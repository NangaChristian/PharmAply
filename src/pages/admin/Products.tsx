import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, updateDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Search, Plus, Edit2, Trash2, Tag, AlertCircle } from "lucide-react";

export function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (p.brand?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Products Management</h1>
             <p className="text-gray-500 text-sm">View and manage all medications across the platform</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
             <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                />
             </div>
             <button className="bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-teal-700 transition flex items-center gap-2">
                <Plus size={18} />
                Add Global Product
             </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500">Loading products...</div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold">Product Info</th>
                            <th className="py-4 px-6 font-semibold">Brand / Manufacturer</th>
                            <th className="py-4 px-6 font-semibold">Category</th>
                            <th className="py-4 px-6 font-semibold">Base Price</th>
                            <th className="py-4 px-6 font-semibold">Status</th>
                            <th className="py-4 px-6 font-semibold text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredProducts.map((p) => (
                           <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-6">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                       {p.imageUrl ? (
                                         <img src={p.imageUrl} className="w-full h-full object-cover rounded-xl" alt="" />
                                       ) : (
                                         <Tag className="text-slate-400" size={18} />
                                       )}
                                    </div>
                                    <div>
                                       <p className="font-bold text-slate-900">{p.name || 'Unnamed Product'}</p>
                                       <p className="text-xs text-slate-500">{p.dosage || 'No dosage info'}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="text-slate-700">{p.brand || 'Generic'}</span>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                   {p.category || 'Uncategorized'}
                                 </span>
                              </td>
                              <td className="py-4 px-6 font-bold text-slate-700">
                                 ${Number(p.price || 0).toFixed(2)}
                              </td>
                              <td className="py-4 px-6">
                                {p.requiresPrescription ? (
                                  <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-max">
                                    <AlertCircle size={12} /> Prescription Rx
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-max">
                                    OTC
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition" title="Edit">
                                       <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition" title="Delete">
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                         {filteredProducts.length === 0 && (
                           <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-500">No products found.</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      </div>
    </div>
  );
}
