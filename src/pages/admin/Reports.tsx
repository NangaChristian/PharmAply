import { useState, useEffect } from "react";
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Download, TrendingUp, Users, Package, FileText, Truck } from "lucide-react";
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

  const driverPerformanceData = [
    { driver: 'John D.', speed: 22, completionRate: 98, delay: 2 },
    { driver: 'Sarah W.', speed: 28, completionRate: 95, delay: 5 },
    { driver: 'Mike R.', speed: 31, completionRate: 88, delay: 12 },
    { driver: 'Emma L.', speed: 25, completionRate: 99, delay: 1 },
    { driver: 'Tom B.', speed: 29, completionRate: 92, delay: 8 },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [{ count: usersCount }, { count: ordersCount }, { count: pharmaciesCount }] = await Promise.all([
           supabase.from('users').select('*', { count: 'exact', head: true }),
           supabase.from('orders').select('*', { count: 'exact', head: true }),
           supabase.from('pharmacies').select('*', { count: 'exact', head: true }),
        ]);

        // Mock revenue for now since we don't have total calculated column easily
        setStats({
          totalUsers: usersCount || 0,
          totalOrders: ordersCount || 0,
          totalPharmacies: pharmaciesCount || 0,
          totalRevenue: 12450,
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
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1"> {t('reports_analytics', 'Reports & Analytics')} </h1>
             <p className="text-gray-500 text-sm"> {t('monitor_platform_metrics_and_e', 'Monitor platform metrics and extract data')} </p>
         </div>
         <button className="bg-white dark:bg-zinc-950 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-2">
            <Download size={18} />  {t('export_full_report', 'Export Full Report')} </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  <TrendingUp size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('total_revenue', 'Total Revenue')} </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stats.totalRevenue)}</h3>
             </div>
             <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Package size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('total_orders', 'Total Orders')} </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalOrders}</h3>
             </div>
             <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                  <Users size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('active_users', 'Active Users')} </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalUsers}</h3>
             </div>
             <div className="bg-white dark:bg-zinc-950 p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <FileText size={24} />
                </div>
                <p className="text-sm font-bold text-slate-500 mb-1"> {t('pharmacies', 'Pharmacies')} </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalPharmacies}</h3>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-sm border border-slate-100 h-96">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6"> {t('weekly_revenue_overview', 'Weekly Revenue Overview')} </h3>
                 <ResponsiveContainer width="100%" height={280}>
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
              
              <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-sm border border-slate-100 h-96">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"> 
                       <Truck className="text-indigo-600" size={20} /> Driver Fleet Performance
                    </h3>
                 </div>
                 <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={driverPerformanceData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="driver" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip 
                         contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line yAxisId="left" type="monotone" name="Delivery Time (mins)" dataKey="speed" stroke="#a855f7" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                      <Line yAxisId="right" type="monotone" name="Success Rate (%)" dataKey="completionRate" stroke="#22c55e" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
                      <Line yAxisId="left" type="monotone" name="Avg Delay (mins)" dataKey="delay" stroke="#ef4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
                    </LineChart>
                 </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
}
