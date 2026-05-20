import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../../lib/firebase';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from '../../lib/firebase';
import { useTranslation } from "react-i18next";
import { useAuth } from "../../components/AuthProvider";
import toast from 'react-hot-toast';

const ONBOARDING_SLIDES = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=1000",
    titleKey: "title_1",
    subtitleKey: "subtitle_1",
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=1000",
    titleKey: "title_2",
    subtitleKey: "subtitle_2",
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000",
    titleKey: "title_3",
    subtitleKey: "subtitle_3",
  }
];

import { sendEmail } from '../../lib/email';

export function Onboarding() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, role, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showRoleSelect, setShowRoleSelect] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (role === 'admin') navigate("/admin");
      else if (role === 'pharmacy') navigate("/pharmacist");
      else if (role === 'driver') navigate("/delivery");
      else if (role === 'patient') navigate("/patient");
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (step === 0 && !authLoading && (!user || !role)) {
      const timer = setTimeout(() => {
        setStep(1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, authLoading, user, role]);

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleSkip = () => {
    setStep(5);
  };

  const handleRoleSelection = (role: string) => {
    setSelectedRole(role);
    setStep(6);
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorText("");
    try {
      const result: any = await signInWithPopup(auth, googleProvider);
      const userUid = result.user?.uid || result.user?.id || 'google_auth_placeholder';
      const userDocRef = doc(db, 'users', userUid);
      const userDoc = await getDoc(userDocRef);

      const isAppAdmin = result.user?.email === 'admin@pharmaply.com';
      let finalRole = isAppAdmin ? 'admin' : selectedRole;

      if (!userDoc.exists()) {
        if (!selectedRole && !isAppAdmin) {
           toast.error("Account not found. Please sign up first.");
           setErrorText("Account not found. Please sign up first.");
           setLoading(false);
           return;
        }
        const userData: any = {
          email: result.user?.email || 'unknown',
          name: result.user?.displayName || result.user?.email?.split('@')[0] || 'Unknown User',
          role: finalRole,
          createdAt: serverTimestamp(),
        };

        if (finalRole === 'driver') {
          userData.status = 'pending_verification';
        }

        await setDoc(userDocRef, userData);
        toast.success("Successfully signed up!");
      } else {
        const existingRole = userDoc.data()?.role;
        finalRole = isAppAdmin ? 'admin' : existingRole;
        if (selectedRole && existingRole !== selectedRole && existingRole !== 'admin') {
           toast.error("Invalid role for this account.");
           setErrorText("Invalid role for this account.");
           setLoading(false);
           return;
        }
        toast.success("Successfully logged in!");
      }

      if (finalRole === 'admin') navigate("/admin");
      else if (finalRole === 'pharmacy') navigate("/pharmacist");
      else if (finalRole === 'driver') navigate("/delivery");
      else navigate("/patient");

    } catch (error: any) {
      console.error(error);
      let errMsg = error.message || "Authentication failed";
      if (error.code === 'auth/email-already-in-use' || errMsg.includes('email-already-in-use')) {
         errMsg = "This email is already registered. Please log in instead.";
      } else if (error.code === 'auth/network-request-failed' || errMsg.includes('network-request-failed')) {
         errMsg = "Network error. This can happen if third-party cookies are blocked by your browser (e.g. Incognito or Safari). Please open the app in a new tab using the top-right button.";
      }
      toast.error(errMsg);
      setErrorText(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup' && selectedRole === 'pharmacy') {
       navigate("/pharmacist-registration");
       return;
    }
    if (authMode === 'signup' && selectedRole === 'driver') {
       navigate("/driver-registration");
       return;
    }
    
    setLoading(true);
    setErrorText("");

    try {
      let result;
      if (authMode === 'signup') {
        result = await createUserWithEmailAndPassword(auth, email, password);
        const userDocRef = doc(db, 'users', result.user.uid);
        
        const userData: any = {
          email: result.user.email,
          name: name || result.user.email?.split('@')[0],
          role: selectedRole,
          createdAt: serverTimestamp(),
        };

        if (selectedRole === 'driver') {
          userData.status = 'pending_verification';
        }

        await setDoc(userDocRef, userData);
        
        // Send Welcome email
        await sendEmail({
          to: result.user.email,
          subject: "Welcome to Pharmap!",
          html: `<h1>Welcome ${name || 'User'} to Pharmap!</h1><p>We are glad to have you on board. Explore pharmacies around you and order medications with ease.</p>`
        });
        
        toast.success("Successfully signed up!");
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
        const userDocRef = doc(db, 'users', result.user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
           toast.error("Account data not found.");
           setErrorText("Account data not found.");
           setLoading(false);
           return;
         }
         const uRole = result.user.email === 'admin@pharmaply.com' ? 'admin' : userDoc.data()?.role;
         if (uRole !== selectedRole && uRole !== 'admin') {
            toast.error("Invalid role for this account.");
            setErrorText("Invalid role for this account.");
            setLoading(false);
            return;
         }
         toast.success("Successfully logged in!");
      }

      const uRole = result.user.email === 'admin@pharmaply.com' ? 'admin' : selectedRole;
      if (uRole === 'admin') navigate("/admin");
      else if (uRole === 'pharmacy') navigate("/pharmacist");
      else if (uRole === 'driver') navigate("/delivery");
      else navigate("/patient");

    } catch (error: any) {
      console.error(error);
      let errMsg = error.message || "Authentication failed";
      if (error.code === 'auth/email-already-in-use' || errMsg.includes('email-already-in-use')) {
         errMsg = "This email is already registered. Please log in instead.";
      } else if (error.code === 'auth/network-request-failed' || errMsg.includes('network-request-failed')) {
         errMsg = "Network error. This can happen if third-party cookies are blocked by your browser (e.g. Incognito or Safari). Please open the app in a new tab using the top-right button.";
      }
      toast.error(errMsg);
      setErrorText(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const activeSlide = step > 1 && step < 5 ? step - 2 : 0;

  return (
    <div className="flex-1 relative bg-[#6a7bc0] overflow-hidden flex flex-col h-full"> 
       <AnimatePresence>
         {/* Splash Screen */}
         {step === 0 && (
            <motion.div 
               key="splash"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 flex flex-col items-center justify-center bg-[#344fb1] z-50 text-white"
            >
               <div className="flex flex-col items-center">
                  <div className="mb-6 text-white scale-150">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 6a2 2 0 1 0 4 0v12a2 2 0 1 0-4 0z" />
                        <path d="M12 2v2" />
                        <path d="M12 20v2" />
                        <path d="M19.5 7.5c-3-3-7.5-3-7.5 4.5" />
                        <path d="M4.5 16.5c3 3 7.5 3 7.5-4.5" />
                        <path d="M4.5 7.5c3-3 7.5-3 7.5 4.5" />
                        <path d="M19.5 16.5c-3 3-7.5 3-7.5-4.5" />
                     </svg>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">{t('app_name')}</h1>
               </div>
            </motion.div>
         )}

         {/* Language Selection Screen */}
         {step === 1 && (
            <motion.div 
               key="lang-select"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 flex flex-col items-center justify-center bg-[#f8f9fc] z-40 p-6"
            >
               <div className="mb-10 text-[#344fb1] scale-150">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M10 6a2 2 0 1 0 4 0v12a2 2 0 1 0-4 0z" />
                     <path d="M12 2v2" />
                     <path d="M12 20v2" />
                     <path d="M19.5 7.5c-3-3-7.5-3-7.5 4.5" />
                     <path d="M4.5 16.5c3 3 7.5 3 7.5-4.5" />
                     <path d="M4.5 7.5c3-3 7.5-3 7.5 4.5" />
                     <path d="M19.5 16.5c-3 3-7.5 3-7.5-4.5" />
                  </svg>
               </div>
               
               <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('choose_language')}</h2>
               <p className="text-gray-500 mb-10 text-center"> {t('select_your_preferred_language', 'Select your preferred language to get started.')} </p>
               
               <div className="w-full max-w-sm space-y-4">
                  <button
                     onClick={() => { i18n.changeLanguage('en'); setStep(2); }}
                     className="w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-200 border-gray-100 bg-white hover:border-[#344fb1] hover:bg-indigo-50/30"
                  >
                     <div className="flex items-center gap-4">
                        <span className="text-2xl">🇺🇸</span>
                        <span className="font-bold text-gray-900 text-base"> {t('english', 'English')} </span>
                     </div>
                     <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center"></div>
                  </button>
                  
                  <button
                     onClick={() => { i18n.changeLanguage('fr'); setStep(2); }}
                     className="w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-200 border-gray-100 bg-white hover:border-[#344fb1] hover:bg-indigo-50/30"
                  >
                     <div className="flex items-center gap-4">
                        <span className="text-2xl">🇫🇷</span>
                        <span className="font-bold text-gray-900 text-base"> {t('fran_ais', 'Français')} </span>
                     </div>
                     <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center"></div>
                  </button>

                  <button
                     onClick={() => { i18n.changeLanguage('ar'); setStep(2); }}
                     className="w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-200 border-gray-100 bg-white hover:border-[#344fb1] hover:bg-indigo-50/30"
                  >
                     <div className="flex items-center gap-4">
                        <span className="text-2xl">🇦🇪</span>
                        <span className="font-bold text-gray-900 text-base">العربية</span>
                     </div>
                     <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center"></div>
                  </button>
               </div>
            </motion.div>
         )}

         {/* Carousel / Role Selection Background Image */}
         {(step >= 2) && (
            <motion.div 
               key={`slide-bg-${activeSlide}`}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.5 }}
               className="absolute inset-0 bg-[#344fb1] z-0"
            >
               {step < 5 && (
                 <>
                   <img 
                     src={ONBOARDING_SLIDES[activeSlide].image} 
                     alt="Onboarding Background" 
                     className="w-full h-full object-cover opacity-60"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20"></div>
                 </>
               )}
            </motion.div>
         )}
         
         {/* Carousel Content */}
         {(step >= 2 && step < 5) && (
            <motion.div 
               key={`slide-content-${activeSlide}`}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="absolute inset-0 z-10 flex flex-col justify-end p-8 pb-12"
            >
               <h2 className="text-4xl font-bold text-white mb-4 whitespace-pre-line leading-tight">
                  {t(ONBOARDING_SLIDES[activeSlide].titleKey)}
               </h2>
               <p className="text-white/80 text-lg mb-12 max-w-[280px]">
                  {t(ONBOARDING_SLIDES[activeSlide].subtitleKey)}
               </p>

               <div className="flex items-center justify-between w-full">
                  <button onClick={handleSkip} className="text-white/80 font-medium px-2 py-2">
                     {t('skip')}
                  </button>
                  
                  <div className="flex bg-white/20 rounded-full p-1 backdrop-blur-md">
                     <button onClick={handleNext} className="w-14 h-14 bg-white text-gray-900 rounded-full flex items-center justify-center hover:bg-gray-100 transition shadow-lg">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                           <path d="m9 18 6-6-6-6"/>
                        </svg>
                     </button>
                  </div>
                  
                  <div className="flex gap-2 items-center px-4">
                     {ONBOARDING_SLIDES.map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeSlide ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}></div>
                     ))}
                  </div>
               </div>
            </motion.div>
         )}

         {/* Role Selection Screen */}
         {step === 5 && (
            <>
               <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="absolute top-[20%] left-0 right-0 flex flex-col items-center justify-center z-10 text-white"
               >
                  <div className="mb-6 text-white scale-125">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 6a2 2 0 1 0 4 0v12a2 2 0 1 0-4 0z" />
                        <path d="M12 2v2" />
                        <path d="M12 20v2" />
                        <path d="M19.5 7.5c-3-3-7.5-3-7.5 4.5" />
                        <path d="M4.5 16.5c3 3 7.5 3 7.5-4.5" />
                        <path d="M4.5 7.5c3-3 7.5-3 7.5 4.5" />
                        <path d="M19.5 16.5c-3 3-7.5 3-7.5-4.5" />
                     </svg>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">{t('app_name')}</h1>
               </motion.div>

               <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pt-8 pb-12 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]"
               >
                  {errorText && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-xl text-center">
                      {errorText}
                    </div>
                  )}

                  <h3 className="text-center font-bold text-gray-900 mb-6 tracking-wide">{t('select_user_type')}</h3>
                  
                  <div className="space-y-3 px-2">
                     <button
                        onClick={() => handleRoleSelection('patient')}
                        disabled={loading}
                        className="w-full flex items-center justify-center py-4 bg-[#344fb1] text-white rounded-xl font-bold hover:bg-[#2b4198] transition shadow-md shadow-indigo-200 gap-2 disabled:opacity-70"
                     >
                        {t('patient')}
                     </button>
                     
                     <button
                        onClick={() => handleRoleSelection('pharmacy')}
                        disabled={loading}
                        className="w-full flex items-center justify-center py-4 bg-gray-50 border border-gray-100 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition gap-2 disabled:opacity-70"
                     >
                        {t('pharmacist')}
                     </button>

                     <button
                        onClick={() => handleRoleSelection('driver')}
                        disabled={loading}
                        className="w-full flex items-center justify-center py-4 bg-gray-50 border border-gray-100 text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition gap-2 disabled:opacity-70"
                     >
                        {t('delivery')}
                     </button>
                  </div>
               </motion.div>
            </>
         )}

         {/* Email Auth Screen */}
         {step === 6 && (
            <>
               <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-[10%] left-0 right-0 flex flex-col items-center justify-center z-10 text-white"
               >
                  <div className="mb-2 text-white scale-100">
                     <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 6a2 2 0 1 0 4 0v12a2 2 0 1 0-4 0z" />
                        <path d="M12 2v2" />
                        <path d="M12 20v2" />
                        <path d="M19.5 7.5c-3-3-7.5-3-7.5 4.5" />
                        <path d="M4.5 16.5c3 3 7.5 3 7.5-4.5" />
                        <path d="M4.5 7.5c3-3 7.5-3 7.5 4.5" />
                        <path d="M19.5 16.5c-3 3-7.5 3-7.5-4.5" />
                     </svg>
                  </div>
                  <h1 className="text-xl font-bold tracking-tight">{t('app_name')}</h1>
               </motion.div>

               <motion.div 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2rem] p-6 pt-8 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col h-[75vh]"
               >
                  <div className="flex items-center mb-6 relative">
                     <button onClick={() => { setStep(5); setAuthMode('login'); }} className="absolute left-0 p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                           <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                     </button>
                     <h3 className="w-full text-center font-bold text-gray-900 text-lg">
                        {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                     </h3>
                  </div>

                  {errorText && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-xl text-center">
                      {errorText}
                    </div>
                  )}

                  <form onSubmit={handleEmailAuth} className="space-y-4 flex-1 overflow-y-auto px-1">
                     {authMode === 'signup' && (
                        <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1"> {t('full_name', 'Full Name')} </label>
                           <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#344fb1] outline-none transition" placeholder={t('john_doe', 'John Doe')} required />
                        </div>
                     )}
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1"> {t('email_address', 'Email Address')} </label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#344fb1] outline-none transition" placeholder={t('email_example_com', 'email@example.com')} required />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1"> {t('password', 'Password')} </label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#344fb1] outline-none transition" placeholder="••••••••" required minLength={6} />
                     </div>
                     
                     {authMode === 'login' && (
                       <div className="flex justify-end mt-2">
                         <button 
                           type="button" 
                           onClick={() => navigate('/forget-password')} 
                           className="text-sm font-bold text-[#344fb1] hover:underline"
                         >
                            {t('forget_password', 'Forget Password?')} </button>
                       </div>
                     )}

                     <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center py-4 mt-6 bg-[#344fb1] text-white rounded-xl font-bold hover:bg-[#2b4198] transition shadow-md shadow-indigo-200 disabled:opacity-70"
                     >
                        {loading ? 'Processing...' : (authMode === 'login' ? 'Log In' : 'Sign Up')}
                     </button>
                     
                     <div className="relative flex items-center py-4">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-sm"> {t('or_continue_with', 'Or continue with')} </span>
                        <div className="flex-grow border-t border-gray-200"></div>
                     </div>

                     <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={loading}
                        className="w-full flex items-center justify-center py-4 bg-white border border-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-50 transition shadow-sm mt-0 disabled:opacity-70"
                     >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                           <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                           <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                           <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                           <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                         {t('google', 'Google')} </button>
                  </form>

                  <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                     <p className="text-sm text-gray-500">
                        {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                        <button 
                           type="button" 
                           onClick={() => {
                             if (authMode === 'login') {
                               if (selectedRole === 'driver') navigate('/driver-registration');
                               else if (selectedRole === 'pharmacy') navigate('/pharmacist-registration');
                               else setAuthMode('signup');
                             } else {
                               setAuthMode('login');
                             }
                           }}
                           className="ml-2 font-bold text-[#344fb1] hover:underline focus:outline-none"
                        >
                           {authMode === 'login' ? 'Sign Up' : 'Log In'}
                        </button>
                     </p>
                  </div>
               </motion.div>
            </>
         )}
       </AnimatePresence>
    </div>
  );
}
