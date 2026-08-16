import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Users, User, CircleDollarSign, Settings, FileText, LogOut, Package, Search, Bell, Globe, Store, Truck, 
  Pill, Tags, CreditCard, FileBarChart, Ticket, HeadphonesIcon, UserCog, BookText, History, Plus, MessageSquare, Smartphone, Monitor, Folder, ChevronDown, MapPin, ShieldAlert
} from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { signOut } from '../../lib/firebase';
import { useAuth } from "../../components/AuthProvider";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, onSnapshot } from "../../lib/firebase";

import { DarkModeToggle } from '../DarkModeToggle';

export function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, role, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();

  const [pendingPharmaciesCount, setPendingPharmaciesCount] = useState(0);
  const [pendingDriversCount, setPendingDriversCount] = useState(0);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'admin')) {
      navigate('/admin-login');
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user || role !== 'admin') return;
    
    const pQ = query(collection(db, 'pharmacies'), where('status', '==', 'pending_verification'));
    const unsubP = onSnapshot(pQ, (snap) => setPendingPharmaciesCount(snap.size));
    
    const dQ = query(collection(db, 'drivers'), where('status', '==', 'pending_verification'));
    const unsubD = onSnapshot(dQ, (snap) => setPendingDriversCount(snap.size));
    
    return () => {
      unsubP();
      unsubD();
    };
  }, [user, role]);

  if (authLoading || !user || role !== 'admin') {
    return <div className="h-screen w-screen flex items-center justify-center bg-[#F0F5F2]"> {t('loading', 'Loading...')} </div>;
  }

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin-login");
  };

  const menuSections = [
    {
       label: t('admin_main_menu', "MAIN MENU"),
       items: [
         { to: "/admin", icon: LayoutDashboard, label: t('admin_dashboard', "Dashboard / Overview"), end: true },
         { to: "/admin/deliveries-tracking", icon: Truck, label: "Tableau Livraison", end: true },
         { to: "/admin/live-map", icon: MapPin, label: "Live Map", end: true }
       ]
    },
    {
       label: t('admin_medications', "MEDICATIONS"),
       items: [
         { to: "/admin/products", icon: Pill, label: t('admin_products', "Products"), end: true },
         { to: "/admin/categories", icon: Tags, label: t('admin_categories', "Categories"), end: true },
         { to: "/admin/dpml", icon: ShieldAlert, label: "DPML Alerts", end: true }
       ]
    },
    {
       label: t('admin_users', "USERS"),
       items: [
         { to: "/admin/clients", icon: Users, label: t('admin_patients', "Patients"), end: true },
         { to: "/admin/vendors", icon: Store, label: t('admin_pharmacies', "Pharmacies"), badge: pendingPharmaciesCount, end: true },
         { to: "/admin/drivers", icon: Truck, label: t('admin_deliveries', "Deliveries"), badge: pendingDriversCount, end: true },
         { to: "/admin/cashiers", icon: CircleDollarSign, label: t('admin_cashiers', "Cashiers"), end: true }
       ]
    },
    {
       label: t('admin_management', "MANAGEMENT"),
       items: [
         { to: "/admin/orders", icon: Package, label: t('admin_orders', "Orders"), end: true },
         { to: "/admin/finances", icon: CreditCard, label: t('admin_finances', "Payment & Finances"), end: true },
         { to: "/admin/reports", icon: FileBarChart, label: t('admin_reports', "Reports"), end: true },
         { to: "/admin/support", icon: HeadphonesIcon, label: t('admin_support', "Customer Queries / Support"), end: true }
       ]
    },
    {
       label: t('admin_settings_menu', "SETTINGS"),
       items: [
         { to: "/admin/settings", icon: Settings, label: t('admin_general_settings', "General Settings"), end: true },
         { to: "/admin/settings/app", icon: Smartphone, label: t('admin_app_settings', "App Settings"), end: true },
         { to: "/admin/settings/website", icon: Monitor, label: t('admin_web_settings', "Website Settings"), end: true },
         { to: "/admin/profile", icon: UserCog, label: t('admin_profile_settings', "Profile Settings"), end: true }
       ]
    },
    {
       label: t('admin_other', "OTHER"),
       items: [
         { to: "/admin/documentation", icon: BookText, label: t('admin_documentation', "Documentation"), end: true },
         { to: "/admin/changelog", icon: History, label: t('admin_changelog', "Changelog"), end: true }
       ]
    }
  ];

  return (
    <div className="flex w-full h-screen bg-[#F0F5F2] dark:bg-slate-900 overflow-hidden text-slate-800 dark:text-slate-200 font-sans p-4 transition-colors">
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-slate-800 rounded-3xl flex flex-col pt-8 pb-6 shadow-sm shrink-0 h-full relative z-20 transition-colors">
        <div className="px-8 mb-8 flex items-center gap-3 text-slate-900 dark:text-white">
          <div className="w-8 h-8 rounded-full bg-[#1650ee] flex items-center justify-center">
             <Package size={16} className="text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-[#0d4ff4]"> {t('pharmaply', 'PharmAply')} </h1>
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
                        `flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-slate-900 text-white dark:bg-indigo-600"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-white dark:hover:bg-slate-700 dark:hover:text-white"
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} />
                        {link.label}
                      </div>
                      {link.badge && link.badge > 0 ? (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {link.badge}
                        </span>
                      ) : null}
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
                 <p className="text-xs font-bold text-slate-800 dark:text-slate-100"> {t('system_health', 'System Health')} </p>
                 <p className="text-[10px] text-slate-500 leading-tight"> {t('all_systems_operational', 'All systems operational')} </p>
              </div>
           </div>
           
           <button 
             onClick={handleLogout}
             className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
           >
              <LogOut size={16} />
              {t('logout', 'Sign Out')}
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
                placeholder={t('search_placeholder', 'Search')}
                className="w-full bg-white dark:bg-slate-800 dark:text-white border-0 py-3 pl-12 pr-4 rounded-full text-sm shadow-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-indigo-500 outline-none"
              />
           </div>
           
           <div className="flex items-center gap-6">
              <div className="relative group">
                 <button className="flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-full shadow-sm text-xs font-bold hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                    <Plus size={14} /> {t('add_new', 'Add New')}
                 </button>
                 <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-950 rounded-xl shadow-lg border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="p-2 flex flex-col gap-1">
                       <button onClick={() => navigate('/admin/products')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg font-medium"> {t('add_product', 'Add Product')} </button>
                       <button onClick={() => navigate('/admin/categories')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg font-medium"> {t('add_category', 'Add Category')} </button>
                       <button onClick={() => navigate('/admin/vendors')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg font-medium"> {t('add_pharmacy', 'Add Pharmacy')} </button>
                       <button onClick={() => navigate('/admin/drivers')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg font-medium"> {t('add_driver', 'Add Driver')} </button>
                    </div>
                 </div>
              </div>
              
              <div className="flex items-center gap-4 text-slate-500">
                 <DarkModeToggle className="shadow-sm bg-white dark:bg-slate-800 dark:text-slate-200" />
                 <button onClick={() => navigate('/admin/support')} className="relative p-2 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-full shadow-sm hover:text-slate-900 dark:text-white transition">
                    <MessageSquare size={18} />
                 </button>
                 <button onClick={() => navigate('/admin/changelog')} className="relative p-2 bg-white dark:bg-slate-800 dark:text-slate-200 rounded-full shadow-sm hover:text-slate-900 dark:text-white transition">
                    <Bell size={18} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                 </button>
              </div>

              <div className="relative flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full shadow-sm text-xs font-medium text-slate-600 dark:text-slate-300 border border-transparent hover:border-slate-200 transition">
                <Globe size={14} /> 
                <span className="uppercase">{i18n.language}</span>
                <ChevronDown size={14} />
                <select 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                >
                  <option value="en">EN</option>
                  <option value="fr">FR</option>
                  <option value="ar">AR</option>
                </select>
              </div>
              
              <div 
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition"
                onClick={() => navigate('/admin/profile')}
              >
                 <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.displayName || "Platform Admin"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || "admin@pharmaply.com"}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm flex items-center justify-center">
                    {user?.photoURL ? (
                       <img src={user.photoURL} alt="Admin" className="w-full h-full object-cover" />
                    ) : (
                       <User size={20} className="text-slate-400" />
                    )}
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
