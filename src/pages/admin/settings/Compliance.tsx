import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from '../../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export function Compliance() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    tosUrl: "",
    privacyPolicyUrl: "",
    hipaaAuditLogs: true,
    prescriptionApprovalRequired: false,
    requireNABPCheck: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "compliance");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        toast.error("Failed to load settings.");
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const { name, value, type, checked } = target;
    setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, "settings", "compliance"), {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
      toast.success("Compliance settings saved!");
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
               <ArrowLeft size={16} className="mr-1" />  {t('back_to_settings', 'Back to Settings')} </button>
             <h1 className="font-bold text-gray-900 text-2xl mb-1"> {t('compliance_legal', 'Compliance & Security Controls')} </h1>
             <p className="text-gray-500 text-sm"> Audit logs, prescription verification, RBAC, and Legal </p>
         </div>
         <button 
           onClick={handleSave} 
           disabled={loading}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
         >
            <Save size={16} />  {t('save_changes', 'Save Changes')} </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4"> HIPAA & Audit </h2>
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="hipaaAuditLogs"
                    checked={settings.hipaaAuditLogs}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Enable PHI Audit Logging</h3>
                    <p className="text-xs text-slate-500 mt-1"> Log every time Protected Health Information (PHI) is accessed (timestamp, user, action) to ensure HIPAA compliance. </p>
                  </div>
               </label>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4"> Prescription Verification Rules </h2>
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="prescriptionApprovalRequired"
                    checked={settings.prescriptionApprovalRequired}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Require Admin/Pharmacist Approval for Uploaded E-Prescriptions</h3>
                    <p className="text-xs text-slate-500 mt-1"> Define if and how prescriptions are required for certain drugs. If enabled, manual check is required. </p>
                  </div>
               </label>
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="requireNABPCheck"
                    checked={settings.requireNABPCheck}
                    onChange={handleChange}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Require NABP checks for pharmacies</h3>
                    <p className="text-xs text-slate-500 mt-1"> Set requirements for uploaded pharmacy licenses, NABP checks, and government-issued documents. </p>
                  </div>
               </label>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4"> {t('legal_links', 'Legal Links')} </h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> {t('terms_of_service_url', 'Terms of Service URL')} </label>
                  <input 
                    type="url" 
                    name="tosUrl"
                    value={settings.tosUrl} 
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder={t('https_example_com_tos', 'https://example.com/tos')}
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"> {t('privacy_policy_url', 'Privacy Policy URL')} </label>
                  <input 
                    type="url" 
                    name="privacyPolicyUrl"
                    value={settings.privacyPolicyUrl} 
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder={t('https_example_com_privacy', 'https://example.com/privacy')}
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
