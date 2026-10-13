// api/_lib/authMiddleware.js
import { parse } from 'cookie';
import { adminAuth, adminDb } from './firebaseAdmin.js';

const authCache = new Map();
const AUTH_CACHE_TTL_MS = 30_000;
const AUTH_CACHE_MAX_ENTRIES = 1000;

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

    const uid = decodedToken.uid;
    const now = Date.now();

    const cached = authCache.get(uid);
    if (cached && now - cached.timestamp < AUTH_CACHE_TTL_MS) {
      return cached.data;
    }
    if (cached) authCache.delete(uid);

    const userDoc = await adminDb.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      res.status(403).json({ error: 'El perfil de acceso no existe.' });
      return null;
    }
    const userData = userDoc.exists ? userDoc.data() : {};
    if (userData.estadoAcceso && userData.estadoAcceso !== 'activo') {
      res.status(403).json({ error: 'El acceso está pendiente de aprobación.' });
      return null;
    }

    const sessionData = {
      uid: uid,
      email: decodedToken.email,
      rol: userData.rol || 'lider',
      cargo: userData.cargo || '',
      nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC',
      permisos: Array.isArray(userData.permisos) ? userData.permisos : [],
      estadoAcceso: userData.estadoAcceso || 'activo',
      procesoAsignado: userData.procesoAsignado || '',
      subprocesoAsignado: userData.subprocesoAsignado || '',
      procesosAsignados: Array.isArray(userData.procesosAsignados) ? userData.procesosAsignados : [],
      subprocesosAsignados: Array.isArray(userData.subprocesosAsignados) ? userData.subprocesosAsignados : [],
    };

    if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
      const oldestUid = authCache.keys().next().value;
      if (oldestUid) authCache.delete(oldestUid);
    }
    authCache.set(uid, { timestamp: now, data: sessionData });
    return sessionData;
  } catch (error) {
    console.error("❌ Error de autenticación en middleware:", error);
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return null;
  }
};