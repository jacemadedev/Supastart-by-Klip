-- Fix the use_organization_credits_safe function to use the direct credits_balance
-- instead of the calculated get_organization_credits function
-- This resolves issues with credit balance discrepancies

CREATE OR REPLACE FUNCTION public.use_organization_credits_safe(org_id uuid, amount integer, description text DEFAULT NULL::text, feature_id text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    
    -- Get available credits directly from the organizations table
    -- This is more reliable than the calculated function
    SELECT credits_balance INTO available_credits
    FROM organizations
    WHERE id = org_id;
    
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
$function$; 