import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../../lib/firebase';
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from '../../lib/firebase';
import { MapPin, AlertCircle } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { useTranslation } from "react-i18next";
import toast from 'react-hot-toast';

export function AdminLogin() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, role, loading: authLoading } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "cashier">("admin");
  const [showLangMenu, setShowLangMenu] = useState(false);

  // If already logged in with appropriate role, redirect
  useEffect(() => {
    if (!authLoading && user && (role === "admin" || role === "cashier")) {
      if (role === "admin") navigate("/admin");
      else navigate("/pharmacist"); // Route cashier to pharmacist for now
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("adminRememberEmail");
    const savedPassword = localStorage.getItem("adminRememberPassword");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
      if (savedPassword) setPassword(savedPassword);
    }
  }, []);

  if (!authLoading && user && (role === "admin" || role === "cashier")) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (signInError: any) {
        // If sign in fails and it's the admin email, attempt to create it.
        // It's possible the user does not exist yet.
        const isAuthError = signInError.code === 'auth/invalid-credential' 
                         || signInError.code === 'auth/user-not-found'
                         || signInError.message?.includes('Invalid login credentials');
                         
        if (email === 'admin@pharmaply.com' && isAuthError) {
           try {
              userCredential = await createUserWithEmailAndPassword(auth, email, password);
           } catch (createError: any) {
              if (createError.code === 'auth/email-already-in-use' || createError.message?.includes('already registered')) {
                 // The account exists, so the password was actually wrong
                 throw new Error("Invalid password.");
              }
              throw createError;
           }
        } else {
           throw signInError;
        }
      }
      
      const isAppAdmin = userCredential.user.email === 'admin@pharmaply.com';
      
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
         if (isAppAdmin) {
            await setDoc(userDocRef, {
              email: userCredential.user.email,
              name: 'Master Admin',
              role: 'admin', 
              createdAt: serverTimestamp(),
            });
            toast.success("Successfully logged in as Master Admin");
            // Let auth provider handle redirect
         } else {
            await signOut(auth);
            toast.error("Cannot find user record. Please register first.");
            setError("Cannot find user record. Please register first.");
         }
      } else {
         const uRole = isAppAdmin ? 'admin' : userDoc.data().role;
         if (selectedRole === 'admin' && uRole !== 'admin') {
            await signOut(auth);
            toast.error("You do not have Admin privileges.");
            setError("You do not have Admin privileges.");
         } else if (selectedRole === 'cashier' && uRole !== 'cashier' && uRole !== 'admin' && uRole !== 'pharmacy') {
            await signOut(auth);
            toast.error("You do not have Cashier privileges.");
            setError("You do not have Cashier privileges.");
         } else {
           if (rememberMe) {
             localStorage.setItem("adminRememberEmail", email);
             localStorage.setItem("adminRememberPassword", password);
           } else {
             localStorage.removeItem("adminRememberEmail");
             localStorage.removeItem("adminRememberPassword");
           }
           toast.success("Successfully logged in!");
         }
         // Otherwise, allow authentication to succeed and AuthProvider to navigate
      }
    } catch (err: any) {
      const isAuthErr = err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.message?.includes('Invalid login credentials');
      if (err.code === "auth/unverified-email") {
         toast.error("Email not confirmed. Please check the create-admin.sql file.");
         setError("Email not confirmed. Please run the create-admin.sql script in your Supabase SQL Editor to verify the admin account.");
      } else if (isAuthErr) {
        toast.error("Invalid credentials.");
        setError("Invalid credentials.");
      } else {
        toast.error(err.message || "Failed to sign in");
        setError(err.message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = (lang: string) => {
    i18n.changeLanguage(lang);
    setShowLangMenu(false);
  };

  return (
    <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[2rem] shadow-xl flex overflow-hidden relative">
      {/* Left Panel */}
      <div className="hidden md:flex w-1/2 bg-teal-900 relative flex-col justify-between p-12 overflow-hidden">
        {/* Abstract Shapes */}
        <div className="absolute top-[-10%] right-[-10%] w-[120%] h-[120%] rounded-full border-[120px] border-teal-800/40 pointer-events-none"></div>
        <div className="absolute bottom-[-30%] left-[-20%] w-[150%] h-[150%] rounded-full border-[100px] border-teal-800/30 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white mb-16">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center">
              <MapPin size={18} className="text-teal-900" />
            </div>
            <span className="font-bold text-2xl tracking-tight">{t("app_name")}</span>
          </div>

          <h1 className="text-4xl text-white font-bold leading-tight max-w-sm">
            {t("slogan")}
          </h1>
        </div>

        <div className="relative z-10">
          <p className="text-teal-100/60 text-sm font-medium">{t("terms")}  {t('nbsp_nbsp', '&nbsp;|&nbsp;')} {t("privacy")}</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-8">
        {/* Language selector */}
        <div className="absolute top-8 right-8 z-20">
           <div className="relative">
             <button 
               onClick={() => setShowLangMenu(!showLangMenu)}
               className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium text-gray-700 shadow-sm"
             >
                <span className="text-gray-400">文A</span> 
                {i18n.language === 'fr' ? 'Français' : 'English'} 
                <span className="text-gray-400 text-[10px]">▼</span>
             </button>
             {showLangMenu && (
               <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-zinc-950 rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
                 <button onClick={() => toggleLang('en')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700"> {t('english', 'English')} </button>
                 <button onClick={() => toggleLang('fr')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700"> {t('fran_ais', 'Français')} </button>
               </div>
             )}
           </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 block">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t("admin_welcome")}</h2>
            <p className="text-gray-500 text-sm mb-6">{t("admin_role_select")}</p>
            
            {/* Role Switcher */}
            <div className="flex bg-gray-50 dark:bg-zinc-900 p-1.5 rounded-xl border border-gray-100 mb-8">
               <button 
                 onClick={() => setSelectedRole("admin")}
                 className={`flex-1 font-bold py-2.5 rounded-lg text-sm transition ${selectedRole === "admin" ? "bg-teal-100 text-teal-900 border border-teal-200" : "text-gray-500 hover:bg-gray-100 dark:bg-zinc-800"}`}
               >
                 {t("admin_role_admin")}
               </button>
               <button 
                 onClick={() => setSelectedRole("cashier")}
                 className={`flex-1 font-bold py-2.5 rounded-lg text-sm transition ${selectedRole === "cashier" ? "bg-teal-100 text-teal-900 border border-teal-200" : "text-gray-500 hover:bg-gray-100 dark:bg-zinc-800"}`}
               >
                 {t("admin_role_cashier")}
               </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-start gap-2 text-sm border border-red-100">
                 <AlertCircle size={16} className="mt-0.5 shrink-0" />
                 <p>{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">{t("email")}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f8f9fa] border border-gray-200 py-3 px-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none transition"
                placeholder={t('admin_example_com', 'admin@example.com')}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-900 dark:text-white mb-2">{t("password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#f8f9fa] border border-gray-200 py-3 px-4 rounded-xl text-sm focus:ring-2 focus:ring-teal-600 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
              />
              <label htmlFor="rememberMe" className="text-sm font-medium text-gray-700"> {t('remember_me', 'Remember me')} </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-800 hover:bg-teal-900 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 mt-4"
            >
              {loading ? t("verifying") : t("login_btn")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
