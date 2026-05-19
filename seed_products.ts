import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const fileContent = fs.readFileSync(path.join(process.cwd(), 'cleaned_products.txt'), 'utf8');
  const lines = fileContent.split('\n').filter(Boolean);
  
  let currentCategory = 'General';
  const products: any[] = [];
  
  for (const line of lines) {
    if (line.match(/^N°|^Partie |^I\.|^II\.|^III\.|^IV\.|^V\.|^VI\.|^VII\.|^VIII\.|^IX\.|^X|^XVI/)) {
      if (line.startsWith('Partie ')) {
         currentCategory = line.substring(line.indexOf('-') + 1).trim();
      } else if (line.match(/^[IXV]+\./)) {
         // Subcategory
         currentCategory = line.substring(line.indexOf(' - ') + 3).trim();
      }
      continue;
    }
    
    // Line format: 1 Diazépam 5mg/ml Solution injectable
    const match = line.match(/^(\d+)\s+(.+?)\s+((?:\d+(?:,\d+)?.*?|M|≥.*?)\s+(?:Solution|Comprimé|Aérosol|Crème|Pommade|Sirop|Gélule|Capsule|PPI|Sachet|Collyre|Lotion|CP|suppositoire|suspension).*|.*)$/i);
    
    if (match) {
      let designation = match[2].trim();
      let dosageForm = match[3] ? match[3].trim() : '';
      
      let imageUrl = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80"; // Pill bottle
      if (dosageForm.toLowerCase().includes('solution') || dosageForm.toLowerCase().includes('injectable') || dosageForm.toLowerCase().includes('perfusion')) {
         imageUrl = "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=400&q=80"; // syringe/solution
      } else if (dosageForm.toLowerCase().includes('sirop') || dosageForm.toLowerCase().includes('buvable') || dosageForm.toLowerCase().includes('suspension')) {
         imageUrl = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80"; // bottle
      } else if (dosageForm.toLowerCase().includes('crème') || dosageForm.toLowerCase().includes('pommade')) {
         imageUrl = "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80"; // tube
      }
      
      products.push({
        id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        data: {
           name: designation,
           dosage: dosageForm,
           category: currentCategory,
           brand: 'Generic',
           price: Math.floor(Math.random() * 5000) + 500, // mock price for generic
           stock: 100, // mock
           imageUrl,
           createdAt: new Date().toISOString(),
           isGlobal: true, // Identify it as a global product provided by the admin
           pharmacyId: null // No specific pharmacy
        }
      });
    } else {
       // fallback parsing
       const fallbackMatch = line.match(/^(\d+)\s+(.*)$/);
       if (fallbackMatch) {
          products.push({
             id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
             data: {
               name: fallbackMatch[2].trim(),
               dosage: '',
               category: currentCategory,
               brand: 'Generic',
               price: Math.floor(Math.random() * 5000) + 500,
               stock: 100,
               imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
               createdAt: new Date().toISOString(),
               isGlobal: true,
               pharmacyId: null
             }
          });
       }
    }
  }

  console.log(`Parsed ${products.length} products. Inserting...`);
  
  // Clean existing global products maybe? 
  // No, let's just insert
  // Batch insert
  for (let i = 0; i < products.length; i += 50) {
    const chunk = products.slice(i, i + 50);
    const { error } = await supabase.from('products').insert(chunk);
    if (error) {
       console.error("Error inserting chunk", error);
    } else {
       console.log(`Inserted ${i + chunk.length} products`);
    }
  }
}

seed().catch(console.error);
