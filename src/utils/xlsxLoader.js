// src/utils/xlsxLoader.js - Carga SheetJS solo cuando se usa (no aumenta la carga inicial de la app).
let carga = null;

export const cargarXLSX = () => {
  if (!carga) {
    carga = import('xlsx')
      .then(modulo => (modulo?.utils ? modulo : modulo.default))
      .catch(error => {
        carga = null; // permite reintentar si falló la descarga del archivo
        throw error;
      });
  }
  return carga;
};
