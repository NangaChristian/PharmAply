import React, { useState, useEffect, useRef } from "react";
import { collection, query, getDocs, doc, updateDoc, deleteDoc, onSnapshot, addDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType, supabase } from "../../lib/firebase";
import { Search, Plus, Edit2, Trash2, Tag, AlertCircle, Database, Upload, ArrowUpDown, Image as ImageIcon, Package, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { formatCurrency } from "../../lib/utils";
import { useTranslation } from "react-i18next";

import { seedData } from '../../seed_data';
import { getCategoryIcon } from '../../lib/icons';

const produitsPatientsData = [
  {"dci": "Paracétamol", "commercial_name": "Doliprane, Efferalgan, Panadol", "dosage": "500mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Paracétamol", "commercial_name": "Doliprane Pédiatrique", "dosage": "2.4%", "form": "Sirop / Suspension", "is_prescription_required": false, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Ibuprofène", "commercial_name": "Advil, Brufen, Nurofen", "dosage": "400mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Diclofénac", "commercial_name": "Voltarène, Olfen", "dosage": "50mg", "form": "Comprimé", "is_prescription_required": true, "ux_category": "Douleurs & Fièvre"},
  {"dci": "Artemether + Lumefantrine", "commercial_name": "Coartem, Lumartem, Artefan", "dosage": "20mg/120mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Paludisme"},
  {"dci": "Oméprazole", "commercial_name": "Mopral, Zoltum, Inipomp", "dosage": "20mg", "form": "Gélule", "is_prescription_required": true, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Diosmectite", "commercial_name": "Smecta", "dosage": "3g", "form": "Sachet", "is_prescription_required": false, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Sels de Réhydratation Orale (SRO)", "commercial_name": "Adidiar, Orasel", "dosage": "Standard", "form": "Sachet", "is_prescription_required": false, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Phloroglucinol", "commercial_name": "Spasfon", "dosage": "80mg", "form": "Comprimé Lyoc", "is_prescription_required": false, "ux_category": "Maux d'estomac & Digestion"},
  {"dci": "Salbutamol", "commercial_name": "Ventoline", "dosage": "100µg/dose", "form": "Aérosol / Inhalateur", "is_prescription_required": true, "ux_category": "Toux, Rhume & Asthme"},
  {"dci": "Loratadine", "commercial_name": "Clarityne", "dosage": "10mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Allergies"},
  {"dci": "Amoxicilline", "commercial_name": "Clamoxyl, Amoxil", "dosage": "500mg", "form": "Gélule", "is_prescription_required": true, "ux_category": "Infections & Antibiotiques"},
  {"dci": "Albendazole", "commercial_name": "Zentel", "dosage": "400mg", "form": "Comprimé", "is_prescription_required": false, "ux_category": "Antiparasitaires"}
];

/*
ARCHITECTURE D'ACCÈS POUR LES PHARMACIES :

La table `produits_patients` sert de catalogue de base (référentiel global) pour toutes les pharmacies.
Les pharmacies ne dupliquent pas ces produits dans leur base, mais utilisent une table de liaison
`pharmacy_inventory` pour indiquer qu'elles possèdent un produit, son prix et sa quantité.

Table de liaison suggérée :
CREATE TABLE pharmacy_inventory (
  id uuid PRIMARY KEY,
  pharmacy_id text NOT NULL,
  produit_id uuid REFERENCES produits_patients(id),
  stock int DEFAULT 0,
  price numeric(10,2) NOT NULL
);

Requête Supabase pour lister les produits pour une pharmacie connectée :
const { data, error } = await supabase
  .from('produits_patients')
  .select(`
    *,
    pharmacy_inventory (
      stock,
      price
    )
  `)
  .eq('pharmacy_inventory.pharmacy_id', supabase.auth.user().id);

Les pharmacies peuvent ainsi consulter le catalogue global complet via :
await supabase.from('produits_patients').select('*');
et ajouter/cocher les produits correspondants dans leur 'pharmacy_inventory'.
*/

export function AdminProducts() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  
  // Filters & Sorting
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "brand" | "category">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [rxFilter, setRxFilter] = useState<"all" | "rx" | "otc">("all");
  
  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
     name: "", dosage: "", category: "", brand: "", price: "", stock: "", imageUrl: "", requiresPrescription: false, description: "", effects: "", directions: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGlobalProducts = async () => {
     try {
        const { data, error } = await supabase.from('produits_patients').select('*');
        if (data && !error) {
           const mappedOut = data.map((d: any) => ({
               id: d.id,
               name: d.commercial_name,
               description: d.dci,
               dosage: d.dosage,
               category: d.ux_category,
               requiresPrescription: d.is_prescription_required,
               price: 0,
               stock: 0,
               imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
               isGlobal: true,
               pharmacyId: null
           }));
           // we prepend these global reference catalogs
           setProducts(prev => {
               // filter out existing seeded to avoid duplicates in the UI
               const withoutGlobals = prev.filter(p => !mappedOut.find(m => m.name === p.name));
               return [...mappedOut, ...withoutGlobals];
           });
        }
     } catch (err) {
         console.error('Error fetching global catalog', err);
     }
  };

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setLoading(false);
      // after loading local firebase products, load the real supabase global table
      fetchGlobalProducts();
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    const catQ = query(collection(db, "categories"));
    const catUnsub = onSnapshot(catQ, (snapshot) => {
       setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data()})));
    });

    return () => { unsubscribe(); catUnsub(); };
  }, []);

  const handleSeed = async () => {
     if (!window.confirm("Êtes-vous sûr de vouloir insérer les produits de base ? Les entrées en double pourraient survenir.")) return;
     setIsSeeding(true);
     try {
        toast.loading(`Seeding ${produitsPatientsData.length} produits globaux...`, { id: 'seed' });
        const { error } = await supabase.from('produits_patients').insert(produitsPatientsData);
        if (error) throw error;
        
        toast.success(`${produitsPatientsData.length} Produits ajoutés au catalogue global !`, { id: 'seed' });
        
        fetchGlobalProducts();
     } catch(e) {
        toast.error("Erreur lors de l'insertion.", { id: 'seed' });
        console.error(e);
     } finally {
        setIsSeeding(false);
     }
  };

  const handleGenerateInfo = async () => {
    if (!window.confirm("Are you sure you want to generate description, effects, and directions for all products that are missing them?")) return;
    toast.loading("Generating product information...", { id: 'gen_info' });
    try {
        let updatedCount = 0;
        const promises = products.map(async (p) => {
           if (!p.description || !p.effects || !p.directions) {
               const description = p.description || `${p.name} is a high-quality pharmaceutical product available in ${p.dosage} format. It is commonly recommended within the ${p.category} category. Ensure to follow professional medical advice when using this product.`;
               const effects = p.effects || `Provides reliable relief and treatment associated with ${p.category?.toLowerCase() || 'general conditions'}. May cause mild drowsiness, stomach upset, or dizziness in some instances.`;
               const directions = p.directions || `For oral use: Take exactly as prescribed. Do not exceed the recommended dose. Take with a full glass of water. If applied topically or injected, ensure it is administered by a qualified professional or according to the leaflet instructions.`;
               
               await updateDoc(doc(db, "products", p.id), {
                   description,
                   effects,
                   directions
               });
               updatedCount++;
           }
        });
        await Promise.all(promises);
        toast.success(`Successfully updated ${updatedCount} products with detailed information!`, { id: 'gen_info' });
    } catch (e) {
        toast.error("Error generating information", { id: 'gen_info' });
        console.error("Info gen error:", e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     
     toast.loading("Parsing CSV...", { id: 'csv' });
     Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
           let successCount = 0;
           let updateCount = 0;
           toast.loading(`Processing ${results.data.length} products...`, { id: 'csv' });
           
           try {
              const promises = results.data.map(async (row: any) => {
                 const name = row.Name || row.name || '';
                 if (!name) return;

                 // Check if product exists by name to update, otherwise insert
                 const existingProduct = products.find(p => p.name?.toLowerCase() === name.toLowerCase());
                 
                 const rowPrice = parseFloat(row.Price || row.price || '0');
                 const rowStock = parseInt(row.Stock || row.stock || '0', 10);
                 const rowRx = String(row.RequiresPrescription || row.requiresPrescription || row.Prescription || '').toLowerCase() === 'true';
                 
                 if (existingProduct) {
                    await updateDoc(doc(db, 'products', existingProduct.id), {
                       price: rowPrice,
                       stock: rowStock,
                       requiresPrescription: rowRx
                    });
                    updateCount++;
                 } else {
                    await addDoc(collection(db, 'products'), {
                       name: name || 'Unnamed',
                       dosage: row.Dosage || row.dosage || '',
                       category: row.Category || row.category || 'Uncategorized',
                       brand: row.Brand || row.brand || 'Generic',
                       price: rowPrice,
                       stock: rowStock,
                       imageUrl: row.ImageURL || row.Image || row.imageUrl || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
                       requiresPrescription: rowRx,
                       createdAt: new Date().toISOString(),
                       isGlobal: true,
                       pharmacyId: null
                    });
                    successCount++;
                 }
              });
              await Promise.all(promises.filter(Boolean));
              toast.success(`Imported ${successCount} new, Updated ${updateCount} stock/pricing!`, { id: 'csv' });
           } catch(err) {
              toast.error("Error importing products", { id: 'csv' });
              console.error(err);
           }
           if (fileInputRef.current) fileInputRef.current.value = "";
        },
        error: (error) => {
           toast.error(`CSV Parse Error: ${error.message}`, { id: 'csv' });
        }
     });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // We mock image upload by reading as base64 data URI
    const reader = new FileReader();
    reader.onload = (event) => {
       if (event.target?.result) {
          setFormData({ ...formData, imageUrl: event.target.result as string });
       }
    };
    reader.readAsDataURL(file);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: "", dosage: "", category: "", brand: "", price: "", stock: "", imageUrl: "", requiresPrescription: false });
    setShowModal(true);
  };

  const openEditModal = (product: any) => {
    setEditingId(product.id);
    setFormData({
       name: product.name || "",
       dosage: product.dosage || "",
       category: product.category || "",
       brand: product.brand || "",
       price: product.price?.toString() || "0",
       stock: product.stock?.toString() || "0",
       imageUrl: product.imageUrl || "",
       requiresPrescription: !!product.requiresPrescription,
       description: product.description || "",
       effects: product.effects || "",
       directions: product.directions || ""
    });
    setShowModal(true);
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
       toast.error("Product name is required");
       return;
    }
    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          ...formData,
          price: parseFloat(formData.price) || 0,
          stock: parseInt(formData.stock, 10) || 0,
        });
        toast.success("Product updated successfully");
      } else {
        await addDoc(collection(db, "products"), {
          ...formData,
          price: parseFloat(formData.price) || 0,
          stock: parseInt(formData.stock, 10) || 0,
          createdAt: new Date().toISOString(),
          isGlobal: true,
          pharmacyId: null
        });
        toast.success("Product created successfully");
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: "", dosage: "", category: "", brand: "", price: "", stock: "", imageUrl: "", requiresPrescription: false, description: "", effects: "", directions: "" });
    } catch (e) {
      handleFirestoreError(e, editingId ? OperationType.UPDATE : OperationType.CREATE, `products`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
    }
  };

  const toggleSort = (field: "name" | "price" | "stock" | "brand" | "category") => {
     if (sortBy === field) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
     } else {
        setSortBy(field);
        setSortOrder("asc");
     }
  };

  const clearFilters = () => {
     setSearch("");
     setRxFilter("all");
     setSortBy("name");
     setSortOrder("asc");
  };

  const filteredProducts = products.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = (p.name?.toLowerCase() || "").includes(term) ||
                          (p.brand?.toLowerCase() || "").includes(term) ||
                          (p.category?.toLowerCase() || "").includes(term);
                          
    let matchesRx = true;
    if (rxFilter === "rx") matchesRx = p.requiresPrescription === true;
    if (rxFilter === "otc") matchesRx = p.requiresPrescription !== true;

    return matchesSearch && matchesRx;
  }).sort((a, b) => {
     let comparison = 0;
     if (sortBy === "name") {
        comparison = (a.name || "").localeCompare(b.name || "");
     } else if (sortBy === "price") {
        comparison = (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
     } else if (sortBy === "brand") {
        comparison = (a.brand || "").localeCompare(b.brand || "");
     } else if (sortBy === "category") {
        comparison = (a.category || "").localeCompare(b.category || "");
     } else if (sortBy === "stock") {
        comparison = (parseInt(a.stock, 10) || 0) - (parseInt(b.stock, 10) || 0);
     }
     return sortOrder === "asc" ? comparison : -comparison;
  });

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden relative">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1">{t('admin_products', 'Products')}</h1>
             <p className="text-gray-500 text-sm">{t('admin_products_desc', 'View and manage all medications across the platform')}</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
             <div className="flex items-center gap-3">
                 <div className="relative w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder={t('search_placeholder', 'Search name, brand, category...')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                    />
                 </div>
                 <select 
                    value={rxFilter}
                    onChange={(e) => setRxFilter(e.target.value as any)}
                    className="bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 px-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                 >
                    <option value="all">{t('all_products', 'All Products')}</option>
                    <option value="rx">{t('rx_only', 'Prescription Only (Rx)')}</option>
                    <option value="otc">{t('otc_only', 'Over The Counter (OTC)')}</option>
                 </select>
                 {(search || rxFilter !== "all" || sortBy !== "name") && (
                    <button 
                       onClick={clearFilters}
                       className="text-slate-500 hover:text-slate-700 text-sm font-medium underline"
                    >
                       {t('clear_filters', 'Clear Filters')}
                    </button>
                 )}
             </div>
             
             <div className="flex gap-3">
               <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
               />
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white dark:bg-zinc-950 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-2"
               >
                  <Upload size={18} /> {t('csv_import', 'CSV Import')}
               </button>
               <button onClick={handleSeed} disabled={isSeeding} className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-200 transition flex items-center gap-2">
                  {isSeeding ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                  {isSeeding ? t('seeding', "Seeding...") : t('seed_db', "Seed Global Database")}
               </button>
               <button onClick={handleGenerateInfo} className="bg-orange-100 text-orange-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-orange-200 transition flex items-center gap-2">
                  <Package size={18} />
                  Generate Info
               </button>
               <button 
                  onClick={openAddModal}
                  className="bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-teal-700 transition flex items-center gap-2"
               >
                  <Plus size={18} />
                  {t('add_global_product', 'Add Global Product')}
               </button>
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500">{t('loading_products', 'Loading products...')}</div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("name")}>
                               <div className="flex items-center gap-1"> {t('product_info', 'Product Info')} {sortBy === 'name' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("brand")}>
                               <div className="flex items-center gap-1"> {t('brand_manufacturer', 'Brand / Manufacturer')} {sortBy === 'brand' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("category")}>
                               <div className="flex items-center gap-1"> {t('category', 'Category')} {sortBy === 'category' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("price")}>
                               <div className="flex items-center gap-1"> {t('base_price', 'Base Price')} {sortBy === 'price' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold cursor-pointer select-none hover:bg-slate-100 transition" onClick={() => toggleSort("stock")}>
                               <div className="flex items-center gap-1"> {t('stock', 'Stock')} {sortBy === 'stock' && <ArrowUpDown size={14}/>}</div>
                            </th>
                            <th className="py-4 px-6 font-semibold"> {t('status', 'Status')} </th>
                            <th className="py-4 px-6 font-semibold text-right"> {t('actions', 'Actions')} </th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredProducts.map((p) => (
                           <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-6">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                       {(p.imageUrl || p.ImageURL || p.image || p.Image) ? (
                                         <img src={p.imageUrl || p.ImageURL || p.image || p.Image} className="w-full h-full object-cover rounded-xl" alt="" />
                                       ) : (
                                         <Tag className="text-slate-400" size={18} />
                                       )}
                                    </div>
                                    <div>
                                       <p className="font-bold text-slate-900 dark:text-white">{p.name || 'Unnamed Product'}</p>
                                       <p className="text-xs text-slate-500">{p.dosage || 'No dosage info'}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="text-slate-700">{p.brand || 'Generic'}</span>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="flex w-fit items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                   <span className="opacity-70">{getCategoryIcon(p.category, 14)}</span>
                                   {p.category || 'Uncategorized'}
                                 </span>
                              </td>
                              <td className="py-4 px-6 font-bold text-slate-700">
                                 {formatCurrency(Number(p.price || 0))}
                              </td>
                              <td className="py-4 px-6">
                                 {p.stock > 0 ? (
                                    <span className="text-slate-700 font-medium">{p.stock}  {t('units', 'units')} </span>
                                 ) : (
                                    <span className="text-red-500 font-bold"> {t('out_of_stock', 'Out of stock')} </span>
                                 )}
                              </td>
                              <td className="py-4 px-6">
                                {p.requiresPrescription ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-max">
                                    <AlertCircle size={12} />  {t('prescription_rx', 'Prescription Rx')} </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-max">
                                     {t('otc', 'OTC')} </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => openEditModal(p)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition" title={t('edit', 'Edit')}>
                                       <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition" title={t('delete', 'Delete')}>
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                         {filteredProducts.length === 0 && (
                           <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-500"> {t('no_products_found', 'No products found.')} </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      </div>

      {showModal && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 w-full max-w-2xl shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{editingId ? "Edit Product" : "Add New Product"}</h2>
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 flex items-center gap-4 mb-2">
                    {(formData.imageUrl || formData.ImageURL || formData.image || formData.Image) ? (
                       <img src={formData.imageUrl || formData.ImageURL || formData.image || formData.Image} className="w-16 h-16 rounded-xl object-cover border border-slate-200" alt="Preview"/>
                    ) : (
                       <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <ImageIcon className="text-slate-400" size={24} />
                       </div>
                    )}
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1"> {t('image_upload', 'Image Upload')} </label>
                       <input 
                         type="file" 
                         accept="image/*" 
                         onChange={handleImageUpload} 
                         className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                       />
                       <p className="text-xs text-slate-500 mt-1"> {t('or_provide_a_url_below', 'Or provide a URL below')} </p>
                    </div>
                 </div>
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1"> {t('product_name', 'Product Name *')} </label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"> {t('brand', 'Brand')} </label>
                    <input type="text" value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"> {t('dosage_format', 'Dosage / Format')} </label>
                    <input type="text" value={formData.dosage} onChange={(e) => setFormData({...formData, dosage: e.target.value})} placeholder={t('e_g_500mg_tablets', 'e.g. 500mg Tablets')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"> {t('category', 'Category')} </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    >
                      <option value="">{t('select_category', 'Select Category...')}</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"> {t('image_url', 'Image URL')} </label>
                    <input type="text" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} placeholder={t('https', 'https://...')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (XAF)</label>
                    <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"> {t('initial_stock', 'Initial Stock')} </label>
                    <input type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                 </div>

                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Product details..."></textarea>
                 </div>
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Effects</label>
                    <textarea value={formData.effects} onChange={(e) => setFormData({...formData, effects: e.target.value})} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="Side effects or main benefits..."></textarea>
                 </div>
                 <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Directions</label>
                    <textarea value={formData.directions} onChange={(e) => setFormData({...formData, directions: e.target.value})} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none" placeholder="How to use the product..."></textarea>
                 </div>

                 <div className="col-span-2 flex items-center gap-3">
                    <input type="checkbox" id="rx" checked={formData.requiresPrescription} onChange={(e) => setFormData({...formData, requiresPrescription: e.target.checked})} className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500" />
                    <label htmlFor="rx" className="text-sm font-medium text-gray-700"> {t('requires_prescription', 'Requires Prescription')} </label>
                 </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                 <button onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"> {t('cancel', 'Cancel')} </button>
                 <button onClick={handleCreateOrUpdate} className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition shadow-sm">{editingId ? "Update Product" : "Save Product"}</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
