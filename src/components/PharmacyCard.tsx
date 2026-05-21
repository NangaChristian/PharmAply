import { Star, Clock, MapPin, Truck, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface PharmacyCardProps {
  pharmacy: any;
  basePath?: string;
  theme?: any;
}

export function PharmacyCard({ pharmacy, basePath = "/patient/pharmacy", theme = {} }: PharmacyCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`${basePath}/${pharmacy.id}`)} 
      className="cursor-pointer w-full bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition"
    >
      <div className="h-28 w-full bg-blue-100 dark:bg-zinc-800 relative">
        {(pharmacy.bannerUrl || pharmacy.imageUrl || theme.defaultPharmacyLogo) ? (
          <img 
            src={pharmacy.bannerUrl || pharmacy.imageUrl || theme.defaultPharmacyLogo || "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80"} 
            alt={pharmacy.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-blue-500/10 flex items-center justify-center">
            <Store className="text-blue-500/40" size={40} />
          </div>
        )}
      </div>

      <div className="p-4 relative bg-white dark:bg-zinc-950">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center text-indigo-700 dark:text-indigo-400 shrink-0">
               {/* Bowl of Hygieia rough approximation using SVG */}
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20"></path>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  <path d="M12 2C8 2 5 5 5 9"></path>
               </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">{pharmacy.name}</h4>
          </div>
          
          <div className="flex items-center gap-1 font-bold text-sm text-gray-900 dark:text-white shrink-0">
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
            <span>{pharmacy.rating || "4.5"}</span>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-gray-900 dark:text-gray-200 font-medium text-sm truncate">{pharmacy.address || t('address_not_provided', 'Address not provided')}</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 truncate">{pharmacy.city || pharmacy.area || "AlRemal area, Gaza"}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 border border-gray-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-gray-600 dark:text-gray-400">
            <Clock size={12} />
            <span>15 {t('minutes', 'minutes')}</span>
          </div>
          <div className="flex items-center gap-1 border border-gray-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-gray-600 dark:text-gray-400">
            <MapPin size={12} />
            <span>2.55 km</span>
          </div>
          <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg px-2 py-1 font-semibold">
            <Truck size={12} />
            {t('delivery_fees_ss', 'Delivery fees $$')}
          </div>
        </div>
      </div>
    </div>
  );
}
