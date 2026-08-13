import { createClient } from "@supabase/supabase-js";

let supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || (import.meta as any).env.SUPABASE_URL || 'https://placeholder.supabase.co';
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = 'https://' + supabaseUrl;
}
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || (import.meta as any).env.SUPABASE_ANON_KEY || (import.meta as any).env.SUPABASE_KEY || 'placeholder';

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
  
  // Do not catch the fetch error so it bubbles up to Supabase correctly.
  return await fetch(url, options);
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
  supabase.auth.getSession().then(({data, error}) => {
    if (error) {
       if (error.message.includes("Refresh Token Not Found") || error.message.includes("Invalid Refresh Token")) {
          supabase.auth.signOut();
       } else {
          console.warn("Auth session error:", error.message);
       }
    }
    if (data?.session?.user && !error) {
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

export const updatePassword = async (authObj: any, password: string) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
};

export const sendPasswordResetEmail = async (authObj: any, email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/forget-password'
  });
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

const toDatabaseRecord = (table: string, id: string, docData: any) => {
  if (table === 'products') {
     const commName = docData.nom_commercial || docData.commercial_name || docData.name || '';
     return {
        id: id,
        nom_commercial: commName,
        commercial_name: commName,
        dci: docData.description || docData.dci || '',
        dosage: docData.dosage || '',
        form: docData.form || '',
        is_prescription_required: docData.requiresPrescription !== undefined ? !!docData.requiresPrescription : (!!docData.is_prescription_required || false),
        price: docData.price ? Number(docData.price) : 0,
        stock: docData.stock ? Number(docData.stock) : 0,
        pharmacy_id: docData.pharmacyId || docData.pharmacy_id || null,
        ux_category_id: docData.ux_category_id || docData.category_id || null,
        symptoms: docData.symptoms || [],
        created_at: docData.createdAt || docData.created_at || new Date().toISOString()
     };
  }
  if (table === 'produits_patients') {
     return {
        id: id,
        nom_commercial: docData.name || docData.commercial_name || docData.nom_commercial || '',
        dci: docData.description || docData.dci || '',
        dosage: docData.dosage || '',
        form: docData.form || '',
        is_prescription_required: docData.requiresPrescription !== undefined ? !!docData.requiresPrescription : (!!docData.is_prescription_required || false),
        categorie_ux: docData.category || docData.categorie_ux || docData.ux_category || null,
        created_at: docData.createdAt || docData.created_at || new Date().toISOString()
     };
  }
  if (table === 'ux_categories') {
     return {
        id: id,
        name: docData.name || '',
        slug: docData.slug || docData.name?.toLowerCase().replace(/\s+/g, '-') || '',
        icon: docData.icon || '',
        description: docData.description || '',
        created_at: docData.createdAt || docData.created_at || new Date().toISOString()
     };
  }
  return { id, data: docData };
};

const parseRecordData = (table: string, row: any) => {
  if (!row) return undefined;
  let parsed: any;
  if (row.data) {
     parsed = { ...row.data };
  } else if (table === 'products') {
     parsed = {
        name: row.commercial_name || row.nom_commercial || row.name || '',
        commercial_name: row.commercial_name || row.nom_commercial || row.name || '',
        nom_commercial: row.nom_commercial || row.commercial_name || row.name || '',
        description: row.dci || row.description || '',
        dci: row.dci || row.description || '',
        dosage: row.dosage || '',
        form: row.form || '',
        requiresPrescription: row.is_prescription_required !== undefined ? !!row.is_prescription_required : (!!row.requires_prescription || false),
        is_prescription_required: row.is_prescription_required !== undefined ? !!row.is_prescription_required : (!!row.requires_prescription || false),
        price: row.price ? Number(row.price) : 0,
        stock: row.stock || 0,
        imageUrl: row.image_url || row.image || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
        category: row.ux_category_id || '',
        pharmacyId: row.pharmacy_id || null,
        isGlobal: row.is_global !== undefined ? row.is_global : (row.pharmacy_id === null),
        createdAt: row.created_at || null,
        ...row 
     };
  } else if (table === 'produits_patients') {
     parsed = {
        name: row.nom_commercial || row.commercial_name || row.name || '',
        commercial_name: row.nom_commercial || row.commercial_name || row.name || '',
        nom_commercial: row.nom_commercial || row.commercial_name || row.name || '',
        description: row.dci || row.description || '',
        dci: row.dci || row.description || '',
        dosage: row.dosage || '',
        form: row.form || '',
        requiresPrescription: row.is_prescription_required !== undefined ? !!row.is_prescription_required : (!!row.requires_prescription || false),
        is_prescription_required: row.is_prescription_required !== undefined ? !!row.is_prescription_required : (!!row.requires_prescription || false),
        category: row.categorie_ux || row.ux_category || '',
        createdAt: row.created_at || null,
        ...row 
     };
  } else if (table === 'ux_categories') {
     parsed = {
        name: row.name || '',
        slug: row.slug || '',
        icon: row.icon || '',
        description: row.description || '',
        createdAt: row.created_at || null,
        ...row
     };
  } else {
     parsed = { ...row };
     delete parsed.id;
     delete parsed.data;
  }
  for (const k in parsed) {
     if (typeof parsed[k] === 'string' && parsed[k].includes('T') && parsed[k].endsWith('Z')) {
        const date = new Date(parsed[k]);
        if (!isNaN(date.getTime())) parsed[k] = new MockTimestamp(date);
     }
  }
  return parsed;
};

export const getDoc = async (docRef: any) => {
  const { data, error } = await supabase.from(docRef.table).select('*').eq('id', docRef.id).maybeSingle();
  return {
    id: docRef.id,
    exists: () => !!data,
    data: () => parseRecordData(docRef.table, data)
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
  const payload = toDatabaseRecord(docRef.table, docRef.id, finalData);
  const { error } = await supabase.from(docRef.table).upsert(payload as any);
  if (error) throw new Error(error.message);
};

export const updateDoc = async (docRef: any, documentData: any) => {
  const existing = await getDoc(docRef);
  let finalData = { ...documentData };
  if (existing.exists()) {
      finalData = { ...existing.data(), ...documentData };
  }
  const payload = toDatabaseRecord(docRef.table, docRef.id, finalData);
  const { error } = await supabase.from(docRef.table).update(payload as any).eq('id', docRef.id);
  if (error) throw new Error(error.message);
};

export const deleteDoc = async (docRef: any) => {
  const { error } = await supabase.from(docRef.table).delete().eq('id', docRef.id);
  if (error) throw new Error(error.message);
};

export const addDoc = async (collRef: any, documentData: any) => {
  const id = genId();
  const payload = toDatabaseRecord(collRef.table, id, documentData);
  const { error } = await supabase.from(collRef.table).insert(payload as any);
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
  let table = queryRef.table;
  
  // Fallback for ux_categories if the user hasn't run the migration yet
  const isUxCategory = table === 'ux_categories';
  const isStructured = ['products', 'ux_categories', 'produits_patients'].includes(table);
  
  let builder: any = supabase.from(table).select('*');
  
  if (queryRef.constraints) {
    for (const c of queryRef.constraints) {
      if (c.type === 'where') {
        let fieldName = `data->>${c.field}`;
        if (isStructured) {
          if (table === 'products') {
            if (c.field === 'pharmacyId') fieldName = 'pharmacy_id';
            else if (c.field === 'isGlobal') fieldName = 'is_global';
            else if (c.field === 'requiresPrescription') fieldName = 'is_prescription_required';
            else if (c.field === 'category') fieldName = 'ux_category_id';
            else if (c.field === 'name') fieldName = 'commercial_name';
            else if (c.field === 'description') fieldName = 'dci';
            else fieldName = c.field;
          } else {
            fieldName = c.field;
          }
        }
        
        if (c.op === '==') builder = builder.eq(fieldName, c.val);
        else if (c.op === '>') builder = builder.gt(fieldName, c.val);
        else if (c.op === '<') builder = builder.lt(fieldName, c.val);
        else if (c.op === '>=') builder = builder.gte(fieldName, c.val);
        else if (c.op === '<=') builder = builder.lte(fieldName, c.val);
        else if (c.op === '!=') builder = builder.neq(fieldName, c.val);
        else if (c.op === 'array-contains') {
          if (isStructured) {
            builder = builder.contains(fieldName, [c.val]);
          } else {
            builder = builder.contains(`data->${c.field}`, [c.val]);
          }
        }
        else if (c.op === 'in') builder = builder.in(fieldName, c.val);
      } else if (c.type === 'orderBy') {
        let fieldName = `data->>${c.field}`;
        if (isStructured) {
          if (table === 'products') {
             if (c.field === 'name') fieldName = 'commercial_name';
             else if (c.field === 'pharmacyId') fieldName = 'pharmacy_id';
             else fieldName = c.field;
          } else {
             fieldName = c.field;
          }
        }
        builder = builder.order(fieldName, { ascending: c.direction === 'asc' });
      } else if (c.type === 'limit') {
        builder = builder.limit(c.n);
      }
    }
  }

  let { data, error } = await builder;
  
  if (error) {
     // Graceful fallback for unapplied migrations
     if (isUxCategory && error.message.includes('Could not find the table')) {
        console.warn("Table 'ux_categories' not found, falling back to 'categories'. Have you run the SQL migration?");
        const fallbackBuilder = supabase.from('categories').select('*');
        const fallbackResult = await (queryRef.constraints?.find((c:any) => c.type === 'limit') ? fallbackBuilder.limit(queryRef.constraints.find((c:any) => c.type === 'limit').n) : fallbackBuilder);
        data = fallbackResult.data;
        error = fallbackResult.error;
     }
     
     if (error) throw new Error(error.message);
  }

  const docs = (data || []).map((d: any) => {
     const parsed = parseRecordData(table, d);
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
