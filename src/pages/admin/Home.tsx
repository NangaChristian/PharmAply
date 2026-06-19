import { Users, TrendingUp, AlertTriangle, CheckCircle, Package, Store, Calendar, RotateCcw, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, getDocs, onSnapshot, where } from '../../lib/firebase';
import { db } from "../../lib/firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { formatCurrency, parseDate } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { useAuth } from '../../components/AuthProvider';

export function AdminHome() {
  const { t } = useTranslation();
  const { user, userData } = useAuth();
  const [stats, setStats] = useState({
    activeOrders: 0,
    pharmaciesCount: 0,
    patientsCount: 0,
    driversCount: 0,
    pendingPharmacies: 0,
    pendingDrivers: 0,
    totalRevenue: 0,
    todaySales: 0,
    pieData: [
      { name: 'Delivered', value: 1, color: '#c4f0b2' },
      { name: 'Active', value: 1, color: '#81ded9' },
      { name: 'Pending', value: 1, color: '#fba5bd' },
      { name: 'Cancelled', value: 1, color: '#e2e8f0' }
    ]
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribeUsers: () => void;
    let unsubscribePharmacies: () => void;
    let unsubscribeOrders: () => void;

    try {
      const qUsers = collection(db, "users");
      unsubscribeUsers = onSnapshot(qUsers, (usersSnap) => {
        const users = usersSnap.docs.map(d => d.data());
        const patients = users.filter(u => u.role === "patient").length;
        const drivers = users.filter(u => u.role === "driver").length;
        const pendingDriversCount = users.filter(u => u.role === "driver" && u.status === "pending_verification").length;

        setStats(prev => ({
          ...prev,
          patientsCount: patients,
          driversCount: drivers,
          pendingDrivers: pendingDriversCount,
        }));
      });

      const qPharmacies = collection(db, "pharmacies");
      unsubscribePharmacies = onSnapshot(qPharmacies, (pharmaciesSnap) => {
        const pharmacies = pharmaciesSnap.docs.map(d => d.data());
        const approvedPharmacies = pharmacies.filter(p => p.status === "approved" || !p.status).length;
        const pendingPharmaciesCount = pharmacies.filter(p => p.status === "pending_verification").length;

        setStats(prev => ({
          ...prev,
          pharmaciesCount: approvedPharmacies,
          pendingPharmacies: pendingPharmaciesCount,
        }));
      });

      const qOrders = collection(db, "orders");
      unsubscribeOrders = onSnapshot(qOrders, (ordersSnap) => {
        const orders: any[] = ordersSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const activeOrdersCount = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length;
        const totalRev = orders.reduce((acc, order) => acc + (Number(order.totalPrice) || 0), 0);

        // Sort orders by createdAt if available, otherwise just use latest
        const sortedOrders = orders.sort((a, b) => {
          const tA = parseDate(a.createdAt) ? parseDate(a.createdAt)!.getTime() : 0;
          const tB = parseDate(b.createdAt) ? parseDate(b.createdAt)!.getTime() : 0;
          return tB - tA;
        });
        setRecentOrders(sortedOrders.slice(0, 5));

        setStats(prev => ({
          ...prev,
          activeOrders: activeOrdersCount,
          totalRevenue: totalRev,
          todaySales: Math.min(totalRev, 120), // Mock today's sales logic based on totalRev
          pieData: [
            { name: 'Delivered', value: orders.filter(o => o.status === 'delivered').length || 1, color: '#c4f0b2' },
            { name: 'Active', value: activeOrdersCount || 1, color: '#81ded9' },
            { name: 'Pending', value: orders.filter(o => o.status === 'pending').length || 1, color: '#fba5bd' },
            { name: 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length || 1, color: '#e2e8f0' }
          ]
        }));
      });
    } catch (err) {
      console.error("Error setting up listeners:", err);
    }

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribePharmacies) unsubscribePharmacies();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, []);

  const barData = [
    { name: 'Mon', uv: 4000, color: '#f3c78b' },
    { name: 'Tue', uv: 3000, color: '#f5b5f5' },
    { name: 'Wed', uv: 2000, color: '#b5e5b5' },
    { name: 'Thu', uv: 2780, color: '#8bd3d3' },
    { name: 'Fri', uv: 1890, color: '#fba5bd' },
    { name: 'Sat', uv: 2390, color: '#b2aaf2' },
  ];

  return (
    <div className="flex flex-col space-y-6">
      
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{userData?.name || user?.displayName || t('admin_welcome_text', 'Admin')}</h1>
         
         <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 bg-white dark:bg-zinc-950 px-4 py-2 rounded-full shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
              <Calendar size={16} />  {t('this_month', 'This Month')} </button>
            <button className="w-10 h-10 bg-white dark:bg-zinc-950 rounded-full shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-white transition">
              <RotateCcw size={16} />
            </button>
         </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
         <div className="bg-[#ccedc8] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="flex justify-between items-start">
             <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
               <TrendingUp size={16} className="text-black dark:text-white/60" />
             </div>
             <button className="text-black dark:text-white/40 hover:text-black dark:text-white/60"><MoreHorizontal size={20} /></button>
           </div>
           <div>
             <p className="text-black dark:text-white/60 text-sm font-medium mb-1">{t('admin_today_revenue', "Today's Revenue")}</p>
             <h3 className="text-3xl font-bold text-black dark:text-white/80">{formatCurrency(stats.todaySales)}</h3>
             <p className="text-[10px] text-green-700 font-bold mt-1"> {t('2_5_this_month', '+2.5% This Month')} </p>
           </div>
           {/* Decorative bars */}
           <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20">
             <div className="w-2 h-8 bg-black rounded-full"></div>
             <div className="w-2 h-12 bg-black rounded-full"></div>
             <div className="w-2 h-6 bg-black rounded-full"></div>
           </div>
         </div>

         <div className="bg-[#a5e0d8] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="flex justify-between items-start">
             <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
               <Store size={16} className="text-black dark:text-white/60" />
             </div>
             <button className="text-black dark:text-white/40 hover:text-black dark:text-white/60"><MoreHorizontal size={20} /></button>
           </div>
           <div>
             <p className="text-black dark:text-white/60 text-sm font-medium mb-1">{t('admin_pharmacies_count', "Pharmacies")}</p>
             <h3 className="text-3xl font-bold text-black dark:text-white/80">{stats.pharmaciesCount}</h3>
             <p className="text-[10px] text-teal-800 font-bold mt-1"> {t('2_5_this_month', '+2.5% This Month')} </p>
           </div>
           <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20">
             <div className="w-2 h-4 bg-black rounded-full"></div>
             <div className="w-2 h-10 bg-black rounded-full"></div>
             <div className="w-2 h-16 bg-black rounded-full"></div>
           </div>
         </div>

         <div className="bg-[#fbabbd] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="flex justify-between items-start">
             <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
               <Package size={16} className="text-black dark:text-white/60" />
             </div>
             <button className="text-black dark:text-white/40 hover:text-black dark:text-white/60"><MoreHorizontal size={20} /></button>
           </div>
           <div>
             <p className="text-black dark:text-white/60 text-sm font-medium mb-1">{t('admin_active_deliveries', "Active Deliveries")}</p>
             <h3 className="text-3xl font-bold text-black dark:text-white/80">{stats.activeOrders}</h3>
             <p className="text-[10px] text-red-800 font-bold mt-1"> {t('in_progress_right_now', 'In progress right now')} </p>
           </div>
           <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20">
             <div className="w-2 h-6 bg-black rounded-full"></div>
             <div className="w-2 h-16 bg-black rounded-full"></div>
             <div className="w-2 h-4 bg-black rounded-full"></div>
           </div>
         </div>

         <div className="bg-[#b3abf2] rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-between h-40">
           <div className="flex justify-between items-start">
             <div className="w-8 h-8 bg-black/10 rounded-full flex items-center justify-center">
               <Users size={16} className="text-black dark:text-white/60" />
             </div>
             <button className="text-black dark:text-white/40 hover:text-black dark:text-white/60"><MoreHorizontal size={20} /></button>
           </div>
           <div>
             <p className="text-black dark:text-white/60 text-sm font-medium mb-1">{t('admin_system_users', "System Users")}</p>
             <h3 className="text-3xl font-bold text-black dark:text-white/80">{stats.patientsCount + stats.driversCount + stats.pharmaciesCount}</h3>
             <p className="text-[10px] text-indigo-800 font-bold mt-1"> {t('total_platform_accounts', 'Total platform accounts')} </p>
           </div>
           <div className="absolute right-6 bottom-6 flex items-end gap-1 opacity-20">
             <div className="w-2 h-10 bg-black rounded-full"></div>
             <div className="w-2 h-6 bg-black rounded-full"></div>
             <div className="w-2 h-12 bg-black rounded-full"></div>
           </div>
         </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
         <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('admin_order_status_report', 'Order Status Report')}</h3>
              <button className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600">
                 <MoreHorizontal size={16} />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[250px]">
               <ResponsiveContainer width="100%" height={220}>
                 <PieChart>
                   <Pie
                     data={stats.pieData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {stats.pieData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-slate-400"> {t('total_orders', 'Total Orders')} </p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.activeOrders + stats.pieData[0].value + stats.pieData[2].value + stats.pieData[3].value}</p>
               </div>
            </div>
            
            <div className="flex justify-center gap-4 mt-4">
               {stats.pieData.map(item => (
                 <div key={item.name} className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                   <span className="text-[10px] text-slate-500 font-medium">{item.name}</span>
                 </div>
               ))}
            </div>
         </div>

         <div className="lg:col-span-3 bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('admin_total_revenue_overview', 'Total Revenue Overview')}</h3>
              <button className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600">
                 <MoreHorizontal size={16} />
              </button>
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => `${val / 1000}K`} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="uv" radius={[10, 10, 10, 10]} barSize={24}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Recent Orders List */}
      <div className="bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-sm border border-gray-100">
         <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{t('admin_recent_platform_orders', 'Recent Platform Orders')}</h3>
            <div className="flex items-center gap-3">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" placeholder={t('search', 'Search...')} className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-xs outline-none focus:ring-2 focus:ring-slate-900" />
               </div>
               <button className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-full text-xs font-medium text-slate-600 flex items-center gap-1">
                  {t('filter', 'Filter')} <span className="text-[10px]">▼</span>
               </button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-slate-500 border-b border-gray-100">
                  <tr>
                     <th className="pb-4 font-semibold px-4"> {t('order_id', 'Order ID')} </th>
                     <th className="pb-4 font-semibold px-4"> {t('pharmacy', 'Pharmacy')} </th>
                     <th className="pb-4 font-semibold px-4"> {t('status', 'Status')} </th>
                     <th className="pb-4 font-semibold px-4"> {t('total_price', 'Total Price')} </th>
                     <th className="pb-4 font-semibold px-4"> {t('date', 'Date')} </th>
                  </tr>
               </thead>
               <tbody>
                  {recentOrders.length > 0 ? recentOrders.map((order, idx) => (
                     <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-slate-50">
                        <td className="py-4 px-4 font-medium text-slate-800 dark:text-slate-100">{order.id?.slice(0, 8)}...</td>
                        <td className="py-4 px-4 text-slate-600">{order.pharmacyId?.slice(0, 8)}</td>
                        <td className="py-4 px-4">
                           <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-[10px] font-bold uppercase">{order.status || 'Pending'}</span>
                        </td>
                        <td className="py-4 px-4 text-slate-800 dark:text-slate-100 font-medium">{formatCurrency(Number(order.totalPrice || 0))}</td>
                        <td className="py-4 px-4 text-slate-500 text-xs"> {t('recently', 'Recently')} </td>
                     </tr>
                  )) : (
                     <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-sm"> {t('no_recent_orders', 'No recent orders.')} </td>
                     </tr>
                  )}
               </tbody>
            </table>
         </div>
         
         <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50">
            <p className="text-xs text-slate-500"> {t('showing_recent_orders', 'Showing recent orders')} </p>
            <div className="flex items-center gap-1">
               <button className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-700"> {t('prev', 'Prev')} </button>
               <button className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">1</button>
               <button className="w-8 h-8 rounded-full text-slate-500 text-xs font-bold flex items-center justify-center hover:bg-slate-100">2</button>
               <button className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-white"> {t('next', 'Next')} </button>
            </div>
         </div>
      </div>
      
    </div>
  );
}
