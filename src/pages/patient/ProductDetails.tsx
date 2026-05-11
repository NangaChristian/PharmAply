import { useState, useEffect } from "react";
import { ArrowLeft, Heart, Star, Share2, Activity, Pill, ShieldAlert, FileText, ChevronRight } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from 'firebase/firestore';
import { formatCurrency } from '../../lib/utils';
import { db } from '../../lib/firebase';
import { useTranslation } from "react-i18next";

export function PatientProductDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
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
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm text-gray-500">{t('loading_product', 'Loading product...')}</div>;
  if (!product) return <div className="p-8 text-center text-sm text-gray-500">{t('product_not_found', 'Product not found')}</div>;

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white z-10 sticky top-0">
         <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full">
            <ArrowLeft size={20} className="text-gray-900" />
         </button>
         <h1 className="font-bold text-gray-900 text-sm">{t('product_details', 'Product Details')}</h1>
         <div className="flex gap-2">
            <button className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full">
               <Heart size={20} className="text-gray-600" />
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
         {/* Product Image */}
         <div className="h-64 bg-slate-50 flex items-center justify-center p-6 mx-6 rounded-3xl mb-6 mt-2 relative">
            <Pill size={80} className="text-indigo-200" />
            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold text-gray-700 shadow-sm">
               <Star size={12} className="text-yellow-400 fill-current" />
               {product.rating || "5.0"}
            </div>
         </div>

         {/* Product Info */}
         <div className="px-6 space-y-6">
            <div>
               <div className="flex justify-between items-start mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
                  <span className="text-xl font-bold text-indigo-600">{formatCurrency(product.price)}</span>
               </div>
               <p className="text-sm text-gray-500">{t(product.category?.replace(/\s+/g, '_').toLowerCase(), product.category)}</p>
            </div>

            {/* Prescription Warning */}
            {product.needsPrescription && (
               <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3">
                  <ShieldAlert className="text-orange-500 shrink-0" size={24} />
                  <div>
                     <h4 className="text-orange-900 font-bold text-sm">{t('prescription_required', 'Prescription Required')}</h4>
                     <p className="text-orange-700/80 text-xs mt-1">{t('prescription_required_desc', 'You will need to upload a valid prescription before checking out.')}</p>
                  </div>
               </div>
            )}

            {/* Tabs (Static for now) */}
            <div className="flex gap-6 border-b border-gray-100">
               <button className="pb-3 border-b-2 border-indigo-600 font-bold text-indigo-600 text-sm">{t('about_tab', 'About')}</button>
               <button className="pb-3 text-gray-400 font-medium text-sm hover:text-gray-600">{t('details_tab', 'Details')}</button>
               <button className="pb-3 text-gray-400 font-medium text-sm hover:text-gray-600">{t('effects_tab', 'Effects')}</button>
               <button className="pb-3 text-gray-400 font-medium text-sm hover:text-gray-600">{t('reviews_tab', 'Reviews')}</button>
            </div>

            <div>
               <h4 className="font-bold text-gray-900 text-sm mb-2">{t('description', 'Description')}</h4>
               <p className="text-sm text-gray-500 leading-relaxed">
                 {t('product_description_content', '{{name}} is available in {{stock}} units. Recommended for {{category}}.')
                    .replace('{{name}}', product.name)
                    .replace('{{stock}}', product.stock)
                    .replace('{{category}}', t(product.category?.replace(/\s+/g, '_').toLowerCase(), product.category)?.toLowerCase() || '')}
               </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center cursor-pointer">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                     <FileText size={18} />
                  </div>
                  <div>
                     <p className="font-bold text-gray-900 text-sm">{t('how_to_use', 'How to use')}</p>
                     <p className="text-xs text-gray-500">{t('read_patient_leaflet', 'Read the patient leaflet')}</p>
                  </div>
               </div>
               <ChevronRight size={20} className="text-gray-400" />
            </div>
         </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 px-6 flex gap-4 pb-8 z-50">
         <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3">
            <button className="text-gray-500 font-bold text-lg px-2">-</button>
            <span className="font-bold text-gray-900 mx-4">1</span>
            <button className="text-indigo-600 font-bold text-lg px-2">+</button>
         </div>
         <button 
           className="flex-1 bg-indigo-600 text-white rounded-2xl font-bold py-3 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
           onClick={() => navigate(`/patient/checkout/${product.id}`)}
         >
            {t('add_to_cart', 'Add to cart')}
         </button>
      </div>
    </div>
  );
}
