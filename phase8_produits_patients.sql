CREATE TABLE IF NOT EXISTS public.produits_patients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dci text NOT NULL,
  commercial_name text NOT NULL,
  dosage text,
  form text,
  is_prescription_required boolean DEFAULT false,
  ux_category text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.produits_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all public selects on produits_patients" ON public.produits_patients;
DROP POLICY IF EXISTS "Allow all public inserts on produits_patients" ON public.produits_patients;
DROP POLICY IF EXISTS "Allow all public updates on produits_patients" ON public.produits_patients;
DROP POLICY IF EXISTS "Allow all public deletes on produits_patients" ON public.produits_patients;

CREATE POLICY "Allow all public selects on produits_patients"
ON public.produits_patients FOR SELECT USING (true);

CREATE POLICY "Allow all public inserts on produits_patients"
ON public.produits_patients FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all public updates on produits_patients"
ON public.produits_patients FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all public deletes on produits_patients"
ON public.produits_patients FOR DELETE USING (true);
