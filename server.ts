import express from "express";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ extended: true, limit: "30mb" }));

  // Health check endpoints for deployment probes
  app.get("/health", (req: express.Request, res: express.Response) => {
    res.status(200).send("OK");
  });
  app.get("/api/health", (req: express.Request, res: express.Response) => {
    res.json({ status: "ok" });
  });

  // Helper Haversine Distance (in kilometers)
  function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371; // Rayon terrestre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Helper string similarity score (0 to 1)
  function stringSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;

    // Word tokens overlap
    const wordsA = a.split(/[\s,/-]+/).filter(w => w.length > 2);
    const wordsB = b.split(/[\s,/-]+/).filter(w => w.length > 2);
    if (wordsA.length === 0 || wordsB.length === 0) return 0;
    
    let matches = 0;
    for (const w of wordsA) {
      if (wordsB.some(wb => wb.includes(w) || w.includes(wb))) {
        matches++;
      }
    }
    return matches / Math.max(wordsA.length, wordsB.length);
  }

  // =========================================================================
  // SMART SCAN ORDONNANCE AVEC IA MULTIMODALE & MATCHING GÉOGRAPHIQUE
  // =========================================================================
  app.post("/api/ai/scan-prescription", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { imageBase64, mimeType, latitude, longitude } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: "Image base64 manquante." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, error: "Clé GEMINI_API_KEY non configurée sur le serveur." });
      }

      // Patient location (default to Douala coordinates if not provided)
      const userLat = typeof latitude === 'number' ? latitude : 4.0511;
      const userLng = typeof longitude === 'number' ? longitude : 9.7679;

      // 1. Appel du modèle multimodal Gemini 1.5 Pro
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const visionPrompt = `Tu es un assistant pharmacien expert en déchiffrage d'ordonnances médicales manuscrites et imprimées.
Analyse attentivement cette image d'ordonnance médicale ou de boîte de médicament.

Extrais TOUS les médicaments prescrits et retourne UNIQUEMENT un tableau JSON structuré.
Pour chaque médicament identifié, retourne un objet avec ces champs exacts :
- "nom_medicament": string (Nom commercial ou nom principal, ex: "Doliprane", "Amoxicilline", "Spasfon", "Augmentin")
- "dosage": string (ex: "1000mg", "500mg", "1g", "50mg/ml", ou "Standard" si absent)
- "forme": string (ex: "Comprimé", "Gélule", "Sirop", "Injectable", "Sachet", "Pommade", etc.)
- "quantite": number (Quantité/boîtes prescrites, nombre entier positif, par défaut 1 si non spécifié)
- "posologie": string (Instructions de prise, ex: "1 comprimé matin et soir pendant 5 jours")
- "dci": string (Dénomination Commune Internationale si déductible, ex: "Paracétamol", "Amoxicilline", ou identique au nom)
- "ordonnance_requise": boolean (true si médicament sous prescription obligatoire, false sinon)
- "remarques": string (Conseils ou avertissements)

Réponds STRICTEMENT par un JSON valide sans formatage Markdown superflu. Exemple :
[
  {
    "nom_medicament": "Doliprane",
    "dosage": "1000mg",
    "forme": "Comprimé",
    "quantite": 2,
    "posologie": "1 cp toutes les 8 heures si douleur",
    "dci": "Paracétamol",
    "ordonnance_requise": false,
    "remarques": "Ne pas dépasser 3g par jour"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [
          { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
          visionPrompt
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      let rawAiText = response.text || "[]";
      // Nettoyage au cas où des backticks markdown seraient inclus
      if (rawAiText.startsWith("```json")) {
        rawAiText = rawAiText.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (rawAiText.startsWith("```")) {
        rawAiText = rawAiText.replace(/^```/, "").replace(/```$/, "").trim();
      }

      let detectedMeds: any[] = [];
      try {
        const parsed = JSON.parse(rawAiText);
        detectedMeds = Array.isArray(parsed) ? parsed : (parsed.medications || [parsed]);
      } catch (parseErr) {
        console.error("Failed to parse Gemini response as JSON:", rawAiText);
        return res.status(422).json({
          success: false,
          error: "L'IA n'a pas pu structurer les médicaments de l'ordonnance.",
          rawText: rawAiText
        });
      }

      // 2. Connexion à Supabase pour le Matching & la Géolocalisation
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      let allProducts: any[] = [];
      let allPharmacies: any[] = [];
      let globalCatalog: any[] = [];

      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch pharmacies
        const { data: pharmaciesData } = await supabase
          .from('pharmacies')
          .select('*');
        if (pharmaciesData) {
          allPharmacies = pharmaciesData.map((ph: any) => {
            const extra = ph.data || {};
            return {
              id: ph.id,
              name: ph.name || extra.name || extra.pharmacy_name || "Pharmacie Partenaire",
              address: ph.address || extra.address || "Douala",
              phone: ph.phone || extra.phone || "",
              latitude: Number(ph.latitude ?? extra.latitude ?? extra.lat ?? 4.0511),
              longitude: Number(ph.longitude ?? extra.longitude ?? extra.lng ?? 9.7679),
              status: ph.status || extra.status || 'approved'
            };
          });
        }

        // Fetch pharmacy stock products
        const { data: productsData } = await supabase
          .from('products')
          .select('*');
        if (productsData) {
          allProducts = productsData.map((p: any) => {
            const extra = p.data || {};
            return {
              id: p.id,
              nom_commercial: p.nom_commercial || p.commercial_name || p.name || extra.nom_commercial || extra.name || "",
              dci: p.dci || extra.dci || "",
              dosage: p.dosage || extra.dosage || "",
              form: p.form || p.forme || extra.form || "",
              price: Number(p.price ?? extra.price ?? 0),
              stock: Number(p.stock ?? extra.stock ?? 0),
              pharmacy_id: p.pharmacy_id || p.pharmacyId || extra.pharmacy_id || extra.pharmacyId,
              is_prescription_required: p.is_prescription_required ?? extra.is_prescription_required ?? true,
              image_url: p.image_url || extra.image_url || null,
              category: p.category || p.ux_category || extra.category || "Pharmacie"
            };
          });
        }

        // Fetch global national catalog (produits_patients) for fallback
        const { data: catalogData } = await supabase
          .from('produits_patients')
          .select('*');
        if (catalogData) {
          globalCatalog = catalogData.map((c: any) => ({
            id: c.id,
            nom_commercial: c.nom_commercial || c.commercial_name || c.name || "",
            dci: c.dci || "",
            dosage: c.dosage || "",
            forme: c.forme || c.form || "",
            prix_moyen: Number(c.prix_moyen || c.price || 1500),
            ordonnance_requise: c.ordonnance_requise ?? true,
            categorie_ux: c.categorie_ux || c.category || "Médicament"
          }));
        }
      }

      // 3. Matching & Sélection Géographique Optimale
      const extracted_items: any[] = [];
      const pharmaciesMap = new Map<string, any>();
      allPharmacies.forEach(ph => pharmaciesMap.set(ph.id, ph));

      for (const detected of detectedMeds) {
        const queryName = (detected.nom_medicament || "").trim();
        const queryDci = (detected.dci || "").trim();
        const queryDosage = (detected.dosage || "").trim();

        // Trouver les correspondances parmi les stocks en pharmacie
        const candidates: any[] = [];

        for (const prod of allProducts) {
          const simName = stringSimilarity(queryName, prod.nom_commercial);
          const simDci = queryDci ? stringSimilarity(queryDci, prod.dci) : 0;
          const bestScore = Math.max(simName, simDci);

          if (bestScore >= 0.45) {
            const pharmacy = pharmaciesMap.get(prod.pharmacy_id);
            const phLat = pharmacy ? pharmacy.latitude : 4.0511;
            const phLng = pharmacy ? pharmacy.longitude : 9.7679;
            const distance = calculateDistanceKm(userLat, userLng, phLat, phLng);

            candidates.push({
              product: {
                id: prod.id,
                nom_commercial: prod.nom_commercial,
                dci: prod.dci,
                dosage: prod.dosage || queryDosage,
                form: prod.form || detected.forme,
                price: prod.price || 1500,
                stock: prod.stock,
                image_url: prod.image_url,
                pharmacy_id: prod.pharmacy_id,
                pharmacy_name: pharmacy ? pharmacy.name : "Pharmacie Partenaire",
                pharmacy_address: pharmacy ? pharmacy.address : "Douala",
                pharmacy_phone: pharmacy ? pharmacy.phone : "",
                distance_km: Math.round(distance * 10) / 10,
                latitude: phLat,
                longitude: phLng,
                is_prescription_required: prod.is_prescription_required
              },
              similarityScore: bestScore,
              distanceKm: distance,
              hasStock: prod.stock > 0
            });
          }
        }

        // Tri : priorité aux produits EN STOCK (stock > 0), puis par distance géographique la plus courte, puis par score de similarité
        candidates.sort((a, b) => {
          if (a.hasStock && !b.hasStock) return -1;
          if (!a.hasStock && b.hasStock) return 1;
          if (Math.abs(a.distanceKm - b.distanceKm) > 0.5) {
            return a.distanceKm - b.distanceKm;
          }
          return b.similarityScore - a.similarityScore;
        });

        if (candidates.length > 0) {
          const best = candidates[0];
          extracted_items.push({
            detected: {
              ...detected,
              quantite: Number(detected.quantite) || 1
            },
            matched: true,
            in_stock: best.hasStock,
            product: best.product,
            similarity_score: best.similarityScore,
            available_alternatives: candidates.slice(1, 4).map(c => c.product)
          });
        } else {
          // Recherche dans le catalogue national (produits_patients)
          const catalogMatches = globalCatalog.filter(c => {
            const sName = stringSimilarity(queryName, c.nom_commercial);
            const sDci = queryDci ? stringSimilarity(queryDci, c.dci) : 0;
            return Math.max(sName, sDci) >= 0.45;
          });

          if (catalogMatches.length > 0) {
            const catItem = catalogMatches[0];
            // Trouver la pharmacie la plus proche pour ce produit du catalogue
            const nearestPh = allPharmacies.length > 0 ? [...allPharmacies].sort((a, b) => {
              const dA = calculateDistanceKm(userLat, userLng, a.latitude, a.longitude);
              const dB = calculateDistanceKm(userLat, userLng, b.latitude, b.longitude);
              return dA - dB;
            })[0] : null;

            const dist = nearestPh ? calculateDistanceKm(userLat, userLng, nearestPh.latitude, nearestPh.longitude) : 1.5;

            extracted_items.push({
              detected: {
                ...detected,
                quantite: Number(detected.quantite) || 1
              },
              matched: true,
              in_stock: false,
              product: {
                id: catItem.id,
                nom_commercial: catItem.nom_commercial,
                dci: catItem.dci,
                dosage: catItem.dosage || queryDosage,
                form: catItem.forme || detected.forme,
                price: catItem.prix_moyen || 2000,
                stock: 5, // Quantité estimée disponible sur commande
                image_url: null,
                pharmacy_id: nearestPh?.id || "default_pharmacy",
                pharmacy_name: nearestPh?.name || "Pharmacie de Référence",
                pharmacy_address: nearestPh?.address || "Douala",
                distance_km: Math.round(dist * 10) / 10,
                latitude: nearestPh?.latitude || userLat,
                longitude: nearestPh?.longitude || userLng,
                is_prescription_required: catItem.ordonnance_requise
              },
              similarity_score: 0.8,
              available_alternatives: []
            });
          } else {
            // Aucun produit correspondant trouvé en base
            extracted_items.push({
              detected: {
                ...detected,
                quantite: Number(detected.quantite) || 1
              },
              matched: false,
              in_stock: false,
              product: null,
              similarity_score: 0,
              available_alternatives: []
            });
          }
        }
      }

      // Déduire les pharmacies distinctes impliquées
      const distinctPharmacies = new Map<string, any>();
      extracted_items.forEach(item => {
        if (item.product && item.product.pharmacy_id) {
          distinctPharmacies.set(item.product.pharmacy_id, {
            id: item.product.pharmacy_id,
            name: item.product.pharmacy_name,
            address: item.product.pharmacy_address,
            distance_km: item.product.distance_km
          });
        }
      });

      const result = {
        success: true,
        extracted_items,
        pharmacies_involved: Array.from(distinctPharmacies.values()),
        summary: {
          total_detected: detectedMeds.length,
          total_matched: extracted_items.filter(i => i.matched).length,
          total_unmatched: extracted_items.filter(i => !i.matched).length,
          multi_pharmacy: distinctPharmacies.size > 1,
          pharmacy_count: distinctPharmacies.size
        }
      };

      res.json(result);
    } catch (error: any) {
      console.error("Erreur dans /api/ai/scan-prescription:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Échec de l'analyse intelligente de l'ordonnance."
      });
    }
  });

  // Nodemailer transporter (for production, configure this via process.env)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "fake-user",
      pass: process.env.SMTP_PASS || "fake-pass",
    },
  });

  // Initialisation du Paiement (Fapshi)
  app.post("/api/payment/initialize", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { amount, email, externalId, redirectUrl } = req.body;
      
      const apiUser = process.env.FAPSHI_API_USER;
      const apiKey = process.env.FAPSHI_API_KEY;

      if (!apiUser || !apiKey) {
        return res.status(500).json({ success: false, error: "Fapshi credentials are not configured on the backend." });
      }

      console.log('Initiating Fapshi payment for:', { amount, email, externalId });

      const response = await fetch('https://api.fapshi.com/v1/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiuser': apiUser,
          'apikey': apiKey
        },
        body: JSON.stringify({
          amount,
          email,
          externalId,
          redirectUrl
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Fapshi initiate error:', data);
        return res.status(response.status).json({ success: false, error: data.message || "Failed to initiate payment" });
      }

      res.json({ success: true, link: data.link });
    } catch (error: any) {
      console.error("Fapshi server error:", error);
      res.status(500).json({ success: false, error: "Internal server error connecting to Fapshi" });
    }
  });

  // Fapshi Webhook Endpoint (Split Paiement)
  app.post("/api/webhooks/fapshi", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      console.log('Webhook Fapshi reçu:', req.body);
      const { externalId, status, transId } = req.body;

      // Sécurité : Vérification de l'origine de Fapshi
      // Il est vital de valider que la transaction est réelle auprès de Fapshi. 
      // Fapshi propose d'interroger directement l'API de statut ou d'utiliser un header HMAC s'il est configuré.
      /* Exemple de validation par API (Best Practice) :
         const verifyReq = await fetch(`https://api.fapshi.com/v1/payment-status/${transId}`, {
            headers: { 'apiuser': process.env.FAPSHI_API_USER, 'apikey': process.env.FAPSHI_API_KEY }
         });
         const verifyData = await verifyReq.json();
         if (verifyData.status !== 'SUCCESSFUL') throw new Error("Transaction invalide");
      */
      
      if (status === 'SUCCESSFUL' && externalId) {
        console.log(`Paiement confirmé pour la commande ${externalId}`);
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Toujours utiliser la Service Role Key pour modifier les wallets
        
        if (supabaseUrl && supabaseKey) {
           const { createClient } = await import('@supabase/supabase-js');
           const supabase = createClient(supabaseUrl, supabaseKey);
           
           // Récupération de la commande
           const { data: orderRow, error: fetchError } = await supabase
              .from('orders')
              .select('*')
              .eq('id', externalId)
              .single();
              
           if (!fetchError && orderRow) {
              const orderData = orderRow.data || orderRow;
              
              // === MODÈLE ÉCONOMIQUE ===
              // Frais de livraison : Fixés à 1000 FCFA (800 Livreur, 200 Plateforme)
              // Commission Plateforme : 5% de la valeur nette des produits
              // Part Pharmacie : Le reste du montant net
              
              const totalAmount = orderData.total || 0;
              const deliveryFee = 1000;
              const productValue = Math.max(0, totalAmount - deliveryFee); // Valeur des produits

              const driverShare = 800; // Pour le livreur
              const platformDeliveryShare = 200; // Pour la plateforme
              
              const platformCommission = productValue * 0.05; // 5% de commission
              const pharmacyShare = productValue - platformCommission; // Reste pour la pharmacie

              const platformTotalShare = platformDeliveryShare + platformCommission;

              const driverId = orderData.driverId; 
              const pharmacyId = orderData.pharmacyId;

              // === DISTRIBUTION DANS LES WALLETS VIA RPC SUPABASE ===
              // L'utilisation d'une fonction RPC Supabase (ex: 'credit_wallet') assure une transaction atomique côté base de données
              // Voici le code pour l'intégration RPC, les procédures RPC doivent être définies dans Supabase:
              
              const transactionRecords = [];

              if (driverId) {
                  await supabase.rpc('credit_wallet', { user_id: driverId, amount: driverShare });
                  transactionRecords.push({
                    user_id: driverId,
                    amount: driverShare,
                    type: 'credit',
                    description: `Livraison commande ${externalId}`,
                    reference: transId
                  });
              }
              if (pharmacyId) {
                  await supabase.rpc('credit_wallet', { user_id: pharmacyId, amount: pharmacyShare });
                  transactionRecords.push({
                    user_id: pharmacyId,
                    amount: pharmacyShare,
                    type: 'credit',
                    description: `Paiement commande ${externalId}`,
                    reference: transId
                  });
              }
              // Créditer le wallet de la plateforme (avec un identifiant générique interne)
              await supabase.rpc('credit_wallet', { user_id: 'PLATFORM_MASTER_WALLET', amount: platformTotalShare });
              transactionRecords.push({
                user_id: 'PLATFORM_MASTER_WALLET',
                amount: platformTotalShare,
                type: 'credit',
                description: `Commission plateforme commande ${externalId}`,
                reference: transId
              });

              // Add Patient Payment Record
              const patientId = orderData.patientId;
              if (patientId) {
                transactionRecords.push({
                  user_id: patientId,
                  amount: totalAmount,
                  type: 'debit',
                  description: `Paiement Mobile Money commande ${externalId}`,
                  reference: transId
                });
              }

              // Insert transaction logs
              if (transactionRecords.length > 0) {
                 await supabase.from('wallet_transactions').insert(transactionRecords);
              }
              
              const datePaid = new Date().toISOString();

              // === MISE À JOUR DE LA COMMANDE ===
              if (orderRow.data) {
                  // Structure typée comme JSONB dans `data`
                  const updatedData = { ...orderRow.data, status: 'paid', fapshiTransId: transId, paidAt: datePaid };
                  await supabase.from('orders').update({ data: updatedData }).eq('id', externalId);
              } else {
                  // Structure avec colonnes aplaties
                  await supabase.from('orders').update({ status: 'paid', fapshiTransId: transId, paidAt: datePaid }).eq('id', externalId);
              }

              console.log('Fonds répartis et statut mis à jour avec succès.');
           }
        } else {
           console.error("Clé SUPABASE_SERVICE_ROLE_KEY manquante pour la répartition des fonds.");
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Fapshi webhook error:", error);
      res.status(500).json({ success: false, error: "Webhook failure" });
    }
  });

  app.post("/api/ocr", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { imageBase64, mimeType } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ success: false, error: "Gemini API Key not configured." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [
          { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
          `Tu es un pharmacien expert et auditeur réglementaire DPML (Direction de la Pharmacie, du Médicament et des Laboratoires).
Analyse rigoureusement cette ordonnance médicale ou boîte de médicament.

Extrais les informations de prescription et effectue un contrôle de conformité DPML.
Retourne un objet JSON valide avec la structure suivante :
{
  "doctor_name": string ou null,
  "patient_name": string ou null,
  "date": string ou null,
  "medications": [
    {
      "name": "Nom commercial ou DCI",
      "dosage": "Posologie (ex: 500mg, 1g)",
      "form": "Forme galénique (comprimé, sirop, injectable...)",
      "quantity": 1,
      "frequency": "Fréquence (ex: 1 cp matin et soir pendant 5 jours)",
      "duration": "Durée du traitement",
      "dpml_classification": "Liste_1" | "Liste_2" | "Stupefiant" | "OTC",
      "requires_prescription": boolean,
      "warnings": "Mises en garde, contre-indications ou interactions potentielles"
    }
  ],
  "dpml_safety_checks": {
    "has_controlled_substances": boolean,
    "requires_original_counterfoil": boolean,
    "validity_period_days": number,
    "compliance_notes": string
  },
  "overall_summary": string
}`
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const data = JSON.parse(text);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error in OCR & DPML analysis:", error);
      res.status(500).json({ success: false, error: "Failed to process prescription image." });
    }
  });

  app.post("/api/send-email", async (req: express.Request, res: express.Response) => {
    try {
      const { to, subject, text, html } = req.body;
      
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Pharmap" <noreply@pharmap.com>',
        to,
        subject,
        text,
        html,
      });

      console.log("Message sent: %s", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, error: "Failed to send email" });
    }
  });

  app.post("/api/driver/telemetry", async (req: express.Request, res: express.Response) => {
    try {
      const { driver_id, latitude, longitude, heading, speed, destination_lat, destination_lng } = req.body;
      
      if (!driver_id || latitude === undefined || longitude === undefined) {
         return res.status(400).json({ success: false, error: "Missing required telemetry fields" });
      }

      // Basic Haversine distance for route deviation check
      let route_deviation_alert = false;
      let distanceToDestination = 0;
      
      if (destination_lat && destination_lng) {
         const R = 6371e3; // metres
         const nLat1 = latitude * Math.PI/180;
         const nLat2 = destination_lat * Math.PI/180;
         const dLat = (destination_lat - latitude) * Math.PI/180;
         const dLon = (destination_lng - longitude) * Math.PI/180;
         
         const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                   Math.cos(nLat1) * Math.cos(nLat2) *
                   Math.sin(dLon/2) * Math.sin(dLon/2);
         const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
         
         distanceToDestination = R * c; 
         
         // Arbitrary logic: If they are more than 5km away after being assigned, flag deviation.
         // Realistically this would use the Directions API polyline and match the point to the path.
         if (distanceToDestination > 5000) {
            route_deviation_alert = true;
         }
      }

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
         console.warn("Supabase credentials not configured, skipping telemetry insert.");
         return res.status(200).json({ success: true, simulated: true, route_deviation_alert });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase
         .from('driver_telemetry_logs')
         .insert([{
            driver_id,
            latitude,
            longitude,
            heading: heading || 0,
            speed: speed || 0,
            route_deviation: route_deviation_alert,
            created_at: new Date().toISOString()
         }]);

      if (error) {
         throw error;
      }

      res.json({ success: true, route_deviation_alert });
    } catch (error) {
      console.error("Error processing telemetry:", error);
      res.status(500).json({ success: false, error: "Failed to process telemetry" });
    }
  });

  // Generate AI Info Route
  app.post("/api/admin/generate-info", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { products, saveToDb } = req.body;
      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, error: "Missing products array" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
         return res.status(500).json({ success: false, error: "Gemini API key not configured" });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are a medical data assistant. For each of the following products, generate professional information in French:
1. 'brand': Manufacturer or pharmaceutical brand name (e.g., Sanofi, GSK, Pfizer, Novartis, Bayer)
2. 'dosage': Standard dosage and format (e.g., 500mg Comprimé, 100mg/5ml Sirop)
3. 'description': Detailed product description & DCI active molecules
4. 'effects': Known side effects, precautions, and contraindications
5. 'directions': Directions & method of use (posology, frequency, mode of administration)

Products: ` + JSON.stringify(products.map((p: any) => ({
        id: p.id || "temp",
        name: p.name || p.nom_commercial || p.commercial_name || "",
        brand: p.brand || "",
        dosage: p.dosage || "",
        category: p.category || p.ux_category || p.categorie_ux || ""
      })));

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                brand: { type: Type.STRING, description: "Brand or manufacturer name" },
                dosage: { type: Type.STRING, description: "Dosage and format" },
                description: { type: Type.STRING, description: "Product therapeutic description" },
                effects: { type: Type.STRING, description: "Known side effects and precautions" },
                directions: { type: Type.STRING, description: "Directions and method of use" }
              },
              required: ["id", "brand", "dosage", "description", "effects", "directions"]
            }
          }
        }
      });

      const responseText = response.text || "[]";
      let generatedInfo: any[] = [];
      try {
         generatedInfo = JSON.parse(responseText);
      } catch (e) {
         const match = responseText.match(/\[.*\]/s);
         if (match) generatedInfo = JSON.parse(match[0]);
      }

      // If saveToDb is true, update Supabase tables
      if (saveToDb && generatedInfo.length > 0) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && (serviceKey || anonKey)) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, serviceKey || anonKey!);

          for (const item of generatedInfo) {
            if (item.id && item.id !== "temp") {
              try {
                await supabase.from('produits_patients').update({
                  dci: item.description,
                  dosage: item.dosage,
                  forme: item.dosage,
                  brand: item.brand,
                  effects: item.effects,
                  directions: item.directions
                }).eq('id', item.id);
              } catch (e) {
                await supabase.from('produits_patients').update({
                  dci: item.description,
                  dosage: item.dosage,
                  forme: item.dosage
                }).eq('id', item.id);
              }

              try {
                await supabase.from('products').update({
                  description: item.description,
                  dci: item.description,
                  dosage: item.dosage,
                  brand: item.brand,
                  marque: item.brand,
                  effects: item.effects,
                  directions: item.directions
                }).or(`id.eq.${item.id},product_id.eq.${item.id}`);
              } catch (e) {
                await supabase.from('products').update({
                  description: item.description,
                  dosage: item.dosage
                }).eq('id', item.id);
              }
            }
          }
        }
      }

      res.json({ success: true, updates: generatedInfo });
    } catch (error: any) {
      console.error("Info generation error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // KYC Approval Route
  app.post("/api/admin/seed-products", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { data } = req.body;
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ success: false, error: "Missing or invalid 'data' array" });
      }
      
      const authHeader = req.headers.authorization;
      const userToken = authHeader ? authHeader.split(' ')[1] : undefined;

      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        return res.status(500).json({ success: false, error: "Supabase URL not configured on backend." });
      }
      
      const { createClient } = await import('@supabase/supabase-js');
      let supabase;
      
      if (serviceKey) {
        // Use service role key to completely bypass RLS
        supabase = createClient(supabaseUrl, serviceKey);
      } else if (anonKey) {
        // Fallback to anon key: supply user token if available so it operates as authenticated admin
        const options = userToken ? { global: { headers: { Authorization: `Bearer ${userToken}` } } } : {};
        supabase = createClient(supabaseUrl, anonKey, options);
      } else {
        return res.status(500).json({ success: false, error: "No Supabase keys configured on backend." });
      }

      const frenchWithImg = data.map((item: any) => {
        const row: any = {
          dci: item.dci || item.description || '',
          nom_commercial: item.nom_commercial || item.commercial_name || item.name || '',
          dosage: item.dosage || '',
          forme: item.forme || item.form || item.dosage || '',
          ordonnance_requise: item.ordonnance_requise !== undefined 
            ? (item.ordonnance_requise === true || item.ordonnance_requise === 'true') 
            : (item.is_prescription_required === true || item.is_prescription_required === 'true'),
          categorie_ux: item.categorie_ux || item.ux_category || 'Uncategorized'
        };
        const img = item.image_url || item.imageUrl || item.image;
        if (img) row.image_url = img;
        return row;
      });

      const frenchNoImg = frenchWithImg.map((item: any) => {
        const { image_url, ...rest } = item;
        return rest;
      });

      const englishWithImg = data.map((item: any) => {
        const row: any = {
          dci: item.dci || item.description || '',
          commercial_name: item.commercial_name || item.nom_commercial || item.name || '',
          dosage: item.dosage || '',
          form: item.form || item.forme || item.dosage || '',
          is_prescription_required: item.is_prescription_required !== undefined 
            ? (item.is_prescription_required === true || item.is_prescription_required === 'true') 
            : (item.ordonnance_requise === true || item.ordonnance_requise === 'true'),
          ux_category: item.ux_category || item.categorie_ux || 'Uncategorized'
        };
        const img = item.image_url || item.imageUrl || item.image;
        if (img) row.image_url = img;
        return row;
      });

      const englishNoImg = englishWithImg.map((item: any) => {
        const { image_url, ...rest } = item;
        return rest;
      });

      const seedCandidates = [frenchWithImg, frenchNoImg, englishWithImg, englishNoImg];

      let insertedData = null;
      let error = null;

      for (const candidateData of seedCandidates) {
        const res = await supabase.from('produits_patients').insert(candidateData).select();
        if (!res.error) {
          insertedData = res.data;
          error = null;
          break;
        } else {
          error = res.error;
          if (res.error.message && res.error.message.includes('row-level security policy')) {
            break;
          }
        }
      }
        
      if (error) {
         if (error.message && error.message.includes('row-level security policy')) {
             throw new Error("Erreur RLS : L'opération a été bloquée. Veuillez ajouter la clé 'SUPABASE_SERVICE_ROLE_KEY' dans vos Secrets AI Studio, ou exécutez le script SQL 'phase8_produits_patients.sql' dans votre base.");
         }
         throw error;
      }
      
      res.json({ success: true, data: insertedData, message: "Products seeded successfully." });
    } catch (error: any) {
      console.error("Error seeding products:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to seed products" });
    }
  });

  // UPSERT route for single product Create or Update
  app.post("/api/admin/upsert-product", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { id, dci, commercial_name, dosage, form, is_prescription_required, ux_category, image_url, imageUrl, image } = req.body;
      
      const authHeader = req.headers.authorization;
      const userToken = authHeader ? authHeader.split(' ')[1] : undefined;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) return res.status(500).json({ success: false, error: "Supabase URL not configured on backend." });
      
      const { createClient } = await import('@supabase/supabase-js');
      let supabase;
      if (serviceKey) {
        supabase = createClient(supabaseUrl, serviceKey);
      } else if (anonKey) {
        const options = userToken ? { global: { headers: { Authorization: `Bearer ${userToken}` } } } : {};
        supabase = createClient(supabaseUrl, anonKey, options);
      } else {
        return res.status(500).json({ success: false, error: "No Supabase keys configured." });
      }

      const img = image_url || imageUrl || image || null;
      const commName = req.body.nom_commercial || req.body.commercial_name || req.body.name || '';
      const dciVal = req.body.dci || req.body.description || '';
      const dosageVal = req.body.dosage || '';
      const formVal = req.body.forme || req.body.form || req.body.dosage || '';
      const brandVal = req.body.brand || req.body.marque || '';
      const catVal = req.body.category || req.body.categorie || req.body.categorie_ux || req.body.ux_category || 'Général';
      const priceVal = req.body.price !== undefined ? Number(req.body.price) : 0;
      const stockVal = req.body.stock !== undefined ? Number(req.body.stock) : 0;
      const effectsVal = req.body.effects || req.body.effets || '';
      const directionsVal = req.body.directions || req.body.mode_emploi || '';
      const ordonnanceVal = req.body.ordonnance_requise !== undefined 
        ? (req.body.ordonnance_requise === true || req.body.ordonnance_requise === 'true') 
        : (req.body.is_prescription_required === true || req.body.is_prescription_required === 'true');

      let resolvedCatId = req.body.category_id || req.body.ux_category_id || null;
      if (!resolvedCatId && catVal && catVal !== 'Uncategorized' && catVal !== 'Général') {
        try {
          const { data: catData } = await supabase.from('ux_categories').select('id').ilike('name', catVal).limit(1);
          if (catData && catData.length > 0) {
            resolvedCatId = catData[0].id;
          } else {
            const { data: catData2 } = await supabase.from('categories').select('id').ilike('name', catVal).limit(1);
            if (catData2 && catData2.length > 0) {
              resolvedCatId = catData2[0].id;
            }
          }
        } catch (e) {
          // ignore lookup errors
        }
      }

      // Candidate 1: Full payload with brand, category_id, category, and image
      const fullFrenchPayload: any = {
        nom_commercial: commName,
        dci: dciVal,
        dosage: dosageVal,
        forme: formVal,
        ordonnance_requise: ordonnanceVal,
        categorie_ux: catVal,
        category: catVal,
        brand: brandVal,
        marque: brandVal,
        price: priceVal,
        stock: stockVal,
        effects: effectsVal,
        directions: directionsVal
      };
      if (img) fullFrenchPayload.image_url = img;
      if (resolvedCatId) {
        fullFrenchPayload.category_id = resolvedCatId;
        fullFrenchPayload.ux_category_id = resolvedCatId;
      }

      // Candidate 2: Full English schema with category_id, brand, and image
      const fullEnglishPayload: any = {
        commercial_name: commName,
        dci: dciVal,
        dosage: dosageVal,
        form: formVal,
        is_prescription_required: ordonnanceVal,
        ux_category: catVal,
        category: catVal,
        brand: brandVal,
        marque: brandVal,
        price: priceVal,
        stock: stockVal,
        effects: effectsVal,
        directions: directionsVal
      };
      if (img) fullEnglishPayload.image_url = img;
      if (resolvedCatId) {
        fullEnglishPayload.category_id = resolvedCatId;
        fullEnglishPayload.ux_category_id = resolvedCatId;
      }

      // Candidate 3: French schema with brand & categorie_ux
      const frenchBrandWithImg: any = {
        nom_commercial: commName,
        dci: dciVal,
        dosage: dosageVal,
        forme: formVal,
        ordonnance_requise: ordonnanceVal,
        categorie_ux: catVal,
        brand: brandVal
      };
      if (img) frenchBrandWithImg.image_url = img;

      // Candidate 4: English schema with brand & ux_category
      const englishBrandWithImg: any = {
        commercial_name: commName,
        dci: dciVal,
        dosage: dosageVal,
        form: formVal,
        is_prescription_required: ordonnanceVal,
        ux_category: catVal,
        brand: brandVal
      };
      if (img) englishBrandWithImg.image_url = img;

      // Candidate 5: Standard French schema with image
      const frenchWithImg: any = {
        nom_commercial: commName,
        dci: dciVal,
        dosage: dosageVal,
        forme: formVal,
        ordonnance_requise: ordonnanceVal,
        categorie_ux: catVal
      };
      if (img) frenchWithImg.image_url = img;

      // Candidate 6: Standard English schema no image
      const englishNoImg: any = {
        commercial_name: commName,
        dci: dciVal,
        dosage: dosageVal,
        form: formVal,
        is_prescription_required: ordonnanceVal,
        ux_category: catVal
      };

      const candidatePayloads = [
        fullFrenchPayload,
        fullEnglishPayload,
        frenchBrandWithImg,
        englishBrandWithImg,
        frenchWithImg,
        englishNoImg
      ];

      let data = null;
      let error = null;

      for (const payload of candidatePayloads) {
        try {
          let query;
          if (id) {
            query = supabase.from('produits_patients').update(payload).eq('id', id).select();
          } else {
            query = supabase.from('produits_patients').insert([payload]).select();
          }
          const res = await query;
          if (!res.error) {
            data = res.data;
            error = null;
            break;
          } else {
            error = res.error;
            if (res.error.message && res.error.message.includes('row-level security policy')) {
              break;
            }
          }
        } catch (err: any) {
          error = err;
        }
      }
      
      if (error) {
         if (error.message && error.message.includes('row-level security policy')) {
            throw new Error("Erreur RLS : L'opération a été bloquée. Veuillez ajouter la clé 'SUPABASE_SERVICE_ROLE_KEY' dans vos Secrets AI Studio, ou exécutez le script SQL 'phase8_produits_patients.sql' dans votre base.");
         }
         throw error;
      }

      // Safe targeted updates to ensure brand and category columns persist even if partial candidate matched
      const targetId = id || (Array.isArray(data) ? data[0]?.id : data?.id);
      if (targetId) {
        if (brandVal) {
          await supabase.from('produits_patients').update({ brand: brandVal }).eq('id', targetId).catch(() => {});
          await supabase.from('produits_patients').update({ marque: brandVal }).eq('id', targetId).catch(() => {});
        }
        if (catVal) {
          await supabase.from('produits_patients').update({ categorie_ux: catVal }).eq('id', targetId).catch(() => {});
          await supabase.from('produits_patients').update({ category: catVal }).eq('id', targetId).catch(() => {});
          await supabase.from('produits_patients').update({ ux_category: catVal }).eq('id', targetId).catch(() => {});
        }
        if (resolvedCatId) {
          await supabase.from('produits_patients').update({ category_id: resolvedCatId }).eq('id', targetId).catch(() => {});
          await supabase.from('produits_patients').update({ ux_category_id: resolvedCatId }).eq('id', targetId).catch(() => {});
        }
        if (priceVal > 0) {
          await supabase.from('produits_patients').update({ price: priceVal }).eq('id', targetId).catch(() => {});
        }
        if (stockVal >= 0) {
          await supabase.from('produits_patients').update({ stock: stockVal }).eq('id', targetId).catch(() => {});
        }
        if (img) {
          await supabase.from('produits_patients').update({ image_url: img }).eq('id', targetId).catch(() => {});
        }

        // Also propagate complete updates to 'products' table
        try {
          const productPayload: any = {
            id: targetId,
            commercial_name: commName,
            nom_commercial: commName,
            name: commName,
            dci: dciVal,
            description: dciVal,
            dosage: dosageVal,
            form: formVal,
            forme: formVal,
            brand: brandVal,
            marque: brandVal,
            category: catVal,
            categorie: catVal,
            categorie_ux: catVal,
            ux_category: catVal,
            category_id: resolvedCatId || null,
            ux_category_id: resolvedCatId || null,
            price: priceVal,
            stock: stockVal,
            effects: effectsVal,
            directions: directionsVal,
            is_prescription_required: ordonnanceVal
          };
          if (img) productPayload.image_url = img;

          await supabase.from('products').upsert(productPayload, { onConflict: 'id' }).catch(() => {});
        } catch (syncErr) {
          console.warn("Product sync to products table warning:", syncErr);
        }
      }
      
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Backend upsert error:", error);
      res.status(500).json({ success: false, error: error.message || "Upsert failed" });
    }
  });

  // DELETE route for single product
  app.post("/api/admin/delete-product", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: "Product ID is required" });
      }

      const authHeader = req.headers.authorization;
      const userToken = authHeader ? authHeader.split(' ')[1] : undefined;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) return res.status(500).json({ success: false, error: "Supabase URL not configured on backend." });
      
      const { createClient } = await import('@supabase/supabase-js');
      let supabase;
      if (serviceKey) {
        supabase = createClient(supabaseUrl, serviceKey);
      } else if (anonKey) {
        const options = userToken ? { global: { headers: { Authorization: `Bearer ${userToken}` } } } : {};
        supabase = createClient(supabaseUrl, anonKey, options);
      } else {
        return res.status(500).json({ success: false, error: "No Supabase keys configured." });
      }

      // Delete from both produits_patients and products
      const [res1, res2] = await Promise.allSettled([
        supabase.from('produits_patients').delete().eq('id', id),
        supabase.from('products').delete().or(`id.eq.${id},product_id.eq.${id}`)
      ]);
      
      let error = null;
      if (res1.status === 'fulfilled' && res1.value.error) {
        error = res1.value.error;
      }

      if (error && error.message && error.message.includes('row-level security policy')) {
        throw new Error("Erreur RLS : L'opération a été bloquée. Veuillez ajouter la clé 'SUPABASE_SERVICE_ROLE_KEY' dans vos Secrets AI Studio, ou exécutez le script SQL 'phase8_produits_patients.sql' dans votre base pour autoriser les suppressions.");
      }
      
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (error: any) {
      console.error("Backend delete error:", error);
      res.status(500).json({ success: false, error: error.message || "Delete failed" });
    }
  });

  app.post("/api/admin/driver/approve", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ success: false, error: "Missing driverId" });
      }
      
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, error: "Supabase not configured on backend." });
      }
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Single source of truth update: Fetch current data and update kyc_status and status
      const { data: driverData, error: fetchErr } = await supabase
        .from('drivers')
        .select('data')
        .eq('id', driverId)
        .single();
        
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      
      const newDriverData = { 
        ...(driverData?.data || {}), 
        status: 'approved',
        kyc_status: 'approved'
      };

      const { error: drvErr } = await supabase
        .from('drivers')
        .upsert({ 
          id: driverId, 
          data: newDriverData
        }, { onConflict: 'id' });
        
      if (drvErr) throw drvErr;

      // Update public.users as well
      const { data: userData, error: fetchUsrErr } = await supabase
        .from('users')
        .select('data')
        .eq('id', driverId)
        .single();
        
      if (fetchUsrErr && fetchUsrErr.code !== 'PGRST116') throw fetchUsrErr;

      const newUserdata = {
        ...(userData?.data || {}),
        status: 'approved',
        kyc_status: 'approved'
      };

      const { error: usrErr } = await supabase
        .from('users')
        .upsert({ 
          id: driverId, 
          data: newUserdata 
        }, { onConflict: 'id' });

      if (usrErr) throw usrErr;

      res.json({ success: true, message: "Driver KYC approved successfully." });
    } catch (error) {
      console.error("Error approving driver:", error);
      res.status(500).json({ success: false, error: "Failed to approve driver KYC" });
    }
  });

  // DPML Webhook to receive alerts and automatically quarantine products
  app.post("/api/dpml/alerts", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { titre, description, num_lot_concerne, dci_concerne, nom_commercial_concerne, action_requise } = req.body;
      
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
         return res.status(500).json({ success: false, error: "Supabase credentials missing" });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Insert alert
      const { data: alert, error: alertError } = await supabase
         .from('dpml_alertes')
         .insert([{
            titre,
            description,
            num_lot_concerne,
            dci_concerne,
            nom_commercial_concerne,
            action_requise,
            statut: 'Actif'
         }])
         .select()
         .single();
         
      if (alertError) throw alertError;

      // 2. Put products in quarantine automatically (is_active = false)
      let productsQuery = supabase.from('products').update({ is_active: false });
      
      if (dci_concerne) {
         productsQuery = productsQuery.ilike('dci', `%${dci_concerne}%`);
      } else if (nom_commercial_concerne) {
         productsQuery = productsQuery.ilike('nom_commercial', `%${nom_commercial_concerne}%`);
      } else {
         throw new Error("Must provide dci_concerne or nom_commercial_concerne");
      }
      
      const { error: updateError } = await productsQuery;
      if (updateError) throw updateError;
      
      res.json({ success: true, message: "Alert received and products quarantined.", alert });
    } catch (err: any) {
      console.error("DPML Webhook Error:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production" || process.argv[1]?.endsWith("server.cjs");
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
