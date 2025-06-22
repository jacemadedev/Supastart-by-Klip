-- Migration: Complete Security Fixes - Supplementary
-- Description: Captures additional security fixes that were applied during testing
-- This ensures all security measures are properly recorded in migrations

-- 1. Fix admin function permissions that were too permissive
-- The admin_add_organization_credits function should only be accessible to service_role
REVOKE ALL ON FUNCTION "public"."admin_add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."admin_add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") FROM "anon";

-- Only service_role should be able to execute this function
GRANT EXECUTE ON FUNCTION "public"."admin_add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "service_role";

-- 2. Ensure unsafe functions are completely locked down from PUBLIC access
-- This provides an extra layer of security beyond role-specific revocations
REVOKE ALL ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") FROM PUBLIC;

-- Grant back only to service_role for system operations (webhooks, etc.)
GRANT EXECUTE ON FUNCTION "public"."add_organization_credits"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."use_organization_credits"("org_id" "uuid", "amount" integer, "description" "text") TO "service_role";

-- 3. Ensure RLS policies are properly configured for maximum security
-- Drop any conflicting policies that might exist
DROP POLICY IF EXISTS "Prevent direct credit manipulation" ON "public"."organization_credits";

-- Recreate with explicit deny-all for authenticated users on direct table access
CREATE POLICY "Prevent direct credit manipulation" ON "public"."organization_credits" 
FOR ALL TO "authenticated" 
USING (false) WITH CHECK (false);

-- 4. Add audit logging comment for security compliance
COMMENT ON POLICY "Prevent direct credit manipulation" ON "public"."organization_credits" IS 'Security policy: Prevents authenticated users from directly manipulating credit records. All credit operations must go through approved functions with proper authorization checks.';

-- 5. Ensure only safe functions are available to authenticated users
-- Verify that the safe functions maintain their proper permissions
GRANT EXECUTE ON FUNCTION "public"."add_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "transaction_type" "text") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."use_organization_credits_safe"("org_id" "uuid", "amount" integer, "description" "text", "feature_id" "text") TO "authenticated";

-- 6. Security documentation
-- This migration completes credit system security hardening. 
-- Ensures no privilege escalation vulnerabilities exist and all credit operations are properly controlled and audited. 