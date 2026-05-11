import { useState, useEffect } from "react";
import { ArrowLeft, Edit2, User, Clock, ShieldCheck, LogOut, FileText, Globe, Car, Settings, Bell, Headset, CreditCard, Lock, CheckCircle, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export function DeliveryProfile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    const fetchDriver = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'drivers', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setDriver({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDriver();
  }, [activeMenu]);

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  const openMenu = (menu: string) => {
    if (driver) {
      setFormData(driver);
    }
    setActiveMenu(menu);
  };

  const handleSave = async () => {
    if (!auth.currentUser || !driver) return;
    try {
      await updateDoc(doc(db, 'drivers', auth.currentUser.uid), formData);
      toast.success(t('profile_updated', 'Profile updated successfully'));
      setActiveMenu(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  if (activeMenu) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-gray-100">
          <div className="flex items-center gap-3">
             <button onClick={() => setActiveMenu(null)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100">
                <ArrowLeft size={20} className="text-gray-900" />
             </button>
             <h1 className="font-bold text-gray-900 text-lg capitalize">{activeMenu.replace('_', ' ')}</h1>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeMenu === 'vehicle_details' && (
             <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <select 
                    value={formData.vehicleType || 'motorcycle'} 
                    onChange={(e) => setFormData({...formData, vehicleType: e.target.value})} 
                    className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 outline-none"
                  >
                     <option value="motorcycle">Motorcycle</option>
                     <option value="car">Car</option>
                     <option value="van">Van</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Plate</label>
                  <input 
                    type="text" 
                    value={formData.vehiclePlate || ''} 
                    onChange={(e) => setFormData({...formData, vehiclePlate: e.target.value})} 
                    className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 outline-none" 
                  />
                </div>
             </div>
          )}

          {activeMenu === 'payout_methods' && (
             <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name / Mobile Money Provider</label>
                  <input 
                    type="text" 
                    value={formData.bankName || ''} 
                    onChange={(e) => setFormData({...formData, bankName: e.target.value})} 
                    placeholder="e.g MTN Mobile Money"
                    className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number / Phone</label>
                  <input 
                    type="text" 
                    value={formData.accountNumber || ''} 
                    onChange={(e) => setFormData({...formData, accountNumber: e.target.value})} 
                    className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 outline-none" 
                  />
                </div>
             </div>
          )}

          {activeMenu === 'working_hours' && (
             <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input 
                    type="time" 
                    value={formData.workStartTime || '08:00'} 
                    onChange={(e) => setFormData({...formData, workStartTime: e.target.value})} 
                    className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input 
                    type="time" 
                    value={formData.workEndTime || '18:00'} 
                    onChange={(e) => setFormData({...formData, workEndTime: e.target.value})} 
                    className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 outline-none" 
                  />
                </div>
             </div>
          )}

          {activeMenu === 'driver_documents' && (
             <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3">
                   <ShieldCheck size={24} />
                   <div>
                     <p className="font-bold text-sm">Documents Verified</p>
                     <p className="text-xs opacity-80">Your KYC documents are approved.</p>
                   </div>
                </div>
             </div>
          )}

          <div className="pt-8">
            <button 
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
            >
               <Save size={20} />
               {t('save_changes', 'Save Changes')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-gray-100">
         <h1 className="font-bold text-gray-900 text-xl">{t('profile', 'My Profile')}</h1>
         <button className="text-indigo-600">
            <Edit2 size={20} />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Profile Card */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center gap-4 text-center">
             <div className="w-24 h-24 bg-gray-200 rounded-full overflow-hidden border-4 border-indigo-50 relative">
                <img src={auth.currentUser?.photoURL || "https://i.pravatar.cc/150?u=b042581f4e29026704z"} alt="Driver" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
             </div>
             <div>
                <h2 className="font-bold text-gray-900 text-xl">{driver?.name || auth.currentUser?.displayName || 'Driver Account'}</h2>
                <p className="text-sm text-gray-500 mb-1">{driver?.phoneNumber || auth.currentUser?.email}</p>
                <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs font-bold mt-1">
                   {driver?.status === 'verified' ? (
                     <><ShieldCheck size={14} /> Verified Driver</>
                   ) : (
                     <><Clock size={14} /> Pending Verification</>
                   )}
                </div>
             </div>
         </div>

         {/* Stats mini */}
         <div className="flex gap-4">
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
               <p className="text-xs text-gray-500">Deliveries</p>
               <p className="font-bold text-gray-900 text-xl">{driver?.completedDeliveries || 0}</p>
            </div>
            <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
               <p className="text-xs text-gray-500">Rating</p>
               <p className="font-bold text-gray-900 text-xl">{driver?.rating || 'New'} <span className="text-yellow-400 text-sm">★</span></p>
            </div>
         </div>

         {/* Configuration */}
         <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Account Settings</h3>
            
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
               <div onClick={() => openMenu('vehicle_details')} className="p-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                         <Car size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Vehicle Details</p>
                         <p className="text-xs text-gray-500">{driver?.vehicleType ? `${driver.vehicleType} (${driver.vehiclePlate})` : 'Setup your vehicle'}</p>
                      </div>
                   </div>
               </div>
               
               <div onClick={() => openMenu('payout_methods')} className="p-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                         <CreditCard size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Payout Methods</p>
                         <p className="text-xs text-gray-500">{driver?.bankName ? driver.bankName : 'Manage bank accounts'}</p>
                      </div>
                   </div>
               </div>

               <div onClick={() => openMenu('driver_documents')} className="p-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                         <FileText size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Driver Documents</p>
                         <p className="text-xs text-gray-500">License, Insurance</p>
                      </div>
                   </div>
               </div>
               
               <div onClick={() => openMenu('working_hours')} className="p-4 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                         <Clock size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Working Hours</p>
                         <p className="text-xs text-gray-500">{driver?.workStartTime ? `${driver.workStartTime} - ${driver.workEndTime}` : 'Set your availability'}</p>
                      </div>
                   </div>
               </div>
            </div>

            <h3 className="font-bold text-gray-900 text-sm mt-6">Preferences & Support</h3>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
               <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center">
                         <Globe size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">{t('language', 'Language')}</p>
                      </div>
                   </div>
                   <select 
                      value={i18n.language} 
                      onChange={(e) => i18n.changeLanguage(e.target.value)}
                      className="bg-gray-100 text-gray-800 text-sm font-bold rounded-lg px-3 py-1 outline-none border border-gray-200"
                   >
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                   </select>
               </div>
               
               <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                         <Bell size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Notifications</p>
                         <p className="text-xs text-gray-500">Manage alerts and sounds</p>
                      </div>
                   </div>
               </div>
               
               <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
                         <Lock size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Privacy & Security</p>
                         <p className="text-xs text-gray-500">Password, 2FA</p>
                      </div>
                   </div>
               </div>

               <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                         <Headset size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Help Center</p>
                         <p className="text-xs text-gray-500">Contact support, FAQ</p>
                      </div>
                   </div>
               </div>
            </div>
         </div>

         <div className="pt-6 pb-20">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition"
            >
               <LogOut size={20} />
               {t('logout', 'Log Out')}
            </button>
         </div>
      </div>
    </div>
  );
}
