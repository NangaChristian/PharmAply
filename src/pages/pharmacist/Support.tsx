import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Plus, CheckCircle, Clock, AlertCircle, MessageSquare, HelpCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, orderBy, updateDoc, doc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { parseDate } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import toast from "react-hot-toast";

export function PharmacistSupport() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const { t } = useTranslation();
  
  const [queries, setQueries] = useState<any[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingQueries, setLoadingQueries] = useState(true);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Fetch pharmacist's pharmacy info for name context
  useEffect(() => {
    if (!user) return;
    const fetchPharm = async () => {
      const q = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setPharmacies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    };
    fetchPharm();
  }, [user]);

  // Sync Support Queries (tickets) for this pharmacist
  useEffect(() => {
    if (!user) return;
    
    // Support queries where userId matches pharmacist's uid
    const q = query(
      collection(db, "support_queries"),
      where("userId", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQueries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory decreasing of createdAt date
      fetchedQueries.sort((a, b) => {
        const timeA = parseDate(a.createdAt)?.getTime() || 0;
        const timeB = parseDate(b.createdAt)?.getTime() || 0;
        return timeB - timeA;
      });
      setQueries(fetchedQueries);
      setLoadingQueries(false);
    }, (error) => {
      console.error("Support queries sync failed: ", error);
      setLoadingQueries(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Chat Messages of current active ticket/query
  useEffect(() => {
    if (!selectedQueryId) {
      setMessages([]);
      return;
    }

    const mQuery = query(
      collection(db, "messages"),
      where("relatedId", "==", selectedQueryId)
    );

    const unsub = onSnapshot(mQuery, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedMessages.sort((a, b) => {
        const timeA = parseDate(a.createdAt)?.getTime() || 0;
        const timeB = parseDate(b.createdAt)?.getTime() || 0;
        return timeA - timeB;
      });
      setMessages(fetchedMessages);
    }, (error) => {
      console.error("Chat messages sync failed: ", error);
    });

    return () => unsub();
  }, [selectedQueryId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeTicket = queries.find(q => q.id === selectedQueryId);

  // Open a new support ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim() || !user) return;
    setSubmitting(true);

    try {
      const pharmName = pharmacies[0]?.name || userData?.name || user.displayName || "Pharmacy Manager";
      
      const newQueryDoc = {
        userId: user.uid,
        userName: pharmName,
        userRole: 'pharmacist',
        subject: newSubject.trim(),
        message: newMessage.trim(),
        status: 'open',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'support_queries'), newQueryDoc);
      
      // Auto-insert first chat message with pharmacist's question
      await addDoc(collection(db, 'messages'), {
        relatedId: docRef.id,
        senderId: user.uid,
        receiverId: 'admin',
        senderType: 'pharmacist',
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });

      // Notify the Administrator via general notification logs table
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        type: 'support_query',
        title: 'New Pharmacy Support Ticket',
        message: `${pharmName} submitted support ticket: "${newSubject.trim()}"`,
        isRead: false,
        relatedId: docRef.id,
        createdAt: serverTimestamp()
      });

      toast.success(t('support_ticket_created', 'Support ticket opened successfully!'));
      setNewSubject("");
      setNewMessage("");
      setShowNewTicketModal(false);
      setSelectedQueryId(docRef.id);
    } catch (error) {
      console.error("Error creating support ticket: ", error);
      toast.error(t('failed_to_create_ticket', 'Failed to open support ticket.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Send a new live chat message inside ticket
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedQueryId || !user) return;
    const textToSend = chatInput.trim();
    setChatInput("");

    try {
      await addDoc(collection(db, 'messages'), {
        relatedId: selectedQueryId,
        senderId: user.uid,
        receiverId: 'admin',
        senderType: 'pharmacist',
        text: textToSend,
        createdAt: serverTimestamp()
      });

      // Optional: Bump the query updatedAt timestamp
      await updateDoc(doc(db, 'support_queries', selectedQueryId), {
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending support message: ", error);
      toast.error(t('failed_to_send', 'Message failed to send.'));
    }
  };

  return (
    <div className="flex-1 bg-transparent flex flex-col h-full overflow-hidden">
      {/* Top Header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between z-10 shrink-0">
         <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700">
               <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
            </button>
            <div>
                 <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight">
                   {t('support_technique', 'Support & Assistance')}
                </h1>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  {t('chat_with_admins', 'Real-time chat with administration')}
                </p>
            </div>
         </div>
         <button 
           onClick={() => setShowNewTicketModal(true)} 
           className="px-5 py-2.5 bg-[#0B3B3C] text-white rounded-full text-sm font-bold hover:bg-[#082a2b] transition flex items-center gap-2 shadow-sm"
         >
           <Plus size={16} />
           {t('new_ticket', 'New Ticket')}
         </button>
      </div>

      <div className="flex-1 flex overflow-hidden px-8 pb-8 gap-4 custom-scrollbar">
         {/* Sidebar with Query List */}
         <div className={`w-full md:w-[320px] flex flex-col bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm rounded-3xl overflow-hidden shrink-0 ${selectedQueryId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-5 border-b border-gray-100 dark:border-slate-700 bg-[#FAFBFC] dark:bg-slate-900/50">
               <h2 className="font-bold text-[#0B3B3C] dark:text-gray-200 text-sm">{t('un_mes_ticket', 'Your Tickets')} ({queries.length})</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700 custom-scrollbar">
               {loadingQueries ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    <Loader2 size={18} className="animate-spin mx-auto mb-3 text-[#0B3B3C]" />
                    {t('loading_tickets', 'Synching tickets...')}
                  </div>
               ) : queries.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500 flex flex-col items-center gap-3 mt-4">
                     <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
                        <HelpCircle size={24} className="text-gray-300 dark:text-slate-600" />
                     </div>
                     <p className="font-bold text-gray-900 dark:text-white">{t('no_tickets_yet', 'No tickets opened yet.')}</p>
                     <p className="text-xs leading-relaxed">{t('no_tickets_desc', 'Click "New Ticket" to chat with an admin about any platform issues.')}</p>
                  </div>
               ) : (
                  queries.map((q) => {
                     const isSelected = q.id === selectedQueryId;
                     const isResolved = q.status === 'resolved';
                     return (
                        <div 
                          key={q.id}
                          onClick={() => setSelectedQueryId(q.id)}
                          className={`p-5 transition-colors cursor-pointer text-left flex flex-col gap-2 ${isSelected ? 'bg-[#FAFBFC] dark:bg-slate-900' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                        >
                           <div className="flex justify-between items-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                 isResolved ? 'bg-[#D3F5A8]/50 text-[#0B3B3C] border-[#D3F5A8]' : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                 {isResolved ? t('resolved', 'Resolved') : t('open', 'Open')}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                 {parseDate(q.createdAt) ? parseDate(q.createdAt)!.toLocaleDateString() : ''}
                              </span>
                           </div>
                           <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{q.subject}</h3>
                           <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{q.message}</p>
                        </div>
                     );
                  })
               )}
            </div>
         </div>

         {/* Chat Workspace */}
         <div className={`flex-1 flex flex-col border border-gray-100 dark:border-slate-700 shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-800 ${!selectedQueryId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
            {selectedQueryId && activeTicket ? (
               <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                  {/* Active Ticket Header */}
                  <div className="px-6 py-5 bg-[#FAFBFC] dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedQueryId(null)} className="md:hidden w-10 h-10 border border-gray-200 bg-white rounded-full flex items-center justify-center text-gray-600">
                          <ArrowLeft size={18} />
                        </button>
                        <div>
                           <div className="flex items-center gap-3">
                             <h2 className="font-bold text-base text-gray-900 dark:text-white max-w-[200px] sm:max-w-md truncate">{activeTicket.subject}</h2>
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                 activeTicket.status === 'resolved' ? 'bg-[#D3F5A8]/50 text-[#0B3B3C] border-[#D3F5A8]' : 'bg-amber-50 text-amber-700 border-amber-100'
                             }`}>
                                 {activeTicket.status === 'resolved' ? t('resolved', 'Resolved') : t('open', 'Open')}
                             </span>
                           </div>
                           <p className="text-xs text-gray-500 font-medium mt-1">Ticket #{activeTicket.id?.substring(0, 8).toUpperCase()}</p>
                        </div>
                     </div>
                  </div>

                  {/* Messages Stream */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar pb-24">
                     {/* Base Query/Ticket message from system/manager */}
                     <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl p-5 bg-[#FAFBFC] dark:bg-slate-900 text-gray-800 dark:text-slate-100 rounded-tl-sm border border-gray-200 dark:border-slate-700 shadow-sm">
                           <p className="text-xs font-bold text-[#0B3B3C] dark:text-gray-300 mb-2 uppercase tracking-wider">💡 {t('ticket_initial_subject', 'Initial Query')}</p>
                           <p className="text-sm font-medium leading-relaxed">{activeTicket.message}</p>
                           <p className="text-xs mt-3 font-semibold text-gray-400">
                              {parseDate(activeTicket.createdAt) ? parseDate(activeTicket.createdAt)!.toLocaleString() : ''}
                           </p>
                        </div>
                     </div>

                     {messages.map((msg) => {
                        const isMe = msg.senderId === user?.uid;
                        return (
                           <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] rounded-2xl p-4 ${
                                 isMe ? 'bg-[#0B3B3C] text-white rounded-br-sm shadow-sm' : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 rounded-bl-sm border border-gray-100 dark:border-slate-600 shadow-sm'
                              }`}>
                                 {!isMe && (
                                   <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">{t('administrator', 'Admin')}</p>
                                 )}
                                 <p className="text-sm leading-relaxed">{msg.text}</p>
                                 <p className={`text-[10px] mt-2 font-medium ${isMe ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {parseDate(msg.createdAt) ? parseDate(msg.createdAt)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('now', 'Now')}
                                 </p>
                              </div>
                           </div>
                        );
                     })}
                     <div ref={messageEndRef} />
                  </div>

                  {/* Message Input Box */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md dark:bg-slate-800/90 border-t border-gray-100 dark:border-slate-700 p-5 px-6 z-20 flex gap-3 items-center">
                     <input 
                       disabled={activeTicket.status === 'resolved'}
                       type="text"
                       value={chatInput}
                       onChange={(e) => setChatInput(e.target.value)}
                       onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                       placeholder={activeTicket.status === 'resolved' ? t('ticket_resolved_chat_warning', 'This ticket is marked as resolved.') : t('type_your_message', 'Type your message...')}
                       className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-full py-3.5 px-6 text-sm font-medium focus:outline-none focus:border-[#0B3B3C] disabled:opacity-50 transition-colors"
                     />
                     <button 
                       disabled={activeTicket.status === 'resolved' || !chatInput.trim()}
                       onClick={handleSendMessage} 
                       className="w-12 h-12 bg-[#0B3B3C] text-white rounded-full flex items-center justify-center shadow-sm hover:bg-[#082a2b] transition shrink-0 disabled:opacity-50"
                     >
                        <Send size={18} className="translate-x-0.5" />
                     </button>
                  </div>
               </div>
            ) : (
               <div className="text-center p-12 text-gray-400 dark:text-gray-500 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
                    <MessageSquare size={32} className="text-gray-300 dark:text-slate-600 stroke-[1.5]" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('select_a_conversations', 'Select a support ticket')}</h3>
                  <p className="text-sm">{t('select_conversations_desc', 'Choose a ticket from the left column to view message thread.')}</p>
               </div>
            )}
         </div>
      </div>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {showNewTicketModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl relative border border-gray-100 dark:border-slate-700"
            >
               <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('nouvelle_demande_support', 'Submit Issue to Admin')}</h2>
               <p className="text-sm font-medium text-gray-500 mb-8">{t('support_sub_desc', 'Open a support card. Administrators will assist you in real-time.')}</p>
               
               <form onSubmit={handleCreateTicket} className="space-y-5">
                  <div>
                     <label className="block text-sm font-bold text-[#0B3B3C] dark:text-gray-300 mb-2">{t('sujet_probleme', 'Subject / Topic')}</label>
                     <select 
                       value={newSubject}
                       onChange={(e) => setNewSubject(e.target.value)}
                       required
                       className="w-full border border-gray-200 dark:border-slate-700 p-4 rounded-xl bg-[#FAFBFC] dark:bg-slate-900 text-sm font-medium focus:border-gray-400 outline-none transition"
                     >
                       <option value="">{t('select_issue_type', 'What is the issue about?')}</option>
                       <option value="Problème de Paiement">{t('payment_issue', 'Payment & Payout / Finances')}</option>
                       <option value="Erreur de Stock ou Inventaire">{t('stock_error', 'Stock & Inventory Synchronization')}</option>
                       <option value="Retard de validation KYC">{t('kyc_delay', 'KYC & Approval Request Delay')}</option>
                       <option value="Bug de l'application">{t('app_bug', 'Technical Bug or Offline Warning')}</option>
                       <option value="Autre demande">{t('other_request', 'Other Request')}</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-sm font-bold text-[#0B3B3C] dark:text-gray-300 mb-2">{t('details_explication', 'Detailed Explanation')}</label>
                     <textarea 
                       value={newMessage}
                       onChange={(e) => setNewMessage(e.target.value)}
                       required
                       placeholder={t('explain_problem_placeholder', 'Please provide error messages, order IDs or other details to help us investigate...')}
                       className="w-full border border-gray-200 dark:border-slate-700 p-4 rounded-xl bg-[#FAFBFC] dark:bg-slate-900 text-sm font-medium focus:border-gray-400 outline-none h-32 resize-none"
                     ></textarea>
                  </div>

                  <div className="flex gap-4 pt-4">
                     <button 
                       type="button"
                       onClick={() => setShowNewTicketModal(false)}
                       disabled={submitting}
                       className="flex-1 py-4 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold transition hover:bg-gray-50 focus:outline-none"
                     >
                       {t('cancel', 'Cancel')}
                     </button>
                     <button 
                       type="submit"
                       disabled={submitting || !newSubject || !newMessage.trim()}
                       className="flex-1 py-4 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 focus:outline-none"
                     >
                       {submitting && <Loader2 size={16} className="animate-spin" />}
                       {t('submit', 'Send Ticket')}
                     </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
