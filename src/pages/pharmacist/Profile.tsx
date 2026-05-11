import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Store, Clock, MapPin, LogOut, Globe, Camera, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { signOut, updateProfile } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";

export function PharmacistProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [pharmacy, setPharmacy] = useState<{id: string, name?: string, address?: string, ownerId?: string, rating?: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && auth.currentUser) {
      const file = e.target.files[0];
      setUploadingProfile(true);
      try {
        let url = "";
        try {
          const fileRef = ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, file);
          url = await getDownloadURL(uploadTask.ref);
        } catch (storageErr) {
          console.warn("Profile upload failed, mocked for prototype", storageErr);
          url = `https://i.pravatar.cc/150?u=${auth.currentUser.uid}`;
        }
        
        await updateProfile(auth.currentUser, { photoURL: url });
        await updateDoc(doc(db, "users", auth.currentUser.uid), { photoUrl: url });
      } catch (err: any) {
        console.error("Profile upload error", err);
        alert("Failed to upload profile picture.");
      } finally {
        setUploadingProfile(false);
      }
    }
  };

  useEffect(() => {
    const fetchPharmacy = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'pharmacies'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          const ph = { id: snapshot.docs[0].id, name: data.name, address: data.address, ownerId: data.ownerId, rating: data.rating };
          setPharmacy(ph);
          setName(ph.name || "");
          setAddress(ph.address || "");
        }
      } catch (error) {
        console.error("Failed to fetch pharmacy", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPharmacy();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      if (pharmacy) {
        await updateDoc(doc(db, 'pharmacies', pharmacy.id), {
          name,
          address
        });
        setPharmacy({ ...pharmacy, name, address });
      } else {
        const docRef = await addDoc(collection(db, 'pharmacies'), {
          name,
          address,
          ownerId: user.uid,
          rating: 5,
          createdAt: serverTimestamp()
        });
        setPharmacy({ id: docRef.id, name, address, ownerId: user.uid, rating: 5 });
      }
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, pharmacy ? OperationType.UPDATE : OperationType.CREATE, 'pharmacies');
    }
  };

  const handleLogout = async () => {
     await signOut(auth);
     navigate("/");
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-gray-100">
         <h1 className="font-bold text-gray-900 text-xl">Pharmacy Profile</h1>
         {!isEditing && (
             <button className="text-indigo-600" onClick={() => setIsEditing(true)}>
                <Edit2 size={20} />
             </button>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Personal Profile Card */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex gap-4 items-center">
             <div className="relative">
                 <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden">
                    <img src={auth.currentUser?.photoURL || "https://i.pravatar.cc/150?u=a042581f4e29026704d"} alt="Profile" className="w-full h-full object-cover" />
                 </div>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={uploadingProfile}
                   className="absolute bottom-0 right-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm disabled:opacity-50 hover:bg-indigo-700 transition"
                 >
                   {uploadingProfile ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
             </div>
             <div>
                <h2 className="font-bold text-gray-900 text-lg">{auth.currentUser?.displayName || 'Pharmacist User'}</h2>
                <p className="text-sm text-gray-500">{auth.currentUser?.email}</p>
             </div>
         </div>

         <div className="flex items-center justify-between">
           <h3 className="font-bold text-gray-900">Pharmacy Details</h3>
           {!isEditing && pharmacy && (
               <button className="text-indigo-600 text-sm font-bold flex items-center gap-1" onClick={() => setIsEditing(true)}>
                  <Edit2 size={14} /> Edit
               </button>
           )}
         </div>

         {loading ? (
             <p className="text-sm text-gray-500">Loading...</p>
         ) : isEditing ? (
             <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Pharmacy Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded text-sm" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Address</label>
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full border p-2 rounded text-sm" />
                 </div>
                 <div className="flex gap-2">
                     <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white rounded py-2 font-bold text-sm">Save</button>
                     <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-200 text-gray-800 rounded py-2 font-bold text-sm">Cancel</button>
                 </div>
             </div>
         ) : pharmacy ? (
             <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex gap-4 items-center">
                 <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                    <Store size={32} />
                 </div>
                 <div>
                    <h2 className="font-bold text-gray-900 text-lg">{pharmacy.name}</h2>
                    <p className="text-sm text-gray-500">{pharmacy.address}</p>
                    <div className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded text-xs font-bold mt-2">
                       <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div> Online
                    </div>
                 </div>
             </div>
         ) : (
             <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 text-center">
                 <h2 className="font-bold text-orange-900 mb-2">No Pharmacy Profile</h2>
                 <p className="text-sm text-orange-700 mb-4">Please set up your pharmacy profile to start receiving orders and adding inventory.</p>
                 <button onClick={() => setIsEditing(true)} className="bg-orange-600 text-white font-bold py-2 px-4 rounded text-sm">Setup Now</button>
             </div>
         )}

         {/* Configuration */}
         <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Settings & Configuration</h3>
            
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
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
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                         <Clock size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Working Hours</p>
                         <p className="text-xs text-gray-500">08:00 AM - 10:00 PM</p>
                      </div>
                   </div>
               </div>
               
               <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                         <MapPin size={20} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 text-sm">Service Zones & Delivery</p>
                         <p className="text-xs text-gray-500">3 zones configured</p>
                      </div>
                   </div>
               </div>
            </div>
         </div>

         <div className="pt-6 pb-20 border-t border-gray-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition"
            >
               <LogOut size={20} />
               Logout
            </button>
         </div>
      </div>
    </div>
  );
}
