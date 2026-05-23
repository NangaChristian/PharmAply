import { useState, useEffect } from "react";
import { ArrowLeft, SlidersHorizontal, Star, Activity, Pill } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, query, getDocs, limit } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import { ProductCard } from '../../components/ProductCard';
import { getCategoryIcon } from '../../lib/icons';

export function PatientSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), limit(20));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    const fetchCategories = async () => {
      try {
        const cq = query(collection(db, 'categories'), limit(12));
        const snapshot = await getDocs(cq);
        setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Failed to fetch categories", error);
      }
    };

    fetchProducts();
    fetchCategories();
  }, []);

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (p.category?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:bg-zinc-900 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-900 dark:text-white" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              autoFocus
              placeholder={t('search_products_desc', 'Search products or categories...')}
              className="w-full bg-gray-100 dark:bg-zinc-900 py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!searchQuery && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white">{t('categories', 'Categories')}</h3>
            <div className="flex gap-2 mt-3 flex-wrap">
              {categories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setSearchQuery(cat.name)}
                  className="bg-white dark:bg-black border border-indigo-100 px-3 py-2 rounded-full text-xs font-medium text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 transition-colors"
                >
                  <div className="opacity-70">{getCategoryIcon(cat.name, 14, "")}</div>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div>
           <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t('relevant_products', 'Relevant Products')}</h3>
           <div className="grid grid-cols-2 gap-4">
             {loading ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 col-span-2">{t('loading_products', 'Loading products...')}</p> : 
              filteredProducts.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 col-span-2">{t('no_products_found', 'No products found.')}</p> :
              filteredProducts.map(product => (
                <div key={product.id}>
                   <ProductCard product={product} basePath="/patient/product" showSaleBadge={true} />
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
