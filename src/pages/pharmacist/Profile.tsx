import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Store, Clock, MapPin, LogOut, Globe, Camera, Loader2, Phone, Image as ImageIcon, Crosshair, Check, User, Search } from "lucide-react";
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
    <div className="flex-1 bg-transparent flex flex-col relative h-full overflow-hidden">
      {/* Top Navigation Area Header */}
      <div className="px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex-1 flex items-center">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                   type="text" 
                   placeholder="Search Settings" 
                   className="w-full bg-[#FAFBFA] dark:bg-slate-800 border border-transparent focus:border-gray-200 py-3 pl-12 pr-4 rounded-full text-sm outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
             </div>
          </div>
          
          {!isEditing && (
             <button onClick={startEdit} className="bg-[#0B3B3C] hover:bg-[#082a2b] text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-md transition-colors">
               <Edit2 size={16} />
               <span>Edit Profile</span>
             </button>
          )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar space-y-8">
         <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
               Pharmacy Profile
            </h1>
         </div>

         {/* Personal Profile Card */}
         <div className="bg-[#FAFBFC] dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex gap-4 items-center">
             <div className="relative">
                 <div className="w-16 h-16 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-full overflow-hidden shadow-sm">
                    {auth.currentUser?.photoURL ? (
                       <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <User size={32} />
                       </div>
                    )}
                 </div>
                 <button 
                   onClick={() => profileInputRef.current?.click()}
                   disabled={uploadingProfile}
                   className="absolute bottom-0 right-0 w-6 h-6 bg-[#0B3B3C] text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm transition"
                 >
                   {uploadingProfile ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                 </button>
                 <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'profile')} />
             </div>
             <div>
                <h2 className="font-bold text-gray-900 dark:text-white text-lg">{auth.currentUser?.displayName || 'Pharmacist User'}</h2>
                <p className="text-sm text-gray-500 font-medium">{auth.currentUser?.email}</p>
             </div>
         </div>

         {loading ? (
             <p className="text-sm text-gray-500 animate-pulse text-center py-10"> Loading pharmacy details... </p>
         ) : isEditing ? (
             <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-slate-700 shadow-sm space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div className="space-y-6">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"> Pharmacy Name </label>
                          <div className="relative">
                            <Store size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-[#FAFBFA] dark:bg-slate-900 border border-transparent focus:border-gray-200 rounded-xl text-sm outline-none transition-colors" placeholder="e.g. City Pharmacy" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"> Address </label>
                          <div className="relative">
                            <MapPin size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-[#FAFBFA] dark:bg-slate-900 border border-transparent focus:border-gray-200 rounded-xl text-sm outline-none transition-colors" placeholder="e.g. 123 Main St, City" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"> Phone Number </label>
                          <div className="relative">
                            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-[#FAFBFA] dark:bg-slate-900 border border-transparent focus:border-gray-200 rounded-xl text-sm outline-none transition-colors" placeholder="e.g. +1 555 123 4567" />
                          </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"> Working Hours </label>
                          <div className="relative">
                            <Clock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={formData.workingHours || ''} onChange={e => setFormData({...formData, workingHours: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-[#FAFBFA] dark:bg-slate-900 border border-transparent focus:border-gray-200 rounded-xl text-sm outline-none transition-colors" placeholder="e.g. Mon-Fri: 8AM-9PM" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2"> Service Zones & Delivery </label>
                          <div className="relative">
                            <Globe size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={formData.serviceZones || ''} onChange={e => setFormData({...formData, serviceZones: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-[#FAFBFA] dark:bg-slate-900 border border-transparent focus:border-gray-200 rounded-xl text-sm outline-none transition-colors" placeholder="e.g. Downtown, Uptown (+5 km)" />
                          </div>
                      </div>
                      
                      <div className="bg-[#FAFBFC] dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-700">
                         <label className="block text-sm font-bold text-slate-700 dark:text-gray-300 mb-3">Geolocation (GPS)</label>
                         <div className="flex gap-3 mb-3">
                           <input type="number" value={formData.latitude || ''} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} placeholder="Latitude" className="w-1/2 px-3 py-2.5 border border-transparent bg-white dark:bg-slate-800 outline-none rounded-xl text-sm shadow-sm" />
                           <input type="number" value={formData.longitude || ''} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} placeholder="Longitude" className="w-1/2 px-3 py-2.5 border border-transparent bg-white dark:bg-slate-800 outline-none rounded-xl text-sm shadow-sm" />
                         </div>
                         <button onClick={getLocation} type="button" className="w-full bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-slate-700 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors shadow-sm">
                           <Crosshair size={16} /> Auto-detect location </button>
                      </div>
                    </div>
                 </div>

                 <div className="border-t border-gray-100 dark:border-slate-700 pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3"> Pharmacy Logo </label>
                        <div className="flex items-center gap-5">
                           <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FAFBFC] dark:bg-slate-900 flex items-center justify-center border border-gray-100 dark:border-slate-700 shadow-sm">
                              {formData.photoUrl ? <img src={formData.photoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Store size={28} className="text-gray-400" />}
                           </div>
                           <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'logo')} />
                           <button onClick={() => logoInputRef.current?.click()} type="button" className="bg-[#FAFBFC] dark:bg-slate-900 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-2">
                              {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} 
                               Change Logo </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3"> Cover Image </label>
                        <div className="w-full h-24 rounded-2xl overflow-hidden bg-[#FAFBFC] dark:bg-slate-900 flex items-center justify-center border border-gray-100 dark:border-slate-700 relative shadow-sm">
                           {formData.coverUrl ? <img src={formData.coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <ImageIcon size={28} className="text-gray-400" />}
                           <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm" onClick={() => coverInputRef.current?.click()}>
                              <span className="text-white text-sm font-bold flex items-center gap-2">
                                {uploadingCover ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} 
                                 Upload Cover </span>
                           </div>
                        </div>
                        <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={e => handleImageChange(e, 'cover')} />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-slate-700 mt-6">
                     <button onClick={handleSave} className="flex-1 bg-[#0B3B3C] text-white rounded-xl py-3.5 font-bold text-base shadow-sm hover:bg-[#082a2b] transition-colors flex items-center justify-center gap-2">
                       <Check size={20} /> Save Settings </button>
                     <button onClick={() => { setIsEditing(false); setFormData({}); }} className="flex-1 bg-white border border-gray-100 dark:bg-slate-800 dark:border-slate-700 text-gray-800 dark:text-gray-300 rounded-xl py-3.5 font-bold text-base shadow-sm">
                        Cancel </button>
                 </div>
             </div>
         ) : pharmacy ? (
             <div className="space-y-6">
                 {/* Cover & Brand Info */}
                 <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden relative">
                    <div className="h-32 bg-[#A2E2D5] w-full relative">
                        {pharmacy.coverUrl ? (
                           <img src={pharmacy.coverUrl} className="w-full h-full object-cover" alt="Cover" />
                        ) : (
                           <div className="w-full h-full bg-[#E2EBE9] opacity-80" />
                        )}
                        <button className="absolute top-4 right-4 bg-white/50 backdrop-blur-md text-[#0B3B3C] p-2 rounded-full hover:bg-white shadow-sm transition" onClick={startEdit}>
                           <Edit2 size={16} />
                        </button>
                    </div>
                    
                    <div className="px-6 pb-6 pt-16 relative">
                       <div className="absolute -top-12 left-6 w-24 h-24 bg-white dark:bg-slate-900 rounded-2xl shadow-md border-4 border-white dark:border-slate-800 flex items-center justify-center overflow-hidden">
                           {pharmacy.photoUrl ? (
                              <img src={pharmacy.photoUrl} className="w-full h-full object-cover" alt="Logo" />
                           ) : (
                              <Store size={40} className="text-[#0B3B3C] dark:text-gray-400" />
                           )}
                       </div>
                       
                       <div className="flex justify-between items-start">
                          <div>
                             <h2 className="font-bold text-gray-900 dark:text-white text-2xl">{pharmacy.name}</h2>
                             <div className="flex items-center text-sm text-gray-500 font-medium mt-1">
                                <MapPin size={14} className="mr-1" /> {pharmacy.address || 'Address not set'}
                             </div>
                          </div>
                          <div className="inline-flex items-center gap-1.5 bg-[#D3F5A8]/50 text-[#0B3B3C] px-4 py-1.5 rounded-full text-xs font-bold border border-[#D3F5A8]">
                             <div className="w-2 h-2 bg-[#0B3B3C] rounded-full animate-pulse"></div> Active </div>
                       </div>
                    </div>
                 </div>

                 {/* Details Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="bg-[#FAFBFC] dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2 text-[#0B3B3C] dark:text-gray-300 mb-2">
                           <Phone size={18} />
                           <h3 className="font-bold text-gray-900 dark:text-white"> Contact </h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{pharmacy.phone || 'Phone not set'}</p>
                     </div>
                     <div className="bg-[#FAFBFC] dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2 text-[#0B3B3C] dark:text-gray-300 mb-2">
                           <Clock size={18} />
                           <h3 className="font-bold text-gray-900 dark:text-white"> Working Hours </h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{pharmacy.workingHours || 'Not configured'}</p>
                     </div>
                     <div className="bg-[#FAFBFC] dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-2 text-[#0B3B3C] dark:text-gray-300 mb-2">
                           <Globe size={18} />
                           <h3 className="font-bold text-gray-900 dark:text-white"> Service Zones </h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{pharmacy.serviceZones || 'Not configured'}</p>
                     </div>
                 </div>

                 {/* Settings List */}
                 <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm ml-1"> App Settings </h3>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm divide-y divide-gray-50 dark:divide-slate-700">
                        <div 
                            onClick={() => navigate('/pharmacist/support')}
                            className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition rounded-t-3xl cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-[#FFB8BA] text-[#0B3B3C] rounded-xl flex items-center justify-center shadow-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                               </div>
                               <div>
                                  <p className="font-bold text-gray-900 dark:text-white text-sm">Support Chat with Admin</p>
                                  <p className="text-xs text-gray-500 font-medium mt-0.5">Resolve issues directly with our team</p>
                               </div>
                            </div>
                            <span className="text-xs font-bold text-[#0B3B3C] dark:text-gray-300">
                                Chat Now &rarr;
                            </span>
                        </div>
                    </div>
                 </div>
             </div>
         ) : (
             <div className="bg-[#E2EBE9] dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700 text-center flex flex-col items-center justify-center min-h-[300px]">
                 <div className="w-20 h-20 bg-white dark:bg-slate-900 border border-[#0B3B3C]/10 rounded-full flex items-center justify-center shadow-sm mb-4">
                    <Store size={36} className="text-[#0B3B3C] dark:text-gray-300" />
                 </div>
                 <h2 className="font-bold text-[#0B3B3C] dark:text-white text-xl mb-2"> Create Your Pharmacy Profile </h2>
                 <p className="text-sm text-[#0B3B3C]/80 dark:text-gray-400 font-medium mb-6 max-w-sm">
                     Set up your pharmacy details, working hours, and location to start receiving orders from patients in your area. </p>
                 <button onClick={startEdit} className="bg-[#0B3B3C] hover:bg-[#082a2b] text-white font-bold py-3 px-8 rounded-full text-sm shadow-md transition">
                     Complete Setup Now </button>
             </div>
         )}

         <div className="pt-6 pb-20 mt-6">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold shadow-sm transition"
            >
               <LogOut size={20} />
                Sign Out Securely </button>
         </div>
      </div>
    </div>
  );
}

