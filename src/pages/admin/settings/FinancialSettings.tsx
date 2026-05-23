import React from "react";
import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from '../../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";

export function FinancialSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    defaultCommissionRate: 5,
    deliveryFixedFee: 3,
    primaryGateway: "stripe",
    secondaryGateway: "paypal",
    taxRate: 7,
    autoCalculateTax: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "financial");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        toast.error("Failed to load financial settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setSettings(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value) 
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "financial"), {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Financial settings saved!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/financial");
      toast.error("Failed to save financial settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <button onClick={() => navigate("/admin/settings")} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-100 mb-2">
               <ArrowLeft size={16} className="mr-1" /> Back to Settings </button>
             <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1">Financial & Payment Settings</h1>
             <p className="text-gray-500 text-sm">Gateways, taxes, and platform commission</p>
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
         <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Payment Gateways & Reconciliation</h2>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> Primary Payment Gateway </label>
                  <select name="primaryGateway" value={settings.primaryGateway} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                     <option value="stripe">Stripe</option>
                     <option value="paypal">PayPal</option>
                     <option value="square">Square</option>
                  </select>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> Secondary Payment Gateway </label>
                  <select name="secondaryGateway" value={settings.secondaryGateway} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                     <option value="none">None</option>
                     <option value="stripe">Stripe</option>
                     <option value="paypal">PayPal</option>
                     <option value="crypto">Cryptocurrency (Coinbase)</option>
                  </select>
               </div>
            </div>
         </div>

         <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Commission Rules & Fees</h2>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> Default Commission Rate (%) </label>
                  <input 
                    type="number" 
                    name="defaultCommissionRate"
                    value={settings.defaultCommissionRate} 
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="5.0"
                    step="0.1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Applied to vendor subtotal</p>
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> Standard Delivery Base Fee ($) </label>
                  <input 
                    type="number" 
                    name="deliveryFixedFee"
                    value={settings.deliveryFixedFee} 
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="3.0"
                    step="0.5"
                  />
                  <p className="text-xs text-slate-500 mt-1">Paid directly to delivery driver</p>
               </div>
            </div>
         </div>

         <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tax & Invoice Settings</h2>
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="autoCalculateTax"
                    checked={settings.autoCalculateTax}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm block">Automated Tax Calculations</h3>
                    <p className="text-xs text-slate-500 mt-1">Automatically calculate regional taxes on checkout based on user location.</p>
                  </div>
               </label>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> Default Base Tax Rate (%) </label>
                  <input 
                    type="number" 
                    name="taxRate"
                    value={settings.taxRate} 
                    onChange={handleChange}
                    disabled={!settings.autoCalculateTax}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:bg-gray-100 dark:bg-zinc-800"
                    placeholder="7.0"
                  />
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}
