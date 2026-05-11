import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Read config
const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function createAdmin() {
  const email = "admin@pharmaply.com";
  const password = "Password123";

  let userCredential;
  try {
    console.log("Attempting to create admin account...");
    userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("User created successfully!");
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("Email already in use, trying to sign in to update password if needed, or assume it exists.");
      userCredential = await signInWithEmailAndPassword(auth, email, password).catch(err => {
         console.error("Wrong password or failed to sign in. Please reset password from Firebase Console if needed.", err);
         process.exit(1);
      });
      console.log("Signed in successfully to existing account.");
    } else {
      console.error("Error creating user:", error);
      process.exit(1);
    }
  }

  const user = userCredential.user;
  console.log("Setting firestore document for admin...");
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    name: 'Admin User',
    role: 'admin',
    createdAt: serverTimestamp()
  });

  console.log("Admin account successfully ensured in Firestore!");
  process.exit(0);
}

createAdmin();
