import { useState, useEffect } from 'react';
import { 
  db, auth, supabase, doc, getDoc, updateDoc, setDoc, 
  collection, query, where, getDocs, onSnapshot 
} from './firebase';

export interface UserProfileData {
  id: string;
  name: string;
  displayName: string;
  fullName: string;
  photoUrl: string;
  photoURL: string;
  phone?: string;
  role?: string;
  email?: string;
}

// Global in-memory cache and subscribers for real-time reactivity
const profileCache: Record<string, UserProfileData> = {};
const profileListeners: Record<string, Set<(profile: UserProfileData) => void>> = {};
const activeUnsubscribes: Record<string, () => void> = {};

/**
 * Subscribe to a user document in Firestore to receive real-time name and photo updates.
 */
export function subscribeToUserProfile(userId: string, callback?: (p: UserProfileData) => void): () => void {
  if (!userId || userId === 'anonymous') return () => {};

  if (!profileListeners[userId]) {
    profileListeners[userId] = new Set();
  }
  if (callback) {
    profileListeners[userId].add(callback);
    // If cached already, notify immediately
    if (profileCache[userId]) {
      callback(profileCache[userId]);
    }
  }

  // If we don't have an active Firestore snapshot listener for this user, start one
  if (!activeUnsubscribes[userId]) {
    try {
      const userRef = doc(db, 'users', userId);
      const unsub = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const resolvedName = data.name || data.fullName || data.displayName || data.profileDetails?.fullName || 'Client';
          const resolvedPhoto = data.photoURL || data.photoUrl || data.avatar_url || data.avatar || '';
          
          const profile: UserProfileData = {
            id: userId,
            name: resolvedName,
            displayName: resolvedName,
            fullName: resolvedName,
            photoUrl: resolvedPhoto,
            photoURL: resolvedPhoto,
            phone: data.phone || data.profileDetails?.phoneNumber || '',
            role: data.role || 'patient',
            email: data.email || ''
          };

          profileCache[userId] = profile;

          // Notify all registered listeners
          profileListeners[userId]?.forEach(listener => {
            try { listener(profile); } catch (e) { console.error(e); }
          });
        }
      }, (err) => {
        console.warn(`User listener error for ${userId}:`, err);
      });

      activeUnsubscribes[userId] = unsub;
    } catch (e) {
      console.warn(`Failed to attach listener for user ${userId}:`, e);
    }
  }

  return () => {
    if (callback && profileListeners[userId]) {
      profileListeners[userId].delete(callback);
    }
  };
}

/**
 * Hook to resolve multiple user IDs in real-time.
 */
