import React from "react";
import { Activity, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../lib/utils";
import { useTranslation } from "react-i18next";
import { getCategoryIcon } from "../lib/icons";

export interface ProductCardProps {
  product: any;
  basePath?: string; // e.g. "/patient/product" or "/pharmacist/inventory"
  onClick?: (product: any) => void;
  showSaleBadge?: boolean;
  onHeartClick?: (e: React.MouseEvent, product: any) => void;
  isWishlisted?: boolean;
}

export function ProductCard({ product, basePath, onClick, showSaleBadge = false, onHeartClick, isWishlisted = false }: ProductCardProps) {
    const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(product);
    } else if (basePath) {
      navigate(`${basePath}/${product.id}`);
    }
  };

  const isRx = String(product.is_prescription_required || product.requires_prescription || product.RequiresPrescription || product.requiresPrescription || product.Prescription || '').toLowerCase() === 'true';

  const title = product.commercial_name || product.name;
  const subtitle = product.dci || product.scientific_name || product.active_ingredient;
  const categoryName = product.ux_categories?.name || product.category || product.Category;
  const categoryIcon = product.ux_categories?.icon || product.category || product.Category;

  return (
    <div 
      onClick={handleClick}
      className="flex flex-col cursor-pointer group"
    >
      <div className="relative w-full aspect-[4/3] bg-slate-100/50 dark:bg-zinc-800/50 rounded-2xl mb-3 overflow-hidden flex items-center justify-center p-4 group-hover:bg-slate-100 dark:group-hover:bg-zinc-800 transition-colors">
        {showSaleBadge && (
          <div className="absolute top-2 left-2 bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
             {t('25_off', '25% Off')} </div>
        )}
        {onHeartClick && (
          <button 
            onClick={(e) => onHeartClick(e, product)}
            className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full text-gray-400 hover:text-red-500 transition-colors z-10 shadow-sm"
          >
             <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} className={isWishlisted ? "text-red-500" : ""} />
          </button>
        )}
        {(product.image_url || product.imageUrl || product.ImageURL || product.image || product.Image) ? (
          <img src={product.image_url || product.imageUrl || product.ImageURL || product.image || product.Image} alt={title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="text-gray-300 dark:text-gray-600">
             {getCategoryIcon(categoryIcon, 32)}
          </div>
        )}
      </div>
      
      <div className="flex flex-col">
        <div className="flex items-start justify-between mb-1.5">
          <div>
            <h3 className="font-extrabold text-[#1a1f36] dark:text-gray-100 text-sm sm:text-base leading-tight truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{subtitle}</p>}
          </div>
          <button className="w-5 h-5 shrink-0 border border-indigo-900/20 dark:border-indigo-400/20 rounded-full flex items-center justify-center text-indigo-900 dark:text-indigo-400 transition-colors">
            {getCategoryIcon(categoryIcon, 10)}
          </button>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-1">
          {product.is_recalled && (
             <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight flex items-center gap-0.5 animate-pulse w-full mb-1">
               ⚠ ALERTE DPML: LOT RETIRÉ
             </span>
          )}
          {product.is_essentiel && (
             <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight flex items-center gap-0.5">
               Médicament Essentiel
             </span>
          )}
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight flex items-center gap-0.5">
            AMM Validée
          </span>
          {isRx && (
             <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight flex items-center gap-0.5">
               Ordonnance Obligatoire
             </span>
          )}
          {product.dosage && !isRx && (
             <span className="bg-[#FDF9EE] dark:bg-yellow-900/20 text-[#786345] dark:text-yellow-500 px-1.5 py-0.5 rounded-sm text-[10px] font-bold tracking-tight truncate max-w-[80px]">
               {product.dosage}
             </span>
          )}
          {product.form && !isRx && (
             <span className="bg-[#FDF9EE] dark:bg-yellow-900/20 text-[#786345] dark:text-yellow-500 px-1.5 py-0.5 rounded-sm text-[10px] font-bold tracking-tight truncate max-w-[80px]">
               {product.form}
             </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-[#2F7D4E] dark:text-emerald-400 text-sm sm:text-base">{formatCurrency(parseFloat(product.price) || 0)}</span>
          {showSaleBadge && <span className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs font-semibold line-through">{formatCurrency((parseFloat(product.price) || 0) * 1.25)}</span>}
        </div>
      </div>
    </div>
  );
}
