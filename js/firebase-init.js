// ======================================================
// Craques do Futuro — Inicialização do Firebase
//
// Este projeto não usa npm/bundler, então o SDK é carregado direto do CDN
// (gstatic) via <script type="module">. Esses valores (apiKey, appId etc.)
// são identificadores públicos do app — não são segredos. A segurança real
// vem das Regras do Firestore (firestore.rules), não de esconder esta config.
// ======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBin3b02Qci3Oj7syhRJa5WW31jBogDIM",
  authDomain: "craques-do-futuro.firebaseapp.com",
  projectId: "craques-do-futuro",
  storageBucket: "craques-do-futuro.firebasestorage.app",
  messagingSenderId: "128692084910",
  appId: "1:128692084910:web:c31d0c573b35ffc52e0d3f",
  measurementId: "G-478NZ15C5D"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
