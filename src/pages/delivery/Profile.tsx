import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Edit2, User, Clock, ShieldCheck, LogOut, FileText, Globe, 
  Car, CreditCard, Lock, Save, Camera, Loader2, Phone, Mail, MapPin, 
  Bike, Trash2, X, AlertCircle, Check, Key, Eye, EyeOff, Star, 
  Package, DollarSign, UploadCloud, ExternalLink
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, db, storage } from "../../lib/firebase";
import { 
  doc, getDoc, getDocs, updateDoc, setDoc, signOut, ref, 
  uploadBytesResumable, getDownloadURL, updateProfile, updatePassword,
  collection, query, where 
} from '../../lib/firebase';
import { useTheme } from "../../components/ThemeProvider";
import { formatCurrency } from "../../lib/utils";
import toast from "react-hot-toast";

interface DriverProfileData {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  photoURL?: string;
  photoUrl?: string;
  city?: string;
  operatingZone?: string;
  address?: string;
  bio?: string;
  vehicleType?: 'motorcycle' | 'car' | 'van' | 'bicycle';
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleColor?: string;
  payoutOperator?: string;
  bankName?: string;
  accountNumber?: string;
  beneficiaryName?: string;
  workStartTime?: string;
  workEndTime?: string;
  isOnline?: boolean;
  status?: 'approved' | 'pending_verification' | 'rejected' | string;
  kyc_status?: 'approved' | 'pending_verification' | 'rejected' | string;
  licenseDocUrl?: string;
  cniDocUrl?: string;
  insuranceDocUrl?: string;
}

interface DeliveryStats {
  completedCount: number;
  activeCount: number;
  totalEarnings: number;
  averageRating: number | null;
  totalReviewsCount: number;
}

