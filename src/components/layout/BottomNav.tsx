import { NavLink } from "react-router-dom";
import { Home, ClipboardList, User, Package, Bell, FileText, Settings, History, MapPin, Calendar, ShoppingCart, BarChart2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useTranslation } from "react-i18next";
import { useCart } from "../CartProvider";

interface BottomNavProps {
  role: "patient" | "pharmacist" | "delivery" | "admin";
}

export function BottomNav({ role }: BottomNavProps) {
  const { t } = useTranslation();
  const { cartCount } = useCart();

  const patientLinks = [
    { to: "/patient", icon: Home, label: t('home', 'Home'), badge: 0 },
    { to: "/patient/orders", icon: ClipboardList, label: t('orders', 'Orders'), badge: 0 },
    { to: "/patient/calendar", icon: Calendar, label: t('calendar', 'Calendar'), badge: 0 },
    { to: "/patient/cart", icon: ShoppingCart, label: t('cart', 'Cart'), badge: cartCount },
    { to: "/patient/profile", icon: User, label: t('profile', 'Profile'), badge: 0 },
  ];

  const pharmacistLinks = [
    { to: "/pharmacist", icon: Home, label: t('home', 'Home') },
    { to: "/pharmacist/orders", icon: ClipboardList, label: t('orders', 'Orders') },
    { to: "/pharmacist/inventory", icon: Package, label: t('inventory', 'Inventory') },
    { to: "/pharmacist/reports", icon: BarChart2, label: t('reports', 'Reports') },
    { to: "/pharmacist/profile", icon: User, label: t('profile', 'Profile') },
  ];

  const deliveryLinks = [
    { to: "/delivery", icon: Home, label: t('home', 'Home') },
    { to: "/delivery/history", icon: History, label: t('history', 'History') },
    { to: "/delivery/deliveries", icon: MapPin, label: t('deliveries', 'Deliveries') },
    { to: "/delivery/profile", icon: User, label: t('profile', 'Profile') },
  ];

  const adminLinks = [
    { to: "/admin", icon: Home, label: t('admin_dashboard', "Dashboard") },
    { to: "/admin/users", icon: User, label: t('admin_users', "Users") },
    { to: "/admin/finances", icon: FileText, label: t('admin_finances', "Finances") },
    { to: "/admin/settings", icon: Settings, label: t('admin_settings_menu', "Settings") },
  ];

  const links =
    role === "patient"
      ? patientLinks
      : role === "pharmacist"
      ? pharmacistLinks
      : role === "delivery"
      ? deliveryLinks
      : adminLinks;

  return (
    <div className="h-[4.5rem] bg-white dark:bg-zinc-950/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 flex items-center justify-around px-2 sm:px-6 z-50 pb-[env(safe-area-inset-bottom)] transition-colors shrink-0">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/patient" || link.to === "/pharmacist" || link.to === "/delivery" || link.to === "/admin"}
            className={({ isActive }) =>
              cn(
                "group relative flex flex-col items-center justify-center w-16 h-full transition-all duration-300",
                isActive 
                  ? "text-indigo-600 dark:text-indigo-400" 
                  : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "flex items-center justify-center transition-all duration-300 rounded-2xl relative z-10",
                  isActive ? "h-8 w-14 bg-indigo-50 dark:bg-indigo-500/15 mb-1" : "h-8 w-8 mb-0.5 group-hover:bg-gray-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800"
                )}>
                   <Icon size={isActive ? 20 : 20} strokeWidth={isActive ? 2.5 : 2} className={cn("transition-all duration-300", isActive ? "scale-110" : "scale-100")} />
                   {(link as any).badge > 0 && (
                     <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center rounded-full">
                       {(link as any).badge}
                     </span>
                   )}
                </div>
                <span className={cn(
                  "font-headline transition-all duration-300", 
                  isActive ? "text-[11px] font-semibold tracking-wide" : "text-[10px] font-medium"
                )}>
                  {link.label}
                </span>
                {isActive && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-500 rounded-b-full shadow-[0_2px_8px_rgba(99,102,241,0.5)] opacity-0" />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
