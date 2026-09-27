import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

// Patrón Fail-Fast: Validar secretos antes de arrancar
const requeridos = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const faltantes = requeridos.filter(key => !process.env[key]);

if (faltantes.length > 0) {
  const msg = `CRITICAL: Faltan secretos de infraestructura: ${faltantes.join(', ')}`;
  logger?.error ? logger.error(msg) : console.error(msg);
  throw new Error(msg);
}
if (!getApps().length) {
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    logger?.info ? logger.info('Firebase Admin SDK conectado de forma segura.') : console.log('Firebase conectado.');
  } catch (error) {
    logger?.error ? logger.error('Fallo al inicializar Firebase Admin', error) : console.error(error);
    throw error;
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();