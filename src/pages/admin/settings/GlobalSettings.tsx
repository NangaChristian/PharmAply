import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

export function GlobalSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [supportEmail, setSupportEmail] = useState("");
  const [appVersion, setAppVersion] = useState("1.0.0");

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMaintenanceMode(docSnap.data().maintenanceMode || false);
          setSupportEmail(docSnap.data().supportEmail || "");
          setAppVersion(docSnap.data().appVersion || "1.0.0");
        }
      } catch (error) {
        toast.error("Failed to load global settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "global"), {
        maintenanceMode,
        supportEmail,
        appVersion,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Global settings saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/global");
      toast.error("Failed to save global settings.");
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
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Global Settings</h1>
             <p className="text-gray-500 text-sm">General application configuration</p>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Application Details</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                  <input 
                    type="email" 
                    value={supportEmail} 
                    onChange={e => setSupportEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="support@pharmaply.com"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required Minimum App Version</label>
                  <input 
                    type="text" 
                    value={appVersion} 
                    onChange={e => setAppVersion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="1.0.0"
                  />
               </div>
               
               <div className="flex pt-4 mt-4 border-t border-slate-100 gap-4 items-center">
                  <input 
                    type="checkbox" 
                    id="maintenanceMode"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded"
                  />
                  <div>
                    <label htmlFor="maintenanceMode" className="font-medium text-red-600 text-sm block cursor-pointer">Maintenance Mode</label>
                    <p className="text-xs text-slate-500 mt-0.5">When checked, the client apps will display a maintenance screen and prevent logins.</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
