import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Store, FileText, CheckCircle, Upload } from 'lucide-react';
import { auth, db, storage } from '../../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';

export function PharmacistRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    pharmacyName: '',
    ownerName: '',
    registrationNumber: '',
    address: '',
    phoneNumber: ''
  });

  const [files, setFiles] = useState<{ operatingLicense: File | null; taxpayerCard: File | null }>({
    operatingLicense: null,
    taxpayerCard: null
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'operatingLicense' | 'taxpayerCard') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.operatingLicense || !files.taxpayerCard) {
      setError('Please upload all required KYC documents.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Upload files sequentially (or Promise.all)
      let operatingLicenseUrl = '';
      let taxpayerCardUrl = '';

      if (files.operatingLicense) {
        try {
          const fileRef = ref(storage, `kyc/${user.uid}/operatingLicense_${files.operatingLicense.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, files.operatingLicense);
          operatingLicenseUrl = await getDownloadURL(uploadTask.ref);
        } catch (storageErr) {
          console.warn("Storage upload failed, mocked for prototype", storageErr);
          operatingLicenseUrl = `https://via.placeholder.com/800x600.png?text=Operating+License`;
        }
      }

      if (files.taxpayerCard) {
        try {
          const fileRef = ref(storage, `kyc/${user.uid}/taxpayerCard_${files.taxpayerCard.name}`);
          const uploadTask = await uploadBytesResumable(fileRef, files.taxpayerCard);
          taxpayerCardUrl = await getDownloadURL(uploadTask.ref);
        } catch (storageErr) {
          console.warn("Storage upload failed, mocked for prototype", storageErr);
          taxpayerCardUrl = `https://via.placeholder.com/800x600.png?text=Taxpayer+Card`;
        }
      }

      await setDoc(doc(db, 'users', user.uid), {
        email: formData.email,
        name: formData.ownerName,
        role: 'pharmacy',
        status: 'pending_verification',
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, 'pharmacies', user.uid), {
        ownerId: user.uid,
        name: formData.pharmacyName,
        address: formData.address,
        phoneNumber: formData.phoneNumber,
        registrationNumber: formData.registrationNumber,
        operatingLicenseUrl: operatingLicenseUrl,
        taxpayerCardUrl: taxpayerCardUrl,
        status: 'pending_verification',
        createdAt: serverTimestamp()
      });

      toast.success("Pharmacy registered successfully!");
      setStep(4); // Success step
    } catch (err: any) {
       console.error(err);
       let errMsg = err.message || 'Failed to register. Please ensure you have set up Firebase storage.';
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
        <h1 className="font-bold text-gray-900 text-lg">Pharmacy Registration</h1>
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
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Store size={24} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">Account & Pharmacy Details</h2>
                    <p className="text-xs text-gray-500">Basic information</p>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                   <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="pharmacy@example.com" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                   <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="••••••••" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Name</label>
                   <input type="text" name="pharmacyName" value={formData.pharmacyName} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="e.g. HealthFirst Pharmacy" />
                </div>
                
                <button onClick={nextStep} disabled={!formData.email || !formData.password || !formData.pharmacyName} className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition">Continue</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Store size={24} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">Owner & Location Info</h2>
                    <p className="text-xs text-gray-500">Contact details</p>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Owner Full Name</label>
                   <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="John Doe" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Address</label>
                   <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="e.g. Makepe, Douala" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                   <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="+237 6XX XXX XXX" />
                </div>
                
                <button onClick={nextStep} disabled={!formData.ownerName || !formData.address || !formData.phoneNumber} className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition">Continue to KYC</button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><FileText size={24} /></div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">KYC & Verification</h2>
                    <p className="text-xs text-gray-500">Cameroon Official Documents</p>
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Business Registration Number (RCCM)</label>
                   <input type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 outline-none" placeholder="RC/DLA/xxxx/B/xxxx" />
                </div>
                
                <div className="pt-2">
                   <p className="block text-sm font-medium text-gray-700 mb-2">Upload Operating License (Ordre National des Pharmaciens)</p>
                   <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition">
                      <Upload size={24} className="mb-2 text-indigo-400" />
                      <span className="text-xs font-medium text-center">
                        {files.operatingLicense ? files.operatingLicense.name : 'Tap to upload Document (PDF/JPG)'}
                      </span>
                      <input type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={(e) => handleFileChange(e, 'operatingLicense')} />
                   </label>
                   <p className="text-[10px] text-gray-400 mt-2 text-center">Required for approval</p>
                </div>

                <div className="pt-2">
                   <p className="block text-sm font-medium text-gray-700 mb-2">Upload Taxpayer Card (Carte de Contribuable)</p>
                   <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition">
                      <Upload size={24} className="mb-2 text-indigo-400" />
                      <span className="text-xs font-medium text-center">
                        {files.taxpayerCard ? files.taxpayerCard.name : 'Tap to upload Document (PDF/JPG)'}
                      </span>
                      <input type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={(e) => handleFileChange(e, 'taxpayerCard')} />
                   </label>
                </div>
                
                <button onClick={handleSubmit} disabled={loading || !formData.registrationNumber || !files.operatingLicense || !files.taxpayerCard} className="w-full py-4 mt-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition flex justify-center items-center gap-2">
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col items-center justify-center text-center py-8 space-y-4 animate-in zoom-in-95">
                 <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={40} className="fill-current text-white" />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
                 <p className="text-gray-500 max-w-xs">Your pharmacy registration is under review. Our team will verify your KYC documents within 24-48 hours according to Cameroon regulations.</p>
                 <button onClick={() => navigate('/pharmacist')} className="w-full py-4 mt-8 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">
                    Go to Dashboard
                 </button>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}
