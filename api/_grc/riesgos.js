// api/grc/riesgos.js - Endpoint Serverless para Gestión de Riesgos (ISO 31000 - Termales SR)
import { applyCors } from '../_lib/cors.js';
import { riesgosVisiblesPara } from '../../src/utils/permisosVista.js';
import { puedeVerTodo } from '../_lib/roles.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { parametrosConsulta } from '../_lib/seguridad.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { notificarSemaforo } from '../_lib/semaforo.js';
import { sanitizarUrls } from '../_lib/validation.js';
import { calcularResiduales } from '../../src/utils/explicacionControles.js';
import { zonaSeveridad } from '../../src/utils/nivelRiesgo.js';
import { revisarControlesEliminados } from '../../src/utils/anulacion.js';
import { compararRiesgos, entradaDeCambios } from '../../src/utils/historialRiesgo.js';
import {
  eliminarRiesgoFragmentado, guardarRiesgoFragmentado, leerRiesgosVigentes, riesgosMigrados,
} from '../_lib/grcWorkspace.js';
import { obtenerProcesosAsignados, obtenerSubprocesosAsignados, normalizarProcesoAlcance, registroDentroDelAlcance } from '../_lib/assignmentScope.js';

const convertirListaProceso = valor => Array.isArray(valor)
  ? valor.map(item => String(item || '').trim()).filter(Boolean)
  : String(valor || '').split(',').map(item => item.trim()).filter(Boolean);

const macroprocesosDeRiesgo = riesgo => {
  const partesLegadas = String(riesgo.proceso || '').split('/').map(parte => parte.trim()).filter(Boolean);
  const macroprocesos = convertirListaProceso(riesgo.macroprocesos).length > 0
    ? convertirListaProceso(riesgo.macroprocesos)
    : convertirListaProceso(riesgo.macroproceso || partesLegadas[0]);
  return [...new Set(macroprocesos.map(macroproceso => macroproceso.split('/')[0].trim()).filter(Boolean))];
};

const subprocesosDeRiesgo = (riesgo, macroproceso) => {
  const relaciones = riesgo.subprocesosPorMacroproceso && typeof riesgo.subprocesosPorMacroproceso === 'object'
    ? riesgo.subprocesosPorMacroproceso
    : {};
  const claveRelacion = Object.keys(relaciones).find(clave => (
    normalizarProcesoAlcance(clave) === normalizarProcesoAlcance(macroproceso)
  ));
  if (claveRelacion) return convertirListaProceso(relaciones[claveRelacion]);
  const subprocesos = convertirListaProceso(riesgo.subprocesos).length > 0
    ? convertirListaProceso(riesgo.subprocesos)
    : convertirListaProceso(riesgo.subproceso);
  if (subprocesos.length > 0) return subprocesos;
  const partesLegadas = String(riesgo.proceso || '').split('/').map(parte => parte.trim()).filter(Boolean);
  return partesLegadas.length > 1 ? partesLegadas.slice(1) : [];
};

const riesgoDentroDelAlcancePropietario = (riesgo, procesosAsignados, subprocesosAsignados) => {
  const macroprocesos = macroprocesosDeRiesgo(riesgo);
  if (procesosAsignados.length === 0 || macroprocesos.length === 0) return false;
  if (subprocesosAsignados.length > 0 && macroprocesos.length > 1
    && (!riesgo.subprocesosPorMacroproceso || typeof riesgo.subprocesosPorMacroproceso !== 'object')) return false;
  return macroprocesos.every(macroproceso => registroDentroDelAlcance(
    procesosAsignados,
    subprocesosAsignados,
    [macroproceso],
    subprocesosDeRiesgo(riesgo, macroproceso),
    riesgo.subprocesosPorMacroproceso,
  ));
};

