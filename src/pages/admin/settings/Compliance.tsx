import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

export function Compliance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tosUrl, setTosUrl] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "compliance");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTosUrl(docSnap.data().tosUrl || "");
          setPrivacyPolicyUrl(docSnap.data().privacyPolicyUrl || "");
        }
      } catch (error) {
        toast.error("Failed to load settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "compliance"), {
        tosUrl,
        privacyPolicyUrl,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Compliance links saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/compliance");
      toast.error("Failed to save compliance settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <button onClick={() => navigate("/admin/settings")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
               <ArrowLeft size={16} className="mr-1" /> Back to Settings
             </button>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Compliance & Legal</h1>
             <p className="text-gray-500 text-sm">Update platform TOS and legal documents</p>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Legal Links</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terms of Service URL</label>
                  <input 
                    type="url" 
                    value={tosUrl} 
                    onChange={e => setTosUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="https://example.com/tos"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Privacy Policy URL</label>
                  <input 
                    type="url" 
                    value={privacyPolicyUrl} 
                    onChange={e => setPrivacyPolicyUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="https://example.com/privacy"
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
