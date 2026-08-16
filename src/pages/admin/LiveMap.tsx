import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { MapContainer, TileLayer, Marker, Polyline, useMap as useLeafletMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { 
  ExternalLink, ShieldAlert, Navigation, Clock, Truck, CheckCircle2, 
  ChevronRight, AlertTriangle, Monitor, Bike, Store, User, MapPin, 
  Activity, Radio, RefreshCw, AlertOctagon, Phone, Layers
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../lib/utils';

// --- TYPES ---
interface Driver {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  isOnline: boolean;
  avatar_url?: string;
  lat?: number;
  lng?: number;
  vehicle_type?: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  updatedAt?: any;
}

interface Order {
  id: string;
  driverId?: string;
  driver_id?: string;
  driverName?: string;
  status: string;
  pharmacyLat?: number;
  pharmacyLng?: number;
  pharmacyName?: string;
  destLat?: number;
  destLng?: number;
  patientName?: string;
  deliveryAddress?: string;
  total?: number;
  createdAt?: any;
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

// Leaflet Map Marker Generators
const createDriverIcon = (color: string, isAlert: boolean) => {
  return L.divIcon({
    className: 'custom-admin-driver-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${isAlert ? '<div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
        <div style="
          width: 40px;
          height: 40px;
          background: ${color};
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18.5" cy="17.5" r="3.5"/>
            <circle cx="5.5" cy="17.5" r="3.5"/>
            <circle cx="15" cy="5" r="1"/>
            <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
};

const pharmacyIcon = L.divIcon({
  className: 'custom-admin-pharma-marker',
  html: `
    <div style="
      width: 36px;
      height: 36px;
      background: #194B4B;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 18px rgba(25, 75, 75, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
        <path d="M2 7h20"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const patientIcon = L.divIcon({
  className: 'custom-admin-patient-marker',
  html: `
    <div style="
      width: 34px;
      height: 34px;
      background: #ea580c;
      border: 2.5px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 18px rgba(234, 88, 12, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

function LeafletMapAutoCenter({ center }: { center: [number, number] }) {
  const map = useLeafletMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export function AdminLiveMap() {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [driverLocationsHistory, setDriverLocationsHistory] = useState<Record<string, { lat: number, lng: number, timestamp: number }[]>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'alert' | 'delivering' | 'idle'>('all');
  const [loading, setLoading] = useState(true);

  // Default Center (Douala, Cameroun)
  const defaultCenter: [number, number] = [4.0511, 9.7679];

  // 1. Initial Data Fetching from Supabase
  const fetchData = async () => {
    try {
      // Drivers
      const { data: dData, error: dErr } = await supabase
        .from('drivers')
        .select('*');

      if (!dErr && dData) {
        setDrivers(dData.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          name: d.name || d.full_name || 'Livreur',
          phone: d.phone || d.phone_number || '',
          avatar_url: d.avatar_url || d.photo_url,
          lat: d.lat || d.latitude,
          lng: d.lng || d.longitude,
          vehicle_type: d.vehicle_type || 'Moto',
          vehicle_plate: d.vehicle_plate || 'LT ---',
          vehicle_model: d.vehicle_model || 'Moto Express',
          isOnline: d.is_online !== undefined ? Boolean(d.is_online) : true,
        })));
      }

      // Active Orders
      const { data: oData, error: oErr } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'accepted', 'approved', 'preparing', 'ready', 'driver_assigned', 'to_pharmacy', 'at_pharmacy', 'out_for_delivery', 'to_customer', 'delivering']);

      if (!oErr && oData) {
        setOrders(oData.map((o: any) => ({
          id: o.id,
          driverId: o.driver_id || o.driverId,
          driver_id: o.driver_id || o.driverId,
          driverName: o.driver_name || o.driverName,
          status: o.status,
          pharmacyLat: o.pharmacy_lat || o.pharmacyLat,
          pharmacyLng: o.pharmacy_lng || o.pharmacyLng,
          pharmacyName: o.pharmacy_name || o.pharmacyName,
          destLat: o.dest_lat || o.destLat || o.deliveryLocation?.lat,
          destLng: o.dest_lng || o.destLng || o.deliveryLocation?.lng,
          patientName: o.patient_name || o.patientName || o.customerName,
          deliveryAddress: o.delivery_address || o.deliveryAddress,
          total: o.total,
          createdAt: o.created_at || o.createdAt,
        })));
      }

      // Deliveries
      const { data: delData } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['idle', 'en_route_to_pharmacy', 'delivering']);

      if (delData) {
        setDeliveries(delData as Delivery[]);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des données de supervision:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 2. Real-time subscriptions with Supabase Realtime Channels
    const driverLocSub = supabase
      .channel('admin-driver-locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        const updated = payload.new as any;
        if (!updated || !updated.driver_id) return;

        setDrivers(prev => prev.map(d => {
          if (d.id === updated.driver_id || d.user_id === updated.driver_id) {
            return {
              ...d,
              lat: updated.latitude,
              lng: updated.longitude,
              isOnline: updated.is_online !== undefined ? Boolean(updated.is_online) : d.isOnline,
            };
          }
          return d;
        }));
      })
      .subscribe();

    const drvSub = supabase
      .channel('admin-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
        const updated = payload.new as any;
        if (!updated) return;

        setDrivers(prev => {
          const idx = prev.findIndex(d => d.id === updated.id);
          const mapped: Driver = {
            id: updated.id,
            user_id: updated.user_id,
            name: updated.name || updated.full_name || 'Livreur',
            phone: updated.phone || updated.phone_number || '',
            avatar_url: updated.avatar_url || updated.photo_url,
            lat: updated.lat || updated.latitude,
            lng: updated.lng || updated.longitude,
            vehicle_type: updated.vehicle_type || 'Moto',
            vehicle_plate: updated.vehicle_plate || 'LT ---',
            vehicle_model: updated.vehicle_model || 'Moto Express',
            isOnline: updated.is_online !== undefined ? Boolean(updated.is_online) : true,
          };

          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...mapped };
            return next;
          }
          return [...prev, mapped];
        });
      })
      .subscribe();

    const ordSub = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as any;
        if (!updated) return;

        setOrders(prev => {
          if (['delivered', 'cancelled'].includes(updated.status)) {
            return prev.filter(o => o.id !== updated.id);
          }
          const mapped: Order = {
            id: updated.id,
            driverId: updated.driver_id || updated.driverId,
            driver_id: updated.driver_id || updated.driverId,
            driverName: updated.driver_name || updated.driverName,
            status: updated.status,
            pharmacyLat: updated.pharmacy_lat || updated.pharmacyLat,
            pharmacyLng: updated.pharmacy_lng || updated.pharmacyLng,
            pharmacyName: updated.pharmacy_name || updated.pharmacyName,
            destLat: updated.dest_lat || updated.destLat,
            destLng: updated.dest_lng || updated.destLng,
            patientName: updated.patient_name || updated.patientName,
            deliveryAddress: updated.delivery_address || updated.deliveryAddress,
            total: updated.total,
            createdAt: updated.created_at || updated.createdAt,
          };
          const idx = prev.findIndex(o => o.id === mapped.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = mapped;
            return next;
          }
          return [...prev, mapped];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(driverLocSub);
      supabase.removeChannel(drvSub);
      supabase.removeChannel(ordSub);
    };
  }, []);

  // 3. Location History for Stalled Movement Detection (> 5 mins stationary with active order)
  useEffect(() => {
    const now = Date.now();
    setDriverLocationsHistory(prev => {
      const next = { ...prev };
      drivers.forEach(d => {
        if (d.lat && d.lng && !isNaN(Number(d.lat)) && !isNaN(Number(d.lng))) {
          if (!next[d.id]) next[d.id] = [];
          next[d.id].push({ lat: Number(d.lat), lng: Number(d.lng), timestamp: now });
          // Conserver les 10 dernières minutes
          next[d.id] = next[d.id].filter(p => now - p.timestamp < 10 * 60 * 1000);
        }
      });
      return next;
    });
  }, [drivers]);

  // 4. Compute Comprehensive Driver Statuses
  const driverStatuses: DriverStatus[] = useMemo(() => {
    const now = Date.now();
    return drivers.map(d => {
      const order = orders.find(o => o.driverId === d.id || o.driver_id === d.id);
      const delivery = deliveries.find(del => del.driver_id === d.id);

      let state: 'idle' | 'en_route_to_pharmacy' | 'delivering' | 'offline' = 'idle';
      let color = '#10b981'; // Vert Émeraude (Disponible)

      if (!d.isOnline) {
        state = 'offline';
        color = '#94a3b8';
      } else if (order) {
        if (['to_pharmacy', 'at_pharmacy', 'preparing', 'ready'].includes(order.status)) {
          state = 'en_route_to_pharmacy';
          color = '#f59e0b'; // Jaune / Ambre (Approche Pharmacie)
        } else if (['out_for_delivery', 'to_customer', 'delivering'].includes(order.status)) {
          state = 'delivering';
          color = '#6366f1'; // Indigo / Bleu (En cours vers Patient)
        }
      } else if (delivery) {
        if (delivery.status === 'en_route_to_pharmacy') {
          state = 'en_route_to_pharmacy';
          color = '#f59e0b';
        } else if (delivery.status === 'delivering') {
          state = 'delivering';
          color = '#6366f1';
        }
      }

      // Détection d'immobilisme critique (> 5 mins sans bouger avec commande active)
      let isStalled = false;
      if (order && driverLocationsHistory[d.id] && d.lat && d.lng) {
        const history = driverLocationsHistory[d.id];
        const fiveMinsAgo = history.find(p => now - p.timestamp >= 5 * 60 * 1000);
        if (fiveMinsAgo) {
          const dLat = (d.lat - fiveMinsAgo.lat) * 111000;
          const dLng = (d.lng - fiveMinsAgo.lng) * 111000 * Math.cos(d.lat * Math.PI / 180);
          const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);
          if (distMeters < 40) {
            isStalled = true;
          }
        }
      }

      return {
        driver: d,
        order,
        delivery,
        state,
        isStalled,
        isDeviated: false,
        color: isStalled ? '#ef4444' : color
      };
    });
  }, [drivers, orders, deliveries, driverLocationsHistory]);

  // Summary Metrics
  const activeAlerts = driverStatuses.filter(s => s.isStalled);
  const deliveringDrivers = driverStatuses.filter(s => s.state === 'delivering' || s.state === 'en_route_to_pharmacy');
  const idleDrivers = driverStatuses.filter(s => s.state === 'idle');
  const fleetHealth = deliveringDrivers.length > 0
    ? Math.round(((deliveringDrivers.length - activeAlerts.length) / deliveringDrivers.length) * 100)
    : 100;

  // Filtered driver list for sidebar
  const filteredStatuses = driverStatuses.filter(s => {
    if (selectedFilter === 'alert') return s.isStalled;
    if (selectedFilter === 'delivering') return s.state === 'delivering' || s.state === 'en_route_to_pharmacy';
    if (selectedFilter === 'idle') return s.state === 'idle';
    return true;
  });

  const selectedDriver = driverStatuses.find(s => s.driver.id === selectedDriverId);
  const activeMapCenter: [number, number] = (selectedDriver?.driver.lat && selectedDriver?.driver.lng)
    ? [Number(selectedDriver.driver.lat), Number(selectedDriver.driver.lng)]
    : defaultCenter;

  // Action: Révoquer et réassigner une mission
  const handleRevokeMission = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'ready',
          driver_id: null,
          driverId: null,
          driverName: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;
      toast.success("Mission révoquée. La commande est remise en file d'attribution.");
      fetchData();
    } catch (err: any) {
      toast.error("Erreur lors de la révocation: " + (err.message || "Échec"));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-slate-50 dark:bg-zinc-950 p-4 md:p-6 overflow-hidden">
      
      {/* Top Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-4 shrink-0">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">Flotte Active</p>
            <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-0.5">{drivers.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#194B4B]/10 text-[#194B4B] dark:text-teal-400 flex items-center justify-center font-black">
            <Bike size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">En Livraison</p>
            <p className="text-xl font-extrabold text-[#194B4B] dark:text-teal-400 mt-0.5">{deliveringDrivers.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
            <Radio size={20} className="animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">Disponibles</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{idleDrivers.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">Alertes Stagnation</p>
            <p className={`text-xl font-extrabold mt-0.5 ${activeAlerts.length > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {activeAlerts.length}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${activeAlerts.length > 0 ? 'bg-red-500 text-white animate-bounce' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'}`}>
            <AlertOctagon size={20} />
          </div>
        </div>
      </div>

      {/* Main Map + Sidebars Layout */}
      <div className="flex-1 flex flex-col lg:flex-row rounded-3xl overflow-hidden border border-gray-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900 relative">
        
        {/* CENTER MAP CONTAINER */}
        <div className="flex-1 h-[45vh] lg:h-full relative z-0">
          <MapContainer
            center={activeMapCenter}
            zoom={13}
            zoomControl={true}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={19}
            />
            <LeafletMapAutoCenter center={activeMapCenter} />

            {/* DRIVER MARKERS */}
            {driverStatuses.map(st => {
              const pos: [number, number] | null = (st.driver.lat && st.driver.lng && !isNaN(Number(st.driver.lat)))
                ? [Number(st.driver.lat), Number(st.driver.lng)]
                : null;

              if (!pos) return null;

              const isAlert = st.isStalled;
              const markerIcon = createDriverIcon(st.color, isAlert);

              // Associated Points
              const pharmaPos: [number, number] | null = (st.order?.pharmacyLat && st.order?.pharmacyLng)
                ? [Number(st.order.pharmacyLat), Number(st.order.pharmacyLng)]
                : null;

              const patientPos: [number, number] | null = (st.order?.destLat && st.order?.destLng)
                ? [Number(st.order.destLat), Number(st.order.destLng)]
                : null;

              return (
                <React.Fragment key={st.driver.id}>
                  <Marker 
                    position={pos} 
                    icon={markerIcon}
                    eventHandlers={{
                      click: () => setSelectedDriverId(st.driver.id)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                      <div className="p-1 text-center font-sans">
                        <p className="font-bold text-xs text-gray-900">{st.driver.name}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                          {st.state === 'idle' ? 'En attente' : st.state === 'en_route_to_pharmacy' ? 'Vers Pharmacie' : 'Vers Patient'}
                        </p>
                        {isAlert && <p className="text-[10px] text-red-600 font-bold">Immobilisé &gt; 5 min</p>}
                      </div>
                    </Tooltip>
                  </Marker>

                  {/* Polyline Route if mission selected */}
                  {selectedDriverId === st.driver.id && pharmaPos && (
                    <>
                      <Marker position={pharmaPos} icon={pharmacyIcon} />
                      <Polyline positions={[pos, pharmaPos]} color="#f59e0b" weight={4} dashArray="6, 8" opacity={0.8} />
                    </>
                  )}

                  {selectedDriverId === st.driver.id && patientPos && (
                    <>
                      <Marker position={patientPos} icon={patientIcon} />
                      <Polyline positions={[pos, patientPos]} color="#6366f1" weight={4} dashArray="6, 8" opacity={0.8} />
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </MapContainer>

          {/* Floating Action Button (Refresh Data) */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button
              onClick={() => fetchData()}
              className="p-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-white transition active:scale-95"
              title="Rafraîchir les données"
            >
              <RefreshCw size={18} className={loading ? "animate-spin text-[#194B4B]" : ""} />
            </button>
          </div>

          {/* Floating Selected Driver Card */}
          {selectedDriver && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-10 pointer-events-auto animate-in slide-in-from-bottom duration-200">
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#194B4B] text-white flex items-center justify-center font-bold">
                      {selectedDriver.driver.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{selectedDriver.driver.name}</h4>
                      <p className="text-[11px] text-gray-500">{selectedDriver.driver.vehicle_model} • {selectedDriver.driver.vehicle_plate}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedDriverId(null)}
                    className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>

                {selectedDriver.order ? (
                  <div className="bg-gray-50 dark:bg-zinc-800/60 p-3 rounded-2xl text-xs space-y-1.5 border border-gray-100 dark:border-zinc-800">
                    <div className="flex justify-between font-bold">
                      <span className="text-gray-500">Mission:</span>
                      <span className="text-[#194B4B] dark:text-teal-300">#{selectedDriver.order.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Patient:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{selectedDriver.order.patientName || 'Patient'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(selectedDriver.order.total || 0)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl text-center">
                    En attente de nouvelle mission
                  </p>
                )}

                {selectedDriver.driver.phone && (
                  <a
                    href={`tel:${selectedDriver.driver.phone}`}
                    className="w-full py-2.5 bg-[#194B4B] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Phone size={14} /> Contacter le livreur ({selectedDriver.driver.phone})
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: AUDIT TRAIL & FLEET LIST */}
        <div className="w-full lg:w-[420px] bg-white dark:bg-zinc-950 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-zinc-800 flex flex-col h-[55vh] lg:h-full shrink-0">
          
          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert size={18} className="text-[#194B4B] dark:text-teal-400" />
                Centre de Contrôle Live
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Supervision de la logistique temps réel</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl gap-1 text-[11px] font-bold">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${selectedFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-[#194B4B] dark:text-teal-300 shadow-sm' : 'text-gray-500'}`}
              >
                Tous
              </button>
              <button
                onClick={() => setSelectedFilter('delivering')}
                className={`px-2.5 py-1 rounded-lg transition ${selectedFilter === 'delivering' ? 'bg-white dark:bg-zinc-900 text-[#194B4B] dark:text-teal-300 shadow-sm' : 'text-gray-500'}`}
              >
                Actifs
              </button>
              <button
                onClick={() => setSelectedFilter('alert')}
                className={`px-2.5 py-1 rounded-lg transition ${selectedFilter === 'alert' ? 'bg-red-500 text-white shadow-sm' : 'text-red-500'}`}
              >
                Alertes ({activeAlerts.length})
              </button>
            </div>
          </div>

          {/* Scrollable Missions / Drivers List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {/* Critical Alerts Banner */}
            {activeAlerts.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                  <AlertOctagon size={16} /> Immobilisme Détecté (&gt; 5 min)
                </div>
                {activeAlerts.map(al => (
                  <div key={al.driver.id} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-red-100 dark:border-red-900/40 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{al.driver.name}</p>
                      <p className="text-[11px] text-red-500 font-medium">Mission #{al.order?.id?.slice(0, 6)} à l'arrêt</p>
                    </div>
                    {al.order && (
                      <button
                        onClick={() => handleRevokeMission(al.order!.id)}
                        className="px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition"
                      >
                        Réassigner
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Drivers List */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                Livreurs Connectés ({filteredStatuses.length})
              </p>

              {filteredStatuses.map(st => (
                <div
                  key={st.driver.id}
                  onClick={() => setSelectedDriverId(st.driver.id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    selectedDriverId === st.driver.id
                      ? 'border-[#194B4B] bg-[#194B4B]/5 dark:border-teal-500 dark:bg-teal-950/20'
                      : 'border-gray-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: st.color }}
                    >
                      {st.driver.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{st.driver.name}</h4>
                      <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }}></span>
                        {st.state === 'idle' ? 'Disponible' : st.state === 'en_route_to_pharmacy' ? 'Vers Officine' : 'En route Client'}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              ))}

              {filteredStatuses.length === 0 && (
                <div className="text-center py-10 text-xs text-gray-400">
                  Aucun livreur ne correspond aux filtres sélectionnés.
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
