import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { motion, AnimatePresence } from "motion/react";

interface RoleLayoutProps {
  role: "patient" | "pharmacist" | "delivery" | "admin";
}

export function RoleLayout({ role }: RoleLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex-1 flex flex-col relative h-full overflow-hidden">
      <div className="flex-1 overflow-x-hidden overflow-y-auto relative pb-[70px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav role={role} />
    </div>
  );
}
