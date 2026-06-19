import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { 
  HeartPulse, LayoutDashboard, Package, Grid, 
  ShoppingCart, BarChart2, Users, CreditCard, 
  Settings, LogOut 
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { auth, signOut, db, collection, query, where, getDocs } from "../../lib/firebase";
import { useAuth } from "../AuthProvider";

interface RoleSidebarProps {
  role: "patient" | "pharmacist" | "delivery" | "admin";
}

export function RoleSidebar({ role }: RoleSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    const fetchPharmacyCompletion = async () => {
      if (role !== "pharmacist" || !user) return;
      try {
        const q = query(collection(db, 'pharmacies'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        
        let percentage = 20; // Base 20% for having an account
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          if (data.name) percentage += 15;
          if (data.address) percentage += 15;
          if (data.phone) percentage += 15;
          if (data.photoUrl) percentage += 15;
          if (data.coverUrl) percentage += 10;
          if (data.workingHours) percentage += 10;
        }
        setCompletionPercentage(percentage);
      } catch (error) {
        console.error("Failed to fetch pharmacy for completion status", error);
      }
    };
    fetchPharmacyCompletion();
  }, [user, role]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const menuSections = [
    {
      title: "MAIN MENU",
      links: [
        { to: "/pharmacist", icon: LayoutDashboard, label: t('dashboard', 'Dashboard'), exact: true },
        { to: "/pharmacist/inventory", icon: Package, label: t('products', 'Products') },
        { to: "/pharmacist/categories", icon: Grid, label: t('categories', 'Categories') },
      ]
    },
    {
      title: "LEADS",
      links: [
        { to: "/pharmacist/orders", icon: ShoppingCart, label: t('orders', 'Orders') },
        { to: "/pharmacist/sales", icon: BarChart2, label: t('sales', 'Sales') },
        { to: "/pharmacist/customers", icon: Users, label: t('customers', 'Customers') },
      ]
    },
    {
      title: "COMMS",
      links: [
        { to: "/pharmacist/payments", icon: CreditCard, label: t('payments', 'Payments') },
        { to: "/pharmacist/reports", icon: BarChart2, label: t('reports', 'Reports') },
        { to: "/pharmacist/profile", icon: Settings, label: t('settings', 'Settings') },
      ]
    }
  ];

  if (role !== "pharmacist") {
    // Other roles can keep a simplified version for now, but focus is on pharmacist
    return null;
  }

  return (
    <aside className="w-full h-full flex flex-col py-8 overflow-y-auto custom-scrollbar border-r border-transparent">
      <div className="px-8 mb-10 flex items-center gap-3 text-slate-900 dark:text-white">
        <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-100 shadow-sm flex items-center justify-center">
           <HeartPulse size={20} className="text-[#0B3B3C] dark:text-teal-400" />
        </div>
        <h1 className="font-bold text-2xl tracking-tight text-[#0B3B3C] dark:text-white"> {t('pharmacy', 'Pharmacy')} </h1>
      </div>

      <div className="flex-1 space-y-8">
        {menuSections.map((section, idx) => (
          <div key={idx} className="px-4">
            <h3 className="px-4 text-[10px] font-bold text-gray-400 tracking-wider mb-3">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.exact}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-[#0B3B3C] text-white shadow-md dark:bg-teal-500/20 dark:text-teal-400"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                        {link.label}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 mt-10 shrink-0">
         {completionPercentage < 100 && (
         <div className="bg-[#B9E9E0] dark:bg-teal-900/30 p-5 rounded-3xl mb-4 relative overflow-hidden">
            <div className="flex items-start gap-4 z-10 relative">
               <div className="w-12 h-12 rounded-full border-4 border-[#0B3B3C] flex items-center justify-center font-bold text-[#0B3B3C] text-sm shrink-0">
                  {Math.min(completionPercentage, 100)}%
               </div>
               <div>
                  <h4 className="font-bold text-[#0B3B3C] dark:text-teal-100 text-sm mb-1 leading-tight">{t('complete_profile', 'Complete Profile')}</h4>
                  <p className="text-xs text-[#0B3B3C]/70 dark:text-teal-200/70 mb-3">{t('complete_profile_desc', 'Complete Your Profile to Unlock all Features')}</p>
               </div>
            </div>
            <button 
               onClick={() => navigate('/pharmacist/profile')}
               className="w-full py-2.5 bg-[#0B3B3C] text-white rounded-xl text-xs font-bold hover:bg-[#082a2b] transition-colors relative z-10"
            >
               {t('update_profile', 'Update Profile')}
            </button>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
         </div>
         )}

         <button 
           onClick={handleLogout}
           className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
         >
            <LogOut size={18} />
            {t('logout', 'Sign Out')}
         </button>
      </div>
    </aside>
  );
}
