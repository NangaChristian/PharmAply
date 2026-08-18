import { 
  FileText, Plus, ArrowLeft, Image as ImageIcon, MoreVertical, 
  Trash2, ShoppingCart, Eye, Calendar, Sparkles, Pill, Clock,
  Search, CheckCircle2, ShieldCheck, Filter, Download
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, deleteDoc } from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { useCart } from "../../components/CartProvider";
import { useTranslation } from "react-i18next";
import { parseDate, sortByDateDesc, formatCurrency } from "../../lib/utils";
import toast from "react-hot-toast";

export function PatientPrescriptions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { t } = useTranslation();

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "today">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'prescriptions'), where('patientId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPrescriptions(sortByDateDesc(raw));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette ordonnance ?")) {
      try {
        await deleteDoc(doc(db, 'prescriptions', id));
        toast.success("Ordonnance supprimée de l'historique.");
      } catch (e) {
        console.error('Error deleting prescription:', e);
        toast.error("Erreur lors de la suppression.");
      }
    }
    setActiveMenuId(null);
  };

  const handleOrderMedications = (p: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const items = p.items || [];
    if (items.length === 0) {
      toast("Aucun médicament structuré dans cette ordonnance.", { icon: "ℹ️" });
      return;
    }

    items.forEach((m: any) => {
      addToCart({
        id: m.product_id || `rx_${p.id}_${m.nom_medicament}`,
        name: m.product_name || m.nom_medicament,
        price: m.price || 1500,
        pharmacyId: "pharm_default",
        pharmacyName: m.pharmacy_name || "Pharmacie Partenaire",
        dosage: m.dosage,
        requiresPrescription: true,
        quantity: m.quantite || 1,
        prescriptionImage: p.fileUrl || undefined
      });
    });

    toast.success(`${items.length} médicament(s) ajouté(s) au panier !`);
    navigate("/patient/cart");
  };

  // Filtrage selon l'onglet et la recherche
  const filteredPrescriptions = prescriptions.filter((p) => {
    const nameMatch = (p.fileName || "Ordonnance")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    
    const medMatch = (p.items || []).some((m: any) =>
      (m.nom_medicament || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!nameMatch && !medMatch) return false;

    if (activeTab === "today") {
      const date = parseDate(p.createdAt);
      if (!date) return true;
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    }
    return true;
  });

  return (
    <div className="flex-1 bg-slate-50 dark:bg-zinc-950 flex flex-col h-full relative font-sans overflow-hidden">
      
      {/* ========================================================================= */}
      {/* HEADER */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-zinc-900 px-6 pt-12 pb-4 shadow-sm z-20 flex flex-col gap-4 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200 transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Historique des Scans
              </h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Prescriptions & Ordonnances médicales
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/patient/smart-scanner")}
            className="px-4 py-2 bg-[#194B4B] hover:bg-teal-700 text-white rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 transition active:scale-95"
          >
            <Sparkles size={14} className="text-yellow-400" />
            Nouveau Scan
          </button>
        </div>

        {/* Barre de Recherche */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par médicament ou nom d'ordonnance..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-zinc-800 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none border border-transparent focus:border-[#194B4B] transition"
          />
        </div>

        {/* Onglets Filtres (Aujourd'hui / Tous) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === "all"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            Tous les scans ({prescriptions.length})
          </button>
          <button
            onClick={() => setActiveTab("today")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              activeTab === "today"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200"
            }`}
          >
            Aujourd'hui
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* LISTE DES ORDONNANCES */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 space-y-4">
        {filteredPrescriptions.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 p-8 shadow-sm">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
            <h3 className="font-bold text-base text-gray-800 dark:text-white">
              Aucune ordonnance trouvée
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Scannez une ordonnance avec la caméra pour que l'IA extrait instantanément vos médicaments.
            </p>
            <button
              onClick={() => navigate("/patient/smart-scanner")}
              className="mt-5 px-6 py-3 bg-[#194B4B] text-white rounded-2xl text-xs font-bold shadow-md hover:bg-teal-700 transition"
            >
              Lancer le Scanner IA
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPrescriptions.map((p) => {
              const isImage = p.fileUrl && !p.fileUrl.endsWith('.pdf');
              const dateObj = parseDate(p.createdAt);
              const meds = p.items || [];

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPrescription(p)}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Vignette Preview */}
                      <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-zinc-800 overflow-hidden shrink-0 border border-gray-200 dark:border-zinc-700 flex items-center justify-center relative">
                        {p.fileUrl ? (
                          <img
                            src={p.fileUrl}
                            alt="Ordonnance"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileText size={24} className="text-[#194B4B] dark:text-teal-400" />
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                          {p.fileName || "Ordonnance Médicale"}
                        </h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {dateObj ? dateObj.toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          }) : "Récemment"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                          : 'bg-teal-50 text-[#194B4B] dark:bg-teal-950 dark:text-teal-300'
                      }`}>
                        {p.status === 'approved' ? 'Validée DPML' : 'Analysée IA'}
                      </span>

                      {/* Menu More */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === p.id ? null : p.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {activeMenuId === p.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden z-30">
                            {p.fileUrl && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(p.fileUrl, "_blank");
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 flex items-center gap-2 font-medium"
                              >
                                <Eye size={14} /> Voir l'original
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(p.id, e)}
                              className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium border-t border-gray-100 dark:border-zinc-700"
                            >
                              <Trash2 size={14} /> Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Médicaments extraits par l'IA */}
                  {meds.length > 0 && (
                    <div className="bg-gray-50 dark:bg-zinc-800/60 rounded-2xl p-3 border border-gray-100 dark:border-zinc-800">
                      <p className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-2">
                        {meds.length} Médicament(s) identifié(s) :
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {meds.map((m: any, idx: number) => (
                          <span
                            key={idx}
                            className="bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 text-xs px-2.5 py-1 rounded-xl border border-gray-200 dark:border-zinc-700 flex items-center gap-1 shadow-2xs font-medium"
                          >
                            <Pill size={11} className="text-[#194B4B] dark:text-teal-400" />
                            {m.nom_medicament} {m.dosage ? `(${m.dosage})` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Rapides */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-zinc-800/80">
                    {p.fileUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(p.fileUrl, "_blank");
                        }}
                        className="text-xs text-[#194B4B] dark:text-teal-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <Eye size={13} />
                        Afficher ordonnance
                      </button>
                    )}

                    {meds.length > 0 && (
                      <button
                        onClick={(e) => handleOrderMedications(p, e)}
                        className="ml-auto px-4 py-2 bg-[#194B4B] hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                      >
                        <ShoppingCart size={13} />
                        Commander les médicaments
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bouton Flottant Nouveau Scan */}
      <button
        onClick={() => navigate("/patient/smart-scanner")}
        className="fixed bottom-20 right-6 w-14 h-14 bg-[#194B4B] hover:bg-teal-700 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition active:scale-90 z-30 border-2 border-white dark:border-zinc-900"
      >
        <Sparkles size={24} className="text-yellow-400" />
      </button>

    </div>
  );
}
