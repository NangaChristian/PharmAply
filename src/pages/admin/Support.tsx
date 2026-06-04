import React, { useState, useEffect, useRef } from "react";
import { collection, query, getDocs, doc, deleteDoc, onSnapshot, orderBy, updateDoc, where, addDoc, serverTimestamp } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { Search, MessagesSquare, Clock, CheckCircle2, User, Check, X, Filter, Send, Loader2 } from "lucide-react";
import { parseDate } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import { useAuth } from "../../components/AuthProvider";
import toast from "react-hot-toast";

export function AdminSupport() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync Support Tickets (Queries)
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

  // Sync Chat messages inside selected Ticket (Query)
  useEffect(() => {
    if (!selectedQuery) {
      setMessages([]);
      return;
    }
    
    const mQuery = query(
      collection(db, "messages"),
      where("relatedId", "==", selectedQuery.id)
    );

    const unsubscribe = onSnapshot(mQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => {
        const timeA = parseDate(a.createdAt)?.getTime() || 0;
        const timeB = parseDate(b.createdAt)?.getTime() || 0;
        return timeA - timeB;
      });
      setMessages(data);
    }, (error) => {
       console.error("Failed to sync support chat messages: ", error);
    });

    return () => unsubscribe();
  }, [selectedQuery]);

  // Scroll current chat container to the bottom
  useEffect(() => {
     chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openCount = queries.filter(q => q.status !== 'resolved').length;

  const filteredQueries = queries.filter(q => {
    const matchesSearch = (q.subject?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (q.userId?.toLowerCase() || "").includes(search.toLowerCase()) ||
                          (q.userName?.toLowerCase() || "").includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "resolved" && q.status === "resolved") || 
                          (statusFilter === "open" && q.status !== "resolved");
    return matchesSearch && matchesStatus;
  });

  const handleResolve = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "support_queries", id), { status: "resolved" });
      if (selectedQuery && selectedQuery.id === id) {
         setSelectedQuery({ ...selectedQuery, status: "resolved" });
      }
      toast.success(t('ticket_resolved', 'Ticket marked as resolved'));
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

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedQuery || !user) return;
    const currentReply = replyText.trim();
    setReplyText("");
    setSending(true);

    try {
      // 1. Add support reply into 'messages'
      await addDoc(collection(db, "messages"), {
        relatedId: selectedQuery.id,
        senderId: user.uid,
        receiverId: selectedQuery.userId,
        senderType: 'admin',
        text: currentReply,
        createdAt: serverTimestamp()
      });

      // 2. Queue app notification for receiver (pharmacist/patient)
      await addDoc(collection(db, 'notifications'), {
        userId: selectedQuery.userId,
        type: 'support_reply',
        title: t('support_notification_title', 'New message from Admin'),
        message: currentReply.substring(0, 100) + (currentReply.length > 100 ? '...' : ''),
        isRead: false,
        relatedId: selectedQuery.id,
        createdAt: serverTimestamp()
      });

      toast.success(t('reply_sent', 'Reply sent successfully!'));
    } catch (err) {
      console.error("Error sending support reply: ", err);
      toast.error(t('failed_to_send_reply', 'Failed to send reply'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Upper bar */}
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-4">
              <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="font-bold text-gray-900 dark:text-white text-2xl"> {t('customer_support', 'Customer Support')} </h1>
                    {openCount > 0 && (
                      <span className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm animate-pulse">
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
                     placeholder={t('search_subject_or_user_id', 'Search subject, client name...')} 
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
                     className="bg-white dark:bg-zinc-950 border border-slate-200 py-2.5 pl-10 pr-8 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none appearance-none transition text-slate-700 font-medium cursor-pointer"
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
                                    <div>
                                       <span className="font-bold text-gray-800 block text-xs">{q.userName || 'Pharmacy Client'}</span>
                                       <span className="font-mono text-[10px] text-gray-400">{q.userId?.slice(0,8)} ({q.userRole || 'pharmacist'})</span>
                                    </div>
                                  </div>
                               </td>
                               <td className="py-4 px-6">
                                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{q.subject || 'No Subject'}</p>
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
                                      {t('chat_now', 'Chat Now')} &rarr; </button>
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

      {/* Real-time Support Chat Modal */}
      {selectedQuery && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-950 rounded-3xl w-full max-w-3xl h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-zinc-800">
               {/* Modal Header */}
               <div className="flex justify-between items-start p-6 border-b border-gray-100 dark:border-zinc-900 bg-gray-50/50 dark:bg-zinc-900/10 shrink-0">
                  <div>
                     <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                       {selectedQuery.subject || 'Support Ticket'}
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                           selectedQuery.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                       }`}>
                           {selectedQuery.status === 'resolved' ? t('resolved', 'Resolved') : t('open', 'Open')}
                       </span>
                     </h2>
                     <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
                       <span> {t('client_name', 'Client:')} <span className="font-bold text-gray-800">{selectedQuery.userName || 'Pharmacy'}</span></span>
                       <span> {t('user_id_short', 'ID:')} <span className="font-mono font-bold">{selectedQuery.userId}</span></span>
                       {parseDate(selectedQuery.createdAt) && (
                         <span> {t('date', 'Opened:')} {parseDate(selectedQuery.createdAt)!.toLocaleString()}</span>
                       )}
                     </div>
                  </div>
                  <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-700 bg-white dark:bg-zinc-900 shadow-sm border border-gray-100 dark:border-zinc-850 rounded-full p-2.5 transition">
                     <X size={18} />
                  </button>
               </div>

               {/* Messages Pane */}
               <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                  {/* First Ticket message */}
                  <div className="flex justify-start">
                     <div className="max-w-[85%] rounded-2xl p-4 bg-blue-50/60 text-slate-800 border border-blue-100/50 rounded-tl-sm shadow-sm">
                        <p className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider mb-1">📢 {t('initial_issue_desc', 'Initial Report')}</p>
                        <p className="text-sm font-medium leading-relaxed">{selectedQuery.message}</p>
                        <p className="text-[10px] mt-2 text-slate-400 font-semibold">
                          {parseDate(selectedQuery.createdAt) ? parseDate(selectedQuery.createdAt)!.toLocaleString() : ''}
                        </p>
                     </div>
                  </div>

                  {/* Chat messages */}
                  {messages.map((msg) => {
                     const isAdmin = msg.senderType === 'admin';
                     return (
                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[75%] rounded-2xl p-4 ${
                              isAdmin ? 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-100' : 'bg-white dark:bg-zinc-950 text-gray-850 dark:text-slate-100 rounded-bl-sm border border-gray-100 dark:border-zinc-850 shadow-sm'
                           }`}>
                              {!isAdmin && (
                                <p className="text-[9px] font-extrabold text-indigo-500 uppercase tracking-widest mb-1">{selectedQuery.userName || 'Client'}</p>
                              )}
                              <p className="text-sm leading-relaxed">{msg.text}</p>
                              <p className={`text-[10px] mt-2 font-medium ${isAdmin ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                 {parseDate(msg.createdAt) ? parseDate(msg.createdAt)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('now', 'Now')}
                              </p>
                           </div>
                        </div>
                     );
                  })}
                  <div ref={chatBottomRef} />
               </div>

               {/* Reply Box at the Bottom of Modal */}
               <div className="p-4 bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-900 flex gap-2.5 items-center shrink-0">
                  <input 
                    type="text"
                    disabled={selectedQuery.status === 'resolved'}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder={selectedQuery.status === 'resolved' ? t('ticket_resolved_chat_warning', 'This ticket is marked as resolved.') : t('type_your_reply', 'Type your reply message...')}
                    className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-850 py-3 px-5 rounded-full text-sm outline-none focus:border-indigo-400 disabled:opacity-50"
                  />
                  
                  {selectedQuery.status !== 'resolved' && (
                     <button 
                       onClick={(e) => handleResolve(e as any, selectedQuery.id)} 
                       className="px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full transition whitespace-nowrap shrink-0"
                     >
                        {t('mark_as_resolved', 'Resolve')}
                     </button>
                  )}

                  <button 
                    disabled={selectedQuery.status === 'resolved' || !replyText.trim() || sending}
                    onClick={handleSendReply}
                    className="w-12 h-12 bg-indigo-600 text-white hover:bg-indigo-700 rounded-full flex items-center justify-center shadow-md shadow-indigo-100 transition shrink-0 disabled:opacity-40"
                  >
                     {sending ? (
                        <Loader2 size={16} className="animate-spin" />
                     ) : (
                        <Send size={16} className="translate-x-0.5" />
                     )}
                  </button>
               </div>
            </div>
        </div>
      )}
    </div>
  );
}
