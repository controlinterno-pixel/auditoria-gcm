// src/hooks/useDataFetching.js
import { useState, useCallback } from 'react';

export const useDataFetching = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Esta función envuelve cualquier llamada a la API y maneja los estados visuales
  const ejecutarPeticion = useCallback(async (promesaApi) => {
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await promesaApi;
      return resultado;
    } catch (err) {
      console.error("Error en la petición:", err);
      setError(err.message || "Ocurrió un error inesperado.");
      throw err; // Relanzamos el error por si el componente necesita reaccionar
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, ejecutarPeticion, setError };
};