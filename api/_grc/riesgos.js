// api/grc/riesgos.js - Endpoint Serverless para Gestión de Riesgos (ISO 31000 - Termales SR)
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
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

// 📊 Tabla 4 del Manual: Matriz de Calor Oficial
const MATRIZ_CALOR_MANUAL = {
  100: { 20: 'Alto',     40: 'Alto',     60: 'Alto',     80: 'Alto',  100: 'Extremo' },
  80:  { 20: 'Moderado', 40: 'Moderado', 60: 'Alto',     80: 'Alto',  100: 'Extremo' },
  60:  { 20: 'Moderado', 40: 'Moderado', 60: 'Moderado', 80: 'Alto',  100: 'Extremo' },
  40:  { 20: 'Bajo',     40: 'Moderado', 60: 'Moderado', 80: 'Alto',  100: 'Extremo' },
  20:  { 20: 'Bajo',     40: 'Bajo',     60: 'Moderado', 80: 'Alto',  100: 'Extremo' }
};

/**
 * Calcula la eficacia del control según los atributos de la Tabla 6 del Manual
 */
function calcularEficaciaControl(c) {
  if (!c) return 75;
  let score = 0;

  // 1. Tipo
  const tipo = c.tipo || 'Preventivo';
  if (tipo.includes('Detectivo')) score += 15;
  else if (tipo.includes('Correctivo')) score += 10;
  else score += 25; // Preventivo

  // 2. Ejecución
  const ejecucion = c.implementacion || c.ejecucion || 'Manual';
  if (ejecucion.includes('Automático')) score += 25;
  else score += 15; // Manual

  // 3. Documentación
  const doc = c.documentacion || '';
  if (doc.includes('Documentado') && !doc.includes('No documentado') && !doc.includes('Sin')) score += 15;

  // 4. Frecuencia
  const freq = c.frecuencia || '';
  if (freq.includes('Aleatoria') || freq.includes('Periódica')) score += 5;
  else score += 10; // Continua / Permanente

  // 5. Evidencia
  const evi = c.evidencia || '';
  if ((evi.includes('Con') && !evi.includes('Sin')) || evi.includes('registro') || evi.includes('Trazable')) score += 10;

  return Math.min(score, 100);
}

/**
 * Calcula la mitigación acumulativa (Tabla 8 del Manual)
 */
function calcularResidualesServidor(probInh, impInh, controles = []) {
  let currP = Number(probInh) || 60;
  let currI = Number(impInh) || 60;

  controles.forEach(c => {
    const eficaciaPct = calcularEficaciaControl(c) / 100;
    const tipo = c.tipo || 'Preventivo';

    if (tipo.includes('Correctivo')) {
      currI = currI - (currI * eficaciaPct);
    } else {
      currP = currP - (currP * eficaciaPct);
    }
  });

  const probResidual = Math.max(Math.round(currP), 0);
  const impResidual = Math.max(Math.round(currI), 0);

  return {
    probabilidadResidual: probResidual,
    impactoResidual: impResidual,
    nivelInherente: MATRIZ_CALOR_MANUAL[probInh]?.[impInh] || 'Moderado',
    nivelResidual: MATRIZ_CALOR_MANUAL[probResidual]?.[impResidual] || 'Bajo'
  };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const user = await requireAuth(req, res);
  if (!user) return;

  const { method } = req;

  try {
    // 🔍 LECTURA CON RLS (GET)
    if (method === 'GET') {
      const snapshot = await adminDb.collection('riesgos').get();
      const riesgos = snapshot.docs.map(documento => ({ docId: documento.id, ...documento.data() }));

      return sendSuccess(res, { riesgos });
    }

    // ✏️ CREACIÓN / ACTUALIZACIÓN (POST)
    if (method === 'POST') {
      const riesgoData = req.body || {};
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
      if (!riesgoDentroDelAlcancePropietario(riesgoSolicitado, procesosAsignados, subprocesosAsignados)) {
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

      const riesgoRef = adminDb.collection('riesgos').doc(String(id));
      const guardado = await adminDb.runTransaction(async (transaction) => {
        const riesgoExistente = await transaction.get(riesgoRef);
        const datosRiesgoExistente = riesgoExistente.data() || {};
        if (riesgoExistente.exists && !riesgoDentroDelAlcancePropietario(
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
      const { id } = req.query;
      if (!id) return sendError(res, 'ID de riesgo requerido.', 400);

      const isAdmin = ['admin', 'administrador', 'auditor'].includes(user.rol?.toLowerCase());
      if (!isAdmin) {
        return sendError(res, 'Solo los administradores o auditores pueden eliminar riesgos.', 403);
      }

      const procesosAsignados = obtenerProcesosAsignados(user, user);
      const subprocesosAsignados = obtenerSubprocesosAsignados(user);
      const riesgoRef = adminDb.collection('riesgos').doc(String(id));
      const eliminado = await adminDb.runTransaction(async transaction => {
        const snapshot = await transaction.get(riesgoRef);
        if (!snapshot.exists) return 'not-found';
        const riesgo = snapshot.data() || {};
        if (!riesgoDentroDelAlcancePropietario(riesgo, procesosAsignados, subprocesosAsignados)) return false;
        transaction.delete(riesgoRef);
        return true;
      });
      if (eliminado === 'not-found') return sendError(res, 'No se encontró el riesgo solicitado.', 404);
      if (!eliminado) return sendError(res, 'Solo el propietario del macroproceso puede eliminar este riesgo.', 403);
      logger.info('Riesgo eliminado de la matriz', { id, usuario: user.email });

      return sendSuccess(res, { message: 'Riesgo eliminado correctamente.' });
    }

    return sendError(res, 'Método no permitido.', 405);

  } catch (error) {
    logger.error('Error en api/grc/riesgos.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno procesando la matriz de riesgos.', 500);
  }
}