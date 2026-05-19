import { ArrowLeft, Heart, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function PatientWishlist() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-black px-6 pt-12 pb-4 shadow-sm z-10 flex items-center gap-4">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-indigo-900 border border-gray-100 dark:border-zinc-800 rounded-full bg-white dark:bg-slate-950 shadow-sm hover:bg-gray-50 dark:bg-black transition">
            <ArrowLeft size={20} />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">{t('wishlist', 'Wishlist & Saved')}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
         <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-4 text-pink-300">
               <Heart size={32} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('wishlist_empty', 'Your wishlist is empty')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 max-w-[200px] mb-6">{t('save_favorite_desc', 'Save your favorite pharmacy products here.')}</p>
            <button onClick={() => navigate('/patient/search')} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-full flex items-center gap-2">
               <ShoppingBag size={20} /> {t('browse_products', 'Browse Products')}
            </button>
         </div>
      </div>
    </div>
  );
}
