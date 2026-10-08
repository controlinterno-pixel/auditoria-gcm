// api/index.js
import { sendError } from './_lib/responseHelper.js';

export default async function handler(req, res) {
  // Extraemos la ruta ignorando los parámetros de búsqueda (query params)
  const path = req.url.split('?')[0];

  try {
    if (path === '/api/public/catalogos') {
      const module = await import('./_public/catalogos.js');
      return await module.default(req, res);
    }

    // --- RUTAS DE AUTH ---
    if (path === '/api/auth/login') {
      const module = await import('./_auth/login.js');
      return await module.default(req, res);
    }
    if (path === '/api/auth/logout') {
      const module = await import('./_auth/logout.js');
      return await module.default(req, res);
    }
    if (path === '/api/auth/me') {
      const module = await import('./_auth/me.js');
      return await module.default(req, res);
    }
    if (path === '/api/auth/profile') {
      const module = await import('./_auth/profile.js');
      return await module.default(req, res);
    }

    // --- RUTAS DE GRC ---
    if (path === '/api/grc/audit') {
      const module = await import('./_grc/audit.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/create') {
      const module = await import('./_grc/create.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/forense') {
      const module = await import('./_grc/forense.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/historico') {
      const module = await import('./_grc/historico.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/register-email') {
      const module = await import('./_grc/register-email.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/review-plans') {
      const module = await import('./_grc/review-plans.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/riesgos') {
      const module = await import('./_grc/riesgos.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/sync') {
      const module = await import('./_grc/sync.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/update') {
      const module = await import('./_grc/update.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/upload') {
      const module = await import('./_grc/upload.js');
      return await module.default(req, res);
    }

    // --- RUTAS DE NOTIFICACIONES ---
    if (path === '/api/notifications/email') {
      const module = await import('./_notifications/email.js');
      return await module.default(req, res);
    }

    // Si la ruta solicitada no coincide
    return sendError(res, `Ruta de API no encontrada: ${path}`, 404);
    
  } catch (error) {
    console.error(`Error procesando ${path}:`, error);
    // Devolvemos el mensaje de error real para saber exactamente qué falló
    return sendError(res, `Error interno en ${path}: ${error.message}`, 500);
  }
}