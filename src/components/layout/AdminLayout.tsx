import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Users, CircleDollarSign, Settings, FileText, LogOut, Package, Search, Bell, Globe, Store, Truck, 
  Pill, Tags, CreditCard, FileBarChart, Ticket, HeadphonesIcon, UserCog, BookText, History, Plus, MessageSquare, Smartphone, Monitor, Folder
} from "lucide-react";
import { auth } from "../../lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "../../components/AuthProvider";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";

export function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, role, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!authLoading && (!user || role !== 'admin')) {
      navigate('/admin-login');
    }
  }, [user, role, authLoading, navigate]);

  if (authLoading || !user || role !== 'admin') {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#F0F5F2]">Loading...</div>;
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin-login");
  };

  const menuSections = [
    {
       label: "MAIN MENU",
       items: [
         { to: "/admin", icon: LayoutDashboard, label: t("dashboard", "Dashboard / Overview"), end: true }
       ]
    },
    {
       label: "MEDICATIONS",
       items: [
         { to: "/admin/products", icon: Pill, label: t("products", "Products"), end: false },
         { to: "/admin/categories", icon: Tags, label: t("categories", "Categories"), end: false }
       ]
    },
    {
       label: "USERS",
       items: [
         { to: "/admin/clients", icon: Users, label: t("patients", "Patients"), end: false },
         { to: "/admin/vendors", icon: Store, label: t("pharmacies", "Pharmacies"), end: false },
         { to: "/admin/drivers", icon: Truck, label: t("deliveries", "Deliveries"), end: false }
       ]
    },
    {
       label: "MANAGEMENT",
       items: [
         { to: "/admin/orders", icon: Package, label: t("orders", "Orders"), end: false },
         { to: "/admin/finances", icon: CreditCard, label: t("finances", "Payment & Finances"), end: false },
         { to: "/admin/reports", icon: FileBarChart, label: t("reports", "Reports"), end: false },
         { to: "/admin/settings/promotions", icon: Ticket, label: t("promotions", "Promo codes & Offers"), end: false },
         { to: "/admin/support", icon: HeadphonesIcon, label: t("support", "Customer Queries / Support"), end: false }
       ]
    },
    {
       label: "SETTINGS",
       items: [
         { to: "/admin/settings", icon: Settings, label: t("general_settings", "General Settings"), end: false },
         { to: "/admin/settings/app", icon: Smartphone, label: t("app_settings", "App Settings"), end: false },
         { to: "/admin/settings/website", icon: Monitor, label: t("website_settings", "Website Settings"), end: false },
         { to: "/admin/profile", icon: UserCog, label: t("profile_settings", "Profile Settings"), end: false }
       ]
    },
    {
       label: "OTHER",
       items: [
         { to: "/admin/documentation", icon: BookText, label: t("documentation", "Documentation"), end: false },
         { to: "/admin/changelog", icon: History, label: t("changelog", "Changelog"), end: false }
       ]
    }
  ];

  return (
    <div className="flex w-full h-screen bg-[#F0F5F2] overflow-hidden text-slate-800 font-sans p-4">
      {/* Sidebar */}
      <aside className="w-72 bg-white rounded-3xl flex flex-col pt-8 pb-6 shadow-sm shrink-0 h-full relative z-20">
        <div className="px-8 mb-8 flex items-center gap-3 text-slate-900">
          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
             <Package size={16} className="text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight">PharmAply</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 min-h-0 pb-4 scrollbar-hide">
          {menuSections.map((section, idx) => (
            <div key={idx}>
              <p className="px-4 text-[10px] font-bold text-slate-400 tracking-wider mb-2">{section.label}</p>
              <nav className="space-y-1">
                {section.items.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-slate-900 text-white"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                    >
                      <Icon size={18} />
                      {link.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="px-6 mt-auto shrink-0">
           <div className="bg-gradient-to-r from-teal-50 to-teal-100 p-4 rounded-3xl flex items-center gap-3 mb-4">
              <div className="w-12 h-12 relative flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <path
                      className="text-teal-200"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-teal-600"
                      strokeWidth="3"
                      strokeDasharray="50, 100"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-teal-800 font-bold text-[10px]">50%</div>
              </div>
              <div>
                 <p className="text-xs font-bold text-slate-800">System Health</p>
                 <p className="text-[10px] text-slate-500 leading-tight">All systems operational</p>
              </div>
           </div>
           
           <button 
             onClick={handleLogout}
             className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
           >
              <LogOut size={16} />
              Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto flex flex-col h-full pl-6 pr-2 py-2">
        {/* Top Header */}
        <header className="flex items-center justify-between mb-8">
           <div className="relative w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full bg-white border-0 py-3 pl-12 pr-4 rounded-full text-sm shadow-sm focus:ring-2 focus:ring-slate-900 outline-none"
              />
           </div>
           
           <div className="flex items-center gap-6">
              <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-sm text-xs font-bold hover:bg-slate-800 transition">
                 <Plus size={14} /> Add New
              </button>
              
              <div className="flex items-center gap-4 text-slate-500">
                 <button className="relative p-2 bg-white rounded-full shadow-sm hover:text-slate-900 transition">
                    <MessageSquare size={18} />
                 </button>
                 <button className="relative p-2 bg-white rounded-full shadow-sm hover:text-slate-900 transition">
                    <Bell size={18} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                 </button>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm text-xs font-medium text-slate-600 cursor-pointer">
                <Globe size={14} /> 
                <select 
                  className="bg-transparent outline-none focus:ring-0 text-xs font-medium uppercase cursor-pointer"
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                >
                  <option value="en">EN</option>
                  <option value="fr">FR</option>
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                 <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-900">Platform Admin</p>
                    <p className="text-xs text-slate-500">admin@pharmaply.com</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                    <img src="https://i.pravatar.cc/150?img=11" alt="Admin" className="w-full h-full object-cover" />
                 </div>
              </div>
           </div>
        </header>

        {/* Content Route */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto pb-8 relative">
           <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                  <Outlet />
              </motion.div>
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
