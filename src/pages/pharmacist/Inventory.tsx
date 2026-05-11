import { ArrowLeft, Plus, Search, Filter, MoreHorizontal, Package, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, FormEvent, useRef } from "react";
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';

export function PharmacistInventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Pain Relief");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductStock, setNewProductStock] = useState("");
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
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
    if (!pharmacyId || !user) return;
    
    setUploading(true);
    try {
      let imageUrl = "";
      if (newProductImage) {
        try {
          const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_${newProductImage.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, newProductImage);
          imageUrl = await getDownloadURL(uploadTask.ref);
        } catch (storageErr: any) {
          console.warn("Storage upload failed, using placeholder url for prototype:", storageErr);
          imageUrl = `https://via.placeholder.com/800x800.png?text=${encodeURIComponent(newProductImage.name)}`;
        }
      }

      await addDoc(collection(db, 'products'), {
        name: newProductName,
        category: newProductCategory,
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock),
        needsPrescription: false,
        pharmacyId: pharmacyId,
        imageUrl: imageUrl,
        createdAt: serverTimestamp(),
      });
      setShowAdd(false);
      setNewProductName(""); setNewProductPrice(""); setNewProductStock(""); setNewProductImage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex flex-col gap-4 bg-white shadow-sm z-10">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <button onClick={() => navigate('/pharmacist')} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100">
                <ArrowLeft size={20} className="text-gray-900" />
             </button>
             <h1 className="font-bold text-gray-900 text-lg">Inventory</h1>
           </div>
           <button onClick={() => setShowAdd(!showAdd)} className="bg-indigo-600 text-white p-2.5 rounded-full shadow-md shadow-indigo-200">
             <Plus size={20} />
           </button>
        </div>
        
        <div className="flex gap-2">
           <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Search..." className="w-full bg-gray-100 py-3 pl-12 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
         {showAdd && (
            <form onSubmit={handleAddProduct} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-3 mb-6">
               <h3 className="font-bold text-sm">Add New Product</h3>
               
               <label className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-500 bg-gray-50 hover:bg-indigo-50 cursor-pointer transition">
                  <Upload size={20} className="mb-2 text-indigo-400" />
                  <span className="text-xs font-medium text-center">
                    {newProductImage ? newProductImage.name : 'Upload Product Image (Optional)'}
                  </span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files) setNewProductImage(e.target.files[0]) }} />
               </label>
               
               <input required type="text" placeholder="Product Name" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
               <input required type="text" placeholder="Category" value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
               <div className="flex gap-2">
                  <input required type="number" placeholder="Price" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-1/2 border p-2 rounded-lg text-sm" />
                  <input required type="number" placeholder="Stock" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="w-1/2 border p-2 rounded-lg text-sm" />
               </div>
               <button disabled={uploading} type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2">
                 {uploading ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Product'}
               </button>
            </form>
         )}

         {loading ? <p className="text-sm text-gray-500">Loading...</p> : 
          products.length === 0 ? <p className="text-sm text-gray-500">No products in inventory.</p> :
          products.map(item => {
            const status = item.stock > 10 ? 'In Stock' : item.stock > 0 ? 'Low Stock' : 'Out of Stock';
            return (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden text-gray-400">
                       {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <Package size={24} />}
                    </div>
                    <div>
                       <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                       <p className="text-xs text-gray-500 mt-1">{item.stock} in stock • ${item.price}</p>
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <button className="text-gray-400 hover:text-gray-600">
                       <MoreHorizontal size={20} />
                    </button>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                       status === 'In Stock' ? 'bg-green-100 text-green-700' :
                       status === 'Low Stock' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}>
                       {status}
                    </span>
                 </div>
              </div>
            );
         })}
      </div>
    </div>
  );
}
