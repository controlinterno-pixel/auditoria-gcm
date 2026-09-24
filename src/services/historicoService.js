import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const CHUNK_SIZE = 500; // Pedazos de 500 filas para no superar el límite de 1MB de Firebase

export const guardarNominaHistorica = async (filasExcel, periodo) => {
  try {
    if (!filasExcel || filasExcel.length === 0) {
      throw new Error("No hay datos en la nómina para guardar.");
    }

    const TAMANO_LOTE = 1000;
    const totalFilas = filasExcel.length;

    for (let i = 0; i < totalFilas; i += TAMANO_LOTE) {
      const lote = filasExcel.slice(i, i + TAMANO_LOTE);

      const response = await fetch('/api/grc/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          filasExcel: lote, 
          periodo 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la nómina en el servidor.');
      }
    }

    return { success: true, message: 'Nómina procesada con éxito por el servidor.' };
  } catch (error) {
    console.error("Error guardando nómina vía backend:", error);
    throw new Error(`Fallo en la carga: ${error.message}`);
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
      return dataCompleta; // Retorna los miles de transacciones intactas
    }

    // 2. Si no es formato Chunk, intentar leer el formato antiguo
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
    const chunksSnapshot = await getDocs(collection(db, `nominas_historicas/${docId}/chunks`));
    const batch = writeBatch(db);
    chunksSnapshot.forEach(d => batch.delete(d.ref));
    await batch.commit();

    await deleteDoc(doc(db, 'nominas_historicas', docId));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando histórico:", error);
    throw new Error("No se pudo eliminar el registro en la nube.");
  }
};
// ============================================================================
// ⏰ NUEVAS FUNCIONES PARA MARCACIONES BIOMÉTRICAS (NUBE)
// ============================================================================

export const guardarMarcacionesEnLaNube = async (filasMarcaciones) => {
  try {
    if (!filasMarcaciones || filasMarcaciones.length === 0) return;

    // Generamos un ID único y exacto basado en el milisegundo de subida
    const docBaseId = `marcaciones_GCM_${Date.now()}`;
    
    const batch = writeBatch(db);
    const resumenBatch = writeBatch(db);

    // 1. Guardar el Índice Principal
    const refIndice = doc(db, 'marcaciones_historicas', docBaseId);
    resumenBatch.set(refIndice, {
      id: docBaseId,
      fechaCarga: new Date().toISOString(),
      totalRegistros: filasMarcaciones.length,
      tipo: 'Biometria_Completa'
    }, { merge: true });

    // 2. Dividir en Chunks para evitar el límite de 1MB de Firebase
    for (let i = 0; i < filasMarcaciones.length; i += CHUNK_SIZE) {
      const pedazo = filasMarcaciones.slice(i, i + CHUNK_SIZE);
      const refChunk = doc(db, `marcaciones_historicas/${docBaseId}/chunks`, `part_${i}`);
      batch.set(refChunk, { datos: pedazo });
    }

    await resumenBatch.commit();
    await batch.commit();
    console.log("✅ Marcaciones guardadas en Firebase exitosamente.");
    
    return true;
  } catch (error) {
    console.error("Error guardando marcaciones en Firebase:", error);
    throw error;
  }
};

export const cargarMarcacionesDeLaNube = async () => {
  try {
    // 1. Obtener la lista de todos los archivos de marcaciones subidos
    const querySnapshot = await getDocs(collection(db, 'marcaciones_historicas'));
    
    if (querySnapshot.empty) return []; // Si no hay nada, regresa un arreglo vacío

    let todaLaData = [];

    // 2. Recorrer cada archivo índice y descargar sus chunks
    for (const documento of querySnapshot.docs) {
       const docBaseId = documento.id;
       const chunksSnapshot = await getDocs(collection(db, `marcaciones_historicas/${docBaseId}/chunks`));
       
       chunksSnapshot.forEach(chunkDoc => {
         const info = chunkDoc.data();
         if (info.datos && Array.isArray(info.datos)) {
           todaLaData.push(...info.datos);
         }
       });
    }

    return todaLaData;
  } catch (error) {
    console.error("Error leyendo marcaciones de Firebase:", error);
    return [];
  }
};
// ============================================================================
// 🗑️ GESTIÓN Y BORRADO DE MARCACIONES
// ============================================================================

export const obtenerListaMarcaciones = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'marcaciones_historicas'));
    const lista = [];
    querySnapshot.forEach((doc) => {
      lista.push({ id: doc.id, ...doc.data() });
    });
    // Ordenamos para que los más recientes salgan primero
    return lista.sort((a, b) => new Date(b.fechaCarga) - new Date(a.fechaCarga));
  } catch (error) {
    console.error("Error obteniendo lista de marcaciones:", error);
    return [];
  }
};

export const eliminarMarcacionesHistoricas = async (docId) => {
  try {
    // 1. Borrar todos los pedacitos (chunks) del archivo
    const chunksSnapshot = await getDocs(collection(db, `marcaciones_historicas/${docId}/chunks`));
    const batch = writeBatch(db);
    chunksSnapshot.forEach(d => batch.delete(d.ref));
    await batch.commit();

    // 2. Borrar el índice principal
    await deleteDoc(doc(db, 'marcaciones_historicas', docId));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando marcaciones:", error);
    throw new Error("No se pudo eliminar el registro biométrico en la nube.");
  }
};