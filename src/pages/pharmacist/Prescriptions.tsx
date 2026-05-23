import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, where } from "../../lib/firebase";
import { db } from "../../lib/firebase";
import { useAuth } from "../../components/AuthProvider";
import { useTranslation } from "react-i18next";
import { FileText, CheckCircle, XCircle, Search, Clock, MessageSquare, Loader2, Image as ImageIcon } from "lucide-react";
import { parseDate } from "../../lib/utils";

export function PharmacistPrescriptions() {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;
    
    const init = async () => {
      if (!user) return;
      
      try {
        const pQuery = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
        const pSnap = await getDocs(pQuery);
        let pId = null;
        if (!pSnap.empty) {
          pId = pSnap.docs[0].id;
          setPharmacyId(pId);
        }
        
        const q = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          // Filter to those belonging to this pharmacy, or general ones (no pharmacyId)
          const filtered = allDocs.filter(d => !d.pharmacyId || d.pharmacyId === pId);
          setPrescriptions(filtered);
          setLoading(false);
        });
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setProcessingId(id);
      await updateDoc(doc(db, 'prescriptions', id), {
        status,
      });
    } catch (err) {
      console.error(err);
      alert(t('error_updating_status', 'Error updating status.'));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10">
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('prescriptions', 'Prescriptions')}</h1>
         <p className="text-gray-500 text-sm mt-1">{t('review_uploaded_rx', 'Review and approve uploaded prescriptions')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12 text-indigo-600"><Loader2 className="animate-spin" size={32} /></div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800">
             <FileText size={40} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
             {t('no_prescriptions', 'No prescriptions to review.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {prescriptions.map(p => {
               const isImage = p.fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(p.fileName) : /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(p.fileUrl);
               const isPdf = p.fileName ? /\.pdf$/i.test(p.fileName) : /\.pdf(\?.*)?$/i.test(p.fileUrl);
               const displayFilename = p.fileName || p.fileUrl?.split('%2F').pop()?.split('?')[0] || 'Document';
               const isPending = p.status === 'pending_review';

               return (
                  <div key={p.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden group">
                     {/* Preview Area */}
                     <div className="h-44 bg-gray-50 dark:bg-zinc-800/80 w-full flex flex-col relative overflow-hidden group-hover:bg-gray-100 dark:bg-zinc-800 transition-colors">
                        <div className="absolute top-3 left-3 z-10 flex gap-2">
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${p.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' : p.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100/50' : 'bg-amber-50 text-amber-700 border border-amber-100/50'}`}>
                             {p.status === 'approved' ? <CheckCircle size={10} /> : p.status === 'rejected' ? <XCircle size={10} /> : <Clock size={10} />}
                             {t(p.status || 'pending', p.status || 'Pending')}
                           </span>
                        </div>

                        <div className="flex-1 flex items-center justify-center cursor-pointer" onClick={() => window.open(p.fileUrl, '_blank')}>
                           {isImage ? (
                              <img src={p.fileUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" alt={displayFilename} />
                           ) : (
                              <FileText size={48} strokeWidth={1} className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 transition-colors" />
                           )}
                        </div>
                     </div>
                     
                     <div className="p-4 flex flex-col flex-1 border-t border-gray-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                           <div className={`w-6 h-6 shrink-0 rounded flex items-center justify-center ${isPdf ? 'bg-red-50 text-red-500' : isImage ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
                              {isPdf ? <FileText size={14} /> : isImage ? <ImageIcon size={14} /> : <FileText size={14} />}
                           </div>
                           <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate flex-1" title={displayFilename}>
                              {displayFilename}
                           </p>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide mb-4">
                           <span>{parseDate(p.createdAt) ? parseDate(p.createdAt)!.toLocaleDateString() : 'Just now'}</span>
                        </div>

                        {/* Actions */}
                        <div className="mt-auto grid grid-cols-2 gap-2">
                           <button 
                             disabled={!isPending || processingId === p.id}
                             onClick={() => handleUpdateStatus(p.id, 'approved')}
                             className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 disabled:opacity-50 disabled:bg-gray-50 dark:bg-zinc-900 disabled:text-gray-400 font-bold py-2 rounded-xl text-xs flex justify-center items-center gap-1 transition"
                           >
                              {processingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve
                           </button>
                           <button 
                             disabled={!isPending || processingId === p.id}
                             onClick={() => handleUpdateStatus(p.id, 'rejected')}
                             className="bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 disabled:bg-gray-50 dark:bg-zinc-900 disabled:text-gray-400 font-bold py-2 rounded-xl text-xs flex justify-center items-center gap-1 transition"
                           >
                              <XCircle size={14} /> Reject
                           </button>
                        </div>
                        
                        <button className="w-full mt-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 rounded-xl text-xs flex justify-center items-center gap-2 transition">
                           <MessageSquare size={14} /> Contact Patient
                        </button>
                     </div>
                  </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
