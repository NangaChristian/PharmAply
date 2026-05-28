import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'placeholder';

const customFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  if (supabaseUrl === 'https://placeholder.supabase.co') {
    console.warn(`[Supabase Mock] Intercepted fetch to ${url}`);
    
    // Provide a basic mock response for session/auth checks so the app doesn't crash completely.
    if (typeof url === 'string' && url.includes('/auth/v1/user')) {
       return new Response(JSON.stringify({ user: null }), { status: 200, headers: {'Content-Type': 'application/json'} });
    }
    
    // For other requests, fail gracefully.
    return new Response(JSON.stringify({ error: "Supabase not configured locally." }), { status: 400, headers: {'Content-Type': 'application/json'} });
  }
  
  try {
    return await fetch(url, options);
  } catch (error) {
    // Return a mocked dummy response so it doesn't leave an uncaught promise
    // Mute network fetch failures in console if they are blocked by adblockers or offline
    if (typeof url === 'string' && url.includes('select=')) {
       return new Response(JSON.stringify([]), { status: 200, headers: {'Content-Type': 'application/json'} });
    }
    return new Response(JSON.stringify({ error: 'Network fetch failed' }), { status: 400, headers: {'Content-Type': 'application/json'} });
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: customFetch
  }
});
export const initializeApp = () => supabase;

export type User = any;

// --- AUTH --- //
export const auth: any = {
  currentUser: null,
};

export const getAuth = () => auth;

export const onAuthStateChanged = (authObj: any, cb: (user: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      auth.currentUser = {
        uid: session.user.id,
        email: session.user.email,
        emailVerified: session.user.email_confirmed_at != null,
        displayName: session.user.user_metadata?.displayName,
        photoURL: session.user.user_metadata?.photoURL,
      };
      cb(auth.currentUser);
    } else {
      auth.currentUser = null;
      cb(null);
    }
  });
  // Trigger immediately
  supabase.auth.getSession().then(({data}) => {
    if (data.session?.user) {
      auth.currentUser = {
        uid: data.session.user.id,
        email: data.session.user.email,
        emailVerified: data.session.user.email_confirmed_at != null,
        displayName: data.session.user.user_metadata?.displayName,
        photoURL: data.session.user.user_metadata?.photoURL,
      };
      cb(auth.currentUser);
    } else {
      auth.currentUser = null;
      cb(null);
    }
  }).catch((err) => {
    console.warn("Failed to get auth session (possibly missing config or network issue):", err);
    auth.currentUser = null;
    cb(null);
  });

  return () => { subscription.unsubscribe() };
};

export const signInWithEmailAndPassword = async (authObj: any, email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) {
    const err: any = new Error(error.message);
    if (error.message.includes('Invalid login credentials')) err.code = 'auth/invalid-credential';
    if (error.message.includes('Email not confirmed')) err.code = 'auth/unverified-email';
    throw err;
  }
  return { user: { uid: data.user.id, email: data.user.email } };
};

export const createUserWithEmailAndPassword = async (authObj: any, email: string, pass: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) {
    const err: any = new Error(error.message);
    if (error.message.includes('already registered')) err.code = 'auth/email-already-in-use';
    throw err;
  }
  return { user: { uid: data.user?.id, email: data.user?.email } };
};

export const signOut = async (authObj: any) => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

export const updateProfile = async (userObj: any, profile: { displayName?: string, photoURL?: string }) => {
  const { error } = await supabase.auth.updateUser({
    data: {
      displayName: profile.displayName,
      photoURL: profile.photoURL
    }
  });
  if (error) throw new Error(error.message);
};

export const sendPasswordResetEmail = async (authObj: any, email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);
};

export const signInWithPopup = async (authObj: any, provider: any) => {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: provider.providerName });
  if (error) throw new Error(error.message);
  return data;
};

export const GoogleAuthProvider = class { providerName = 'google'; };
export const googleProvider = new GoogleAuthProvider();
export const setPersistence = async () => {};
export const browserLocalPersistence = {};


// --- FIRESTORE --- //
export const db = supabase;
export const getFirestore = () => db;

class MockTimestamp {
  seconds: number;
  nanoseconds: number;
  constructor(date: Date) {
    this.seconds = Math.floor(date.getTime() / 1000);
    this.nanoseconds = (date.getTime() % 1000) * 1000000;
  }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1000000; }
  toDate() { return new Date(this.toMillis()); }
}

export const serverTimestamp = () => new Date().toISOString(); 

export const collection = (dbObj: any, path: string) => {
  return { type: 'collection', path, table: path.split('/')[0] };
};

