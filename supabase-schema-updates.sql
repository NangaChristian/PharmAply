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

-- 3. Create Messages Table for Real-time Chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "relatedId" TEXT NOT NULL, 
    "patientId" TEXT,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "senderType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- e.g., 'welcome', 'new_order', 'prescription_uploaded', 'driver_assigned'
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN DEFAULT FALSE,
    "relatedId" TEXT, -- e.g., order_id, prescription_id
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read their own notifications" ON public.notifications FOR SELECT USING ( auth.uid() = user_id );
-- CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ( auth.uid() = user_id );

-- Add RLS Policies for Messages (Example)
-- CREATE POLICY "Users can read messages for their orders" ON public.chat_messages FOR SELECT USING ( auth.uid()::text = "patientId" OR auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId" );
-- CREATE POLICY "Users can insert messages" ON public.chat_messages FOR INSERT WITH CHECK ( auth.uid()::text = "senderId" );
