import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { motion, AnimatePresence } from "motion/react";
import { DPMLAlertBanner } from "../DPMLAlerts";

interface RoleLayoutProps {
  role: "patient" | "pharmacist" | "delivery" | "admin";
}

export function RoleLayout({ role }: RoleLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex-1 flex flex-col relative h-full overflow-hidden">
      <div className="z-50 px-4 pt-4 pb-0 max-w-7xl mx-auto w-full">
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
      <BottomNav role={role} />
    </div>
  );
}
