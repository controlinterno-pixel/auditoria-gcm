// src/services/grcStorageService.js
import { apiService } from './apiService';
import { cargarXLSX } from '../utils/xlsxLoader';
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

    await apiService.saveGrcData(sanitizedData);
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