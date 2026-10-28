// src/services/apiService.js - Cliente HTTP Centralizado para la API Serverless GRC
import { secureLogger } from './secureLogger.js';
import { signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { markSignOutReason, recordAuthEvent } from './authDiagnostics.js';

let renovacionSesionEnCurso = null;

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

const renovarCookieSesion = async () => {
  if (!auth.currentUser) return false;
  if (renovacionSesionEnCurso) return renovacionSesionEnCurso;

  renovacionSesionEnCurso = (async () => {
    let idToken;
    try {
      idToken = await auth.currentUser.getIdToken(true);
    } catch (error) {
      recordAuthEvent('token-refresh-error', { code: error?.code || 'unknown' });
      throw error;
    }
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(sanitizeServerMessage(data?.error || 'Tu sesión venció. Inicia sesión de nuevo.'));
      error.status = response.status;
      throw error;
    }

    return true;
  })().finally(() => {
    renovacionSesionEnCurso = null;
  });

  return renovacionSesionEnCurso;
};

// 📉 Ahorro de lecturas: cuando una escritura ya devolvió y aplicó en pantalla todo lo que cambió, el
// servidor informa la revisión anterior y la nueva para que useGrcData no vuelva a descargar el workspace.
const oyentesRevisionPropia = new Set();
const suscribirRevisionPropia = oyente => {
  oyentesRevisionPropia.add(oyente);
  return () => oyentesRevisionPropia.delete(oyente);
};
const avisarRevisionPropia = response => {
  const anterior = response.headers?.get?.('X-GRC-Revision-Anterior');
  const nueva = response.headers?.get?.('X-GRC-Revision');
  if (!anterior || !nueva) return;
  oyentesRevisionPropia.forEach(oyente => {
    try { oyente({ anterior, nueva }); } catch { /* un oyente no debe romper la respuesta */ }
  });
};

// Aviso de registros guardados por endpoints distintos de /api/grc/sync ("Guardar acción", decisiones del revisor o
// del aprobador, No aplica, restaurar): el módulo de guardado renueva con ellos la versión conocida de cada registro.
// Sin esto, el siguiente "Guardar matriz y sincronizar" tomaba esos cambios propios como de "otra persona" (409).
let observadorGuardados = null;
const LISTAS_EN_RESPUESTA = { planes: ['planes', 'planesActualizados', 'planesNuevos', 'plan'], hallazgos: ['hallazgos', 'hallazgo'] };
const avisarRegistrosGuardados = (endpoint, metodo, data) => {
  if (!observadorGuardados || metodo === 'GET' || !data || typeof data !== 'object') return;
  const ruta = String(endpoint).split('?')[0];
  if (!ruta.startsWith('/api/grc/') || ruta === '/api/grc/sync') return;
  const porLista = Object.fromEntries(Object.entries(LISTAS_EN_RESPUESTA).map(([lista, campos]) => [lista,
    campos.flatMap(campo => (Array.isArray(data[campo]) ? data[campo] : data[campo] && typeof data[campo] === 'object' ? [data[campo]] : []))]));
  if (Object.values(porLista).some(registros => registros.length)) {
    try { observadorGuardados(porLista); } catch { /* el aviso nunca rompe el guardado */ }
  }
};

