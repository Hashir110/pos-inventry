import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
 apiKey: "AIzaSyA8MJjcuz3SWufasdjQIEllj5VV56L82ms",
  authDomain: "pos-inventry.firebaseapp.com",
  projectId: "pos-inventry",
  storageBucket: "pos-inventry.firebasestorage.app",
  messagingSenderId: "813797999412",
  appId: "1:813797999412:web:42f2ad1cf920445a369b61",
  measurementId: "G-W7FHR3YTGY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exports
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);