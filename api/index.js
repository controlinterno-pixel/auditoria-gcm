// api/index.js
import { sendError } from './_lib/responseHelper.js';

// --- Importar los controladores de Auth ---
import loginHandler from './_auth/login.js';
import logoutHandler from './_auth/logout.js';
import meHandler from './_auth/me.js';
import profileHandler from './_auth/profile.js';

// --- Importar los controladores de GRC ---
import auditHandler from './_grc/audit.js';
import createHandler from './_grc/create.js';
import forenseHandler from './_grc/forense.js';
import historicoHandler from './_grc/historico.js';
import registerEmailHandler from './_grc/register-email.js';
import riesgosHandler from './_grc/riesgos.js';
import syncHandler from './_grc/sync.js';
import uploadHandler from './_grc/upload.js';

// --- Importar los controladores de Notificaciones ---
import emailHandler from './_notifications/email.js';

export default async function handler(req, res) {
  // Extraemos la ruta ignorando los parámetros de búsqueda (query params como ?id=123)
  const path = req.url.split('?')[0];

  try {
    // --- RUTAS DE AUTH ---
    if (path === '/api/auth/login') return await loginHandler(req, res);
    if (path === '/api/auth/logout') return await logoutHandler(req, res);
    if (path === '/api/auth/me') return await meHandler(req, res);
    if (path === '/api/auth/profile') return await profileHandler(req, res);

    // --- RUTAS DE GRC ---
    if (path === '/api/grc/audit') return await auditHandler(req, res);
    if (path === '/api/grc/create') return await createHandler(req, res);
    if (path === '/api/grc/forense') return await forenseHandler(req, res);
    if (path === '/api/grc/historico') return await historicoHandler(req, res);
    if (path === '/api/grc/register-email') return await registerEmailHandler(req, res);
    if (path === '/api/grc/riesgos') return await riesgosHandler(req, res);
    if (path === '/api/grc/sync') return await syncHandler(req, res);
    if (path === '/api/grc/upload') return await uploadHandler(req, res);

    // --- RUTAS DE NOTIFICACIONES ---
    if (path === '/api/notifications/email') return await emailHandler(req, res);

    // Si la ruta solicitada no coincide con ninguna de las anteriores
    return sendError(res, `Ruta de API no encontrada: ${path}`, 404);
    
  } catch (error) {
    console.error(`Error en el enrutador principal procesando ${path}:`, error);
    return sendError(res, 'Error interno del servidor en el enrutador.', 500);
  }
}