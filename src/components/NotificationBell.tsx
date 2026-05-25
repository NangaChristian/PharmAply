import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { db, collection, query, where, orderBy, onSnapshot, updateDoc, doc } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    
    // Using our mock firebase which connects to Supabase Realtime
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const notifs: any[] = [];
      snapshot.forEach((d: any) => {
         notifs.push({ id: d.id, ...d.data() });
      });
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await updateDoc(doc(db, 'notifications', notification.id), {
        isRead: true
      });
    }
    
    setShowDropdown(false);

    if (notification.relatedId) {
       if (notification.type === 'new_order' || notification.type === 'order_status') {
           navigate(`/${user.role}/order/${notification.relatedId}`);
       }
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center border border-gray-100 dark:border-zinc-700 shadow-sm relative text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800"></span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
            <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                No new notifications
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 border-b border-gray-50 dark:border-zinc-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors ${!notif.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{notif.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{notif.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
