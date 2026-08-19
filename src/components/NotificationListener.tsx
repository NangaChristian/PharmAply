import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from '../lib/firebase';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { parseDate } from '../lib/utils';

export function NotificationListener() {
  const { user, role } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notifiedOrders = useRef<Set<string>>(new Set());
  const notifiedMessages = useRef<Set<string>>(new Set());
  const previousStatusMap = useRef<Map<string, string>>(new Map());

  // Helper for clickable toast with navigation
  const showClickableToast = (
    message: string, 
    path: string, 
    icon: string = '🔔', 
    duration: number = 6000
  ) => {
    toast((tObj) => (
      <div 
        onClick={() => {
          toast.dismiss(tObj.id);
          navigate(path);
        }}
        className="cursor-pointer flex items-center justify-between gap-3 w-full"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">
            {message}
          </span>
        </div>
        <span className="text-[10px] font-bold text-[#194B4B] dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-1 rounded-full whitespace-nowrap">
          Voir &rarr;
        </span>
      </div>
    ), { duration });
  };

  // Helper for System Browser notification
  const showSystemNotification = (title: string, body: string, path: string) => {
    if ("Notification" in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico'
        });
        notif.onclick = (e) => {
          e.preventDefault();
          window.focus();
          navigate(path);
          notif.close();
        };
      } catch (err) {
        console.warn("System notification error:", err);
      }
    }
  };

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

    // 1. Pharmacist Notifications
    if (role === 'pharmacist' || role === 'vendor') {
      const q = query(collection(db, 'orders'), where('pharmacyId', '==', user.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const order = change.doc.data();
          const orderId = change.doc.id;
          const orderTargetUrl = `/pharmacist/orders`;

          if (change.type === 'added') {
            if (!notifiedOrders.current.has(orderId)) {
              notifiedOrders.current.add(orderId);
              const isRecent = parseDate(order.createdAt) && (Date.now() - parseDate(order.createdAt)!.getTime() < 60000 * 10);
              if (isRecent && order.status === 'pending') {
                showClickableToast(
                  `Nouvelle commande #${orderId.slice(0, 6).toUpperCase()} reçue !`,
                  orderTargetUrl,
                  '🔔'
                );
                showSystemNotification(
                  "Nouvelle Commande",
                  "Une nouvelle ordonnance/commande attend votre validation.",
                  orderTargetUrl
                );
              }
            }
          } else if (change.type === 'modified') {
            const prevStatus = previousStatusMap.current.get(orderId);
            if (prevStatus !== order.status) {
              previousStatusMap.current.set(orderId, order.status);
              
              if (order.status === 'paid') {
                showClickableToast(
                  `Commande #${orderId.slice(0, 6).toUpperCase()} payée ! Préparation requise.`,
                  orderTargetUrl,
                  '💳'
                );
              } else if (order.driverId && ['driver_assigned', 'to_pharmacy', 'at_pharmacy', 'on_the_way'].includes(order.status)) {
                showClickableToast(
                  `Livreur assigné à la commande #${orderId.slice(0, 6).toUpperCase()} : ${order.driverName || 'Livreur en route'}`,
                  orderTargetUrl,
                  '🚚'
                );
              }
            }
          }
        });
      });
      unsubscribers.push(unsub);
    } 
    
    // 2. Driver Notifications
    else if (role === 'driver') {
      const q = query(collection(db, 'orders'));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const order = change.doc.data();
          const orderId = change.doc.id;
          const targetUrl = order.driverId === user.uid ? `/delivery/active` : `/delivery/orders`;

          if (change.type === 'added' || change.type === 'modified') {
            if (order.status === 'ready' && !order.driverId) {
              if (!notifiedOrders.current.has(orderId + '_ready')) {
                notifiedOrders.current.add(orderId + '_ready');
                showClickableToast(
                  `Nouvelle course disponible #${orderId.slice(0, 6).toUpperCase()} !`,
                  `/delivery/orders`,
                  '🚚'
                );
                showSystemNotification(
                  "Nouvelle Course Disponible",
                  "Une commande prête attend un livreur.",
                  `/delivery/orders`
                );
              }
            } else if (order.driverId === user.uid && order.status === 'ready_for_pickup') {
              showClickableToast(
                `Commande #${orderId.slice(0, 6).toUpperCase()} prête pour retrait à l'officine.`,
                `/delivery/active`,
                '📦'
              );
            }
          }
        });
      });
      unsubscribers.push(unsub);
    } 
    
    // 3. Patient Notifications
    else if (role === 'patient') {
      const q = query(collection(db, 'orders'), where('patientId', '==', user.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const order = change.doc.data();
          const orderId = change.doc.id;
          const trackingUrl = `/patient/tracking/${orderId}`;
          const ordersUrl = `/patient/orders`;

          if (change.type === 'modified') {
            const prevStatus = previousStatusMap.current.get(orderId);
            if (prevStatus !== order.status) {
              previousStatusMap.current.set(orderId, order.status);

              let body = '';
              let title = 'Mise à jour de commande';
              let icon = '📦';
              let destUrl = trackingUrl;

              if (order.status === 'validated_awaiting_payment') {
                title = 'Médicaments Disponibles';
                body = `Vos médicaments pour la commande #${orderId.slice(0, 6).toUpperCase()} sont disponibles. Cliquez pour payer.`;
                icon = '💳';
                destUrl = ordersUrl;
              } else if (order.status === 'preparing') {
                title = 'Préparation en cours';
                body = `Votre commande #${orderId.slice(0, 6).toUpperCase()} est en cours de préparation en pharmacie.`;
                icon = '💊';
              } else if (order.status === 'ready' || order.status === 'ready_for_pickup') {
                title = 'Commande prête';
                body = order.deliveryMethod === 'pickup' 
                  ? `Votre commande #${orderId.slice(0, 6).toUpperCase()} est prête pour retrait au comptoir.`
                  : `Votre commande #${orderId.slice(0, 6).toUpperCase()} est prête et assignée à un coursier.`;
                icon = '📦';
              } else if (order.status === 'out_for_delivery' || order.status === 'on_the_way' || order.status === 'to_customer') {
                title = 'En cours de livraison';
                body = `Le livreur est en route avec votre commande #${orderId.slice(0, 6).toUpperCase()} ! Suivez sa position en direct.`;
                icon = '🚚';
              } else if (order.status === 'delivered') {
                title = 'Commande Livrée';
                body = `Votre commande #${orderId.slice(0, 6).toUpperCase()} a été livrée avec succès !`;
                icon = '✅';
              } else if (order.status === 'cancelled' || order.status === 'rejected') {
                title = 'Commande Annulée';
                body = `La commande #${orderId.slice(0, 6).toUpperCase()} a été annulée. ${order.cancellationReason || ''}`;
                icon = '❌';
                destUrl = ordersUrl;
              }

              if (body) {
                showClickableToast(body, destUrl, icon);
                showSystemNotification(title, body, destUrl);
              }
            }
          } else if (change.type === 'added') {
            previousStatusMap.current.set(orderId, order.status);
          }
        });
      });
      unsubscribers.push(unsub);
    }

    // 4. Admin Real-time Supervision Notifications (Transactions, Orders, Deliveries, Users, KYC)
    else if (role === 'admin') {
      // 4a. Orders & Deliveries & Transactions
      const q = query(collection(db, 'orders'));
      const unsubAdmin = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const order = change.doc.data();
          const orderId = change.doc.id;
          const liveMapUrl = `/admin/live-map`;
          const ordersUrl = `/admin/orders`;
          const financesUrl = `/admin/finances`;

          if (change.type === 'added') {
            const isRecent = parseDate(order.createdAt) && (Date.now() - parseDate(order.createdAt)!.getTime() < 60000 * 5);
            if (isRecent && !notifiedOrders.current.has(orderId)) {
              notifiedOrders.current.add(orderId);
              showClickableToast(
                `Nouvelle commande #${orderId.slice(0, 6).toUpperCase()} enregistrée (${order.total || 0} FCFA)`,
                ordersUrl,
                '📋'
              );
              showSystemNotification(
                "Nouvelle Commande",
                `Commande #${orderId.slice(0, 6)} de ${order.total || 0} FCFA reçue.`,
                ordersUrl
              );
            }
          } else if (change.type === 'modified') {
            const prevStatus = previousStatusMap.current.get(orderId);
            if (prevStatus !== order.status) {
              previousStatusMap.current.set(orderId, order.status);

              // Payment / Transaction notification
              if (order.status === 'paid' || (order.paymentStatus === 'paid' && prevStatus !== 'paid')) {
                showClickableToast(
                  `Transaction validée : Commande #${orderId.slice(0, 6).toUpperCase()} payée (${order.total || 0} FCFA via ${order.paymentMethod || 'Mobile Money'})`,
                  financesUrl,
                  '💳'
                );
                showSystemNotification(
                  "Paiement Reçu",
                  `Paiement de ${order.total || 0} FCFA confirmé pour la commande #${orderId.slice(0, 6)}.`,
                  financesUrl
                );
              } 
              // Delivery Tracking notifications
              else if (['driver_assigned', 'to_pharmacy', 'picked_up', 'out_for_delivery', 'on_the_way'].includes(order.status)) {
                if (order.driverName || order.driverId) {
                  showClickableToast(
                    `Livraison en cours : ${order.driverName || 'Un livreur'} a pris en charge #${orderId.slice(0, 6).toUpperCase()}`,
                    liveMapUrl,
                    '🛵'
                  );
                  showSystemNotification(
                    "Course Acceptée",
                    `Le livreur ${order.driverName || ''} a accepté la livraison #${orderId.slice(0, 6)}.`,
                    liveMapUrl
                  );
                }
              } else if (order.status === 'delivered') {
                showClickableToast(
                  `Livraison terminée avec succès pour la commande #${orderId.slice(0, 6).toUpperCase()} !`,
                  liveMapUrl,
                  '🏁'
                );
                showSystemNotification(
                  "Course Terminée",
                  `La commande #${orderId.slice(0, 6)} a été livrée et clôturée.`,
                  liveMapUrl
                );
              } else if (order.status === 'cancelled' || order.status === 'rejected') {
                showClickableToast(
                  `Commande #${orderId.slice(0, 6).toUpperCase()} annulée`,
                  ordersUrl,
                  '❌'
                );
              }
            }
          }
        });
      });
      unsubscribers.push(unsubAdmin);

      // 4b. New User Inscriptions (Patients, Pharmacists, Drivers)
      const usersQ = query(collection(db, 'users'));
      const unsubUsers = onSnapshot(usersQ, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const uData = change.doc.data();
            const isRecent = parseDate(uData.createdAt) && (Date.now() - parseDate(uData.createdAt)!.getTime() < 60000 * 5);
            if (isRecent && !notifiedOrders.current.has(`user_${change.doc.id}`)) {
              notifiedOrders.current.add(`user_${change.doc.id}`);
              const userRoleName = uData.role === 'driver' ? 'Livreur' : (uData.role === 'pharmacist' || uData.role === 'vendor' ? 'Pharmacie' : 'Patient');
              const targetUrl = uData.role === 'driver' ? '/admin/drivers' : (uData.role === 'pharmacist' || uData.role === 'vendor' ? '/admin/vendors' : '/admin/clients');
              
              showClickableToast(
                `Nouvelle inscription : ${uData.name || uData.displayName || uData.email || 'Utilisateur'} (${userRoleName})`,
                targetUrl,
                '👤'
              );
              showSystemNotification(
                "Nouvelle Inscription",
                `Un nouveau compte ${userRoleName} (${uData.name || uData.email}) vient d'être créé.`,
                targetUrl
              );
            }
          }
        });
      });
      unsubscribers.push(unsubUsers);

      // 4c. KYC & Verification Applications (Pharmacies & Drivers)
      const kycPharmaciesQ = query(collection(db, 'pharmacies'), where('status', '==', 'pending_verification'));
      const unsubKYCPharm = onSnapshot(kycPharmaciesQ, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const pData = change.doc.data();
            if (!notifiedOrders.current.has(`kyc_pharm_${change.doc.id}`)) {
              notifiedOrders.current.add(`kyc_pharm_${change.doc.id}`);
              showClickableToast(
                `Dossier KYC Pharmacie à valider : ${pData.name || pData.pharmacyName || 'Nouvelle officine'}`,
                '/admin/vendors',
                '🛡️'
              );
              showSystemNotification(
                "Dossier KYC Requis",
                `Une pharmacie (${pData.name || ''}) attend la vérification de sa licence d'exploitation.`,
                '/admin/vendors'
              );
            }
          }
        });
      });
      unsubscribers.push(unsubKYCPharm);

      const kycDriversQ = query(collection(db, 'drivers'), where('status', '==', 'pending_verification'));
      const unsubKYCDrivers = onSnapshot(kycDriversQ, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const dData = change.doc.data();
            if (!notifiedOrders.current.has(`kyc_driver_${change.doc.id}`)) {
              notifiedOrders.current.add(`kyc_driver_${change.doc.id}`);
              showClickableToast(
                `Dossier KYC Livreur à vérifier : ${dData.name || dData.fullName || 'Nouveau coursier'}`,
                '/admin/drivers',
                '🛵'
              );
              showSystemNotification(
                "Vérification Livreur Requise",
                `Un livreur (${dData.name || ''}) a téléversé ses pièces d'identité et permis.`,
                '/admin/drivers'
              );
            }
          }
        });
      });
      unsubscribers.push(unsubKYCDrivers);
    }

    // 5. Direct Message Notifications
    const messagesQ = query(collection(db, 'messages'), where('receiverId', '==', user.uid));
    const unsubMessages = onSnapshot(messagesQ, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          const chatUrl = `/${role === 'admin' ? 'admin' : role === 'pharmacist' ? 'pharmacist' : role === 'driver' ? 'delivery' : 'patient'}/messages`;
          if (!notifiedMessages.current.has(change.doc.id)) {
            notifiedMessages.current.add(change.doc.id);
            const isRecent = parseDate(msg.createdAt) && (Date.now() - parseDate(msg.createdAt)!.getTime() < 60000);
            if (isRecent) {
              showClickableToast(
                `Nouveau message : "${msg.text?.substring(0, 45) || 'Pièce jointe'}"`,
                chatUrl,
                '💬'
              );
              showSystemNotification(
                "Nouveau Message",
                msg.text?.substring(0, 60) || "Vous avez reçu un nouveau message.",
                chatUrl
              );
            }
          }
        }
      });
    }, (err: any) => {
      console.warn("Messages sync error:", err.message);
    });
    unsubscribers.push(unsubMessages);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, role, navigate]);

  return null;
}
