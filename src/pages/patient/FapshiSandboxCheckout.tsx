import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ShieldCheck, Smartphone, CreditCard, Loader2, AlertCircle, ExternalLink, Lock } from "lucide-react";
import { formatCurrency } from "../../lib/utils";
import { db, doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "../../lib/firebase";
import { supabase } from "../../lib/firebase";
import toast from "react-hot-toast";

export function FapshiSandboxCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const amount = Number(searchParams.get("amount") || 2500);
  const externalId = searchParams.get("externalId") || "order_" + Date.now();
  const email = searchParams.get("email") || "client@pharmap.cm";
  const redirectUrl = searchParams.get("redirectUrl") || `/patient/orders`;
  const transId = searchParams.get("transId") || "fapshi_sand_" + Math.random().toString(36).substring(2, 9);

  const [paymentType, setPaymentType] = useState<"momo" | "om" | "card">("momo");
  const [phone, setPhone] = useState("670000000");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    if (externalId && db) {
      getDoc(doc(db, "orders", externalId)).then((snap) => {
        if (snap.exists()) {
          setOrderDetails(snap.data());
        }
      }).catch((e) => console.warn("Order preview fetch warning:", e));
    }
  }, [externalId]);

  const handlePay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Déclencher le webhook backend Fapshi (Split Paiement & Comptabilité)
      try {
        await fetch("/api/webhooks/fapshi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId,
            status: "SUCCESSFUL",
            transId: transId,
            amount: amount,
            payerEmail: email,
            phone: phone,
            operator: paymentType === "momo" ? "MTN Mobile Money" : paymentType === "om" ? "Orange Money" : "Carte Bancaire"
          })
        });
      } catch (webhookErr) {
        console.warn("Fapshi webhook notice:", webhookErr);
      }

      // 2. Mise à jour de la commande dans Firestore
      let targetPharmacyId = orderDetails?.pharmacyId;
      let patientId = orderDetails?.patientId;

      try {
        if (externalId && db) {
          const orderRef = doc(db, "orders", externalId);
          const currentSnap = await getDoc(orderRef);
          const currentData = currentSnap.exists() ? currentSnap.data() : {};
          
          targetPharmacyId = targetPharmacyId || currentData.pharmacyId;
          patientId = patientId || currentData.patientId;

          const historyItem = { 
            status: "paid", 
            timestamp: new Date().toISOString(),
            note: `Paiement Fapshi Sandbox (${paymentType === 'momo' ? 'MTN MoMo' : paymentType === 'om' ? 'Orange Money' : 'Carte'})` 
          };
          const existingHistory = currentData.statusHistory || [];

          await updateDoc(orderRef, {
            status: "paid",
            paymentStatus: "paid",
            fapshiTransId: transId,
            paidAt: new Date().toISOString(),
            statusHistory: [...existingHistory, historyItem],
            paymentDetails: {
              provider: "Fapshi Sandbox",
              phone: phone,
              method: paymentType,
              amount: amount,
              transId: transId,
              paidAt: new Date().toISOString()
            }
          });

          // Notification pour la pharmacie
          if (targetPharmacyId) {
            await addDoc(collection(db, "notifications"), {
              userId: targetPharmacyId,
              type: "order_status",
              title: "💰 Paiement reçu via Fapshi",
              message: `Le paiement de ${formatCurrency(amount)} pour la commande #${externalId.slice(0, 6).toUpperCase()} a été validé. Veuillez préparer le colis.`,
              isRead: false,
              relatedId: externalId,
              createdAt: serverTimestamp()
            });
          }

          // Notification pour le patient
          if (patientId) {
            await addDoc(collection(db, "notifications"), {
              userId: patientId,
              type: "payment_confirmed",
              title: "✅ Paiement validé avec succès",
              message: `Votre règlement de ${formatCurrency(amount)} pour la commande #${externalId.slice(0, 6).toUpperCase()} a été reçu. La pharmacie prépare vos médicaments.`,
              isRead: false,
              relatedId: externalId,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (dbErr) {
        console.warn("Firestore direct update notice:", dbErr);
      }

      // 3. Mise à jour Supabase miroir
      try {
        if (externalId && supabase) {
          await supabase.from("orders").update({
            status: "paid",
            fapshi_trans_id: transId,
            paid_at: new Date().toISOString()
          }).eq("id", externalId);
        }
      } catch (supaErr) {
        console.warn("Supabase direct update notice:", supaErr);
      }

      setSuccess(true);
      toast.success("Paiement validé avec succès !");

      setTimeout(() => {
        if (redirectUrl.startsWith("http")) {
          window.location.href = redirectUrl;
        } else {
          navigate(redirectUrl);
        }
      }, 1500);
    } catch (err: any) {
      console.error("Payment execution error:", err);
      setErrorMsg("Erreur lors de l'exécution du paiement Fapshi. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      {/* Header bar */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Top branded bar */}
        <div className="bg-[#194B4B] p-6 text-white text-center relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-4 top-5 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/40 text-white"
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="inline-flex items-center gap-2 bg-yellow-400 text-zinc-950 px-3 py-1 rounded-full text-xs font-black mb-2 shadow-sm">
            <Lock size={12} /> Paiement Sécurisé (Mobile Money / Orange Money)
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Paiement en Ligne</h1>
          <p className="text-teal-200 text-xs mt-1">Réf. Commande : #{externalId.slice(0, 8).toUpperCase()}</p>
        </div>

        {/* Payment Summary */}
        <div className="p-6 space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-medium block">Montant total</span>
              {orderDetails?.pharmacyName && (
                <span className="text-[11px] text-teal-400 font-medium">{orderDetails.pharmacyName}</span>
              )}
            </div>
            <span className="text-2xl font-extrabold text-white">{formatCurrency(amount)}</span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {success ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-lg font-bold text-emerald-400">Paiement validé avec succès !</h3>
              <p className="text-xs text-slate-400">Votre commande est transmise en préparation...</p>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-4">
              {/* Payment selector */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Sélectionnez le mode de paiement
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType("momo")}
                    className={`py-3.5 px-3 rounded-2xl border flex flex-col items-center gap-1.5 transition text-xs font-bold ${
                      paymentType === "momo"
                        ? "bg-amber-500/20 border-yellow-400 text-yellow-400 shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Smartphone size={20} className="text-yellow-400" />
                    <span>MTN MoMo</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setPaymentType("om")}
                    className={`py-3.5 px-3 rounded-2xl border flex flex-col items-center gap-1.5 transition text-xs font-bold ${
                      paymentType === "om"
                        ? "bg-orange-500/20 border-orange-400 text-orange-400 shadow-sm"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Smartphone size={20} className="text-orange-400" />
                    <span>Orange Money</span>
                  </button>
                </div>
              </div>

              {/* Numéro de Téléphone */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Numéro de débit Mobile Money
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 670 00 00 00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  Transaction sécurisée — Validation instantanée.
                </p>
              </div>

              {/* Bouton de Paiement */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#194B4B] to-teal-600 hover:from-teal-700 hover:to-teal-500 text-white rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Validation du paiement en cours...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} className="text-yellow-400" />
                    <span>Confirmer le Paiement ({formatCurrency(amount)})</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-[11px] text-slate-500">
            <span>Paiement Sécurisé Mobile Money</span>
            <span className="text-teal-400 font-semibold flex items-center gap-1">
              <ShieldCheck size={13} /> 100% Chiffré SSL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
