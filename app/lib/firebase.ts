import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Values .env.local se aati hain (template: .env.example)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForVercelBuildOnly12345",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Hot reload par dobara initialize na ho
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Browser mein Firestore ka data IndexedDB mein cache hota hai (multi-tab safe).
 * Is se offline mein products/profile padhe ja sakte hain aur page refresh par blank nahi hota.
 * Server render (IndexedDB nahi) ya dobara initialize par normal Firestore.
 */
const createFirestore = (): Firestore => {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Pehle hi initialize ho chuka (hot reload) ya browser IndexedDB allow nahi karta
    return getFirestore(app);
  }
};

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = createFirestore();
