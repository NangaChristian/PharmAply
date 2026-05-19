import { FileText, Plus, UploadCloud, Clock, CheckCircle, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { parseDate } from "../../lib/utils";

export function PatientPrescriptions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'prescriptions'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 flex items-center gap-4">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-indigo-900 border border-gray-100 dark:border-zinc-800 rounded-full bg-white dark:bg-slate-950 shadow-sm hover:bg-gray-50 dark:bg-black transition">
            <ArrowLeft size={20} />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('my_prescriptions', 'My Prescriptions')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Upload Card */}
         <div onClick={() => navigate('/patient/prescription-upload')} className="bg-indigo-50 border-2 border-indigo-100 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-100/50 transition">
            <div className="w-16 h-16 bg-white dark:bg-black rounded-full flex items-center justify-center shadow-sm text-indigo-600 mb-4">
               <UploadCloud size={32} />
            </div>
            <h3 className="font-bold text-indigo-900 text-sm">{t('upload_prescription', 'Upload New Prescription')}</h3>
            <p className="text-xs text-indigo-700/70 mt-1 max-w-[200px]">{t('upload_desc', 'Take a picture or upload a PDF. A pharmacist will review it.')}</p>
         </div>

         {/* Prescription List */}
         <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4">{t('recent_prescriptions', 'Recent Prescriptions')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               {prescriptions.map(p => {
                  const isImage = p.fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(p.fileName) : /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(p.fileUrl);
                  const isPdf = p.fileName ? /\.pdf$/i.test(p.fileName) : /\.pdf(\?.*)?$/i.test(p.fileUrl);
                  const displayFilename = p.fileName || p.fileUrl.split('%2F').pop()?.split('?')[0] || t('prescription_document', 'Prescription Document');
                  
                  return (
                  <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col relative cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:shadow-md group overflow-hidden" onClick={() => window.open(p.fileUrl, '_blank')}>
                     <div className="h-32 bg-gray-50 dark:bg-zinc-800/80 w-full flex items-center justify-center relative overflow-hidden">
                        <div className="absolute top-2 left-2 z-10">
                           <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-transparent flex items-center gap-1 ${p.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-amber-50 text-amber-700 border-amber-100/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'}`}>
                             {p.status === 'approved' ? <CheckCircle size={10} /> : <Clock size={10} />}
                             {t(p.status, p.status)}
                           </span>
                        </div>
                        
                        {isImage ? (
                           <img src={p.fileUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" alt={displayFilename} />
                        ) : (
                           <FileText size={48} strokeWidth={1} className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors" />
                        )}
                     </div>
                     <div className="p-3 flex flex-col flex-1 h-[72px] bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-1">
                           <div className={`w-5 h-5 shrink-0 rounded flex items-center justify-center ${isPdf ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400' : isImage ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'}`}>
                              {isPdf ? <FileText size={12} strokeWidth={2.5}/> : isImage ? <ImageIcon size={12} strokeWidth={2.5}/> : <FileText size={12} />}
                           </div>
                           <p className="font-bold text-gray-900 dark:text-gray-100 text-xs truncate" title={displayFilename}>
                              {displayFilename}
                           </p>
                        </div>
                        <div className="mt-auto flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                           <span className="truncate">Uploaded {parseDate(p.createdAt) ? parseDate(p.createdAt)!.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'}) : 'Just now'}</span>
                        </div>
                     </div>
                  </div>
               )})}
               {prescriptions.length === 0 && (
                 <div className="col-span-2 md:col-span-3 lg:col-span-4 text-center py-12 text-gray-400 dark:text-gray-500 text-sm bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
                   <FileText size={40} strokeWidth={1.5} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
                   {t('no_prescriptions', 'You have no prescriptions yet.')}
                 </div>
               )}
            </div>
         </div>
         <div className="h-8"></div>
      </div>
    </div>
  );
}
