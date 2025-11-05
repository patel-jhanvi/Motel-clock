// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyBfDBgnBxiNLfEyw1RocHvHKZaR27wOEmQ",
    authDomain: "motel-clock.firebaseapp.com",
    projectId: "motel-clock",
    storageBucket: "motel-clock.firebasestorage.app",
    messagingSenderId: "904539953812",
    appId: "1:904539953812:web:5913904fc9b71be98b7281",
    measurementId: "G-LHNLW8L0GK"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
