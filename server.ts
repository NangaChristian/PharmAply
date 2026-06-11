import express from "express";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

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

  // API Routes
  app.post("/api/fapshi/initiate-pay", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { amount, email, externalId, redirectUrl } = req.body;
      
      const apiUser = process.env.FAPSHI_API_USER;
      const apiKey = process.env.FAPSHI_API_KEY;

      if (!apiUser || !apiKey) {
        return res.status(500).json({ success: false, error: "Fapshi credentials are not configured on the backend. Please add FAPSHI_API_USER and FAPSHI_API_KEY." });
      }

      console.log('Initiating Fapshi payment for:', { amount, email, externalId });

      const response = await fetch('https://sandbox.fapshi.com/initiate-pay', {
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
        console.error('Fapshi initiate-pay error response:', data);
        return res.status(response.status).json({ success: false, error: data.message || "Failed to initiate payment" });
      }

      res.json({ success: true, link: data.link });
    } catch (error: any) {
      console.error("Fapshi server error:", error);
      res.status(500).json({ success: false, error: "Internal server error connecting to Fapshi" });
    }
  });

  // Fapshi Webhook Endpoint
  app.post("/api/fapshi/webhook", async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      console.log('Received Fapshi webhook:', req.body);
      const { externalId, status, transId } = req.body;
      
      if (status === 'SUCCESSFUL' && externalId) {
        console.log(`Payment successful for order ${externalId}`);
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
           const { createClient } = await import('@supabase/supabase-js');
           const supabase = createClient(supabaseUrl, supabaseKey);
           
           const { data: orderResponse, error: fetchError } = await supabase
              .from('orders')
              .select('data')
              .eq('id', externalId)
              .single();
              
           if (!fetchError && orderResponse?.data) {
              const updatedData = { ...orderResponse.data, status: 'paid', fapshiTransId: transId };
              await supabase.from('orders').update({ data: updatedData }).eq('id', externalId);
              console.log('Successfully updated order status to paid in Supabase');
           }
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

      const { data: insertedData, error } = await supabase
        .from('produits_patients')
        .insert(data);
        
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
         dci,
         nom_commercial: commercial_name,
         dosage,
         forme: form,
         ordonnance_requise: is_prescription_required === true || is_prescription_required === 'true',
         categorie_ux: ux_category
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
  if (process.env.NODE_ENV !== "production") {
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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
