import { useState, useEffect } from "react";
import { Package, MapPin, Phone, Camera, CheckCircle, Navigation } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { RouteDisplay } from './RouteDisplay';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

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

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('loading_active_delivery', 'Loading active delivery...')} </div>;
  if (!order) return <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-black text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('no_active_delivery', 'No active delivery')} </div>;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className={`px-6 pt-12 pb-6 shadow-sm z-10 text-white rounded-b-[2rem] transition-colors ${status === 'completed' ? 'bg-green-600' : 'bg-indigo-600'}`}>
         <h1 className="font-bold text-xl mb-1">{getStatusText()}</h1>
         <p className="text-white/80 text-sm"> {t('order', 'Order #')} {order.id.slice(0, 8)}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Live Map wrapper */}
         <div className="bg-indigo-100 rounded-3xl overflow-hidden relative border border-gray-100 shadow-sm h-48">
             <APIProvider apiKey={API_KEY} version="weekly">
                 <Map
                   defaultCenter={{ lat: 31.500, lng: 34.450 }}
                   center={order.driverLocation ? { lat: order.driverLocation.lat, lng: order.driverLocation.lng } : { lat: 31.500, lng: 34.450 }}
                   defaultZoom={14}
                   mapId="DEMO_MAP_ID"
                   disableDefaultUI={true}
                   internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                   style={{ width: '100%', height: '100%' }}
                 >
                   {order.driverLocation && (
                     <AdvancedMarker position={{ lat: order.driverLocation.lat, lng: order.driverLocation.lng }}>
                       <Pin background="#4f46e5" glyphColor="#fff" borderColor="#fff" />
                     </AdvancedMarker>
                   )}
                   {order.driverLocation && (
                      <RouteDisplay 
                        origin={{ lat: order.driverLocation.lat, lng: order.driverLocation.lng }} 
                        destination={status === 'to_pharmacy' || status === 'at_pharmacy' ? (order.pharmacyAddress || 'Pharmacy') : (order.deliveryAddress || 'Customer')} 
                      />
                   )}
                 </Map>
             </APIProvider>
         </div>

         {/* Order details context */}
         <div className="bg-white dark:bg-black border-2 border-indigo-100 rounded-2xl p-5 shadow-sm shadow-indigo-100/50">
            <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-4">
               <div>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold tracking-wide uppercase">
                    {status === 'to_pharmacy' || status === 'at_pharmacy' ? 'Pickup' : 'Drop-off'}
                  </span>
                  <h2 className="font-bold text-gray-900 dark:text-white mt-2 line-clamp-1">
                    {status === 'to_pharmacy' || status === 'at_pharmacy' ? (order.pharmacyName || t('pharmacy', 'Pharmacy')) : (order.patientName || t('customer', 'Customer'))}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mt-1">
                    {status === 'to_pharmacy' || status === 'at_pharmacy' ? (order.pharmacyAddress || 'Local Pharmacy') : order.deliveryAddress}
                  </p>
               </div>
               <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                  <Package size={24} />
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-black flex items-center justify-center shrink-0">
                     <Navigation size={16} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                     <div>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5"> {t('navigate', 'Navigate')} </p>
                     </div>
                     <button className="bg-indigo-100 text-indigo-700 p-2 rounded-full">
                        <Navigation size={16} className="fill-current" />
                     </button>
                  </div>
               </div>
               
               <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-black flex items-center justify-center shrink-0">
                     <Phone size={16} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                     <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide font-semibold"> {t('contact', 'Contact')} </p>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5"> {t('customer', 'Customer')} </p>
                     </div>
                     <div className="flex gap-2">
                        <button className="bg-indigo-100 text-indigo-700 p-2 rounded-full" onClick={() => navigate(`/patient/messages/${order.id}`)}>
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        <button className="bg-green-100 text-green-700 p-2 rounded-full" onClick={() => window.location.href = `tel:${order?.patientPhone || ''}`}>
                           <Phone size={16} className="fill-current" />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Proof of Delivery (only at customer) */}
         {status === 'at_customer' && (
           <div className="bg-white dark:bg-black rounded-2xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm text-center">
             <h3 className="font-bold text-gray-900 dark:text-white mb-2"> {t('proof_of_delivery', 'Proof of Delivery')} </h3>
             <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4"> {t('please_take_a_photo_of_the_pac', 'Please take a photo of the package at the door.')} </p>
             
             {!proofUploaded ? (
               <button 
                 onClick={() => setProofUploaded(true)}
                 className="w-full bg-gray-50 dark:bg-black border-2 border-dashed border-gray-200 dark:border-zinc-800 py-8 rounded-xl flex flex-col items-center gap-2 text-indigo-600 hover:bg-gray-100 dark:bg-zinc-900 transition"
               >
                 <Camera size={32} />
                 <span className="font-bold text-sm"> {t('take_photo', 'Take Photo')} </span>
               </button>
             ) : (
               <div className="bg-green-50 text-green-700 border border-green-200 py-6 rounded-xl flex flex-col items-center gap-2">
                 <CheckCircle size={32} />
                 <span className="font-bold text-sm"> {t('proof_uploaded', 'Proof Uploaded')} </span>
               </div>
             )}
           </div>
         )}
         
         {status === 'completed' && (
            <div className="bg-white dark:bg-black rounded-2xl p-8 border border-green-100 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                 <CheckCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white"> {t('delivery_successful', 'Delivery Successful!')} </h2>
              <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2"> {t('you_earned', 'You earned')} <span className="font-bold text-green-600">{formatCurrency(3)}</span></p>
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
