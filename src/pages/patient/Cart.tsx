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
      <div className="bg-white dark:bg-zinc-900 px-6 pt-12 pb-4 z-10 flex items-center justify-between">
         <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t('cart', 'Cart')}</h1>
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
             <button onClick={() => navigate('/patient')} className="bg-[#16307b] hover:bg-[#122864] text-white font-bold py-4 px-8 min-h-[56px] rounded-[1.2rem] shadow-sm w-full max-w-xs transition-colors touch-manipulation">
                {t('browse_products', 'Browse Products')}
             </button>
           </div>
         ) : (
           <div className="space-y-6">
              
              {/* Items List */}
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
                       <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight mb-1">{item.commercial_name || item.name}</h3>
                       <p className="text-[#1a3b8d] dark:text-indigo-400 font-bold mb-3">{formatCurrency(item.price)}</p>
                       
                       <div className="flex items-center justify-between">
                          <div className="flex items-center bg-gray-50 dark:bg-black rounded-lg p-0.5 border border-gray-200 dark:border-zinc-800">
                             <button onClick={() => updateQuantity(item.id, -1)} className="text-indigo-600 dark:text-indigo-400 p-2 shrink-0 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"><Minus size={14}/></button>
                             <span className="font-bold text-gray-900 dark:text-white mx-2 text-xs min-w-[16px] text-center">{item.quantity}</span>
                             <button onClick={() => updateQuantity(item.id, 1)} className="text-indigo-600 dark:text-indigo-400 p-2 shrink-0 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center text-white bg-[#1a3b8d] rounded-md"><Plus size={14}/></button>
                          </div>
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg shrink-0 flex items-center justify-center touch-manipulation" title="Remove">
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add More Items Button */}
              <button onClick={() => navigate('/patient')} className="w-full bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 font-bold py-4 min-h-[56px] rounded-[1.2rem] shadow-sm border-2 border-indigo-50 dark:border-zinc-800 transition-colors touch-manipulation outline-none flex justify-center items-center gap-2">
                 <Plus size={20} /> Add More Items
              </button>
           </div>
         )}
      </div>

       {items.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 p-6 pb-[calc(env(safe-area-inset-bottom)+5rem)] z-40 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
           {items.some(item => item.classification_liste === 'Liste_1' || item.classification_liste === 'Liste_2' || item.classification_liste === 'Stupefiant') && (
             <div className="mb-4 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg flex items-start gap-2 border border-red-100 dark:border-red-900/50">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
               <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-tight">
                 Garde-Fou DPML: Votre panier contient des médicaments sur ordonnance. Vous devrez télécharger une ordonnance valide à l'étape suivante.
               </p>
             </div>
           )}
           <h3 className="font-bold text-gray-900 dark:text-white mb-4">{t('order_bill', 'Order Bill')}</h3>
           <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500 font-medium text-sm">{t('subtotal', 'Subtotal')}</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(cartTotal)}</span>
           </div>
           <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800">
              <span className="text-gray-500 font-medium text-sm">{t('delivery', 'Delivery')}</span>
              <span className="font-bold text-gray-900 dark:text-white text-sm">{formatCurrency(3.0)}</span>
           </div>
           <div className="flex justify-between items-center mb-6">
              <span className="text-gray-900 dark:text-white font-bold">{t('total', 'Total')}</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(cartTotal + 3.0)}</span>
           </div>
           <button onClick={() => navigate('/patient/checkout')} className="w-full bg-[#0a1128] hover:bg-black text-white font-bold py-4 min-h-[56px] rounded-2xl transition-colors touch-manipulation shadow-md">
              {t('submit_order', 'Submit Order')}
           </button>
        </div>
      )}
    </div>
  );
}
