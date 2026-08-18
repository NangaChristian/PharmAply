import React, { useState, useEffect } from "react";
import { ArrowLeft, SlidersHorizontal, Pill, Clock, X, Navigation, MapPin } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, query, getDocs, limit, where } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useTranslation } from "react-i18next";
import { ProductCard } from '../../components/ProductCard';
import { getCategoryIcon } from '../../lib/icons';

// Formule Haversine pour calculer la distance géographique en km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function PatientSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const initialQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [deduplicatedProducts, setDeduplicatedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

  // Géolocalisation du patient pour le tri par proximité
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Coordonnées par défaut (Douala)
          setUserLocation({ lat: 4.0511, lng: 9.7679 });
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    } else {
      setUserLocation({ lat: 4.0511, lng: 9.7679 });
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      saveRecentSearch(initialQuery);
    }
  }, [initialQuery]);

  const saveRecentSearch = (qStr: string) => {
    if (!qStr.trim()) return;
    const updated = [qStr.trim(), ...recentSearches.filter(s => s !== qStr.trim())].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const removeRecentSearch = (e: React.MouseEvent, qStr: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== qStr);
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
        // 1. Récupération des produits et pharmacies actives
        const [snapshotProducts, snapshotPharmacies, snapshotCategories] = await Promise.all([
          getDocs(query(collection(db, 'products'), limit(300))),
          getDocs(query(collection(db, 'pharmacies'), where('status', '==', 'approved'), limit(200))),
          getDocs(query(collection(db, 'ux_categories'), limit(20)))
        ]);

        const rawProducts = snapshotProducts.docs.map(d => ({ id: d.id, ...d.data() }));
        const pharmaciesMap = new Map<string, any>();
        snapshotPharmacies.docs.forEach(docSnap => {
          pharmaciesMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });

        setCategories(snapshotCategories.docs.map(d => ({ id: d.id, ...d.data() })));

        // 2. Dédoublonnage & enrichissement de proximité masqué
        // Groupe par clé globale de médicament (productId / globalId / commercial_name)
        const productGroups = new Map<string, any>();

        const patientLat = userLocation?.lat || 4.0511;
        const patientLng = userLocation?.lng || 9.7679;

        rawProducts.forEach((p: any) => {
          // Ne conserver que si stock disponible en pharmacie
          const stock = Number(p.stock ?? 0);
          if (stock <= 0) return;

          const groupKey = (p.productId || p.global_product_id || p.commercial_name || p.name || p.id).trim().toLowerCase();
          const pharmacy = p.pharmacyId ? pharmaciesMap.get(p.pharmacyId) : null;

          const phLat = Number(pharmacy?.latitude || pharmacy?.lat || 4.0511);
          const phLng = Number(pharmacy?.longitude || pharmacy?.lng || 9.7679);
          const distance = calculateDistanceKm(patientLat, patientLng, phLat, phLng);
          const price = parseFloat(p.price) || 0;

          if (!productGroups.has(groupKey)) {
            productGroups.set(groupKey, {
              ...p,
              // Privacy : Nettoyage strict de toute information directe de la pharmacie
              pharmacyId: p.pharmacyId, // conservé en interne pour le panier/checkout
              pharmacyName: undefined,
              pharmacy_name: undefined,
              pharmacyAddress: undefined,
              pharmacyPhone: undefined,
              distance_km: Math.round(distance * 10) / 10,
              min_price: price,
              price: price,
              totalStockAvailable: stock,
            });
          } else {
            const existing = productGroups.get(groupKey);
            // Retenir la distance minimale et le meilleur prix
            if (distance < existing.distance_km) {
              existing.distance_km = Math.round(distance * 10) / 10;
              existing.pharmacyId = p.pharmacyId;
            }
            if (price > 0 && (existing.price === 0 || price < existing.price)) {
              existing.price = price;
              existing.min_price = price;
            }
            existing.totalStockAvailable += stock;
          }
        });

        // Tri initial par proximité géographique
        const deduplicatedList = Array.from(productGroups.values()).sort(
          (a, b) => (a.distance_km || 0) - (b.distance_km || 0)
        );

        setDeduplicatedProducts(deduplicatedList);
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userLocation]);

  const sq = searchQuery.toLowerCase();

  const filteredProducts = deduplicatedProducts.filter(p => 
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

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center gap-4 mb-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:bg-zinc-900 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-900 dark:text-white" />
          </button>
          <form className="flex-1 relative" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              autoFocus
              placeholder={t('search_products_desc', 'Rechercher un médicament, DCI, catégorie...')}
              className="w-full bg-gray-100 dark:bg-zinc-900 py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#194B4B]/20 text-gray-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <button className="p-2 bg-[#194B4B]/10 text-[#194B4B] dark:text-teal-400 rounded-xl">
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Indicateur de localisation discrète */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 pl-1">
          <MapPin size={13} className="text-[#194B4B] dark:text-teal-400" />
          <span>Tri par proximité automatique • Place de marché sécurisée</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Filtres par catégorie */}
        <div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {categories.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setSearchQuery(cat.name)}
                className={`whitespace-nowrap border px-3 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  searchQuery.toLowerCase() === cat.name.toLowerCase() 
                    ? 'bg-[#194B4B] text-white border-[#194B4B]' 
                    : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className={searchQuery.toLowerCase() === cat.name.toLowerCase() ? 'opacity-100' : 'opacity-70'}>
                  {getCategoryIcon(cat.name, 14, "")}
                </div>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {!searchQuery && recentSearches.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={18} className="text-gray-400" />
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t('recent_searches', 'Recherches récentes')}</h3>
            </div>
            <div className="flex flex-col gap-2">
              {recentSearches.map((sqStr, idx) => (
                <div key={idx} onClick={() => setSearchQuery(sqStr)} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg cursor-pointer group transition-colors">
                  <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{sqStr}</span>
                  <button onClick={(e) => removeRecentSearch(e, sqStr)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste des produits uniques classés par proximité */}
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('loading_data', 'Chargement du catalogue...')}</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pill size={18} className="text-[#194B4B] dark:text-teal-400" />
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {searchQuery ? t('relevant_products', 'Médicaments disponibles') : t('suggested_products', 'Médicaments à proximité')}
                </h3>
              </div>
              <span className="text-xs text-gray-400">
                {filteredProducts.length} référence{filteredProducts.length > 1 ? 's' : ''}
              </span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
                  {t('no_results', 'Aucun médicament trouvé')}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {t('no_results_desc', 'Essayez un autre mot-clé ou filtrez par catégorie.')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredProducts.map(product => (
                  <div key={product.id}>
                    <ProductCard 
                      product={product} 
                      basePath="/patient/product" 
                      showSaleBadge={false} 
                      onHeartClick={handleHeartClick}
                      isWishlisted={!!wishlist[product.id]}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

