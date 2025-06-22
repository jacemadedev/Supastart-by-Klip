-- Optimize sessions table with compound indexes for better query performance
-- This migration adds indexes to support efficient filtering and sorting of sessions

-- Compound index for organization + type + updated_at (covers most common queries)
CREATE INDEX IF NOT EXISTS sessions_org_type_updated_idx 
ON sessions (organization_id, type, updated_at DESC);

-- Compound index for organization + starred + updated_at (for starred sessions)
CREATE INDEX IF NOT EXISTS sessions_org_starred_updated_idx 
ON sessions (organization_id, starred, updated_at DESC) 
WHERE starred = true;

-- Index for organization + created_at (for chronological queries)
CREATE INDEX IF NOT EXISTS sessions_org_created_desc_idx 
ON sessions (organization_id, created_at DESC);

-- Full-text search index using PostgreSQL's GIN (for search functionality)
-- Note: Using title column (not name) as per sessions table schema
CREATE INDEX IF NOT EXISTS sessions_search_idx 
ON sessions USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '')));

-- Optimize interactions table for joins
CREATE INDEX IF NOT EXISTS interactions_session_created_idx 
ON interactions (session_id, created_at DESC);

-- Optimize artifacts table for joins  
CREATE INDEX IF NOT EXISTS artifacts_interaction_created_idx 
ON artifacts (interaction_id, created_at DESC);

-- Index to help with counting interactions per session
CREATE INDEX IF NOT EXISTS interactions_session_count_idx 
ON interactions (session_id); 