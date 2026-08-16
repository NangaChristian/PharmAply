import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";

import { collection, query, limit, getDocs, where } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTheme } from '../../components/ThemeProvider';
import { useTranslation } from "react-i18next";
import { NotificationBell } from "../../components/NotificationBell";
import { PatientSearchBar } from '../../components/PatientSearchBar';
import { SearchHeroBanner, CategoryItem, GeneralProductItem } from '../../components/SearchHeroBanner';

// Fallback admin categories if not yet created in Firestore
const DEFAULT_CATEGORIES: CategoryItem[] = [
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

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<GeneralProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch categories (from 'categories' or 'ux_categories')
    const fetchCategories = async () => {
      try {
        const [catSnap, uxCatSnap] = await Promise.all([
          getDocs(query(collection(db, 'categories'), limit(20))),
          getDocs(query(collection(db, 'ux_categories'), limit(20)))
        ]);

        const loadedCats: CategoryItem[] = [];
        const seenNames = new Set<string>();

        // Admin categories
        catSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          if (data.name && !seenNames.has(data.name.toLowerCase().trim())) {
            seenNames.add(data.name.toLowerCase().trim());
            loadedCats.push({ id: docSnap.id, name: data.name, description: data.description, imageUrl: data.imageUrl });
          }
        });

        // UX categories
        uxCatSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          if (data.name && !seenNames.has(data.name.toLowerCase().trim())) {
            seenNames.add(data.name.toLowerCase().trim());
            loadedCats.push({ id: docSnap.id, name: data.name, description: data.description, imageUrl: data.imageUrl });
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

    // 2. Fetch exclusively real products available in approved pharmacies (stock > 0)
    const fetchAvailablePharmacyProducts = async () => {
      try {
        const [pSnap, phSnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), limit(300))),
          getDocs(query(collection(db, 'pharmacies'), where('status', '==', 'approved'), limit(200)))
        ]);

        const approvedPharmacyIds = new Set<string>();
        phSnap.docs.forEach(d => approvedPharmacyIds.add(d.id));

        const rawProducts = pSnap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }));

        // Deduplicate and group only products with real available stock in pharmacies
        const availableGroups = new Map<string, GeneralProductItem>();

        rawProducts.forEach(p => {
          const stock = Number(p.stock ?? (p.quantity ?? 0));
          // Filter strictly for products with stock > 0
          if (stock <= 0) return;

          // If assigned to a pharmacy, verify the pharmacy is approved (if pharmacies are configured)
          if (p.pharmacyId && approvedPharmacyIds.size > 0 && !approvedPharmacyIds.has(p.pharmacyId)) {
            return;
          }

          const groupKey = (p.productId || p.global_product_id || p.commercial_name || p.name || p.id).trim().toLowerCase();
          const price = parseFloat(p.price) || 0;

          if (!availableGroups.has(groupKey)) {
            availableGroups.set(groupKey, {
              id: p.id,
              name: p.name || p.commercial_name,
              commercial_name: p.commercial_name || p.name,
              dci: p.dci || p.scientific_name,
              dosage: p.dosage,
              price: price,
              category: p.category || p.ux_category || p.ux_categories?.name || "Général",
              is_prescription_required: Boolean(p.is_prescription_required || p.requires_prescription),
              is_essentiel: Boolean(p.is_essentiel),
              image_url: p.image_url || p.imageUrl || p.image,
              description: p.description
            });
          } else {
            const existing = availableGroups.get(groupKey)!;
            if (price > 0 && (existing.price === 0 || price < (existing.price || 0))) {
              existing.price = price;
              existing.id = p.id;
            }
          }
        });

        setProducts(Array.from(availableGroups.values()));
      } catch (err) {
        console.error("Error loading products available in pharmacies:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
    fetchAvailablePharmacyProducts();
  }, []);

  const handleProductClick = (product: GeneralProductItem) => {
    if (product.id) {
      navigate(`/patient/product/${product.id}`);
    } else {
      const q = product.commercial_name || product.name || product.dci;
      navigate(`/patient/search?q=${encodeURIComponent(q || "")}`);
    }
  };

  const handleCategoryClick = (cat: CategoryItem) => {
    navigate(`/patient/search?q=${encodeURIComponent(cat.name)}`);
  };

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
      <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
        <SearchHeroBanner 
          categories={categories}
          products={products}
          onProductClick={handleProductClick}
          onCategoryClick={handleCategoryClick}
        />
      </div>

    </div>
  );
}
