import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, User, CreditCard, Heart, Settings, Shield, LogOut, FileText, Bell, Globe, Camera, Loader2, Clock, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, storage, db } from "../../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

export function PatientProfile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && auth.currentUser) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        const fileRef = ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(fileRef, file);
        const url = await getDownloadURL(uploadTask.ref);
        
        await updateProfile(auth.currentUser, { photoURL: url });
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoUrl: url });
      } catch (err: any) {
        console.warn("Profile upload error", err);
        if (err?.code === 'storage/quota-exceeded') {
          alert("Storage Quota Exceeded. Using a placeholder image for now.");
          const url = `https://i.pravatar.cc/150?u=${auth.currentUser.uid}`;
          await updateProfile(auth.currentUser, { photoURL: url });
          await updateDoc(doc(db, "users", auth.currentUser.uid), { photoUrl: url });
        } else {
          alert(t('profile_upload_failed', 'Failed to upload profile picture.'));
        }
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-gray-100">
         <h1 className="font-bold text-gray-900 text-xl">{t('profile', 'Profile')}</h1>
         <button className="text-gray-400 hover:text-gray-600 transition">
            <Settings size={20} />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Profile Card */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex gap-4 items-center">
             <div className="relative">
                 <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden">
                    <img src={auth.currentUser?.photoURL || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} alt="Profile" className="w-full h-full object-cover" />
                 </div>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={uploading}
                   className="absolute bottom-0 right-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm disabled:opacity-50 hover:bg-indigo-700 transition"
                 >
                   {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
             </div>
             <div>
                <h2 className="font-bold text-gray-900 text-lg">{auth.currentUser?.displayName || t('user', 'User')}</h2>
                <p className="text-sm text-gray-500">{auth.currentUser?.email}</p>
             </div>
         </div>

         {/* Menu List */}
         <div className="bg-white rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
             
             <div className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
                       <Globe size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('language', 'Language')}</span>
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

             <button onClick={() => navigate('/patient/payment-methods')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                       <CreditCard size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('payment_methods', 'Payment Methods')}</span>
                 </div>
                 <span className="text-gray-400 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>
             
             <button onClick={() => navigate('/patient/prescriptions')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                       <FileText size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('my_prescriptions', 'My Prescriptions')}</span>
                 </div>
                 <span className="text-gray-400 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>

             <button onClick={() => navigate('/patient/calendar')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                       <Clock size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('medication_reminders', 'Medication Reminders')}</span>
                 </div>
                 <span className="text-gray-400 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>
             
             <button onClick={() => navigate('/patient/wishlist')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center">
                       <Heart size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('wishlist', 'Wishlist & Saved')}</span>
                 </div>
                 <span className="text-gray-400 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>

             <button onClick={() => navigate('/patient/notifications')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                       <Bell size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('notifications', 'Notifications')}</span>
                 </div>
                 <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
             </button>

             <button onClick={() => navigate('/patient/privacy')} className="w-full p-4 flex items-center justify-between active:bg-gray-50">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                       <Shield size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900">{t('privacy_security', 'Privacy & Security')}</span>
                 </div>
             </button>
         </div>

         {/* Logout */}
         <div className="pt-4">
            <button 
              onClick={handleLogout}
              className="w-full bg-white border border-red-100 text-red-600 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 transition"
            >
               <LogOut size={20} /> {t('logout', 'Log Out')}
            </button>
         </div>
         
         <div className="h-24"></div>
      </div>
    </div>
  );
}
