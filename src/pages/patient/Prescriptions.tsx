import { FileText, Plus, UploadCloud, Clock, CheckCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";

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
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10 flex items-center gap-4">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-indigo-900 border border-gray-100 rounded-full bg-white shadow-sm hover:bg-gray-50 transition">
            <ArrowLeft size={20} />
         </button>
         <h1 className="font-bold text-gray-900 text-xl">{t('my_prescriptions', 'My Prescriptions')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Upload Card */}
         <div onClick={() => navigate('/patient/prescription-upload')} className="bg-indigo-50 border-2 border-indigo-100 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-100/50 transition">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-600 mb-4">
               <UploadCloud size={32} />
            </div>
            <h3 className="font-bold text-indigo-900 text-sm">{t('upload_prescription', 'Upload New Prescription')}</h3>
            <p className="text-xs text-indigo-700/70 mt-1 max-w-[200px]">{t('upload_desc', 'Take a picture or upload a PDF. A pharmacist will review it.')}</p>
         </div>

         {/* Prescription List */}
         <div>
            <h3 className="font-bold text-gray-900 text-sm mb-4">{t('recent_prescriptions', 'Recent Prescriptions')}</h3>
            <div className="space-y-4">
               {prescriptions.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-3 relative cursor-pointer" onClick={() => window.open(p.fileUrl, '_blank')}>
                     <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-500">
                        <FileText size={20} />
                     </div>
                     <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-gray-900 text-sm truncate">{p.fileUrl.split('%2F').pop()?.split('?')[0] || t('prescription_document', 'Prescription Document')}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${p.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                             {p.status === 'approved' ? <CheckCircle size={10} /> : <Clock size={10} />}
                             {t(p.status, p.status)}
                           </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mt-3 font-medium">
                           <span>{p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                        </div>
                     </div>
                  </div>
               ))}
               {prescriptions.length === 0 && (
                 <div className="text-center py-8 text-gray-500 text-sm">
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
