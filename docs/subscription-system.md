# Subscription System

This document explains how the SupaStart subscription system works, including plans, features, billing, and the technical implementation.

## Overview

SupaStart uses a tiered subscription model powered by Stripe:

- Organizations subscribe to plans (Free, Pro, Enterprise)
- Each plan includes a set of features and limitations
- Billing is handled through Stripe
- Subscription status is synchronized between Stripe and the application

## Plan Structure

Plans are stored in the `plans` table with the following structure:

```typescript
interface Plan {
  id: string;
  name: string;           // "Free", "Pro", "Enterprise"
  description: string;    // Plan description
  price: number;          // Monthly price in USD
  billing_interval: string; // "monthly" or "yearly"
  features: {             // Feature flags and limits
    max_members: number,  // Maximum number of members
    projects: number,     // Number of allowed projects
    storage: number,      // Storage in GB
    advanced_analytics: boolean // Feature flags
    // ...other features
  };
  credits_per_period: number; // Credits allocated each billing period
  is_public: boolean;      // Whether the plan is publicly available
  stripe_product_id: string; // Stripe product ID
  stripe_price_id: string;   // Stripe price ID
}
```

## Subscription Lifecycle

### 1. Initial Subscription

When a user creates an organization, a Free plan subscription is automatically created:

```sql
-- Automatic subscription creation
INSERT INTO subscriptions (
  organization_id,
  plan_id,
  status,
  current_period_end
) VALUES (
  new_org_id,
  free_plan_id,
  'active',
  timezone('utc'::text, now()) + interval '1 year'
);
```

### 2. Upgrading Subscription

When upgrading to a paid plan:

1. User selects a plan on the billing page
2. Frontend calls the subscription API
3. Backend creates a Stripe checkout session
4. User completes payment on Stripe checkout
5. Stripe sends a webhook to update the subscription

```typescript
// Creating a checkout session
export async function createCheckoutSession(
  organizationId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string | null> {
  // Get plan details
  const plan = await getPlan(planId);
  
  // Free plan doesn't need Stripe checkout
  if (plan.price === 0) {
    const supabase = await createClient();
    
    // Update subscription directly
    await supabase.rpc('change_subscription', {
      org_id: organizationId,
      new_plan_id: planId,
    });
    
    return successUrl;
  }
  
  // Create a Stripe checkout session for paid plans
  const customerId = await getOrCreateStripeCustomer(organizationId);
  const stripe = getStripeInstance();
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.stripe_price_id,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organization_id: organizationId,
      plan_id: planId,
    },
  });
  
  return session.url;
}
```

### 3. Subscription Updates

When a subscription is updated in Stripe, a webhook updates the database:

```javascript
// Webhook handler for subscription updates
case 'customer.subscription.updated': {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  
  // Find organization by customer ID
  const { data: organizationId } = await supabase.rpc(
    'find_or_create_organization_by_customer',
    { customer_id: customerId }
  );
  
  // Extract period end date
  const periodEnd = subscription.current_period_end 
    ? new Date(subscription.current_period_end * 1000).toISOString() 
    : null;
  
  // Update subscription in database
  await supabase.rpc('change_subscription', {
    org_id: organizationId,
    new_plan_id: planId,
    stripe_sub_id: subscription.id,
    stripe_price: subscription.items.data[0]?.price.id,
    period_end: periodEnd
  });
  
  break;
}
```

### 4. Cancellation

When a subscription is canceled:

1. User requests cancellation on the billing page
2. Backend calls Stripe to cancel subscription
3. Stripe sends webhook to update local subscription
4. User is downgraded to Free plan at end of billing period

```sql
-- Function to cancel subscription
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  org_id UUID,
  immediate BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the subscription
  UPDATE subscriptions 
  SET 
    cancel_at_period_end = TRUE,
    status = CASE WHEN immediate THEN 'canceled' ELSE status END
  WHERE organization_id = org_id;
  
  -- Log the cancellation
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description
  ) VALUES (
    org_id,
    'subscription.cancellation_requested',
    'Subscription cancellation requested'
  );
  
  RETURN TRUE;
END;
$$;
```

