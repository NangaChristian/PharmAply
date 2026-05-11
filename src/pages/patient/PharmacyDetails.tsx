import { useState, useEffect } from "react";
import { ArrowLeft, Star, MapPin, Pill, Search, Filter, Phone, Clock, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";

export function PatientPharmacyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'products' | 'about'>('products');
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPharmacy = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'pharmacies', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPharmacy({ id: docSnap.id, ...docSnap.data() });
        }
        
        const q = query(collection(db, 'products'), where('pharmacyId', '==', id));
        const pSnap = await getDocs(q);
        setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchPharmacy();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-sm text-gray-500">{t('loading_pharmacy', 'Loading pharmacy...')}</div>;
  if (!pharmacy) return <div className="p-8 text-center text-sm text-gray-500">{t('pharmacy_not_found', 'Pharmacy not found')}</div>;

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Header Image & Info */}
      <div className="relative bg-white shadow-sm z-10">
        <div className="h-40 bg-indigo-600 relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
           <button onClick={() => navigate(-1)} className="absolute top-12 left-6 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white">
              <ArrowLeft size={20} />
           </button>
           <button className="absolute top-12 right-6 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white">
              <Search size={20} />
           </button>
           <div className="absolute bottom-6 left-6 right-6">
              <h1 className="text-2xl font-bold text-white mb-1">{pharmacy.name}</h1>
              <div className="flex items-center text-white/80 text-sm gap-4">
                 <div className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400" /> {pharmacy.rating || 5.0} {t('references', 'references')}</div>
                 <div className="flex items-center gap-1"><MapPin size={14} /> {t('local', 'Local')}</div>
              </div>
           </div>
        </div>
        
        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-gray-100 gap-6">
           <button 
             onClick={() => setActiveTab('products')}
             className={`pb-3 font-bold text-sm ${activeTab === 'products' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
           >
             {t('products_tab', 'Products')}
           </button>
           <button 
             onClick={() => setActiveTab('about')}
             className={`pb-3 font-bold text-sm ${activeTab === 'about' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}
           >
             {t('about_tab', 'About')}
           </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full">
         {activeTab === 'products' ? (
            <div className="p-6">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">{t('all_products', 'All Products')}</h3>
                  <button className="text-indigo-600 bg-indigo-50 p-2 rounded-xl">
                     <Filter size={16} />
                  </button>
               </div>
               
               <div className="space-y-4">
                  {products.length === 0 ? <p className="text-sm text-gray-500">{t('no_products_at_pharmacy', 'No products available at this pharmacy.')}</p> :
                   products.map(product => (
                     <div 
                       key={product.id} 
                       onClick={() => navigate(`/patient/product/${product.id}`)}
                       className="bg-white p-4 rounded-2xl flex gap-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
                     >
                        <div className="w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center text-indigo-300">
                           <Pill size={32} />
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-start">
                              <h4 className="font-bold text-gray-900 text-sm">{product.name}</h4>
                           </div>
                           <p className="text-xs text-gray-500 mb-2 truncate max-w-[180px]">{t(product.category?.replace(/\s+/g, '_').toLowerCase(), product.category)}</p>
                           <div className="flex items-center justify-between mt-auto">
                              <span className="font-bold text-gray-900">{formatCurrency(product.price)}</span>
                              <button className="bg-indigo-600 text-white px-3 py-1 text-xs rounded-full flex items-center justify-center font-bold">
                                 {t('buy', 'Buy')}
                              </button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div className="p-6 space-y-6">
               <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                     <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><MapPin size={20} /></div>
                     <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{pharmacy.address}</p>
                        <p className="text-xs text-gray-500">{t('registered_local_pharmacy', 'Registered Local Pharmacy')}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                     <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><Clock size={20} /></div>
                     <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{t('open_now', 'Open Now')}</p>
                        <p className="text-xs text-gray-500">{t('closes_at', 'Closes at 10:00 PM')}</p>
                     </div>
                  </div>
               </div>

               <div>
                  <h3 className="font-bold text-gray-900 mb-3 text-sm">{t('upload_prescription_short', 'Upload Prescription')}</h3>
                  <div 
                    onClick={() => navigate('/patient/prescription-upload')}
                    className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer"
                  >
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                           <FileText size={20} />
                        </div>
                        <div>
                           <p className="font-bold text-indigo-900 text-sm">{t('send_to_this_pharmacy', 'Send to this pharmacy')}</p>
                           <p className="text-xs text-indigo-700 mt-1">{t('get_prescription_quote', 'Get quote for your prescription')}</p>
                        </div>
                     </div>
                     <ArrowLeft size={20} className="text-indigo-400 rotate-180" />
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}
