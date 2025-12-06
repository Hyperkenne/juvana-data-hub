import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAHywez4ICVGjeRPBnLXRULN9f_NUOit6I",
  authDomain: "juvana-895bf.firebaseapp.com",
  projectId: "juvana-895bf",
  storageBucket: "juvana-895bf.firebasestorage.app",
  messagingSenderId: "578622151084",
  appId: "1:578622151084:web:3af8267f87ddf76cc70209",
  measurementId: "G-J531HD3CQY"
};

export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
