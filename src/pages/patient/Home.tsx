import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MapPin, ChevronRight, Activity, ShoppingBag, Pill, 
  Thermometer, Sparkles, ShieldCheck, Clock, FileText, 
  Search, ArrowRight, Heart, Plus, Check
} from "lucide-react";

import { collection, query, limit, getDocs, onSnapshot } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { useTranslation } from "react-i18next";
import { NotificationBell } from "../../components/NotificationBell";
import { ProductCard } from "../../components/ProductCard";
import { PatientSearchBar } from '../../components/PatientSearchBar';
import { getCategoryIcon } from "../../lib/icons";

// Baseline staple/general products that are always readily available
const DEFAULT_ESSENTIAL_PRODUCTS = [
  {
    id: "prod_doliprane_1000",
    name: "Doliprane 1000 mg",
    commercial_name: "Doliprane 1000 mg",
    dci: "Paracétamol",
    dosage: "1000 mg (8 comprimés)",
    price: 1500,
    category: "Douleur & Fièvre",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&q=80",
    description: "Indiqué en cas de douleur et/ou fièvre telles que maux de tête, états grippaux, douleurs dentaires, courbatures."
  },
  {
    id: "prod_efferalgan_1g",
    name: "Efferalgan 1g Effervescent",
    commercial_name: "Efferalgan 1g",
    dci: "Paracétamol",
    dosage: "1000 mg (8 comprimés effervescents)",
    price: 1800,
    category: "Douleur & Fièvre",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=500&q=80",
    description: "Soulagement rapide de la fièvre et des douleurs modérées par dissolution effervescente."
  },
  {
    id: "prod_thermometre_digital",
    name: "Thermomètre Médical Digital",
    commercial_name: "Thermomètre Médical Digital",
    dci: "Dispositif Médical",
    dosage: "Précision 0.1°C",
    price: 4500,
    category: "Matériel Médical & Diagnostic",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=500&q=80",
    description: "Thermomètre électronique étanche avec écran LCD pour prise de température corporelle rapide et précise."
  },
  {
    id: "prod_gants_medicaux",
    name: "Gants Médicaux en Latex (Boîte de 100)",
    commercial_name: "Gants Médicaux en Latex",
    dci: "Protection & Hygiène",
    dosage: "Boîte 100 unités",
    price: 3800,
    category: "Matériel Médical & Diagnostic",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&q=80",
    description: "Gants d'examen à usage unique poudrés ou non-poudrés pour soins, protection et hygiène médicale."
  },
  {
    id: "prod_betadine_dermique",
    name: "Bétadine Dermique 10%",
    commercial_name: "Bétadine Dermique 10%",
    dci: "Povidone iodée",
    dosage: "Flacon 125ml",
    price: 2200,
    category: "Premiers Soins & Antiseptiques",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=500&q=80",
    description: "Antiseptique local pour l'antisepsie des plaies, des brûlures superficielles et petites coupures."
  },
  {
    id: "prod_vitamine_c_zinc",
    name: "Vitamine C 1000mg + Zinc",
    commercial_name: "Vitamine C 1000mg",
    dci: "Acide ascorbique + Zinc",
    dosage: "20 comprimés effervescents",
    price: 2500,
    category: "Vitamines & Immunité",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=500&q=80",
    description: "Renforce les défenses immunitaires et réduit la fatigue passagère chez l'adulte."
  },
  {
    id: "prod_pansements_steriles",
    name: "Pansements Stériles Multi-formats",
    commercial_name: "Pansements Stériles",
    dci: "Pansements adhésifs",
    dosage: "Boîte de 30 pansements",
    price: 1200,
    category: "Premiers Soins & Antiseptiques",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=500&q=80",
    description: "Assortiment de pansements respirants et hypoallergéniques pour protéger les petites plaies."
  },
  {
    id: "prod_spasfon_80mg",
    name: "Spasfon 80mg Lyoc",
    commercial_name: "Spasfon Lyoc",
    dci: "Phloroglucinol",
    dosage: "80 mg (10 lyophilisats)",
    price: 2100,
    category: "Digestion & Spasmes",
    is_prescription_required: false,
    is_essentiel: true,
    image_url: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=500&q=80",
    description: "Traitement symptomatique des douleurs spasmodiques intestinales, biliaires et gynécologiques."
  }
];

