import { Bell, Map, Settings, Tag, Shield, FileText, Database, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AdminSettings() {
  const navigate = useNavigate();
  const sections = [
    { title: "Delivery Zones & Maps", icon: Map, color: "text-blue-600", bg: "bg-blue-50", desc: "Manage service regions, surge zones", path: "/admin/settings/delivery-zones" },
    { title: "Promotions & Campaigns", icon: Tag, color: "text-pink-600", bg: "bg-pink-50", desc: "Coupons, global discounts", path: "/admin/settings/promotions" },
    { title: "Audit & Security Logs", icon: Database, color: "text-purple-600", bg: "bg-purple-50", desc: "View system audit trail, API logs", path: "/admin/audit" },
    { title: "Compliance & Legal", icon: FileText, color: "text-orange-600", bg: "bg-orange-50", desc: "TOS updates, standard contracts", path: "/admin/settings/compliance" },
    { title: "Security & Roles", icon: Shield, color: "text-green-600", bg: "bg-green-50", desc: "Admin permissions, 2FA settings", path: "/admin/settings/security" },
    { title: "Theme & Visuals", icon: Palette, color: "text-teal-600", bg: "bg-teal-50", desc: "App colors, dashboard texts", path: "/admin/settings/theme" },
    { title: "Global Settings", icon: Settings, color: "text-gray-600", bg: "bg-gray-100", desc: "App maintenance mode, localization", path: "/admin/settings/global" },
  ];

  return (
    <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-hidden">
      <div className="bg-white px-8 pt-6 pb-6 shadow-sm z-10 border-b border-gray-200 shrink-0">
         <h1 className="font-bold text-gray-900 text-2xl mb-1">System Settings</h1>
         <p className="text-gray-500 text-sm">Platform configuration and logs</p>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl space-y-4">
         {sections.map((sec, i) => {
            const Icon = sec.icon;
            return (
               <div 
                 key={i} 
                 onClick={() => sec.path && navigate(sec.path)}
                 className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition"
               >
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${sec.bg} ${sec.color}`}>
                        <Icon size={24} />
                     </div>
                     <div>
                        <h3 className="font-bold text-gray-900 text-sm">{sec.title}</h3>
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
