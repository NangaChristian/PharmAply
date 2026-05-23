import { FileText, Plus, ArrowLeft, Image as ImageIcon, MoreVertical, ArrowUp, List as ListIcon, Grid as GridIcon, User, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { parseDate } from "../../lib/utils";

export function PatientPrescriptions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'prescriptions'), where('patientId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('confirm_delete', 'Are you sure you want to delete this prescription?'))) {
      try {
         await deleteDoc(doc(db, 'prescriptions', id));
      } catch (e) {
         console.error('Error deleting document:', e);
      }
    }
    setActiveMenuId(null);
  };

  return (
    <div className="flex-1 bg-white dark:bg-black flex flex-col h-full relative h-[100dvh]">
      <div className="px-4 py-3 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] z-10 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-black">
         <div className="flex items-center gap-2">
           <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-900 transition">
              <ArrowLeft size={24} />
           </button>
           <h1 className="text-[1.35rem] text-gray-800 dark:text-gray-100">{t('my_prescriptions', 'My Prescriptions')}</h1>
         </div>
         {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full shadow-sm object-cover" />
         ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium shadow-sm">
               {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
         )}
      </div>

      <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto pb-24">
         <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 px-2 py-1.5 rounded transition">
               {t('name', 'Name')} <ArrowUp size={16} />
            </div>
            <button 
               className="p-2 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 rounded-full transition"
               onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
               {viewMode === 'grid' ? <ListIcon size={22} className="text-gray-600 dark:text-gray-400" /> : <GridIcon size={22} className="text-gray-600 dark:text-gray-400" />}
            </button>
         </div>

         {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4 pb-4 w-full">
            {prescriptions.map(p => {
               const isImage = p.fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(p.fileName) : /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(p.fileUrl);
               const isPdf = p.fileName ? /\.pdf$/i.test(p.fileName) : /\.pdf(\?.*)?$/i.test(p.fileUrl);
               const displayFilename = p.fileName || p.fileUrl.split('%2F').pop()?.split('?')[0] || t('prescription_document', 'Prescription Document');
               
               return (
               <div key={p.id} className="flex flex-col group cursor-pointer w-full min-w-0" onClick={() => window.open(p.fileUrl, '_blank')}>
                  {/* Aspect Ratio Preview Wrapper */}
                  <div className="w-full bg-[#f0f4f9] dark:bg-zinc-800/70 rounded-xl relative pt-[75%] mb-2 group-hover:bg-[#e4ebf5] dark:group-hover:bg-zinc-800 transition-colors shrink-0">
                     
                     {/* Inner Preview Window */}
                     <div className="absolute inset-0 p-1 sm:p-2 w-full h-full flex flex-col">
                        <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 overflow-hidden relative flex flex-col">
                           {isImage ? (
                              <img src={p.fileUrl} className="w-full h-full object-cover" alt={displayFilename} />
                           ) : (
                              <div className="w-full h-full flex flex-col p-2 md:p-3 relative z-0">
                                 <div className="flex gap-2 mb-2 mt-1">
                                    <div className="w-5 h-5 md:w-6 md:h-6 bg-blue-50 dark:bg-zinc-800 rounded flex items-center justify-center text-blue-500">
                                      <FileText size={12} strokeWidth={2.5}/>
                                    </div>
                                 </div>
                                 <div className="w-[50%] h-1 md:h-1.5 bg-blue-400/80 rounded-full mb-1.5 md:mb-2 flex-shrink-0"></div>
                                 <div className="w-[90%] h-1 md:h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full mb-1 md:mb-1.5 flex-shrink-0"></div>
                                 <div className="w-[85%] h-1 md:h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full mb-1 md:mb-1.5 flex-shrink-0"></div>
                                 <div className="w-[70%] h-1 md:h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full flex-shrink-0"></div>
                              </div>
                           )}
                           
                           {/* Circular Badge Overlay - anchored to the Inner Preview bottom right corner */}
                           <div className="absolute bottom-[2px] right-[2px] md:bottom-[4px] md:right-[4px] bg-white dark:bg-zinc-900 rounded-full p-[2px] shadow-sm flex items-center justify-center flex-shrink-0 z-10">
                              <div className="bg-gray-400 dark:bg-zinc-600 rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-white">
                                 {p.status === 'approved' ? (
                                    <div className="bg-emerald-500 rounded-full w-full h-full flex items-center justify-center"><User size={10} strokeWidth={2.5} /></div>
                                 ) : (
                                    <User size={10} strokeWidth={2.5} />
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Details/Footer Section */}
                  <div className="flex items-center pt-0 pb-1 gap-2 w-full min-w-0">
                     {isImage ? (
                        <div className="text-red-500 shrink-0"><ImageIcon size={18} strokeWidth={2} /></div>
                     ) : isPdf ? (
                        <div className="text-red-500 shrink-0"><FileText size={18} strokeWidth={2} /></div>
                     ) : (
                        <div className="text-blue-500 shrink-0"><FileText size={18} strokeWidth={2} /></div>
                     )}
                     
                     <span className="text-[12px] md:text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate flex-1 leading-tight">{displayFilename}</span>
                     
                     <div className="relative">
                        <button className="text-gray-500 dark:text-gray-400 focus:outline-none p-1 md:p-1.5 -mr-1 md:-mr-1.5 rounded-full hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-800 transition shrink-0" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === p.id ? null : p.id); }}>
                           <MoreVertical size={16} />
                        </button>
                        {activeMenuId === p.id && (
                           <div className="absolute right-0 bottom-full mb-1 w-32 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 overflow-hidden z-50">
                              <button
                                 onClick={(e) => handleDelete(p.id, e)}
                                 className="w-full text-left px-3 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[13px] font-medium flex items-center gap-2 transition"
                              >
                                 <Trash2 size={16} />
                                 {t('delete', 'Delete')}
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )})}
            {prescriptions.length === 0 && (
              <div className="col-span-2 md:col-span-3 lg:col-span-4 text-center py-20 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 w-full">
                <FileText size={48} strokeWidth={1} className="mx-auto text-gray-300 dark:text-zinc-700 mb-4" />
                <p className="text-[15px]">{t('no_prescriptions', 'You have no prescriptions yet.')}</p>
              </div>
            )}
         </div>
         ) : (
         <div className="flex flex-col px-4 gap-2 pb-4">
            {prescriptions.map(p => {
               const isImage = p.fileName ? /\.(jpg|jpeg|png|gif|webp)$/i.test(p.fileName) : /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(p.fileUrl);
               const isPdf = p.fileName ? /\.pdf$/i.test(p.fileName) : /\.pdf(\?.*)?$/i.test(p.fileUrl);
               const displayFilename = p.fileName || p.fileUrl.split('%2F').pop()?.split('?')[0] || t('prescription_document', 'Prescription Document');
               
               return (
                  <div key={p.id} className="flex items-center p-3 rounded-xl hover:bg-gray-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 transition cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-zinc-700" onClick={() => window.open(p.fileUrl, '_blank')}>
                     <div className="w-10 h-10 shrink-0 bg-[#f0f4f9] dark:bg-zinc-800 rounded flex items-center justify-center mr-4">
                        {isImage ? (
                           <ImageIcon size={20} className="text-red-500" strokeWidth={2} />
                        ) : isPdf ? (
                           <FileText size={20} className="text-red-500" strokeWidth={2} />
                        ) : (
                           <FileText size={20} className="text-blue-500" strokeWidth={2} />
                        )}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-gray-800 dark:text-gray-200 truncate">{displayFilename}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                           <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                             {p.status === 'approved' ? (
                                <div className="text-emerald-500 flex items-center"><User size={10} strokeWidth={2.5} className="mr-1" /> Approved</div>
                             ) : (
                                <div className="text-gray-400 flex items-center"><User size={10} strokeWidth={2.5} className="mr-1" /> {t(p.status, p.status)}</div>
                             )}
                           </div>
                           <span className="text-[11px] text-gray-400">•</span>
                           <span className="text-[11px] text-gray-400">
                              {parseDate(p.createdAt) ? parseDate(p.createdAt)!.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                           </span>
                        </div>
                     </div>
                     <div className="relative">
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 ml-2 transition rounded-full hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700" onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === p.id ? null : p.id); }}>
                           <MoreVertical size={18} />
                        </button>
                        {activeMenuId === p.id && (
                           <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700 overflow-hidden z-50">
                              <button
                                 onClick={(e) => handleDelete(p.id, e)}
                                 className="w-full text-left px-3 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-[13px] font-medium flex items-center gap-2 transition"
                              >
                                 <Trash2 size={16} />
                                 {t('delete', 'Delete')}
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               )
            })}
            {prescriptions.length === 0 && (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900/50 dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 w-full">
                <FileText size={48} strokeWidth={1} className="mx-auto text-gray-300 dark:text-zinc-700 mb-4" />
                <p className="text-[15px]">{t('no_prescriptions', 'You have no prescriptions yet.')}</p>
              </div>
            )}
         </div>
         )}
      </div>

      <button onClick={() => navigate('/patient/prescription-upload')} className="fixed bottom-6 right-6 w-14 h-14 bg-white dark:bg-zinc-800 rounded-full shadow-[0_1px_8px_0_rgba(0,0,0,0.1),0_3px_4px_0_rgba(0,0,0,0.14),0_3px_3px_-2px_rgba(0,0,0,0.12)] flex items-center justify-center cursor-pointer hover:shadow-lg transition-all active:bg-gray-50 dark:bg-zinc-900 dark:active:bg-zinc-700 z-50">
         <svg width="32" height="32" viewBox="0 0 36 36">
            <path fill="#EA4335" d="M16 16v14h4V20z" />
            <path fill="#4285F4" d="M30 16H20l-4 4h14z" />
            <path fill="#34A853" d="M6 16v4h10l4-4z" />
            <path fill="#FBBC05" d="M20 16V2h-4v14z" />
            <path fill="none" d="M0 0h36v36H0z" />
         </svg>
      </button>
    </div>
  );
}
