import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

interface Promo {
  code: string;
  discountPer: number;
}

export function Promotions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState(10);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "promotions");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPromos(docSnap.data().list || []);
        }
      } catch (error) {
        toast.error("Failed to load promotions.");
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "promotions"), {
        list: promos,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Promotions saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/promotions");
      toast.error("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  const addPromo = () => {
    if (!newCode.trim()) return;
    setPromos([...promos, { code: newCode.toUpperCase(), discountPer: newDiscount }]);
    setNewCode("");
    setNewDiscount(10);
  };

  const removePromo = (index: number) => {
    setPromos(promos.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <button onClick={() => navigate("/admin/settings")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
               <ArrowLeft size={16} className="mr-1" /> Back to Settings
             </button>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Promotions & Campaigns</h1>
             <p className="text-gray-500 text-sm">Manage discount codes and platform campaigns</p>
         </div>
         <button 
           onClick={handleSave} 
           disabled={loading}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
         >
            <Save size={16} /> Save Changes
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-6">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Active Promo Codes</h2>
            
            <div className="flex gap-4 mb-6">
              <input 
                type="text" 
                placeholder="Code (e.g. SUMMER20)"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
              />
              <div className="relative w-32">
                 <input 
                   type="number" 
                   value={newDiscount}
                   onChange={e => setNewDiscount(Number(e.target.value))}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
                 <span className="absolute right-4 top-2.5 text-slate-500 text-sm">%</span>
              </div>
              <button 
                onClick={addPromo}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition"
              >
                <Plus size={18} />
              </button>
            </div>

            {promos.length > 0 ? (
              <div className="space-y-3">
                 {promos.map((promo, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                       <div>
                          <p className="font-bold text-indigo-900">{promo.code}</p>
                          <p className="text-xs text-slate-500">{promo.discountPer}% discount</p>
                       </div>
                       <button 
                         onClick={() => removePromo(idx)}
                         className="text-red-500 hover:text-red-700 text-sm font-medium"
                       >
                         Remove
                       </button>
                    </div>
                 ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No active promotions</p>
            )}
         </div>
      </div>
    </div>
  );
}
