// api/grc/historico.js
import { adminAuth, adminDb } from '../_lib/firebaseAdmin';
import { requireAuth } from '../_lib/authMiddleware';

const CHUNK_SIZE = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  // 1. Validar autenticación
  const user = await requireAuth(req, res);
  if (!user) return; // Si no hay sesión válida, requireAuth ya envió la respuesta 401/403

  try {
    const { filasExcel, periodo } = req.body;

    if (!filasExcel || !Array.isArray(filasExcel) || filasExcel.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos de nómina válidos.' });
    }

    if (!periodo) {
      return res.status(400).json({ error: 'El campo período es obligatorio.' });
    }

    // 2. Agrupar por Empresa
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

    // 3. Escribir en Firestore desde el servidor
    for (const empNombre of Object.keys(porEmpresa)) {
      const empresaLimpia = empNombre.replace(/[\s/]/g, '_');
      const docBaseId = `${empresaLimpia}_${periodoLimpio}`;
      const filasEmpresa = porEmpresa[empNombre];
      
      // Guardar el Índice Principal
      await adminDb.collection('nominas_historicas').doc(docBaseId).set({
        periodo: periodoLimpio,
        empresa: empresaLimpia,
        fechaCarga: new Date().toISOString(),
        totalRegistros: filasEmpresa.length,
        subidoPor: user.email,
        esChunked: true 
      }, { merge: true });

      // Guardar por pedazos (Chunks)
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

  } catch (error) {
    console.error("❌ Error en api/grc/historico.js:", error);
    return res.status(500).json({ error: 'Error interno al procesar la nómina en el servidor.' });
  }
}