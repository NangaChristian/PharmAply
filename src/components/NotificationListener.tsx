import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from '../lib/firebase';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { parseDate } from '../lib/utils';

export function NotificationListener() {
  const { user, role } = useAuth();
  const { t } = useTranslation();
  const notifiedOrders = useRef<Set<string>>(new Set());
  const notifiedMessages = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request notification and geolocation permissions
    const requestPermissions = async () => {
      try {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
          await Notification.requestPermission();
        }
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 10000 });
        }
      } catch (err) {
        console.warn("Permission request failed", err);
      }
    };
    
    if (user) {
      requestPermissions();
    }

    if (!user) return;

    const unsubscribers: (() => void)[] = [];

    // 1. Order Notifications
    if (role === 'pharmacist' || role === 'vendor') {
      const q = query(collection(db, 'orders'), where('pharmacyId', '==', user.uid), where('status', '==', 'pending'));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const order = change.doc.data();
            if (!notifiedOrders.current.has(change.doc.id)) {
              notifiedOrders.current.add(change.doc.id);
              // Only notify if recent
              const isRecent = parseDate(order.createdAt) && (Date.now() - parseDate(order.createdAt)!.getTime() < 60000 * 5); // 5 mins
              if (isRecent) {
                toast(t("new_order_pharmacist_toast", "New order received!"), { icon: '🔔' });
                if (Notification.permission === 'granted') {
                  new Notification(t("new_order", "New Order"), {
                    body: t("new_order_pharmacist_desc", "A new order is waiting for your approval."),
                  });
                }
              }
            }
          }
        });
      });
      unsubscribers.push(unsub);
    } else if (role === 'driver') {
      const q = query(collection(db, 'orders'), where('status', '==', 'ready'));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const order = change.doc.data();
            if (!notifiedOrders.current.has(change.doc.id)) {
              notifiedOrders.current.add(change.doc.id);
              toast(t("new_order_toast", "New order available for delivery!"), { icon: '🚚' });
              if (Notification.permission === 'granted') {
                new Notification(t("new_order", "New Order"), {
                  body: t("new_order_desc", "An order is ready to be delivered."),
                });
              }
            }
          }
        });
      });
      unsubscribers.push(unsub);
    } else if (role === 'patient') {
      const q = query(collection(db, 'orders'), where('patientId', '==', user.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const order = change.doc.data();
            
            let body = '';
            let title = t('order_update', 'Order Update');
            if (order.status === 'out_for_delivery') body = t('order_out_for_delivery', 'Your order is out for delivery!');
            else if (order.status === 'delivered') body = t('order_delivered', 'Your order has been delivered!');
            else if (order.status === 'cancelled') body = `${t('order_cancelled', 'Your order was cancelled.')} ${order.cancellationReason || ''}`;
            else if (order.status === 'rejected') body = `${t('order_rejected', 'Your order was rejected.')} ${order.cancellationReason || ''}`;
            
            if (body) {
              toast(body, { icon: order.status === 'cancelled' || order.status === 'rejected' ? '❌' : '📦' });
              if (Notification.permission === 'granted') {
                new Notification(title, { body });
              }
            }
          }
        });
      });
      unsubscribers.push(unsub);
    }

    // 2. Message Notifications
    if (role === 'patient' || role === 'driver' || role === 'pharmacist' || role === 'pharmacy' || role === 'admin') {
      const messagesQ = query(collection(db, 'messages'), where('receiverId', '==', user.uid));
      const unsubMessages = onSnapshot(messagesQ, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const msg = change.doc.data();
            if (!notifiedMessages.current.has(change.doc.id)) {
              notifiedMessages.current.add(change.doc.id);
              // Only notify if it's recent (within last minute) to avoid spam on initial load
              const isRecent = parseDate(msg.createdAt) && (Date.now() - parseDate(msg.createdAt)!.getTime() < 60000);
              if (isRecent) {
                 toast(t('new_message_received', 'New message received!'), { icon: '💬' });
                 if (Notification.permission === 'granted') {
                   new Notification(t('new_message', 'New Message'), {
                     body: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''),
                   });
                 }
              }
            }
          }
        });
      }, (err: any) => {
         // Silently ignore if table doesn't exist yet
         console.warn("Messages sync error (likely missing table):", err.message);
      });
      unsubscribers.push(unsubMessages);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, role]);

  return null;
}
