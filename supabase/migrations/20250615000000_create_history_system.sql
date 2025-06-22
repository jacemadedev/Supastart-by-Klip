-- Create unified history system for chat, sandbox, and future agent functionality
-- Migration: 20250615000000_create_history_system.sql

-- Create sessions table for grouping related interactions
CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "type" text NOT NULL CHECK ("type" IN ('chat', 'sandbox', 'agent')),
    "title" text,
    "description" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "starred" boolean DEFAULT false,
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Create interactions table for individual actions within sessions
CREATE TABLE IF NOT EXISTS "public"."interactions" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "session_id" uuid NOT NULL REFERENCES "public"."sessions"("id") ON DELETE CASCADE,
    "type" text NOT NULL CHECK ("type" IN ('user_message', 'assistant_message', 'image_generation', 'agent_action', 'agent_finding')),
    "content" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "cost_credits" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "sequence" integer NOT NULL
);

-- Create artifacts table for generated content (images, files, etc.)
CREATE TABLE IF NOT EXISTS "public"."artifacts" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "interaction_id" uuid NOT NULL REFERENCES "public"."interactions"("id") ON DELETE CASCADE,
    "type" text NOT NULL CHECK ("type" IN ('image', 'document', 'code', 'data')),
    "url" text,
    "filename" text,
    "size_bytes" bigint,
    "mime_type" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

-- Create agent_monitors table for future agent functionality
CREATE TABLE IF NOT EXISTS "public"."agent_monitors" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "type" text NOT NULL CHECK ("type" IN ('website', 'blog', 'search_results', 'rss_feed', 'api_endpoint')),
    "target_url" text NOT NULL,
    "check_frequency" interval DEFAULT '1 hour'::interval,
    "keywords" text[],
    "last_checked" timestamp with time zone,
    "last_change_detected" timestamp with time zone,
    "active" boolean DEFAULT true,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Create agent_findings table for agent discoveries
CREATE TABLE IF NOT EXISTS "public"."agent_findings" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "monitor_id" uuid NOT NULL REFERENCES "public"."agent_monitors"("id") ON DELETE CASCADE,
    "session_id" uuid REFERENCES "public"."sessions"("id") ON DELETE SET NULL,
    "change_type" text NOT NULL CHECK ("change_type" IN ('content_change', 'new_content', 'keyword_match', 'structure_change')),
    "summary" text NOT NULL,
    "details" jsonb DEFAULT '{}'::jsonb,
    "confidence_score" numeric(3,2) CHECK ("confidence_score" >= 0 AND "confidence_score" <= 1),
    "reviewed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "sessions_organization_id_idx" ON "public"."sessions"("organization_id");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "public"."sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_type_idx" ON "public"."sessions"("type");
CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "public"."sessions"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "sessions_starred_idx" ON "public"."sessions"("starred") WHERE "starred" = true;

CREATE INDEX IF NOT EXISTS "interactions_session_id_idx" ON "public"."interactions"("session_id");
CREATE INDEX IF NOT EXISTS "interactions_type_idx" ON "public"."interactions"("type");
CREATE INDEX IF NOT EXISTS "interactions_sequence_idx" ON "public"."interactions"("session_id", "sequence");

CREATE INDEX IF NOT EXISTS "artifacts_interaction_id_idx" ON "public"."artifacts"("interaction_id");
CREATE INDEX IF NOT EXISTS "artifacts_type_idx" ON "public"."artifacts"("type");

CREATE INDEX IF NOT EXISTS "agent_monitors_organization_id_idx" ON "public"."agent_monitors"("organization_id");
CREATE INDEX IF NOT EXISTS "agent_monitors_user_id_idx" ON "public"."agent_monitors"("user_id");
CREATE INDEX IF NOT EXISTS "agent_monitors_type_idx" ON "public"."agent_monitors"("type");
CREATE INDEX IF NOT EXISTS "agent_monitors_active_idx" ON "public"."agent_monitors"("active") WHERE "active" = true;

CREATE INDEX IF NOT EXISTS "agent_findings_monitor_id_idx" ON "public"."agent_findings"("monitor_id");
CREATE INDEX IF NOT EXISTS "agent_findings_session_id_idx" ON "public"."agent_findings"("session_id");
CREATE INDEX IF NOT EXISTS "agent_findings_reviewed_idx" ON "public"."agent_findings"("reviewed") WHERE "reviewed" = false;
CREATE INDEX IF NOT EXISTS "agent_findings_created_at_idx" ON "public"."agent_findings"("created_at" DESC);

