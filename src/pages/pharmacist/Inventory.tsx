import { ArrowLeft, Plus, Search, Filter, MoreHorizontal, Package, Upload, Loader2, Image as ImageIcon, X, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, FormEvent, useRef } from "react";
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';
import { sendEmail } from '../../lib/email';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { ProductCard } from '../../components/ProductCard';
import { useTranslation } from "react-i18next";

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
          alert('Please setup your pharmacy profile first!');
          navigate('/pharmacist/profile');
          return;
        }
        setPharmacyId(currentPharmacyId);
        
        // Fetch global products
        const gQuery = query(collection(db, 'products'), where("isGlobal", "==", true));
        const gSnap = await getDocs(gQuery);
        setGlobalProducts(gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

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

  const handleAddProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!pharmacyId || !user || !selectedGlobalProduct) return;
    
    setUploading(true);
    try {
      const selectedProduct = globalProducts.find(p => p.id === selectedGlobalProduct);
      if (!selectedProduct) throw new Error("Invalid product selected");

      await addDoc(collection(db, 'products'), {
        name: selectedProduct.name,
        category: selectedProduct.category,
        dosage: selectedProduct.dosage || '',
        brand: selectedProduct.brand || 'Generic',
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock),
        expiryDate: newProductExpiry,
        needsPrescription: false,
        pharmacyId: pharmacyId,
        imageUrl: selectedProduct.imageUrl,
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

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    setUploading(true);
    try {
      const newStock = parseInt(editingProduct.stock);
      await updateDoc(doc(db, 'products', editingProduct.id), {
        name: editingProduct.name,
        dosage: editingProduct.dosage,
        category: editingProduct.category,
        brand: editingProduct.brand,
        price: parseFloat(editingProduct.price),
        stock: newStock,
      });

      if (newStock < 10) {
        await sendEmail({
          to: user?.email || '',
          subject: 'Low Stock Alert',
          html: `<h1>Low Stock Alert</h1><p>Your product <b>${editingProduct.name}</b> is running low on stock. Current stock level: ${newStock}.</p>`
        });
      }

      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${editingProduct.id}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!editingProduct) return;
    if (!window.confirm("Are you sure you want to remove this product?")) return;
    setUploading(true);
    try {
      await deleteDoc(doc(db, 'products', editingProduct.id));
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${editingProduct.id}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex flex-col gap-4 bg-white dark:bg-black shadow-sm z-10 rounded-b-3xl">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <button onClick={() => navigate('/pharmacist')} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full hover:bg-gray-100 dark:bg-zinc-900 transition">
                <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
             </button>
             <h1 className="font-bold text-gray-900 dark:text-white text-xl"> {t('inventory', 'Inventory')} </h1>
           </div>
           <button onClick={() => setShowAdd(!showAdd)} className={`p-2.5 rounded-full shadow-md transition ${showAdd ? 'bg-red-50 text-red-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
             {showAdd ? <X size={20} /> : <Plus size={20} />}
           </button>
        </div>
        
        <div className="flex gap-2">
           <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input type="text" placeholder={t('search_products', 'Search products...')} className="w-full bg-gray-100 dark:bg-zinc-900 py-3 pl-12 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition" />
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 w-full">
         {showAdd && (
            <form onSubmit={handleAddProduct} className="bg-white dark:bg-black p-5 rounded-3xl border border-indigo-100 shadow-sm space-y-4 mb-6">
               <h3 className="font-bold text-gray-900 dark:text-white text-lg"> {t('add_from_master_list', 'Add from Master List')} </h3>
               
               <select 
                  required 
                  value={selectedGlobalProduct} 
                  onChange={e => setSelectedGlobalProduct(e.target.value)} 
                  className="w-full border p-3 rounded-xl text-sm bg-gray-50 dark:bg-black focus:ring-2 focus:ring-indigo-100 outline-none transition"
               >
                  <option value="" disabled> {t('select_a_product', 'Select a product...')} </option>
                  {globalProducts.map(p => (
                     <option key={p.id} value={p.id}>
                        {p.name} {p.dosage ? `(${p.dosage})` : ''} - {p.category}
                     </option>
                  ))}
               </select>

               {selectedGlobalProduct && (
                 <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-600 mb-1 block"> {t('price', 'Price')} </label>
                      <input required type="number" placeholder="0.00" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-600 mb-1 block"> {t('initial_stock', 'Initial Stock')} </label>
                      <input required type="number" placeholder="0" min="0" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-600 mb-1 block"> expiry date </label>
                      <input required type="date" value={newProductExpiry} onChange={e => setNewProductExpiry(e.target.value)} className="w-full border border-gray-200 dark:border-zinc-800 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 transition" />
                    </div>
                 </div>
               )}
               
               <button disabled={uploading || !selectedGlobalProduct} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2 transition">
                 {uploading ? <><Loader2 size={16} className="animate-spin" />  {t('saving', 'Saving...')} </> : 'Add to My Inventory'}
               </button>
            </form>
         )}

         {loading ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 animate-pulse text-center py-10"> {t('loading_inventory', 'Loading inventory...')} </p> : 
          products.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center py-10"> {t('no_products_in_inventory', 'No products in inventory.')} </p> :
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(item => (
                <div key={item.id}>
                   <ProductCard product={item} onClick={() => navigate(`/pharmacist/inventory/${item.id}`)} showSaleBadge={false} />
                </div>
            ))}
          </div>
         }
      </div>

    </div>
  );
}
