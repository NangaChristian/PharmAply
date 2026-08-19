import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, CheckCircle, Package, Download, X, AlertTriangle, RefreshCcw, 
  MessageCircle, FileText, Loader2, MapPin, Navigation, Bike, Phone, 
  Store, User, ShieldCheck, Clock, ExternalLink 
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { sendEmail } from '../../lib/email';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import { printInvoice } from '../../lib/invoice';
import { InvoiceModal } from '../../components/InvoiceModal';
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom Leaflet Icons
const driverMotoLeafletIcon = L.divIcon({
  className: 'custom-driver-moto-marker',
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
      color: #FACC15;
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

const pharmacyLeafletIcon = L.divIcon({
  className: 'custom-pharma-marker',
  html: `
    <div style="
      width: 40px;
      height: 40px;
      background: #194B4B;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 18px rgba(25, 75, 75, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
        <path d="M2 7h20"/>
      </svg>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const destPinLeafletIcon = L.divIcon({
  className: 'custom-patient-dest-marker',
  html: `
    <div style="
      width: 38px;
      height: 38px;
      background: #ea580c;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 6px 18px rgba(234, 88, 12, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});

// Map View Controller to fit bounds
function MapAutoBounds({ pharmacyPos, driverPos, destPos }: { pharmacyPos?: [number, number]; driverPos?: [number, number]; destPos?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    if (pharmacyPos) points.push(pharmacyPos);
    if (driverPos) points.push(driverPos);
    if (destPos) points.push(destPos);

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [pharmacyPos, driverPos, destPos, map]);

  return null;
}

export function PharmacistOrderDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  
  const [order, setOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 1. Écouter la commande en temps réel
  useEffect(() => {
    if (!id) return;
    const orderDocRef = doc(db, 'orders', id);
    const unsubscribeOrder = onSnapshot(orderDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const orderData = { id: docSnap.id, ...docSnap.data() } as any;
        
        // Charger les informations du patient si besoin
        if (orderData.patientId && !orderData.patientName) {
          try {
            const pd = await getDoc(doc(db, 'users', orderData.patientId));
            if (pd.exists()) {
              const uData = pd.data();
              orderData.patientName = uData.name || uData.fullName || uData.displayName || 'Client';
              orderData.patientPhoto = uData.photoURL || uData.photoUrl || uData.avatar_url;
              orderData.patientPhone = uData.phone;
            }
          } catch(e) {}
        }
        setOrder(orderData);
      }
      setLoading(false);
    });

    return () => unsubscribeOrder();
  }, [id]);

  // 2. Écouter la position en temps réel du livreur assigné
  useEffect(() => {
    const driverId = order?.driverId || order?.driver_id;
    if (!driverId) {
      setDriver(null);
      return;
    }

    const driverDocRef = doc(db, 'drivers', driverId);
    const unsubscribeDriver = onSnapshot(driverDocRef, (driverSnap) => {
      if (driverSnap.exists()) {
        setDriver({ id: driverSnap.id, ...driverSnap.data() });
      } else {
        // Fallback s'il est dans la collection users
        getDoc(doc(db, 'users', driverId)).then((uSnap) => {
          if (uSnap.exists()) {
            setDriver({ id: uSnap.id, ...uSnap.data() });
          }
        });
      }
    });

    return () => unsubscribeDriver();
  }, [order?.driverId, order?.driver_id]);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!order) return;
    setProcessing(true);
    setActionLoading(newStatus);
    try {
      const historyItem = { status: newStatus, timestamp: new Date().toISOString() };
      const newHistory = [...(order.statusHistory || []), historyItem];
      
      const updateData: any = { status: newStatus, statusHistory: newHistory };
      if (newStatus === 'rejected' && rejectReason) {
        updateData.cancellationReason = rejectReason;
      }
      await updateDoc(doc(db, 'orders', order.id), updateData);
      
      let notifTitle = 'Statut de commande mis à jour';
      let notifMessage = `Votre commande #${order.id.slice(0, 6)} est maintenant : ${newStatus}`;

      if (newStatus === 'validated_awaiting_payment') {
        notifTitle = '💊 Médicaments Disponibles - Paiement Requis';
        notifMessage = `La pharmacie ${order.pharmacyName || ''} a validé la disponibilité de vos produits pour la commande #${order.id.slice(0, 6).toUpperCase()}. Vous pouvez maintenant effectuer le paiement sécurisé Fapshi.`;
      } else if (newStatus === 'preparing') {
        notifTitle = '📦 Préparation en cours';
        notifMessage = `La pharmacie a commencé la préparation de votre commande #${order.id.slice(0, 6).toUpperCase()}.`;
      }

      // Notification patient
      await addDoc(collection(db, 'notifications'), {
        userId: order.patientId,
        type: newStatus === 'validated_awaiting_payment' ? 'payment_required' : 'order_status',
        title: notifTitle,
        message: notifMessage,
        isRead: false,
        relatedId: order.id,
        createdAt: serverTimestamp()
      });
      
      setOrder({ ...order, status: newStatus, statusHistory: newHistory, cancellationReason: newStatus === 'rejected' ? rejectReason : order.cancellationReason });
      setIsRejecting(false);

      if (newStatus === 'validated_awaiting_payment') {
        toast.success("Disponibilité confirmée ! Notification de paiement envoyée au patient.");
      } else if (newStatus === 'preparing') {
        toast.success("Commande acceptée avec succès !");
      } else if (newStatus === 'rejected') {
        toast.success("Commande rejetée.");
      } else {
        toast.success("Statut de la commande mis à jour !");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour de la commande.");
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
    } finally {
      setProcessing(false);
      setActionLoading(null);
    }
  };

  const handlePrintInvoice = () => {
    if (order) {
      printInvoice(order);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 animate-pulse"> Chargement de la commande... </div>;
  if (!order) return <div className="p-8 text-center text-sm text-gray-500"> Commande introuvable </div>;

  // Calcul des coordonnées GPS pour la carte
  const pharmacyLat = Number(order.pharmacyLat || order.pharmacyLatitude || 4.0511);
  const pharmacyLng = Number(order.pharmacyLng || order.pharmacyLongitude || 9.7679);
  const pharmacyPos: [number, number] = [pharmacyLat, pharmacyLng];

  const destLat = Number(order.destLat || order.destinationLat || order.latitude || 4.0590);
  const destLng = Number(order.destLng || order.destinationLng || order.longitude || 9.7750);
  const destPos: [number, number] = [destLat, destLng];

  const driverLat = Number(driver?.lat || driver?.latitude || order.driverLat || (pharmacyLat + 0.005));
  const driverLng = Number(driver?.lng || driver?.longitude || order.driverLng || (pharmacyLng + 0.005));
  const driverPos: [number, number] = [driverLat, driverLng];

  const routePositions: [number, number][] = [
    pharmacyPos,
    driverPos,
    destPos
  ];

  const isDeliveryOrder = order.deliveryMethod !== 'pickup';
  const hasDriverAssigned = Boolean(order.driverId || order.driver_id || driver);

  return (
    <div className="flex-1 bg-transparent flex flex-col h-full overflow-hidden relative">
      {/* HEADER */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight"> Commande #{order.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-xs text-gray-500">Détails et suivi logistique en temps réel</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate(`/pharmacist/messages/${order.id}`)}
            className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
          >
            <MessageCircle size={16} />
            Chat Patient
          </button>
          {driver?.phone && (
            <a 
              href={`tel:${driver.phone}`}
              className="px-4 py-2.5 bg-[#194B4B] text-white rounded-full text-sm font-bold shadow-sm hover:bg-[#133a3a] transition flex items-center gap-2"
            >
              <Phone size={16} />
              Appeler Livreur
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-40 custom-scrollbar space-y-6">
        
        {/* ========================================================================= */}
        {/* MODULE CARTE DU SUIVI DU LIVREUR EN TEMPS RÉEL (PHARMACIE -> LIVREUR -> PATIENT) */}
        {/* ========================================================================= */}
        {isDeliveryOrder && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-slate-700 flex items-center justify-center text-[#194B4B] dark:text-teal-400">
                  <Navigation size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    Suivi GPS du Livreur en Direct
                  </h3>
                  <p className="text-xs text-gray-500">
                    Position exacte du coursier et itinéraire de livraison
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  hasDriverAssigned ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {hasDriverAssigned ? (order.status === 'delivered' ? 'Livré' : 'Livreur en Course') : 'En attente d\'attribution'}
                </span>
              </div>
            </div>

            {/* Carte Leaflet interactive */}
            <div className="w-full h-80 rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 relative shadow-inner z-0">
              <MapContainer
                center={driverPos}
                zoom={14}
                scrollWheelZoom={false}
                style={{ width: "100%", height: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* Pin Pharmacie */}
                <Marker position={pharmacyPos} icon={pharmacyLeafletIcon}>
                  <Tooltip permanent direction="top" offset={[0, -20]}>
                    <span className="font-bold text-xs">{order.pharmacyName || "Votre Pharmacie"}</span>
                  </Tooltip>
                </Marker>

                {/* Pin Livreur */}
                {hasDriverAssigned && (
                  <Marker position={driverPos} icon={driverMotoLeafletIcon}>
                    <Tooltip permanent direction="top" offset={[0, -22]}>
                      <span className="font-bold text-xs text-[#194B4B]">{driver?.name || order.driverName || "Coursier"}</span>
                    </Tooltip>
                  </Marker>
                )}

                {/* Pin Destination Patient */}
                <Marker position={destPos} icon={destPinLeafletIcon}>
                  <Tooltip permanent direction="top" offset={[0, -20]}>
                    <span className="font-bold text-xs">{order.patientName || "Adresse Client"}</span>
                  </Tooltip>
                </Marker>

                {/* Tracé Itinéraire */}
                <Polyline
                  positions={routePositions}
                  color="#194B4B"
                  weight={4}
                  dashArray="6, 8"
                  opacity={0.8}
                />

                <MapAutoBounds
                  pharmacyPos={pharmacyPos}
                  driverPos={hasDriverAssigned ? driverPos : undefined}
                  destPos={destPos}
                />
              </MapContainer>
            </div>

            {/* Infos Livreur Carte */}
            <div className="bg-gray-50 dark:bg-slate-900 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 shrink-0 border border-slate-300">
                  {driver?.photoURL || driver?.avatar_url || order.driverPhoto ? (
                    <img src={driver?.photoURL || driver?.avatar_url || order.driverPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Bike size={22} className="text-[#194B4B] dark:text-teal-400" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {driver?.name || order.driverName || (hasDriverAssigned ? "Livreur Assigné" : "Recherche d'un coursier...")}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                    <Bike size={13} />
                    {driver?.vehicle_plate ? `Moto / ${driver.vehicle_plate}` : (driver?.vehicle_type || "Deux-roues motorisé")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {driver?.phone && (
                  <a
                    href={`tel:${driver.phone}`}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 flex items-center gap-1.5 transition"
                  >
                    <Phone size={14} className="text-emerald-600" />
                    {driver.phone}
                  </a>
                )}
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Adresse de livraison</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px] block">
                    {order.deliveryAddress || "Douala, Cameroun"}
                  </span>
                </div>
              </div>
            </div>

            {/* Preuve de livraison si disponible */}
            {(order.proofOfDeliveryUrl || order.deliveryProofPhoto || order.proof_of_delivery_url) && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={24} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-950 dark:text-emerald-300 text-xs">
                      Preuve photo de livraison enregistrée
                    </p>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-400">
                      Photo prise par le coursier à la remise
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.open(order.proofOfDeliveryUrl || order.deliveryProofPhoto || order.proof_of_delivery_url, '_blank')}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                >
                  Voir la photo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Détails Commande Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
          {/* Badge */}
          <div className={`inline-block px-5 py-1.5 rounded-full text-sm font-bold mb-5 ${
            order.status === 'pending' ? 'bg-[#c5ead5] text-[#2c8d50]' :
            order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
            (order.status === 'ready' || order.status === 'ready_for_pickup') ? 'bg-[#D3F5A8] text-[#0B3B3C]' :
            (order.status === 'cancelled' || order.status === 'rejected') ? 'bg-red-100 text-red-700' :
            order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
            'bg-[#FAFBFC] border border-gray-200 text-gray-700'
          }`}>
            {order.status === 'pending' ? 'Nouveau' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </div>
          
          <h2 className="text-2xl font-bold text-[#0B3B3C] dark:text-white mb-2">Commande #{order.id.slice(0, 6).toUpperCase()}</h2>
          <p className="text-sm text-gray-500 font-medium mb-8">
            {parseDate(order.createdAt) ? parseDate(order.createdAt)!.toLocaleString('fr-FR', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'récemment'}
          </p>

          {/* Order Summary */}
          <div className="bg-[#FAFBFC] dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl p-6 mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-4">Résumé Client</h3>
            <div className="text-sm font-medium text-gray-500 flex flex-wrap gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                  {order.patientPhoto ? (
                    <img src={order.patientPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (order.patientName || 'C')[0].toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">Client</span>
                  <span className="text-gray-900 font-bold dark:text-gray-300">{order.patientName || 'Client'}</span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-xs text-gray-500">Articles</span>
                <span className="text-gray-900 font-bold dark:text-gray-300">{order.items?.length || 0} médicament(s)</span>
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-xs text-gray-500">Mode</span>
                <span className="text-gray-900 font-bold dark:text-gray-300">{order.deliveryMethod === 'pickup' ? 'Retrait en Pharmacie' : 'Livraison à Domicile'}</span>
              </div>
            </div>
          </div>

          {/* Medicines List */}
          <div className="space-y-4 mb-8">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-4 px-1">Médicaments Commandés</h3>
            {(order.items || []).map((item: any, index: number) => (
              <div key={index} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-5 rounded-2xl flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#E2EBE9] dark:bg-slate-900 rounded-xl flex flex-col items-center justify-center text-[#0B3B3C] dark:text-gray-300 font-bold shrink-0">
                    <span className="text-[10px] opacity-70">x</span>{item.quantity}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{item.name}</p>
                    {item.dosage && <p className="text-xs text-gray-500 mt-1">{item.dosage}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(item.price * item.quantity)}</p>
                  {item.quantity > 1 && <p className="text-xs text-gray-500 mt-1">{formatCurrency(item.price)} l'unité</p>}
                </div>
              </div>
            ))}
            {!(order.items?.length > 0) && <div className="bg-[#FAFBFC] p-4 rounded-2xl border border-gray-100 text-center text-gray-500 text-sm">Aucun article</div>}
          </div>

          {/* Ordonnance DPML Validation */}
          {(order.hasPrescription || order.prescriptionUrl) && (
            <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 mb-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500 shrink-0" />
                <h3 className="font-bold text-red-900 dark:text-red-400 text-sm">Validation DPML (Ordonnance Obligatoire)</h3>
              </div>
              
              {order.prescriptionUrl ? (
                <div className="bg-white dark:bg-slate-800 border border-red-50 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600">
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">Ordonnance Téléchargée</p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">Vérifiez la signature et validité</p>
                    </div>
                  </div>
                  <button onClick={() => window.open(order.prescriptionUrl, '_blank')} className="bg-red-600/10 text-red-700 px-5 py-2.5 rounded-full text-xs font-bold hover:bg-red-600 hover:text-white transition-colors">
                    Ouvrir le document
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">Document Manquant</p>
                  <p className="text-xs text-gray-500 mt-1">Le patient n'a pas encore transmis d'ordonnance valide.</p>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          <div className="bg-[#FAFBFC] dark:bg-slate-900 rounded-2xl p-6 flex justify-between items-center border border-gray-100 dark:border-slate-700 mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Total Commande :</h3>
            <span className="font-bold text-gray-900 dark:text-white text-lg">{formatCurrency(order.total)}</span>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-6">Historique & Timeline</h3>
            <div className="relative border-l-2 border-gray-100 dark:border-slate-700 ml-3 space-y-6">
              {[
                { status: 'pending', timestamp: order.createdAt },
                ...(order.statusHistory || (order.status !== 'pending' ? [{ status: order.status, timestamp: order.updatedAt || undefined }] : []))
              ].map((update, index, arr) => {
                const isLast = index === arr.length - 1;
                const getStatusLabel = (s: string) => {
                  switch(s) {
                    case 'pending': return 'Commande Reçue';
                    case 'preparing': return 'Préparation en cours';
                    case 'ready': return 'Prête pour la livraison';
                    case 'ready_for_pickup': return 'Prête pour le retrait';
                    case 'accepted': return 'Livreur Assigné';
                    case 'picked_up': return 'Colis Récupéré par le Coursier';
                    case 'on_the_way': return 'En cours de livraison';
                    case 'delivered': return 'Commande Livrée';
                    case 'rejected': return 'Commande Rejetée';
                    case 'cancelled': return 'Commande Annulée';
                    default: return s;
                  }
                };
                return (
                  <div key={index} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${isLast ? 'bg-[#0B3B3C] ring-4 ring-teal-50 dark:ring-slate-700' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <div>
                      <p className={`text-sm font-bold ${isLast ? 'text-[#0B3B3C] dark:text-teal-400' : 'text-gray-900 dark:text-gray-300'}`}>
                        {getStatusLabel(update.status)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {update.timestamp ? (parseDate(update.timestamp) ? parseDate(update.timestamp)!.toLocaleString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'En attente') : 'Heure inconnue'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Action Buttons Fixed Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-transparent px-8 pb-8 pt-4 flex flex-col gap-4 z-20 pointer-events-none">
        <div className="flex gap-4 w-full justify-end pointer-events-auto">
          {order.status === 'pending' && !isRejecting && (
            <>
              <button disabled={processing} onClick={handlePrintInvoice} className="px-5 py-3.5 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold shadow-sm transition-all focus:outline-none flex items-center gap-2">
                <Download size={18} /> Imprimer
              </button>
              <button disabled={processing} onClick={() => setIsRejecting(true)} className="px-6 py-3.5 bg-white border border-red-100 text-red-600 hover:bg-red-50 rounded-full font-bold shadow-sm transition-all focus:outline-none">
                Refuser
              </button>
              <button 
                disabled={processing} 
                onClick={() => handleUpdateStatus('validated_awaiting_payment')} 
                className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-full font-black shadow-md transition-all focus:outline-none flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {processing && actionLoading === 'validated_awaiting_payment' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Validation stock...</span>
                  </>
                ) : (
                  <span>Valider Disponibilité & Demander Paiement</span>
                )}
              </button>
              <button 
                disabled={processing} 
                onClick={() => handleUpdateStatus('preparing')} 
                className="px-6 py-3.5 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold shadow-md transition-all focus:outline-none flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {processing && actionLoading === 'preparing' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Préparation...</span>
                  </>
                ) : (
                  <span>Préparer Directement</span>
                )}
              </button>
            </>
          )}

          {order.status === 'validated_awaiting_payment' && (
            <div className="bg-amber-500/15 border border-amber-400 text-amber-900 dark:text-amber-300 px-6 py-3.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm">
              <Clock size={16} className="text-amber-500 animate-spin" />
              <span>Disponibilité confirmée — En attente du règlement Fapshi par le patient</span>
            </div>
          )}
          
          {order.status !== 'pending' && (
            <button disabled={processing} onClick={handlePrintInvoice} className="px-5 py-3.5 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all focus:outline-none flex items-center gap-2">
              <Download size={18} /> Imprimer Facture
            </button>           
          )}
          
          {isRejecting && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col gap-4 w-full max-w-sm ml-auto pointer-events-auto animate-in slide-in-from-bottom-5">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2"> Motif du refus : </label>
                <select 
                  className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-[#FAFBFA] dark:bg-slate-900 text-sm focus:border-red-300 outline-none transition-all shadow-sm" 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)}
                >
                  <option value=""> Sélectionner un motif </option>
                  <option value="Rupture de stock"> Rupture de stock </option>
                  <option value="Ordonnance invalide ou illisible"> Ordonnance invalide ou illisible </option>
                  <option value="Pharmacie ferme bientôt"> Pharmacie ferme bientôt </option>
                  <option value="other"> Autre motif... </option>
                </select>
              </div>
              {rejectReason === 'other' && (
                <input 
                  type="text" 
                  placeholder="Tapez le motif..." 
                  className="w-full border border-gray-200 dark:border-slate-700 p-3 rounded-xl bg-[#FAFBFA] dark:bg-slate-900 text-sm focus:border-red-300 outline-none transition-all shadow-sm"
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              )}
              <div className="flex gap-3 mt-2">
                <button disabled={processing} onClick={() => setIsRejecting(false)} className="flex-1 py-3 bg-white border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold transition-colors"> Annuler </button>
                <button 
                  disabled={processing || !rejectReason} 
                  onClick={() => handleUpdateStatus('rejected')} 
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {processing && actionLoading === 'rejected' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Rejet...</span>
                    </>
                  ) : (
                    <span>Confirmer le refus</span>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {order.status === 'preparing' && (
            <button 
              disabled={processing} 
              onClick={() => handleUpdateStatus(order.deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'ready')} 
              className="px-8 py-3.5 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold shadow-md transition-all ml-auto focus:outline-none pointer-events-auto flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Mise à jour...</span>
                </>
              ) : (
                order.deliveryMethod === 'pickup' ? 'Marquer Prêt pour Retrait' : 'Marquer Prêt pour Livraison'
              )}
            </button>
          )}
          
          {order.status === 'ready_for_pickup' && order.deliveryMethod === 'pickup' && (
            <button 
              disabled={processing} 
              onClick={() => handleUpdateStatus('delivered')} 
              className="px-8 py-3.5 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold shadow-md transition-all ml-auto focus:outline-none pointer-events-auto flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Confirmation...</span>
                </>
              ) : (
                'Confirmer Remise au Patient'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
