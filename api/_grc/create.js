import { randomUUID } from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { esInformePrograma, ESTADO_EVALUACION_INICIAL } from '../../src/utils/programPlanWorkflow.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import {
  guardarInformesGrc, guardarPlanesGrc, guardarWorkspaceParcial, leerWorkspaceGrc,
  leerWorkspaceGrcLigero, leerInformeTx, guardarRegistrosGrc, listarHallazgosTx, obtenerHallazgosTx, reservarIdsPlanesTx,
} from '../_lib/grcWorkspace.js';
import { obtenerProcesosAsignados, obtenerSubprocesosAsignados, registroDentroDelAlcance } from '../_lib/assignmentScope.js';
import { sanitizarUrls } from '../_lib/validation.js';

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
const hayRolesDuplicados = ({ correoResponsable, correoRevisor, correoAuditor }) => {
  const correos = [correoResponsable, correoRevisor, correoAuditor]
    .map(normalizar)
    .filter(Boolean);
  return new Set(correos).size !== correos.length;
};

async function reservarConsecutivoInforme(anio) {
  const refContador = adminDb.collection('_grc_counters').doc(`informes_${anio}`);
  const contadorExistente = await refContador.get();
  let ultimoConsecutivo = Number(contadorExistente.data()?.ultimo) || 0;

  if (!contadorExistente.exists) {
    const { data } = await leerWorkspaceGrc(null, { origen: 'create-consecutivo' });
    ultimoConsecutivo = (Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [])
      .reduce((mayor, informe) => {
        const coincidencia = String(informe?.ref || '').match(new RegExp(`^INF-${anio}-(\\d+)$`));
        return coincidencia ? Math.max(mayor, Number(coincidencia[1])) : mayor;
      }, 0);
  }

  return adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(refContador);
    const ultimoGuardado = Number(snapshot.data()?.ultimo) || 0;
    const siguiente = Math.max(ultimoGuardado, ultimoConsecutivo) + 1;
    transaction.set(refContador, {
      anio,
      ultimo: siguiente,
      actualizadoEn: new Date().toISOString(),
    }, { merge: true });
    return siguiente;
  });
}

