import { Search, Filter, Settings, ChevronDown, ArrowUpRight, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

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
    <div className="flex-1 bg-transparent flex flex-col relative h-full overflow-hidden">
      
      {/* Top Navigation Area Header */}
      <div className="px-8 py-6 flex items-center justify-between shrink-0">
          <div className="flex-1 flex items-center">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                   type="text" 
                   placeholder="Search Orders" 
                   className="w-full bg-[#FAFBFA] dark:bg-slate-800 border border-transparent focus:border-gray-200 py-3 pl-12 pr-4 rounded-full text-sm outline-none text-gray-900 dark:text-white transition-all shadow-sm"
                />
             </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-12 custom-scrollbar space-y-8">
         <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
               Recent Orders List
            </h1>
         </div>

         {/* Filtering Tabs & Actions */}
         <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex gap-6 pb-2 text-sm font-bold overflow-x-auto hide-scrollbar">
                {(['All', 'pending', 'preparing', 'ready', 'cancelled', 'rejected'] as const).map(tab => (
                 <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 capitalize whitespace-nowrap transition-colors relative ${activeTab === tab ? 'text-[#0B3B3C] dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
                 >
                    {tab}
                    {activeTab === tab && (
                       <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0B3B3C] rounded-t-full"></span>
                    )}
                 </button>
                ))}
            </div>

            <div className="flex items-center gap-3">
               <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                  <Settings size={14} /> Filter <ChevronDown size={12} />
               </button>
               <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                  <ArrowUpRight size={14} /> Sort By <ChevronDown size={12} />
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
                        <th className="py-4 px-6 text-xs font-bold tracking-wider text-gray-500 uppercase text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                     {loading ? (
                        <tr><td colSpan={7} className="py-8 text-center text-gray-500 text-sm animate-pulse">Loading orders...</td></tr>
                     ) : filteredOrders.length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-gray-500 text-sm">No orders found.</td></tr>
                     ) : (
                        filteredOrders.map((order) => (
                           <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate(`/pharmacist/order/${order.id}`)}>
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
                              <td className="py-4 px-6 text-sm">
                                 <span className={`capitalize font-bold text-xs ${
                                     order.status === 'pending' ? 'text-green-600' :
                                     order.status === 'preparing' ? 'text-blue-600' :
                                     order.status === 'ready' ? 'text-purple-600' :
                                     order.status === 'delivered' ? 'text-indigo-600' :
                                     'text-red-500'
                                 }`}>
                                    {order.status}
                                 </span>
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
                              <td className="py-4 px-6 text-right">
                                 <button
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       navigate(`/pharmacist/messages/${order.id}`, { state: { patientId: order.patientId } });
                                    }}
                                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                                 >
                                    Quick Chat
                                 </button>
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
  );
}
