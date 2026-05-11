import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, deleteDoc, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Search, Plus, Edit2, Trash2, Tags, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

export function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatImage, setNewCatImage] = useState("");

  useEffect(() => {
    const q = query(collection(db, "categories"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      toast.success("Category deleted");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `categories/${id}`);
    }
  };

  const handleCreate = async () => {
    if (!newCatName.trim()) return;
    try {
      await addDoc(collection(db, "categories"), {
        name: newCatName,
        imageUrl: newCatImage,
        createdAt: serverTimestamp(),
        isActive: true,
      });
      setShowModal(false);
      setNewCatName("");
      setNewCatImage("");
      toast.success("Category created");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `categories`);
    }
  };

  const filteredCategories = categories.filter(c => 
    (c.name?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden relative">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Categories Directory</h1>
             <p className="text-gray-500 text-sm">Organize store structure and visual navigation</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
             <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search categories..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                />
             </div>
             <button 
                onClick={() => setShowModal(true)}
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition flex items-center gap-2"
             >
                <Plus size={18} /> Add Category
             </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500">Loading categories...</div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold">Icon</th>
                            <th className="py-4 px-6 font-semibold">Name</th>
                            <th className="py-4 px-6 font-semibold">Status</th>
                            <th className="py-4 px-6 font-semibold text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredCategories.map((c) => (
                           <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-6">
                                 <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                    {c.imageUrl ? (
                                      <img src={c.imageUrl} className="w-full h-full object-cover rounded-xl" alt="" />
                                    ) : (
                                      <Tags className="text-slate-400" size={18} />
                                    )}
                                 </div>
                              </td>
                              <td className="py-4 px-6">
                                 <span className="font-bold text-slate-800">{c.name}</span>
                              </td>
                              <td className="py-4 px-6">
                                 {c.isActive ? (
                                   <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase">Active</span>
                                 ) : (
                                   <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase">Inactive</span>
                                 )}
                              </td>
                              <td className="py-4 px-6 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition" title="Edit">
                                       <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition" title="Delete">
                                       <Trash2 size={16} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                         ))}
                         {filteredCategories.length === 0 && (
                           <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500">No categories found.</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Create New Category</h2>
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                    <input 
                      type="text" 
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (Optional)</label>
                    <input 
                      type="text" 
                      value={newCatImage}
                      onChange={(e) => setNewCatImage(e.target.value)}
                      placeholder="https://images.unsplash..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                 </div>
                 <div className="flex justify-end gap-3 pt-4">
                    <button 
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleCreate}
                      className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm"
                    >
                      Create Category
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
