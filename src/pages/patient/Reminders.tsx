import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, doc, updateDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";

export function PatientReminders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [orderedMeds, setOrderedMeds] = useState<{id: string, name: string}[]>([]);
  
  // Specific to 'add' view
  const [newReminder, setNewReminder] = useState({
     name: '',
     dose: '',
     frequency: 'Daily',
     time: '08:00'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Load active reminders
    const qReminders = query(collection(db, 'reminders'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load previously ordered medications for suggestions
    const fetchOrders = async () => {
      try {
        const qOrders = query(collection(db, 'orders'), where('patientId', '==', user.uid));
        const snapshot = await getDocs(qOrders);
        const meds = new Map<string, string>();
        snapshot.docs.forEach(doc => {
           const data = doc.data();
           if (data.items) {
             data.items.forEach((item: any) => {
               if (item.product?.name) {
                 meds.set(item.product.id || item.product.name, item.product.name);
               } else if (item.name) {
                 meds.set(item.productId || item.name, item.name);
               }
             });
           }
        });
        setOrderedMeds(Array.from(meds.entries()).map(([id, name]) => ({id, name})));
      } catch (e) {
        console.error("Error fetching orders for suggestions", e);
      }
    };
    fetchOrders();

    return () => unsub();
  }, [user]);

  const handleCreateReminder = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!newReminder.name || !newReminder.dose || !newReminder.time) {
        toast.error(t('please_fill_all_fields', 'Please fill out all required fields'));
        return;
     }
     
     setIsSaving(true);
     try {
        await addDoc(collection(db, 'reminders'), {
           patientId: user?.uid,
           name: newReminder.name,
           dose: newReminder.dose,
           frequency: newReminder.frequency,
           time: newReminder.time,
           active: true,
           createdAt: serverTimestamp()
        });
        toast.success(t('reminder_added_success', 'Reminder added successfully!'));
        setView('list');
        setNewReminder({ name: '', dose: '', frequency: 'Daily', time: '08:00' });
     } catch (error: any) {
        toast.error(t('reminder_added_error', 'Failed to create reminder'));
     } finally {
        setIsSaving(false);
     }
  };

  if (view === 'add') {
     return (
        <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
          <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between">
             <button onClick={() => setView('list')} className="p-2 -ml-2 text-indigo-900 border border-gray-100 dark:border-zinc-800 rounded-full bg-white dark:bg-slate-950 shadow-sm hover:bg-gray-50 dark:bg-black">
               <ArrowLeft size={20} />
             </button>
             <h1 className="text-lg font-bold text-indigo-900">{t('add_medication_reminder', 'Add Reminder')}</h1>
             <div className="w-10"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col pb-32">
             <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-6">{t('specify_medication_details', 'Specify medication details')}</h2>
             
             <form id="reminder-form" onSubmit={handleCreateReminder} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block uppercase tracking-wider">{t('medication_name', 'Medication Name')}</label>
                  {orderedMeds.length > 0 ? (
                    <div className="relative">
                      <input 
                         list="medications-list"
                         required 
                         value={newReminder.name}
                         onChange={e => setNewReminder({...newReminder, name: e.target.value})}
                         className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                         placeholder={t('e_g_panadol', 'e.g., Panadol')}
                      />
                      <datalist id="medications-list">
                         {orderedMeds.map(med => <option key={med.id} value={med.name} />)}
                      </datalist>
                    </div>
                  ) : (
                    <input 
                       required 
                       value={newReminder.name}
                       onChange={e => setNewReminder({...newReminder, name: e.target.value})}
                       className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                       placeholder={t('e_g_panadol', 'e.g., Panadol')}
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block uppercase tracking-wider">{t('dosage', 'Dosage')}</label>
                  <input 
                     required 
                     value={newReminder.dose}
                     onChange={e => setNewReminder({...newReminder, dose: e.target.value})}
                     className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                     placeholder={t('e_g_1_tablet', 'e.g., 1 Tablet, 15ml')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block uppercase tracking-wider">{t('frequency', 'Frequency')}</label>
                    <select 
                       value={newReminder.frequency}
                       onChange={e => setNewReminder({...newReminder, frequency: e.target.value})}
                       className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm appearance-none"
                    >
                       <option value="Daily">{t('daily', 'Daily')}</option>
                       <option value="Twice a Day">{t('twice_a_day', 'Twice a Day')}</option>
                       <option value="Weekly">{t('weekly', 'Weekly')}</option>
                       <option value="As Needed">{t('as_needed', 'As Needed')}</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block uppercase tracking-wider">{t('time_of_intake', 'Time')}</label>
                    <input 
                       type="time"
                       required 
                       value={newReminder.time}
                       onChange={e => setNewReminder({...newReminder, time: e.target.value})}
                       className="w-full bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 p-4 rounded-2xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                    />
                  </div>
                </div>
             </form>
          </div>
          
          <div className="p-6 bg-white dark:bg-slate-950 dark:bg-black border-t border-gray-100 dark:border-zinc-800 z-10 shrink-0">
             <button disabled={isSaving} form="reminder-form" type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-colors disabled:opacity-50">
                {isSaving ? t('saving', 'Saving...') : t('save_reminder', 'Save Reminder')}
             </button>
          </div>
        </div>
     );
  }

  // List view (Today's calendar view based on image)
  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10">
         <div className="flex items-center justify-between mb-4">
           <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('my_calendar', 'My Calendar')}</h1>
           <button onClick={() => setView('add')} className="w-10 h-10 rounded-full border border-gray-100 dark:border-zinc-800 flex items-center justify-center text-indigo-600 shadow-sm hover:bg-gray-50 dark:bg-black transition-colors">
             <Plus size={20} />
           </button>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 pb-32">
         {/* Mini Calendar strip */}
         <div className="flex items-center justify-between bg-white dark:bg-black rounded-2xl px-4 py-3 border border-gray-100 dark:border-zinc-800 mb-6 shadow-sm">
            <button className="text-gray-400 dark:text-gray-500"> {t('lt', '&lt;')} </button>
            <span className="font-bold text-sm text-indigo-900">{t('today', 'Today')} - {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <button className="text-gray-400 dark:text-gray-500"> {t('gt', '&gt;')} </button>
         </div>
         
         <div className="flex justify-between items-center mb-8 px-2 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-50 dark:bg-black -translate-y-1/2 z-0"></div>
            {['S','M','T','W','T','F','S'].map((day, i) => (
               <div key={i} className="text-center cursor-pointer relative z-10 bg-slate-50 dark:bg-black px-1">
                  <p className={`text-xs mb-2 font-bold ${i === new Date().getDay() ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500'}`}>{day}</p>
                  <p className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full font-bold text-sm ${i === new Date().getDay() ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-gray-800 dark:text-slate-100'}`}>
                     {new Date().getDate() - new Date().getDay() + i}
                  </p>
               </div>
            ))}
         </div>
         
         <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">{t('today', 'Today')}</h2>
            <span className="text-sm text-indigo-600 font-bold">{reminders.length} {t('reminders', 'Reminders')}</span>
         </div>
         
         {reminders.length === 0 ? (
            <div className="bg-white dark:bg-black rounded-3xl p-8 border border-gray-100 dark:border-zinc-800 text-center shadow-sm">
               <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">{t('no_reminders_today', 'No reminders set for today.')}</p>
               <button onClick={() => setView('add')} className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-full hover:bg-indigo-100 transition-colors">
                  {t('create_reminder', 'Create Reminder')}
               </button>
            </div>
         ) : (
            <div className="space-y-4">
               {reminders.map((rem, idx) => (
                  <div key={rem.id} className="bg-white dark:bg-black p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between shadow-sm">
                     <div className="flex gap-4 items-center flex-1">
                        <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-zinc-800 rounded-2xl p-2 shrink-0 shadow-sm flex items-center justify-center">
                           <img src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=200&auto=format&fit=crop" alt="Pills" className="w-full h-full object-contain rounded-lg" />
                        </div>
                        <div className="flex-1">
                           <h3 className={`font-bold text-sm mb-0.5 ${!rem.active ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{rem.name}</h3>
                           <p className={`text-[11px] mb-2 ${!rem.active ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400 dark:text-gray-500'}`}>{rem.dose}</p>
                           <div className="flex gap-2 text-[10px]">
                              {rem.frequency && <span className={`px-2 py-1 rounded-md font-bold ${!rem.active ? 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-gray-500' : 'bg-[#fff9e6] text-[#e6a200]'}`}>{rem.frequency}</span>}
                              <span className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 ${!rem.active ? 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-gray-500' : 'bg-blue-50 text-blue-600'}`}><Clock size={10} /> {rem.time}</span>
                           </div>
                        </div>
                     </div>
                     <button 
                        onClick={async () => {
                          const ref = doc(db, 'reminders', rem.id);
                          await updateDoc(ref, { active: !rem.active });
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${!rem.active ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-gray-50 dark:bg-black text-transparent hover:border-green-500 hover:text-green-500'}`}
                     >
                        <Check size={14} />
                     </button>
                  </div>
               ))}
               
               <button onClick={() => setView('add')} className="w-full py-4 bg-indigo-50 text-indigo-600 border border-indigo-100 border-dashed hover:bg-indigo-100 transition-colors rounded-2xl font-bold flex items-center justify-center gap-2">
                  <Plus size={20} /> {t('add_new_reminder', 'Add new reminder')}
               </button>
            </div>
         )}
      </div>
    </div>
  );
}

