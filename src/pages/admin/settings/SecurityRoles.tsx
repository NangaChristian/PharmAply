import { useState, useEffect } from "react";
import { ArrowLeft, Save, Shield, Server, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from '../../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../../lib/firebase";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export function SecurityRoles() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [adminWhitelisting, setAdminWhitelisting] = useState(false);
  const [allowedIPs, setAllowedIPs] = useState<string>('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "security");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRequireTwoFactor(data.requireTwoFactor || false);
          setAdminWhitelisting(data.adminWhitelisting || false);
          if (data.allowedIPs && Array.isArray(data.allowedIPs)) {
            setAllowedIPs(data.allowedIPs.join('\n'));
          }
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
      const ips = allowedIPs.split('\n').map(ip => ip.trim()).filter(Boolean);
      await setDoc(doc(db, "settings", "security"), {
        requireTwoFactor,
        adminWhitelisting,
        allowedIPs: ips,
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
               <ArrowLeft size={16} className="mr-1" />  {t('back_to_settings', 'Back to Settings')} </button>
             <h1 className="font-bold text-gray-900 text-2xl mb-1"> {t('security_roles', 'Security & Roles')} </h1>
             <p className="text-gray-500 text-sm"> {t('system_wide_security_policies_', 'System-wide security policies and role management')} </p>
         </div>
         <button 
           onClick={handleSave} 
           disabled={loading}
           className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-50"
         >
            <Save size={16} />  {t('save_changes', 'Save Changes')} </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
         {/* Authentication Settings */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-3 mb-6 block border-b border-gray-50 pb-4">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                 <Shield size={20} />
              </div>
              <div>
                 <h2 className="text-lg font-bold text-gray-900"> {t('authentication_policies', 'Authentication Policies')} </h2>
                 <p className="text-sm text-slate-500"> {t('configure_how_administrators_a', 'Configure how administrators authenticate.')} </p>
              </div>
            </div>
            
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={requireTwoFactor}
                    onChange={(e) => setRequireTwoFactor(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block">Require Two-Factor Authentication (2FA)</h3>
                    <p className="text-xs text-slate-500 mt-1"> {t('force_all_admin_users_to_enrol', 'Force all admin users to enroll in 2FA via authenticator app or SMS before accessing the dashboard.')} </p>
                  </div>
               </label>
            </div>
         </div>

         {/* Access Control */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-3 mb-6 block border-b border-gray-50 pb-4">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                 <Server size={20} />
              </div>
              <div>
                 <h2 className="text-lg font-bold text-gray-900"> {t('network_access_control', 'Network Access Control')} </h2>
                 <p className="text-sm text-slate-500"> {t('restrict_where_admin_dashboard', 'Restrict where admin dashboard can be accessed from.')} </p>
              </div>
            </div>
            
            <div className="space-y-4">
               <label className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl hover:bg-slate-50 transition cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={adminWhitelisting}
                    onChange={(e) => setAdminWhitelisting(e.target.checked)}
                    className="w-5 h-5 text-emerald-600 rounded mt-0.5"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm block"> {t('enable_ip_whitelisting', 'Enable IP Whitelisting')} </h3>
                    <p className="text-xs text-slate-500 mt-1"> {t('only_allow_dashboard_access_fr', 'Only allow dashboard access from specific, pre-authorized IP addresses or CIDR ranges.')} </p>
                  </div>
               </label>

               {adminWhitelisting && (
                 <div className="pl-9 pt-2">
                   <label className="block text-sm font-bold text-gray-700 mb-2"> {t('allowed_ip_addresses', 'Allowed IP Addresses')} </label>
                   <textarea
                      value={allowedIPs}
                      onChange={(e) => setAllowedIPs(e.target.value)}
                      placeholder={t('e_g_192_168_1_1_10_10_0_0_0_24', 'e.g. 192.168.1.1&#10;10.0.0.0/24')}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none font-mono min-h-[100px]"
                   />
                   <p className="text-xs text-slate-400 mt-2"> {t('enter_one_ip_address_or_cidr_r', 'Enter one IP address or CIDR range per line.')} </p>
                 </div>
               )}
            </div>
         </div>
         
         {/* Role Management */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6 block border-b border-gray-50 pb-4">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                 <Users size={20} />
              </div>
              <div>
                 <h2 className="text-lg font-bold text-gray-900"> {t('role_management', 'Role Management')} </h2>
                 <p className="text-sm text-slate-500"> {t('define_access_rules_and_permis', 'Define access rules and permissions for different user roles.')} </p>
              </div>
            </div>
            
            <div className="space-y-3">
               {[
                 { role: 'Super Admin', desc: 'Full access to all settings, users, and financial records.', badge: 'bg-purple-100 text-purple-700' },
                 { role: 'Store Manager', desc: 'Can manage products, orders, and view basic reports.', badge: 'bg-blue-100 text-blue-700' },
                 { role: 'Support Agent', desc: 'Can view orders, users, and manage tickets. Cannot modify products.', badge: 'bg-emerald-100 text-emerald-700' }
               ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-bold text-gray-900">{r.role}</h3>
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${r.badge}`}> {t('system', 'System')} </span>
                        </div>
                        <p className="text-sm text-slate-500">{r.desc}</p>
                     </div>
                     <button className="text-indigo-600 font-medium text-sm hover:underline"> {t('edit_permissions', 'Edit Permissions')} </button>
                  </div>
               ))}
               
               <button className="w-full border-2 border-dashed border-gray-200 text-gray-500 font-bold py-4 rounded-xl hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mt-2">
                  {t('create_custom_role', '+ Create Custom Role')} </button>
            </div>
         </div>
      </div>
    </div>
  );
}
