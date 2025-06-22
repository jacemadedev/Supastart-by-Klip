-- Migration: Add DELETE policies for artifacts
-- This allows users to delete artifacts from their own sessions

-- Add DELETE policy for artifacts
CREATE POLICY "Users can delete artifacts from accessible interactions" ON "public"."artifacts"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "public"."interactions" i
            JOIN "public"."sessions" s ON s.id = i.session_id
            JOIN "public"."organization_members" om ON om.organization_id = s.organization_id
            WHERE i.id = "artifacts"."interaction_id"
            AND om.user_id = auth.uid()
            AND s.user_id = auth.uid()  -- Extra check: user must own the session
        )
    );

-- Also add UPDATE policy for artifacts (in case we need to modify them in the future)
CREATE POLICY "Users can update artifacts from accessible interactions" ON "public"."artifacts"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "public"."interactions" i
            JOIN "public"."sessions" s ON s.id = i.session_id
            JOIN "public"."organization_members" om ON om.organization_id = s.organization_id
            WHERE i.id = "artifacts"."interaction_id"
            AND om.user_id = auth.uid()
            AND s.user_id = auth.uid()  -- Extra check: user must own the session
        )
    ); 