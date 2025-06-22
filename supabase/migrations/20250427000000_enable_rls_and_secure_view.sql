-- Migration: Enable RLS on webhook_logs and system_logs and create secure view
-- Description: Fixes security issues by enabling RLS on logs tables and creating a secure view

-- Enable Row Level Security on webhook_logs table
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on system_logs table
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Create or replace the organization_members_with_profiles view with security_invoker=on
CREATE OR REPLACE VIEW public.organization_members_with_profiles
WITH (security_invoker = on) AS
SELECT om.id,
       om.organization_id,
       om.user_id,
       om.role,
       om.created_at,
       om.updated_at,
       p.full_name,
       p.email,
       p.avatar_url
FROM organization_members om
JOIN profiles p ON om.user_id = p.id;

COMMENT ON VIEW public.organization_members_with_profiles IS 'View that joins organization members with their profile information for easier querying with security_invoker=on'; 