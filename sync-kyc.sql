-- Sync driver status with users table for already approved users
UPDATE public.drivers
SET 
  status = 'approved',
  data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', '"approved"'), 
          '{kyc_status}', '"approved"'
         )
WHERE id IN (
  SELECT id FROM public.users WHERE data->>'status' = 'approved'
);

-- Update users top-level just in case
UPDATE public.users
SET 
  data = jsonb_set(
          jsonb_set(COALESCE(data, '{}'::jsonb), '{status}', '"approved"'), 
          '{kyc_status}', '"approved"'
         )
WHERE data->>'status' = 'approved';
