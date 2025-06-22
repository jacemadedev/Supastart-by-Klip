-- Create storage buckets for generated content
-- Migration: 20250615000001_create_storage_buckets.sql

-- Create a bucket for generated images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-images',
  'generated-images', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the generated-images bucket
-- Allow users to insert images in their organization's folder
CREATE POLICY "Users can upload images to their organization folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-images' 
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'organization_id'
  );

-- Allow users to view images from their organization
CREATE POLICY "Users can view images from their organization"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated-images' 
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'organization_id'
  );

-- Allow users to delete images from their organization
CREATE POLICY "Users can delete images from their organization"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generated-images' 
    AND (storage.foldername(name))[1] = auth.jwt() ->> 'organization_id'
  );

-- Note: RLS is already enabled on storage.objects by default in Supabase 