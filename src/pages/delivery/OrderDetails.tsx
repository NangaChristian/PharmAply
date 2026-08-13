import { useState, useEffect } from "react";
import { ArrowLeft, Navigation, MapPin, Phone, MessageCircle, Clock, CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../lib/utils";

export function DeliveryOrderDetails() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
         console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleAcceptOrder = async () => {
    if (!order || !user) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'driver_assigned', driverId: user.uid });
      toast.success("Livraison acceptée avec succès !");
      // navigate to the active delivery view
      navigate('/delivery/deliveries');
    } catch (error) {
      toast.error("Erreur lors de l'acceptation de la livraison.");
      handleFirestoreError(error, OperationType.UPDATE, 'orders');
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('loading_order_details', 'Loading order details...')} </div>;
  if (!order) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('order_not_found', 'Order not found')} </div>;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-black shadow-sm z-10">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full hover:bg-gray-100 dark:bg-zinc-900">
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-sm"> {t('delivery', 'Delivery #')} {order.id.slice(0,8)}</h1>
         <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         {/* Delivery Stats mini */}
         <div className="bg-white dark:bg-black rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 flex divide-x divide-gray-100 text-center">
            <div className="flex-1 px-2">
               <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1"> {t('earning', 'Earning')} </p>
               <p className="font-bold text-gray-900 dark:text-white text-lg">{formatCurrency((order.total || 0) * 0.1)}</p>
            </div>
            <div className="flex-1 px-2">
               <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1"> {t('items', 'Items')} </p>
               <p className="font-bold text-gray-900 dark:text-white text-lg">{order.items?.length || 1}</p>
            </div>
            <div className="flex-1 px-2">
               <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1"> {t('time', 'Time')} </p>
               <p className="font-bold text-gray-900 dark:text-white text-lg"> {t('asap', 'ASAP')} </p>
            </div>
         </div>

         {/* Locations */}
         <div className="bg-white dark:bg-black rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-zinc-800 relative">
            <div className="absolute left-[33px] top-[40px] bottom-[40px] w-0.5 bg-gray-200 border-l border-dashed border-gray-300"></div>
            
            <div className="flex gap-4 mb-6 relative z-10">
               <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                  <MapPin size={14} className="fill-current" />
               </div>
               <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium"> {t('pickup_pharmacy', 'Pickup Pharmacy')} </p>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">{order.pharmacyName || t('pharmacy', 'Pharmacy')}</p>
               </div>
            </div>

            <div className="flex gap-4 relative z-10">
               <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <Navigation size={14} className="fill-current" />
               </div>
               <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium"> {t('drop_off_customer', 'Drop-off Customer')} </p>
                  <p className="font-bold text-gray-900 dark:text-white mt-0.5">{order.patientName || t('customer', 'Customer')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{order.deliveryAddress}</p>
               </div>
            </div>
         </div>

         {/* Contact & Actions */}
         <div className="flex gap-3">
             {order.patientPhone ? (
               <a href={`tel:${order.patientPhone}`} className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 dark:bg-black transition">
                  <Phone size={20} className="text-green-600" />
                  <span className="text-xs font-bold"> {t('call', 'Call')} </span>
               </a>
             ) : (
               <button onClick={() => alert("Phone number not available")} className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 dark:bg-black transition">
                  <Phone size={20} className="text-green-600" />
                  <span className="text-xs font-bold"> {t('call', 'Call')} </span>
               </button>
             )}
             <button onClick={() => navigate(`/delivery/messages/${order.id}`)} className="flex-1 bg-white dark:bg-slate-950 border border-gray-200 dark:border-zinc-800 rounded-2xl py-4 flex flex-col items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 dark:bg-black transition">
                <MessageCircle size={20} className="text-blue-600" />
                <span className="text-xs font-bold"> {t('message', 'Message')} </span>
             </button>
         </div>

         <div className="h-24"></div>
      </div>

      {/* Accept Button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-black border-t border-gray-100 dark:border-zinc-800 p-4 px-6 pb-8 z-50">
         <button disabled={processing} onClick={handleAcceptOrder} className="w-full bg-indigo-600 disabled:bg-indigo-400 text-white rounded-2xl font-bold py-4 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-2">
            {processing ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Acceptation...</span>
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                <span>Accept Delivery</span>
              </>
            )}
         </button>
      </div>
    </div>
  );
}
