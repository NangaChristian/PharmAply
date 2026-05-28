import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Bell, MapPin, Clock, DollarSign, CheckCircle, Navigation, Menu, Power, X, Moon, Sun, Layers, Star, AlertTriangle } from "lucide-react";
import { collection, query, where, getDocs, onSnapshot, updateDoc, doc, setDoc, addDoc, serverTimestamp } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useDarkMode } from "../../components/DarkModeProvider";
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { RouteDisplay } from './RouteDisplay';
import { NotificationBell } from "../../components/NotificationBell";

const rawApiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY || '';
const API_KEY = rawApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' || rawApiKey === 'YOUR_KEY_HERE' ? '' : rawApiKey;

export function DeliveryHome() {
  const [mapType, setMapType] = useState('roadmap');
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [isOnline, setIsOnline] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [todaysEarnings, setTodaysEarnings] = useState(0);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [driverPos, setDriverPos] = useState({ lat: 48.8566, lng: 2.3522 }); // Fallback location
  
  useEffect(() => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(
         (position) => {
           setDriverPos({ lat: position.coords.latitude, lng: position.coords.longitude });
         },
         (error) => console.error('Error getting initial location', error)
       );
    }
  }, []);

  useEffect(() => {
     let unsub: () => void;
     if (user) {
        unsub = onSnapshot(doc(db, 'drivers', user.uid), (snap) => {
           if (snap.exists()) {
              const data = snap.data();
              setIsOnline(data.isOnline || false);
              setDriverProfile(data);
           }
        });
     }
     return () => { if (unsub) unsub(); }
  }, [user]);

  useEffect(() => {
    if (!isOnline || !user) return;
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setDriverPos({ lat: latitude, lng: longitude });
        try {
          await updateDoc(doc(db, 'drivers', user.uid), {
             lat: latitude,
             lng: longitude,
             updatedAt: serverTimestamp()
          });
          // Also update active orders if we have current request, or any out_for_delivery orders
          if (currentRequest) {
            await updateDoc(doc(db, 'orders', currentRequest.id), {
               driverLat: latitude,
               driverLng: longitude
            });
          }
        } catch(e) {}
      },
      (error) => { console.error('Error watching location', error); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, user, currentRequest]);

  useEffect(() => {
    let unsubscribe: () => void;
    if (user && isOnline) {
      try {
        const q = query(collection(db, 'orders'), where('status', '==', 'ready'), where('deliveryMethod', '==', 'delivery'));
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
  }, [isOnline, user]);

  useEffect(() => {
    const fetchEarnings = async () => {
       if (!user) return;
       try {
          const startOfDay = new Date();
          startOfDay.setHours(0,0,0,0);
          
          // Using JS filtering if timestamp query requires complex indices
          const q = query(collection(db, 'orders'), where('driverId', '==', user.uid), where('status', '==', 'delivered'));
          const snapshot = await getDocs(q);
          const earned = snapshot.docs.reduce((acc, doc) => {
             const data = doc.data();
             const dateStr = data.deliveredAt || data.createdAt;
             if (dateStr) {
                const date = new Date(dateStr);
                if (date >= startOfDay) {
                   return acc + ((data.total || 0) * 0.1); 
                }
             }
             return acc;
          }, 0);
          setTodaysEarnings(earned);
       } catch(e) { console.error(e); }
    };
    fetchEarnings();
  }, [user]);

  const toggleOnlineStatus = async (status: boolean) => {
     if (!user) return;
     setIsOnline(status);
     try {
        await setDoc(doc(db, 'drivers', user.uid), { isOnline: status }, { merge: true });
     } catch (err) { console.error("Error updating online status", err); }
  };

  const handleAcceptOrder = async () => {
    if (!currentRequest || !user) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', currentRequest.id), { 
         status: 'driver_assigned', 
         driverId: user.uid, 
         driverName: userData?.name || user.displayName || 'Driver',
         acceptedAt: new Date().toISOString() 
      });
      
      try {
         await addDoc(collection(db, 'notifications'), {
           userId: currentRequest.patientId,
           type: 'driver_assigned',
           title: 'Driver Assigned',
           message: `${userData?.name || user.displayName || 'A driver'} is heading to the pharmacy.`,
           isRead: false,
           relatedId: currentRequest.id,
           createdAt: serverTimestamp()
         });
      } catch (e) {
         console.warn("Could not notify patient", e);
      }
      
      setProcessing(false);
      navigate(`/delivery/order/${currentRequest.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${currentRequest.id}`);
      setProcessing(false);
    }
  };

  const handleRejectOrder = () => {
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
      
      {/* Map Background */}
      <div className="absolute inset-0 z-0 bg-[#e5e3df] overflow-hidden">
         {API_KEY ? (
            <APIProvider apiKey={API_KEY} version="weekly">
               <Map
                 defaultCenter={driverPos}
                 center={driverPos}
                 defaultZoom={15}
                 mapId="DEMO_MAP_ID"
                 disableDefaultUI={true}
                 mapTypeId={mapType}
                 internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                 style={{ width: '100%', height: '100%' }}
               >
                  {isOnline && (
                    <AdvancedMarker position={driverPos}>
                      <div className="flex flex-col items-center justify-center">
                         <div className="w-16 h-16 bg-indigo-500/20 rounded-full absolute animate-ping"></div>
                         <div className="w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-lg z-10 flex items-center justify-center">
                            <Navigation size={12} className="text-white fill-current transform rotate-45" />
                         </div>
                      </div>
                    </AdvancedMarker>
                  )}
                  {isOnline && currentRequest && (
                     <RouteDisplay 
                         origin={driverPos} 
                         destination={currentRequest.pharmacyAddress || currentRequest.pharmacyName || 'Pharmacy'}
                     />
                  )}
               </Map>
            </APIProvider>
         ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
               <MapPin className="w-8 h-8 text-gray-400 mb-2 opacity-50" />
               <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Map Unavailable</p>
            </div>
         )}
      </div>

      {/* Map Toggle FAB */}
      <div className="absolute top-32 right-6 z-10">
         <button 
           onClick={() => setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap')}
           className="w-10 h-10 bg-white dark:bg-black rounded-full shadow-lg flex items-center justify-center border border-gray-100 dark:border-zinc-800"
         >
           <Layers size={20} className="text-gray-700 dark:text-gray-300" />
         </button>
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-12 z-10 flex items-start justify-between">
         <div className="bg-white dark:bg-black/90 backdrop-blur shadow-sm rounded-2xl p-2 flex items-center gap-3 pr-4 pointer-events-auto cursor-pointer" onClick={() => navigate('/delivery/profile')}>
            <div className="w-10 h-10 bg-indigo-100 rounded-full overflow-hidden flex items-center justify-center text-indigo-600 shrink-0 relative">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt={user.displayName || 'Driver'} className="w-full h-full object-cover" />
               ) : (
                 user?.displayName ? <span className="font-bold text-sm">{user.displayName[0].toUpperCase()}</span> : <User size={18} />
               )}
            </div>
            <div>
               <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{userData?.name || user?.displayName || t('driver', 'Driver')}</p>
                  <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5"><Star size={10} className="fill-current"/> 5.0</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                   {driverProfile?.vehicleType === 'car' ? t('car', 'CAR') : (driverProfile?.vehicleType === 'motorcycle' ? t('moto', 'MOTO') : t('vehicle', 'VEHICLE'))}
                 </span>
                 <p className="text-[11px] text-gray-500 font-bold tracking-widest uppercase"> 
                   {driverProfile?.vehiclePlate || 'NO PLATE'} 
                 </p>
               </div>
            </div>
         </div>
         
         <div className="flex flex-row gap-2 pointer-events-auto">
            <div className="bg-white dark:bg-black/90 backdrop-blur rounded-2xl shadow-sm px-3 flex flex-col items-center justify-center text-gray-900 dark:text-white relative font-bold text-sm">
               <span className="text-[10px] text-gray-400 font-medium tracking-wide uppercase uppercase">Today</span>
               {formatCurrency(todaysEarnings)}
            </div>
            <NotificationBell />
         </div>
      </div>

      {/* KYC Warning Banner */}
      {driverProfile?.status === 'pending_verification' && (
         <div className="absolute top-32 left-6 right-20 z-10 bg-orange-500 text-white p-3 rounded-2xl shadow-lg flex items-start gap-3 pointer-events-auto animate-in slide-in-from-top-4">
             <AlertTriangle size={20} className="shrink-0 mt-0.5" />
             <div className="text-xs">
                <span className="font-bold block text-sm mb-0.5">Action Required</span>
                Your KYC profile is pending verification. Going online is restricted.
             </div>
         </div>
      )}

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
                  onClick={() => toggleOnlineStatus(true)}
                  disabled={driverProfile?.status === 'pending_verification'}
                  className="w-full bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed border border-indigo-700 disabled:border-indigo-300 shadow-indigo-200 shadow-lg text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 disabled:hover:bg-indigo-300 transition flex justify-center items-center gap-2 text-lg uppercase tracking-wide"
               >
                  <Power size={22} className="mr-1" />  {t('go_online', 'Go Online')} </button>
            </div>
         ) : !currentRequest ? (
            <div className="bg-white dark:bg-black rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-zinc-800 transform transition-all duration-300 translate-y-0 flex flex-col items-center text-center">
               <div className="w-16 h-1 bg-gray-200 rounded-full mb-6"></div>
               <h2 className="font-bold text-indigo-600 text-xl mb-1"> {t('you_re_online', 'You\'re Online')} </h2>
               <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mb-6"> {t('waiting_for_the_next_delivery_', 'Waiting for the next delivery request...')} </p>
               
               <button 
                  onClick={() => toggleOnlineStatus(false)}
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
                        <div className="font-bold text-gray-700 text-sm"> {t('calculating', 'Calculating...')} </div>
                     </div>
                  </div>

                  <div className="relative pl-6 space-y-5 mb-8">
                     <div className="absolute left-[9px] top-[4px] bottom-[4px] w-0.5 bg-gray-200"></div>
                     <div className="relative">
                        <div className="w-5 h-5 bg-indigo-600 rounded-full absolute -left-6 top-0 border-4 border-white flex items-center justify-center shadow-sm">
                           <div className="w-1 h-1 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Pickup</p>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5">{currentRequest.pharmacyName || t('pharmacy', 'Pharmacy')} </p>
                     </div>
                     <div className="relative">
                        <div className="w-5 h-5 bg-green-500 rounded-full absolute -left-6 top-0 border-4 border-white flex items-center justify-center shadow-sm">
                           <div className="w-1 h-1 bg-white dark:bg-black rounded-full"></div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Drop-off</p>
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
