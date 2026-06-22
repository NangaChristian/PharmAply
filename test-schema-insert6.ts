import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function test() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (data?.length) {
     console.log("Cols:", Object.keys(data[0]));
  } else {
     console.log("No data returned");
     console.log("Error:", error);
  }
}
test();
