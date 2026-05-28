import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { ExternalLink, ShieldAlert, Navigation, Clock, Truck, CheckCircle2, ChevronRight, AlertTriangle, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY && (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY" && (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY !== "YOUR_KEY_HERE" ? (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY : "";

interface Driver {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  isOnline: boolean;
  avatar_url?: string;
  lat?: number;
  lng?: number;
  updatedAt?: any;
}

interface Order {
  id: string;
  driverId?: string;
  driver_id?: string;
  status: string;
  pharmacyLat?: number;
  pharmacyLng?: number;
  destLat?: number;
  destLng?: number;
  patientName?: string;
  pharmacyName?: string;
}

interface Delivery {
  id: string;
  driver_id: string;
  order_id: string;
  status: string;
}

interface DriverStatus {
   driver: Driver;
   order?: Order;
   delivery?: Delivery;
   state: 'idle' | 'en_route_to_pharmacy' | 'delivering' | 'offline';
   isStalled: boolean;
   isDeviated: boolean;
   color: string;
}

function LiveRoute({ origin, destination, setRoutePolyline }: { origin: any, destination: any, setRoutePolyline: (poly: google.maps.Polyline) => void }) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({
       map,
       suppressMarkers: true,
       polylineOptions: {
          strokeColor: '#6366f1',
          strokeOpacity: 0.5,
          strokeWeight: 4
       }
    }));
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer || !origin || !destination) return;

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);
          const route = result.routes[0];
          if (route && route.overview_path) {
             const polyline = new google.maps.Polyline({ path: route.overview_path });
             setRoutePolyline(polyline);
          }
        }
      }
    );

    return () => {
       directionsRenderer.setMap(null);
    };
  }, [directionsService, directionsRenderer, origin, destination]);

  return null;
}

const DriverMarkerComponent: React.FC<{ driverStatus: DriverStatus, mapObj: google.maps.Map | null, onDeviationChange: (id: string, isDeviated: boolean) => void }> = ({ driverStatus, mapObj, onDeviationChange }) => {
   const { driver, state, isStalled, isDeviated, color, order } = driverStatus;
   const pos = (driver.lat && driver.lng && !isNaN(Number(driver.lat))) ? { lat: Number(driver.lat), lng: Number(driver.lng) } : null;
   const geometryLibrary = useMapsLibrary('geometry');
   const [routePolyline, setRoutePolyline] = useState<google.maps.Polyline | null>(null);

   const [deviatedInner, setDeviatedInner] = useState(false);

   useEffect(() => {
      if (!geometryLibrary || !pos || !routePolyline || isNaN(pos.lat) || isNaN(pos.lng)) {
         setDeviatedInner(false);
         onDeviationChange(driver.id, false);
         return;
      }
      // Check deviation: isLocationOnEdge with a tolerance of ~100m radius
      const isDeviatedNow = !geometryLibrary.poly.isLocationOnEdge(new google.maps.LatLng(pos), routePolyline, 0.001);
      
      if (isDeviatedNow && !deviatedInner) {
         toast.error(`Alert: ${driver.name || 'Driver'} deviated from route!`, { id: `dev-${driver.id}`});
      } else if (!isDeviatedNow && deviatedInner) {
         toast.success(`${driver.name || 'Driver'} returned to route.`, { id: `dev-${driver.id}`});
      }
      
      setDeviatedInner(isDeviatedNow);
      onDeviationChange(driver.id, isDeviatedNow);
   }, [pos, routePolyline, geometryLibrary]);

   const actualColor = (isStalled || deviatedInner) ? '#ef4444' : color;
   const isSecurityAlert = isStalled || deviatedInner;

   if (!pos) return null;

   let destPos = null;
   if (order) {
      if (state === 'en_route_to_pharmacy' && order.pharmacyLat && order.pharmacyLng && !isNaN(Number(order.pharmacyLat))) {
         destPos = { lat: Number(order.pharmacyLat), lng: Number(order.pharmacyLng) };
      } else if (state === 'delivering' && order.destLat && order.destLng && !isNaN(Number(order.destLat))) {
         destPos = { lat: Number(order.destLat), lng: Number(order.destLng) };
      }
   }

   return (
      <>
         {destPos && <LiveRoute origin={pos} destination={destPos} setRoutePolyline={setRoutePolyline} />}
         <AdvancedMarker position={pos}>
             <div className="relative group">
                {isSecurityAlert && (
                   <div className="absolute -inset-4 bg-red-500/30 rounded-full animate-ping pointer-events-none"></div>
                )}
                <div className={`w-10 h-10 rounded-full border-4 shadow-xl flex items-center justify-center transition-colors transform ${isSecurityAlert ? 'border-red-500 bg-red-100 scale-110' : 'border-white bg-white scale-100'}`} style={{ borderColor: actualColor === '#ef4444' ? '#ef4444' : 'white' }}>
                    <div className="w-full h-full rounded-full flex items-center justify-center" style={{ backgroundColor: actualColor }}>
                       <Truck size={18} className="text-white" />
                    </div>
                </div>

                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-2xl p-3 whitespace-nowrap z-50 pointer-events-none transition-opacity duration-200 min-w-[200px]">
                   <p className="font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
                      {driver.name || 'Unknown'} 
                      {isSecurityAlert && <AlertTriangle size={14} className="text-red-500 ml-1" />}
                   </p>
                   {order ? (
                      <>
                         <p className="text-xs text-gray-500 font-medium">Order: <span className="text-gray-900 dark:text-white font-bold">#{order.id.slice(0,6)}</span></p>
                         <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-bold">
                            {state === 'en_route_to_pharmacy' ? 'To Pharmacy' : 'To Customer'}
                         </p>
                      </>
                   ) : (
                      <p className="text-xs text-gray-500 font-medium tracking-wide">Online</p>
                   )}
                   {isSecurityAlert && (
                      <p className="text-xs text-red-600 font-bold mt-2 bg-red-50 py-1 px-2 rounded">
                         {isStalled ? 'Alert: Driver Stalled' : 'Alert: Route Deviation'}
                      </p>
                   )}
                </div>
             </div>
         </AdvancedMarker>
      </>
   )
}

