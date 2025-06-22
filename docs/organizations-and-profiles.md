# Organizations and Profiles System

This document provides an in-depth explanation of how organizations and user profiles work in SupaStart, covering data structure, relationships, and implementation details.

## Core Concepts

SupaStart implements a multi-tenant system with these core entities:

1. **Profiles**: Extended user information beyond auth data
2. **Organizations**: The primary tenant entity representing a team or company
3. **Organization Members**: The relationship between users and organizations with roles

## Profile Management

### Profile Structure

User profiles extend the built-in Supabase auth.users table:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  username TEXT UNIQUE,
  
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Ensure profile exists for each user
CREATE TRIGGER create_profile_for_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();
```

The trigger function automatically creates a profile for each new user:

```sql
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    LOWER(SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle username collision by appending random numbers
    INSERT INTO public.profiles (id, full_name, avatar_url, username)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.raw_user_meta_data->>'avatar_url',
      LOWER(SPLIT_PART(NEW.email, '@', 1)) || FLOOR(RANDOM() * 1000)
    );
    RETURN NEW;
END;
$$;
```

### Profile Management

Profiles are managed through the profiles service:

```typescript
// src/lib/profiles.ts
export async function updateProfile(
  profileData: Partial<Profile>
): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const user = supabase.auth.user();
  
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
      
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update profile' 
    };
  }
}
```

## Organizations System

### Organization Structure

Organizations are the core tenant entity:

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

The settings JSONB field contains configurable options including member permissions:

```json
{
  "member_permissions": {
    "chat": true,
    "history": false,
    "files": true,
    "analytics": false
  },
  "branding": {
    "primary_color": "#4f46e5",
    "logo_position": "left"
  },
  "notifications": {
    "email_digest": "weekly",
    "slack_integration": false
  }
}
```

### Organization Members

The relationship between users and organizations is managed through the `organization_members` table:

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

## Organization Context

A React context provides organization data to the application:

```tsx
// src/contexts/organization-context.tsx
export const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  
  // Fetch user's organizations on mount
  useEffect(() => {
    fetchOrganizations();
  }, []);
  
  // Update organization state when selection changes
  const updateOrganizationState = async () => {
    setLoading(true);
    
    try {
      if (!organization) {
        setLoading(false);
        return;
      }
      
      // Fetch fresh organization data
      const { data: freshOrg, error } = await supabase
        .from('organizations')
        .select(`
          *,
          subscription:subscriptions(
            id,
            plan_id,
            status,
            current_period_end,
            cancel_at_period_end,
            plan:plans(
              id, 
              name, 
              price,
              features,
              credits_per_period
            )
          )
        `)
        .eq('id', organization.id)
        .single();
      
      if (error) throw error;
      
      // Get the user's role in this organization
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization.id)
        .eq('user_id', supabase.auth.userId())
        .single();
      
      if (memberError) throw memberError;
      
      // Update state
      setOrganization(freshOrg);
      setUserRole(membership.role);
    } catch (error) {
      console.error('Error updating organization state:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Other methods like switchOrganization, createOrganization, etc.
  
  return (
    <OrganizationContext.Provider value={{
      organization,
      organizations,
      members,
      userRole,
      loading,
      membersLoading,
      isOwner: userRole === 'owner',
      isAdmin: userRole === 'owner' || userRole === 'admin',
      switchOrganization,
      updateOrganizationState,
      fetchOrganizations,
      fetchMembers,
      addMember,
      removeMember,
      updateMemberRole,
      createOrganization,
      updateOrganization,
      leaveOrganization,
      deleteOrganization,
      // ...other methods
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

// Custom hook for using the organization context
export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  
  if (context === undefined) {
    throw new Error("useOrganizationContext must be used within an OrganizationProvider");
  }
  
  return context;
}
```

## Current Organization Tracking

The system tracks the user's current/active organization:

```sql
CREATE TABLE public.current_organization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  
  CONSTRAINT unique_user_current_org UNIQUE (user_id)
);
```

When a user switches organizations, the current organization is updated:

```typescript
async function switchOrganization(orgId: string): Promise<{success: boolean, error?: string}> {
  const supabase = await createClient();
  
  try {
    // Verify user is a member of this organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', supabase.auth.userId())
      .single();
    
    if (memberError || !membership) {
      return { success: false, error: 'You are not a member of this organization' };
    }
    
    // Update current organization
    const { error } = await supabase
      .from('current_organization')
      .upsert({
        user_id: supabase.auth.userId(),
        organization_id: orgId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (error) throw error;
    
    // Fetch the organization data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();
    
    if (orgError) throw orgError;
    
    // Update state
    setOrganization(org);
    
    // Also update the full organization state (includes subscription, etc.)
    await updateOrganizationState();
    
    return { success: true };
  } catch (error) {
    console.error('Error switching organization:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to switch organization' 
    };
  }
}
```

## Default Organization Creation

First-time users automatically get an organization:

```typescript
async function createDefaultOrganization() {
  // Get user information
  const { data: user } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  // Extract name from email or use "My Organization"
  const orgName = user.email ? 
    `${user.email.split('@')[0]}'s Organization` : 
    'My Organization';
  
  // Create the organization
  const result = await createOrganization({
    name: orgName
  });
  
  return result.success ? result.organization : null;
}
```

## Organization Settings

Organization settings are managed through settings components:

```tsx
// Simplified version of organization settings component
function OrganizationSettings() {
  const { organization, updateOrganization, isOwner } = useOrganizationContext();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    logo_url: ''
  });
  
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        description: organization.description || '',
        website: organization.website || '',
        logo_url: organization.logo_url || ''
      });
    }
  }, [organization]);
  
  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const result = await updateOrganization(formData);
    
    if (result.success) {
      toast.success('Organization updated successfully');
    } else {
      toast.error(result.error || 'Failed to update organization');
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button type="submit" disabled={!isOwner}>Save Changes</Button>
    </form>
  );
}
```

## Organization Slug and URLs

Each organization has a unique slug used in URLs:

```typescript
// Generate a URL-friendly slug from the organization name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 32);
}

