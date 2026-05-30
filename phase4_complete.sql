-- Phase 4: Architecture Complète, Données et Recherche Intelligente

-- 1. Nettoyage / Drop des anciennes tables (si existantes)
DROP FUNCTION IF EXISTS search_medicines_for_patients(text);
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS ux_categories CASCADE;

-- 2. Création des nouvelles tables
CREATE TABLE ux_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dci TEXT NOT NULL, -- Dénomination Commune Internationale
    commercial_name TEXT, -- Nom de marque
    dosage TEXT,
    form TEXT,
    is_prescription_required BOOLEAN DEFAULT false,
    ux_category_id UUID REFERENCES ux_categories(id),
    symptoms JSONB, -- Stocke une liste de symptômes comme ["Fièvre", "Toux"]
    price NUMERIC,
    pharmacy_id TEXT, -- Relation avec la pharmacie (simulée pour l'exemple)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Fonction RPC de recherche (Patient-Friendly)
CREATE OR REPLACE FUNCTION search_medicines_for_patients(search_term TEXT)
RETURNS TABLE (
    id UUID,
    commercial_name TEXT,
    dci TEXT,
    dosage TEXT,
    form TEXT,
    price NUMERIC,
    category_name TEXT,
    is_prescription_required BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.commercial_name,
        p.dci,
        p.dosage,
        p.form,
        p.price,
        c.name AS category_name,
        p.is_prescription_required
    FROM 
        products p
    LEFT JOIN 
        ux_categories c ON p.ux_category_id = c.id
    WHERE 
        p.commercial_name ILIKE '%' || search_term || '%'
        OR p.dci ILIKE '%' || search_term || '%'
        OR c.name ILIKE '%' || search_term || '%';
END;
$$ LANGUAGE plpgsql;

-- 4. Seed des catégories UX
INSERT INTO ux_categories (id, name, slug, icon, description) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Douleurs & Fièvre', 'douleurs-fievre', 'Thermometer', 'Cible les Analgésiques/Antipyrétiques (ex: Paracétamol, Ibuprofène)'),
  ('22222222-2222-2222-2222-222222222222', 'Paludisme', 'paludisme', 'Shield', 'Cible les Antipaludiques (ex: Artemether, Quinine)'),
  ('33333333-3333-3333-3333-333333333333', 'Maux d''estomac & Digestion', 'digestion', 'Activity', 'Cible les Antiacides/Anti-ulcéreux (ex: Oméprazole, Diosmectite)'),
  ('44444444-4444-4444-4444-444444444444', 'Toux, Rhume & Asthme', 'toux-rhume-asthme', 'Wind', 'Cible les Bronchodilatateurs et Fluidifiants (ex: Salbutamol, Carbocystéine)'),
  ('55555555-5555-5555-5555-555555555555', 'Allergies', 'allergies', 'Feather', 'Cible les Antihistaminiques (ex: Loratadine, Chlorphéniramine)'),
  ('66666666-6666-6666-6666-666666666666', 'Vitamines & Compléments', 'vitamines-complements', 'Zap', 'Cible l''Acide Ascorbique, Vitamines B'),
  ('77777777-7777-7777-7777-777777777777', 'Soins & Blessures', 'soins-blessures', 'Cross', 'Cible les Antiseptiques comme la Polyvidone iodée, Chlorhexidine');

-- 5. Seed des 15 médicaments de base (LNME -> Commercial)
INSERT INTO products (dci, commercial_name, dosage, form, is_prescription_required, ux_category_id, symptoms, price, pharmacy_id)
VALUES 
  -- Douleurs & Fièvre
  ('Paracétamol', 'Doliprane', '500mg', 'Comprimé', false, '11111111-1111-1111-1111-111111111111', '["Fièvre", "Maux de tête", "Douleur"]', 1500, 'pharmacy_demo_1'),
  ('Paracétamol', 'Efferalgan', '1000mg', 'Comprimé effervescent', false, '11111111-1111-1111-1111-111111111111', '["Fièvre", "Maux de tête", "Douleur"]', 2000, 'pharmacy_demo_1'),
  ('Ibuprofène', 'Advil', '400mg', 'Comprimé', false, '11111111-1111-1111-1111-111111111111', '["Fièvre", "Maux de tête", "Douleur inflammatoire"]', 2200, 'pharmacy_demo_1'),

  -- Paludisme
  ('Artemether + Luméfantrine', 'Coartem', '20mg/120mg', 'Comprimé', true, '22222222-2222-2222-2222-222222222222', '["Fièvre paludéenne", "Frissons"]', 3500, 'pharmacy_demo_1'),
  ('Quinine', 'Quinimax', '300mg', 'Comprimé', true, '22222222-2222-2222-2222-222222222222', '["Paludisme"]', 2500, 'pharmacy_demo_1'),

  -- Maux d'estomac & Digestion
  ('Oméprazole', 'Mopral', '20mg', 'Gélule', true, '33333333-3333-3333-3333-333333333333', '["Aigreurs", "Reflux"]', 4000, 'pharmacy_demo_1'),
  ('Diosmectite', 'Smecta', '3g', 'Sachet', false, '33333333-3333-3333-3333-333333333333', '["Diarrhée", "Maux d''estomac"]', 2500, 'pharmacy_demo_1'),
  ('Phloroglucinol', 'Spasfon', '80mg', 'Comprimé', false, '33333333-3333-3333-3333-333333333333', '["Spasmes", "Douleurs abdominales"]', 1800, 'pharmacy_demo_1'),

  -- Toux, Rhume & Asthme
  ('Salbutamol', 'Ventoline', '100µg/dose', 'Aérosol', true, '44444444-4444-4444-4444-444444444444', '["Crise d''asthme", "Respiration difficile"]', 3000, 'pharmacy_demo_1'),
  ('Carbocystéine', 'Rhinathiol', '5%', 'Sirop', false, '44444444-4444-4444-4444-444444444444', '["Toux grasse"]', 2000, 'pharmacy_demo_1'),

  -- Allergies
  ('Loratadine', 'Clarityne', '10mg', 'Comprimé', false, '55555555-5555-5555-5555-555555555555', '["Allergie", "Éternuements"]', 1800, 'pharmacy_demo_1'),
  ('Chlorphéniramine', 'Polaramine', '4mg', 'Comprimé', false, '55555555-5555-5555-5555-555555555555', '["Allergie", "Démangeaisons"]', 1200, 'pharmacy_demo_1'),

  -- Vitamines & Compléments
  ('Acide Ascorbique', 'Vitamine C UPSA', '1g', 'Comprimé effervescent', false, '66666666-6666-6666-6666-666666666666', '["Fatigue"]', 2500, 'pharmacy_demo_1'),

  -- Soins & Blessures
  ('Polyvidone iodée', 'Bétadine', '10%', 'Solution cutanée', false, '77777777-7777-7777-7777-777777777777', '["Plaie", "Antiseptie"]', 1500, 'pharmacy_demo_1'),
  ('Chlorhexidine', 'Biseptine', '0.5%', 'Solution spray', false, '77777777-7777-7777-7777-777777777777', '["Plaie", "Désinfection"]', 2300, 'pharmacy_demo_1');
