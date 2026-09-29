// api/grc/upload.js - Carga segura de evidencias y soportes en el servidor
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

// 🛡️️ ARQUITECTURA: Ampliar el límite del bodyParser de Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const EXTENSIONES_PERMITIDAS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'docx'];
const MAX_BASE64_LENGTH = 10 * 1024 * 1024; // Límite de ~7MB en Base64

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { fileName, fileType, fileBase64, appName } = req.body || {};

    if (!fileBase64 || !fileName || typeof fileName !== 'string') {
      return sendError(res, 'Falta la información del archivo o el nombre es inválido.', 400);
    }

    if (fileBase64.length > MAX_BASE64_LENGTH) {
      return sendError(res, 'El archivo excede el tamaño máximo permitido.', 413);
    }

    const ext = fileName.split('.').pop().toLowerCase().trim();
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      return sendError(res, `Formato de archivo .${ext} no permitido por políticas de seguridad GRC.`, 400);
    }

    // Convertimos el Base64 a un Buffer Binario
    const base64Data = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
    const buffer = Buffer.from(base64Data, 'base64');

    // Construimos el formulario (multipart/form-data)
    const blob = new Blob([buffer], { type: fileType || 'application/octet-stream' });
    const formData = new FormData();
    
    // Adjuntamos los datos al FormData
formData.append('file', blob, fileName);
    formData.append('subidoPor', user.email);
    formData.append('appName', appName || 'controlInterno');

    // 🚀 MAGIA AQUÍ: Inyectamos el appName en la URL para que el servidor de Termales lo lea correctamente
    const destinoUrl = `https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${appName || 'controlInterno'}`;

    const response = await fetch(destinoUrl, {
      method: 'POST',
      body: formData
    });

    // 🛡️️ Extraer la respuesta real del servidor de Termales si falla
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Fallo en servidor Termales', { status: response.status, errorText });
      return sendError(res, `Servidor Destino Rechazado (HTTP ${response.status}): ${errorText}`, response.status);
    }

    const data = await response.json();
    logger.info('Evidencia subida con éxito', { fileName, usuario: user.email, appName });

    return sendSuccess(res, {
      success: true,
      url: data.url || data.path || '',
      appName: data.appName || 'controlInterno',
      fileName: data.fileName || fileName,
      message: 'Evidencia validada y almacenada con éxito.'
    });

  } catch (error) {
    logger.error('Error en api/grc/upload.js', error, { endpoint: req.url, detalle: error.message });
    return sendError(res, `Fallo Interno (Vercel/Node): ${error.message}`, 500);
  }
}