## Plan Features & Limitations

Features and limitations are defined in the `features` JSONB field of the plans table:

```javascript
// Example plan features
{
  "max_members": 10,          // Numeric limit
  "projects": 5,              // Numeric limit
  "storage": 10,              // GB limit
  "chat": true,               // Boolean feature flag
  "history": true,            // Boolean feature flag
  "advanced_analytics": true  // Boolean feature flag
}
```

Feature access is checked using the `canUseFeature` function:

```typescript
// Check if an organization can use a feature
function canUseFeature(org: Organization | null, featureName: string): boolean {
  if (!org || !org.subscription) return false;
  
  const { plan_features } = org.subscription;
  return !!plan_features[featureName];
}
```

## Credit System

Plans include credits that are allocated each billing period:

```sql
-- Reset credits on subscription renewal
CREATE TRIGGER on_subscription_renewal
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_organization_credits();
```

The `reset_organization_credits` function adds credits based on the plan:

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
  -- Get the plan information
  SELECT p.credits_per_period, p.name 
  INTO plan_info
  FROM plans p 
  WHERE p.id = NEW.plan_id;
  
  -- Only proceed if we're dealing with a renewal
  IF (TG_OP = 'UPDATE' AND 
      OLD.current_period_end != NEW.current_period_end AND 
      NEW.status = 'active') THEN
    
    -- Get credits to add based on plan
    credits_to_add := plan_info.credits_per_period;
    
    -- Add reset credits
    PERFORM public.add_organization_credits(
      NEW.organization_id,
      credits_to_add,
      'Plan reset: ' || plan_info.name || ' plan credits'
    );
  END IF;
  
  RETURN NEW;
END;
$$;
```

## Payment Processing

Payment processing is handled through Stripe:

1. Payments are collected through Stripe Checkout
2. Invoices are generated automatically by Stripe
3. Payment status is tracked in the `subscriptions.payment_status` field
4. Payment history is recorded in the `payment_history` table

## Subscription Management UI

The billing page (`/dashboard/billing`) allows users to:

- View current plan and usage
- Upgrade to a higher tier
- Downgrade to a lower tier
- Update payment methods
- View payment history

## Handling Plan Changes

### Upgrading

When upgrading, changes take effect immediately:

1. New features become available instantly
2. New limits are applied immediately
3. Credits are adjusted based on the new plan

### Downgrading

When downgrading:

1. The current subscription continues until the end of the billing period
2. At renewal, the subscription switches to the new plan
3. Credits are reset to the new plan's allocation

```sql
-- Handle downgrade at renewal
IF (OLD.plan_id != NEW.plan_id OR 
    EXISTS (
      SELECT 1 FROM system_logs 
      WHERE organization_id = NEW.organization_id 
      AND event_type = 'subscription.downgrade'
      AND created_at > (NEW.current_period_end - INTERVAL '1 month')
    )) THEN
  -- Reset credits completely rather than adding
  UPDATE organizations
  SET credits_balance = plan_info.credits_per_period
  WHERE id = NEW.organization_id;
  
  -- Log the reset
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description
  ) VALUES (
    NEW.organization_id,
    'credits.reset_on_downgrade',
    'Reset credits due to plan downgrade'
  );
END IF;
```

## Error Handling

The subscription system includes robust error handling:

1. Failed webhook processing is logged in `webhook_logs`
2. Failed payments are tracked in `subscriptions.payment_status`
3. System events are recorded in `system_logs`
4. Recovery mechanisms attempt to reconcile missing data

## Implementation Tips

When extending the subscription system:

1. Always add new features to the plan definition in the database
2. Use feature flags for conditional rendering in UI
3. Add server-side checks for feature access
4. Test webhooks thoroughly with Stripe CLI 