// Eficacia (Tabla 6) y mitigación acumulativa (Tabla 8): la misma regla que usa la matriz en el navegador.
function calcularResidualesServidor(probInh, impInh, controles = []) {
  const { probabilidadResidual: probResidual, impactoResidual: impResidual } = calcularResiduales(probInh, impInh, controles);

  return {
    probabilidadResidual: probResidual,
    impactoResidual: impResidual,
    // Tabla 4 del manual con rangos: un residual de 25 % es probabilidad Baja (antes no encontraba fila y quedaba "Bajo").
    // Sin probabilidad o impacto registrados la zona queda "Sin dato" (no se asume un nivel).
    nivelInherente: probResidual === null ? 'Sin dato' : zonaSeveridad(probInh, impInh, true).label,
    nivelResidual: probResidual === null ? 'Sin dato' : zonaSeveridad(probResidual, impResidual, true).label,
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { method } = req;
  const esAdministrador = ['admin', 'administrador'].includes(String(user.rol || '').trim().toLowerCase());

  try {
    // 🔍 LECTURA CON RLS (GET)
    if (method === 'GET') {
      // Con la matriz migrada se devuelve la misma fuente que ve la aplicación.
      // Mismo alcance que la sincronización: solo sus macroprocesos, salvo "Ver todos los riesgos".
      const alcance = { veTodo: puedeVerTodo(user.rol), permisos: user.permisos, procesosAsignados: obtenerProcesosAsignados(user, user) };
      if (await riesgosMigrados()) {
        return sendSuccess(res, { riesgos: riesgosVisiblesPara(await leerRiesgosVigentes(), alcance) });
      }
      const snapshot = await adminDb.collection('riesgos').get();
      const riesgos = snapshot.docs.map(documento => ({ docId: documento.id, ...documento.data() }));

      return sendSuccess(res, { riesgos: riesgosVisiblesPara(riesgos, alcance) });
    }

    // ✏️ CREACIÓN / ACTUALIZACIÓN (POST)
    if (method === 'POST') {
      // 🛡️ H13: solo enlaces http/https en campos URL (misma regla que aplica el cliente).
      const riesgoData = sanitizarUrls(req.body || {});
      const { id, proceso, probabilidadInherente, impactoInherente, controlesDetallados } = riesgoData;

      if (!id || !proceso) {
        return sendError(res, 'El ID y el Proceso son campos obligatorios.', 400);
      }

      const procesosAsignados = obtenerProcesosAsignados(user, user);
      const subprocesosAsignados = obtenerSubprocesosAsignados(user);
      const riesgoSolicitado = {
        ...riesgoData,
        macroproceso: riesgoData.macroproceso || String(proceso).split('/')[0].trim(),
      };
      if (!esAdministrador && !riesgoDentroDelAlcancePropietario(riesgoSolicitado, procesosAsignados, subprocesosAsignados)) {
        return sendError(res, 'No tiene permisos para modificar riesgos de otro proceso.', 403);
      }

      // 🧮 Recálculo obligatorio en servidor (Cero confianza en el cliente)
      const calculos = calcularResidualesServidor(
        probabilidadInherente,
        impactoInherente,
        controlesDetallados || []
      );

      const documentoRiesgo = {
        ...riesgoData,
        ...calculos,
        actualizadoPor: user.email,
        ultimaActualizacion: new Date().toISOString()
      };

      // Matriz migrada: se guarda en la misma fuente que lee la aplicación (antes quedaba en una
      // colección que nadie leía y la edición no aparecía al recargar).
      if (await riesgosMigrados()) {
        const resultado = await guardarRiesgoFragmentado({ ...documentoRiesgo, id }, {
          autorizar: existente => esAdministrador || riesgoDentroDelAlcancePropietario(existente, procesosAsignados, subprocesosAsignados),
          // Solo un administrador puede borrar controles guardados; los demás los anulan (queda el historial).
          validar: existente => (esAdministrador ? '' : revisarControlesEliminados(existente, documentoRiesgo)),
          // Historial con el detalle de lo que cambió respecto a la versión guardada (quién, cuándo, antes y después).
          completar: (actualizado, existente) => {
            if (!existente) return actualizado;
            const entrada = entradaDeCambios({ usuario: user.email, cambios: compararRiesgos(existente, actualizado) });
            if (!entrada) return actualizado;
            const historial = Array.isArray(actualizado.historialCambios) ? actualizado.historialCambios : [];
            return { ...actualizado, historialCambios: [...historial, entrada] };
          },
        });
        if (!resultado.autorizado) {
          logger.warn('Intento de modificar riesgo de otro proceso', { id, usuario: user.email, proceso });
          return sendError(res, 'No tiene permisos para modificar riesgos de otro proceso.', 403);
        }
        if (resultado.rechazo) {
          logger.warn('Guardado de riesgo rechazado', { id, usuario: user.email, motivo: resultado.rechazo });
          return sendError(res, resultado.rechazo, 409);
        }
        await notificarSemaforo();
        logger.info('Riesgo corporativo guardado en servidor', { id, usuario: user.email, nivelResidual: calculos.nivelResidual });
        return sendSuccess(res, { message: 'Riesgo evaluado y almacenado correctamente.', riesgo: resultado.riesgo });
      }

      const riesgoRef = adminDb.collection('riesgos').doc(String(id));
      const guardado = await adminDb.runTransaction(async (transaction) => {
        const riesgoExistente = await transaction.get(riesgoRef);
        const datosRiesgoExistente = riesgoExistente.data() || {};
        if (riesgoExistente.exists && !esAdministrador && !riesgoDentroDelAlcancePropietario(
          datosRiesgoExistente,
          procesosAsignados,
          subprocesosAsignados,
        )) {
          return false;
        }

        transaction.set(riesgoRef, documentoRiesgo, { merge: true });
        return true;
      });

      if (!guardado) {
        logger.warn('Intento de modificar riesgo de otro proceso', { id, usuario: user.email, proceso });
        return sendError(res, 'No tiene permisos para modificar riesgos de otro proceso.', 403);
      }

      logger.info('Riesgo corporativo guardado en servidor', { id, usuario: user.email, nivelResidual: calculos.nivelResidual });

      return sendSuccess(res, {
        message: 'Riesgo evaluado y almacenado correctamente.',
        riesgo: documentoRiesgo
      });
    }

    // 🗑️ ELIMINACIÓN (DELETE)
    if (method === 'DELETE') {
      const { id } = parametrosConsulta(req);
      if (!id) return sendError(res, 'ID de riesgo requerido.', 400);

      const puedeEliminarPorRol = esAdministrador;
      if (!puedeEliminarPorRol) {
        return sendError(res, 'Solo los administradores o auditores pueden eliminar riesgos.', 403);
      }

      const procesosAsignados = obtenerProcesosAsignados(user, user);
      const subprocesosAsignados = obtenerSubprocesosAsignados(user);
      if (await riesgosMigrados()) {
        const eliminadoMatriz = await eliminarRiesgoFragmentado(id, {
          autorizar: riesgo => esAdministrador || riesgoDentroDelAlcancePropietario(riesgo, procesosAsignados, subprocesosAsignados),
        });
        if (eliminadoMatriz === 'not-found') return sendError(res, 'No se encontró el riesgo solicitado.', 404);
        if (!eliminadoMatriz) return sendError(res, 'Solo el propietario del macroproceso o un administrador puede eliminar este riesgo.', 403);
        await notificarSemaforo();
        logger.info('Riesgo eliminado de la matriz', { id, usuario: user.email });
        return sendSuccess(res, { message: 'Riesgo eliminado correctamente.' });
      }
      const riesgoRef = adminDb.collection('riesgos').doc(String(id));
      const eliminado = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(riesgoRef);
        if (!snapshot.exists) return 'not-found';
        const riesgo = snapshot.data() || {};
        if (!esAdministrador && !riesgoDentroDelAlcancePropietario(riesgo, procesosAsignados, subprocesosAsignados)) return false;
        transaction.delete(riesgoRef);
        return true;
      });
      if (eliminado === 'not-found') return sendError(res, 'No se encontró el riesgo solicitado.', 404);
      if (!eliminado) return sendError(res, 'Solo el propietario del macroproceso o un administrador puede eliminar este riesgo.', 403);
      logger.info('Riesgo eliminado de la matriz', { id, usuario: user.email });

      return sendSuccess(res, { message: 'Riesgo eliminado correctamente.' });
    }

    return sendError(res, 'Método no permitido.', 405);

  } catch (error) {
    logger.error('Error en api/grc/riesgos.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno procesando la matriz de riesgos.', 500);
  }
}