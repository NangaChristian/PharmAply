import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, Package, Download, X, AlertTriangle, RefreshCcw, MessageCircle, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { sendEmail } from '../../lib/email';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import { printInvoice } from '../../lib/invoice';
import { InvoiceModal } from '../../components/InvoiceModal';
import { useTranslation } from "react-i18next";

export function PharmacistOrderDetails() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
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
    setActionLoading(newStatus);
    try {
      const historyItem = { status: newStatus, timestamp: new Date().toISOString() };
      const newHistory = [...(order.statusHistory || []), historyItem];
      
      const updateData: any = { status: newStatus, statusHistory: newHistory };
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
      
      setOrder({ ...order, status: newStatus, statusHistory: newHistory, cancellationReason: newStatus === 'rejected' ? rejectReason : order.cancellationReason });
      setIsRejecting(false);

      if (newStatus === 'preparing') {
        toast.success("Commande acceptée avec succès !");
      } else if (newStatus === 'rejected') {
        toast.success("Commande rejetée.");
      } else {
        toast.success("Statut de la commande mis à jour !");
      }

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
      toast.error("Erreur lors de la mise à jour de la commande.");
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    } finally {
      setProcessing(false);
      setActionLoading(null);
    }
  };

  const handlePrintInvoice = () => {
    if (order) {
      printInvoice(order);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 animate-pulse"> Loading order... </div>;
  if (!order) return <div className="p-8 text-center text-sm text-gray-500"> Order not found </div>;

  return (
    <div className="flex-1 bg-transparent flex flex-col h-full overflow-hidden relative">
      <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
         <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
               <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight"> Order #{order.id.slice(0, 8).toUpperCase()}</h1>
         </div>
         <button 
           type="button"
           onClick={() => navigate(`/pharmacist/messages/${order.id}`)}
           className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
         >
           <MessageCircle size={16} />
           Chat with Patient
         </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-40 custom-scrollbar">
         <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
           {/* Badge */}
           <div className={`inline-block px-5 py-1.5 rounded-full text-sm font-bold mb-5 ${
              order.status === 'pending' ? 'bg-[#c5ead5] text-[#2c8d50]' :
              order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
              (order.status === 'ready' || order.status === 'ready_for_pickup') ? 'bg-[#D3F5A8] text-[#0B3B3C]' :
              (order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-100 text-red-700' :
              'bg-[#FAFBFC] border border-gray-200 text-gray-700'
           }`}>
              {order.status === 'pending' ? 'New' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
           </div>
           
           <h2 className="text-2xl font-bold text-[#0B3B3C] dark:text-white mb-2">Order #{order.id.slice(0, 3)}</h2>
           <p className="text-sm text-gray-500 font-medium mb-8">
              {parseDate(order.createdAt) ? parseDate(order.createdAt)!.toLocaleString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(' at', ' |') : 'recently'}
           </p>

           {/* Order Summary */}
           <div className="bg-[#FAFBFC] dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl p-6 mb-6">
             <h3 className="font-bold text-gray-900 dark:text-white text-base mb-4">Order Summary</h3>
             <div className="text-sm font-medium text-gray-500 flex flex-wrap gap-x-6 gap-y-3">
               <span className="flex flex-col gap-1">Driver: <span className="text-gray-900 font-bold dark:text-gray-300">{order.driverName || (order.driverId ? 'Assigned' : 'Unassigned')}</span></span>
               <span className="flex flex-col gap-1">Customer: <span className="text-gray-900 font-bold dark:text-gray-300">{order.patientName || 'Customer'}</span></span>
               <span className="flex flex-col gap-1">Count: <span className="text-gray-900 font-bold dark:text-gray-300">{order.items?.length || 0} items</span></span>
             </div>
           </div>

           {/* Medicines */}
           <div className="space-y-4 mb-8">
             <h3 className="font-bold text-gray-900 dark:text-white text-base mb-4 px-1">Medicines</h3>
             {(order.items || []).map((item: any, index: number) => (
                <div key={index} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-5 rounded-2xl flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#E2EBE9] dark:bg-slate-900 rounded-xl flex flex-col items-center justify-center text-[#0B3B3C] dark:text-gray-300 font-bold shrink-0">
                         <span className="text-[10px] opacity-70">x</span>{item.quantity}
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 dark:text-white text-sm">{item.name}</p>
                         {item.dosage && <p className="text-xs text-gray-500 mt-1">{item.dosage}</p>}
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(item.price * item.quantity)}</p>
                      {item.quantity > 1 && <p className="text-xs text-gray-500 mt-1">{formatCurrency(item.price)} each</p>}
                   </div>
                </div>
             ))}
             {!(order.items?.length > 0) && <div className="bg-[#FAFBFC] p-4 rounded-2xl border border-gray-100 text-center text-gray-500 text-sm">No items</div>}
           </div>

           {/* Prescription DPML Validation */}
           {order.hasPrescription && (
             <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 mb-6 space-y-4">
               <div className="flex items-center gap-2">
                 <AlertTriangle size={20} className="text-red-500 shrink-0" />
                 <h3 className="font-bold text-red-900 dark:text-red-400 text-sm">Validation DPML (Ordonnance Obligatoire)</h3>
               </div>
               
               {order.prescriptionUrl ? (
                 <div className="bg-white dark:bg-slate-800 border border-red-50 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600">
                         <FileText size={18} />
                      </div>
                      <div>
                         <p className="font-bold text-gray-900 dark:text-white text-sm">Ordonnance Téléchargée</p>
                         <p className="text-xs text-gray-500 font-medium mt-0.5">Veuillez vérifier l'authenticité</p>
                      </div>
                   </div>
                   <button onClick={() => window.open(order.prescriptionUrl, '_blank')} className="bg-red-600/10 text-red-700 px-5 py-2.5 rounded-full text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">
                     Ouvrir le document
                   </button>
                 </div>
               ) : (
                 <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">Document Manquant</p>
                    <p className="text-xs text-gray-500 mt-1">Le patient n'a pas téléchargé d'ordonnance valide.</p>
                 </div>
               )}
             </div>
           )}

           {/* Note */}
           {order.notes && (
             <div className="bg-[#FFF8E6] border border-[#FFE5B4] rounded-2xl p-6 mb-6">
               <div className="flex items-start gap-4">
                  <AlertTriangle size={20} className="text-orange-500 mt-0.5 shrink-0" />
                  <div>
                     <h3 className="font-bold text-orange-900 text-sm mb-2">Patient's Note</h3>
                     <p className="text-sm font-medium text-orange-800 whitespace-pre-line leading-relaxed">
                       {order.notes}
                     </p>
                  </div>
               </div>
             </div>
           )}

           {/* Total */}
           <div className="bg-[#FAFBFC] dark:bg-slate-900 rounded-2xl p-6 flex justify-between items-center border border-gray-100 dark:border-slate-700 mb-6">
             <h3 className="font-bold text-gray-900 dark:text-white text-base">Total :</h3>
             <span className="font-bold text-gray-900 dark:text-white text-lg">{formatCurrency(order.total)}</span>
           </div>

           {/* Timeline */}
           <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
             <h3 className="font-bold text-gray-900 dark:text-white text-base mb-6">Order Timeline</h3>
             <div className="relative border-l-2 border-gray-100 dark:border-slate-700 ml-3 space-y-6">
               {[
                 { status: 'pending', timestamp: order.createdAt },
                 ...(order.statusHistory || (order.status !== 'pending' ? [{ status: order.status, timestamp: order.updatedAt || undefined }] : []))
               ].map((update, index, arr) => {
                 const isLast = index === arr.length - 1;
                 const getStatusLabel = (s: string) => {
                   switch(s) {
                     case 'pending': return 'Order Placed';
                     case 'preparing': return 'Preparing Order';
                     case 'ready': return 'Ready for Delivery';
                     case 'ready_for_pickup': return 'Ready for Pickup';
                     case 'accepted': return 'Driver Assigned';
                     case 'picked_up': return 'Picked up by Driver';
                     case 'on_the_way': return 'Out for Delivery';
                     case 'delivered': return 'Delivered';
                     case 'rejected': return 'Order Rejected';
                     case 'cancelled': return 'Order Cancelled';
                     default: return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
                   }
                 };
                 return (
                   <div key={index} className="relative pl-6">
                     <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isLast ? 'bg-[#0B3B3C] ring-4 ring-teal-50 dark:ring-slate-700' : 'bg-gray-300 dark:bg-gray-600'}`} />
                     <div>
                       <p className={`text-sm font-bold ${isLast ? 'text-[#0B3B3C] dark:text-teal-400' : 'text-gray-900 dark:text-gray-300'}`}>
                         {getStatusLabel(update.status)}
                       </p>
                       <p className="text-xs text-gray-500 mt-1">
                         {update.timestamp ? (parseDate(update.timestamp) ? parseDate(update.timestamp)!.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Pending') : 'Time unknown'}
                       </p>
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>

         </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-transparent px-8 pb-8 pt-4 flex flex-col gap-4 z-20 pointer-events-none">
         <div className="flex gap-4 w-full justify-end pointer-events-auto">
             {order.status === 'pending' && !isRejecting && (
               <>
                 <button disabled={processing} onClick={handlePrintInvoice} className="px-5 py-3.5 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold shadow-sm transition-all focus:outline-none flex items-center gap-2">
                   <Download size={18} /> Print
                 </button>
                 <button disabled={processing} onClick={() => setIsRejecting(true)} className="px-8 py-3.5 bg-white border border-red-100 text-red-600 hover:bg-red-50 rounded-full font-bold shadow-sm transition-all focus:outline-none">
                    Reject </button>
                 <button 
                    disabled={processing} 
                    onClick={() => handleUpdateStatus('preparing')} 
                    className="px-8 py-3.5 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold shadow-md transition-all focus:outline-none flex items-center justify-center gap-2 disabled:opacity-75"
                 >
                    {processing && actionLoading === 'preparing' ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Acceptation...</span>
                      </>
                    ) : (
                      <span>Accept Order</span>
                    )}
                 </button>
               </>
             )}
             
             {order.status !== 'pending' && (
                 <button disabled={processing} onClick={handlePrintInvoice} className="px-5 py-3.5 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all focus:outline-none flex items-center gap-2">
                   <Download size={18} /> Print Invoice
                 </button>           
             )}
             
             {isRejecting && (
               <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col gap-4 w-full max-w-sm ml-auto pointer-events-auto animate-in slide-in-from-bottom-5">
                 <div>
                   <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2"> Reason for rejection: </label>
                   <select 
                     className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-[#FAFBFA] dark:bg-slate-900 text-sm focus:border-red-300 outline-none transition-all shadow-sm" 
                     value={rejectReason} 
                     onChange={(e) => setRejectReason(e.target.value)}
                   >
                      <option value=""> Select a reason </option>
                      <option value="Out of stock"> Out of stock </option>
                      <option value="Invalid prescription"> Invalid prescription </option>
                      <option value="Store closing soon"> Store closing soon </option>
                      <option value="other"> Other reason... </option>
                   </select>
                 </div>
                 {rejectReason === 'other' && (
                    <input 
                      type="text" 
                      placeholder="Type your reason here..." 
                      className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-[#FAFBFA] dark:bg-slate-900 text-sm focus:border-red-300 outline-none transition-all shadow-sm"
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                 )}
                 <div className="flex gap-3 mt-2">
                    <button disabled={processing} onClick={() => setIsRejecting(false)} className="flex-1 py-3 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold transition-colors"> Cancel </button>
                    <button 
                       disabled={processing || !rejectReason} 
                       onClick={() => handleUpdateStatus('rejected')} 
                       className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                       {processing && actionLoading === 'rejected' ? (
                         <>
                           <Loader2 size={16} className="animate-spin" />
                           <span>Rejet...</span>
                         </>
                       ) : (
                         <span>Confirm Reject</span>
                       )}
                    </button>
                 </div>
               </div>
             )}
             
             {order.status === 'preparing' && (
               <button 
                  disabled={processing} 
                  onClick={() => handleUpdateStatus(order.deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'ready')} 
                  className="px-8 py-3.5 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold shadow-md transition-all ml-auto focus:outline-none pointer-events-auto flex items-center justify-center gap-2 disabled:opacity-75"
               >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Mise à jour...</span>
                    </>
                  ) : (
                    order.deliveryMethod === 'pickup' ? 'Mark as Ready for Pickup' : 'Mark as Ready for Delivery'
                  )}
               </button>
             )}
             
             {order.status === 'ready_for_pickup' && order.deliveryMethod === 'pickup' && (
               <button 
                  disabled={processing} 
                  onClick={() => handleUpdateStatus('delivered')} 
                  className="px-8 py-3.5 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold shadow-md transition-all ml-auto focus:outline-none pointer-events-auto flex items-center justify-center gap-2 disabled:opacity-75"
               >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Confirmation...</span>
                    </>
                  ) : (
                    'Confirm Picked Up'
                  )}
               </button>
             )}
         </div>
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
