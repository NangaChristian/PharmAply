import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, Camera, Upload, CheckCircle2, Loader2, Sparkles, AlertCircle, 
  MapPin, ShoppingCart, Trash2, Plus, Minus, Search, RefreshCw, ShieldAlert,
  Building2, Pill, Check, ArrowRight, Eye, AlertTriangle, FileText,
  Zap, ZapOff, SwitchCamera, History, ExternalLink, Clock, ChevronRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCart } from "../../components/CartProvider";
import { useAuth } from "../../components/AuthProvider";
import { supabase } from "../../lib/supabase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from "../../lib/firebase";
import { db } from "../../lib/firebase";
import toast from "react-hot-toast";
import { formatCurrency, parseDate } from "../../lib/utils";

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
  const [activeTab, setActiveTab] = useState<"scanner" | "history">("scanner");
  const [step, setStep] = useState<"capture" | "analyzing" | "review">("capture");
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [analysisPhase, setAnalysisPhase] = useState<number>(1);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({ lat: 4.0511, lng: 9.7679 });

  // Camera & Stream controls
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extracted Results State
  const [items, setItems] = useState<ScanItem[]>([]);
  const [pharmacies, setPharmacies] = useState<PharmacySummary[]>([]);
  const [savedPrescriptionId, setSavedPrescriptionId] = useState<string | null>(null);

  // Prescription History State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"today" | "all">("all");
  const [selectedHistoryPrescription, setSelectedHistoryPrescription] = useState<any | null>(null);

  // 1. Initialiser la géolocalisation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn("Géolocalisation par défaut (Douala) :", err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // 2. Charger l'historique des ordonnances scannées depuis Firestore
  useEffect(() => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "prescriptions"),
        where("patientId", "==", user.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Sort descending by date
        docs.sort((a: any, b: any) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });
        setHistoryList(docs);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Erreur écoute historique prescriptions :", e);
    }
  }, [user]);

  // 3. Gestion de la Caméra avec Viseur & Torche
  const startCamera = async (mode: "environment" | "user" = facingMode) => {
    try {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        },
        audio: false
      });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Accès caméra non disponible :", err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleTorch = async () => {
    if (!mediaStream) return;
    const track = mediaStream.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities: any = track.getCapabilities?.() || {};
        if (capabilities.torch) {
          const nextTorch = !isTorchOn;
          await (track as any).applyConstraints({
            advanced: [{ torch: nextTorch }]
          });
          setIsTorchOn(nextTorch);
        } else {
          toast("Lampe torche non supportée sur cet appareil", { icon: "💡" });
        }
      } catch (err) {
        console.warn("Torch error:", err);
      }
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  useEffect(() => {
    if (step === "capture" && activeTab === "scanner") {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, activeTab]);

  // 4. Capture photo instantanée et démarrage de l'IA
  const capturePhotoAndAnalyze = () => {
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
      
      // Lancement immédiat de l'analyse IA
      processPrescriptionWithImage(dataUrl.split(",")[1], "image/jpeg", dataUrl);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Veuillez choisir une image ou un PDF de votre ordonnance.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedImage(result);
      const b64 = result.split(",")[1];
      const mime = file.type || "image/jpeg";
      setImageBase64(b64);
      setImageMimeType(mime);
      stopCamera();

      // Lancement immédiat de l'analyse IA
      processPrescriptionWithImage(b64, mime, result, file.name);
    };
    reader.readAsDataURL(file);
  };

  // 5. Exécution de l'IA Gemini 1.5 Pro et Enregistrement dans les Prescriptions
  const processPrescriptionWithImage = async (
    b64: string, 
    mime: string, 
    fullDataUrl: string, 
    fileName?: string
  ) => {
    setStep("analyzing");
    setScanProgress(15);
    setAnalysisPhase(1);

    // Progression fluide de l'IA
    const timer1 = setTimeout(() => {
      setScanProgress(45);
      setAnalysisPhase(2);
    }, 1000);

    const timer2 = setTimeout(() => {
      setScanProgress(80);
      setAnalysisPhase(3);
    }, 2200);

    try {
      const response = await fetch("/api/ai/scan-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: b64,
          mimeType: mime,
          latitude: userLocation.lat,
          longitude: userLocation.lng
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "L'IA n'a pas pu identifier les médicaments.");
      }

      setScanProgress(100);

      const formattedItems: ScanItem[] = (data.extracted_items || []).map((item: any, idx: number) => ({
        id: `scan_item_${idx}_${Date.now()}`,
        detected: item.detected,
        matched: !!item.matched,
        in_stock: !!item.in_stock,
        product: item.product,
        selectedQuantity: Number(item.detected?.quantite) || 1,
        selected: true,
        available_alternatives: item.available_alternatives || [],
        similarity_score: item.similarity_score
      }));

      setItems(formattedItems);
      setPharmacies(data.pharmacies_involved || []);

      // Sauvegarde immédiate dans Firestore dans la collection `prescriptions`
      const docName = fileName || `Ordonnance-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.jpg`;
      if (user) {
        try {
          const docRef = await addDoc(collection(db, "prescriptions"), {
            patientId: user.uid,
            patientName: user.displayName || "Patient",
            fileName: docName,
            fileUrl: fullDataUrl,
            status: "pending",
            source: "smart_scanner_ai",
            medicationsCount: formattedItems.length,
            items: formattedItems.map((it) => ({
              nom_medicament: it.detected.nom_medicament,
              dosage: it.detected.dosage,
              forme: it.detected.forme,
              quantite: it.selectedQuantity,
              posologie: it.detected.posologie || "",
              in_stock: it.in_stock,
              product_id: it.product?.id || null,
              product_name: it.product?.nom_commercial || null,
              price: it.product?.price || 0,
              pharmacy_name: it.product?.pharmacy_name || "Pharmacie Partenaire"
            })),
            createdAt: serverTimestamp()
          });
          setSavedPrescriptionId(docRef.id);
        } catch (saveErr) {
          console.warn("Erreur sauvegarde Firestore :", saveErr);
        }

        // Sauvegarde miroir Supabase
        try {
          await supabase.from("prescriptions").insert([
            {
              patient_id: user.uid,
              scanned_data: JSON.stringify(formattedItems),
              status: "pending",
              created_at: new Date().toISOString()
            }
          ]);
        } catch (supaErr) {
          console.warn("Erreur sauvegarde Supabase :", supaErr);
        }
      }

      setStep("review");
      toast.success(`${formattedItems.length} médicament(s) identifié(s) avec succès !`);
    } catch (error: any) {
      console.error("Erreur de scan :", error);
      toast.error(error.message || "Erreur lors de l'analyse.");
      setStep("capture");
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
    }
  };

  // 6. Gestion des quantités & sélection
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
    toast.success("Médicament retiré.");
  };

  // 7. Ajout des médicaments au panier
  const handleAddAllToCart = () => {
    const validItems = items.filter((it) => it.selected && it.matched && it.product);
    if (validItems.length === 0) {
      toast.error("Aucun médicament disponible sélectionné.");
      return;
    }

    validItems.forEach((it) => {
      const prod = it.product!;
      addToCart({
        id: prod.id,
        name: prod.nom_commercial,
        price: prod.price,
        pharmacyId: prod.pharmacy_id,
        pharmacyName: prod.pharmacy_name,
        dosage: prod.dosage || it.detected.dosage,
        image_url: prod.image_url || undefined,
        requiresPrescription: true,
        quantity: it.selectedQuantity,
        prescriptionImage: selectedImage || undefined
      });
    });

    toast.success(`${validItems.length} médicament(s) ajouté(s) au panier !`);
    navigate("/patient/cart");
  };

  // Filtrage pour l'historique
  const filteredHistory = historyList.filter((item) => {
    if (historyFilter === "today") {
      const date = parseDate(item.createdAt);
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

  // Calculs totaux
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
    <div className="flex-1 bg-black text-white flex flex-col h-full overflow-hidden relative font-sans">
      
      {/* ========================================================================= */}
      {/* TOP HEADER */}
      {/* ========================================================================= */}
      <header className="bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 z-30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step === "review") {
                setStep("capture");
                setSelectedImage(null);
                setImageBase64(null);
              } else {
                navigate(-1);
              }
            }}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-white text-base flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              Scanner d'Ordonnance
            </h1>
            <p className="text-[11px] text-zinc-400">
              Reconnaissance médicale & pharmacie
            </p>
          </div>
        </div>

        {/* Onglets Scanner / Historique */}
        <div className="flex items-center bg-zinc-900 p-1 rounded-full border border-zinc-800">
          <button
            onClick={() => {
              setActiveTab("scanner");
              if (step === "review") setStep("capture");
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "scanner"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Camera size={13} />
            Scanner
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-[#194B4B] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <History size={13} />
            Historique
            {historyList.length > 0 && (
              <span className="bg-yellow-400 text-zinc-900 text-[10px] font-black px-1.5 rounded-full ml-0.5">
                {historyList.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VUE 1 : HISTORIQUE DES SCANS */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="flex-1 bg-zinc-950 overflow-y-auto p-4 space-y-4 pb-24">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText size={18} className="text-[#194B4B] text-teal-400" />
              Historique des Ordonnances Scannées
            </h2>
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setHistoryFilter("today")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  historyFilter === "today" ? "bg-zinc-800 text-white" : "text-zinc-400"
                }`}
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => setHistoryFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  historyFilter === "all" ? "bg-zinc-800 text-white" : "text-zinc-400"
                }`}
              >
                Tous ({historyList.length})
              </button>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 bg-zinc-900/40 rounded-3xl border border-dashed border-zinc-800">
              <FileText size={48} className="mx-auto text-zinc-700 mb-3" />
              <p className="font-bold text-sm text-zinc-300">Aucun scan d'ordonnance enregistré</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                Vos ordonnances analysées par l'IA apparaîtront ici avec les médicaments extraits.
              </p>
              <button
                onClick={() => setActiveTab("scanner")}
                className="mt-5 px-5 py-2.5 bg-[#194B4B] text-white rounded-full text-xs font-bold shadow-md hover:bg-teal-700 transition"
              >
                Scanner une ordonnance maintenant
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                const dateObj = parseDate(item.createdAt);
                const meds = item.items || [];
                return (
                  <div
                    key={item.id}
                    className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700 flex items-center justify-center">
                          {item.fileUrl ? (
                            <img src={item.fileUrl} alt="Ordonnance" className="w-full h-full object-cover" />
                          ) : (
                            <FileText size={20} className="text-teal-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm truncate max-w-[200px]">
                            {item.fileName || "Ordonnance Médicale"}
                          </p>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                            <Clock size={12} />
                            {dateObj ? dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Récemment"}
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-950 text-teal-400 border border-teal-800">
                        {item.status || "Validé IA"}
                      </span>
                    </div>

                    {/* Médicaments extraits */}
                    {meds.length > 0 && (
                      <div className="bg-zinc-950/60 rounded-xl p-2.5 border border-zinc-800/80">
                        <p className="text-[11px] font-bold text-zinc-400 mb-1.5">
                          {meds.length} Médicament(s) prescrit(s) :
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {meds.map((m: any, idx: number) => (
                            <span
                              key={idx}
                              className="bg-zinc-800 text-zinc-200 text-[11px] px-2 py-0.5 rounded-md border border-zinc-700 flex items-center gap-1"
                            >
                              <Pill size={10} className="text-yellow-400" />
                              {m.nom_medicament} {m.dosage ? `(${m.dosage})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                      {item.fileUrl && (
                        <button
                          onClick={() => window.open(item.fileUrl, "_blank")}
                          className="text-xs text-teal-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Eye size={13} /> Voir document
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (meds.length > 0) {
                            meds.forEach((m: any) => {
                              addToCart({
                                id: m.product_id || `hist_${Date.now()}_${m.nom_medicament}`,
                                name: m.product_name || m.nom_medicament,
                                price: m.price || 1500,
                                pharmacyId: "pharm_default",
                                pharmacyName: m.pharmacy_name || "Pharmacie Partenaire",
                                dosage: m.dosage,
                                requiresPrescription: true,
                                quantity: m.quantite || 1,
                                prescriptionImage: item.fileUrl || undefined
                              });
                            });
                            toast.success("Médicaments ajoutés au panier !");
                            navigate("/patient/cart");
                          }
                        }}
                        className="ml-auto px-3.5 py-1.5 bg-[#194B4B] hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <ShoppingCart size={13} />
                        Commander ces médicaments
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VUE 2 : SCANNER LIVE (VISEUR CADRE AVEC LASER ANIMÉ) */}
      {/* ========================================================================= */}
      {activeTab === "scanner" && step === "capture" && (
        <div className="flex-1 relative flex flex-col justify-between overflow-hidden bg-black">
          {/* Caméra Live Vidéo */}
          <div className="absolute inset-0 z-0 flex items-center justify-center">
            {isCameraActive ? (
              <video
                ref={videoRef}
                playsInline
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-8 text-zinc-500">
                <Camera size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Caméra inactive</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="mt-3 px-4 py-2 bg-[#194B4B] text-white rounded-full text-xs font-bold"
                >
                  Activer la caméra
                </button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Masque Sombre avec Découpe Centrale & Cadre du Viseur */}
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center p-6">
            {/* Boîte de visée pour ordonnance */}
            <div className="relative w-full max-w-xs sm:max-w-sm aspect-[3/4] rounded-3xl border-2 border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] overflow-hidden">
              
              {/* 4 Coins lumineux stylisés */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400 rounded-tl-2xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400 rounded-tr-2xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400 rounded-bl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400 rounded-br-2xl"></div>

              {/* Ligne Laser qui scanne de haut en bas */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser"></div>

              {/* Texte au centre du viseur */}
              <div className="absolute inset-x-0 bottom-6 text-center">
                <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full border border-white/20">
                  Alignez l'ordonnance dans le cadre
                </span>
              </div>
            </div>
          </div>

          {/* Commandes Flottantes du Haut (Flash, Switch Caméra) */}
          <div className="relative z-20 px-6 pt-4 flex items-center justify-between">
            <button
              onClick={toggleTorch}
              className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition ${
                isTorchOn
                  ? "bg-yellow-400 text-zinc-900 border-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.5)]"
                  : "bg-black/40 text-white border-white/20 hover:bg-black/60"
              }`}
            >
              {isTorchOn ? <Zap size={20} /> : <ZapOff size={20} />}
            </button>

            <button
              onClick={switchCamera}
              className="w-11 h-11 rounded-full bg-black/40 text-white border border-white/20 backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition"
            >
              <SwitchCamera size={20} />
            </button>
          </div>

          {/* Commandes Flottantes du Bas (Upload, Déclencheur Photo, Historique) */}
          <div className="relative z-20 px-8 pb-10 flex items-center justify-around">
            {/* Input file caché */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,application/pdf"
              className="hidden"
            />

            {/* Bouton Import Galerie / Fichier */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 text-white group"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-900/80 border border-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-zinc-800 transition">
                <Upload size={20} className="text-zinc-200" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-300">Importer</span>
            </button>

            {/* Bouton Déclencheur Principal Shutter */}
            <button
              onClick={capturePhotoAndAnalyze}
              className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm p-1.5 flex items-center justify-center border-2 border-white hover:scale-105 active:scale-95 transition shadow-2xl"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#194B4B] to-teal-500 flex items-center justify-center text-white shadow-inner">
                <Camera size={28} />
              </div>
            </button>

            {/* Bouton Accès Rapide Historique */}
            <button
              onClick={() => setActiveTab("history")}
              className="flex flex-col items-center gap-1 text-white group"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-900/80 border border-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-zinc-800 transition">
                <History size={20} className="text-zinc-200" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-300">Historique</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VUE 3 : ÉCRAN D'ANALYSE IA EN DIRECT */}
      {/* ========================================================================= */}
      {step === "analyzing" && (
        <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
          {/* Lueur d'ambiance */}
          <div className="absolute w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 max-w-sm w-full space-y-6">
            {/* Viseur miniature de l'ordonnance en cours d'analyse */}
            <div className="relative w-44 h-56 mx-auto rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.3)] bg-zinc-900">
              {selectedImage && (
                <img src={selectedImage} alt="Scan" className="w-full h-full object-cover" />
              )}
              {/* Ligne laser qui balaie */}
              <div className="absolute inset-x-0 h-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-laser"></div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Sparkles size={20} className="text-yellow-400 animate-spin" />
                Déchiffrage de l'ordonnance...
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                L'IA Gemini 1.5 Pro extrait les molécules, dosages et recherche les stocks en temps réel.
              </p>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-cyan-400 font-bold tracking-widest uppercase">
              {scanProgress}% — {analysisPhase === 1 ? "Lecture OCR Multimodale" : analysisPhase === 2 ? "Extraction des Molécules DCI" : "Recherche des Pharmacies"}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VUE 4 : RÉSULTAT & PROPOSITION IMMÉDIATE DES MÉDICAMENTS */}
      {/* ========================================================================= */}
      {step === "review" && (
        <div className="flex-1 bg-zinc-950 overflow-y-auto p-4 sm:p-6 pb-36 space-y-4">
          {/* Header de succès */}
          <div className="bg-gradient-to-r from-[#194B4B] to-teal-900 text-white rounded-3xl p-5 shadow-lg border border-teal-800 flex items-center justify-between">
            <div>
              <span className="bg-yellow-400 text-zinc-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                Analyse Terminée
              </span>
              <h2 className="text-lg font-bold text-white mt-1">
                {items.length} Médicament(s) Détecté(s)
              </h2>
              <p className="text-xs text-teal-200 mt-0.5">
                Vérifiez les posologies et confirmez votre commande.
              </p>
            </div>

            <button
              onClick={() => {
                setStep("capture");
                setSelectedImage(null);
                setImageBase64(null);
              }}
              className="px-3 py-2 bg-black/40 hover:bg-black/60 rounded-2xl text-xs font-bold flex items-center gap-1.5 border border-white/20 transition"
            >
              <RefreshCw size={13} />
              Re-scanner
            </button>
          </div>

          {/* Liste des Médicaments Proposés par l'IA */}
          <div className="space-y-3">
            {items.map((item, index) => {
              const isMatched = item.matched && item.product;
              const prod = item.product;

              return (
                <div
                  key={item.id}
                  className={`bg-zinc-900 border rounded-2xl p-4 transition ${
                    item.selected
                      ? "border-teal-700/80 shadow-md"
                      : "border-zinc-800 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Checkbox de sélection */}
                      <button
                        onClick={() => toggleItemSelection(item.id)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-1 transition ${
                          item.selected
                            ? "bg-[#194B4B] text-white"
                            : "border border-zinc-700 bg-zinc-800"
                        }`}
                      >
                        {item.selected && <Check size={14} strokeWidth={3} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Nom détecté & Forme */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white text-base">
                            {item.detected.nom_medicament}
                          </h3>
                          {item.detected.dosage && (
                            <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-md font-medium border border-zinc-700">
                              {item.detected.dosage}
                            </span>
                          )}
                          <span className="text-xs text-zinc-400">
                            {item.detected.forme}
                          </span>
                        </div>

                        {/* Posologie manuscrite déchiffrée */}
                        {item.detected.posologie && (
                          <p className="text-xs text-yellow-300/90 font-medium mt-1">
                            📋 Posologie : {item.detected.posologie}
                          </p>
                        )}

                        {/* Statut Stock & Pharmacie Partenaire */}
                        {isMatched ? (
                          <div className="mt-3 bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400 flex items-center gap-1 truncate">
                                <Building2 size={13} className="text-teal-400 shrink-0" />
                                {prod?.pharmacy_name}
                              </span>
                              <span className="text-zinc-400 text-[11px]">
                                à {prod?.distance_km} km
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className="font-bold text-white text-sm">
                                {formatCurrency((prod?.price || 1500) * item.selectedQuantity)}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-800">
                                En stock ({prod?.stock} dispo)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-amber-400 bg-amber-950/40 p-2 rounded-xl border border-amber-800 flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>Sur commande auprès des officines partenaires</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sélecteur de Quantité */}
                    <div className="flex items-center bg-zinc-800 rounded-xl p-1 border border-zinc-700">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 flex items-center justify-center hover:bg-zinc-700 transition"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-white">
                        {item.selectedQuantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-zinc-900 text-zinc-300 flex items-center justify-center hover:bg-zinc-700 transition"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARRE D'ACTION INFÉRIEURE FIXE (RÉSUMÉ & COMMANDE RAPIDE) */}
      {/* ========================================================================= */}
      {step === "review" && (
        <div className="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 p-4 z-40">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider">
                Total Estimé ({selectedItemsList.length} articles)
              </p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(grandTotal)}
              </p>
            </div>

            <button
              onClick={handleAddAllToCart}
              className="px-6 py-3.5 bg-gradient-to-r from-[#194B4B] to-teal-600 hover:from-teal-700 hover:to-teal-500 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 active:scale-95 transition"
            >
              <ShoppingCart size={18} />
              Commander Maintenant
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
