import { useState, useEffect, ChangeEvent, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, handleFirestoreError, OperationType } from "../../../lib/firebase";
import { Palette, Save, Upload, X } from "lucide-react";
import toast from "react-hot-toast";

export function ThemeSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState({
    primaryColor: "#4f46e5",
    logoUrl: "",
    dashboardWelcomeText: "Welcome to our application",
    dashboardSubtitleText: "Here's what is happening today."
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "theme");
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
      await setDoc(doc(db, "settings", "theme"), settings, { merge: true });
      toast.success("Theme settings saved successfully");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, "settings/theme");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `settings/theme_logo_${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      const url = await new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed', 
          null, 
          (error: any) => reject(error), 
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          }
        );
      });
      
      setSettings(prev => ({ ...prev, logoUrl: url }));
      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Logo upload error", error);
      if (error?.code === 'storage/quota-exceeded') {
         toast.error("Firebase Storage Quota Exceeded. Using a placeholder.");
         setSettings(prev => ({ ...prev, logoUrl: `https://ui-avatars.com/api/?name=Logo&background=random` }));
      } else {
         toast.error("Failed to upload logo.");
      }
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading settings...</div>;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1 flex items-center gap-2"><Palette size={24} /> Theme & Visuals</h1>
             <p className="text-gray-500 text-sm">Configure app visuals and text for user dashboards</p>
         </div>
         <button 
           onClick={handleSave}
           disabled={saving || uploadingLogo}
           className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-50"
         >
           <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-3xl space-y-8">
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">User Dashboard Texts</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Welcome Text</label>
                  <input 
                    type="text" 
                    name="dashboardWelcomeText"
                    value={settings.dashboardWelcomeText}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subtitle Text</label>
                  <input 
                    type="text" 
                    name="dashboardSubtitleText"
                    value={settings.dashboardSubtitleText}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>
         </div>

         <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Colors & Branding</h2>
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary App Color (Hex)</label>
                  <div className="flex items-center gap-4">
                      <input 
                        type="color" 
                        name="primaryColor"
                        value={settings.primaryColor}
                        onChange={handleChange}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <input 
                        type="text" 
                        name="primaryColor"
                        value={settings.primaryColor}
                        onChange={handleChange}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase uppercase"
                      />
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">App Logo</label>
                  <div className="flex items-center gap-6">
                    {settings.logoUrl ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                        <img src={settings.logoUrl} alt="App Logo" className="w-full h-full object-contain" />
                        <button 
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, logoUrl: "" }))}
                          className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-gray-700 hover:text-red-600 transition shadow-sm backdrop-blur-sm"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                        <Upload size={20} className="mb-1" />
                        <span className="text-[10px] font-medium">No Logo</span>
                      </div>
                    )}
                    <div>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
                      >
                        {uploadingLogo ? "Uploading..." : "Upload Logo Image"}
                      </button>
                      <p className="mt-2 text-xs text-gray-500">Suggested size: 256x256px. PNG or SVG.</p>
                    </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
