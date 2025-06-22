-- Fix double credit allocation issue caused by trigger conflict
-- Problem: handle_subscription_plan_change was manually updating credits_balance 
-- AND the update_organization_credits_balance trigger was also updating it
-- Solution: Remove manual balance update, let the trigger handle it consistently

-- Fix the handle_subscription_plan_change function to NOT manually update credits_balance
-- The update_organization_credits_balance trigger already handles balance updates automatically
CREATE OR REPLACE FUNCTION "public"."handle_subscription_plan_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  old_plan_info RECORD;
  new_plan_info RECORD;
  log_message TEXT;
  credits_to_add INTEGER;
  credit_result BOOLEAN;
BEGIN
  -- Only proceed if we're dealing with a plan change
  IF (TG_OP = 'UPDATE' AND OLD.plan_id != NEW.plan_id) THEN
    -- Get the old and new plan information
    SELECT p.credits_per_period, p.name, p.price 
    INTO old_plan_info
    FROM plans p 
    WHERE p.id = OLD.plan_id;
    
    SELECT p.credits_per_period, p.name, p.price 
    INTO new_plan_info
    FROM plans p 
    WHERE p.id = NEW.plan_id;
    
    -- Log the plan change for diagnostics
    INSERT INTO system_logs (
      organization_id,
      event_type,
      description,
      metadata
    ) VALUES (
      NEW.organization_id,
      'credit.plan_change_debug',
      'Plan change detected: ' || old_plan_info.name || ' to ' || new_plan_info.name,
      jsonb_build_object(
        'old_plan_price', old_plan_info.price,
        'new_plan_price', new_plan_info.price,
        'old_credits', old_plan_info.credits_per_period,
        'new_credits', new_plan_info.credits_per_period
      )
    );
    
    -- Check if this is a downgrade (based on price)
    IF (new_plan_info.price < old_plan_info.price) THEN
      log_message := 'Plan downgraded from ' || old_plan_info.name || ' to ' || new_plan_info.name;
      
      -- Log the downgrade event
      INSERT INTO system_logs (
        organization_id,
        event_type,
        description,
        metadata
      ) VALUES (
        NEW.organization_id,
        'subscription.downgrade',
        log_message,
        jsonb_build_object(
          'old_plan_id', OLD.plan_id,
          'old_plan_name', old_plan_info.name,
          'new_plan_id', NEW.plan_id,
          'new_plan_name', new_plan_info.name,
          'old_credits_per_period', old_plan_info.credits_per_period,
          'new_credits_per_period', new_plan_info.credits_per_period,
          'effective_at_period_end', TRUE
        )
      );
    -- Check if this is an upgrade (based on price)
    ELSIF (new_plan_info.price > old_plan_info.price) THEN
      log_message := 'Plan upgraded from ' || old_plan_info.name || ' to ' || new_plan_info.name;
      
      -- Calculate credits difference to add
      credits_to_add := new_plan_info.credits_per_period - old_plan_info.credits_per_period;
      
      -- Only add credits if we're upgrading to a plan with more credits
      IF credits_to_add > 0 THEN
        -- ONLY insert the credit transaction
        -- DO NOT manually update the credits_balance - let the trigger handle it
        INSERT INTO organization_credits (
          organization_id, 
          amount,
          description,
          transaction_type
        ) VALUES (
          NEW.organization_id,
          credits_to_add,
          'Plan upgrade: Added ' || credits_to_add || ' credits for upgrading to ' || new_plan_info.name || ' plan',
          'add'
        );
        
        -- REMOVED: Manual balance update (this was causing the duplication!)
        -- The update_organization_credits_balance trigger will handle this automatically
        
        -- Log the upgrade event
        INSERT INTO system_logs (
          organization_id,
          event_type,
          description,
          metadata
        ) VALUES (
          NEW.organization_id,
          'subscription.upgrade',
          log_message || ' (+' || credits_to_add || ' credits)',
          jsonb_build_object(
            'old_plan_id', OLD.plan_id,
            'old_plan_name', old_plan_info.name,
            'new_plan_id', NEW.plan_id,
            'new_plan_name', new_plan_info.name,
            'old_credits_per_period', old_plan_info.credits_per_period,
            'new_credits_per_period', new_plan_info.credits_per_period,
            'credits_added', credits_to_add,
            'timestamp', now()
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also fix the reset_organization_credits function to properly exclude plan changes
-- This ensures no conflicts between the two triggers
CREATE OR REPLACE FUNCTION "public"."reset_organization_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  credits_to_add integer;
  plan_info record;
begin
  -- Get the plan information for this subscription
  select p.credits_per_period, p.name 
  into plan_info
  from plans p 
  where p.id = NEW.plan_id;
  
  -- Only proceed if we're dealing with a renewal (new period starts)
  -- IMPORTANT: Exclude plan changes as they're handled by handle_subscription_plan_change
  if (TG_OP = 'UPDATE' AND 
      OLD.current_period_end != NEW.current_period_end AND 
      NEW.status = 'active' AND
      OLD.plan_id = NEW.plan_id) then  -- ADDED: Only if plan hasn't changed
    
    -- Get credits to add based on plan
    credits_to_add := plan_info.credits_per_period;
    
    -- Add reset credits through the existing function
    perform public.add_organization_credits(
      NEW.organization_id,
      credits_to_add,
      'Plan reset: ' || plan_info.name || ' plan credits for new billing period',
      'add'
    );
    
    -- Record the event in the logs table if it exists
    begin
      insert into system_logs (
        organization_id,
        event_type,
        description,
        metadata
      ) values (
        NEW.organization_id,
        'credits.reset',
        'Reset ' || credits_to_add || ' credits for ' || plan_info.name || ' plan',
        jsonb_build_object(
          'plan_id', NEW.plan_id,
          'plan_name', plan_info.name,
          'credits_reset', credits_to_add,
          'subscription_id', NEW.id
        )
      );
    exception when undefined_table then
      -- system_logs table doesn't exist, ignore
    end;
  end if;
  
  return NEW;
end;
$$;

-- Add function comment for documentation
COMMENT ON FUNCTION "public"."handle_subscription_plan_change"() IS 'Handles plan upgrades and downgrades. Fixed to avoid double credit allocation by removing manual balance updates - relies on update_organization_credits_balance trigger instead.';
COMMENT ON FUNCTION "public"."reset_organization_credits"() IS 'Handles subscription renewals only (excludes plan changes to avoid conflicts). Fixed to prevent trigger conflicts with handle_subscription_plan_change.'; 