async function repararConsecutivosInformes(user) {
  const perfilSnap = await adminDb.collection('usuarios').doc(user.uid).get();
  const perfil = perfilSnap.exists ? perfilSnap.data() : {};
  if (!esAdministrador(perfil.rol)) return { error: 'forbidden' };

  const { data } = await leerWorkspaceGrc(null, { origen: 'create-reparar-consecutivos' });
  const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
  const porReferencia = new Map();
  const maximosPorAnio = new Map();

  informes.forEach(informe => {
    const coincidencia = String(informe?.ref || '').match(/^INF-(\d{4})-(\d+)$/i);
    if (!coincidencia) return;
    const [, anio, consecutivo] = coincidencia;
    maximosPorAnio.set(anio, Math.max(maximosPorAnio.get(anio) || 0, Number(consecutivo)));
    const clave = `INF-${anio}-${consecutivo}`.toLowerCase();
    porReferencia.set(clave, [...(porReferencia.get(clave) || []), informe]);
  });

  const duplicados = [...porReferencia.values()].filter(grupo => grupo.length > 1);
  if (duplicados.length === 0) return { informesAuditoria: informes, reparados: 0 };

  const corregidosPorId = new Map();
  for (const grupo of duplicados) {
    const ordenados = [...grupo].sort((a, b) => (
      String(a.fecha || '').localeCompare(String(b.fecha || '')) ||
      String(a.fechaHora || '').localeCompare(String(b.fechaHora || '')) ||
      String(a.id || '').localeCompare(String(b.id || ''))
    ));
    const referenciaActual = String(ordenados[0].ref);
    const anio = referenciaActual.match(/^INF-(\d{4})-/i)?.[1] || String(new Date().getFullYear());

    for (const informe of ordenados.slice(1)) {
      const siguiente = (maximosPorAnio.get(anio) || 0) + 1;
      maximosPorAnio.set(anio, siguiente);
      const nuevaRef = `INF-${anio}-${String(siguiente).padStart(3, '0')}`;
      const historial = Array.isArray(informe.historialCambios) ? informe.historialCambios : [];
      corregidosPorId.set(String(informe.id), {
        ...informe,
        ref: nuevaRef,
        historialCambios: [...historial, {
          fecha: new Date().toLocaleString('es-CO'),
          timestamp: new Date().toISOString(),
          usuario: user.email,
          accion: `Consecutivo corregido por duplicidad: ${informe.ref} → ${nuevaRef}`,
          motivo: 'Renumeración automática para garantizar referencias únicas.',
        }],
      });
    }
  }

  const informesActualizados = informes.map(informe => corregidosPorId.get(String(informe.id)) || informe);
  await guardarWorkspaceParcial({ informesAuditoria: informesActualizados });
  await Promise.all([...maximosPorAnio].map(([anio, consecutivo]) => (
    adminDb.runTransaction(async transaction => {
      const refContador = adminDb.collection('_grc_counters').doc(`informes_${anio}`);
      const snapshot = await transaction.get(refContador);
      const ultimo = Number(snapshot.data()?.ultimo) || 0;
      transaction.set(refContador, {
        anio,
        ultimo: Math.max(ultimo, consecutivo),
        actualizadoEn: new Date().toISOString(),
      }, { merge: true });
    })
  )));
  await notificarSemaforo();
  return { informesAuditoria: informesActualizados, reparados: corregidosPorId.size };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    // 🛡️ H13: solo enlaces http/https en campos URL (misma regla que aplica el cliente).
    const { coleccion, registro } = sanitizarUrls(req.body || {});
    if (coleccion === 'repararConsecutivosInformes') {
      const resultado = await repararConsecutivosInformes(user);
      if (resultado.error === 'forbidden') return sendError(res, 'Solo un administrador puede reparar consecutivos.', 403);
      return sendSuccess(res, resultado);
    }
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

    const procesosAsignados = obtenerProcesosAsignados(perfil, user);
    const subprocesosAsignados = obtenerSubprocesosAsignados(perfil);
    const macroprocesosRegistro = Array.isArray(registro.macroprocesos) && registro.macroprocesos.length > 0
      ? registro.macroprocesos
      : [registro.macroproceso || String(registro.proceso || '').split('/')[0]];
    const procesoRegistro = normalizar(macroprocesosRegistro[0]);
    const subprocesosRegistro = (Array.isArray(registro.subprocesos) ? registro.subprocesos : [registro.subproceso]).map(normalizar);
    if (!admin && coleccion !== 'hallazgos' && coleccion !== 'planes' && !registroDentroDelAlcance(
      procesosAsignados,
      subprocesosAsignados,
      macroprocesosRegistro,
      subprocesosRegistro,
      registro.subprocesosPorMacroproceso
    )) {
      return sendError(res, 'El registro debe pertenecer a un proceso y subproceso asignados.', 403);
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

    const anioInforme = new Date().getFullYear();
    const consecutivoInforme = coleccion === 'informesAuditoria'
      ? await reservarConsecutivoInforme(anioInforme)
      : null;

    const registroGuardado = await adminDb.runTransaction(async (transaction) => {
      // Sin listar colecciones: los planes usan IDs reservados y solo los hallazgos necesitan la lista
      // completa de hallazgos (para el consecutivo HAL-AAAA-NNN). Informes y fuentes viven en el documento principal.
      const workspace = await leerWorkspaceGrcLigero(transaction, { origen: 'create-tx' });
      const { data, workspaceRef } = workspace;
      const registrosActuales = coleccion === 'hallazgos'
        ? await listarHallazgosTx(transaction, workspace)
        : coleccion === 'planes' ? [] : (Array.isArray(data[coleccion]) ? data[coleccion] : []);
      const ahora = new Date();
      const fechaIso = ahora.toISOString();
      let nuevoRegistro;

      if (coleccion === 'planes') {
        const informes = Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [];
        const hallazgosPorId = await obtenerHallazgosTx(transaction, workspace, registro.items.map(item => item.idHallazgo));
        let informe = informes.find(item => String(item.id) === String(registro.idInforme));
        if (!informe && registro.idInforme) {
          const informeSnapshot = await leerInformeTx(transaction, workspace, String(registro.idInforme).trim());
          if (informeSnapshot.exists) informe = { id: informeSnapshot.id, ...informeSnapshot.data() };
        }
        if (!informe) return { error: 'informe-not-found' };
        const correoAuditorInforme = String(
          informe.correoAuditor || informe.correoAuditorResponsable || informe.correo_auditor || ''
        ).trim();

        const items = [];
        // IDs libres verificados en la transacción (antes: máximo de toda la colección + 1).
        const idsNuevos = await reservarIdsPlanesTx(transaction, workspace, registro.items.length);
        let indiceNuevo = 0;
        const email = normalizar(user.email);

        for (const item of registro.items) {
          const hallazgo = hallazgosPorId.get(String(item.idHallazgo));
          if (!hallazgo || String(hallazgo.idInforme) !== String(registro.idInforme)) {
            return { error: 'hallazgo-not-found' };
          }

          const procesoHallazgo = normalizar(hallazgo.macroproceso || String(hallazgo.proceso || '').split('/')[0]);
          const subprocesosHallazgo = (Array.isArray(hallazgo.subprocesos) ? hallazgo.subprocesos : [hallazgo.subproceso])
            .map(normalizar);
          const creadoPorUsuario = normalizar(hallazgo.correoCreador || hallazgo.creadoPor) === email;
          const perteneceProcesoAsignado = procesosAsignados.length > 0 && registroDentroDelAlcance(
            procesosAsignados,
            subprocesosAsignados,
            procesoHallazgo,
            subprocesosHallazgo
          );
          if (!admin && !creadoPorUsuario && !perteneceProcesoAsignado) {
            return { error: 'hallazgo-forbidden' };
          }
          if (!normalizar(item.accion)) return { error: 'invalid-action' };
          const correoResponsable = String(item.correoResponsable || '').trim();
          const correoConfirmacion = String(item.correoConfirmacion || '').trim();
          const correoRevisor = String(item.correoRevisor || '').trim();
          const correoRevisorConfirmacion = String(item.correoRevisorConfirmacion || '').trim();
          const correoAuditor = String(item.correoAuditor || correoAuditorInforme).trim();
          if (esInformePrograma(informe, data.fuentesMejora) && !esCorreoValido(correoAuditor)) return { error: 'invalid-auditor-email' };
          if (
            !esCorreoValido(correoResponsable) ||
            !esCorreoValido(correoRevisor) ||
            normalizar(correoResponsable) !== normalizar(correoConfirmacion) ||
            normalizar(correoRevisor) !== normalizar(correoRevisorConfirmacion)
          ) return { error: 'invalid-email-confirmation' };
          if (hayRolesDuplicados({
            correoResponsable,
            correoRevisor,
            correoAuditor,
          })) return { error: 'duplicate-plan-roles' };

          const { correoConfirmacion: _correoConfirmacion, correoRevisorConfirmacion: _correoRevisorConfirmacion, ...datosPlan } = item;
          items.push({
            ...datosPlan,
            id: idsNuevos[indiceNuevo++],
            idInforme: informe.id,
            idHallazgo: hallazgo.id,
            ...(correoAuditor ? { correoAuditor } : {}),
            progreso: 0,
            ...(esInformePrograma(informe, data.fuentesMejora) ? {
              evaluacionHolistica: null, historialEvaluaciones: [],
              aprobadoPorCorreo: '', aprobadoEn: '', validadoPorRevisorCorreo: '', validadoPorRevisorEn: '',
            } : {}),
            estadoWorkflow: esInformePrograma(informe, data.fuentesMejora) ? ESTADO_EVALUACION_INICIAL : 'Pendiente Revisión Jefatura',
            estado: 'En Proceso',
            creadoPor: user.email,
            historialCambios: [{
              fecha: ahora.toLocaleString('es-CO'),
              usuario: user.email,
              accion: 'Actividad registrada en matriz por el líder de proceso',
            }],
          });
        }

        if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
        guardarPlanesGrc(transaction, workspace, items);
        return { registros: items };
      }

      if (coleccion === 'informesAuditoria') {
        const prefijo = `INF-${anioInforme}-`;
        nuevoRegistro = {
          ...registro,
          id: randomUUID(),
          ref: `${prefijo}${String(consecutivoInforme).padStart(3, '0')}`,
          correoCreador: user.email,
          creadoPor: user.email,
          historialCambios: [],
        };
      } else if (coleccion === 'hallazgos') {
        let informeOrigen = (Array.isArray(data.informesAuditoria) ? data.informesAuditoria : [])
          .find(informe => String(informe.id) === String(registro.idInforme));
        if (!informeOrigen && registro.idInforme) {
          const informeSnapshot = await leerInformeTx(transaction, workspace, String(registro.idInforme));
          if (informeSnapshot.exists) {
            informeOrigen = { id: informeSnapshot.id, ...informeSnapshot.data() };
          }
        }
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

      if (coleccion === 'informesAuditoria') {
        guardarInformesGrc(transaction, workspace, [nuevoRegistro, ...registrosActuales]);
      } else {
        if (workspace.tieneInformesLegados) guardarInformesGrc(transaction, workspace, data.informesAuditoria);
        if (coleccion === 'hallazgos') {
          guardarRegistrosGrc(transaction, workspace, 'hallazgos', [nuevoRegistro]);
        } else {
          transaction.set(workspaceRef, { [coleccion]: [nuevoRegistro, ...registrosActuales] }, { merge: true });
        }
      }
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
    if (registroGuardado.error === 'duplicate-plan-roles') {
      return sendError(res, 'Ejecutor, revisor y auditor deben ser personas distintas. Revisa los correos asignados.', 400);
    }
    if (registroGuardado.error === 'invalid-auditor-email') {
      return sendError(res, 'Asigna un correo válido al auditor que evaluará las acciones.', 400);
    }
    await notificarSemaforo();
    logger.info('Registro GRC creado', { coleccion, usuario: user.email, id: registroGuardado.id });
    return sendSuccess(res, registroGuardado.registros ? { registros: registroGuardado.registros } : { registro: registroGuardado });
  } catch (error) {
    logger.error('Error creando registro GRC', error, { endpoint: req.url });
    return sendError(res, 'No se pudo crear el registro.', 500);
  }
}