-- Add RLS policies
ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_monitors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_findings" ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view sessions from their organizations" ON "public"."sessions"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."organization_members" om
            WHERE om.organization_id = "sessions"."organization_id"
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create sessions in their organizations" ON "public"."sessions"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."organization_members" om
            WHERE om.organization_id = "sessions"."organization_id"
            AND om.user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

CREATE POLICY "Users can update their own sessions" ON "public"."sessions"
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions" ON "public"."sessions"
    FOR DELETE USING (user_id = auth.uid());

-- Interactions policies (inherit from sessions)
CREATE POLICY "Users can view interactions from accessible sessions" ON "public"."interactions"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."sessions" s
            JOIN "public"."organization_members" om ON om.organization_id = s.organization_id
            WHERE s.id = "interactions"."session_id"
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create interactions in accessible sessions" ON "public"."interactions"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."sessions" s
            JOIN "public"."organization_members" om ON om.organization_id = s.organization_id
            WHERE s.id = "interactions"."session_id"
            AND om.user_id = auth.uid()
        )
    );

-- Artifacts policies (inherit from interactions)
CREATE POLICY "Users can view artifacts from accessible interactions" ON "public"."artifacts"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."interactions" i
            JOIN "public"."sessions" s ON s.id = i.session_id
            JOIN "public"."organization_members" om ON om.organization_id = s.organization_id
            WHERE i.id = "artifacts"."interaction_id"
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create artifacts for accessible interactions" ON "public"."artifacts"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."interactions" i
            JOIN "public"."sessions" s ON s.id = i.session_id
            JOIN "public"."organization_members" om ON om.organization_id = s.organization_id
            WHERE i.id = "artifacts"."interaction_id"
            AND om.user_id = auth.uid()
        )
    );

-- Agent monitors policies
CREATE POLICY "Users can view monitors from their organizations" ON "public"."agent_monitors"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."organization_members" om
            WHERE om.organization_id = "agent_monitors"."organization_id"
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create monitors in their organizations" ON "public"."agent_monitors"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."organization_members" om
            WHERE om.organization_id = "agent_monitors"."organization_id"
            AND om.user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

CREATE POLICY "Users can update their own monitors" ON "public"."agent_monitors"
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own monitors" ON "public"."agent_monitors"
    FOR DELETE USING (user_id = auth.uid());

-- Agent findings policies
CREATE POLICY "Users can view findings from their organization's monitors" ON "public"."agent_findings"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."agent_monitors" am
            JOIN "public"."organization_members" om ON om.organization_id = am.organization_id
            WHERE am.id = "agent_findings"."monitor_id"
            AND om.user_id = auth.uid()
        )
    );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "handle_sessions_updated_at" 
    BEFORE UPDATE ON "public"."sessions" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

CREATE OR REPLACE TRIGGER "handle_agent_monitors_updated_at" 
    BEFORE UPDATE ON "public"."agent_monitors" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- Create helper functions
CREATE OR REPLACE FUNCTION "public"."get_session_with_interactions"("session_id" uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Check if user has access to this session
    IF NOT EXISTS (
        SELECT 1 FROM sessions s
        JOIN organization_members om ON om.organization_id = s.organization_id
        WHERE s.id = session_id
        AND om.user_id = auth.uid()
    ) THEN
        RETURN NULL;
    END IF;
    
    SELECT jsonb_build_object(
        'session', to_jsonb(s.*),
        'interactions', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'interaction', to_jsonb(i.*),
                    'artifacts', i_artifacts.artifacts
                )
                ORDER BY i.sequence
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'::jsonb
        )
    ) INTO result
    FROM sessions s
    LEFT JOIN interactions i ON i.session_id = s.id
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(a.*)) as artifacts
        FROM artifacts a
        WHERE a.interaction_id = i.id
    ) i_artifacts ON true
    WHERE s.id = session_id
    GROUP BY s.id;
    
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_chat_session"(
    "organization_id" uuid,
    "title" text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_session_id uuid;
BEGIN
    -- Check if user is member of organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = create_chat_session.organization_id
        AND om.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;
    
    INSERT INTO sessions (organization_id, user_id, type, title)
    VALUES (create_chat_session.organization_id, auth.uid(), 'chat', create_chat_session.title)
    RETURNING id INTO new_session_id;
    
    RETURN new_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_sandbox_session"(
    "organization_id" uuid,
    "title" text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_session_id uuid;
BEGIN
    -- Check if user is member of organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = create_sandbox_session.organization_id
        AND om.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;
    
    INSERT INTO sessions (organization_id, user_id, type, title)
    VALUES (create_sandbox_session.organization_id, auth.uid(), 'sandbox', create_sandbox_session.title)
    RETURNING id INTO new_session_id;
    
    RETURN new_session_id;
END;
$$; 