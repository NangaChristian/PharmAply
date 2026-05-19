import fs from 'fs';

const rawData = fs.readFileSync('raw_pdf_text.txt', 'utf-8');

const lines = rawData.split('\n').filter(l => l.trim() !== '');

let currentCategory = '';
let currentSubcategory = '';

const products: any[] = [];
let currentProduct: any = null;

const categoryRegex = /^Partie (\d+)[\s:-]+(.*)$/i;
const subCategoryRegex = /^[IVX]+\.[\d.]+[\s:-]+(.*)$/i;
const productLineRegex = /^(\d+)\s+(.+?)\s+((?:\d+(?:,\d+)?(?:mg|g|µg|ml|UI|MUI|%|microgrammes|dose|doses|mOsm\/l)[\s/A-Za-z0-9.+*(),-]*)+)\s+(.+)$/i;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  if (line.match(/^N°\s+Désignation/)) continue;
  if (line.match(/^LISTE NATIONALE DE MEDICAMENTS/)) continue;
  if (line.match(/^ESSENTIELS DES HOPITAUX/)) continue;
  if (line.match(/^LNME_2022/)) continue;

  const catMatch = line.match(categoryRegex);
  if (catMatch) {
    currentCategory = catMatch[2].trim();
    continue;
  }

  const subCatMatch = line.match(subCategoryRegex);
  if (subCatMatch) {
    currentSubcategory = subCatMatch[1].trim();
    continue;
  }

  // Very naively try to parse the products
  // A lot of lines don't have the number because they are continuations or variants
  const prodMatch = line.match(/^(\d+)\s+(.+)$/);
  if (prodMatch) {
    const num = prodMatch[1];
    let rest = prodMatch[2];
    
    // Attempt to split rest into name, dosage, form
    // Let's just store the whole string for manual cleanup if necessary or simple representation
    products.push({
      category: currentCategory,
      subcategory: currentSubcategory,
      raw: line
    });
  } else if (products.length > 0) {
    // Might be dosage/form variants for the latest product
    products[products.length - 1].raw += ' | ' + line;
  } else {
    // console.log("Skipped: ", line);
  }
}

fs.writeFileSync('parsed_products.json', JSON.stringify(products, null, 2));
console.log(`Parsed ${products.length} products`);
