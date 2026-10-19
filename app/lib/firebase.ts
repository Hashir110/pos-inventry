import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const cleanString = (val?: string) => val?.trim();
const cleanDomain = (val?: string) =>
  val ? val.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "") : undefined;

const firebaseConfig = {
  apiKey: cleanString(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: cleanDomain(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: cleanString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: cleanDomain(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanString(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanString(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: cleanString(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

if (typeof window !== "undefined" && (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey === "AIzaSyDummyKeyForVercelBuildOnly12345")) {
  console.error("⚠️ Firebase API Key missing or using dummy fallback! Please add NEXT_PUBLIC_FIREBASE_API_KEY in your deployment environment variables and redeploy.");
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const createFirestore = (): Firestore => {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
};

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = createFirestore();
