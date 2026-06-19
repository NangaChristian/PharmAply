import React, { useState, useEffect } from "react";
import { ArrowLeft, MoreVertical, CheckCircle, AlertCircle, Edit2 } from "lucide-react";
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
         <div className="flex-1 bg-transparent dark:bg-black p-8 text-center text-sm text-gray-400 animate-pulse">
            Loading...
         </div>
      );
   }

   if (!product) {
      return (
         <div className="flex-1 bg-transparent dark:bg-black p-8 text-center text-sm text-gray-500 font-medium pb-20">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm inline-block mx-auto">
               Product not found.
            </div>
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
      <div className="flex-1 bg-transparent dark:bg-black flex flex-col h-full overflow-hidden relative">
         {/* Header */}
         <div className="px-8 pt-8 pb-4 flex items-center gap-4 shrink-0 z-10">
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700">
               <ArrowLeft size={20} className="text-gray-700 dark:text-gray-200" />
            </button>
            <h1 className="font-bold text-gray-900 dark:text-white text-2xl tracking-tight">Medication Details</h1>
         </div>

         <div className="flex-1 overflow-y-auto px-8 pb-32 custom-scrollbar">
            {/* Title & More */}
            <div className="flex justify-between items-start mt-2 mb-6">
               <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full border border-gray-100 dark:border-slate-700 shadow-sm flex items-start justify-between">
                  <div>
                     <h2 className="text-2xl font-bold text-[#0B3B3C] dark:text-white leading-tight">
                        {product.name} {product.dosage ? product.dosage : ''}
                     </h2>
                     <p className="text-sm text-gray-500 font-medium mt-1">
                        {product.category || 'Tablet'} {product.dosage ? `- ${product.dosage}` : ''}
                     </p>
                  </div>
                  <button className="p-2 bg-[#FAFBFC] rounded-full border border-gray-100 text-gray-500 hover:text-[#0B3B3C] hover:bg-[#E2EBE9] transition-colors">
                     <Edit2 size={16} />
                  </button>
               </div>
            </div>

            {/* Image */}
            <div className="w-full aspect-[16/9] mb-6 flex items-center justify-center bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm p-4 overflow-hidden relative group">
               {product.imageUrl || product.ImageURL || product.image || product.Image ? (
                  <img
                     src={product.imageUrl || product.ImageURL || product.image || product.Image}
                     alt={product.name}
                     className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
                  />
               ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-slate-600">
                     {getCategoryIcon(product.category, 80)}
                     <span className="text-sm mt-4 font-bold uppercase tracking-widest text-gray-200 dark:text-slate-700">No Image</span>
                  </div>
               )}
            </div>

            {/* Status tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <div className="bg-[#D3F5A8]/50 dark:bg-[#D3F5A8]/10 border border-[#D3F5A8] text-[#0B3B3C] dark:text-[#D3F5A8] flex flex-col gap-1 px-5 py-4 rounded-3xl font-bold shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={18} className="text-[#0B3B3C] dark:text-[#D3F5A8]" />
                      <span className="text-sm">Stock Status</span>
                    </div>
                    <span className="text-xl">{product.stock || 0} unit(s) available</span>
                 </div>
                 
                 {product.expiryDate && (
                    <div className="bg-[#FFF8E6] dark:bg-orange-900/20 border border-[#FFE5B4] dark:border-orange-900/30 text-[#a37943] dark:text-orange-400 flex flex-col gap-1 px-5 py-4 rounded-3xl font-bold shadow-sm">
                       <div className="flex items-center gap-2 mb-1">
                          <AlertCircle size={18} className="text-[#d85542] dark:text-red-400" />
                          <span className="text-sm text-[#d85542] dark:text-red-400">Expiry Date</span>
                       </div>
                       <span className="text-xl text-orange-900 dark:text-orange-300">{product.expiryDate}</span>
                    </div>
                 )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 mb-8">
               <button onClick={() => {
                  setEditStockValue(product.stock?.toString() || "0");
                  setEditExpiryDate(product.expiryDate || "");
                  setShowStockModal(true);
               }} className="flex-1 bg-[#0B3B3C] hover:bg-[#082a2b] transition-colors text-white py-4 rounded-full font-bold text-sm shadow-sm cursor-pointer whitespace-nowrap focus:outline-none">
                  Update Stock
               </button>
               <button onClick={handleMarkOutOfStock} className="flex-1 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-100 hover:text-red-600 text-gray-700 py-4 rounded-full font-bold text-sm cursor-pointer transition-colors shadow-sm whitespace-nowrap focus:outline-none">
                  Mark Out of Stock
               </button>
            </div>

            {/* Drug Info Block */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm mb-6 space-y-4">
               <h3 className="font-bold text-[#0B3B3C] dark:text-white text-base pb-3 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
                  Drug Information
               </h3>
               
               <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-gray-500 font-medium">Generic Name</span>
                  <span className="text-gray-900 dark:text-gray-200 font-bold">{product.name}</span>
               </div>
               <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-gray-500 font-medium">Brand Name</span>
                  <span className="text-gray-900 dark:text-gray-200 font-bold">{product.brand || '---'}</span>
               </div>
               <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-gray-500 font-medium">Category</span>
                  <div className="flex items-center gap-1.5 bg-[#FAFBFC] dark:bg-slate-900 px-2 py-1 rounded-lg border border-gray-100 dark:border-slate-700">
                     {getCategoryIcon(product.category, 14, "text-[#0B3B3C]")}
                     <span className="text-gray-900 dark:text-gray-200 font-bold text-xs">{product.category || '---'}</span>
                  </div>
               </div>
               <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-gray-500 font-medium">Manufacturer</span>
                  <span className="text-gray-900 dark:text-gray-200 font-bold">{product.manufacturer || '---'}</span>
               </div>
               <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-gray-500 font-medium">Prescription</span>
                  <span className="text-gray-900 dark:text-gray-200 font-bold">
                     {(product.RequiresPrescription || product.requiresPrescription || product.Prescription) ? 'Yes' : 'No'}
                  </span>
               </div>
            </div>

            {/* Usage & Instructions Block */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm mb-6">
               <h3 className="font-bold text-[#0B3B3C] dark:text-white text-base pb-3 border-b border-gray-50 dark:border-slate-700 mb-4">
                  Usage & Instructions
               </h3>

               <div className="space-y-6">
                  <div>
                     <h4 className="text-sm font-bold text-gray-900 dark:text-gray-200 mb-2">Instructions</h4>
                     {product.instructions || product.description ? (
                        <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed bg-[#FAFBFC] dark:bg-slate-900 p-4 rounded-2xl border border-gray-100">{product.instructions || product.description}</p>
                     ) : (
                        <p className="text-sm text-gray-500 font-medium bg-[#FAFBFC] dark:bg-slate-900 p-4 rounded-2xl border border-gray-50">Please refer to the physical packaging for dosage and storage instructions.</p>
                     )}
                  </div>
                  <div>
                     <h4 className="text-sm font-bold text-gray-900 dark:text-gray-200 mb-2">Batch Details</h4>
                     {product.batchNumber || product.expiryDate ? (
                        <div className="bg-[#FAFBFC] dark:bg-slate-900 p-4 rounded-2xl border border-gray-100">
                           <ul className="text-sm text-gray-500 font-medium space-y-2 list-disc list-inside">
                              {product.batchNumber && <li>Batch: {product.batchNumber}</li>}
                              {product.expiryDate && <li>Expiry Date: {product.expiryDate}</li>}
                           </ul>
                        </div>
                     ) : (
                        <p className="text-sm text-gray-500 font-medium bg-[#FAFBFC] dark:bg-slate-900 p-4 rounded-2xl border border-gray-50">No batch details recorded.</p>
                     )}
                  </div>
               </div>
            </div>
         </div>

         {/* Stock & Expiry Update Modal */}
         {showStockModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-5">
               <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Update Stock</h3>
                  <form onSubmit={handleUpdateStock} className="space-y-5">
                     <div>
                        <label className="text-sm font-bold text-[#0B3B3C] dark:text-gray-300 block mb-2">New Stock Level<span className="text-red-500 ml-1">*</span></label>
                        <input
                           type="number"
                           required
                           min="0"
                           value={editStockValue}
                           onChange={(e) => setEditStockValue(e.target.value)}
                           className="w-full bg-[#FAFBFC] dark:bg-slate-900 border border-gray-200 py-3.5 px-4 rounded-xl text-sm font-medium focus:border-gray-400 outline-none text-gray-900 dark:text-white transition-colors"
                           placeholder="Enter quantity"
                        />
                     </div>
                     <div>
                        <label className="text-sm font-bold text-[#0B3B3C] dark:text-gray-300 block mb-2">Expiry Date<span className="text-red-500 ml-1">*</span></label>
                        <input
                           type="date"
                           required
                           value={editExpiryDate}
                           onChange={(e) => setEditExpiryDate(e.target.value)}
                           className="w-full bg-[#FAFBFC] dark:bg-slate-900 border border-gray-200 py-3.5 px-4 rounded-xl text-sm font-medium focus:border-gray-400 outline-none text-gray-900 dark:text-white transition-colors"
                        />
                     </div>
                     <div className="flex gap-4 pt-4">
                        <button
                           type="button"
                           onClick={() => setShowStockModal(false)}
                           disabled={savingStock}
                           className="flex-1 py-4 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full font-bold text-sm transition-colors disabled:opacity-50 focus:outline-none"
                        >
                           Cancel
                        </button>
                        <button
                           type="submit"
                           disabled={savingStock || !editStockValue || !editExpiryDate}
                           className="flex-1 py-4 bg-[#0B3B3C] hover:bg-[#082a2b] text-white rounded-full font-bold text-sm transition-colors disabled:opacity-50 focus:outline-none shadow-sm"
                        >
                           {savingStock ? 'Saving...' : 'Save'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
}
