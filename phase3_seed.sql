-- Phase 3 : Mapping des Catégories (Le pont UX / Médical) & Seed des produits LNME

-- Nettoyage optionnel avant insertion
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE ux_categories CASCADE;

-- 1. Insertion des catégories Grand Public (UX Categories)
INSERT INTO ux_categories (id, name, slug, icon, description) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Douleurs & Fièvre', 'douleurs-fievre', 'Thermometer', 'Cible les Analgésiques/Antipyrétiques (ex: Paracétamol, Ibuprofène)'),
  ('22222222-2222-2222-2222-222222222222', 'Paludisme', 'paludisme', 'Shield', 'Cible les Antipaludiques (ex: Artemether, Quinine)'),
  ('33333333-3333-3333-3333-333333333333', 'Maux d''estomac & Digestion', 'digestion', 'Activity', 'Cible les Antiacides/Anti-ulcéreux (ex: Oméprazole, Diosmectite)'),
  ('44444444-4444-4444-4444-444444444444', 'Toux, Rhume & Asthme', 'toux-rhume-asthme', 'Wind', 'Cible les Bronchodilatateurs et Fluidifiants (ex: Salbutamol, Carbocystéine)'),
  ('55555555-5555-5555-5555-555555555555', 'Allergies', 'allergies', 'Feather', 'Cible les Antihistaminiques (ex: Loratadine, Chlorphéniramine)'),
  ('66666666-6666-6666-6666-666666666666', 'Vitamines & Compléments', 'vitamines-complements', 'Zap', 'Cible l''Acide Ascorbique, Vitamines B')
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name, 
  icon = EXCLUDED.icon,
  description = EXCLUDED.description;

-- 2. Insertion d'un échantillon de médicaments LNME reliés aux catégories UX
INSERT INTO products (dci, commercial_name, dosage, form, is_prescription_required, ux_category_id, symptoms, price, pharmacy_id)
VALUES 
  -- Douleurs & Fièvre
  ('Paracétamol', 'Doliprane', '500mg', 'Comprimé', false, '11111111-1111-1111-1111-111111111111', '["Fièvre", "Maux de tête", "Douleur"]', 1500, 'pharmacy_demo_1'),
  ('Ibuprofène', 'Advil', '400mg', 'Comprimé', false, '11111111-1111-1111-1111-111111111111', '["Fièvre", "Maux de tête", "Douleur inflammatoire"]', 2000, 'pharmacy_demo_1'),

  -- Paludisme
  ('Artemether + Luméfantrine', 'Coartem', '20mg/120mg', 'Comprimé', true, '22222222-2222-2222-2222-222222222222', '["Fièvre paludéenne", "Frissons"]', 3500, 'pharmacy_demo_1'),
  ('Quinine', 'Quinimax', '300mg', 'Comprimé', true, '22222222-2222-2222-2222-222222222222', '["Paludisme"]', 2500, 'pharmacy_demo_1'),

  -- Maux d'estomac & Digestion
  ('Oméprazole', 'Mopral', '20mg', 'Gélule', true, '33333333-3333-3333-3333-333333333333', '["Aigreurs", "Reflux"]', 4000, 'pharmacy_demo_1'),
  ('Diosmectite', 'Smecta', '3g', 'Sachet', false, '33333333-3333-3333-3333-333333333333', '["Diarrhée", "Maux d''estomac"]', 2500, 'pharmacy_demo_1'),

  -- Toux, Rhume & Asthme
  ('Salbutamol', 'Ventoline', '100µg/dose', 'Aérosol', true, '44444444-4444-4444-4444-444444444444', '["Crise d''asthme", "Respiration difficile"]', 3000, 'pharmacy_demo_1'),
  ('Carbocystéine', 'Rhinathiol', '5%', 'Sirop', false, '44444444-4444-4444-4444-444444444444', '["Toux grasse"]', 2000, 'pharmacy_demo_1'),

  -- Allergies
  ('Loratadine', 'Clarityne', '10mg', 'Comprimé', false, '55555555-5555-5555-5555-555555555555', '["Allergie", "Éternuements"]', 1800, 'pharmacy_demo_1'),
  ('Chlorphéniramine', 'Polaramine', '4mg', 'Comprimé', false, '55555555-5555-5555-5555-555555555555', '["Allergie", "Démangeaisons"]', 1200, 'pharmacy_demo_1'),

  -- Vitamines & Compléments
  ('Acide Ascorbique', 'Vitamine C UPSA', '1g', 'Comprimé effervescent', false, '66666666-6666-6666-6666-666666666666', '["Fatigue"]', 2500, 'pharmacy_demo_1'),
  ('Complexe vitaminique B', 'Alvityl', '15mg', 'Comprimé', false, '66666666-6666-6666-6666-666666666666', '["Fatigue", "Carence"]', 3000, 'pharmacy_demo_1');
