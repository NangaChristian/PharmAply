-- Supabase Schema Updates for PharmAply Driver Platform

-- 1. Create or Update Drivers Table
-- Note: Changed 'id' to TEXT to avoid UUID/TEXT type mismatches with existing systems (like Firebase UIDs)
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone_number TEXT,
    vehicle_type TEXT DEFAULT 'motorcycle',
    license_plate TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    kyc_status TEXT DEFAULT 'pending',
    payout_method TEXT,
    payout_account TEXT,
    rating DECIMAL(2, 1) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Update Orders Table
-- Using TEXT for driver_id to prevent the 42804 incompatible types error
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS driver_id TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS delivery_stage TEXT, 
ADD COLUMN IF NOT EXISTS driver_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS driver_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 3. Correct Messages Table for Real-time Chat
-- Drop any wrongly created explicit column tables
DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.messages;

CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 4. Correct Notifications Table
-- Drop any wrongly created explicit column tables
DROP TABLE IF EXISTS public.notifications;

CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read their own notifications" ON public.notifications FOR SELECT USING ( (data->>'userId') = auth.uid()::text );
-- CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ( (data->>'userId') = auth.uid()::text );

-- Add RLS Policies for Messages (Example)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read messages for their orders" ON public.messages FOR SELECT USING ( (data->>'patientId') = auth.uid()::text OR (data->>'senderId') = auth.uid()::text OR (data->>'receiverId') = auth.uid()::text );
-- CREATE POLICY "Users can insert messages" ON public.messages FOR INSERT WITH CHECK ( (data->>'senderId') = auth.uid()::text );

-- 5. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT USING ( true );
-- CREATE POLICY "Authenticated users can create reviews" ON public.reviews FOR INSERT WITH CHECK ( (data->>'reviewerId') = auth.uid()::text );

-- 6. Create Prescription Scans Table (for AI OCR)
CREATE TABLE IF NOT EXISTS public.prescription_scans (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.prescription_scans ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read own scans" ON public.prescription_scans FOR SELECT USING ( (data->>'patientId') = auth.uid()::text OR (data->>'pharmacyId') = auth.uid()::text );
-- CREATE POLICY "Users can insert own scans" ON public.prescription_scans FOR INSERT WITH CHECK ( (data->>'patientId') = auth.uid()::text );

-- 7. Create Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read own order items" ON public.order_items FOR SELECT USING ( true );
