-- Phase 1 : Suppression des données produits et catégories existantes
-- Option A: Nettoyage des données seulement
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE categories CASCADE;

-- Option B: Suppression et recréation des tables (dé-commentez si vous souhaitez recréer l'architecture de zéro)
/*
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  slug text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL, -- Nom commercial / patient-friendly
  scientific_name text, -- DCI (Dénomination Commune Internationale)
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  description text,
  symptoms jsonb DEFAULT '[]'::jsonb, -- ex: ["Fièvre", "Maux de tête"]
  dosage text,
  form text, -- ex: Comprimé, Sirop
  requires_prescription boolean DEFAULT false,
  price numeric(10,2) DEFAULT 0.0,
  stock integer DEFAULT 0,
  pharmacy_id text NOT NULL, 
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
*/

-- Phase 2 : Insertion des catégories "Orientées Besoins / Symptômes"
INSERT INTO categories (id, name, slug, icon) VALUES 
  (gen_random_uuid(), 'Douleurs & Fièvre', 'douleurs-fievre', 'Thermometer'),
  (gen_random_uuid(), 'Rhume & Toux', 'rhume-toux', 'Wind'),
  (gen_random_uuid(), 'Digestion', 'digestion', 'Activity'),
  (gen_random_uuid(), 'Premiers Soins', 'premiers-soins', 'Cross'),
  (gen_random_uuid(), 'Vitamines & Tonus', 'vitamines-tonus', 'Zap'),
  (gen_random_uuid(), 'Bébé & Enfant', 'bebe-enfant', 'Baby'),
  (gen_random_uuid(), 'Yeux & Oreilles', 'yeux-oreilles', 'Eye')
ON CONFLICT (slug) DO NOTHING;

-- Exemple d'insertion d'un médicament LNME re-catégorisé pour le patient
-- (Utilisez les IDs de catégories générées pour compléter cette logique si besoin)
/*
INSERT INTO products (name, scientific_name, category_id, description, symptoms, dosage, form, requires_prescription, price, pharmacy_id)
VALUES 
  ('Paracétamol (Doliprane)', 'Paracétamol', '...id...', 'Soulage la douleur légère à modérée et abaisse la fièvre', '["Fièvre", "Maux de tête", "Douleur articulaire"]', '500mg', 'Comprimé', false, 1500, 'YOUR_PHARMACY_ID');
*/
