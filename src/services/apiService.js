// src/services/apiService.js - Cliente HTTP Centralizado para la API Serverless GRC
import { secureLogger } from './secureLogger.js';

/**
 * Helper privado para ejecutar peticiones HTTP estandarizadas a la API.
 */
const sanitizeServerMessage = (message) => {
  if (!message) return 'Error del servidor.';

  let safe = String(message)
    .replace(/https?:\/\/[^\s]+/gi, '[url-redactada]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redactado]')
    .replace(/(?:[A-Za-z]:)?(?:\\|\/)[^\s]+/g, '[ruta-redactada]');

  if (safe.length > 180) {
    safe = `${safe.slice(0, 170)}...`;
  }

  return safe || 'Error del servidor.';
};

async function request(endpoint, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    method: 'GET',
    credentials: 'include', // 🔒 OBLIGATORIO: Transmite cookies HttpOnly (grc_session)
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(endpoint, config);

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Si la respuesta no es un JSON válido o viene vacía, data permanece como null
  }

  if (!response.ok) {
    const rawMessage = data?.error || data?.message || data?.details || `Error HTTP ${response.status}`;
    throw new Error(sanitizeServerMessage(rawMessage));
  }

  return data;
}

// 🖼️ Helper privado: Comprime imágenes en el navegador antes de convertirlas a Base64
const comprimirImagen = (file, maxWidth = 1000, quality = 0.6) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
    };
  });
};

const sanitizarNombreArchivo = (nombre = '') => {
  const base = String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();

  return base || 'archivo';
};

const enmascararNombreArchivo = (nombre = '') => {
  const valor = String(nombre || '').trim();
  if (!valor) return 'archivo';

  const extension = valor.includes('.') ? `.${valor.split('.').pop()}` : '';
  const base = valor.replace(new RegExp(`${extension.replace('.', '\.')}$`), '');

  if (base.length <= 4) return '***';
  return `${base.slice(0, 2)}***${base.slice(-2)}${extension}`;
};

const enmascararUrl = (url = '') => {
  if (!url) return '[sin-url]';
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/[ruta-redactada]`;
  } catch {
    return '[url-redactada]';
  }
};

const generarRequestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `req-${Date.now().toString(36)}`;
};

const prepararArchivoAntesDeSubir = async (archivo) => {
  const MAX_FILE_SIZE = 7 * 1024 * 1024;

  if (archivo.size > MAX_FILE_SIZE) {
    if (archivo.type?.startsWith('image/')) {
      const dataUrlComprimida = await comprimirImagen(archivo, 1200, 0.6);
      const blob = await fetch(dataUrlComprimida).then((res) => res.blob());
      return new File([blob], sanitizarNombreArchivo(archivo.name), { type: 'image/jpeg' });
    }

    throw new Error('El archivo supera el límite de 7 MB permitido por el repositorio corporativo.');
  }

  const nombreSanitizado = sanitizarNombreArchivo(archivo.name);
  if (nombreSanitizado !== archivo.name) {
    return new File([archivo], nombreSanitizado, { type: archivo.type || 'application/octet-stream' });
  }

  return archivo;
};

const resolveArchivoUrl = (payload = {}, fallbackFileName = '') => {
  const candidates = [
    payload?.url,
    payload?.path,
    payload?.file?.url,
    payload?.file?.path,
    payload?.filename,
    payload?.fileName,
    payload?.file?.filename,
    fallbackFileName,
  ];

  const rawCandidate = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
  if (!rawCandidate) return '';

  const rawValue = rawCandidate.trim();
  const appName = String(payload?.appName || 'controlInterno').trim() || 'controlInterno';

  let fileName = '';
  try {
    const stripped = rawValue.split('?')[0].split('#')[0];
    fileName = decodeURIComponent(stripped.split('/').pop() || '');
  } catch {
    fileName = 'archivo';
  }

  if (!fileName) {
    const candidateFileName = String(fallbackFileName || payload?.fileName || 'archivo').split('?')[0].split('#')[0];
    fileName = decodeURIComponent(candidateFileName.split('/').pop() || candidateFileName || 'archivo');
  }

  // ⚠️ El dominio correcto para la descarga es el repositorio de archivos, no el frontend /docs.
  return `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${encodeURIComponent(appName)}/${encodeURIComponent(fileName)}`;
};

export const apiService = {
  // 🔑 AUTENTICACIÓN Y SESIÓN
  checkSession: () => request('/api/auth/me'),
  
  login: (idToken) => request('/api/auth/login', {
    method: 'POST',
    body: { idToken }
  }),

  logout: () => request('/api/auth/logout', {
    method: 'POST'
  }),

  updateProfile: (profileData) => request('/api/auth/profile', {
    method: 'POST',
    body: profileData
  }),

  // 📊 SINCRONIZACIÓN GRC Y RLS
  getGrcData: () => request('/api/grc/sync'),

  saveGrcData: (partialData) => request('/api/grc/sync', {
    method: 'POST',
    body: { partialData }
  }),

  // 🗄️ HISTÓRICOS DE NÓMINA Y MARCACIONES
  getHistorico: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/grc/historico${query ? `?${query}` : ''}`);
  },

  postHistorico: (payload) => request('/api/grc/historico', {
    method: 'POST',
    body: payload
  }),

  deleteHistorico: (payload) => request('/api/grc/historico', {
    method: 'DELETE',
    body: payload
  }),

  // 🛡️ MATRICES DE RIESGO (ISO 31000 / E-GE-MAN-001)
  getRiesgos: () => request('/api/grc/riesgos'),

  saveRiesgo: (riesgoData) => request('/api/grc/riesgos', {
    method: 'POST',
    body: riesgoData
  }),

  deleteRiesgo: (id) => request(`/api/grc/riesgos?id=${encodeURIComponent(id)}`, {
    method: 'DELETE'
  }),

  // 🤖 AUDITORÍA E INTELIGENCIA ARTIFICIAL
  consultarAuditor: (payload) => request('/api/grc/audit', {
    method: 'POST',
    body: payload
  }),

  // 🔎 ANÁLISIS FORENSE DE NÓMINA
  ejecutarAnalisisForense: (listaBases) => request('/api/forense', {
    method: 'POST',
    body: { listaBases }
  }),

  // 📧 NOTIFICACIONES POR CORREO
  despacharCorreo: (payload) => request('/api/notifications/email', {
    method: 'POST',
    body: payload
  }),

  resolveArchivoUrl,

  // 📁 CARGA BINARIA DE EVIDENCIAS EN FORM-DATA (OPTIMIZADO NESTJS + SOPORTE PROGRESO)
  subirEvidencia: async (archivo, metadata = {}, onProgress = null) => {
    try {
      const appName = metadata.appName || 'controlInterno';
      const fileFieldName = metadata.fieldName || 'file';
      const archivoPreparado = await prepararArchivoAntesDeSubir(archivo);

      const formData = new FormData();
      formData.append('appName', appName);

      Object.keys(metadata).forEach((key) => {
        if (key !== 'fieldName' && key !== 'appName') {
          formData.append(key, metadata[key]);
        }
      });

      formData.append(fileFieldName, archivoPreparado, sanitizarNombreArchivo(archivoPreparado.name));

      const urlConQuery = `https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${encodeURIComponent(appName)}`;

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', urlConQuery, true);

        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const porcentaje = Math.round((e.loaded / e.total) * 100);
              onProgress(porcentaje);
            }
          };
        }

xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);

              const nombreUnico = data.file?.filename || data.fileName || data.filename || data.file?.fileName || data.file?.name;
              const urlAbsoluta = resolveArchivoUrl({
                appName: data.appName || appName,
                url: data.url || data.path,
                filename: nombreUnico,
              }, nombreUnico || archivoPreparado.name);

              if (import.meta.env.DEV) {
                const requestId = generarRequestId();
                secureLogger.debug('[UPLOAD] Archivo procesado', {
                  requestId,
                  appName: data.appName || appName,
                  fileNameMasked: enmascararNombreArchivo(data.file?.originalname || data.originalName || archivoPreparado.name),
                  hashMasked: nombreUnico ? enmascararNombreArchivo(nombreUnico) : '[sin-hash]',
                  urlMasked: enmascararUrl(urlAbsoluta),
                  status: xhr.status,
                });
              }

              resolve({ 
                success: true, 
                url: urlAbsoluta,
                path: urlAbsoluta,
                filePath: urlAbsoluta,
                appName: data.appName || appName, 
                fileName: data.file?.originalname || data.originalName || archivoPreparado.name
              });
              return;
            } catch (err) {
              if (import.meta.env.DEV) {
                secureLogger.error('[UPLOAD] Error al procesar respuesta del servidor', { message: err?.message || 'error' });
              }
              resolve({ success: true, url: '', appName, fileName: archivoPreparado.name });
            }
          } else {
            // Manejo de errores 400 o 500 (este se mantiene intacto)
            let detalleError = 'Falló la carga del archivo';
            try {
              const errorJson = JSON.parse(xhr.responseText);
              detalleError = errorJson.message || errorJson.error || JSON.stringify(errorJson);
              if (Array.isArray(detalleError)) detalleError = detalleError.join(', ');
            } catch {
              detalleError = `Error HTTP ${xhr.status}`;
            }
            reject(new Error(`Servidor (${xhr.status}): ${detalleError}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Error de conexión con el repositorio corporativo.'));
        };

        xhr.send(formData);
      });
    } catch (error) {
      secureLogger.error('🔴 Error en carga binaria a Termales:', error);
      throw error;
    }
  }
};