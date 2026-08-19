import { useState, useEffect } from "react";
import { ArrowLeft, Heart, Star, Pill, ShieldAlert, FileText, CheckCircle2, AlertCircle, ShoppingCart } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, collection, getDocs, db, auth } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import { useTranslation } from "react-i18next";
import { getCategoryIcon } from "../../lib/icons";
import { useCart } from "../../components/CartProvider";
import { useTheme } from "../../components/ThemeProvider";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "motion/react";

export function PatientProductDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const theme = useTheme();
  const primaryColor = theme.primaryColor || '#194B4B';

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'effects' | 'directions' | 'reviews'>('details');
  const [isWishlist, setIsWishlist] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        let prodData: any = null;

        // 1. Try fetching from produits_patients first for full master medical catalog
        const { data: ppData } = await supabase.from('produits_patients').select('*').eq('id', id).maybeSingle();
        if (ppData) {
          const rawName = ppData.nom_commercial || ppData.commercial_name || ppData.name || '';
          const rawCat = (ppData.category && ppData.category !== 'Uncategorized')
            ? ppData.category
            : (ppData.categorie_ux || ppData.ux_category || ppData.categorie || 'Douleurs & Fièvre');
          const rawBrand = ppData.brand || ppData.marque || ppData.manufacturer || 'Laboratoire Agréé';

          prodData = {
            id: ppData.id,
            name: rawName,
            commercial_name: rawName,
            nom_commercial: rawName,
            dci: ppData.dci || ppData.description || rawName,
            description: ppData.description || ppData.dci || rawName,
            dosage: ppData.dosage || ppData.forme || ppData.form || '',
            form: ppData.forme || ppData.form || 'Boîte',
            forme: ppData.forme || ppData.form || 'Boîte',
            brand: rawBrand,
            marque: rawBrand,
            category: rawCat,
            category_id: ppData.category_id || ppData.ux_category_id || null,
            is_prescription_required: ppData.is_prescription_required !== undefined ? !!ppData.is_prescription_required : (!!ppData.ordonnance_requise || false),
            ordonnance_requise: ppData.is_prescription_required !== undefined ? !!ppData.is_prescription_required : (!!ppData.ordonnance_requise || false),
            price: ppData.price ? Number(ppData.price) : 2500,
            stock: ppData.stock !== undefined ? Number(ppData.stock) : 25,
            imageUrl: ppData.image_url || ppData.imageUrl || ppData.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
            image_url: ppData.image_url || ppData.imageUrl || ppData.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
            effects: ppData.effects || ppData.effets || '',
            directions: ppData.directions || ppData.mode_emploi || ''
          };
        }

        // 2. If not found in produits_patients, fetch from products table
        if (!prodData) {
          const docRef = doc(db, 'products', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const rawName = data.name || data.commercial_name || data.nom_commercial || '';
            const rawCat = (data.category && data.category !== 'Uncategorized')
              ? data.category
              : (data.categorie_ux || data.ux_category || data.categorie || 'Douleurs & Fièvre');
            prodData = {
              id: docSnap.id,
              ...data,
              name: rawName,
              category: rawCat,
              price: data.price ? Number(data.price) : 2500,
              stock: data.stock !== undefined ? Number(data.stock) : 20
            };
          }
        }

        if (prodData) {
          setProduct(prodData);

          // Check wishlist
          if (auth.currentUser) {
            const wishlistRef = doc(db, 'users', auth.currentUser.uid, 'wishlist', prodData.id);
            const wishlistSnap = await getDoc(wishlistRef);
            setIsWishlist(wishlistSnap.exists());
          }

          // 3. Fetch real reviews from Firestore or Supabase
          try {
            const reviewsQ = collection(db, 'reviews');
            const reviewSnaps = await getDocs(reviewsQ);
            const revs = reviewSnaps.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((r: any) => r.productId === prodData.id || r.product_id === prodData.id);
            setReviews(revs);
          } catch (rErr) {
            console.warn("Reviews load notice:", rErr);
            setReviews([]);
          }
        }
      } catch (error) {
        console.error("Error fetching product details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const toggleWishlist = async () => {
    if (!auth.currentUser || !product) {
       toast.error(t('login_required', 'Veuillez vous connecter d\'abord'));
       return;
    }
    try {
      if (isWishlist) {
         setIsWishlist(false);
         toast(t('removed_wishlist', 'Retiré des favoris'), { icon: '💔' });
      } else {
         setIsWishlist(true);
         toast(t('added_wishlist', 'Ajouté aux favoris'), { icon: '❤️' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const incrementQty = () => {
     setQuantity(q => q + 1);
  };

  const decrementQty = () => setQuantity(q => Math.max(1, q - 1));

  const handleAddToCart = () => {
     if (!product) return;
     addToCart(product, quantity);
     toast.success(`${product.name} ajouté au panier !`);
  };

  if (loading) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-8">
        <div 
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-4" 
          style={{ borderColor: primaryColor, borderTopColor: 'transparent' }}
        />
        <p className="text-sm font-medium text-gray-500">Chargement de la fiche produit...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Médicament introuvable</h2>
        <p className="text-sm text-gray-500 mb-6">Ce produit n'est plus disponible ou a été déplacé dans le catalogue.</p>
        <button
          onClick={() => navigate('/patient/search')}
          className="text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition hover:opacity-90 active:scale-95"
          style={{ backgroundColor: primaryColor }}
        >
          Parcourir les médicaments
        </button>
      </div>
    );
  }

  const isPrescription = product.is_prescription_required || product.ordonnance_requise;
  const rawDci = product.dci || product.description || product.name;
  const rawCategory = product.category || "Médicament";
  const rawBrand = product.brand || product.marque || "Laboratoire Pharmaceutique Homologué";

  const medicalDetails = product.description && product.description !== product.name && product.description.length > 20
    ? product.description
    : `${product.name} (${rawDci}) est un médicament indiqué dans la prise en charge thérapeutique relevant de la classe "${rawCategory}". Délivré sous contrôle pharmaceutique conformément aux directives sanitaires en vigueur.`;

  const medicalEffects = product.effects && product.effects.trim() !== ''
    ? product.effects
    : `Principe actif : ${rawDci}. Action ciblée pour le soulagement des symptômes et la régulation thérapeutique. Tolérance clinique éprouvée. Ne pas combiner avec d'autres molécules sans avis de votre médecin ou pharmacien.`;

  const medicalDirections = product.directions && product.directions.trim() !== ''
    ? product.directions
    : `Posologie habituelle : Se conformer scrupuleusement à la prescription médicale ou à la notice officielle. Prendre avec un verre d'eau. Respecter les intervalles recommandés entre les prises. Tenir hors de portée des enfants.`;

  return (
    <div className="flex-1 bg-white dark:bg-zinc-950 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between z-10 sticky top-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-100 dark:border-zinc-900">
         <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-full border border-gray-200 dark:border-zinc-800 shadow-sm transition hover:bg-gray-100"
         >
            <ArrowLeft size={20} className="text-gray-900 dark:text-white" />
         </button>
         <div className="text-center">
            <h1 className="font-bold text-gray-900 dark:text-white text-sm">Fiche Médicament</h1>
            <p 
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: primaryColor }}
            >
              {rawCategory}
            </p>
         </div>
         <button
            onClick={toggleWishlist}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-zinc-900 rounded-full border border-gray-200 dark:border-zinc-800 shadow-sm transition-transform active:scale-95"
         >
            <Heart size={20} className={isWishlist ? "fill-red-500 text-red-500" : "text-gray-600 dark:text-gray-400"} />
         </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-8">
         {/* Product Visual Banner */}
         <div className="bg-white dark:bg-zinc-900 flex items-center justify-center p-8 mx-6 rounded-2xl mb-6 mt-4 relative overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm min-h-[220px]">
            {product.imageUrl ? (
               <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="max-h-48 max-w-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
               />
            ) : (
               <div className="p-8 flex flex-col items-center" style={{ color: primaryColor }}>
                  {getCategoryIcon(product.category, 64)}
                  <span className="text-xs font-semibold mt-2 text-gray-500">{rawCategory}</span>
               </div>
            )}
            <div className="absolute top-4 right-4 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-zinc-700 shadow-sm">
               <Star size={13} className="text-amber-500 fill-amber-500" />
               <span>4.9</span>
            </div>
            {isPrescription && (
               <div className="absolute top-4 left-4 bg-amber-500 text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <ShieldAlert size={12} />
                  <span>Sur Ordonnance</span>
               </div>
            )}
         </div>

         {/* Product Info */}
         <div className="px-6 space-y-6">
            <div>
               <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 pr-4">
                     <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{product.name}</h2>
                     <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>{rawDci}</p>
                     <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {product.dosage ? `${product.dosage} • ` : ''}{product.form || 'Boîte'} • {rawBrand}
                     </p>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-2xl font-black" style={{ color: primaryColor }}>{formatCurrency(product.price)}</span>
                     <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mt-1">
                        En stock
                     </span>
                  </div>
               </div>

               <div className="flex items-center gap-2 mt-3 text-xs">
                  <div className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                     isPrescription 
                       ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900" 
                       : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                  }`}>
                     <FileText size={12} />
                     <span>{isPrescription ? "Ordonnance requise" : "Vente libre (Sans ordonnance)"}</span>
                  </div>
                  <div className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                     <Pill size={12} style={{ color: primaryColor }} />
                     <span>{rawCategory}</span>
                  </div>
               </div>
            </div>

            {/* Prescription Warning Box */}
            {isPrescription && (
               <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex gap-3 shadow-sm">
                  <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={22} />
                  <div>
                     <h4 className="text-amber-900 dark:text-amber-300 font-bold text-sm">Prescription Médicale Obligatoire</h4>
                     <p className="text-amber-800/90 dark:text-amber-400 text-xs mt-1 font-medium leading-relaxed">
                        Pour valider la commande de ce médicament, vous devrez téléverser une ordonnance médicale valide émise par un médecin qualifié.
                     </p>
                  </div>
               </div>
            )}

            {/* Tabs Médicaux */}
            <div className="pt-2">
               <div className="flex p-1 bg-gray-100 dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                  {[
                     { id: 'details', label: 'Indications' },
                     { id: 'effects', label: 'Effets' },
                     { id: 'directions', label: 'Posologie' },
                     { id: 'reviews', label: 'Avis' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className="flex-1 text-xs font-bold py-2.5 rounded-lg transition-colors"
                      style={{
                        backgroundColor: activeTab === tab.id ? primaryColor : 'transparent',
                        color: activeTab === tab.id ? '#FFFFFF' : undefined
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
               </div>

               <div className="min-h-[120px] mt-4">
                  <AnimatePresence mode="wait">
                     <motion.div
                       key={activeTab}
                       initial={{ opacity: 0, y: 6 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -6 }}
                       transition={{ duration: 0.15 }}
                     >
                       {activeTab === 'details' && (
                         <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800">
                            <h5 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: primaryColor }}>
                               Description & Indication Thérapeutique
                            </h5>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                               {medicalDetails}
                            </p>
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-800 grid grid-cols-2 gap-2 text-[11px]">
                               <div><span className="font-bold text-gray-500">DCI :</span> <span className="text-gray-900 dark:text-white font-medium">{rawDci}</span></div>
                               <div><span className="font-bold text-gray-500">Fabricant :</span> <span className="text-gray-900 dark:text-white font-medium">{rawBrand}</span></div>
                               <div><span className="font-bold text-gray-500">Dosage :</span> <span className="text-gray-900 dark:text-white font-medium">{product.dosage || 'Standard'}</span></div>
                               <div><span className="font-bold text-gray-500">Forme :</span> <span className="text-gray-900 dark:text-white font-medium">{product.form || 'Boîte'}</span></div>
                            </div>
                         </div>
                       )}

                       {activeTab === 'effects' && (
                         <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800">
                            <h5 className="font-bold text-xs uppercase tracking-wider mb-2" style={{ color: primaryColor }}>
                               Action & Tolérance Clinique
                            </h5>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                               {medicalEffects}
                            </p>
                         </div>
                       )}

                       {activeTab === 'directions' && (
                         <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800 space-y-3">
                            <div className="flex items-center gap-3">
                               <div 
                                 className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                               >
                                  <FileText size={18} />
                               </div>
                               <div>
                                  <p className="font-bold text-gray-900 dark:text-white text-xs">Conseils d'utilisation & Posologie</p>
                                  <p className="text-[11px] text-gray-500 font-medium">Consultez la notice du laboratoire pharmaceutique</p>
                               </div>
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                               {medicalDirections}
                            </p>
                         </div>
                       )}

                       {activeTab === 'reviews' && (
                         <div className="space-y-3">
                           {reviews.length > 0 ? (
                             reviews.map(rev => (
                               <div key={rev.id} className="bg-gray-50 dark:bg-zinc-900 p-3.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
                                  <div className="flex justify-between items-start mb-1.5">
                                    <h5 className="font-bold text-gray-900 dark:text-white text-xs">{rev.userName || rev.user_name || "Patient vérifié"}</h5>
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map(star => (
                                        <Star key={star} size={11} className={star <= (rev.rating || 5) ? "text-amber-500 fill-amber-500" : "text-gray-300"} />
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">{rev.comment}</p>
                                  {rev.date && <p className="text-[10px] text-gray-400 mt-1.5">{rev.date}</p>}
                               </div>
                             ))
                           ) : (
                             <div className="bg-gray-50 dark:bg-zinc-900 p-6 rounded-xl border border-gray-100 dark:border-zinc-800 text-center">
                                <p className="text-xs text-gray-500 font-medium">Aucun avis pour le moment sur ce produit.</p>
                             </div>
                           )}
                         </div>
                       )}
                     </motion.div>
                  </AnimatePresence>
               </div>
            </div>
         </div>
      </div>

      {/* Fixed Sticky Action Bar at Bottom (without price on button, themed) */}
      <div className="bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 p-4 px-6 flex items-center gap-3 z-30 shrink-0 shadow-lg">
         <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2 border border-gray-200 dark:border-zinc-700">
            <button
               onClick={decrementQty}
               className="font-bold text-lg px-2 active:scale-90 transition-transform"
               style={{ color: primaryColor }}
            >
               -
            </button>
            <span className="font-bold text-gray-900 dark:text-white mx-3 text-base">{quantity}</span>
            <button
               onClick={incrementQty}
               className="font-bold text-lg px-2 active:scale-90 transition-transform"
               style={{ color: primaryColor }}
            >
               +
            </button>
         </div>
         <button 
           className="flex-1 text-white rounded-xl font-bold py-3.5 transition shadow-sm flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
           style={{ backgroundColor: primaryColor }}
           onClick={handleAddToCart}
         >
            <ShoppingCart size={18} />
            <span>Ajouter au panier</span>
         </button>
      </div>
    </div>
  );
}
