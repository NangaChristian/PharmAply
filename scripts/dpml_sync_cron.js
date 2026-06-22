import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// Configuration de Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERREUR: Variables d'environnement Supabase manquantes (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// URL Cible de la DPML (Simulée pour l'exemple)
const DPML_ALERTS_URL = 'https://www.minsante.cm/dpml/alertes-retraits';

/**
 * Scraper la page DPML pour extraire les notes circulaires de retrait de lot
 */
async function scrapeDpmlAlerts() {
    console.log(`🔍 [1/3] Récupération de la page DPML: ${DPML_ALERTS_URL}`);
    try {
        // En conditions réelles, on ferait ça:
        // const { data } = await axios.get(DPML_ALERTS_URL);
        // const $ = cheerio.load(data);
        
        // Simulation des tables extraites dynamiquement via Cheerio
        // $('.alerte-row').each((i, el) => { ... })
        
        const mockScrapedAlerts = [
            {
                num_amm: 'AMM-CMR-2024-001',
                lot_number: 'LX-4590',
                product_name: 'Amoxicilline 500mg Sirop',
                motif_retrait: 'Défaut de conformité physique (Précipité anormal observé).'
            },
            {
                num_amm: 'AMM-CMR-2023-442',
                lot_number: 'B-7721',
                product_name: 'Paracétamol Injectable',
                motif_retrait: 'Non-stérilité détectée lors du contrôle de routine post-marketing.'
            }
        ];
        
        console.log(`✅ [1/3] Succès: ${mockScrapedAlerts.length} alertes extraites.`);
        return mockScrapedAlerts;

    } catch (error) {
        console.error('❌ Erreur lors du scraping de la DPML:', error.message);
        return [];
    }
}

/**
 * Synchroniser les alertes extraites avec la base de données
 */
async function syncAlertsToDatabase(alerts) {
    if (!alerts || alerts.length === 0) {
        console.log("ℹ️ [2/3] Aucune nouvelle alerte à synchroniser.");
        return;
    }

    console.log(`🔄 [2/3] Synchronisation de ${alerts.length} alertes avec la base de données...`);

    for (const alert of alerts) {
        try {
            console.log(`   ➔ Enregistrement de l'alerte pour le lot: ${alert.lot_number}`);

            // 1. Enregistrer dans l'historique dpml_alertes
            const { error: alertError } = await supabase
                .from('dpml_alertes')
                .insert([{
                    num_amm: alert.num_amm,
                    lot_number: alert.lot_number,
                    product_name: alert.product_name,
                    motif_retrait: alert.motif_retrait,
                    is_processed: true
                }]);

            if (alertError) {
                console.error(`      ❌ Erreur d'insertion (peut-être un doublon):`, alertError.message);
                continue;
            }

            // 2. Mettre à jour la table products (GARDE-FOU)
            // Passe instantanément is_active = false et is_recalled = true
            const { data, error: updateError } = await supabase
                .from('products')
                .update({ 
                    is_active: false,
                    is_recalled: true,
                    recall_reason: alert.motif_retrait
                })
                .or(`num_amm.eq.${alert.num_amm},lot_number.eq.${alert.lot_number}`);

            if (updateError) {
                console.error(`      ❌ Erreur de désactivation du produit:`, updateError.message);
            } else {
                console.log(`      ✅ SECRUITÉ: Tous les produits correspondants au lot ${alert.lot_number} ont été retirés de la plateforme.`);
            }
            
        } catch (err) {
            console.error(`      ❌ Erreur critique lors du traitement du lot ${alert.lot_number}:`, err);
        }
    }
}

/**
 * Point d'entrée du Cron Job
 */
async function runCronJob() {
    console.log('=====================================================');
    console.log(`⏰ Démarrage du CRON JOB DPML - Date: ${new Date().toISOString()}`);
    console.log('=====================================================');
    
    // Étape 1 : Scraper les alertes
    const alerts = await scrapeDpmlAlerts();
    
    // Étape 2 : Traiter & Synchroniser (Désactivation d'urgence)
    await syncAlertsToDatabase(alerts);
    
    console.log('✅ [3/3] Fin d\'exécution du script.');
    console.log('=====================================================');
    process.exit(0);
}

runCronJob();
