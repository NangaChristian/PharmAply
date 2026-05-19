import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, MapPin, FileText, Check, Loader2, Hospital } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from '../../lib/firebase';

export function PatientProfileDetails() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    deliveryAddress: '',
    isHealthcareProvider: false,
    professionalLicense: '',
    npiNumber: '',
    clinicName: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        setFormData(prev => ({ ...prev, fullName: auth.currentUser?.displayName || '' }));
        try {
          const d = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (d.exists() && d.data().profileDetails) {
            setFormData(prev => ({ ...prev, ...d.data().profileDetails }));
          }
        } catch (e) {
          console.error(e);
        }
      }
      setInitialLoading(false);
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          profileDetails: formData
        });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
     return <div className="flex-1 flex items-center justify-center dark:bg-black"><Loader2 className="animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-black flex flex-col h-full overflow-hidden transition-colors duration-200">
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-white dark:bg-zinc-900 shadow-sm z-10 border-b border-gray-100 dark:border-zinc-800 transition-colors duration-200">
         <button onClick={() => navigate(-1)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-slate-200 transition">
            <ArrowLeft size={20} />
         </button>
         <h1 className="font-bold text-gray-900 dark:text-white text-xl">Profile & Credentials</h1>
         <div className="w-5"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden p-6 space-y-4">
             <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User size={18} className="text-indigo-500" /> Personal Information
             </h2>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Full Name</label>
                <input 
                   type="text"
                   name="fullName"
                   value={formData.fullName}
                   onChange={handleChange}
                   className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                   placeholder="Your full name"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Contact Number</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={16} className="text-gray-400" />
                   </div>
                   <input 
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                      placeholder="+1 (555) 000-0000"
                   />
                </div>
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden p-6 space-y-4">
             <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin size={18} className="text-indigo-500" /> Delivery Address
             </h2>
             <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Primary Address</label>
                <textarea 
                   name="deliveryAddress"
                   value={formData.deliveryAddress}
                   onChange={handleChange}
                   className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white h-24 resize-none"
                   placeholder="Enter your full delivery address"
                />
             </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden p-6 space-y-4">
             <div className="flex items-center justify-between">
                 <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Hospital size={18} className="text-indigo-500" /> Professional Credentials
                 </h2>
                 <button 
                   onClick={() => setFormData(s => ({ ...s, isHealthcareProvider: !s.isHealthcareProvider }))}
                   className={`w-12 h-6 rounded-full transition-colors relative ${formData.isHealthcareProvider ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
                 >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${formData.isHealthcareProvider ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                 </button>
             </div>
             
             {formData.isHealthcareProvider && (
                 <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-zinc-800">
                     <p className="text-xs text-gray-500 dark:text-gray-400">Please provide your credentials for verification. This allows healthcare providers to order supplies directly.</p>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Clinic / Hospital Name</label>
                        <input 
                           type="text"
                           name="clinicName"
                           value={formData.clinicName}
                           onChange={handleChange}
                           className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                           placeholder="Name of your practice"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Professional License #</label>
                        <input 
                           type="text"
                           name="professionalLicense"
                           value={formData.professionalLicense}
                           onChange={handleChange}
                           className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                           placeholder="License number"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">NPI Number (if applicable)</label>
                        <input 
                           type="text"
                           name="npiNumber"
                           value={formData.npiNumber}
                           onChange={handleChange}
                           className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                           placeholder="National Provider Identifier"
                        />
                     </div>
                 </div>
             )}
          </div>
          
          <div className="h-6"></div>
      </div>
      
      <div className="p-6 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 z-10 shrink-0">
         <button onClick={handleSave} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 
             success ? <><Check size={20} /> Saved Successfully</> : "Save Details"}
         </button>
      </div>
    </div>
  );
}
