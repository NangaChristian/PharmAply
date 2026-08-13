import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Phone, User, Store, Bike, Package } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, getDoc, doc 
} from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { parseDate } from "../../lib/utils";
import toast from "react-hot-toast";

export function Messages() {
  const navigate = useNavigate();
  const { id } = useParams(); // orderId or prescriptionId
  const { user, role } = useAuth();
  const { t } = useTranslation();

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextItem, setContextItem] = useState<any>(null);
  
  const [partnerName, setPartnerName] = useState<string>("");
  const [partnerRole, setPartnerRole] = useState<string>("");
  const [partnerPhone, setPartnerPhone] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch Order/Prescription context & partner details
  useEffect(() => {
    if (!id || !user) return;
    setLoadingContext(true);

    const fetchContext = async () => {
      try {
        // Try fetching order first
        const orderSnap = await getDoc(doc(db, 'orders', id));
        if (orderSnap.exists()) {
          const oData = { type: 'Commande', id: orderSnap.id, ...orderSnap.data() };
          setContextItem(oData);

          if (role === 'patient') {
            // Patient talking to Driver or Pharmacy
            if (oData.driverId) {
              let name = oData.driverName;
              let phone = oData.driverPhone;
              if (!name || !phone) {
                try {
                  const dSnap = await getDoc(doc(db, 'drivers', oData.driverId));
                  if (dSnap.exists()) {
                    name = name || dSnap.data().name || dSnap.data().fullName;
                    phone = phone || dSnap.data().phone || dSnap.data().phoneNumber;
                  }
                  if (!name) {
                    const uSnap = await getDoc(doc(db, 'users', oData.driverId));
                    if (uSnap.exists()) {
                      name = uSnap.data().name || uSnap.data().fullName;
                      phone = phone || uSnap.data().phone;
                    }
                  }
                } catch (e) {
                  console.warn("Could not fetch driver user:", e);
                }
              }
              setPartnerName(name || "Livreur");
              setPartnerRole("Livreur");
              setPartnerPhone(phone || "");
            } else if (oData.pharmacyId) {
              let name = oData.pharmacyName;
              let phone = oData.pharmacyPhone;
              if (!name) {
                try {
                  const pSnap = await getDoc(doc(db, 'pharmacies', oData.pharmacyId));
                  if (pSnap.exists()) {
                    name = pSnap.data().name || pSnap.data().pharmacyName;
                    phone = phone || pSnap.data().phone;
                  }
                } catch (e) {
                  console.warn("Could not fetch pharmacy:", e);
                }
              }
              setPartnerName(name || "Pharmacie");
              setPartnerRole("Pharmacie");
              setPartnerPhone(phone || "");
            } else {
              setPartnerName("Pharmacie / Livreur");
              setPartnerRole("Support");
            }
          } else if (role === 'pharmacist' || role === 'pharmacy') {
            // Pharmacist talking to Patient
            let name = oData.patientName;
            let phone = oData.patientPhone;
            if (!name && oData.patientId) {
              try {
                const uSnap = await getDoc(doc(db, 'users', oData.patientId));
                if (uSnap.exists()) {
                  name = uSnap.data().name || uSnap.data().fullName;
                  phone = phone || uSnap.data().phone;
                }
              } catch (e) {
                console.warn("Could not fetch patient user:", e);
              }
            }
            setPartnerName(name || "Client");
            setPartnerRole("Client");
            setPartnerPhone(phone || "");
          } else if (role === 'delivery' || role === 'driver') {
            // Driver talking to Patient
            let name = oData.patientName;
            let phone = oData.patientPhone;
            if (!name && oData.patientId) {
              try {
                const uSnap = await getDoc(doc(db, 'users', oData.patientId));
                if (uSnap.exists()) {
                  name = uSnap.data().name || uSnap.data().fullName;
                  phone = phone || uSnap.data().phone;
                }
              } catch (e) {
                console.warn("Could not fetch patient user:", e);
              }
            }
            setPartnerName(name || "Client");
            setPartnerRole("Client");
            setPartnerPhone(phone || "");
          } else {
            setPartnerName(oData.patientName || oData.pharmacyName || "Discussion");
            setPartnerRole("Contact");
          }
        } else {
          // Try fetching prescription
          const pSnap = await getDoc(doc(db, 'prescriptions', id));
          if (pSnap.exists()) {
            const pData = { type: 'Ordonnance', id: pSnap.id, ...pSnap.data() };
            setContextItem(pData);

            if (role === 'patient') {
              setPartnerName(pData.pharmacyName || "Pharmacie");
              setPartnerRole("Pharmacie");
            } else {
              let name = pData.patientName;
              if (!name && pData.patientId) {
                try {
                  const uSnap = await getDoc(doc(db, 'users', pData.patientId));
                  if (uSnap.exists()) name = uSnap.data().name || uSnap.data().fullName;
                } catch (e) {}
              }
              setPartnerName(name || "Client");
              setPartnerRole("Client");
            }
          } else {
            setPartnerName("Discussion");
            setPartnerRole("Message");
          }
        }
      } catch (err) {
        console.error("Error fetching chat context:", err);
        setPartnerName("Discussion");
        setPartnerRole("Message");
      } finally {
        setLoadingContext(false);
      }
    };

    fetchContext();
  }, [id, user, role]);

  // 2. Realtime listener for messages in Firestore
  useEffect(() => {
    if (!user || !id) return;

    const q = query(
      collection(db, 'messages'),
      where('relatedId', '==', id)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        fetched.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
          return timeA - timeB;
        });
        setMessages(fetched);
      },
      (error) => {
        console.error("Messages sync error:", error);
      }
    );

    return () => unsub();
  }, [user, id]);

  const getReceiverId = () => {
    if (!contextItem) return 'unknown';
    if (role === 'patient') {
      return contextItem.driverId || contextItem.pharmacyId || 'unknown';
    }
    return contextItem.patientId || 'unknown';
  };

  const handleSend = async () => {
    if (!input.trim() || !user || !id) return;

    const msgText = input.trim();
    setInput("");

    try {
      const receiverId = getReceiverId();
      await addDoc(collection(db, 'messages'), {
        relatedId: id,
        patientId: contextItem?.patientId || (role === 'patient' ? user.uid : ''),
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Utilisateur',
        receiverId,
        senderType: role || 'user',
        text: msgText,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending message to Firestore:", error);
      toast.error("Échec d'envoi du message");
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-full hover:bg-gray-100 transition"
          >
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
              {partnerRole === 'Livreur' ? <Bike size={20} /> : partnerRole === 'Pharmacie' ? <Store size={20} /> : <User size={20} />}
            </div>

            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                {loadingContext ? (
                  <span className="inline-block w-28 h-4 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
                ) : (
                  partnerName || "Discussion"
                )}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  {partnerRole ? `${partnerRole} • En ligne` : 'En ligne'}
                </span>
                {contextItem && (
                  <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
                    #{id?.substring(0, 6).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {partnerPhone && (
          <a 
            href={`tel:${partnerPhone}`}
            className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center hover:bg-teal-100 transition"
            title="Appeler"
          >
            <Phone size={18} />
          </a>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-24">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400 dark:text-gray-500">
            <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
              <Package size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium">{t('no_messages_yet', 'Aucun message pour l\'instant. Dites bonjour !')}</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl p-3.5 shadow-sm ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-slate-100 rounded-bl-none border border-gray-100 dark:border-zinc-800'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[10px] mt-1.5 font-medium text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {parseDate(msg.createdAt) 
                      ? parseDate(msg.createdAt)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : t('now', 'À l\'instant')}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-100 dark:border-zinc-800 p-4 px-6 z-20 flex gap-2 items-center">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t('type_your_message', 'Saisissez votre message...')}
          className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-full py-3 px-6 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 transition"
        />
        <button 
          onClick={handleSend} 
          disabled={!input.trim()}
          className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-full flex items-center justify-center shadow-md transition"
        >
          <Send size={18} className="translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
