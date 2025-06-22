-- Migration: Fix Critical Credit Security Vulnerabilities
-- Description: Revokes dangerous permissions and fixes credit security issues

-- 1. REVOKE ALL PERMISSIONS from the unsafe add_organization_credits function
REVOKE ALL ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") FROM "anon";

-- 2. REVOKE ALL PERMISSIONS from the unsafe use_organization_credits function  
REVOKE ALL ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") FROM "anon";

-- 3. Keep service_role permissions for system operations (webhooks, etc.)
-- But limit authenticated users to only the safe versions

-- 4. Fix the broken handle_manual_credit_reset function
CREATE OR REPLACE FUNCTION "public"."handle_manual_credit_reset"("org_id" "uuid") RETURNS boolean
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  plan_id UUID;
  credits_to_add INTEGER;
  plan_name TEXT;
  user_id UUID;
  user_role TEXT;
BEGIN
  -- Get current user ID
  user_id := auth.uid();
  
  -- Validate user is owner or admin of the organization
  SELECT om.role INTO user_role
  FROM organization_members om
  WHERE om.organization_id = org_id
  AND om.user_id = user_id;
  
  -- If not an admin or owner, return false
  IF user_role IS NULL OR NOT (user_role = 'owner' OR user_role = 'admin') THEN
    RAISE EXCEPTION 'Only organization owners and admins can reset credits';
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
  
  -- Use the safe function to add credits
  SELECT public.add_organization_credits_safe(
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
      'reset_by', user_id,
      'timestamp', now()
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- 5. Create a new admin-only function for legitimate credit additions (support, refunds, etc.)
CREATE OR REPLACE FUNCTION "public"."admin_add_organization_credits"(
  "org_id" "uuid", 
  "amount" integer, 
  "description" "text" DEFAULT NULL::"text", 
  "transaction_type" "text" DEFAULT 'add'::"text"
) RETURNS boolean
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
    
    -- Check user has owner role in the organization (stricter than admin)
    SELECT om.role INTO user_role
    FROM organization_members om
    WHERE om.organization_id = org_id
    AND om.user_id = user_id;
    
    -- Only owners can add credits manually
    IF user_role IS NULL OR user_role != 'owner' THEN
        RETURN false;
    END IF;
    
    -- Get current balance
    SELECT public.get_organization_credits(org_id) INTO old_balance;
    
    -- Add credits
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
    
    -- Update credits balance on organization
    UPDATE organizations
    SET credits_balance = old_balance + amount
    WHERE id = org_id;
    
    -- Log the manual addition
    INSERT INTO system_logs (
        organization_id,
        event_type,
        description,
        metadata
    ) VALUES (
        org_id,
        'credits.manual_add',
        'Manual credit addition by owner: ' || amount || ' credits - ' || description,
        jsonb_build_object(
            'amount', amount,
            'transaction_type', transaction_type,
            'added_by', user_id,
            'previous_balance', old_balance,
            'new_balance', old_balance + amount,
            'timestamp', now()
        )
    );
    
    RETURN true;
EXCEPTION
    WHEN others THEN
        RETURN false;
END;
$$;

-- 6. Only grant permissions to service_role for admin function
GRANT EXECUTE ON FUNCTION "public"."admin_add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "service_role";

-- 7. Add additional security policy to prevent direct table access
CREATE POLICY "Prevent direct credit manipulation" ON "public"."organization_credits" 
FOR ALL TO "authenticated" 
USING (false) WITH CHECK (false);

-- Drop the existing policies first
DROP POLICY IF EXISTS "Credits can be added by organization owners and admins" ON "public"."organization_credits";
DROP POLICY IF EXISTS "Credits can be used by any organization member" ON "public"."organization_credits";

-- Recreate with stricter controls
CREATE POLICY "Credits can only be used by organization members" ON "public"."organization_credits" 
FOR INSERT TO "authenticated" 
WITH CHECK (
  (transaction_type = 'use') AND 
  (EXISTS (
    SELECT 1
    FROM "public"."organization_members"
    WHERE 
      "organization_members"."organization_id" = "organization_credits"."organization_id" AND
      "organization_members"."user_id" = "auth"."uid"()
  ))
);

-- Credits can only be added through safe functions or by service role
CREATE POLICY "Credits can only be added by system" ON "public"."organization_credits" 
FOR INSERT TO "service_role"
WITH CHECK (transaction_type = ANY (ARRAY['add'::"text", 'refund'::"text"])); 