export function DeliveryProfile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { primaryColor } = useTheme();
  const brandPrimary = primaryColor || '#194B4B';
  const brandYellow = '#FACC15';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const cniInputRef = useRef<HTMLInputElement>(null);
  const insuranceInputRef = useRef<HTMLInputElement>(null);

  const [driver, setDriver] = useState<DriverProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState<string | null>(null);
  
  // Real stats from orders collection
  const [stats, setStats] = useState<DeliveryStats>({
    completedCount: 0,
    activeCount: 0,
    totalEarnings: 0,
    averageRating: null,
    totalReviewsCount: 0
  });

  // Modals & submenus
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [formData, setFormData] = useState<DriverProfileData>({});
  
  // Password change
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Fetch driver data & compute real metrics from orders
  const loadDriverAndStats = async () => {
    if (!auth.currentUser) return;
    const userUid = auth.currentUser.uid;

    try {
      // 1. Load driver doc from Firestore
      const driverDocRef = doc(db, 'drivers', userUid);
      const driverSnap = await getDoc(driverDocRef);
      let profileData: DriverProfileData = {};

      if (driverSnap.exists()) {
        profileData = driverSnap.data() as DriverProfileData;
      }

      // Supplementary user doc data
      try {
        const userDocRef = doc(db, 'users', userUid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          profileData.name = profileData.name || uData.displayName || uData.name || auth.currentUser.displayName || '';
          profileData.email = profileData.email || uData.email || auth.currentUser.email || '';
          profileData.phoneNumber = profileData.phoneNumber || uData.phoneNumber || uData.phone || '';
          profileData.photoURL = profileData.photoURL || profileData.photoUrl || uData.photoUrl || uData.photoURL || auth.currentUser.photoURL || '';
          
          if (uData.status === 'approved' || uData.kyc_status === 'approved') {
            profileData.status = 'approved';
            profileData.kyc_status = 'approved';
          }
        }
      } catch (e) {
        console.warn("Could not load users doc fallback:", e);
      }

      const consolidated: DriverProfileData = {
        id: userUid,
        name: profileData.name || auth.currentUser.displayName || '',
        displayName: profileData.name || auth.currentUser.displayName || '',
        email: profileData.email || auth.currentUser.email || '',
        phoneNumber: profileData.phoneNumber || profileData.phone || '',
        photoURL: profileData.photoURL || profileData.photoUrl || auth.currentUser.photoURL || '',
        city: profileData.city || '',
        operatingZone: profileData.operatingZone || '',
        address: profileData.address || '',
        bio: profileData.bio || '',
        vehicleType: profileData.vehicleType || undefined,
        vehicleModel: profileData.vehicleModel || '',
        vehiclePlate: profileData.vehiclePlate || '',
        vehicleColor: profileData.vehicleColor || '',
        payoutOperator: profileData.payoutOperator || profileData.bankName || '',
        bankName: profileData.bankName || profileData.payoutOperator || '',
        accountNumber: profileData.accountNumber || '',
        beneficiaryName: profileData.beneficiaryName || '',
        workStartTime: profileData.workStartTime || '08:00',
        workEndTime: profileData.workEndTime || '20:00',
        status: profileData.status || 'approved',
        kyc_status: profileData.kyc_status || 'approved',
        licenseDocUrl: profileData.licenseDocUrl || '',
        cniDocUrl: profileData.cniDocUrl || '',
        insuranceDocUrl: profileData.insuranceDocUrl || '',
        ...profileData
      };

      setDriver(consolidated);
      setFormData(consolidated);

      // 2. Fetch real stats from orders collection for this driver
      try {
        const qDelivered = query(
          collection(db, 'orders'),
          where('driverId', '==', userUid),
          where('status', '==', 'delivered')
        );
        const deliveredSnap = await getDocs(qDelivered);
        const deliveredOrders = deliveredSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

        // Active orders
        const qActive = query(
          collection(db, 'orders'),
          where('driverId', '==', userUid)
        );
        const allDriverOrdersSnap = await getDocs(qActive);
        const allDriverOrders = allDriverOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const activeOrders = allDriverOrders.filter(o => 
          ['driver_assigned', 'delivering', 'en_route', 'out_for_delivery', 'accepted', 'in_transit'].includes(o.status)
        );

        // Calculate total earnings from delivered orders
        const totalEarningsCalculated = deliveredOrders.reduce((acc, order) => {
          const fee = order.deliveryFee || order.delivery_fee || (order.total ? order.total * 0.1 : 0) || 0;
          return acc + Number(fee);
        }, 0);

        // Calculate average rating from real patient ratings in orders
        const ratingsArray: number[] = [];
        deliveredOrders.forEach(o => {
          const r = o.driverRating ?? o.rating ?? o.note;
          if (typeof r === 'number' && r > 0 && r <= 5) {
            ratingsArray.push(r);
          }
        });

        let avgRating: number | null = null;
        if (ratingsArray.length > 0) {
          const sum = ratingsArray.reduce((a, b) => a + b, 0);
          avgRating = parseFloat((sum / ratingsArray.length).toFixed(1));
        }

        setStats({
          completedCount: deliveredOrders.length,
          activeCount: activeOrders.length,
          totalEarnings: totalEarningsCalculated,
          averageRating: avgRating,
          totalReviewsCount: ratingsArray.length
        });
      } catch (statsErr) {
        console.warn("Could not calculate real order stats:", statsErr);
      }
    } catch (err) {
      console.error("Error fetching driver profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriverAndStats();
  }, [activeMenu, isEditingBasic]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success(t('logout_success', 'Déconnexion réussie'));
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la déconnexion');
    }
  };

  const openMenu = (menu: string) => {
    if (driver) {
      setFormData({ ...driver });
    }
    setActiveMenu(menu);
  };

  // Upload or replace profile photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !auth.currentUser) return;
    const file = e.target.files[0];
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('photo_too_large', 'La photo ne doit pas dépasser 5 Mo'));
      return;
    }

    setUploadingPhoto(true);
    const toastId = toast.loading(t('uploading_photo', 'Téléchargement de la photo...'));

    try {
      let finalUrl = '';
      try {
        const fileRef = ref(storage, `profiles/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(fileRef, file);
        finalUrl = await getDownloadURL(uploadTask.ref);
      } catch (storageErr) {
        console.warn("Storage upload fallback to base64 data URL:", storageErr);
        finalUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      if (finalUrl) {
        try {
          await updateProfile(auth.currentUser, { photoURL: finalUrl });
        } catch (authErr) {
          console.warn("Auth updateProfile failed:", authErr);
        }

        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            photoURL: finalUrl,
            photoUrl: finalUrl,
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn("Users doc update failed:", e);
        }

        await setDoc(doc(db, 'drivers', auth.currentUser.uid), {
          photoURL: finalUrl,
          photoUrl: finalUrl,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        setDriver(prev => prev ? ({ ...prev, photoURL: finalUrl, photoUrl: finalUrl }) : null);
        setFormData(prev => ({ ...prev, photoURL: finalUrl, photoUrl: finalUrl }));

        toast.success(t('photo_updated', 'Photo de profil mise à jour avec succès'), { id: toastId });
      }
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast.error(t('photo_upload_error', 'Impossible de mettre à jour la photo : ') + (err.message || ''), { id: toastId });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove photo
  const handleRemovePhoto = async () => {
    if (!auth.currentUser) return;
    if (!window.confirm(t('confirm_remove_photo', 'Voulez-vous vraiment supprimer votre photo de profil ?'))) return;

    setUploadingPhoto(true);
    const toastId = toast.loading(t('removing_photo', 'Suppression de la photo...'));

    try {
      try {
        await updateProfile(auth.currentUser, { photoURL: '' });
      } catch (e) {}

      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          photoURL: null,
          photoUrl: null
        });
      } catch (e) {}

      await setDoc(doc(db, 'drivers', auth.currentUser.uid), {
        photoURL: null,
        photoUrl: null
      }, { merge: true });

      setDriver(prev => prev ? ({ ...prev, photoURL: undefined, photoUrl: undefined }) : null);
      setFormData(prev => ({ ...prev, photoURL: undefined, photoUrl: undefined }));

      toast.success(t('photo_removed', 'Photo supprimée avec succès'), { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression', { id: toastId });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Real KYC Document Upload Handler
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: 'license' | 'cni' | 'insurance') => {
    if (!e.target.files || !e.target.files[0] || !auth.currentUser) return;
    const file = e.target.files[0];
    
    setUploadingDocKey(docType);
    const toastId = toast.loading(t('uploading_document', 'Téléversement du document...'));

    try {
      let finalDocUrl = '';
      try {
        const fileRef = ref(storage, `kyc/drivers/${auth.currentUser.uid}/${docType}_${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(fileRef, file);
        finalDocUrl = await getDownloadURL(uploadTask.ref);
      } catch (storageErr) {
        console.warn("Storage upload failed, using local base64 preview:", storageErr);
        finalDocUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const docKeyMap = {
        license: 'licenseDocUrl',
        cni: 'cniDocUrl',
        insurance: 'insuranceDocUrl'
      } as const;

      const fieldKey = docKeyMap[docType];

      const patch = {
        [fieldKey]: finalDocUrl,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'drivers', auth.currentUser.uid), patch, { merge: true });

      setDriver(prev => prev ? ({ ...prev, [fieldKey]: finalDocUrl }) : null);
      setFormData(prev => ({ ...prev, [fieldKey]: finalDocUrl }));

      toast.success(t('document_uploaded_success', 'Document téléversé avec succès !'), { id: toastId });
    } catch (err: any) {
      console.error("Document upload error:", err);
      toast.error(t('document_upload_failed', 'Échec du téléversement : ') + (err.message || ''), { id: toastId });
    } finally {
      setUploadingDocKey(null);
      e.target.value = '';
    }
  };

  // Save changes from any submenu or main modal
  const handleSave = async (customPayload?: Partial<DriverProfileData>) => {
    if (!auth.currentUser) return;
    const payload = customPayload || formData;
    const toastId = toast.loading(t('saving_profile', 'Enregistrement en cours...'));

    try {
      const cleanPayload: Record<string, any> = {
        ...payload,
        updatedAt: new Date().toISOString()
      };

      if (cleanPayload.name) {
        cleanPayload.displayName = cleanPayload.name;
      }

      if (cleanPayload.name && cleanPayload.name !== auth.currentUser.displayName) {
        try {
          await updateProfile(auth.currentUser, { displayName: cleanPayload.name });
        } catch (e) {
          console.warn("Auth name update failed:", e);
        }
      }

      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          displayName: cleanPayload.name,
          name: cleanPayload.name,
          phoneNumber: cleanPayload.phoneNumber || cleanPayload.phone,
          phone: cleanPayload.phoneNumber || cleanPayload.phone,
          city: cleanPayload.city,
          address: cleanPayload.address
        });
      } catch (e) {
        console.warn("User record update failed:", e);
      }

      await setDoc(doc(db, 'drivers', auth.currentUser.uid), cleanPayload, { merge: true });

      setDriver(prev => prev ? ({ ...prev, ...cleanPayload }) : cleanPayload);
      toast.success(t('profile_updated_success', 'Profil mis à jour avec succès !'), { id: toastId });
      setActiveMenu(null);
      setIsEditingBasic(false);
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || t('profile_update_failed', 'Échec de la mise à jour'), { id: toastId });
    }
  };

  // Password update
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error(t('password_too_short', 'Le mot de passe doit comporter au moins 6 caractères'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwords_do_not_match', 'Les mots de passe ne correspondent pas'));
      return;
    }

    setUpdatingPassword(true);
    const toastId = toast.loading(t('updating_password', 'Mise à jour du mot de passe...'));

    try {
      await updatePassword(auth, newPassword);
      toast.success(t('password_updated', 'Mot de passe modifié avec succès !'), { id: toastId });
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || t('password_change_error', 'Impossible de modifier le mot de passe'), { id: toastId });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: brandPrimary }} />
          <p className="text-sm font-medium text-slate-500">{t('loading_profile', 'Chargement du profil...')}</p>
        </div>
      </div>
    );
  }

  // Active Submenu View (Vehicle, Payout, Documents, Hours)
  if (activeMenu) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
        {/* Hidden inputs for KYC documents */}
        <input 
          type="file" 
          ref={licenseInputRef} 
          className="hidden" 
          accept="image/*,.pdf" 
          onChange={(e) => handleDocUpload(e, 'license')} 
        />
        <input 
          type="file" 
          ref={cniInputRef} 
          className="hidden" 
          accept="image/*,.pdf" 
          onChange={(e) => handleDocUpload(e, 'cni')} 
        />
        <input 
          type="file" 
          ref={insuranceInputRef} 
          className="hidden" 
          accept="image/*,.pdf" 
          onChange={(e) => handleDocUpload(e, 'insurance')} 
        />

        {/* Submenu Header */}
        <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveMenu(null)} 
              className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-700 rounded-full hover:bg-slate-100 transition"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-bold text-slate-900 text-lg">
              {activeMenu === 'vehicle_details' && t('vehicle_details', 'Détails du véhicule')}
              {activeMenu === 'payout_methods' && t('payout_methods', 'Moyens de retrait & Payout')}
              {activeMenu === 'driver_documents' && t('driver_documents', 'Documents & Permis')}
              {activeMenu === 'working_hours' && t('working_hours', 'Horaires & Disponibilité')}
            </h1>
          </div>
        </div>

        {/* Submenu Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-xl mx-auto w-full">
          {/* 1. Vehicle Details */}
          {activeMenu === 'vehicle_details' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandPrimary}15`, color: brandPrimary }}
                >
                  <Car size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('vehicle_information', 'Informations sur votre véhicule')}</h3>
                  <p className="text-xs text-slate-500">{t('vehicle_info_desc', 'Renseignez les détails précis pour les clients et la pharmacie.')}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {t('vehicle_type', 'Type de véhicule')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'motorcycle', label: t('motorcycle', 'Moto / Scooter'), icon: Bike },
                    { id: 'car', label: t('car', 'Voiture'), icon: Car },
                    { id: 'bicycle', label: t('bicycle', 'Vélo / Cargo'), icon: Bike },
                    { id: 'van', label: t('van', 'Camionnette'), icon: Car }
                  ].map((v) => {
                    const IconComp = v.icon;
                    const isSelected = (formData.vehicleType || 'motorcycle') === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, vehicleType: v.id as any })}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left font-bold text-sm transition ${
                          isSelected 
                            ? 'text-white border-transparent shadow-sm' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        style={isSelected ? { backgroundColor: brandPrimary } : undefined}
                      >
                        <IconComp size={18} className={isSelected ? 'text-[#FACC15]' : 'text-slate-500'} />
                        <span>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('vehicle_model', 'Marque & Modèle du véhicule')}
                </label>
                <input 
                  type="text" 
                  value={formData.vehicleModel || ''} 
                  onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })} 
                  placeholder={t('eg_yamaha', 'ex: Yamaha Crypton 110, Boxer 150cc, TVS...')}
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('vehicle_plate', 'Immatriculation / Plaque')}
                  </label>
                  <input 
                    type="text" 
                    value={formData.vehiclePlate || ''} 
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value.toUpperCase() })} 
                    placeholder="LT 482 AB"
                    className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-bold text-sm uppercase tracking-wider outline-none focus:bg-white transition" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('vehicle_color', 'Couleur du véhicule')}
                  </label>
                  <input 
                    type="text" 
                    value={formData.vehicleColor || ''} 
                    onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })} 
                    placeholder="Noir, Rouge, Bleu..."
                    className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition" 
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. Payout Methods */}
          {activeMenu === 'payout_methods' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandPrimary}15`, color: brandPrimary }}
                >
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('payout_details', 'Compte de reversement')}</h3>
                  <p className="text-xs text-slate-500">{t('payout_desc', 'Vos gains de livraison seront directement versés sur ce compte.')}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  {t('operator_or_bank', 'Opérateur de paiement')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'MTN Mobile Money',
                    'Orange Money',
                    'Express Union',
                    'Virement Bancaire'
                  ].map((op) => {
                    const isSelected = (formData.payoutOperator || formData.bankName || 'MTN Mobile Money') === op;
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setFormData({ ...formData, payoutOperator: op, bankName: op })}
                        className={`p-3.5 rounded-2xl border text-center font-bold text-sm transition ${
                          isSelected 
                            ? 'text-white border-transparent shadow-sm' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                        style={isSelected ? { backgroundColor: brandPrimary } : undefined}
                      >
                        {op}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('account_number_phone', 'Numéro de téléphone / Compte')}
                </label>
                <input 
                  type="text" 
                  value={formData.accountNumber || ''} 
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} 
                  placeholder={driver?.phoneNumber || "+237 6XX XX XX XX"}
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:bg-white transition" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('beneficiary_name', 'Nom complet du titulaire')}
                </label>
                <input 
                  type="text" 
                  value={formData.beneficiaryName || ''} 
                  onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })} 
                  placeholder={driver?.name || "Nom apparaissant sur le compte"}
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition" 
                />
              </div>
            </div>
          )}

          {/* 3. Working Hours & Availability */}
          {activeMenu === 'working_hours' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandPrimary}15`, color: brandPrimary }}
                >
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('hours_and_zone', 'Horaires & Rayon de livraison')}</h3>
                  <p className="text-xs text-slate-500">{t('hours_desc', 'Définissez vos plages de disponibilité quotidienne.')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('start_time', 'Heure de début')}
                  </label>
                  <input 
                    type="time" 
                    value={formData.workStartTime || '08:00'} 
                    onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })} 
                    className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-bold text-base outline-none focus:bg-white transition" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('end_time', 'Heure de fin')}
                  </label>
                  <input 
                    type="time" 
                    value={formData.workEndTime || '20:00'} 
                    onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })} 
                    className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-bold text-base outline-none focus:bg-white transition" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('operating_zone', 'Secteur / Quartiers de couverture')}
                </label>
                <input 
                  type="text" 
                  value={formData.operatingZone || ''} 
                  onChange={(e) => setFormData({ ...formData, operatingZone: e.target.value })} 
                  placeholder={t('eg_zones', 'ex: Akwa, Bonanjo, Deido, Bonapriso, Makepe...')}
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition" 
                />
              </div>
            </div>
          )}

          {/* 4. Driver KYC Documents */}
          {activeMenu === 'driver_documents' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="p-4 rounded-2xl border border-slate-100 flex items-start gap-3 bg-slate-50">
                <ShieldCheck size={24} style={{ color: brandPrimary }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-slate-900">
                    {driver?.kyc_status === 'approved' 
                      ? t('kyc_approved_title', 'Statut KYC : Approuvé') 
                      : t('kyc_pending_title', 'Statut KYC : En cours de validation')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('kyc_real_upload_desc', 'Téléversez vos pièces officielles pour la validation de vos autorisations de transport.')}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  {
                    key: 'license' as const,
                    title: t('driver_license', 'Permis de conduire'),
                    desc: t('driver_license_desc', 'Catégorie A (Moto) ou B (Auto)'),
                    url: driver?.licenseDocUrl,
                    ref: licenseInputRef
                  },
                  {
                    key: 'cni' as const,
                    title: t('national_id', 'Carte Nationale d\'Identité (CNI)'),
                    desc: t('national_id_desc', 'Recto/Verso ou Passeport valide'),
                    url: driver?.cniDocUrl,
                    ref: cniInputRef
                  },
                  {
                    key: 'insurance' as const,
                    title: t('vehicle_insurance', 'Attestation d\'Assurance Véhicule'),
                    desc: t('vehicle_insurance_desc', 'Certificat d\'assurance en cours de validité'),
                    url: driver?.insuranceDocUrl,
                    ref: insuranceInputRef
                  }
                ].map((docItem) => {
                  const isUploadingThis = uploadingDocKey === docItem.key;
                  return (
                    <div key={docItem.key} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm"
                          style={{ color: brandPrimary }}
                        >
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{docItem.title}</p>
                          <p className="text-[11px] text-slate-500">{docItem.desc}</p>
                          {docItem.url && (
                            <a 
                              href={docItem.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[11px] font-bold underline flex items-center gap-1 mt-0.5 text-slate-700"
                            >
                              <ExternalLink size={10} />
                              <span>{t('view_document', 'Voir le document téléversé')}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isUploadingThis}
                        onClick={() => docItem.ref.current?.click()}
                        className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 text-white shadow-sm disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: brandPrimary }}
                      >
                        {isUploadingThis ? (
                          <Loader2 size={13} className="animate-spin text-[#FACC15]" />
                        ) : (
                          <UploadCloud size={13} className="text-[#FACC15]" />
                        )}
                        <span>{docItem.url ? t('replace', 'Remplacer') : t('upload', 'Téléverser')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-4 pb-12">
            <button 
              onClick={() => handleSave()}
              className="w-full flex items-center justify-center gap-2 py-4 text-white rounded-2xl font-bold transition shadow-sm active:scale-[0.99]"
              style={{ backgroundColor: brandPrimary }}
            >
              <Save size={18} className="text-[#FACC15]" />
              <span>{t('save_changes', 'Enregistrer les modifications')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      {/* Hidden File Input for Image Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handlePhotoUpload} 
      />

      {/* Top Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white shadow-sm z-10 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/delivery')} 
            className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-700 rounded-full hover:bg-slate-100 transition"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-slate-900 text-xl">{t('my_driver_profile', 'Profil Livreur')}</h1>
        </div>
        
        <button 
          onClick={() => setIsEditingBasic(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border"
          style={{ 
            backgroundColor: `${brandPrimary}10`, 
            color: brandPrimary, 
            borderColor: `${brandPrimary}25` 
          }}
        >
          <Edit2 size={14} />
          <span>{t('edit', 'Modifier')}</span>
        </button>
      </div>

      {/* Main Profile Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-xl mx-auto w-full">
        {/* Profile Card with Photo & Main Info */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden">
          {/* Avatar Container with Upload Trigger */}
          <div className="relative group mb-3">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-100 bg-slate-100 shadow-sm relative">
              {driver?.photoURL || driver?.photoUrl || auth.currentUser?.photoURL ? (
                <img 
                  src={driver?.photoURL || driver?.photoUrl || auth.currentUser?.photoURL || ''} 
                  alt="Livreur" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                  <User size={42} className="text-slate-400" />
                </div>
              )}

              {/* Uploading Spinner Overlay */}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                  <Loader2 size={24} className="animate-spin text-[#FACC15]" />
                  <span className="text-[10px] font-bold mt-1">Upload...</span>
                </div>
              )}
            </div>

            {/* Edit Photo Trigger Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              title={t('change_photo', 'Changer la photo de profil')}
              className="absolute bottom-1 right-1 w-9 h-9 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
              style={{ backgroundColor: brandPrimary }}
            >
              <Camera size={16} className="text-[#FACC15]" />
            </button>
          </div>

          {/* Photo Action Buttons */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="text-xs font-bold flex items-center gap-1 px-3 py-1 rounded-full border transition"
              style={{ 
                backgroundColor: `${brandPrimary}08`, 
                color: brandPrimary, 
                borderColor: `${brandPrimary}20` 
              }}
            >
              <Camera size={12} />
              <span>{driver?.photoURL ? t('change_photo', 'Changer la photo') : t('add_photo', 'Ajouter une photo')}</span>
            </button>

            {(driver?.photoURL || driver?.photoUrl) && (
              <button
                onClick={handleRemovePhoto}
                disabled={uploadingPhoto}
                className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 bg-red-50 px-2.5 py-1 rounded-full border border-red-100"
                title={t('remove_photo', 'Supprimer')}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Name & Real Contact Info */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-bold text-slate-900 text-xl">
                {driver?.name || auth.currentUser?.displayName || t('unnamed_driver', 'Livreur')}
              </h2>
              <button 
                onClick={() => setIsEditingBasic(true)}
                className="text-slate-400 hover:text-slate-700 p-1 transition"
                title={t('edit_name', 'Modifier le nom')}
              >
                <Edit2 size={15} />
              </button>
            </div>

            <p className="text-sm font-medium text-slate-500 flex items-center justify-center gap-1.5">
              <Phone size={13} className="text-slate-400" />
              <span>{driver?.phoneNumber || driver?.phone || t('no_phone_configured', 'Téléphone non configuré')}</span>
            </p>

            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Mail size={13} className="text-slate-400" />
              <span>{driver?.email || auth.currentUser?.email}</span>
            </p>

            {driver?.operatingZone ? (
              <p className="text-xs font-medium text-slate-600 flex items-center justify-center gap-1 pt-1">
                <MapPin size={13} style={{ color: brandPrimary }} />
                <span>Zone : {driver.operatingZone}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 italic pt-1">
                {t('no_zone_set', 'Aucune zone définie • Cliquer sur modifier')}
              </p>
            )}
          </div>

          {/* KYC Status Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-50 border-slate-200">
            <ShieldCheck size={14} style={{ color: brandPrimary }} />
            <span className="text-slate-800">
              {driver?.kyc_status === 'approved' 
                ? t('verified_driver', 'Livreur Vérifié') 
                : t('kyc_under_review', 'Validation KYC en cours')}
            </span>
          </div>
        </div>

        {/* Real Dynamic Stats Computed from Orders */}
        <div className="grid grid-cols-2 gap-4">
          {/* 1. Completed Deliveries */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              {t('completed_deliveries', 'Courses effectuées')}
            </p>
            <p className="font-extrabold text-slate-900 text-2xl">
              {stats.completedCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {stats.activeCount > 0 ? `${stats.activeCount} en cours` : 'Livraisons terminées'}
            </p>
          </div>
          
          {/* 2. Real Satisfaction Rating */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 text-center shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              {t('satisfaction_rating', 'Note de satisfaction')}
            </p>
            {stats.averageRating !== null ? (
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-1">
                  <p className="font-extrabold text-slate-900 text-2xl">{stats.averageRating}</p>
                  <span className="text-[#FACC15] text-lg font-bold">★</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {stats.totalReviewsCount} {stats.totalReviewsCount > 1 ? 'avis reçus' : 'avis reçu'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <p className="font-bold text-slate-700 text-base">{t('new_account', 'Nouveau')}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">0 évaluation</p>
              </div>
            )}
          </div>
        </div>

        {/* Real Cumulative Earnings Banner */}
        {stats.totalEarnings > 0 && (
          <div className="bg-white rounded-3xl p-4.5 px-5 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${brandPrimary}12`, color: brandPrimary }}
              >
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {t('total_earnings_delivered', 'Revenus de livraison cumulés')}
                </p>
                <p className="font-bold text-slate-900 text-base">
                  {formatCurrency(stats.totalEarnings)}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              {stats.completedCount} courses
            </span>
          </div>
        )}

        {/* Real Vehicle Badge Preview */}
        <div 
          onClick={() => openMenu('vehicle_details')}
          className="text-white rounded-3xl p-4.5 px-5 shadow-sm flex items-center justify-between cursor-pointer hover:opacity-95 transition"
          style={{ backgroundColor: brandPrimary }}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center text-[#FACC15]">
              {driver?.vehicleType === 'car' ? <Car size={22} /> : <Bike size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#FACC15] uppercase tracking-wider">
                  {driver?.vehicleType === 'car' 
                    ? t('car', 'Voiture') 
                    : (driver?.vehicleType === 'bicycle' ? t('bicycle', 'Vélo') : t('motorcycle', 'Moto'))}
                </span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md font-mono font-bold tracking-widest uppercase">
                  {driver?.vehiclePlate || t('no_plate', 'NON IMMATRICULÉ')}
                </span>
              </div>
              <p className="text-sm font-semibold text-white/90 mt-0.5">
                {driver?.vehicleModel || t('configure_vehicle', 'Cliquer pour renseigner le modèle')}
              </p>
            </div>
          </div>
          <Edit2 size={16} className="text-white/70" />
        </div>

        {/* Account Configuration Menu List */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider px-1">
            {t('account_management', 'Gestion du compte & Paramètres')}
          </h3>
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {/* 1. Modify Personal Info */}
            <div 
              onClick={() => setIsEditingBasic(true)}
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('personal_info', 'Informations personnelles')}</p>
                  <p className="text-xs text-slate-500">
                    {driver?.name ? `${driver.name} • ${driver.phoneNumber || 'Téléphone non configuré'}` : 'Nom, téléphone, zone de travail'}
                  </p>
                </div>
              </div>
              <Edit2 size={16} className="text-slate-400" />
            </div>

            {/* 2. Vehicle Details */}
            <div 
              onClick={() => openMenu('vehicle_details')} 
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandPrimary}12`, color: brandPrimary }}
                >
                  <Car size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('vehicle_details', 'Véhicule de livraison')}</p>
                  <p className="text-xs text-slate-500">
                    {driver?.vehiclePlate ? `${driver.vehicleType || 'Véhicule'} • ${driver.vehiclePlate}` : t('configure_vehicle', 'Configurer le véhicule')}
                  </p>
                </div>
              </div>
              <Edit2 size={16} className="text-slate-400" />
            </div>
            
            {/* 3. Payout Methods */}
            <div 
              onClick={() => openMenu('payout_methods')} 
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('payout_methods', 'Compte de retrait & Revenus')}</p>
                  <p className="text-xs text-slate-500">
                    {driver?.payoutOperator || driver?.bankName ? `${driver.payoutOperator || driver.bankName} (${driver.accountNumber || 'Numéro'})` : t('add_payout_account', 'Ajouter un compte de retrait')}
                  </p>
                </div>
              </div>
              <Edit2 size={16} className="text-slate-400" />
            </div>

            {/* 4. Documents & KYC */}
            <div 
              onClick={() => openMenu('driver_documents')} 
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('driver_documents', 'Documents & Permis (KYC)')}</p>
                  <p className="text-xs text-slate-500">
                    {driver?.licenseDocUrl ? t('documents_provided', 'Documents téléversés') : t('upload_missing_docs', 'Permis, CNI, Attestation')}
                  </p>
                </div>
              </div>
              <ShieldCheck size={16} style={{ color: brandPrimary }} />
            </div>
            
            {/* 5. Working Hours */}
            <div 
              onClick={() => openMenu('working_hours')} 
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-sky-50 text-sky-700 rounded-2xl flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('working_hours', 'Horaires de service')}</p>
                  <p className="text-xs text-slate-500">
                    {driver?.workStartTime ? `${driver.workStartTime} - ${driver.workEndTime}` : '08:00 - 20:00'}
                  </p>
                </div>
              </div>
              <Edit2 size={16} className="text-slate-400" />
            </div>
          </div>

          {/* Preferences & Security */}
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider px-1 pt-2">
            {t('preferences_and_security', 'Sécurité & Préférences')}
          </h3>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {/* Language */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center">
                  <Globe size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('language', 'Langue de l\'application')}</p>
                </div>
              </div>
              <select 
                value={i18n.language} 
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-slate-50 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none border border-slate-200 cursor-pointer"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
            
            {/* Password / Security */}
            <div 
              onClick={() => setShowPasswordModal(true)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-rose-50 text-rose-700 rounded-2xl flex items-center justify-center">
                  <Lock size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t('change_password', 'Changer de mot de passe')}</p>
                  <p className="text-xs text-slate-500">{t('secure_your_account', 'Sécurisez vos accès')}</p>
                </div>
              </div>
              <Key size={16} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="pt-2 pb-20">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-700 rounded-2xl font-bold hover:bg-red-100 transition active:scale-[0.99]"
          >
            <LogOut size={18} />
            <span>{t('logout', 'Se déconnecter')}</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: Edit Basic Profile (Name, Phone, Operating Zone, Bio) */}
      {isEditingBasic && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${brandPrimary}15`, color: brandPrimary }}
                >
                  <User size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {t('edit_profile_info', 'Modifier mes informations')}
                </h3>
              </div>
              <button 
                onClick={() => setIsEditingBasic(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('full_name', 'Nom complet')} *
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name || ''} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  placeholder={t('eg_driver_name', 'ex: Jean Dupont')}
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:bg-white transition"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('phone_number', 'Numéro de téléphone')} *
                </label>
                <input 
                  type="tel" 
                  required
                  value={formData.phoneNumber || formData.phone || ''} 
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value, phone: e.target.value })} 
                  placeholder="+237 6XX XX XX XX"
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-bold text-sm outline-none focus:bg-white transition"
                />
              </div>

              {/* Operating Zone / City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('city', 'Ville')}
                  </label>
                  <input 
                    type="text" 
                    value={formData.city || ''} 
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })} 
                    placeholder="Douala"
                    className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('operating_zone', 'Secteur principal')}
                  </label>
                  <input 
                    type="text" 
                    value={formData.operatingZone || ''} 
                    onChange={(e) => setFormData({ ...formData, operatingZone: e.target.value })} 
                    placeholder="Akwa, Bonanjo"
                    className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Bio / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('bio_short', 'Phrase de présentation')}
                </label>
                <textarea 
                  rows={2}
                  value={formData.bio || ''} 
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })} 
                  placeholder={t('driver_bio_placeholder', 'Coursier express, disponible pour livraisons...')}
                  className="w-full border border-slate-200 rounded-2xl p-3 bg-slate-50 text-slate-900 font-medium text-xs outline-none focus:bg-white transition resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBasic(false)}
                  className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition"
                >
                  {t('cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm transition shadow-sm"
                  style={{ backgroundColor: brandPrimary }}
                >
                  {t('save', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Password */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
                  <Lock size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {t('change_password', 'Changer de mot de passe')}
                </h3>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('new_password', 'Nouveau mot de passe')}
                </label>
                <div className="relative">
                  <input 
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className="w-full border border-slate-200 rounded-2xl p-3.5 pr-11 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('confirm_new_password', 'Confirmer le mot de passe')}
                </label>
                <input 
                  type={showPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full border border-slate-200 rounded-2xl p-3.5 bg-slate-50 text-slate-900 font-medium text-sm outline-none focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3.5 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition"
                >
                  {t('cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: brandPrimary }}
                >
                  {updatingPassword && <Loader2 size={16} className="animate-spin text-[#FACC15]" />}
                  <span>{t('save', 'Valider')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
