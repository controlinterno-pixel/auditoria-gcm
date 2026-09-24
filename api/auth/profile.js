// api/auth/profile.js - Actualización segura de perfiles en el servidor
import { adminDb } from '../_lib/firebaseAdmin.js';
import { requireAuth } from '../_lib/authMiddleware.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  // 🔒 1. Validar sesión HttpOnly en el servidor
  const user = await requireAuth(req, res);
  if (!user) return; // Si falla la sesión, la función se detiene aquí

  try {
    const { nombreResponsable, procesoAsignado, cargo } = req.body;

    // 🛡️ 2. Filtrar únicamente los campos permitidos.
    // NUNCA permitimos que el usuario envíe o modifique la propiedad "rol" desde este endpoint.
    const datosActualizar = {
      nombreResponsable: nombreResponsable || user.nombreResponsable,
      procesoAsignado: procesoAsignado || '',
      cargo: cargo || '',
      ultimaActualizacion: new Date().toISOString()
    };

    // 3. Escribir los cambios en la colección usuarios usando el UID extraído del token verificado
    await adminDb.collection('usuarios').doc(user.uid).set(datosActualizar, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado correctamente.',
      user: {
        ...user,
        ...datosActualizar
      }
    });

  } catch (error) {
    console.error("❌ Error en api/auth/profile.js:", error);
    return res.status(500).json({ error: 'Error interno al actualizar el perfil.' });
  }
}