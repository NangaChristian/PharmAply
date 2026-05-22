import { useState, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { parseDate } from "../../lib/utils";

export function Messages() {
  const navigate = useNavigate();
  const { id } = useParams(); // assuming this is orderId for chat
  const { user, role } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [tableError, setTableError] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    
    const q = query(
        collection(db, 'messages'),
        where('orderId', '==', id)
    );

    const unsub = onSnapshot(q, (snapshot: any) => {
        const fetchedMessages = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        // Sort in memory to avoid needing composite indexes
        fetchedMessages.sort((a: any, b: any) => {
           const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : Date.now()));
           const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : Date.now()));
           return timeA - timeB;
        });
        setMessages(fetchedMessages);
        setTableError(false);
    }, (error: any) => {
        console.error("Messages sync error: ", error);
        setTableError(true); // Fallback on ANY error (RLS, missing table, etc)
        const localMsgs = localStorage.getItem(`local_messages_${id}`);
        if (localMsgs) {
            setMessages(JSON.parse(localMsgs));
        }
    });

    return () => unsub();
  }, [user, id]);

  const handleSend = async () => {
    if (!input.trim() || !user || !id) return;
    
    const msgText = input;
    setInput("");

    try {
        if (tableError) {
             throw new Error("Table error fallback active");
        }

        await addDoc(collection(db, 'messages'), {
            orderId: id,
            patientId: role === 'patient' ? user.uid : '',
            senderId: user.uid,
            senderType: role || 'unknown',
            text: msgText,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending message, using local fallback: ", error);
        setTableError(true);
        const newLocalMsg = {
             id: Math.random().toString(36).substring(7),
             orderId: id,
             patientId: role === 'patient' ? user.uid : 'client-id',
             senderId: user.uid,
             senderType: role || 'unknown',
             text: msgText,
             createdAt: new Date().toISOString()
        };
        const updatedMsgs = [...messages, newLocalMsg];
        setMessages(updatedMsgs);
        localStorage.setItem(`local_messages_${id}`, JSON.stringify(updatedMsgs));
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800">
         <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full">
               <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
            </button>
            <div>
               <h1 className="font-bold text-gray-900 dark:text-white text-sm">
                  {role === 'pharmacist' || role === 'delivery' ? t('contact_patient', 'Contact Patient') : t('contact_driver', 'Contact Driver')}
               </h1>
               <p className="text-xs text-green-500 font-medium tracking-wide">{t('online', 'Online')}</p>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-24">
         {tableError && (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 text-yellow-800 dark:text-yellow-400 p-4 rounded-xl text-sm mb-4">
                 <strong>Database Setup Required:</strong> The <code>messages</code> table is missing in Supabase. You are currently using <strong>local offline storage</strong> for this chat.
                 <br className="mb-2"/>
                 To enable cloud sync, execute the following SQL in your Supabase SQL Editor:
                 <pre className="mt-2 p-3 bg-yellow-100 dark:bg-yellow-500/20 rounded font-mono text-[11px] overflow-x-auto text-yellow-900 dark:text-yellow-200">
{`CREATE TABLE public.messages (
  id TEXT PRIMARY KEY,
  patientId TEXT NOT NULL,
  senderId TEXT NOT NULL,
  senderType TEXT NOT NULL,
  orderId TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT now()
);`}
                 </pre>
              </div>
          )}
         {messages.length === 0 ? (
             <div className="text-center text-gray-400 dark:text-gray-500 mt-10">
                 {t('no_messages_yet', 'No messages yet. Say hi!')}
             </div>
         ) : null}
         {messages.map(msg => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[75%] rounded-2xl p-4 ${
                    isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-black text-gray-800 dark:text-slate-100 rounded-bl-sm border border-gray-100 dark:border-zinc-800 shadow-sm'
                 }`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p className={`text-[10px] mt-2 font-medium ${isMe ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                       {parseDate(msg.createdAt) ? parseDate(msg.createdAt)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('now', 'Now')}
                    </p>
                 </div>
              </div>
            );
         })}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-100 dark:border-zinc-800 p-4 px-6 z-20 flex gap-2 items-center">
         <input 
           type="text"
           value={input}
           onChange={(e) => setInput(e.target.value)}
           onKeyPress={(e) => e.key === 'Enter' && handleSend()}
           placeholder={t('type_your_message', 'Type your message...')}
           className="flex-1 bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-full py-3 px-6 text-sm focus:outline-none focus:border-indigo-300"
         />
         <button onClick={handleSend} className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-md">
            <Send size={18} className="translate-x-0.5" />
         </button>
      </div>
    </div>
  );
}
