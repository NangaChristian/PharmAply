import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, Camera, Upload, CheckCircle2, Loader2, Sparkles, AlertCircle, 
  MapPin, ShoppingCart, Trash2, Plus, Minus, Search, RefreshCw, ShieldAlert,
  Building2, Pill, Check, ArrowRight, Eye, AlertTriangle, FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../../components/CartProvider";
import { useAuth } from "../../components/AuthProvider";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

interface DetectedMedication {
  nom_medicament: string;
  dosage: string;
  forme: string;
  quantite: number;
  posologie?: string;
  dci?: string;
  ordonnance_requise?: boolean;
  remarques?: string;
}

interface MatchedProduct {
  id: string;
  nom_commercial: string;
  dci: string;
  dosage: string;
  form: string;
  price: number;
  stock: number;
  image_url?: string | null;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone?: string;
  distance_km: number;
  latitude: number;
  longitude: number;
  is_prescription_required?: boolean;
}

interface ScanItem {
  id: string;
  detected: DetectedMedication;
  matched: boolean;
  in_stock: boolean;
  product: MatchedProduct | null;
  selectedQuantity: number;
  selected: boolean;
  available_alternatives?: MatchedProduct[];
  similarity_score?: number;
}

interface PharmacySummary {
  id: string;
  name: string;
  address: string;
  distance_km: number;
}

