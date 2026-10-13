import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const { idToken, nombreResponsable, cargo, procesoSolicitado, subprocesoSolicitado } = req.body || {};
    if (
      typeof idToken !== 'string' ||
      typeof nombreResponsable !== 'string' ||
      typeof cargo !== 'string' ||
      typeof procesoSolicitado !== 'string' ||
      typeof subprocesoSolicitado !== 'string' ||
      !nombreResponsable.trim() ||
      nombreResponsable.trim().length > 160
    ) {
      return sendError(res, 'Los datos de la solicitud están incompletos o no son válidos.', 400);
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!decoded.uid || !email.endsWith('@termales.com.co')) {
      return sendError(res, 'Solo se permiten cuentas institucionales.', 403);
    }

    const catalogSnapshot = await adminDb.collection('workspace_compartido').doc('base_de_datos_grc').get();
    const catalog = catalogSnapshot.exists ? catalogSnapshot.data() || {} : {};
    const catalogosInicializados = catalog.catalogosInicializados === true;
    const cargos = (Array.isArray(catalog.catalogoCargos) ? catalog.catalogoCargos : [])
      .filter(item => item?.activo !== false)
      .map(item => String(item?.cargo || '').trim());
    const mapaProcesos = catalog.mapaProcesos && typeof catalog.mapaProcesos === 'object'
      ? catalog.mapaProcesos
      : {};
    const subprocesosValidos = Array.isArray(mapaProcesos[procesoSolicitado])
      ? mapaProcesos[procesoSolicitado]
      : [];

    if (
      !catalogosInicializados ||
      !cargos.includes(cargo) ||
      !Object.hasOwn(mapaProcesos, procesoSolicitado) ||
      !subprocesosValidos.includes(subprocesoSolicitado)
    ) {
      return sendError(res, 'El cargo, macroproceso o subproceso no coincide con los catálogos vigentes.', 400);
    }

    const userRef = adminDb.collection('usuarios').doc(decoded.uid);
    const profile = {
      correo: email,
      email,
      nombreResponsable: nombreResponsable.trim(),
      cargo,
      rol: 'lider',
      permisos: [],
      estadoAcceso: 'pendiente',
      procesosSolicitados: [procesoSolicitado],
      subprocesosSolicitados: [subprocesoSolicitado],
      procesosAsignados: [],
      subprocesosAsignados: [],
      creadoEn: new Date().toISOString(),
    };

    try {
      await userRef.create(profile);
      return sendSuccess(res, { estadoAcceso: 'pendiente', message: 'Solicitud de acceso registrada.' }, 201);
    } catch (error) {
      if (error.code === 6 || error.code === 'already-exists') {
        const existing = await userRef.get();
        return sendSuccess(res, {
          estadoAcceso: existing.get('estadoAcceso') || 'activo',
          message: 'El perfil ya estaba registrado; no se modificó.'
        });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error registrando solicitud de acceso', error, { endpoint: req.url });
    return sendError(res, 'No se pudo registrar la solicitud de acceso.', 500);
  }
}