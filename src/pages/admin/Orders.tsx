import { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy } from '../../lib/firebase';
import { db } from "../../lib/firebase";
import { formatCurrency, parseDate } from "../../lib/utils";
import { Search, Package, MapPin, Calendar, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AdminOrders() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredOrders = orders.filter(o => 
    (o.id.toLowerCase() || "").includes(search.toLowerCase()) ||
    (o.patientId?.toLowerCase() || "").includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold uppercase">{t('status_pending', 'Pending')}</span>;
      case 'processing': return <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase">{t('status_processing', 'Processing')}</span>;
      case 'out_for_delivery': return <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold uppercase">{t('status_out_for_delivery', 'Out for Delivery')}</span>;
      case 'delivered': return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase">{t('status_delivered', 'Delivered')}</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase">{t('status_cancelled', 'Cancelled')}</span>;
      default: return <span className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold uppercase">{status}</span>;
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0 flex items-center justify-between">
         <div>
             <h1 className="font-bold text-gray-900 text-2xl mb-1">{t('admin_orders', 'Orders')}</h1>
             <p className="text-gray-500 text-sm">{t('admin_orders_desc', 'Monitor all platform deliveries')}</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="flex items-center justify-between">
             <div className="relative w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder={t('search_order_id', 'Search order ID...')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 py-2.5 pl-12 pr-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none transition"
                />
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             {loading ? (
                <div className="p-8 text-center text-slate-500">{t('loading', 'Loading...')}</div>
             ) : (
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50/50 border-b border-slate-100 uppercase mt-2">
                         <tr>
                            <th className="py-4 px-6 font-semibold">{t('order_id', 'Order ID')}</th>
                            <th className="py-4 px-6 font-semibold">{t('date', 'Date')}</th>
                            <th className="py-4 px-6 font-semibold">{t('amount', 'Amount')}</th>
                            <th className="py-4 px-6 font-semibold">{t('status', 'Status')}</th>
                            <th className="py-4 px-6 font-semibold text-right">{t('details', 'Details')}</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {filteredOrders.map((o) => {
                            const dateStr = parseDate(o.createdAt) ? parseDate(o.createdAt)!.toLocaleString() : "Unknown";
                            return (
                               <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-4 px-6 font-mono font-medium text-indigo-600 block">
                                     #{o.id.slice(0, 8)}...
                                  </td>
                                  <td className="py-4 px-6 text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                      <Calendar size={14} /> {dateStr}
                                    </div>
                                  </td>
                                  <td className="py-4 px-6 font-bold text-slate-700">
                                     {formatCurrency(Number(o.total || 0))}
                                  </td>
                                  <td className="py-4 px-6">
                                     {getStatusBadge(o.status)}
                                  </td>
                                  <td className="py-4 px-6 text-right">
                                     <button className="text-slate-400 hover:text-indigo-600 p-1.5 transition">
                                        <ExternalLink size={18} />
                                     </button>
                                  </td>
                               </tr>
                            );
                         })}
                         {filteredOrders.length === 0 && (
                           <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500">{t('no_orders', 'No orders found.')}</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             )}
          </div>
      </div>
    </div>
  );
}
