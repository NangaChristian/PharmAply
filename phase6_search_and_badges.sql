-- Phase 2 : L'UX Patient & Recherche Intelligente (Recherche avec alternatives + Badges)

CREATE OR REPLACE FUNCTION search_medicines_for_patients(search_term TEXT)
RETURNS TABLE (
    id UUID,
    nom_commercial TEXT,
    dci TEXT,
    dosage TEXT,
    form TEXT,
    price NUMERIC,
    category_name TEXT,
    is_prescription_required BOOLEAN,
    classification_liste classification_liste_enum,
    is_essentiel BOOLEAN,
    is_active BOOLEAN,
    is_alternative BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH direct_matches AS (
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN ux_categories c ON p.ux_category_id = c.id
        WHERE p.is_active = true AND
        (p.nom_commercial ILIKE '%' || search_term || '%'
        OR p.dci ILIKE '%' || search_term || '%'
        OR c.name ILIKE '%' || search_term || '%')
    ),
    matched_dcis AS (
        SELECT DISTINCT d.dci FROM direct_matches d WHERE d.dci IS NOT NULL
    ),
    alternatives AS (
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN ux_categories c ON p.ux_category_id = c.id
        WHERE p.is_active = true AND p.is_essentiel = true AND p.dci IN (SELECT md.dci FROM matched_dcis md)
        AND p.id NOT IN (SELECT dm.id FROM direct_matches dm)
    )
    SELECT 
        dm.id, dm.nom_commercial, dm.dci, dm.dosage, dm.form, dm.price, dm.category_name, dm.is_prescription_required, dm.classification_liste, dm.is_essentiel, dm.is_active, FALSE AS is_alternative
    FROM direct_matches dm
    UNION ALL
    SELECT 
        a.id, a.nom_commercial, a.dci, a.dosage, a.form, a.price, a.category_name, a.is_prescription_required, a.classification_liste, a.is_essentiel, a.is_active, TRUE AS is_alternative
    FROM alternatives a;
END;
$$ LANGUAGE plpgsql;

-- Ajoutons un médicament essentiel pour le test (Paracétamol générique)
INSERT INTO products (dci, nom_commercial, dosage, form, is_prescription_required, classification_liste, is_essentiel, is_active, price, ux_category_id)
VALUES 
('Paracétamol', 'Paracétamol Générique DPML', '500mg', 'Comprimé', false, 'Libre', true, true, 500, (SELECT id FROM ux_categories WHERE slug = 'douleurs-fievre' LIMIT 1))
ON CONFLICT DO NOTHING;
