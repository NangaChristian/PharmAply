import { useState, useEffect } from "react";
import { ArrowLeft, Search, Mic, TrendingUp, ShieldAlert, BarChart2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../lib/utils";
import { collection, query, where, getDocs, onSnapshot, orderBy, db } from "../../lib/firebase";
import { useAuth } from "../../components/AuthProvider";
import dayjs from "dayjs";

export function PharmacistReports() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeView, setActiveView] = useState('main'); // 'main', 'sales', 'stock', 'usage'
  const [insightTab, setInsightTab] = useState('This Week');
  const [loading, setLoading] = useState(true);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribeOrders: () => void;
    let unsubscribeProducts: () => void;
    
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
        unsubscribeOrders = onSnapshot(ordersQuery, (oSnap: any) => {
          setOrders(oSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        });

        const productsQuery = query(collection(db, 'products'), where('pharmacyId', '==', pharmacyId));
        unsubscribeProducts = onSnapshot(productsQuery, (pSnap: any) => {
          setProducts(pSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
        
      } catch (error) {
        console.error("Error fetching reports data:", error);
        setLoading(false);
      }
    };
    fetchContext();
    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeProducts) unsubscribeProducts();
    };
  }, [user]);

  if (activeView === 'sales') {
    // Process orders for sales metrics
    let filteredOrders = orders;
    const now = dayjs();
    
    if (insightTab === 'Today') {
      filteredOrders = orders.filter(o => o.createdAt && dayjs(o.createdAt).isSame(now, 'day'));
    } else if (insightTab === 'This Week') {
      filteredOrders = orders.filter(o => o.createdAt && dayjs(o.createdAt).isSame(now, 'week'));
    } else if (insightTab === 'This Month') {
      filteredOrders = orders.filter(o => o.createdAt && dayjs(o.createdAt).isSame(now, 'month'));
    }

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const numberOfOrders = filteredOrders.length;

    // We can also calculate top selling products by revenue
    const productRevenue: Record<string, { revenue: number, name: string, quantity: number }> = {};
    filteredOrders.forEach(o => {
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
           const id = item.productId || item.id || item.name;
           if (!productRevenue[id]) productRevenue[id] = { revenue: 0, name: item.name, quantity: 0 };
           const price = item.price || 0;
           const qty = item.quantity || 1;
           productRevenue[id].revenue += price * qty;
           productRevenue[id].quantity += qty;
        });
      }
    });

    const topSellingProducts = Object.values(productRevenue)
       .sort((a, b) => b.revenue - a.revenue)
       .slice(0, 5);

    // Chart data based on days or previous periods could be real, but for this overview
    // we might just use a placeholder chart array like `defaultData` but styled for sales.
    const defaultData = [120, 300, 150, 450, 200, 350, 180];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="flex-1 bg-[#f4f5f9] dark:bg-black/95 flex flex-col h-full overflow-hidden relative">
        <div className="px-5 pt-12 pb-4 flex items-center gap-4 z-10 bg-[#f4f5f9] dark:bg-black">
          <button onClick={() => setActiveView('main')} className="flex items-center justify-center transition-colors">
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="font-bold text-gray-800 dark:text-white text-[19px] tracking-tight">Sales Overview</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto pb-40 px-5">
           <div className="flex bg-[#eef0f5] dark:bg-zinc-900 rounded-full p-1 mb-6 mt-2 shadow-sm">
             {['Today', 'This Week', 'This Month'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setInsightTab(tab)}
                 className={`flex-1 text-[13px] font-bold py-2.5 rounded-full transition-all ${insightTab === tab ? 'bg-[#3b4c9b] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
               >
                 {tab}
               </button>
             ))}
           </div>

           <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-[#445bba] to-[#8fa5db] rounded-[24px] p-5 shadow-sm text-white">
                 <p className="text-white/80 text-[12px] font-bold mb-1">Total Revenue</p>
                 <h3 className="font-bold text-[22px]">{formatCurrency(totalRevenue)}</h3>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-5 shadow-sm">
                 <p className="text-gray-500 dark:text-gray-400 text-[12px] font-bold mb-1">Total Orders</p>
                 <h3 className="font-bold text-gray-900 dark:text-white text-[22px]">{numberOfOrders}</h3>
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-sm mb-6">
             <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-gray-900 dark:text-white text-[16px]">Sales Trend</h3>
             </div>
             <div className="flex items-end gap-2 h-32 mt-4 relative">
                {defaultData.map((val, i) => (
                   <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2 relative group">
                      <div className="w-full bg-[#f0f2f8] dark:bg-zinc-800 rounded-t-md relative hover:bg-[#3b4c9b]/20 dark:hover:bg-[#3b4c9b]/40 transition-colors" style={{ height: `${(val / 500) * 100}%`}}>
                         <div className="absolute bottom-0 w-full bg-[#3b4c9b] rounded-t-md transition-all duration-500" style={{ height: `${(val / 500) * 100}%` }}></div>
                         <div className="absolute -top-10 left-1/2 min-w-max -translate-x-1/2 bg-black text-white text-[10px] font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {formatCurrency(val)}
                         </div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 tracking-wider hidden sm:block">{days[i]}</span>
                   </div>
                ))}
             </div>
             <div className="flex justify-between mt-2 sm:hidden px-1">
                {days.map((day, i) => (
                  <span key={day} className="text-[10px] font-bold text-gray-400">{day.charAt(0)}</span>
                ))}
             </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-sm">
             <h3 className="font-bold text-gray-900 dark:text-white text-[17px] mb-5">Top Selling Items</h3>
             <div className="space-y-4">
               {topSellingProducts.length > 0 ? topSellingProducts.map((item, index) => {
                  return (
                    <div key={index} className={`flex items-center justify-between ${index !== topSellingProducts.length - 1 ? 'pb-4 border-b border-gray-100 dark:border-zinc-800' : 'pb-1'}`}>
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-[14.5px] max-w-[180px] truncate mb-1">{item.name}</h4>
                        <p className="text-[12px] text-gray-400 font-medium">{item.quantity} units sold</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#3b4c9b] text-[14.5px]">{formatCurrency(item.revenue)}</span>
                      </div>
                    </div>
                  );
               }) : (
                 <p className="text-sm text-gray-500 text-center py-4">No sales data available for this period.</p>
               )}
             </div>
           </div>
        </div>
      </div>
    );
  }

  if (activeView === 'usage') {
    // Process order items to get top medicines
    const medicineCounts: Record<string, { count: number, name: string }> = {};
    let totalItems = 0;
    
    // Filter orders based on insightTab (Today, This Week, This Month)
    let filteredOrders = orders;
    const now = dayjs();
    
    if (insightTab === 'Today') {
      filteredOrders = orders.filter(o => o.createdAt && dayjs(o.createdAt).isSame(now, 'day'));
    } else if (insightTab === 'This Week') {
      filteredOrders = orders.filter(o => o.createdAt && dayjs(o.createdAt).isSame(now, 'week'));
    } else if (insightTab === 'This Month') {
      filteredOrders = orders.filter(o => o.createdAt && dayjs(o.createdAt).isSame(now, 'month'));
    }

    filteredOrders.forEach(o => {
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
           const id = item.productId || item.id || item.name;
           if (!medicineCounts[id]) medicineCounts[id] = { count: 0, name: item.name };
           medicineCounts[id].count += (item.quantity || 1);
           totalItems += (item.quantity || 1);
        });
      }
    });

    const topMedicines = Object.values(medicineCounts)
       .sort((a, b) => b.count - a.count)
       .slice(0, 3);
       
    // Synthetic data for the chart, ideally this would aggregate by day of week
    const defaultData = [52, 35, 29, 28];

    return (
      <div className="flex-1 bg-[#f4f5f9] dark:bg-black/95 flex flex-col h-full overflow-hidden relative">
        <div className="px-5 pt-12 pb-4 flex items-center gap-4 z-10 bg-[#f4f5f9] dark:bg-black">
          <button onClick={() => setActiveView('main')} className="flex items-center justify-center transition-colors">
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="font-bold text-gray-800 dark:text-white text-[19px] tracking-tight">Medicine Usage Insights</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto pb-40 px-5">
           <div className="flex bg-[#eef0f5] dark:bg-zinc-900 rounded-full p-1 mb-6 mt-2 shadow-sm">
             {['Today', 'This Week', 'This Month'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setInsightTab(tab)}
                 className={`flex-1 text-[13px] font-bold py-2.5 rounded-full transition-all ${insightTab === tab ? 'bg-[#3b4c9b] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
               >
                 {tab}
               </button>
             ))}
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-sm mb-6 pb-2">
             <h3 className="font-bold text-[#3b4c9b] dark:text-indigo-400 text-[15px] mb-6">Top Date of future</h3>
             <div className="relative h-44 mb-8">
               <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                 <div className="border-b border-dashed border-indigo-100 dark:border-indigo-900/30 w-full h-[1px]"></div>
                 <div className="border-b border-dashed border-indigo-100 dark:border-indigo-900/30 w-full h-[1px]"></div>
                 <div className="border-b border-dashed border-indigo-100 dark:border-indigo-900/30 w-full h-[1px]"></div>
                 <div className="border-b border-dashed border-indigo-100 dark:border-indigo-900/30 w-full h-[1px]"></div>
               </div>
               <div className="absolute inset-0 flex justify-between items-end px-3 z-10 h-full">
                 {defaultData.map((val, i) => (
                    <div key={i} className="flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-2">{val}</span>
                      <div className="w-4 bg-[#3b4c9b] rounded-t-md" style={{ height: `${(val / 60) * 100}%`}}></div>
                    </div>
                 ))}
               </div>
               <div className="absolute -bottom-7 w-full flex justify-between px-2">
                 <span className="text-[10px] font-bold text-gray-400 tracking-wider">MON</span>
                 <span className="text-[10px] font-bold text-gray-400 tracking-wider">TUE</span>
                 <span className="text-[10px] font-bold text-gray-400 tracking-wider">WED</span>
                 <span className="text-[10px] font-bold text-gray-400 tracking-wider">SUN</span>
               </div>
             </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-sm">
             <h3 className="font-bold text-gray-900 dark:text-white text-[17px] mb-5">Top Medicines</h3>
             <div className="space-y-4">
               {topMedicines.length > 0 ? topMedicines.map((item, index) => {
                  const percentage = totalItems > 0 ? Math.round((item.count / totalItems) * 100) : 0;
                  return (
                    <div key={index} className={`flex items-center justify-between ${index !== topMedicines.length - 1 ? 'pb-4 border-b border-gray-100 dark:border-zinc-800' : 'pb-1'}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600 dark:bg-gray-400 mb-2.5"></div>
                        <div>
                          <h4 className="font-bold text-gray-800 dark:text-gray-200 text-[14px] max-w-[150px] truncate">{item.name}</h4>
                          <p className="text-[11px] text-gray-400 font-medium">{percentage}% Share</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="font-bold text-[#3b4c9b] text-[13px] mb-1">{item.count} Items</span>
                        <div className="w-12 h-[3px] bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#3b4c9b] rounded-full" style={{ width: `${Math.max(10, percentage)}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
               }) : (
                 <p className="text-sm text-gray-500 text-center py-4">No data available</p>
               )}
             </div>
           </div>
        </div>
      </div>
    );
  }

  if (activeView === 'stock') {
    const lowStockProducts = products.filter(p => p.stock !== undefined && p.stock < 10).sort((a, b) => (a.stock || 0) - (b.stock || 0));
    const emptyStock = lowStockProducts.filter(p => !p.stock || p.stock === 0);
    const lowNotEmtpy = lowStockProducts.filter(p => p.stock && p.stock > 0);
    const sortedLowStock = [...emptyStock, ...lowNotEmtpy];

    return (
      <div className="flex-1 bg-[#f4f5f9] dark:bg-black/95 flex flex-col h-full overflow-hidden relative">
        <div className="px-5 pt-12 pb-4 flex items-center gap-4 z-10 bg-[#f4f5f9] dark:bg-black">
          <button onClick={() => setActiveView('main')} className="flex items-center justify-center transition-colors">
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="font-bold text-gray-800 dark:text-white text-[19px] tracking-tight">Low Stock Trends</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto pb-40 px-5">
           {sortedLowStock.length > 0 && (
             <div className="bg-gradient-to-r from-[#445bba] to-[#8fa5db] text-white rounded-[24px] p-5 mb-8 shadow-sm flex items-center justify-between mt-2">
               <div className="flex items-start gap-3">
                 <ShieldAlert size={20} className="text-white mt-1 shrink-0" />
                 <div>
                   <h3 className="font-bold text-[15px] leading-tight mb-2 pr-6">
                     {sortedLowStock[0].name} is {!sortedLowStock[0].stock ? 'out of stock' : 'running low'}
                   </h3>
                   <p className="text-[12px] opacity-90 font-medium">You might want to restock soon.</p>
                 </div>
               </div>
             </div>
           )}

           <div className="flex items-center justify-between mb-5">
             <h2 className="font-bold text-gray-900 dark:text-white text-[17px]">Low Stock Alerts</h2>
             <span className="text-[12px] font-bold text-[#3b4c9b] bg-indigo-50 px-2 py-1 rounded-md">{sortedLowStock.length} Items</span>
           </div>
           
           <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-5 shadow-sm space-y-0">
             {sortedLowStock.length > 0 ? sortedLowStock.map((item, index) => (
               <div key={item.id} className={`flex items-center justify-between py-4 ${index !== sortedLowStock.length - 1 ? 'border-b border-gray-100 dark:border-zinc-800' : ''}`}>
                 <div>
                   <h4 className="font-bold text-gray-800 dark:text-gray-200 text-[14.5px] tracking-tight mb-1 truncate max-w-[150px]">{item.name}</h4>
                   {(!item.stock || item.stock === 0) ? (
                     <div className="inline-block bg-[#feebea] text-[#d65f57] font-bold text-[11px] px-2 py-1 rounded-md">
                       Out of Stock
                     </div>
                   ) : (
                     <div className="inline-block bg-[#fff9ea] text-[#b08b3c] font-bold text-[11px] px-2 py-1 rounded-md">
                       Low Stock
                     </div>
                   )}
                 </div>
                 <div className="flex items-center gap-5">
                   <div className="text-center">
                     <div className="font-bold text-gray-800 dark:text-gray-200 text-[14px]">{item.stock || 0}</div>
                     <div className="text-[10px] text-gray-400 font-medium">items</div>
                   </div>
                   <div className="w-5 h-5 border-l-2 border-b-2 border-gray-700 mb-1 flex items-end justify-end p-0.5">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 transform rotate-45 mb-0.5"><path d="m5 12 7 7 7-7"/></svg>
                   </div>
                 </div>
               </div>
             )) : (
                <div className="py-8 text-center">
                  <p className="text-gray-500 font-medium text-sm">All products are well stocked.</p>
                </div>
             )}
           </div>
        </div>
      </div>
    );
  }

  // Active View Main
  return (
    <div className="flex-1 bg-[#f4f5f9] dark:bg-black/95 flex flex-col h-full overflow-hidden relative">
      <div className="px-5 pt-12 pb-4 flex items-center gap-4 z-10 bg-[#f4f5f9] dark:bg-black">
         <button onClick={() => navigate(-1)} className="flex items-center justify-center transition-colors">
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
         </button>
         <h1 className="font-bold text-gray-800 dark:text-white text-[19px] tracking-tight">Report</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-40 px-5">
         <div className="relative mb-6 mt-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search Reports" 
              className="w-full bg-white dark:bg-zinc-900 rounded-[20px] py-4 pl-12 pr-12 text-sm font-medium shadow-sm outline-none placeholder:text-gray-400 text-gray-800 dark:text-gray-200 border border-transparent focus:border-indigo-100"
            />
         </div>

         <div className="space-y-4">
            {/* Sales Overview */}
            <div onClick={() => setActiveView('sales')} className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
              <div className="flex items-start gap-4">
                <TrendingUp size={24} className="text-gray-600 dark:text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-[16px] mb-1">Sales Overview</h3>
                  <p className="text-[13px] text-gray-400 font-medium">Monitor revenue and sales metrics</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>

            {/* Low Stock Alert Trends */}
            <div onClick={() => setActiveView('stock')} className="bg-gradient-to-r from-[#445bba] to-[#8fa5db] p-5 rounded-[24px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
              <div className="flex items-start gap-4">
                <ShieldAlert size={24} className="text-white shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-white text-[16px] mb-1">Low Stock Alert Trends</h3>
                  <p className="text-[13px] text-white/80 font-medium">Track stock level alerts overtime</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
            </div>

            {/* Medicine Usage Insights */}
            <div onClick={() => setActiveView('usage')} className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
              <div className="flex items-start gap-4">
                <BarChart2 size={24} className="text-gray-600 dark:text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-[16px] mb-1">Medicine Usage Insights</h3>
                  <p className="text-[13px] text-gray-400 font-medium">Analyze popular medication and usage</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
         </div>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
       <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
