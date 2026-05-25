import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, User, CreditCard, Heart, Settings, Shield, LogOut, FileText, Bell, Globe, Camera, Loader2, Clock, ChevronRight, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, storage, db } from "../../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';
import { updateProfile } from '../../lib/firebase';
import { doc, updateDoc, signOut } from '../../lib/firebase';
import { useDarkMode } from "../../components/DarkModeProvider";

export function PatientProfile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');

  const handleUpdateName = async () => {
     if(auth.currentUser && displayName.trim() !== '') {
        try {
           setUploading(true);
           await updateProfile(auth.currentUser, { displayName });
           await updateDoc(doc(db, "users", auth.currentUser.uid), { displayName });
           setIsEditing(false);
        } catch(e) {
           console.error(e);
        } finally {
           setUploading(false);
        }
     }
  };

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
        console.error("Profile upload error", err);
        alert(err.message || t('profile_upload_failed', 'Failed to upload profile picture.'));
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden transition-colors duration-200">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800 transition-colors duration-200">
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('profile', 'Profile')}</h1>
         <button onClick={() => navigate('/patient/settings')} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 transition">
            <Settings size={20} />
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Profile Card */}
         <div className="bg-white dark:bg-black dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 flex gap-4 items-center transition-colors">
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
                   onClick={() => fileInputRef.current?.click()}
                   disabled={uploading}
                   className="absolute bottom-0 right-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm disabled:opacity-50 hover:bg-indigo-700 transition"
                 >
                   {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
             </div>
             <div className="flex-1 flex justify-between items-start">
               <div>
                  {isEditing ? (
                     <div className="flex items-center gap-2 mb-1">
                        <input 
                           type="text" 
                           value={displayName} 
                           onChange={e => setDisplayName(e.target.value)}
                           className="bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-lg px-2 py-1 text-sm font-bold w-full max-w-[150px] outline-none border border-transparent focus:border-indigo-500"
                           autoFocus
                        />
                        <button onClick={handleUpdateName} disabled={uploading} className="bg-indigo-600 text-white rounded-lg px-2 py-1 text-xs font-bold hover:bg-indigo-700">Save</button>
                        <button onClick={() => { setIsEditing(false); setDisplayName(auth.currentUser?.displayName || ''); }} className="bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg px-2 py-1 text-xs font-bold hover:bg-gray-300 dark:hover:bg-zinc-600">Cancel</button>
                     </div>
                  ) : (
                     <div className="flex items-center gap-2">
                        <h2 className="font-bold text-gray-900 dark:text-white text-lg">{auth.currentUser?.displayName || t('user', 'User')}</h2>
                        <button onClick={() => setIsEditing(true)} className="text-gray-400 hover:text-indigo-600 transition p-1">
                           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                     </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-slate-400">{auth.currentUser?.email}</p>
               </div>
             </div>
         </div>

         {/* Menu List */}
         <div className="bg-white dark:bg-black dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-colors">
             
             <button onClick={() => navigate('/patient/profile/details')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                       <User size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">Profile & Credentials</span>
                 </div>
                 <span className="text-gray-400 dark:text-gray-500 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>

             <div className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-black dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                       <Globe size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('language', 'Language')}</span>
                 </div>
                 <select 
                    value={i18n.language} 
                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                    className="bg-gray-100 dark:bg-zinc-900 dark:bg-black text-gray-800 dark:text-slate-100 dark:text-slate-200 text-sm font-bold rounded-lg px-3 py-1 outline-none border border-gray-200 dark:border-zinc-800"
                 >
                    <option value="en"> {t('english', 'English')} </option>
                    <option value="fr"> {t('fran_ais', 'Français')} </option>
                    <option value="ar">العربية</option>
                 </select>
             </div>

             <button onClick={() => navigate('/patient/payment-methods')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                       <CreditCard size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('payment_methods', 'Payment Methods')}</span>
                 </div>
                 <span className="text-gray-400 dark:text-gray-500 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>
             
             <button onClick={() => navigate('/patient/prescriptions')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                       <FileText size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('my_prescriptions', 'My Prescriptions')}</span>
                 </div>
                 <span className="text-gray-400 dark:text-gray-500 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>

             <button onClick={() => navigate('/patient/calendar')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                       <Clock size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('medication_reminders', 'Medication Reminders')}</span>
                 </div>
                 <span className="text-gray-400 dark:text-gray-500 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>
             
             <button onClick={() => navigate('/patient/wishlist')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                       <Heart size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('wishlist', 'Wishlist & Saved')}</span>
                 </div>
                 <span className="text-gray-400 dark:text-gray-500 font-bold text-xs"><ChevronRight size={16} /></span>
             </button>

             <button onClick={() => navigate('/patient/notifications')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                       <Bell size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('notifications', 'Notifications')}</span>
                 </div>
                 <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
             </button>

             <button onClick={() => navigate('/patient/privacy')} className="w-full p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800 active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                       <Shield size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('privacy_security', 'Privacy & Security')}</span>
                 </div>
             </button>

             <div className="w-full p-4 flex items-center justify-between active:bg-gray-50 dark:bg-black dark:active:bg-slate-700">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 dark:text-slate-200 flex items-center justify-center">
                       <Moon size={16} />
                    </div>
                    <span className="font-bold text-sm text-gray-900 dark:text-white dark:text-slate-100">{t('dark_mode', 'Dark Mode')}</span>
                 </div>
                 <div className="flex items-center">
                   <button 
                     onClick={toggleDarkMode}
                     className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
                   >
                      <div className={`w-5 h-5 bg-white dark:bg-black rounded-full absolute top-0.5 transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                   </button>
                 </div>
             </div>
         </div>

         {/* Logout */}
         <div className="pt-4">
            <button 
              onClick={handleLogout}
              className="w-full bg-white dark:bg-black dark:bg-zinc-900 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
            >
               <LogOut size={20} /> {t('logout', 'Log Out')}
            </button>
         </div>
         
         <div className="h-24"></div>
      </div>
    </div>
  );
}
