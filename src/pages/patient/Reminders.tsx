import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";

export function PatientReminders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<any[]>([]);
  const [prescriptedMeds, setPrescriptedMeds] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'calendar'>('list');
  
  // Specific to 'add' view
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // Load active reminders
    const qReminders = query(collection(db, 'reminders'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Simulate loading medications from orders or prescriptions. Using some dummy data for the UI
    setPrescriptedMeds([
      { id: '1', name: 'Pain Relief - Panadol', genericName: 'Paracetamol', dose: '12 Tablets', frequency: 'Daily', time: '8:00 AM' },
      { id: '2', name: 'Pain Relief - Panadol', genericName: 'Paracetamol', dose: '12 Tablets', frequency: 'Daily', time: '8:00 AM' },
    ]);

    return () => unsub();
  }, [user]);

  const handleCreateReminders = async () => {
     if (selectedMeds.size === 0) return;
     
     const medsToCreate = prescriptedMeds.filter(m => selectedMeds.has(m.id));
     try {
       for (const med of medsToCreate) {
          await addDoc(collection(db, 'reminders'), {
             patientId: user?.uid,
             medicationId: med.id,
             name: med.name,
             genericName: med.genericName,
             dose: med.dose,
             frequency: med.frequency,
             time: med.time,
             active: true,
             createdAt: serverTimestamp()
          });
       }
       toast.success(t('reminders_added_success', 'Reminders added successfully!'));
       setView('list');
       setSelectedMeds(new Set());
     } catch (error: any) {
        toast.error(t('reminders_added_error', 'Failed to create reminders'));
     }
  };

  const toggleMed = (id: string) => {
     const newSet = new Set(selectedMeds);
     if (newSet.has(id)) newSet.delete(id);
     else newSet.add(id);
     setSelectedMeds(newSet);
  };

  if (view === 'add') {
     return (
        <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
          <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between">
             <button onClick={() => setView('list')} className="p-2 -ml-2 text-indigo-900 border border-gray-100 rounded-full bg-white shadow-sm hover:bg-gray-50">
               <ArrowLeft size={20} />
             </button>
             <h1 className="text-lg font-bold text-indigo-900">{t('medication_reminder', 'Medication Reminder')}</h1>
             <div className="w-10"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col pb-32">
             <h2 className="text-sm font-bold text-gray-900 mb-4">{t('choose_medication_activate', 'Choose a medication to activate reminders')}</h2>
             <div className="flex gap-4 mb-4">
                <button className="text-indigo-600 font-bold border-b-2 border-indigo-600 pb-1 text-sm">{t('prescriptions', 'Prescriptions')} (2 active)</button>
                <button className="text-gray-400 font-medium pb-1 text-sm">{t('frequently_ordered', 'Frequently ordered')}</button>
             </div>
             
             <div className="space-y-4">
               {prescriptedMeds.map((med, idx) => {
                  const isSelected = selectedMeds.has(med.id);
                  return (
                     <div key={idx} className={`p-4 rounded-2xl border ${isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-white'}`}>
                        <div className="flex gap-3 mb-4">
                           <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                              <img src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=200&auto=format&fit=crop" alt="Pills" className="w-full h-full object-cover" />
                           </div>
                           <div>
                              <h3 className="font-bold text-gray-900">{med.name}</h3>
                              <p className="text-xs text-gray-500">{med.genericName}</p>
                           </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                           <div className="text-center bg-white border border-gray-100 rounded-lg p-2"><p className="text-[10px] text-gray-400">{t('dose_tablet', 'Dose/Tablet')}</p><p className="text-xs font-bold text-gray-800">{med.dose}</p></div>
                           <div className="text-center bg-white border border-gray-100 rounded-lg p-2"><p className="text-[10px] text-gray-400">{t('schedule', 'Schedule')}</p><p className="text-xs font-bold text-gray-800">2x/day</p></div>
                           <div className="text-center bg-white border border-gray-100 rounded-lg p-2"><p className="text-[10px] text-gray-400">{t('frequency', 'Frequency')}</p><p className="text-xs font-bold text-gray-800">{t(med.frequency.toLowerCase(), med.frequency)}</p></div>
                        </div>
                        <button 
                           onClick={() => toggleMed(med.id)}
                           className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${isSelected ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white'}`}
                        >
                           {isSelected ? <><Check size={18} /> {t('selected', 'Selected')}</> : t('select', 'Select')}
                        </button>
                     </div>
                  );
               })}
             </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
             <button disabled={selectedMeds.size === 0} onClick={handleCreateReminders} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold mb-2 disabled:opacity-50">
                {t('create_reminder_for', 'Create Reminder for {{count}} Medications').replace('{{count}}', selectedMeds.size.toString())}
             </button>
             <button disabled={selectedMeds.size === 0} className="w-full text-indigo-600 font-bold py-2 disabled:opacity-50">
                {t('adjust_reminder_time_for', 'Adjust reminder time for {{count}} Medications').replace('{{count}}', selectedMeds.size.toString())}
             </button>
          </div>
        </div>
     );
  }

  // List view (Today's calendar view based on image)
  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10">
         <div className="flex items-center justify-between mb-4">
           <h1 className="text-xl font-bold text-slate-800">{t('my_calendar', 'My Calendar')}</h1>
           <button onClick={() => setView('add')} className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-indigo-600 shadow-sm">
             <Plus size={20} />
           </button>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 pb-32">
         {/* Mini Calendar strip */}
         <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-gray-100 mb-6 shadow-sm">
            <button className="text-gray-400">&lt;</button>
            <span className="font-bold text-sm text-indigo-900">{t('today', 'Today')} - 17, Dec, 2025</span>
            <button className="text-gray-400">&gt;</button>
         </div>
         
         <div className="flex justify-between items-center mb-8 px-2 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-50 -translate-y-1/2 z-0"></div>
            {['S','M','T','W','T','F','S'].map((day, i) => (
               <div key={i} className="text-center cursor-pointer relative z-10 bg-slate-50 px-1">
                  <p className={`text-xs mb-2 font-bold ${i === 3 ? 'text-indigo-600' : 'text-gray-400'}`}>{day}</p>
                  <p className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full font-bold text-sm ${i === 3 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : i < 3 ? 'text-gray-800' : 'text-gray-400'}`}>
                     {16 + i}
                  </p>
               </div>
            ))}
         </div>
         
         <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-gray-900 text-lg">{t('today', 'Today')}</h2>
            <span className="text-sm text-indigo-600 font-bold">{reminders.length} {t('reminders', 'Reminders')}</span>
         </div>
         
         {reminders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 text-center shadow-sm">
               <p className="text-gray-500 mb-4">{t('no_reminders_today', 'No reminders set for today.')}</p>
               <button onClick={() => setView('add')} className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-full">
                  {t('create_reminder', 'Create Reminder')}
               </button>
            </div>
         ) : (
            <div className="space-y-4">
               {reminders.map((rem, idx) => (
                  <div key={rem.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                     <div className="flex gap-4 items-center flex-1">
                        <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl p-2 shrink-0 shadow-sm flex items-center justify-center">
                           <img src="https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=200&auto=format&fit=crop" alt="Pills" className="w-full h-full object-contain rounded-lg" />
                        </div>
                        <div className="flex-1">
                           <h3 className="font-bold text-gray-900 text-sm mb-0.5">{rem.name}</h3>
                           <p className="text-[11px] text-gray-500 mb-2">{rem.dose}</p>
                           <div className="flex gap-2 text-[10px]">
                              <span className="bg-[#fff9e6] text-[#e6a200] px-2 py-1 rounded-md font-bold">1 tab</span>
                              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-bold flex items-center gap-1"><Clock size={10} /> {rem.time}</span>
                           </div>
                        </div>
                     </div>
                     <button 
                        onClick={async () => {
                          const ref = doc(db, 'reminders', rem.id);
                          await updateDoc(ref, { active: !rem.active });
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${!rem.active ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-gray-50 text-transparent hover:border-green-500'}`}
                     >
                        <Check size={14} />
                     </button>
                  </div>
               ))}
               
               <button onClick={() => setView('add')} className="w-full py-4 bg-indigo-50 text-indigo-600 border border-indigo-100 border-dashed rounded-2xl font-bold flex items-center justify-center gap-2">
                  <Plus size={20} /> {t('add_new_reminder', 'Add new reminder')}
               </button>
            </div>
         )}
      </div>
    </div>
  );
}
