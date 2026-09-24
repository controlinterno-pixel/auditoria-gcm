// api/grc/upload.js - Carga segura de evidencias y soportes en el servidor
import { requireAuth } from '../_lib/authMiddleware.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  // 🔒 1. Validar sesión HttpOnly
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    const { fileName, fileType, fileBase64, appName } = req.body;

    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Falta la información del archivo.' });
    }

    // 🛡️ 2. Validar extensiones permitidas (Solo documentos/imágenes válidos para auditoría)
    const extensionesPermitidas = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'docx'];
    const ext = fileName.split('.').pop().toLowerCase();

    if (!extensionesPermitidas.includes(ext)) {
      return res.status(400).json({ 
        error: `Formato de archivo .${ext} no permitido por políticas de seguridad GRC.` 
      });
    }

    // 🚀 3. Reenviar de forma segura desde el servidor hacia el repositorio oficial
    const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload?appName=controlInterno', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName,
        fileType,
        fileData: fileBase64,
        subidoPor: user.email,
        appName: appName || 'controlInterno'
      })
    });

    if (!response.ok) {
      throw new Error(`El repositorio devolvió un estado ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      url: data.url || data.path || '',
      message: 'Evidencia validada y almacenada con éxito.'
    });

  } catch (error) {
    console.error("❌ Error en api/grc/upload.js:", error);
    return res.status(500).json({ error: 'Error interno al procesar y subir el archivo.' });
  }
}