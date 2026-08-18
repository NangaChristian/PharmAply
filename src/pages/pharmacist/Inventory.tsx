import { ArrowLeft, Plus, Search, Filter, MoreHorizontal, Package, Upload, Loader2, Image as ImageIcon, X, Save, Settings, ArrowUpRight, ChevronDown, Download, CheckCircle, Trash2, CheckSquare, Square, Edit3, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, FormEvent, useRef, useMemo } from "react";
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
  const [globalSearch, setGlobalSearch] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");
  const [newProductExpiry, setNewProductExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "priceAsc" | "nameAsc">("recent");

  // Multi-selection & bulk actions states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [showBulkStockModal, setShowBulkStockModal] = useState(false);
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  const fetchInventory = async (pharmId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('pharmacy_id', pharmId);
        
      if (error) {
        console.error("Error fetching inventory:", error);
        return;
      }
      
      if (data) {
        // Map to expected format for the UI
        const mappedProducts = data.map(row => ({
          id: row.id,
          name: row.commercial_name || row.nom_commercial || row.name || '',
          commercial_name: row.commercial_name || row.nom_commercial || row.name || '',
          dci: row.dci || row.description || '',
          dosage: row.dosage || '',
          form: row.form || '',
          price: row.price ? Number(row.price) : 0,
          stock: row.stock ? Number(row.stock) : 0,
          expiryDate: row.expiry_date || '',
          product_id: row.product_id || '',
          imageUrl: row.image_url || row.imageUrl || row.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
          image_url: row.image_url || row.imageUrl || row.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
          category: row.ux_category_id || '',
          pharmacyId: row.pharmacy_id || null,
          createdAt: row.created_at || null,
        }));
        setProducts(mappedProducts);
      }
    } catch (err) {
      console.error("Unexpected error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

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
               imageUrl: d.image_url || d.imageUrl || d.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
               image_url: d.image_url || d.imageUrl || d.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
               category: d.ux_category || d.categorie_ux || 'Uncategorized',
               ux_category_id: d.ux_category || d.categorie_ux,
               is_prescription_required: d.is_prescription_required !== undefined ? d.is_prescription_required : d.ordonnance_requise,
           }));
           setGlobalProducts(mappedGlobals);
        }

        // Fetch inventory directly via Supabase
        await fetchInventory(currentPharmacyId);
        
        // Optional: Realtime listener (kept for background updates)
        const channel = supabase.channel(`public:products-${currentPharmacyId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `pharmacy_id=eq.${currentPharmacyId}` }, () => {
            fetchInventory(currentPharmacyId);
          })
          .subscribe();
          
        unsubscribeProducts = () => {
          supabase.removeChannel(channel);
        };
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
                       stock: (exists.stock || 0) + (row.stock || 0),
                       price: row.prix || exists.price || 0
                    });
                 } else {
                    await addDoc(collection(db, 'products'), {
                       name,
                       commercial_name: name || "Unnamed Product",
                       dci: row.dci || "",
                       category: row.categorie_ux || "Uncategorized",
                       form: row.forme || "",
                       dosage: row.dosage || "",
                       price: row.prix || 0,
                       stock: row.stock || 0,
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

      const priceNum = parseFloat(newProductPrice);
      const stockNum = parseInt(newProductStock, 10);

      // Insert directly into Supabase table 'products'
      const productName = selectedProduct.commercial_name || selectedProduct.name || selectedProduct.nom_commercial || "Unnamed Product";
      const productImg = selectedProduct.image_url || selectedProduct.imageUrl || selectedProduct.image || null;
      const { data, error } = await supabase.from('products').insert([
        {
          nom_commercial: productName,
          commercial_name: productName,
          dci: selectedProduct.dci || "",
          dosage: selectedProduct.dosage || '',
          form: selectedProduct.form || "",
          image_url: productImg,
          is_prescription_required: selectedProduct.is_prescription_required || false,
          price: isNaN(priceNum) ? 0 : priceNum,
          stock: isNaN(stockNum) ? 0 : stockNum,
          expiry_date: newProductExpiry || null,
          product_id: selectedGlobalProduct,
          pharmacy_id: pharmacyId,
          ux_category_id: selectedProduct.ux_category_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedProduct.ux_category_id) ? selectedProduct.ux_category_id : null,
          created_at: new Date().toISOString()
        }
      ]).select();

      if (error) {
        // Detailed error log for RLS and type debugging
        const isRLSError = error.code === '42501';
        const isConstraintError = error.code && error.code.startsWith('23');
        const isTypeError = error.code && error.code.startsWith('22');
        
        console.error("Supabase insert error in handleAddProduct:", {
          errorType: isRLSError ? 'RLS Policy Violation' : isConstraintError ? 'Constraint Violation' : isTypeError ? 'Data Type Error' : 'Unknown Database Error',
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        
        toast.error(`Error: ${isRLSError ? 'Permission denied (RLS)' : error.message}`);
        return; // Don't reset UI if insertion failed
      }

      // Success: Reset UI and refetch
      toast.success("Product successfully added to inventory!");
      setShowAdd(false);
      setSelectedGlobalProduct(""); 
      setGlobalSearch(""); 
      setNewProductPrice(""); 
      setNewProductStock(""); 
      setNewProductExpiry("");
      
      // Force UI refresh
      await fetchInventory(pharmacyId);
      
    } catch (err: any) {
      console.error("Unexpected error in handleAddProduct:", err);
      toast.error(`Unexpected error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const filteredGlobalProducts = useMemo(() => {
    if (!globalSearch.trim()) return globalProducts.slice(0, 50); // Show max 50 initially to rendering performance
    const q = globalSearch.toLowerCase();
    return globalProducts.filter(p => 
      (p.commercial_name || p.name || '').toLowerCase().includes(q) ||
      (p.dci || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [globalProducts, globalSearch]);

  const sortedStockItems = useMemo(() => {
    let filtered = [...products];

    // Filter by search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name || p.commercial_name || '').toLowerCase().includes(q) ||
        (p.dci || '').toLowerCase().includes(q) ||
        (p.dosage || '').toLowerCase().includes(q) ||
        (p.form || '').toLowerCase().includes(q)
      );
    }

    // Filter by stock status
    if (stockStatusFilter === 'in_stock') {
      filtered = filtered.filter(p => (p.stock || 0) >= 10);
    } else if (stockStatusFilter === 'low_stock') {
      filtered = filtered.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 10);
    } else if (stockStatusFilter === 'out_of_stock') {
      filtered = filtered.filter(p => (p.stock || 0) <= 0);
    }

    // Sort
    if (sortBy === 'priceAsc') {
      filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'nameAsc') {
      filtered.sort((a, b) => {
        const nameA = (a.name || a.commercial_name || '').toLowerCase();
        const nameB = (b.name || b.commercial_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return timeB - timeA;
      });
    }
    return filtered;
  }, [products, searchTerm, stockStatusFilter, sortBy]);

  // Selection handlers
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedStockItems.length && sortedStockItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedStockItems.map(item => item.id));
    }
  };

  // Single Product Deletion
  const handleDeleteSingle = async (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer "${name}" de votre inventaire ?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error(`Erreur de suppression: ${error.message}`);
        return;
      }

      // Optional Firestore cleanup
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (e) {}

      toast.success(`"${name}" a été supprimé`);
      setSelectedIds(prev => prev.filter(item => item !== id));
      if (pharmacyId) await fetchInventory(pharmacyId);
    } catch (err: any) {
      toast.error(`Erreur inattendue: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Product Deletion
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${selectedIds.length} produit(s) de votre inventaire ?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const countToDelete = selectedIds.length;
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedIds);

      if (error) {
        toast.error(`Erreur lors de la suppression groupée: ${error.message}`);
        return;
      }

      // Cleanup Firestore docs in background
      selectedIds.forEach(async (id) => {
        try {
          await deleteDoc(doc(db, 'products', id));
        } catch (e) {}
      });

      toast.success(`${countToDelete} produit(s) supprimé(s) avec succès`);
      setSelectedIds([]);
      if (pharmacyId) await fetchInventory(pharmacyId);
    } catch (err: any) {
      toast.error(`Erreur inattendue: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Stock Update
  const handleBulkUpdateStock = async () => {
    if (selectedIds.length === 0 || !bulkStockValue) return;
    const newStockNum = parseInt(bulkStockValue, 10);
    if (isNaN(newStockNum) || newStockNum < 0) {
      toast.error("Veuillez entrer une quantité de stock valide");
      return;
    }

    try {
      setIsUpdatingStock(true);
      const { error } = await supabase
        .from('products')
        .update({ stock: newStockNum })
        .in('id', selectedIds);

      if (error) {
        toast.error(`Erreur de mise à jour: ${error.message}`);
        return;
      }

      toast.success(`Stock mis à jour (${newStockNum} unités) pour ${selectedIds.length} produit(s)`);
      setShowBulkStockModal(false);
      setBulkStockValue("");
      setSelectedIds([]);
      if (pharmacyId) await fetchInventory(pharmacyId);
    } catch (err: any) {
      toast.error(`Erreur inattendue: ${err.message}`);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const isAllSelected = sortedStockItems.length > 0 && selectedIds.length === sortedStockItems.length;

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
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div className="col-span-1 md:col-span-2 lg:col-span-3">
                   <label className="text-xs font-bold text-gray-500 mb-2 block"> Search & Select Global Product </label>
                   <div className="space-y-3">
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                       <input
                         type="text"
                         placeholder="Search master catalog..."
                         value={globalSearch}
                         onChange={(e) => setGlobalSearch(e.target.value)}
                         className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 py-2.5 pl-9 pr-4 rounded-xl text-sm outline-none focus:border-emerald-500 transition shadow-sm"
                       />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl custom-scrollbar">
                       {filteredGlobalProducts.map((p, idx) => {
                         const pName = p.commercial_name || p.name;
                         const isAdded = products.some(
                           (prod) => (prod.commercial_name === pName || prod.name === pName)
                         );
                         const isSelected = selectedGlobalProduct === p.id;
                         return (
                           <div
                             key={`${p.id}-${idx}`}
                             onClick={() => {
                               if (!isAdded) setSelectedGlobalProduct(p.id);
                             }}
                             className={`relative p-3 rounded-xl border flex flex-col justify-between transition-all ${
                               isAdded
                                 ? "opacity-60 cursor-not-allowed bg-gray-100 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700"
                                 : isSelected
                                 ? "cursor-pointer bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500"
                                 : "cursor-pointer bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700"
                             }`}
                           >
                             <div className="flex items-start justify-between gap-2 mb-2">
                               <div className="flex-1">
                                 <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2">
                                   {pName}
                                 </h4>
                                 {p.dci && (
                                   <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                     {p.dci}
                                   </p>
                                 )}
                               </div>
                               {(isAdded || isSelected) && (
                                 <div
                                   className={`shrink-0 rounded-full ${
                                     isAdded ? "text-gray-400" : "text-emerald-500"
                                   }`}
                                 >
                                   <CheckCircle size={18} />
                                 </div>
                               )}
                             </div>
                             <div className="flex items-center gap-2 mt-auto">
                               {p.dosage && (
                                 <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                                   {p.dosage}
                                 </span>
                               )}
                               {p.form && (
                                 <span className="text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis">
                                   {p.form}
                                 </span>
                               )}
                             </div>
                           </div>
                         );
                       })}
                       {filteredGlobalProducts.length === 0 && (
                         <div className="col-span-full py-8 text-center text-sm font-medium text-gray-500">
                           No products found in master catalog.
                         </div>
                       )}
                     </div>
                   </div>
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

         <div className="pb-24">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
               <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Articles en stock ({sortedStockItems.length})</h2>
                  {sortedStockItems.length > 0 && (
                     <button 
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                     >
                        {isAllSelected ? <CheckSquare size={15} className="text-emerald-600" /> : <Square size={15} />}
                        <span>{isAllSelected ? "Tout désélectionner" : "Tout sélectionner"}</span>
                     </button>
                  )}
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                     <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Rechercher nom, DCI..." 
                        className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 py-2 pl-9 pr-3 rounded-xl text-xs font-medium w-44 md:w-56 outline-none shadow-sm text-gray-900 dark:text-white" 
                     />
                     {searchTerm && (
                        <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                           <X size={12} />
                        </button>
                     )}
                  </div>

                  <select 
                     value={stockStatusFilter} 
                     onChange={(e) => setStockStatusFilter(e.target.value as any)}
                     className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm outline-none cursor-pointer"
                  >
                     <option value="all">Tous les statuts</option>
                     <option value="in_stock">En stock (≥ 10)</option>
                     <option value="low_stock">Stock faible (&lt; 10)</option>
                     <option value="out_of_stock">Rupture de stock (0)</option>
                  </select>

                  <select 
                     value={sortBy} 
                     onChange={(e) => setSortBy(e.target.value as "recent" | "priceAsc" | "nameAsc")}
                     className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm outline-none cursor-pointer"
                  >
                     <option value="recent">Plus récents</option>
                     <option value="priceAsc">Prix croissant</option>
                     <option value="nameAsc">Nom (A-Z)</option>
                  </select>
               </div>
            </div>

            {loading ? (
               <div className="py-12 text-center text-gray-500 text-sm animate-pulse">Chargement de l'inventaire...</div>
            ) : sortedStockItems.length === 0 ? (
               <div className="py-12 text-center text-gray-500 text-sm bg-white dark:bg-slate-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 p-8">
                  <Package className="mx-auto mb-2 text-gray-400" size={32} />
                  <p className="font-bold text-gray-700 dark:text-gray-300">Aucun produit trouvé</p>
                  <p className="text-xs text-gray-400 mt-1">Ajoutez des produits depuis le catalogue ou modifiez vos filtres de recherche.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sortedStockItems.map((item) => {
                     const isSelected = selectedIds.includes(item.id);
                     return (
                        <div 
                           key={item.id} 
                           className={`bg-white dark:bg-slate-800 rounded-2xl border p-5 flex flex-col justify-between transition-all cursor-pointer relative group ${
                              isSelected 
                                 ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-900/10 shadow-md' 
                                 : 'border-gray-100 dark:border-slate-700 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800'
                           }`} 
                           onClick={() => navigate(`/pharmacist/inventory/${item.id}`)}
                        >
                           <div>
                              <div className="flex justify-between items-start mb-3">
                                 {/* Selection Checkbox */}
                                 <button 
                                    onClick={(e) => toggleSelect(item.id, e)}
                                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition shrink-0 ${
                                       isSelected 
                                          ? 'bg-emerald-600 border-emerald-600 text-white' 
                                          : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-400 hover:border-emerald-400'
                                    }`}
                                    title={isSelected ? "Désélectionner" : "Sélectionner pour action groupée"}
                                 >
                                    {isSelected ? <CheckCircle size={15} /> : <Square size={15} />}
                                 </button>

                                 <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0 mx-2">
                                    {item.imageUrl || item.image_url ? (
                                       <img 
                                         src={item.imageUrl || item.image_url} 
                                         alt={item.name} 
                                         className="w-full h-full object-cover"
                                         onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                         }}
                                       />
                                    ) : (
                                       <Package className="text-gray-400" size={20} />
                                    )}
                                 </div>

                                 <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                       (item.stock || 0) <= 0 
                                          ? 'bg-red-50 text-red-600 dark:bg-red-900/30' 
                                          : (item.stock || 0) < 10 
                                          ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30' 
                                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30'
                                    }`}>
                                       {item.stock || 0} en stock
                                    </span>
                                 </div>
                              </div>

                              <h3 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-1 mb-0.5">
                                 {item.name || item.commercial_name || 'Produit'}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-4">
                                 {item.dosage || item.form || item.dci || 'Détails non spécifiés'}
                              </p>
                           </div>

                           <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50 dark:border-slate-700/50">
                              <div className="flex flex-col">
                                 <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Prix de vente</span>
                                 <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(item.price || 0)}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                 <button 
                                    onClick={(e) => handleDeleteSingle(item.id, item.name || item.commercial_name || 'Produit', e)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition"
                                    title="Supprimer ce produit"
                                 >
                                    <Trash2 size={14} />
                                 </button>
                                 <button 
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition"
                                    title="Voir la fiche détaillée"
                                 >
                                    <ArrowUpRight size={14} />
                                 </button>
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>
            )}
         </div>

         {/* Floating Bulk Actions Bar */}
         {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0B3B3C] text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-700/50 animate-in slide-in-from-bottom-6">
               <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-400/30">
                     {selectedIds.length} sélectionné(s)
                  </span>
               </div>

               <div className="h-5 w-px bg-white/20"></div>

               <div className="flex items-center gap-2">
                  <button 
                     onClick={() => setShowBulkStockModal(true)}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
                  >
                     <Edit3 size={14} />
                     <span>Ajuster stock</span>
                  </button>

                  <button 
                     onClick={handleBulkDelete}
                     disabled={isDeleting}
                     className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/80 hover:bg-red-600 text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                     {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                     <span>Supprimer la sélection</span>
                  </button>
               </div>

               <div className="h-5 w-px bg-white/20"></div>

               <button 
                  onClick={() => setSelectedIds([])}
                  className="p-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition"
                  title="Annuler la sélection"
               >
                  <X size={16} />
               </button>
            </div>
         )}

         {/* Bulk Stock Update Modal */}
         {showBulkStockModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
               <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="font-bold text-gray-900 dark:text-white text-base">Ajuster le stock en masse</h3>
                     <button onClick={() => setShowBulkStockModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                     </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                     Définissez la nouvelle quantité en stock pour les <strong className="text-gray-900 dark:text-white">{selectedIds.length} produits sélectionnés</strong> :
                  </p>

                  <div className="mb-5">
                     <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Nouvelle quantité (unités)</label>
                     <input 
                        type="number"
                        min="0"
                        placeholder="Ex: 50"
                        value={bulkStockValue}
                        onChange={(e) => setBulkStockValue(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-3 rounded-xl text-sm outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                     />
                  </div>

                  <div className="flex gap-2">
                     <button 
                        onClick={() => setShowBulkStockModal(false)}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition"
                     >
                        Annuler
                     </button>
                     <button 
                        onClick={handleBulkUpdateStock}
                        disabled={isUpdatingStock || !bulkStockValue}
                        className="flex-1 py-2.5 rounded-xl bg-[#0B3B3C] text-white text-xs font-bold hover:bg-[#082a2b] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                     >
                        {isUpdatingStock ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Appliquer
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}
