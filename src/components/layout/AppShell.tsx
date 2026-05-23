import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin') || pathname === '/admin-login';
  const { isImpersonating, stopImpersonating, user } = useAuth();
  const navigate = useNavigate();

  const handleStop = () => {
    stopImpersonating();
    navigate('/admin');
  };

  const renderBanner = () => {
    if (!isImpersonating) return null;
    return (
      <div className="bg-red-500 text-white text-xs font-bold py-2 px-4 shadow flex items-center justify-between shrink-0 z-50 absolute top-0 w-full left-0">
        <span>Viewing as: {user?.email || 'User'}</span>
        <button onClick={handleStop} className="bg-white dark:bg-zinc-950/20 hover:bg-white dark:bg-zinc-950/30 px-3 py-1 rounded transition">Stop Impersonating</button>
      </div>
    );
  };

  if (isAdmin) {
    return (
      <div className="w-full h-screen font-sans overflow-hidden bg-[#F0F5F2] dark:bg-slate-900 relative">
        {renderBanner()}
        <div className={`w-full h-full flex flex-col ${isImpersonating ? 'pt-8' : ''}`}>
           {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
      <div className="w-full h-[100dvh] bg-white dark:bg-slate-900 sm:max-w-[400px] sm:h-[850px] sm:rounded-[3rem] sm:border-[12px] sm:border-slate-800 dark:sm:border-slate-800 overflow-hidden relative shadow-2xl flex flex-col transition-colors duration-200">
        {renderBanner()}
        <div className={`w-full h-full flex flex-col ${isImpersonating ? 'pt-8' : ''} overflow-hidden`}>
           {children}
        </div>
      </div>
    </div>
  );
}
