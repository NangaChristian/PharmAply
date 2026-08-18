import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Activity, Clock, FileText, Search, AlertTriangle, Check, X, 
  CreditCard, Sparkles, ShoppingBag, Truck, CheckCircle2, ArrowRight,
  ShieldCheck, Phone, Store, MapPin, RefreshCw, ChevronRight, AlertCircle,
  ExternalLink, Download, ArrowUpRight
} from "lucide-react";
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from '../../lib/firebase';
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
      // 1. Initialisation de la session Fapshi via l'API
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
      console.warn("Fapshi API initialization notice, opening sandbox direct checkout:", err);
    }

    // Redirection Sandbox directe
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
      {/* HEADER DU DASHBOARD */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-zinc-900 px-6 pt-12 pb-4 shadow-sm z-10 flex flex-col gap-4 border-b border-gray-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingBag size={22} className="text-[#194B4B] dark:text-teal-400" />
              Tableau de Bord des Commandes
            </h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Gestion de vos ordonnances, vérifications de stock et règlements Fapshi
            </p>
          </div>

          <button
            onClick={() => navigate("/patient/smart-scanner")}
            className="px-4 py-2 bg-[#194B4B] hover:bg-teal-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95"
          >
            <Sparkles size={14} className="text-yellow-400" />
            Scanner une ordonnance
          </button>
        </div>

        {/* Barre de Recherche Rapide */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher une commande, un médicament ou une pharmacie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-100 dark:bg-zinc-800 py-2.5 pl-10 pr-4 rounded-2xl text-xs outline-none text-gray-900 dark:text-white placeholder-gray-400 border border-transparent focus:border-[#194B4B] transition"
          />
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CORPS PRINCIPAL DU DASHBOARD */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 space-y-6">
        
        {/* CARTES KPI RÉSUMÉ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1 : Paiements en attente */}
          <div 
            onClick={() => setActiveTab("unpaid")}
            className={`p-4 rounded-3xl border transition cursor-pointer flex flex-col justify-between ${
              unpaidOrders.length > 0 
                ? "bg-amber-500/10 border-amber-400/50 shadow-sm hover:border-amber-400" 
                : "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">À Régler</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <CreditCard size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900 dark:text-white">{unpaidOrders.length}</span>
                {unpaidOrders.length > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full animate-pulse">
                    Action requise
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium">
                {unpaidTotalSum > 0 ? formatCurrency(unpaidTotalSum) : "Aucun impayé"}
              </p>
            </div>
          </div>

          {/* KPI 2 : En cours de livraison */}
          <div 
            onClick={() => setActiveTab("in_progress")}
            className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:border-teal-600 transition cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 dark:text-teal-400">En Cours</span>
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-[#194B4B] dark:text-teal-400">
                <Truck size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{inProgressOrders.length}</span>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium">
                Préparation & Livraison
              </p>
            </div>
          </div>

          {/* KPI 3 : Finalisées */}
          <div 
            onClick={() => setActiveTab("delivered")}
            className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:border-emerald-600 transition cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Livrées</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{deliveredOrders.length}</span>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium">
                Commandes terminées
              </p>
            </div>
          </div>

          {/* KPI 4 : Dépenses Totales */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600 dark:text-zinc-400">Dépenses</span>
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-600 dark:text-zinc-300">
                <ShieldCheck size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(deliveredTotalSpent)}</span>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium">
                Paiements Fapshi validés
              </p>
            </div>
          </div>
        </div>

        {/* BANNIÈRE D'ALERTE : PAIEMENTS EN ATTENTE VALIDÉS PAR LA PHARMACIE */}
        {unpaidOrders.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/60 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0 font-bold shadow-md">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-amber-950 dark:text-amber-300 text-sm">
                    {unpaidOrders.length} Commande(s) Validée(s) en attente de règlement
                  </h3>
                  <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                    La pharmacie a confirmé la disponibilité de vos médicaments. Réglez maintenant pour lancer la préparation immédiate.
                  </p>
                </div>
              </div>

              <span className="font-black text-sm text-amber-950 dark:text-amber-200 shrink-0">
                {formatCurrency(unpaidTotalSum)}
              </span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => handleProceedToPayment(unpaidOrders[0])}
                className="px-5 py-2.5 bg-[#194B4B] hover:bg-teal-700 text-white rounded-2xl text-xs font-bold shadow-md flex items-center gap-2 transition active:scale-95"
              >
                <ShieldCheck size={15} className="text-yellow-400" />
                Payer maintenant ({formatCurrency(unpaidOrders[0].total)})
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ONGLETS DE FILTRAGE */}
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-3 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
              activeTab === "all"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            Toutes ({orders.length})
          </button>
          
          <button
            onClick={() => setActiveTab("unpaid")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "unpaid"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            <CreditCard size={13} />
            À Payer ({unpaidOrders.length})
          </button>

          <button
            onClick={() => setActiveTab("in_progress")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "in_progress"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            <Truck size={13} />
            En Cours ({inProgressOrders.length})
          </button>

          <button
            onClick={() => setActiveTab("delivered")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
              activeTab === "delivered"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            Livrées ({deliveredOrders.length})
          </button>

          <button
            onClick={() => setActiveTab("cancelled")}
            className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${
              activeTab === "cancelled"
                ? "bg-red-700 text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            Annulées ({cancelledOrders.length})
          </button>
        </div>

        {/* LISTE DES COMMANDES */}
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500 dark:text-zinc-400 animate-pulse">
            Chargement de vos commandes...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 p-8">
            <ShoppingBag size={48} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
            <h3 className="font-bold text-base text-gray-800 dark:text-white">
              Aucune commande dans cette section
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Retrouvez ici l'état d'avancement de vos prescriptions et vos factures.
            </p>
            <button
              onClick={() => navigate("/patient/search")}
              className="mt-5 px-6 py-2.5 bg-[#194B4B] text-white rounded-full text-xs font-bold hover:bg-teal-700 transition shadow-sm"
            >
              Parcourir les médicaments
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
              let statusLabel = "En attente";
              let statusClass = "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300";

              if (order.status === 'validated_awaiting_payment' || (order.status === 'pending' && !order.paidAt)) {
                statusLabel = "Disponibilité Validée — À Payer";
                statusClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300";
              } else if (order.status === 'paid') {
                statusLabel = "Payé — En attente préparation";
                statusClass = "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
              } else if (order.status === 'preparing') {
                statusLabel = "En préparation à l'officine";
                statusClass = "bg-teal-100 text-[#194B4B] dark:bg-teal-950 dark:text-teal-300";
              } else if (order.status === 'ready' || order.status === 'ready_for_pickup') {
                statusLabel = order.deliveryMethod === 'pickup' ? "Prêt au comptoir" : "Prêt pour livraison";
                statusClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
              } else if (order.status === 'on_the_way' || order.status === 'picked_up') {
                statusLabel = "En cours de livraison (Coursier)";
                statusClass = "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
              } else if (order.status === 'delivered') {
                statusLabel = "Commande Livrée";
                statusClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
              } else if (order.status === 'cancelled' || order.status === 'rejected') {
                statusLabel = "Commande Annulée";
                statusClass = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
              }

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 border shadow-sm transition flex flex-col gap-4 ${
                    isUnpaid 
                      ? "border-amber-300/80 dark:border-amber-500/40 shadow-amber-500/5" 
                      : "border-gray-100 dark:border-zinc-800 hover:border-gray-200"
                  }`}
                >
                  {/* Top Bar : Numéro Commande & Statut */}
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-zinc-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900 dark:text-white text-base">
                          Commande #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={12} />
                          {dateObj ? dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Récemment"}
                        </span>
                      </div>

                      {order.pharmacyName && (
                        <p className="text-xs text-gray-600 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                          <Store size={13} className="text-[#194B4B] dark:text-teal-400" />
                          {order.pharmacyName}
                        </p>
                      )}
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${statusClass}`}>
                      {isUnpaid && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>}
                      {statusLabel}
                    </span>
                  </div>

                  {/* Liste des Médicaments de la Commande */}
                  <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-2xl p-3.5 space-y-2">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      {items.length} Médicament(s) commandé(s)
                    </p>
                    <div className="space-y-1.5">
                      {items.map((it: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-gray-800 dark:text-zinc-200 font-medium">
                            <span className="font-bold text-[#194B4B] dark:text-teal-400 mr-1.5">{it.quantity}x</span>
                            {it.name} {it.dosage ? `(${it.dosage})` : ""}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatCurrency((Number(it.price) || 0) * (Number(it.quantity) || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mode de Livraison & Total */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                      {order.deliveryMethod === 'pickup' ? (
                        <span className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl font-medium">
                          <Store size={13} /> Retrait en Pharmacie
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl font-medium truncate max-w-[200px]">
                          <MapPin size={13} /> {order.deliveryAddress || "Livraison à domicile"}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-gray-400 block">Total TTC</span>
                      <span className="font-black text-gray-900 dark:text-white text-base">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* ACTIONS SPÉCIFIQUES SELON L'ÉTAT DU PAIEMENT & LIVRAISON */}
                  {/* ========================================================================= */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                    
                    {/* Cas 1 : PAIEMENT EN ATTENTE (Disponibilité confirmée) */}
                    {isUnpaid && (
                      <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancellingOrderId(order.id);
                          }}
                          className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 rounded-xl transition"
                        >
                          Annuler
                        </button>

                        <button
                          onClick={(e) => handleProceedToPayment(order, e)}
                          disabled={payingOrderId === order.id}
                          className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                        >
                          <ShieldCheck size={16} />
                          Finaliser le Paiement Fapshi ({formatCurrency(order.total)})
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}

                    {/* Cas 2 : COMMANDE EN COURS DE LIVRAISON */}
                    {isInDelivery && (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <span className="text-xs text-orange-600 font-bold flex items-center gap-1 animate-pulse">
                          <Truck size={14} /> Coursier en route
                        </span>
                        <button
                          onClick={() => navigate(`/patient/tracking/${order.id}`)}
                          className="px-4 py-2 bg-[#194B4B] hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                        >
                          <MapPin size={14} /> Suivre sur la Carte Live
                        </button>
                      </div>
                    )}

                    {/* Cas 3 : COMMANDE LIVRÉE / FACTURE */}
                    {isDelivered && (
                      <div className="flex items-center gap-2 w-full justify-between">
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle2 size={14} /> Règlement Fapshi effectué
                        </span>
                        <button
                          onClick={() => printInvoice(order)}
                          className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Download size={14} /> Facture PDF
                        </button>
                      </div>
                    )}

                  </div>

                  {/* Formulaire Modal / Drawer d'Annulation */}
                  {cancellingOrderId === order.id && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900 space-y-3 mt-2">
                      <p className="text-xs font-bold text-red-900 dark:text-red-300">
                        Motif de l'annulation de la commande :
                      </p>
                      <select
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 p-2.5 rounded-xl text-xs outline-none"
                      >
                        <option value="Changement d'avis">Changement d'avis</option>
                        <option value="Délai trop long">Délai trop long</option>
                        <option value="Médicament trouvé ailleurs">Médicament trouvé ailleurs</option>
                        <option value="Erreur dans la commande">Erreur dans la commande</option>
                      </select>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setCancellingOrderId(null)}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg text-xs font-bold"
                        >
                          Retour
                        </button>
                        <button
                          onClick={(e) => handleCancelOrder(order.id, e)}
                          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-red-700"
                        >
                          Confirmer l'annulation
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
  );
}
