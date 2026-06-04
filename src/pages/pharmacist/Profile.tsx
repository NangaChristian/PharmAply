import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Store, Clock, MapPin, LogOut, Globe, Camera, Loader2, Phone, Image as ImageIcon, Crosshair, Check, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from '../../lib/firebase';
import { db, auth, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { signOut, updateProfile } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";

interface PharmacyData {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
  photoUrl?: string;
  coverUrl?: string;
  workingHours?: string;
  serviceZones?: string;
  latitude?: number;
  longitude?: number;
  ownerId?: string;
  rating?: number;
}

export function PharmacistProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [pharmacy, setPharmacy] = useState<PharmacyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PharmacyData>({});
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPharmacy = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'pharmacies'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          const ph = { id: docSnap.id, ...data };
          setPharmacy(ph);
        }
      } catch (error) {
        console.error("Failed to fetch pharmacy", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPharmacy();
  }, [user]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'logo' | 'cover') => {
    if (e.target.files && e.target.files[0] && auth.currentUser) {
      const file = e.target.files[0];
      
      if (type === 'profile') setUploadingProfile(true);
      if (type === 'logo') setUploadingLogo(true);
      if (type === 'cover') setUploadingCover(true);

      try {
        let url = "";
        try {
          const fileRef = ref(storage, `${type}s/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, file);
          url = await getDownloadURL(uploadTask.ref);
        } catch (storageErr) {
          console.error("Upload failed", storageErr);
          throw storageErr;
        }
        
        if (type === 'profile') {
          await updateProfile(auth.currentUser, { photoURL: url });
          await updateDoc(doc(db, "users", auth.currentUser.uid), { photoUrl: url });
        } else if (type === 'logo') {
          setFormData({ ...formData, photoUrl: url });
          if (pharmacy?.id) await updateDoc(doc(db, "pharmacies", pharmacy.id), { photoUrl: url });
        } else if (type === 'cover') {
          setFormData({ ...formData, coverUrl: url });
          if (pharmacy?.id) await updateDoc(doc(db, "pharmacies", pharmacy.id), { coverUrl: url });
        }
      } catch (err: any) {
        console.error(`${type} upload error`, err);
        alert(`Failed to upload ${type} picture.`);
      } finally {
        if (type === 'profile') setUploadingProfile(false);
        if (type === 'logo') setUploadingLogo(false);
        if (type === 'cover') setUploadingCover(false);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      if (pharmacy?.id) {
        await updateDoc(doc(db, 'pharmacies', pharmacy.id), formData);
        setPharmacy({ ...pharmacy, ...formData });
      } else {
        const payload = {
          ...formData,
          ownerId: user.uid,
          rating: 5,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'pharmacies'), payload);
        setPharmacy({ id: docRef.id, ...payload });
      }
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, pharmacy ? OperationType.UPDATE : OperationType.CREATE, 'pharmacies');
    }
  };

  const startEdit = () => {
    setFormData(pharmacy || { 
      name: '', address: '', phone: '', workingHours: '', 
      serviceZones: '', latitude: 0, longitude: 0 
    });
    setIsEditing(true);
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get your location.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleLogout = async () => {
     await signOut(auth);
     navigate("/");
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800">
         <h1 className="font-bold text-gray-900 dark:text-white text-xl"> {t('pharmacy_profile', 'Pharmacy Profile')} </h1>
         {!isEditing && (
             <button className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-full transition" onClick={startEdit}>
                <Edit2 size={20} />
             </button>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Personal Profile Card */}
         <div className="bg-white dark:bg-black rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 flex gap-4 items-center">
             <div className="relative">
                 <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden">
                    {auth.currentUser?.photoURL ? (
                       <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400">
                          <User size={32} />
                       </div>
                    )}
                 </div>
                 <button 
                   onClick={() => profileInputRef.current?.click()}
                   disabled={uploadingProfile}
                   className="absolute bottom-0 right-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-indigo-700 transition"
                 >
                   {uploadingProfile ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                 </button>
                 <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'profile')} />
             </div>
             <div>
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">{auth.currentUser?.displayName || 'Pharmacist User'}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{auth.currentUser?.email}</p>
             </div>
         </div>

         {loading ? (
             <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 animate-pulse text-center py-10"> {t('loading_pharmacy_details', 'Loading pharmacy details...')} </p>
         ) : isEditing ? (
             <div className="bg-white dark:bg-black rounded-2xl p-6 md:p-8 border border-gray-100 dark:border-zinc-800 shadow-sm space-y-8">
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white"> {t('edit_pharmacy_settings', 'Edit Pharmacy Settings')} </h3>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div className="space-y-6">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2"> {t('pharmacy_name', 'Pharmacy Name')} </label>
                          <div className="relative">
                            <Store size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors" placeholder={t('e_g_city_pharmacy', 'e.g. City Pharmacy')} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2"> {t('address', 'Address')} </label>
                          <div className="relative">
                            <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors" placeholder={t('e_g_123_main_st_city', 'e.g. 123 Main St, City')} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2"> {t('phone_number', 'Phone Number')} </label>
                          <div className="relative">
                            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors" placeholder={t('e_g_1_555_123_4567', 'e.g. +1 555 123 4567')} />
                          </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2"> {t('working_hours', 'Working Hours')} </label>
                          <div className="relative">
                            <Clock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input type="text" value={formData.workingHours || ''} onChange={e => setFormData({...formData, workingHours: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors" placeholder={t('e_g_mon_fri_8am_9pm', 'e.g. Mon-Fri: 8AM-9PM')} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2"> {t('service_zones_delivery', 'Service Zones & Delivery')} </label>
                          <div className="relative">
                            <Globe size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input type="text" value={formData.serviceZones || ''} onChange={e => setFormData({...formData, serviceZones: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-colors" placeholder={t('e_g_downtown_uptown_5_km', 'e.g. Downtown, Uptown (+5 km)')} />
                          </div>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-black p-5 rounded-2xl border border-slate-100 dark:border-zinc-800">
                         <label className="block text-sm font-bold text-slate-700 mb-3">Geolocation (GPS)</label>
                         <div className="flex gap-3 mb-3">
                           <input type="number" value={formData.latitude || ''} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} placeholder={t('latitude', 'Latitude')} className="w-1/2 px-3 py-2.5 border border-gray-200 dark:border-zinc-800 outline-none focus:border-indigo-500 rounded-xl text-sm bg-white dark:bg-black transition-colors" />
                           <input type="number" value={formData.longitude || ''} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} placeholder={t('longitude', 'Longitude')} className="w-1/2 px-3 py-2.5 border border-gray-200 dark:border-zinc-800 outline-none focus:border-indigo-500 rounded-xl text-sm bg-white dark:bg-black transition-colors" />
                         </div>
                         <button onClick={getLocation} type="button" className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors">
                           <Crosshair size={16} />  {t('auto_detect_location', 'Auto-detect location')} </button>
                      </div>
                    </div>
                 </div>

                 <div className="border-t border-gray-100 dark:border-zinc-800 pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3"> {t('pharmacy_logo', 'Pharmacy Logo')} </label>
                        <div className="flex items-center gap-5">
                           <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 dark:bg-black flex items-center justify-center border border-gray-200 dark:border-zinc-800 shadow-sm">
                              {formData.photoUrl ? <img src={formData.photoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Store size={28} className="text-gray-400 dark:text-gray-500" />}
                           </div>
                           <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'logo')} />
                           <button onClick={() => logoInputRef.current?.click()} type="button" className="bg-gray-100 dark:bg-zinc-900 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-200 flex items-center gap-2 transition-colors">
                              {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} 
                               {t('change_logo', 'Change Logo')} </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3"> {t('cover_image', 'Cover Image')} </label>
                        <div className="w-full h-24 rounded-2xl overflow-hidden bg-gray-50 dark:bg-black flex items-center justify-center border border-gray-200 dark:border-zinc-800 relative shadow-sm">
                           {formData.coverUrl ? <img src={formData.coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <ImageIcon size={28} className="text-gray-400 dark:text-gray-500" />}
                           <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm" onClick={() => coverInputRef.current?.click()}>
                              <span className="text-white text-sm font-bold flex items-center gap-2">
                                {uploadingCover ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} 
                                 {t('upload_cover', 'Upload Cover')} </span>
                           </div>
                        </div>
                        <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'cover')} />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-zinc-800 mt-6">
                     <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3.5 font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-2">
                       <Check size={20} />  {t('save_settings', 'Save Settings')} </button>
                     <button onClick={() => { setIsEditing(false); setFormData({}); }} className="flex-1 bg-gray-100 dark:bg-zinc-900 hover:bg-gray-200 text-gray-800 dark:text-slate-100 rounded-xl py-3.5 font-bold text-base transition-colors">
                        {t('cancel', 'Cancel')} </button>
                 </div>
             </div>
         ) : pharmacy ? (
             <div className="space-y-6">
                 {/* Cover & Brand Info */}
                 <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden relative">
                    <div className="h-32 bg-indigo-100 w-full relative">
                        {pharmacy.coverUrl ? (
                           <img src={pharmacy.coverUrl} className="w-full h-full object-cover" alt="Cover" />
                        ) : (
                           <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-80" />
                        )}
                        <button className="absolute top-4 right-4 bg-white dark:bg-black/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-white dark:bg-black/30 transition" onClick={startEdit}>
                           <Edit2 size={16} />
                        </button>
                    </div>
                    
                    <div className="px-6 pb-6 pt-16 relative">
                       <div className="absolute -top-12 left-6 w-24 h-24 bg-white dark:bg-black rounded-2xl shadow-md border-4 border-white flex items-center justify-center overflow-hidden">
                           {pharmacy.photoUrl ? (
                              <img src={pharmacy.photoUrl} className="w-full h-full object-cover" alt="Logo" />
                           ) : (
                              <Store size={40} className="text-indigo-600" />
                           )}
                       </div>
                       
                       <div className="flex justify-between items-start">
                          <div>
                             <h2 className="font-bold text-gray-900 dark:text-white text-2xl">{pharmacy.name}</h2>
                             <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                                <MapPin size={14} className="mr-1" /> {pharmacy.address || 'Address not set'}
                             </div>
                          </div>
                          <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>  {t('active', 'Active')} </div>
                       </div>
                    </div>
                 </div>

                 {/* Details Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-white dark:bg-black p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                           <Phone size={18} />
                           <h3 className="font-bold text-gray-900 dark:text-white"> {t('contact', 'Contact')} </h3>
                        </div>
                        <p className="text-gray-600 text-sm">{pharmacy.phone || 'Phone not set'}</p>
                     </div>
                     <div className="bg-white dark:bg-black p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                           <Clock size={18} />
                           <h3 className="font-bold text-gray-900 dark:text-white"> {t('working_hours', 'Working Hours')} </h3>
                        </div>
                        <p className="text-gray-600 text-sm">{pharmacy.workingHours || 'Not configured'}</p>
                     </div>
                     <div className="bg-white dark:bg-black p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                           <Globe size={18} />
                           <h3 className="font-bold text-gray-900 dark:text-white"> {t('service_zones', 'Service Zones')} </h3>
                        </div>
                        <p className="text-gray-600 text-sm">{pharmacy.serviceZones || 'Not configured'}</p>
                     </div>
                 </div>

                 {/* Settings List */}
                 <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm ml-1"> {t('app_settings', 'App Settings')} </h3>
                    <div className="bg-white dark:bg-black rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-50">
                        <div 
                            onClick={() => navigate('/pharmacist/support')}
                            className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-900 transition rounded-t-2xl cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                               </div>
                               <div>
                                  <p className="font-bold text-gray-900 dark:text-white text-sm">{t('admin_support_chat', 'Support Chat with Admin')}</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('chat_with_admins_desc', 'Resolve issues directly with our team')}</p>
                               </div>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {t('chat_now', 'Chat Now')} &rarr;
                            </span>
                        </div>
                       <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:bg-black transition rounded-2xl">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-50 dark:bg-black text-slate-600 rounded-xl flex items-center justify-center">
                                 <Globe size={20} />
                              </div>
                              <div>
                                 <p className="font-bold text-gray-900 dark:text-white text-sm">{t('language', 'Language')}</p>
                              </div>
                           </div>
                           <select 
                              value={i18n.language} 
                              onChange={(e) => i18n.changeLanguage(e.target.value)}
                              className="bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-slate-100 text-sm font-bold rounded-lg px-3 py-1.5 outline-none border border-gray-200 dark:border-zinc-800 cursor-pointer"
                           >
                              <option value="en"> {t('english', 'English')} </option>
                              <option value="fr"> {t('fran_ais', 'Français')} </option>
                              <option value="ar">العربية</option>
                           </select>
                       </div>
                    </div>
                 </div>
             </div>
         ) : (
             <div className="bg-indigo-50/50 rounded-3xl p-8 border border-indigo-100 text-center flex flex-col items-center justify-center min-h-[300px]">
                 <div className="w-20 h-20 bg-white dark:bg-black rounded-full flex items-center justify-center shadow-sm mb-4">
                    <Store size={36} className="text-indigo-400" />
                 </div>
                 <h2 className="font-bold text-indigo-950 text-xl mb-2"> {t('create_your_pharmacy_profile', 'Create Your Pharmacy Profile')} </h2>
                 <p className="text-sm text-indigo-700/80 mb-6 max-w-sm">
                     {t('set_up_your_pharmacy_details_w', 'Set up your pharmacy details, working hours, and location to start receiving orders from patients in your area.')} </p>
                 <button onClick={startEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl text-sm shadow-sm transition">
                     {t('complete_setup_now', 'Complete Setup Now')} </button>
             </div>
         )}

         <div className="pt-6 pb-20 border-t border-gray-100 dark:border-zinc-800 mt-6">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition shadow-sm"
            >
               <LogOut size={20} />
                {t('sign_out_securely', 'Sign Out Securely')} </button>
         </div>
      </div>
    </div>
  );
}

