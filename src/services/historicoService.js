// Se han eliminado las importaciones directas de Firestore (Zero Trust).
// Las peticiones ahora se enrutan a través del Backend de Vercel.

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

    const response = await fetch(`/api/grc/historico?action=cargarNomina&periodo=${periodo}&empresa=${empresa}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) throw new Error("Fallo de acceso denegado por el servidor.");
    
    const data = await response.json();
    return data.datos || [];
  } catch (error) {
    console.error(`Error consultando histórico para ${periodo}:`, error);
    return [];
  }
};

export const obtenerListaHistoricos = async () => {
  try {
    const response = await fetch('/api/grc/historico?action=listaHistoricos', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) throw new Error("Fallo de acceso denegado por el servidor.");

    const data = await response.json();
    return data.lista || [];
  } catch (error) {
    console.error("Error obteniendo lista de históricos:", error);
    return [];
  }
};

export const eliminarNominaHistorica = async (docId) => {
  try {
    const response = await fetch('/api/grc/historico', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ docId, tipo: 'nomina' })
    });

    if (!response.ok) throw new Error("Fallo al eliminar en el servidor.");
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

    for (let i = 0; i < filasMarcaciones.length; i += CHUNK_SIZE) {
      const lote = filasMarcaciones.slice(i, i + CHUNK_SIZE);

      const response = await fetch('/api/grc/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          filasMarcaciones: lote, 
          tipo: 'marcaciones' 
        }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar lote de marcaciones.');
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error guardando marcaciones en Firebase:", error);
    throw error;
  }
};

export const cargarMarcacionesDeLaNube = async () => {
  try {
    const response = await fetch('/api/grc/historico?action=cargarMarcaciones', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) throw new Error("Fallo de acceso denegado por el servidor.");

    const data = await response.json();
    return data.datos || [];
  } catch (error) {
    console.error("Error leyendo marcaciones de Firebase:", error);
    return [];
  }
};

export const obtenerListaMarcaciones = async () => {
  try {
    const response = await fetch('/api/grc/historico?action=listaMarcaciones', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) throw new Error("Fallo de acceso denegado por el servidor.");

    const data = await response.json();
    return data.lista || [];
  } catch (error) {
    console.error("Error obteniendo lista de marcaciones:", error);
    return [];
  }
};

export const eliminarMarcacionesHistoricas = async (docId) => {
  try {
    const response = await fetch('/api/grc/historico', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ docId, tipo: 'marcaciones' })
    });

    if (!response.ok) throw new Error("Fallo al eliminar en el servidor.");
    return { success: true };
  } catch (error) {
    console.error("Error eliminando marcaciones:", error);
    throw new Error("No se pudo eliminar el registro biométrico en la nube.");
  }
};