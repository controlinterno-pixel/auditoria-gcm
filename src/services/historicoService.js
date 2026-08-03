import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase'; // Ajusta la ruta a tu Source 6
import { normalizarSabanaNomina } from './normalizadorNomina'; // Ajusta la ruta a tu Source 4

/**
 * 💾 PASO 1: GUARDAR NÓMINA HISTÓRICA
 * Toma el Excel crudo, lo normaliza para que pese poco, y lo sube a Firestore.
 */
export const guardarNominaHistorica = async (filasExcel, periodo, empresa = 'Termales') => {
  try {
    // 1. Normalizamos los datos usando tu propia lógica ETL
    const datosEstructurados = normalizarSabanaNomina(filasExcel);
    
    // 2. Creamos la referencia en una NUEVA colección para no saturar la GRC
    const docId = `${empresa}_${periodo}`; // Ej: "Termales_2026-03"
    const docRef = doc(db, 'nominas_historicas', docId);

    // 3. Guardamos en Firebase
    await setDoc(docRef, {
      periodo,
      empresa,
      fechaCarga: new Date().toISOString(),
      empleados: datosEstructurados // El array de empleados pivoteados
    }, { merge: true });

    return { success: true, message: `Nómina de ${periodo} guardada con éxito.` };
  } catch (error) {
    console.error("Error guardando histórico:", error);
    throw new Error("No se pudo guardar la nómina en la nube.");
  }
};

/**
 * 🔍 PASO 2: CONSULTAR HISTÓRICO PARA EL MOTOR
 * Busca en Firestore los meses anteriores para calcular los promedios reales (Art 70. Dec 806).
 */
export const cargarNominaHistorica = async (periodo, empresa = 'Termales') => {
  try {
    const docId = `${empresa}_${periodo}`;
    const docRef = doc(db, 'nominas_historicas', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data().empleados;
    } else {
      console.warn(`No hay histórico registrado para ${periodo}`);
      return [];
    }
  } catch (error) {
    console.error("Error consultando histórico:", error);
    return [];
  }
};