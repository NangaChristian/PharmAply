CREATE TABLE IF NOT EXISTS public.produits_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dci TEXT,
    commercial_name TEXT NOT NULL,
    form TEXT,
    dosage TEXT,
    description TEXT,
    category TEXT,
    image_url TEXT,
    is_prescription_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT,
    commercial_name TEXT,
    dci TEXT,
    price NUMERIC DEFAULT 0,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pharmacy_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    patient_id TEXT,
    pharmacy_id TEXT,
    driver_id TEXT,
    status TEXT DEFAULT 'pending',
    delivery_mode TEXT DEFAULT 'delivery',
    total NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pharmacy_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'delivery';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.wallets (
    user_id TEXT PRIMARY KEY,
    balance NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produits_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
