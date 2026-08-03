import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Importación apuntando a utils con minúscula (estándar común)
import { normalizarSabanaNomina } from "../utils/normalizadorNomina";

export const guardarNominaHistorica = async (filasExcel, periodo, empresa = 'Termales') => {
  try {
    if (!filasExcel || filasExcel.length === 0) {
      throw new Error("No hay datos en la nómina para guardar.");
    }

    const datosEstructurados = typeof normalizarSabanaNomina === 'function' 
      ? normalizarSabanaNomina(filasExcel)
      : filasExcel;
    
    const empresaLimpia = empresa.toString().trim().replace(/[\s/]/g, '_');
    const periodoLimpio = periodo.toString().trim().replace('/', '-');
    const docId = `${empresaLimpia}_${periodoLimpio}`;
    
    const docRef = doc(db, 'nominas_historicas', docId);

    await setDoc(docRef, {
      periodo: periodoLimpio,
      empresa: empresaLimpia,
      fechaCarga: new Date().toISOString(),
      totalRegistros: datosEstructurados.length,
      empleados: datosEstructurados 
    }, { merge: true });

    return { 
      success: true, 
      message: `Nómina del período ${periodoLimpio} guardada con éxito en Firestore.` 
    };
  } catch (error) {
    console.error("Error guardando nómina histórica:", error);
    throw new Error(`No se pudo guardar la nómina en la nube: ${error.message}`);
  }
};

export const cargarNominaHistorica = async (periodo, empresa = 'Termales') => {
  try {
    if (!periodo) return [];

    const empresaLimpia = empresa.toString().trim().replace(/[\s/]/g, '_');
    const periodoLimpio = periodo.toString().trim().replace('/', '-');
    const docId = `${empresaLimpia}_${periodoLimpio}`;
    
    const docRef = doc(db, 'nominas_historicas', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().empleados || [];
    } else {
      console.warn(`[UGPP Audit] No se encontró histórico en Firestore para: ${docId}`);
      return [];
    }
  } catch (error) {
    console.error(`Error consultando histórico para ${periodo}:`, error);
    return [];
  }
};