const genId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const doc = (dbObj: any, pathOrCollection: any, ...segments: string[]) => {
  let table = '';
  let id = '';
  if (typeof pathOrCollection === 'string') {
    const parts = [pathOrCollection, ...segments].join('/').split('/');
    table = parts[0];
    id = parts[1] || genId();
  } else {
    table = pathOrCollection.table;
    id = segments[0] || genId();
  }
  return { type: 'doc', table, id, path: `${table}/${id}` };
};

export const getDoc = async (docRef: any) => {
  const { data, error } = await supabase.from(docRef.table).select('*').eq('id', docRef.id).maybeSingle();
  return {
    id: docRef.id,
    exists: () => !!data,
    data: () => {
      if (!data) return undefined;
      const parsed: any = { ...(data.data || {}) };
      for (const k in parsed) {
         if (typeof parsed[k] === 'string' && parsed[k].includes('T') && parsed[k].endsWith('Z')) {
            const d = new Date(parsed[k]);
            if (!isNaN(d.getTime())) parsed[k] = new MockTimestamp(d);
         }
      }
      return parsed;
    }
  };
};

export const setDoc = async (docRef: any, documentData: any, options: { merge?: boolean } = {}) => {
  let finalData = { ...documentData };
  if (options.merge) {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
          finalData = { ...existing.data(), ...documentData };
      }
  }
  const payload = { id: docRef.id, data: finalData };
  const { error } = await supabase.from(docRef.table).upsert(payload);
  if (error) throw new Error(error.message);
};

export const updateDoc = async (docRef: any, documentData: any) => {
  const existing = await getDoc(docRef);
  let finalData = { ...documentData };
  if (existing.exists()) {
      finalData = { ...existing.data(), ...documentData };
  }
  const payload = { id: docRef.id, data: finalData };
  const { error } = await supabase.from(docRef.table).update(payload).eq('id', docRef.id);
  if (error) throw new Error(error.message);
};

export const deleteDoc = async (docRef: any) => {
  const { error } = await supabase.from(docRef.table).delete().eq('id', docRef.id);
  if (error) throw new Error(error.message);
};

export const addDoc = async (collRef: any, documentData: any) => {
  const id = genId();
  const payload = { id, data: documentData };
  const { error } = await supabase.from(collRef.table).insert(payload);
  if (error) throw new Error(error.message);
  return doc(db, collRef.table, id);
};

export const query = (collRef: any, ...constraints: any[]) => {
  return { type: 'query', table: collRef.table, constraints };
};

export const where = (field: string, op: string, val: any) => {
  return { type: 'where', field, op, val };
};

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => {
  return { type: 'orderBy', field, direction };
};

export const limit = (n: number) => {
  return { type: 'limit', n };
};

