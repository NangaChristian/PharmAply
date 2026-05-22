import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Bell, MapPin, Clock, DollarSign, CheckCircle, Navigation, Menu, Power, X } from "lucide-react";
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';

import { useTranslation } from "react-i18next";

export function DeliveryHome() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;
    if (isOnline) {
      try {
        const q = query(collection(db, 'orders'), where('status', '==', 'ready'));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setOrders(fetched);
          if (fetched.length > 0 && !currentRequest) {
             setCurrentRequest(fetched[0]);
          } else if (fetched.length === 0) {
             setCurrentRequest(null);
          }
        }, (err) => {
          console.error(err);
        });
      } catch (error) {
        console.error(error);
      }
    } else {
       setCurrentRequest(null);
       setOrders([]);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOnline]);

  const handleAcceptOrder = async () => {
    if (!currentRequest || !user) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', currentRequest.id), { status: 'driver_assigned', driverId: user.uid });
      setProcessing(false);
      navigate(`/delivery/order/${currentRequest.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${currentRequest.id}`);
      setProcessing(false);
    }
  };

  const handleRejectOrder = () => {
     // In a real app we'd mark this driver as rejected for this order, 
     // but here we just hide it and show the next one or wait.
     const nextOrders = orders.filter(o => o.id !== currentRequest?.id);
     setOrders(nextOrders);
     if (nextOrders.length > 0) {
        setCurrentRequest(nextOrders[0]);
     } else {
        setCurrentRequest(null);
     }
  };

  return (
    <div className="flex-1 bg-slate-100 flex flex-col relative pb-16 h-full overflow-hidden">
      
      {/* Fake Map Background */}
      <div className="absolute inset-0 z-0 bg-[#e5e3df] overflow-hidden">
         {/* Map Grid Pattern */}
         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
         {/* Roads Pattern */}
         <div className="absolute top-1/3 left-0 right-0 h-4 bg-white dark:bg-black opacity-40 transform -skew-y-12"></div>
         <div className="absolute top-1/2 left-0 right-0 h-6 bg-white dark:bg-black opacity-40 transform skew-y-6"></div>
         <div className="absolute top-0 bottom-0 left-1/3 w-6 bg-white dark:bg-black opacity-40 transform skew-x-12"></div>
         
         {/* Driver Location Marker */}
         {isOnline && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
               <div className="w-24 h-24 bg-indigo-500/20 rounded-full absolute animate-ping"></div>
               <div className="w-12 h-12 bg-indigo-500/10 rounded-full absolute animate-pulse"></div>
               <div className="w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-lg z-10 flex items-center justify-center">
                  <Navigation size={12} className="text-white fill-current transform rotate-45" />
               </div>
            </div>
         )}
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-12 z-10 flex items-start justify-between">
         <div className="bg-white dark:bg-black/90 backdrop-blur shadow-sm rounded-2xl p-2 flex items-center gap-3 pr-4 pointer-events-auto cursor-pointer" onClick={() => navigate('/delivery/profile')}>
            <div className="w-10 h-10 bg-indigo-100 rounded-full overflow-hidden flex items-center justify-center text-indigo-600 shrink-0">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt={user.displayName || 'Driver'} className="w-full h-full object-cover" />
               ) : (
                 user?.displayName ? <span className="font-bold text-sm">{user.displayName[0].toUpperCase()}</span> : <User size={18} />
               )}
            </div>
            <div>
               <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{userData?.name || user?.displayName || t('driver', 'Driver')}</p>
               <p className="text-[10px] text-gray-500 font-medium"> {formatCurrency(124.50)} {t('today_s_earnings', 'Today\'s earnings')} </p>
            </div>
         </div>
         
         <div className="flex flex-col gap-2 pointer-events-auto">
            <button className="w-12 h-12 bg-white dark:bg-black/90 backdrop-blur rounded-2xl shadow-sm flex items-center justify-center text-gray-700 hover:bg-white dark:bg-black transition relative">
               <Bell size={20} />
               <span className="w-2.5 h-2.5 bg-red-500 rounded-full absolute top-3 right-3 border-2 border-white"></span>
            </button>
         </div>
      </div>

      {/* Status Overlay */}
      {isOnline && !currentRequest && (
         <div className="absolute top-36 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-lg animate-fade-in whitespace-nowrap">
             {t('searching_for_orders', 'Searching for orders...')} </div>
      )}

      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-auto px-6 pb-20 pt-4 bg-gradient-to-t from-white via-white/90 to-transparent">
         {!isOnline ? (
            <div className="bg-white dark:bg-black rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-zinc-800 transform transition-all duration-300 translate-y-0">
               <h2 className="font-bold text-gray-900 dark:text-white text-xl text-center mb-2"> {t('you_re_offline', 'You\'re Offline')} </h2>
               <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm text-center mb-6"> {t('go_online_to_start_receiving_d', 'Go online to start receiving delivery requests')} </p>
               <button 
                  onClick={() => setIsOnline(true)}
                  className="w-full bg-indigo-600 border border-indigo-700 shadow-indigo-200 shadow-lg text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition flex justify-center items-center gap-2 text-lg uppercase tracking-wide"
               >
                  <Power size={22} className="mr-1" />  {t('go_online', 'Go Online')} </button>
            </div>
         ) : !currentRequest ? (
            <div className="bg-white dark:bg-black rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-zinc-800 transform transition-all duration-300 translate-y-0 flex flex-col items-center text-center">
               <div className="w-16 h-1 bg-gray-200 rounded-full mb-6"></div>
               <h2 className="font-bold text-indigo-600 text-xl mb-1"> {t('you_re_online', 'You\'re Online')} </h2>
               <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mb-6"> {t('waiting_for_the_next_delivery_', 'Waiting for the next delivery request...')} </p>
               
               <button 
                  onClick={() => setIsOnline(false)}
                  className="w-full bg-gray-100 dark:bg-zinc-900 text-gray-600 font-bold py-4 rounded-2xl hover:bg-gray-200 transition text-sm uppercase tracking-wide"
               >
                   {t('go_offline', 'Go Offline')} </button>
            </div>
         ) : (
            <div className="bg-white dark:bg-black rounded-3xl overflow-hidden shadow-2xl border border-indigo-100 transform transition-all duration-300 translate-y-0 relative animate-slide-up">
               {/* Progress bar timer mock */}
               <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-100 dark:bg-zinc-900">
                  <div className="h-full bg-indigo-600 animate-shrink-x" style={{ animationDuration: '30s', transformOrigin: 'left' }}></div>
               </div>
               
               <div className="p-6">
                  <div className="flex justify-between items-start mb-6 pt-2">
                     <div>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block"> {t('new_delivery', 'New Delivery')} </span>
                        <h2 className="font-bold text-gray-900 dark:text-white text-3xl tracking-tight">{formatCurrency(currentRequest.total)} <span className="text-sm text-gray-400 dark:text-gray-500 font-medium tracking-normal"> {t('tips', '+ tips')} </span></h2>
                     </div>
                     <div className="flex bg-gray-50 dark:bg-black rounded-xl p-2 items-center gap-2">
                        <Clock size={16} className="text-gray-400 dark:text-gray-500" />
                        <div className="font-bold text-gray-700 text-sm"> {t('12_min', '~ 12 min')} </div>
                     </div>
                  </div>

                  <div className="relative pl-6 space-y-5 mb-8">
                     <div className="absolute left-[9px] top-[4px] bottom-[4px] w-0.5 bg-gray-200"></div>
                     <div className="relative">
                        <div className="w-5 h-5 bg-indigo-600 rounded-full absolute -left-6 top-0 border-4 border-white flex items-center justify-center shadow-sm">
                           <div className="w-1 h-1 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Pickup (0.5 km away)</p>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">{currentRequest.pharmacyId.slice(0, 16)}  {t('pharmacy', 'Pharmacy')} </p>
                     </div>
                     <div className="relative">
                        <div className="w-5 h-5 bg-green-500 rounded-full absolute -left-6 top-0 border-4 border-white flex items-center justify-center shadow-sm">
                           <div className="w-1 h-1 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Drop-off (3.2 km distance)</p>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">{currentRequest.deliveryAddress || 'Customer Address'}</p>
                     </div>
                  </div>

                  <div className="flex gap-3">
                     <button 
                        disabled={processing}
                        onClick={handleRejectOrder}
                        className="w-16 h-16 shrink-0 bg-gray-100 dark:bg-zinc-900 text-gray-600 border border-gray-200 dark:border-zinc-800 font-bold rounded-2xl hover:bg-gray-200 transition flex justify-center items-center"
                        aria-label="Reject Request"
                     >
                        <X size={24} />
                     </button>
                     <button 
                        disabled={processing}
                        onClick={handleAcceptOrder}
                        className="flex-1 bg-indigo-600 shadow-indigo-300 shadow-xl text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition flex justify-center items-center gap-2 text-xl"
                     >
                        {processing ? 'Accepting...' : 'Accept'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
      
      

    </div>
  );
}
