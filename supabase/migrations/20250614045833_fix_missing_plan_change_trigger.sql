-- Fix missing plan change trigger that should update credits when subscription plans change
-- This was causing users to not receive credits when upgrading to paid plans

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION handle_subscription_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the plan_id actually changed
    IF OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN
        -- Update the organization's credits based on the new plan
        UPDATE organizations 
        SET credits_balance = (
            SELECT credits_per_period 
            FROM plans 
            WHERE id = NEW.plan_id
        )
        WHERE id = NEW.organization_id;
        
        -- Log the credit change
        INSERT INTO organization_credits (
            organization_id,
            amount,
            description,
            transaction_type,
            feature_id
        )
        SELECT 
            NEW.organization_id,
            p.credits_per_period,
            'Plan change: Updated to ' || p.name || ' plan',
            'add',
            'plan_change'
        FROM plans p
        WHERE p.id = NEW.plan_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 