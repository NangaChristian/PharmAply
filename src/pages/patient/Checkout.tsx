import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, UploadCloud, MapPin, CreditCard, ChevronRight, AlertTriangle, CheckCircle, FileText, Smartphone, Loader2, Package } from "lucide-react";
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
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Is this a cart checkout or single product checkout?
  const isCartCheckout = !id;

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
    if (!user || (!isCartCheckout && !product)) return;
    if (isCartCheckout && items.length === 0) return;
    
    if (!paymentMethod) {
      alert(t('select_payment_method', 'Please select a payment method.'));
      return;
    }
    setProcessing(true);
    try {
      let orderData: any;
      
      if (isCartCheckout) {
        orderData = {
          patientId: user.uid,
          pharmacyId: items[0]?.pharmacyId || 'multiple', // grouped in real app, simplified here
          items: items.map(i => ({ productId: i.id, name: i.name, price: i.price, quantity: i.quantity })),
          total: cartTotal + 1000,
          status: 'pending',
          createdAt: serverTimestamp(),
          deliveryAddress: "Douala, Akwa St.",
          paymentMethod,
          hasPrescription: !!prescriptionUrl,
          prescriptionUrl,
        };
      } else {
        orderData = {
          patientId: user.uid,
          pharmacyId: product.pharmacyId,
          items: [{
             productId: product.id,
             name: product.name,
             price: product.price,
             quantity: 1
          }],
          total: product.price + 1000,
          status: 'pending',
          createdAt: serverTimestamp(),
          deliveryAddress: "Douala, Akwa St.",
          paymentMethod,
          hasPrescription: product.needsPrescription ? !!prescriptionUrl : false,
          prescriptionUrl,
        };
      }
      
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Emit notification to Pharmacy
      await addDoc(collection(db, 'notifications'), {
        userId: orderData.pharmacyId || 'UNKNOWN',
        type: 'new_order',
        title: 'New Order Received',
        message: `You have received a new order for ${formatCurrency(orderData.total)}`,
        isRead: false,
        relatedId: docRef.id,
        createdAt: serverTimestamp()
      });
      
      if (isCartCheckout) clearCart();
      
      navigate(`/patient/tracking/${docRef.id}`);
    } catch (error) {
      setProcessing(false);
      alert(t('order_failed', 'Failed to confirm order. Please try again.'));
      try {
        handleFirestoreError(error, OperationType.CREATE, 'orders');
      } catch (e) {
        // Ignored, log error
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('loading_checkout', 'Loading checkout...')}</div>;
  if (!isCartCheckout && !product) return <div className="p-8 text-center text-sm text-gray-500">{t('product_not_found', 'Product not found')}</div>;
  if (isCartCheckout && items.length === 0) return <div className="p-8 text-center text-sm text-gray-500">{t('your_cart_is_empty', 'Your cart is empty')}</div>;

  const requiresPrescription = isCartCheckout ? false /* simplified */ : product?.needsPrescription;
  const deliveryFee = 1000;
  const totalItemsPrice = isCartCheckout ? cartTotal : product.price;

  return (
    <div className="flex-1 bg-gray-50 dark:bg-black flex flex-col h-full overflow-hidden relative">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 shadow-sm z-10 w-full fixed top-0">
         <button onClick={() => navigate(-1)} className="w-12 h-12 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full touch-manipulation">
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-sm">{t('checkout', 'Checkout')}</h1>
         <div className="w-12"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-28">
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
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.name}</h4>
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
                <div className="flex items-center gap-2 mb-3 px-1">
                   <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('prescription_validation', 'Prescription Validation')}</h3>
                   {!prescriptionUrl && <AlertTriangle size={14} className="text-red-500" />}
                </div>
                
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  accept="image/*,.pdf"
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
                       <p className="font-bold text-orange-900 dark:text-orange-400 text-sm">{uploading ? t('uploading', 'Uploading...') : t('upload_prescription', 'Upload Prescription')}</p>
                       <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">{t('legally_required', 'Legally required for this order')}</p>
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

         {/* Delivery Address */}
         <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm px-1">{t('delivery_address', 'Delivery Address')}</h3>
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                     <MapPin size={20} />
                  </div>
                  <div>
                     <p className="font-bold text-gray-900 dark:text-white text-sm">{t('home', 'Home')}</p>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"> {t('douala_akwa_st', 'Douala, Akwa St.')} </p>
                  </div>
               </div>
               <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
            </div>
         </div>

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
                   { id: "Fapshi", name: t('fapshi_payment', 'Fapshi (Mobile Money & Card)'), color: "blue", icon: <CreditCard size={16}/> }
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
           disabled={(requiresPrescription && !prescriptionUrl) || processing}
           className="w-full bg-[#16307b] hover:bg-[#122864] disabled:bg-gray-300 dark:disabled:bg-zinc-800 text-white rounded-[1.2rem] font-bold py-4 min-h-[56px] shadow-sm transition disabled:opacity-50 touch-manipulation"
           onClick={handleConfirmOrder}
         >
            {processing ? t('processing', 'Processing...') : (requiresPrescription && !prescriptionUrl ? t('upload_rx_to_continue', 'Upload Prescription to Continue') : t('confirm_pay', 'Confirm & Pay'))}
         </button>
      </div>
    </div>
  );
}
