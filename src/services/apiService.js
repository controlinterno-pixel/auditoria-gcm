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

  // 📜 HISTÓRICO, NÓMINA Y MARCACIONES
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

  // 📁 CARGA DE EVIDENCIAS Y ARCHIVOS CON COMPRESIÓN DE SEGURIDAD
  subirEvidencia: async (archivo, metadata = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        let base64Final = '';

        if (archivo.type.startsWith('image/')) {
          base64Final = await comprimirImagen(archivo);
        } else {
          base64Final = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = (e) => rej(e);
            reader.readAsDataURL(archivo);
          });
        }

        const tamanoAproximadoKB = Math.round((base64Final.length * 0.75) / 1024);

        if (tamanoAproximadoKB > 95 && !archivo.type.startsWith('image/')) {
          alert(`⚠️ ATENCIÓN: El PDF pesa ${tamanoAproximadoKB} KB en Base64.\n\nEl servidor de Termales tiene un límite estricto de 100 KB.\nSi la subida falla con Error 413, comprime el PDF en ilovepdf.com o expórtalo con menor resolución.`);
        }

        const data = await request('/api/grc/upload', {
          method: 'POST',
          body: {
            fileName: archivo.name,
            fileType: archivo.type,
            fileBase64: base64Final,
            appName: metadata.appName || 'controlInterno'
          }
        });

        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }
};