// When creating an organization, a slug is generated
async function createOrganization(data: {
  name: string;
  slug?: string;
}): Promise<CreateOrganizationResult> {
  try {
    // Create the organization
    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        slug: data.slug || slugify(data.name),
      })
      .select()
      .single();
      
    // Rest of function...
  }
}
```

## Organization Deletion

Organizations can be deleted by owners:

```typescript
async function deleteOrganization(): Promise<DeleteOrganizationResult> {
  if (!organization) {
    return { success: false, error: 'No organization selected' };
  }
  
  // Only owners can delete organizations
  if (userRole !== 'owner') {
    return { success: false, error: 'Only owners can delete organizations' };
  }
  
  try {
    // Delete the organization (cascades to members and subscription)
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', organization.id);
    
    if (error) throw error;
    
    // Remove from local state
    setOrganizations(prev => prev.filter(org => org.id !== organization.id));
    setOrganization(null);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting organization:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete organization' 
    };
  }
}
```

## Row Level Security

Organizations and profiles have Row Level Security policies:

```sql
-- Users can see their own profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE USING (id = auth.uid());

-- Organization members can view organization data
CREATE POLICY "Organization members can view organization data" 
ON public.organizations 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
  )
);

-- Only owners and admins can update organizations
CREATE POLICY "Only owners and admins can update organizations" 
ON public.organizations 
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role IN ('owner', 'admin')
  )
);
```

## Implementation Tips

When working with organizations and profiles:

1. **Use the Organization Context**: Always access organization data through the context to ensure consistency.

2. **RLS Policies**: Every table containing organization data should have RLS policies referencing the organization_members table.

3. **Transactions**: When performing multi-step operations, use database transactions to maintain data integrity.

4. **Role Checking**: Implement role checks in both UI and backend:
   ```tsx
   // UI check example
   {isOwner && <OwnerOnlyComponent />}
   
   // Backend check example
   if (userRole !== 'owner') {
     return { success: false, error: 'Only owners can perform this action' };
   }
   ```

5. **Handle Edge Cases**: Make sure to handle scenarios like:
   - User being removed from an organization
   - Last owner trying to leave an organization
   - Organization being deleted
   
6. **Organization Switching**: Implement a clear UI for switching between organizations with proper state management.

7. **Profile Completeness**: Encourage users to complete their profiles for better collaboration within organizations. 