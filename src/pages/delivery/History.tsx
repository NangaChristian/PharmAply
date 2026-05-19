import { useState, useEffect } from "react";
import { ArrowLeft, Clock, MapPin, Package, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, orderBy } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { formatCurrency, parseDate } from '../../lib/utils';
import { useTranslation } from "react-i18next";

export function DeliveryHistory() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'orders'), 
          where('driverId', '==', user.uid),
          where('status', '==', 'delivered')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        // Manual sort if index is an issue otherwise use firebase orderBy
        data.sort((a, b) => {
           const tA = parseDate(a.createdAt) ? parseDate(a.createdAt)!.getTime() : 0;
           const tB = parseDate(b.createdAt) ? parseDate(b.createdAt)!.getTime() : 0;
           return tB - tA;
        });
        setHistory(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800">
         <h1 className="font-bold text-gray-900 dark:text-white text-xl mb-4"> {t('history', 'History')} </h1>
         <div className="flex gap-4 border-b border-gray-100 dark:border-zinc-800 pb-2 text-sm font-medium">
            <button className="text-indigo-600 border-b-2 border-indigo-600 pb-2"> {t('all', 'All')} </button>
            <button className="text-gray-400 dark:text-gray-500 pb-2"> {t('today', 'Today')} </button>
            <button className="text-gray-400 dark:text-gray-500 pb-2"> {t('this_week', 'This Week')} </button>
            <button className="text-gray-400 dark:text-gray-500 pb-2"> {t('this_month', 'This Month')} </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
         {loading ? (
           <p className="text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-4"> {t('loading_history', 'Loading history...')} </p>
         ) : history.length === 0 ? (
           <p className="text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 py-4"> {t('no_completed_deliveries_yet', 'No completed deliveries yet.')} </p>
         ) : history.map((item, i) => (
            <div key={i} className="bg-white dark:bg-black rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 text-sm">
               <div className="flex justify-between items-start border-b border-gray-50 pb-3 mb-3">
                  <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-wider">
                     <span> {t('order', 'Order #')} {item.id.slice(0,8)}</span>
                  </div>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md font-bold text-xs flex items-center gap-1 uppercase tracking-wide">
                     <CheckCircle size={10} /> {item.status}
                  </span>
               </div>
               
               <div className="font-bold text-gray-900 dark:text-white mb-0.5">{item.deliveryAddress || 'Customer Address'}</div>
               <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">{parseDate(item.createdAt) ? parseDate(item.createdAt)!.toLocaleDateString() : 'Recently'}</div>
               
               <div className="flex items-center gap-4 text-xs font-semibold text-gray-600 bg-gray-50 dark:bg-black p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
                  <div className="flex-1 flex justify-center items-center gap-1.5"><MapPin size={12} className="text-indigo-500" />  {t('local', 'Local')} </div>
                  <div className="w-[1px] h-4 bg-gray-200"></div>
                  <div className="flex-1 flex justify-center items-center gap-1.5 text-green-600 font-bold">{formatCurrency((item.total || 0) * 0.1)}</div>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
}
