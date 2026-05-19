import { useState, useEffect } from "react";
import { collection, query, getDocs } from '../../lib/firebase';
import { db } from "../../lib/firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Users, Package, FileText } from "lucide-react";
import { formatCurrency } from "../../lib/utils";
import { useTranslation } from "react-i18next";

export function AdminReports() {
    const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalPharmacies: 0,
    totalRevenue: 0,
  });

  const [loading, setLoading] = useState(true);

  const mockChartData = [
    { name: 'Mon', revenue: 4000, orders: 24 },
    { name: 'Tue', revenue: 3000, orders: 13 },
    { name: 'Wed', revenue: 2000, orders: 98 },
    { name: 'Thu', revenue: 2780, orders: 39 },
    { name: 'Fri', revenue: 1890, orders: 48 },
    { name: 'Sat', revenue: 2390, orders: 38 },
    { name: 'Sun', revenue: 3490, orders: 43 },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, "users")));
        const ordersSnap = await getDocs(query(collection(db, "orders")));
        const pharmaciesSnap = await getDocs(query(collection(db, "pharmacies")));

        let rev = 0;
        ordersSnap.forEach((doc) => {
           rev += (doc.data().total || 0);
        });

        setStats({
          totalUsers: usersSnap.size,
          totalOrders: ordersSnap.size,
          totalPharmacies: pharmaciesSnap.size,
          totalRevenue: rev,
        });

      } catch (err) {
        console.error("Failed to fetch reports stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1"> {t('reports_analytics', 'Reports & Analytics')} </h1>
             <p className="text-gray-500 text-sm"> {t('monitor_platform_metrics_and_e', 'Monitor platform metrics and extract data')} </p>
         </div>
         <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-2">
            <Download size={18} />  {t('export_full_report', 'Export Full Report')} </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <TrendingUp size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('total_revenue', 'Total Revenue')} </p>
                <h3 className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalRevenue)}</h3>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Package size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('total_orders', 'Total Orders')} </p>
                <h3 className="text-2xl font-black text-slate-900">{stats.totalOrders}</h3>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Users size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('active_users', 'Active Users')} </p>
                <h3 className="text-2xl font-black text-slate-900">{stats.totalUsers}</h3>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <FileText size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('pharmacies', 'Pharmacies')} </p>
                <h3 className="text-2xl font-black text-slate-900">{stats.totalPharmacies}</h3>
             </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-96">
             <h3 className="text-lg font-bold text-slate-900 mb-6"> {t('weekly_revenue_overview', 'Weekly Revenue Overview')} </h3>
             <ResponsiveContainer width="100%" height="80%">
                <BarChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(val) => formatCurrency(val)} />
                  <Tooltip 
                     cursor={{fill: '#f8fafc'}}
                     contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
             </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
}
