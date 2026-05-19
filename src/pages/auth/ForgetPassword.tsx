import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from '../../lib/firebase';
import { auth } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { useTranslation } from "react-i18next";

export function ForgetPassword() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
      setIsSent(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full scrollbar-hide">
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm z-10 flex items-center justify-between">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-indigo-900 hover:bg-gray-50 rounded-full transition">
            <ArrowLeft size={24} />
         </button>
         <div className="w-8"></div>
      </div>
      
      <div className="p-6 flex-1 flex flex-col items-center pt-8">
         <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-slate-800 text-center mb-2"> {t('forget_your_password', 'Forget Your Password')} </h1>
            <p className="text-slate-500 text-center text-sm mb-8 px-4">
              {isSent 
                ? "Check your email inbox for instructions to reset your password." 
                : "Please write your email to receive a confirmation link to set a new password."}
            </p>

            {!isSent ? (
               <form onSubmit={handleReset} className="w-full">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('enter_your_email', 'Enter your email')}
                    required
                    className="w-full p-4 border border-slate-200 rounded-xl mb-6 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  
                  <button 
                    type="submit" 
                    disabled={loading || !email}
                    className="w-full bg-indigo-600 text-white rounded-full py-4 font-bold text-lg hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Link'}
                  </button>
               </form>
            ) : (
               <div className="flex flex-col items-center gap-4">
                  <button onClick={() => navigate('/')} className="w-full bg-indigo-600 text-white rounded-full py-4 font-bold text-lg hover:bg-indigo-700 transition">
                     {t('return_to_login', 'Return to Login')} </button>
                  <p className="text-sm text-slate-500">
                      {t('didn_t_get_the_email', 'Didn\'t get the email?')} <button onClick={handleReset} className="text-indigo-600 font-bold hover:underline"> {t('resend_it', 'Resend it.')} </button>
                  </p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
