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
  planes: 'sub_seguimiento_planes',
};

const esAdministrador = (rol) => ['admin', 'administrador', 'auditor'].includes(
  String(rol || '').toLowerCase().trim()
);

const normalizar = (valor) => String(valor || '').trim().toLowerCase();
const esCorreoValido = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());

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
    if (!admin && coleccion !== 'hallazgos' && coleccion !== 'planes' && procesoAsignado && procesoRegistro !== procesoAsignado) {
      return sendError(res, 'El registro debe pertenecer al proceso asignado.', 403);
    }
    if (!admin && coleccion !== 'hallazgos' && coleccion !== 'planes' && subprocesoAsignado && normalizar(registro.subproceso) !== subprocesoAsignado) {
      return sendError(res, 'El registro debe pertenecer al subproceso asignado.', 403);
    }

    if (coleccion === 'hallazgos' && (!normalizar(registro.titulo) || !normalizar(registro.idInforme) || !procesoRegistro)) {
      return sendError(res, 'El hallazgo requiere título, informe y proceso.', 400);
    }
    if (coleccion === 'planes' && (
      !normalizar(registro.idInforme) ||
      !Array.isArray(registro.items) ||
      registro.items.length === 0 ||
      registro.items.length > 100
    )) {
      return sendError(res, 'La matriz debe incluir entre 1 y 100 actividades nuevas y un informe.', 400);
    }

    const workspaceRef = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
    const registroGuardado = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(workspaceRef);
      const data = snapshot.exists ? snapshot.data() || {} : {};
      const registrosActuales = Array.isArray(data[coleccion]) ? data[coleccion] : [];
      const ahora = new Date();
      const fechaIso = ahora.toISOString();
      let nuevoRegistro;

      if (coleccion === 'planes') {
        const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
        const hallazgos = Array.isArray(data.hallazgos) ? data.hallazgos : [];
        const informe = informes.find(item => String(item.id) === String(registro.idInforme));
        if (!informe) return { error: 'informe-not-found' };

        const items = [];
        let siguienteId = registrosActuales.reduce((maximo, item) => Math.max(maximo, Number(item?.id) || 0), 0) + 1;
        const email = normalizar(user.email);
        const procesoPerfil = normalizar(perfil.procesoAsignado || user.procesoAsignado);
        const subprocesoPerfil = normalizar(perfil.subprocesoAsignado);

        for (const item of registro.items) {
          const hallazgo = hallazgos.find(candidate => String(candidate.id) === String(item.idHallazgo));
          if (!hallazgo || String(hallazgo.idInforme) !== String(registro.idInforme)) {
            return { error: 'hallazgo-not-found' };
          }

          const procesoHallazgo = normalizar(hallazgo.macroproceso || String(hallazgo.proceso || '').split('/')[0]);
          const subprocesoHallazgo = normalizar(hallazgo.subproceso);
          const creadoPorUsuario = normalizar(hallazgo.correoCreador || hallazgo.creadoPor) === email;
          const perteneceAlAlcance = Boolean(
            procesoPerfil && procesoHallazgo === procesoPerfil &&
            (!subprocesoPerfil || subprocesoHallazgo === subprocesoPerfil)
          );
          if (!admin && !creadoPorUsuario && !perteneceAlAlcance) {
            return { error: 'hallazgo-forbidden' };
          }
          if (!normalizar(item.accion)) return { error: 'invalid-action' };
          const correoResponsable = String(item.correoResponsable || '').trim();
          const correoConfirmacion = String(item.correoConfirmacion || '').trim();
          const correoRevisor = String(item.correoRevisor || '').trim();
          const correoRevisorConfirmacion = String(item.correoRevisorConfirmacion || '').trim();
          if (
            !esCorreoValido(correoResponsable) ||
            !esCorreoValido(correoRevisor) ||
            normalizar(correoResponsable) !== normalizar(correoConfirmacion) ||
            normalizar(correoRevisor) !== normalizar(correoRevisorConfirmacion)
          ) return { error: 'invalid-email-confirmation' };

          const { correoConfirmacion: _correoConfirmacion, correoRevisorConfirmacion: _correoRevisorConfirmacion, ...datosPlan } = item;

          items.push({
            ...datosPlan,
            id: siguienteId++,
            idHallazgo: hallazgo.id,
            progreso: 0,
            estadoWorkflow: 'Pendiente Revisión Jefatura',
            estado: 'En Proceso',
            creadoPor: user.email,
            historialCambios: [{
              fecha: ahora.toLocaleString('es-CO'),
              usuario: user.email,
              accion: 'Actividad registrada en matriz por el líder de proceso',
            }],
          });
        }

        transaction.set(workspaceRef, { planes: [...items, ...registrosActuales] }, { merge: true });
        return { registros: items };
      }

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
          correoCreador: user.email,
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
    if (registroGuardado.error === 'hallazgo-not-found') {
      return sendError(res, 'El informe contiene un hallazgo que no está disponible.', 404);
    }
    if (registroGuardado.error === 'hallazgo-forbidden') {
      return sendError(res, 'Solo puede crear planes para hallazgos de sus informes o procesos asignados.', 403);
    }
    if (registroGuardado.error === 'invalid-action') {
      return sendError(res, 'Cada plan debe tener una acción descrita.', 400);
    }
    if (registroGuardado.error === 'invalid-email-confirmation') {
      return sendError(res, 'Los correos del ejecutor y revisor deben ser válidos y coincidir con sus confirmaciones.', 400);
    }
    logger.info('Registro GRC creado', { coleccion, usuario: user.email, id: registroGuardado.id });
    return sendSuccess(res, registroGuardado.registros ? { registros: registroGuardado.registros } : { registro: registroGuardado });
  } catch (error) {
    logger.error('Error creando registro GRC', error, { endpoint: req.url });
    return sendError(res, 'No se pudo crear el registro.', 500);
  }
}