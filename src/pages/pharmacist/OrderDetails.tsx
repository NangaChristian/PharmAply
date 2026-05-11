import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, Package, Download, X, AlertTriangle, RefreshCcw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';

export function PharmacistOrderDetails() {
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500">Loading order...</div>;
  if (!order) return <div className="p-8 text-center text-sm text-gray-500">Order not found</div>;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden relative">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-900" />
         </button>
         <h1 className="font-bold text-gray-900 text-sm">Order #{order.id.slice(0, 8)}</h1>
         <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
         {/* Status Alert */}
         <div className={`border p-4 rounded-2xl flex items-start gap-3 ${(order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-50 border-red-100' : 'bg-indigo-50 border-indigo-100'}`}>
            <Package className={(order.status === 'cancelled' || order.status === 'rejected') ? "text-red-600 mt-0.5" : "text-indigo-600 mt-0.5"} size={20} />
            <div>
               <h3 className={`font-bold text-sm ${(order.status === 'cancelled' || order.status === 'rejected') ? "text-red-900" : "text-indigo-900"}`}>Status: <span className="uppercase">{order.status}</span></h3>
               <p className={`text-xs mt-1 ${(order.status === 'cancelled' || order.status === 'rejected') ? "text-red-700/80" : "text-indigo-700/80"}`}>
                 {order.status === 'cancelled' && order.cancellationReason && `Reason: ${order.cancellationReason}`}
                 {order.status === 'rejected' && order.cancellationReason && `Reason: ${order.cancellationReason}`}
                 {(order.status !== 'cancelled' && order.status !== 'rejected') && "Review the order items and update status."}
               </p>
            </div>
         </div>

         {/* Patient Info */}
         <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-50 pb-3 text-sm">Patient Information</h3>
            <div className="space-y-3">
               <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">Patient ID</span>
                  <span className="font-bold text-gray-900 text-sm">{order.patientId}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">Address</span>
                  <span className="font-bold text-gray-900 text-sm text-right max-w-[200px]">{order.deliveryAddress}</span>
               </div>
            </div>
         </div>

         {/* Prescription Review */}
         {order.hasPrescription && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
               <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Prescription Review</h3>
                    <p className="text-[10px] text-orange-600 font-bold mt-0.5 flex items-center gap-1">
                       <AlertTriangle size={10} /> Validation required
                    </p>
                  </div>
               </div>
               <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200">
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 flex-col gap-2">
                     <FileImagePlaceholder />
                     <span className="text-sm font-medium">prescription_scan.jpg</span>
                  </div>
               </div>
            </div>
         )}

         {/* Requested Items */}
         <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-50 pb-3">
               <h3 className="font-bold text-gray-900 text-sm">Requested Items</h3>
               <span className="font-bold text-indigo-600">{formatCurrency(order.total)}</span>
            </div>
            
            {(order.items || []).map((item: any) => (
              <div key={item.productId} className="pt-2">
                <div className="flex gap-4">
                   <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                      <Package size={20} />
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between">
                         <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</h4>
                         <span className="font-bold text-gray-900 text-sm">{formatCurrency(item.price)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Qty: {item.quantity}</p>
                   </div>
                </div>
              </div>
            ))}
         </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 px-6 flex flex-col gap-4 pb-8 z-20">
         {order.status === 'pending' && !isRejecting && (
           <div className="flex gap-4 w-full">
             <button disabled={processing} onClick={() => setIsRejecting(true)} className="flex-1 min-w-[100px] py-4 border-2 border-red-100 text-red-600 hover:bg-red-50 rounded-2xl font-bold flex items-center justify-center gap-2 transition">
                <X size={18} /> Reject
             </button>
             <button disabled={processing} onClick={() => handleUpdateStatus('preparing')} className="flex-[2] min-w-[150px] py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">
                <CheckCircle size={18} /> Accept Order
             </button>
           </div>
         )}
         
         {isRejecting && (
           <div className="flex flex-col gap-3">
             <label className="text-sm font-bold text-gray-700">Reason for rejection:</label>
             <select 
               className="border border-gray-200 p-3 rounded-xl bg-gray-50 text-sm" 
               value={rejectReason} 
               onChange={(e) => setRejectReason(e.target.value)}
             >
                <option value="">Select a reason</option>
                <option value="Out of stock">Out of stock</option>
                <option value="Invalid prescription">Invalid prescription</option>
                <option value="Store closing soon">Store closing soon</option>
                <option value="other">Other</option>
             </select>
             {rejectReason === 'other' && (
                <input 
                  type="text" 
                  placeholder="Enter reason..." 
                  className="border border-gray-200 p-3 rounded-xl bg-gray-50 text-sm"
                  onChange={(e) => setRejectReason(e.target.value)}
                />
             )}
             <div className="flex gap-3 mt-2">
                <button disabled={processing} onClick={() => setIsRejecting(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">Cancel</button>
                <button disabled={processing || !rejectReason} onClick={() => handleUpdateStatus('rejected')} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-50">Confirm Reject</button>
             </div>
           </div>
         )}
         
         {order.status === 'preparing' && (
           <button disabled={processing} onClick={() => handleUpdateStatus('ready')} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-green-700 transition">
              <CheckCircle size={18} /> Mark as Ready for Delivery
           </button>
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
