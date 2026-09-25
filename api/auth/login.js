import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';
import { parse, serialize } from 'cookie';

// 🛡️ Memoria en servidor para registrar intentos fallidos por IP (Rate Limiting)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // Ventana de 60 segundos

export default async function handler(req, res) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://auditoria-gcm.vercel.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : [])
  ];
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST.' });

  // 🛡️ Rate Limiting por IP de origen
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();
  const userAttempts = loginAttempts.get(clientIp) || { count: 0, resetTime: now + WINDOW_MS };

  // Reiniciar ventana de tiempo si transcurrieron los 60 segundos
  if (now > userAttempts.resetTime) {
    userAttempts.count = 0;
    userAttempts.resetTime = now + WINDOW_MS;
  }

  // Si supera los 5 intentos, bloquea de inmediato la petición en el servidor
  if (userAttempts.count >= MAX_ATTEMPTS) {
    const secondsLeft = Math.ceil((userAttempts.resetTime - now) / 1000);
    return res.status(429).json({ 
      error: `Demasiados intentos fallidos. Intente nuevamente en ${secondsLeft} segundos.` 
    });
  }

  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Falta idToken' });

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    const decoded = await adminAuth.verifySessionCookie(sessionCookie);

    const userDoc = await adminDb.collection('usuarios').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const isProd = process.env.NODE_ENV === 'production' || (origin && origin.includes('vercel.app'));

    const cookieSerialized = serialize('grc_session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true, // 🔒 Inaccesible para JS del cliente
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });

    // 🟢 Si el inicio de sesión es exitoso, limpiamos el contador de la IP
    loginAttempts.delete(clientIp);

    res.setHeader('Set-Cookie', cookieSerialized);
    return res.status(200).json({
      success: true,
      user: {
        email: decoded.email,
        uid: decoded.uid,
        rol: userData.rol || 'lider',
        nombreResponsable: userData.nombreResponsable || userData.nombre || 'Usuario GRC'
      }
    });
  } catch (error) {
    // 🔴 Si falla la autenticación, incrementamos el contador de intentos fallidos
    userAttempts.count += 1;
    loginAttempts.set(clientIp, userAttempts);

    console.error("❌ Detalle interno en login.js:", error);
    return res.status(401).json({ error: "Autenticación fallida o credenciales inválidas." });
  }
}