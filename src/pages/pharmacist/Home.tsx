import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, Lock, Grid, Activity, Users, Settings, MoreHorizontal, CheckCircle, Package, ShieldAlert, AlertTriangle, Clock, TrendingUp, DollarSign, Pill, Moon, Sun, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { useDarkMode } from '../../components/DarkModeProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { NotificationBell } from "../../components/NotificationBell";

export function PharmacistHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let unsubscribeOrders: () => void;
    let unsubscribeProducts: () => void;

    const fetchContext = async () => {
      if (!user) return;
      try {
        const pQuery = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
        const pSnap = await getDocs(pQuery);
        if (pSnap.empty) {
          setLoading(false);
          return;
        }
        
        const pharmDoc = pSnap.docs[0];
        setPharmacy({ id: pharmDoc.id, ...pharmDoc.data() });
        const pharmacyId = pharmDoc.id;

        const ordersQuery = query(collection(db, 'orders'), where('pharmacyId', '==', pharmacyId));
        unsubscribeOrders = onSnapshot(ordersQuery, (oSnap) => {
           const fetchedOrders = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
           setOrders(fetchedOrders);
           
           // Calculate unique customers
           const uniqueCustomers = new Set<string>();
           fetchedOrders.forEach(o => {
             if (o.userId) uniqueCustomers.add(o.userId);
           });
           setCustomers(uniqueCustomers);
        });

        const pProductsQuery = query(collection(db, 'products'), where('pharmacyId', '==', pharmacyId));
        unsubscribeProducts = onSnapshot(pProductsQuery, (pSnap2) => {
           setProducts(pSnap2.docs.map(d => ({ id: d.id, ...d.data() })));
           setLoading(false);
        });
        
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchContext();

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, [user]);

  const todayRevenue = orders.reduce((sum, order) => {
    if (order.createdAt && dayjs(parseDate(order.createdAt)).isSame(dayjs(), 'day')) {
      return sum + (order.total || 0);
    }
    return sum;
  }, 0);

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  
  const expiredCount = products.filter(p => p.expiryDate && dayjs(p.expiryDate).isBefore(dayjs())).length;
  const expiredPercentage = products.length > 0 ? (expiredCount / products.length) * 100 : 0;

  // Compute Weekly Sales Data
  const last7Days = Array.from({length: 6}).map((_, i) => dayjs().subtract(5 - i, 'day'));
  const salesData = last7Days.map(date => {
     const dayOrders = orders.filter(o => o.createdAt && dayjs(parseDate(o.createdAt)).isSame(date, 'day'));
     const dayTotal = dayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
     return {
        name: date.format('ddd'),
        total: dayTotal,
        date: date.format('MMM DD, YYYY')
     };
  });

  // Calculate Graph Report data (e.g. Sales by Category)
  const categorySalesMap = new Map<string, number>();
  orders.forEach(order => {
     if (order.items) {
        order.items.forEach((item: any) => {
           const product = products.find(p => p.id === item.productId);
           const cat = product?.category || product?.ux_category_id || 'Unknown';
           categorySalesMap.set(cat, (categorySalesMap.get(cat) || 0) + (item.price * item.quantity));
        });
     }
  });

  const rawPieData = Array.from(categorySalesMap.entries()).map(([name, value]) => ({ name, value }));
  const pieData = rawPieData.length > 0 ? rawPieData.sort((a,b) => b.value - a.value).slice(0, 4) : [{name: 'No Sales', value: 1}];
  
  const COLORS = ['#A2E2D5', '#FFB8BA', '#C1BDEB', '#D3F5A8'];

  return (
    <div className="flex-1 bg-transparent flex flex-col relative h-full overflow-hidden">
      
      {/* Top Navigation Bar */}
      <div className="px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex-1 flex items-center">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                   type="text" 
                   placeholder="Search" 
                   className="w-full bg-[#FAFBFA] dark:bg-slate-800 border border-transparent focus:border-gray-200 py-3 pl-12 pr-4 rounded-full text-sm outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
             </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 bg-[#FAFBFA] dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm cursor-pointer">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">EN</span>
                <ChevronDown size={14} className="text-gray-400" />
             </div>
             
             <button 
                onClick={toggleDarkMode}
                className="w-10 h-10 flex items-center justify-center bg-[#FAFBFA] dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors rounded-full text-gray-600 dark:text-gray-300 shadow-sm"
             >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>

             <div className="flex items-center gap-3 cursor-pointer">
                <img 
                  src={user?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full object-cover shadow-sm"
                />
                <div className="hidden sm:block">
                   <p className="font-bold text-gray-900 dark:text-white text-sm">{userData?.name || user?.displayName || pharmacy?.name || 'Pharmacist'}</p>
                   <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
             </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar space-y-8">
         
         {/* Welcome Section */}
         <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
               Welcome {userData?.name?.split(' ')[0] || 'Back'}!
            </h1>
            <div className="bg-[#0B3B3C] text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-md cursor-pointer hover:bg-[#082a2b] transition-colors">
               <span>Team Member</span>
               <ChevronDown size={14} />
            </div>
         </div>

         {/* Stats Row */}
         <div>
            <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Pharmacy Sales Results</h2>
               <div className="flex items-center gap-3">
                  <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold shadow-sm cursor-pointer">
                     <Clock size={14} />
                     <span>This Month</span>
                     <ChevronDown size={14} className="text-gray-400" />
                  </div>
                  <button className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-600 shadow-sm hover:bg-gray-50">
                     <Activity size={16} />
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="bg-[#D3F5A8] rounded-3xl p-6 relative overflow-hidden shadow-sm">
                   <div className="flex justify-between items-start mb-6 z-10 relative">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#0B3B3C]">
                         <Lock size={14} />
                      </div>
                      <MoreHorizontal size={16} className="text-[#0B3B3C]/50" />
                   </div>
                   <div className="z-10 relative">
                      <p className="text-[#0B3B3C]/70 text-sm font-bold mb-1">Todays Sales</p>
                      <h3 className="text-3xl font-black text-[#0B3B3C] mb-2">{formatCurrency(todayRevenue)}</h3>
                      <p className="text-xs font-bold text-[#0B3B3C]/60 flex items-center gap-1">
                         <span className="text-[#0B3B3C]">+2.5%</span> This Month
                      </p>
                   </div>
                   <div className="absolute bottom-0 right-4 flex items-end gap-1.5 opacity-20 h-16">
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-3/4"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-1/2"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                   </div>
               </div>

               <div className="bg-[#A2E2D5] rounded-3xl p-6 relative overflow-hidden shadow-sm">
                   <div className="flex justify-between items-start mb-6 z-10 relative">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#0B3B3C]">
                         <Grid size={14} />
                      </div>
                      <MoreHorizontal size={16} className="text-[#0B3B3C]/50" />
                   </div>
                   <div className="z-10 relative">
                      <p className="text-[#0B3B3C]/70 text-sm font-bold mb-1">Available Categories</p>
                      <h3 className="text-3xl font-black text-[#0B3B3C] mb-2">
                        {Array.from(new Set(products.map(p => p.category || p.ux_category_id))).filter(Boolean).length}
                      </h3>
                      <p className="text-xs font-bold text-[#0B3B3C]/60 flex items-center gap-1">
                         <span className="text-[#0B3B3C]">+2.5%</span> This Month
                      </p>
                   </div>
                   <div className="absolute bottom-0 right-4 flex items-end gap-1.5 opacity-20 h-16">
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-1/2"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-3/4"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                   </div>
               </div>

               <div className="bg-[#FFB8BA] rounded-3xl p-6 relative overflow-hidden shadow-sm">
                   <div className="flex justify-between items-start mb-6 z-10 relative">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#0B3B3C]">
                         <Activity size={14} />
                      </div>
                      <MoreHorizontal size={16} className="text-[#0B3B3C]/50" />
                   </div>
                   <div className="z-10 relative">
                      <p className="text-[#0B3B3C]/70 text-sm font-bold mb-1">Expired Medicines</p>
                      <h3 className="text-3xl font-black text-[#0B3B3C] mb-2">{expiredPercentage.toFixed(2)}%</h3>
                      <p className="text-xs font-bold text-[#0B3B3C]/60 flex items-center gap-1">
                         <span className="text-[#0B3B3C]">+2.5%</span> This Month
                      </p>
                   </div>
                   <div className="absolute bottom-0 right-4 flex items-end gap-1.5 opacity-20 h-16">
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-1/2"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-3/4"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-1/4"></div>
                   </div>
               </div>

               <div className="bg-[#C1BDEB] rounded-3xl p-6 relative overflow-hidden shadow-sm">
                   <div className="flex justify-between items-start mb-6 z-10 relative">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[#0B3B3C]">
                         <Users size={14} />
                      </div>
                      <MoreHorizontal size={16} className="text-[#0B3B3C]/50" />
                   </div>
                   <div className="z-10 relative">
                      <p className="text-[#0B3B3C]/70 text-sm font-bold mb-1">System Users</p>
                      <h3 className="text-3xl font-black text-[#0B3B3C] mb-2">{customers.size}</h3>
                      <p className="text-xs font-bold text-[#0B3B3C]/60 flex items-center gap-1">
                         <span className="text-[#0B3B3C]">+{customers.size > 0 ? '1' : '0'}</span> This Month
                      </p>
                   </div>
                   <div className="absolute bottom-0 right-4 flex items-end gap-1.5 opacity-20 h-16">
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-3/4"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-1/2"></div>
                      <div className="w-3 bg-[#0B3B3C] rounded-t-sm h-full"></div>
                   </div>
               </div>
            </div>
         </div>

         {/* Charts Section */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#FAFBFC] dark:bg-slate-800 rounded-3xl p-6 relative overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Graph Report</h3>
                  <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-gray-100 text-gray-500 hover:bg-gray-50">
                     <MoreHorizontal size={14} />
                  </button>
               </div>
               <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] relative">
                  <ResponsiveContainer width="100%" height={250}>
                     <PieChart>
                        <Pie
                           data={pieData}
                           cx="50%"
                           cy="50%"
                           innerRadius={70}
                           outerRadius={100}
                           fill="#8884d8"
                           paddingAngle={5}
                           dataKey="value"
                        >
                           {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                     </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total</p>
                     <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</p>
                  </div>
               </div>
               <div className="flex justify-center gap-6 mt-4">
                  {pieData.map((entry, idx) => (
                      <div key={entry.name} className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                         <span className="text-xs font-medium text-gray-500">{entry.name}</span>
                      </div>
                  ))}
               </div>
            </div>

            <div className="bg-[#FAFBFC] dark:bg-slate-800 rounded-3xl p-6 relative overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Total Sales Overview</h3>
                  <button className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-gray-100 text-gray-500 hover:bg-gray-50">
                     <MoreHorizontal size={14} />
                  </button>
               </div>
               <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height={250}>
                     <BarChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis 
                           dataKey="name" 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{fill: '#9CA3AF', fontSize: 12, fontWeight: 600}} 
                           dy={10}
                        />
                        <YAxis 
                           axisLine={false} 
                           tickLine={false} 
                           tick={{fill: '#9CA3AF', fontSize: 12}}
                           tickFormatter={(value) => `${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value} XAF`}
                        />
                        <Tooltip 
                           cursor={{fill: 'rgba(0,0,0,0.02)'}}
                           contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                           formatter={(value: number) => [formatCurrency(value), 'Sales']}
                           labelStyle={{fontWeight: 'bold', color: '#374151', marginBottom: '4px'}}
                        />
                        <Bar dataKey="total" radius={[8, 8, 8, 8]} barSize={32}>
                           {
                              salesData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={
                                    index === 3 ? '#D3F5A8' : // Highlight today or a specific column
                                    index % 2 === 0 ? '#FFB8BA' : '#C1BDEB'
                                 } />
                              ))
                           }
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* Recent Sales List */}
         <div>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 mt-8">
               <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Recent Sales List</h2>
               <div className="flex items-center gap-3">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                     <input type="text" placeholder="Search..." className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 py-2.5 pl-9 pr-4 rounded-xl text-xs font-medium w-48 outline-none shadow-sm" />
                  </div>
                  <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                     <Settings size={14} /> Filter <ChevronDown size={12} />
                  </button>
                  <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                     <ArrowUpRight size={14} /> Sort By <ChevronDown size={12} />
                  </button>
                  <button className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-gray-600 dark:text-gray-300 shadow-sm">
                     <MoreHorizontal size={14} />
                  </button>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-700">
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Name</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Medicine</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Status</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Quantity</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase">Total Price</th>
                           <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase flex items-center gap-1">Date <ChevronDown size={12}/></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                        {loading ? (
                           <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-sm">Loading orders...</td></tr>
                        ) : orders.length === 0 ? (
                           <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-sm">No recent sales.</td></tr>
                        ) : (
                           orders.slice(0, 5).map((order) => (
                              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors group">
                                 <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-full bg-[#E2EBE9] dark:bg-slate-700 flex items-center justify-center text-[#0B3B3C] dark:text-white font-bold text-xs">
                                          {order.patientName ? order.patientName.charAt(0) : 'U'}
                                       </div>
                                       <span className="font-bold text-gray-800 dark:text-white text-sm">{order.patientName || 'Unknown User'}</span>
                                    </div>
                                 </td>
                                 <td className="py-4 px-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {order.items && order.items[0] ? order.items[0].name : 'Unknown Item'}
                                    {order.items && order.items.length > 1 && ` (+${order.items.length - 1})`}
                                 </td>
                                 <td className="py-4 px-6 text-sm text-gray-500 dark:text-gray-400 capitalize">
                                    {order.status}
                                 </td>
                                 <td className="py-4 px-6">
                                    <div className="flex items-center gap-2 bg-[#FAFBFC] dark:bg-slate-900 px-3 py-1.5 rounded-full w-max border border-gray-100 dark:border-slate-700">
                                       <span className="text-xs font-bold text-[#0B3B3C] dark:text-gray-300">{order.items ? order.items.reduce((acc: any, curr: any) => acc + curr.quantity, 0) : 0}</span>
                                    </div>
                                 </td>
                                 <td className="py-4 px-6 font-bold text-gray-900 dark:text-white text-sm">
                                    {formatCurrency(order.total || 0)}
                                 </td>
                                 <td className="py-4 px-6 text-xs font-medium text-gray-500 dark:text-gray-400">
                                    {order.createdAt ? dayjs(parseDate(order.createdAt)).format('MMM DD, YYYY hh:mm A') : 'N/A'}
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
