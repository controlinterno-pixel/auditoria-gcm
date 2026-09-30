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

  // 📁 CARGA DIRECTA DE EVIDENCIAS AL REPOSITORIO CORPORATIVO DE TERMALES
  subirEvidencia: async (archivo, metadata = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        let base64Final = '';

        // 1. Compresión previa si es imagen
        if (archivo.type.startsWith('image/')) {
          base64Final = await comprimirImagen(archivo);
        } else {
          // Lectura Base64 para PDFs u otros documentos
          base64Final = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = (e) => rej(e);
            reader.readAsDataURL(archivo);
          });
        }

        const appName = metadata.appName || 'controlInterno';

        // 2. Envío directo al servidor de Termales con formato JSON
        const response = await fetch(`https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${appName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName: archivo.name,
            fileType: archivo.type,
            fileData: base64Final,
            subidoPor: 'auditoria_app@termales.com.co',
            appName: appName
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 413) {
            const pesoKB = Math.round(base64Final.length / 1024);
            throw new Error(`EL PDF PESA ${pesoKB} KB Y EL SERVIDOR RECHAZÓ LA SUBIDA (HTTP 413).\n\nEl servidor Express de Termales requiere configurar app.use(express.json({ limit: '50mb' })) para habilitar archivos de mayor peso.`);
          }
          throw new Error(`Rechazado por Termales (HTTP ${response.status}): ${errText}`);
        }

        const data = await response.json();

        resolve({
          success: true,
          url: data.url || data.path || '',
          appName: data.appName || appName,
          fileName: data.fileName || archivo.name
        });

      } catch (error) {
        console.error("🔴 Error en carga a Termales:", error);
        reject(error);
      }
    });
  }
};