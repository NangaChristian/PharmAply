import { Activity, Clock, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import { useTranslation } from "react-i18next";

export function PharmacistOrders() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'pending' | 'preparing' | 'ready'>('All');

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
        unsubscribeOrders = onSnapshot(ordersQuery, async (oSnap) => {
          const ordersData = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          // Fetch patient names
          const patientsCache: Record<string, string> = {};
          for (let order of ordersData) {
              if (order.patientId && !patientsCache[order.patientId]) {
                 try {
                     const pd = await getDoc(doc(db, 'users', order.patientId));
                     if (pd.exists()) {
                         patientsCache[order.patientId] = pd.data().name || 'Unknown Patient';
                     }
                 } catch(e) {}
              }
              order.patientName = patientsCache[order.patientId] || 'Unknown Patient';
          }
          
          setOrders(ordersData);
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

  const filteredOrders = activeTab === 'All' ? orders : orders.filter(o => o.status === activeTab);

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-2 flex flex-col gap-6 bg-white dark:bg-black shadow-sm z-10 rounded-b-3xl">
         <div className="flex items-center justify-between">
            <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight"> {t('orders', 'Orders')} </h1>
         </div>
         
         <div className="flex gap-3">
           <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input type="text" placeholder={t('search_orders', 'Search orders...')} className="w-full bg-gray-50 dark:bg-black border border-gray-100 dark:border-zinc-800 py-3.5 pl-12 pr-4 rounded-2xl text-sm outline-none focus:bg-white dark:bg-black focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50 transition-all" />
           </div>
           <button className="w-14 h-14 flex items-center justify-center bg-gray-50 dark:bg-black border border-gray-100 dark:border-zinc-800 hover:bg-gray-100 dark:bg-zinc-900 rounded-2xl text-gray-600 transition-colors">
              <Filter size={20} />
           </button>
         </div>
         
         <div className="flex gap-6 pb-2 text-sm font-bold overflow-x-auto hide-scrollbar snap-x">
            {(['All', 'pending', 'preparing', 'ready', 'cancelled', 'rejected'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 capitalize whitespace-nowrap snap-start transition-colors relative ${activeTab === tab ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
              >
                {tab}
                {activeTab === tab && (
                   <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></span>
                )}
              </button>
            ))}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 animate-pulse text-center py-10 tracking-tight"> {t('loading_orders', 'Loading orders...')} </p> : 
           filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 mb-4">
                    <Activity size={24} />
                 </div>
                 <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1"> {t('no_orders_found', 'No orders found')} </h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('there_are_no_orders_in_this_ca', 'There are no orders in this category yet.')} </p>
              </div>
           ) :
           filteredOrders.map(order => (
             <div 
               key={order.id} 
               onClick={() => navigate(`/pharmacist/order/${order.id}`)}
               className="bg-white dark:bg-black p-5 rounded-[24px] border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-indigo-50 transition-all active:scale-[0.98]"
             >
                <div className="flex justify-between items-start">
                   <p className="font-bold text-indigo-700 dark:text-indigo-400 text-lg"> {t('order', 'Order #')} {order.id.slice(0, 3)}</p>
                   <span className={`text-[12px] font-bold px-4 py-1.5 rounded-full ${
                      order.status === 'pending' ? 'bg-[#c5ead5] text-[#2c8d50]' :
                      order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'ready' ? 'bg-green-100 text-green-700' :
                      (order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-100 text-red-700' :
                      'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300'
                   }`}>
                      {order.status === 'pending' ? 'New' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                   </span>
                </div>
                
                <div>
                   <p className="font-bold text-gray-800 dark:text-white text-[15px] mb-1 leading-snug">{order.patientName}</p>
                   <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{order.items?.length || 0} {t('items', 'Items')}</p>
                </div>

                <div className="border-t border-gray-200 dark:border-zinc-800 pt-3 flex items-center text-sm font-bold text-gray-800 dark:text-white mt-1">
                   <span>{formatCurrency(order.total)}</span>
                   <span className="mx-2 text-gray-400 dark:text-gray-600">•</span>
                   <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">
                     {parseDate(order.createdAt) ? parseDate(order.createdAt)!.toLocaleDateString() : 'recently'}
                   </span>
                </div>

                {(order.status === 'cancelled' || order.status === 'rejected') && order.cancellationReason && (
                   <div className="text-xs text-red-600 bg-red-50/50 p-3 rounded-xl border border-red-100/50 mt-1">
                      <span className="font-bold"> {t('reason', 'Reason:')} </span> {order.cancellationReason}
                   </div>
                )}
             </div>
          ))}
          <div className="h-20"></div>
      </div>
    </div>
  );
}
