-- Migration script to add the missing commercial_name column to the products table
ALTER TABLE IF EXISTS public.products 
ADD COLUMN IF NOT EXISTS commercial_name TEXT;

-- Optionally, if there is a nom_commercial column, you could copy the data over using:
-- UPDATE public.products SET commercial_name = nom_commercial WHERE commercial_name IS NULL;
