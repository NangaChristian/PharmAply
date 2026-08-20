import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, CreditCard, Package, Truck, UserPlus, 
  ShieldCheck, MessageSquare, CheckCircle, AlertTriangle 
} from 'lucide-react';
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs, limit } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';
import { parseDate } from '../lib/utils';
import { useTranslation } from 'react-i18next';

export function NotificationBell({ className = '' }: { className?: string }) {
  const { user, role, userData } = useAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // User-specific notifications
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const notifs: any[] = [];
      snapshot.forEach((d: any) => {
         notifs.push({ id: d.id, ...d.data() });
      });

      // If admin, also fetch broadcast admin notifications
      if (role === 'admin') {
        const adminQ = query(
          collection(db, 'notifications'),
          where('targetRole', '==', 'admin')
        );
        getDocs(adminQ).then((adminSnap) => {
          adminSnap.forEach((ad: any) => {
            if (!notifs.some(n => n.id === ad.id)) {
              notifs.push({ id: ad.id, ...ad.data() });
            }
          });
          notifs.sort((a, b) => {
            const timeA = parseDate(a.createdAt)?.getTime() || 0;
            const timeB = parseDate(b.createdAt)?.getTime() || 0;
            return timeB - timeA;
          });
          setNotifications(notifs);
        }).catch(() => {
          notifs.sort((a, b) => {
            const timeA = parseDate(a.createdAt)?.getTime() || 0;
            const timeB = parseDate(b.createdAt)?.getTime() || 0;
            return timeB - timeA;
          });
          setNotifications(notifs);
        });
      } else {
        notifs.sort((a, b) => {
          const timeA = parseDate(a.createdAt)?.getTime() || 0;
          const timeB = parseDate(b.createdAt)?.getTime() || 0;
          return timeB - timeA;
        });
        setNotifications(notifs);
      }
    });

    return () => unsubscribe();
  }, [user, role]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'transaction':
      case 'payment':
        return <CreditCard size={16} className="text-emerald-500" />;
      case 'delivery':
      case 'driver':
        return <Truck size={16} className="text-blue-500" />;
      case 'kyc':
      case 'verification':
        return <ShieldCheck size={16} className="text-amber-500" />;
      case 'registration':
      case 'user_signup':
        return <UserPlus size={16} className="text-purple-500" />;
      case 'message':
        return <MessageSquare size={16} className="text-teal-500" />;
      case 'order':
      case 'order_status':
      default:
        return <Package size={16} className="text-indigo-500" />;
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead && notification.id) {
      try {
        await updateDoc(doc(db, 'notifications', notification.id), {
          isRead: true
        });
      } catch (e) {
        // Fallback for memory/mock
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
      }
    }
    
    setShowDropdown(false);

    // Direct URL target priority if explicitly specified
    if (notification.targetUrl || notification.url) {
      navigate(notification.targetUrl || notification.url);
      return;
    }

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const rawRole = (role || userData?.role || '').toLowerCase();
    
    // Robust multi-criteria portal detection
    const isPharmacist = 
      currentPath.startsWith('/pharmacist') || 
      ['pharmacist', 'pharmacy', 'vendor', 'team_member', 'team', 'staff', 'cashier'].some(r => rawRole.includes(r)) ||
      notification.targetRole === 'pharmacist' ||
      notification.targetRole === 'vendor' ||
      notification.target === 'pharmacy';

    const isAdmin = 
      currentPath.startsWith('/admin') || 
      ['admin', 'superadmin', 'manager'].some(r => rawRole.includes(r)) ||
      notification.targetRole === 'admin';

    const isDelivery = 
      currentPath.startsWith('/delivery') || 
      ['delivery', 'driver', 'courier', 'livreur'].some(r => rawRole.includes(r)) ||
      notification.targetRole === 'driver' ||
      notification.targetRole === 'delivery' ||
      notification.target === 'driver';

    const relatedId = notification.relatedId || notification.orderId;

    if (isPharmacist) {
      if (notification.type === 'message') {
        navigate(relatedId ? `/pharmacist/messages/${relatedId}` : '/pharmacist/messages');
      } else if (notification.type === 'inventory' || notification.type === 'stock') {
        navigate(relatedId ? `/pharmacist/inventory/${relatedId}` : '/pharmacist/inventory');
      } else if (notification.type === 'prescription') {
        navigate('/pharmacist/prescriptions');
      } else if (relatedId) {
        navigate(`/pharmacist/order/${relatedId}`);
      } else {
        navigate('/pharmacist/orders');
      }
    } else if (isAdmin) {
      if (notification.type === 'transaction' || notification.type === 'payment' || notification.type === 'financial') {
        navigate('/admin/finances');
      } else if (notification.type === 'delivery' || notification.type === 'driver_tracking') {
        navigate('/admin/live-map');
      } else if (notification.type === 'kyc' || notification.type === 'verification') {
        if (notification.target === 'driver') {
          navigate('/admin/drivers');
        } else {
          navigate('/admin/vendors');
        }
      } else if (notification.type === 'registration' || notification.type === 'user_signup') {
        if (notification.target === 'driver') navigate('/admin/drivers');
        else if (notification.target === 'pharmacist' || notification.target === 'pharmacy' || notification.target === 'vendor') navigate('/admin/vendors');
        else navigate('/admin/clients');
      } else if (notification.type === 'message' || notification.type === 'support') {
        navigate('/admin/support');
      } else if (notification.type === 'dpml') {
        navigate('/admin/dpml');
      } else if (relatedId) {
        navigate(`/admin/orders`);
      } else {
        navigate('/admin/orders');
      }
    } else if (isDelivery) {
      if (notification.type === 'message') {
        navigate(relatedId ? `/delivery/messages/${relatedId}` : '/delivery/messages');
      } else if (relatedId) {
        navigate(`/delivery/order/${relatedId}`);
      } else {
        navigate('/delivery/deliveries');
      }
    } else {
      // Patient Portal
      if (notification.type === 'payment_required') {
        navigate('/patient/orders');
      } else if (notification.type === 'reminder') {
        navigate('/patient/calendar');
      } else if (notification.type === 'message') {
        navigate(relatedId ? `/patient/messages/${relatedId}` : '/patient/messages');
      } else if (relatedId) {
        navigate(`/patient/tracking/${relatedId}`);
      } else {
        navigate('/patient/orders');
      }
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    for (const notif of unread) {
      if (notif.id) {
        try {
          await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
        } catch (e) {}
      }
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center border border-gray-100 dark:border-zinc-700 shadow-sm relative text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800 animate-pulse"></span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-zinc-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} {t('new', 'nouvelles')}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead} 
                className="text-xs text-[#194B4B] dark:text-teal-400 font-bold hover:underline"
              >
                {t('mark_all_read', 'Tout marquer lu')}
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-800/50">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-40" />
                <p className="font-medium">Aucune notification pour le moment</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors ${!notif.isRead ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 border border-gray-100 dark:border-zinc-700">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-xs font-bold truncate ${!notif.isRead ? 'text-[#194B4B] dark:text-teal-300' : 'text-gray-900 dark:text-white'}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.createdAt && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 block">
                        {parseDate(notif.createdAt)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Récent'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
