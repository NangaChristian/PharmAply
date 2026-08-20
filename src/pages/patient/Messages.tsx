import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  ArrowLeft, Send, Phone, User, Store, Bike, Package, 
  ShieldCheck, CheckCheck, Search, Headphones, MessageCircle, 
  ChevronRight, Clock, FileText, AlertCircle
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, getDoc, doc, getDocs, limit, orderBy
} from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { parseDate, formatCurrency } from "../../lib/utils";
import { useTheme } from "../../components/ThemeProvider";
import { DarkModeToggle } from "../../components/DarkModeToggle";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useUserProfiles } from "../../lib/userSync";
import { UserAvatar } from "../../components/common/UserAvatar";
import toast from "react-hot-toast";

interface ConversationItem {
  id: string; // can be orderId, userId, supportId
  type: 'order' | 'driver' | 'patient' | 'support';
  title: string;
  subtitle: string;
  roleBadge: string;
  phone?: string;
  photoUrl?: string;
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: number;
  orderNumber?: string;
  orderStatus?: string;
  partnerId?: string;
  partnerType?: 'patient' | 'driver' | 'pharmacist' | 'admin';
}

export function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: rawRouteId } = useParams();
  const { user, role, userData } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();

  // Role detection
  const rawRole = (role || userData?.role || '').toLowerCase();
  const isPharmacist = ['pharmacist', 'pharmacy', 'vendor', 'team_member', 'team', 'staff', 'cashier'].some(r => rawRole.includes(r)) || location.pathname.startsWith('/pharmacist');
  const isDriver = ['delivery', 'driver', 'courier', 'livreur'].some(r => rawRole.includes(r)) || location.pathname.startsWith('/delivery');
  const isAdmin = ['admin', 'superadmin', 'manager'].some(r => rawRole.includes(r)) || location.pathname.startsWith('/admin');
  const isPatient = !isPharmacist && !isDriver && !isAdmin;

  // Sanitize route ID
  const routeId = useMemo(() => {
    if (!rawRouteId) return "";
    const decoded = decodeURIComponent(String(rawRouteId)).trim();
    if (decoded === "[object Object]" || decoded === "undefined" || decoded === "null") {
      return "";
    }
    return decoded;
  }, [rawRouteId]);

  const [activeId, setActiveId] = useState<string>(routeId);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'patients' | 'drivers' | 'support'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState<boolean>(!!routeId);

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [activePartner, setActivePartner] = useState<ConversationItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Synchronize routeId with activeId
  useEffect(() => {
    if (routeId) {
      setActiveId(routeId);
      setMobileShowChat(true);
    }
  }, [routeId]);

  // Collect partner IDs for real-time user profile resolution
  const userIdsToResolve = useMemo(() => {
    const ids = new Set<string>();
    conversations.forEach(c => {
      if (c.partnerId && c.partnerId !== 'admin_support' && c.partnerId !== 'patient' && c.partnerId !== 'driver') {
        ids.add(c.partnerId);
      }
    });
    messages.forEach(m => {
      if (m.senderId) ids.add(m.senderId);
      if (m.receiverId && m.receiverId !== 'recipient') ids.add(m.receiverId);
    });
    return Array.from(ids);
  }, [conversations, messages]);

  const userProfiles = useUserProfiles(userIdsToResolve);

  // Load all Conversations list according to the active role
  useEffect(() => {
    if (!user) return;

    let unsubscribeOrders: () => void;
    let unsubscribeMessages: () => void;

    const loadConversations = async () => {
      try {
        // Resolve pharmacy ID if pharmacist
        let pharmacyId = user.uid;
        if (isPharmacist) {
          try {
            const pQuery = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
            const pSnap = await getDocs(pQuery);
            if (!pSnap.empty) {
              pharmacyId = pSnap.docs[0].id;
            }
          } catch(e) {}
        }

        // 1. Prepare fixed Support conversation for everyone
        const supportItem: ConversationItem = {
          id: `support_${user.uid}`,
          type: 'support',
          title: t('support_client_admin', "Support Client Admin"),
          subtitle: t('direct_admin_contact', "Contact direct avec l'administrateur 24/7"),
          roleBadge: t('support_admin', "Support Admin"),
          photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
          partnerId: "admin_support",
          partnerType: "admin"
        };

        // 2. Fetch Orders for conversations
        let ordersQ;
        if (isPharmacist) {
          ordersQ = query(collection(db, 'orders'), where('pharmacyId', '==', pharmacyId), limit(40));
        } else if (isDriver) {
          ordersQ = query(collection(db, 'orders'), where('driverId', '==', user.uid), limit(40));
        } else {
          ordersQ = query(collection(db, 'orders'), where('patientId', '==', user.uid), limit(40));
        }

        unsubscribeOrders = onSnapshot(ordersQ, async (snapshot) => {
          const orderDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          const itemsMap = new Map<string, ConversationItem>();

          // Insert support first
          itemsMap.set(supportItem.id, supportItem);

          for (const ord of orderDocs as any[]) {
            const orderShortCode = ord.id.slice(0, 6).toUpperCase();

            if (isPharmacist) {
              // Conversation with Patient
              const patientKey = ord.id;
              itemsMap.set(patientKey, {
                id: ord.id,
                type: 'patient',
                title: ord.patientName || `Patient #${orderShortCode}`,
                subtitle: `Commande #${orderShortCode} • ${ord.totalAmount ? formatCurrency(ord.totalAmount) : (ord.items?.length || 1) + ' article(s)'}`,
                roleBadge: t('patient', "Patient"),
                phone: ord.patientPhone || "",
                photoUrl: ord.patientPhoto || ord.patientPhotoUrl || "",
                orderNumber: orderShortCode,
                orderStatus: ord.status,
                partnerId: ord.patientId || ord.userId || 'patient',
                partnerType: 'patient'
              });

              // Conversation with Driver if assigned
              if (ord.driverId || ord.driverName) {
                const driverKey = `driver_${ord.id}`;
                itemsMap.set(driverKey, {
                  id: ord.id,
                  type: 'driver',
                  title: ord.driverName || t('driver', "Livreur"),
                  subtitle: `Course #${orderShortCode} • ${ord.status === 'delivered' ? t('delivered', 'Livrée') : t('in_transit', 'En transit')}`,
                  roleBadge: t('driver', "Livreur"),
                  phone: ord.driverPhone || "",
                  photoUrl: ord.driverPhoto || ord.driverPhotoUrl || "",
                  orderNumber: orderShortCode,
                  orderStatus: ord.status,
                  partnerId: ord.driverId || 'driver',
                  partnerType: 'driver'
                });
              }
            } else if (isDriver) {
              // Driver views Patient and Pharmacy
              itemsMap.set(ord.id, {
                id: ord.id,
                type: 'patient',
                title: ord.patientName || `Client #${orderShortCode}`,
                subtitle: `Livraison #${orderShortCode} • ${ord.deliveryAddress || 'Douala'}`,
                roleBadge: t('patient', "Patient"),
                phone: ord.patientPhone || "",
                photoUrl: ord.patientPhoto || "",
                orderNumber: orderShortCode,
                orderStatus: ord.status,
                partnerId: ord.patientId || ord.userId || 'patient',
                partnerType: 'patient'
              });
            } else {
              // Patient views Pharmacy or Driver
              const isAssignedToDriver = ord.driverName && ['picked_up', 'out_for_delivery', 'delivered'].includes(ord.status);
              const title = isAssignedToDriver ? ord.driverName : (ord.pharmacyName || t('pharmacy', "Pharmacie"));
              const roleB = isAssignedToDriver ? t('driver', "Livreur") : t('pharmacy', "Pharmacie");

              itemsMap.set(ord.id, {
                id: ord.id,
                type: isAssignedToDriver ? 'driver' : 'patient',
                title: title,
                subtitle: `Commande #${orderShortCode} • Statut: ${ord.status || 'En cours'}`,
                roleBadge: roleB,
                phone: ord.driverPhone || ord.pharmacyPhone || "",
                photoUrl: ord.driverPhoto || ord.pharmacyPhoto || "",
                orderNumber: orderShortCode,
                orderStatus: ord.status,
                partnerId: isAssignedToDriver ? ord.driverId : ord.pharmacyId,
                partnerType: isAssignedToDriver ? 'driver' : 'pharmacist'
              });
            }
          }

          const convList = Array.from(itemsMap.values());
          setConversations(convList);

          // If no activeId, select the first available
          if (!activeId && convList.length > 0) {
            setActiveId(convList[0].id);
          }
        });
      } catch (err) {
        console.error("Error loading conversations:", err);
      }
    };

    loadConversations();

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }, [user, isPharmacist, isDriver, isPatient, t]);

  // Resolve Active Partner details
  useEffect(() => {
    if (!activeId) {
      setLoadingContext(false);
      return;
    }

    const found = conversations.find(c => c.id === activeId);
    if (found) {
      setActivePartner(found);
      setLoadingContext(false);
      return;
    }

    // Fallback: If not found in loaded list, fetch doc directly
    let isMounted = true;
    const fetchDirect = async () => {
      try {
        if (activeId.startsWith('support_')) {
          if (isMounted) {
            setActivePartner({
              id: activeId,
              type: 'support',
              title: t('support_client_admin', "Support Client Admin"),
              subtitle: t('direct_admin_contact', "Contact direct avec l'administrateur 24/7"),
              roleBadge: t('support_admin', "Support Admin"),
              partnerId: "admin_support",
              partnerType: "admin"
            });
            setLoadingContext(false);
          }
          return;
        }

        const oSnap = await getDoc(doc(db, 'orders', activeId));
        if (oSnap.exists() && isMounted) {
          const oData: any = oSnap.data();
          const orderShortCode = activeId.slice(0, 6).toUpperCase();
          setActivePartner({
            id: activeId,
            type: isPharmacist ? 'patient' : isDriver ? 'patient' : 'patient',
            title: isPharmacist ? (oData.patientName || "Patient") : (oData.pharmacyName || t('pharmacy', "Pharmacie")),
            subtitle: `Commande #${orderShortCode}`,
            roleBadge: isPharmacist ? t('patient', "Patient") : t('pharmacy', "Pharmacie"),
            phone: isPharmacist ? oData.patientPhone : oData.pharmacyPhone,
            photoUrl: isPharmacist ? oData.patientPhoto : oData.pharmacyPhoto,
            orderNumber: orderShortCode,
            partnerId: isPharmacist ? (oData.patientId || oData.userId) : oData.pharmacyId,
            partnerType: isPharmacist ? 'patient' : 'pharmacist'
          });
        }
        if (isMounted) setLoadingContext(false);
      } catch (e) {
        if (isMounted) setLoadingContext(false);
      }
    };

    fetchDirect();
    return () => { isMounted = false; };
  }, [activeId, conversations, isPharmacist, isDriver, t]);

  // Realtime listener for messages in active conversation
  useEffect(() => {
    if (!user || !activeId) return;

    const q = query(
      collection(db, 'messages'),
      where('relatedId', '==', activeId)
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
  }, [user, activeId]);

  const myPhoto = user?.photoURL || userData?.photoURL || userData?.photoUrl || userData?.avatar_url || '';
  const myDisplayName = user?.displayName || userData?.name || userData?.fullName || (isPharmacist ? t('pharmacist', 'Pharmacie') : isDriver ? t('driver', 'Livreur') : t('patient', 'Client'));

  const handleSend = async () => {
    if (!input.trim() || !user || !activeId) return;

    const msgText = input.trim();
    setInput("");

    const tempId = `temp_${Date.now()}`;
    const newMsg = {
      id: tempId,
      relatedId: activeId,
      orderId: activePartner?.type !== 'support' ? activeId : '',
      senderId: user.uid,
      senderName: myDisplayName,
      senderPhoto: myPhoto,
      receiverId: activePartner?.partnerId || 'recipient',
      senderType: isPharmacist ? 'pharmacist' : isDriver ? 'driver' : 'patient',
      text: msgText,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);

    try {
      await addDoc(collection(db, 'messages'), {
        relatedId: activeId,
        orderId: newMsg.orderId,
        senderId: newMsg.senderId,
        senderName: newMsg.senderName,
        senderPhoto: newMsg.senderPhoto,
        receiverId: newMsg.receiverId,
        senderType: newMsg.senderType,
        text: msgText,
        createdAt: serverTimestamp()
      });

      // Notification
      if (activePartner?.partnerId && activePartner.partnerId !== user.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: activePartner.partnerId,
          targetRole: activePartner.partnerType || 'user',
          targetUrl: `/${activePartner.partnerType === 'patient' ? 'patient' : activePartner.partnerType === 'driver' ? 'delivery' : 'pharmacist'}/messages/${activeId}`,
          type: 'new_message',
          title: `Nouveau message de ${myDisplayName}`,
          message: msgText.length > 60 ? msgText.slice(0, 57) + '...' : msgText,
          isRead: false,
          relatedId: activeId,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(t('send_message_error', 'Échec de transmission du message'));
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (activeTab === 'patients' && c.type !== 'patient') return false;
      if (activeTab === 'drivers' && c.type !== 'driver') return false;
      if (activeTab === 'support' && c.type !== 'support') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const resolvedName = (c.partnerId && userProfiles[c.partnerId]?.name) || c.title;
        return (
          resolvedName.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q) ||
          (c.orderNumber && c.orderNumber.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [conversations, activeTab, searchQuery, userProfiles]);

  const liveActivePartnerName = (activePartner?.partnerId && userProfiles[activePartner.partnerId]?.name) || activePartner?.title || "Discussion";
  const liveActivePartnerPhoto = (activePartner?.partnerId && userProfiles[activePartner.partnerId]?.photoUrl) || activePartner?.photoUrl;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-900 flex h-full overflow-hidden relative">
      
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR: LISTE DES CONVERSATIONS (PATIENTS, CHAUFFEURS, SUPPORT) */}
      {/* ========================================================================= */}
      <div className={`w-full md:w-80 lg:w-96 bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 flex flex-col h-full shrink-0 z-10 transition-all ${
        mobileShowChat ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header de la liste */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-[#194B4B] dark:text-teal-400 font-bold">
                <MessageCircle size={18} />
              </div>
              <h2 className="font-bold text-gray-900 dark:text-white text-base">
                {t('messages', 'Messagerie')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="pill" />
              <DarkModeToggle className="w-8 h-8 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600" />
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_conversations', 'Rechercher un client, chauffeur...')}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#194B4B]"
            />
          </div>

          {/* Onglets Filtres */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'all' 
                  ? 'bg-white dark:bg-slate-800 text-[#194B4B] dark:text-teal-400 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t('all_tab', 'Tous')}
            </button>
            <button
              onClick={() => setActiveTab('patients')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'patients' 
                  ? 'bg-white dark:bg-slate-800 text-[#194B4B] dark:text-teal-400 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t('patients_tab', 'Patients')}
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'drivers' 
                  ? 'bg-white dark:bg-slate-800 text-[#194B4B] dark:text-teal-400 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t('drivers_tab', 'Chauffeurs')}
            </button>
            <button
              onClick={() => setActiveTab('support')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === 'support' 
                  ? 'bg-white dark:bg-slate-800 text-[#194B4B] dark:text-teal-400 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t('support_tab', 'Support')}
            </button>
          </div>
        </div>

        {/* Liste défilante des discussions */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50 custom-scrollbar">
          
          {/* CARTE SUPPORT ADMIN ÉPINGLÉE EN TÊTE */}
          <div 
            onClick={() => {
              const sId = `support_${user?.uid}`;
              setActiveId(sId);
              setMobileShowChat(true);
              navigate(isPharmacist ? `/pharmacist/messages/${sId}` : isDriver ? `/delivery/messages/${sId}` : `/patient/messages/${sId}`);
            }}
            className={`p-3.5 flex items-center gap-3 cursor-pointer transition border-l-4 ${
              activeId.startsWith('support_') 
                ? 'bg-teal-50/70 dark:bg-teal-950/30 border-[#194B4B] dark:border-teal-400' 
                : 'bg-amber-50/40 dark:bg-slate-800/80 border-amber-500 hover:bg-amber-50 dark:hover:bg-slate-700'
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-[#194B4B] text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Headphones size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-white text-xs truncate flex items-center gap-1">
                  {t('support_client_admin', 'Support Client Admin')}
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                  24/7
                </span>
              </div>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {t('direct_admin_contact', 'Contact direct avec l\'administrateur')}
              </p>
            </div>
          </div>

          {filteredConversations.filter(c => c.type !== 'support').length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-xs">
              {t('no_conversations_found', 'Aucune conversation trouvée dans cette catégorie.')}
            </div>
          ) : (
            filteredConversations.filter(c => c.type !== 'support').map((conv) => {
              const isSelected = conv.id === activeId;
              const liveName = (conv.partnerId && userProfiles[conv.partnerId]?.name) || conv.title;
              const livePhoto = (conv.partnerId && userProfiles[conv.partnerId]?.photoUrl) || conv.photoUrl;

              return (
                <div
                  key={`${conv.type}_${conv.id}`}
                  onClick={() => {
                    setActiveId(conv.id);
                    setMobileShowChat(true);
                    navigate(isPharmacist ? `/pharmacist/messages/${conv.id}` : isDriver ? `/delivery/messages/${conv.id}` : `/patient/messages/${conv.id}`);
                  }}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition border-l-4 ${
                    isSelected 
                      ? 'bg-teal-50/60 dark:bg-teal-950/30 border-[#194B4B] dark:border-teal-400' 
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="shrink-0">
                    <UserAvatar
                      userId={conv.partnerId}
                      name={liveName}
                      photoUrl={livePhoto}
                      sizeClassName="w-11 h-11"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        {liveName}
                      </span>
                      {conv.orderNumber && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          #{conv.orderNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {conv.subtitle}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        conv.type === 'driver' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {conv.roleBadge}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RIGHT AREA: CHAT ACTIF EN DIRECT */}
      {/* ========================================================================= */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-900 ${
        !mobileShowChat ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header de la conversation active */}
        <div className="px-6 py-3.5 flex items-center justify-between bg-white dark:bg-slate-800 shadow-xs z-10 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => setMobileShowChat(false)} 
              className="md:hidden w-9 h-9 flex items-center justify-center bg-gray-50 dark:bg-slate-700 rounded-full hover:bg-gray-100 transition text-gray-700 dark:text-gray-200"
              title="Retour à la liste"
            >
              <ArrowLeft size={18} />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                {activePartner?.type === 'support' ? (
                  <div className="w-10 h-10 rounded-full bg-[#194B4B] text-white flex items-center justify-center font-bold">
                    <Headphones size={20} />
                  </div>
                ) : (
                  <UserAvatar
                    userId={activePartner?.partnerId}
                    name={liveActivePartnerName}
                    photoUrl={liveActivePartnerPhoto}
                    sizeClassName="w-10 h-10"
                  />
                )}
              </div>

              <div>
                <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
                  {loadingContext ? (
                    <span className="inline-block w-28 h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                  ) : (
                    liveActivePartnerName
                  )}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    {activePartner?.roleBadge || t('online', 'En ligne')}
                  </span>
                  {activePartner?.orderNumber && (
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-bold">
                      #{activePartner.orderNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activePartner?.type !== 'support' && isPharmacist && activePartner?.id && (
              <button
                type="button"
                onClick={() => navigate(`/pharmacist/order/${activePartner.id}`)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition border border-gray-200 dark:border-slate-600"
              >
                <FileText size={13} />
                {t('view_order', 'Voir commande')}
              </button>
            )}

            {activePartner?.phone && (
              <a 
                href={`tel:${activePartner.phone}`}
                className="w-9 h-9 rounded-full flex items-center justify-center transition shadow-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100"
                title={t('call', 'Appeler')}
              >
                <Phone size={16} />
              </a>
            )}
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-28 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400 dark:text-gray-500">
              <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 shadow-xs">
                {activePartner?.type === 'support' ? (
                  <Headphones size={24} className="text-[#194B4B] dark:text-teal-400" />
                ) : (
                  <Package size={24} className="text-gray-400 dark:text-gray-500" />
                )}
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {activePartner?.type === 'support' 
                  ? t('support_welcome_title', "Assistance PharmaExpress") 
                  : t('no_messages_yet', 'Aucun message pour l\'instant.')}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                {activePartner?.type === 'support' 
                  ? t('support_welcome_desc', "Posez votre question à notre équipe technique. Un agent vous répondra sous quelques minutes.") 
                  : t('exchange_with_partner', "Échangez directement avec votre interlocuteur pour le bon déroulement de la commande.")}
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.senderId === user?.uid;
              const senderLive = msg.senderId && userProfiles[msg.senderId];
              const resolvedSenderName = senderLive?.name || msg.senderName;
              const bubblePhoto = isMe ? myPhoto : (senderLive?.photoUrl || msg.senderPhoto || liveActivePartnerPhoto);

              return (
                <div key={msg.id} className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className="shrink-0">
                      <UserAvatar
                        userId={msg.senderId}
                        name={resolvedSenderName || "User"}
                        photoUrl={bubblePhoto}
                        sizeClassName="w-8 h-8"
                      />
                    </div>
                  )}

                  <div 
                    className={`max-w-[78%] rounded-2xl p-3.5 shadow-xs ${
                      isMe 
                        ? 'bg-[#194B4B] text-white rounded-br-none' 
                        : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-bl-none border border-gray-100 dark:border-slate-700'
                    }`}
                  >
                    {!isMe && resolvedSenderName && (
                      <p className="text-[11px] font-bold text-teal-700 dark:text-teal-400 mb-1">
                        {resolvedSenderName}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] font-medium ${isMe ? 'text-teal-100' : 'text-gray-400'}`}>
                      <span>
                        {parseDate(msg.createdAt) 
                          ? parseDate(msg.createdAt)!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : t('now', 'À l\'instant')}
                      </span>
                      {isMe && <CheckCheck size={12} className="text-teal-200" />}
                    </div>
                  </div>

                  {isMe && (
                    <div className="shrink-0">
                      <UserAvatar
                        userId={user?.uid}
                        name={myDisplayName}
                        photoUrl={myPhoto}
                        sizeClassName="w-8 h-8"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 px-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-gray-100 dark:border-slate-700 z-20 flex gap-2 items-center shadow-lg">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={activePartner?.type === 'support' ? t('write_to_support', "Écrivez au support administrateur...") : t('type_your_message', 'Saisissez votre message...')}
            className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-full py-3 px-6 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#194B4B] dark:focus:ring-teal-500 transition"
          />
          <button 
            type="button"
            onClick={handleSend} 
            disabled={!input.trim()}
            className="w-12 h-12 disabled:opacity-50 text-white rounded-full flex items-center justify-center shadow-md transition hover:bg-[#133a3a] bg-[#194B4B] shrink-0"
          >
            <Send size={18} className="translate-x-0.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
