-- Database update to support Pickup vs. Delivery
-- Since Phase 1 asks for the SQL to update the orders table in Supabase to include delivery_method

ALTER TABLE orders
ADD COLUMN delivery_method VARCHAR(20) DEFAULT 'delivery';

-- Add a constraint if desired (assuming PostgreSQL in Supabase)
ALTER TABLE orders
ADD CONSTRAINT chk_delivery_method CHECK (delivery_method IN ('pickup', 'delivery'));
