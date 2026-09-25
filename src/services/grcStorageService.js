// src/services/grcStorageService.js

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
          } catch (e) {
            obj[key] = '';
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          traverseAndSanitize(obj[key]);
        }
      }
    };
    traverseAndSanitize(sanitizedData);

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ partialData: sanitizedData })
    });

    if (!response.ok) {
      throw new Error('El servidor rechazó la sincronización de datos.');
    }
  } catch (error) {
    console.error('❌ Error de sincronización segura:', error);
    if (showNotification) showNotification('Error guardando en el servidor GRC.', 'error');
  }
};

export const exportToExcel = (dataArray, fileName, xlsxLoaded, showNotification) => {
  if (!xlsxLoaded || !window.XLSX) {
    showNotification("La librería de exportación aún está cargando.", "error");
    return;
  }
  const cleanData = dataArray.map(item => {
    const { historialCambios, ...rest } = item;
    return rest;
  });
  
  const ws = window.XLSX.utils.json_to_sheet(cleanData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  window.XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
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