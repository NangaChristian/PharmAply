import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Leaf, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

export function PatientSearchBar() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchResults = async () => {
      // Don't search if query is less than 2 characters
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_medicines_for_patients', {
          search_term: debouncedQuery
        });
        
        if (error) {
          console.warn("RPC Error:", error);
          setResults([]);
          return;
        }
        
        setResults(data || []);
        setIsOpen(true);
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

  const directMatches = results.filter(r => !r.is_alternative);
  const alternatives = results.filter(r => r.is_alternative && r.is_essentiel);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl leading-5 bg-white dark:bg-zinc-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow dark:text-white"
          placeholder="Rechercher un médicament (ex: Doliprane, Paracétamol, Fièvre)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-800 shadow-xl max-h-[32rem] rounded-xl py-2 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm border border-gray-100 dark:border-zinc-700">
          {/* Résultats Directs */}
          {directMatches.length > 0 && (
            <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Produits Correspondants
            </div>
          )}
          {directMatches.map((product) => (
            <ProductItem key={product.id} product={product} onClick={() => {
              setQuery(product.nom_commercial || product.dci);
              setIsOpen(false);
            }} />
          ))}

          {/* Alternatives Essentielles */}
          {alternatives.length > 0 && (
             <div className="mt-2 text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 pt-3 pb-1 border-t border-gray-100 dark:border-zinc-700/50 flex flex-col">
               <span className="flex items-center text-green-600 dark:text-green-400 mb-1">
                 <Leaf className="w-3 h-3 mr-1" />
                 Alternatives Génériques Recommandées
               </span>
               <span className="text-gray-400 font-normal lowercase">Basées sur la DCI correspondante</span>
             </div>
          )}
          {alternatives.map((product) => (
            <div key={product.id} className="bg-green-50/50 dark:bg-green-900/10 border-l-2 border-green-400">
              <ProductItem product={product} onClick={() => {
                setQuery(product.nom_commercial || product.dci);
                setIsOpen(false);
              }} />
            </div>
          ))}
        </div>
      )}
      
      {isOpen && !loading && query.length >= 2 && results.length === 0 && (
         <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 shadow-lg rounded-xl py-6 text-center text-sm text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-zinc-700">
          <Search className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
          <p>Aucun médicament trouvé pour "{query}".</p>
          <p className="text-xs mt-1 text-gray-400">Essayez de chercher par DCI, marque, ou symptôme.</p>
        </div>
      )}
    </div>
  );
}

const ProductItem: React.FC<{ product: any; onClick: () => void }> = ({ product, onClick }) => {
  const isPrescriptionRequired = product.is_prescription_required || product.classification_liste === 'Liste_1' || product.classification_liste === 'Liste_2' || product.classification_liste === 'Stupefiant';

  return (
    <div 
      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 px-4 py-3 border-b border-gray-50 dark:border-zinc-700/50 last:border-0 transition-colors"
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h4 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
              {product.nom_commercial || product.dci}
            </h4>
            {product.is_recalled && (
               <span className="inline-flex items-center text-[10px] uppercase font-bold text-white bg-red-600 animate-pulse px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  LOT RETIRÉ DPML
               </span>
            )}
            {product.is_essentiel && (
               <span className="inline-flex items-center text-[10px] uppercase font-bold text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40 px-1.5 py-0.5 rounded">
                  <Leaf className="w-3 h-3 mr-1" />
                  Médicament Essentiel
               </span>
            )}
            <span className="inline-flex items-center text-[10px] uppercase font-bold text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">
               <ShieldCheck className="w-3 h-3 mr-1" />
               AMM Validée
            </span>
            {isPrescriptionRequired && (
               <span className="inline-flex items-center text-[10px] uppercase font-bold text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40 px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Ordonnance Obligatoire
               </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
            DCI: <span className="text-gray-700 dark:text-gray-300">{product.dci}</span> • {product.form} {product.dosage}
          </p>
        </div>
        {product.price && (
          <div className="flex-shrink-0 flex items-center mt-1">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300">
              {product.price} FCFA
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center text-[11px] font-medium text-indigo-600 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-900/30 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/50">
          {product.category_name}
        </span>
        {product.classification_liste && product.classification_liste !== 'Libre' && (
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 ml-2">
            Classification: {product.classification_liste.replace('_', ' ')}
          </span>
        )}
      </div>
    </div>
  );
}
