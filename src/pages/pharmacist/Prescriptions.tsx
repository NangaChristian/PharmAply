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
    <div className="flex-1 bg-transparent flex flex-col h-full overflow-hidden relative">
      <div className="px-8 pt-8 pb-4 shrink-0 z-10">
         <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight">{t('prescriptions', 'Prescriptions')}</h1>
         <p className="text-gray-500 font-medium text-sm mt-1">{t('review_uploaded_rx', 'Review and approve uploaded prescriptions')}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-12 text-[#0B3B3C]"><Loader2 className="animate-spin" size={32} /></div>
        ) : prescriptions.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col items-center">
             <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
               <FileText size={32} className="text-gray-300 dark:text-slate-600 stroke-[1.5]" />
             </div>
             <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('no_prescriptions', 'No prescriptions to review')}</h3>
             <p className="text-sm font-medium text-gray-500">{t('no_prescriptions_desc', 'When a patient uploads a prescription it will appear here.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {prescriptions.map(p => {
               const isImage = p.fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(p.fileName) : /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(p.fileUrl);
               const isPdf = p.fileName ? /\.pdf$/i.test(p.fileName) : /\.pdf(\?.*)?$/i.test(p.fileUrl);
               const displayFilename = p.fileName || p.fileUrl?.split('%2F').pop()?.split('?')[0] || 'Document';
               const isPending = p.status === 'pending_review';

               return (
                  <div key={p.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden group">
                     {/* Preview Area */}
                     <div className="h-48 bg-[#FAFBFC] dark:bg-slate-900/80 w-full flex flex-col relative overflow-hidden group-hover:bg-gray-50 transition-colors">
                        <div className="absolute top-4 left-4 z-10 flex gap-2">
                           <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1 border ${p.status === 'approved' ? 'bg-[#D3F5A8]/90 text-[#0B3B3C] border-[#D3F5A8] backdrop-blur-md' : p.status === 'rejected' ? 'bg-red-50/90 text-red-700 border-red-100/50 backdrop-blur-md' : 'bg-white/90 text-amber-700 border-gray-200 backdrop-blur-md'}`}>
                             {p.status === 'approved' ? <CheckCircle size={12} /> : p.status === 'rejected' ? <XCircle size={12} /> : <Clock size={12} className="text-amber-500" />}
                             {t(p.status || 'pending', p.status || 'Pending')}
                           </span>
                        </div>

                        <div className="flex-1 flex items-center justify-center cursor-pointer p-4 h-full" onClick={() => window.open(p.fileUrl, '_blank')}>
                           {isImage ? (
                              <img src={p.fileUrl} className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-all duration-300" alt={displayFilename} />
                           ) : (
                              <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center group-hover:-translate-y-1 transition-transform">
                                <FileText size={36} strokeWidth={1.5} className="text-gray-400" />
                              </div>
                           )}
                        </div>
                     </div>
                     
                     <div className="p-5 flex flex-col flex-1 border-t border-gray-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-2">
                           <div className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center border ${isPdf ? 'bg-red-50 border-red-100 text-red-500' : isImage ? 'bg-blue-50 border-blue-100 text-blue-500' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                              {isPdf ? <FileText size={16} /> : isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                           </div>
                           <div className="flex-1 overflow-hidden">
                             <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate" title={displayFilename}>
                                {displayFilename}
                             </p>
                             <p className="text-xs font-medium text-gray-500 mt-0.5 truncate">{parseDate(p.createdAt) ? parseDate(p.createdAt)!.toLocaleDateString() : 'Just now'}</p>
                           </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                           <button 
                             disabled={!isPending || processingId === p.id}
                             onClick={() => handleUpdateStatus(p.id, 'approved')}
                             className="bg-white border-2 border-gray-100 hover:border-[#D3F5A8] hover:bg-[#D3F5A8]/20 hover:text-[#0B3B3C] text-gray-700 disabled:opacity-50 disabled:bg-gray-50 dark:bg-slate-700 disabled:border-transparent disabled:text-gray-400 font-bold py-3 rounded-2xl text-xs flex justify-center items-center gap-1.5 transition-all"
                           >
                              {processingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Approve
                           </button>
                           <button 
                             disabled={!isPending || processingId === p.id}
                             onClick={() => handleUpdateStatus(p.id, 'rejected')}
                             className="bg-white border-2 border-gray-100 hover:border-red-200 hover:bg-red-50 hover:text-red-700 text-gray-700 disabled:opacity-50 disabled:bg-gray-50 dark:bg-slate-700 disabled:border-transparent disabled:text-gray-400 font-bold py-3 rounded-2xl text-xs flex justify-center items-center gap-1.5 transition-all"
                           >
                              <XCircle size={16} /> Reject
                           </button>
                        </div>
                        
                        <button className="w-full mt-3 bg-white border border-[#0B3B3C]/10 hover:border-[#0B3B3C]/30 text-[#0B3B3C] font-bold py-3.5 rounded-2xl text-xs flex justify-center items-center gap-2 transition-all shadow-sm">
                           <MessageSquare size={16} /> Contact Patient
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
