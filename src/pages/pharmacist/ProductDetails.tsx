import React, { useState, useEffect } from "react";
import { ArrowLeft, MoreVertical, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useTranslation } from "react-i18next";
import { getCategoryIcon } from "../../lib/icons";

export function PharmacistProductDetails() {
   const { t } = useTranslation();
   const navigate = useNavigate();
   const { id } = useParams();
   const { user } = useAuth();
   const [product, setProduct] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [showStockModal, setShowStockModal] = useState(false);
   const [editStockValue, setEditStockValue] = useState("");
   const [editExpiryDate, setEditExpiryDate] = useState("");
   const [savingStock, setSavingStock] = useState(false);

   useEffect(() => {
      if (!user || !id) return;
      const fetchProduct = async () => {
         try {
            const docSnap = await getDoc(doc(db, 'products', id));
            if (docSnap.exists()) {
               setProduct({ id: docSnap.id, ...docSnap.data() });
            }
         } catch (error) {
            console.error(error);
         } finally {
            setLoading(false);
         }
      };
      fetchProduct();
   }, [user, id]);

   if (loading) {
      return (
         <div className="flex-1 bg-[#f4f5f9] dark:bg-black p-8 text-center text-sm text-gray-500 animate-pulse">
            Loading...
         </div>
      );
   }

   if (!product) {
      return (
         <div className="flex-1 bg-[#f4f5f9] dark:bg-black p-8 text-center text-sm text-gray-500">
            Product not found.
         </div>
      );
   }

   const handleUpdateStock = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const newStock = parseInt(editStockValue, 10);
      if (isNaN(newStock) || newStock < 0) return;
      if (!editExpiryDate) return; // Expiry date is mandatory

      setSavingStock(true);
      try {
         await updateDoc(doc(db, 'products', product.id), { 
            stock: newStock,
            expiryDate: editExpiryDate 
         });
         setProduct({ ...product, stock: newStock, expiryDate: editExpiryDate });
         setShowStockModal(false);
      } catch (error) {
         console.error('Failed to update stock', error);
      } finally {
         setSavingStock(false);
      }
   };

   const handleMarkOutOfStock = async () => {
      try {
         await updateDoc(doc(db, 'products', product.id), { stock: 0 });
         setProduct({ ...product, stock: 0 });
      } catch (error) {
         console.error('Failed to update stock', error);
      }
   };

   return (
      <div className="flex-1 bg-white dark:bg-black flex flex-col h-full overflow-y-auto">
         {/* Header */}
         <div className="px-5 pt-12 pb-4 flex items-center gap-4 bg-white dark:bg-black sticky top-0 z-10">
            <button onClick={() => navigate(-1)} className="flex items-center justify-center transition-colors">
               <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
            </button>
            <h1 className="font-bold text-gray-800 dark:text-white text-[18px]">Medication Details</h1>
         </div>

         <div className="px-5 pb-32">
            {/* Title & More */}
            <div className="flex justify-between items-start mt-2 mb-4">
               <div>
                  <h2 className="text-[20px] font-bold text-gray-900 dark:text-white leading-tight">
                     {product.name} {product.dosage ? product.dosage : ''}
                  </h2>
                  <p className="text-[14px] text-gray-500 font-medium mt-0.5">
                     {product.category || 'Tablet'} {product.dosage ? `- ${product.dosage}` : ''}
                  </p>
               </div>
               <button className="p-1">
                  <MoreVertical size={20} className="text-gray-800 dark:text-gray-300" />
               </button>
            </div>

            {/* Image */}
            <div className="w-full aspect-[16/9] mb-5 flex items-center justify-center bg-transparent">
               {product.imageUrl || product.ImageURL || product.image || product.Image ? (
                  <img
                     src={product.imageUrl || product.ImageURL || product.image || product.Image}
                     alt={product.name}
                     className="w-full h-full object-contain drop-shadow-md"
                  />
               ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center border border-gray-200 dark:border-zinc-700 text-gray-300">
                     {getCategoryIcon(product.category, 64)}
                  </div>
               )}
            </div>

            {/* Status tags */}
            <div className="bg-[#eef8f2] dark:bg-green-900/20 text-[#308d56] dark:text-green-400 flex items-center gap-2.5 px-4 py-3 rounded-2xl mb-3 font-bold text-[14px]">
               <CheckCircle size={18} className="fill-[#308d56]/20 text-[#308d56] dark:text-green-400" />
               Available ({product.stock || 0} in stock)
            </div>

            {product.expiryDate && (
               <div className="bg-[#fff9f1] dark:bg-orange-900/20 text-[#a37943] dark:text-orange-400 flex items-stretch gap-3 px-4 py-3 rounded-2xl mb-5 font-bold text-[14px]">
                  <AlertCircle size={20} className="text-[#d85542] dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col mb-1">
                     <span className="text-[#d85542] dark:text-red-400 text-[15px] mb-0.5">Expiry Date</span>
                     <span className="text-[#a37943] text-[13px] font-medium leading-snug">{product.expiryDate}</span>
                  </div>
               </div>
            )}

            {/* Actions */}
            <div className="space-y-3 mb-8">
               <button onClick={() => {
                  setEditStockValue(product.stock?.toString() || "0");
                  setEditExpiryDate(product.expiryDate || "");
                  setShowStockModal(true);
               }} className="w-full bg-[#3b4c9b] hover:bg-[#324082] transition-colors text-white py-3.5 rounded-2xl font-bold text-[15px] shadow-sm cursor-pointer">
                  Update Stock
               </button>
               <button onClick={handleMarkOutOfStock} className="w-full bg-transparent hover:bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 py-3.5 rounded-2xl font-bold text-[15px] cursor-pointer transition-colors">
                  Mark as out of stock
               </button>
            </div>

            {/* Drug Info Block */}
            <div className="bg-[#f8f9fc] dark:bg-zinc-900/50 rounded-3xl p-5 mb-5 space-y-4">
               <h3 className="font-bold text-[#3b4c9b] dark:text-indigo-400 text-[16px] pb-3 border-b border-gray-200 dark:border-zinc-800">
                  Drug Information
               </h3>
               
               <div className="flex justify-between items-center text-[14px]">
                  <span className="text-gray-500 font-medium">Generic Name:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-bold">{product.name}</span>
               </div>
               <div className="flex justify-between items-center text-[14px]">
                  <span className="text-gray-500 font-medium">Brand Name:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-bold">{product.brand || '---'}</span>
               </div>
               <div className="flex justify-between items-center text-[14px]">
                  <span className="text-gray-500 font-medium">Category:</span>
                  <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                     {getCategoryIcon(product.category, 14, "text-indigo-500")}
                     <span className="text-gray-800 dark:text-gray-200 font-bold text-xs">{product.category || '---'}</span>
                  </div>
               </div>
               <div className="flex justify-between items-center text-[14px]">
                  <span className="text-gray-500 font-medium">Manufacturer:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-bold">{product.manufacturer || '---'}</span>
               </div>
               <div className="flex justify-between items-center text-[14px]">
                  <span className="text-gray-500 font-medium">Prescription:</span>
                  <span className="text-gray-800 dark:text-gray-200 font-bold">
                     {(product.RequiresPrescription || product.requiresPrescription || product.Prescription) ? 'Yes' : 'No'}
                  </span>
               </div>
               <div className="h-0.5"></div>
            </div>

            {/* Usage & Instructions Block */}
            <div className="bg-[#f8f9fc] dark:bg-zinc-900/50 rounded-3xl p-5 mb-5">
               <h3 className="font-bold text-[#3b4c9b] dark:text-indigo-400 text-[16px] pb-3 border-b border-gray-200 dark:border-zinc-800 mb-4">
                  Usage & Instructions
               </h3>

               <div className="space-y-4">
                  <div>
                     <h4 className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-1.5">Instructions</h4>
                     {product.instructions || product.description ? (
                        <p className="text-[13px] text-gray-500 font-medium whitespace-pre-line leading-relaxed pb-1">{product.instructions || product.description}</p>
                     ) : (
                        <p className="text-[13px] text-gray-500 font-medium pb-1">Please refer to the physical packaging for dosage and storage instructions.</p>
                     )}
                  </div>
                  <div>
                     <h4 className="text-[14px] font-bold text-gray-800 dark:text-gray-200 mb-1.5">Batch Details</h4>
                     {product.batchNumber || product.expiryDate ? (
                        <ul className="text-[13px] text-gray-500 font-medium space-y-1 list-disc list-inside pb-2">
                           {product.batchNumber && <li>Batch: {product.batchNumber}</li>}
                           {product.expiryDate && <li>Expiry Date: {product.expiryDate}</li>}
                        </ul>
                     ) : (
                        <p className="text-[13px] text-gray-500 font-medium pb-1">No batch details recorded.</p>
                     )}
                  </div>
               </div>
            </div>
         </div>

         {/* Stock & Expiry Update Modal */}
         {showStockModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-5">
               <div className="bg-white dark:bg-zinc-900 rounded-[32px] p-6 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Update Stock</h3>
                  <form onSubmit={handleUpdateStock} className="space-y-5">
                     <div>
                        <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 block mb-2">New Stock Level<span className="text-red-500 ml-1">*</span></label>
                        <input
                           type="number"
                           required
                           min="0"
                           value={editStockValue}
                           onChange={(e) => setEditStockValue(e.target.value)}
                           className="w-full bg-[#f4f5f9] dark:bg-black border-none py-3.5 px-4 rounded-2xl text-[15px] font-medium focus:ring-2 focus:ring-[#3b4c9b] outline-none text-gray-900 dark:text-white"
                           placeholder="Enter quantity"
                        />
                     </div>
                     <div>
                        <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 block mb-2">Expiry Date<span className="text-red-500 ml-1">*</span></label>
                        <input
                           type="date"
                           required
                           value={editExpiryDate}
                           onChange={(e) => setEditExpiryDate(e.target.value)}
                           className="w-full bg-[#f4f5f9] dark:bg-black border-none py-3.5 px-4 rounded-2xl text-[15px] font-medium focus:ring-2 focus:ring-[#3b4c9b] outline-none text-gray-900 dark:text-white"
                        />
                     </div>
                     <div className="flex gap-3 pt-2">
                        <button
                           type="button"
                           onClick={() => setShowStockModal(false)}
                           disabled={savingStock}
                           className="flex-1 py-3.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold text-[14px] transition-colors disabled:opacity-50"
                        >
                           Cancel
                        </button>
                        <button
                           type="submit"
                           disabled={savingStock || !editStockValue || !editExpiryDate}
                           className="flex-1 py-3.5 bg-[#3b4c9b] hover:bg-[#324082] text-white rounded-2xl font-bold text-[14px] transition-colors disabled:opacity-50"
                        >
                           {savingStock ? 'Saving...' : 'Save Changes'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
}
