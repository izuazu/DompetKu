// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCSR-GtSmhv-VhV9uyvLqWVLlhe5952t8Y",
  authDomain: "dompet-7a43e.firebaseapp.com",
  projectId: "dompet-7a43e",
  storageBucket: "dompet-7a43e.firebasestorage.app",
  messagingSenderId: "691139722926",
  appId: "1:691139722926:web:1dac5c61fb760f46c6773f",
  measurementId: "G-7ZK6TY1VF8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);