// api/grc/historico.js
import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';
import { requireAuth } from '../_lib/authMiddleware';

const CHUNK_SIZE = 500;

export default async function handler(req, res) {
  // 1. Validar autenticación siempre (Zero Trust)
  const user = await requireAuth(req, res);
  if (!user) return; // Si no hay sesión válida, requireAuth ya envió la respuesta 401/403

  const { method } = req;

  try {
    // =========================================================================
    // 📖 PETICIONES GET (LECTURA SEGURA)
    // =========================================================================
    if (method === 'GET') {
      const { action, periodo, empresa } = req.query;

      // 1. Obtener lista de Nóminas
      if (action === 'listaHistoricos') {
        const snap = await adminDb.collection('nominas_historicas').get();
        const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ lista: lista.sort((a, b) => b.periodo.localeCompare(a.periodo)) });
      }
      
      // 2. Descargar una Nómina específica
      if (action === 'cargarNomina') {
        const empresaLimpia = empresa.toString().trim().replace(/[\s/]/g, '_');
        const periodoLimpio = periodo.toString().trim().replace('/', '-');
        const docBaseId = `${empresaLimpia}_${periodoLimpio}`;
        
        const chunksSnap = await adminDb.collection(`nominas_historicas/${docBaseId}/chunks`).get();
        let datos = [];
        if (!chunksSnap.empty) {
          chunksSnap.forEach(doc => {
            const info = doc.data();
            if (info.datos) datos.push(...info.datos);
          });
        } else {
          // Soporte para formato antiguo sin chunks
          const docSnap = await adminDb.collection('nominas_historicas').doc(docBaseId).get();
          if (docSnap.exists) {
            datos = docSnap.data().empleados || docSnap.data().transacciones || [];
          }
        }
        return res.status(200).json({ datos });
      }

      // 3. Obtener lista de Marcaciones Biométricas
      if (action === 'listaMarcaciones') {
        const snap = await adminDb.collection('marcaciones_historicas').get();
        const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ lista: lista.sort((a, b) => new Date(b.fechaCarga) - new Date(a.fechaCarga)) });
      }

      // 4. Descargar TODAS las Marcaciones Biométricas
      if (action === 'cargarMarcaciones') {
        const indicesSnap = await adminDb.collection('marcaciones_historicas').get();
        let todosLosDatos = [];
        
        for (const indiceDoc of indicesSnap.docs) {
          const chunksSnap = await adminDb.collection(`marcaciones_historicas/${indiceDoc.id}/chunks`).get();
          chunksSnap.forEach(chunkDoc => {
            const info = chunkDoc.data();
            if (info.datos) todosLosDatos.push(...info.datos);
          });
        }
        return res.status(200).json({ datos: todosLosDatos });
      }

      return res.status(400).json({ error: 'Acción GET no reconocida por el backend.' });
    }

    // =========================================================================
    // 💾 PETICIONES POST (ESCRITURA SEGURA EN CHUNKS)
    // =========================================================================
    if (method === 'POST') {
      const { filasExcel, periodo, filasMarcaciones, tipo } = req.body;

      // A. Lógica para guardar Biométrico
      if (tipo === 'marcaciones' && filasMarcaciones) {
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
        return res.status(200).json({ success: true, message: 'Marcaciones guardadas en el servidor.' });
      }
      
      // B. Lógica original para guardar Nómina (Se conserva intacta tu lógica de negocio)
      if (filasExcel && periodo) {
        if (!Array.isArray(filasExcel) || filasExcel.length === 0) {
          return res.status(400).json({ error: 'No se enviaron datos de nómina válidos.' });
        }

        // Agrupar por Empresa
        const porEmpresa = {};
        filasExcel.forEach(fila => {
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

        return res.status(200).json({
          success: true,
          message: `Nómina del periodo ${periodo} procesada y guardada correctamente en el servidor.`
        });
      }

      return res.status(400).json({ error: 'Estructura de datos POST inválida.' });
    }

    // =========================================================================
    // 🗑️ PETICIONES DELETE (ELIMINACIÓN SEGURA)
    // =========================================================================
    if (method === 'DELETE') {
      const { docId, tipo } = req.body;
      const coleccion = tipo === 'marcaciones' ? 'marcaciones_historicas' : 'nominas_historicas';
      
      const chunksSnap = await adminDb.collection(`${coleccion}/${docId}/chunks`).get();
      const batch = adminDb.batch();
      
      chunksSnap.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      batch.delete(adminDb.collection(coleccion).doc(docId));
      await batch.commit();
      
      return res.status(200).json({ success: true, message: 'Archivo eliminado correctamente.' });
    }

    return res.status(405).json({ error: 'Método HTTP no permitido.' });
    
  } catch (error) {
    console.error("❌ Error en api/grc/historico.js:", error);
    return res.status(500).json({ error: 'Error interno en el servidor.', details: error.message });
  }
}