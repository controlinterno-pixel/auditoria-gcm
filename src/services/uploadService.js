// src/services/uploadService.js
// ☁️ SERVICIO DE SUBIDA DE ARCHIVOS A FIREBASE STORAGE
// Reemplaza la dependencia del servidor externo de Termales que tiene un límite de 100KB.
// Firebase Storage soporta archivos de hasta 5GB sin restricciones de payload HTTP.

import { storage } from './firebase.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { secureLogger } from './secureLogger.js';

/**
 * Sube un archivo a Firebase Storage y retorna su URL pública de descarga.
 * @param {File} file - El archivo a subir.
 * @param {object} options - Opciones adicionales.
 * @param {string} options.appName - Carpeta destino en Storage (ej: 'controlInterno').
 * @param {function} options.onProgress - Callback de progreso (0-100).
 * @returns {Promise<{url: string, fileName: string, appName: string}>}
 */
export const subirArchivoStorage = (file, { appName = 'controlInterno', onProgress } = {}) => {
  return new Promise((resolve, reject) => {
    // 📁 Ruta en Storage: auditoria/{appName}/{timestamp}_{nombre}
    const timestamp = Date.now();
    const fileName = file.name;
    const storagePath = `auditoria/${appName}/${timestamp}_${fileName}`;
    
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (typeof onProgress === 'function') onProgress(progress);
      },
      (error) => {
        secureLogger.error('Error subiendo a Firebase Storage:', { message: error?.message || 'error', fileNameMasked: file?.name ? file.name.slice(0, 2) + '***' + file.name.slice(-2) : '[sin-nombre]' });
        reject(new Error(`Error al subir el archivo: ${error.message}`));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, fileName, appName });
        } catch (error) {
          reject(new Error(`Error obteniendo URL de descarga: ${error.message}`));
        }
      }
    );
  });
};

