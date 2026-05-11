import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin') || pathname === '/admin-login';

  if (isAdmin) {
    return (
      <div className="w-full h-screen font-sans overflow-hidden bg-[#F0F5F2]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
      <div className="w-full h-[100dvh] bg-white sm:max-w-[400px] sm:h-[850px] sm:rounded-[3rem] sm:border-[12px] sm:border-slate-800 overflow-hidden relative shadow-2xl flex flex-col">
        {children}
      </div>
    </div>
  );
}
