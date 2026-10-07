import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';

const COLECCIONES_PERMITIDAS = {
  informesAuditoria: 'sub_informes',
  fuentesMejora: 'sub_fuentes_mejora',
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

    const procesoAsignado = normalizar(perfil.procesoAsignado);
    const procesoRegistro = normalizar(registro.macroproceso || String(registro.proceso || '').split('/')[0]);
    if (!admin && procesoAsignado && procesoRegistro !== procesoAsignado) {
      return sendError(res, 'El registro debe pertenecer al proceso asignado.', 403);
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

    logger.info('Registro GRC creado', { coleccion, usuario: user.email, id: registroGuardado.id });
    return sendSuccess(res, { registro: registroGuardado });
  } catch (error) {
    logger.error('Error creando registro GRC', error, { endpoint: req.url });
    return sendError(res, 'No se pudo crear el registro.', 500);
  }
}