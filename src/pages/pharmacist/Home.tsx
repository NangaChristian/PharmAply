import { useNavigate } from "react-router-dom";
import { Activity, Search, Filter, MoreHorizontal, CheckCircle, Package, ShieldAlert } from "lucide-react";
import { BottomNav } from "../../components/layout/BottomNav";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { formatCurrency } from '../../lib/utils';

export function PharmacistHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
           setOrders(oSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  return (
    <div className="flex-1 bg-slate-50 flex flex-col relative pb-16 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-4 flex flex-col gap-6 z-10 shadow-sm rounded-b-[2rem]">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               {theme.logoUrl ? (
                 <img src={theme.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover bg-indigo-100" />
               ) : (
                 <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                    <Activity size={24} />
                 </div>
               )}
               <div>
                  <h1 className="font-bold text-lg text-gray-900 leading-tight">{theme.dashboardWelcomeText}</h1>
                  <p className="text-xs text-gray-500">{theme.dashboardSubtitleText}</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full">
                 <Search size={18} className="text-gray-600" />
               </button>
               <button className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full">
                 <div className="relative">
                    <Activity size={18} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                 </div>
               </button>
            </div>
         </div>

         {pharmacy?.status === 'pending_verification' && (
           <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
              <ShieldAlert className="text-orange-500 shrink-0 mt-0.5" size={20} />
              <div>
                 <h3 className="text-orange-800 font-bold text-sm">Account Pending Verification</h3>
                 <p className="text-orange-700 text-xs mt-1">Your pharmacy profile is under review by admins. Once approved, your products will be visible to patients.</p>
              </div>
           </div>
         )}

         {/* Accept New Order Toggle Area? Actually let's look at the UI. */}
         <div className="relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input type="text" placeholder="Search orders or medications" className="w-full bg-gray-100 py-3 pl-12 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
         </div>

         <div className="flex gap-4">
            <div className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl shadow-md">
               <p className="text-indigo-100 text-xs font-medium mb-1">Total Orders</p>
               <p className="text-2xl font-bold">{orders.length} <span className="text-xs font-normal opacity-80">orders</span></p>
            </div>
            <div className="flex-1 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
               <p className="text-gray-500 text-xs font-medium mb-1">Delivered</p>
               <p className="text-2xl font-bold text-gray-900">{orders.filter(o => o.status === 'delivered').length} <span className="text-xs font-normal text-gray-400">orders</span></p>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
         {/* Orders */}
         <div>
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-gray-900 text-lg">Recent Orders</h3>
               <button onClick={() => navigate('/pharmacist/orders')} className="text-gray-400 font-medium text-sm flex items-center gap-1">All Orders <MoreHorizontal size={16}/></button>
            </div>
            <div className="space-y-3">
               {loading ? <p className="text-sm text-gray-500">Loading...</p> : 
                orders.length === 0 ? <p className="text-sm text-gray-500">No recent orders.</p> :
                orders.slice(0,3).map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => navigate(`/pharmacist/order/${order.id}`)}
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 cursor-pointer hover:shadow-md transition"
                  >
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="font-bold text-gray-900 text-sm">{order.id.slice(0, 8)}</p>
                           <p className="text-xs text-gray-500">Total: {formatCurrency(order.total)}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-700 uppercase`}>
                           {order.status}
                        </span>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Inventory Snapshot */}
         <div>
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-gray-900 text-lg">Inventory Snapshot</h3>
               <button onClick={() => navigate('/pharmacist/inventory')} className="text-indigo-600 font-medium text-sm">See all</button>
            </div>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4">
               {loading ? <p className="text-sm text-gray-500">Loading...</p> : 
                products.length === 0 ? <p className="text-sm text-gray-500 text-center w-full">Go to Inventory to add products.</p> :
                products.map(item => {
                  const status = item.stock > 10 ? 'In Stock' : item.stock > 0 ? 'Low Stock' : 'Out of Stock';
                  return (
                    <div key={item.id} className="min-w-[140px] bg-white border border-gray-100 p-3 rounded-2xl shadow-sm text-center">
                       <div className="w-16 h-16 mx-auto bg-gray-50 rounded-xl mb-3 flex items-center justify-center">
                          <Package size={24} className="text-gray-400"/>
                       </div>
                       <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                       <p className={`text-xs font-semibold mt-1 ${
                          status === 'In Stock' ? 'text-green-500' :
                          status === 'Low Stock' ? 'text-orange-500' : 'text-red-500'
                       }`}>
                          {status}
                       </p>
                    </div>
                  )
               })}
            </div>
         </div>
      </div>
    </div>
  );
}
