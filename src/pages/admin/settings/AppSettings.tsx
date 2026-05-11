import { useState, useEffect, ChangeEvent } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import { Smartphone, Save } from "lucide-react";
import toast from "react-hot-toast";

export function AppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    forceUpdate: false,
    version: "1.0.0",
    maintenanceMode: false,
    supportEmail: "",
    termsUrl: "",
    privacyUrl: ""
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "app");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings({ ...settings, ...docSnap.data() });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "app"), settings, { merge: true });
      toast.success("App settings saved successfully");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/app");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) return <div className="p-8 text-slate-500">Loading settings...</div>;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1 flex items-center gap-2"><Smartphone size={24} /> App Settings</h1>
             <p className="text-gray-500 text-sm">Configure mobile application behavior and parameters</p>
         </div>
         <button 
           onClick={handleSave}
           disabled={saving}
           className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
         >
           <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-8">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">General Application Settings</h2>
            
            <div className="space-y-5">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current App Version</label>
                  <input 
                    type="text" 
                    name="version"
                    value={settings.version}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>

               <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="font-bold text-slate-800">Force Update Required</p>
                    <p className="text-xs text-slate-500">Require all users to update to the latest version to use the app.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="forceUpdate" checked={settings.forceUpdate} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
               </div>

               <div className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div>
                    <p className="font-bold text-amber-900">App Maintenance Mode</p>
                    <p className="text-xs text-amber-700">Prevent all non-admin users from accessing the app.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="maintenanceMode" checked={settings.maintenanceMode} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Links & Support</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Support Email Address</label>
                  <input 
                    type="email" 
                    name="supportEmail"
                    value={settings.supportEmail}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Terms of Service URL</label>
                  <input 
                    type="url" 
                    name="termsUrl"
                    value={settings.termsUrl}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Privacy Policy URL</label>
                  <input 
                    type="url" 
                    name="privacyUrl"
                    value={settings.privacyUrl}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
