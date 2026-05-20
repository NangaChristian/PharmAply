import { NavLink } from "react-router-dom";
import { Home, ClipboardList, User, Package, Bell, FileText, Settings, History, MapPin, Calendar, ShoppingCart } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useTranslation } from "react-i18next";

interface BottomNavProps {
  role: "patient" | "pharmacist" | "delivery" | "admin";
}

export function BottomNav({ role }: BottomNavProps) {
  const { t } = useTranslation();

  const patientLinks = [
    { to: "/patient", icon: Home, label: t('home', 'Home') },
    { to: "/patient/orders", icon: ClipboardList, label: t('orders', 'Orders') },
    { to: "/patient/calendar", icon: Calendar, label: t('calendar', 'Calendar') },
    { to: "/patient/cart", icon: ShoppingCart, label: t('cart', 'Cart') },
    { to: "/patient/profile", icon: User, label: t('profile', 'Profile') },
  ];

  const pharmacistLinks = [
    { to: "/pharmacist", icon: Home, label: t('home', 'Home') },
    { to: "/pharmacist/orders", icon: ClipboardList, label: t('orders', 'Orders') },
    { to: "/pharmacist/inventory", icon: Package, label: t('inventory', 'Inventory') },
    { to: "/pharmacist/prescriptions", icon: FileText, label: t('prescriptions', 'Prescriptions') },
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
    <div className="h-16 bg-white dark:bg-black border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between px-6 z-50 transition-colors shrink-0">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/patient" || link.to === "/pharmacist" || link.to === "/delivery"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 text-xs transition-colors",
                isActive ? "text-indigo-600 dark:text-white" : "text-gray-400 dark:text-white/40"
              )
            }
          >
            <Icon size={20} strokeWidth={2.5} />
            <span className="font-medium">{link.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}