export const getDocs = async (queryRef: any) => {
  const table = queryRef.table;
  let builder: any = supabase.from(table).select('*');
  
  if (queryRef.constraints) {
    for (const c of queryRef.constraints) {
      if (c.type === 'where') {
        const fieldName = `data->>${c.field}`;
        if (c.op === '==') builder = builder.eq(fieldName, c.val);
        else if (c.op === '>') builder = builder.gt(fieldName, c.val);
        else if (c.op === '<') builder = builder.lt(fieldName, c.val);
        else if (c.op === '>=') builder = builder.gte(fieldName, c.val);
        else if (c.op === '<=') builder = builder.lte(fieldName, c.val);
        else if (c.op === '!=') builder = builder.neq(fieldName, c.val);
        else if (c.op === 'array-contains') builder = builder.contains(`data->${c.field}`, [c.val]);
        else if (c.op === 'in') builder = builder.in(fieldName, c.val);
      } else if (c.type === 'orderBy') {
        builder = builder.order(`data->>${c.field}`, { ascending: c.direction === 'asc' });
      } else if (c.type === 'limit') {
        builder = builder.limit(c.n);
      }
    }
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  const docs = (data || []).map((d: any) => {
     const parsed: any = { ...(d.data || {}) };
     for (const k in parsed) {
         if (typeof parsed[k] === 'string' && parsed[k].includes('T') && parsed[k].endsWith('Z')) {
            const date = new Date(parsed[k]);
            if (!isNaN(date.getTime())) parsed[k] = new MockTimestamp(date);
         }
     }
     return {
        id: d.id,
        data: () => parsed,
        ref: { id: d.id }
     };
  });

  return { 
    docs: docs as any[], 
    empty: docs.length === 0, 
    size: docs.length,
    forEach: (cb: any) => docs.forEach(cb),
    docChanges: () => docs.map((doc: any) => ({ type: 'added', doc }))
  };
};

export const onSnapshot = (queryRef: any, callback: any, errorCallback?: any) => {
  const table = queryRef.table;
  let prevDocs: Map<string, any> = new Map();

  const fetchAndNotify = async () => {
    try {
      if (queryRef.type === 'doc') {
         const snap = await getDoc(queryRef);
         callback(snap);
         return;
      }
      
      const snap = await getDocs(queryRef);
      const newDocsMap = new Map();
      const changes: any[] = [];
      
      snap.docs.forEach((doc: any) => {
         newDocsMap.set(doc.id, doc);
         if (!prevDocs.has(doc.id)) {
            changes.push({ type: 'added', doc });
         } else {
            const prevDoc = prevDocs.get(doc.id);
            if (JSON.stringify(prevDoc.data()) !== JSON.stringify(doc.data())) {
               changes.push({ type: 'modified', doc });
            }
         }
      });
      
      prevDocs.forEach((doc: any, id: string) => {
         if (!newDocsMap.has(id)) {
            changes.push({ type: 'removed', doc });
         }
      });
      
      prevDocs = newDocsMap;
      
      const snapshotWithChanges = {
        ...snap,
        docChanges: () => changes
      };
      
      callback(snapshotWithChanges);
    } catch (e) {
      if (errorCallback) errorCallback(e);
      else console.error(e);
    }
  };

  fetchAndNotify();

  const channel = supabase.channel(`public:${table}-${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      fetchAndNotify();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// --- STORAGE --- //
export const storage = { type: 'storage' };
export const getStorage = () => storage;

export const ref = (storageObj: any, path: string) => {
  return { type: 'ref', path };
};

export const uploadBytesResumable = (storageRef: any, file: File | Blob): any => {
  const parts = storageRef.path.split('/');
  let bucketName = parts.length > 1 ? parts[0] : 'main'; 
  let objectPath = parts.length > 1 ? parts.slice(1).join('/') : storageRef.path;
  
  const knownBuckets = ['images', 'drivers', 'pharmacies', 'profiles', 'products', 'prescriptions', 'settings'];
  if (!knownBuckets.includes(bucketName)) {
      bucketName = 'images';
      objectPath = storageRef.path;
  }
  
  const listeners: any = { state_changed: [] };
  
  const task: any = {
    on: (evt: string, ...args: any[]) => {
      if (typeof evt === 'string' && evt === 'state_changed') {
         if(typeof args[0] === 'function') listeners.state_changed.push({ progress: args[0], error: args[1], complete: args[2] });
         else listeners.state_changed.push({ progress: null, error: args[1], complete: args[2] });
      } else {
         listeners.state_changed.push({ progress: null, error: args[0], complete: args[1] });
      }
    },
    snapshot: { ref: storageRef },
    ref: storageRef
  };

  const uploadPromise = new Promise(async (resolve, reject) => {
    try {
      if (supabaseUrl === 'https://placeholder.supabase.co') {
         return reject(new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."));
      }

      const { error } = await supabase.storage.from(bucketName).upload(objectPath, file, {
        upsert: true
      });
      if (error) {
        console.warn("Storage upload error:", error);
        listeners.state_changed.forEach((l:any) => l.error && l.error(new Error(error.message)));
        return reject(new Error(error.message));
      }
      listeners.state_changed.forEach((l:any) => l.complete && l.complete());
      resolve({ ref: storageRef, snapshot: { ref: storageRef } });
    } catch(e: any) {
      console.warn("Storage upload exception:", e);
      listeners.state_changed.forEach((l:any) => l.error && l.error(e));
      reject(e);
    }
  });

  task.then = uploadPromise.then.bind(uploadPromise);
  task.catch = uploadPromise.catch.bind(uploadPromise);
  task.finally = uploadPromise.finally.bind(uploadPromise);

  return task;
};

export const getDownloadURL = async (storageRef: any) => {
  const parts = storageRef.path.split('/');
  let bucketName = parts.length > 1 ? parts[0] : 'main'; 
  let objectPath = parts.length > 1 ? parts.slice(1).join('/') : storageRef.path;

  const knownBuckets = ['images', 'drivers', 'pharmacies', 'profiles', 'products', 'prescriptions', 'settings'];
  if (!knownBuckets.includes(bucketName)) {
      bucketName = 'images';
      objectPath = storageRef.path;
  }

  if ([''].includes(bucketName)) {
    try {
      const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(objectPath, 31536000); // 1 year
      if (error) {
        console.warn("Error creating signed URL, using placeholder:", error);
        return `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(bucketName)}`;
      }
      return data?.signedUrl || '';
    } catch (err) {
      console.warn("Failed to create signed URL (possibly missing bucket or CORS), using placeholder:", err);
      return `https://via.placeholder.com/800x600.png?text=${encodeURIComponent(bucketName)}`;
    }
  }

  if (supabaseUrl === 'https://placeholder.supabase.co') {
    throw new Error("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(objectPath);
  return data.publicUrl;
};

// Types & Utilities
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
export const handleFirestoreError = (error: any, opType: any, path: any) => {
  console.error("Supabase Adapter Error:", opType, path, error);
};
