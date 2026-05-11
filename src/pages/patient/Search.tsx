import { useState, useEffect } from "react";
import { ArrowLeft, SlidersHorizontal, Star, Activity, Pill } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";

export function PatientSearch() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
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
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (p.category?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              autoFocus
              placeholder={t('search_products_desc', 'Search products or categories...')}
              className="w-full bg-gray-100 py-3 px-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
        <div className="mb-4">
          <h3 className="font-bold text-gray-900">{t('recent_searches', 'Recent Searches')}</h3>
          <div className="flex gap-2 mt-3 flex-wrap">
            {["Panadol", "Cold medicine", "Vitamin C"].map(term => (
              <button 
                key={term} 
                onClick={() => setSearchQuery(term)}
                className="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div>
           <h3 className="font-bold text-gray-900 mb-4">{t('relevant_products', 'Relevant Products')}</h3>
           <div className="space-y-4">
             {loading ? <p className="text-sm text-gray-500">{t('loading_products', 'Loading products...')}</p> : 
              filteredProducts.length === 0 ? <p className="text-sm text-gray-500">{t('no_products_found', 'No products found.')}</p> :
              filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => navigate(`/patient/product/${product.id}`)}
                  className="bg-white p-4 rounded-2xl flex gap-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
                >
                   <div className="w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center text-indigo-300">
                      <Pill size={32} />
                   </div>
                   <div className="flex-1">
                      <div className="flex justify-between items-start">
                         <h4 className="font-bold text-gray-900 text-sm">{product.name}</h4>
                         <div className="flex items-center text-xs font-bold text-yellow-500 bg-yellow-50 px-1.5 py-0.5 rounded">
                            <Star size={10} className="fill-current mr-1" />
                            {product.rating || "5.0"}
                         </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 truncate max-w-[180px]">{t(product.category?.replace(/\s+/g, '_').toLowerCase(), product.category)}</p>
                      <div className="flex items-center justify-between mt-auto">
                         <div className="flex items-center gap-2">
                             <span className="font-bold text-gray-900">{formatCurrency(product.price)}</span>
                         </div>
                         <button className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                            +
                         </button>
                      </div>
                   </div>
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
