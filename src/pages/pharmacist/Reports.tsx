import { BarChart3, TrendingUp, DollarSign, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

export function PharmacistReports() {
    const { t } = useTranslation();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeOrders: () => void;
    
    const fetchContext = async () => {
      if (!user) return;
      try {
        const pQuery = query(collection(db, 'pharmacies'), where("ownerId", "==", user.uid));
        const pSnap = await getDocs(pQuery);
        let pharmacyId = pSnap.docs[0]?.id;
        if (!pharmacyId) {
          setLoading(false);
          return;
        }

        const ordersQuery = query(collection(db, 'orders'), where('pharmacyId', '==', pharmacyId));
        unsubscribeOrders = onSnapshot(ordersQuery, (oSnap) => {
          setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    };
  }, [user]);

  const completedOrders = orders.filter(o => o.status === 'ready' || o.status === 'delivered');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const availableWithdrawal = totalRevenue * 0.9; // 10% platform fee assumed for display

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-black shadow-sm z-10 rounded-b-3xl">
         <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight"> {t('reports_analytics', 'Reports & Analytics')} </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Summary Cards */}
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-black p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
               <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                  <DollarSign size={24} />
               </div>
               <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium"> {t('total_revenue', 'Total Revenue')} </p>
               <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalRevenue)}</h3>
               {completedOrders.length > 0 && <p className="text-xs text-green-600 bg-green-50 inline-block px-2 py-1 rounded-full mt-3 font-bold"> {t('updated_just_now', 'Updated Just Now')} </p>}
            </div>
            
            <div className="bg-white dark:bg-black p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
               <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                  <Package size={24} />
               </div>
               <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium"> {t('orders_completed', 'Orders Completed')} </p>
               <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{completedOrders.length}</h3>
               {completedOrders.length > 0 && <p className="text-xs text-indigo-600 bg-indigo-50 inline-block px-2 py-1 rounded-full mt-3 font-bold"> {t('updated_just_now', 'Updated Just Now')} </p>}
            </div>
         </div>

         {/* Chart Placeholder */}
         <div className="bg-white dark:bg-black p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-8">
               <h3 className="font-bold text-gray-900 dark:text-white text-base"> {t('sales_overview', 'Sales Overview')} </h3>
               <select className="bg-gray-50 dark:bg-black text-xs text-gray-600 font-bold py-2 px-3 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-indigo-100">
                  <option> {t('this_week', 'This Week')} </option>
                  <option> {t('this_month', 'This Month')} </option>
               </select>
            </div>
            <div className="h-48 flex items-end gap-3 justify-between px-2">
               {/* Synthetic bars */}
               <div className="w-1/6 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-t-xl h-16 relative group cursor-pointer"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatCurrency(120)}</div></div>
               <div className="w-1/6 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-t-xl h-24 relative group cursor-pointer"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatCurrency(240)}</div></div>
               <div className="w-1/6 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-t-xl h-20 relative group cursor-pointer"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatCurrency(160)}</div></div>
               <div className="w-1/6 bg-indigo-600 rounded-t-xl h-40 relative shadow-lg shadow-indigo-200 cursor-pointer"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-indigo-600 whitespace-nowrap">{formatCurrency(320)}</div></div>
               <div className="w-1/6 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-t-xl h-28 relative group cursor-pointer"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatCurrency(200)}</div></div>
               <div className="w-1/6 bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-t-xl h-12 relative group cursor-pointer"><div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{formatCurrency(100)}</div></div>
            </div>
            <div className="flex justify-between text-xs font-bold text-gray-400 dark:text-gray-500 mt-4 px-2 uppercase tracking-wider">
               <span> {t('mon', 'Mon')} </span>
               <span> {t('tue', 'Tue')} </span>
               <span> {t('wed', 'Wed')} </span>
               <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md"> {t('thu', 'Thu')} </span>
               <span> {t('fri', 'Fri')} </span>
               <span> {t('sat', 'Sat')} </span>
            </div>
         </div>

         {/* Withdrawals */}
         <div className="bg-white dark:bg-black p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
               <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('available_for_withdrawal', 'Available for Withdrawal')} </h3>
                  <p className="font-bold text-green-600 text-3xl tracking-tight">{formatCurrency(availableWithdrawal)}</p>
               </div>
               <button className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold px-6 py-3 rounded-2xl transition-colors shadow-lg shadow-gray-200 active:scale-95"> {t('withdraw_funds', 'Withdraw Funds')} </button>
            </div>
         </div>
         
         <div className="h-20"></div>
      </div>
    </div>
  );
}
