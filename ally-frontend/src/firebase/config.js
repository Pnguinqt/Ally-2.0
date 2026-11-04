
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDikLb4sudYlxXLaaFJCkoes4jwSxViB5c",
  authDomain: "ally-legal-assistant.firebaseapp.com",
  projectId: "ally-legal-assistant",
  storageBucket: "ally-legal-assistant.firebasestorage.app",
  messagingSenderId: "887162634306",
  appId: "1:887162634306:web:b99f0dc72ee17d5f64eddb"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);
