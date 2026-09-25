import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 🛡️ REGLA: Solo permitimos lectura (GET) y escritura (POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const { parse } = await import('cookie');
    const cookies = parse(req.headers.cookie || '');
    const sessionCookie = cookies.grc_session;

    if (!sessionCookie) {
      return res.status(401).json({ error: 'Falta sesión HttpOnly de servidor.' });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!decodedToken.email || !decodedToken.email.endsWith('@termales.com.co')) {
      return res.status(403).json({ error: 'Dominio no autorizado.' });
    }

    // Obtenemos los roles y datos verdaderos desde el backend
    const userDoc = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const rawRol = String(userData.rol || '').toLowerCase().trim();
    const isAdmin = rawRol === 'admin' || rawRol === 'administrador' || rawRol.includes('admin') || rawRol === 'auditor';

    // =========================================================================
    // 🛡️ LÓGICA GET: LECTURA CON ROW-LEVEL SECURITY (RLS) SERVER-SIDE
    // Cierra el Hallazgo #N1 (Fuga de datos completa en red)
    // =========================================================================
    if (req.method === 'GET') {
      const dbDoc = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
      const data = dbDoc.exists ? dbDoc.data() : {};

      // Si es un alto mando, enviamos todo el documento completo
      if (isAdmin) {
        return res.status(200).json(data);
      }

      // Si es un Líder normal, podamos los datos confidenciales ANTES de responder
      const userEmail = decodedToken.email.toLowerCase();
      const userName = userData.nombreResponsable?.toLowerCase() || userData.nombre?.toLowerCase() || '';
      const userProcess = userData.procesoAsignado;

      const applyRLS = (list = [], keyProceso, keyResp, keyCorreoResp) => {
        return list.filter(item => {
          if (keyCorreoResp && item[keyCorreoResp]?.toLowerCase() === userEmail) return true;
          if (keyResp && userName && item[keyResp]?.toLowerCase().includes(userName)) return true;
          if (keyProceso && userProcess && item[keyProceso] === userProcess) return true;
          return false;
        });
      };

      const filteredData = {
        ...data,
        planes: applyRLS(data.planes || [], 'proceso', 'responsable', 'correoResponsable'),
        hallazgos: applyRLS(data.hallazgos || [], 'proceso', 'responsable', null),
        riesgos: applyRLS(data.riesgos || [], 'proceso', 'responsable', null),
        evaluaciones: applyRLS(data.evaluaciones || [], 'proceso', null, null)
      };

      return res.status(200).json(filteredData);
    }

    // =========================================================================
    // 🛡️ LÓGICA POST: ESCRITURA ESTRICTA
    // Cierra el Hallazgo #6 y #N2 (Escritura no autorizada)
    // =========================================================================
    if (req.method === 'POST') {
      if (!isAdmin) {
        return res.status(403).json({ error: 'Permisos insuficientes. Solo administradores pueden modificar la estructura GRC.' });
      }

      const { partialData } = req.body;
      await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').set(partialData, { merge: true });
      return res.status(200).json({ success: true, message: 'Guardado exitoso.' });
    }

  } catch (error) {
    // 🛡️ MITIGACIÓN HALLAZGO #N3: Mensaje genérico al cliente, detalle en consola de Vercel.
    console.error("❌ Detalle interno en sync.js:", error);
    return res.status(500).json({ error: "Error interno al procesar la base de datos." });
  }
}