import { useState, useEffect } from "react";
import { Package, MapPin, Phone, Camera, CheckCircle, Navigation } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';

type DeliveryStatus = 'to_pharmacy' | 'at_pharmacy' | 'to_customer' | 'at_customer' | 'completed';

export function DeliveryActive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DeliveryStatus>('to_pharmacy');
  const [proofUploaded, setProofUploaded] = useState(false);

  useEffect(() => {
    const fetchActiveOrder = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'orders'), where('driverId', '==', user.uid), where('status', '==', 'driver_assigned'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setOrder({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        }
      } catch (error) {
         console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveOrder();
  }, [user]);

  const handleNextStatus = async () => {
    switch (status) {
      case 'to_pharmacy':
        setStatus('at_pharmacy');
        break;
      case 'at_pharmacy':
        setStatus('to_customer');
        break;
      case 'to_customer':
        setStatus('at_customer');
        break;
      case 'at_customer':
        if (proofUploaded && order) {
          try {
             await updateDoc(doc(db, 'orders', order.id), { status: 'delivered' });
             setStatus('completed');
             setTimeout(() => navigate('/delivery'), 1500);
          } catch(error) {
             handleFirestoreError(error, OperationType.UPDATE, 'orders');
          }
        }
        break;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'to_pharmacy': return 'Heading to Pharmacy';
      case 'at_pharmacy': return 'Pick up Order';
      case 'to_customer': return 'Heading to Customer';
      case 'at_customer': return 'Deliver Order';
      case 'completed': return 'Delivery Completed!';
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'to_pharmacy': return 'Arrived at Pharmacy';
      case 'at_pharmacy': return 'Confirm Pickup';
      case 'to_customer': return 'Arrived at Drop-off';
      case 'at_customer': return 'Complete Delivery';
      case 'completed': return 'Done';
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500">Loading active delivery...</div>;
  if (!order) return <div className="flex-1 flex items-center justify-center bg-slate-50 text-gray-500">No active delivery</div>;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className={`px-6 pt-12 pb-6 shadow-sm z-10 text-white rounded-b-[2rem] transition-colors ${status === 'completed' ? 'bg-green-600' : 'bg-indigo-600'}`}>
         <h1 className="font-bold text-xl mb-1">{getStatusText()}</h1>
         <p className="text-white/80 text-sm">Order #{order.id.slice(0, 8)}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Order details context */}
         <div className="bg-white border-2 border-indigo-100 rounded-2xl p-5 shadow-sm shadow-indigo-100/50">
            <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-4">
               <div>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold tracking-wide uppercase">
                    {status === 'to_pharmacy' || status === 'at_pharmacy' ? 'Pickup' : 'Drop-off'}
                  </span>
                  <h2 className="font-bold text-gray-900 mt-2 line-clamp-1">
                    {status === 'to_pharmacy' || status === 'at_pharmacy' ? `Pharmacy: ${order.pharmacyId}` : `Customer: ${order.patientId}`}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {status === 'to_pharmacy' || status === 'at_pharmacy' ? 'Local Pharmacy' : order.deliveryAddress}
                  </p>
               </div>
               <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Package size={24} />
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                     <Navigation size={16} className="text-gray-400" />
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                     <div>
                        <p className="font-bold text-gray-900 mt-0.5">Navigate</p>
                     </div>
                     <button className="bg-indigo-100 text-indigo-700 p-2 rounded-full">
                        <Navigation size={16} className="fill-current" />
                     </button>
                  </div>
               </div>
               
               <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                     <Phone size={16} className="text-gray-400" />
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Contact</p>
                        <p className="font-bold text-gray-900 mt-0.5">Call System</p>
                     </div>
                     <button className="bg-green-100 text-green-700 p-2 rounded-full">
                        <Phone size={16} className="fill-current" />
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Proof of Delivery (only at customer) */}
         {status === 'at_customer' && (
           <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
             <h3 className="font-bold text-gray-900 mb-2">Proof of Delivery</h3>
             <p className="text-xs text-gray-500 mb-4">Please take a photo of the package at the door.</p>
             
             {!proofUploaded ? (
               <button 
                 onClick={() => setProofUploaded(true)}
                 className="w-full bg-gray-50 border-2 border-dashed border-gray-200 py-8 rounded-xl flex flex-col items-center gap-2 text-indigo-600 hover:bg-gray-100 transition"
               >
                 <Camera size={32} />
                 <span className="font-bold text-sm">Take Photo</span>
               </button>
             ) : (
               <div className="bg-green-50 text-green-700 border border-green-200 py-6 rounded-xl flex flex-col items-center gap-2">
                 <CheckCircle size={32} />
                 <span className="font-bold text-sm">Proof Uploaded</span>
               </div>
             )}
           </div>
         )}
         
         {status === 'completed' && (
            <div className="bg-white rounded-2xl p-8 border border-green-100 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                 <CheckCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Delivery Successful!</h2>
              <p className="text-gray-500 mt-2">You earned <span className="font-bold text-green-600">$3.00</span></p>
            </div>
         )}

         {/* Actions */}
         <div className="mt-8">
             <button 
               className={`w-full text-white font-bold text-lg py-5 rounded-2xl shadow-xl transition-all ${
                 (status === 'at_customer' && !proofUploaded) 
                   ? 'bg-gray-300 shadow-none cursor-not-allowed' 
                   : status === 'completed' 
                   ? 'bg-green-600 shadow-green-200' 
                   : 'bg-slate-900 shadow-slate-200 hover:bg-slate-800'
               }`}
               onClick={handleNextStatus}
               disabled={status === 'at_customer' && !proofUploaded}
             >
                {getButtonText()}
             </button>
         </div>
         <div className="h-8"></div>
      </div>
    </div>
  );
}
