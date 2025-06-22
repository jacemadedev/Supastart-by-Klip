-- Update the sessions summary function to optimize for latest image only
-- This improves performance by filtering only image artifacts at the database level
-- Fixes schema references and removes deleted_at columns that don't exist

CREATE OR REPLACE FUNCTION get_sessions_with_summary(
  org_id UUID,
  session_type TEXT DEFAULT NULL,
  starred_only BOOLEAN DEFAULT FALSE,
  search_query TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  type TEXT,
  starred BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  organization_id UUID,
  interaction_count BIGINT,
  latest_artifacts JSONB
) 
LANGUAGE SQL
STABLE
AS $$
  WITH session_interactions AS (
    SELECT 
      s.id,
      s.title as name,
      s.description,
      s.type,
      s.starred,
      s.created_at,
      s.updated_at,
      s.organization_id,
      COUNT(i.id) as interaction_count
    FROM sessions s
    LEFT JOIN interactions i ON s.id = i.session_id
    WHERE s.organization_id = org_id
      AND (session_type IS NULL OR s.type = session_type)
      AND (NOT starred_only OR s.starred = true)
      AND (
        search_query IS NULL 
        OR to_tsvector('english', COALESCE(s.title, '') || ' ' || COALESCE(s.description, '')) 
           @@ plainto_tsquery('english', search_query)
      )
    GROUP BY s.id, s.title, s.description, s.type, s.starred, s.created_at, s.updated_at, s.organization_id
  ),
  session_artifacts AS (
    SELECT 
      s.id as session_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'type', a.type,
            'url', a.url,
            'created_at', a.created_at,
            'interaction_id', a.interaction_id
          ) ORDER BY a.created_at DESC
        ) FILTER (WHERE a.id IS NOT NULL AND a.type = 'image'),
        '[]'::jsonb
      ) as latest_artifacts
    FROM session_interactions s
    LEFT JOIN interactions i ON s.id = i.session_id
    LEFT JOIN artifacts a ON i.id = a.interaction_id
    GROUP BY s.id
  )
  SELECT 
    si.id,
    si.name,
    si.description,
    si.type,
    si.starred,
    si.created_at,
    si.updated_at,
    si.organization_id,
    si.interaction_count,
    sa.latest_artifacts
  FROM session_interactions si
  LEFT JOIN session_artifacts sa ON si.id = sa.session_id
  ORDER BY si.updated_at DESC
  LIMIT limit_count
  OFFSET offset_count;
$$; 