// api/index.js
import { sendError } from './_lib/responseHelper.js';
import { logger } from './_lib/logger.js';
import { applyCors, origenAutorizado } from './_lib/cors.js';
import { obtenerIpCliente, revisarLimites, validarPeticion } from './_lib/seguridad.js';

export default async function handler(req, res) {
  // Extraemos la ruta ignorando los parámetros de búsqueda (query params)
  const path = req.url.split('?')[0];

  try {
    // 🛡️ Controles comunes antes de cualquier ruta: origen, límite de solicitudes y forma del cuerpo.
    if (req.method === 'OPTIONS') {
      applyCors(req, res);
      return;
    }
    if (!origenAutorizado(req)) {
      logger.warn('Petición rechazada: origen no autorizado', { endpoint: path, origen: String(req.headers.origin).slice(0, 200) });
      return sendError(res, 'Origen no autorizado.', 403);
    }
    const limite = await revisarLimites(req, path);
    if (limite) {
      logger.warn('Límite de solicitudes excedido', { endpoint: path, ip: obtenerIpCliente(req) });
      res.setHeader('Retry-After', String(limite.segundos));
      return sendError(res, limite.mensaje, limite.status);
    }
    const peticionInvalida = validarPeticion(req);
    if (peticionInvalida) {
      logger.warn('Petición rechazada por formato', { endpoint: path, motivo: peticionInvalida.mensaje });
      return sendError(res, peticionInvalida.mensaje, peticionInvalida.status);
    }

    if (path === '/api/public/catalogos') {
      const module = await import('./_public/catalogos.js');
      return await module.default(req, res);
    }

    // --- RUTAS DE AUTH ---
    if (path === '/api/auth/login') {
      const module = await import('./_auth/login.js');
      return await module.default(req, res);
    }
    if (path === '/api/auth/register') {
      const module = await import('./_auth/register.js');
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
    if (path === '/api/auth/users') {
      const module = await import('./_auth/users.js');
      return await module.default(req, res);
    }

    // --- RUTAS DE GRC ---
    
    if (path === '/api/grc/audit') {
      const module = await import('./_grc/audit.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/catalogo-cargos') {
      const module = await import('./_grc/catalogo-cargos.js');
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
    if (path === '/api/grc/no-aplica') {
      const module = await import('./_grc/no-aplica.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/vincular-riesgo') {
      const module = await import('./_grc/vincular-riesgo.js');
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
    if (path === '/api/grc/diagnostico-lecturas') {
      const module = await import('./_grc/diagnostico-lecturas.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/agrupar-colecciones') {
      const module = await import('./_grc/agrupar-colecciones.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/limpiar-colecciones') {
      const module = await import('./_grc/limpiar-colecciones.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/normalizar-clasificaciones') {
      const module = await import('./_grc/normalizar-clasificaciones.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/corregir-escala-riesgos') {
      const module = await import('./_grc/corregir-escala-riesgos.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/recalcular-residuales') {
      const module = await import('./_grc/recalcular-residuales.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/migrar-riesgos') {
      const module = await import('./_grc/migrar-riesgos.js');
      return await module.default(req, res);
    }
    if (path === '/api/grc/limpiar-riesgos') {
      const module = await import('./_grc/limpiar-riesgos.js');
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
    return sendError(res, 'Ruta de API no encontrada.', 404);
    
  } catch (error) {
    // 🛡️ El detalle (mensaje y pila) queda solo en los registros de Vercel; el usuario recibe un texto general.
    logger.error('Error no controlado en la API', error, { endpoint: path });
    if (res.headersSent) return;
    return sendError(res, 'Error interno del servidor. Intenta de nuevo; si persiste, avisa al administrador.', 500);
  }
}