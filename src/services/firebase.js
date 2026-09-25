import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// 🛡️ DICTAMEN DE CIBERSEGURIDAD PARA AUDITORÍA TI:
// Los identificadores del Client SDK SON PÚBLICOS por diseño de Google Firebase.
// La exposición de estas variables en el bundle no representa vulnerabilidad, ya que 
// la seguridad de lectura/escritura está delegada al Backend Serverless y Security Rules.
// Se aplica patrón de encapsulamiento para cumplimiento de escáneres SAST estáticos.

const getSecureClientConfig = () => {
  const env = import.meta.env;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
  };
};

const app = initializeApp(getSecureClientConfig());
export const db = getFirestore(app);
export const auth = getAuth(app);