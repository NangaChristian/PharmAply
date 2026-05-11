import { useState, useEffect, ChangeEvent, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, auth, handleFirestoreError, OperationType } from "../../../lib/firebase";
import { Monitor, Save, Globe, Image as ImageIcon, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";

export function WebsiteSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  
  const heroInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    seoTitle: "",
    seoDescription: "",
    contactNumber: "",
    companyAddress: "",
    facebookUrl: "",
    instagramUrl: "",
    twitterUrl: "",
    heroImageUrl: "",
    promoBannerUrl: ""
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "website");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings({ ...settings, ...docSnap.data() });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "website"), settings, { merge: true });
      toast.success("Website settings saved successfully");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/website");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, field: 'heroImageUrl' | 'promoBannerUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    const storageRef = ref(storage, `profiles/${auth.currentUser?.uid || 'admin'}/${Date.now()}_${field}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      () => {}, 
      (error: any) => {
        console.error(error);
        if (error?.code === 'storage/quota-exceeded') {
           toast.error("Firebase Storage Quota Exceeded.");
        } else {
           toast.error("Upload failed");
        }
        setUploading(null);
      }, 
      async () => {
        try {
           const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
           setSettings(prev => ({ ...prev, [field]: downloadURL }));
           toast.success("Image uploaded, remember to save changes");
        } catch (error) {
           console.error(error);
           toast.error("Failed to get image URL");
        } finally {
           setUploading(null);
        }
      }
    );
  };

  if (loading) return <div className="p-8 text-slate-500">Loading settings...</div>;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1 flex items-center gap-2"><Monitor size={24} /> Website Settings</h1>
             <p className="text-gray-500 text-sm">Configure marketing website details, SEO, and contact info</p>
         </div>
         <button 
           onClick={handleSave}
           disabled={saving}
           className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
         >
           <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-8">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><ImageIcon size={18} /> Website Assets</h2>
            <div className="space-y-6">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Patient Homepage Hero Image</label>
                  <div className="w-full h-48 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center relative overflow-hidden group">
                     {settings.heroImageUrl ? (
                        <img src={settings.heroImageUrl} alt="Hero" className="w-full h-full object-cover" />
                     ) : (
                        <div className="text-center text-slate-500">
                           <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                           <span className="text-sm font-medium">No image uploaded</span>
                        </div>
                     )}
                     <div 
                        onClick={() => !uploading && heroInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                     >
                        <UploadCloud size={24} className={uploading === 'heroImageUrl' ? "animate-bounce" : ""} />
                        <span className="text-xs font-bold mt-2 uppercase">{uploading === 'heroImageUrl' ? "Uploading..." : "Change Image"}</span>
                     </div>
                     <input 
                        type="file" 
                        ref={heroInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'heroImageUrl')}
                        disabled={uploading !== null}
                     />
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Promotional Banner Image</label>
                  <div className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center relative overflow-hidden group">
                     {settings.promoBannerUrl ? (
                        <img src={settings.promoBannerUrl} alt="Banner" className="w-full h-full object-cover" />
                     ) : (
                        <div className="text-center text-slate-500">
                           <ImageIcon size={24} className="mx-auto mb-2 opacity-50" />
                           <span className="text-sm font-medium">No image uploaded</span>
                        </div>
                     )}
                     <div 
                        onClick={() => !uploading && bannerInputRef.current?.click()}
                        className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                     >
                        <UploadCloud size={24} className={uploading === 'promoBannerUrl' ? "animate-bounce" : ""} />
                        <span className="text-xs font-bold mt-2 uppercase">{uploading === 'promoBannerUrl' ? "Uploading..." : "Change Image"}</span>
                     </div>
                     <input 
                        type="file" 
                        ref={bannerInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'promoBannerUrl')}
                        disabled={uploading !== null}
                     />
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><Globe size={18} /> SEO & Meta Data</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Global SEO Title</label>
                  <input 
                    type="text" 
                    name="seoTitle"
                    value={settings.seoTitle}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Global SEO Description</label>
                  <textarea 
                    name="seoDescription"
                    value={settings.seoDescription}
                    onChange={handleChange}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
               </div>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Company Information</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone Number</label>
                  <input 
                    type="text" 
                    name="contactNumber"
                    value={settings.contactNumber}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company Physical Address</label>
                  <input 
                    type="text" 
                    name="companyAddress"
                    value={settings.companyAddress}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Social Links</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Facebook URL</label>
                  <input 
                    type="url" 
                    name="facebookUrl"
                    value={settings.facebookUrl}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Instagram URL</label>
                  <input 
                    type="url" 
                    name="instagramUrl"
                    value={settings.instagramUrl}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Twitter / X URL</label>
                  <input 
                    type="url" 
                    name="twitterUrl"
                    value={settings.twitterUrl}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
