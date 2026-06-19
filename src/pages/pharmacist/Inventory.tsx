import { ArrowLeft, Plus, Search, Filter, MoreHorizontal, Package, Upload, Loader2, Image as ImageIcon, X, Save, Settings, ArrowUpRight, ChevronDown, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, FormEvent, useRef } from "react";
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType, supabase } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../lib/utils";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import Papa from "papaparse";

export function PharmacistInventory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  const [selectedGlobalProduct, setSelectedGlobalProduct] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");
  const [newProductExpiry, setNewProductExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProducts: () => void;
    
    const fetchContext = async () => {
      if (!user) return;
      try {
        const pQuery = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
        const pSnap = await getDocs(pQuery);
        let currentPharmacyId = pSnap.docs[0]?.id;
        
        if (!currentPharmacyId) {
          navigate('/pharmacist/profile');
          return;
        }
        setPharmacyId(currentPharmacyId);
        
        // Fetch global products from Supabase
        const { data: globalData, error: globalError } = await supabase.from('produits_patients').select('*');
        if (globalData && !globalError) {
           const mappedGlobals = globalData.map((d: any) => ({
               id: d.id,
               name: d.nom_commercial || d.commercial_name,
               commercial_name: d.nom_commercial || d.commercial_name,
               dci: d.dci,
               dosage: d.dosage,
               form: d.forme || d.form,
               category: d.ux_category || d.categorie_ux || 'Uncategorized',
               ux_category_id: d.ux_category || d.categorie_ux,
               is_prescription_required: d.is_prescription_required !== undefined ? d.is_prescription_required : d.ordonnance_requise,
           }));
           setGlobalProducts(mappedGlobals);
        }

        const q = query(collection(db, 'products'), where("pharmacyId", "==", currentPharmacyId));
        unsubscribeProducts = onSnapshot(q, (snapshot) => {
          setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        });
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchContext();
    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, [user, navigate]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csvContent = [
      ["dci", "nom_commercial", "dosage", "forme", "categorie_ux", "stock", "price"],
      ["Paracétamol", "Doliprane", "500mg", "Comprimé", "Douleurs & Fièvre", "50", "1500"],
      ["Ibuprofène", "Advil", "400mg", "Comprimé", "Douleurs & Fièvre", "30", "2000"],
    ].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "inventory_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV download template generated successfully!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !pharmacyId) return;
     
     toast.loading("Parsing CSV...", { id: 'csv' });
     Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
           const csvData = results.data as any[];
           
           // Exemple de mapping à l'intérieur de la fonction Papa.parse
           const formattedProducts = csvData.map(row => ({
               commercial_name: row.Name || row.Brand || row.nom_commercial,
               dosage: row.Dosage || row.dosage,
               prix: Number(row.Price || row.price || 0),
               stock: Number(row.Stock || row.stock || 0),
               dci: row.dci || row.description || '',
               categorie_ux: row.Category || row.categorie_ux || 'Uncategorized',
               forme: row.form || row.forme || '',
               ordonnance_requise: String(row.ordonnance_requise || row.RequiresPrescription).toLowerCase() === 'true'
           })).filter(item => item.commercial_name);

           toast.loading(`Processing ${formattedProducts.length} products...`, { id: 'csv' });
           
           try {
              let addedCount = 0;
              for (const row of formattedProducts) {
                 const name = row.commercial_name;
                 
                 // Check if it already exists in the pharmacist's inventory
                 const exists = products.find(p => p.name === name || p.commercial_name === name);
                 if (exists) {
                    await updateDoc(doc(db, 'products', exists.id), {
                       stock: exists.stock + row.stock,
                       price: row.prix
                    });
                 } else {
                    await addDoc(collection(db, 'products'), {
                       name,
                       commercial_name: name,
                       dci: row.dci,
                       category: row.categorie_ux,
                       form: row.forme,
                       dosage: row.dosage,
                       price: row.prix,
                       stock: row.stock,
                       is_prescription_required: row.ordonnance_requise,
                       needsPrescription: row.ordonnance_requise,
                       pharmacyId: pharmacyId,
                       createdAt: serverTimestamp(),
                    });
                 }
                 addedCount++;
              }
              toast.success(`Imported/Updated ${addedCount} products successfully!`, { id: 'csv' });
           } catch(err: any) {
              toast.error(`Error importing products: ${err.message || 'Unknown error'}`, { id: 'csv' });
              console.error(err);
           }
           if (fileInputRef.current) fileInputRef.current.value = "";
        },
        error: (error) => {
           toast.error(`CSV Parse Error: ${error.message}`, { id: 'csv' });
        }
     });
  };

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!pharmacyId || !user || !selectedGlobalProduct) return;
    
    setUploading(true);
    try {
      const selectedProduct = globalProducts.find(p => p.id === selectedGlobalProduct);
      if (!selectedProduct) throw new Error("Invalid product selected");

      await addDoc(collection(db, 'products'), {
        name: selectedProduct.commercial_name || selectedProduct.name,
        commercial_name: selectedProduct.commercial_name,
        dci: selectedProduct.dci,
        category: selectedProduct.category,
        ux_category_id: selectedProduct.ux_category_id,
        form: selectedProduct.form,
        dosage: selectedProduct.dosage || '',
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock),
        expiryDate: newProductExpiry,
        is_prescription_required: selectedProduct.is_prescription_required || false,
        needsPrescription: selectedProduct.is_prescription_required || false,
        pharmacyId: pharmacyId,
        createdAt: serverTimestamp(),
      });
      setShowAdd(false);
      setSelectedGlobalProduct(""); setNewProductPrice(""); setNewProductStock(""); setNewProductExpiry("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 bg-transparent flex flex-col relative h-full overflow-hidden">
      
      {/* Top Bar Area Header */}
      <div className="px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex-1 flex items-center">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                   type="text" 
                   placeholder="Search Inventory" 
                   className="w-full bg-[#FAFBFA] dark:bg-slate-800 border border-transparent focus:border-gray-200 py-3 pl-12 pr-4 rounded-full text-sm outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <input 
                 type="file" 
                 accept=".csv" 
                 className="hidden" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload} 
             />
             <button onClick={handleDownloadTemplate} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-sm transition-colors">
               <Download size={16} />
               <span className="hidden sm:inline">Template</span>
             </button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-sm transition-colors">
               <Upload size={16} />
               <span className="hidden sm:inline">Import CSV</span>
             </button>
             <button onClick={() => setShowAdd(!showAdd)} className="bg-[#0B3B3C] hover:bg-[#082a2b] text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-md transition-colors">
               <Plus size={16} />
               <span>Add Stock</span>
             </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar space-y-8">
         <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
               Inventory Management
            </h1>
         </div>

         {showAdd && (
            <form onSubmit={handleAddProduct} className="bg-[#FAFBFC] dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm space-y-4">
               <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-gray-900 dark:text-white text-lg">Add from Master Catalog</h3>
                 <button type="button" onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                 </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="col-span-1 md:col-span-2">
                   <label className="text-xs font-bold text-gray-500 mb-1 block"> Select Global Product </label>
                   <select required value={selectedGlobalProduct} onChange={e => setSelectedGlobalProduct(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none shadow-sm transition">
                      <option value="" disabled> Select a product... </option>
                      {globalProducts.map((p, idx) => (
                         <option key={`${p.id}-${idx}`} value={p.id}>
                            {p.commercial_name || p.name} {p.dci ? `[${p.dci}]` : ''} {p.dosage ? `(${p.dosage})` : ''}
                         </option>
                      ))}
                   </select>
                 </div>

                 <div className="col-span-1">
                   <label className="text-xs font-bold text-gray-500 mb-1 block"> Sell Price (XAF) </label>
                   <input required type="number" placeholder="0.00" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none shadow-sm transition" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-xs font-bold text-gray-500 mb-1 block"> Initial Stock </label>
                   <input required type="number" placeholder="0" min="0" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none shadow-sm transition" />
                 </div>
                 <div className="col-span-1">
                   <label className="text-xs font-bold text-gray-500 mb-1 block"> Expiry Date </label>
                   <input required type="date" value={newProductExpiry} onChange={e => setNewProductExpiry(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none shadow-sm transition" />
                 </div>
               </div>
               
               <div className="flex justify-end pt-2">
                 <button disabled={uploading || !selectedGlobalProduct} type="submit" className="bg-[#0B3B3C] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-md hover:bg-[#082a2b] transition disabled:opacity-50 flex items-center gap-2">
                   {uploading ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save to Inventory'}
                 </button>
               </div>
            </form>
         )}

         <div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
               <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Stock Items</h2>
               <div className="flex items-center gap-3">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                     <input type="text" placeholder="Search..." className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 py-2.5 pl-9 pr-4 rounded-xl text-xs font-medium w-48 outline-none shadow-sm" />
                  </div>
                  <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                     <Settings size={14} /> Filter <ChevronDown size={12} />
                  </button>
                  <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                     <ArrowUpRight size={14} /> Sort By <ChevronDown size={12} />
                  </button>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-700">
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Product Name</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Category</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Stock</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Price</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Expiry</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                        {loading ? (
                           <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-sm animate-pulse">Loading inventory...</td></tr>
                        ) : products.length === 0 ? (
                           <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-sm">No items in your inventory. Add some from the master catalog.</td></tr>
                        ) : (
                           products.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate(`/pharmacist/inventory/${item.id}`)}>
                                 <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 rounded-xl bg-[#FAFBFC] dark:bg-slate-900 border border-gray-100 dark:border-slate-700 flex items-center justify-center shrink-0">
                                          <Package className="text-gray-400" size={16} />
                                       </div>
                                       <div>
                                          <span className="font-bold text-gray-800 dark:text-white text-sm">{item.name || item.commercial_name || 'Unnamed Product'}</span>
                                          <p className="text-xs text-gray-500">{item.dosage || item.form || 'Various Details'}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="py-4 px-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {item.category || item.ux_category_id || 'Uncategorized'}
                                 </td>
                                 <td className="py-4 px-6">
                                    <div className="flex items-center gap-2 bg-[#FAFBFC] dark:bg-slate-900 px-3 py-1.5 rounded-full w-max border border-gray-100 dark:border-slate-700">
                                       <span className={`text-xs font-bold ${item.stock < 10 ? 'text-red-600' : 'text-[#0B3B3C] dark:text-gray-300'}`}>
                                          {item.stock} Units
                                       </span>
                                    </div>
                                 </td>
                                 <td className="py-4 px-6 font-bold text-gray-900 dark:text-white text-sm">
                                    {formatCurrency(item.price || 0)}
                                 </td>
                                 <td className="py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {item.expiryDate ? dayjs(item.expiryDate).format('MMM yyyy') : 'N/A'}
                                 </td>
                                 <td className="py-4 px-6 text-xs">
                                     <button className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-full text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); navigate(`/pharmacist/inventory/${item.id}`); }}>
                                        <ArrowUpRight size={14} />
                                     </button>
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