// Fallback admin categories if not yet created in Firestore
const DEFAULT_CATEGORIES = [
  { id: "cat_douleur", name: "Douleur & Fièvre", description: "Paracétamol, anti-inflammatoires" },
  { id: "cat_materiel", name: "Matériel & Diagnostic", description: "Thermomètres, gants, tensiomètres" },
  { id: "cat_premiers_soins", name: "Premiers Soins", description: "Antiseptiques, pansements, compresses" },
  { id: "cat_vitamines", name: "Vitamines & Énergie", description: "Vitamine C, Zinc, Magnésium" },
  { id: "cat_digestion", name: "Digestion & Transit", description: "Antiacides, antispasmodiques" },
  { id: "cat_respiration", name: "Respiration & ORL", description: "Sirops, sprays nasaux, pastilles" },
  { id: "cat_bebe", name: "Maternité & Bébé", description: "Soins nourrissons, laits infantiles" },
  { id: "cat_hygiene", name: "Hygiène & Soins", description: "Gels hydroalcooliques, savons" }
];

export function PatientHome() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const theme = useTheme();
  const { t } = useTranslation();

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  useEffect(() => {
    // 1. Fetch categories (from 'categories' or 'ux_categories')
    const fetchCategories = async () => {
      try {
        const [catSnap, uxCatSnap] = await Promise.all([
          getDocs(query(collection(db, 'categories'), limit(20))),
          getDocs(query(collection(db, 'ux_categories'), limit(20)))
        ]);

        const loadedCats: any[] = [];
        const seenNames = new Set<string>();

        // Admin categories
        catSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.name && !seenNames.has(data.name.toLowerCase().trim())) {
            seenNames.add(data.name.toLowerCase().trim());
            loadedCats.push({ id: docSnap.id, ...data });
          }
        });

        // UX categories
        uxCatSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.name && !seenNames.has(data.name.toLowerCase().trim())) {
            seenNames.add(data.name.toLowerCase().trim());
            loadedCats.push({ id: docSnap.id, ...data });
          }
        });

        if (loadedCats.length > 0) {
          setCategories(loadedCats);
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      } catch (err) {
        console.warn("Using default categories fallback:", err);
        setCategories(DEFAULT_CATEGORIES);
      }
    };

    // 2. Fetch products from Firestore, merge with staples
    const fetchProducts = async () => {
      try {
        const pSnap = await getDocs(query(collection(db, 'products'), limit(30)));
        const dbProducts = pSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        // Merge DB products with default essential products ensuring no duplicate names
        const mergedList = [...dbProducts];
        const existingNames = new Set(
          dbProducts.map((p: any) => (p.commercial_name || p.name || '').toLowerCase().trim())
        );

        DEFAULT_ESSENTIAL_PRODUCTS.forEach(item => {
          if (!existingNames.has(item.commercial_name.toLowerCase().trim())) {
            mergedList.push(item);
          }
        });

        setProducts(mergedList);
      } catch (err) {
        console.warn("Using default essential products fallback:", err);
        setProducts(DEFAULT_ESSENTIAL_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
    fetchProducts();
  }, []);

  const handleProductClick = (product: any) => {
    if (product.id && !product.id.startsWith('prod_')) {
      navigate(`/patient/product/${product.id}`);
    } else {
      const q = product.commercial_name || product.name || product.dci;
      navigate(`/patient/search?q=${encodeURIComponent(q)}`);
    }
  };

  // Filter products by active category tag if selected
  const displayedProducts = selectedCategoryFilter === "all" 
    ? products 
    : products.filter(p => {
        const cat = (p.category || p.ux_category || p.ux_categories?.name || "").toLowerCase();
        return cat.includes(selectedCategoryFilter.toLowerCase());
      });

  return (
    <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col relative pb-20 h-full overflow-hidden">
      
      {/* 1. Header Profile & Delivery Address */}
      <div className="bg-white dark:bg-zinc-900 px-6 pt-12 pb-4 rounded-b-[2rem] shadow-sm z-20 flex flex-col gap-4 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/patient/profile')}>
            <div 
              className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden border-2 flex items-center justify-center text-lg text-[#194B4B] dark:text-teal-400 font-bold uppercase shrink-0 shadow-sm"
              style={{ borderColor: theme.primaryColor || '#194B4B' }}
            >
              {(user?.photoURL || userData?.photoURL || userData?.photoUrl || userData?.avatar_url) ? (
                <img 
                  src={user?.photoURL || userData?.photoURL || userData?.photoUrl || userData?.avatar_url} 
                  alt={userData?.name || user?.displayName || 'User'} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                (userData?.name || user?.displayName) ? (userData?.name || user?.displayName)[0].toUpperCase() : 'U'
              )}
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                Bonjour, {userData?.name || user?.displayName || t('user', 'Client')}
              </p>
              <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                <MapPin size={12} className="text-[#194B4B] dark:text-teal-400 mr-1 shrink-0" />
                <span className="truncate max-w-[200px]">
                  {userData?.address || t('select_address', 'Livraison à domicile')}
                </span>
              </div>
            </div>
          </div>

          <NotificationBell />
        </div>

        {/* Search Bar with instant autocomplete */}
        <div className="relative mt-1 flex items-center z-30">
          <PatientSearchBar />
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-7">
        
        {/* 2. JOLIE BANNIÈRE D'ANNONCE : TROUVER DES MÉDICAMENTS FACILEMENT */}
        <div className="bg-[#194B4B] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
          {/* Subtle decorative background circles */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute right-12 top-4 w-20 h-20 bg-[#F59E0B]/20 rounded-full blur-md pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="inline-flex items-center gap-1.5 bg-[#F59E0B] text-slate-900 px-3 py-1 rounded-full text-xs font-black self-start uppercase tracking-wider">
              <Sparkles size={13} className="text-slate-950" />
              <span>Livraison Express Santé</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
                Trouvez vos médicaments facilement
              </h2>
              <p className="text-white/85 text-xs sm:text-sm font-medium mt-1.5 leading-relaxed max-w-[340px]">
                Commandez vos produits de santé essentiels ou transmettez votre ordonnance en photo pour une livraison rapide.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button 
                onClick={() => navigate('/patient/prescription-upload')}
                className="bg-[#F59E0B] hover:bg-[#d97706] text-slate-950 text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-2"
              >
                <FileText size={15} />
                <span>Envoyer une ordonnance</span>
              </button>

              <button 
                onClick={() => navigate('/patient/search')}
                className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-2.5 px-4 rounded-xl border border-white/20 transition flex items-center gap-1.5"
              >
                <span>Rechercher un produit</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex items-center gap-4 pt-1 text-[11px] text-white/70 font-medium">
              <span className="flex items-center gap-1">
                <ShieldCheck size={13} className="text-[#F59E0B]" /> Produits certifiés
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-[#F59E0B]" /> Suivi GPS en direct
              </span>
            </div>
          </div>
        </div>

        {/* 3. SECTION CATÉGORIES DE PRODUITS (COULISSANTE DE DROITE À GAUCHE) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">
                Catégories de produits
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Faites défiler pour explorer par besoin de santé
              </p>
            </div>
            <button 
              onClick={() => navigate('/patient/search')} 
              className="text-xs font-bold text-[#194B4B] dark:text-teal-400 hover:underline flex items-center gap-0.5"
            >
              <span>{t('see_all', 'Tout voir')}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Horizontally scrolling category cards */}
          <div className="flex overflow-x-auto gap-3.5 hide-scrollbar -mx-6 px-6 pb-2 pt-1 snap-x scroll-smooth">
            {categories.map((cat) => (
              <div 
                key={cat.id || cat.name} 
                onClick={() => navigate(`/patient/search?q=${encodeURIComponent(cat.name)}`)}
                className="flex flex-col flex-none w-[145px] sm:w-[160px] cursor-pointer group bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-2xl items-start snap-start hover:border-[#194B4B]/40 dark:hover:border-teal-500/40 hover:shadow-sm transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[#194B4B] dark:text-teal-400 mb-3 bg-white dark:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-700 group-hover:scale-105 transition-transform">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={cat.name} className="w-8 h-8 object-contain rounded-lg" />
                  ) : (
                    getCategoryIcon(cat.name, 24)
                  )}
                </div>
                <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-tight mb-1 line-clamp-2">
                  {cat.name}
                </span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 line-clamp-1">
                  {cat.description || t('various_products', 'Voir les articles')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. PRODUITS GÉNÉRAUX ESSENTIELS (Doliprane, Efferalgan, Thermomètre, Gants, etc.) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h3 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">
                Médicaments & Produits Essentiels
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Disponibles et livrables rapidement
              </p>
            </div>
            <button 
              onClick={() => navigate('/patient/search')} 
              className="text-xs font-bold text-[#194B4B] dark:text-teal-400 hover:underline flex items-center gap-0.5"
            >
              <span>{t('see_all', 'Catalogue')}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Quick filter pills */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 pt-1 -mx-1 px-1">
            <button
              onClick={() => setSelectedCategoryFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategoryFilter === "all"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              Tous les produits
            </button>
            <button
              onClick={() => setSelectedCategoryFilter("douleur")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategoryFilter === "douleur"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              Douleur & Fièvre
            </button>
            <button
              onClick={() => setSelectedCategoryFilter("matériel")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategoryFilter === "matériel"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              Matériel & Diagnostic
            </button>
            <button
              onClick={() => setSelectedCategoryFilter("premiers soins")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                selectedCategoryFilter === "premiers soins"
                  ? "bg-[#194B4B] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              Premiers Soins
            </button>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
            {displayedProducts.slice(0, 10).map((product) => (
              <div 
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-[#194B4B]/30 dark:hover:border-teal-500/30 transition-all group"
              >
                <div>
                  {/* Product Image Box */}
                  <div className="w-full aspect-square bg-gray-50 dark:bg-zinc-800/80 rounded-xl mb-2.5 overflow-hidden flex items-center justify-center p-2 relative">
                    {product.is_essentiel && (
                      <span className="absolute top-1.5 left-1.5 bg-[#194B4B] text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10">
                        Essentiel
                      </span>
                    )}
                    {product.image_url || product.imageUrl || product.image ? (
                      <img 
                        src={product.image_url || product.imageUrl || product.image} 
                        alt={product.commercial_name || product.name} 
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="text-[#194B4B]/40 dark:text-teal-400/40">
                        {getCategoryIcon(product.category || product.ux_category, 36)}
                      </div>
                    )}
                  </div>

                  {/* Title and details */}
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-1 group-hover:text-[#194B4B] dark:group-hover:text-teal-400 transition-colors">
                    {product.commercial_name || product.name}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                    {product.dosage || product.dci || product.category}
                  </p>
                </div>

                {/* Price & Action button */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 block font-medium">Prix</span>
                    <span className="font-extrabold text-sm text-[#194B4B] dark:text-teal-400">
                      {product.price ? `${Number(product.price).toLocaleString()} XAF` : "Disponible"}
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-[#194B4B] group-hover:bg-[#F59E0B] text-white group-hover:text-slate-950 flex items-center justify-center transition-colors">
                    <Plus size={15} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* View All Button */}
          <div className="pt-4">
            <button
              onClick={() => navigate('/patient/search')}
              className="w-full py-3.5 bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-800 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2"
            >
              <Search size={15} className="text-[#194B4B] dark:text-teal-400" />
              <span>Explorer tout le catalogue de médicaments</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
