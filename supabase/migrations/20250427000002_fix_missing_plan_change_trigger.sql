-- Migration: Fix Missing Subscription Plan Change Trigger
-- Description: Adds the missing trigger that handles credit allocation when users upgrade/downgrade subscription plans
-- Bug: Users weren't getting credits when upgrading to paid plans because this trigger was missing

-- Create the missing subscription plan change trigger
-- This trigger fires when the plan_id field is updated on the subscriptions table
-- It calls the handle_subscription_plan_change function which adds appropriate credits for upgrades
CREATE OR REPLACE TRIGGER "on_subscription_plan_change"
AFTER UPDATE OF "plan_id" ON "public"."subscriptions" 
FOR EACH ROW 
EXECUTE FUNCTION "public"."handle_subscription_plan_change"();

-- Add comment to document the trigger's purpose
COMMENT ON TRIGGER "on_subscription_plan_change" ON "public"."subscriptions" IS 'Handles credit adjustments when subscription plan changes (upgrades/downgrades). Ensures users receive appropriate credits when upgrading to paid plans.';

-- Note: The handle_subscription_plan_change function already exists in the schema
-- This migration only adds the missing trigger that calls that function
-- 
-- Function behavior:
-- - For upgrades: Adds the difference in credits between old and new plan
-- - For downgrades: Resets credits to the new plan's amount  
-- - Logs all changes to system_logs table for audit trail 