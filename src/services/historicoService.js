/**
 * HISTORICO SERVICE - GCM AUDITOR v5.0
 * Gestión de almacenamiento y consulta de nóminas históricas en Firebase Firestore.
 */
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ⚠️ NOTA DE IMPORTACIÓN:
// Si tu archivo se llama "NormalizadorNomina.js" (con N mayúscula), mantén la importación con mayúscula.
// Si está en la carpeta utils, ajusta a "../utils/NormalizadorNomina".
import { normalizarSabanaNomina } from "./NormalizadorNomina";

/**
 * 💾 PASO 1: GUARDAR NÓMINA HISTÓRICA
 * Toma el Excel crudo, lo normaliza mediante la función ETL y guarda el snapshot en Firestore.
 * 
 * @param {Array} filasExcel - Transacciones crudas leídas del archivo de Excel.
 * @param {string} periodo - Período en formato ISO (ej: "2026-05" o "2026-04").
 * @param {string} empresa - Nombre o NIT de la empresa (ej: "Termales" o "Fam").
 */
export const guardarNominaHistorica = async (filasExcel, periodo, empresa = 'Termales') => {
  try {
    if (!filasExcel || filasExcel.length === 0) {
      throw new Error("No hay datos en la nómina para guardar.");
    }

    // 1. Normalización ETL de los registros de nómina
    const datosEstructurados = typeof normalizarSabanaNomina === 'function' 
      ? normalizarSabanaNomina(filasExcel)
      : filasExcel; // Fallback defensivo si ya vienen pivoteados
    
    // 2. Normalizar el formato del ID de documento para Firestore
    const empresaLimpia = empresa.toString().trim().replace(/[\s/]/g, '_');
    const periodoLimpio = periodo.toString().trim().replace('/', '-');
    const docId = `${empresaLimpia}_${periodoLimpio}`; // Ej: "Fam_2026-05"
    
    const docRef = doc(db, 'nominas_historicas', docId);

    // 3. Persistencia en la colección de Firestore
    await setDoc(docRef, {
      periodo: periodoLimpio,
      empresa: empresaLimpia,
      fechaCarga: new Date().toISOString(),
      totalRegistros: datosEstructurados.length,
      empleados: datosEstructurados 
    }, { merge: true });

    return { 
      success: true, 
      message: `Nómina del período ${periodoLimpio} guardada con éxito en Firestore (${datosEstructurados.length} registros).` 
    };
  } catch (error) {
    console.error("Error guardando nómina histórica en Firestore:", error);
    throw new Error(`No se pudo guardar la nómina en la nube: ${error.message}`);
  }
};

/**
 * 🔍 PASO 2: CONSULTAR HISTÓRICO PARA EL MOTOR DE AUDITORÍA
 * Consulta Firestore para obtener la nómina del mes/período anterior y calcular
 * los promedios reales del IBC según el Art. 70 del Decreto 806/1998.
 * 
 * @param {string} periodo - Período a consultar en formato "YYYY-MM" (ej: "2026-04").
 * @param {string} empresa - Identificador de la empresa.
 * @returns {Promise<Array>} Array con los registros pivoteados de los empleados.
 */
export const cargarNominaHistorica = async (periodo, empresa = 'Termales') => {
  try {
    if (!periodo) return [];

    const empresaLimpia = empresa.toString().trim().replace(/[\s/]/g, '_');
    const periodoLimpio = periodo.toString().trim().replace('/', '-');
    const docId = `${empresaLimpia}_${periodoLimpio}`;
    
    const docRef = doc(db, 'nominas_historicas', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.empleados || [];
    } else {
      console.warn(`[UGPP Audit] No se encontró registro histórico en Firestore para el documento: ${docId}`);
      return [];
    }
  } catch (error) {
    console.error(`Error consultando histórico para ${periodo}:`, error);
    return [];
  }
};