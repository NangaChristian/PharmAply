import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { doc, onSnapshot, getDoc, db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { Bike, MapPin, Store, Navigation, Phone, MessageSquare, Clock, ShieldCheck, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Pharmacy Marker Icon
const pharmacyLeafletIcon = L.divIcon({
  className: 'custom-pharma-marker',
  html: `
    <div style="
      width: 44px;
      height: 44px;
      background: #194B4B;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 8px 20px rgba(25, 75, 75, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
        <path d="M2 7h20"/>
        <path d="M12 11v6"/>
        <path d="M9 14h6"/>
      </svg>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

// Driver Motorcycle Marker Icon
const driverMotoLeafletIcon = L.divIcon({
  className: 'custom-driver-moto-marker',
  html: `
    <div style="
      width: 44px;
      height: 44px;
      background: #FACC15;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 8px 20px rgba(250, 204, 21, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #194B4B;
    ">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5"/>
        <circle cx="5.5" cy="17.5" r="3.5"/>
        <circle cx="15" cy="5" r="1"/>
        <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
      </svg>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

function MapAutoCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

interface PharmacyDriverMapProps {
  orders: any[];
  pharmacy: any;
}

export function PharmacyDriverMap({ orders, pharmacy }: PharmacyDriverMapProps) {
  const navigate = useNavigate();
  // Filter active orders that have an assigned driver approaching or picking up
  const activeDeliveryOrders = orders.filter(o => 
    (o.driverId || o.driver_id) && 
    ['driver_assigned', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'to_pharmacy', 'at_pharmacy'].includes(o.status)
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [driverData, setDriverData] = useState<any>(null);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  // Pharmacy position
  const pharmaPos: [number, number] = (pharmacy?.lat && pharmacy?.lng && !isNaN(Number(pharmacy.lat)))
    ? [Number(pharmacy.lat), Number(pharmacy.lng)]
    : [4.0511, 9.7679]; // Douala fallback

  const currentOrder = activeDeliveryOrders.find(o => o.id === selectedOrderId) || activeDeliveryOrders[0] || null;

  useEffect(() => {
    if (activeDeliveryOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(activeDeliveryOrders[0].id);
    }
  }, [activeDeliveryOrders, selectedOrderId]);

  useEffect(() => {
    if (!currentOrder) {
      setDriverData(null);
      setDriverPos(null);
      return;
    }

    const driverId = currentOrder.driverId || currentOrder.driver_id;
    if (!driverId) return;

    // Listen in real-time to driver data & coordinates
    const unsub = onSnapshot(doc(db, 'drivers', driverId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setDriverData({ id: snap.id, ...d });
        const lat = d.lat || d.latitude || d.location?.lat;
        const lng = d.lng || d.longitude || d.location?.lng;
        if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
          setDriverPos([Number(lat), Number(lng)]);
        }
      }
    });

    return () => unsub();
  }, [currentOrder?.id, currentOrder?.driverId, currentOrder?.driver_id]);

  // Compute distance and ETA to pharmacy
  useEffect(() => {
    if (!driverPos || !pharmaPos) {
      setDistanceKm(null);
      setEtaMinutes(null);
      return;
    }

    const R = 6371; // Earth radius in km
    const dLat = (pharmaPos[0] - driverPos[0]) * Math.PI / 180;
    const dLng = (pharmaPos[1] - driverPos[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(driverPos[0] * Math.PI / 180) * Math.cos(pharmaPos[0] * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const dist = R * c;
    setDistanceKm(dist);

    // Moto speed ~30 km/h in urban traffic
    const minutes = Math.max(1, Math.round((dist / 30) * 60));
    setEtaMinutes(minutes);
  }, [driverPos, pharmaPos]);

  if (activeDeliveryOrders.length === 0) {
    return (
      <div className="bg-[#FAFBFC] dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="w-14 h-14 rounded-full bg-[#194B4B]/10 text-[#194B4B] dark:text-teal-300 flex items-center justify-center mb-4">
          <Bike size={28} />
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
          Suivi des Chauffeurs en Direct
        </h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
          Aucun livreur n'est actuellement en route vers votre pharmacie. Dès qu'un coursier est assigné à une commande prête, sa position et son heure d'arrivée estimée s'afficheront ici en temps réel.
        </p>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          En attente de ramassage
        </div>
      </div>
    );
  }

  const mapCenter: [number, number] = driverPos || pharmaPos;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Livreur en approche de l'officine
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Suivi GPS en temps réel du coursier assigné pour le ramassage des médicaments
          </p>
        </div>

        {/* Order Selector if multiple */}
        {activeDeliveryOrders.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {activeDeliveryOrders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  (currentOrder?.id === o.id) 
                    ? 'bg-[#194B4B] text-white shadow-sm' 
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                #{o.id.slice(0, 6).toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="w-full h-[320px] relative z-0">
        <MapContainer
          center={mapCenter}
          zoom={14}
          zoomControl={false}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
          />
          <MapAutoCenter center={mapCenter} />
          
          {/* Pharmacy Marker */}
          <Marker position={pharmaPos} icon={pharmacyLeafletIcon} />

          {/* Driver Marker */}
          {driverPos && (
            <>
              <Marker position={driverPos} icon={driverMotoLeafletIcon} />
              <Polyline positions={[driverPos, pharmaPos]} color="#194B4B" weight={4} opacity={0.8} dashArray="5, 10" />
            </>
          )}
        </MapContainer>

        {/* Floating live driver card overlay */}
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-auto">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
            
            {/* Driver Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#194B4B] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {driverData?.name?.charAt(0) || currentOrder?.driverName?.charAt(0) || 'L'}
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  {driverData?.name || currentOrder?.driverName || 'Chauffeur Assigné'}
                </h4>
                <p className="text-[11px] text-gray-500">
                  {driverData?.vehicleModel || 'Moto de livraison'} • {driverData?.vehiclePlate || 'LT 482 AB'}
                </p>
              </div>
            </div>

            {/* Distance & ETA */}
            <div className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-slate-700">
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-gray-400">Distance</p>
                <p className="text-xs font-black text-gray-900 dark:text-white">
                  {distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '--'}
                </p>
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-slate-700"></div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-gray-400">Arrivée estimée</p>
                <p className="text-xs font-black text-[#194B4B] dark:text-teal-300">
                  {etaMinutes !== null ? `~${etaMinutes} min` : '--'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {(driverData?.phone || currentOrder?.driverPhone) && (
                <a
                  href={`tel:${driverData?.phone || currentOrder?.driverPhone}`}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl transition shadow-sm"
                  title="Appeler le chauffeur"
                >
                  <Phone size={16} />
                </a>
              )}
              <button
                onClick={() => navigate(`/pharmacist/orders/${currentOrder?.id}`)}
                className="px-4 py-2.5 bg-[#194B4B] hover:bg-[#143d3d] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                Voir commande
                <ChevronRight size={14} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
