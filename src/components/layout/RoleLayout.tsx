import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RoleSidebar } from "./RoleSidebar";
import { motion, AnimatePresence } from "motion/react";
import { DPMLAlertBanner } from "../DPMLAlerts";
import { cn } from "../../lib/utils";

interface RoleLayoutProps {
  role: "patient" | "pharmacist" | "delivery" | "admin";
}

export function RoleLayout({ role }: RoleLayoutProps) {
  const location = useLocation();

  return (
    <div className={cn(
       "flex-1 flex flex-col md:flex-row relative h-full overflow-hidden w-full",
       role === 'pharmacist' ? "bg-white dark:bg-slate-900" : ""
    )}>
      {/* Desktop Sidebar */}
      {role === 'pharmacist' && (
        <div className="hidden md:block w-64 lg:w-72 bg-white dark:bg-slate-900 shrink-0">
          <RoleSidebar role={role} />
        </div>
      )}
      
      {/* Main Content Area */}
      <div className={cn(
         "flex-1 flex flex-col relative h-full overflow-hidden w-full mx-auto",
         role === 'pharmacist' ? "bg-[#FAFBFA] dark:bg-slate-950/50 rounded-tl-3xl rounded-bl-3xl" : "md:max-w-7xl"
      )}>
        <div className="z-50 px-4 pt-4 pb-0 w-full">
           <DPMLAlertBanner />
        </div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className={role === 'pharmacist' ? "block md:hidden pb-[env(safe-area-inset-bottom)] shrink-0 bg-white" : "block pb-[env(safe-area-inset-bottom)] shrink-0"}>
          <BottomNav role={role} />
        </div>
      </div>
    </div>
  );
}
