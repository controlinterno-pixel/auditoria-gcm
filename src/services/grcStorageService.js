// src/services/grcStorageService.js
import { apiService } from './apiService';
import { cargarXLSX } from '../utils/xlsxLoader';
import { LISTAS_CON_HUELLA, claveRegistro, serializarRegistro } from '../utils/huellaRegistro.js';

// Copia de cada registro tal como llegó del servidor (lista → clave → { serial, huella }).
const copiasServidor = new Map();

/** Se llama con cada descarga de datos: es la versión que el usuario tiene en pantalla. */
export function registrarDatosServidor(data) {
  Object.entries(LISTAS_CON_HUELLA).forEach(([lista, obtener]) => {
    if (!Array.isArray(data?.[lista])) return;
    const huellas = data.huellasRegistros?.[lista] || {};
    copiasServidor.set(lista, new Map(data[lista]
      .map(registro => [claveRegistro(obtener, registro), registro])
      .filter(([clave]) => clave !== null)
      .map(([clave, registro]) => [clave, { serial: serializarRegistro(registro), huella: huellas[clave] || null }])));
  });
}

/**
 * Deja en cada lista solo los registros nuevos o cambiados (el servidor conserva los demás) y marca cada
 * cambiado con la huella con que se cargó, para que el servidor detecte si otra persona lo modificó.
 */
function soloCambios(datos) {
  if (datos.reemplazoTotal === true) return datos;
  const resultado = { ...datos };
  Object.entries(LISTAS_CON_HUELLA).forEach(([lista, obtener]) => {
    const copias = copiasServidor.get(lista);
    if (!Array.isArray(resultado[lista]) || !copias) return;
    resultado[lista] = resultado[lista].flatMap(registro => {
      const copia = copias.get(claveRegistro(obtener, registro));
      if (!copia) return [registro];
      if (serializarRegistro(registro) === copia.serial) return [];
      return [copia.huella ? { ...registro, huellaBase: copia.huella } : registro];
    });
  });
  return resultado;
}

/** Tras guardar: lo enviado pasa a ser la versión conocida, con la huella nueva que devolvió el servidor. */
function actualizarCopias(enviado, huellasRegistros = {}) {
  Object.entries(LISTAS_CON_HUELLA).forEach(([lista, obtener]) => {
    const copias = copiasServidor.get(lista);
    if (!copias) return;
    (Array.isArray(enviado[lista]) ? enviado[lista] : []).forEach(registro => {
      const clave = claveRegistro(obtener, registro);
      if (clave === null) return;
      copias.set(clave, { serial: serializarRegistro(registro), huella: huellasRegistros[lista]?.[clave] || null });
    });
    (Array.isArray(enviado[`${lista}Eliminados`]) ? enviado[`${lista}Eliminados`] : []).forEach(clave => copias.delete(String(clave)));
  });
}

export const saveToCloud = async (partialData, showNotification) => {
  try {
    const sanitizedData = JSON.parse(JSON.stringify(partialData));
    
    const traverseAndSanitize = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string' && key.toLowerCase().includes('url') && obj[key].trim() !== '') {
          try {
            const parsed = new URL(obj[key]);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              obj[key] = '';
            }
          } catch {
            obj[key] = '';
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {  
          traverseAndSanitize(obj[key]);
        }
      }
    };
    traverseAndSanitize(sanitizedData);

    const envio = soloCambios(sanitizedData);
    const respuesta = await apiService.saveGrcData(envio);
    actualizarCopias(envio, respuesta?.huellasRegistros);
    return true;
  } catch (error) {
    console.error('❌ Error de sincronización segura:', error);
    if (showNotification) showNotification(error?.message || 'Error guardando en el servidor GRC.', 'error');
    return false;
  }
};

export const exportToExcel = async (dataArray, fileName, showNotification = () => {}) => {
  let XLSX;
  try {
    XLSX = await cargarXLSX();
  } catch {
    showNotification("No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.", "error");
    return;
  }
  const cleanData = (Array.isArray(dataArray) ? dataArray : []).map(item => {
    const rest = { ...item };
    delete rest.historialCambios;
    return rest;
  });

  const ws = XLSX.utils.json_to_sheet(cleanData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  showNotification(`Archivo ${fileName} exportado con éxito.`);
};

export const exportToJSON = (data) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "GCM_Backup_" + new Date().toISOString().split('T')[0] + ".json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};