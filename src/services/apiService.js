// src/services/apiService.js - Cliente HTTP Centralizado para la API Serverless GRC

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

  // 📁 CARGA BINARIA DE EVIDENCIAS EN FORM-DATA (ORDEN CORRECTO PARA NESTJS)
  subirEvidencia: async (archivo, metadata = {}) => {
    try {
      const formData = new FormData();
      const appName = metadata.appName || 'controlInterno';
      const fileFieldName = metadata.fieldName || 'file';

      // 1. ⚠️ CRÍTICO: 'appName' y metadatos DEBEN ir PRIMERO antes del archivo
      formData.append('appName', appName);

      Object.keys(metadata).forEach(key => {
        if (key !== 'fieldName' && key !== 'appName') {
          formData.append(key, metadata[key]);
        }
      });

      // 2. El archivo se agrega AL FINAL del FormData
      formData.append(fileFieldName, archivo);

      // 3. 'appName' en la URL por compatibilidad con validadores Query de NestJS
      const urlConQuery = `https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${encodeURIComponent(appName)}`;

      const response = await fetch(urlConQuery, {
        method: 'POST',
        // Nota: No se define 'Content-Type', el navegador asigna el boundary multipart automáticamente
        body: formData,
      });

      if (!response.ok) {
        let detalleError = 'Falló la carga del archivo';
        try {
          const errorJson = await response.json();
          detalleError = errorJson.message || errorJson.error || JSON.stringify(errorJson);
          if (Array.isArray(detalleError)) detalleError = detalleError.join(', ');
        } catch (e) {
          detalleError = `Error HTTP ${response.status}`;
        }
        throw new Error(`Servidor (${response.status}): ${detalleError}`);
      }

      const data = await response.json();

      return {
        success: true,
        url: data.url || data.path || '',
        appName: data.appName || appName,
        fileName: data.fileName || archivo.name
      };
    } catch (error) {
      console.error("🔴 Error en carga binaria a Termales:", error);
      throw error;
    }
    }
  }