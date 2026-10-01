// src/services/apiService.js - Cliente HTTP Centralizado para la API Serverless GRC

import { subirArchivoStorage } from './uploadService';

/**
 * Helper privado para ejecutar peticiones HTTP estandarizadas a la API.
 */
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
    const errorMessage = data?.error || data?.message || `Error HTTP ${response.status}`;
    throw new Error(errorMessage);
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

  // 📁 CARGA BINARIA DE EVIDENCIAS EN FORM-DATA (OPTIMIZADO NESTJS + SOPORTE PROGRESO)
  subirEvidencia: (archivo, metadata = {}, onProgress = null) => {
    return new Promise(async (resolve, reject) => {
      try {
        const formData = new FormData();
        const appName = metadata.appName || 'controlInterno';
        const fileFieldName = metadata.fieldName || 'file';

        formData.append('appName', appName);
        Object.keys(metadata).forEach(key => {
          if (key !== 'fieldName' && key !== 'appName') {
            formData.append(key, metadata[key]);
          }
        });
        formData.append(fileFieldName, archivo);

        const urlConQuery = `https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${encodeURIComponent(appName)}`;

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

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              const urlExtraida = data.url || data.path || data.filePath || data.fileUrl || data.location || (data.file && (data.file.path || data.file.url)) || (typeof data === 'string' ? data : '');
              const urlValida = typeof urlExtraida === 'string' ? urlExtraida.trim() : '';

              if (urlValida && /^https?:\/\//i.test(urlValida)) {
                resolve({
                  success: true,
                  url: urlValida,
                  appName: data.appName || appName,
                  fileName: data.fileName || archivo.name
                });
                return;
              }

              if (urlValida && !/^https?:\/\//i.test(urlValida)) {
                console.warn('La respuesta del repositorio devolvió un nombre de archivo sin URL válida. Se reintenta con Firebase Storage como fallback seguro.');
              }

              try {
                const fallback = await subirArchivoStorage(archivo, { appName, onProgress });
                resolve({
                  success: true,
                  url: fallback.url,
                  appName: fallback.appName || appName,
                  fileName: fallback.fileName || archivo.name
                });
              } catch (fallbackError) {
                reject(new Error(fallbackError.message || 'No se pudo generar una URL válida para el archivo adjunto.'));
              }
              return;
            } catch {
              const responseText = typeof xhr.responseText === 'string' ? xhr.responseText.trim() : '';
              if (responseText && /^https?:\/\//i.test(responseText)) {
                resolve({ success: true, url: responseText, appName, fileName: archivo.name });
                return;
              }

              try {
                const fallback = await subirArchivoStorage(archivo, { appName, onProgress });
                resolve({ success: true, url: fallback.url, appName: fallback.appName || appName, fileName: fallback.fileName || archivo.name });
              } catch (fallbackError) {
                reject(new Error(fallbackError.message || 'La subida no devolvió una URL válida y el fallback a Firebase Storage falló.'));
              }
            }
          } else {
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

        xhr.onerror = async () => {
          try {
            const fallback = await subirArchivoStorage(archivo, { appName, onProgress });
            resolve({ success: true, url: fallback.url, appName: fallback.appName || appName, fileName: fallback.fileName || archivo.name });
          } catch (fallbackError) {
            reject(new Error(fallbackError.message || 'Error de conexión con el repositorio de Termales y fallback a Firebase Storage'));
          }
        };
        xhr.send(formData);

      } catch (error) {
        console.error('🔴 Error en carga binaria a Termales:', error);
        reject(error);
      }
    });
  }
};