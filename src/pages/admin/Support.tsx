import React, { useState, useEffect } from "react";
import { collection, query, getDocs, doc, deleteDoc, onSnapshot, orderBy, updateDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Search, MessagesSquare, Clock, CheckCircle2, User, Check, X, Filter } from "lucide-react";
import { parseDate } from '../../lib/utils';
import { useTranslation } from "react-i18next";

export function AdminSupport() {
    const { t } = useTranslation();
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    const q = query(collection(db, "support_queries"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQueries(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openCount = queries.filter(q => q.status !== 'resolved').length;

  const filteredQueries = queries.filter(q => {
    const matchesSearch = (q.subject?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (q.userId?.toLowerCase() || "").includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "resolved" && q.status === "resolved") || 
                          (statusFilter === "open" && q.status !== "resolved");
    return matchesSearch && matchesStatus;
  });

  const handleResolve = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "support_queries", id), { status: "resolved" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `support_queries/${id}`);
    }
  };

  const handleRowClick = (q: any) => {
    setSelectedQuery(q);
    setReplyText("");
  };

  const handleCloseModal = () => {
    setSelectedQuery(null);
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-4">
             <div>
                 <div className="flex items-center gap-3 mb-1">
                   <h1 className="font-bold text-gray-900 dark:text-white text-2xl"> {t('customer_support', 'Customer Support')} </h1>
                   {openCount > 0 && (
                     <span className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
                       {openCount}  {t('open', 'Open')} </span>
                   )}
                 </div>
                 <p className="text-gray-500 text-sm"> {t('manage_user_queries_complaints', 'Manage user queries, complaints, and requests')} </p>
             </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="relative w-80">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                   <input 
                     type="text" 
                     placeholder={t('search_subject_or_user_id', 'Search subject or user ID...')} 
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                     className="w-full bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                   />
                </div>
                <div className="relative">
                   <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <select 
                     value={statusFilter} 
                     onChange={(e) => setStatusFilter(e.target.value)}
                     className="bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 pl-10 pr-8 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none appearance-none transition text-slate-700 font-medium"
                   >
                     <option value="all"> {t('all_status', 'All Status')} </option>
                     <option value="open"> {t('open', 'Open')} </option>
                     <option value="resolved"> {t('resolved', 'Resolved')} </option>
                   </select>
                </div>
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500"> {t('loading_queries', 'Loading queries...')} </div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold"> {t('user_id', 'User / ID')} </th>
                            <th className="py-4 px-6 font-semibold"> {t('subject', 'Subject')} </th>
                            <th className="py-4 px-6 font-semibold"> {t('status', 'Status')} </th>
                            <th className="py-4 px-6 font-semibold text-right"> {t('actions', 'Actions')} </th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredQueries.map((q) => (
                           <tr key={q.id} onClick={() => handleRowClick(q)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                              <td className="py-4 px-6">
                                 <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                      <User size={14} />
                                   </div>
                                   <span className="font-mono text-xs">{q.userId?.slice(0,8)}</span>
                                 </div>
                              </td>
                              <td className="py-4 px-6">
                                 <p className="font-bold text-slate-800 dark:text-slate-100">{q.subject || 'No Subject'}</p>
                                 <p className="text-xs text-slate-500 truncate max-w-[300px]">{q.message}</p>
                              </td>
                              <td className="py-4 px-6">
                                 <div className="flex items-center gap-2">
                                     {q.status === 'resolved' ? (
                                       <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold w-max">
                                         <CheckCircle2 size={12} />  {t('resolved', 'Resolved')} </span>
                                     ) : (
                                       <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold w-max">
                                         <Clock size={12} />  {t('open', 'Open')} </span>
                                     )}
                                     {q.status !== 'resolved' && (
                                       <button 
                                         onClick={(e) => handleResolve(e, q.id)}
                                         className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition ml-2" 
                                         title={t('mark_as_resolved', 'Mark as Resolved')}
                                       >
                                         <Check size={16} />
                                       </button>
                                     )}
                                 </div>
                              </td>
                              <td className="py-4 px-6 text-right">
                                 <button className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
                                     {t('view', 'View')} </button>
                              </td>
                           </tr>
                         ))}
                         {filteredQueries.length === 0 && (
                           <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-500"> {t('no_support_queries_found', 'No support queries found.')} </td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      </div>

      {selectedQuery && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 w-full max-w-2xl shadow-xl flex flex-col">
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                 <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedQuery.subject || 'No Subject'}</h2>
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span> {t('user_id', 'User ID:')} <span className="font-mono font-bold">{selectedQuery.userId}</span></span>
                      {parseDate(selectedQuery.createdAt) && (
                        <span> {t('date', 'Date:')} {parseDate(selectedQuery.createdAt)!.toLocaleString()}</span>
                      )}
                    </div>
                 </div>
                 <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2 transition">
                    <X size={20} />
                 </button>
              </div>
              <div className="flex-1 overflow-y-auto mb-6">
                 <p className="text-sm text-slate-700 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                   {selectedQuery.message}
                 </p>

                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2"> {t('reply_notes', 'Reply / Notes')} </label>
                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('add_an_internal_note_or_reply', 'Add an internal note or reply...')}
                      className="w-full border border-slate-200 rounded-xl p-3 bg-white dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                    ></textarea>
                 </div>
              </div>
              <div className="flex justify-between items-center bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-2xl border-t border-slate-100">
                 {selectedQuery.status !== 'resolved' ? (
                   <button onClick={(e) => { handleResolve(e as any, selectedQuery.id); handleCloseModal(); }} className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-xl hover:bg-emerald-200 transition">
                       {t('mark_as_resolved', 'Mark as Resolved')} </button>
                 ) : (
                   <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                     <CheckCircle2 size={16} />  {t('resolved', 'Resolved')} </span>
                 )}
                 <button className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition shadow-sm">
                     {t('send_reply', 'Send Reply')} </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
