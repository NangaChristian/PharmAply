import { Bell, Map, Settings, Tag, Shield, FileText, Database, Palette, DollarSign, Store, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function AdminSettings() {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const sections = [
    { title: "Delivery Zones & Logistics", icon: Map, color: "text-blue-600", bg: "bg-blue-50", desc: "Service areas, shipping rules", path: "/admin/settings/delivery-zones" },
    { title: "Marketing & Promotions", icon: Tag, color: "text-pink-600", bg: "bg-pink-50", desc: "Campaigns, notification templates", path: "/admin/settings/promotions" },
    { title: "Financial & Payments", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50", desc: "Payment gateways, tax, commissions", path: "/admin/settings/financial" },
    { title: "Vendor & Pharmacist", icon: Store, color: "text-indigo-600", bg: "bg-indigo-50", desc: "KYC, licensing requirements", path: "/admin/settings/vendors" },
    { title: "Catalog & Inventory", icon: ShoppingCart, color: "text-cyan-600", bg: "bg-cyan-50", desc: "Pricing rules, substitution config", path: "/admin/settings/catalog" },
    { title: "Audit & Security Logs", icon: Database, color: "text-purple-600", bg: "bg-purple-50", desc: "System audit trail, API logs", path: "/admin/audit" },
    { title: "Compliance & Security Controls", icon: Shield, color: "text-red-600", bg: "bg-red-50", desc: "TOS updates, HIPAA, verification", path: "/admin/settings/compliance" },
    { title: "Security Roles & Access", icon: Shield, color: "text-green-600", bg: "bg-green-50", desc: "Admin permissions, 2FA settings", path: "/admin/settings/security" },
    { title: "Theme & Visuals", icon: Palette, color: "text-teal-600", bg: "bg-teal-50", desc: "App colors, dashboard texts", path: "/admin/settings/theme" },
    { title: "Global Configuration", icon: Settings, color: "text-gray-600", bg: "bg-gray-100 dark:bg-zinc-800", desc: "App maintenance, localization, API keys", path: "/admin/settings/global" },
  ];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white dark:bg-zinc-950 px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 dark:text-white text-2xl mb-1"> {t('system_settings', 'System Settings')} </h1>
         <p className="text-gray-500 text-sm"> {t('platform_configuration_and_log', 'Platform configuration and logs')} </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-4">
         {sections.map((sec, i) => {
            const Icon = sec.icon;
            return (
               <div 
                 key={i} 
                 onClick={() => sec.path && navigate(sec.path)}
                 className="bg-white dark:bg-zinc-950 rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition"
               >
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${sec.bg} ${sec.color}`}>
                        <Icon size={24} />
                     </div>
                     <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{sec.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{sec.desc}</p>
                     </div>
                  </div>
               </div>
            );
         })}
      </div>
    </div>
  );
}
