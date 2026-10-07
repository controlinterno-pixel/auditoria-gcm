import { randomUUID } from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

const COLECCIONES_PERMITIDAS = {
  informesAuditoria: 'sub_informes',
  fuentesMejora: 'sub_fuentes_mejora',
  hallazgos: 'sub_hallazgos',
};

const esAdministrador = (rol) => ['admin', 'administrador', 'auditor'].includes(
  String(rol || '').toLowerCase().trim()
);

const normalizar = (valor) => String(valor || '').trim().toLowerCase();

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { coleccion, registro } = req.body || {};
    const permisoRequerido = COLECCIONES_PERMITIDAS[coleccion];
    if (!permisoRequerido) return sendError(res, 'Tipo de registro no permitido.', 400);
    if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
      return sendError(res, 'El registro enviado no es válido.', 400);
    }
    if (JSON.stringify(registro).length > 500000) {
      return sendError(res, 'El registro excede el tamaño permitido.', 413);
    }

    const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const admin = esAdministrador(perfil.rol);
    const permisos = Array.isArray(perfil.permisos) ? perfil.permisos : [];
    if (!admin && !permisos.includes(permisoRequerido)) {
      return sendError(res, 'No tiene permiso para crear este tipo de registro.', 403);
    }

    const procesoAsignado = normalizar(perfil.procesoAsignado || user.procesoAsignado);
    const subprocesoAsignado = normalizar(perfil.subprocesoAsignado);
    const procesoRegistro = normalizar(registro.macroproceso || String(registro.proceso || '').split('/')[0]);
    if (!admin && coleccion === 'hallazgos' && !procesoAsignado) {
      return sendError(res, 'Debe tener un proceso asignado para crear hallazgos.', 403);
    }
    if (!admin && procesoAsignado && procesoRegistro !== procesoAsignado) {
      return sendError(res, 'El registro debe pertenecer al proceso asignado.', 403);
    }
    if (!admin && subprocesoAsignado && normalizar(registro.subproceso) !== subprocesoAsignado) {
      return sendError(res, 'El registro debe pertenecer al subproceso asignado.', 403);
    }

    if (coleccion === 'hallazgos' && (!normalizar(registro.titulo) || !normalizar(registro.idInforme) || !procesoRegistro)) {
      return sendError(res, 'El hallazgo requiere título, informe y proceso.', 400);
    }

    const workspaceRef = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
    const registroGuardado = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(workspaceRef);
      const data = snapshot.exists ? snapshot.data() || {} : {};
      const registrosActuales = Array.isArray(data[coleccion]) ? data[coleccion] : [];
      const ahora = new Date();
      const fechaIso = ahora.toISOString();
      let nuevoRegistro;

      if (coleccion === 'informesAuditoria') {
        const anio = ahora.getFullYear();
        const prefijo = `INF-${anio}-`;
        const consecutivo = registrosActuales.reduce((mayor, item) => {
          const coincidencia = String(item?.ref || '').match(new RegExp(`^INF-${anio}-(\\d+)$`));
          return coincidencia ? Math.max(mayor, Number(coincidencia[1])) : mayor;
        }, 0) + 1;
        nuevoRegistro = {
          ...registro,
          id: crypto.randomUUID(),
          ref: `${prefijo}${String(consecutivo).padStart(3, '0')}`,
          correoCreador: user.email,
          creadoPor: user.email,
          historialCambios: [],
        };
      } else if (coleccion === 'hallazgos') {
        const informeOrigen = (Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [])
          .find(informe => String(informe.id) === String(registro.idInforme));
        if (!informeOrigen) return { error: 'informe-not-found' };

        const procesoInforme = normalizar(informeOrigen.macroproceso || String(informeOrigen.proceso || '').split('/')[0]);
        if (procesoInforme !== procesoRegistro) return { error: 'informe-process-mismatch' };
        if (!admin && procesoAsignado && procesoInforme !== procesoAsignado) return { error: 'forbidden' };

        const anio = ahora.getFullYear();
        const prefijo = `HAL-${anio}-`;
        const consecutivo = registrosActuales.reduce((mayor, item) => {
          const coincidencia = String(item?.ref || '').match(new RegExp(`^HAL-${anio}-(\\d+)$`));
          return coincidencia ? Math.max(mayor, Number(coincidencia[1])) : mayor;
        }, 0) + 1;
        nuevoRegistro = {
          ...registro,
          id: randomUUID(),
          ref: `${prefijo}${String(consecutivo).padStart(3, '0')}`,
          estado: 'Abierto',
          fecha: registro.fecha || fechaIso.slice(0, 10),
          anio: Number(registro.anio) || anio,
          creadoPor: user.email,
          historialCambios: [{
            fecha: ahora.toLocaleString('es-CO'),
            usuario: user.email,
            accion: 'Desviación documentada',
          }],
        };
      } else {
        const consecutivo = registrosActuales.reduce((mayor, item) => {
          const coincidencia = String(item?.codigo || item?.id || '').match(/(\d+)$/);
          return coincidencia ? Math.max(mayor, Number(coincidencia[1])) : mayor;
        }, 0) + 1;
        const codigo = `FA-${String(consecutivo).padStart(3, '0')}`;
        nuevoRegistro = {
          ...registro,
          id: codigo,
          codigo,
          historialCambios: [{
            fecha: ahora.toLocaleString('es-CO'),
            timestamp: fechaIso,
            usuario: user.email,
            accion: 'Creación',
            motivo: 'Registro inicial de la fuente.',
          }],
        };
      }

      transaction.set(workspaceRef, { [coleccion]: [nuevoRegistro, ...registrosActuales] }, { merge: true });
      return nuevoRegistro;
    });

    if (registroGuardado.error === 'informe-not-found') {
      return sendError(res, 'No se encontró el informe de origen.', 404);
    }
    if (registroGuardado.error === 'informe-process-mismatch') {
      return sendError(res, 'El informe de origen pertenece a otro proceso.', 403);
    }
    if (registroGuardado.error === 'forbidden') {
      return sendError(res, 'No tiene permiso para ese proceso.', 403);
    }

    logger.info('Registro GRC creado', { coleccion, usuario: user.email, id: registroGuardado.id });
    return sendSuccess(res, { registro: registroGuardado });
  } catch (error) {
    logger.error('Error creando registro GRC', error, { endpoint: req.url });
    return sendError(res, 'No se pudo crear el registro.', 500);
  }
}