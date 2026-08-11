import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Importación apuntando a utils con minúscula (estándar común)
import { normalizarSabanaNomina } from "../utils/normalizadorNomina";

export const guardarNominaHistorica = async (filasExcel, periodo) => {
  try {
    if (!filasExcel || filasExcel.length === 0) {
      throw new Error("No hay datos en la nómina para guardar.");
    }

    const datosEstructurados = typeof normalizarSabanaNomina === 'function' 
      ? normalizarSabanaNomina(filasExcel)
      : filasExcel;
    
    // 🔍 AGRUPAR POR EMPRESA (Detecta Fam, RecreFam, etc.)
    const porEmpresa = {};
    
    datosEstructurados.forEach(emp => {
      const empNombre = emp.Empresa || emp.empresa || emp.Compania || 'GENERAL';
      const empresasLista = String(empNombre).split('+').map(e => e.trim());
      
      empresasLista.forEach(e => {
        if (!porEmpresa[e]) porEmpresa[e] = [];
        porEmpresa[e].push(emp);
      });
    });

    const periodoLimpio = String(periodo).trim().replace('/', '-');

    // 💾 GUARDAR UN DOCUMENTO POR CADA EMPRESA
    const promesasGuardado = Object.keys(porEmpresa).map(async (empNombre) => {
      const empresaLimpia = empNombre.replace(/[\s/]/g, '_');
      const docId = `${empresaLimpia}_${periodoLimpio}`; // Ej: "Fam_2026-05"
      const docRef = doc(db, 'nominas_historicas', docId);

      return setDoc(docRef, {
        periodo: periodoLimpio,
        empresa: empresaLimpia,
        fechaCarga: new Date().toISOString(),
        totalRegistros: porEmpresa[empNombre].length,
        empleados: porEmpresa[empNombre]
      }, { merge: true });
    });

    await Promise.all(promesasGuardado);

    const listaEmpresas = Object.keys(porEmpresa).join(', ');
    return { 
      success: true, 
      message: `Nómina guardada con éxito para las empresas: [${listaEmpresas}].` 
    };
  } catch (error) {
    console.error("Error guardando nómina histórica:", error);
    throw new Error(`No se pudo guardar la nómina en la nube: ${error.message}`);
  }
};

export const cargarNominaHistorica = async (periodo, empresa = 'GENERAL') => {
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