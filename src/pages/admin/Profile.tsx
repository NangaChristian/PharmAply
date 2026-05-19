import { useState, useRef, ChangeEvent } from "react";
import { User, Shield, Key, UploadCloud } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { updateProfile } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';
import { auth, storage } from "../../lib/firebase";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

export function AdminProfile() {
    const { t } = useTranslation();
  const { user, role, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_avatar`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
         // optional: show progress
      }, 
      (error: any) => {
        console.error(error);
        if (error?.code === 'storage/quota-exceeded') {
           toast.error("Firebase Storage Quota Exceeded.");
        } else {
           toast.error("Upload failed");
        }
        setUploading(false);
      }, 
      async () => {
        try {
           const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
           await updateProfile(user, { photoURL: downloadURL });
           if (refreshUser) refreshUser();
           toast.success("Profile photo updated!");
        } catch (error) {
           console.error(error);
           toast.error("Failed to update profile photo");
        } finally {
           setUploading(false);
        }
      }
    );
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 text-2xl mb-1"> {t('profile_settings', 'Profile Settings')} </h1>
         <p className="text-gray-500 text-sm"> {t('manage_your_administrator_acco', 'Manage your administrator account')} </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-6">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex gap-6 items-start">
            <div className="relative group w-24 h-24 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
               {user?.photoURL ? (
                  <img src={user.photoURL} alt="Admin" className="w-full h-full object-cover" />
               ) : (
                  <User size={32} className="text-indigo-300" />
               )}
               <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
               >
                  <UploadCloud size={20} className={uploading ? "animate-bounce" : ""} />
                  <span className="text-[10px] font-bold mt-1 uppercase"> {t('upload', 'Upload')} </span>
               </div>
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleUpload}
                  disabled={uploading}
               />
            </div>
            <div>
               <h2 className="text-xl font-bold text-slate-900 mb-1">{user?.displayName || "Platform Admin"}</h2>
               <p className="text-sm text-slate-500 mb-3">{user?.email}</p>
               <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold uppercase">
                 <Shield size={12} /> {role || 'admin'}
               </span>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
               <Key size={18} className="text-slate-400" />  {t('password_security', 'Password & Security')} </h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
               <div>
                  <p className="font-bold text-slate-800 text-sm"> {t('update_password', 'Update Password')} </p>
                  <p className="text-xs text-slate-500 mt-1"> {t('ensure_your_account_uses_a_str', 'Ensure your account uses a strong, unique password.')} </p>
               </div>
               <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                  {t('change_password', 'Change Password')} </button>
            </div>
         </div>
      </div>
    </div>
  );
}
