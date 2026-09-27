import { apiService } from './apiService';

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

      await apiService.postHistorico({ 
        filasExcel: lote, 
        periodo 
      });
    }

    return { success: true, message: 'Nómina procesada con éxito por el servidor.' };
 } catch (error) {
    console.error("Error guardando nómina vía backend:", error);
    throw new Error(`Fallo en la carga: ${error.message}`, { cause: error });
  } 
};

export const cargarNominaHistorica = async (periodo, empresa = 'GENERAL') => {
  try {
    if (!periodo) return [];

    const data = await apiService.getHistorico({
      action: 'cargarNomina',
      periodo,
      empresa
    });

    return data?.datos || [];
  } catch (error) {
    console.error(`Error consultando histórico para ${periodo}:`, error);
    return [];
  }
};

export const obtenerListaHistoricos = async () => {
  try {
    const data = await apiService.getHistorico({ action: 'listaHistoricos' });
    return data?.lista || [];
  } catch (error) {
    console.error("Error obteniendo lista de históricos:", error);
    return [];
  }
};

export const eliminarNominaHistorica = async (docId) => {
  try {
    await apiService.deleteHistorico({ docId, tipo: 'nomina' });
    return { success: true };
} catch (error) {
    console.error("Error eliminando histórico:", error);
    throw new Error("No se pudo eliminar el registro en la nube.", { cause: error });
  } 
};
// ============================================================================
// ⏰ NUEVAS FUNCIONES PARA MARCACIONES BIOMÉTRICAS (NUBE)
// ============================================================================

export const guardarMarcacionesEnLaNube = async (filasMarcaciones) => {
  try {
    if (!filasMarcaciones || filasMarcaciones.length === 0) return;

    for (let i = 0; i < filasMarcaciones.length; i += CHUNK_SIZE) {
      const lote = filasMarcaciones.slice(i, i + CHUNK_SIZE);

      await apiService.postHistorico({ 
        filasMarcaciones: lote, 
        tipo: 'marcaciones' 
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error guardando marcaciones en Firebase:", error);
    throw error;
  }
};

export const cargarMarcacionesDeLaNube = async () => {
  try {
    const data = await apiService.getHistorico({ action: 'cargarMarcaciones' });
    return data?.datos || [];
  } catch (error) {
    console.error("Error leyendo marcaciones de Firebase:", error);
    return [];
  }
};

export const obtenerListaMarcaciones = async () => {
  try {
    const data = await apiService.getHistorico({ action: 'listaMarcaciones' });
    return data?.lista || [];
  } catch (error) {
    console.error("Error obteniendo lista de marcaciones:", error);
    return [];
  }
};

export const eliminarMarcacionesHistoricas = async (docId) => {
  try {
    await apiService.deleteHistorico({ docId, tipo: 'marcaciones' });
    return { success: true };
 } catch (error) {
    console.error("Error eliminando marcaciones:", error);
    throw new Error("No se pudo eliminar el registro biométrico en la nube.", { cause: error });
  }
};