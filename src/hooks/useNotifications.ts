import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from '../lib/firebase';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { parseDate } from '../lib/utils';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`read_notifications_${user.uid}`);
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const ratingQ = query(collection(db, 'orders'), where('patientId', '==', user.uid), where('status', '==', 'delivered'));
    const unsubRating = onSnapshot(ratingQ, (snapshot) => {
      const ratedOrders = snapshot.docs.map(d => ({ id: d.id, type: 'rating', ...d.data() }));
      setRatings(ratedOrders);
    });

    const salesQ = query(collection(db, 'flash_sales'), orderBy('createdAt', 'desc'));
    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      setFlashSales(snapshot.docs.map(d => ({ id: d.id, type: 'offer', ...d.data() })));
    });

    const notifQ = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubNotif = onSnapshot(notifQ, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRating();
      unsubSales();
      unsubNotif();
    };
  }, [user]);

  const allItems = [...notifications, ...flashSales, ...ratings].sort((a, b) => {
    const timeA = parseDate(a.createdAt) ? parseDate(a.createdAt)!.getTime() : Date.now();
    const timeB = parseDate(b.createdAt) ? parseDate(b.createdAt)!.getTime() : Date.now();
    return timeB - timeA;
  });

  const unreadCount = allItems.filter(item => !readIds.includes(item.id)).length;

  const markAllAsRead = () => {
    const allIds = allItems.map(i => i.id);
    const newReadIds = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(newReadIds);
    if (user) {
      localStorage.setItem(`read_notifications_${user.uid}`, JSON.stringify(newReadIds));
    }
  };

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      setReadIds(newReadIds);
      if (user) {
        localStorage.setItem(`read_notifications_${user.uid}`, JSON.stringify(newReadIds));
      }
    }
  };

  return { items: allItems, unreadCount, readIds, markAllAsRead, markAsRead };
}