async function request(endpoint, options = {}, reintentosMaximos = 3, sesionRenovada = false) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  // Solo las llamadas cuyo resultado se aplica completo en pantalla pueden omitir la recarga.
  const { aplicadoLocalmente = false, tiempoEsperaMs = 15000, ...opcionesFetch } = options;

  // Preparamos la configuración base (sin la señal de aborto, porque esa cambia en cada intento)
  const configBase = {
    method: 'GET',
    credentials: 'include', // 🔒 OBLIGATORIO: Transmite cookies HttpOnly (grc_session)
    ...opcionesFetch,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (configBase.body && typeof configBase.body === 'object' && !(configBase.body instanceof FormData)) {
    configBase.body = JSON.stringify(configBase.body);
  }

  // 🔄 CICLO DE REINTENTOS SILENCIOSOS
  for (let intento = 1; intento <= reintentosMaximos; intento++) {
    
    // El temporizador (Timeout) se crea fresco para cada intento (15 segundos)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), tiempoEsperaMs);

    const config = { ...configBase, signal: controller.signal };

    try {
      const response = await fetch(endpoint, config);
      clearTimeout(timeoutId); // Llegó a tiempo, apagamos la alarma

      let data = null;
      try {
        data = await response.json();
      } catch {
        // Si no es JSON válido o viene vacío
      }

      if (!response.ok) {
        const rawMessage = data?.error || data?.message || data?.details || `Error HTTP ${response.status}`;
        const errorMessage = sanitizeServerMessage(rawMessage);

        if (
          response.status === 401 &&
          !sesionRenovada &&
          !String(endpoint).startsWith('/api/auth/') &&
          auth.currentUser
        ) {
          try {
            await renovarCookieSesion();
            return await request(endpoint, options, reintentosMaximos, true);
          } catch (error) {
            if (error.status === 403) {
              secureLogger.error('[AUTH] Cierre automático: el servidor rechazó la renovación de sesión', {
                endpoint: String(endpoint).split('?')[0],
                statusPeticion: response.status,
                statusRenovacion: error.status,
                codigoRenovacion: error.code || 'unknown',
              });
              markSignOutReason('renewal-403', error.message);
              await signOut(auth).catch(() => {});
              throw error;
            }
            recordAuthEvent('session-renewal-failed', {
              endpoint: String(endpoint).split('?')[0],
              status: error.status || 0,
              code: error.code || 'unknown',
            });
            throw new Error('No se pudo renovar la sesion temporalmente. Comprueba tu conexion e intenta nuevamente.', { cause: error });
          }
        }
        
        // 🛑 Si el error es 400-499 (error de validación, ej. "Usuario incorrecto"), NO reintentamos.
        if (response.status >= 400 && response.status < 500) {
          const error = new Error(errorMessage);
          error.status = response.status;
          throw error;
        }
        
        // ⚠️ Si es 500+ (se cayó el servidor), forzamos el error para que el "catch" lo intente de nuevo.
        throw new Error(`ServerError: ${errorMessage}`);
      }

      // La propagación de cambios la hace el servidor actualizando sistema/semaforo (no hay endpoint SSE).
      if (aplicadoLocalmente) avisarRevisionPropia(response);
      avisarRegistrosGuardados(endpoint, configBase.method, data);
      return data; // ✅ Éxito total. Entregamos los datos y salimos.

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Si fue un error de validación (como contraseña incorrecta), lo mostramos de inmediato.
      if (error.message && !error.message.includes('ServerError') && error.name !== 'AbortError' && error.name !== 'TypeError') {
        throw error; 
      }

      // Si ya gastamos los 3 intentos, nos rendimos y le avisamos al cliente de forma amable.
      if (intento === reintentosMaximos) {
        if (error.name === 'AbortError') {
          throw new Error('El servidor tardó más de lo esperado en responder. Por favor, revisa tu conexión a internet e intenta de nuevo.', { cause: error });
        }
        throw new Error('La conexión es inestable en este momento. Revisa tu red o intenta más tarde.', { cause: error });
      }

      // ⏳ EXPONENTIAL BACKOFF: Si falló pero nos quedan intentos, hacemos una pequeña pausa (1s, 2s...)
      const tiempoDeEspera = intento * 1000;
      console.warn(`⚠️ Interrupción detectada. Reintentando conexión de forma silenciosa en ${tiempoDeEspera/1000}s... (Intento ${intento}/${reintentosMaximos})`);
      
      await new Promise(resolve => setTimeout(resolve, tiempoDeEspera));
    }
  }
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
  const base = valor.replace(new RegExp(`${extension.replace('.', '[.]')}$`), '');

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
  // Ampliado a 25 MB para soportar informes institucionales y planes escaneados sin rebotes
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  if (archivo.size > MAX_FILE_SIZE) {
    if (archivo.type?.startsWith('image/')) {
      const dataUrlComprimida = await comprimirImagen(archivo, 1200, 0.6);
      const blob = await fetch(dataUrlComprimida).then((res) => res.blob());
      return new File([blob], sanitizarNombreArchivo(archivo.name), { type: 'image/jpeg' });
    }

    throw new Error('El archivo supera el límite de 25 MB permitido por el repositorio corporativo.');
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

  let fileName;
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
  /** Recibe { planes: [...], hallazgos: [...] } con lo que guardaron los endpoints distintos de /api/grc/sync. */
  observarGuardados: fn => { observadorGuardados = typeof fn === 'function' ? fn : null; },
  getCatalogosPublicos: () => request('/api/public/catalogos', { cache: 'no-store' }),

  eliminarCargoCatalogo: (id) => request('/api/grc/catalogo-cargos', {
    method: 'DELETE',
    body: { id },
  }),

  obtenerCorreosCargos: (asignaciones) => request('/api/grc/catalogo-cargos', {
    method: 'POST',
    body: { asignaciones },
  }),

  // 🔑 AUTENTICACIÓN Y SESIÓN
  checkSession: () => request('/api/auth/me'),
  
  login: (idToken) => request('/api/auth/login', {
    method: 'POST',
    body: { idToken }
  }),

  registrarSolicitudAcceso: (profileData) => request('/api/auth/register', {
    method: 'POST',
    body: profileData
  }),

  logout: () => request('/api/auth/logout', {
    method: 'POST'
  }),

  updateProfile: (profileData) => request('/api/auth/profile', {
    method: 'POST',
    body: profileData
  }),

  getAdminUsers: () => request('/api/auth/users', { cache: 'no-store' }),

  actualizarUsuario: (uid, cambios) => request('/api/auth/users', {
    method: 'PATCH',
    body: { uid, cambios }
  }),

  resolverSolicitudAcceso: (uid, accion) => request('/api/auth/users', {
    method: 'PATCH',
    body: { uid, accion }
  }),

  // Gestión de proyectos. Las operaciones van con un solo intento: un reintento automático podría duplicar
  // un proyecto recién creado (las ediciones llevan versión y un reintento solo daría aviso de conflicto).
  listarProyectos: (incluirArchivados = false) => request(`/api/grc/proyectos${incluirArchivados ? '?archivados=1' : ''}`),
  obtenerProyecto: id => request(`/api/grc/proyectos?id=${encodeURIComponent(id)}`),
  leccionesProyectos: () => request('/api/grc/proyectos?lecciones=1'),
  historialProyecto: (id, despuesDe = '') => request(`/api/grc/proyectos?id=${encodeURIComponent(id)}&historial=1${despuesDe ? `&despuesDe=${encodeURIComponent(despuesDe)}` : ''}`),
  operarProyecto: (accion, idProyecto, datos) => request('/api/grc/proyectos', { method: 'POST', body: { accion, idProyecto, datos } }, 1),

 // 📊 SINCRONIZACIÓN GRC Y RLS
  getGrcData: ({ forceFresh = false, revision = '' } = {}) => {
    const params = new URLSearchParams();
    if (forceFresh) params.set('fresh', '1');
    if (revision) params.set('revision', String(revision));
    const query = params.toString();
    return request(`/api/grc/sync${query ? `?${query}` : ''}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
  },

  saveGrcData: (partialData) => request('/api/grc/sync', {
    method: 'POST',
    body: { partialData }
  }),
  crearRegistroGrc: (coleccion, registro) => request('/api/grc/create', {
    method: 'POST',
    body: { coleccion, registro }
  }),

  repararConsecutivosInformes: () => request('/api/grc/create', {
    method: 'POST',
    body: { coleccion: 'repararConsecutivosInformes' }
  }),

  actualizarInformeGrc: (id, registro, motivo) => request('/api/grc/update', {
    method: 'PUT',
    body: { coleccion: 'informesAuditoria', id, registro, motivo }
  }),

  actualizarHallazgoGrc: (id, registro) => request('/api/grc/update', {
    method: 'PUT',
    body: { coleccion: 'hallazgos', id, registro },
  }),

  guardarMatrizPlanes: (registro) => request('/api/grc/update', {
    method: 'PUT',
    body: { coleccion: 'planes', registro }
  }),

  decidirRevisionPlanes: (idInforme, decision, motivo = '', idsPlanes) => request('/api/grc/review-plans', {
    method: 'POST',
    body: { idInforme, decision, motivo, ...(Array.isArray(idsPlanes) ? { idsPlanes } : {}) },
    aplicadoLocalmente: true,
  }),

  // "No aplica" de un hallazgo: accion 'proponer' | 'aprobar' | 'rechazar'.
  decidirNoAplicaHallazgo: (idHallazgo, accion, justificacion = '') => request('/api/grc/no-aplica', {
    method: 'POST',
    body: { idHallazgo, accion, justificacion },
    aplicadoLocalmente: true,
  }),
  // Acciones devueltas por error a la evaluación inicial: vuelven al revisor o a la evaluación de eficacia.
  restaurarReenvioPlanes: (idInforme, idsPlanes) => request('/api/grc/review-plans', {
    method: 'POST',
    body: { decision: 'restaurar-reenvio', idInforme, idsPlanes },
    aplicadoLocalmente: true,
  }),
  evaluarDisenoPlanes: (idInforme, idsPlanes, criterios, justificacion, adjuntoEvaluacion) => request('/api/grc/review-plans', {
    method: 'POST',
    body: { decision: 'evaluar-diseno', idInforme, idsPlanes, criterios, justificacion, adjuntoEvaluacion },
    aplicadoLocalmente: true,
  }),

  decidirPlanComoAuditor: (idPlan, decision, motivo = '', evaluacionEficacia = null) => request('/api/grc/review-plans', {
    method: 'POST',
    body: { idPlan, decision, motivo, evaluacionEficacia },
    aplicadoLocalmente: true,
  }),

  decidirPlanesComoAuditor: (idInforme, idsPlanes, decision, motivo, evaluacionEficacia) => request('/api/grc/review-plans', {
    method: 'POST',
    body: { idInforme, idsPlanes, alcance: 'todas', decision, motivo, evaluacionEficacia },
    aplicadoLocalmente: true,
  }),

  registrarCorreoInforme: (id, destinatarios, fechaCorreoEnviado) => request('/api/grc/register-email', {
    method: 'POST',
    body: { id, destinatarios, fechaCorreoEnviado }
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
  // La IA prueba Pro primero (puede tardar hasta un minuto) y baja a Flash si se acaba su cuota: se espera
  // más que en las demás llamadas y no se reintenta (cada reintento empezaría de nuevo por Pro).
  consultarAuditor: (payload) => request('/api/grc/audit', {
    method: 'POST',
    body: payload,
    tiempoEsperaMs: 150000,
  }, 1),

  // 🔎 ANÁLISIS FORENSE DE NÓMINA
  ejecutarAnalisisForense: (listaBases) => request('/api/grc/forense', {
    method: 'POST',
    body: { listaBases }
  }),

  // 🔗 Vincular o desvincular un riesgo de la matriz a una acción de Planes (numeral 9).
  vincularRiesgoPlan: (idPlan, idRiesgo, accion = 'vincular') => request('/api/grc/vincular-riesgo', {
    method: 'POST',
    body: { idPlan, idRiesgo, accion },
  }),

  // 📧 NOTIFICACIONES POR CORREO (se envían con Gmail desde el navegador; el servidor solo prepara adjuntos)
  prepararAdjuntoCorreo: (adjuntoEvaluacion) => request('/api/notifications/email', {
    method: 'POST',
    body: { operacion: 'preparar-adjunto', adjuntoEvaluacion },
  }),

  resolveArchivoUrl,

  // 📁 CARGA BINARIA DE EVIDENCIAS EN FORM-DATA (OPTIMIZADO NESTJS + SOPORTE PROGRESO)
  subirEvidencia: async (archivo, metadata = {}, onProgress = null) => {
    try {
      const appName = metadata.appName || 'controlInterno';
      const fileFieldName = metadata.fieldName || 'file';
      // comprimirFoto: fotos de celular (4–8 MB) se reducen a 1600 px para que la línea de tiempo cargue rápido.
      const archivoPreparado = metadata.conservarOriginal ? archivo
        : metadata.comprimirFoto && archivo.type?.startsWith('image/')
          ? await fetch(await comprimirImagen(archivo, 1600, 0.75)).then(res => res.blob()).then(blob => new File([blob], sanitizarNombreArchivo(archivo.name).replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
          : await prepararArchivoAntesDeSubir(archivo);

      const formData = new FormData();
      formData.append('appName', appName);

      Object.keys(metadata).forEach((key) => {
        if (key !== 'fieldName' && key !== 'appName' && key !== 'conservarOriginal' && key !== 'comprimirFoto') {
          formData.append(key, metadata[key]);
        }
      });

      formData.append(fileFieldName, archivoPreparado, sanitizarNombreArchivo(archivoPreparado.name));

      const urlConQuery = `https://repos.termalessantarosa.com.co/api/archivos/upload?appName=${encodeURIComponent(appName)}`;

      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', urlConQuery, true);

        // 👇 NUEVO: Tiempo máximo de espera para archivos (60 segundos)
        xhr.timeout = 60000; 

        // 👇 NUEVO: Qué hacer si se acaba el tiempo
        xhr.ontimeout = () => {
          reject(new Error('La subida de archivo tardó demasiado (Timeout). Puede que el archivo sea muy pesado o la conexión a Internet sea inestable. Por favor, reintenta.'));
        };

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
            let detalleError;
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
          reject(new Error('Error de conexión con el repositorio corporativo. Verifica tu conexión a internet o intenta de nuevo en unos minutos.'));
        };

        xhr.send(formData);
      });
    } catch (error) {
      secureLogger.error('🔴 Error en carga binaria a Termales:', error);
      throw error;
    }
  }
};

export { suscribirRevisionPropia };
