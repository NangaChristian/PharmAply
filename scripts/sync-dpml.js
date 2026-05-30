const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

// 1. Initialisation de Supabase avec STRICTEMENT des variables d'environnement
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ ERREUR: Variables d'environnement manquantes (SUPABASE_URL ou SUPABASE_SERVICE_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// URL Cible simulée de la DPML
const DPML_ALERTS_URL = 'https://www.minsante.cm/dpml/alertes-retraits';

async function syncDPML() {
  console.log('=====================================================');
  console.log(`⏰ Démarrage du CRON JOB DPML - Date: ${new Date().toISOString()}`);
  console.log('=====================================================');

  try {
    console.log(`🔍 [1/3] Scraping de la page DPML: ${DPML_ALERTS_URL}`);
    
    // Simulation d'une requête axios et parsing cheerio
    // const response = await axios.get(DPML_ALERTS_URL);
    // const $ = cheerio.load(response.data);
    
    const mockScrapedAlerts = [
      {
        num_amm: 'AMM-CMR-2024-001',
        lot_number: 'LX-4590',
        product_name: 'Amoxicilline 500mg Sirop',
        motif_retrait: 'Défaut de conformité physique (Précipité anormal observé).'
      }
    ];

    console.log(`✅ [1/3] Succès: ${mockScrapedAlerts.length} alertes trouvées.`);

    if (mockScrapedAlerts.length === 0) {
      console.log("ℹ️ [2/3] Aucune nouvelle alerte à traiter. Fin du script.");
      process.exit(0);
    }

    console.log(`🔄 [2/3] Traitement et mise à jour de la base de données...`);

    for (const alert of mockScrapedAlerts) {
      console.log(`   ➔ Traitement du lot rappelé: ${alert.lot_number} (AMM: ${alert.num_amm})`);

      // 2. Insérer un log dans la table dpml_alertes
      const { error: alertInsertError } = await supabase
        .from('dpml_alertes')
        .insert([{
          num_amm: alert.num_amm,
          lot_number: alert.lot_number,
          product_name: alert.product_name,
          motif_retrait: alert.motif_retrait,
          is_processed: true
        }]);

      if (alertInsertError) {
        console.error(`      ❌ Erreur lors de l'insertion de l'alerte:`, alertInsertError.message);
        continue; // On passe au lot suivant en cas d'erreur
      }
      
      console.log(`      ✅ Alerte consignée avec succès dans l'historique.`);

      // 3. Mettre à jour la table des produits pour désactiver les lots rappelés
      const { data, error: updateError } = await supabase
        .from('products')
        .update({ 
          is_active: false,
          is_recalled: true,
          recall_reason: alert.motif_retrait
        })
        .or(`num_amm.eq.${alert.num_amm},lot_number.eq.${alert.lot_number}`);

      if (updateError) {
        console.error(`      ❌ Erreur lors de la désactivation du produit:`, updateError.message);
      } else {
        console.log(`      ✅ SÉCURITÉ: Les produits correspondants (AMM: ${alert.num_amm} ou Lot: ${alert.lot_number}) ont été désactivés (is_active = false)`);
      }
    }

    console.log('✅ [3/3] Fin d\'exécution du script DPML avec succès.');

  } catch (error) {
    console.error(`❌ UNE ERREUR CRITIQUE EST SURVENUE DURANT LE SCRAPING:`, error.message);
    process.exit(1);
  }
}

syncDPML();
