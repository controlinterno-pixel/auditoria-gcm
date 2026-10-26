// api/grc/upload.js - Carga segura de evidencias y soportes en el servidor
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

// 🛡️ Mantenemos el límite ampliado en Vercel para que no tire Error 413
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const EXTENSIONES_PERMITIDAS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'docx'];
const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // Límite de 7MB en Base64 para evitar 413 en Termales
const APLICACION_REPOSITORIO = 'controlInterno';
const TIPOS_POR_EXTENSION = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};
// Base64 puro o con prefijo data:<tipo>;base64, (el cliente puede enviar cualquiera de los dos).
const BASE64_VALIDO = /^(data:[\w.+-]+\/[\w.+-]+;base64,)?[A-Za-z0-9+/]+={0,2}$/;

const sanitizarNombreArchivo = (nombre = '') => {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
};

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Método no permitido. Usa POST.', 405);
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { fileName, fileType, fileBase64 } = req.body || {};

    if (!fileBase64 || typeof fileBase64 !== 'string' || !fileName || typeof fileName !== 'string' || fileName.length > 255) {
      return sendError(res, 'Falta la información del archivo o el nombre es inválido.', 400);
    }

    const nombreSeguro = sanitizarNombreArchivo(fileName);
    if (!nombreSeguro) {
      return sendError(res, 'El nombre del archivo no es válido para el repositorio corporativo.', 400);
    }

    if (fileBase64.length > MAX_BASE64_LENGTH) {
      return sendError(res, 'El archivo excede el tamaño máximo permitido para el repositorio corporativo.', 413);
    }

    const ext = nombreSeguro.split('.').pop().toLowerCase().trim();
    if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
      return sendError(res, `Formato de archivo .${ext} no permitido por políticas de seguridad GRC.`, 400);
    }
    // 🛡️ El tipo declarado debe corresponder a la extensión, y el contenido debe ser Base64 válido.
    const tipoArchivo = typeof fileType === 'string' && fileType ? fileType.toLowerCase() : TIPOS_POR_EXTENSION[ext][0];
    if (!TIPOS_POR_EXTENSION[ext].includes(tipoArchivo)) {
      return sendError(res, `El tipo del archivo no corresponde a un .${ext}.`, 400);
    }
    if (!BASE64_VALIDO.test(fileBase64)) {
      return sendError(res, 'El contenido del archivo no tiene un formato válido.', 400);
    }

    const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload?appName=controlInterno', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: nombreSeguro,
        fileType: tipoArchivo,
        fileData: fileBase64,
        subidoPor: user.email,
        appName: APLICACION_REPOSITORIO
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Fallo en servidor Termales', null, { status: response.status, fileName: nombreSeguro, usuario: user.email, errorText: errorText.slice(0, 500) });
      return sendError(res, 'El repositorio de archivos no aceptó el archivo. Intenta de nuevo; si persiste, avisa al administrador.', 502);
    }

    const data = await response.json();
    logger.info('Evidencia subida con éxito', { fileName: nombreSeguro, usuario: user.email });

    return sendSuccess(res, {
      success: true,
      url: data.url || data.path || '',
      appName: data.appName || APLICACION_REPOSITORIO,
      fileName: data.fileName || nombreSeguro,
      message: 'Evidencia validada y almacenada con éxito.'
    });

  } catch (error) {
    logger.error('Error en api/grc/upload.js', error, { endpoint: req.url });
    return sendError(res, 'No se pudo subir el archivo. Intenta de nuevo; si persiste, avisa al administrador.', 500);
  }
}