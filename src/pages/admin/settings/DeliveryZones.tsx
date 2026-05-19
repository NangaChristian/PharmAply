import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from '../../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export function DeliveryZones() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [baseFee, setBaseFee] = useState<number>(3);
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1);
  const [maxDistance, setMaxDistance] = useState<number>(50);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "deliveryZones");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBaseFee(data.baseFee || 3);
          setSurgeMultiplier(data.surgeMultiplier || 1);
          setMaxDistance(data.maxDistance || 50);
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
      await setDoc(doc(db, "settings", "deliveryZones"), {
        baseFee,
        surgeMultiplier,
        maxDistance,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Delivery zones settings saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/deliveryZones");
      toast.error("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <button onClick={() => navigate("/admin/settings")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
               <ArrowLeft size={16} className="mr-1" />  {t('back_to_settings', 'Back to Settings')} </button>
             <h1 className="font-bold text-gray-900 text-2xl mb-1"> {t('delivery_zones_maps', 'Delivery Zones & Maps')} </h1>
             <p className="text-gray-500 text-sm"> {t('manage_service_regions_and_sur', 'Manage service regions and surge pricing')} </p>
         </div>
         <button 
           onClick={handleSave} 
           disabled={loading}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
         >
            <Save size={16} />  {t('save_changes', 'Save Changes')} </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-6">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4"> {t('pricing_configuration', 'Pricing Configuration')} </h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Delivery Fee (FCFA)</label>
                  <input 
                    type="number" 
                    value={baseFee} 
                    onChange={e => setBaseFee(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> {t('surge_pricing_multiplier', 'Surge Pricing Multiplier')} </label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={surgeMultiplier} 
                    onChange={e => setSurgeMultiplier(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">Multiplies the base fee during high demand (e.g., 1.5x).</p>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Delivery Distance (km)</label>
                  <input 
                    type="number" 
                    value={maxDistance} 
                    onChange={e => setMaxDistance(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
