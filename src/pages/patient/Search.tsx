import React, { useState, useEffect } from "react";
import { ArrowLeft, SlidersHorizontal, Store, Pill, Clock, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, query, getDocs, limit, where } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useTranslation } from "react-i18next";
import { ProductCard } from '../../components/ProductCard';
import { PharmacyCard } from '../../components/PharmacyCard';
import { PharmacyHeatmap } from '../../components/PharmacyHeatmap';
import { getCategoryIcon } from '../../lib/icons';
import { useTheme } from '../../components/ThemeProvider';

export function PatientSearch() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const initialQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [products, setProducts] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('recentSearches') || '[]');
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('wishlist') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (initialQuery) {
       saveRecentSearch(initialQuery);
    }
  }, [initialQuery]);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query.trim(), ...recentSearches.filter(s => s !== query.trim())].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const removeRecentSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== query);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveRecentSearch(searchQuery);
  };

  const handleHeartClick = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    const updatedWishlist = { ...wishlist, [product.id]: !wishlist[product.id] };
    setWishlist(updatedWishlist);
    localStorage.setItem('wishlist', JSON.stringify(updatedWishlist));
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch products - increased limit for better client-side search
        const qProducts = query(collection(db, 'products'), limit(200));
        const snapshotProducts = await getDocs(qProducts);
        setProducts(snapshotProducts.docs.map(d => ({ id: d.id, ...d.data() })));
        
        // Fetch pharmacies
        const qPharmacies = query(collection(db, 'pharmacies'), where('status', '==', 'approved'), limit(200));
        const snapshotPharmacies = await getDocs(qPharmacies);
        setPharmacies(snapshotPharmacies.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch categories
        const qCategories = query(collection(db, 'ux_categories'), limit(20));
        const snapshotCategories = await getDocs(qCategories);
        setCategories(snapshotCategories.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sq = searchQuery.toLowerCase();

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase() || '').includes(sq) || 
    (p.commercial_name?.toLowerCase() || '').includes(sq) || 
    (p.dci?.toLowerCase() || '').includes(sq) || 
    (p.category?.toLowerCase() || '').includes(sq) ||
    (p.description?.toLowerCase() || '').includes(sq) ||
    (p.scientific_name?.toLowerCase() || '').includes(sq) ||
    (p.active_ingredient?.toLowerCase() || '').includes(sq) ||
    (p.brand?.toLowerCase() || '').includes(sq) ||
    (Array.isArray(p.symptoms) && p.symptoms.some((sym: string) => sym.toLowerCase().includes(sq)))
  );

  const filteredPharmacies = pharmacies.filter(p => 
    (p.name?.toLowerCase() || '').includes(sq) ||
    (p.address?.toLowerCase() || '').includes(sq) ||
    (p.city?.toLowerCase() || '').includes(sq) ||
    (p.region?.toLowerCase() || '').includes(sq) ||
    (p.email?.toLowerCase() || '').includes(sq)
  );

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:bg-zinc-900 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-900 dark:text-white" />
          </button>
          <form className="flex-1 relative" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              autoFocus
              placeholder={t('search_products_desc', 'Search medicine, pharmacy, category, region...')}
              className="w-full bg-gray-100 dark:bg-zinc-900 py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 text-gray-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <button className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <div>
           <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
             {categories.map(cat => (
               <button 
                 key={cat.id} 
                 onClick={() => setSearchQuery(cat.name)}
                 className={`whitespace-nowrap border px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    searchQuery.toLowerCase() === cat.name.toLowerCase() 
                    ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-600' 
                    : 'bg-white dark:bg-zinc-900 border-indigo-100 dark:border-zinc-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800'
                 }`}
               >
                 <div className={searchQuery.toLowerCase() === cat.name.toLowerCase() ? 'opacity-100' : 'opacity-70'}>{getCategoryIcon(cat.name, 14, "")}</div>
                 {cat.name}
               </button>
             ))}
           </div>
        </div>

        {!searchQuery && recentSearches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
               <Clock size={18} className="text-gray-400" />
               <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('recent_searches', 'Recent Searches')}</h3>
            </div>
            <div className="flex flex-col gap-2">
               {recentSearches.map((sq, idx) => (
                 <div key={idx} onClick={() => setSearchQuery(sq)} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg cursor-pointer group transition-colors">
                    <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{sq}</span>
                    <button onClick={(e) => removeRecentSearch(e, sq)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                       <X size={16} />
                    </button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
           <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('loading_data', 'Loading data...')}</p>
        ) : (
          <>
            {!searchQuery && filteredPharmacies.length > 0 && (
               <div>
                  <div className="flex items-center gap-2 mb-4">
                     <Store size={18} className="text-indigo-500" />
                     <h3 className="font-bold text-gray-900 dark:text-white">{t('delivery_demand', 'Delivery Demand Map')}</h3>
                  </div>
                  <PharmacyHeatmap pharmacies={filteredPharmacies} />
               </div>
            )}

            {searchQuery && filteredPharmacies.length > 0 && (
               <div>
                 <div className="flex items-center gap-2 mb-4">
                    <Store size={18} className="text-indigo-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">{t('pharmacies', 'Pharmacies')}</h3>
                 </div>
                 <div className="flex overflow-x-auto gap-4 hide-scrollbar -mx-6 px-6 pb-2 snap-x">
                   {filteredPharmacies.map(pharmacy => (
                     <div key={pharmacy.id} className="flex-none w-[280px] snap-center">
                       <PharmacyCard pharmacy={pharmacy} theme={theme} />
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {(searchQuery || !searchQuery) && (
               <div>
                 <div className="flex items-center gap-2 mb-4">
                    <Pill size={18} className="text-indigo-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {searchQuery ? t('relevant_products', 'Relevant Products') : t('suggested_products', 'Suggested Products')}
                    </h3>
                 </div>
                 {filteredProducts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_products_found', 'No products found.')}</p>
                 ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {filteredProducts.map(product => (
                        <div key={product.id}>
                           <ProductCard 
                               product={product} 
                               basePath="/patient/product" 
                               showSaleBadge={true} 
                               onHeartClick={handleHeartClick}
                               isWishlisted={!!wishlist[product.id]}
                           />
                        </div>
                      ))}
                    </div>
                 )}
               </div>
            )}
            
            {searchQuery && filteredProducts.length === 0 && filteredPharmacies.length === 0 && (
                <div className="text-center py-12">
                   <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                      {t('no_results', 'No results found')}
                   </p>
                   <p className="text-sm text-gray-400 dark:text-gray-500">
                      {t('no_results_desc', 'Try adjusting your search terms.')}
                   </p>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
