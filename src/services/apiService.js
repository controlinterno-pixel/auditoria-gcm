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

// 📁 CARGA DE EVIDENCIAS Y ARCHIVOS (BYPASS DE VERCEL DIRECTO AL SERVIDOR DE TERMALES)
  subirEvidencia: async (archivo, metadata = {}) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const fileBase64 = reader.result;
          
          // 🔥 Nos saltamos Vercel y su límite de 4.5MB enviando directo al servidor de tu empresa
          const response = await fetch(`https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${metadata.appName || 'controlInterno'}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileName: archivo.name,
              fileType: archivo.type,
              fileData: fileBase64,
              // Usa un nombre genérico o pásale el usuario si lo tienes en el contexto
              subidoPor: 'auditoria_app@termales.com.co', 
              appName: metadata.appName || 'controlInterno'
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Rechazado por Termales: ${errText}`);
          }

          const data = await response.json();
          resolve({
            success: true,
            url: data.url || data.path || '',
            appName: data.appName || 'controlInterno',
            fileName: data.fileName || archivo.name
          });

        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(archivo);
    });
  }
};