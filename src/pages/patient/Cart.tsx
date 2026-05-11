import { ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function PatientCart() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between">
         <h1 className="text-lg font-bold text-indigo-900 border-b-2 border-transparent">{t('cart', 'Cart')}</h1>
         <div className="w-8"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center pb-24">
         <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-200 border-4 border-white shadow-sm">
            <ShoppingCart size={32} />
         </div>
         <h2 className="text-xl font-bold text-gray-900 mb-2">{t('your_cart_is_empty', 'Your cart is empty')}</h2>
         <p className="text-sm text-gray-500 mb-8 max-w-xs">{t('cart_empty_desc', 'Looks like you haven\'t added anything to your cart yet. Explore our wide range of products.')}</p>
         <button onClick={() => navigate('/patient')} className="bg-indigo-600 text-white font-bold py-4 px-8 rounded-full shadow-md shadow-indigo-200 w-full max-w-xs">
            {t('browse_products', 'Browse Products')}
         </button>
      </div>
    </div>
  );
}
