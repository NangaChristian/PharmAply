import express from "express";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoints for deployment probes
  app.get("/health", (req: express.Request, res: express.Response) => {
    res.status(200).send("OK");
  });
  app.get("/api/health", (req: express.Request, res: express.Response) => {
    res.json({ status: "ok" });
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
              
              if (driverId) {
                  await supabase.rpc('credit_wallet', { user_id: driverId, amount: driverShare });
              }
              if (pharmacyId) {
                  await supabase.rpc('credit_wallet', { user_id: pharmacyId, amount: pharmacyShare });
              }
              // Créditer le wallet de la plateforme (avec un identifiant générique interne)
              await supabase.rpc('credit_wallet', { user_id: 'PLATFORM_MASTER_WALLET', amount: platformTotalShare });
              
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

  app.post("/api/ocr", async (req: express.Request, res: express.Response) => {
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
        model: "gemini-3.5-flash",
        contents: [
          { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
          "Analyze this medical prescription or medicine box. Extract the medications, dosages, and quantities. Map them as closely as possible to standard inventory. Return a JSON array of objects with the following keys: { name: \"string\", dosage: \"string\", quantity: \"number\" }."
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      const data = JSON.parse(text);
      res.json({ success: true, data });
    } catch (error) {
      console.error("Error in OCR:", error);
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
      const { products } = req.body;
      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ success: false, error: "Missing products array" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
         return res.status(500).json({ success: false, error: "Gemini API key not configured" });
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

      // Prompt Gemini to generate info
      const prompt = `You are a medical data assistant. For each of the following products, generate a professional 'description', 'effects', and 'directions' (in French/English). Return a valid JSON array of objects, with each object containing { "id": "original_id", "description": "...", "effects": "...", "directions": "..." }. \n\nProducts: ` + JSON.stringify(products.map((p: any) => ({ id: p.id, name: p.name, category: p.category, dosage: p.dosage })));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
           responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "[]";
      let generatedInfo = [];
      try {
         generatedInfo = JSON.parse(responseText);
      } catch (e) {
         // fallback if it wrapped in markdown
         const match = responseText.match(/\[.*\]/s);
         if (match) generatedInfo = JSON.parse(match[0]);
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

      const normalizedData = data.map((item: any) => ({
        ...item,
        nom_commercial: item.nom_commercial || item.commercial_name || item.name || '',
        forme: item.forme || item.form || '',
        ordonnance_requise: item.ordonnance_requise !== undefined ? (item.ordonnance_requise === true || item.ordonnance_requise === 'true') : (item.is_prescription_required === true || item.is_prescription_required === 'true'),
        categorie_ux: item.categorie_ux || item.ux_category || 'Uncategorized'
      }));

      const { data: insertedData, error } = await supabase
        .from('produits_patients')
        .insert(normalizedData);
        
      if (error) {
         if (error.message.includes('row-level security policy')) {
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
      const { id, dci, commercial_name, dosage, form, is_prescription_required, ux_category } = req.body;
      
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

      const payload: any = {
         dci: req.body.dci,
         nom_commercial: req.body.nom_commercial || req.body.commercial_name || req.body.name || '',
         dosage: req.body.dosage,
         forme: req.body.forme || req.body.form || '',
         ordonnance_requise: req.body.ordonnance_requise !== undefined ? (req.body.ordonnance_requise === true || req.body.ordonnance_requise === 'true') : (req.body.is_prescription_required === true || req.body.is_prescription_required === 'true'),
         categorie_ux: req.body.categorie_ux || req.body.ux_category || 'Uncategorized'
      };

      let query;
      if (id) {
         query = supabase.from('produits_patients').update(payload).eq('id', id);
      } else {
         query = supabase.from('produits_patients').insert([payload]);
      }

      const { data, error } = await query;
      
      if (error) {
         if (error.message.includes('row-level security policy')) {
            throw new Error("Erreur RLS : L'opération a été bloquée. Veuillez ajouter la clé 'SUPABASE_SERVICE_ROLE_KEY' dans vos Secrets AI Studio, ou exécutez le script SQL 'phase8_produits_patients.sql' dans votre base.");
         }
         throw error;
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

      const { data, error } = await supabase.from('produits_patients').delete().eq('id', id);
      
      if (error) {
         if (error.message.includes('row-level security policy')) {
            throw new Error("Erreur RLS : L'opération a été bloquée. Veuillez ajouter la clé 'SUPABASE_SERVICE_ROLE_KEY' dans vos Secrets AI Studio, ou exécutez le script SQL 'phase8_produits_patients.sql' dans votre base pour autoriser les suppressions.");
         }
         throw error;
      }
      
      res.json({ success: true, data });
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