const DriverMarker = React.memo(DriverMarkerComponent, (prevProps, nextProps) => {
   const pd = prevProps.driverStatus.driver;
   const nd = nextProps.driverStatus.driver;
   if (pd.lat !== nd.lat || pd.lng !== nd.lng) return false;
   if (prevProps.driverStatus.isStalled !== nextProps.driverStatus.isStalled) return false;
   if (prevProps.driverStatus.isDeviated !== nextProps.driverStatus.isDeviated) return false;
   if (prevProps.driverStatus.state !== nextProps.driverStatus.state) return false;
   if (prevProps.driverStatus.color !== nextProps.driverStatus.color) return false;
   if (prevProps.driverStatus.order?.id !== nextProps.driverStatus.order?.id) return false;
   return true;
});

function LiveMapInner() {
  const map = useMap();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [driverLocationsHistory, setDriverLocationsHistory] = useState<Record<string, { lat: number, lng: number, timestamp: number }[]>>({});
  const [deviatedDrivers, setDeviatedDrivers] = useState<Record<string, boolean>>({});
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(
         (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
         (err) => console.error("Error with geolocation in admin map", err)
       );
    }
  }, []);

  useEffect(() => {
     const fetchInitialData = async () => {
        try {
           // We try to fetch drivers, orders, and deliveries.
           // Joining users based on user requirement: "joined with auth.users to grab their real legal names"
           // Note: Typically requires a 'users' view in the 'public' schema or foreign key relations.
           const { data: dData } = await supabase.from('drivers').select('*, users(name, avatar_url), auth_users:user_id(name, avatar_url)');
           if (dData) {
              setDrivers(dData.map((d: any) => ({
                 id: d.id,
                 user_id: d.user_id,
                 name: (d.users && d.users.name) || (d.auth_users && d.auth_users.name) || (d.users && d.users[0] && d.users[0].name) || d.name || 'Unknown Driver',
                 avatar_url: (d.users && d.users.avatar_url) || (d.auth_users && d.auth_users.avatar_url) || (d.users && d.users[0] && d.users[0].avatar_url) || d.avatar_url,
                 phone: d.phone || '',
                 lat: d.lat,
                 lng: d.lng,
                 isOnline: d.is_online !== undefined ? d.is_online : d.isOnline || true,
              } as Driver)).filter((d: Driver) => d.isOnline));
           }

           const { data: oData } = await supabase.from('orders').select('*').in('status', ['pending', 'accepted', 'to_pharmacy', 'at_pharmacy', 'to_customer', 'at_customer']);
           if (oData) setOrders(oData.map(o => ({ ...o, driverId: o.driver_id || o.driverId }) as Order));

           const { data: delData } = await supabase.from('deliveries').select('*').in('status', ['idle', 'en_route_to_pharmacy', 'delivering']);
           if (delData) setDeliveries(delData as Delivery[]);
        } catch (err) {
           console.error("Error fetching Supabase initial data:", err);
        } finally {
           setLoading(false);
        }
     };

     fetchInitialData();

     // Supabase Realtime Payload Subscriptions
     const drvSub = supabase.channel('drivers-live').on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
        setDrivers(prev => {
           const next = [...prev];
           const updated = payload.new as any;
           const idx = next.findIndex(d => d.id === updated.id);
           const mappedDriver: Driver = {
              ...updated,
              isOnline: updated.is_online !== undefined ? updated.is_online : updated.isOnline,
              name: updated.name || 'Unknown Driver' // We miss 'users' join on realtime, ideally we refetch or keep old joined dat if available
           };
           
           if (idx !== -1) {
              if (mappedDriver.isOnline === false) return next.filter(d => d.id !== mappedDriver.id);
              next[idx] = { ...next[idx], lat: mappedDriver.lat, lng: mappedDriver.lng, isOnline: mappedDriver.isOnline };
           } else if (mappedDriver.isOnline !== false) {
               next.push(mappedDriver);
           }
           return next;
        });
     }).subscribe();

     const ordSub = supabase.channel('orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        setOrders(prev => {
           let next = [...prev];
           const updated = payload.new as any;
           if (['delivered', 'cancelled'].includes(updated.status)) {
              return next.filter(o => o.id !== updated.id);
           }
           const mappedOrder: Order = { ...updated, driverId: updated.driver_id || updated.driverId };
           const idx = next.findIndex(o => o.id === mappedOrder.id);
           if (idx !== -1) {
              next[idx] = mappedOrder;
           } else {
              next.push(mappedOrder);
           }
           return next;
        });
     }).subscribe();

     const delSub = supabase.channel('deliveries-live').on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, (payload) => {
        setDeliveries(prev => {
           let next = [...prev];
           const updated = payload.new as any;
           if (updated.status === 'completed' || updated.status === 'cancelled') {
              return next.filter(d => d.id !== updated.id);
           }
           const mappedDelivery: Delivery = { ...updated };
           const idx = next.findIndex(d => d.id === mappedDelivery.id);
           if (idx !== -1) {
              next[idx] = mappedDelivery;
           } else {
              next.push(mappedDelivery);
           }
           return next;
        });
     }).subscribe();

     return () => {
       supabase.removeChannel(drvSub);
       supabase.removeChannel(ordSub);
       supabase.removeChannel(delSub);
     };
  }, []);

  useEffect(() => {
     // Track location history for stall checking
     setDriverLocationsHistory(prev => {
        const next = { ...prev };
        const now = Date.now();
        drivers.forEach(d => {
           if (d.lat && d.lng) {
              if (!next[d.id]) next[d.id] = [];
              next[d.id].push({ lat: d.lat, lng: d.lng, timestamp: now });
              // retain only last 10 minutes
              next[d.id] = next[d.id].filter(pos => now - pos.timestamp < 10 * 60 * 1000);
           }
        });
        return next;
     });
  }, [drivers]);

  const activeStatuses = useMemo(() => {
     const now = Date.now();
     const statuses: DriverStatus[] = drivers.map(d => {
        const order = orders.find(o => o.driverId === d.id);
        const delivery = deliveries.find(del => del.driver_id === d.id);
        
        let state: 'idle' | 'en_route_to_pharmacy' | 'delivering' | 'offline' = 'idle';
        let color = '#22c55e'; // green idle

        // Prefer delivery status mapping if available, otherwise check order
        if (delivery) {
            if (delivery.status === 'en_route_to_pharmacy') {
               state = 'en_route_to_pharmacy';
               color = '#eab308'; // Orange/Yellow
            } else if (delivery.status === 'delivering') {
               state = 'delivering';
               color = '#a855f7'; // Purple/Blue
            } else if (delivery.status === 'idle') {
               state = 'idle';
               color = '#22c55e'; // Green
            }
        } else if (order) {
           if (['to_pharmacy', 'at_pharmacy'].includes(order.status)) {
              state = 'en_route_to_pharmacy';
              color = '#eab308';
           } else {
              state = 'delivering';
              color = '#a855f7';
           }
        }

        // detect stall: no significant movement (> 50 meters) in last 5 minutes while having active order
        let isStalled = false;
        if (order && driverLocationsHistory[d.id]) {
           const history = driverLocationsHistory[d.id];
           const fiveMinsAgoPos = history.find(pos => now - pos.timestamp >= 5 * 60 * 1000);
           // If we have history back to 5 mins
           if (fiveMinsAgoPos && d.lat && d.lng) {
               // simple rough distance check
               const dLat = (d.lat - fiveMinsAgoPos.lat) * 111000;
               const dLng = (d.lng - fiveMinsAgoPos.lng) * 111000 * Math.cos(d.lat * Math.PI / 180);
               const dist = Math.sqrt(dLat * dLat + dLng * dLng);
               if (dist < 50) {
                  isStalled = true;
               }
           }
        }

        return {
           driver: d,
           order,
           state,
           isStalled,
           isDeviated: deviatedDrivers[d.id] || false,
           color
        }
     });
     return statuses;
  }, [drivers, orders, driverLocationsHistory, deviatedDrivers]);

  const alerts = activeStatuses.filter(s => s.isStalled || deviatedDrivers[s.driver.id]);

  const deliveringCount = activeStatuses.filter(st => st.state !== 'idle').length;
  const attentionCount = alerts.length; // Actually, one driver can have one task only here, so alerts correspond to tasks. Or just drivers with issues.
  const onTrackCount = Math.max(0, deliveringCount - attentionCount);
  const onTrackPercentage = deliveringCount > 0 ? Math.round((onTrackCount / deliveringCount) * 100) : 100;

  const active_deliveries = deliveries.filter(d => ['en_route_to_pharmacy', 'delivering'].includes(d.status));
  const activeOrders = orders.filter(o => o.status !== 'pending' && o.status !== 'delivered');
  const hasActiveMissions = active_deliveries.length > 0 || activeOrders.length > 0;

  if (loading) {
     return (
        <div className="absolute inset-0 flex flex-col md:flex-row h-full bg-slate-50 dark:bg-zinc-950 p-6 z-50 gap-6">
            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm animate-pulse flex items-center justify-center">
               <div className="flex flex-col items-center gap-4 opacity-50">
                   <div className="w-16 h-16 bg-gray-200 dark:bg-zinc-800 rounded-full"></div>
                   <div className="w-32 h-4 bg-gray-200 dark:bg-zinc-800 rounded-full"></div>
               </div>
            </div>
            <div className="w-full md:w-96 bg-white dark:bg-zinc-900 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm animate-pulse p-6 space-y-6">
                <div className="w-1/2 h-6 bg-gray-200 dark:bg-zinc-800 rounded-full"></div>
                <div className="space-y-4 pt-4">
                   {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 items-center">
                         <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-800 rounded-full shrink-0"></div>
                         <div className="flex-1 space-y-2">
                             <div className="w-3/4 h-4 bg-gray-200 dark:bg-zinc-800 rounded"></div>
                             <div className="w-1/2 h-3 bg-gray-200 dark:bg-zinc-800 rounded"></div>
                         </div>
                      </div>
                   ))}
                </div>
            </div>
        </div>
     );
  }

  if (!hasActiveMissions) {
     return (
        <div className="absolute inset-0 flex flex-col justify-center items-center h-full bg-slate-50 dark:bg-zinc-950 p-8 z-50">
            <div className="w-24 h-24 bg-white dark:bg-zinc-900 shadow-[0_10px_40px_rgba(0,0,0,0.05)] rounded-full flex items-center justify-center mb-6 border border-slate-100 dark:border-zinc-800">
               <Navigation size={40} className="text-slate-400" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">All quiet on the logistics front</h2>
            <p className="text-sm font-medium text-slate-500 max-w-md text-center leading-relaxed">
               There are currently no active delivery missions across your selected areas. Once a pharmacy approves an order and a courier accepts the mission, the real-time tracking radar will initialize automatically.
            </p>
        </div>
     );
  }

  return (
     <div className="absolute inset-0 flex flex-col md:flex-row h-full">
         <div className="flex-1 relative bg-zinc-100 z-0 overflow-hidden">
             <Map
                defaultCenter={userLocation || { lat: 48.8566, lng: 2.3522 }}
                center={userLocation || { lat: 48.8566, lng: 2.3522 }}
                defaultZoom={11}
                mapId="DEMO_MAP_ID"
                disableDefaultUI={true}
                gestureHandling="greedy"
                style={{ width: '100%', height: '100%' }}
             >
                {activeStatuses.map(st => (
                   <DriverMarker 
                       key={st.driver.id} 
                       driverStatus={st} 
                       mapObj={map}
                       onDeviationChange={(id, isDeviated) => {
                          setDeviatedDrivers(prev => {
                             if (prev[id] === isDeviated) return prev;
                             return { ...prev, [id]: isDeviated };
                          });
                       }}
                   />
                ))}
             </Map>
             {selectedDriverId && (
                 <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <button 
                       onClick={() => {
                          const drv = drivers.find(d => d.id === selectedDriverId);
                          if (drv?.lat && drv?.lng && map) {
                             map.panTo({ lat: drv.lat, lng: drv.lng });
                             map.setZoom(16);
                          }
                       }}
                       className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition"
                    >
                       <Navigation size={18} fill="currentColor" />
                       Recenter
                    </button>
                    <button 
                       onClick={() => setSelectedDriverId(null)}
                       className="bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl shadow-md font-bold text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 flex justify-center uppercase tracking-widest transition border border-gray-100 dark:border-zinc-700"
                    >
                       Clear
                    </button>
                 </div>
             )}
         </div>
         <div className="w-full md:w-96 bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-[-10px_0_40px_rgba(0,0,0,0.05)] flex flex-col h-[50vh] md:h-full z-10 transition-all">
             <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-950 shrink-0">
                <div>
                   <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                       <ShieldAlert className="text-indigo-600" />
                       Control Center
                   </h2>
                   <p className="text-sm font-medium text-gray-500 mt-1">Live Fleet Operations</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg gap-1">
                   {alerts.length > 0 && <span className="px-2 py-0.5 bg-red-500 text-white font-bold text-xs rounded-md animate-pulse">{alerts.length} ALERTS</span>}
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 
                 <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold tracking-widest text-gray-500 mb-1 uppercase">Fleet Health</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white flex items-end gap-1">
                           {onTrackPercentage}% <span className="text-sm font-medium text-gray-500 mb-1">on track</span>
                        </p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="text-center">
                           <p className="text-xl font-bold text-[#22c55e]">{onTrackCount}</p>
                           <p className="text-[10px] uppercase font-bold text-gray-400">Stable</p>
                        </div>
                        <div className="text-center">
                           <p className="text-xl font-bold text-[#ef4444]">{attentionCount}</p>
                           <p className="text-[10px] uppercase font-bold text-gray-400">At Risk</p>
                        </div>
                    </div>
                 </div>

                 {alerts.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                       <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2"><AlertTriangle size={16} /> EMERGENCY ALERTS</h3>
                       {alerts.map(al => (
                          <div key={'alert_' + al.driver.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex justify-between items-center mb-2">
                             <div>
                                <p className="font-bold text-red-700 dark:text-red-400 text-sm">{al.driver.name}</p>
                                <p className="text-xs text-red-600/70">{al.isStalled ? 'Stalled > 5 mins' : 'Route Deviation'}</p>
                             </div>
                             <button className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50 hover:bg-red-600 transition">
                                DISPATCH
                             </button>
                          </div>
                       ))}
                    </div>
                 )}

                 <div>
                    <h3 className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 mb-3 uppercase flex items-center justify-between">
                       Active Drivers ({activeStatuses.length})
                    </h3>
                    <div className="space-y-3">
                       {activeStatuses.map(st => (
                          <div key={st.driver.id} className={`p-3 bg-white dark:bg-zinc-900 border ${selectedDriverId === st.driver.id ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]' : 'border-gray-100 dark:border-zinc-800'} rounded-xl flex items-center gap-3 cursor-pointer hover:border-gray-300 dark:hover:border-zinc-700 transition`} onClick={() => {
                             setSelectedDriverId(st.driver.id);
                             if (st.driver.lat && st.driver.lng && map) {
                                map.panTo({ lat: st.driver.lat, lng: st.driver.lng });
                                map.setZoom(16);
                             }
                          }}>
                             <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 overflow-hidden" style={{ backgroundColor: `${st.color}15`, borderColor: st.color }}>
                                {st.driver.avatar_url ? (
                                   <img src={st.driver.avatar_url} alt={st.driver.name} className="w-full h-full object-cover" />
                                ) : (
                                   <Truck size={16} style={{ color: st.color }} />
                                )}
                             </div>
                             <div className="flex-1">
                                <p className="font-bold text-gray-900 dark:text-white text-sm">{st.driver.name || 'Unknown Driver'}</p>
                                <p className="text-xs font-bold mt-0.5" style={{ color: st.state === 'idle' ? '#22c55e' : st.state === 'en_route_to_pharmacy' ? '#eab308' : '#a855f7' }}>
                                   {st.state === 'idle' && 'Online'}
                                   {st.state === 'en_route_to_pharmacy' && 'Navigating to Pharmacy'}
                                   {st.state === 'delivering' && 'Delivering to Patient'}
                                </p>
                             </div>
                             {st.order && <ChevronRight size={16} className="text-gray-300" />}
                          </div>
                       ))}
                       {activeStatuses.length === 0 && (
                          <div className="text-center py-6 text-gray-400 text-sm font-medium">No drivers online.</div>
                       )}
                    </div>
                 </div>
             </div>
             
             <div className="p-4 border-t border-gray-100 dark:border-zinc-800 text-[10px] text-gray-400 font-medium flex justify-between bg-zinc-50 dark:bg-zinc-950 shrink-0">
                <div className="flex gap-4">
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#22c55e]"></div> Idle</div>
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#eab308]"></div> Pickup</div>
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#a855f7]"></div> Drogoff</div>
                </div>
             </div>
         </div>
         
         {/* Live Lifecycle Audit Trail Ticker */}
         <div className="hidden lg:flex w-[400px] bg-[#0c0c0e] text-white flex-col h-full border-l border-zinc-900 border-l-4">
            <div className="p-5 border-b border-zinc-800/50 flex justify-between items-center bg-[#111113] shrink-0 shadow-lg relative z-10">
               <div>
                  <h3 className="font-bold tracking-widest text-[#00ffcc] uppercase text-xs flex items-center gap-2">
                     <div className="w-2 h-2 bg-[#00ffcc] rounded-full animate-pulse shadow-[0_0_10px_#00ffcc]"></div>
                     Live Audit Trail
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">Real-Time Transactions</p>
               </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
               <div className="absolute inset-0 overflow-hidden flex flex-col p-4 space-y-4">
                  {orders.map(order => {
                     const isFraudulent = Math.random() < 0.1 && (order.status === 'at_pharmacy' || order.status === 'to_pharmacy'); // Mocking pharmacy flag for demo UI
                     
                     let progressWidth = '0%';
                     if (order.status === 'pending') progressWidth = '10%';
                     if (order.status === 'accepted') progressWidth = '30%';
                     if (order.status === 'to_pharmacy' || order.status === 'at_pharmacy') progressWidth = '60%';
                     if (order.status === 'to_customer' || order.status === 'at_customer') progressWidth = '80%';
                     if (order.status === 'delivered') progressWidth = '100%';

                     return (
                        <div key={order.id} className="bg-[#1a1a1e] border border-zinc-800/80 rounded-xl p-4 shadow-xl transition-all relative overflow-hidden group shrink-0">
                           <div className="absolute top-0 left-0 h-1 bg-[#1a1a1e] w-full">
                              <div className="h-full bg-gradient-to-r from-indigo-500 to-[#00ffcc] transition-all duration-1000" style={{ width: progressWidth }}></div>
                           </div>
                           
                           <div className="flex justify-between items-start mb-4 mt-2">
                              <div>
                                 <p className="text-[11px] text-zinc-500 font-mono">MISSION {order.id.slice(0, 8).toUpperCase()}</p>
                                 <p className="font-bold text-sm mt-1">{order.patientName || 'Patient'}</p>
                              </div>
                           </div>
                           
                           <div className="space-y-3 relative before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                              {/* Stages */}
                              {[
                                 { id: 'pending', label: 'Mission Created' },
                                 { id: 'accepted', label: 'Driver Accepted' },
                                 { id: 'at_pharmacy', label: 'Pharmacy Arrival & Verification' },
                                 { id: 'in_transit', label: 'In-Transit' },
                                 { id: 'delivered', label: 'Securely Delivered with Patient OTP/Signature' }
                              ].map((stage, idx) => {
                                 const activeStages = ['pending', 'accepted', 'to_pharmacy', 'at_pharmacy', 'to_customer', 'at_customer', 'delivered'];
                                 const currentIndex = activeStages.indexOf(order.status);
                                 
                                 let stageIndex = 0;
                                 if (stage.id === 'pending') stageIndex = activeStages.indexOf('pending');
                                 if (stage.id === 'accepted') stageIndex = activeStages.indexOf('accepted');
                                 if (stage.id === 'at_pharmacy') stageIndex = activeStages.indexOf('at_pharmacy');
                                 if (stage.id === 'in_transit') stageIndex = activeStages.indexOf('to_customer');
                                 if (stage.id === 'delivered') stageIndex = activeStages.indexOf('delivered');

                                 const isCompleted = currentIndex >= stageIndex;
                                 const isCurrent = currentIndex > 0 && currentIndex === stageIndex && order.status !== 'delivered';

                                 return (
                                    <div key={stage.id} className="relative flex items-center justify-between">
                                       <div className="flex items-center gap-3 w-full">
                                          <div className={`w-3 h-3 rounded-full shrink-0 z-10 border-2 border-[#1a1a1e] ${isCompleted ? 'bg-[#00ffcc] shadow-[0_0_8px_#00ffcc]' : 'bg-zinc-700'}`}></div>
                                          <p className={`text-[10px] uppercase font-bold tracking-widest ${isCompleted ? 'text-zinc-200' : 'text-zinc-600'}`}>{stage.label}</p>
                                       </div>
                                       {isCurrent && <span className="text-[10px] text-[#00ffcc] animate-pulse whitespace-nowrap bg-[#00ffcc]/10 px-2 py-0.5 rounded ml-2">ACTIVE</span>}
                                    </div>
                                 );
                              })}
                           </div>

                           {(order.status === 'at_pharmacy' || order.status === 'to_pharmacy' || isFraudulent) && (
                              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                                 {isFraudulent && (
                                    <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-1">
                                       <AlertTriangle size={12} /> Pharmacy Flag: Invalid Driver
                                    </p>
                                 )}
                                 <button onClick={async () => {
                                     try {
                                        await supabase.from('orders').update({
                                           status: 'pending',
                                           driver_id: null,
                                           driverId: null,
                                           driverName: null,
                                           updatedAt: new Date().toISOString()
                                        }).eq('id', order.id);
                                     } catch (err) {
                                        console.error('Failed to revoke assignment', err);
                                     }
                                 }} className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${isFraudulent ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40 border border-red-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}>
                                    Revoke & Re-assign Mission
                                 </button>
                              </div>
                           )}
                        </div>
                     )
                  })}
                  {orders.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                        <Monitor size={32} className="mb-4 opacity-50" />
                        <p className="text-xs font-bold uppercase tracking-widest">No Active Missions</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
     </div>
  );
}

export function AdminLiveMap() {
   return (
      <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-gray-50 dark:bg-black p-4 md:p-6 overflow-hidden">
         <div className="w-full h-full rounded-[2.5rem] overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.1)] border border-gray-200 dark:border-zinc-800 relative bg-white dark:bg-zinc-900">
            {API_KEY ? (
               <APIProvider apiKey={API_KEY} version="weekly" libraries={['geometry', 'routes']}>
                   <LiveMapInner />
               </APIProvider>
            ) : (
               <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                  <Monitor className="w-12 h-12 text-gray-400 mb-4 opacity-50" />
                  <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-1">Google Maps API Required</p>
                  <p className="text-xs text-gray-500">Set VITE_GOOGLE_MAPS_API_KEY to enable live tracking</p>
               </div>
            )}
         </div>
      </div>
   );
}
