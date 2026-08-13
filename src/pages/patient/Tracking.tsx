import { ArrowLeft, CheckCircle, Package, Truck, Home, Phone, Star, User, FileText, Printer } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { doc, onSnapshot, db } from '../../lib/firebase';
import { formatCurrency, parseDate } from '../../lib/utils';
import { InvoiceModal } from '../../components/InvoiceModal';
import { printInvoice } from '../../lib/invoice';

const driverLeafletIcon = L.divIcon({
  className: 'custom-driver-marker',
  html: `
    <div style="
      width: 40px;
      height: 40px;
      background: #4f46e5;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 16px rgba(79,70,229,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const destLeafletIcon = L.divIcon({
  className: 'custom-patient-marker',
  html: `
    <div style="
      width: 40px;
      height: 40px;
      background: #ea580c;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 16px rgba(234,88,12,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

export function PatientTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  
  const [order, setOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [truckPos, setTruckPos] = useState<[number, number]>([48.8566, 2.3522]); // Fallback to Paris
  const [eta, setEta] = useState(15);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
          if (truckPos[0] === 48.8566 && truckPos[1] === 2.3522) {
             setTruckPos(loc);
          }
        },
        (error) => {
          console.warn("User location unavailable in tracking:", error?.message || "Permission denied");
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, []);

  const destPos: [number, number] = (order?.destLat && order?.destLng && !isNaN(Number(order.destLat)) && Number(order.destLat) !== 48.8566) 
    ? [Number(order.destLat), Number(order.destLng)]
    : order?.deliveryLocation 
      ? [order.deliveryLocation.lat, order.deliveryLocation.lng]
      : userLocation || [4.0511, 9.7679]; // Douala default fallback if geolocation fails

  useEffect(() => {
    if (!id) return;
    
    // Listen to order updates
    const unsubscribe = onSnapshot(doc(db, 'orders', id), (snapshot) => {
       if (snapshot.exists()) {
          const data = snapshot.data();
          setOrder(data);
          let lat = data.driverLat || data.driverLocation?.lat;
          let lng = data.driverLng || data.driverLocation?.lng;
          if (lat && lng && !isNaN(Number(lat)) && Number(lat) !== 48.8566) {
             setTruckPos([Number(lat), Number(lng)]);
          }
       }
       setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!order?.driverId) return;
    const unsub = onSnapshot(doc(db, 'drivers', order.driverId), (docObj) => {
       if (docObj.exists()) {
          const driverData = docObj.data();
          setDriver({ id: docObj.id, ...driverData });
          if (driverData.lat && driverData.lng && !isNaN(Number(driverData.lat)) && Number(driverData.lat) !== 48.8566) {
             setTruckPos([Number(driverData.lat), Number(driverData.lng)]);
          }
       }
    });
    return () => unsub();
  }, [order?.driverId]);

  useEffect(() => {
    if (truckPos[0] !== 48.8566) { // Assuming 48.8566 is default and wait until updated
       const R = 6371; // Radius of the earth in km
       const dLat = (destPos[0] - truckPos[0]) * Math.PI / 180;
       const dLng = (destPos[1] - truckPos[1]) * Math.PI / 180;
       const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(truckPos[0] * Math.PI / 180) * Math.cos(destPos[0] * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2); 
       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
       const distance = R * c; // Distance in km

       // Assume average speed 40 km/h -> distance / 40 hours -> distance / 40 * 60 minutes
       let estimatedTime = Math.round((distance / 40) * 60);
       if(estimatedTime < 1) estimatedTime = 1;
       
       if (distance < 0.05 || order.status === 'delivered') { // within 50m
          setEta(0);
       } else {
          setEta(estimatedTime);
       }
    }
  }, [truckPos, order?.status, destPos[0], destPos[1]]);

   const isPickup = order?.deliveryMethod === 'pickup';

  const getTimelineDate = (type: string) => {
    if (!order) return "";
    
    const extractDate = (dateField: any) => {
      const parsed = parseDate(dateField);
      if (!parsed) return "";
      return parsed.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    if (type === 'placed') return extractDate(order.createdAt) || t('today', "Today");
    if (type === 'preparing') return extractDate(order.preparedAt || order.acceptedAt) || (['preparing', 'driver_assigned', 'out_for_delivery', 'ready', 'ready_for_pickup', 'delivered'].includes(order.status) ? "Processing..." : "");
    if (type === 'out') return extractDate(order.dispatchedAt || order.outForDeliveryAt) || (['driver_assigned', 'out_for_delivery', 'delivered'].includes(order.status) ? "Dispatched" : "");
    if (type === 'ready') return extractDate(order.readyAt) || (['ready', 'ready_for_pickup', 'delivered'].includes(order.status) ? "Ready" : "");
    if (type === 'delivered') return extractDate(order.deliveredAt) || (order.status === 'delivered' ? (isPickup ? "Picked up" : "Delivered") : t('pending', "Pending"));

    return "";
  };

  const statuses = isPickup ? [
    { label: t('order_placed_status', "Commande passée"), date: getTimelineDate('placed'), completed: true, icon: CheckCircle },
    { label: t('pharmacy_preparing_status', "Préparation par la pharmacie"), date: getTimelineDate('preparing'), completed: ['preparing', 'ready_for_pickup', 'ready', 'delivered'].includes(order?.status), active: order?.status === 'pending', icon: Package },
    { label: t('ready_for_pickup_status', "Ready for Pickup at Pharmacy"), date: getTimelineDate('ready'), completed: order?.status === 'delivered' || order?.status === 'ready' || order?.status === 'ready_for_pickup', active: order?.status === 'preparing', icon: Home },
    { label: t('picked_up_status', "Picked Up"), date: order?.status === 'delivered' ? getTimelineDate('delivered') : t('pending', "Pending"), completed: order?.status === 'delivered', icon: CheckCircle },
  ] : [
    { label: t('order_placed_status', "Commande passée"), date: getTimelineDate('placed'), completed: true, icon: CheckCircle },
    { label: t('pharmacy_preparing_status', "Préparation par la pharmacie"), date: getTimelineDate('preparing'), completed: ['preparing', 'driver_assigned', 'out_for_delivery', 'delivered'].includes(order?.status), active: order?.status === 'pending', icon: Package },
    { label: t('on_the_way_status', "En route"), date: eta > 0 ? t('estimated', "Estimated") + ` ${eta} ${t('mins', 'mins')}` : getTimelineDate('out'), completed: order?.status === 'delivered', active: ['driver_assigned', 'out_for_delivery'].includes(order?.status), icon: Truck },
    { label: t('delivered_status', "Delivered"), date: order?.status === 'delivered' ? getTimelineDate('delivered') : t('pending', "Pending"), completed: order?.status === 'delivered', icon: Home },
  ];

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10">
         <button onClick={() => navigate('/patient')} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full">
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-sm">{t('delivery_status', 'Delivery Status')}</h1>
         <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Live Map Tracking */}
         {!isPickup && order && ['driver_assigned', 'en_route_to_pharmacy', 'delivering', 'out_for_delivery', 'en_route', 'delivered'].includes(order.status) && (
           <div className="w-full h-72 bg-slate-900 rounded-3xl overflow-hidden relative border-4 border-white dark:border-zinc-800 shadow-md z-0">
             <MapContainer
               center={truckPos}
               zoom={14}
               zoomControl={false}
               style={{ width: '100%', height: '100%' }}
             >
               <TileLayer
                 url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                 maxZoom={19}
               />
               <Marker position={truckPos} icon={driverLeafletIcon} />
               <Marker position={destPos} icon={destLeafletIcon} />
               <Polyline positions={[truckPos, destPos]} color="#4f46e5" weight={5} opacity={0.8} dashArray="6, 10" />
             </MapContainer>

             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-48 bg-white/95 dark:bg-black/95 backdrop-blur-md p-3 rounded-2xl shadow-lg flex items-center gap-3 border border-gray-100 dark:border-zinc-800">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                   <Truck size={18} />
                </div>
                <div>
                   <p className="font-bold text-gray-900 dark:text-white text-xs">{t('arriving_in', 'Arriving in')}</p>
                   <p className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">{eta > 0 ? `${eta} ${t('mins', 'mins')}` : t('arrived', 'Arrived')}</p>
                </div>
             </div>
           </div>
         )}
         
         {!isPickup && (!order || ['pending', 'preparing', 'ready'].includes(order.status)) && (
            <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
               <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full shadow-sm flex items-center justify-center mb-4">
                  <Truck className="w-8 h-8 text-gray-400 dark:text-gray-500" />
               </div>
               <h3 className="font-bold text-gray-900 dark:text-white">{t('awaiting_driver_assignment', 'Awaiting driver assignment')}</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-[250px]">{t('driver_assignment_desc', 'We are preparing your order. A map will appear here once a driver is assigned.')}</p>
            </div>
         )}

         {isPickup && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900 p-6 rounded-3xl flex flex-col items-center justify-center text-center">
               <Home className="w-12 h-12 text-indigo-600 mb-2" />
               <h3 className="font-bold text-indigo-900 dark:text-indigo-100">{['ready_for_pickup', 'ready'].includes(order?.status) ? t('head_to_pharmacy', 'Head to the pharmacy for pickup') : t('store_pickup', 'Store Pickup')}</h3>
               <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">{['ready_for_pickup', 'ready'].includes(order?.status) ? t('pickup_ready_desc', 'Your order is ready to be picked up. Please show your ID at the counter.') : t('pickup_instructions', 'You will be notified when your order is ready to be picked up from the pharmacy.')}</p>
            </div>
         )}

         {/* Driver Info */}
         {!isPickup && (order && order.driverId ? (
            <div className="bg-white dark:bg-black p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                      {driver?.photoUrl ? (
                         <img src={driver.photoUrl} alt="Driver" className="w-full h-full object-cover" />
                      ) : (
                         <User size={24} className="text-gray-400" />
                      )}
                  </div>
                  <div>
                     <div className="flex items-center gap-2">
                       <p className="font-bold text-gray-900 dark:text-white text-sm"> {driver?.name || t('ahmed_hassan', 'Driver')} </p>
                       <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200">
                         <CheckCircle size={10} />  {t('verified', 'Verified')} </span>
                     </div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {driver?.vehicleDetails?.model || driver?.vehicleDetails?.plate || driver?.vehicleDetails?.type || t('delivery_driver', 'Delivery Driver')}  {t('bull_4_9', '&bull;')} {driver?.rating !== undefined ? driver.rating : 'New'} <Star size={10} className="inline fill-yellow-400 text-yellow-400" />
                     </p>
                  </div>
               </div>
               <div className="flex gap-2">
                  <button className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center" onClick={() => navigate(`/patient/messages/${order.id}`)}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </button>
                  {driver && (driver.phone || driver.phoneNumber) && (
                     <button className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center" onClick={() => window.location.href = `tel:${driver.phone || driver.phoneNumber}`}>
                        <Phone size={18} />
                     </button>
                  )}
               </div>
            </div>
         ) : (
            <div className="bg-white dark:bg-black p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center shadow-sm">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 animate-pulse rounded-full overflow-hidden"></div>
                  <div>
                     <p className="font-bold text-gray-900 dark:text-white text-sm"> {t('waiting_for_driver', 'Waiting for a driver...')} </p>
                     <p className="text-xs text-gray-400">Order is being processed</p>
                  </div>
               </div>
            </div>
         ))}

         {/* Timeline */}
         <div className="bg-white dark:bg-black p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-6">{t('order_status', 'Order #{{id}} Status').replace('{{id}}', id || '1123')}</h3>
            <div className="space-y-6 relative">
               <div className="absolute left-[15px] top-[20px] bottom-[20px] w-0.5 bg-gray-100 dark:bg-zinc-900"></div>
               {statuses.map((status, index) => {
                 const Icon = status.icon;
                 return (
                   <div key={index} className="flex gap-4 relative z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm ${
                        status.completed ? 'bg-indigo-600 text-white' : 
                        status.active ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-gray-500'
                      }`}>
                         <Icon size={14} className={status.completed ? 'fill-current opacity-80' : ''} />
                      </div>
                      <div className="pt-1.5 flex-1 flex justify-between items-start">
                         <div>
                            <p className={`font-bold text-sm ${status.active || status.completed ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>{status.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{status.date}</p>
                         </div>
                      </div>
                   </div>
                 )
               })}
            </div>
         </div>

         {/* Order Details */}
         {order && order.items && order.items.length > 0 && (
           <div className="bg-white dark:bg-black p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">{t('order_details', 'Order Details')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInvoiceModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#194B4B]/10 hover:bg-[#194B4B]/20 text-[#194B4B] dark:text-teal-400 rounded-xl text-xs font-bold transition"
                  >
                    <FileText size={14} /> Facture
                  </button>
                  <button
                    onClick={() => printInvoice(order)}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl transition"
                    title="Imprimer la facture"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-3 mb-4">
                 {order.items.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                       <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {item.quantity}x {item.name || item.productId}
                       </span>
                       <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(item.price * item.quantity)}
                       </span>
                    </div>
                 ))}
                 
                 {/* Substitute Items (if any) */}
                 {order.substituteItems && order.substituteItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                       <h4 className="text-xs font-bold text-indigo-600 mb-2">{t('substitutes', 'Substitutes')}</h4>
                       {order.substituteItems.map((item: any, index: number) => (
                          <div key={`sub-${index}`} className="flex justify-between items-center text-sm">
                             <span className="text-indigo-700 dark:text-indigo-400 font-medium">
                                {item.quantity}x {item.name}
                             </span>
                             <span className="font-bold text-indigo-900 dark:text-indigo-300">
                                {formatCurrency(item.price * item.quantity)}
                             </span>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-zinc-800">
                 <span className="font-bold text-gray-500 dark:text-gray-400">{t('total', 'Total')}</span>
                 <span className="font-black text-gray-900 dark:text-white text-lg">{formatCurrency(Number(order.total || 0))}</span>
              </div>
           </div>
         )}

         {order && (
           <InvoiceModal
             isOpen={showInvoiceModal}
             onClose={() => setShowInvoiceModal(false)}
             order={order}
           />
         )}
         <div className="h-8"></div>
      </div>
    </div>
  );
}

 
