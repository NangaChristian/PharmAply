import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc } from '../../lib/firebase';
import { auth, db } from '../../lib/firebase';
import toast from 'react-hot-toast';

export function PatientSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableError, setTableError] = useState(false);
  
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    emailAlerts: true,
    smsAlerts: false,
    profileVisibility: 'Private', // Match image: 'Private' is active
  });

  useEffect(() => {
     // Load settings
     const fetchSettings = async () => {
        if(auth.currentUser) {
           try {
              const d = await getDoc(doc(db, "users", auth.currentUser.uid));
              if(d.exists() && d.data()?.settings) {
                 setSettings(d.data().settings);
                 setTableError(false);
              }
           } catch(e: any) {
              if (e?.message?.includes('Could not find the table') || e?.message?.includes('does not exist')) {
                 setTableError(true);
                 // Fallback to local storage
                 const localSettings = localStorage.getItem('local_user_settings');
                 if (localSettings) {
                    setSettings(JSON.parse(localSettings));
                 }
              }
           }
        }
        setInitialLoading(false);
     };
     fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (tableError) {
         localStorage.setItem('local_user_settings', JSON.stringify(settings));
         toast.success(t('saved_locally', 'Settings saved (Local Offline Mode)'));
         setLoading(false);
         return;
      }
      
      if (auth.currentUser) {
         await updateDoc(doc(db, "users", auth.currentUser.uid), {
             settings
         });
         toast.success(t('saved', 'Settings saved successfully'));
      } else {
         toast.error(t('must_be_logged_in', 'You must be logged in to save settings'));
      }
    } catch(err: any) {
      console.error(err);
      toast.error(t('error_saving', 'Error saving settings'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#f8f9fc] dark:bg-black flex flex-col h-full overflow-hidden transition-colors duration-200 lg:max-w-md lg:mx-auto lg:border-x lg:border-gray-200 dark:lg:border-zinc-800">
      <div className="px-6 pt-12 pb-4 flex items-center bg-white dark:bg-black shadow-sm z-10 transition-colors duration-200">
         <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition">
            <ArrowLeft size={24} />
         </button>
         <h1 className="font-headline font-bold text-[#0a1128] dark:text-white text-xl flex-1 text-center pr-6">{t('settings', 'Settings')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-24 font-body">
          {tableError && (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 text-yellow-800 dark:text-yellow-400 p-4 rounded-xl text-sm">
                 <strong>Database Setup Required:</strong> The <code>users</code> table is missing in Supabase. You are currently using <strong>local offline storage</strong> for your settings.
                 <br className="mb-2"/>
                 To enable cloud sync, execute the following SQL in your Supabase SQL Editor:
                 <pre className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-500/20 rounded font-mono text-[11px] overflow-x-auto text-yellow-900 dark:text-yellow-200">
                    {`CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  data JSONB DEFAULT '{}'::jsonb
);`}
                 </pre>
              </div>
          )}
          
          <div className="bg-white dark:bg-zinc-900 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/50 dark:border-zinc-800 overflow-hidden">
             <div className="p-5 pb-3">
               <h3 className="font-headline font-bold text-[#0a1128] dark:text-slate-100 flex items-center gap-3">
                 <Bell size={18} className="text-[#5c4fff]" /> {t('notifications', 'Notifications')}
               </h3>
             </div>
             
             <div className="px-5 py-4 flex items-center justify-between border-b mx-5 px-0 border-gray-100 dark:border-zinc-800">
                <div>
                   <p className="font-headline font-bold text-[15px] text-[#0a1128] dark:text-white">Push Notifications</p>
                   <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Receive alerts on your device</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, notificationsEnabled: !s.notificationsEnabled }))}
                  className={`w-[46px] h-[26px] rounded-full transition-colors relative flex items-center shrink-0 ${settings.notificationsEnabled ? 'bg-[#5c4fff]' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                   <div className={`w-5 h-5 bg-white dark:bg-zinc-950 rounded-full transition-transform shadow-sm ${settings.notificationsEnabled ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}></div>
                </button>
             </div>
             
             <div className="px-5 py-4 flex items-center justify-between border-b mx-5 px-0 border-gray-100 dark:border-zinc-800">
                <div>
                   <p className="font-headline font-bold text-[15px] text-[#0a1128] dark:text-white">Email Alerts</p>
                   <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Order updates to your inbox</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, emailAlerts: !s.emailAlerts }))}
                  className={`w-[46px] h-[26px] rounded-full transition-colors relative flex items-center shrink-0 ${settings.emailAlerts ? 'bg-[#5c4fff]' : 'bg-gray-200 dark:bg-zinc-700'}`}
                >
                   <div className={`w-5 h-5 bg-white dark:bg-zinc-950 rounded-full transition-transform shadow-sm ${settings.emailAlerts ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}></div>
                </button>
             </div>
             
             <div className="px-5 py-4 mx-5 px-0 flex items-center justify-between">
                <div>
                   <p className="font-headline font-bold text-[15px] text-[#0a1128] dark:text-white">SMS Alerts</p>
                   <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">Text messages for deliveries</p>
                </div>
                <button 
                  onClick={() => setSettings(s => ({ ...s, smsAlerts: !s.smsAlerts }))}
                  className={`w-[46px] h-[26px] rounded-full transition-colors relative flex items-center shrink-0 ${settings.smsAlerts ? 'bg-[#5c4fff]' : 'bg-[#e5e7eb] dark:bg-zinc-700'}`}
                >
                   <div className={`w-5 h-5 bg-white dark:bg-zinc-950 rounded-full transition-transform shadow-[0_1px_2px_rgba(0,0,0,0.1)] ${settings.smsAlerts ? 'translate-x-[22px]' : 'translate-x-[3px]'}`}></div>
                </button>
             </div>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/50 dark:border-zinc-800 overflow-hidden">
             <div className="p-5 pb-3">
               <h3 className="font-headline font-bold text-[#0a1128] dark:text-slate-100 flex items-center gap-3">
                 <Eye size={18} className="text-[#5c4fff]" /> {t('privacy_policy', 'Privacy policy')}
               </h3>
             </div>
             
             <div className="px-5 pt-3 pb-5">
                <p className="font-headline font-bold text-[15px] text-[#0a1128] dark:text-white mb-3">Profile Visibility</p>
                <div className="flex bg-[#f3f4f6] dark:bg-zinc-800 rounded-[12px] p-1.5 h-12">
                  <button 
                    className={`flex-1 text-[14px] font-bold rounded-[8px] transition-all flex items-center justify-center ${settings.profileVisibility === 'Public' ? 'bg-white dark:bg-zinc-700 shadow-sm text-[#0a1128] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    onClick={() => setSettings(s => ({ ...s, profileVisibility: 'Public'}))}
                  >
                    Public
                  </button>
                  <button 
                    className={`flex-1 text-[14px] font-bold rounded-[8px] transition-all flex items-center justify-center ${settings.profileVisibility === 'Private' ? 'bg-white dark:bg-zinc-700 shadow-sm text-[#0a1128] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    onClick={() => setSettings(s => ({ ...s, profileVisibility: 'Private'}))}
                  >
                    Private
                  </button>
                </div>
             </div>
          </div>
      </div>
      
      <div className="p-5 bg-white dark:bg-transparent z-10 shrink-0">
         <button onClick={handleSave} disabled={loading || initialLoading} className="w-full bg-[#5c4fff] hover:bg-[#4d40ff] text-white h-14 rounded-[16px] font-headline font-bold text-[16px] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : t('save_changes', 'Save Changes')}
         </button>
      </div>
    </div>
  );
}
