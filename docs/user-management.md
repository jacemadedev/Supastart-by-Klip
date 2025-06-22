# User Management

This document explains how user management works in SupaStart, including authentication, organization membership, roles, and permissions.

## Overview

SupaStart implements a multi-tenant system where:

- Users can create and join multiple organizations
- Organizations have members with different roles (owner, admin, member)
- Permissions are role-based with feature-specific controls
- User profiles contain additional metadata beyond auth information

## User Authentication

Authentication is handled by Supabase Auth:

- Email/password authentication
- Email verification
- Password reset functionality
- OAuth providers (optional)

## Database Schema

### User Tables

The user management system uses the following core tables:

#### Auth Users (Built-in)

Supabase's built-in `auth.users` table handles core authentication information:

```sql
-- This is managed by Supabase Auth
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  confirmation_token TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  recovery_token TEXT,
  recovery_sent_at TIMESTAMPTZ,
  ...
);
```

#### Profiles

The `profiles` table extends user information with additional metadata:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ,
  username TEXT UNIQUE,
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);
```

#### Organizations

The `organizations` table represents tenant entities:

```sql
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  credits_balance INTEGER DEFAULT 0
);
```

#### Organization Members

The `organization_members` table creates a many-to-many relationship between users and organizations:

```sql
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_email TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member'))
);

-- Create a unique index to prevent duplicate memberships
CREATE UNIQUE INDEX organization_members_org_user_unique 
ON public.organization_members (organization_id, user_id);
```

## User Registration & Onboarding

The registration flow works as follows:

1. User signs up with email/password
2. Email verification is sent
3. After verification, user is prompted to complete their profile
4. User creates their first organization or accepts an invitation

## Organization Creation

Creating a new organization:

```typescript
async function createOrganization(data: { 
  name: string; 
  slug?: string;
}): Promise<CreateOrganizationResult> {
  const supabase = await createClient();
  
  try {
    // Get the free plan ID
    const { data: freePlan } = await supabase
      .from('plans')
      .select('id')
      .eq('price', 0)
      .single();
      
    if (!freePlan) {
      return { success: false, error: 'Free plan not found' };
    }
    
    // Create the organization
    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        slug: data.slug || slugify(data.name),
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Add the current user as the owner
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        user_id: supabase.auth.userId(),
        role: 'owner'
      });
      
    if (memberError) throw memberError;
    
    // Create subscription with free plan
    await supabase.rpc('change_subscription', {
      org_id: organization.id,
      new_plan_id: freePlan.id
    });
    
    return { success: true, organization };
  } catch (error) {
    console.error('Error creating organization:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create organization' 
    };
  }
}
```

## Member Management

### Adding Members

Organization owners and admins can add new members:

```typescript
async function addMember(
  email: string, 
  role: 'admin' | 'member'
): Promise<AddMemberResult> {
  const supabase = await createClient();
  
  try {
    // Check plan limits for members
    const canAddMember = await checkMemberLimit(organization.id);
    if (!canAddMember) {
      return { 
        success: false, 
        error: 'Member limit reached for your plan'
      };
    }
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();
      
    if (existingUser) {
      // Add existing user directly
      const { error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organization.id,
          user_id: existingUser.id,
          role: role
        });
        
      if (error) throw error;
    } else {
      // Create invitation with pending status
      const { error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organization.id,
          email: email,
          role: role,
          invited_by: supabase.auth.userId()
        });
        
      if (error) throw error;
      
      // Send invitation email
      await sendInvitationEmail(email, organization.name);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error adding member:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to add member'
    };
  }
}
```

### Removing Members

Organization owners and admins can remove members:

```typescript
async function removeMember(memberId: string): Promise<RemoveMemberResult> {
  const supabase = await createClient();
  
  try {
    // Prevent removing the last owner
    const { data: owners } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('role', 'owner');
      
    if (owners.length === 1 && owners[0].id === memberId) {
      return { 
        success: false, 
        error: 'Cannot remove the last owner'
      };
    }
    
    // Remove the member
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organization.id);
      
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error removing member:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to remove member'
    };
  }
}
```

### Updating Member Roles

Organization owners can update member roles:

```typescript
async function updateMemberRole(
  memberId: string, 
  newRole: 'owner' | 'admin' | 'member'
): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Update the member's role
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('organization_id', organization.id);
      
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error updating member role:', error);
    return false;
  }
}
```

### Transferring Ownership

Organization owners can transfer ownership:

```typescript
async function transferOwnership(newOwnerId: string): Promise<boolean> {
  const supabase = await createClient();
  
  try {
    // Begin transaction
    await supabase.rpc('begin_transaction');
    
    // Demote current owner to admin
    const { error: demoteError } = await supabase
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('organization_id', organization.id)
      .eq('user_id', supabase.auth.userId());
      
    if (demoteError) throw demoteError;
    
    // Promote new owner
    const { error: promoteError } = await supabase
      .from('organization_members')
      .update({ role: 'owner' })
      .eq('organization_id', organization.id)
      .eq('user_id', newOwnerId);
      
    if (promoteError) throw promoteError;
    
    // Commit transaction
    await supabase.rpc('commit_transaction');
    
    return true;
  } catch (error) {
    // Rollback transaction
    await supabase.rpc('rollback_transaction');
    console.error('Error transferring ownership:', error);
    return false;
  }
}
```

## Invitations System

The invitation system allows adding users who aren't already registered:

```sql
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '7 days'),
  
  CONSTRAINT valid_invitation_role CHECK (role IN ('admin', 'member'))
);

-- Create a unique index to prevent duplicate invitations
CREATE UNIQUE INDEX organization_invitations_org_email_unique 
ON public.organization_invitations (organization_id, email);
```

The invitation flow works as follows:

1. Admin/owner invites a user by email
2. Invitation record is created
3. Email is sent with an invitation link
4. User clicks the link and either:
   - Creates a new account if they don't have one
   - Logs in to their existing account
5. User accepts the invitation and joins the organization

## Row Level Security

Data is protected by Row Level Security policies:

```sql
-- Organization members can view organization data
CREATE POLICY "Organization members can view organization data" 
ON public.organizations FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
  )
);

-- Users can only manage organizations they own or administer
CREATE POLICY "Users can manage organizations they own or administer" 
ON public.organizations FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
);

-- Only owners can delete organizations
CREATE POLICY "Only owners can delete organizations" 
ON public.organizations FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role = 'owner'
  )
);

-- Users can view their own memberships
CREATE POLICY "Users can view their own memberships" 
ON public.organization_members FOR SELECT TO authenticated 
USING (user_id = auth.uid());

-- Users can view all members in organizations they belong to
CREATE POLICY "Users can view all members in their organizations" 
ON public.organization_members FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members AS om
    WHERE om.organization_id = organization_members.organization_id
    AND om.user_id = auth.uid()
  )
);
```

## UI Components

Key UI components for user management include:

- **OrganizationSwitcher**: Dropdown to switch between organizations
- **UserSettings**: For managing profile information
- **OrganizationSettings**: For managing organization settings
- **MemberList**: For viewing and managing organization members
- **InviteMemberForm**: For inviting new members
- **RoleSelector**: For changing member roles

## Implementation Tips

When extending the user management system:

1. Always enforce RLS policies for new tables related to organizations
2. Add organization_id to any table that contains organization-specific data
3. Implement proper permission checks for both client and server actions
4. Handle edge cases like the last owner trying to leave an organization
5. Use the permission system from permission-system.md for feature access controls 