import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid, Search, Plus, Loader2 } from 'lucide-react';
import { collection, getDocs, db } from '../../lib/firebase';

export function PharmacistCategories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'ux_categories'));
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Failed to fetch categories", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const filteredCategories = categories.filter(c => 
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Grid size={24} />
            </div>
            {t('categories', 'Categories')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('manage_categories_desc', 'View platform admin categories available to your pharmacy.')}
          </p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition duration-200 opacity-50 cursor-not-allowed" title="Admin only">
          <Plus size={18} />
          <span>{t('add_category', 'Add Category')}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input 
          type="text" 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search_categories', 'Search categories...')}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCategories.map(cat => (
            <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 hover:border-indigo-500 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-xl">
                 {cat.icon || '📦'}
              </div>
              <div>
                 <h3 className="font-bold text-gray-900 dark:text-white">{cat.name}</h3>
                 <p className="text-xs text-gray-500 mt-1">{cat.description || 'Global Category'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8 text-center text-gray-500">
          {t('no_categories_found', 'No categories found.')}
        </div>
      )}
    </div>
  );
}
