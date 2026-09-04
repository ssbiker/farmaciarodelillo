import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCL6Q8ClmEmg4pjtdha4KWnqVKZOCJtuMI",
  authDomain: "landing-cesfamrod.firebaseapp.com",
  projectId: "landing-cesfamrod",
  storageBucket: "landing-cesfamrod.firebasestorage.app",
  messagingSenderId: "218699469194",
  appId: "1:218699469194:web:a50c44e535963e5bc93873"
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
