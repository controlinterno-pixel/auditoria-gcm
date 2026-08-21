import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const CHUNK_SIZE = 500; // Pedazos de 500 filas para no superar el límite de 1MB de Firebase

export const guardarNominaHistorica = async (filasExcel, periodo) => {
  try {
    if (!filasExcel || filasExcel.length === 0) {
      throw new Error("No hay datos en la nómina para guardar.");
    }

    // 1. Agrupar por Empresa respetando los datos crudos originales
    const porEmpresa = {};
    
    filasExcel.forEach(fila => {
      // Buscar la llave que contenga la empresa
      const llaves = Object.keys(fila);
      const llaveEmpresa = llaves.find(k => k.toLowerCase().includes('empresa') || k.toLowerCase().includes('compania'));
      let empNombre = llaveEmpresa ? fila[llaveEmpresa] : 'GENERAL';
      
      const empresasLista = String(empNombre).split('+').map(e => e.trim());
      
      empresasLista.forEach(e => {
        if (!porEmpresa[e]) porEmpresa[e] = [];
        porEmpresa[e].push(fila); // Guardamos la fila INTACTA
      });
    });

    const periodoLimpio = String(periodo).trim().replace('/', '-');
    const batch = writeBatch(db);
    const resumenBatch = writeBatch(db);

    // 2. Partir y Guardar en pedacitos (Chunks)
    for (const empNombre of Object.keys(porEmpresa)) {
      const empresaLimpia = empNombre.replace(/[\s/]/g, '_');
      const docBaseId = `${empresaLimpia}_${periodoLimpio}`;
      const filasEmpresa = porEmpresa[empNombre];
      
      // Guardar un "Indice Principal" para mostrar en la tabla de la UI
      const refIndice = doc(db, 'nominas_historicas', docBaseId);
      resumenBatch.set(refIndice, {
        periodo: periodoLimpio,
        empresa: empresaLimpia,
        fechaCarga: new Date().toISOString(),
        totalRegistros: filasEmpresa.length,
        esChunked: true // Marca para saber que está dividida
      }, { merge: true });

      // Dividir el arreglo gigante en pedazos de 500 y guardarlos en una sub-colección "chunks"
      for (let i = 0; i < filasEmpresa.length; i += CHUNK_SIZE) {
        const pedazo = filasEmpresa.slice(i, i + CHUNK_SIZE);
        const refChunk = doc(db, `nominas_historicas/${docBaseId}/chunks`, `part_${i}`);
        batch.set(refChunk, { datos: pedazo });
      }
    }

    await resumenBatch.commit();
    await batch.commit();

    return { success: true, message: `Nómina cruda y particionada guardada con éxito.` };
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
    const docBaseId = `${empresaLimpia}_${periodoLimpio}`;
    
    // 1. Ir a buscar todos los pedacitos de este mes y empresa
    const chunksSnapshot = await getDocs(collection(db, `nominas_historicas/${docBaseId}/chunks`));
    
    if (!chunksSnapshot.empty) {
      let dataCompleta = [];
      chunksSnapshot.forEach(doc => {
        const info = doc.data();
        if (info.datos && Array.isArray(info.datos)) {
          dataCompleta.push(...info.datos);
        }
      });
      return dataCompleta; // Retorna las 5,000 transacciones intactas
    }

    // 2. Si no es formato Chunk, intentar leer el formato antiguo (Retro-compatibilidad)
    const docRef = doc(db, 'nominas_historicas', docBaseId);
    const { getDoc } = await import('firebase/firestore');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
       return docSnap.data().empleados || docSnap.data().transacciones || [];
    }
    
    return [];
  } catch (error) {
    console.error(`Error consultando histórico para ${periodo}:`, error);
    return [];
  }
};

export const obtenerListaHistoricos = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'nominas_historicas'));
    const lista = [];
    querySnapshot.forEach((doc) => {
      lista.push({ id: doc.id, ...doc.data() });
    });
    return lista.sort((a, b) => b.periodo.localeCompare(a.periodo));
  } catch (error) {
    console.error("Error obteniendo lista de históricos:", error);
    return [];
  }
};

export const eliminarNominaHistorica = async (docId) => {
  try {
    // Si queremos borrar los chunks también de Firebase
    const chunksSnapshot = await getDocs(collection(db, `nominas_historicas/${docId}/chunks`));
    const batch = writeBatch(db);
    chunksSnapshot.forEach(d => batch.delete(d.ref));
    await batch.commit();

    // Luego borramos el índice principal
    await deleteDoc(doc(db, 'nominas_historicas', docId));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando histórico:", error);
    throw new Error("No se pudo eliminar el registro en la nube.");
  }
};