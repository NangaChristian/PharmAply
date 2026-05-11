import { DollarSign, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export function AdminFinances() {
  const [finances, setFinances] = useState({
    totalRevenue: 0,
    platformCommission: 0,
    pendingPayoutsCount: 0
  });

  const [revenueData, setRevenueData] = useState<{name: string, revenue: number}[]>([]);
  
  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (ordersSnap) => {
      const orders = ordersSnap.docs.map(d => d.data());
      
      const totalRev = orders.reduce((acc, order) => acc + (Number(order.total) || 0), 0);
      const commission = totalRev * 0.05; // 5% commission
      
      const deliveredOrders = orders.filter(o => o.status === "delivered");
      
      setFinances({
        totalRevenue: totalRev,
        platformCommission: commission,
        pendingPayoutsCount: deliveredOrders.length // Mock logic
      });

      // Generate some mockup historical data for the chart or calculate if dates are available
      const now = new Date();
      const mockData = Array.from({ length: 7 }).map((_, i) => {
         const date = new Date(now);
         date.setDate(now.getDate() - (6 - i));
         return {
            name: date.toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: Math.floor(Math.random() * 500) + 100 // Mock data per day
         }
      });
      // Override the last day with actual today's calculated revenue as part of mock
      mockData[6].revenue = totalRev > 0 ? totalRev : mockData[6].revenue;
      
      setRevenueData(mockData);
    }, (err) => {
      console.error(err);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 text-2xl mb-1">Financial Center</h1>
         <p className="text-gray-500 text-sm">Revenue, payouts, and commissions</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
         {/* Balance Card */}
         <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8 blur-2xl"></div>
            <p className="text-slate-300 text-xs font-semibold mb-1 uppercase tracking-wide">Platform Escrow Balance</p>
            <h2 className="text-3xl font-bold font-mono">${(finances.totalRevenue - finances.platformCommission).toFixed(2)}</h2>
            <div className="flex justify-between items-end mt-4">
               <div>
                  <p className="text-slate-400 text-xs">Total Platform Commission</p>
                  <p className="text-green-400 font-bold text-sm">${finances.platformCommission.toFixed(2)}</p>
               </div>
            </div>
         </div>

         {/* Revenue Chart Section */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-lg font-bold text-slate-800">Revenue Overview</h2>
               <select className="bg-slate-50 border-0 rounded-xl text-sm font-medium text-slate-600 px-4 py-2 outline-none focus:ring-2 focus:ring-teal-500">
                 <option>Last 7 days</option>
                 <option>Last 30 days</option>
                 <option>This Year</option>
               </select>
            </div>
            
            <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#0d9488" stopOpacity={0.8}/>
                       <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <RechartsTooltip 
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                   />
                   <Area type="monotone" dataKey="revenue" stroke="#0d9488" fillOpacity={1} fill="url(#colorRevenue)" />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Commission Config Preview */}
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
               <p className="font-bold text-gray-900 text-sm">Platform Fee Rate</p>
               <p className="text-xs text-gray-500 mt-0.5">Applied per pharmacy order</p>
            </div>
            <div className="text-right">
               <p className="font-bold text-indigo-600 text-xl">5.0%</p>
               <button className="text-[10px] font-bold text-slate-500 underline uppercase mt-1">Configure</button>
            </div>
         </div>
         
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
               <p className="font-bold text-gray-900 text-sm">Delivery Fixed Fee</p>
               <p className="text-xs text-gray-500 mt-0.5">Base fee for drivers</p>
            </div>
            <div className="text-right">
               <p className="font-bold text-indigo-600 text-xl">$3.00</p>
               <button className="text-[10px] font-bold text-slate-500 underline uppercase mt-1">Configure</button>
            </div>
         </div>
         </div>

         {/* Recent Transactions */}
         <div>
            <h3 className="font-bold text-gray-900 text-sm mb-3 px-1">Pending Payouts</h3>
            {finances.pendingPayoutsCount > 0 ? (
              <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                 <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                          <ArrowUpRight size={18} />
                       </div>
                       <div>
                          <p className="font-bold text-gray-900 text-sm">{finances.pendingPayoutsCount} Orders Pending</p>
                          <p className="text-[10px] text-gray-500 font-medium">To various pharmacies/drivers</p>
                       </div>
                    </div>
                 </div>
              </div>
            ) : (
                <p className="text-sm text-gray-500 px-1">No pending payouts.</p>
            )}
         </div>

      </div>
    </div>
  );
}
