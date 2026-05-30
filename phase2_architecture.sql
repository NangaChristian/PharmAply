-- Phase 2 : Nouvelle Architecture de la Table Produits

DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS ux_categories CASCADE;

-- Table des catégories orientées UX/Symptômes pour le patient
CREATE TABLE ux_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL, -- Ex: Douleurs & Fièvre, Rhume & Toux
  description text,
  icon text,
  slug text UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Nouvelle table des produits respectant la nomenclature LNME
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dci text NOT NULL, -- Dénomination Commune Internationale (Molécule officielle de la LNME)
  commercial_name text NOT NULL, -- Nom de marque (ex: Doliprane)
  dosage text, -- Ex: 500mg
  form text, -- Ex: Comprimé, Sirop
  is_prescription_required boolean DEFAULT false, -- Sur ordonnance ou non
  ux_category_id uuid REFERENCES ux_categories(id) ON DELETE SET NULL, -- Lien vers la catégorie UX
  
  -- Champs additionnels pour le e-commerce
  description text,
  symptoms jsonb DEFAULT '[]'::jsonb, -- Liste des symptômes traités (ex: ["Fièvre", "Maux de tête"])
  price numeric(10,2) DEFAULT 0.0,
  stock integer DEFAULT 0,
  pharmacy_id text NOT NULL, -- À lier ultérieurement à une table pharmacy si besoin
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertion des catégories UX par défaut
INSERT INTO ux_categories (id, name, slug, icon) VALUES 
  (gen_random_uuid(), 'Douleurs & Fièvre', 'douleurs-fievre', 'Thermometer'),
  (gen_random_uuid(), 'Rhume & Toux', 'rhume-toux', 'Wind'),
  (gen_random_uuid(), 'Digestion', 'digestion', 'Activity'),
  (gen_random_uuid(), 'Premiers Soins', 'premiers-soins', 'Cross'),
  (gen_random_uuid(), 'Vitamines & Tonus', 'vitamines-tonus', 'Zap'),
  (gen_random_uuid(), 'Bébé & Enfant', 'bebe-enfant', 'Baby'),
  (gen_random_uuid(), 'Yeux & Oreilles', 'yeux-oreilles', 'Eye')
ON CONFLICT (slug) DO NOTHING;

-- Exemple d'insertion d'un produit
/*
INSERT INTO products (dci, commercial_name, dosage, form, is_prescription_required, price, pharmacy_id)
VALUES ('Paracétamol', 'Doliprane', '500mg', 'Comprimé', false, 1500, 'pharmacy_demo_1');
*/
