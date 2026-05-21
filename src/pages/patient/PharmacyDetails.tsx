import { useState, useEffect } from "react";
import { ArrowLeft, Star, MapPin, Pill, Search, Filter, Phone, Clock, FileText, CheckCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import { ProductCard } from '../../components/ProductCard';

import { useTheme } from '../../components/ThemeProvider';

export function PatientPharmacyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const theme = useTheme();

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
          const data = docSnap.data();
          if (data.status === 'approved') {
            setPharmacy({ id: docSnap.id, ...data });
          } else {
             // Handle not found/unapproved here by leaving pharmacy state null
             console.error("Pharmacy is not approved yet");
          }
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

  if (loading) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('loading_pharmacy', 'Loading pharmacy...')}</div>;
  if (!pharmacy) return <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('pharmacy_not_found', 'Pharmacy not found')}</div>;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header Image & Info */}
      <div className="relative bg-white dark:bg-black shadow-sm z-10">
        <div className="h-40 bg-indigo-600 relative overflow-hidden flex items-end p-6">
           {(pharmacy.imageUrl || theme.defaultPharmacyLogo) && (
              <img src={pharmacy.imageUrl || theme.defaultPharmacyLogo} className="absolute inset-0 w-full h-full object-cover" alt="header" />
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-slate-900/40"></div>
           <button onClick={() => navigate(-1)} className="absolute top-12 left-6 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white">
              <ArrowLeft size={20} />
           </button>
           <button className="absolute top-12 right-6 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full text-white">
              <Search size={20} />
           </button>
           <div className="relative z-10 w-full">
              <div className="flex items-center gap-3 mb-1">
                 <h1 className="text-2xl font-bold text-white">{pharmacy.name}</h1>
                 {pharmacy.status === 'approved' ? (
                   <div className="bg-green-500/20 text-green-100 text-[10px] px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1 font-medium">
                     <CheckCircle size={10} /> {t('verified', 'Verified')}
                   </div>
                 ) : (
                   <div className="bg-amber-500/20 text-amber-100 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 font-medium">
                     <Clock size={10} /> {t('pending_kyc', 'Pending KYC')}
                   </div>
                 )}
              </div>
              <div className="flex items-center text-white/80 text-sm gap-4">
                 <div className="flex items-center gap-1"><MapPin size={14} /> {t('local', 'Local')}</div>
              </div>
           </div>
        </div>
        
        {/* Tabs */}
        <div className="flex px-6 pt-4 border-b border-gray-100 dark:border-zinc-800 gap-6">
           <button 
             onClick={() => setActiveTab('products')}
             className={`pb-3 font-bold text-sm ${activeTab === 'products' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 dark:text-gray-500'}`}
           >
             {t('products_tab', 'Products')}
           </button>
           <button 
             onClick={() => setActiveTab('about')}
             className={`pb-3 font-bold text-sm ${activeTab === 'about' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 dark:text-gray-500'}`}
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
                  <h3 className="font-bold text-gray-900 dark:text-white">{t('all_products', 'All Products')}</h3>
                  <button className="text-indigo-600 bg-indigo-50 p-2 rounded-xl">
                     <Filter size={16} />
                  </button>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  {products.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 col-span-2">{t('no_products_at_pharmacy', 'No products available at this pharmacy.')}</p> :
                   products.map(product => (
                      <div key={product.id}>
                         <ProductCard product={product} basePath="/patient/product" showSaleBadge={false} />
                      </div>
                  ))}
               </div>
            </div>
         ) : (
            <div className="p-6 space-y-6">
               <div className="bg-white dark:bg-black p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                     <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><MapPin size={20} /></div>
                     <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{pharmacy.address}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('registered_local_pharmacy', 'Registered Local Pharmacy')}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                     <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><Clock size={20} /></div>
                     <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t('open_now', 'Open Now')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('closes_at', 'Closes at 10:00 PM')}</p>
                     </div>
                  </div>
               </div>

               <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">{t('upload_prescription_short', 'Upload Prescription')}</h3>
                  <div 
                    onClick={() => navigate('/patient/prescription-upload')}
                    className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer"
                  >
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-black rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
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
