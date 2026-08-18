import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, FileText, ChevronRight, Sparkles, ShieldCheck, 
  Clock, Plus
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getCategoryIcon } from "../lib/icons";
import { useTheme } from "./ThemeProvider";

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface GeneralProductItem {
  id: string;
  name: string;
  commercial_name?: string;
  dci?: string;
  dosage?: string;
  price?: number;
  category?: string;
  is_prescription_required?: boolean;
  is_essentiel?: boolean;
  image_url?: string;
  imageUrl?: string;
  image?: string;
  description?: string;
}

interface SearchHeroBannerProps {
  categories?: CategoryItem[];
  products?: GeneralProductItem[];
  onProductClick?: (product: GeneralProductItem) => void;
  onCategoryClick?: (category: CategoryItem) => void;
}

export function SearchHeroBanner({
  categories = [],
  products = [],
  onProductClick,
  onCategoryClick
}: SearchHeroBannerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const theme = useTheme();
  const primaryColor = theme.primaryColor || '#194B4B';
  const secondaryColor = theme.secondaryColor || '#F59E0B';

  const handleProductSelect = (product: GeneralProductItem) => {
    if (onProductClick) {
      onProductClick(product);
    } else {
      if (product.id && !product.id.startsWith("prod_")) {
        navigate(`/patient/product/${product.id}`);
      } else {
        const q = product.commercial_name || product.name || product.dci;
        navigate(`/patient/search?q=${encodeURIComponent(q || "")}`);
      }
    }
  };

  const handleCategorySelect = (cat: CategoryItem) => {
    if (onCategoryClick) {
      onCategoryClick(cat);
    } else {
      navigate(`/patient/search?q=${encodeURIComponent(cat.name)}`);
    }
  };

  const filteredProducts = selectedFilter === "all"
    ? products
    : products.filter(p => {
        const cat = (p.category || "").toLowerCase();
        return cat.includes(selectedFilter.toLowerCase());
      });

  return (
    <div id="search-hero-banner-container" className="space-y-7">
      
      {/* 1. PROMOTIONAL HERO BANNER */}
      <div 
        id="search-promo-banner" 
        className="rounded-3xl p-6 text-white shadow-md relative overflow-hidden"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="relative z-10 flex flex-col gap-3">
          <div 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black self-start uppercase tracking-wider text-slate-950"
            style={{ backgroundColor: secondaryColor }}
          >
            <Sparkles size={13} className="text-slate-950" />
            <span>Livraison Express Santé</span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
              Trouvez vos médicaments facilement
            </h2>
            <p className="text-white/90 text-xs sm:text-sm font-medium mt-1.5 leading-relaxed max-w-[340px]">
              Commandez vos produits de santé essentiels ou transmettez votre ordonnance en photo pour une livraison rapide.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button 
              id="banner-btn-upload-prescription"
              onClick={() => navigate('/patient/prescription-upload')}
              className="text-slate-950 text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-2 hover:opacity-90 active:scale-95"
              style={{ backgroundColor: secondaryColor }}
            >
              <FileText size={15} />
              <span>Envoyer une ordonnance</span>
            </button>

            <button 
              id="banner-btn-search-catalog"
              onClick={() => navigate('/patient/search')}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold py-2.5 px-4 rounded-xl border border-white/20 transition flex items-center gap-1.5 active:scale-95"
            >
              <span>Rechercher un produit</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-4 pt-1 text-[11px] text-white/75 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} style={{ color: secondaryColor }} /> Produits certifiés
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} style={{ color: secondaryColor }} /> Suivi GPS en direct
            </span>
          </div>
        </div>
      </div>

      {/* 2. HORIZONTALLY SCROLLABLE PRODUCT CATEGORIES */}
      {categories.length > 0 && (
        <div id="hero-categories-section">
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
              id="btn-see-all-categories"
              onClick={() => navigate('/patient/search')} 
              className="text-xs font-bold hover:underline flex items-center gap-0.5"
              style={{ color: primaryColor }}
            >
              <span>{t('see_all', 'Tout voir')}</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div 
            id="hero-categories-slider" 
            className="flex overflow-x-auto gap-3.5 hide-scrollbar -mx-6 px-6 pb-2 pt-1 snap-x scroll-smooth"
          >
            {categories.map((cat) => (
              <div 
                key={cat.id || cat.name} 
                id={`cat-card-${cat.id || cat.name.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => handleCategorySelect(cat)}
                className="flex flex-col flex-none w-[145px] sm:w-[160px] cursor-pointer group bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-2xl items-start snap-start hover:shadow-sm transition-all duration-200"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-white dark:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-700 group-hover:scale-105 transition-transform"
                  style={{ color: primaryColor }}
                >
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
      )}

      {/* 3. PRODUCTS AVAILABLE IN PHARMACIES */}
      <div id="hero-general-products-section">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">
              Médicaments & Produits Essentiels
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Produits certifiés du catalogue
            </p>
          </div>
          <button 
            id="btn-see-all-products"
            onClick={() => navigate('/patient/search')} 
            className="text-xs font-bold hover:underline flex items-center gap-0.5"
            style={{ color: primaryColor }}
          >
            <span>{t('see_all', 'Catalogue')}</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {products.length > 0 ? (
          <>
            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-3 pt-1 -mx-1 px-1">
              {[
                { id: "all", label: "Tous les produits" },
                { id: "douleur", label: "Douleur & Fièvre" },
                { id: "matériel", label: "Matériel & Diagnostic" },
                { id: "premiers soins", label: "Premiers Soins" }
              ].map(f => {
                const isActive = selectedFilter === f.id;
                return (
                  <button
                    key={f.id}
                    id={`filter-pill-${f.id}`}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                      isActive
                        ? "text-white shadow-sm"
                        : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                    style={{
                      backgroundColor: isActive ? primaryColor : undefined
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* 2-Column Product Grid */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              {filteredProducts.slice(0, 8).map((product) => (
                <div 
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={() => handleProductSelect(product)}
                  className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
                >
                  <div>
                    <div className="w-full aspect-square bg-gray-50 dark:bg-zinc-800/80 rounded-xl mb-2.5 overflow-hidden flex items-center justify-center p-2 relative">
                      <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full z-10">
                        En stock
                      </span>
                      {product.image_url || product.imageUrl || product.image ? (
                        <img 
                          src={product.image_url || product.imageUrl || product.image} 
                          alt={product.commercial_name || product.name} 
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div style={{ color: primaryColor }}>
                          {getCategoryIcon(product.category, 36)}
                        </div>
                      )}
                    </div>

                    <h4 
                      className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-1 transition-colors"
                    >
                      {product.commercial_name || product.name}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      {product.dosage || product.dci || product.category}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-medium">Prix</span>
                      <span className="font-extrabold text-sm" style={{ color: primaryColor }}>
                        {product.price ? `${Number(product.price).toLocaleString()} XAF` : "Disponible"}
                      </span>
                    </div>
                    <div 
                      className="w-7 h-7 rounded-lg text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus size={15} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-6 bg-gray-50 dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl text-center space-y-2">
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              Aucun produit actuellement dans cette catégorie
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Utilisez la recherche ou transmettez votre ordonnance pour commander vos médicaments.
            </p>
          </div>
        )}

        <div className="pt-4">
          <button
            id="btn-explore-full-catalog"
            onClick={() => navigate('/patient/search')}
            className="w-full py-3.5 bg-gray-50 dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-800 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2"
          >
            <Search size={15} style={{ color: primaryColor }} />
            <span>Explorer tout le catalogue de médicaments</span>
          </button>
        </div>
      </div>

    </div>
  );
}
