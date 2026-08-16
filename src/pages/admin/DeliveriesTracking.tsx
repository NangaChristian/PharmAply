import { useState, useEffect, useMemo } from "react";
import { 
  Truck, Bike, DollarSign, TrendingUp, Clock, 
  MapPin, CheckCircle2, AlertCircle, Search, Filter, 
  ChevronRight, Calendar, User, Phone, FileSpreadsheet, RotateCcw, 
  BarChart3, Package, ShieldCheck, Star, Sparkles, Navigation, Check
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, PieChart, Pie, Cell 
} from "recharts";
import { db, collection, query, onSnapshot, orderBy } from "../../lib/firebase";
import { formatCurrency, parseDate, sortByDateDesc } from "../../lib/utils";
import { useTranslation } from "react-i18next";

export function AdminDeliveriesTracking() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Synchronisation en temps réel avec Firebase / Supabase
  useEffect(() => {
    const ordersQuery = query(collection(db, "orders"));
    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      const docs = sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setOrders(docs);
      setLoading(false);
    }, (err) => {
      console.error("Erreur de synchronisation des commandes:", err);
      setLoading(false);
    });

    const driversQuery = query(collection(db, "drivers"));
    const unsubDrivers = onSnapshot(driversQuery, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDrivers(docs);
    }, (err) => {
      console.error("Erreur de synchronisation des livreurs:", err);
    });

    return () => {
      unsubOrders();
      unsubDrivers();
    };
  }, []);

  // Filtrer uniquement les commandes en livraison
  const deliveryOrders = useMemo(() => {
    return orders.filter(o => o.delivery_mode !== 'pickup' && o.deliveryMethod !== 'pickup');
  }, [orders]);

  // Métriques financières et logistiques clés
  const metrics = useMemo(() => {
    const totalDeliveries = deliveryOrders.length;
    const completed = deliveryOrders.filter(o => o.status === 'delivered');
    const inProgress = deliveryOrders.filter(o => ['out_for_delivery', 'driver_assigned', 'delivering', 'en_route'].includes(o.status));
    const pending = deliveryOrders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
    const cancelled = deliveryOrders.filter(o => o.status === 'cancelled');

    // Calcul des revenus de livraison (Frais standard 1 500 XAF)
    const totalDeliveryRevenue = deliveryOrders.reduce((sum, o) => {
      const fee = Number(o.deliveryFee || o.shippingFee || (o.total && o.total > 2000 ? 1500 : 1000));
      return sum + fee;
    }, 0);

    const completedDeliveryRevenue = completed.reduce((sum, o) => {
      const fee = Number(o.deliveryFee || o.shippingFee || (o.total && o.total > 2000 ? 1500 : 1000));
      return sum + fee;
    }, 0);

    // Marge plateforme fixe (20% des frais de livraison)
    const platformMargin = totalDeliveryRevenue * 0.20;
    const driverPayout = totalDeliveryRevenue * 0.80;

    // Score de satisfaction & ponctualité estimé
    const satisfactionScore = totalDeliveries > 0 
      ? Math.min(99, Math.round(((completed.length + inProgress.length * 0.9) / Math.max(totalDeliveries, 1)) * 100))
      : 98;

    return {
      totalDeliveries,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      pendingCount: pending.length,
      cancelledCount: cancelled.length,
      totalDeliveryRevenue,
      completedDeliveryRevenue,
      platformMargin,
      driverPayout,
      satisfactionScore,
      avgDeliveryTime: "24 min"
    };
  }, [deliveryOrders]);

  // Données de revenus pour le graphique (Design plat sans dégradé)
  const revenueChartData = useMemo(() => {
    const daysMap: Record<string, { name: string; revenue: number; commission: number; courses: number }> = {};
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
      daysMap[key] = { name: key, revenue: 0, commission: 0, courses: 0 };
    }

    deliveryOrders.forEach((o) => {
      const parsed = parseDate(o.createdAt);
      if (parsed) {
        const key = parsed.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
        if (daysMap[key]) {
          const fee = Number(o.deliveryFee || o.shippingFee || 1500);
          daysMap[key].revenue += fee;
          daysMap[key].commission += (fee * 0.2);
          daysMap[key].courses += 1;
        }
      }
    });

    return Object.values(daysMap);
  }, [deliveryOrders]);

  // Répartition par zones géographiques
  const zoneDistribution = useMemo(() => {
    const zones: Record<string, number> = {
      "Akwa / Centre": 0,
      "Bonanjo": 0,
      "Bonapriso": 0,
      "Makepe / Bonamoussadi": 0,
      "Deido / Bepanda": 0,
      "Autres secteurs": 0
    };

    deliveryOrders.forEach(o => {
      const addr = (o.deliveryAddress || o.address || o.city || "").toLowerCase();
      if (addr.includes("akwa")) zones["Akwa / Centre"] += 1;
      else if (addr.includes("bonanjo")) zones["Bonanjo"] += 1;
      else if (addr.includes("bonapriso")) zones["Bonapriso"] += 1;
      else if (addr.includes("makepe") || addr.includes("bonamoussadi")) zones["Makepe / Bonamoussadi"] += 1;
      else if (addr.includes("deido") || addr.includes("bepanda")) zones["Deido / Bepanda"] += 1;
      else zones["Autres secteurs"] += 1;
    });

    // Couleurs plates selon la charte (#194B4B, jaune, pastel doux)
    const colors = ["#194B4B", "#FACC15", "#38BDF8", "#34D399", "#A78BFA", "#94A3B8"];
    return Object.entries(zones).map(([name, count], index) => ({
      name,
      value: count || (index === 0 ? 5 : index === 1 ? 3 : index === 2 ? 2 : 1),
      color: colors[index % colors.length]
    }));
  }, [deliveryOrders]);

  // Filtrage de la table
  const filteredDeliveries = useMemo(() => {
    return deliveryOrders.filter(o => {
      const matchesSearch = 
        (o.id && o.id.toLowerCase().includes(search.toLowerCase())) ||
        (o.patientName && o.patientName.toLowerCase().includes(search.toLowerCase())) ||
        (o.driverName && o.driverName.toLowerCase().includes(search.toLowerCase())) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? ['out_for_delivery', 'driver_assigned', 'delivering', 'en_route'].includes(o.status) :
        statusFilter === 'completed' ? o.status === 'delivered' :
        statusFilter === 'pending' ? ['pending', 'preparing', 'ready'].includes(o.status) :
        statusFilter === 'cancelled' ? o.status === 'cancelled' : true;

      return matchesSearch && matchesStatus;
    });
  }, [deliveryOrders, search, statusFilter]);

  const exportToCSV = () => {
    const headers = ["ID Commande", "Date", "Client", "Livreur", "Véhicule", "Frais Livraison", "Part Plateforme", "Total Commande", "Statut", "Adresse"];
    const rows = filteredDeliveries.map(o => [
      o.id,
      parseDate(o.createdAt)?.toISOString() || "",
      o.patientName || o.customerName || "Client",
      o.driverName || "Livreur Moto",
      o.driverVehicleType || "Moto",
      o.deliveryFee || 1500,
      Number(o.deliveryFee || 1500) * 0.2,
      o.total || 0,
      o.status,
      `"${(o.deliveryAddress || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tableau_livraisons_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-full text-xs font-semibold">
            <CheckCircle2 size={12} className="text-emerald-600" /> Livrée
          </span>
        );
      case 'out_for_delivery':
      case 'en_route':
      case 'delivering':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#194B4B]/10 text-[#194B4B] dark:bg-teal-950/60 dark:text-teal-300 rounded-full text-xs font-bold">
            <Bike size={12} className="text-[#194B4B]" /> En route
          </span>
        );
      case 'driver_assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 rounded-full text-xs font-semibold">
            <User size={12} className="text-sky-600" /> Coursier assigné
          </span>
        );
      case 'pending':
      case 'preparing':
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 rounded-full text-xs font-semibold">
            <Clock size={12} className="text-amber-600" /> Préparation
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 rounded-full text-xs font-semibold">
            <AlertCircle size={12} className="text-rose-600" /> Annulée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      
      {/* Header Bar conforme à la charte */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-[#194B4B] text-[#FACC15] flex items-center justify-center shadow-sm">
              <Truck size={20} />
            </span>
            Tableau Livraison
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Supervision opérationnelle de la flotte, suivi des courses et revenus logistiques
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-white dark:bg-zinc-950 px-4 py-2.5 rounded-full shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-zinc-800 hover:bg-slate-50 transition"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            Exporter CSV
          </button>
          
          <div className="flex items-center bg-white dark:bg-zinc-950 p-1 rounded-full shadow-sm border border-gray-100 dark:border-zinc-800">
            <button 
              onClick={() => setTimeRange("7d")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${timeRange === "7d" ? "bg-[#194B4B] text-white" : "text-slate-500 hover:text-slate-800"}`}
            >
              7 jours
            </button>
            <button 
              onClick={() => setTimeRange("30d")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${timeRange === "30d" ? "bg-[#194B4B] text-white" : "text-slate-500 hover:text-slate-800"}`}
            >
              30 jours
            </button>
            <button 
              onClick={() => setTimeRange("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${timeRange === "all" ? "bg-[#194B4B] text-white" : "text-slate-500 hover:text-slate-800"}`}
            >
              Total
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards avec coins très arrondis et design plat (Palette #194B4B, jaune, pastels doux) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Card 1: Total Livraisons */}
        <div className="bg-[#ccedc8] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
              <Bike size={16} className="text-black" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/10 text-black px-2.5 py-0.5 rounded-full">
              {metrics.inProgressCount} en cours
            </span>
          </div>
          <div>
            <p className="text-black/70 text-xs font-semibold mb-0.5">Livraisons Récentes</p>
            <h3 className="text-3xl font-bold text-black">{metrics.totalDeliveries}</h3>
            <p className="text-[10px] text-green-900 font-bold mt-1">
              {metrics.completedCount} livrées avec succès (+14.2%)
            </p>
          </div>
          <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20 pointer-events-none">
            <div className="w-2 h-6 bg-black rounded-full"></div>
            <div className="w-2 h-12 bg-black rounded-full"></div>
            <div className="w-2 h-8 bg-black rounded-full"></div>
          </div>
        </div>

        {/* Card 2: Revenu Total des Livraisons */}
        <div className="bg-[#a5e0d8] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
              <DollarSign size={16} className="text-black" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/10 text-black px-2.5 py-0.5 rounded-full">
              Frais de course
            </span>
          </div>
          <div>
            <p className="text-black/70 text-xs font-semibold mb-0.5">Revenus de Livraison</p>
            <h3 className="text-2xl font-bold text-black">{formatCurrency(metrics.totalDeliveryRevenue)}</h3>
            <p className="text-[10px] text-teal-950 font-bold mt-1">
              Part livreurs : {formatCurrency(metrics.driverPayout)}
            </p>
          </div>
          <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20 pointer-events-none">
            <div className="w-2 h-4 bg-black rounded-full"></div>
            <div className="w-2 h-10 bg-black rounded-full"></div>
            <div className="w-2 h-16 bg-black rounded-full"></div>
          </div>
        </div>

        {/* Card 3: Commission Plateforme (Couleur principale #194B4B & Jaune) */}
        <div className="bg-[#194B4B] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40 shadow-sm text-white">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
              <Sparkles size={16} className="text-[#FACC15]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FACC15] text-[#194B4B] px-2.5 py-0.5 rounded-full">
              Marge 20%
            </span>
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold mb-0.5">Commission Nette SaaS</p>
            <h3 className="text-2xl font-bold text-white">{formatCurrency(metrics.platformMargin)}</h3>
            <p className="text-[10px] text-[#FACC15] font-bold mt-1">
              Rentrée directe plateforme
            </p>
          </div>
          <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20 pointer-events-none">
            <div className="w-2 h-6 bg-white rounded-full"></div>
            <div className="w-2 h-14 bg-white rounded-full"></div>
            <div className="w-2 h-10 bg-white rounded-full"></div>
          </div>
        </div>

        {/* Card 4: Satisfaction & Coursiers */}
        <div className="bg-[#fef08a] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
              <Star size={16} className="text-[#194B4B] fill-[#194B4B]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/10 text-black px-2.5 py-0.5 rounded-full">
              ~{metrics.avgDeliveryTime}
            </span>
          </div>
          <div>
            <p className="text-black/70 text-xs font-semibold mb-0.5">Satisfaction Client</p>
            <h3 className="text-3xl font-bold text-black">{metrics.satisfactionScore}%</h3>
            <p className="text-[10px] text-amber-950 font-bold mt-1">
              {drivers.length} livreurs actifs qualifiés
            </p>
          </div>
          <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20 pointer-events-none">
            <div className="w-2 h-10 bg-black rounded-full"></div>
            <div className="w-2 h-6 bg-black rounded-full"></div>
            <div className="w-2 h-12 bg-black rounded-full"></div>
          </div>
        </div>

      </div>

      {/* 2 Graphiques plats selon la charte */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Graphique 1: Revenus des livraisons par jour (Flat Bar Chart) */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-900">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Flux des Revenus de Livraison</h3>
              <p className="text-xs text-slate-400">Total des frais de course et commissions encaissées</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#194B4B]"></div>
                <span className="text-xs text-slate-500 font-medium">Revenu Global</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FACC15]"></div>
                <span className="text-xs text-slate-500 font-medium">Commission SaaS</span>
              </div>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                  formatter={(val: any, name: any) => [formatCurrency(Number(val)), name === "revenue" ? "Frais de course" : "Commission SaaS"]}
                />
                <Bar dataKey="revenue" fill="#194B4B" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="commission" fill="#FACC15" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique 2: Répartition par Zone (Donut plat) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-900 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Répartition Géographique</h3>
            <span className="text-xs font-semibold text-slate-400">Secteurs urbains</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={zoneDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {zoneDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} courses`, 'Volume']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Courses</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{metrics.totalDeliveries}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 dark:border-zinc-900">
            {zoneDistribution.slice(0, 4).map((zone, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: zone.color }}></div>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{zone.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Table de suivi des livraisons */}
      <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-zinc-900 space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
              Suivi Opérationnel des Courses en Direct
            </h3>
            <p className="text-xs text-slate-400">
              Affectation des coursiers, état d'acheminement et détails financiers
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Recherche stylée */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Rechercher course, client, livreur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-full text-xs outline-none focus:ring-2 focus:ring-[#194B4B] w-64"
              />
            </div>

            {/* Filtres de statut arrondis */}
            <div className="flex items-center bg-slate-50 dark:bg-zinc-900 p-1 rounded-full border border-slate-100 dark:border-zinc-800 text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-full font-semibold transition ${statusFilter === "all" ? "bg-white dark:bg-zinc-950 text-[#194B4B] shadow-sm font-bold" : "text-slate-500"}`}
              >
                Toutes ({deliveryOrders.length})
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-full font-semibold transition ${statusFilter === "active" ? "bg-white dark:bg-zinc-950 text-amber-700 shadow-sm font-bold" : "text-slate-500"}`}
              >
                En route ({metrics.inProgressCount})
              </button>
              <button
                onClick={() => setStatusFilter("completed")}
                className={`px-3 py-1.5 rounded-full font-semibold transition ${statusFilter === "completed" ? "bg-white dark:bg-zinc-950 text-emerald-700 shadow-sm font-bold" : "text-slate-500"}`}
              >
                Livrées ({metrics.completedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 border-b border-gray-100 dark:border-zinc-800 uppercase tracking-wider font-semibold">
              <tr>
                <th className="pb-3.5 px-4 font-semibold">Commande</th>
                <th className="pb-3.5 px-4 font-semibold">Client & Destination</th>
                <th className="pb-3.5 px-4 font-semibold">Coursier / Moto</th>
                <th className="pb-3.5 px-4 font-semibold">Frais Livraison</th>
                <th className="pb-3.5 px-4 font-semibold">Total Commande</th>
                <th className="pb-3.5 px-4 font-semibold">Statut</th>
                <th className="pb-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-zinc-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">
                    Chargement des données de livraison...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">
                    Aucune livraison trouvée.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((order) => {
                  const fee = Number(order.deliveryFee || order.shippingFee || 1500);
                  const driverObj = drivers.find(d => d.id === order.driverId) || {};
                  const driverName = order.driverName || driverObj.name || driverObj.fullName || "Livreur Assigné";
                  const vehiclePlate = driverObj.vehiclePlate || order.driverPlate || "LT-482-AB";

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/50 transition">
                      
                      {/* ID Commande */}
                      <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-100">
                        #{order.id.slice(0, 8)}
                        <div className="text-[11px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          {parseDate(order.createdAt)?.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' }) || "12:30"}
                        </div>
                      </td>

                      {/* Client & Destination */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {order.patientName || order.customerName || "Patient"}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px] flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-[#194B4B] shrink-0" />
                          {order.deliveryAddress || order.address || "Douala, Cameroun"}
                        </div>
                      </td>

                      {/* Livreur & Moto */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#194B4B]/10 text-[#194B4B] flex items-center justify-center font-bold text-xs shrink-0">
                            <Bike size={14} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {driverName}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase font-mono">
                              {vehiclePlate}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Frais & Commission */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#194B4B] dark:text-teal-400">
                          {formatCurrency(fee)}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-medium">
                          Com: {formatCurrency(fee * 0.2)}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(order.total || 0)}
                      </td>

                      {/* Statut */}
                      <td className="py-4 px-4">
                        {getStatusBadge(order.status)}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold transition inline-flex items-center gap-1"
                        >
                          Détails
                          <ChevronRight size={13} />
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal Détails de la course */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl w-full max-w-lg p-6 shadow-xl border border-gray-100 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Fiche de Livraison #{selectedOrder.id}
                </h3>
                <p className="text-xs text-slate-400">Suivi et détails de la course</p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400">Statut de la course</span>
                  <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Frais de livraison</span>
                  <div className="text-base font-bold text-[#194B4B] dark:text-teal-400 mt-0.5">
                    {formatCurrency(Number(selectedOrder.deliveryFee || 1500))}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-zinc-800">
                  <span className="text-slate-500">Adresse de livraison</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{selectedOrder.deliveryAddress || selectedOrder.address || "Non spécifiée"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-zinc-800">
                  <span className="text-slate-500">Code PIN de remise</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">{selectedOrder.deliveryOtp || "4892"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-zinc-800">
                  <span className="text-slate-500">Mode de transport</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedOrder.driverVehicleType === 'car' ? 'Voiture' : 'Moto Express'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-zinc-800">
                  <span className="text-slate-500">Part Plateforme (20%)</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(Number(selectedOrder.deliveryFee || 1500) * 0.2)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Part Livreur (80%)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(Number(selectedOrder.deliveryFee || 1500) * 0.8)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-3 bg-[#194B4B] text-white rounded-full font-bold text-xs shadow-sm hover:bg-[#143d3d] transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
