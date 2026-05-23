import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Tag, Heart, UploadCloud, ChevronRight, Activity, Star, ShoppingBag, Bell, Pill, Store, Thermometer, Sparkles, Sun, HeartPulse, Baby, CheckCircle, Clock } from "lucide-react";

import { collection, query, limit, getDocs, where } from '../../lib/firebase';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../hooks/useNotifications";
import { PharmacyCard } from "../../components/PharmacyCard";
import { ProductCard } from "../../components/ProductCard";
import { getCategoryIcon } from "../../lib/icons";

export function PatientHome() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const theme = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  
  const { unreadCount } = useNotifications();

  const suggestions = [
    { type: 'category', text: 'Pain Relief' },
    ...pharmacies.map(p => ({ type: 'pharmacy', text: p.name })),
  ].filter(s => s.text.toLowerCase().includes(search.toLowerCase()));

    const handleSearchClick = (item: any) => {
      navigate(`/patient/search?q=${encodeURIComponent(item.text)}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && search) {
        navigate(`/patient/search?q=${encodeURIComponent(search)}`);
      }
    };
    const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const q = query(collection(db, 'pharmacies'), where('status', '==', 'approved'), limit(5));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPharmacies(fetched);
      } catch (error) {
        console.error("Failed to fetch pharmacies", error);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchCategories = async () => {
      try {
        const cq = query(collection(db, 'categories'), limit(6));
        const snapshot = await getDocs(cq);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(fetched);
      } catch (error) {
        console.error("Failed to fetch categories", error);
      }
    };
    
    const fetchProducts = async () => {
      try {
        const pq = query(collection(db, 'products'), limit(6));
        const snapshot = await getDocs(pq);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(fetched);
      } catch (error) {
        console.error("Failed to fetch products", error);
      }
    }

    fetchPharmacies();
    fetchCategories();
    fetchProducts();
  }, []);

  return (
    <div className="flex-1 bg-gray-50 dark:bg-black flex flex-col relative pb-16 h-full overflow-hidden">
      {/* Header Profile Section */}
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 rounded-b-[2rem] shadow-sm z-20 flex flex-col gap-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/patient/profile')}>
            <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden border-2 border-indigo-100 flex items-center justify-center text-xl text-gray-500 dark:text-gray-400 font-bold uppercase shrink-0">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
               ) : (
                 user?.displayName ? user.displayName[0] : 'U'
               )}
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{userData?.name || user?.displayName || t('user', 'User')}</p>
              <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                {theme.dashboardSubtitleText || <><MapPin size={14} className="text-indigo-600 mr-1" /> {t('select_address', 'Select Address')} </>}
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/patient/notifications')} className="relative w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-black rounded-full cursor-pointer hover:bg-gray-100 dark:bg-zinc-900 transition">
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 min-h-4 px-1 bg-red-500 rounded-full text-[10px] font-bold text-white border border-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar with Autosuggest */}
        <div className="relative mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder={t('search_placeholder', 'Search medicine, pharmacy...')}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-100 dark:bg-zinc-900 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-shadow"
          />
          
          {showSuggestions && search && (
             <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-black rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-zinc-800 z-50">
                {suggestions.length > 0 ? (
                   suggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:bg-black cursor-pointer border-b border-gray-50 last:border-0" onClick={() => handleSearchClick(s)}>
                         <div className="text-gray-400 dark:text-gray-500">
                            {s.type === 'product' && <Pill size={16} />}
                            {s.type === 'category' && <Search size={16} />}
                            {s.type === 'pharmacy' && <Store size={16} />}
                         </div>
                         <span className="text-sm font-medium text-gray-900 dark:text-white">{s.text}</span>
                         <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase ml-auto">{s.type}</span>
                      </div>
                   ))
                ) : (
                   <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500"> {t('no_results_found', 'No results found')} </div>
                )}
             </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-8">
        
        {/* Upload Prescription Card */}
        <div className="bg-[#1f3775] rounded-[1.75rem] p-5 text-white flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 bg-indigo-200/20 rounded-2xl flex items-center justify-center shrink-0 -m-1 ml-0">
               {/* Bag illustration icon replacement */}
               <Pill size={40} className="text-white drop-shadow-md" />
            </div>
            <div className="z-10 py-1">
              <h3 className="font-bold text-lg mb-1">{t('upload_prescription', 'Upload Prescription')}</h3>
              <p className="text-white/80 text-xs mb-3 leading-snug font-medium max-w-[200px]">{t('upload_desc', 'Get medicines by uploading prescriptions to pharmacist')}</p>
              <button 
                onClick={() => navigate('/patient/prescription-upload')} 
                className="bg-white text-indigo-900 text-[13px] font-bold py-2.5 px-4 rounded-xl shadow-sm hover:bg-gray-50 flex items-center justify-between gap-4 w-full"
              >
                <span>{t('upload_now', 'Upload Prescription')}</span>
                <ChevronRight size={14} className="opacity-70" />
              </button>
            </div>
          </div>
        </div>

        {/* Pharmacy Offers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-[19px] tracking-tight">{t('pharmacy_offers', 'Pharmacy Offers')}</h3>
            <button onClick={() => navigate('/patient/search')} className="text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full text-xs font-semibold">{t('see_all', 'see all')} <ChevronRight size={12} className="inline opacity-70" /></button>
          </div>
          <div className="bg-[#fef4f4] dark:bg-red-950/20 rounded-[1.75rem] py-6 px-5 flex items-center">
            <div className="flex-1 pr-2">
              <div className="text-[#d84040] font-bold text-xl flex items-center gap-2 tracking-tight">
                 {t('20_discount', '20% Discount')} 
              </div>
              <p className="text-[#3b2b2b] dark:text-gray-200 font-bold text-xl leading-tight tracking-tight mb-2"> {t('first_aid', 'First Aid')} </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium max-w-[180px]"> {t('everything_you_need_in_kit', 'Everything you need to act fast in emergencies')} </p>
            </div>
            <div className="w-24 h-24 flex items-center justify-center shrink-0 relative">
               <div className="absolute inset-0 bg-red-100 rounded-3xl blur-xl opacity-60"></div>
               {/* A red brief-case cross icon representation */}
               <div className="w-20 h-16 bg-[#d84040] rounded-2xl relative z-10 flex items-center justify-center shadow-lg transform rotate-[-5deg]">
                  <div className="absolute -top-3 w-8 h-4 border-4 border-[#a32a2a] rounded-t-lg"></div>
                  <div className="w-6 h-6 bg-white/20 flex items-center justify-center">
                     <span className="text-white text-2xl font-bold leading-none -mt-1">+</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Nearby Pharmacies */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-[19px] tracking-tight">{t('nearby_pharmacies', 'Nearby pharmacies')}</h3>
            <button onClick={() => navigate('/patient/search')} className="text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full text-xs font-semibold">{t('see_all', 'see all')} <ChevronRight size={12} className="inline opacity-70" /></button>
          </div>
          <div className="flex overflow-x-auto gap-4 hide-scrollbar -mx-6 px-6 pb-2 snap-x">
              {loading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-4 w-full"> {t('loading_pharmacies', 'Loading pharmacies...')} </div>
            ) : pharmacies.length === 0 ? (
              <div className="flex-none w-[280px] flex flex-col items-center justify-center py-10 px-4 text-center bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                <Store size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                <h4 className="text-gray-900 dark:text-white font-medium mb-1">{t('no_pharmacies_nearby', 'No pharmacies nearby')}</h4>
              </div>
            ) : (
              pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="flex-none w-[280px] snap-center">
                  <PharmacyCard pharmacy={pharmacy} theme={theme} />
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Categories */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-[19px] tracking-tight">{t('categories', 'Categories')}</h3>
            <button onClick={() => navigate('/patient/search')} className="text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full text-xs font-semibold">{t('see_all', 'see all')} <ChevronRight size={12} className="inline opacity-70" /></button>
          </div>
          <div className="flex overflow-x-auto gap-4 hide-scrollbar -mx-6 px-6 pb-2 snap-x">
              {categories.map((cat) => (
              <div 
                key={cat.id} 
                onClick={() => navigate(`/patient/search?q=${encodeURIComponent(cat.name)}`)}
                className="flex flex-col flex-none w-[170px] cursor-pointer group bg-[#f5f6fc] dark:bg-zinc-900/50 p-5 rounded-2xl items-start snap-center"
              >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-indigo-500 mb-3 bg-white dark:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-700">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 object-contain" />
                    ) : (
                      getCategoryIcon(cat.name, 28)
                    )}
                  </div>
                <span className="text-[14px] font-bold text-[#1f3775] dark:text-indigo-100 leading-tight mb-1">{cat.name}</span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight">{t('various_products', 'Various products')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Sales */}
        <div>
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-bold text-gray-900 dark:text-white text-[19px] tracking-tight">{t('most_sales', 'Most Sales')}</h3>
             <button onClick={() => navigate('/patient/search')} className="text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full text-xs font-semibold">{t('see_all', 'see all')} <ChevronRight size={12} className="inline opacity-70" /></button>
          </div>
          <div className="flex overflow-x-auto gap-4 hide-scrollbar -mx-6 px-6 pb-2 snap-x">
            {products.length === 0 && !loading && (
               <div className="text-sm text-gray-500 dark:text-gray-400 py-4 w-full text-center"> {t('no_products', 'No products found')} </div>
            )}
            {products.map(p => (
               <div key={p.id} className="flex-none w-[180px] snap-center">
                  <ProductCard product={p} onClick={() => navigate(`/patient/product/${p.id}`)} showSaleBadge={true} />
               </div>
            ))}
          </div>
        </div>

      </div>
      
    </div>
  );
}
