// api/_lib/authMiddleware.js
import { parse } from 'cookie';
import { adminAuth, adminDb } from './firebaseAdmin.js';

export const requireAuth = async (req, res) => {
  const cookies = parse(req.headers.cookie || '');
  const sessionCookie = cookies.grc_session;

  if (!sessionCookie) {
    res.status(401).json({ error: 'Falta sesión HttpOnly de servidor.' });
    return null;
  }

  try {
    // CAMBIO ARQUITECTÓNICO: checkForRevocation en 'false' para evitar fallos de red en cada petición.
    // La firma de la cookie se valida criptográficamente de forma local y síncrona.
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, false);
    
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      res.status(403).json({ error: 'Dominio no autorizado.' });
      return null;
    }

   // PEGAR ESTA LÍNEA HASTA ARRIBA (Debajo de los imports)
const authCache = new Map();

// PEGAR ESTO DENTRO DEL TRY (Reemplazando lo que borraste)
    const uid = decodedToken.uid;
    const now = Date.now();

    // 1. Escudo de Caché: Si el usuario ya se autenticó en los últimos 3 minutos en esta instancia, no ir a la BD.
    if (authCache.has(uid)) {
      const cached = authCache.get(uid);
      if (now - cached.timestamp < 180000) return cached.data; // 3 minutos de vida
    }

    // 2. Si no está en caché, ir a Firestore (Una sola vez por sesión activa)
    const userDoc = await adminDb.collection('usuarios').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const sessionData = {
      uid: uid,
      email: decodedToken.email,
      rol: userData.rol || 'lider',
      cargo: userData.cargo || '',
      nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC',
      permisos: Array.isArray(userData.permisos) ? userData.permisos : [],
      procesoAsignado: userData.procesoAsignado || '',
      subprocesoAsignado: userData.subprocesoAsignado || '',
      procesosAsignados: Array.isArray(userData.procesosAsignados) ? userData.procesosAsignados : [],
      subprocesosAsignados: Array.isArray(userData.subprocesosAsignados) ? userData.subprocesosAsignados : [],
    };

    // 3. Guardar en memoria y retornar
    authCache.set(uid, { timestamp: now, data: sessionData });
    return sessionData;
  } catch (error) {
    console.error("❌ Error de autenticación en middleware:", error);
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return null;
  }
};