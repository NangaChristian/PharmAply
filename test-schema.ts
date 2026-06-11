import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function check() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        console.log("no keys");
        return;
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase.from('produits_patients').select('*').limit(1);
    if (error) {
        console.log("Error querying:", error);
    } else {
        console.log("Data columns:", data && data.length > 0 ? Object.keys(data[0]) : "Query succeeded but table is empty. Let's try sending a generic error to see what happens.");
    }
}
check();
