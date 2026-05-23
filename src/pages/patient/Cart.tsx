import { ShoppingCart, Trash2, Plus, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../../components/CartProvider";
import { formatCurrency } from "../../lib/utils";

export function PatientCart() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, removeFromCart, updateQuantity, cartTotal } = useCart();

  return (
    <div className="flex-1 bg-gray-50 dark:bg-black flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-900 px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800">
         <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('cart', 'Cart')}</h1>
         <div className="w-8"></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 flex flex-col pb-32">
         {items.length === 0 ? (
           <div className="flex flex-col items-center justify-center text-center mt-20">
             <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6 text-indigo-400 border-4 border-white dark:border-zinc-800 shadow-sm">
                <ShoppingCart size={32} />
             </div>
             <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('your_cart_is_empty', 'Your cart is empty')}</h2>
             <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-xs">{t('cart_empty_desc', 'Looks like you haven\'t added anything to your cart yet. Explore our wide range of products.')}</p>
             <button onClick={() => navigate('/patient')} className="bg-[#16307b] hover:bg-[#122864] text-white font-bold py-4 px-8 rounded-[1.2rem] shadow-sm w-full max-w-xs transition-colors">
                {t('browse_products', 'Browse Products')}
             </button>
           </div>
         ) : (
           <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center flex-shrink-0">
                    {item.imageUrl ? (
                       <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-contain" />
                    ) : (
                       <ShoppingCart size={24} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1">
                     <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight mb-1">{item.name}</h3>
                     <p className="text-[#1a3b8d] dark:text-indigo-400 font-bold mb-3">{formatCurrency(item.price)}</p>
                     
                     <div className="flex items-center justify-between">
                        <div className="flex items-center bg-gray-50 dark:bg-black rounded-lg px-2 py-1 border border-gray-200 dark:border-zinc-800">
                           <button onClick={() => updateQuantity(item.id, -1)} className="text-indigo-600 dark:text-indigo-400 p-1"><Minus size={14}/></button>
                           <span className="font-bold text-gray-900 dark:text-white mx-3 text-sm">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.id, 1)} className="text-indigo-600 dark:text-indigo-400 p-1"><Plus size={14}/></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full">
                           <Trash2 size={14} />
                        </button>
                     </div>
                  </div>
                </div>
              ))}
           </div>
         )}
      </div>

      {items.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 p-4 px-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] z-40">
           <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 dark:text-gray-400 font-medium">{t('total', 'Total')}</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(cartTotal)}</span>
           </div>
           <button onClick={() => navigate('/patient/checkout')} className="w-full bg-[#16307b] hover:bg-[#122864] text-white font-bold py-3.5 rounded-[1.2rem] shadow-sm transition-colors">
              {t('checkout', 'Checkout')}
           </button>
        </div>
      )}
    </div>
  );
}
