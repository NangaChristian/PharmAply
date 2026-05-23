import React, { useEffect, useState } from "react";
import { doc, getDoc } from '../lib/firebase';
import { db } from "../lib/firebase";
import { AlertTriangle, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

const CURRENT_VERSION = "1.0.0";

// Basic semantic version comparison
function isVersionLower(current: string, required: string) {
  const curParts = current.split(".").map(Number);
  const reqParts = required.split(".").map(Number);
  
  for (let i = 0; i < 3; i++) {
    const c = curParts[i] || 0;
    const r = reqParts[i] || 0;
    if (c < r) return true;
    if (c > r) return false;
  }
  return false;
}

export function AppUpdater({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().appVersion) {
            const requiredVersion = docSnap.data().appVersion;
            if (isVersionLower(CURRENT_VERSION, requiredVersion)) {
                setNeedsUpdate(true);
            }
        }
      } catch (error) {
        console.error("Failed to check app version", error);
      } finally {
        setLoading(false);
      }
    };
    checkVersion();
  }, []);

  if (loading) {
     return <div className="min-h-screen w-full flex bg-[#F0F5F2] items-center justify-center"> {t('loading', 'Loading...')} </div>;
  }

  if (needsUpdate) {
     return (
       <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F0F5F2] p-6 text-center">
          <div className="bg-white dark:bg-zinc-950 p-8 rounded-3xl shadow-sm max-w-md w-full flex flex-col items-center">
             <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle size={32} />
             </div>
             <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2"> {t('update_required', 'Update Required')} </h1>
             <p className="text-gray-500 mb-8">
                {t('your_current_version_of_the_ap', 'Your current version of the app is outdated. Please update to the latest version to safely continue using PharmAply.')} </p>
             <button className="w-full bg-slate-900 text-white font-bold rounded-xl py-3.5 flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-sm">
                <Download size={20} />  {t('download_update', 'Download Update')} </button>
          </div>
       </div>
     );
  }

  return <>{children}</>;
}
