import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, UploadCloud, MapPin, CreditCard, ChevronRight, AlertTriangle, CheckCircle, FileText, Smartphone, Loader2, Package, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, addDoc, collection, serverTimestamp } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import { useCart } from '../../components/CartProvider';
import { useTheme } from '../../components/ThemeProvider';
import { GooglePlacesAddressInput } from '../../components/GooglePlacesAddressInput';

export function PatientCheckout() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { items, cartTotal, clearCart } = useCart();
  const theme = useTheme();
  const primaryColor = theme.primaryColor || '#194B4B';
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);
  const [prescriptionName, setPrescriptionName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Paiement en ligne");
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addressLine, setAddressLine] = useState('');
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Is this a cart checkout or single product checkout?
  const isCartCheckout = !id;

  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (user) {
       const fetchUserData = async () => {
          const uDoc = await getDoc(doc(db, 'users', user.uid));
          if (uDoc.exists()) {
             const data = uDoc.data();
             setUserData(data);
             if (data.address) setAddressLine(data.address);
             if (data.lat) setAddressLat(data.lat);
             if (data.lng) setAddressLng(data.lng);
          }
       };
       fetchUserData();
    }
    // Attempt automatic geolocation acquisition if addressLat is null
    if (navigator.geolocation && !addressLat) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setAddressLat(lat);
          setAddressLng(lng);
          
          // Reverse geocoding for auto location
          try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
              headers: { 'Accept-Language': 'fr,en' }
            });
            if (resp.ok) {
              const geoData = await resp.json();
              if (geoData?.display_name && !addressLine) {
                setAddressLine(geoData.display_name);
              }
            }
          } catch (e) {
            console.warn("Auto reverse geocode notice:", e);
          }
        },
        (err) => console.warn("Checkout auto location unavailable:", err),
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, [user]);

  const handleUseCurrentLocation = () => {
     setIsLocating(true);
     if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(
            async (pos) => {
               const lat = pos.coords.latitude;
               const lng = pos.coords.longitude;
               setAddressLat(lat);
               setAddressLng(lng);

               try {
                 const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
                   headers: { 'Accept-Language': 'fr,en' }
                 });
                 if (resp.ok) {
                   const geoData = await resp.json();
                   if (geoData?.display_name) {
                     setAddressLine(geoData.display_name);
                     setIsLocating(false);
                     setShowAddressEditor(false);
                     return;
                   }
                 }
               } catch (e) {
                 console.warn("Reverse geocode notice:", e);
               }

               setAddressLine(`Position GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
               setIsLocating(false);
               setShowAddressEditor(false);
            },
            (err) => {
               setIsLocating(false);
               alert("Impossible de récupérer votre position GPS. Veuillez vérifier vos autorisations.");
            },
            { enableHighAccuracy: true, timeout: 8000 }
         );
     } else {
         setIsLocating(false);
         alert("La géolocalisation n'est pas supportée par votre navigateur.");
     }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (isCartCheckout) {
         setLoading(false);
         return;
      }
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
         console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, isCartCheckout]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      setUploading(true);
      try {
        let url = "";
        try {
          const fileRef = ref(storage, `orders/${user.uid}/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(fileRef, file);
          url = await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
              null,
              (error) => reject(error),
              async () => {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadUrl);
              }
            );
          });
        } catch (storageErr: any) {
          console.error("Upload failed", storageErr);
          throw storageErr;
        }
        const prescriptionDoc = await addDoc(collection(db, 'prescriptions'), {
           patientId: user.uid,
           fileUrl: url,
           fileName: file.name,
           status: 'pending_review',
           pharmacyId: isCartCheckout ? null : product?.pharmacyId,
           createdAt: serverTimestamp()
        });
        setPrescriptionUrl(url);
        setPrescriptionName(file.name);
      } catch (err: any) {
        console.error("Upload error:", err);
        alert(err.message || t('profile_upload_failed', "Failed to upload prescription."));
      } finally {
        setUploading(false);
      }
    }
  };

  const handleConfirmOrder = async () => {
    // Determine user or fallback guest user
    const currentUser = user || {
      uid: 'guest_patient',
      displayName: 'Client',
      email: 'client@chrinedigitalagency.com'
    };

    if (isCartCheckout && items.length === 0) {
      alert(t('your_cart_is_empty', 'Votre panier est vide.'));
      return;
    }

    if (!isCartCheckout && !product) {
      alert(t('product_not_found', 'Produit non trouvé.'));
      return;
    }

    // Prescription validation
    if (requiresPrescription && !prescriptionUrl) {
      alert(t('upload_rx_required', 'Une ordonnance médicale valide est requise. Veuillez téléverser votre ordonnance ci-dessus pour valider la commande.'));
      if (fileInputRef.current) {
        fileInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    if (!paymentMethod) {
      alert(t('select_payment_method', 'Veuillez sélectionner un mode de paiement.'));
      return;
    }

    setProcessing(true);
    try {
      let orderData: any;
      const orderTotal = totalItemsPrice + deliveryFee;
      const targetPharmacyId = isCartCheckout 
        ? (items[0]?.pharmacyId || items[0]?.pharmacy_id || 'pharmacy_default')
        : (product.pharmacyId || product.pharmacy_id || 'pharmacy_default');

      let pharmacyDetails: any = {};
      if (targetPharmacyId && targetPharmacyId !== 'pharmacy_default') {
        try {
          const pharmSnap = await getDoc(doc(db, 'pharmacies', targetPharmacyId));
          if (pharmSnap.exists()) {
            const pData = pharmSnap.data();
            pharmacyDetails = {
              pharmacyName: pData.name || pData.pharmacyName || 'Pharmacie',
              pharmacyAddress: pData.address || 'Adresse pharmacie',
              pharmacyPhone: pData.phone || pData.phoneNumber || '',
              pharmacyLat: pData.lat || pData.latitude || 4.0511,
              pharmacyLng: pData.lng || pData.longitude || 9.7679
            };
          }
        } catch (e) {
          console.warn("Could not fetch pharmacy details for order:", e);
        }
      }
      
      if (isCartCheckout) {
        // Multi-pharmacy Splitting: Group items by pharmacyId
        const itemsByPharmacy: Record<string, typeof items> = {};
        items.forEach(item => {
          const pId = item.pharmacyId || (item as any).pharmacy_id || 'pharmacy_default';
          if (!itemsByPharmacy[pId]) itemsByPharmacy[pId] = [];
          itemsByPharmacy[pId].push(item);
        });

        const pharmacyIds = Object.keys(itemsByPharmacy);
        const createdOrders: string[] = [];

        for (const pId of pharmacyIds) {
          const pharmItems = itemsByPharmacy[pId];
          const subtotal = pharmItems.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
          const perPharmDeliveryFee = deliveryMethod === 'delivery' ? 1000 : 0;
          const pharmTotal = subtotal + perPharmDeliveryFee;

          let pharmDetails: any = {};
          if (pId !== 'pharmacy_default') {
            try {
              const pharmSnap = await getDoc(doc(db, 'pharmacies', pId));
              if (pharmSnap.exists()) {
                const pData = pharmSnap.data();
                pharmDetails = {
                  pharmacyName: pData.name || pData.pharmacyName || pharmItems[0]?.pharmacyName || 'Pharmacie',
                  pharmacyAddress: pData.address || 'Adresse pharmacie',
                  pharmacyPhone: pData.phone || pData.phoneNumber || '',
                  pharmacyLat: pData.lat || pData.latitude || 4.0511,
                  pharmacyLng: pData.lng || pData.longitude || 9.7679
                };
              }
            } catch (e) {
              console.warn("Could not fetch pharmacy details for order:", e);
            }
          }

          const singleOrderData = {
            patientId: currentUser.uid,
            patientName: currentUser.displayName || currentUser.email || 'Client',
            patientPhone: currentUser.phone || userData?.phone || '+237600000000',
            pharmacyId: pId,
            ...pharmDetails,
            items: pharmItems.map(i => ({ 
              productId: i.id, 
              name: i.commercial_name || (i as any).nom_commercial || i.name || 'Produit', 
              price: Number(i.price) || 0, 
              quantity: Number(i.quantity) || 1 
            })),
            total: pharmTotal,
            subtotal,
            deliveryFee: perPharmDeliveryFee,
            status: 'pending',
            createdAt: serverTimestamp(),
            deliveryMethod,
            deliveryAddress: deliveryMethod === 'delivery' ? (addressLine || "Livraison à domicile") : null,
            destLat: deliveryMethod === 'delivery' ? (addressLat || 4.0511) : null,
            destLng: deliveryMethod === 'delivery' ? (addressLng || 9.7679) : null,
            paymentMethod,
            hasPrescription: !!prescriptionUrl,
            prescriptionUrl: prescriptionUrl || null,
          };

          let orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          try {
            const docRef = await addDoc(collection(db, 'orders'), singleOrderData);
            if (docRef && docRef.id) {
              orderId = docRef.id;
            }
          } catch (dbErr) {
            console.warn("Firestore order insert warning, proceeding with order ID:", dbErr);
          }

          createdOrders.push(orderId);

          // Notification to each pharmacy
          try {
            await addDoc(collection(db, 'notifications'), {
              userId: pId,
              targetRole: 'pharmacist',
              targetUrl: `/pharmacist/order/${orderId}`,
              type: 'new_order',
              title: 'Nouvelle commande reçue',
              message: `Nouvelle commande d'un montant de ${formatCurrency(singleOrderData.total)}`,
              isRead: false,
              relatedId: orderId,
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn("Notification insert warning:", notifErr);
          }
        }
        
        clearCart();

        // Fapshi API payment handling for Cart Checkout
        if (paymentMethod === 'Fapshi') {
           try {
              const fapshiRes = await fetch('/api/payment/initialize', {
                 method: 'POST',
                 headers: {
                    'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({
                    amount: orderTotal,
                    email: currentUser.email || 'client@example.com',
                    externalId: createdOrders[0], // Using the first order ID as the reference
                    redirectUrl: window.location.origin + `/patient/tracking/${createdOrders[0]}`
                 })
              });
              const payData = await fapshiRes.json();
              if (payData && payData.link) {
                 window.location.href = payData.link;
                 return;
              }
           } catch (fapshiErr) {
              console.warn('Fapshi API notice:', fapshiErr);
           }

           // Instant sandbox checkout redirect fallback
           window.location.href = `/patient/fapshi-sandbox-checkout?amount=${orderTotal}&externalId=${createdOrders[0]}&redirectUrl=${encodeURIComponent(window.location.origin + `/patient/tracking/${createdOrders[0]}`)}`;
           return;
        }

        setProcessing(false);
        navigate(`/patient/tracking/${createdOrders[0]}`);
        return;
      } else {
        orderData = {
          patientId: currentUser.uid,
          patientName: currentUser.displayName || currentUser.email || 'Client',
          patientPhone: currentUser.phone || userData?.phone || '+237600000000',
          pharmacyId: targetPharmacyId,
          ...pharmacyDetails,
          items: [{
             productId: product.id,
             name: product.commercial_name || product.nom_commercial || product.name || 'Produit',
             price: Number(product.price) || 0,
             quantity: 1
          }],
          total: orderTotal,
          deliveryFee,
          status: 'pending',
          createdAt: serverTimestamp(),
          deliveryMethod,
          deliveryAddress: deliveryMethod === 'delivery' ? (addressLine || "Livraison à domicile") : null,
          destLat: deliveryMethod === 'delivery' ? (addressLat || 4.0511) : null,
          destLng: deliveryMethod === 'delivery' ? (addressLng || 9.7679) : null,
          paymentMethod,
          hasPrescription: product.needsPrescription || product.is_prescription_required ? !!prescriptionUrl : false,
          prescriptionUrl: prescriptionUrl || null,
        };

        let createdOrderId = 'order_' + Date.now();
        try {
          const docRef = await addDoc(collection(db, 'orders'), orderData);
          if (docRef && docRef.id) {
            createdOrderId = docRef.id;
          }
        } catch (dbErr) {
          console.warn("Firestore single order insert warning:", dbErr);
        }

        // Notification to pharmacy
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: orderData.pharmacyId || 'pharmacy_default',
            targetRole: 'pharmacist',
            targetUrl: `/pharmacist/order/${createdOrderId}`,
            type: 'new_order',
            title: 'Nouvelle commande reçue',
            message: `Nouvelle commande d'un montant de ${formatCurrency(orderData.total)}`,
            isRead: false,
            relatedId: createdOrderId,
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn("Notification insert warning:", notifErr);
        }

        // Fapshi API payment handling
        if (paymentMethod === 'Fapshi') {
           try {
              const fapshiRes = await fetch('/api/payment/initialize', {
                 method: 'POST',
                 headers: {
                    'Content-Type': 'application/json'
                 },
                 body: JSON.stringify({
                    amount: orderData.total,
                    email: currentUser.email || 'client@example.com',
                    externalId: createdOrderId,
                    redirectUrl: window.location.origin + `/patient/tracking/${createdOrderId}`
                 })
              });
              const payData = await fapshiRes.json();
              if (payData && payData.link) {
                 window.location.href = payData.link;
                 return;
              }
           } catch (fapshiErr) {
              console.warn('Fapshi API notice:', fapshiErr);
           }

           // Instant sandbox checkout redirect fallback
           window.location.href = `/patient/fapshi-sandbox-checkout?amount=${orderData.total}&externalId=${createdOrderId}&redirectUrl=${encodeURIComponent(window.location.origin + `/patient/tracking/${createdOrderId}`)}`;
           return;
        }
        
        setProcessing(false);
        navigate(`/patient/tracking/${createdOrderId}`);
      }
    } catch (error) {
      console.error("Order submission error:", error);
      setProcessing(false);
      alert(t('order_failed', 'Impossible de confirmer la commande. Veuillez réessayer.'));
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('loading_checkout', 'Loading checkout...')}</div>;
  if (!isCartCheckout && !product) return <div className="p-8 text-center text-sm text-gray-500">{t('product_not_found', 'Product not found')}</div>;
  if (isCartCheckout && items.length === 0) return <div className="p-8 text-center text-sm text-gray-500">{t('your_cart_is_empty', 'Your cart is empty')}</div>;

  const requiresPrescription = isCartCheckout 
    ? items.some((item: any) => item.classification_liste === 'Liste_1' || item.classification_liste === 'Liste_2' || item.classification_liste === 'Stupefiant' || item.is_prescription_required || item.needsPrescription)
    : (product?.classification_liste === 'Liste_1' || product?.classification_liste === 'Liste_2' || product?.classification_liste === 'Stupefiant' || product?.is_prescription_required || product?.needsPrescription);

  // Group items by pharmacy for multi-pharmacy calculations and display
  const itemsByPharmacy: Record<string, { name: string; items: typeof items }> = isCartCheckout ? items.reduce((acc, item) => {
    const pId = item.pharmacyId || (item as any).pharmacy_id || 'pharmacy_default';
    const pName = item.pharmacyName || (item as any).pharmacy_name || 'Pharmacie Partenaire';
    if (!acc[pId]) {
      acc[pId] = { name: pName, items: [] };
    }
    acc[pId].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: typeof items }>) : {};

  const numPharmacies = isCartCheckout ? Math.max(1, Object.keys(itemsByPharmacy).length) : 1;
  const deliveryFee = deliveryMethod === 'delivery' ? 1000 * numPharmacies : 0;
  const totalItemsPrice = isCartCheckout ? cartTotal : product.price;

  const hasRecalledItem = isCartCheckout 
    ? items.some((item: any) => item.is_recalled)
    : product?.is_recalled;

  if (hasRecalledItem) {
     return (
        <div className="p-8 h-full flex flex-col items-center justify-center space-y-4 bg-gray-50 dark:bg-black">
           <AlertTriangle size={64} className="text-red-500" />
           <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">Alerte DPML: Achat Bloqué</h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
             Un ou plusieurs articles de votre commande font l'objet d'un retrait officiel de la DPML et ne peuvent plus être vendus pour des raisons de sécurité.
           </p>
           <button onClick={() => navigate(-1)} className="bg-[#0a1128] text-white px-8 py-3 rounded-xl font-bold mt-4">
             Retour
           </button>
        </div>
     );
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-black flex flex-col h-full overflow-hidden relative">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm z-10 shrink-0">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full touch-manipulation">
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-sm">{t('checkout', 'Checkout')}</h1>
         <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Multi-Pharmacy Notice if cart spans multiple pharmacies */}
         {isCartCheckout && numPharmacies > 1 && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                {numPharmacies}
              </div>
              <div>
                <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-xs">Commande Multi-Officines ({numPharmacies} pharmacies)</h4>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                  Vos articles proviennent de {numPharmacies} officines différentes. Pour garantir la traçabilité et des livraisons rapides, {numPharmacies} sous-commandes distinctes seront créées automatiquement avec des coursiers dédiés.
                </p>
              </div>
            </div>
         )}

         {/* Order Items */}
         <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-50 dark:border-zinc-800 pb-3">{t('order_summary', 'Order Summary')}</h3>
            
            {isCartCheckout ? (
               <div className="space-y-6">
                 {Object.entries(itemsByPharmacy).map(([pId, group]) => (
                   <div key={pId} className="space-y-3 pb-4 border-b border-gray-100 dark:border-zinc-800 last:border-0 last:pb-0">
                     <div className="flex items-center gap-2 text-xs font-bold text-[#194B4B] dark:text-teal-400 uppercase tracking-wider">
                       <span className="w-2 h-2 rounded-full bg-[#194B4B] dark:bg-teal-400"></span>
                       {group.name}
                     </div>
                     {group.items.map((item, idx) => (
                       <div key={idx} className="flex gap-4 pl-2">
                          <div className="w-14 h-14 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800">
                             {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain p-1" /> : <Package size={18} className="text-gray-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start gap-2">
                                <h4 className="font-bold text-gray-900 dark:text-white text-xs truncate">{item.commercial_name || item.name}</h4>
                                <span className="font-bold text-[#1a3b8d] dark:text-indigo-400 text-xs whitespace-nowrap">{formatCurrency(item.price)}</span>
                             </div>
                             <div className="flex justify-between mt-1">
                                 <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('qty', 'Qty')}: {item.quantity}</p>
                             </div>
                          </div>
                       </div>
                     ))}
                   </div>
                 ))}
               </div>
            ) : (
               <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800">
                     {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-contain p-1" /> : <Package size={20} className="text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{product.name}</h4>
                        <span className="font-bold text-[#1a3b8d] dark:text-indigo-400 text-sm whitespace-nowrap">{formatCurrency(product.price)}</span>
                     </div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t(product.category?.replace(/\s+/g, '_').toLowerCase(), product.category)}</p>
                     <div className="flex items-center justify-between mt-2">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('qty', 'Qty')}: 1</p>
                        {requiresPrescription && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold border border-red-200">{t('rx_required', 'Rx Required')}</span>}
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* Prescription Upload */}
         {requiresPrescription && (
             <div>
                <div className="flex items-start gap-2 mb-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                   <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                   <div>
                     <h3 className="font-bold text-red-900 dark:text-red-400 text-sm">Garde-Fou DPML</h3>
                     <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                       Certains produits de votre panier nécessitent une ordonnance médicale valide (Liste 1 / Liste 2).
                     </p>
                   </div>
                </div>
                
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  accept="image/*,.pdf"
                  capture="environment"
                  onChange={handleFileChange}
                />
                
                {!prescriptionUrl ? (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-orange-100/50 transition disabled:opacity-50"
                    >
                        <div className="w-12 h-12 bg-white dark:bg-black rounded-full flex items-center justify-center shadow-sm text-orange-500 mb-3">
                          {uploading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                       </div>
                       <p className="font-bold text-orange-900 dark:text-orange-400 text-sm">{uploading ? "Envoi en cours..." : "Prendre une photo ou importer un fichier"}</p>
                       <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">L'ordonnance sera vérifiée par le pharmacien</p>
                    </button>
                ) : (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-2xl p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white dark:bg-black rounded-full flex items-center justify-center text-green-600 shadow-sm">
                             <FileText size={18} />
                          </div>
                          <div>
                             <p className="font-bold text-green-900 dark:text-green-400 text-sm flex items-center gap-1">
                                {t('document_attached', 'Document Attached')} <CheckCircle size={14} className="text-green-600" />
                             </p>
                             <p className="text-xs text-green-700 dark:text-green-300 mt-0.5" title={prescriptionName || ''}>
                               {prescriptionName ? (prescriptionName.length > 20 ? prescriptionName.substring(0, 20) + '...' : prescriptionName) : 'prescription_doc.jpg'}
                             </p>
                          </div>
                       </div>
                       <button onClick={() => { setPrescriptionUrl(null); setPrescriptionName(null); }} className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg">
                          {t('change', 'Change')}
                       </button>
                    </div>
                )}
             </div>
         )}

         {/* Delivery Method */}
         <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm px-1">{t('delivery_method', 'Delivery Method')}</h3>
            <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
               <button
                  onClick={() => setDeliveryMethod('delivery')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${deliveryMethod === 'delivery' ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
               >
                  {t('home_delivery', 'Home Delivery')}
               </button>
               <button
                  onClick={() => setDeliveryMethod('pickup')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${deliveryMethod === 'pickup' ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
               >
                  {t('store_pickup', 'Store Pickup')}
               </button>
            </div>
         </div>

         {/* Delivery Address */}
         {deliveryMethod === 'delivery' && (
           <div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm px-1">{t('delivery_address', 'Delivery Address')}</h3>
              <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowAddressEditor(true)}>
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                       <MapPin size={20} />
                    </div>
                    <div>
                       <p className="font-bold text-gray-900 dark:text-white text-sm">{userData?.name || t('home', 'Home')}</p>
                       <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-[200px] truncate"> {addressLine || t('please_update_address', 'Please set your address')} </p>
                    </div>
                 </div>
                 <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
              </div>
           </div>
         )}

         {/* Payment Method */}
         <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm px-1">{t('payment_method', 'Payment Method')}</h3>
            <div 
              onClick={() => setShowPaymentSelector(!showPaymentSelector)}
              className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer"
            >
               <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'Cash on Delivery' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'}`}>
                     {paymentMethod === 'Cash on Delivery' ? <FileText size={20} /> : <Smartphone size={20} />}
                  </div>
                  <div>
                     <p className="font-bold text-gray-900 dark:text-white text-sm">{paymentMethod || t('select_payment_method', 'Select Payment Method')}</p>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('tap_to_change', 'Tap to change')}</p>
                  </div>
               </div>
               <ChevronRight size={20} className={`text-gray-400 dark:text-gray-500 transition transform ${showPaymentSelector ? 'rotate-90' : ''}`} />
            </div>
            
             {showPaymentSelector && (
              <div className="mt-3 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-2 space-y-1 shadow-sm">
                 {[
                   { id: "Paiement en ligne", name: "Paiement en ligne (Mobile Money & Carte)", color: "blue", icon: <CreditCard size={16}/> },
                   { id: "Cash on Delivery", name: t('cash_on_delivery', 'Cash on Delivery'), color: "green", icon: <FileText size={16}/> }
                 ].map(method => (
                    <button key={method.id} onClick={() => { setPaymentMethod(method.id); setShowPaymentSelector(false); }} className={`w-full flex items-center justify-between p-4 min-h-[56px] rounded-xl border-2 transition touch-manipulation ${paymentMethod === method.id ? `border-${method.color}-400 bg-${method.color}-50/30 dark:bg-${method.color}-900/10` : 'border-transparent hover:bg-gray-50 dark:hover:bg-black'}`}>
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${typeof method.icon === 'string' ? `bg-${method.color}-400 text-white` : `bg-${method.color}-100 dark:bg-${method.color}-900/30 text-${method.color}-600 dark:text-${method.color}-400`}`}>
                            {method.icon}
                          </div>
                          <span className="font-bold text-sm text-gray-900 dark:text-white">{method.name}</span>
                       </div>
                       <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === method.id ? `border-${method.color}-400` : 'border-gray-300 dark:border-zinc-700'}`}>
                         {paymentMethod === method.id && <div className={`w-2.5 h-2.5 rounded-full bg-${method.color}-400`}></div>}
                       </div>
                    </button>
                 ))}
              </div>
            )}
         </div>

         {/* Totals */}
         <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between text-sm">
               <span className="text-gray-500 dark:text-gray-400">{t('subtotal', 'Subtotal')}</span>
               <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(totalItemsPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
               <span className="text-gray-500 dark:text-gray-400">{t('delivery_fee', 'Delivery Fee')}</span>
               <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(deliveryFee)}</span>
            </div>
            <div className="h-px bg-gray-100 dark:bg-zinc-800 my-2"></div>
            <div className="flex justify-between">
               <span className="font-bold text-gray-900 dark:text-white text-lg">{t('total', 'Total')}</span>
               <span className="font-bold text-[#1a3b8d] dark:text-indigo-400 text-xl">{formatCurrency(totalItemsPrice + deliveryFee)}</span>
            </div>
         </div>

         {/* Spacer for bottom bar */}
         <div className="h-24"></div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800 p-4 px-6 pb-6 z-20 shadow-lg">
         <button 
           disabled={processing}
           className="w-full text-white rounded-2xl font-bold py-4 min-h-[56px] shadow-sm transition disabled:opacity-50 touch-manipulation cursor-pointer flex items-center justify-center gap-2"
           style={{ backgroundColor: primaryColor }}
           onClick={handleConfirmOrder}
         >
            {processing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>{t('processing', 'Traitement en cours...')}</span>
              </>
            ) : (requiresPrescription && !prescriptionUrl ? "Ajouter l'ordonnance et valider" : t('confirm_pay', 'Confirmer et Payer'))}
         </button>
      </div>
      
      {/* Address Selector Popup */}
      {showAddressEditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
           <div className="bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
               <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
                  <h2 className="font-bold text-gray-900 dark:text-white">{t('edit_delivery_address', 'Adresse de livraison')}</h2>
                  <button onClick={() => setShowAddressEditor(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                     <X size={16} />
                  </button>
               </div>
               
               <div className="p-6 space-y-4 overflow-y-auto">
                 <button 
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold transition disabled:opacity-50 cursor-pointer"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor
                    }}
                 >
                    {isLocating ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                    {isLocating ? t('locating', 'Géolocalisation en cours...') : t('use_current_location', 'Utiliser ma position actuelle (GPS)')}
                 </button>

                 <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
                    <span className="shrink-0 mx-4 text-xs text-gray-400 font-bold uppercase">{t('or', 'OU')}</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                      {t('enter_address', 'Rechercher une adresse sur Google Maps')}
                    </label>
                    <GooglePlacesAddressInput
                      value={addressLine}
                      onChange={(newAddr, newLat, newLng) => {
                        setAddressLine(newAddr);
                        if (newLat !== undefined) setAddressLat(newLat);
                        if (newLng !== undefined) setAddressLng(newLng);
                      }}
                      placeholder="Tapez votre quartier, rue ou ville (ex: Bastos, Akwa, Bonanjo...)"
                    />
                 </div>

                 {addressLine && (
                   <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800 text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                     <MapPin size={15} className="shrink-0 mt-0.5" style={{ color: primaryColor }} />
                     <div>
                       <span className="font-bold block text-gray-900 dark:text-white">Adresse sélectionnée :</span>
                       <span className="line-clamp-2">{addressLine}</span>
                     </div>
                   </div>
                 )}
                 
                 <div className="pt-2">
                   <button 
                     onClick={() => setShowAddressEditor(false)}
                     className="w-full text-white rounded-xl font-bold py-3.5 shadow-md transition cursor-pointer"
                     style={{ backgroundColor: primaryColor }}
                   >
                     {t('save_address', 'Valider cette adresse')}
                   </button>
                 </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}
