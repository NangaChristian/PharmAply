import { useState, useEffect } from "react";
import { Package, MapPin, Phone, Camera, CheckCircle, Navigation, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { RouteDisplay } from './RouteDisplay';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";

const rawApiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY || '';
const API_KEY = rawApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' || rawApiKey === 'YOUR_KEY_HERE' ? '' : rawApiKey;

type DeliveryStatus = 'to_pharmacy' | 'at_pharmacy' | 'to_customer' | 'at_customer' | 'completed';

export function DeliveryActive() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DeliveryStatus>('to_pharmacy');
  const [proofUploaded, setProofUploaded] = useState(false);

  useEffect(() => {
    let watchId: number;
    let unsubscribe: () => void;

    const fetchActiveOrder = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'orders'), where('driverId', '==', user.uid), where('status', '==', 'driver_assigned'));
        const snapshot = await getDocs(q);
        // We will ALSO check 'out_for_delivery' if order was updated recently. Let's do 'in' since status can change.
        // Actually since we only use 'getDocs' we should probably use onSnapshot so the delivery side stays synced if something changes
        const activeQ = query(collection(db, 'orders'), where('driverId', '==', user.uid), where('status', 'in', ['driver_assigned', 'out_for_delivery']));
        unsubscribe = onSnapshot(activeQ, (snap) => {
           if (!snap.empty) {
             setOrder({ id: snap.docs[0].id, ...snap.docs[0].data() });
             if (snap.docs[0].data().status === 'out_for_delivery') {
                setStatus(snap.docs[0].data().deliveryStage || 'to_pharmacy');
             }
           } else {
             setOrder(null);
           }
        });
      } catch (error) {
         console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveOrder();

    // Start watching location
    if (navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(
          async (position) => {
             const { latitude, longitude } = position.coords;
             if (order?.id) {
                try {
                   await updateDoc(doc(db, 'orders', order.id), {
                      driverLocation: { lat: latitude, lng: longitude }
                   });
                } catch (e) {
                   console.error("Failed to update location", e);
                }
             }
          },
          (err) => console.warn(err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
       );
    }

    return () => {
       if (watchId) navigator.geolocation.clearWatch(watchId);
       if (unsubscribe) unsubscribe();
    };
  }, [user, order?.id]);

  const handleNextStatus = async () => {
    if (!order) return;
    let nextStage = status;
    let newStatus = order.status;

    switch (status) {
      case 'to_pharmacy':
        nextStage = 'at_pharmacy';
        newStatus = 'out_for_delivery';
        break;
      case 'at_pharmacy':
        nextStage = 'to_customer';
        break;
      case 'to_customer':
        nextStage = 'at_customer';
        break;
      case 'at_customer':
        if (proofUploaded) {
          nextStage = 'completed';
          newStatus = 'delivered';
        }
        break;
    }

    try {
        await updateDoc(doc(db, 'orders', order.id), {
           status: newStatus,
           deliveryStage: nextStage
        });
        setStatus(nextStage);
        if (nextStage === 'completed') {
           setTimeout(() => navigate('/delivery'), 1500);
        }
    } catch(error) {
        handleFirestoreError(error, OperationType.UPDATE, 'orders');
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

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"> {t('loading_active_delivery', 'Loading active delivery...')} </div>;
  if (!order) return <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-black text-gray-500"> {t('no_active_delivery', 'No active delivery')} </div>;

  const currentStep = status === 'to_pharmacy' ? 1 : (status === 'at_pharmacy' ? 1 : (status === 'to_customer' ? 2 : (status === 'at_customer' ? 2 : 3)));

  return (
    <div className="flex-1 bg-white dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black sticky top-0 z-20 shadow-sm border-b border-gray-100 dark:border-zinc-800">
         <div className="flex items-center gap-2">
           <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center -ml-2 text-gray-900 dark:text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
           </button>
           <h1 className="font-bold text-gray-900 dark:text-white text-lg">Delivery Progress</h1>
         </div>
         <div className="text-gray-900 dark:text-white font-bold p-2 bg-gray-100 rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 space-y-8">
         
         {/* Progress Steps */}
         <div className="flex items-center justify-between relative px-2 mb-2">
            <div className="absolute left-[38px] right-[38px] top-6 h-0.5 bg-gray-100 dark:bg-zinc-800 -z-10">
               <div className="h-full bg-[#1a3b8d] dark:bg-indigo-500 transition-all duration-500" style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}></div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
               <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Pickup</div>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors shadow-sm ${currentStep >= 1 ? 'bg-gray-900 dark:bg-indigo-600 text-white' : 'bg-white dark:bg-black border-2 border-gray-100 dark:border-zinc-800 text-gray-400'}`}>
                  1
               </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
               <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">En Route</div>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors shadow-sm ${currentStep >= 2 ? 'bg-gray-900 dark:bg-indigo-600 text-white' : 'bg-white dark:bg-black border-2 border-gray-100 dark:border-zinc-800 text-gray-400'}`}>
                  2
               </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
               <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Complete</div>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-colors shadow-sm ${currentStep >= 3 ? 'bg-green-600 dark:bg-green-500 text-white' : 'bg-white dark:bg-black border-2 border-gray-100 dark:border-zinc-800 text-gray-400'}`}>
                  3
               </div>
            </div>
         </div>

         {/* Pickup Card */}
         <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Pickup</div>
            <div className={`rounded-[1.5rem] p-5 shadow-sm border transition-colors ${currentStep === 1 ? 'bg-[#f5f6fc] border-[#e8ecf8] dark:bg-zinc-900 dark:border-zinc-800' : 'bg-white dark:bg-black border-gray-100 dark:border-zinc-800'}`}>
               <h3 className="font-bold text-gray-900 dark:text-white text-[19px] mb-1">{order.pharmacyName || 'Pharmacy name'}</h3>
               <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">{order.pharmacyAddress || 'From: Pharmacy location, Pharmacy Number To: Patient location, Patient Number'}</p>
               
               <div className="flex items-center gap-4 mb-6">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center"><MapPin size={12} className="mr-1" /> distance</span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center"><Clock size={12} className="mr-1" /> time</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">$ Visa Payment</span>
               </div>
               
               <div className="flex gap-3">
                  <button 
                     onClick={handleNextStatus}
                     disabled={currentStep > 1}
                     className={`flex-1 font-bold py-3.5 rounded-xl text-sm transition-colors ${currentStep === 1 ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg' : 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
                  >
                     <CheckCircle size={16} className="inline mr-2 -mt-0.5" /> Mark as pickup
                  </button>
                  <button className="bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white font-bold py-3.5 px-6 rounded-xl text-sm hover:opacity-80 transition flex items-center">
                     <MapPin size={16} className="inline mr-1" /> location
                  </button>
               </div>
            </div>
         </div>

         {/* Deliver To Card */}
         <div className={currentStep < 2 ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Deliver to</div>
            <div className={`rounded-[1.5rem] p-5 shadow-sm border transition-colors ${currentStep === 2 ? 'bg-[#f5f6fc] border-[#e8ecf8] dark:bg-zinc-900 dark:border-zinc-800' : 'bg-white dark:bg-black border-gray-100 dark:border-zinc-800'}`}>
               <h3 className="font-bold text-gray-900 dark:text-white text-[19px] mb-1">{order.patientName || 'Patient name'}</h3>
               <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">{order.deliveryAddress || 'Patient location'}</p>
               
               <div className="flex items-center gap-4 mb-4">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center"><MapPin size={12} className="mr-1" /> distance</span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center"><Clock size={12} className="mr-1" /> time</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">$ Visa Payment</span>
               </div>
               
               <div className="bg-white dark:bg-black border border-gray-100 dark:border-zinc-800 p-3 rounded-xl mb-6">
                  <div className="flex items-center gap-2 mb-1">
                     <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">!</span>
                     <span className="text-xs font-bold text-gray-900 dark:text-white">Delivery Instructions</span>
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 pl-6">"Leave at door."</p>
               </div>
               
               {currentStep === 2 && !proofUploaded && (
                 <button 
                   onClick={() => setProofUploaded(true)}
                   className="w-full bg-gray-50 dark:bg-black border-2 border-dashed border-gray-200 dark:border-zinc-800 py-6 mb-6 rounded-xl flex flex-col items-center justify-center gap-2 text-indigo-600 hover:bg-gray-100 dark:bg-zinc-900 transition"
                 >
                   <Camera size={24} />
                   <span className="font-bold text-sm"> {t('take_photo', 'Take Photo of Delivery')} </span>
                 </button>
               )}

               <div className="flex gap-3">
                  <button 
                     onClick={handleNextStatus}
                     disabled={currentStep > 2 || (currentStep === 2 && !proofUploaded)}
                     className={`flex-1 font-bold py-3.5 rounded-xl text-sm transition-colors ${currentStep === 2 && proofUploaded ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg' : 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
                  >
                     <CheckCircle size={16} className="inline mr-2 -mt-0.5" /> Mark as delivery
                  </button>
                  <button className="bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white font-bold py-3.5 px-6 rounded-xl text-sm hover:opacity-80 transition flex items-center">
                     <MapPin size={16} className="inline mr-1" /> location
                  </button>
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}
