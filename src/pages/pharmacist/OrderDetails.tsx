import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, Package, Download, X, AlertTriangle, RefreshCcw, MessageCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { sendEmail } from '../../lib/email';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
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
          const orderData = { id: docSnap.id, ...docSnap.data() } as any;
          orderData.patientName = 'Unknown Patient';
          if (orderData.patientId) {
             try {
                const pd = await getDoc(doc(db, 'users', orderData.patientId));
                if (pd.exists()) {
                   orderData.patientName = pd.data().name || pd.data().fullName || 'Unknown Patient';
                }
             } catch(e) {}
          }
          setOrder(orderData);
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
      
      // Notify the patient
      await addDoc(collection(db, 'notifications'), {
        userId: order.patientId,
        type: 'order_status',
        title: 'Order Status Updated',
        message: `Your order status has been updated to: ${newStatus}`,
        isRead: false,
        relatedId: order.id,
        createdAt: serverTimestamp()
      });
      
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
    <div className="flex-1 bg-[#f4f5f9] dark:bg-black/95 flex flex-col h-full overflow-hidden relative">
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 z-10">
         <button onClick={() => navigate(-1)} className="flex items-center justify-center transition-colors">
            <ArrowLeft size={24} className="text-gray-700 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-800 dark:text-white text-[19px] tracking-tight"> {t('order', 'Order #')} {order.id.slice(0, 3)}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-40">
         <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-sm">
           {/* Badge */}
           <div className={`inline-block px-5 py-1.5 rounded-full text-sm font-bold mb-5 ${
              order.status === 'pending' ? 'bg-[#c5ead5] text-[#2c8d50]' :
              order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
              order.status === 'ready' ? 'bg-green-100 text-green-700' :
              (order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-100 text-red-700' :
              'bg-gray-200 text-gray-700'
           }`}>
              {order.status === 'pending' ? 'New' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
           </div>
           
           <h2 className="text-[22px] font-bold text-indigo-700 dark:text-indigo-400 mb-1.5">Order #{order.id.slice(0, 3)}</h2>
           <p className="text-sm text-gray-400 font-medium mb-7 tracking-wide">
              {parseDate(order.createdAt) ? parseDate(order.createdAt)!.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(' at', ' |') : 'recently'}
           </p>

           {/* Order Summary */}
           <div className="bg-gray-50 dark:bg-zinc-900/70 dark:bg-black/40 rounded-3xl p-5 mb-5 pb-6">
             <h3 className="font-bold text-gray-700 dark:text-gray-200 text-[15px] mb-3">Order Summary</h3>
             <div className="text-[13px] font-medium text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
               <span>Driver : <span className="text-gray-700 font-bold dark:text-gray-300">{order.driverName || (order.driverId ? 'Assigned' : 'Unassigned')}</span></span>
               <span>Customer : <span className="text-gray-700 font-bold dark:text-gray-300">{order.patientName || 'Customer'}</span></span>
               <span>Count : <span className="text-gray-700 font-bold dark:text-gray-300">{order.items?.length || 0} items</span></span>
             </div>
           </div>

           {/* Medicines */}
           <div className="space-y-3 mb-5">
             <h3 className="font-bold text-gray-700 dark:text-gray-200 text-[15px] mb-3 px-1">Medicines</h3>
             {(order.items || []).map((item: any, index: number) => (
                <div key={index} className="bg-white dark:bg-black border border-gray-100 dark:border-zinc-800 p-4 rounded-2xl flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-zinc-900 rounded-xl flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                         <span className="text-xs opacity-70">x</span>{item.quantity}
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 dark:text-white text-[15px]">{item.name}</p>
                         {item.dosage && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.dosage}</p>}
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</p>
                      {item.quantity > 1 && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatCurrency(item.price)} each</p>}
                   </div>
                </div>
             ))}
             {!(order.items?.length > 0) && <div className="bg-white dark:bg-black p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 text-center text-gray-500 text-sm shadow-sm">No items</div>}
           </div>

           {/* Prescription */}
           <div className="bg-gray-50 dark:bg-zinc-900/70 dark:bg-black/40 rounded-3xl p-5 mb-5">
             <h3 className="font-bold text-gray-700 dark:text-gray-200 text-[15px] mb-3">Prescription</h3>
             {order.hasPrescription && order.prescriptionUrl ? (
               <div className="text-center py-3">
                 <button onClick={() => window.open(order.prescriptionUrl, '_blank')} className="text-[13px] font-bold text-gray-700 dark:text-gray-300 underline underline-offset-4 decoration-gray-400">View Prescription Image</button>
               </div>
             ) : (
               <p className="text-[13px] text-gray-500 text-center py-2 underline underline-offset-4 decoration-gray-300 w-full block">No prescription</p>
             )}
           </div>

           {/* Note */}
           {order.notes && (
             <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-3xl p-5 mb-5">
               <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-orange-500 mt-0.5 shrink-0" />
                  <div>
                     <h3 className="font-bold text-orange-800 dark:text-orange-300 text-[15px] mb-2">Patient's Note</h3>
                     <p className="text-[14.5px] font-medium text-orange-700 dark:text-orange-200/80 whitespace-pre-line leading-relaxed">
                       {order.notes}
                     </p>
                  </div>
               </div>
             </div>
           )}

           {/* Total */}
           <div className="bg-gray-50 dark:bg-zinc-900/70 dark:bg-black/40 rounded-3xl p-5 mb-2 flex justify-between items-center">
             <h3 className="font-bold text-gray-700 dark:text-gray-200 text-[16px]">Total :</h3>
             <span className="font-bold text-gray-800 dark:text-white text-[16px]">{formatCurrency(order.total)}</span>
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
              <CheckCircle size={20} />  {order.deliveryMethod === 'pickup' ? t('mark_as_ready_for_pickup', 'Mark as Ready for Pickup') : t('mark_as_ready_for_delivery', 'Mark as Ready for Delivery')} </button>
         )}
         
         {order.status === 'ready' && order.deliveryMethod === 'pickup' && (
           <button disabled={processing} onClick={() => handleUpdateStatus('delivered')} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]">
              <CheckCircle size={20} />  {t('confirm_patient_pickup', 'Confirm Patient Picked Up')} </button>
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
