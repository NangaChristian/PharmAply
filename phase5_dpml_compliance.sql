-- Phase 1 : Restructuration de la Base de Données (DPML Regulatory Compliance)

-- 1. Création de l'Enum pour la classification_liste
DO $$ BEGIN
    CREATE TYPE classification_liste_enum AS ENUM ('Libre', 'Liste_1', 'Liste_2', 'Stupefiant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Mise à jour de la fonction RPC de recherche existante (car elle dépend de commercial_name)
DROP FUNCTION IF EXISTS search_medicines_for_patients(text);

-- 3. Mise à jour de la table products
ALTER TABLE products RENAME COLUMN commercial_name TO nom_commercial;
ALTER TABLE products ADD COLUMN IF NOT EXISTS num_amm TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS date_expiration_amm DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS classification_liste classification_liste_enum DEFAULT 'Libre';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_essentiel BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Re-création de la fonction RPC de recherche
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
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nom_commercial,
        p.dci,
        p.dosage,
        p.form,
        p.price,
        c.name AS category_name,
        p.is_prescription_required,
        p.classification_liste,
        p.is_essentiel,
        p.is_active
    FROM 
        products p
    LEFT JOIN 
        ux_categories c ON p.ux_category_id = c.id
    WHERE 
        p.is_active = true AND
        (p.nom_commercial ILIKE '%' || search_term || '%'
        OR p.dci ILIKE '%' || search_term || '%'
        OR c.name ILIKE '%' || search_term || '%');
END;
$$ LANGUAGE plpgsql;

-- 5. Création de la table dpml_alertes pour journaliser les retraits de lots gouvernementaux
CREATE TABLE IF NOT EXISTS dpml_alertes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titre TEXT NOT NULL,
    description TEXT,
    num_lot_concerne TEXT NOT NULL,
    date_alerte DATE NOT NULL DEFAULT CURRENT_DATE,
    dci_concerne TEXT,
    nom_commercial_concerne TEXT,
    statut TEXT DEFAULT 'Actif', -- 'Actif' ou 'Résolu'
    action_requise TEXT, -- ex: 'Retrait immédiat', 'Mise en quarantaine'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
