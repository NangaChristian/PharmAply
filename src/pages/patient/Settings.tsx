import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Lock, Eye, Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDarkMode } from '../../components/DarkModeProvider';
import { doc, getDoc, updateDoc } from '../../lib/firebase';
import { auth, db } from '../../lib/firebase';

export function PatientSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    emailAlerts: true,
    smsAlerts: false,
    profileVisibility: 'public',
  });

  useEffect(() => {
     // Load settings
     const fetchSettings = async () => {
        if(auth.currentUser) {
           try {
              const d = await getDoc(doc(db, "users", auth.currentUser.uid));
              if(d.exists() && d.data().settings) {
                 setSettings(d.data().settings);
              }
           } catch(e) {}
        }
        setInitialLoading(false);
     };
     fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      if (auth.currentUser) {
         await updateDoc(doc(db, "users", auth.currentUser.uid), {
             settings
         });
      }
      setTimeout(() => {
         setSuccess(true);
         setTimeout(() => setSuccess(false), 2000);
      }, 500);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-black flex flex-col h-full overflow-hidden transition-colors duration-200">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-zinc-900 shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800 transition-colors duration-200">
         <button onClick={() => navigate(-1)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-slate-200 transition">
            <ArrowLeft size={20} />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('settings', 'Settings')}</h1>
         <div className="w-5"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
               <h3 className="font-bold text-sm text-gray-800 dark:text-slate-100 flex items-center gap-2">
                 <Bell size={16} className="text-indigo-500" /> {t('notifications', 'Notifications')}
               </h3>
             </div>
             
             <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800">
                <div>
                   <p className="font-bold text-sm text-gray-900 dark:text-white">Push Notifications</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400">Receive alerts on your device</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, notificationsEnabled: !s.notificationsEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                   <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
             </div>
             
             <div className="p-4 flex items-center justify-between border-b border-gray-50 dark:border-zinc-800">
                <div>
                   <p className="font-bold text-sm text-gray-900 dark:text-white">Email Alerts</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400">Order updates to your inbox</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, emailAlerts: !s.emailAlerts }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.emailAlerts ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                   <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.emailAlerts ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
             </div>
             
             <div className="p-4 flex items-center justify-between">
                <div>
                   <p className="font-bold text-sm text-gray-900 dark:text-white">SMS Alerts</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400">Text messages for deliveries</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, smsAlerts: !s.smsAlerts }))}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.smsAlerts ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                   <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.smsAlerts ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
             </div>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
               <h3 className="font-bold text-sm text-gray-800 dark:text-slate-100 flex items-center gap-2">
                 <Eye size={16} className="text-indigo-500" /> {t('privacy', 'Privacy')}
               </h3>
             </div>
             
             <div className="p-4 border-b border-gray-50 dark:border-zinc-800">
                <p className="font-bold text-sm text-gray-900 dark:text-white mb-3">Profile Visibility</p>
                <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button 
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${settings.profileVisibility === 'public' ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    onClick={() => setSettings(s => ({ ...s, profileVisibility: 'public'}))}
                  >
                    Public
                  </button>
                  <button 
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${settings.profileVisibility === 'private' ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    onClick={() => setSettings(s => ({ ...s, profileVisibility: 'private'}))}
                  >
                    Private
                  </button>
                </div>
             </div>
          </div>
          
      </div>
      
      <div className="p-6 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 z-10 shrink-0">
         <button onClick={handleSave} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 
             success ? <><Check size={20} /> {t('saved', 'Saved!')}</> : t('save_changes', 'Save Changes')}
         </button>
      </div>
    </div>
  );
}
