-- Phase 1 & 2: Supabase KYC Storage and Database Updates

-- 1. Ensure the 'drivers' storage bucket exists and is PUBLIC
INSERT INTO storage.buckets (id, name, public)
VALUES ('drivers', 'drivers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow authenticated users to upload documents to the 'drivers' bucket
CREATE POLICY "Drivers can upload their own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'drivers' AND 
  (auth.uid()::text = (string_to_array(name, '/'))[1])
);

-- 3. Allow public or authenticated users to view documents in the 'drivers' bucket
-- (Since bucket is public, this might not be strictly necessary for getPublicUrl,
-- but good for direct read access via SELECT if used).
CREATE POLICY "Anyone can view driver documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'drivers');

-- 2.1 Schema Updates (Phase 2): single source of truth for kyc_status
-- Alter drivers table if not already handling status natively
-- The original code used 'status' for both users and drivers tables. Let's make sure 'drivers' has 'status'.
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending_verification';
