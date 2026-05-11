import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Tag, Heart, UploadCloud, ChevronRight, Activity, Star, ShoppingBag, Bell, Pill, Store, Thermometer, Sparkles, Sun, HeartPulse, Baby } from "lucide-react";
import { BottomNav } from "../../components/layout/BottomNav";
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { useTranslation } from "react-i18next";

export function PatientHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const PATIENT_CATEGORIES = [
    { id: '1', name: t('category_cold_flu', 'Cold & Flu'), icon: 'Thermometer' },
    { id: '2', name: t('category_daily', 'Daily Essentials'), icon: 'Pill' },
    { id: '3', name: t('category_skin', 'Skin Care'), icon: 'Sparkles' },
    { id: '4', name: t('category_vitamins', 'Vitamins'), icon: 'Sun' },
    { id: '5', name: t('category_first_aid', 'First Aid'), icon: 'Cross' },
    { id: '6', name: t('category_baby', 'Baby Care'), icon: 'Baby' },
  ];

  const suggestions = [
    { type: 'category', text: 'Pain Relief' },
    ...pharmacies.map(p => ({ type: 'pharmacy', text: p.name })),
  ].filter(s => s.text.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const q = query(collection(db, 'pharmacies'), limit(5));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPharmacies(fetched);
      } catch (error) {
        // Will throw handled error via handleFirestoreError but we catch it to not crash whole UI
        console.error("Failed to fetch pharmacies", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPharmacies();
  }, []);

  return (
    <div className="flex-1 bg-gray-50 flex flex-col relative pb-16 h-full overflow-hidden">
      {/* Header Profile Section */}
      <div className="bg-white px-6 pt-12 pb-4 rounded-b-[2rem] shadow-sm z-20 flex flex-col gap-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden border-2 border-indigo-100 flex items-center justify-center text-xl text-gray-500 font-bold uppercase">
              {user?.displayName ? user.displayName[0] : 'U'}
            </div>
            <div>
              <p className="text-sm text-gray-500">{theme.dashboardWelcomeText} {theme.dashboardWelcomeText === 'Hi 👋' ? (user?.displayName || 'User') : ''}</p>
              <div className="flex items-center text-gray-900 font-semibold text-sm">
                {theme.dashboardSubtitleText || <><MapPin size={14} className="text-indigo-600 mr-1" />Select Address</>}
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/patient/notifications')} className="relative w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full cursor-pointer hover:bg-gray-100 transition">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>

        {/* Search Bar with Autosuggest */}
        <div className="relative mt-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t('search_placeholder', 'Search medicine, pharmacy...')}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-shadow"
          />
          
          {showSuggestions && search && (
             <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 z-50">
                {suggestions.length > 0 ? (
                   suggestions.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0" onClick={() => navigate('/patient/search')}>
                         <div className="text-gray-400">
                            {s.type === 'product' && <Pill size={16} />}
                            {s.type === 'category' && <Search size={16} />}
                            {s.type === 'pharmacy' && <Store size={16} />}
                         </div>
                         <span className="text-sm font-medium text-gray-900">{s.text}</span>
                         <span className="text-[10px] text-gray-400 uppercase ml-auto">{s.type}</span>
                      </div>
                   ))
                ) : (
                   <div className="p-4 text-center text-sm text-gray-500">No results found</div>
                )}
             </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-8">
        
        {/* Upload Prescription Card */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg shadow-indigo-200 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8 blur-2xl"></div>
          <div className="max-w-[65%] z-10">
            <h3 className="font-bold text-lg mb-1">{t('upload_prescription', 'Upload Prescription')}</h3>
            <p className="text-indigo-100 text-xs mb-3 leading-relaxed">{t('upload_desc', 'A licensed pharmacist will review it and process your order')}</p>
            <button onClick={() => navigate('/patient/prescription-upload')} className="bg-white text-indigo-600 text-xs font-bold py-2 px-4 rounded-xl shadow-sm hover:bg-gray-50">
              {t('upload_now', 'Upload Now')}
            </button>
          </div>
          <div className="z-10 w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
            <UploadCloud size={32} className="text-white" />
          </div>
        </div>

        {/* Categories */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('categories', 'Categories')}</h3>
            <button className="text-indigo-600 text-xs font-semibold">{t('see_all', 'See all')}</button>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {PATIENT_CATEGORIES.map((cat) => {
              const Icon = {
                Thermometer,
                Pill,
                Sparkles,
                Sun,
                Cross: HeartPulse,
                Baby
              }[cat.icon] || Activity;

              return (
              <div key={cat.id} className="flex flex-col items-center gap-2 min-w-[72px]">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-500 border border-gray-100 hover:shadow-md transition cursor-pointer">
                  <Icon size={24} />
                </div>
                <span className="text-[11px] font-medium text-gray-600 text-center">{cat.name}</span>
              </div>
            )})}
          </div>
        </div>

        {/* Pharmacy Offers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('pharmacy_offers', 'Pharmacy Offers')}</h3>
            <button className="text-indigo-600 text-xs font-semibold">{t('see_all', 'See all')}</button>
          </div>
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-center justify-between">
            <div>
              <div className="text-red-500 font-bold text-lg flex items-center gap-2">
                <Tag size={20} className="fill-current" />
                20% Discount
              </div>
              <p className="text-red-900 font-bold text-xl leading-tight">First Aid</p>
              <p className="text-red-700/80 text-xs mt-1">Everything you need in kit!</p>
            </div>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <Activity className="text-red-500" size={32} />
            </div>
          </div>
        </div>

        {/* Nearby Pharmacies */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{t('nearby_pharmacies', 'Nearby pharmacies')}</h3>
            <button className="text-indigo-600 text-xs font-semibold">{t('see_all', 'See all')}</button>
          </div>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {loading ? (
              <div className="text-sm text-gray-500 py-4">Loading pharmacies...</div>
            ) : pharmacies.length === 0 ? (
              <div className="text-sm text-gray-500 py-4">No pharmacies available. Admin must add them.</div>
            ) : (
              pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} onClick={() => navigate(`/patient/pharmacy/${pharmacy.id}`)} className="cursor-pointer min-w-[240px] bg-white rounded-2xl p-4 shadow-sm border border-gray-100 shrink-0 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                       <Store size={20} />
                    </div>
                    <div className="flex items-center bg-green-50 text-green-600 px-2 py-1 rounded-lg text-xs font-bold gap-1">
                      <Star size={12} className="fill-current text-yellow-400" />
                      {pharmacy.rating || 5.0}
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-900">{pharmacy.name}</h4>
                  <div className="flex items-center text-gray-400 text-xs mt-1 mb-3">
                    <MapPin size={12} className="mr-1" />
                    {pharmacy.address}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
