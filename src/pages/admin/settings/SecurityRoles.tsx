import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

export function SecurityRoles() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [adminWhitelisting, setAdminWhitelisting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "security");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRequireTwoFactor(docSnap.data().requireTwoFactor || false);
          setAdminWhitelisting(docSnap.data().adminWhitelisting || false);
        }
      } catch (error) {
        toast.error("Failed to load security settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "security"), {
        requireTwoFactor,
        adminWhitelisting,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Security settings saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/security");
      toast.error("Failed to save security settings.");
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
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Security & Roles</h1>
             <p className="text-gray-500 text-sm">System-wide security policies</p>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Admin Security Polices</h2>
            <div className="space-y-4">
               <div className="flex mt-8 gap-4 items-center">
                  <input 
                    type="checkbox" 
                    id="require2fa"
                    checked={requireTwoFactor}
                    onChange={(e) => setRequireTwoFactor(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded"
                  />
                  <div>
                    <label htmlFor="require2fa" className="font-medium text-gray-900 text-sm block cursor-pointer">Require 2FA for Admins</label>
                    <p className="text-xs text-slate-500 mt-0.5">Force all admin users to enroll in Two-Factor Authentication.</p>
                  </div>
               </div>

               <div className="flex gap-4 items-center mt-4">
                  <input 
                    type="checkbox" 
                    id="restrictIPs"
                    checked={adminWhitelisting}
                    onChange={(e) => setAdminWhitelisting(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded"
                  />
                  <div>
                    <label htmlFor="restrictIPs" className="font-medium text-gray-900 text-sm block cursor-pointer">Enable IP Whitelisting</label>
                    <p className="text-xs text-slate-500 mt-0.5">Restrict admin dashboard access to allowed IP addresses only.</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
