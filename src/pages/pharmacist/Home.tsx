import { useNavigate } from "react-router-dom";
import { Activity, Search, Filter, MoreHorizontal, CheckCircle, Package, ShieldAlert, AlertTriangle, Bell, Clock, TrendingUp, DollarSign, Pill } from "lucide-react";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import dayjs from "dayjs";
import { ProductCard } from '../../components/ProductCard';
import { useTranslation } from "react-i18next";

export function PharmacistHome() {
    const { t } = useTranslation();
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

  const handleNotifyAdmin = async (product: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "logs"), {
        action: "Low Stock Alert",
        type: "System",
        userId: user.uid,
        details: `Pharmacy ${pharmacy?.name || user.uid} reported low stock for ${product.name} (${product.stock} left).`,
        level: "warning",
        createdAt: serverTimestamp()
      });
      alert(`Admin notified about ${product.name}`);
    } catch (error) {
      console.error(error);
      alert("Failed to notify admin");
    }
  };

  const lowStockProducts = products.filter(p => typeof p.stock === 'number' && p.stock < 10);
  const todayRevenue = orders.reduce((sum, order) => {
    if (order.createdAt && dayjs(parseDate(order.createdAt)).isSame(dayjs(), 'day')) {
      return sum + (order.total || 0);
    }
    return sum;
  }, 0);

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col relative pb-20 h-full overflow-hidden">
      {/* Sleek Header Section */}
      <div className="bg-indigo-600 px-6 pt-12 pb-8 flex flex-col gap-6 z-10 rounded-b-[2.5rem] shadow-md relative overflow-hidden">
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-black/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-800/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
         
         <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shadow-sm shrink-0" />
               ) : theme.logoUrl ? (
                 <img src={theme.logoUrl} alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shadow-sm shrink-0" />
               ) : (
                 <div className="w-12 h-12 bg-white dark:bg-black/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm border border-white/30 shadow-sm shrink-0">
                    <Activity size={24} />
                 </div>
               )}
               <div>
                  <h1 className="font-bold text-xl text-white leading-tight flex items-center gap-2">
                    {theme.dashboardWelcomeText}
                    {pharmacy?.status === 'approved' && (
                      <span className="bg-green-500/20 text-green-100 text-[10px] px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1 font-medium mt-0.5">
                         <CheckCircle size={10} />  {t('verified', 'Verified')} </span>
                    )}
                  </h1>
                  <p className="text-sm text-indigo-100 mt-1">{theme.dashboardSubtitleText}</p>
               </div>
            </div>
            
            <button className="w-12 h-12 flex items-center justify-center bg-white dark:bg-black/10 hover:bg-white dark:bg-black/20 transition-colors rounded-full text-white backdrop-blur-sm relative">
               <Bell size={22} />
               {lowStockProducts.length > 0 && <span className="absolute top-3 right-3.5 w-2.5 h-2.5 bg-red-500 border border-indigo-600 rounded-full"></span>}
            </button>
         </div>

         {/* Search Bar */}
         <div className="relative z-10 mt-2">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
             <input 
                type="text" 
                placeholder={t('search_orders_meds', 'Search orders, meds...')} 
                className="w-full bg-white dark:bg-black py-3.5 pl-12 pr-4 rounded-2xl text-sm outline-none text-gray-900 dark:text-white shadow-sm" 
             />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-8 -mt-4 relative z-20 pb-8">
         {/* Stats Row */}
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-black p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col justify-between hover:shadow-md transition cursor-default">
               <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <Package size={20} className="text-indigo-600" />
               </div>
               <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm font-medium mb-1"> {t('total_orders', 'Total Orders')} </p>
               <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.length}</p>
            </div>
            
            <div className="bg-white dark:bg-black p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col justify-between hover:shadow-md transition cursor-default">
               <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <DollarSign size={20} className="text-emerald-600" />
               </div>
               <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm font-medium mb-1"> {t('today_s_revenue', 'Today\'s Revenue')} </p>
               <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(todayRevenue)}</p>
            </div>
         </div>

         {pharmacy?.status === 'pending_verification' && (
           <div className="bg-amber-50 border whitespace-pre-wrap border-amber-200 p-5 rounded-3xl flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                 <ShieldAlert className="text-amber-600" size={20} />
              </div>
              <div>
                 <h3 className="text-amber-800 font-bold text-base mb-1"> {t('pending_kyc', 'Pending KYC')} </h3>
                 <p className="text-amber-700/80 text-sm leading-relaxed"> {t('your_pharmacy_profile_is_under', 'Your pharmacy profile is under review by admins. Once approved, your products will be visible to patients.')} </p>
              </div>
           </div>
         )}

         {/* Orders */}
         <div>
            <div className="flex items-center justify-between mb-5">
               <h3 className="font-bold text-gray-900 dark:text-white text-xl"> {t('recent_orders', 'Recent Orders')} </h3>
               <button onClick={() => navigate('/pharmacist/orders')} className="text-indigo-600 font-bold text-sm bg-indigo-50/50 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition"> {t('see_all', 'See all')} </button>
            </div>
            
            <div className="space-y-4">
               {loading ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-4 text-center animate-pulse"> {t('loading_orders', 'Loading orders...')} </p> : 
                orders.length === 0 ? <div className="text-center bg-white dark:bg-black p-8 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800"><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('no_recent_orders', 'No recent orders.')} </p></div> :
                orders.slice(0, 2).map(order => (
                  <div 
                    key={order.id} 
                    onClick={() => navigate(`/pharmacist/order/${order.id}`)}
                    className="bg-white dark:bg-black p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-indigo-100 transition group"
                  >
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-zinc-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-colors">
                           <CheckCircle size={20} />
                        </div>
                        <div>
                           <p className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
                               {t('order', 'Order #')} {order.id.slice(0, 5)}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                 order.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                                 order.status === 'processing' ? 'bg-indigo-50 text-indigo-600' :
                                 order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                                 'bg-amber-50 text-amber-600'
                              }`}>
                                 {order.status}
                              </span>
                           </p>
                           <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mt-1">
                              <Clock size={14} /> 
                              {parseDate(order.createdAt) ? dayjs(parseDate(order.createdAt)).format('MMM D, h:mm A') : 'Just now'}
                           </p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-gray-400 dark:text-gray-500 text-xs mb-1 font-medium"> {t('total', 'Total')} </p>
                        <p className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-indigo-600 transition-colors">
                           {formatCurrency(order.total)}
                        </p>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Low Stock Alerts */}
         {lowStockProducts.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                    <AlertTriangle size={20} className="text-orange-500"/>  {t('low_stock_alerts', 'Low Stock Alerts')} </h3>
               </div>
               <div className="space-y-4">
               {lowStockProducts.slice(0, 2).map(product => (
                     <div key={product.id} className="bg-orange-50 border border-orange-100 p-5 rounded-3xl shadow-sm flex items-center justify-between group hover:bg-orange-100/50 transition">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-xl bg-white dark:bg-black flex items-center justify-center shadow-sm">
                              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-8 h-8 object-cover rounded" /> : <AlertTriangle className="text-orange-400" size={20}/>}
                           </div>
                           <div>
                              <p className="font-bold text-orange-900 text-base">{product.name}</p>
                              <p className="text-sm text-orange-700/80 font-medium flex items-center gap-1 mt-0.5">
                                <TrendingUp size={14} />  {t('only', 'Only')} {product.stock}  {t('left_in_stock', 'left in stock')} </p>
                           </div>
                        </div>
                        <button 
                           onClick={() => handleNotifyAdmin(product)}
                           className="px-4 py-2 bg-white dark:bg-black hover:bg-orange-100 text-orange-700 text-sm font-bold rounded-xl transition shadow-sm border border-orange-200 opacity-90 group-hover:opacity-100"
                        >
                            {t('notify_admin', 'Notify Admin')} </button>
                     </div>
                  ))}
               </div>
            </div>
         )}

         {/* Inventory Snapshot */}
         <div>
            <div className="flex items-center justify-between mb-4 mt-6">
               <h3 className="font-bold text-gray-900 dark:text-white text-xl"> {t('inventory_snapshot', 'Inventory Snapshot')} </h3>
               <button onClick={() => navigate('/pharmacist/inventory')} className="text-indigo-600 font-bold text-sm bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"> {t('see_all', 'See all')} </button>
            </div>
            <div className="grid grid-cols-2 gap-4 pb-6">
               {loading ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('loading', 'Loading...')} </p> : 
                products.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 text-center w-full col-span-full"> {t('go_to_inventory_to_add_product', 'Go to Inventory to add products.')} </p> :
                products.slice(0, 6).map(item => (
                   <div key={item.id}>
                      <ProductCard product={item} basePath="/pharmacist/inventory" showSaleBadge={true} />
                   </div>
                ))}
            </div>
         </div>
      </div>
    </div>
  );
}
