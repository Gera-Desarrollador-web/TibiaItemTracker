// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBpGcGWyeGcekPgfip9_Eegd3Q7e0gfej8",
  authDomain: "itemstbia.firebaseapp.com",
  projectId: "itemstbia",
  storageBucket: "itemstbia.firebasestorage.app",
  messagingSenderId: "695352213442",
  appId: "1:695352213442:web:751fc25d2f87a4636f205b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 👉 Exporta Firestore para poder usarlo en tu App.jsx
export const db = getFirestore(app);
