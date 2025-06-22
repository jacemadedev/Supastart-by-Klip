# Credits System

This document explains how the SupaStart credits system works, including how credits are allocated, tracked, and used within the application.

## Overview

SupaStart uses a credits-based system to control usage of premium features:

- Credits are allocated to organizations based on their subscription plan
- Credits are consumed when using certain features
- Credit balances reset at the beginning of each billing period
- Credits can be viewed and managed through the dashboard

## Credit Structure

Credits are managed through the `organization_credits` table, which tracks individual credit transactions:

```typescript
interface OrganizationCredit {
  id: string;
  organization_id: string;
  amount: number;          // Credit amount (positive for additions, negative for usage)
  description: string;     // Human-readable description of the transaction
  transaction_type: 'add' | 'use' | 'refund'; // Type of transaction
  feature_id?: string;     // Feature that consumed the credits (for 'use' transactions)
  created_at: Date;        // When the transaction occurred
  created_by?: string;     // User ID who initiated the transaction (if applicable)
}
```

The current credit balance is also stored directly in the `organizations` table for quick access:

```sql
ALTER TABLE organizations
ADD COLUMN credits_balance INTEGER NOT NULL DEFAULT 0;
```

## Credit Allocation

### Initial Allocation

When a user first subscribes to a plan, they receive the plan's allocated credits:

```sql
-- Function to assign initial plan credits
CREATE OR REPLACE FUNCTION public.assign_initial_plan_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  credits_to_add integer;
  plan_info record;
BEGIN
  -- Only proceed for new subscriptions
  IF (TG_OP = 'INSERT') THEN
    -- Get the plan information for this subscription
    SELECT p.credits_per_period, p.name 
    INTO plan_info
    FROM plans p 
    WHERE p.id = NEW.plan_id;
    
    credits_to_add := plan_info.credits_per_period;
    
    -- Add initial credits
    PERFORM public.add_organization_credits(
      NEW.organization_id,
      credits_to_add,
      'Initial credits: ' || plan_info.name || ' plan',
      'add'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for initial credit assignment
CREATE TRIGGER on_subscription_create
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_initial_plan_credits();
```

### Periodic Renewal

Credits are renewed at the beginning of each billing period:

```sql
-- Function to reset organization credits
CREATE OR REPLACE FUNCTION public.reset_organization_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  credits_to_add integer;
  plan_info record;
BEGIN
  -- Get the plan information for this subscription
  SELECT p.credits_per_period, p.name 
  INTO plan_info
  FROM plans p 
  WHERE p.id = NEW.plan_id;
  
  -- Only proceed if we're dealing with a renewal (new period starts)
  IF (TG_OP = 'UPDATE' AND 
      OLD.current_period_end != NEW.current_period_end AND 
      NEW.status = 'active') THEN
    
    -- Get credits to add based on plan
    credits_to_add := plan_info.credits_per_period;
    
    -- Important: Special handling for downgrades
    IF (OLD.plan_id != NEW.plan_id OR 
        EXISTS (
          SELECT 1 FROM system_logs 
          WHERE organization_id = NEW.organization_id 
          AND event_type = 'subscription.downgrade'
          AND created_at > (NEW.current_period_end - INTERVAL '1 month')
        )) THEN
      -- Reset credits completely rather than adding
      UPDATE organizations
      SET credits_balance = credits_to_add
      WHERE id = NEW.organization_id;
      
      -- Record the reset transaction
      INSERT INTO organization_credits (
        organization_id,
        amount,
        description,
        transaction_type
      ) VALUES (
        NEW.organization_id,
        credits_to_add,
        'Reset credits: ' || plan_info.name || ' plan (on downgrade)',
        'add'
      );
      
    ELSE
      -- Add reset credits through the existing function
      PERFORM public.add_organization_credits(
        NEW.organization_id,
        credits_to_add,
        'Plan reset: ' || plan_info.name || ' plan credits for new billing period',
        'add'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for subscription renewals
CREATE TRIGGER on_subscription_renewal
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_organization_credits();
```

## Using Credits

Credits are consumed when using certain features in the application:

```typescript
// Example of using credits in application code
async function consumeCreditsForFeature(
  organizationId: string,
  amount: number,
  featureId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  // Check and consume credits in one atomic transaction
  const { data, error } = await supabase.rpc('use_organization_credits_safe', {
    org_id: organizationId,
    amount: amount,
    description: `Used ${amount} credits for ${featureId}`,
    feature_id: featureId
  });
  
  if (error || !data) {
    console.error('Failed to consume credits:', error);
    return false;
  }
  
  return data;
}
```

The `use_organization_credits_safe` function handles credit usage:

```sql
-- Function to safely use organization credits with permission check
CREATE OR REPLACE FUNCTION public.use_organization_credits_safe(
  org_id UUID,
  amount INTEGER,
  description TEXT,
  feature_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
  is_member BOOLEAN;
  available_credits INTEGER;
BEGIN
  -- Get current user ID
  user_id := auth.uid();
  
  -- Verify the user is a member of the organization
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  ) INTO is_member;
  
  -- If not a member, return false
  IF NOT is_member THEN
    RETURN false;
  END IF;
  
  -- Get available credits
  SELECT public.get_organization_credits(org_id) INTO available_credits;
  
  -- Check if enough credits
  IF available_credits >= amount THEN
    -- Record credit usage
    INSERT INTO organization_credits (
      organization_id, 
      amount,
      description,
      transaction_type,
      feature_id,
      created_by
    ) VALUES (
      org_id,
      -amount, -- Negative amount for usage
      description,
      'use',
      feature_id,
      user_id
    );
    
    -- Update credits balance on organization
    UPDATE organizations
    SET credits_balance = available_credits - amount
    WHERE id = org_id;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;
```

## Credit Balance Calculation

The current credit balance is calculated as the sum of all credit transactions:

```sql
-- Function to get the current credit balance for an organization
CREATE OR REPLACE FUNCTION public.get_organization_credits(org_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM organization_credits
  WHERE organization_id = org_id;
$$;
```

For efficiency, this balance is also stored directly in the `organizations` table and updated via trigger:

```sql
-- Trigger function to update the organization credits balance
CREATE OR REPLACE FUNCTION public.update_organization_credits_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
  new_balance INTEGER;
BEGIN
  -- Get the organization ID
  org_id := NEW.organization_id;
  
  -- Calculate new balance
  SELECT public.get_organization_credits(org_id) INTO new_balance;
  
  -- Update organization credits balance
  UPDATE organizations
  SET credits_balance = new_balance
  WHERE id = org_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on organization_credits
CREATE TRIGGER on_organization_credits_change
  AFTER INSERT OR DELETE ON public.organization_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_credits_balance();
```

## Managing Credits

### Adding Credits

Administrators can add credits manually:

```sql
-- Function to add credits to an organization
CREATE OR REPLACE FUNCTION public.add_organization_credits(
  org_id UUID,
  amount INTEGER,
  description TEXT,
  transaction_type TEXT DEFAULT 'add'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Get current user ID
  user_id := auth.uid();
  
  -- Insert credit transaction
  INSERT INTO organization_credits (
    organization_id,
    amount,
    description,
    transaction_type,
    created_by
  ) VALUES (
    org_id,
    amount,
    description,
    transaction_type,
    user_id
  );
  
  RETURN true;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;
```

### Refunding Credits

Unused credits from certain operations can be refunded:

```sql
-- Example of refunding credits after an operation is canceled
INSERT INTO organization_credits (
  organization_id,
  amount,
  description,
  transaction_type,
  feature_id,
  created_by
) VALUES (
  org_id,
  refund_amount, -- Positive amount for refund
  'Refunded credits for canceled operation',
  'refund',
  feature_id,
  user_id
);
```

## Credit Usage Analytics

The `organization_credits` table allows for detailed analytics of credit usage:

```sql
-- Example query to analyze credit usage by feature
SELECT 
  feature_id,
  SUM(ABS(amount)) as total_used,
  COUNT(*) as usage_count
FROM organization_credits
WHERE 
  organization_id = your_org_id AND
  transaction_type = 'use' AND
  created_at >= (NOW() - INTERVAL '30 days')
GROUP BY feature_id
ORDER BY total_used DESC;
```

## Credits UI

The credits UI is displayed in the dashboard and includes:

- Current credit balance
- Credit usage history
- Credit consumption by feature
- Credit renewal date

## Security Considerations

Credits are protected by Row Level Security policies:

```sql
-- Credits can be viewed by organization members
CREATE POLICY "Credits are viewable by organization members" 
ON "public"."organization_credits" 
FOR SELECT TO "authenticated" 
USING (
  EXISTS (
    SELECT 1
    FROM "public"."organization_members"
    WHERE 
      "organization_members"."organization_id" = "organization_credits"."organization_id" AND
      "organization_members"."user_id" = "auth"."uid"()
  )
);

-- Credits can be added by organization owners and admins
CREATE POLICY "Credits can be added by organization owners and admins" 
ON "public"."organization_credits" 
FOR INSERT TO "authenticated" 
WITH CHECK (
  ("transaction_type" = ANY (ARRAY['add', 'refund'])) AND 
  (EXISTS (
    SELECT 1
    FROM "public"."organization_members"
    WHERE 
      "organization_members"."organization_id" = "organization_credits"."organization_id" AND
      "organization_members"."user_id" = "auth"."uid"() AND
      "organization_members"."role" = ANY (ARRAY['owner', 'admin'])
  ))
);

-- Credits can be used by any organization member
CREATE POLICY "Credits can be used by any organization member" 
ON "public"."organization_credits" 
FOR INSERT TO "authenticated" 
WITH CHECK (
  ("transaction_type" = 'use') AND 
  (EXISTS (
    SELECT 1
    FROM "public"."organization_members"
    WHERE 
      "organization_members"."organization_id" = "organization_credits"."organization_id" AND
      "organization_members"."user_id" = "auth"."uid"()
  ))
);
```

## Implementation Tips

When implementing credit-based features:

1. Always check credit availability before performing credit-consuming operations
2. Use the `use_organization_credits_safe` function for atomic credit deduction
3. Provide clear feedback to users about credit consumption
4. Include credit usage analytics in admin dashboards
5. Consider implementing credit purchase options for users who need more 