// api/grc/historico.js - Gestión de Nómina y Biometría con Optimización Async y RLS
import { adminDb } from '../_lib/firebaseAdmin.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { applyCors } from '../_lib/cors.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';

const CHUNK_SIZE = 500;

/**
 * Valida si el usuario posee privilegios para operaciones administrativas.
 */
function esRolAdministrador(rol) {
  if (!rol || typeof rol !== 'string') return false;
  const normalizado = rol.toLowerCase().trim();
  return normalizado === 'admin' || normalizado === 'administrador' || normalizado === 'auditor';
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const { method } = req;
    const isAdmin = esRolAdministrador(user.rol);

    // =========================================================================
    // 📖 PETICIONES GET (LECTURA SEGURA Y PARALELIZADA)
    // =========================================================================
    if (method === 'GET') {
      if (!isAdmin) {
        logger.warn('Intento no autorizado de lectura de histórico', { usuario: user.email, rol: user.rol });
        return sendError(res, 'Permisos insuficientes para consultar históricos de nómina o marcaciones.', 403);
      }

      const { action, periodo, empresa } = req.query;

      // 1. Obtener lista de Nóminas
      if (action === 'listaHistoricos') {
        const snap = await adminDb.collection('nominas_historicas').get();
        const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const ordenada = lista.sort((a, b) => String(b.periodo || '').localeCompare(String(a.periodo || '')));
        return sendSuccess(res, { lista: ordenada });
      }

      // 2. Descargar una Nómina específica
      if (action === 'cargarNomina') {
        if (!periodo || !empresa) {
          return sendError(res, 'Parámetros periodo y empresa son requeridos.', 400);
        }

        const empresaLimpia = String(empresa).trim().replace(/[\s/]/g, '_');
        const periodoLimpio = String(periodo).trim().replace('/', '-');
        const docBaseId = `${empresaLimpia}_${periodoLimpio}`;

        const chunksSnap = await adminDb.collection(`nominas_historicas/${docBaseId}/chunks`).get();
        let datos = [];

        if (!chunksSnap.empty) {
          chunksSnap.forEach(doc => {
            const info = doc.data();
            if (Array.isArray(info.datos)) datos.push(...info.datos);
          });
        } else {
          // Soporte para legado sin chunks
          const docSnap = await adminDb.collection('nominas_historicas').doc(docBaseId).get();
          if (docSnap.exists) {
            const payload = docSnap.data();
            datos = payload.empleados || payload.transacciones || [];
          }
        }
        return sendSuccess(res, { datos });
      }

      // 3. Obtener lista de Marcaciones Biométricas
      if (action === 'listaMarcaciones') {
        const snap = await adminDb.collection('marcaciones_historicas').get();
        const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const ordenada = lista.sort((a, b) => new Date(b.fechaCarga || 0) - new Date(a.fechaCarga || 0));
        return sendSuccess(res, { lista: ordenada });
      }

      // 4. Descargar Marcaciones Biométricas (Consultas Ejecutadas en Paralelo)
      if (action === 'cargarMarcaciones') {
        const indicesSnap = await adminDb.collection('marcaciones_historicas').get();

        if (indicesSnap.empty) {
          return sendSuccess(res, { datos: [] });
        }

        // 🚀 Promesas en paralelo para resolver el cuello de botella N+1 y prevenir timeouts
        const promesasChunks = indicesSnap.docs.map(indiceDoc =>
          adminDb.collection(`marcaciones_historicas/${indiceDoc.id}/chunks`).get()
        );

        const chunksSnaps = await Promise.all(promesasChunks);
        const todosLosDatos = [];

        chunksSnaps.forEach(chunkSnap => {
          chunkSnap.forEach(doc => {
            const info = doc.data();
            if (Array.isArray(info.datos)) todosLosDatos.push(...info.datos);
          });
        });

        return sendSuccess(res, { datos: todosLosDatos });
      }

      return sendError(res, 'Acción GET no reconocida por el servidor.', 400);
    }

    // =========================================================================
    // 💾 PETICIONES POST (ESCRITURA CON CONTROL DE ROLES)
    // =========================================================================
    if (method === 'POST') {
      if (!isAdmin) {
        logger.warn('Intento no autorizado de carga de histórico', { usuario: user.email });
        return sendError(res, 'Permisos insuficientes para cargar registros históricos.', 403);
      }

      const { filasExcel, periodo, filasMarcaciones, tipo } = req.body || {};

      // A. Guardar Marcaciones
      if (tipo === 'marcaciones' && Array.isArray(filasMarcaciones) && filasMarcaciones.length > 0) {
        const docBaseId = `marcaciones_GCM_${Date.now()}`;
        const batch = adminDb.batch();

        const refIndice = adminDb.collection('marcaciones_historicas').doc(docBaseId);
        batch.set(refIndice, {
          id: docBaseId,
          fechaCarga: new Date().toISOString(),
          totalRegistros: filasMarcaciones.length,
          subidoPor: user.email,
          tipo: 'Biometria_Completa'
        }, { merge: true });

        for (let i = 0; i < filasMarcaciones.length; i += CHUNK_SIZE) {
          const pedazo = filasMarcaciones.slice(i, i + CHUNK_SIZE);
          const refChunk = adminDb.doc(`marcaciones_historicas/${docBaseId}/chunks/part_${i}`);
          batch.set(refChunk, { datos: pedazo });
        }

        await batch.commit();
        logger.info('Marcaciones guardadas correctamente', { docBaseId, total: filasMarcaciones.length, usuario: user.email });
        return sendSuccess(res, { success: true, message: 'Marcaciones guardadas en el servidor.' });
      }

      // B. Guardar Nómina
      if (Array.isArray(filasExcel) && filasExcel.length > 0 && periodo) {
        const porEmpresa = {};
        filasExcel.forEach(fila => {
          if (!fila || typeof fila !== 'object') return;
          const llaves = Object.keys(fila);
          const llaveEmpresa = llaves.find(k => k.toLowerCase().includes('empresa') || k.toLowerCase().includes('compania'));
          let empNombre = llaveEmpresa ? fila[llaveEmpresa] : 'GENERAL';

          const empresasLista = String(empNombre).split('+').map(e => e.trim());
          empresasLista.forEach(e => {
            if (!porEmpresa[e]) porEmpresa[e] = [];
            porEmpresa[e].push(fila);
          });
        });

        const periodoLimpio = String(periodo).trim().replace('/', '-');

        for (const empNombre of Object.keys(porEmpresa)) {
          const empresaLimpia = empNombre.replace(/[\s/]/g, '_');
          const docBaseId = `${empresaLimpia}_${periodoLimpio}`;
          const filasEmpresa = porEmpresa[empNombre];

          await adminDb.collection('nominas_historicas').doc(docBaseId).set({
            periodo: periodoLimpio,
            empresa: empresaLimpia,
            fechaCarga: new Date().toISOString(),
            totalRegistros: filasEmpresa.length,
            subidoPor: user.email,
            esChunked: true
          }, { merge: true });

          const batch = adminDb.batch();
          for (let i = 0; i < filasEmpresa.length; i += CHUNK_SIZE) {
            const pedazo = filasEmpresa.slice(i, i + CHUNK_SIZE);
            const refChunk = adminDb.doc(`nominas_historicas/${docBaseId}/chunks/part_${i}`);
            batch.set(refChunk, { datos: pedazo });
          }
          await batch.commit();
        }

        logger.info('Nómina guardada correctamente', { periodo: periodoLimpio, usuario: user.email });
        return sendSuccess(res, {
          success: true,
          message: `Nómina del periodo ${periodo} procesada y guardada correctamente en el servidor.`
        });
      }

      return sendError(res, 'Estructura de datos POST inválida o vacía.', 400);
    }

    // =========================================================================
    // 🗑️ PETICIONES DELETE (ELIMINACIÓN PROTEGIDA)
    // =========================================================================
    if (method === 'DELETE') {
      if (!isAdmin) {
        logger.warn('Intento no autorizado de eliminación de histórico', { usuario: user.email });
        return sendError(res, 'Permisos insuficientes para eliminar datos históricos.', 403);
      }

      const { docId, tipo } = req.body || {};
      if (!docId) {
        return sendError(res, 'Identificador de documento (docId) requerido.', 400);
      }

      const coleccion = tipo === 'marcaciones' ? 'marcaciones_historicas' : 'nominas_historicas';
      const chunksSnap = await adminDb.collection(`${coleccion}/${docId}/chunks`).get();
      const batch = adminDb.batch();

      chunksSnap.forEach(doc => {
        batch.delete(doc.ref);
      });

      batch.delete(adminDb.collection(coleccion).doc(docId));
      await batch.commit();

      logger.info('Histórico eliminado con éxito', { docId, coleccion, usuario: user.email });
      return sendSuccess(res, { success: true, message: 'Archivo eliminado correctamente.' });
    }

    return sendError(res, 'Método HTTP no permitido.', 405);

  } catch (error) {
    logger.error('Error interno en api/grc/historico.js', error, { endpoint: req.url });
    return sendError(res, 'Error interno en el servidor.', 500);
  }
}