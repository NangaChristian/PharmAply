import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BarChart2, TrendingUp, TrendingDown, DollarSign, 
  Calendar, ShoppingBag, ArrowUpRight, ArrowDownRight, 
  Search, Filter, Download, CheckCircle, Clock, XCircle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, BarChart, Bar 
} from 'recharts';
import { 
  collection, query, where, onSnapshot, getDocs, db 
} from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate, sortByDateDesc } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useUserProfiles } from '../../lib/userSync';
import { UserAvatar } from '../../components/common/UserAvatar';

export function PharmacistSales() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, userData } = useAuth();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');

  const patientIds = useMemo(() => {
    return orders.map(o => o.patientId || o.userId).filter(Boolean);
  }, [orders]);

  const userProfiles = useUserProfiles(patientIds);

  // Load orders from Firestore for the pharmacist's pharmacy
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    let unsubscribe: () => void;

    const fetchSalesData = async () => {
      try {
        let pharmacyId = user.uid;
        try {
          const pQuery = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
          const pSnap = await getDocs(pQuery);
          if (!pSnap.empty) {
            pharmacyId = pSnap.docs[0].id;
          }
        } catch (e) {}

        const q = query(
          collection(db, 'orders'),
          where('pharmacyId', '==', pharmacyId)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setOrders(sortByDateDesc(docs));
          setLoading(false);
        }, (error) => {
          console.error("Sales fetch error:", error);
          setLoading(false);
        });
      } catch (err) {
        console.error("Error setting up sales listener:", err);
        setLoading(false);
      }
    };

    fetchSalesData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Filter orders by time range
  const filteredByTime = useMemo(() => {
    const now = dayjs();
    return orders.filter(o => {
      if (timeRange === 'all') return true;
      const orderDate = o.createdAt ? dayjs(parseDate(o.createdAt) || o.createdAt) : null;
      if (!orderDate || !orderDate.isValid()) return false;

      if (timeRange === 'today') return orderDate.isSame(now, 'day');
      if (timeRange === 'week') return orderDate.isAfter(now.subtract(7, 'day'));
      if (timeRange === 'month') return orderDate.isSame(now, 'month') && orderDate.isSame(now, 'year');
      if (timeRange === 'year') return orderDate.isSame(now, 'year');
      return true;
    });
  }, [orders, timeRange]);

  // Key Metrics
  const metrics = useMemo(() => {
    const successfulOrders = filteredByTime.filter(o => !['cancelled', 'rejected'].includes(o.status));
    const cancelledOrders = filteredByTime.filter(o => ['cancelled', 'rejected'].includes(o.status));

    const totalRevenue = successfulOrders.reduce((sum, o) => {
      const val = Number(o.totalAmount || o.totalPrice || o.amount || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalRefunds = cancelledOrders.reduce((sum, o) => {
      const val = Number(o.totalAmount || o.totalPrice || o.amount || 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const totalItemsSold = successfulOrders.reduce((sum, o) => {
      if (Array.isArray(o.items)) {
        return sum + o.items.reduce((itemSum: number, it: any) => itemSum + (Number(it.quantity) || 1), 0);
      }
      return sum + 1;
    }, 0);

    const avgOrderValue = successfulOrders.length > 0 ? Math.round(totalRevenue / successfulOrders.length) : 0;

    return {
      totalRevenue,
      totalRefunds,
      totalItemsSold,
      successfulCount: successfulOrders.length,
      cancelledCount: cancelledOrders.length,
      avgOrderValue
    };
  }, [filteredByTime]);

  // Chart data aggregation
  const chartData = useMemo(() => {
    const dataMap: Record<string, { label: string; revenue: number; ordersCount: number }> = {};

    if (timeRange === 'today') {
      for (let h = 8; h <= 22; h += 2) {
        const key = `${h}h`;
        dataMap[key] = { label: key, revenue: 0, ordersCount: 0 };
      }
      filteredByTime.forEach(o => {
        if (['cancelled', 'rejected'].includes(o.status)) return;
        const d = parseDate(o.createdAt);
        if (d) {
          const hour = Math.floor(d.getHours() / 2) * 2;
          const key = `${hour}h`;
          if (dataMap[key]) {
            dataMap[key].revenue += Number(o.totalAmount || o.totalPrice || 0);
            dataMap[key].ordersCount += 1;
          }
        }
      });
    } else if (timeRange === 'week') {
      const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      for (let i = 6; i >= 0; i--) {
        const d = dayjs().subtract(i, 'day');
        const key = d.format('DD/MM');
        dataMap[key] = { label: `${days[d.day()]} ${d.format('DD')}`, revenue: 0, ordersCount: 0 };
      }
      filteredByTime.forEach(o => {
        if (['cancelled', 'rejected'].includes(o.status)) return;
        const d = parseDate(o.createdAt);
        if (d) {
          const key = dayjs(d).format('DD/MM');
          if (dataMap[key]) {
            dataMap[key].revenue += Number(o.totalAmount || o.totalPrice || 0);
            dataMap[key].ordersCount += 1;
          }
        }
      });
    } else {
      // Month or year (split into weeks or months)
      for (let i = 1; i <= 4; i++) {
        const key = `Semaine ${i}`;
        dataMap[key] = { label: key, revenue: 0, ordersCount: 0 };
      }
      filteredByTime.forEach(o => {
        if (['cancelled', 'rejected'].includes(o.status)) return;
        const d = parseDate(o.createdAt);
        if (d) {
          const weekNum = Math.min(4, Math.ceil(d.getDate() / 7));
          const key = `Semaine ${weekNum}`;
          if (dataMap[key]) {
            dataMap[key].revenue += Number(o.totalAmount || o.totalPrice || 0);
            dataMap[key].ordersCount += 1;
          }
        }
      });
    }

    return Object.values(dataMap);
  }, [filteredByTime, timeRange]);

  // Filtered transactions list
  const transactions = useMemo(() => {
    return filteredByTime.filter(o => {
      if (statusFilter === 'delivered' && o.status !== 'delivered') return false;
      if (statusFilter === 'cancelled' && !['cancelled', 'rejected'].includes(o.status)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = (o.patientName || '').toLowerCase();
        const code = (o.id || '').toLowerCase();
        return client.includes(q) || code.includes(q);
      }
      return true;
    });
  }, [filteredByTime, statusFilter, searchQuery]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 rounded-xl text-[#194B4B] dark:text-teal-400">
              <BarChart2 size={24} />
            </div>
            {t('sales', 'Ventes & Performance Financière')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t('monitor_sales_desc', 'Suivi en direct du chiffre d\'affaires, volumes et transactions')}
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xs">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              timeRange === 'today' 
                ? 'bg-[#194B4B] text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              timeRange === 'week' 
                ? 'bg-[#194B4B] text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            7 jours
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              timeRange === 'month' 
                ? 'bg-[#194B4B] text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Ce mois
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              timeRange === 'all' 
                ? 'bg-[#194B4B] text-white shadow-xs' 
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Historique complet
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xs border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{t('total_revenue', 'Chiffre d\'Affaires')}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(metrics.totalRevenue)}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
            <TrendingUp size={14} /> {metrics.successfulCount} {t('successful_orders', 'commandes validées')}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xs border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{t('items_sold', 'Articles Vendus')}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {metrics.totalItemsSold}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-600 font-bold">
            <CheckCircle size={14} /> Unités délivrées
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xs border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
              <BarChart2 size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{t('average_order', 'Panier Moyen')}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(metrics.avgOrderValue)}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-amber-600 font-bold">
            <ArrowUpRight size={14} /> Moyenne par client
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xs border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 rounded-2xl flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{t('refunds_cancelled', 'Annulations / Rejets')}</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(metrics.totalRefunds)}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-rose-600 font-bold">
            <XCircle size={14} /> {metrics.cancelledCount} commandes refusées
          </div>
        </div>
      </div>

      {/* Revenue Graph */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xs border border-gray-100 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Évolution des Ventes
            </h3>
            <p className="text-xs text-gray-400">
              Chiffre d'affaires réalisé sur la période
            </p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#194B4B" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#194B4B" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
              <Tooltip 
                formatter={(value: any) => [formatCurrency(Number(value)), "Chiffre d'Affaires"]}
                contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#194B4B" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#salesGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xs border border-gray-100 dark:border-slate-700 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">
              Historique des Transactions Récentes
            </h3>
            <p className="text-xs text-gray-400">
              Détail des commandes passées auprès de votre officine
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par client ou ID..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#194B4B]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200"
            >
              <option value="all">Tous les statuts</option>
              <option value="delivered">Livrées uniquement</option>
              <option value="cancelled">Annulées / Rejetées</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Commande</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Articles</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50 text-sm">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                    Aucune transaction trouvée pour cette période.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const shortId = t.id ? t.id.slice(0, 6).toUpperCase() : 'N/A';
                  const dateStr = parseDate(t.createdAt) 
                    ? parseDate(t.createdAt)!.toLocaleDateString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) 
                    : 'Récemment';

                  const isDelivered = t.status === 'delivered';
                  const isCancelled = ['cancelled', 'rejected'].includes(t.status);

                  const pId = t.patientId || t.userId;
                  const liveName = userProfiles[pId]?.name || t.patientName || 'Client';
                  const livePhoto = userProfiles[pId]?.photoUrl || t.patientPhoto || t.patientPhotoUrl || '';

                  return (
                    <tr 
                      key={t.id} 
                      onClick={() => navigate(`/pharmacist/order/${t.id}`)}
                      className="hover:bg-gray-50/70 dark:hover:bg-slate-700/40 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-[#194B4B] dark:text-teal-400">
                        #{shortId}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            userId={pId}
                            name={liveName}
                            photoUrl={livePhoto}
                            sizeClassName="w-7 h-7"
                          />
                          <span>{liveName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs">
                        {Array.isArray(t.items) ? `${t.items.length} produit(s)` : '1 ordonnance'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-xs">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          isDelivered 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : isCancelled 
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {t.status === 'delivered' ? 'Livré' : isCancelled ? 'Annulé' : 'En cours'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(Number(t.totalAmount || t.totalPrice || 0))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
