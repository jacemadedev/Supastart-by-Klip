# Permission-Based Role System

This document explains how the permission-based role system works in the SupaStart application and how to extend it for new features.

## Overview

SupaStart uses a role-based permission system with feature-specific controls:

- **Role Hierarchy**: Users have roles (owner, admin, member) with different default permissions
- **Feature Controls**: Specific features can be enabled/disabled for regular members
- **UI Integration**: UI components conditionally render based on permissions
- **Loading States**: Skeleton loading handles the data-fetching period

## Role Hierarchy

The application has three roles with increasing privileges:

| Role | Description | Access Level |
|------|-------------|--------------|
| **Owner** | Organization creator or designated owner | Full access to all features and settings |
| **Admin** | Designated administrator | Full access to features, limited organization settings |
| **Member** | Regular team member | Access controlled by permission settings |

Owners and admins **always** have access to all features. Permission toggles only affect regular members.

## Permission Storage

Permissions are stored in the organization settings:

```typescript
// Organization Schema
{
  // ...other fields
  settings: {
    member_permissions: {
      "chat": true,       // Member can access chat
      "history": false,   // Member cannot access history
      "files": true       // Member can access files
      // ...other features
    }
    // ...other settings
  }
}
```

## Available Features

Features that can be toggled are defined in `getAvailableFeatures()` in `src/lib/organization/permissions.ts`:

```typescript
export function getAvailableFeatures(): Array<{id: string, name: string, description: string}> {
  return [
    {
      id: "chat",
      name: "Chat",
      description: "Access to the AI chat feature"
    },
    {
      id: "agents",
      name: "AI Agents",
      description: "Access to advanced AI agent mode with specialized capabilities"
    },
    {
      id: "magic_ads",
      name: "Magic Ads",
      description: "Access to AI-powered advertisement creation and editing"
    },
    {
      id: "history",
      name: "Chat History",
      description: "View past conversation history"
    },
    {
      id: "files",
      name: "File Management",
      description: "Upload and manage files"
    },
    {
      id: "analytics",
      name: "Analytics",
      description: "View organization analytics"
    }
  ];
}
```

## Permission Checking

The core permission check uses the `canMemberUseFeature()` function:

```typescript
function canMemberUseFeature(
  organization: Organization | null,
  userRole: string | null,
  feature: string
): boolean {
  // If no organization or role, deny access
  if (!organization || !userRole) return false;
  
  // Owners and admins always have access to all features
  if (userRole === 'owner' || userRole === 'admin') return true;
  
  // For regular members, check settings
  if (organization.settings?.member_permissions) {
    return organization.settings.member_permissions[feature] === true;
  }
  
  // Default to true for backward compatibility
  return true;
}
```

## Managing Permissions

Owners can configure member permissions through the `PermissionManager` component, which provides toggle switches for each available feature.

## Permission Check Strategies

There are two main approaches for implementing permission checks:

### 1. Navigation-Level Filtering (Recommended)

Hide features from navigation for unauthorized users while allowing page access:

```tsx
// In sidebar navigation
const filteredNavItems = data.navMain
  .filter(item => {
    // If no permission required, show the item
    if (!item.permissionRequired) return true
    
    // Check if user has permission for this feature
    return canMemberUseFeature(organization, userRole, item.permissionRequired)
  })
```

### 2. Action-Level Checking (Best Practice)

Check permissions when users attempt to use features, not on page load:

```tsx
function FeatureComponent() {
  const { organization, userRole } = useOrganizationContext();
  
  const handleFeatureAction = async () => {
    // Check permission before proceeding
    if (!canMemberUseFeature(organization, userRole, "your_feature")) {
      toast.error("You don't have permission to use this feature. Please contact your organization owner for access.");
      return;
    }
    
    // Proceed with the action
    await performFeatureAction();
  };
  
  return (
    <div>
      <Button onClick={handleFeatureAction}>
        Use Feature
      </Button>
    </div>
  );
}
```

### ❌ Avoid: Page-Level Blocking

**Don't** block entire pages based on permissions as this causes poor UX with flashing screens:

```tsx
// DON'T DO THIS - causes flashing and poor UX
function FeatureComponent() {
  const { organization, userRole, loading } = useOrganizationContext();
  
  if (loading) {
    return <Skeleton />; // Causes flashing
  }
  
  if (!canMemberUseFeature(organization, userRole, "feature")) {
    return <AccessDenied />; // Bad UX - blocks entire page
  }
  
  return <FeatureContent />;
}
```

## How to Add a New Feature with Permission Control

Follow these steps to add a new feature with permission control:

### 1. Add the Feature to Available Features

Update the `getAvailableFeatures()` function in `src/lib/organization/permissions.ts`:

```typescript
export function getAvailableFeatures() {
  return [
    // ... existing features
    {
      id: "your_new_feature",
      name: "Your New Feature",
      description: "Description of your new feature"
    }
  ];
}
```

### 2. Add Navigation Permission Requirement

Add the `permissionRequired` property to your navigation item:

```tsx
// In sidebar navigation data
{
  title: "Your Feature",
  url: "/dashboard/your-feature",
  icon: YourIcon,
  permissionRequired: "your_new_feature"
}
```

### 3. Implement Action-Level Permission Checks

Check permissions when users attempt to use the feature:

```tsx
import { canMemberUseFeature } from "@/lib/organization/permissions";
import { useOrganizationContext } from "@/contexts/organization-context";
import { toast } from "sonner";

function YourFeatureComponent() {
  const { organization, userRole } = useOrganizationContext();
  
  const handleFeatureAction = async () => {
    // Check permission before proceeding
    if (!canMemberUseFeature(organization, userRole, "your_new_feature")) {
      toast.error("You don't have permission to use this feature. Please contact your organization owner for access.");
      return;
    }
    
    // Proceed with the feature action
    try {
      await performYourFeatureAction();
      toast.success("Action completed successfully!");
    } catch (error) {
      toast.error("Failed to perform action");
    }
  };
  
  return (
    <div>
      <Button onClick={handleFeatureAction}>
        Use Your Feature
      </Button>
    </div>
  );
}
```

### 4. Add Server-Side Protection

For complete security, implement server-side checks in your API routes:

```typescript
// Example API route or Edge Function
export async function POST(req: Request) {
  // Get current user and organization
  const user = await getUser();
  const organization = await getOrganization();
  const userRole = await getUserRole(user.id, organization.id);
  
  // Check permission
  const hasPermission = canMemberUseFeature(
    organization,
    userRole,
    "your_new_feature"
  );
  
  if (!hasPermission) {
    return new Response(JSON.stringify({ error: "Permission denied" }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Process the request if authorized
  // ...
}
```

## Best Practices

1. **Navigation-Level Filtering**: Hide unauthorized features from navigation to prevent confusion
2. **Action-Level Checking**: Check permissions when users attempt actions, not on page load
3. **Avoid Page Blocking**: Don't block entire pages as it causes flashing and poor UX
4. **Clear Error Messages**: Use toast notifications for permission errors with helpful guidance
5. **Server-Side Validation**: Always validate permissions on the server for security
6. **Default to Restrictive**: When in doubt, default to denying access
7. **Consistent Patterns**: Use the same permission checking pattern across all features
8. **Documentation**: Document new permissions when adding features

## Real-World Examples

### ✅ Good: Chat Feature Implementation
```tsx
// Navigation filtering (sidebar)
{
  title: "Chat",
  url: "/dashboard/chat",
  icon: Send,
  permissionRequired: "chat"
}

// Action-level checking (when sending message)
const handleSendMessage = async (message: string) => {
  if (!canMemberUseFeature(organization, userRole, "chat")) {
    toast.error("You don't have permission to use chat. Please contact your organization owner.");
    return;
  }
  
  // Proceed with sending message
  await sendMessage(message);
};
```

### ✅ Good: Magic Ads Feature Implementation
```tsx
// Navigation filtering (sidebar)
{
  title: "Magic Ads",
  url: "/dashboard/magic-ads",
  icon: Sparkles,
  permissionRequired: "magic_ads"
}

// Action-level checking (when generating ad)
const handleAdCreation = async (prompt: string) => {
  if (!canMemberUseFeature(organization, userRole, "magic_ads")) {
    toast.error("You don't have permission to use Magic Ads. Please contact your organization owner.");
    return;
  }
  
  // Proceed with ad generation
  await generateAd(prompt);
};
``` 