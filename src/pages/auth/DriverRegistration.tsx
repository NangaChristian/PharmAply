import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCircle, Car, FileText, CheckCircle, Upload } from 'lucide-react';
import { auth, db, storage } from '../../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from '../../lib/firebase';

import { handleFirestoreError, OperationType } from '../../lib/firestore_error';
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";

export function DriverRegistration() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    vehicleType: 'motorcycle',
    vehiclePlate: ''
  });

  const [files, setFiles] = useState<{ idCard: File | null; drivingLicense: File | null }>({
    idCard: null,
    drivingLicense: null
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'idCard' | 'drivingLicense') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.idCard || !files.drivingLicense) {
      setError('Please upload all required KYC documents.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let user;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        user = userCredential.user;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use' || authErr.message?.includes('email-already-in-use')) {
          // Try to sign in instead to resume registration
          try {
            const signInCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            user = signInCredential.user;
          } catch (signInErr: any) {
            throw new Error("This email is already registered, but password was incorrect. Please log in first.");
          }
        } else {
          throw authErr;
        }
      }

      let idCardUrl = '';
      let drivingLicenseUrl = '';

      if (files.idCard) {
        try {
          const fileRef = ref(storage, `kyc/${user.uid}/idCard_${files.idCard.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, files.idCard);
          idCardUrl = await getDownloadURL(uploadTask.ref);
        } catch (storageErr) {
          console.error("Storage upload failed", storageErr);
          throw storageErr;
        }
      }

      if (files.drivingLicense) {
        try {
          const fileRef = ref(storage, `kyc/${user.uid}/drivingLicense_${files.drivingLicense.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, files.drivingLicense);
          drivingLicenseUrl = await getDownloadURL(uploadTask.ref);
        } catch (storageErr) {
          console.error("Storage upload failed", storageErr);
          throw storageErr;
        }
      }

      try {
        console.log("Writing user doc:", { email: formData.email, name: formData.fullName, role: 'driver', status: 'pending_verification', createdAt: "serverTimestamp" });
        await setDoc(doc(db, 'users', user.uid), {
          email: formData.email,
          name: formData.fullName,
          role: 'driver',
          status: 'pending_verification',
          createdAt: serverTimestamp()
        });
        console.log("User doc written successfully");
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }

      try {
        console.log("Writing driver doc:", { ...formData, idCardUrl, drivingLicenseUrl, status: 'pending_verification', createdAt: "serverTimestamp", isAvailable: false });
        await setDoc(doc(db, 'drivers', user.uid), {
          userId: user.uid,
          name: formData.fullName,
          phoneNumber: formData.phoneNumber,
          vehicleType: formData.vehicleType,
          vehiclePlate: formData.vehiclePlate,
          idCardUrl: idCardUrl,
          drivingLicenseUrl: drivingLicenseUrl,
          status: 'pending_verification',
          createdAt: serverTimestamp(),
          isAvailable: false
        });
        console.log("Driver doc written successfully");
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `drivers/${user.uid}`);
      }

      toast.success("Registration submitted successfully!");
      setStep(4); // Success step
    } catch (err: any) {
       console.error("Registration error:", err);
       let errMsg = err.message || 'Failed to register. Please try again.';
       if (err.code === 'auth/email-already-in-use' || errMsg.includes('email-already-in-use')) {
         errMsg = "This email is already registered. Please log in instead.";
       }
       setError(errMsg);
       toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10 flex items-center gap-4">
        <button onClick={() => step > 1 && step < 4 ? prevStep() : navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="font-bold text-gray-900 text-lg"> {t('driver_registration', 'Driver Registration')} </h1>
      </div>

      <div className="flex-1 overflow-y-auto w-full flex flex-col pt-6 pb-20">
         {/* Step Indicator */}
         {step < 4 && (
            <div className="flex items-center justify-center gap-2 mb-8 px-6">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {s}
                  </div>
                  {s < 3 && <div className={`w-10 h-1 rounded-full mx-1 ${step > s ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>}
                </div>
              ))}
            </div>
         )}
         
         <div className="bg-white mx-6 p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            {error && (
              <div className="p-3 mb-4 bg-red-100 text-red-700 text-sm rounded-xl">
                {error}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><UserCircle size={24} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg"> {t('account_details', 'Account Details')} </h2>
                    <p className="text-xs text-gray-500"> {t('basic_information', 'Basic information')} </p>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1"> {t('email_address', 'Email Address')} </label>
                   <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder={t('driver_example_com', 'driver@example.com')} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1"> {t('password', 'Password')} </label>
                   <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="••••••••" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1"> {t('full_name', 'Full Name')} </label>
                   <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder={t('john_doe', 'John Doe')} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1"> {t('phone_number', 'Phone Number')} </label>
                   <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder={t('237_6xx_xxx_xxx', '+237 6XX XXX XXX')} />
                </div>
                
                <button onClick={nextStep} disabled={!formData.email || !formData.password || !formData.fullName || !formData.phoneNumber} className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition"> {t('continue', 'Continue')} </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Car size={24} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg"> {t('vehicle_information', 'Vehicle Information')} </h2>
                    <p className="text-xs text-gray-500"> {t('transportation_details', 'Transportation details')} </p>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1"> {t('vehicle_type', 'Vehicle Type')} </label>
                   <select name="vehicleType" value={formData.vehicleType} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none">
                     <option value="motorcycle"> {t('motorcycle', 'Motorcycle')} </option>
                     <option value="car"> {t('car', 'Car')} </option>
                     <option value="van"> {t('van', 'Van')} </option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1"> {t('vehicle_plate_number', 'Vehicle Plate Number')} </label>
                   <input type="text" name="vehiclePlate" value={formData.vehiclePlate} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder={t('e_g_ce_1234_a', 'e.g. CE-1234-A')} />
                </div>
                
                <button onClick={nextStep} disabled={!formData.vehiclePlate} className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition"> {t('continue_to_kyc', 'Continue to KYC')} </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><FileText size={24} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg"> {t('kyc_verification', 'KYC & Verification')} </h2>
                    <p className="text-xs text-gray-500"> {t('official_documents', 'Official Documents')} </p>
                  </div>
                </div>
                
                <div className="pt-2">
                   <p className="block text-sm font-medium text-gray-700 mb-2">Upload National ID Card (CNI)</p>
                   <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition">
                      <Upload size={24} className="mb-2 text-indigo-400" />
                      <span className="text-xs font-medium text-center">
                        {files.idCard ? files.idCard.name : 'Tap to upload Front of ID Card'}
                      </span>
                      <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={(e) => handleFileChange(e, 'idCard')} />
                   </label>
                </div>

                <div className="pt-2">
                   <p className="block text-sm font-medium text-gray-700 mb-2"> {t('upload_driving_license', 'Upload Driving License')} </p>
                   <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition">
                      <Upload size={24} className="mb-2 text-indigo-400" />
                      <span className="text-xs font-medium text-center">
                        {files.drivingLicense ? files.drivingLicense.name : 'Tap to upload Driving License'}
                      </span>
                      <input type="file" className="hidden" accept="image/jpeg,image/png" onChange={(e) => handleFileChange(e, 'drivingLicense')} />
                   </label>
                </div>
                
                <button onClick={handleSubmit} disabled={loading || !files.idCard || !files.drivingLicense} className="w-full py-4 mt-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex justify-center items-center gap-2">
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col items-center justify-center text-center py-8 space-y-4 animate-in zoom-in-95">
                 <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={40} className="fill-current text-white" />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-900"> {t('application_submitted', 'Application Submitted!')} </h2>
                 <p className="text-gray-500 max-w-xs"> {t('your_driver_registration_is_un', 'Your driver registration is under review. Our team will verify your KYC documents and vehicle information shortly.')} </p>
                 <button onClick={() => navigate('/delivery')} className="w-full py-4 mt-8 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">
                     {t('go_to_dashboard', 'Go to Dashboard')} </button>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
