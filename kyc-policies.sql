-- Phase 1: Fixing Supabase Storage RLS for KYC Documents
-- Assuming a bucket named 'kyc_documents' exists.

-- Enable RLS on the storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated drivers to INSERT (upload) their own KYC documents
CREATE POLICY "Drivers can upload KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc_documents' AND 
  (auth.uid()::text = (storage.foldername(name))[1])
);

-- Allow authenticated drivers to SELECT (read) their own KYC documents
CREATE POLICY "Drivers can view their own KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc_documents' AND
  (auth.uid()::text = (storage.foldername(name))[1])
);

-- Allow admin role to SELECT (read) all KYC documents
CREATE POLICY "Admins can view all KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc_documents' AND 
  (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
);