export function SmartScanner() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { user } = useAuth();

  // Navigation & Workflow state
  const [step, setStep] = useState<"capture" | "analyzing" | "review" | "confirmed">("capture");
  const [analysisPhase, setAnalysisPhase] = useState<number>(1);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 4.0511, lng: 9.7679 });

  // File & Camera state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extracted Results State
  const [items, setItems] = useState<ScanItem[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacySummary[]>([]);
  const [totalDetected, setTotalDetected] = useState<number>(0);

  // Manual search state for unmatched items
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [activeItemIndexForSearch, setActiveItemIndexForSearch] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState<boolean>(false);

  // 1. Initialiser la géolocalisation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Géolocalisation refusée, coordonnées par défaut utilisées :", err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // 2. Gestion de la Caméra Native
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Impossible d'accéder à la caméra :", err);
      setIsCameraActive(false);
      // Fallback sur le sélecteur de fichier
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setSelectedImage(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setImageMimeType("image/jpeg");
      stopCamera();
    }
  };

  // 3. Gestion du fichier uploadé
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Veuillez sélectionner une image (JPG, PNG) ou un document PDF clair.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImage(result);
      const parts = result.split(",");
      setImageBase64(parts[1]);
      setImageMimeType(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
  };

  // 4. Lancement de l'analyse intelligente avec Gemini 1.5 Pro
  const processPrescription = async () => {
    if (!imageBase64) {
      toast.error("Veuillez d'abord prendre une photo ou choisir une ordonnance.");
      return;
    }

    setStep("analyzing");
    setAnalysisPhase(1);

    // Animation progressive des phases pour une UX premium
    const phaseTimer1 = setTimeout(() => setAnalysisPhase(2), 1200);
    const phaseTimer2 = setTimeout(() => setAnalysisPhase(3), 2600);

    try {
      const response = await fetch("/api/ai/scan-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageMimeType,
          latitude: userLocation.lat,
          longitude: userLocation.lng
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible d'analyser l'ordonnance.");
      }

      const formattedItems: ScanItem[] = (data.extracted_items || []).map((item: any, idx: number) => ({
        id: `scan_item_${idx}_${Date.now()}`,
        detected: item.detected,
        matched: !!item.matched,
        in_stock: !!item.in_stock,
        product: item.product,
        selectedQuantity: item.detected.quantite || 1,
        selected: true,
        available_alternatives: item.available_alternatives || [],
        similarity_score: item.similarity_score
      }));

      setItems(formattedItems);
      setPharmacies(data.pharmacies_involved || []);
      setTotalDetected(data.summary?.total_detected || formattedItems.length);

      // Enregistrer l'ordonnance dans Supabase si connecté
      if (user) {
        try {
          await supabase.from("prescriptions").insert([
            {
              patient_id: user.uid,
              scanned_data: JSON.stringify(data.extracted_items),
              status: "reviewed_by_patient",
              created_at: new Date().toISOString()
            }
          ]);
        } catch (e) {
          console.warn("Sauvegarde de l'historique d'ordonnance ignorée :", e);
        }
      }

      setStep("review");
      toast.success(`${formattedItems.length} médicament(s) identifié(s) avec succès !`);
    } catch (error: any) {
      console.error("Erreur de scan :", error);
      toast.error(error.message || "Erreur lors de l'analyse de l'ordonnance.");
      setStep("capture");
    } finally {
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
    }
  };

  // 5. Modifications dans l'écran de revue (Review Screen)
  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const newQty = Math.max(1, it.selectedQuantity + delta);
          return { ...it, selectedQuantity: newQty };
        }
        return it;
      })
    );
  };

  const toggleItemSelection = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    toast.success("Médicament retiré de la sélection.");
  };

  const selectAlternativeProduct = (itemId: string, altProd: MatchedProduct) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            product: altProd,
            matched: true,
            in_stock: altProd.stock > 0
          };
        }
        return it;
      })
    );
    toast.success(`Officine mise à jour : ${altProd.pharmacy_name}`);
  };

  // 6. Recherche manuelle pour les médicaments non trouvés
  const openManualSearch = (itemIndex: number) => {
    setActiveItemIndexForSearch(itemIndex);
    const it = items[itemIndex];
    setSearchQuery(it.detected.nom_medicament || "");
    setSearchModalOpen(true);
    triggerCatalogSearch(it.detected.nom_medicament || "");
  };

  const triggerCatalogSearch = async (term: string) => {
    if (!term.trim()) return;
    setIsSearchingCatalog(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .or(`nom_commercial.ilike.%${term}%,dci.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(10);

      if (data && !error) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.warn("Erreur recherche manuelle:", e);
      setSearchResults([]);
    } finally {
      setIsSearchingCatalog(false);
    }
  };

  const linkProductToItem = (product: any) => {
    if (activeItemIndexForSearch === null) return;
    const targetItem = items[activeItemIndexForSearch];

    const matchedProd: MatchedProduct = {
      id: product.id,
      nom_commercial: product.nom_commercial || product.commercial_name || product.name,
      dci: product.dci || targetItem.detected.dci || "",
      dosage: product.dosage || targetItem.detected.dosage,
      form: product.form || product.forme || targetItem.detected.forme,
      price: Number(product.price || 1500),
      stock: Number(product.stock || 5),
      image_url: product.image_url,
      pharmacy_id: product.pharmacy_id || product.pharmacyId || "ph_manual",
      pharmacy_name: "Pharmacie Associée",
      pharmacy_address: "Douala",
      distance_km: 1.8,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      is_prescription_required: product.is_prescription_required ?? true
    };

    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx === activeItemIndexForSearch) {
          return {
            ...it,
            matched: true,
            in_stock: matchedProd.stock > 0,
            product: matchedProd
          };
        }
        return it;
      })
    );

    setSearchModalOpen(false);
    setActiveItemIndexForSearch(null);
    toast.success("Médicament associé avec succès !");
  };

  // 7. Validation finale et Ajout au Panier Multi-Officines
  const confirmAndAddToCart = () => {
    const selectedItems = items.filter((it) => it.selected && it.matched && it.product);

    if (selectedItems.length === 0) {
      toast.error("Veuillez sélectionner au moins un médicament disponible pour continuer.");
      return;
    }

    let addedCount = 0;
    selectedItems.forEach((it) => {
      if (it.product) {
        addToCart(
          {
            id: it.product.id,
            name: `${it.product.nom_commercial} (${it.product.dosage})`,
            price: it.product.price,
            imageUrl: it.product.image_url,
            pharmacyId: it.product.pharmacy_id,
            pharmacyName: it.product.pharmacy_name,
            stock: it.product.stock,
            is_prescription_required: it.product.is_prescription_required
          },
          it.selectedQuantity
        );
        addedCount++;
      }
    });

    toast.success(`${addedCount} médicament(s) ajouté(s) à votre panier optimisé !`, {
      duration: 4000,
      icon: "🛒"
    });

    navigate("/patient/cart");
  };

  // Calculs financiers pour le résumé de commande
  const selectedItemsList = items.filter((it) => it.selected && it.matched && it.product);
  const estimatedMedicinesTotal = selectedItemsList.reduce(
    (acc, it) => acc + (it.product?.price || 0) * it.selectedQuantity,
    0
  );
  const distinctPharmaciesCount = new Set(
    selectedItemsList.map((it) => it.product?.pharmacy_id).filter(Boolean)
  ).size;
  const estimatedDeliveryTotal = distinctPharmaciesCount > 0 ? distinctPharmaciesCount * 1500 : 0;
  const grandTotal = estimatedMedicinesTotal + estimatedDeliveryTotal;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-zinc-950 flex flex-col h-full overflow-hidden">
      {/* En-tête Sticky */}
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step === "review") setStep("capture");
              else navigate(-1);
            }}
            className="p-2 -ml-2 text-[#194B4B] dark:text-emerald-400 border border-gray-100 dark:border-zinc-800 rounded-full bg-white dark:bg-zinc-900 shadow-sm hover:bg-gray-50 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
              <Sparkles size={18} className="text-[#194B4B] dark:text-emerald-400" />
              Smart Scan Ordonnance
            </h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Extraction IA & Géolocalisation Officines
            </p>
          </div>
        </div>

        {step === "review" && (
          <button
            onClick={() => setStep("capture")}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#194B4B] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800"
          >
            <RefreshCw size={12} />
            Nouveau scan
          </button>
        )}
      </header>

      {/* Corps dynamique de l'application */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28">
        {/* ========================================================================= */}
        {/* STEP 1 : CAPTURE & UPLOAD */}
        {/* ========================================================================= */}
        {step === "capture" && (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Guide & Avantages */}
            <div className="bg-[#194B4B] text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-yellow-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={14} />
                  Intelligence Artificielle Vision
                </div>
                <h2 className="text-xl font-bold mb-2">Scannez votre ordonnance</h2>
                <p className="text-xs text-emerald-100 leading-relaxed mb-4">
                  Notre modèle IA analyse les écritures manuscrites, extrait les dosages et sélectionne automatiquement la pharmacie la plus proche avec le meilleur stock.
                </p>

                <div className="flex items-center gap-4 text-xs text-emerald-200 pt-2 border-t border-emerald-800">
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-yellow-300" /> Reconnaissance DCI
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-yellow-300" /> Stock temps réel
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-yellow-300" /> Split panier
                  </div>
                </div>
              </div>
            </div>

            {/* Zone Caméra Live */}
            {isCameraActive ? (
              <div className="bg-black rounded-3xl overflow-hidden shadow-lg border border-gray-800 relative">
                <video ref={videoRef} playsInline autoPlay className="w-full h-80 object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viseur visuel */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                  <div className="w-full h-full border-2 border-dashed border-yellow-300/80 rounded-2xl"></div>
                </div>

                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 px-6 z-20">
                  <button
                    onClick={stopCamera}
                    className="bg-zinc-800 text-white font-medium text-xs px-4 py-2.5 rounded-full"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-lg active:scale-95 transition"
                  >
                    <Camera size={18} /> Prendre la photo
                  </button>
                </div>
              </div>
            ) : selectedImage ? (
              /* Prévisualisation de la photo choisie */
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 border border-gray-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="relative rounded-2xl overflow-hidden max-h-80 bg-gray-100 dark:bg-black flex items-center justify-center">
                  <img
                    src={selectedImage}
                    alt="Ordonnance sélectionnée"
                    className="w-full h-auto max-h-80 object-contain"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" /> Prête à l'analyse
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setImageBase64(null);
                    }}
                    className="flex-1 py-3 px-4 rounded-2xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-semibold hover:bg-gray-50 transition text-center"
                  >
                    Changer de photo
                  </button>
                  <button
                    onClick={processPrescription}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#194B4B] hover:bg-[#133a3a] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Sparkles size={16} className="text-yellow-300" /> Lancer l'analyse IA
                  </button>
                </div>
              </div>
            ) : (
              /* Boutons de Choix : Caméra ou Upload */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,application/pdf"
                  className="hidden"
                />

                <button
                  onClick={startCamera}
                  className="bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-800 hover:border-[#194B4B] rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-center transition group shadow-sm"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-[#194B4B] dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                    <Camera size={28} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      Prendre une photo
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      Caméra en direct
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-800 hover:border-[#194B4B] rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-center transition group shadow-sm"
                >
                  <div className="w-14 h-14 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center group-hover:scale-105 transition">
                    <Upload size={28} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      Importer un fichier
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      JPG, PNG ou PDF
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Conseils pour un scan optimal */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-300 space-y-1">
                <p className="font-bold">Pour un résultat optimal :</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-400">
                  <li>Posez l'ordonnance à plat sur une surface bien éclairée.</li>
                  <li>Assurez-vous que les noms des médicaments et dosages soient nets.</li>
                  <li>L'original papier vous sera demandé lors de la livraison par le coursier.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2 : ANALYSING SCREEN WITH STEP-BY-STEP PROGRESS */}
        {/* ========================================================================= */}
        {step === "analyzing" && (
          <div className="max-w-md mx-auto py-12 flex flex-col items-center text-center space-y-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-[#194B4B] dark:text-emerald-400">
                <Sparkles size={42} className="animate-pulse" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-[#194B4B] border-t-transparent animate-spin"></div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Analyse de votre ordonnance en cours...
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                Notre intelligence multimodale Gemini 1.5 Pro déchiffre la prescription et interroge les stocks des officines de garde.
              </p>
            </div>

            {/* Étapes de l'IA */}
            <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-gray-100 dark:border-zinc-800 shadow-sm text-left space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    analysisPhase >= 1
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                  }`}
                >
                  {analysisPhase > 1 ? <Check size={14} /> : 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Lecture OCR & Vision Multimodale
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Déchiffrage de l'écriture manuscrite du praticien
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    analysisPhase >= 2
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                  }`}
                >
                  {analysisPhase > 2 ? <Check size={14} /> : 2}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Extraction des Molécules & DCI
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Structuration des dosages, formes et posologies
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    analysisPhase >= 3
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 dark:bg-zinc-800 text-gray-400"
                  }`}
                >
                  {analysisPhase >= 3 ? <Loader2 size={14} className="animate-spin" /> : 3}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Matching & Géolocalisation Stocks
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Sélection des officines les plus proches avec stock &gt; 0
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3 : REVIEW SCREEN (REVUE PAR LE PATIENT) */}
        {/* ========================================================================= */}
        {step === "review" && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Résumé supérieur du matching */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 dark:bg-emerald-950 text-[#194B4B] dark:text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {items.filter((i) => i.matched && i.in_stock).length} / {items.length} Disponibles
                  </span>
                  {pharmacies.length > 0 && (
                    <span className="bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Building2 size={12} /> {pharmacies.length} Officine(s)
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mt-1.5">
                  Revue des médicaments détectés
                </h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Vérifiez les quantités et ajustez les correspondances avant de valider votre panier.
                </p>
              </div>

              {selectedImage && (
                <button
                  onClick={() => {
                    const win = window.open();
                    win?.document.write(`<img src="${selectedImage}" style="max-width:100%" />`);
                  }}
                  className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 px-3 py-2 rounded-xl transition font-medium"
                >
                  <Eye size={14} /> Voir l'original
                </button>
              )}
            </div>

            {/* Multi-Pharmacy Warning if split needed */}
            {pharmacies.length > 1 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3">
                <MapPin size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200">
                  <p className="font-bold">Panier Multi-Pharmacies optimisé</p>
                  <p className="mt-0.5">
                    Pour honorer l'intégralité de votre ordonnance, vos médicaments seront récupérés auprès de{" "}
                    <strong>{pharmacies.length} pharmacies différentes</strong> (livraisons coordonnées).
                  </p>
                </div>
              </div>
            )}

            {/* Liste des Médicaments Détectés */}
            <div className="space-y-4">
              {items.map((item, index) => {
                const isMatched = item.matched && item.product;
                const prod = item.product;

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-zinc-900 rounded-3xl p-5 border transition shadow-sm ${
                      item.selected
                        ? isMatched
                          ? "border-emerald-200 dark:border-emerald-900/60"
                          : "border-amber-200 dark:border-amber-900/60"
                        : "border-gray-100 dark:border-zinc-800 opacity-60"
                    }`}
                  >
                    {/* Ligne Supérieure : Détection IA vs Checkbox */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleItemSelection(item.id)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 transition ${
                            item.selected
                              ? "bg-[#194B4B] text-white"
                              : "border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                          }`}
                        >
                          {item.selected && <Check size={14} strokeWidth={3} />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                              {item.detected.nom_medicament}
                            </h3>
                            <span className="text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                              {item.detected.dosage || "Standard"}
                            </span>
                            {item.detected.forme && (
                              <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                                • {item.detected.forme}
                              </span>
                            )}
                          </div>
                          {item.detected.posologie && (
                            <p className="text-xs text-[#194B4B] dark:text-emerald-400 font-medium mt-0.5">
                              📋 {item.detected.posologie}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition"
                        title="Supprimer cette ligne"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Bloc Correspondance Officine */}
                    {isMatched && prod ? (
                      <div className="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-3.5 border border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 dark:text-white">
                              {prod.nom_commercial}
                            </span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {prod.price} FCFA
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
                            <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-zinc-300">
                              <Building2 size={12} className="text-[#194B4B]" />
                              {prod.pharmacy_name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                              <MapPin size={12} /> {prod.distance_km} km
                            </span>
                            <span>•</span>
                            <span className={prod.stock > 0 ? "text-emerald-600 font-medium" : "text-amber-600"}>
                              {prod.stock > 0 ? `En stock (${prod.stock} dispo)` : "Sur commande"}
                            </span>
                          </div>

                          {/* Alternatives d'officines disponibles */}
                          {item.available_alternatives && item.available_alternatives.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[10px] text-gray-400 mr-1.5">Autre officine :</span>
                              {item.available_alternatives.map((alt) => (
                                <button
                                  key={alt.pharmacy_id}
                                  onClick={() => selectAlternativeProduct(item.id, alt)}
                                  className="text-[10px] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 px-2 py-0.5 rounded-md mr-1 hover:border-[#194B4B] transition"
                                >
                                  {alt.pharmacy_name} ({alt.distance_km} km)
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Sélecteur de Quantité */}
                        <div className="flex items-center self-end sm:self-center gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-2 py-1">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-bold px-2 text-gray-900 dark:text-white">
                            {item.selectedQuantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white transition"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Si médicament non reconnu automatiquement */
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-3.5 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                              Correspondance automatique non trouvée
                            </p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">
                              Recherchez manuellement dans le catalogue pour lier le produit exact.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => openManualSearch(index)}
                          className="text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0"
                        >
                          <Search size={13} /> Rechercher au catalogue
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Récapitulatif Financier Pré-Calculé */}
            <div className="bg-[#194B4B] text-white rounded-3xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-800">
                <span className="text-xs text-emerald-200">Articles sélectionnés</span>
                <span className="font-bold text-sm">{selectedItemsList.length} produit(s)</span>
              </div>

              <div className="flex items-center justify-between text-xs text-emerald-200">
                <span>Sous-total médicaments</span>
                <span className="font-bold text-white text-sm">{estimatedMedicinesTotal} FCFA</span>
              </div>

              <div className="flex items-center justify-between text-xs text-emerald-200">
                <span>Livraison ({distinctPharmaciesCount} point(s) de collecte)</span>
                <span className="font-bold text-white text-sm">{estimatedDeliveryTotal} FCFA</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-emerald-800">
                <span className="font-bold text-base">Total Estimé</span>
                <span className="font-extrabold text-xl text-yellow-300">{grandTotal} FCFA</span>
              </div>

              <button
                onClick={confirmAndAddToCart}
                disabled={selectedItemsList.length === 0}
                className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-extrabold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] mt-2"
              >
                <ShoppingCart size={18} />
                Valider &amp; Ajouter au Panier ({grandTotal} FCFA)
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL DE RECHERCHE MANUELLE DU CATALOGUE */}
      {/* ========================================================================= */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Associer un médicament du catalogue
              </h3>
              <button
                onClick={() => setSearchModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 text-xs"
              >
                Fermer
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    triggerCatalogSearch(e.target.value);
                  }}
                  placeholder="Rechercher par nom commercial ou DCI (ex: Paracétamol, Amox...)"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#194B4B]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isSearchingCatalog ? (
                <div className="text-center py-8 text-xs text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Recherche en cours...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => linkProductToItem(prod)}
                    className="p-3 bg-gray-50 dark:bg-zinc-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl border border-gray-100 dark:border-zinc-800 cursor-pointer flex items-center justify-between transition group"
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-[#194B4B] dark:group-hover:text-emerald-400">
                        {prod.nom_commercial || prod.commercial_name || prod.name}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {prod.dosage} {prod.form ? `• ${prod.form}` : ""} {prod.dci ? `(${prod.dci})` : ""}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 shrink-0">
                      {prod.price || 1500} FCFA
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-gray-400">
                  Aucun produit correspondant trouvé.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
