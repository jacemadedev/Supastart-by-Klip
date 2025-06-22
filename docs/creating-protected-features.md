# Creating Protected Features and Routes

This document provides a step-by-step guide for implementing new features in SupaStart, including creating routes, adding permission controls, and implementing credit checks and deductions.

## Overview

When adding a new feature to SupaStart, you'll need to consider:

1. **Frontend Components**: UI components for the feature
2. **Routes**: Next.js route handling
3. **Permission System**: Controls who can access the feature
4. **Credit System**: Credit checks and deductions for usage
5. **Organization Requirements**: Ensuring the user belongs to an organization

This guide provides a practical approach based on the actual implementation patterns used in existing features like the Chat system.

## Creating a New Feature

### 1. Add the Feature Permission

First, register the feature in the permissions system:

```typescript
// src/lib/organization/permissions.ts
export function getAvailableFeatures(): Array<{id: string, name: string, description: string}> {
  return [
    // ... existing features
    {
      id: "your_feature",
      name: "Your Feature Name",
      description: "Description of your new feature"
    }
  ];
}
```

### 2. Create the Feature UI Components

Create the necessary UI components for your feature:

```tsx
// src/components/dashboard-components/YourFeature/index.tsx
"use client"

import { useState, useEffect } from "react"
import { useOrganizationContext } from "@/contexts/organization-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

// Define interfaces and types for your feature
interface YourFeatureProps {
  // Props for your feature
}

export function YourFeature({ /* props */ }: YourFeatureProps) {
  const [loading, setLoading] = useState(false)
  // Feature-specific state
  
  // Process your feature's logic
  const handleAction = async () => {
    setLoading(true)
    
    try {
      // Call your API endpoint
      const response = await fetch("/api/your-feature", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          // Your feature parameters
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Handle different error types
        if (response.status === 402) {
          toast.error("Insufficient credits to use this feature")
        } else {
          toast.error(data.error || "An error occurred")
        }
        return
      }
      
      // Handle successful response
      toast.success("Feature executed successfully")
      // Update UI as needed
      
    } catch (error) {
      console.error("Error:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Card className="flex flex-1 flex-col min-h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] border-none shadow-none bg-transparent relative mx-auto max-w-4xl w-full">
      <CardContent className="flex flex-1 flex-col p-0 overflow-hidden">
        {/* Your feature UI */}
        <Button 
          onClick={handleAction} 
          disabled={loading}
        >
          {loading ? "Processing..." : "Use Feature"}
        </Button>
      </CardContent>
    </Card>
  )
}

// Export additional components for your feature
// ...
```

### 3. Create the Feature Page

Create a page for your feature using the Next.js App Router:

```tsx
// src/app/dashboard/your-feature/page.tsx
"use client"

import { useState, useEffect } from "react"
import { YourFeature } from "@/components/dashboard-components/YourFeature"
import { useOrganizationContext } from "@/contexts/organization-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, AlertTriangle } from "lucide-react"
import { canMemberUseFeature } from "@/lib/organization/permissions"
import { Skeleton } from "@/components/ui/skeleton"

export default function YourFeaturePage() {
  const { organization, userRole, loading: orgLoading } = useOrganizationContext()
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  
  // Calculate permission status
  const canUseFeature = canMemberUseFeature(organization, userRole, "your_feature")
  
  // Set permissions loading state when organization data changes
  useEffect(() => {
    if (!orgLoading && organization && userRole !== null) {
      // Short delay to ensure smooth transition and avoid flashing
      const timer = setTimeout(() => {
        setPermissionsLoading(false)
      }, 300)
      
      return () => clearTimeout(timer)
    }
  }, [organization, userRole, orgLoading])
  
  // Skeleton loading component for feature UI
  const YourFeatureSkeleton = () => (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-20" />
      </div>
      
      {/* Main content skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      
      {/* Action buttons skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
  
  // Show skeleton loading while checking permissions
  if (permissionsLoading) {
    return (
      <div className="grid gap-4 w-full">
        <YourFeatureSkeleton />
      </div>
    )
  }
  
  // Permission denied UI
  if (!canUseFeature) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to access this feature. 
            Please contact your organization administrator.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  // Return your feature UI
  return <YourFeature />
}
```

