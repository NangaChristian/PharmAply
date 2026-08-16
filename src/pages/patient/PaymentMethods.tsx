import { ArrowLeft, CreditCard, Plus, Smartphone, Wallet, ArrowUpRight, ArrowDownRight, Clock, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthProvider";
import { formatCurrency, parseDate } from "../../lib/utils";

export function PatientPaymentMethods() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Fetch transaction history
    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false });
          
        if (data && !error) {
          setTransactions(data);
        }
      } catch (err) {
        console.warn("Could not fetch transactions:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
    
    // Subscribe to new transactions
    const channel = supabase.channel(`wallet_tx_${user.uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.uid}` }, (payload) => {
        setTransactions(prev => [payload.new, ...prev]);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-indigo-900 border border-gray-100 dark:border-zinc-800 rounded-full bg-white dark:bg-zinc-900 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition">
              <ArrowLeft size={20} />
           </button>
           <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('wallet_payments', 'Paiements & Historique')}</h1>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32 custom-scrollbar">
         
         {/* Fapshi Setup Card */}
         <div className="bg-gradient-to-br from-[#1a3b8d] to-indigo-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400 opacity-10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Wallet size={20} className="text-white" />
                </div>
                <h2 className="font-bold text-lg tracking-tight">Moyens de Paiement</h2>
              </div>
              
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4 flex items-center justify-between mb-4">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1a3b8d]">
                       <Smartphone size={24} />
                    </div>
                    <div>
                       <p className="font-bold text-sm">Mobile Money via Fapshi</p>
                       <p className="text-xs text-indigo-200 mt-0.5">Orange Money / MTN / Cartes</p>
                    </div>
                 </div>
                 <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold border border-emerald-500/30">
                    Actif par défaut
                 </div>
              </div>

              <p className="text-xs text-indigo-200/80 leading-relaxed">
                Les paiements par Mobile Money sont gérés de manière sécurisée par l'API Fapshi. Aucune information bancaire n'est stockée sur nos serveurs.
              </p>
            </div>
         </div>

         {/* Transactions History */}
         <div>
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
                 Historique des Transactions
               </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3b8d]"></div>
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                 {transactions.map((tx) => (
                    <div key={tx.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'credit' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                          {tx.type === 'credit' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{tx.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Clock size={12} className="text-gray-400" />
                             <span className="text-[11px] text-gray-500">{parseDate(tx.created_at)}</span>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className={`font-bold text-sm ${tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                             {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                          </p>
                          {tx.reference && <p className="text-[10px] text-gray-400 mt-0.5">Réf: {tx.reference.substring(0,8)}</p>}
                       </div>
                    </div>
                 ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 border-dashed">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-black rounded-full flex items-center justify-center mb-4 text-gray-400 dark:text-gray-600">
                     <FileText size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Aucune transaction</h3>
                  <p className="text-xs text-gray-500 max-w-[200px]">Vous n'avez pas encore effectué de paiement via l'application.</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
