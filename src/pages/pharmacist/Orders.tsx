import { Activity, Clock, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';

export function PharmacistOrders() {
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

  const filteredOrders = activeTab === 'All' ? orders : orders.filter(o => o.status === activeTab);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex flex-col gap-4 bg-white shadow-sm z-10 border-b border-gray-100">
         <h1 className="font-bold text-gray-900 text-xl">Orders</h1>
         
         <div className="flex gap-2">
           <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Search orders..." className="w-full bg-gray-100 py-3 pl-12 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
           </div>
           <button className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-xl text-gray-600">
              <Filter size={18} />
         </button>
         </div>
         
         <div className="flex gap-4 pb-2 text-sm font-medium overflow-x-auto hide-scrollbar">
            {(['All', 'pending', 'preparing', 'ready', 'cancelled', 'rejected'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 capitalize whitespace-nowrap ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
              >
                {tab}
              </button>
            ))}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? <p className="text-sm text-gray-500">Loading...</p> : 
           filteredOrders.length === 0 ? <p className="text-sm text-gray-500">No orders found.</p> :
           filteredOrders.map(order => (
             <div 
               key={order.id} 
               onClick={() => navigate(`/pharmacist/order/${order.id}`)}
               className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 cursor-pointer hover:shadow-md transition"
             >
                <div className="flex justify-between items-start">
                   <div>
                      <p className="font-bold text-gray-900 text-sm">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(order.total)}</p>
                   </div>
                   <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${
                      order.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                      order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                      (order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                   }`}>
                      {order.status}
                   </span>
                </div>
                {(order.status === 'cancelled' || order.status === 'rejected') && order.cancellationReason && (
                   <div className="text-xs text-red-600 bg-red-50/50 p-2 rounded-lg">
                      <span className="font-bold">Reason:</span> {order.cancellationReason}
                   </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                   <div className="flex items-center gap-1">
                      <Clock size={12} className="text-orange-500" />
                      <span className="text-orange-600 font-medium">recently</span>
                   </div>
                </div>
             </div>
          ))}
          <div className="h-8"></div>
      </div>
    </div>
  );
}
