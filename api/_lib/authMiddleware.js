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
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      res.status(403).json({ error: 'Dominio no autorizado.' });
      return null;
    }

    // Obtener datos del usuario desde Firestore
    const userDoc = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      rol: userData.rol || 'lider',
      nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC'
    };
  } catch (error) {
    console.error("❌ Error de autenticación en middleware:", error);
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return null;
  }
};