### 4. Add to Navigation

Add your feature to the dashboard navigation:

```tsx
// In your navigation component (e.g., src/components/dashboard/sidebar.tsx)
const navigationItems = [
  // ... existing items
  {
    title: "Your Feature",
    url: "/dashboard/your-feature",
    icon: YourFeatureIcon,
    permissionRequired: "your_feature" // This enables permission-based filtering
  }
];
```

## Implementing API Protection

### 1. Update Credit Constants

First, define credit constants for your feature:

```typescript
// src/lib/supabase/creditConstants.ts
// Add to CREDIT_COSTS
export const CREDIT_COSTS = {
  // ... existing costs
  YOUR_FEATURE: {
    BASIC: 5,
    PREMIUM: 10
  }
};

// Add to CREDIT_DESCRIPTIONS
export const CREDIT_DESCRIPTIONS = {
  // ... existing descriptions
  YOUR_FEATURE_BASIC: "Your Feature (Basic)",
  YOUR_FEATURE_PREMIUM: "Your Feature (Premium)"
};

// Create a helper function to calculate cost for your feature
export function calculateYourFeatureCost(options: { premium?: boolean }): number {
  return options.premium 
    ? CREDIT_COSTS.YOUR_FEATURE.PREMIUM 
    : CREDIT_COSTS.YOUR_FEATURE.BASIC;
}
```

### 2. Create an API Route

Implement your API route with proper authentication, permission checks, and credit deduction:

```typescript
// src/app/api/your-feature/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndDeductCredits, getUserAndOrganization } from "@/lib/supabase/credits";
import { 
  CREDIT_ERRORS, 
  calculateYourFeatureCost, 
  CREDIT_DESCRIPTIONS 
} from "@/lib/supabase/creditConstants";
import { canMemberUseFeature } from "@/lib/organization/permissions";

export async function POST(request: Request) {
  try {
    // Parse the request body
    const { options = {} } = await request.json();
    
    // Create Supabase client
    const supabase = await createClient();
    
    // 1. Get user and organization
    const userOrg = await getUserAndOrganization(supabase);
    
    if (!userOrg.success) {
      return NextResponse.json(
        { error: userOrg.error || "Authentication error" },
        { status: userOrg.status || 401 }
      );
    }
    
    // 2. Verify the user has permission to use this feature
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', userOrg.organizationId)
      .eq('user_id', userOrg.user.id)
      .single();
    
    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }
    
    // 3. Get organization details for permission check
    const { data: organization } = await supabase
      .from('organizations')
      .select('*, settings')
      .eq('id', userOrg.organizationId)
      .single();
    
    // Check permission
    const hasPermission = canMemberUseFeature(
      organization,
      membership.role,
      "your_feature"
    );
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    
    // 4. Calculate credit cost based on options
    const isPremium = options.premium === true;
    const creditCost = calculateYourFeatureCost({ premium: isPremium });
    const description = isPremium 
      ? CREDIT_DESCRIPTIONS.YOUR_FEATURE_PREMIUM 
      : CREDIT_DESCRIPTIONS.YOUR_FEATURE_BASIC;
    
    // 5. Check and deduct credits
    const creditResult = await checkAndDeductCredits(
      supabase,
      userOrg.organizationId,
      creditCost,
      description
    );
    
    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error || CREDIT_ERRORS.INSUFFICIENT },
        { status: 402 } // Payment required status code
      );
    }
    
    // 6. Execute your feature's main logic here
    // ... Your feature's core functionality
    
    // 7. Return the result
    return NextResponse.json({
      success: true,
      message: "Feature executed successfully",
      credits: {
        cost: creditCost,
        remaining: creditResult.newBalance
      },
      // Feature-specific result data
      result: {
        // ...feature output
      }
    });
  } catch (error) {
    console.error("Error in your feature API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

### 3. Implementing a Supabase Edge Function (Alternative)

If you prefer using a Supabase Edge Function instead of a Next.js API route:

```typescript
// supabase/functions/your-feature/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Define credit costs and constants here or import from a shared module
const CREDIT_COSTS = {
  BASIC: 5,
  PREMIUM: 10
};

