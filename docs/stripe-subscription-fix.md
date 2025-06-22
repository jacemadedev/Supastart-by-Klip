# Stripe Subscription Issue Fixes

## Issue Summary

We identified two major issues with the Stripe subscription handling:

1. **Redundant Updates**: In the webhook handler for `customer.subscription.updated` events, we were performing redundant updates after already calling the `change_subscription` function, which was handling the update properly.

2. **Period End Date Sync**: The `change_subscription` function was not properly updating the `current_period_end` date when Stripe sent subscription updates, causing subscription end dates to be out of sync between our database and Stripe.

## Solutions Implemented

1. **Removed Redundant Update**: Eliminated redundant update operations in the webhook handler, relying solely on the `change_subscription` function.

2. **Enhanced Function Parameter**: Updated the `change_subscription` function to accept a `period_end` parameter that allows properly setting the subscription end date.

3. **Added Period End Extraction**: Modified the webhook handlers to extract and pass the `current_period_end` date from Stripe subscription objects.

4. **Fixed Free Plan Dates**: Ensured that free plans always have a far-future end date (100 years from now) to prevent unwanted expirations.

5. **Created Migration Script**: Added a database migration to correct any incorrect period end dates for existing subscriptions.

## Manual Fix for Problem Accounts

If you need to manually fix a subscription for a specific organization, you can run the following SQL query:

```sql
-- For paid plans, need to get the current period end from Stripe
SELECT change_subscription(
  org_id := 'organization_id_here',
  new_plan_id := 'current_plan_id_here',
  stripe_sub_id := 'stripe_subscription_id_here',
  stripe_price := 'stripe_price_id_here',
  period_end := 'YYYY-MM-DDTHH:MM:SS.SSSZ'  -- ISO timestamp from Stripe
);

-- For free plans
SELECT change_subscription(
  org_id := 'organization_id_here',
  new_plan_id := 'free_plan_id_here',
  stripe_sub_id := NULL,
  stripe_price := NULL,
  period_end := (NOW() + INTERVAL '100 YEARS')::TEXT
);
```

Alternatively, you can run our helper function to fix all free plan subscriptions at once:

```sql
SELECT fix_subscription_period_ends();
```

## Testing the Fix

After deploying these changes, you should verify that:

1. When a subscription is updated in Stripe, the webhook correctly updates the `current_period_end` date in your database.
2. Free plan subscriptions always have a far-future end date.
3. No redundant updates are being performed.

You can trigger test events from the Stripe dashboard or use the Stripe CLI to send test webhooks. 