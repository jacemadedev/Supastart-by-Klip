-- Migration: Add 'magic_ads' to sessions type constraint
-- This allows Magic Ads sessions to be stored in the sessions table

-- Drop existing constraint
ALTER TABLE sessions DROP CONSTRAINT sessions_type_check;

-- Add new constraint with magic_ads included
ALTER TABLE sessions ADD CONSTRAINT sessions_type_check 
CHECK (type = ANY (ARRAY[
  'chat'::text, 
  'sandbox'::text, 
  'agent'::text,
  'magic_ads'::text
])); 