Deno.serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Initialize Supabase client with auth from request
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
    
    // Parse request
    const { options = {} } = await req.json();
    
    // 1. Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // 2. Get organization and membership
    const { data: currentOrg } = await supabaseClient
      .from('current_organization')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();
    
    if (!currentOrg) {
      return new Response(
        JSON.stringify({ error: 'No organization selected' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get organization details
    const { data: org } = await supabaseClient
      .from('organizations')
      .select('*, settings')
      .eq('id', currentOrg.organization_id)
      .single();
    
    // Get member role
    const { data: member } = await supabaseClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', currentOrg.organization_id)
      .eq('user_id', user.id)
      .single();
    
    if (!member) {
      return new Response(
        JSON.stringify({ error: 'Not a member of this organization' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // 3. Check feature permission
    const hasPermission = 
      member.role === 'owner' || 
      member.role === 'admin' || 
      (org.settings?.member_permissions?.your_feature === true);
    
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Permission denied' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // 4. Calculate credit cost
    const creditCost = options.premium ? CREDIT_COSTS.PREMIUM : CREDIT_COSTS.BASIC;
    
    // 5. Check and deduct credits
    const { data: creditResult, error: creditError } = await supabaseClient.rpc(
      'use_organization_credits_safe',
      {
        org_id: currentOrg.organization_id,
        amount: creditCost,
        description: `Your Feature (${options.premium ? 'Premium' : 'Basic'})`,
        feature_id: 'your_feature'
      }
    );
    
    if (creditError || !creditResult) {
      return new Response(
        JSON.stringify({ 
          error: creditError?.message || 'Insufficient credits' 
        }),
        { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // 6. Run your feature logic here
    
    // 7. Return results
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feature executed successfully',
        // Your feature-specific results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

## Frontend Integration

### Using the Custom React Hook Pattern

For more complex features, consider creating a custom hook to manage API interactions:

```typescript
// src/hooks/use-your-feature.ts
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface YourFeatureOptions {
  premium?: boolean;
  // Other options specific to your feature
}

interface YourFeatureResult {
  success: boolean;
  error?: string;
  data?: any;
}

export function useYourFeature() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const executeFeature = async (options: YourFeatureOptions): Promise<YourFeatureResult> => {
    setLoading(true);
    
    try {
      const response = await fetch("/api/your-feature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ options })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error types
        if (response.status === 402) {
          toast.error("Insufficient credits");
          return {
            success: false,
            error: "Insufficient credits"
          };
        }
        
        toast.error(data.error || "An error occurred");
        return {
          success: false,
          error: data.error || "Failed to execute feature"
        };
      }
      
      // Force UI refresh to show updated credit balance
      router.refresh();
      
      return {
        success: true,
        data: data.result
      };
    } catch (error) {
      console.error("Error executing feature:", error);
      
      toast.error("An unexpected error occurred");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    } finally {
      setLoading(false);
    }
  };
  
  return {
    loading,
    executeFeature
  };
}
```

Then use this hook in your component:

```tsx
import { useYourFeature } from "@/hooks/use-your-feature";

function YourFeatureComponent() {
  const { loading, executeFeature } = useYourFeature();
  
  const handleAction = async () => {
    const result = await executeFeature({
      premium: true // or other options
    });
    
    if (result.success) {
      // Handle success
    }
  };
  
  return (
    <div>
      <Button 
        onClick={handleAction}
        disabled={loading}
      >
        {loading ? "Processing..." : "Use Feature"}
      </Button>
    </div>
  );
}
```

## Credit System Integration

### 1. Using the Credit Hook (Advanced Usage)

For components that need more direct control over credit operations:

```tsx
import { useCreditOperations } from "@/hooks/use-credit-operations";

function YourAdvancedFeatureComponent() {
  const { useCredits, hasEnoughCredits, isProcessing } = useCreditOperations();
  
  const handlePremiumAction = async () => {
    // First check if the user has enough credits
    if (!hasEnoughCredits(10)) {
      toast.error("Insufficient credits for this operation");
      return;
    }
    
    // Manually deduct credits
    const creditResult = await useCredits({
      amount: 10,
      description: "Premium Feature Usage",
      featureId: "your_feature_premium"
    });
    
    if (!creditResult.success) {
      // Handle credit deduction failure
      return;
    }
    
    // Proceed with the feature operation now that credits are deducted
    // ...
  };
  
  return (
    <div>
      <Button 
        onClick={handlePremiumAction}
        disabled={isProcessing}
      >
        Use Premium Feature (10 Credits)
      </Button>
    </div>
  );
}
```

### 2. Credit Refunds

For operations that might fail after credits are deducted, implement refunds:

```typescript
// In your API route
async function refundCredits(
  supabase: SupabaseClient,
  organizationId: string,
  amount: number,
  description: string
) {
  try {
    const { error } = await supabase.rpc(
      "add_organization_credits_safe",
      {
        org_id: organizationId,
        amount: amount,
        description,
        transaction_type: "refund"
      }
    );
    
    if (error) {
      console.error("Error refunding credits:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Exception refunding credits:", error);
    return false;
  }
}

// Example usage in your API route
// If an operation fails after deducting credits:
if (operationFailed) {
  await refundCredits(
    supabase,
    userOrg.organizationId,
    creditCost,
    `Refund: ${description} (operation failed)`
  );
}
```

## Best Practices

### 1. Error Handling

Follow this pattern for comprehensive error handling:

```typescript
try {
  // Your operation
} catch (error) {
  console.error("Error:", error);
  
  // Specific error handling
  if (error instanceof SpecificError) {
    // Handle specific error type
  }
  
  // Generic user-facing error
  toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
  
  // Return structured error
  return {
    success: false,
    error: error instanceof Error ? error.message : "Unknown error"
  };
}
```

### 2. Loading States and Progress Indicators

Always provide clear loading states:

```tsx
// In your component
const [loading, setLoading] = useState(false);

// When making API calls
setLoading(true);
try {
  // API operation
} finally {
  setLoading(false);
}

// In your UI
<Button disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </>
  ) : (
    "Submit"
  )}
</Button>
```

### 3. Credit Status Display

Display credit costs and status in your UI:

```tsx
function CreditCostIndicator({ cost, hasEnoughCredits }: { cost: number, hasEnoughCredits: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm">
        Cost: {cost} {cost === 1 ? "credit" : "credits"}
      </span>
      {!hasEnoughCredits && (
        <Badge variant="destructive" className="text-xs">
          Insufficient credits
        </Badge>
      )}
    </div>
  );
}
```

### 4. Consistent Permission Checks

Ensure permissions are checked consistently across UI and API:

```typescript
// In UI components
const canUseFeature = canMemberUseFeature(organization, userRole, "your_feature");

// In API routes
const hasPermission = canMemberUseFeature(organization, memberRole, "your_feature");
```

## Testing Your Protected Feature

### 1. Test Different User Roles

Create test accounts with different roles to verify permissions:

- Owner: Should have access to all features
- Admin: Should have access to all features
- Member with permission: Should have access to the feature
- Member without permission: Should see access denied message

### 2. Test Credit Scenarios

Test various credit scenarios:

- With sufficient credits: Feature should work normally
- With insufficient credits: Should show appropriate error
- Edge case: Using exactly the available credits amount
- With no credits: Should show insufficient credits message

### 3. Error Cases

Test different error cases:

- Network failures
- Server errors
- Concurrent operations
- Invalid input parameters

By following this guide, you can create a robust, well-protected feature that integrates seamlessly with SupaStart's permission and credit systems. 