import React from "react";
import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from '../../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

export function CatalogSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    enforceBatchTracking: true,
    enableSubstitutions: true,
    priceCapMultiplier: 2.0,
    allowPrescriptionDrugs: true,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "catalog");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        toast.error("Failed to load catalog settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const { name, value, type, checked } = target;
    setSettings(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : parseFloat(value)
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "catalog"), {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Catalog settings saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/catalog");
      toast.error("Failed to save catalog settings.");
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
             <h1 className="font-bold text-gray-900 text-2xl mb-1">Catalog & Inventory</h1>
             <p className="text-gray-500 text-sm">Medicine database, substitutions, and pricing rules</p>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Inventory Data Management</h2>
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="enforceBatchTracking"
                    checked={settings.enforceBatchTracking}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Enforce Batch Number & Expiry Date Tracking</h3>
                    <p className="text-xs text-slate-500 mt-1">Require pharmacists to enter batch and expiry for all medications added to stock.</p>
                  </div>
               </label>
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="enableSubstitutions"
                    checked={settings.enableSubstitutions}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Allow Medication Substitution</h3>
                    <p className="text-xs text-slate-500 mt-1">Allow pharmacies to provide generic equivalent options if brand name is out of stock.</p>
                  </div>
               </label>
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="allowPrescriptionDrugs"
                    checked={settings.allowPrescriptionDrugs}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Allow Sale of Prescription Drugs</h3>
                    <p className="text-xs text-slate-500 mt-1">Turn off to restrict the marketplace to OTC products only.</p>
                  </div>
               </label>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Pricing Rules</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> Global Price Cap Multiplier </label>
                  <input 
                    type="number" 
                    name="priceCapMultiplier"
                    value={settings.priceCapMultiplier} 
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none max-w-sm"
                    step="0.1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Limits maximum vendor price. (e.g. 2.0 = Vendor cannot charge more than 2x the base MSRP catalog value).</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
