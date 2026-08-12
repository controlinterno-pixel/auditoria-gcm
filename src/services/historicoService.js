import { doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
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
    
    // 🔍 AGRUPAR POR EMPRESA (Búsqueda Profunda y Defensiva)
    const porEmpresa = {};
    
    datosEstructurados.forEach(emp => {
      let empNombre = emp.empresa || emp.Empresa || emp.Compania;
      
      // 1. Buscar en las llaves del empleado normalizado
      if (!empNombre) {
        const llaves = Object.keys(emp);
        const llaveEmpresa = llaves.find(k => k.toLowerCase().includes('empresa') || k.toLowerCase().includes('compania'));
        if (llaveEmpresa) empNombre = emp[llaveEmpresa];
      }

      // 2. Si no la encuentra, rescatarla del Excel crudo original usando la cédula
      if (!empNombre && emp.cedula && filasExcel) {
        const filaOriginal = filasExcel.find(f => 
          String(f.Identificacion) === String(emp.cedula) || 
          String(f.Cedula) === String(emp.cedula) ||
          String(f.Documento) === String(emp.cedula)
        );
        if (filaOriginal) {
          const llavesRaw = Object.keys(filaOriginal);
          const llaveEmp = llavesRaw.find(k => k.toLowerCase().includes('empresa') || k.toLowerCase().includes('compania'));
          if (llaveEmp) empNombre = filaOriginal[llaveEmp];
        }
      }

      // 3. Fallback final
      empNombre = empNombre || 'GENERAL';
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

/**
 * 📋 OBTENER LISTADO DE HISTÓRICOS GUARDADOS
 * Trae un resumen de todas las nóminas subidas a Firebase para mostrarlas en pantalla.
 */
export const obtenerListaHistoricos = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'nominas_historicas'));
    const lista = [];
    querySnapshot.forEach((doc) => {
      lista.push({ id: doc.id, ...doc.data() });
    });
    // Ordenamos para que los meses más recientes salgan primero
    return lista.sort((a, b) => b.periodo.localeCompare(a.periodo));
  } catch (error) {
    console.error("Error obteniendo lista de históricos:", error);
    return [];
  }
};
/**
 * 🗑️ PASO 4: ELIMINAR HISTÓRICO
 * Borra un documento específico de la base de datos.
 */
export const eliminarNominaHistorica = async (docId) => {
  try {
    await deleteDoc(doc(db, 'nominas_historicas', docId));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando histórico:", error);
    throw new Error("No se pudo eliminar el registro en la nube.");
  }
};