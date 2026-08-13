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

export function PatientCheckout() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { items, cartTotal, clearCart } = useCart();
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);
  const [prescriptionName, setPrescriptionName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Fapshi");
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
        (pos) => {
          setAddressLat(pos.coords.latitude);
          setAddressLng(pos.coords.longitude);
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
            (pos) => {
               setIsLocating(false);
               setAddressLat(pos.coords.latitude);
               setAddressLng(pos.coords.longitude);
               setAddressLine("Current Location (Lat/Lng)");
               setShowAddressEditor(false);
            },
            (err) => {
               setIsLocating(false);
               alert("Could not retrieve location. Please check your browser permissions.");
            }
         );
     } else {
         setIsLocating(false);
         alert("Geolocation is not supported by your browser.");
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
        orderData = {
          patientId: currentUser.uid,
          patientName: currentUser.displayName || currentUser.email || 'Client',
          patientPhone: currentUser.phone || userData?.phone || '+237600000000',
          pharmacyId: targetPharmacyId,
          ...pharmacyDetails,
          items: items.map(i => ({ 
            productId: i.id, 
            name: i.commercial_name || i.nom_commercial || i.name || 'Produit', 
            price: Number(i.price) || 0, 
            quantity: Number(i.quantity) || 1 
          })),
          total: orderTotal,
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
      }
      
      let createdOrderId = 'order_' + Date.now();
      try {
        const docRef = await addDoc(collection(db, 'orders'), orderData);
        if (docRef && docRef.id) {
          createdOrderId = docRef.id;
        }
      } catch (dbErr) {
        console.warn("Firestore order insert warning, proceeding with order ID:", dbErr);
      }

      // Notification to pharmacy
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: orderData.pharmacyId || 'pharmacy_default',
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
      
      if (isCartCheckout) clearCart();
      
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
            } else if (payData && !payData.success) {
               console.warn('Fapshi initiation response:', payData.error);
            }
         } catch (fapshiErr) {
            console.warn('Fapshi API skipped or unreachable:', fapshiErr);
         }
      }
      
      setProcessing(false);
      navigate(`/patient/tracking/${createdOrderId}`);
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

  const deliveryFee = deliveryMethod === 'delivery' ? 1000 : 0;
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
         {/* Order Items */}
         <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-50 dark:border-zinc-800 pb-3">{t('order_summary', 'Order Summary')}</h3>
            
            {isCartCheckout ? (
               <div className="space-y-4">
                 {items.map((item, idx) => (
                   <div key={idx} className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-gray-100 dark:border-zinc-800">
                         {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain p-1" /> : <Package size={20} className="text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.commercial_name || item.name}</h4>
                            <span className="font-bold text-[#1a3b8d] dark:text-indigo-400 text-sm whitespace-nowrap">{formatCurrency(item.price)}</span>
                         </div>
                         <div className="flex justify-between mt-2">
                             <p className="text-xs text-gray-600 dark:text-gray-400">{t('qty', 'Qty')}: {item.quantity}</p>
                         </div>
                      </div>
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
                   { id: "Fapshi", name: t('fapshi_payment', 'Fapshi (Mobile Money & Card)'), color: "blue", icon: <CreditCard size={16}/> },
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

      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 p-4 px-6 pb-8 z-20">
         <button 
           disabled={processing}
           className="w-full bg-[#0a1128] hover:bg-[#122864] disabled:bg-gray-300 dark:disabled:bg-zinc-800 text-white rounded-2xl font-bold py-4 min-h-[56px] shadow-sm transition disabled:opacity-50 touch-manipulation cursor-pointer"
           onClick={handleConfirmOrder}
         >
            {processing ? t('processing', 'Traitement en cours...') : (requiresPrescription && !prescriptionUrl ? "Ajouter l'ordonnance et valider" : t('confirm_pay', 'Confirmer et Payer'))}
         </button>
      </div>
      
      {/* Address Selector Popup */}
      {showAddressEditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
           <div className="bg-white dark:bg-black rounded-t-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
               <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
                  <h2 className="font-bold text-gray-900 dark:text-white">{t('edit_delivery_address', 'Delivery Address')}</h2>
                  <button onClick={() => setShowAddressEditor(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                     <X size={16} />
                  </button>
               </div>
               
               <div className="p-6 space-y-4 overflow-y-auto">
                 <button 
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition disabled:opacity-50"
                 >
                    {isLocating ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                    {isLocating ? t('locating', 'Locating...') : t('use_current_location', 'Use current location')}
                 </button>

                 <div className="relative flex items-center py-4">
                    <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
                    <span className="shrink-0 mx-4 text-sm text-gray-400 font-bold uppercase">{t('or', 'or')}</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-zinc-800"></div>
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">{t('enter_address', 'Enter address manually')}</label>
                    <input 
                      type="text" 
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder={t('address_placeholder', 'e.g. 123 Main St, Appt 4B')}
                      className="w-full p-4 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition"
                    />
                 </div>
                 
                 <div className="pt-4">
                   <button 
                     onClick={() => setShowAddressEditor(false)}
                     className="w-full bg-[#0a1128] hover:bg-[#122864] text-white rounded-xl font-bold py-4 transition"
                   >
                     {t('save_address', 'Save Address')}
                   </button>
                 </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}
