import React from "react";
import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from '../../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

export function VendorSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    requireBusinessLicense: true,
    requireTaxId: true,
    requirePharmacistLicense: true,
    autoApproveVerified: false,
    allowCustomCommissions: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "vendor");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        toast.error("Failed to load vendor settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const { name, checked } = target;
    setSettings(prev => ({ ...prev, [name]: checked }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "vendor"), {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Vendor settings saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/vendor");
      toast.error("Failed to save vendor settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <button onClick={() => navigate("/admin/settings")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
               <ArrowLeft size={16} className="mr-1" /> Back to Settings </button>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Vendor & Pharmacist Settings</h1>
             <p className="text-gray-500 text-sm">Onboarding KYC, licensing, and approvals</p>
         </div>
         <button 
           onClick={handleSave} 
           disabled={loading}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
         >
            <Save size={16} /> Save Changes
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Onboarding KYC & Licensing Requirements</h2>
            <p className="text-sm text-gray-500 mb-4">Set requirements for uploaded pharmacy documents during registration.</p>
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="requireBusinessLicense"
                    checked={settings.requireBusinessLicense}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Require Operating License / Business License</h3>
                  </div>
               </label>
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="requireTaxId"
                    checked={settings.requireTaxId}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Require Taxpayer Card / VAT ID</h3>
                  </div>
               </label>
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="requirePharmacistLicense"
                    checked={settings.requirePharmacistLicense}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Require Pharmacy Board License</h3>
                  </div>
               </label>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Approval & Commissions</h2>
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="autoApproveVerified"
                    checked={settings.autoApproveVerified}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Auto-approve Verified Pharmacies</h3>
                    <p className="text-xs text-slate-500 mt-1">If unchecked, requires manual admin approval for all vendors.</p>
                  </div>
               </label>
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="allowCustomCommissions"
                    checked={settings.allowCustomCommissions}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Allow Custom Commission Rates</h3>
                    <p className="text-xs text-slate-500 mt-1">Allow overriding global commission rates per pharmacy in vendor management.</p>
                  </div>
               </label>
            </div>
         </div>

      </div>
    </div>
  );
}
