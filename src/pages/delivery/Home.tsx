import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Bell, MapPin, Clock, DollarSign, CheckCircle, Navigation } from "lucide-react";
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';

export function DeliveryHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;
    try {
      const q = query(collection(db, 'orders'), where('status', '==', 'ready'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error(err);
        setLoading(false);
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <div className="flex-1 bg-slate-50 flex flex-col relative pb-16 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 border-b border-gray-100 z-10 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center text-gray-500">
               <User />
            </div>
            <div>
               <h1 className="font-bold text-gray-900 text-sm">Hi 👋 {user?.displayName || 'Driver'}</h1>
               <p className="text-xs text-gray-500">Delivery Driver</p>
            </div>
         </div>
         <button className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center relative">
            <Bell size={18} className="text-gray-600" />
         </button>
      </div>

      {/* Online Toggle & Status */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
         <span className="font-bold text-gray-900">Online/Offline</span>
         <button 
           onClick={() => setIsOnline(!isOnline)}
           className={`w-12 h-6 rounded-full relative transition-colors ${isOnline ? 'bg-indigo-600' : 'bg-gray-300'}`}
         >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${isOnline ? 'left-6' : 'left-0.5'}`}></div>
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Available Orders */}
         <div>
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-gray-900 text-lg">Available Orders</h3>
               <span className="text-gray-400 font-medium text-sm">{orders.length} orders</span>
            </div>

            <div className="space-y-4">
               {loading ? <p className="text-sm text-gray-500">Loading...</p> : 
                orders.length === 0 ? <p className="text-sm text-gray-500">No new orders available right now.</p> :
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                     <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                        <span className="font-bold text-indigo-600">Order #{order.id.slice(0,8)}</span>
                        <span className="font-bold text-gray-900">Total: {formatCurrency(order.total)}</span>
                     </div>
                     <div className="p-4 relative">
                        {/* Route Line visual */}
                        <div className="absolute left-[27px] top-[32px] bottom-[32px] w-[2px] bg-gray-200 border-l border-dashed border-gray-300"></div>
                        
                        <div className="flex gap-4 mb-4 relative z-10">
                           <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                              <MapPin size={12} className="fill-current" />
                           </div>
                           <div>
                              <p className="font-bold text-gray-900 text-sm">Pharmacy ID: {order.pharmacyId}</p>
                              <p className="text-xs text-gray-500">Pick up ready</p>
                           </div>
                        </div>
                        
                        <div className="flex gap-4 relative z-10">
                           <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                              <Navigation size={12} className="fill-current" />
                           </div>
                           <div>
                              <p className="font-bold text-gray-900 text-sm">Customer ID: {order.patientId}</p>
                           </div>
                        </div>
                     </div>
                     
                     <div className="px-4 py-3 bg-gray-50 flex items-center gap-4 text-xs font-medium text-gray-600">
                        <div className="flex items-center gap-1.5"><Clock size={14} className="text-indigo-600"/> ASAP</div>
                        <div className="flex items-center gap-1.5"><MapPin size={14} className="text-indigo-600"/> Local</div>
                     </div>
                     
                     <div className="p-4">
                        <button 
                          onClick={() => navigate(`/delivery/order/${order.id}`)}
                          className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold shadow-md transition-colors text-sm"
                        >
                           View order
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
