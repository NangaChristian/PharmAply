import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Leaf, ShieldCheck, AlertCircle, X, ArrowRight, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { db, collection, query, getDocs, limit } from '../lib/firebase';
import { formatCurrency } from '../lib/utils';
import { getCategoryIcon } from '../lib/icons';

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

export function PatientSearchBar() {
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const debouncedQuery = useDebounce(queryText, 250);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchResults = async () => {
      const q = debouncedQuery.trim().toLowerCase();
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      
      setLoading(true);
      const combined: any[] = [];
      const seenIds = new Set<string>();

      try {
        // 1. Search in Firestore products collection (primary real-time catalog)
        const snap = await getDocs(query(collection(db, 'products'), limit(150)));
        snap.docs.forEach((docSnap) => {
          const p = { id: docSnap.id, ...docSnap.data() } as any;
          const name = (p.name || p.commercial_name || p.nom_commercial || '').toLowerCase();
          const dci = (p.dci || p.scientific_name || '').toLowerCase();
          const category = (p.category || p.ux_category || p.categorie || '').toLowerCase();
          const dosage = (p.dosage || p.forme || '').toLowerCase();

          if (name.includes(q) || dci.includes(q) || category.includes(q) || dosage.includes(q)) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              combined.push({
                id: p.id,
                nom_commercial: p.commercial_name || p.name || p.nom_commercial,
                dci: p.dci || p.scientific_name,
                form: p.form || p.forme || 'Boîte',
                dosage: p.dosage || '',
                price: p.price ? Number(p.price) : 2500,
                category_name: p.category || p.ux_category || 'Général',
                is_prescription_required: Boolean(p.is_prescription_required || p.ordonnance_requise || p.requires_prescription),
                is_essentiel: Boolean(p.is_essentiel),
                is_recalled: Boolean(p.is_recalled),
                image_url: p.image_url || p.imageUrl || p.image,
                stock: p.stock !== undefined ? Number(p.stock) : 10
              });
            }
          }
        });

        // 2. Fallback / supplementary search from Supabase RPC or table if available
        try {
          const { data: supaData } = await supabase.rpc('search_medicines_for_patients', {
            search_term: debouncedQuery
          });
          if (Array.isArray(supaData)) {
            supaData.forEach((p: any) => {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                combined.push(p);
              }
            });
          }
        } catch (supaErr) {
          // Ignore if Supabase RPC is optional
        }

        setResults(combined.slice(0, 10));
        setIsOpen(combined.length > 0 || q.length >= 2);
      } catch (err) {
        console.error("Error searching medicines:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryText.trim()) return;
    setIsOpen(false);
    navigate(`/patient/search?q=${encodeURIComponent(queryText.trim())}`);
  };

  const handleSelectProduct = (product: any) => {
    setIsOpen(false);
    if (product.id) {
      navigate(`/patient/product/${product.id}`);
    } else {
      navigate(`/patient/search?q=${encodeURIComponent(product.nom_commercial || product.dci || '')}`);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <form onSubmit={handleSearchSubmit} className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#194B4B] dark:text-teal-400">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-20 py-3 border border-gray-200 dark:border-zinc-700 rounded-2xl leading-5 bg-gray-50/80 dark:bg-zinc-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#194B4B] focus:border-[#194B4B] text-xs sm:text-sm transition-all dark:text-white shadow-xs"
          placeholder="Rechercher un médicament, DCI, symptôme..."
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onFocus={() => { if (results.length > 0 || queryText.length >= 2) setIsOpen(true); }}
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {queryText.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQueryText('');
                setResults([]);
                setIsOpen(false);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#194B4B] hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 active:scale-95"
          >
            <span>Rechercher</span>
          </button>
        </div>
      </form>

      {/* Autocomplete Results Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-zinc-900 shadow-2xl max-h-[26rem] rounded-2xl py-2 text-sm ring-1 ring-black/5 overflow-y-auto border border-gray-100 dark:border-zinc-800">
          {results.length > 0 ? (
            <>
              <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <span>Résultats suggérés ({results.length})</span>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="text-[#194B4B] dark:text-teal-400 hover:underline flex items-center gap-0.5 normal-case font-semibold"
                >
                  Voir tout dans le catalogue <ArrowRight size={12} />
                </button>
              </div>

              <div className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                {results.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="p-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/70 cursor-pointer transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 shrink-0 overflow-hidden flex items-center justify-center p-1 border border-gray-200/60 dark:border-zinc-700">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          getCategoryIcon(product.category_name, 20)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm truncate group-hover:text-[#194B4B] dark:group-hover:text-teal-400 transition-colors">
                            {product.nom_commercial || product.name || product.dci}
                          </p>
                          {product.is_prescription_required && (
                            <span className="bg-red-50 text-red-600 dark:bg-red-950/40 text-[9px] font-bold px-1.5 py-0.2 rounded border border-red-200">
                              Ordonnance
                            </span>
                          )}
                          {product.is_essentiel && (
                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                              Essentiel
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {product.dci ? `DCI: ${product.dci} • ` : ''}{product.dosage || product.form || product.category_name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-xs sm:text-sm text-[#194B4B] dark:text-teal-400">
                        {product.price ? formatCurrency(product.price) : 'En stock'}
                      </p>
                      <span className="text-[10px] text-gray-400 font-medium">Disponible</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-gray-50 dark:bg-zinc-800/40 border-t border-gray-100 dark:border-zinc-800 text-center">
                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="w-full py-2 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold text-[#194B4B] dark:text-teal-300 border border-gray-200 dark:border-zinc-700 transition flex items-center justify-center gap-1.5"
                >
                  <Search size={13} />
                  <span>Afficher tous les résultats pour « {queryText} »</span>
                </button>
              </div>
            </>
          ) : (
            !loading && queryText.length >= 2 && (
              <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400 space-y-2">
                <Search className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
                <p className="font-bold text-gray-700 dark:text-gray-300">Aucun médicament trouvé pour « {queryText} »</p>
                <p className="text-[11px] text-gray-400">Appuyez sur "Rechercher" pour explorer tout le catalogue ou envoyer une ordonnance.</p>
                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="mt-2 px-4 py-2 bg-[#194B4B] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"
                >
                  Rechercher dans le catalogue complet
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