export function useUserProfiles(userIds: (string | undefined | null)[]): Record<string, UserProfileData> {
  const [profiles, setProfiles] = useState<Record<string, UserProfileData>>(() => {
    const initial: Record<string, UserProfileData> = {};
    userIds.forEach(id => {
      if (id && profileCache[id]) {
        initial[id] = profileCache[id];
      }
    });
    return initial;
  });

  const validIdsKey = Array.from(new Set(userIds.filter(Boolean))).sort().join(',');

  useEffect(() => {
    const ids = Array.from(new Set(userIds.filter(Boolean))) as string[];
    if (ids.length === 0) return;

    const unsubs: (() => void)[] = [];

    ids.forEach(uid => {
      const unsub = subscribeToUserProfile(uid, (updatedProfile) => {
        setProfiles(prev => ({
          ...prev,
          [uid]: updatedProfile
        }));
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [validIdsKey]);

  return profiles;
}

/**
 * Hook for a single user's real-time profile.
 */
export function useUserProfile(userId: string | undefined | null): UserProfileData | null {
  const [profile, setProfile] = useState<UserProfileData | null>(() => {
    return (userId && profileCache[userId]) ? profileCache[userId] : null;
  });

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const unsub = subscribeToUserProfile(userId, (updated) => {
      setProfile(updated);
    });

    return () => {
      unsub();
    };
  }, [userId]);

  return profile;
}

/**
 * Updates the user's profile and cascades the updated name and photo across all 
 * orders, prescriptions, and user documents in Firestore/Supabase so that
 * the changes persist and display immediately everywhere.
 */
export async function updateUserProfileAndCascade(
  userId: string, 
  updates: {
    name?: string;
    displayName?: string;
    fullName?: string;
    photoURL?: string;
    photoUrl?: string;
    phone?: string;
    phoneNumber?: string;
    [key: string]: any;
  }
) {
  if (!userId) return;

  const newName = (updates.name || updates.displayName || updates.fullName || '').trim();
  const newPhoto = updates.photoURL || updates.photoUrl || '';
  const newPhone = updates.phone || updates.phoneNumber || '';

  // 1. Prepare user document payload
  const userPayload: any = {
    updatedAt: new Date().toISOString()
  };

  if (newName) {
    userPayload.name = newName;
    userPayload.displayName = newName;
    userPayload.fullName = newName;
  }
  if (newPhoto !== undefined) {
    userPayload.photoURL = newPhoto;
    userPayload.photoUrl = newPhoto;
    userPayload.avatar_url = newPhoto;
    userPayload.avatar = newPhoto;
  }
  if (newPhone) {
    userPayload.phone = newPhone;
  }

  // Update in Firestore users collection
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, userPayload, { merge: true });
  } catch (e) {
    console.error("Error updating user document:", e);
  }

  // 2. Update Supabase Auth metadata and currentUser
  try {
    if (auth.currentUser && auth.currentUser.uid === userId) {
      if (newName) auth.currentUser.displayName = newName;
      if (newPhoto) auth.currentUser.photoURL = newPhoto;
    }
    await supabase.auth.updateUser({
      data: {
        ...(newName ? { displayName: newName, name: newName, fullName: newName } : {}),
        ...(newPhoto ? { photoURL: newPhoto, photoUrl: newPhoto, avatar_url: newPhoto } : {})
      }
    });
  } catch (e) {
    console.warn("Supabase auth updateUser warning:", e);
  }

  // Update local memory cache immediately
  if (profileCache[userId]) {
    profileCache[userId] = {
      ...profileCache[userId],
      ...(newName ? { name: newName, displayName: newName, fullName: newName } : {}),
      ...(newPhoto ? { photoUrl: newPhoto, photoURL: newPhoto } : {}),
      ...(newPhone ? { phone: newPhone } : {})
    };
    profileListeners[userId]?.forEach(l => l(profileCache[userId]));
  }

  // 3. CASCADE to all orders where patientId == userId or userId == userId
  try {
    const orderUpdates: any = {};
    if (newName) orderUpdates.patientName = newName;
    if (newPhoto) {
      orderUpdates.patientPhoto = newPhoto;
      orderUpdates.patientPhotoUrl = newPhoto;
    }
    if (newPhone) orderUpdates.patientPhone = newPhone;

    if (Object.keys(orderUpdates).length > 0) {
      // Query by patientId
      const q1 = query(collection(db, 'orders'), where('patientId', '==', userId));
      const s1 = await getDocs(q1);
      const updatePromises = s1.docs.map(d => updateDoc(doc(db, 'orders', d.id), orderUpdates).catch(() => {}));
      
      // Query by userId (if different)
      const q2 = query(collection(db, 'orders'), where('userId', '==', userId));
      const s2 = await getDocs(q2);
      const updatePromises2 = s2.docs.map(d => updateDoc(doc(db, 'orders', d.id), orderUpdates).catch(() => {}));

      await Promise.all([...updatePromises, ...updatePromises2]);
    }
  } catch (e) {
    console.warn("Could not cascade updates to orders:", e);
  }

  // 4. CASCADE to prescriptions
  try {
    const prescUpdates: any = {};
    if (newName) prescUpdates.patientName = newName;
    if (newPhoto) {
      prescUpdates.patientPhoto = newPhoto;
      prescUpdates.patientPhotoUrl = newPhoto;
    }
    if (newPhone) prescUpdates.patientPhone = newPhone;

    if (Object.keys(prescUpdates).length > 0) {
      const qP = query(collection(db, 'prescriptions'), where('patientId', '==', userId));
      const sP = await getDocs(qP);
      const pPromises = sP.docs.map(d => updateDoc(doc(db, 'prescriptions', d.id), prescUpdates).catch(() => {}));
      await Promise.all(pPromises);
    }
  } catch (e) {
    console.warn("Could not cascade updates to prescriptions:", e);
  }

  // Dispatch custom window event
  window.dispatchEvent(new CustomEvent('user_profile_updated', {
    detail: { userId, name: newName, photoURL: newPhoto, phone: newPhone }
  }));
}
