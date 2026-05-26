-- 1. Create Tables for NoSQL-like Collections
-- We will use JSONB for flexible attributes to avoid constant schema updates 
-- while this app uses "Firestore-style" unstructured objects.

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.pharmacies (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.drivers (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.logs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.support_queries (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.flash_sales (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- For development purporses, we can allow ALL access to authenticated users.
-- In production, you would configure strict RLS policies per table.

-- Create a generic policy for all tables allowing full access to authenticated users
DO $$ 
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon select" ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon insert" ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon update" ON public.%I;', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all public" ON public.%I;', table_name);
        
        EXECUTE format('CREATE POLICY "Allow all public" ON public.%I FOR ALL USING (true) WITH CHECK (true);', table_name);
    END LOOP;
END $$;


-- 2. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
('images', 'images', true),
('drivers', 'drivers', true),
('pharmacies', 'pharmacies', true),
('profiles', 'profiles', true),
('products', 'products', true),
('prescriptions', 'prescriptions', true),
('settings', 'settings', true),
('orders', 'orders', false),
('kyc', 'kyc', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Rules
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read isolated files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update/delete files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Allow public access to read files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id IN ('images', 'drivers', 'pharmacies', 'profiles', 'products', 'prescriptions', 'settings') );

-- Allow authenticated users to read isolated buckets
CREATE POLICY "Authenticated users can read isolated files"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id IN ('orders', 'kyc') );

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id IN ('images', 'drivers', 'pharmacies', 'profiles', 'products', 'prescriptions', 'settings', 'orders', 'kyc') );

-- Allow authenticated users to update/delete files
CREATE POLICY "Authenticated users can update/delete files"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id IN ('images', 'drivers', 'pharmacies', 'profiles', 'products', 'prescriptions', 'settings', 'orders', 'kyc') );

CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id IN ('images', 'drivers', 'pharmacies', 'profiles', 'products', 'prescriptions', 'settings', 'orders', 'kyc') );
