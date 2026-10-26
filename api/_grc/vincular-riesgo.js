// api/_grc/vincular-riesgo.js - Vincula o desvincula un riesgo de la matriz a una acción del módulo de Planes.
// Es un dato informativo (numeral 9: el riesgo Extremo/Alto cuenta como "con plan"): no cambia el estado de la
// acción ni la reenvía a revisión, y se puede hacer en cualquier estado salvo "No aplica". Lo pueden hacer el
// administrador, quienes participan en la acción (ejecutor, revisor, auditor) o el líder del proceso del hallazgo.
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { esAdministradorTotal } from '../_lib/roles.js';
import { guardarPlanesGrc, leerWorkspaceGrcLigero, obtenerHallazgosTx, obtenerPlanesTx } from '../_lib/grcWorkspace.js';
import { obtenerProcesosAsignados, obtenerSubprocesosAsignados, registroDentroDelAlcance } from '../_lib/assignmentScope.js';

const normalizar = valor => String(valor || '').trim().toLowerCase();
const correos = valor => String(valor || '').split(',').map(normalizar).filter(Boolean);
const ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_RIESGOS_VINCULADOS = 50;

/** ¿Puede el usuario cambiar los riesgos vinculados de esta acción? */
export function puedeVincular(user, plan, hallazgo) {
  if (esAdministradorTotal(user.rol)) return true;
  const yo = normalizar(user.email);
  const participa = [plan.correoResponsable, plan.correoRevisor, plan.correoAuditor].some(valor => correos(valor).includes(yo));
  if (participa) return true;
  const procesos = obtenerProcesosAsignados(user, user);
  if (!procesos.length || !hallazgo) return false;
  const proceso = normalizar(hallazgo.macroproceso || String(hallazgo.proceso || '').split('/')[0]);
  const subprocesos = (Array.isArray(hallazgo.subprocesos) ? hallazgo.subprocesos : [hallazgo.subproceso]).map(normalizar);
  return registroDentroDelAlcance(procesos, obtenerSubprocesosAsignados(user), proceso, subprocesos);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);
  const user = await requireAuth(req, res);
  if (!user) return;

  const { idPlan, idRiesgo, accion } = req.body || {};
  const riesgo = String(idRiesgo ?? '').trim();
  if (!idPlan || !ID_VALIDO.test(String(idPlan)) || !ID_VALIDO.test(riesgo) || !['vincular', 'desvincular'].includes(accion)) {
    return sendError(res, 'Solicitud de vínculo no válida.', 400);
  }

  try {
    const resultado = await adminDb.runTransaction(async transaction => {
      const workspace = await leerWorkspaceGrcLigero(transaction, { origen: 'vincular-riesgo-tx' });
      if (!workspace.workspaceExists) return { error: 'not-found' };
      const [plan] = await obtenerPlanesTx(transaction, workspace, [String(idPlan)]);
      if (!plan) return { error: 'not-found' };
      if (plan.estadoWorkflow === 'No aplica' || plan.noAplica === true) return { error: 'no-aplica' };
      const hallazgo = (await obtenerHallazgosTx(transaction, workspace, [plan.idHallazgo])).get(String(plan.idHallazgo));
      if (!puedeVincular(user, plan, hallazgo)) return { error: 'forbidden' };

      const actuales = (Array.isArray(plan.riesgosVinculados) ? plan.riesgosVinculados : []).map(String);
      const vinculados = accion === 'vincular' ? [...new Set([...actuales, riesgo])] : actuales.filter(id => id !== riesgo);
      if (vinculados.length > MAX_RIESGOS_VINCULADOS) return { error: 'too-many' };
      if (JSON.stringify(vinculados) === JSON.stringify(actuales)) return { plan };

      const ahora = new Date();
      const actualizado = {
        ...plan,
        matrizRiesgos: vinculados.length ? 'Sí aplica' : (plan.matrizRiesgos === 'Sí aplica' ? 'No aplica' : plan.matrizRiesgos || 'No aplica'),
        riesgosVinculados: vinculados,
        historialCambios: [...(Array.isArray(plan.historialCambios) ? plan.historialCambios : []), {
          fecha: ahora.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
          usuario: user.email,
          accion: accion === 'vincular' ? `Vinculada al riesgo RSK-${riesgo} (matriz de riesgos)` : `Desvinculada del riesgo RSK-${riesgo}`,
          detalleCambios: [{ campo: 'riesgosVinculados', antes: actuales, despues: vinculados }],
        }],
      };
      guardarPlanesGrc(transaction, workspace, [actualizado]);
      return { plan: actualizado };
    });

    const errores = {
      'not-found': ['No se encontró la acción.', 404],
      'no-aplica': ['La acción está cerrada como No aplica: no se vincula a la matriz de riesgos.', 409],
      forbidden: ['Solo el administrador, quienes participan en la acción o el líder del proceso pueden vincularla a un riesgo.', 403],
      'too-many': [`Una acción admite como máximo ${MAX_RIESGOS_VINCULADOS} riesgos vinculados.`, 400],
    };
    if (resultado.error) {
      const [mensaje, estado] = errores[resultado.error];
      return sendError(res, mensaje, estado);
    }
    await notificarSemaforo(res);
    logger.info('Vínculo de riesgo en acción', { idPlan, idRiesgo: riesgo, accion, usuario: user.email });
    return sendSuccess(res, { plan: resultado.plan });
  } catch (error) {
    logger.error('Error vinculando riesgo a la acción', error, { idPlan, idRiesgo: riesgo, usuario: user.email });
    return sendError(res, 'No se pudo guardar el vínculo. No se cambió nada.', 500);
  }
}
