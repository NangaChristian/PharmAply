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

export function PatientHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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

    fetchPharmacies();
    fetchCategories();
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
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{user?.displayName || 'User'}</p>
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
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg shadow-indigo-200 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white dark:bg-black/10 rounded-full translate-x-8 -translate-y-8 blur-2xl"></div>
          <div className="max-w-[65%] z-10">
            <h3 className="font-bold text-lg mb-1">{t('upload_prescription', 'Upload Prescription')}</h3>
            <p className="text-indigo-100 text-xs mb-3 leading-relaxed">{t('upload_desc', 'A licensed pharmacist will review it and process your order')}</p>
            <button onClick={() => navigate('/patient/prescription-upload')} className="bg-white dark:bg-slate-950 text-indigo-600 text-xs font-bold py-2 px-4 rounded-xl shadow-sm hover:bg-gray-50 dark:bg-black">
              {t('upload_now', 'Upload Now')}
            </button>
          </div>
          <div className="z-10 w-16 h-16 bg-white dark:bg-black/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
            <UploadCloud size={32} className="text-white" />
          </div>
        </div>

        {/* Categories */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">{t('categories', 'Categories')}</h3>
            <button className="text-indigo-600 text-xs font-semibold">{t('see_all', 'See all')}</button>
          </div>
          <div className="grid grid-cols-3 gap-4">
              {categories.map((cat) => (
              <div 
                key={cat.id} 
                onClick={() => navigate(`/patient/search?q=${encodeURIComponent(cat.name)}`)}
                className="flex flex-col items-center gap-2 cursor-pointer group"
              >
                  <div className="w-full aspect-square rounded-2xl bg-white dark:bg-black shadow-sm flex items-center justify-center text-indigo-500 border border-gray-100 dark:border-zinc-800 group-hover:shadow-md transition overflow-hidden">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <Activity size={28} />
                    )}
                  </div>
                <span className="text-[11px] font-medium text-gray-600 text-center">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pharmacy Offers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">{t('pharmacy_offers', 'Pharmacy Offers')}</h3>
            <button className="text-indigo-600 text-xs font-semibold">{t('see_all', 'See all')}</button>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-center justify-between">
            <div>
              <div className="text-red-500 font-bold text-lg flex items-center gap-2">
                <Tag size={20} className="fill-current" />
                 {t('20_discount', '20% Discount')} </div>
              <p className="text-red-900 font-bold text-xl leading-tight"> {t('first_aid', 'First Aid')} </p>
              <p className="text-red-700/80 text-xs mt-1"> {t('everything_you_need_in_kit', 'Everything you need in kit!')} </p>
            </div>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <Activity className="text-red-500" size={32} />
            </div>
          </div>
        </div>

        {/* Nearby Pharmacies */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">{t('nearby_pharmacies', 'Nearby pharmacies')}</h3>
            <button className="text-indigo-600 text-xs font-semibold">{t('see_all', 'See all')}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
              {loading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-4"> {t('loading_pharmacies', 'Loading pharmacies...')} </div>
            ) : pharmacies.length === 0 ? (
              <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-10 px-4 text-center bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                <Store size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                <h4 className="text-gray-900 dark:text-white font-medium mb-1">{t('no_pharmacies_nearby', 'No pharmacies nearby')}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[250px]">
                  {t('no_pharmacies_available_admin_', 'We are expanding our network. New pharmacies will be available soon.')}
                </p>
              </div>
            ) : (
              pharmacies.map((pharmacy) => (
                <div key={pharmacy.id}>
                  <PharmacyCard pharmacy={pharmacy} theme={theme} />
                </div>
              ))
            )}
          </div>
        </div>

      </div>
      
    </div>
  );
}
