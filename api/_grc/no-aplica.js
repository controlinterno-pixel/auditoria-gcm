// api/_grc/no-aplica.js - "No aplica" de un hallazgo: el ejecutor propone, el auditor del informe aprueba o
// rechaza. Aprobado es definitivo: el hallazgo se cierra y sus acciones abiertas pasan a "No aplica".
// Nunca se borra ninguna acción: conservan su historial y quedan consultables.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { esAdministradorTotal } from '../_lib/roles.js';
import {
  guardarPlanesGrc, guardarRegistrosGrc, leerInformeTx, leerWorkspaceGrcLigero, obtenerHallazgosTx, obtenerPlanesDeHallazgosTx,
} from '../_lib/grcWorkspace.js';
import { ESTADO_PLAN_NO_APLICA, MOTIVO_MINIMO_NO_APLICA, estadoNoAplica } from '../../src/utils/noAplicaHallazgo.js';

const normalizar = valor => String(valor || '').trim().toLowerCase();
const correos = valor => String(valor || '').split(',').map(normalizar).filter(Boolean);

export function rolesEnHallazgo(email, { informe, planes }) {
  const yo = normalizar(email);
  const auditores = new Set([
    ...correos(informe?.correoAuditor), ...correos(informe?.correoAuditorResponsable),
    ...planes.flatMap(plan => [...correos(plan.correoAuditor), ...correos(plan.correoAuditorResponsable)]),
  ]);
  const ejecutores = new Set(planes.flatMap(plan => correos(plan.correoResponsable)));
  return { esAuditor: auditores.has(yo), esEjecutor: ejecutores.has(yo) };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);
  const user = await requireAuth(req, res);
  if (!user) return;

  const { idHallazgo, accion, justificacion = '' } = req.body || {};
  const texto = String(justificacion || '').trim().slice(0, 2000);
  if (!idHallazgo || !['proponer', 'aprobar', 'rechazar'].includes(accion)) return sendError(res, 'Solicitud de "No aplica" no válida.', 400);
  if (['proponer', 'rechazar'].includes(accion) && texto.length < MOTIVO_MINIMO_NO_APLICA) {
    return sendError(res, `Escribe la ${accion === 'proponer' ? 'justificación' : 'razón del rechazo'} (mínimo ${MOTIVO_MINIMO_NO_APLICA} caracteres).`, 400);
  }
  const admin = esAdministradorTotal(user.rol);

  try {
    const resultado = await adminDb.runTransaction(async transaction => {
      const workspace = await leerWorkspaceGrcLigero(transaction, { origen: 'no-aplica-tx' });
      if (!workspace.workspaceExists) return { error: 'not-found' };
      const hallazgo = (await obtenerHallazgosTx(transaction, workspace, [idHallazgo])).get(String(idHallazgo));
      if (!hallazgo) return { error: 'not-found' };
      let informe = (workspace.data.informesAuditoria || []).find(item => String(item.id) === String(hallazgo.idInforme));
      if (!informe && hallazgo.idInforme) {
        const snap = await leerInformeTx(transaction, workspace, String(hallazgo.idInforme).trim());
        if (snap.exists) informe = { id: hallazgo.idInforme, ...snap.data() };
      }
      const planes = await obtenerPlanesDeHallazgosTx(transaction, workspace, [String(hallazgo.id)]);
      const { esAuditor, esEjecutor } = rolesEnHallazgo(user.email, { informe, planes });
      const estadoActual = estadoNoAplica(hallazgo);
      if (estadoActual === 'Aprobado') return { error: 'definitive' };

      const ahora = new Date();
      const marca = { fecha: ahora.toLocaleString('es-CO', { timeZone: 'America/Bogota' }), timestamp: ahora.toISOString(), usuario: user.email };
      const historial = Array.isArray(hallazgo.historialCambios) ? hallazgo.historialCambios : [];
      let actualizado;
      let planesActualizados = [];

      const aprobar = (base, justificacionFinal) => {
        // Definitivo: el hallazgo se cierra y sus acciones abiertas quedan "No aplica" (no se borran).
        planesActualizados = planes.filter(plan => plan.estadoWorkflow !== 'Cerrado' && plan.estado !== 'Cerrado').map(plan => ({
          ...plan,
          estadoWorkflow: ESTADO_PLAN_NO_APLICA,
          estado: 'Cerrado',
          noAplica: true,
          historialCambios: [...(Array.isArray(plan.historialCambios) ? plan.historialCambios : []), {
            ...marca, accion: `🚫 Acción cerrada como NO APLICA (hallazgo ${hallazgo.ref || hallazgo.id}). Justificación: ${justificacionFinal}`,
          }],
        }));
        return {
          ...base,
          estado: 'Cerrado',
          noAplica: { ...(base.noAplica || {}), estado: 'Aprobado', justificacion: justificacionFinal, decididoPor: user.email, decididoEn: ahora.toISOString() },
        };
      };

      if (accion === 'proponer') {
        if (hallazgo.estado === 'Cerrado') return { error: 'closed' };
        if (estadoActual === 'Pendiente') return { error: 'already-pending' };
        if (!admin && !esAuditor && !esEjecutor) return { error: 'forbidden-propose' };
        const propuesto = { ...hallazgo, noAplica: { estado: 'Pendiente', justificacion: texto, propuestoPor: user.email, propuestoEn: ahora.toISOString() } };
        // El auditor del informe o un administrador son quienes aprueban: si lo proponen ellos, queda aprobado.
        actualizado = admin || esAuditor
          ? { ...aprobar(propuesto, texto), historialCambios: [...historial, { ...marca, accion: `❌ Hallazgo marcado como NO APLICA (aprobado por ${esAuditor ? 'el auditor' : 'un administrador'}). Justificación: ${texto}` }] }
          : { ...propuesto, historialCambios: [...historial, { ...marca, accion: `⏳ NO APLICA propuesto por el ejecutor, pendiente de aprobación del auditor. Justificación: ${texto}` }] };
      } else {
        if (estadoActual !== 'Pendiente') return { error: 'not-pending' };
        if (!admin && !esAuditor) return { error: 'forbidden-decide' };
        const justificacionPropuesta = hallazgo.noAplica?.justificacion || '';
        actualizado = accion === 'aprobar'
          ? { ...aprobar(hallazgo, justificacionPropuesta), historialCambios: [...historial, { ...marca, accion: `❌ Hallazgo marcado como NO APLICA (aprobado). Justificación: ${justificacionPropuesta}` }] }
          : {
            ...hallazgo,
            noAplica: { ...hallazgo.noAplica, estado: 'Rechazado', motivoRechazo: texto, decididoPor: user.email, decididoEn: ahora.toISOString() },
            historialCambios: [...historial, { ...marca, accion: `↩️ NO APLICA rechazado por el auditor: el hallazgo sigue aplicando. Motivo: ${texto}`, motivo: texto }],
          };
      }
      guardarRegistrosGrc(transaction, workspace, 'hallazgos', [actualizado]);
      if (planesActualizados.length) guardarPlanesGrc(transaction, workspace, planesActualizados);
      return { hallazgo: actualizado, planes: planesActualizados };
    });

    const errores = {
      'not-found': ['No se encontró el hallazgo.', 404],
      definitive: ['Este hallazgo ya fue cerrado como No aplica: la decisión es definitiva.', 409],
      closed: ['El hallazgo ya está cerrado.', 409],
      'already-pending': ['Ya hay una propuesta de No aplica pendiente de aprobación del auditor.', 409],
      'not-pending': ['No hay una propuesta de No aplica pendiente para este hallazgo.', 409],
      'forbidden-propose': ['Solo el ejecutor de alguna acción del hallazgo, el auditor del informe o un administrador pueden proponer No aplica.', 403],
      'forbidden-decide': ['Solo el auditor del informe o un administrador pueden aprobar o rechazar el No aplica.', 403],
    };
    if (resultado.error) {
      const [mensaje, estado] = errores[resultado.error];
      return sendError(res, mensaje, estado);
    }
    await notificarSemaforo(res);
    logger.info('No aplica de hallazgo', { idHallazgo, accion, estado: resultado.hallazgo?.noAplica?.estado, usuario: user.email });
    return sendSuccess(res, resultado);
  } catch (error) {
    logger.error('Error en No aplica de hallazgo', error, { idHallazgo, usuario: user.email });
    return sendError(res, 'No se pudo registrar el No aplica. No se cambió nada.', 500);
  }
}
