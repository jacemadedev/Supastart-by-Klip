SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."accept_invitation"("invitation_token" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    invite_record public.invitations;
    org_id uuid;
    user_email text;
begin
    -- Get current user's email
    select email into user_email from auth.users where id = auth.uid();
    
    -- Find the invitation
    select * into invite_record from public.invitations 
    where token = invitation_token
    and expires_at > now();
    
    -- Check if invitation exists and matches user email
    if invite_record.id is null then
        raise exception 'Invalid or expired invitation';
    end if;
    
    if invite_record.email != user_email then
        raise exception 'Invitation email does not match your account';
    end if;
    
    -- Add user to organization with the specified role
    insert into public.organization_members (organization_id, user_id, role)
    values (invite_record.organization_id, auth.uid(), invite_record.role);
    
    -- Delete the invitation
    delete from public.invitations where id = invite_record.id;
    
    -- Return the organization ID
    return invite_record.organization_id;
exception
    when others then
        raise;
end;
$$;

ALTER FUNCTION "public"."accept_invitation"("invitation_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text" DEFAULT NULL::"text", "transaction_type" "text" DEFAULT 'add'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    old_balance integer;
begin
    -- Check valid transaction type
    if transaction_type not in ('add', 'refund') then
        return false;
    end if;
    
    -- Get current balance
    select public.get_organization_credits(org_id) into old_balance;
    
    -- Add credits
    insert into organization_credits (
        organization_id, 
        amount,
        description,
        transaction_type
    ) values (
        org_id,
        amount,
        description,
        transaction_type
    );
    
    -- Update credits balance on organization
    update organizations
    set credits_balance = old_balance + amount
    where id = org_id;
    
    return true;
exception
    when others then
        return false;
end;
$$;

ALTER FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text" DEFAULT NULL::"text", "transaction_type" "text" DEFAULT 'add'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    old_balance integer;
    user_id uuid;
    user_role text;
BEGIN
    -- Check valid transaction type
    IF transaction_type NOT IN ('add', 'refund') THEN
        RETURN false;
    END IF;
    
    -- Get current user ID
    user_id := auth.uid();
    
    -- Check user has admin or owner role in the organization
    SELECT om.role INTO user_role
    FROM organization_members om
    WHERE om.organization_id = org_id
    AND om.user_id = user_id;
    
    -- If not an admin or owner, return false
    IF user_role IS NULL OR NOT (user_role = 'owner' OR user_role = 'admin') THEN
        RETURN false;
    END IF;
    
    -- Get current balance
    SELECT public.get_organization_credits(org_id) INTO old_balance;
    
    -- Add credits
    INSERT INTO organization_credits (
        organization_id, 
        amount,
        description,
        transaction_type
    ) VALUES (
        org_id,
        amount,
        description,
        transaction_type
    );
    
    -- Update credits balance on organization
    UPDATE organizations
    SET credits_balance = old_balance + amount
    WHERE id = org_id;
    
    RETURN true;
EXCEPTION
    WHEN others THEN
        RETURN false;
END;
$$;

ALTER FUNCTION "public"."add_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_organization_member"("org_id" "uuid", "member_email" "text", "member_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_token TEXT;
  v_current_user_id UUID;
  v_current_user_role TEXT;
BEGIN
  -- Get current user making the request
  v_current_user_id := auth.uid();
  
  -- Check if current user has permission (admin or owner)
  SELECT role INTO v_current_user_role
  FROM organization_members
  WHERE organization_id = org_id
  AND user_id = v_current_user_id;
  
  IF v_current_user_role IS NULL OR (v_current_user_role != 'admin' AND v_current_user_role != 'owner') THEN
    RAISE EXCEPTION 'Only organization owners and admins can add members';
  END IF;
  
  -- Check if email already exists in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = member_email;
  
  IF v_user_id IS NOT NULL THEN
    -- User exists, check if already in organization
    IF EXISTS (
      SELECT 1
      FROM organization_members
      WHERE organization_id = org_id
      AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'User is already a member of this organization';
    END IF;
    
    -- Add user directly to organization
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role
    ) VALUES (
      org_id,
      v_user_id,
      member_role
    );
    
  ELSE
    -- User doesn't exist, create invitation
    v_token := encode(gen_random_bytes(20), 'hex');
    
    INSERT INTO invitations (
      organization_id,
      email,
      role,
      token,
      invited_by
    ) VALUES (
      org_id,
      member_email,
      member_role,
      v_token,
      v_current_user_id
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

ALTER FUNCTION "public"."add_organization_member"("org_id" "uuid", "member_email" "text", "member_role" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."add_organization_member"("org_id" "uuid", "member_email" "text", "member_role" "text") IS 'Adds a member to an organization or creates an invitation if the user does not exist';

CREATE OR REPLACE FUNCTION "public"."add_webhook_credits"("org_id" "uuid", "amount" integer, "description" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    old_balance INTEGER;
BEGIN
    -- Get current balance
    SELECT credits_balance INTO old_balance
    FROM organizations
    WHERE id = org_id;
    
    IF old_balance IS NULL THEN
        old_balance := 0;
    END IF;
    
    -- Add credits without triggering the audit trigger
    INSERT INTO organization_credits (
        organization_id, 
        amount,
        description,
        transaction_type
    ) VALUES (
        org_id,
        amount,
        description,
        'add'
    );
    
    -- Update credits balance on organization directly
    UPDATE organizations
    SET credits_balance = old_balance + amount
    WHERE id = org_id;
    
    -- Log the operation separately
    INSERT INTO system_logs (
        organization_id,
        event_type,
        description,
        metadata
    ) VALUES (
        org_id,
        'credits.webhook_add',
        description,
        jsonb_build_object(
            'amount', amount,
            'previous_balance', old_balance,
            'new_balance', old_balance + amount,
            'source', 'webhook'
        )
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

ALTER FUNCTION "public"."add_webhook_credits"("org_id" "uuid", "amount" integer, "description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."admin_recreate_missing_profiles"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  profile_count INT;
BEGIN
  -- Insert profiles for users that don't have one
  INSERT INTO public.profiles (id, email)
  SELECT id, email
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  )
  RETURNING COUNT(*) INTO profile_count;
  
  RETURN profile_count || ' missing profiles recreated';
END;
$$;

ALTER FUNCTION "public"."admin_recreate_missing_profiles"() OWNER TO "postgres";

CREATE PROCEDURE "public"."assign_free_plan_to_existing_organizations"()
    LANGUAGE "plpgsql"
    AS $$
declare
    free_plan_id uuid;
    org_record record;
begin
    -- Get the free plan ID
    select id into free_plan_id from plans where name = 'Free' limit 1;
    
    -- Exit if no free plan found
    if free_plan_id is null then
        raise exception 'Free plan not found';
    end if;
    
    -- Loop through all organizations
    for org_record in select id from organizations
    loop
        -- Skip if organization already has a subscription
        if exists (select 1 from subscriptions where organization_id = org_record.id) then
            continue;
        end if;
        
        -- Insert subscription with free plan
        insert into subscriptions (
            organization_id, 
            plan_id, 
            status, 
            current_period_end
        ) values (
            org_record.id, 
            free_plan_id, 
            'active', 
            timezone('utc'::text, now()) + interval '100 years'
        );
    end loop;
end;
$$;

ALTER PROCEDURE "public"."assign_free_plan_to_existing_organizations"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_initial_plan_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  credits_to_add integer;
  plan_info record;
begin
  -- Only proceed for new subscriptions
  if (TG_OP = 'INSERT') then
    -- Get the plan information for this subscription
    select p.credits_per_period, p.name 
    into plan_info
    from plans p 
    where p.id = NEW.plan_id;
    
    -- Skip if plan not found (shouldn't happen)
    if not found then
      return NEW;
    end if;
    
    credits_to_add := plan_info.credits_per_period;
    
    -- Check if the organization already has credits
    if (select count(*) from organization_credits where organization_id = NEW.organization_id) = 0 then
      -- Add initial credits through the existing function
      perform public.add_organization_credits(
        NEW.organization_id,
        credits_to_add,
        'Initial credits: ' || plan_info.name || ' plan',
        'add'
      );
    end if;
  end if;
  
  return NEW;
end;
$$;

ALTER FUNCTION "public"."assign_initial_plan_credits"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."can_delete_user"("user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select not public.user_owns_organizations(user_id);
$$;

ALTER FUNCTION "public"."can_delete_user"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."can_use_feature"("org_id" "uuid", "feature_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    plan_features jsonb;
begin
    -- Get the organization's plan features
    select p.features into plan_features
    from subscriptions s
    join plans p on s.plan_id = p.id
    where s.organization_id = org_id
    and s.status = 'active'
    limit 1;
    
    -- If no active subscription found, return false
    if plan_features is null then
        return false;
    end if;
    
    -- Check if the feature exists and is enabled
    return (plan_features ? feature_name) and (plan_features ->> feature_name)::boolean;
exception
    when others then
        return false;
end;
$$;

ALTER FUNCTION "public"."can_use_feature"("org_id" "uuid", "feature_name" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cancel_subscription"("org_id" "uuid", "immediate" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_subscription_id UUID;
  v_stripe_sub_id TEXT;
  v_plan_name TEXT;
  v_current_period_end TIMESTAMPTZ;
BEGIN
  -- Check if there's an existing subscription
  SELECT s.id, s.stripe_subscription_id, p.name, s.current_period_end
  INTO v_subscription_id, v_stripe_sub_id, v_plan_name, v_current_period_end
  FROM subscriptions s
  JOIN plans p ON s.plan_id = p.id
  WHERE s.organization_id = org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for organization';
  END IF;
  
  -- Update the subscription in the database
  -- IMPORTANT: Do NOT modify current_period_end when cancelling
  UPDATE subscriptions 
  SET 
    cancel_at_period_end = TRUE,
    -- If immediate cancellation is requested, also update status
    status = CASE WHEN immediate THEN 'canceled' ELSE status END,
    updated_at = NOW()
  WHERE id = v_subscription_id;
  
  -- Log the cancellation
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description,
    metadata
  ) VALUES (
    org_id,
    'subscription.cancellation_requested',
    CASE 
      WHEN immediate THEN 'Subscription canceled immediately' 
      ELSE 'Subscription will be canceled on ' || to_char(v_current_period_end, 'YYYY-MM-DD')
    END,
    jsonb_build_object(
      'subscription_id', v_subscription_id,
      'stripe_subscription_id', v_stripe_sub_id,
      'immediate', immediate,
      'timestamp', now(),
      'plan_name', v_plan_name,
      'cancellation_date', v_current_period_end
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and rethrow
    INSERT INTO system_logs (
      organization_id,
      event_type,
      description,
      metadata
    ) VALUES (
      org_id,
      'subscription.cancellation_error',
      'Error canceling subscription: ' || SQLERRM,
      jsonb_build_object(
        'error', SQLERRM,
        'timestamp', now()
      )
    );
    
    RAISE;
END;
$$;

ALTER FUNCTION "public"."cancel_subscription"("org_id" "uuid", "immediate" boolean) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."cancel_subscription"("org_id" "uuid", "immediate" boolean) IS 'Cancels a subscription for an organization. Preserves the current_period_end date as the cancellation date.';

CREATE OR REPLACE FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text" DEFAULT NULL::"text", "stripe_price" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan RECORD;
  v_subscription_id UUID;
  v_is_free_plan BOOLEAN;
BEGIN
  -- Validate the new plan
  SELECT *, (price = 0) AS is_free INTO v_plan FROM plans WHERE id = new_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;
  
  -- Check if this is a free plan
  v_is_free_plan := v_plan.price = 0;
  
  -- Check if there's an existing subscription
  SELECT id INTO v_subscription_id 
  FROM subscriptions 
  WHERE organization_id = org_id;
  
  IF FOUND THEN
    -- Update existing subscription
    UPDATE subscriptions 
    SET 
      plan_id = new_plan_id,
      status = 'active',
      -- For free plans, set Stripe IDs to NULL, otherwise use provided values or fallback to plan values
      stripe_price_id = CASE 
        WHEN v_is_free_plan THEN NULL 
        WHEN stripe_price IS NOT NULL THEN stripe_price
        ELSE v_plan.stripe_price_id 
      END,
      -- Only clear the subscription ID for free plans
      stripe_subscription_id = CASE 
        WHEN v_is_free_plan THEN NULL 
        WHEN stripe_sub_id IS NOT NULL THEN stripe_sub_id
        ELSE stripe_subscription_id 
      END,
      -- Set a far future expiration date for free plans
      current_period_end = CASE 
        WHEN v_is_free_plan THEN timezone('utc'::text, now()) + interval '100 years'
        ELSE current_period_end
      END,
      -- Reset cancellation flag
      cancel_at_period_end = false,
      payment_status = CASE
        WHEN v_is_free_plan THEN NULL
        ELSE 'succeeded'
      END,
      updated_at = NOW()
    WHERE id = v_subscription_id;
  ELSE
    -- Create new subscription
    INSERT INTO subscriptions (
      organization_id,
      plan_id,
      status,
      stripe_price_id,
      stripe_subscription_id,
      payment_status,
      current_period_end
    ) VALUES (
      org_id,
      new_plan_id,
      'active',
      CASE 
        WHEN v_is_free_plan THEN NULL 
        WHEN stripe_price IS NOT NULL THEN stripe_price
        ELSE v_plan.stripe_price_id 
      END,
      CASE 
        WHEN v_is_free_plan THEN NULL 
        ELSE stripe_sub_id
      END,
      CASE
        WHEN v_is_free_plan THEN NULL
        ELSE 'succeeded'
      END,
      CASE 
        WHEN v_is_free_plan THEN timezone('utc'::text, now()) + interval '100 years'
        ELSE timezone('utc'::text, now()) + interval '1 month'
      END
    );
  END IF;
  
  -- Log the subscription change
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description,
    metadata
  ) VALUES (
    org_id,
    'subscription.change',
    CASE 
      WHEN v_is_free_plan THEN 'Changed to Free plan' 
      ELSE 'Changed to paid plan'
    END,
    jsonb_build_object(
      'plan_id', new_plan_id,
      'stripe_subscription_id', stripe_sub_id,
      'timestamp', now()
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

ALTER FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text") IS 'Changes or creates a subscription for an organization. Can optionally specify Stripe subscription ID and price ID.';

CREATE OR REPLACE FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text" DEFAULT NULL::"text", "stripe_price" "text" DEFAULT NULL::"text", "period_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan RECORD;
  v_subscription_id UUID;
  v_is_free_plan BOOLEAN;
BEGIN
  -- Validate the new plan
  SELECT *, (price = 0) AS is_free INTO v_plan FROM plans WHERE id = new_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;
  
  -- Check if this is a free plan
  v_is_free_plan := v_plan.price = 0;
  
  -- Check if there's an existing subscription
  SELECT id INTO v_subscription_id 
  FROM subscriptions 
  WHERE organization_id = org_id;
  
  -- Calculate a reasonable period end for free plans (1 year instead of 100 years)
  -- This avoids the previous issue with unreasonable far-future dates
  DECLARE
    v_free_plan_expiry TIMESTAMPTZ := timezone('utc'::text, now()) + interval '1 year';
  BEGIN
    
    IF FOUND THEN
      -- Update existing subscription
      UPDATE subscriptions 
      SET 
        plan_id = new_plan_id,
        status = 'active',
        -- For free plans, set Stripe IDs to NULL, otherwise use provided values or fallback to plan values
        stripe_price_id = CASE 
          WHEN v_is_free_plan THEN NULL 
          WHEN stripe_price IS NOT NULL THEN stripe_price
          ELSE v_plan.stripe_price_id 
        END,
        -- Only clear the subscription ID for free plans
        stripe_subscription_id = CASE 
          WHEN v_is_free_plan THEN NULL 
          WHEN stripe_sub_id IS NOT NULL THEN stripe_sub_id
          ELSE stripe_subscription_id 
        END,
        -- Set period end based on plan type and provided period_end - use 1 year for free plans
        current_period_end = CASE 
          WHEN v_is_free_plan THEN v_free_plan_expiry
          WHEN period_end IS NOT NULL THEN period_end
          ELSE current_period_end
        END,
        -- Reset cancellation flag
        cancel_at_period_end = false,
        payment_status = CASE
          WHEN v_is_free_plan THEN NULL
          ELSE 'succeeded'
        END,
        updated_at = NOW()
      WHERE id = v_subscription_id;
    ELSE
      -- Create new subscription
      INSERT INTO subscriptions (
        organization_id,
        plan_id,
        status,
        stripe_price_id,
        stripe_subscription_id,
        payment_status,
        current_period_end
      ) VALUES (
        org_id,
        new_plan_id,
        'active',
        CASE 
          WHEN v_is_free_plan THEN NULL 
          WHEN stripe_price IS NOT NULL THEN stripe_price
          ELSE v_plan.stripe_price_id 
        END,
        CASE 
          WHEN v_is_free_plan THEN NULL 
          ELSE stripe_sub_id
        END,
        CASE
          WHEN v_is_free_plan THEN NULL
          ELSE 'succeeded'
        END,
        CASE 
          WHEN v_is_free_plan THEN v_free_plan_expiry
          WHEN period_end IS NOT NULL THEN period_end
          ELSE timezone('utc'::text, now()) + interval '1 month'
        END
      );
    END IF;
    
    -- Log the subscription change
    INSERT INTO system_logs (
      organization_id,
      event_type,
      description,
      metadata
    ) VALUES (
      org_id,
      'subscription.change',
      CASE 
        WHEN v_is_free_plan THEN 'Changed to Free plan' 
        ELSE 'Changed to paid plan'
      END,
      jsonb_build_object(
        'plan_id', new_plan_id,
        'stripe_subscription_id', stripe_sub_id,
        'timestamp', now()
      )
    );
    
    RETURN TRUE;
  END;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

ALTER FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text", "period_end" timestamp with time zone) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text", "period_end" timestamp with time zone) IS 'Changes or creates a subscription for an organization. Avoids using 100-year dates for free plans.';

CREATE OR REPLACE FUNCTION "public"."change_subscription_plan"("new_plan_id" "uuid", "org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Call the existing change_subscription function with all parameters to avoid ambiguity
  -- Explicitly passing NULL for the optional parameters
  RETURN public.change_subscription(
    org_id, 
    new_plan_id, 
    NULL::text,  -- stripe_sub_id
    NULL::text,  -- stripe_price
    NULL::timestamp with time zone  -- period_end
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

ALTER FUNCTION "public"."change_subscription_plan"("new_plan_id" "uuid", "org_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."change_subscription_plan"("new_plan_id" "uuid", "org_id" "uuid") IS 'Alias for change_subscription function to maintain backward compatibility. Uses explicit parameter passing to avoid ambiguity.';

CREATE OR REPLACE FUNCTION "public"."create_missing_profiles"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert profiles for users that don't have one
  INSERT INTO public.profiles (id, email)
  SELECT id, email
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );
END;
$$;

ALTER FUNCTION "public"."create_missing_profiles"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_missing_profiles"() IS 'Function to create missing profiles for existing auth users';

CREATE OR REPLACE FUNCTION "public"."create_payment_from_checkout"("p_organization_id" "uuid", "p_amount" numeric, "p_currency" "text" DEFAULT 'usd'::"text", "p_stripe_invoice_id" "text" DEFAULT NULL::"text", "p_stripe_payment_intent_id" "text" DEFAULT NULL::"text", "p_invoice_url" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_subscription_id UUID;
  v_payment_id UUID;
BEGIN
  -- Find the subscription ID for this organization
  SELECT id INTO v_subscription_id
  FROM subscriptions
  WHERE organization_id = p_organization_id;
  
  -- Insert the payment record
  INSERT INTO payment_history (
    organization_id,
    subscription_id,
    amount,
    currency,
    status,
    stripe_invoice_id,
    stripe_payment_intent_id,
    payment_method_type,
    invoice_url
  ) VALUES (
    p_organization_id,
    v_subscription_id,
    p_amount,
    p_currency,
    'succeeded',
    p_stripe_invoice_id,
    p_stripe_payment_intent_id,
    'card',
    p_invoice_url
  )
  RETURNING id INTO v_payment_id;
  
  -- Log the payment creation
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description,
    metadata
  ) VALUES (
    p_organization_id,
    'payment.created',
    'Created payment record from checkout',
    jsonb_build_object(
      'payment_id', v_payment_id,
      'amount', p_amount,
      'currency', p_currency,
      'timestamp', now()
    )
  );
  
  RETURN v_payment_id;
END;
$$;

ALTER FUNCTION "public"."create_payment_from_checkout"("p_organization_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_stripe_invoice_id" "text", "p_stripe_payment_intent_id" "text", "p_invoice_url" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_payment_from_checkout"("p_organization_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_stripe_invoice_id" "text", "p_stripe_payment_intent_id" "text", "p_invoice_url" "text") IS 'Creates a payment history record from checkout session completion to ensure payment tracking';

CREATE OR REPLACE FUNCTION "public"."find_or_create_organization_by_customer"("customer_id" "text", "customer_email" "text" DEFAULT NULL::"text", "customer_name" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  org_id UUID;
  new_org_id UUID;
  free_plan_id UUID;
BEGIN
  -- First try to find organization by customer ID
  SELECT id INTO org_id
  FROM organizations
  WHERE stripe_customer_id = customer_id;
  
  -- If found, return it
  IF FOUND THEN
    RETURN org_id;
  END IF;
  
  -- If customer has an email, try to find an organization with an owner with that email
  IF customer_email IS NOT NULL THEN
    SELECT o.id INTO org_id
    FROM organizations o
    JOIN organization_members om ON o.id = om.organization_id
    JOIN auth.users u ON om.user_id = u.id
    WHERE u.email = customer_email
    AND om.role = 'owner'
    AND o.stripe_customer_id IS NULL
    LIMIT 1;
    
    -- If found, update with customer ID and return
    IF FOUND THEN
      UPDATE organizations
      SET stripe_customer_id = customer_id
      WHERE id = org_id;
      
      -- Log the reconciliation
      INSERT INTO system_logs (
        organization_id,
        event_type,
        description,
        metadata
      ) VALUES (
        org_id,
        'stripe.customer_reconciliation',
        'Linked existing organization to Stripe customer',
        jsonb_build_object(
          'customer_id', customer_id,
          'customer_email', customer_email,
          'timestamp', now()
        )
      );
      
      RETURN org_id;
    END IF;
  END IF;

  -- If still not found, and we have a name, create a placeholder organization
  -- Only do this for webhooks that require action (like payments)
  IF customer_name IS NOT NULL THEN
    -- Get free plan ID
    SELECT id INTO free_plan_id
    FROM plans
    WHERE price = 0
    LIMIT 1;
    
    -- Create a new organization
    INSERT INTO organizations (
      name,
      stripe_customer_id
    ) VALUES (
      customer_name || ' (Stripe recovery)',
      customer_id
    )
    RETURNING id INTO new_org_id;
    
    -- Create a subscription for this organization with free plan
    INSERT INTO subscriptions (
      organization_id,
      plan_id,
      status,
      current_period_end
    ) VALUES (
      new_org_id,
      free_plan_id,
      'active',
      timezone('utc'::text, now()) + interval '100 years'
    );
    
    -- Log the creation
    INSERT INTO system_logs (
      organization_id,
      event_type,
      description,
      metadata
    ) VALUES (
      new_org_id,
      'stripe.organization_recovery',
      'Created placeholder organization for Stripe customer',
      jsonb_build_object(
        'customer_id', customer_id,
        'customer_name', customer_name,
        'customer_email', customer_email,
        'timestamp', now()
      )
    );
    
    RETURN new_org_id;
  END IF;
  
  -- If we get here, we couldn't find or create an organization
  RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."find_or_create_organization_by_customer"("customer_id" "text", "customer_email" "text", "customer_name" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."find_or_create_organization_by_customer"("customer_id" "text", "customer_email" "text", "customer_name" "text") IS 'Finds an organization by customer ID or creates a placeholder if needed';

CREATE OR REPLACE FUNCTION "public"."fix_subscription_dates"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    sub_record RECORD;
BEGIN
    -- Loop through all subscriptions with far-future dates
    FOR sub_record IN 
        SELECT id, organization_id, current_period_end
        FROM subscriptions
        WHERE current_period_end > NOW() + INTERVAL '10 years'
    LOOP
        -- Set a proper current_period_end that's 1 month from now
        UPDATE subscriptions
        SET current_period_end = NOW() + INTERVAL '1 month'
        WHERE id = sub_record.id;
        
        -- Log the update
        INSERT INTO system_logs (
            organization_id,
            event_type,
            description,
            metadata
        ) VALUES (
            sub_record.organization_id,
            'system.date_correction',
            'Fixed incorrect far-future subscription date',
            jsonb_build_object(
                'subscription_id', sub_record.id,
                'old_date', sub_record.current_period_end,
                'new_date', NOW() + INTERVAL '1 month'
            )
        );
    END LOOP;
    
    RETURN;
END;
$$;

ALTER FUNCTION "public"."fix_subscription_dates"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."fix_subscription_period_ends"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_system_org_id UUID;
BEGIN
  -- Find a system organization ID to use for logs (first organization)
  SELECT id INTO v_system_org_id FROM organizations LIMIT 1;
  
  -- Set far future dates for free plans
  UPDATE subscriptions s
  SET current_period_end = timezone('utc'::text, now()) + interval '100 years'
  FROM plans p
  WHERE s.plan_id = p.id
    AND p.price = 0
    AND (
      s.current_period_end IS NULL OR 
      s.current_period_end < timezone('utc'::text, now()) + interval '90 years'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Log the fix
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description,
    metadata
  ) VALUES (
    v_system_org_id, -- Use the system organization ID
    'system.fix',
    'Fixed subscription period end dates',
    jsonb_build_object(
      'count', v_count,
      'timestamp', now()
    )
  );
  
  RETURN v_count;
END;
$$;

ALTER FUNCTION "public"."fix_subscription_period_ends"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."fix_subscription_period_ends"() IS 'Helper function to fix subscription period end dates for existing subscriptions.';

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."organization_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "transaction_type" "text" NOT NULL,
    "feature_id" "text",
    CONSTRAINT "organization_credits_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['add'::"text", 'use'::"text", 'refund'::"text"])))
);

ALTER TABLE "public"."organization_credits" OWNER TO "postgres";

COMMENT ON TABLE "public"."organization_credits" IS 'Credit transactions for organizations';

CREATE OR REPLACE FUNCTION "public"."get_organization_credit_history"("org_id" "uuid", "limit_count" integer DEFAULT 50) RETURNS SETOF "public"."organization_credits"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select *
    from organization_credits
    where organization_id = org_id
    order by created_at desc
    limit limit_count;
$$;

ALTER FUNCTION "public"."get_organization_credit_history"("org_id" "uuid", "limit_count" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_organization_credit_usage_by_feature"("org_id" "uuid", "time_period" interval DEFAULT '30 days'::interval) RETURNS TABLE("feature_id" "text", "total_usage" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 
        COALESCE(feature_id, 'uncategorized') as feature_id,
        SUM(amount) as total_usage
    FROM organization_credits
    WHERE 
        organization_id = org_id
        AND transaction_type = 'use'
        AND created_at >= NOW() - time_period
    GROUP BY feature_id
    ORDER BY total_usage DESC;
$$;

ALTER FUNCTION "public"."get_organization_credit_usage_by_feature"("org_id" "uuid", "time_period" interval) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_organization_credits"("org_id" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select coalesce(sum(
        case 
            when transaction_type = 'add' then amount
            when transaction_type = 'refund' then amount
            when transaction_type = 'use' then -amount
        end
    ), 0)
    from organization_credits
    where organization_id = org_id;
$$;

ALTER FUNCTION "public"."get_organization_credits"("org_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_organization_plan"("org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select 
        jsonb_build_object(
            'plan_id', p.id,
            'plan_name', p.name,
            'plan_description', p.description,
            'plan_features', p.features,
            'subscription_status', s.status,
            'current_period_end', s.current_period_end,
            'cancel_at_period_end', s.cancel_at_period_end
        )
    from subscriptions s
    join plans p on s.plan_id = p.id
    where s.organization_id = org_id
    limit 1;
$$;

ALTER FUNCTION "public"."get_organization_plan"("org_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_organizations"() RETURNS TABLE("organization_id" "uuid", "organization_name" "text", "organization_slug" "text", "user_role" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select
        o.id as organization_id,
        o.name as organization_name,
        o.slug as organization_slug,
        om.role as user_role
    from organizations o
    inner join organization_members om on o.id = om.organization_id
    where om.user_id = (select auth.uid());
$$;

ALTER FUNCTION "public"."get_user_organizations"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_auth_user_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if the user has a profile
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    -- Create a profile for the user
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
  END IF;
  RETURN new;
END;
$$;

ALTER FUNCTION "public"."handle_auth_user_login"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_manual_credit_reset"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  org_id UUID;
  plan_id UUID;
  credits_to_add INTEGER;
  plan_name TEXT;
  current_credits INTEGER;
BEGIN
  -- Get parameters from request
  org_id := auth.uid();
  
  -- Validate organization
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Get the plan information for this organization
  SELECT s.plan_id, p.credits_per_period, p.name 
  INTO plan_id, credits_to_add, plan_name
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.organization_id = org_id
  AND s.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active subscription found';
  END IF;
  
  -- Add reset credits through the existing function
  PERFORM public.add_organization_credits(
    org_id,
    credits_to_add,
    'Manual reset: ' || plan_name || ' plan credits',
    'add'
  );
  
  -- Log the manual reset
  INSERT INTO system_logs (
    organization_id,
    event_type,
    description,
    metadata
  ) VALUES (
    org_id,
    'credits.manual_reset',
    'Manual reset: Added ' || credits_to_add || ' credits for ' || plan_name || ' plan',
    jsonb_build_object(
      'plan_id', plan_id,
      'plan_name', plan_name,
      'credits_added', credits_to_add,
      'timestamp', now()
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

ALTER FUNCTION "public"."handle_manual_credit_reset"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."handle_manual_credit_reset"() IS 'API endpoint for manually resetting credits based on the current plan';

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

-- Add trigger to automatically create profile when user signs up
CREATE OR REPLACE TRIGGER "on_auth_user_created"
AFTER INSERT ON "auth"."users"
FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

CREATE OR REPLACE FUNCTION "public"."handle_stripe_webhook_event"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  event_type text;
  event_object jsonb;
  subscription_id text;
  customer_id text;
  organization_id uuid;
  result jsonb;
begin
  -- Extract event type and data
  event_type := payload->>'type';
  event_object := payload->'data'->'object';
  
  -- Create a result object
  result := jsonb_build_object(
    'success', true,
    'event_type', event_type
  );
  
  -- Handle different event types
  case event_type
    -- Subscription events
    when 'customer.subscription.created', 'customer.subscription.updated' then
      subscription_id := event_object->>'id';
      customer_id := event_object->>'customer';
      
      -- Find the organization by customer ID
      select id into organization_id
      from organizations
      where stripe_customer_id = customer_id;
      
      if organization_id is not null then
        result := result || jsonb_build_object('organization_id', organization_id);
        
        -- Further processing will be handled by a separate function or edge function
      end if;
    
    -- Payment events
    when 'invoice.payment_succeeded', 'invoice.payment_failed' then
      customer_id := event_object->>'customer';
      
      -- Find the organization by customer ID
      select id into organization_id
      from organizations
      where stripe_customer_id = customer_id;
      
      if organization_id is not null then
        result := result || jsonb_build_object('organization_id', organization_id);
        
        -- Further processing will be handled by a separate function or edge function
      end if;
    
    else
      -- Unhandled event type
      result := jsonb_build_object(
        'success', true,
        'event_type', event_type,
        'status', 'ignored'
      );
  end case;
  
  return result;
exception
  when others then
    return jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
end;
$$;

ALTER FUNCTION "public"."handle_stripe_webhook_event"("payload" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_subscription_cancellation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  plan_info record;
  log_message text;
  credits_policy text;
  organization_settings jsonb;
begin
  -- Only proceed if we're dealing with a status change to canceled or setting cancel_at_period_end to true
  if (TG_OP = 'UPDATE' AND 
      (NEW.status = 'canceled' OR 
       (OLD.cancel_at_period_end = false AND NEW.cancel_at_period_end = true))) then
    
    -- Get the plan information for this subscription
    select p.name 
    into plan_info
    from plans p 
    where p.id = NEW.plan_id;
    
    -- Get organization settings to determine credit policy on cancellation
    begin
      select settings into organization_settings
      from organizations
      where id = NEW.organization_id;
      
      -- Default to 'keep' if not specified
      credits_policy := coalesce(organization_settings->>'cancellation_credits_policy', 'keep');
    exception
      when others then
        -- Default to 'keep' if any error occurs
        credits_policy := 'keep';
    end;
    
    -- If policy is to remove credits on cancellation
    if credits_policy = 'remove' then
      -- Reset credits to 0
      update organizations
      set credits_balance = 0
      where id = NEW.organization_id;
      
      log_message := 'Removed all credits due to subscription cancellation';
    else
      -- Default policy: keep existing credits until used
      log_message := 'Keeping existing credits after subscription cancellation';
    end if;
    
    -- Log the cancellation event
    begin
      insert into system_logs (
        organization_id,
        event_type,
        description,
        metadata
      ) values (
        NEW.organization_id,
        'subscription.cancellation',
        log_message,
        jsonb_build_object(
          'plan_id', NEW.plan_id,
          'plan_name', plan_info.name,
          'credits_policy', credits_policy,
          'cancel_at_period_end', NEW.cancel_at_period_end,
          'status', NEW.status
        )
      );
    exception when undefined_table then
      -- system_logs table doesn't exist, ignore
    end;
  end if;
  
  return NEW;
end;
$$;

ALTER FUNCTION "public"."handle_subscription_cancellation"() OWNER TO "postgres";

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
        -- Insert directly into organization_credits without using function
        -- This is to bypass any permission issues
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
        
        -- Update the organization's credits balance
        UPDATE organizations
        SET credits_balance = credits_balance + credits_to_add
        WHERE id = NEW.organization_id;
        
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

ALTER FUNCTION "public"."handle_subscription_plan_change"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."handle_subscription_plan_change"() IS 'Handles both plan upgrades and downgrades. For upgrades, immediately adds the difference in credits.';

CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;

ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_user_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Remove user from all organizations they're a member of (in a safe way)
  DELETE FROM organization_members
  WHERE user_id = old.id;
  
  RETURN old;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but continue with the deletion
    RAISE WARNING 'Error in handle_user_deletion trigger: %', SQLERRM;
    RETURN old;
END;
$$;

ALTER FUNCTION "public"."handle_user_deletion"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_credit_operation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_is_webhook BOOLEAN;
BEGIN
    -- Try to get user ID, but don't fail if none exists
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        -- If operation is coming from a webhook or system, mark it as such
        v_user_id := NULL;
        v_is_webhook := TRUE;
    END;
    
    -- Check if this is a webhook-initiated operation based on description
    IF NEW.description LIKE 'Plan upgrade: %' OR 
       NEW.description LIKE 'Initial credits: %' OR
       NEW.description LIKE 'Plan reset: %' THEN
        v_is_webhook := TRUE;
    END IF;
    
    -- For webhook operations where no user ID is available, use a system user ID
    IF v_user_id IS NULL THEN
        -- Check if the webhook user exists, create if not
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'system@webhook.internal',
            '{"provider":"email","providers":["email"]}',
            '{"name":"System Webhook"}',
            now(),
            now()
        )
        ON CONFLICT (id) DO NOTHING;
        
        v_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;
    
    -- Insert the audit log
    INSERT INTO credit_operations_audit (
        operation_id,
        organization_id,
        user_id,
        amount,
        transaction_type,
        status,
        request_details,
        client_info
    ) VALUES (
        NEW.id,
        NEW.organization_id,
        v_user_id,
        NEW.amount,
        NEW.transaction_type,
        'success',
        jsonb_build_object(
            'description', NEW.description,
            'feature_id', NEW.feature_id,
            'is_webhook', v_is_webhook
        ),
        CASE WHEN v_is_webhook 
            THEN jsonb_build_object('source', 'webhook')
            ELSE jsonb_build_object(
                'client_ip', coalesce(request.header('CF-Connecting-IP'), 'unknown'),
                'user_agent', coalesce(request.header('User-Agent'), 'unknown')
            )
        END
    );
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log error but don't block the main operation
        BEGIN
            INSERT INTO credit_operations_audit (
                operation_id,
                organization_id,
                user_id,
                amount,
                transaction_type,
                status,
                error_message,
                request_details
            ) VALUES (
                NEW.id,
                NEW.organization_id,
                coalesce(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID),
                NEW.amount,
                NEW.transaction_type,
                'failed',
                SQLERRM,
                jsonb_build_object(
                    'description', NEW.description,
                    'feature_id', NEW.feature_id,
                    'error_context', 'Trigger exception handling'
                )
            );
        EXCEPTION WHEN OTHERS THEN
            -- Final fallback - do nothing if even the error logging fails
            NULL;
        END;
        
        RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."log_credit_operation"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_webhook_event"("webhook_type" "text", "event_type" "text", "object_id" "text", "payload" "jsonb", "was_processed" boolean DEFAULT false, "error_msg" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO webhook_logs (
    webhook_type,
    event_type,
    object_id,
    payload,
    processed,
    error_message
  ) VALUES (
    webhook_type,
    event_type,
    object_id,
    payload,
    was_processed,
    error_msg
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

ALTER FUNCTION "public"."log_webhook_event"("webhook_type" "text", "event_type" "text", "object_id" "text", "payload" "jsonb", "was_processed" boolean, "error_msg" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."manually_reset_organization_credits"("org_id" "uuid", "override_credits" integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  credits_to_add integer;
  plan_name text;
begin
  -- Check if user is allowed to perform this operation
  if not (
    exists (
      select 1 from organization_members 
      where organization_id = org_id 
      and user_id = auth.uid() 
      and role in ('owner', 'admin')
    )
  ) then
    raise exception 'Unauthorized';
  end if;
  
  -- Get the plan information for this organization
  select p.credits_per_period, p.name 
  into credits_to_add, plan_name
  from subscriptions s
  join plans p on p.id = s.plan_id
  where s.organization_id = org_id
  and s.status = 'active';
  
  -- Allow override if provided
  if override_credits is not null then
    credits_to_add := override_credits;
  end if;
  
  -- Add reset credits through the existing function
  perform public.add_organization_credits(
    org_id,
    credits_to_add,
    'Manual reset: ' || plan_name || ' plan credits',
    'add'
  );
  
  return true;
exception
  when others then
    return false;
end;
$$;

ALTER FUNCTION "public"."manually_reset_organization_credits"("org_id" "uuid", "override_credits" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mark_webhook_processed"("webhook_id" "uuid", "was_processed" boolean DEFAULT true, "error_msg" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE webhook_logs
  SET 
    processed = was_processed,
    error_message = error_msg
  WHERE id = webhook_id;
END;
$$;

ALTER FUNCTION "public"."mark_webhook_processed"("webhook_id" "uuid", "was_processed" boolean, "error_msg" "text") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."mark_webhook_processed"("webhook_id" "uuid", "was_processed" boolean, "error_msg" "text") IS 'Updates a webhook log entry to mark it as processed or failed';

CREATE OR REPLACE FUNCTION "public"."reset_credits"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.handle_manual_credit_reset();
END;
$$;

ALTER FUNCTION "public"."reset_credits"() OWNER TO "postgres";

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
  if (TG_OP = 'UPDATE' AND 
      OLD.current_period_end != NEW.current_period_end AND 
      NEW.status = 'active') then
    
    -- Get credits to add based on plan
    credits_to_add := plan_info.credits_per_period;
    
    -- Important: If this is the first renewal after a downgrade,
    -- we need to reset credits to exactly the new plan amount rather
    -- than adding to existing balance.
    -- This ensures that when a user downgrades, they get exactly the
    -- new plan allocation at the next renewal.
    if (OLD.plan_id != NEW.plan_id OR 
        exists (
          select 1 from system_logs 
          where organization_id = NEW.organization_id 
          and event_type = 'subscription.downgrade'
          and created_at > (NEW.current_period_end - interval '1 month')
        )) then
      -- Set credits to exactly the new plan amount
      -- First, get current balance
      declare
        current_balance integer;
      begin
        select credits_balance 
        into current_balance
        from organizations
        where id = NEW.organization_id;
        
        -- If the current balance is higher than the new plan's credit amount,
        -- we need to adjust it down
        if (current_balance > credits_to_add) then
          -- Update the organization's credit balance directly
          update organizations
          set credits_balance = credits_to_add
          where id = NEW.organization_id;
          
          -- Log the adjustment
          begin
            insert into system_logs (
              organization_id,
              event_type,
              description,
              metadata
            ) values (
              NEW.organization_id,
              'credits.downgrade_reset',
              'Reset credits to ' || credits_to_add || ' after plan downgrade',
              jsonb_build_object(
                'plan_id', NEW.plan_id,
                'plan_name', plan_info.name,
                'previous_balance', current_balance,
                'new_balance', credits_to_add
              )
            );
          exception when undefined_table then
            -- system_logs table doesn't exist, ignore
          end;
          
          -- Return early since we've already set the credits
          return NEW;
        end if;
      end;
    end if;
    
    -- If we reach here, it's a normal credit addition for renewal
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

ALTER FUNCTION "public"."reset_organization_credits"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_default_current_organization"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- For each profile with null current_organization_id, set it to their first organization
  UPDATE public.profiles p
  SET current_organization_id = (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = p.id
    ORDER BY om.created_at ASC
    LIMIT 1
  )
  WHERE p.current_organization_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = p.id
  );
END;
$$;

ALTER FUNCTION "public"."set_default_current_organization"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."set_default_current_organization"() IS 'Sets default current organization for users missing one';

CREATE OR REPLACE FUNCTION "public"."set_organization_cancellation_policy"("org_id" "uuid", "policy" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Validate policy value
  if policy not in ('keep', 'remove') then
    raise exception 'Invalid policy value. Must be "keep" or "remove".';
  end if;
  
  -- Update the organization settings
  update organizations
  set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{cancellation_credits_policy}',
    to_jsonb(policy)
  )
  where id = org_id;
  
  return found;
end;
$$;

ALTER FUNCTION "public"."set_organization_cancellation_policy"("org_id" "uuid", "policy" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_organization_credits_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    org_id uuid;
    new_balance integer;
begin
    -- Get the organization ID
    org_id := NEW.organization_id;
    
    -- Calculate new balance
    select public.get_organization_credits(org_id) into new_balance;
    
    -- Update organization credits balance
    update organizations
    set credits_balance = new_balance
    where id = org_id;
    
    return NEW;
end;
$$;

ALTER FUNCTION "public"."update_organization_credits_balance"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    available_credits integer;
begin
    -- Get available credits
    select public.get_organization_credits(org_id) into available_credits;
    
    -- Check if enough credits
    if available_credits >= amount then
        -- Record credit usage
        insert into organization_credits (
            organization_id, 
            amount,
            description,
            transaction_type
        ) values (
            org_id,
            amount,
            description,
            'use'
        );
        
        -- Update credits balance on organization
        update organizations
        set credits_balance = available_credits - amount
        where id = org_id;
        
        return true;
    else
        return false;
    end if;
exception
    when others then
        return false;
end;
$$;

ALTER FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."use_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text" DEFAULT NULL::"text", "feature_id" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    available_credits integer;
    user_id uuid;
    is_member boolean;
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
            feature_id
        ) VALUES (
            org_id,
            amount,
            description,
            'use',
            feature_id
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

ALTER FUNCTION "public"."use_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "feature_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."user_owns_organizations"("user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $_$
  select exists (
    select 1 
    from organization_members
    where user_id = $1
    and role = 'owner'
  );
$_$;

ALTER FUNCTION "public"."user_owns_organizations"("user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."verify_plan_id"("plan_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  verified_plan_id UUID;
  default_plan_id UUID;
BEGIN
  -- Check if the provided plan ID exists
  SELECT id INTO verified_plan_id
  FROM plans
  WHERE id = plan_id;
  
  -- If found, return it
  IF FOUND THEN
    RETURN verified_plan_id;
  END IF;
  
  -- If not found, get the default free plan
  SELECT id INTO default_plan_id
  FROM plans
  WHERE price = 0
  LIMIT 1;
  
  -- Log the fallback
  INSERT INTO system_logs (
    event_type,
    description,
    metadata
  ) VALUES (
    'stripe.plan_fallback',
    'Invalid plan ID provided, falling back to free plan',
    jsonb_build_object(
      'invalid_plan_id', plan_id,
      'fallback_plan_id', default_plan_id,
      'timestamp', now()
    )
  );
  
  RETURN default_plan_id;
END;
$$;

ALTER FUNCTION "public"."verify_plan_id"("plan_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."verify_plan_id"("plan_id" "uuid") IS 'Verifies a plan ID exists or returns the default free plan';

CREATE TABLE IF NOT EXISTS "public"."credit_operations_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation_id" "uuid",
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "request_details" "jsonb",
    "client_info" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."credit_operations_audit" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("timezone"('utc'::"text", "now"()) + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);

ALTER TABLE "public"."invitations" OWNER TO "postgres";

COMMENT ON TABLE "public"."invitations" IS 'Invitations for users to join organizations';

CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);

ALTER TABLE "public"."organization_members" OWNER TO "postgres";

COMMENT ON TABLE "public"."organization_members" IS 'Junction table for users and their organizations with roles';

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "username" "text",
    "avatar_url" "text",
    "website" "text",
    "email" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid",
    "current_organization_id" "uuid"
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

COMMENT ON COLUMN "public"."profiles"."current_organization_id" IS 'The currently selected organization for this user';

CREATE OR REPLACE VIEW "public"."organization_members_with_profiles" AS
 SELECT "om"."id",
    "om"."organization_id",
    "om"."user_id",
    "om"."role",
    "om"."created_at",
    "om"."updated_at",
    "p"."full_name",
    "p"."email",
    "p"."avatar_url"
   FROM ("public"."organization_members" "om"
     JOIN "public"."profiles" "p" ON (("om"."user_id" = "p"."id")));

ALTER TABLE "public"."organization_members_with_profiles" OWNER TO "postgres";

COMMENT ON VIEW "public"."organization_members_with_profiles" IS 'View that joins organization members with their profile information for easier querying';

CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "credits_balance" integer DEFAULT 0 NOT NULL,
    "stripe_customer_id" "text",
    "stripe_payment_method_id" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

ALTER TABLE "public"."organizations" OWNER TO "postgres";

COMMENT ON TABLE "public"."organizations" IS 'Organizations that users can belong to';

COMMENT ON COLUMN "public"."organizations"."stripe_customer_id" IS 'Stripe customer ID for this organization';

COMMENT ON COLUMN "public"."organizations"."stripe_payment_method_id" IS 'Default Stripe payment method ID for this organization';

COMMENT ON COLUMN "public"."organizations"."settings" IS 'JSON settings for the organization including subscription and credit policies';

CREATE TABLE IF NOT EXISTS "public"."payment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "stripe_invoice_id" "text",
    "stripe_payment_intent_id" "text",
    "payment_method_type" "text",
    "invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE "public"."payment_history" OWNER TO "postgres";

COMMENT ON TABLE "public"."payment_history" IS 'History of payment transactions';

CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "billing_interval" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "credits_per_period" integer DEFAULT 0 NOT NULL,
    "stripe_product_id" "text",
    "stripe_price_id" "text",
    "stripe_price_id_yearly" "text",
    CONSTRAINT "plans_billing_interval_check" CHECK (("billing_interval" = ANY (ARRAY['monthly'::"text", 'annual'::"text"])))
);

ALTER TABLE "public"."plans" OWNER TO "postgres";

COMMENT ON TABLE "public"."plans" IS 'Subscription plans that organizations can subscribe to';

COMMENT ON COLUMN "public"."plans"."credits_per_period" IS 'Number of credits assigned to this plan per billing period';

COMMENT ON COLUMN "public"."plans"."stripe_product_id" IS 'Stripe product ID for this plan';

COMMENT ON COLUMN "public"."plans"."stripe_price_id" IS 'Stripe price ID for monthly billing of this plan';

COMMENT ON COLUMN "public"."plans"."stripe_price_id_yearly" IS 'Stripe price ID for yearly billing of this plan';

CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_start" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "stripe_invoice_id" "text",
    "payment_status" "text",
    "payment_error" "text",
    "payment_method_type" "text" DEFAULT 'card'::"text",
    "latest_invoice_url" "text",
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'canceled'::"text"])))
);

ALTER TABLE "public"."subscriptions" OWNER TO "postgres";

COMMENT ON TABLE "public"."subscriptions" IS 'Organization subscriptions to plans';

COMMENT ON COLUMN "public"."subscriptions"."stripe_subscription_id" IS 'Stripe subscription ID';

COMMENT ON COLUMN "public"."subscriptions"."stripe_price_id" IS 'Stripe price ID for this subscription';

COMMENT ON COLUMN "public"."subscriptions"."stripe_invoice_id" IS 'Latest Stripe invoice ID for this subscription';

COMMENT ON COLUMN "public"."subscriptions"."payment_status" IS 'Status of the latest payment';

COMMENT ON COLUMN "public"."subscriptions"."payment_error" IS 'Error message if payment failed';

COMMENT ON COLUMN "public"."subscriptions"."payment_method_type" IS 'Type of payment method used';

COMMENT ON COLUMN "public"."subscriptions"."latest_invoice_url" IS 'URL to latest invoice PDF';

CREATE TABLE IF NOT EXISTS "public"."system_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."system_logs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_type" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "object_id" "text",
    "payload" "jsonb",
    "processed" boolean DEFAULT false,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";

ALTER TABLE ONLY "public"."credit_operations_audit"
    ADD CONSTRAINT "credit_operations_audit_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");

ALTER TABLE ONLY "public"."organization_credits"
    ADD CONSTRAINT "organization_credits_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_organization_id_key" UNIQUE ("organization_id");

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."system_logs"
    ADD CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");

CREATE INDEX "idx_organization_credits_feature_id" ON "public"."organization_credits" USING "btree" ("feature_id");

CREATE OR REPLACE TRIGGER "before_profile_delete" BEFORE DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_user_deletion"();

CREATE OR REPLACE TRIGGER "handle_organization_members_updated_at" BEFORE UPDATE ON "public"."organization_members" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "handle_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "handle_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "handle_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "on_credit_operation" AFTER INSERT ON "public"."organization_credits" FOR EACH ROW EXECUTE FUNCTION "public"."log_credit_operation"();

CREATE OR REPLACE TRIGGER "on_organization_credits_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."organization_credits" FOR EACH ROW EXECUTE FUNCTION "public"."update_organization_credits_balance"();

CREATE OR REPLACE TRIGGER "on_profile_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "on_subscription_cancellation" AFTER UPDATE OF "status", "cancel_at_period_end" ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_subscription_cancellation"();

CREATE OR REPLACE TRIGGER "on_subscription_create" AFTER INSERT ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."assign_initial_plan_credits"();

CREATE OR REPLACE TRIGGER "on_subscription_renewal" AFTER UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."reset_organization_credits"();

ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."organization_credits"
    ADD CONSTRAINT "organization_credits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_current_organization_id_fkey" FOREIGN KEY ("current_organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");

CREATE POLICY "Admin can recreate profiles" ON "public"."profiles" FOR INSERT TO "service_role" WITH CHECK (true);

CREATE POLICY "Admins and owners can create invitations" ON "public"."invitations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "invitations"."organization_id") AND ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Admins and owners can delete invitations" ON "public"."invitations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "invitations"."organization_id") AND ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Anyone can view organization members" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Credit audit logs are viewable by organization owners and admin" ON "public"."credit_operations_audit" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "credit_operations_audit"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Credits are viewable by organization members" ON "public"."organization_credits" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organization_credits"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));

CREATE POLICY "Credits can be added by organization owners and admins" ON "public"."organization_credits" FOR INSERT TO "authenticated" WITH CHECK ((("transaction_type" = ANY (ARRAY['add'::"text", 'refund'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organization_credits"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));

CREATE POLICY "Credits can be used by any organization member" ON "public"."organization_credits" FOR INSERT TO "authenticated" WITH CHECK ((("transaction_type" = 'use'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organization_credits"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))));

CREATE POLICY "Enable authenticated users to reset their credits" ON "public"."plans" TO "authenticated" USING (true);

CREATE POLICY "Member roles can be updated by owners and admins" ON "public"."organization_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "organization_members_1"
  WHERE (("organization_members_1"."organization_id" = "organization_members_1"."organization_id") AND ("organization_members_1"."user_id" = "auth"."uid"()) AND ("organization_members_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "organization_members_1"
  WHERE (("organization_members_1"."organization_id" = "organization_members_1"."organization_id") AND ("organization_members_1"."user_id" = "auth"."uid"()) AND ("organization_members_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Members can be removed by owners and admins" ON "public"."organization_members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "organization_members_1"
  WHERE (("organization_members_1"."organization_id" = "organization_members_1"."organization_id") AND ("organization_members_1"."user_id" = "auth"."uid"()) AND ("organization_members_1"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Only service_role can create plans" ON "public"."plans" FOR INSERT TO "service_role" WITH CHECK (true);

CREATE POLICY "Only service_role can delete plans" ON "public"."plans" FOR DELETE TO "service_role" USING (true);

CREATE POLICY "Only service_role can update plans" ON "public"."plans" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);

CREATE POLICY "Organization members can view invitations" ON "public"."invitations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "invitations"."organization_id") AND ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));

CREATE POLICY "Organizations are viewable by authenticated users" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Organizations can be created by authenticated users" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Organizations can be deleted by owners only" ON "public"."organizations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("organization_members"."role" = 'owner'::"text")))));

CREATE POLICY "Organizations can be updated by owners and admins" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Payment history can be created by service_role" ON "public"."payment_history" FOR INSERT TO "service_role" WITH CHECK (true);

CREATE POLICY "Payment history can be created via Stripe webhook" ON "public"."payment_history" FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Payment history is viewable by organization admins and owners" ON "public"."payment_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "payment_history"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));

CREATE POLICY "Plans are viewable by everyone" ON "public"."plans" FOR SELECT TO "authenticated" USING (("is_active" = true));

CREATE POLICY "Profiles are viewable by authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Subscriptions are viewable by organization members" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "subscriptions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));

CREATE POLICY "Subscriptions can be created by organization owners" ON "public"."subscriptions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "subscriptions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'owner'::"text")))));

CREATE POLICY "Subscriptions can be deleted by organization owners" ON "public"."subscriptions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "subscriptions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'owner'::"text")))));

CREATE POLICY "Subscriptions can be updated by organization owners" ON "public"."subscriptions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "subscriptions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'owner'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "subscriptions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()) AND ("organization_members"."role" = 'owner'::"text")))));

CREATE POLICY "Users can be added to organizations" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members" "existing"
  WHERE (("existing"."organization_id" = "organization_members"."organization_id") AND ("existing"."user_id" = "auth"."uid"()) AND ("existing"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));

CREATE POLICY "Users can create their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));

CREATE POLICY "Users can delete their own profile if they don't own any organi" ON "public"."profiles" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "id") AND "public"."can_delete_user"("id")));

CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));

CREATE POLICY "Users can view their own invitation by token" ON "public"."invitations" FOR SELECT TO "authenticated" USING (("token" = "current_setting"('app.invitation_token'::"text", true)));

ALTER TABLE "public"."credit_operations_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_credits" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."payment_history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."accept_invitation"("invitation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_invitation"("invitation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("invitation_token" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_organization_member"("org_id" "uuid", "member_email" "text", "member_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_organization_member"("org_id" "uuid", "member_email" "text", "member_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_organization_member"("org_id" "uuid", "member_email" "text", "member_role" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."add_webhook_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_webhook_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_webhook_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."admin_recreate_missing_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_recreate_missing_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_recreate_missing_profiles"() TO "service_role";

GRANT ALL ON PROCEDURE "public"."assign_free_plan_to_existing_organizations"() TO "anon";
GRANT ALL ON PROCEDURE "public"."assign_free_plan_to_existing_organizations"() TO "authenticated";
GRANT ALL ON PROCEDURE "public"."assign_free_plan_to_existing_organizations"() TO "service_role";

GRANT ALL ON FUNCTION "public"."assign_initial_plan_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_initial_plan_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_initial_plan_credits"() TO "service_role";

GRANT ALL ON FUNCTION "public"."can_delete_user"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_delete_user"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_delete_user"("user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."can_use_feature"("org_id" "uuid", "feature_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_use_feature"("org_id" "uuid", "feature_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_use_feature"("org_id" "uuid", "feature_name" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."cancel_subscription"("org_id" "uuid", "immediate" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_subscription"("org_id" "uuid", "immediate" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_subscription"("org_id" "uuid", "immediate" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text", "period_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text", "period_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_subscription"("org_id" "uuid", "new_plan_id" "uuid", "stripe_sub_id" "text", "stripe_price" "text", "period_end" timestamp with time zone) TO "service_role";

GRANT ALL ON FUNCTION "public"."change_subscription_plan"("new_plan_id" "uuid", "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."change_subscription_plan"("new_plan_id" "uuid", "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_subscription_plan"("new_plan_id" "uuid", "org_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_missing_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_missing_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_missing_profiles"() TO "service_role";

GRANT ALL ON FUNCTION "public"."create_payment_from_checkout"("p_organization_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_stripe_invoice_id" "text", "p_stripe_payment_intent_id" "text", "p_invoice_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_payment_from_checkout"("p_organization_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_stripe_invoice_id" "text", "p_stripe_payment_intent_id" "text", "p_invoice_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_payment_from_checkout"("p_organization_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_stripe_invoice_id" "text", "p_stripe_payment_intent_id" "text", "p_invoice_url" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."find_or_create_organization_by_customer"("customer_id" "text", "customer_email" "text", "customer_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_organization_by_customer"("customer_id" "text", "customer_email" "text", "customer_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_organization_by_customer"("customer_id" "text", "customer_email" "text", "customer_name" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."fix_subscription_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_subscription_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_subscription_dates"() TO "service_role";

GRANT ALL ON FUNCTION "public"."fix_subscription_period_ends"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_subscription_period_ends"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_subscription_period_ends"() TO "service_role";

GRANT ALL ON TABLE "public"."organization_credits" TO "anon";
GRANT ALL ON TABLE "public"."organization_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_credits" TO "service_role";

GRANT ALL ON FUNCTION "public"."get_organization_credit_history"("org_id" "uuid", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_credit_history"("org_id" "uuid", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_credit_history"("org_id" "uuid", "limit_count" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_organization_credit_usage_by_feature"("org_id" "uuid", "time_period" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_credit_usage_by_feature"("org_id" "uuid", "time_period" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_credit_usage_by_feature"("org_id" "uuid", "time_period" interval) TO "service_role";

GRANT ALL ON FUNCTION "public"."get_organization_credits"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_credits"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_credits"("org_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_organization_plan"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_plan"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_plan"("org_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_auth_user_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_user_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_user_login"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_manual_credit_reset"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_manual_credit_reset"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_manual_credit_reset"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_stripe_webhook_event"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_stripe_webhook_event"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_stripe_webhook_event"("payload" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_subscription_cancellation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_cancellation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_cancellation"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_subscription_plan_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_subscription_plan_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_subscription_plan_change"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_user_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_deletion"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_credit_operation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_credit_operation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_credit_operation"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_webhook_event"("webhook_type" "text", "event_type" "text", "object_id" "text", "payload" "jsonb", "was_processed" boolean, "error_msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_webhook_event"("webhook_type" "text", "event_type" "text", "object_id" "text", "payload" "jsonb", "was_processed" boolean, "error_msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_webhook_event"("webhook_type" "text", "event_type" "text", "object_id" "text", "payload" "jsonb", "was_processed" boolean, "error_msg" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."manually_reset_organization_credits"("org_id" "uuid", "override_credits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."manually_reset_organization_credits"("org_id" "uuid", "override_credits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."manually_reset_organization_credits"("org_id" "uuid", "override_credits" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."mark_webhook_processed"("webhook_id" "uuid", "was_processed" boolean, "error_msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_webhook_processed"("webhook_id" "uuid", "was_processed" boolean, "error_msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_webhook_processed"("webhook_id" "uuid", "was_processed" boolean, "error_msg" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."reset_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_credits"() TO "service_role";

GRANT ALL ON FUNCTION "public"."reset_organization_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_organization_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_organization_credits"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_default_current_organization"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_current_organization"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_current_organization"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_organization_cancellation_policy"("org_id" "uuid", "policy" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_cancellation_policy"("org_id" "uuid", "policy" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_cancellation_policy"("org_id" "uuid", "policy" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_organization_credits_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_organization_credits_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organization_credits_balance"() TO "service_role";

GRANT ALL ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."use_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "feature_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."use_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "feature_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "feature_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_owns_organizations"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_organizations"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_organizations"("user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."verify_plan_id"("plan_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_plan_id"("plan_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_plan_id"("plan_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."credit_operations_audit" TO "anon";
GRANT ALL ON TABLE "public"."credit_operations_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_operations_audit" TO "service_role";

GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";

GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."organization_members_with_profiles" TO "anon";
GRANT ALL ON TABLE "public"."organization_members_with_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members_with_profiles" TO "service_role";

GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";

GRANT ALL ON TABLE "public"."payment_history" TO "anon";
GRANT ALL ON TABLE "public"."payment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_history" TO "service_role";

GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";

GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";

GRANT ALL ON TABLE "public"."system_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_logs" TO "service_role";

GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";

RESET ALL;
