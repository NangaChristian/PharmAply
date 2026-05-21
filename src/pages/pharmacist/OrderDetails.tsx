import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, Package, Download, X, AlertTriangle, RefreshCcw, MessageCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { sendEmail } from '../../lib/email';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";

export function PharmacistOrderDetails() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
         console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;
    setProcessing(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'rejected' && rejectReason) {
        updateData.cancellationReason = rejectReason;
      }
      await updateDoc(doc(db, 'orders', order.id), updateData);
      setOrder({ ...order, status: newStatus, cancellationReason: newStatus === 'rejected' ? rejectReason : order.cancellationReason });
      setIsRejecting(false);

      // fetch patient to get email
      if (order.patientId) {
         try {
           const patientDoc = await getDoc(doc(db, 'users', order.patientId));
           if (patientDoc.exists() && patientDoc.data().email) {
             await sendEmail({
               to: patientDoc.data().email,
               subject: `Order Update: ${newStatus}`,
               html: `<p>Your order status has been updated to: <strong>${newStatus}</strong>.</p>`
             });
           }
         } catch(e) { console.error('Failed to notify patient', e); }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('loading_order', 'Loading order...')} </div>;
  if (!order) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('order_not_found', 'Order not found')} </div>;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden relative">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10 rounded-b-3xl">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full hover:bg-gray-100 dark:bg-zinc-900 transition-colors">
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-base tracking-tight"> {t('order', 'Order #')} {order.id.slice(0, 8)}</h1>
         <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
         {/* Status Alert */}
         <div className={`p-5 rounded-3xl flex flex-col gap-3 border shadow-sm ${
            (order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-50 border-red-100' : 
            order.status === 'ready' ? 'bg-green-50 border-green-100' :
            'bg-indigo-50 border-indigo-100'}`}>
            <div className="flex items-start gap-3">
               <Package className={
                  (order.status === 'cancelled' || order.status === 'rejected') ? "text-red-500 mt-0.5" : 
                  order.status === 'ready' ? "text-green-500 mt-0.5" :
                  "text-indigo-500 mt-0.5"
               } size={24} />
               <div>
                  <h3 className={`font-bold text-base ${
                     (order.status === 'cancelled' || order.status === 'rejected') ? "text-red-900" : 
                     order.status === 'ready' ? "text-green-900" :
                     "text-indigo-900"
                  }`}> {t('status', 'Status:')} <span className="uppercase tracking-wider text-sm ml-1">{order.status}</span></h3>
                  <p className={`text-sm mt-1 leading-relaxed ${
                     (order.status === 'cancelled' || order.status === 'rejected') ? "text-red-700/80" : 
                     order.status === 'ready' ? "text-green-700/80" :
                     "text-indigo-700/80"
                  }`}>
                    {order.status === 'cancelled' && order.cancellationReason && `Reason: ${order.cancellationReason}`}
                    {order.status === 'rejected' && order.cancellationReason && `Reason: ${order.cancellationReason}`}
                    {order.status === 'pending' && "Please review the order items and accept or reject the order."}
                    {order.status === 'preparing' && "Please prepare the order for the delivery partner."}
                    {order.status === 'ready' && "Order is ready and waiting for delivery pickup."}
                  </p>
               </div>
            </div>
         </div>

         {/* Patient Info */}
         <div className="bg-white dark:bg-black p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5 border-b border-gray-50 pb-4 text-base"> {t('patient_information', 'Patient Information')} </h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm font-medium"> {t('patient_id', 'Patient ID')} </span>
                  <span className="font-bold text-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-black px-3 py-1 rounded-lg">{order.patientId}</span>
               </div>
               <div className="flex justify-between items-start">
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm font-medium"> {t('delivery_address', 'Delivery Address')} </span>
                  <span className="font-bold text-gray-900 dark:text-white text-sm text-right max-w-[200px] leading-relaxed">{order.deliveryAddress}</span>
               </div>
               <div className="pt-4 border-t border-gray-50 dark:border-zinc-800">
                 <button onClick={() => navigate(`/pharmacist/messages/${order.id}`)} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
                   <MessageCircle size={18} /> {t('message_patient', 'Message Patient')}
                 </button>
               </div>
            </div>
         </div>

         {/* Prescription Review */}
         {order.hasPrescription && order.prescriptionUrl && (
            <div className="bg-white dark:bg-black p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm">
               <div className="flex items-center justify-between border-b border-gray-50 pb-4 mb-5">
                  <div className="flex items-center justify-between w-full">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base"> {t('prescription_review', 'Prescription Review')} </h3>
                    <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-orange-100">
                       <AlertTriangle size={12} />  {t('validation_required', 'Validation required')} </div>
                  </div>
               </div>
               <div 
                 className="aspect-[4/3] bg-gray-50 dark:bg-black rounded-2xl overflow-hidden relative border border-gray-100 dark:border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:bg-zinc-900 transition-colors group"
                 onClick={() => window.open(order.prescriptionUrl, '_blank')}
               >
                  {/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(order.prescriptionUrl) ? (
                    <img src={order.prescriptionUrl} alt="Prescription" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 flex-col gap-3 group-hover:text-indigo-500 transition-colors">
                       <FileImagePlaceholder />
                       <span className="text-sm font-bold underline"> {t('view_prescription', 'View Prescription Document')} </span>
                    </div>
                  )}
               </div>
            </div>
         )}

         {/* Requested Items */}
         <div className="bg-white dark:bg-black p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex justify-between items-center border-b border-gray-50 pb-4">
               <h3 className="font-bold text-gray-900 dark:text-white text-base"> {t('requested_items', 'Requested Items')} </h3>
               <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-sm">{formatCurrency(order.total)}</span>
            </div>
            
            <div className="space-y-4">
               {(order.items || []).map((item: any, index: number) => (
                 <div key={item.productId || index} className="flex gap-4">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0 border border-indigo-100/50">
                       <Package size={24} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                       <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 dark:text-white text-base line-clamp-1 pr-4">{item.name}</h4>
                          <span className="font-bold text-gray-900 dark:text-white text-base shrink-0">{formatCurrency(item.price)}</span>
                       </div>
                       <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium"> {t('quantity', 'Quantity:')} <span className="text-gray-900 dark:text-white font-bold">{item.quantity}</span></p>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-black/80 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 p-6 px-6 flex flex-col gap-4 z-20">
         {order.status === 'pending' && !isRejecting && (
           <div className="flex gap-4 w-full">
             <button disabled={processing} onClick={() => setIsRejecting(true)} className="flex-1 min-w-[120px] py-4 border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                <X size={20} />  {t('reject', 'Reject')} </button>
             <button disabled={processing} onClick={() => handleUpdateStatus('preparing')} className="flex-[2] min-w-[180px] py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]">
                <CheckCircle size={20} />  {t('accept_order', 'Accept Order')} </button>
           </div>
         )}
         
         {isRejecting && (
           <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-5">
             <div>
               <label className="text-sm font-bold text-gray-700 block mb-2"> {t('reason_for_rejection', 'Reason for rejection:')} </label>
               <select 
                 className="w-full border border-gray-200 dark:border-zinc-800 p-3.5 rounded-2xl bg-white dark:bg-black text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-sm" 
                 value={rejectReason} 
                 onChange={(e) => setRejectReason(e.target.value)}
               >
                  <option value=""> {t('select_a_reason', 'Select a reason')} </option>
                  <option value="Out of stock"> {t('out_of_stock', 'Out of stock')} </option>
                  <option value="Invalid prescription"> {t('invalid_prescription', 'Invalid prescription')} </option>
                  <option value="Store closing soon"> {t('store_closing_soon', 'Store closing soon')} </option>
                  <option value="other"> {t('other_reason', 'Other reason...')} </option>
               </select>
             </div>
             {rejectReason === 'other' && (
                <input 
                  type="text" 
                  placeholder={t('type_your_reason_here', 'Type your reason here...')} 
                  className="w-full border border-gray-200 dark:border-zinc-800 p-3.5 rounded-2xl bg-white dark:bg-black text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-sm"
                  onChange={(e) => setRejectReason(e.target.value)}
                />
             )}
             <div className="flex gap-3 mt-1">
                <button disabled={processing} onClick={() => setIsRejecting(false)} className="flex-1 py-4 bg-gray-100 dark:bg-zinc-900 text-gray-700 hover:bg-gray-200 rounded-2xl font-bold transition-colors"> {t('cancel', 'Cancel')} </button>
                <button disabled={processing || !rejectReason} onClick={() => handleUpdateStatus('rejected')} className="flex-[2] py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold disabled:opacity-50 transition-all shadow-lg shadow-red-200 flex justify-center items-center gap-2">
                    {t('confirm_reject', 'Confirm Reject')} </button>
             </div>
           </div>
         )}
         
         {order.status === 'preparing' && (
           <button disabled={processing} onClick={() => handleUpdateStatus('ready')} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-green-200 hover:bg-green-700 transition-all active:scale-[0.98]">
              <CheckCircle size={20} />  {t('mark_as_ready_for_delivery', 'Mark as Ready for Delivery')} </button>
         )}
      </div>
    </div>
  );
}

function FileImagePlaceholder() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  );
}
