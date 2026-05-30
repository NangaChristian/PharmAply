-- Phase 4 : Synchronisation Automatique DPML (Web Scraper)

-- 1. Ajout des champs pour la gestion des numéros d'AMM, lots et statut de retrait
ALTER TABLE products ADD COLUMN IF NOT EXISTS num_amm TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_recalled BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS recall_reason TEXT;

-- 2. Création de la table historique des alertes de la DPML (Direction de la Pharmacie et du Médicament)
CREATE TABLE IF NOT EXISTS dpml_alertes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    num_amm TEXT,
    lot_number TEXT,
    product_name TEXT,
    motif_retrait TEXT,
    date_alerte TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Index pour optimiser les performances des requêtes du bot
CREATE INDEX IF NOT EXISTS idx_dpml_alertes_amm ON dpml_alertes(num_amm);
CREATE INDEX IF NOT EXISTS idx_dpml_alertes_lot ON dpml_alertes(lot_number);
CREATE INDEX IF NOT EXISTS idx_products_amm_lot ON products(num_amm, lot_number);

-- Vue pour l'admin (les produits actuellement sous alerte DPML)
CREATE OR REPLACE VIEW view_dpml_recalled_products AS
SELECT p.id, p.nom_commercial, p.dci, p.num_amm, p.lot_number, a.motif_retrait, a.date_alerte
FROM products p
JOIN dpml_alertes a ON (p.num_amm = a.num_amm OR p.lot_number = a.lot_number)
WHERE p.is_recalled = true;
