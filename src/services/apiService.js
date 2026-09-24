// src/services/apiService.js

export const apiService = {
  subirEvidencia: async (archivo, metadata = {}) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const fileBase64 = reader.result;

          const response = await fetch('/api/grc/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 🔒 Envía la cookie HttpOnly de sesión
            body: JSON.stringify({
              fileName: archivo.name,
              fileType: archivo.type,
              fileBase64: fileBase64,
              appName: metadata.appName || 'controlInterno'
            })
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Error al subir la evidencia');
          }

          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(archivo);
    });
  }
};