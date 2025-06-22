-- Migration: Add 'image_edit' and 'image_variation' to interactions type constraint
-- This allows image editing and variation interactions to be stored properly

-- Drop existing constraint
ALTER TABLE interactions DROP CONSTRAINT interactions_type_check;

-- Add new constraint with image_edit and image_variation included
ALTER TABLE interactions ADD CONSTRAINT interactions_type_check 
CHECK (type = ANY (ARRAY[
  'user_message'::text, 
  'assistant_message'::text, 
  'image_generation'::text, 
  'image_edit'::text,
  'image_variation'::text,
  'agent_action'::text, 
  'agent_finding'::text
])); 