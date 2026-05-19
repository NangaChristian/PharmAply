import { ArrowLeft, CheckCircle, Package, Truck, Home, Phone, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";

const truckIcon = new L.DivIcon({
  html: `<div style="background-color: #4f46e5; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 4px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-left: -5px; margin-top: -5px;">
     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3M20 17h2v-9l-3-3h-4v12h3M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const homeIcon = new L.DivIcon({
  html: `<div style="background-color: #f97316; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

export function PatientTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  
  const [truckPos, setTruckPos] = useState<[number, number]>([31.500, 34.450]);
  const destPos: [number, number] = [31.505, 34.465];
  const [eta, setEta] = useState(15);

  useEffect(() => {
    const interval = setInterval(() => {
      setTruckPos((prev) => {
        const dLat = destPos[0] - prev[0];
        const dLng = destPos[1] - prev[1];
        
        // Stop moving if close enough
        if (Math.abs(dLat) < 0.0001 && Math.abs(dLng) < 0.0001) {
            clearInterval(interval);
            setEta(0);
            return destPos;
        }

        const distance = Math.sqrt(dLat * dLat + dLng * dLng);
        // Estimate time: distance * factor
        const estimatedTime = Math.max(1, Math.round(distance * 500));
        setEta(estimatedTime);

        return [
          prev[0] + dLat * 0.1,
          prev[1] + dLng * 0.1
        ];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const statuses = [
    { label: t('order_placed', "Order Placed"), date: t('today', "Today") + " 10:42 AM", completed: true, icon: CheckCircle },
    { label: t('pharmacy_preparing', "Pharmacy Preparing"), date: t('today', "Today") + " 10:45 AM", completed: true, icon: Package },
    { label: t('on_the_way', "On the way"), date: t('estimated', "Estimated") + " 11:20 AM", completed: false, icon: Truck, active: true },
    { label: t('delivered_status', "Delivered"), date: t('pending', "Pending"), completed: false, icon: Home },
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
         <div className="w-full h-64 bg-indigo-100 rounded-3xl overflow-hidden relative border-4 border-white shadow-sm z-0">
            <MapContainer center={[31.51, 34.46]} zoom={14} scrollWheelZoom={false} zoomControl={false} className="w-full h-full z-0 p-0 m-0">
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                
                <Marker position={truckPos} icon={truckIcon}>
                </Marker>
                
                <Marker position={destPos} icon={homeIcon}>
                </Marker>
            </MapContainer>
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-48 bg-white dark:bg-black/95 backdrop-blur-md p-3 rounded-2xl shadow-lg flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                  <Truck size={18} />
               </div>
               <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{t('arriving_in', 'Arriving in')}</p>
                  <p className="font-bold text-indigo-600">{eta > 0 ? `${eta} ${t('mins', 'mins')}` : t('arrived', 'Arrived')}</p>
               </div>
            </div>
         </div>

         {/* Driver Info */}
         <div className="bg-white dark:bg-black p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                   <img src="https://i.pravatar.cc/150?u=b042581f4e29026704z" alt="Driver" className="w-full h-full object-cover" />
               </div>
               <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 dark:text-white text-sm"> {t('ahmed_hassan', 'Ahmed Hassan')} </p>
                    <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200">
                      <CheckCircle size={10} />  {t('verified', 'Verified')} </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('delivery_driver', 'Delivery Driver')}  {t('bull_4_9', '&bull; 4.9')} <Star size={10} className="inline fill-yellow-400 text-yellow-400" /></p>
               </div>
            </div>
            <div className="flex gap-2">
               <button className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center" onClick={() => navigate('/patient/messages/123')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
               </button>
               <button className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                  <Phone size={18} />
               </button>
            </div>
         </div>

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
         <div className="h-8"></div>
      </div>
    </div>
  );
}

 
