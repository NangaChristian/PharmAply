import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock, FileText, Search, AlertTriangle, Check, X } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate, sortByDateDesc } from '../../lib/utils';
import { printInvoice } from '../../lib/invoice';
import { useTranslation } from "react-i18next";

export function PatientOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    let unsubscribe: () => void;
    const fetchOrders = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'orders'), where('patientId', '==', user.uid));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const rawOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setOrders(sortByDateDesc(rawOrders));
          setLoading(false);
        });
      } catch (error) {
        console.error(error);
        setLoading(false);
      }
    };
    fetchOrders();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status));
  const pastOrders = orders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status));

  const handleApproveSubstitute = async (id: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: 'preparing' });
      setOrders(orders.map(o => o.id === id ? { ...o, status: 'preparing' } : o));
    } catch(error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

  const handleCancelOrder = async (id: string) => {
    try {
      const updateData: any = { status: 'cancelled' };
      if (cancelReason) {
        updateData.cancellationReason = cancelReason;
      }
      await updateDoc(doc(db, 'orders', id), updateData);
      setCancellingOrder(null);
      setCancelReason("");
    } catch(error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    }
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 flex flex-col gap-4">
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('orders', 'Orders')}</h1>
         
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
            <input type="text" placeholder={t('search_orders', 'Search orders...')} className="w-full bg-gray-100 dark:bg-zinc-900 py-3 pl-12 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
         </div>
         
         <div className="flex gap-4 border-b border-gray-100 dark:border-zinc-800 pb-2 text-sm font-medium">
            <button className="text-indigo-600 border-b-2 border-indigo-600 pb-2">{t('active', 'Active')} ({activeOrders.length})</button>
            <button className="text-gray-400 dark:text-gray-500 pb-2">{t('past', 'Past')} ({pastOrders.length})</button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {loading ? <p className="text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-4">{t('loading_orders', 'Loading orders...')}</p> : (
           <>
             {/* Active Orders */}
             <div className="space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('active_orders', 'Active Orders')}</h3>
                {activeOrders.map(order => (
                   <div key={order.id} onClick={() => navigate(`/patient/tracking/${order.id}`)} className={`bg-white dark:bg-black p-4 rounded-2xl border shadow-sm cursor-pointer hover:border-indigo-300 transition ${order.status === 'substitution_proposed' ? 'border-indigo-200 shadow-indigo-100/50' : 'border-orange-200 shadow-orange-100/50'}`}>
                      <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                         <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${order.status === 'substitution_proposed' ? 'bg-indigo-50 text-indigo-500' : 'bg-orange-50 text-orange-500'}`}>
                               {order.status === 'substitution_proposed' ? <AlertTriangle size={20} /> : <Clock size={20} />}
                            </div>
                            <div>
                               <p className="font-bold text-gray-900 dark:text-white text-sm">{t('order', 'Order')} #{order.id.slice(0,8)}</p>
                               <p className={`text-xs font-medium uppercase ${order.status === 'substitution_proposed' ? 'text-indigo-600' : 'text-orange-600'}`}>{t(order.status, order.status)}</p>
                            </div>
                         </div>
                      </div>
                      
                      {order.status === 'substitution_proposed' && (
                         <div className="mb-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-900 mb-1">{t('substitution_proposal', 'Pharmacist Substitution Proposal')}</p>
                            <p className="text-[10px] text-indigo-700 leading-relaxed mb-3">
                              {t('substitution_proposal_desc', 'The pharmacist proposed an equivalent substitute. please approve to proceed.')}
                            </p>
                            <div className="flex gap-2">
                               <button onClick={(e) => { e.stopPropagation(); }} className="flex-1 py-1.5 bg-white dark:bg-black border border-red-100 text-red-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1">
                                  <X size={12} /> {t('reject', 'Reject')}
                               </button>
                               <button onClick={(e) => { e.stopPropagation(); handleApproveSubstitute(order.id); }} className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1">
                                  <Check size={12} /> {t('approve', 'Approve')}
                               </button>
                            </div>
                         </div>
                      )}

                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">
                         <span>{parseDate(order.createdAt) ? parseDate(order.createdAt)!.toLocaleDateString() : t('recently', 'Recently')}</span>
                         <span>{formatCurrency(order.total)}</span>
                      </div>
                      
                        {order.status === 'pending' && cancellingOrder !== order.id && (
                          <div className="mt-3 text-right">
                            <button onClick={(e) => { e.stopPropagation(); setCancellingOrder(order.id); }} className="text-xs text-red-600 font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition">
                              {t('cancel_order', 'Cancel Order')}
                            </button>
                          </div>
                        )}
                      
                      {cancellingOrder === order.id && (
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
                          <label className="text-[10px] font-bold text-gray-700 uppercase mb-1 block">{t('reason_for_cancellation', 'Reason for cancellation')}</label>
                          <select 
                            className="w-full border border-gray-200 dark:border-zinc-800 p-2 rounded-lg bg-gray-50 dark:bg-black text-xs mb-2" 
                            value={cancelReason} 
                            onChange={(e) => setCancelReason(e.target.value)}
                          >
                             <option value="">{t('select_reason', 'Select a reason')}</option>
                             <option value="Changed my mind">{t('reason_changed_mind', 'Changed my mind')}</option>
                             <option value="Ordered by mistake">{t('reason_mistake', 'Ordered by mistake')}</option>
                             <option value="Delivery is taking too long">{t('reason_delivery_long', 'Delivery is taking too long')}</option>
                             <option value="Found a better price">{t('reason_better_price', 'Found a better price')}</option>
                             <option value="other">{t('other', 'Other')}</option>
                          </select>
                          {cancelReason === 'other' && (
                             <input 
                               type="text" 
                               placeholder={t('enter_reason', 'Enter reason...')} 
                               className="w-full border border-gray-200 dark:border-zinc-800 p-2 rounded-lg bg-gray-50 dark:bg-black text-xs mb-2"
                               onChange={(e) => setCancelReason(e.target.value)}
                             />
                          )}
                          <div className="flex gap-2 mt-2">
                             <button onClick={(e) => { e.stopPropagation(); setCancellingOrder(null); }} className="flex-1 py-1.5 bg-gray-100 dark:bg-zinc-900 text-gray-700 rounded-lg text-xs font-bold transition hover:bg-gray-200">{t('keep_order', 'Keep Order')}</button>
                             <button disabled={!cancelReason} onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 hover:bg-red-700">{t('confirm_cancel', 'Confirm Cancel')}</button>
                          </div>
                        </div>
                      )}
                   </div>
                ))}
                
                {activeOrders.length === 0 && (
                   <div className="text-center py-10 px-6 bg-white dark:bg-black rounded-2xl border border-gray-100 dark:border-zinc-800 border-dashed flex flex-col items-center justify-center">
                     <div className="w-16 h-16 bg-gray-50 dark:bg-black text-gray-300 rounded-full flex items-center justify-center mb-4">
                        <Activity size={32} />
                     </div>
                     <h3 className="font-bold text-gray-900 dark:text-white mb-1">{t('no_active_orders', 'No active orders')}</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-6">{t('no_active_orders_desc', "You don't have any active orders right now. Start shopping to see them here.")}</p>
                     <button onClick={() => window.location.href = '/patient'} className="bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-sm">
                        {t('browse_products', 'Browse Products')}
                     </button>
                   </div>
                )}
             </div>

             {/* Past Orders */}
             <div className="space-y-4">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('past_orders', 'Past Orders')}</h3>
                {pastOrders.map(order => (
                   <div key={order.id} onClick={() => navigate(`/patient/tracking/${order.id}`)} className="bg-white dark:bg-black p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm cursor-pointer hover:border-indigo-300 transition">
                      <div className="flex justify-between items-start mb-3 border-b border-gray-50 pb-3">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                               <FileText size={20} />
                            </div>
                            <div>
                               <p className="font-bold text-gray-900 dark:text-white text-sm">{t('order', 'Order')} #{order.id.slice(0,8)}</p>
                               <p className={`text-xs font-medium uppercase ${order.status === 'delivered' ? 'text-green-600' : 'text-red-500'}`}>{t(order.status, order.status)}</p>
                            </div>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium">
                         <span>{parseDate(order.createdAt) ? parseDate(order.createdAt)!.toLocaleDateString() : t('unknown_date', 'unknown date')}</span>
                         <div className="flex items-center gap-2">
                           <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(order.total)}</span>
                           <button 
                             onClick={(e) => { e.stopPropagation(); printInvoice(order); }}
                             className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                             title="Imprimer / Télécharger la Facture"
                           >
                             <FileText size={12} /> Facture
                           </button>
                         </div>
                      </div>
                      {(order.status === 'cancelled' || order.status === 'rejected') && order.cancellationReason && (
                         <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-red-600 bg-red-50/50 p-2 rounded-lg">
                           <span className="font-bold">{t('reason', 'Reason')}:</span> {order.cancellationReason}
                         </div>
                      )}
                   </div>
                ))}
                {pastOrders.length === 0 && (
                   <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm bg-white dark:bg-black rounded-2xl border border-gray-100 dark:border-zinc-800 border-dashed">
                     {t('no_past_orders', 'No past orders')}
                   </div>
                )}
             </div>
           </>
         )}
         
         <div className="h-24"></div>
      </div>
    </div>
  );
}
