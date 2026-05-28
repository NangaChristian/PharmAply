-- Migration: Create Driver Telemetry Logs

CREATE TABLE IF NOT EXISTS public.driver_telemetry_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    route_deviation BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimize queries for tracking live fleets and historic paths
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_logs_driver_id ON public.driver_telemetry_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_telemetry_logs_created_at ON public.driver_telemetry_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.driver_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- Strict database Row-Level Security (RLS) rules ensuring that only authenticated admin users can access the global live tracking streams
CREATE POLICY "Enable read access for admin users only" 
ON public.driver_telemetry_logs
FOR SELECT
TO authenticated
USING (
  -- Assume admin roles are defined in user metadata or a profiles table
  -- We'll use a standard JWT claim check for an admin role or allow reading if explicitly an admin.
  (auth.jwt() ->> 'role') = 'admin' OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Allow service role to insert (for the Express backend)
-- Note: service_role bypasses RLS by default, but it's good practice to be explicit if inserting via authenticated drivers.
CREATE POLICY "Drivers can insert their own telemetry"
ON public.driver_telemetry_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = driver_id
);
