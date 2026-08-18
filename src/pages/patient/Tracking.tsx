import { 
  ArrowLeft, CheckCircle, Package, Truck, Home, Phone, Star, 
  FileText, MapPin, Navigation, Store, MessageSquare, 
  ChevronRight, X, Bike, Key, PhoneCall, Check, Copy, Clock, 
  AlertCircle, ShieldCheck, RefreshCw, ShoppingBag, ThumbsUp, Heart, Send
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp, db } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { formatCurrency, parseDate } from '../../lib/utils';
import { InvoiceModal } from '../../components/InvoiceModal';
import toast from 'react-hot-toast';

// Custom Motorcycle Icon for Leaflet
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

// Destination Pin (Patient)
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
    ">
      <div style="
        width: 12px;
        height: 12px;
        background: #ffffff;
        border-radius: 50%;
      "></div>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});

// Pharmacy Pin
const pharmacyLeafletIcon = L.divIcon({
  className: 'custom-pharma-marker',
  html: `
    <div style="
      width: 38px;
      height: 38px;
      background: #194B4B;
      border: 3px solid #ffffff;
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
  iconSize: [38, 38],
  iconAnchor: [19, 19]
});

// Component to auto recenter map
function MapAutoCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export function PatientTracking() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  
  const [order, setOrder] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  
  // Rating states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingHover, setRatingHover] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [selectedRatingTags, setSelectedRatingTags] = useState<string[]>(["Rapide ⚡", "Médicaments intacts 📦"]);
  const [selectedTip, setSelectedTip] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // User Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
        },
        (error) => {
          console.warn("User location unavailable in tracking:", error?.message || "Permission denied");
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, []);

  // Listen to order updates
  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(doc(db, 'orders', id), (snapshot) => {
       if (snapshot.exists()) {
          const data = snapshot.data();
          setOrder({ id: snapshot.id, ...data });
          
          const lat = data.driverLat || data.driverLocation?.lat;
          const lng = data.driverLng || data.driverLocation?.lng;
          if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
             setDriverPos([Number(lat), Number(lng)]);
          }
       }
       setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  // Fetch Pharmacy info
  useEffect(() => {
    const phId = order?.pharmacyId || order?.pharmacy_id;
    if (!phId) return;

    const fetchPharmacy = async () => {
      try {
        const phDoc = await getDoc(doc(db, 'pharmacies', phId));
        if (phDoc.exists()) {
          setPharmacy({ id: phDoc.id, ...phDoc.data() });
        }
      } catch (err) {
        console.error("Error fetching pharmacy:", err);
      }
    };
    fetchPharmacy();
  }, [order?.pharmacyId, order?.pharmacy_id]);

  // Fetch Assigned Driver in real-time
  const assignedDriverId = order?.driverId || order?.driver_id;
  useEffect(() => {
    if (!assignedDriverId) {
      setDriver(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'drivers', assignedDriverId), (docObj) => {
       if (docObj.exists()) {
          const driverData = docObj.data();
          setDriver({ id: docObj.id, ...driverData });
          
          const lat = driverData.lat || driverData.latitude || driverData.location?.lat;
          const lng = driverData.lng || driverData.longitude || driverData.location?.lng;
          if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
             setDriverPos([Number(lat), Number(lng)]);
          }
       }
    });
    return () => unsub();
  }, [assignedDriverId]);

  const isPickup = Boolean(
    order && (
      order.delivery_mode === 'PICKUP' || 
      order.delivery_mode === 'pickup' || 
      order.deliveryMethod === 'pickup' || 
      order.deliveryMethod === 'store_pickup' || 
      order.fulfillment_type === 'PICKUP'
    )
  );

  const destPos: [number, number] = (order?.destLat && order?.destLng && !isNaN(Number(order.destLat))) 
    ? [Number(order.destLat), Number(order.destLng)]
    : order?.deliveryLocation 
      ? [order.deliveryLocation.lat, order.deliveryLocation.lng]
      : userLocation || [4.0511, 9.7679];

  // ETA Calculation
  useEffect(() => {
    if (driverPos && destPos) {
       const R = 6371; // Radius of earth in km
       const dLat = (destPos[0] - driverPos[0]) * Math.PI / 180;
       const dLng = (destPos[1] - driverPos[1]) * Math.PI / 180;
       const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(driverPos[0] * Math.PI / 180) * Math.cos(destPos[0] * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2); 
       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
       const distance = R * c;

       let estimatedTime = Math.round((distance / 30) * 60);
       if (estimatedTime < 1) estimatedTime = 1;
       
       if (distance < 0.05 || order?.status === 'delivered') {
          setEta(0);
       } else {
          setEta(estimatedTime);
       }
    }
  }, [driverPos, order?.status, destPos]);

  // Order Approval & Driver Assignment Conditions (CHANTIER 1)
  const isApproved = Boolean(
    order && 
    ['APPROVED', 'approved', 'preparing', 'ready', 'ready_for_pickup', 'driver_assigned', 'picked_up', 'out_for_delivery', 'en_route', 'delivered'].includes(order.status)
  );

  const hasAssignedDriver = Boolean(assignedDriverId && driver);

  // Status timeline dates
  const getTimelineDate = (type: string) => {
    if (!order) return "";
    const extractDate = (dateField: any) => {
      const parsed = parseDate(dateField);
      if (!parsed) return "";
      return parsed.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    if (type === 'placed') return extractDate(order.createdAt) || "Aujourd'hui";
    if (type === 'approved') return extractDate(order.approvedAt || order.acceptedAt) || (isApproved ? "Validée" : "En cours");
    if (type === 'preparing') return extractDate(order.preparedAt || order.acceptedAt) || (['preparing', 'driver_assigned', 'out_for_delivery', 'ready', 'ready_for_pickup', 'delivered'].includes(order.status) ? "En cours..." : "");
    if (type === 'out') return extractDate(order.dispatchedAt || order.outForDeliveryAt) || (['driver_assigned', 'out_for_delivery', 'delivered'].includes(order.status) ? "En cours de route" : "");
    if (type === 'ready') return extractDate(order.readyAt) || (['ready', 'ready_for_pickup', 'delivered'].includes(order.status) ? "Prêt" : "");
    if (type === 'delivered') return extractDate(order.deliveredAt) || (order.status === 'delivered' ? "Livré avec succès" : "En attente");
    return "";
  };

  // Driver details (Real data only)
  const driverName = driver?.name || driver?.fullName || driver?.nom || order?.driverName || "Livreur Assigné";
  const driverFirstName = driverName.split(' ')[0];
  const driverRating = driver?.rating !== undefined ? Number(driver.rating).toFixed(2).replace('.', ',') : "4.9";
  const driverPhone = driver?.phone || driver?.phoneNumber || order?.driverPhone || "";
  const driverPhoto = driver?.photoURL || driver?.photoUrl || driver?.avatarUrl || driver?.photo || order?.driverPhoto || null;
  const vehicleTypeLabel = driver?.vehicleType === 'car' ? 'Voiture' : 'Moto';
  const vehicleModel = driver?.vehicleModel || driver?.vehicleDetails?.model || (vehicleTypeLabel === 'Moto' ? 'Moto de livraison' : 'Véhicule de livraison');
  const vehiclePlate = driver?.vehiclePlate || driver?.vehicleDetails?.plate || 'LT ---';
  const deliveryOtp = order?.deliveryOtp || order?.pickupOtp || order?.id?.slice(-4)?.toUpperCase() || '----';

  const copyDeliveryCode = () => {
    navigator.clipboard.writeText(deliveryOtp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const toggleRatingTag = (tag: string) => {
    setSelectedRatingTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitDriverRating = async () => {
    if (!order?.id) return;
    setIsSubmittingRating(true);

    try {
      // 1. Update Firestore Order
      await updateDoc(doc(db, 'orders', order.id), {
        patientConfirmedReceipt: true,
        patientConfirmedAt: serverTimestamp(),
        driverRating: ratingScore,
        driverReview: ratingComment.trim(),
        driverReviewTags: selectedRatingTags,
        driverTip: selectedTip,
        updatedAt: serverTimestamp()
      });

      // 2. Update Driver stats if driverId exists
      const targetDriverId = order.driverId || driver?.id;
      if (targetDriverId) {
        try {
          const currentTotalRatings = Number(driver?.totalRatings || driver?.ratingCount || 1);
          const currentAvgRating = Number(driver?.rating || 4.8);
          const newAvg = Number(((currentAvgRating * currentTotalRatings + ratingScore) / (currentTotalRatings + 1)).toFixed(2));

          await updateDoc(doc(db, 'drivers', targetDriverId), {
            rating: newAvg,
            totalRatings: currentTotalRatings + 1,
            lastRatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn("Could not update driver rating aggregate:", e);
        }

        // 3. Supabase sync if table exists
        try {
          await supabase.from('orders').update({
            patient_confirmed: true,
            driver_rating: ratingScore,
            driver_review: ratingComment.trim(),
            updated_at: new Date().toISOString()
          }).eq('id', order.id);
        } catch (e) {
          // ignore
        }
      }

      toast.success("Merci ! Votre avis a été enregistré avec succès ⭐");
      setShowRatingModal(false);
    } catch (error) {
      console.error("Error saving rating:", error);
      toast.error("Impossible d'enregistrer l'avis. Veuillez réessayer.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const statuses = isPickup ? [
    { label: "Commande validée", date: getTimelineDate('placed'), completed: true, icon: CheckCircle },
    { label: "Préparation par la pharmacie", date: getTimelineDate('preparing'), completed: ['preparing', 'ready_for_pickup', 'ready', 'delivered'].includes(order?.status), active: order?.status === 'pending', icon: Package },
    { label: "Prête pour retrait en officine", date: getTimelineDate('ready'), completed: order?.status === 'delivered' || order?.status === 'ready' || order?.status === 'ready_for_pickup', active: order?.status === 'preparing', icon: Store },
    { label: "Médicaments retirés", date: order?.status === 'delivered' ? getTimelineDate('delivered') : "En attente", completed: order?.status === 'delivered', icon: CheckCircle },
  ] : [
    { label: "Commande enregistrée & payée", date: getTimelineDate('placed'), completed: true, icon: CheckCircle },
    { label: "Approbation & préparation pharmacie", date: getTimelineDate('preparing'), completed: isApproved, active: !isApproved, icon: Package },
    { label: "Livreur assigné & en route", date: (eta !== null && eta > 0) ? `Arrive dans ~${eta} min` : getTimelineDate('out'), completed: order?.status === 'delivered', active: isApproved && hasAssignedDriver, icon: Bike },
    { label: "Remis en main propre", date: order?.status === 'delivered' ? getTimelineDate('delivered') : "En attente", completed: order?.status === 'delivered', icon: Home },
  ];

  if (loading) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-8 h-8 text-[#194B4B] animate-spin mb-3" />
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Chargement des informations de suivi...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Commande introuvable</h2>
        <p className="text-xs text-gray-500 max-w-xs">Cette commande n'existe pas ou vous n'avez pas l'autorisation d'y accéder.</p>
        <button onClick={() => navigate('/patient/orders')} className="px-5 py-2.5 bg-[#194B4B] text-white text-xs font-bold rounded-full">
          Retour aux commandes
        </button>
      </div>
    );
  }

  /* =========================================================================
     CAS 1 : COMMANDE EN ATTENTE D'APPROBATION PHARMACIE OU SANS LIVREUR
     (Chantier 1 : Masquer la carte tant que la commande n'est pas approuvée
     avec chauffeur assigné)
     ========================================================================= */
  const shouldShowWaitingScreen = !isPickup && (!isApproved || !hasAssignedDriver);

  return (
    <div className="flex-1 bg-white dark:bg-black flex flex-col h-full overflow-hidden relative font-sans">
      
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-10 pb-3 px-4 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/50 via-black/20 to-transparent">
        <button 
          id="btn-back-patient"
          onClick={() => navigate('/patient/orders')} 
          className="w-11 h-11 flex items-center justify-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full shadow-md text-gray-800 dark:text-white hover:bg-white transition active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-4 py-1.5 rounded-full shadow-md border border-gray-100 dark:border-zinc-800 flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            order?.status === 'delivered' ? 'bg-emerald-500' :
            shouldShowWaitingScreen ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 animate-pulse'
          }`}></span>
          <span className="text-xs font-black tracking-wide text-[#194B4B] dark:text-teal-300 uppercase">
            {order?.status === 'delivered' ? 'Livraison effectuée' : 
             isPickup ? 'Retrait Officine' : 
             shouldShowWaitingScreen ? 'En attente pharmacie' : 'Livraison en direct'}
          </span>
        </div>

        <button 
          id="btn-open-details-top"
          onClick={() => setShowDetailsDrawer(true)}
          className="w-11 h-11 flex items-center justify-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-full shadow-md text-gray-800 dark:text-white hover:bg-white transition active:scale-95"
          title="Détails de la commande"
        >
          <FileText size={18} />
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 w-full h-full relative z-0">
        
        {/* VUE 1 : ÉCRAN D'ATTENTE DE VALIDATION PHARMACIE / ASSIGNATION DU COURSIER */}
        {shouldShowWaitingScreen ? (
          <div className="w-full h-full bg-slate-50 dark:bg-zinc-950 p-6 pt-24 overflow-y-auto space-y-6">
            
            {/* Header d'attente */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-6 rounded-3xl text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-[#194B4B]/10 text-[#194B4B] dark:text-teal-300 rounded-full flex items-center justify-center mx-auto relative">
                <Clock size={32} className="animate-spin" style={{ animationDuration: '6s' }} />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white dark:border-zinc-900"></span>
              </div>
              
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {!isApproved 
                    ? "En attente de l'approbation de la pharmacie" 
                    : "Recherche d'un livreur en cours..."}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  {!isApproved
                    ? "L'officine certifiée vérifie la conformité de vos ordonnances et prépare votre colis sécurisé."
                    : "Votre commande est approuvée et prête ! Un coursier certifié va être assigné d'un instant à l'autre."}
                </p>
              </div>

              {pharmacy && (
                <div className="bg-gray-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#194B4B] text-white flex items-center justify-center font-bold">
                      <Store size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{pharmacy.name || 'Pharmacie Partenaire'}</p>
                      <p className="text-[11px] text-gray-500">{pharmacy.address || 'Officine locale certifiée'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-bold rounded-lg border border-amber-200 dark:border-amber-800">
                    {!isApproved ? "En cours" : "Prête"}
                  </span>
                </div>
              )}
            </div>

            {/* Étapes du processus */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
                Progression de votre commande
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Check size={14} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Commande transmise & enregistrée</p>
                    <p className="text-[11px] text-gray-500">Paiement validé avec succès</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    isApproved ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                  }`}>
                    {isApproved ? <Check size={14} /> : <Clock size={14} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">Validation officinale par le pharmacien</p>
                    <p className="text-[11px] text-gray-500">
                      {isApproved ? "Ordonnance & médicaments validés" : "Vérification du stock et scellage en cours"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    hasAssignedDriver ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'
                  }`}>
                    <Bike size={14} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${hasAssignedDriver ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                      Attribution du livreur certifié
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {hasAssignedDriver ? "Chauffeur en route vers l'officine" : "La carte GPS s'activera automatiquement dès l'assignation"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDetailsDrawer(true)}
                className="flex-1 py-3.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
              >
                <ShoppingBag size={16} className="text-[#194B4B]" /> Détails commande
              </button>

              <button
                onClick={() => navigate(`/patient/messages/${order.id}`)}
                className="flex-1 py-3.5 bg-[#194B4B] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
              >
                <MessageSquare size={16} /> Contacter pharmacie
              </button>
            </div>

          </div>
        ) : !isPickup ? (
          /* =========================================================================
             VUE 2 : SUIVI GPS EN DIRECT AVEC LE VRAI LIVREUR ASSIGNÉ
             ========================================================================= */
          <div className="w-full h-full">
            <MapContainer
              center={driverPos || destPos}
              zoom={15}
              zoomControl={false}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                maxZoom={19}
              />
              <MapAutoCenter center={driverPos || destPos} />
              
              {/* Driver Marker */}
              {driverPos && (
                <Marker position={driverPos} icon={driverMotoLeafletIcon} />
              )}

              {/* Destination Marker */}
              <Marker position={destPos} icon={destPinLeafletIcon} />

              {/* Polyline Route */}
              {driverPos && (
                <Polyline positions={[driverPos, destPos]} color="#194B4B" weight={5} opacity={0.85} dashArray="4, 8" />
              )}
            </MapContainer>
          </div>
        ) : (
          /* =========================================================================
             VUE 3 : MODE RETRAIT EN OFFICINE
             ========================================================================= */
          <div className="w-full h-full bg-slate-50 dark:bg-zinc-950 p-6 pt-24 overflow-y-auto space-y-4">
            <div className="bg-[#194B4B]/10 border border-[#194B4B]/20 p-6 rounded-3xl text-center space-y-3">
              <div className="w-14 h-14 bg-[#194B4B] text-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Store size={28} />
              </div>
              <h2 className="text-xl font-black text-[#194B4B] dark:text-teal-300">Retrait en Pharmacie</h2>
              <p className="text-xs text-gray-600 dark:text-gray-300 max-w-xs mx-auto">
                Vos médicaments sont préparés et scellés par l'officine partenaire certifiée.
              </p>
            </div>

            {pharmacy && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{pharmacy.name || 'Pharmacie Partenaire'}</h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <MapPin size={13} className="text-[#194B4B]" />
                      {pharmacy.address || 'Adresse de retrait'}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200">
                    Prête au comptoir
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  {pharmacy.phone && (
                    <a href={`tel:${pharmacy.phone}`} className="flex-1 py-2.5 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                      <Phone size={14} className="text-emerald-600" /> Appeler
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pharmacy.address || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-[#194B4B] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Navigation size={14} /> Itinéraire
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING BOTTOM CARD (Affiché uniquement quand un vrai livreur est assigné) */}
      {!isPickup && hasAssignedDriver && isApproved && (
        <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-[28px] p-5 shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4 max-w-lg mx-auto">
            
            {/* Ligne 1: ETA, Véhicule & Plaque d'immatriculation */}
            <div 
              id="card-header-eta"
              onClick={() => setShowDetailsDrawer(true)}
              className="flex items-center justify-between cursor-pointer hover:opacity-90 transition"
            >
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">
                    {(eta !== null && eta > 0) ? `Arrive dans ~${eta} min` : 'Arrivé à destination !'}
                  </h3>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium capitalize mt-0.5">
                  {vehicleModel}
                </p>
              </div>

              <div className="flex flex-col items-end">
                {/* Badge Immatriculation */}
                <div className="bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-black text-gray-800 dark:text-gray-200 tracking-wider shadow-sm">
                  {vehiclePlate}
                </div>
                {/* Type de véhicule */}
                <div className="flex items-center gap-1 text-[11px] font-bold text-gray-400 mt-1">
                  <Bike size={14} className="text-[#194B4B] dark:text-teal-400" />
                  <span className="text-[10px] uppercase">{vehicleTypeLabel}</span>
                </div>
              </div>
            </div>

            {/* Séparateur */}
            <div className="h-px bg-gray-100 dark:bg-zinc-800 w-full" />

            {/* Ligne 2: Livreur (Photo + Note + Nom), Bouton Contact & Bouton Détails */}
            <div className="flex items-center justify-between pt-1">
              
              {/* Profil Livreur */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-700 shadow-md flex items-center justify-center">
                    {driverPhoto ? (
                      <img src={driverPhoto} alt={driverName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#194B4B]/15 text-[#194B4B] dark:text-teal-400 flex items-center justify-center font-black text-lg">
                        {driverFirstName.charAt(0)}
                      </div>
                    )}
                  </div>
                  
                  {/* Badge de Note */}
                  <div className="absolute -top-1.5 -right-2 bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded-full shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center gap-0.5 text-[10px] font-black text-gray-800 dark:text-gray-200">
                    <Star size={10} className="fill-[#FACC15] text-[#FACC15]" />
                    <span>{driverRating}</span>
                  </div>
                </div>

                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1.5 max-w-[80px] truncate text-center">
                  {driverFirstName}
                </span>
              </div>

              {/* Bouton Noter le livreur ou Contact */}
              {(order?.status === 'delivered' || order?.deliveryStage === 'completed') ? (
                <div className="flex-1 px-3">
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="w-full py-3 px-3 bg-[#FACC15] hover:bg-yellow-400 text-slate-900 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition"
                  >
                    <Star size={15} className="fill-slate-900" />
                    {order?.driverRating ? `Note: ${order.driverRating}/5 ⭐` : 'Noter le livreur'}
                  </button>
                </div>
              ) : (
                /* Bouton Contact Livreur */
                <div className="flex flex-col items-center">
                  <button
                    id="btn-contact-driver"
                    onClick={() => setShowContactModal(true)}
                    className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white flex items-center justify-center shadow-sm transition active:scale-95"
                    title="Contacter le livreur"
                  >
                    <Phone size={22} className="text-[#194B4B] dark:text-teal-300" />
                  </button>
                  <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mt-1.5">
                    Contact
                  </span>
                </div>
              )}

              {/* Bouton Détails */}
              <div className="flex flex-col items-center">
                <button
                  id="btn-details-drawer"
                  onClick={() => setShowDetailsDrawer(true)}
                  className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white flex items-center justify-center shadow-sm transition active:scale-95"
                  title="Afficher les détails de la commande"
                >
                  <div className="flex flex-col gap-1 items-center justify-center">
                    <span className="w-5 h-0.5 bg-gray-800 dark:bg-gray-200 rounded-full"></span>
                    <span className="w-5 h-0.5 bg-gray-800 dark:bg-gray-200 rounded-full"></span>
                    <span className="w-5 h-0.5 bg-gray-800 dark:bg-gray-200 rounded-full"></span>
                  </div>
                </button>
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mt-1.5">
                  Détails
                </span>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CONTACT DU LIVREUR */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[24px] p-6 shadow-2xl space-y-4 border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-[#194B4B]">
                  {driverPhoto ? <img src={driverPhoto} alt={driverName} className="w-full h-full object-cover" /> : driverFirstName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{driverName}</h4>
                  <p className="text-[11px] text-gray-500">Livreur certifié PharmAply</p>
                </div>
              </div>
              <button onClick={() => setShowContactModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 pt-2">
              {driverPhone && (
                <a
                  href={`tel:${driverPhone}`}
                  className="w-full py-3.5 px-4 bg-[#194B4B] hover:bg-[#143d3d] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <PhoneCall size={18} />
                  Appeler ({driverPhone})
                </a>
              )}

              <button
                onClick={() => {
                  setShowContactModal(false);
                  navigate(`/patient/messages/${order?.id}`);
                }}
                className="w-full py-3.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <MessageSquare size={18} className="text-[#194B4B] dark:text-teal-300" />
                Message dans l'application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / BOTTOM SHEET COMPLET DES DÉTAILS DE LIVRAISON */}
      {showDetailsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-t-[32px] max-h-[85vh] flex flex-col shadow-2xl border-t border-gray-100 dark:border-zinc-800">
            
            {/* Drawer Header */}
            <div className="p-5 pb-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#194B4B] dark:bg-teal-400"></div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                  Suivi de Commande #{order?.id?.slice(0, 8) || id?.slice(0, 8)}
                </h3>
              </div>
              <button 
                onClick={() => setShowDetailsDrawer(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:text-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Code PIN de Livraison Sécurisée */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                    <Key size={20} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                      Code de remise sécurisée
                    </p>
                    <p className="text-xl font-black text-amber-950 dark:text-amber-200 tracking-widest mt-0.5">
                      {deliveryOtp}
                    </p>
                  </div>
                </div>

                <button
                  onClick={copyDeliveryCode}
                  className="px-3 py-2 bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  {copiedOtp ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copiedOtp ? 'Copié' : 'Copier'}
                </button>
              </div>

              {/* Timeline de livraison */}
              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm">Progression de la livraison</h4>
                <div className="space-y-5 relative pl-2">
                  <div className="absolute left-[17px] top-[14px] bottom-[14px] w-0.5 bg-gray-100 dark:bg-zinc-800"></div>
                  {statuses.map((status, index) => {
                    const Icon = status.icon;
                    return (
                      <div key={index} className="flex items-start gap-4 relative z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white dark:border-zinc-900 shadow-sm ${
                          status.completed ? 'bg-[#194B4B] text-white' : 
                          status.active ? 'bg-amber-100 text-amber-700 border-amber-300 animate-pulse' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400'
                        }`}>
                          <Icon size={14} />
                        </div>
                        <div className="pt-0.5 flex-1">
                          <p className={`font-bold text-xs ${status.active || status.completed ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                            {status.label}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{status.date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Liste des Médicaments & Produits */}
              {order?.items && order.items.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Contenu de la commande</h4>
                    <span className="text-xs font-bold text-gray-500">{order.items.length} article(s)</span>
                  </div>

                  <div className="space-y-2 bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {item.quantity}x {item.name || item.productId}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                        </span>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-zinc-700 flex justify-between items-center text-sm">
                      <span className="font-black text-gray-900 dark:text-white">Total réglé</span>
                      <span className="font-black text-[#194B4B] dark:text-teal-300 text-base">
                        {formatCurrency(Number(order.total || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bouton Facture */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setShowDetailsDrawer(false);
                    setShowInvoiceModal(true);
                  }}
                  className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 text-gray-900 dark:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <FileText size={16} className="text-[#194B4B]" />
                  Afficher / Télécharger la Facture Officielle
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {order && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          order={order}
        />
      )}

      {/* MODAL DE NOTATION & CONFIRMATION DE LIVRAISON */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 border border-gray-100 dark:border-zinc-800 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800 border-2 border-[#194B4B]/20 flex items-center justify-center font-black text-lg text-[#194B4B]">
                  {driverPhoto ? (
                    <img src={driverPhoto} alt={driverName} className="w-full h-full object-cover" />
                  ) : (
                    driverFirstName.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-base">
                    Noter {driverFirstName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Votre avis aide à récompenser nos meilleurs livreurs
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowRatingModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Étoiles interactives */}
            <div className="text-center py-2 space-y-2">
              <div className="flex justify-center items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (ratingHover !== null ? ratingHover : ratingScore) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setRatingHover(star)}
                      onMouseLeave={() => setRatingHover(null)}
                      onClick={() => setRatingScore(star)}
                      className="p-1 text-3xl transition transform active:scale-125 hover:scale-110 focus:outline-none"
                    >
                      <Star 
                        size={36} 
                        className={active ? "fill-[#FACC15] text-[#FACC15]" : "text-gray-300 dark:text-zinc-700"} 
                      />
                    </button>
                  );
                })}
              </div>
              <div className="text-xs font-black text-[#194B4B] dark:text-teal-400 tracking-wide uppercase">
                {ratingScore === 5 && "⭐ Service Exceptionnel & Parfait"}
                {ratingScore === 4 && "⭐ Très bonne livraison"}
                {ratingScore === 3 && "⭐ Service Correct"}
                {ratingScore === 2 && "⭐ Décevant"}
                {ratingScore === 1 && "⭐ Insatisfaisant"}
              </div>
            </div>

            {/* Critères / Tags rapides */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                Qu'avez-vous particulièrement apprécié ?
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Ponctuel ⏰",
                  "Courtois & Souriant 😊",
                  "Médicaments intacts 📦",
                  "Communication fluide 💬",
                  "Livraison ultra-rapide ⚡",
                  "Respect des consignes 🛡️"
                ].map((tag) => {
                  const isSelected = selectedRatingTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleRatingTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                        isSelected 
                          ? "bg-[#194B4B] text-white border-[#194B4B]" 
                          : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-100"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Commentaire optionnel */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                Laisser un commentaire (facultatif)
              </label>
              <textarea
                rows={2}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Ex: Livreur très professionnel et attentif..."
                className="w-full bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-2xl p-3 text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#194B4B] transition resize-none"
              />
            </div>

            {/* Pourboire optionnel */}
            <div className="space-y-2 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Heart size={14} className="text-amber-600 fill-amber-600" />
                  Ajouter un pourboire au livreur ?
                </span>
                <span className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
                  {selectedTip > 0 ? `${selectedTip} FCFA` : '0 FCFA'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0, 200, 500, 1000].map((tip) => (
                  <button
                    key={tip}
                    type="button"
                    onClick={() => setSelectedTip(tip)}
                    className={`py-2 rounded-xl text-xs font-extrabold transition border ${
                      selectedTip === tip
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 border-amber-200/80 dark:border-zinc-700 hover:bg-amber-50"
                    }`}
                  >
                    {tip === 0 ? "Aucun" : `+${tip}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Bouton de validation */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitDriverRating}
                disabled={isSubmittingRating}
                className="w-full py-3.5 bg-[#194B4B] hover:bg-[#143d3d] text-white rounded-2xl font-bold text-sm shadow-md transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingRating ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <Star size={16} className="fill-[#FACC15] text-[#FACC15]" />
                    Confirmer & Enregistrer ma note
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
