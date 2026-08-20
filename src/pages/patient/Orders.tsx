import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ShoppingBag, Search, CreditCard, Truck, CheckCircle2, 
  Clock, Store, MapPin, Download, ArrowRight, ShieldCheck
} from "lucide-react";
import { collection, query, where, onSnapshot, updateDoc, doc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate, sortByDateDesc } from '../../lib/utils';
import { printInvoice } from '../../lib/invoice';
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

export function PatientOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unpaid" | "in_progress" | "delivered" | "cancelled">("all");
  
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'orders'), where('patientId', '==', user.uid));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const rawOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setOrders(sortByDateDesc(rawOrders));
          setLoading(false);
        });
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchOrders();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Actions
  const handleProceedToPayment = async (order: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPayingOrderId(order.id);

    try {
      // 1. Initialisation de la session de paiement via l'API
      const res = await fetch("/api/payment/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: order.total,
          email: user?.email || "patient@pharmaply.cm",
          externalId: order.id,
          redirectUrl: window.location.origin + `/patient/orders`
        })
      });

      const data = await res.json();
      if (data && data.link) {
        window.location.href = data.link;
        return;
      }
    } catch (err) {
      console.warn("Payment API initialization notice, opening sandbox direct checkout:", err);
    }

    // Redirection directe
    const sandboxUrl = `/patient/fapshi-sandbox-checkout?amount=${order.total}&externalId=${order.id}&redirectUrl=${encodeURIComponent(window.location.origin + '/patient/orders')}`;
    navigate(sandboxUrl);
  };

  const handleCancelOrder = async (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updateData: any = { 
        status: 'cancelled',
        cancellationReason: cancelReason || "Annulé par le patient"
      };
      await updateDoc(doc(db, 'orders', orderId), updateData);
      
      toast.success("Commande annulée.");
      setCancellingOrderId(null);
      setCancelReason("");
    } catch(error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      toast.error("Impossible d'annuler la commande.");
    }
  };

  // KPIs & Compteurs
  const unpaidOrders = orders.filter(o => 
    (o.status === 'validated_awaiting_payment' || o.status === 'pending_payment' || (o.status === 'pending' && !o.paidAt && o.paymentStatus !== 'paid'))
  );
  const unpaidTotalSum = unpaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const inProgressOrders = orders.filter(o => 
    ['paid', 'preparing', 'ready', 'ready_for_pickup', 'on_the_way', 'picked_up'].includes(o.status)
  );

  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const deliveredTotalSpent = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const cancelledOrders = orders.filter(o => ['cancelled', 'rejected'].includes(o.status));

  // Filtrage selon l'onglet actif et le texte de recherche
  const filteredOrders = orders.filter(order => {
    const isUnpaid = (order.status === 'validated_awaiting_payment' || order.status === 'pending_payment' || (order.status === 'pending' && !order.paidAt && order.paymentStatus !== 'paid'));
    const isInProgress = ['paid', 'preparing', 'ready', 'ready_for_pickup', 'on_the_way', 'picked_up'].includes(order.status);
    const isDelivered = order.status === 'delivered';
    const isCancelled = ['cancelled', 'rejected'].includes(order.status);

    if (activeTab === "unpaid" && !isUnpaid) return false;
    if (activeTab === "in_progress" && !isInProgress) return false;
    if (activeTab === "delivered" && !isDelivered) return false;
    if (activeTab === "cancelled" && !isCancelled) return false;

    if (!searchTerm.trim()) return true;

    const s = searchTerm.toLowerCase();
    const matchId = order.id?.toLowerCase().includes(s);
    const matchPharm = order.pharmacyName?.toLowerCase().includes(s);
    const matchItems = order.items?.some((i: any) => i.name?.toLowerCase().includes(s));

    return matchId || matchPharm || matchItems;
  });

  return (
    <div className="flex-1 bg-slate-50 dark:bg-zinc-950 flex flex-col h-full overflow-hidden font-sans">
      
      {/* ========================================================================= */}
      {/* HEADER RESPONSIVE */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-zinc-900 px-4 sm:px-6 pt-4 sm:pt-6 pb-4 shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800 shrink-0">
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingBag size={24} className="text-[#194B4B] dark:text-teal-400 shrink-0" />
                {t('patient_orders.my_orders', 'Mes Commandes')}
              </h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                {t('patient_orders.track_orders_desc', 'Suivez vos commandes, vérifications de stock et effectuez vos paiements')}
              </p>
            </div>
          </div>

          {/* Barre de Recherche Rapide */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={t('patient_orders.search_placeholder', 'Rechercher une commande, un médicament ou une pharmacie...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-100 dark:bg-zinc-800 py-2.5 pl-10 pr-4 rounded-2xl text-xs sm:text-sm outline-none text-gray-900 dark:text-white placeholder-gray-400 border border-transparent focus:border-[#194B4B] transition"
            />
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CORPS PRINCIPAL DU DASHBOARD */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 pb-28">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          
          {/* CARTES KPI RÉSUMÉ (2 PAR LIGNE AVEC COULEURS DASHBOARD ADMIN) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* KPI 1 : Paiements en attente (Jaune/Ambre Pastel Admin) */}
            <div 
              onClick={() => setActiveTab("unpaid")}
              className="bg-[#fde68a] text-slate-900 rounded-[2rem] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-[155px] shadow-sm cursor-pointer hover:opacity-95 transition active:scale-[0.99]"
            >
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
                  <CreditCard size={16} className="text-black" />
                </div>
                {unpaidOrders.length > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/15 text-slate-900 px-2 py-0.5 rounded-full">
                    {t('patient_orders.action_required', 'Action requise')}
                  </span>
                )}
              </div>
              <div className="relative z-10">
                <p className="text-slate-800/75 text-xs sm:text-sm font-semibold mb-0.5">{t('patient_orders.to_pay', 'À Régler')}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-950">{unpaidOrders.length}</h3>
                <p className="text-[11px] sm:text-xs font-bold text-amber-900 mt-1 truncate">
                  {unpaidTotalSum > 0 ? formatCurrency(unpaidTotalSum) : t('patient_orders.no_unpaid', 'Aucun impayé')}
                </p>
              </div>
              {/* Barres décoratives */}
              <div className="absolute right-4 bottom-4 flex items-end gap-1 opacity-15 pointer-events-none">
                <div className="w-2 h-6 bg-black rounded-full"></div>
                <div className="w-2 h-12 bg-black rounded-full"></div>
                <div className="w-2 h-8 bg-black rounded-full"></div>
              </div>
            </div>

            {/* KPI 2 : En cours (Teal Pastel Admin) */}
            <div 
              onClick={() => setActiveTab("in_progress")}
              className="bg-[#a5e0d8] text-slate-900 rounded-[2rem] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-[155px] shadow-sm cursor-pointer hover:opacity-95 transition active:scale-[0.99]"
            >
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
                  <Truck size={16} className="text-black" />
                </div>
                <span className="text-[10px] font-bold text-teal-900 bg-black/10 px-2 py-0.5 rounded-full">
                  {t('patient_orders.live_tracking', 'Suivi direct')}
                </span>
              </div>
              <div className="relative z-10">
                <p className="text-slate-800/75 text-xs sm:text-sm font-semibold mb-0.5">{t('patient_orders.in_progress', 'En Cours')}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-950">{inProgressOrders.length}</h3>
                <p className="text-[11px] sm:text-xs font-bold text-teal-950 mt-1 truncate">
                  {t('patient_orders.prep_delivery', 'Préparation & Livraison')}
                </p>
              </div>
              {/* Barres décoratives */}
              <div className="absolute right-4 bottom-4 flex items-end gap-1 opacity-15 pointer-events-none">
                <div className="w-2 h-4 bg-black rounded-full"></div>
                <div className="w-2 h-10 bg-black rounded-full"></div>
                <div className="w-2 h-16 bg-black rounded-full"></div>
              </div>
            </div>

            {/* KPI 3 : Finalisées (Mint Green Pastel Admin) */}
            <div 
              onClick={() => setActiveTab("delivered")}
              className="bg-[#ccedc8] text-slate-900 rounded-[2rem] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-[155px] shadow-sm cursor-pointer hover:opacity-95 transition active:scale-[0.99]"
            >
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-black" />
                </div>
                <span className="text-[10px] font-bold text-emerald-950 bg-black/10 px-2 py-0.5 rounded-full">
                  {t('patient_orders.delivered', 'Livrées')}
                </span>
              </div>
              <div className="relative z-10">
                <p className="text-slate-800/75 text-xs sm:text-sm font-semibold mb-0.5">{t('patient_orders.completed', 'Terminées')}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-950">{deliveredOrders.length}</h3>
                <p className="text-[11px] sm:text-xs font-bold text-emerald-900 mt-1 truncate">
                  {t('patient_orders.orders_received', 'Commandes reçues')}
                </p>
              </div>
              {/* Barres décoratives */}
              <div className="absolute right-4 bottom-4 flex items-end gap-1 opacity-15 pointer-events-none">
                <div className="w-2 h-8 bg-black rounded-full"></div>
                <div className="w-2 h-12 bg-black rounded-full"></div>
                <div className="w-2 h-6 bg-black rounded-full"></div>
              </div>
            </div>

            {/* KPI 4 : Dépenses Totales (Lavender Pastel Admin) */}
            <div className="bg-[#b3abf2] text-slate-900 rounded-[2rem] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between min-h-[140px] sm:min-h-[155px] shadow-sm">
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
                  <ShieldCheck size={16} className="text-black" />
                </div>
                <span className="text-[10px] font-bold text-indigo-950 bg-black/10 px-2 py-0.5 rounded-full">
                  {t('patient_orders.payments', 'Paiements')}
                </span>
              </div>
              <div className="relative z-10">
                <p className="text-slate-800/75 text-xs sm:text-sm font-semibold mb-0.5">{t('patient_orders.expenses', 'Dépenses')}</p>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 truncate">{formatCurrency(deliveredTotalSpent)}</h3>
                <p className="text-[11px] sm:text-xs font-bold text-indigo-950 mt-1 truncate">
                  {t('patient_orders.total_paid', 'Total payé')}
                </p>
              </div>
              {/* Barres décoratives */}
              <div className="absolute right-4 bottom-4 flex items-end gap-1 opacity-15 pointer-events-none">
                <div className="w-2 h-10 bg-black rounded-full"></div>
                <div className="w-2 h-6 bg-black rounded-full"></div>
                <div className="w-2 h-14 bg-black rounded-full"></div>
              </div>
            </div>
          </div>

          {/* BANNIÈRE D'ALERTE : PAIEMENTS EN ATTENTE VALIDÉS PAR LA PHARMACIE */}
          {unpaidOrders.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0 font-bold shadow-md">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-950 dark:text-amber-300 text-xs sm:text-sm">
                      {t('patient_orders.validated_pending_payment_alert', { count: unpaidOrders.length, defaultValue: `${unpaidOrders.length} Commande(s) Validée(s) en attente de règlement` })}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                      {t('patient_orders.pharmacy_confirmed_desc', 'La pharmacie a confirmé la disponibilité de vos médicaments. Réglez maintenant pour lancer la préparation immédiate.')}
                    </p>
                  </div>
                </div>

                <span className="font-black text-sm sm:text-base text-amber-950 dark:text-amber-200 shrink-0 self-end sm:self-auto">
                  {formatCurrency(unpaidTotalSum)}
                </span>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => handleProceedToPayment(unpaidOrders[0])}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] bg-[#194B4B] hover:bg-teal-700 text-white rounded-xl sm:rounded-2xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <ShieldCheck size={16} className="text-yellow-400" />
                  {t('patient_orders.pay_now', 'Payer maintenant')}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ONGLETS DE FILTRAGE HORIZONTAUX */}
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-3 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 sm:px-4 py-2 min-h-[38px] rounded-full text-xs font-bold transition whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
              }`}
            >
              {t('patient_orders.all_tab', 'Toutes')} ({orders.length})
            </button>
            
            <button
              onClick={() => setActiveTab("unpaid")}
              className={`px-3.5 sm:px-4 py-2 min-h-[38px] rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "unpaid"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
              }`}
            >
              <CreditCard size={13} />
              {t('patient_orders.unpaid_tab', 'À Payer')} ({unpaidOrders.length})
            </button>

            <button
              onClick={() => setActiveTab("in_progress")}
              className={`px-3.5 sm:px-4 py-2 min-h-[38px] rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "in_progress"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
              }`}
            >
              <Truck size={13} />
              {t('patient_orders.in_progress_tab', 'En Cours')} ({inProgressOrders.length})
            </button>

            <button
              onClick={() => setActiveTab("delivered")}
              className={`px-3.5 sm:px-4 py-2 min-h-[38px] rounded-full text-xs font-bold transition whitespace-nowrap ${
                activeTab === "delivered"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
              }`}
            >
              {t('patient_orders.delivered_tab', 'Livrées')} ({deliveredOrders.length})
            </button>

            <button
              onClick={() => setActiveTab("cancelled")}
              className={`px-3.5 sm:px-4 py-2 min-h-[38px] rounded-full text-xs font-bold transition whitespace-nowrap ${
                activeTab === "cancelled"
                  ? "bg-red-700 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
              }`}
            >
              {t('patient_orders.cancelled_tab', 'Annulées')} ({cancelledOrders.length})
            </button>
          </div>

          {/* LISTE DES CARTES DE COMMANDE BIEN DISPOSÉES */}
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-500 dark:text-zinc-400 animate-pulse">
              {t('patient_orders.loading_orders', 'Chargement de vos commandes...')}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 p-8">
              <ShoppingBag size={48} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
              <h3 className="font-bold text-base text-gray-800 dark:text-white">
                {t('patient_orders.no_orders_section', 'Aucune commande dans cette section')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                {t('patient_orders.no_orders_sub', "Retrouvez ici l'état d'avancement de vos prescriptions et vos factures.")}
              </p>
              <button
                onClick={() => navigate("/patient/search")}
                className="mt-5 px-6 py-2.5 min-h-[44px] bg-[#194B4B] text-white rounded-full text-xs font-bold hover:bg-teal-700 transition shadow-sm"
              >
                {t('patient_orders.browse_meds', 'Parcourir les médicaments')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const dateObj = parseDate(order.createdAt);
                const isUnpaid = (order.status === 'validated_awaiting_payment' || order.status === 'pending_payment' || (order.status === 'pending' && !order.paidAt && order.paymentStatus !== 'paid'));
                const isDelivered = order.status === 'delivered';
                const isInDelivery = ['on_the_way', 'picked_up'].includes(order.status);
                const items = order.items || [];

                // Libellé et Style du Statut
                let statusLabel = t('status.pending', "En attente");
                let statusClass = "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300";

                if (order.status === 'validated_awaiting_payment' || (order.status === 'pending' && !order.paidAt)) {
                  statusLabel = t('status.validated_awaiting_payment', "Validée — À Payer");
                  statusClass = "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300";
                } else if (order.status === 'paid') {
                  statusLabel = t('status.paid', "Payé — Préparation");
                  statusClass = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
                } else if (order.status === 'preparing') {
                  statusLabel = t('status.preparing', "En préparation");
                  statusClass = "bg-teal-100 text-[#194B4B] dark:bg-teal-950 dark:text-teal-300";
                } else if (order.status === 'ready' || order.status === 'ready_for_pickup') {
                  statusLabel = order.deliveryMethod === 'pickup' ? t('status.ready_counter', "Prêt au comptoir") : t('status.ready_delivery', "Prêt pour livraison");
                  statusClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                } else if (order.status === 'on_the_way' || order.status === 'picked_up') {
                  statusLabel = t('status.in_delivery', "En livraison");
                  statusClass = "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
                } else if (order.status === 'delivered') {
                  statusLabel = t('status.delivered', "Livrée");
                  statusClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                } else if (order.status === 'cancelled' || order.status === 'rejected') {
                  statusLabel = t('status.cancelled', "Annulée");
                  statusClass = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
                }

                return (
                  <div
                    key={order.id}
                    className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 border shadow-sm transition flex flex-col gap-4 overflow-hidden ${
                      isUnpaid 
                        ? "border-amber-300 dark:border-amber-500/50 shadow-amber-500/10" 
                        : "border-gray-100 dark:border-zinc-800 hover:border-gray-200"
                    }`}
                  >
                    {/* SECTION 1 : EN-TÊTE DE LA CARTE */}
                    <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-zinc-800 pb-3">
                      <div className="space-y-1">
                        <h3 className="font-black text-gray-900 dark:text-white text-base tracking-tight">
                          {t('patient_orders.order_hash', 'Commande')} #{order.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-gray-400" />
                            {dateObj ? dateObj.toLocaleDateString(t('locale_code', 'fr-FR'), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : t('recently', "Récemment")}
                          </span>
                          {order.pharmacyName && (
                            <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-zinc-300">
                              <Store size={13} className="text-[#194B4B] dark:text-teal-400 shrink-0" />
                              {order.pharmacyName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold items-center gap-1.5 whitespace-nowrap ${statusClass}`}>
                          {isUnpaid && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>}
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* SECTION 2 : LISTE DES MÉDICAMENTS */}
                    <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-2xl p-4 space-y-2.5">
                      <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('patient_orders.items_ordered_count', { count: items.length, defaultValue: `${items.length} Médicament(s) commandé(s)` })}
                      </p>
                      <div className="space-y-2">
                        {items.map((it: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs sm:text-sm gap-3">
                            <span className="text-gray-800 dark:text-zinc-200 font-medium truncate">
                              <span className="font-bold text-[#194B4B] dark:text-teal-400 mr-2">{it.quantity}x</span>
                              {it.name} {it.dosage ? `(${it.dosage})` : ""}
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white shrink-0">
                              {formatCurrency((Number(it.price) || 0) * (Number(it.quantity) || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SECTION 3 : ADRESSE DE LIVRAISON */}
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-xl">
                      {order.deliveryMethod === 'pickup' ? (
                        <div className="flex items-center gap-2">
                          <Store size={15} className="text-[#194B4B] dark:text-teal-400 shrink-0" />
                          <span className="font-medium">{t('patient_orders.pickup_at_counter', 'Retrait sur place en pharmacie')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin size={15} className="text-orange-600 shrink-0" />
                          <span className="font-medium truncate">{order.deliveryAddress || t('patient_orders.home_delivery', "Livraison à domicile")}</span>
                        </div>
                      )}
                    </div>

                    {/* SECTION 4 : TOTAL TTC */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">
                        {t('patient_orders.total_incl_tax', 'Montant Total TTC')}
                      </span>
                      <span className="font-black text-gray-950 dark:text-white text-lg sm:text-xl">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    {/* SECTION 5 : BOUTONS D'ACTION */}
                    <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
                      
                      {/* Cas 1 : PAIEMENT EN ATTENTE */}
                      {isUnpaid && (
                        <div className="flex flex-col sm:flex-row items-stretch gap-2.5 w-full">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancellingOrderId(order.id);
                            }}
                            className="px-4 py-3 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 rounded-2xl transition text-center shrink-0"
                          >
                            {t('patient_orders.cancel', 'Annuler')}
                          </button>

                          <button
                            onClick={(e) => handleProceedToPayment(order, e)}
                            disabled={payingOrderId === order.id}
                            className="flex-1 py-3 px-4 min-h-[46px] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black text-xs sm:text-sm rounded-2xl shadow-md flex items-center justify-center gap-2 transition active:scale-[0.98]"
                          >
                            <ShieldCheck size={18} />
                            <span>{t('patient_orders.pay_order', 'Payer la commande')}</span>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}

                      {/* Cas 2 : COMMANDE EN COURS DE LIVRAISON */}
                      {isInDelivery && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                          <span className="text-xs text-orange-600 font-bold flex items-center gap-1.5 animate-pulse">
                            <Truck size={16} /> {t('patient_orders.courier_on_the_way', 'Coursier en route vers vous')}
                          </span>
                          <button
                            onClick={() => navigate(`/patient/tracking/${order.id}`)}
                            className="px-5 py-3 min-h-[44px] bg-[#194B4B] hover:bg-teal-700 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
                          >
                            <MapPin size={16} /> {t('patient_orders.track_live_map', 'Suivre sur la Carte Live')}
                          </button>
                        </div>
                      )}

                      {/* Cas 3 : COMMANDE LIVRÉE */}
                      {isDelivered && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={16} /> {t('patient_orders.payment_validated_received', 'Paiement validé & Commande reçue')}
                          </span>
                          <button
                            onClick={() => printInvoice(order)}
                            className="px-5 py-3 min-h-[44px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition"
                          >
                            <Download size={16} /> {t('patient_orders.download_pdf_invoice', 'Télécharger Facture PDF')}
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Formulaire Modal d'Annulation */}
                    {cancellingOrderId === order.id && (
                      <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900 space-y-3 mt-1">
                        <p className="text-xs font-bold text-red-900 dark:text-red-300">
                          {t('patient_orders.cancel_reason_prompt', "Motif de l'annulation de la commande :")}
                        </p>
                        <select
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 p-3 rounded-xl text-xs outline-none"
                        >
                          <option value="Changement d'avis">{t('patient_orders.reasons.change_mind', "Changement d'avis")}</option>
                          <option value="Délai trop long">{t('patient_orders.reasons.too_long', "Délai trop long")}</option>
                          <option value="Médicament trouvé ailleurs">{t('patient_orders.reasons.found_elsewhere', "Médicament trouvé ailleurs")}</option>
                          <option value="Erreur dans la commande">{t('patient_orders.reasons.order_error', "Erreur dans la commande")}</option>
                        </select>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setCancellingOrderId(null)}
                            className="px-4 py-2.5 min-h-[38px] bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-xl text-xs font-bold"
                          >
                            {t('patient_orders.back', 'Retour')}
                          </button>
                          <button
                            onClick={(e) => handleCancelOrder(order.id, e)}
                            className="px-5 py-2.5 min-h-[38px] bg-red-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-red-700"
                          >
                            {t('patient_orders.confirm_cancel', "Confirmer l'annulation")}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
