// src/components/proyectos/useProyectos.js - Carga del portafolio y del detalle, y ejecución de operaciones.
// Sin listeners en tiempo real: el portafolio se lee al entrar (1 lectura por proyecto visible) y el detalle
// al abrir un proyecto (2 lecturas). Cada operación devuelve el proyecto y el plan ya guardados.
import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';

export function usePortafolio(incluirArchivados) {
  const [estado, setEstado] = useState({ cargando: true, error: '', proyectos: [], hoy: '' });
  // Solo actualiza el estado al llegar la respuesta (nunca de forma síncrona dentro del efecto).
  const pedir = useCallback((vigente = () => true) => apiService.listarProyectos(incluirArchivados).then(
    respuesta => vigente() && setEstado({ cargando: false, error: '', proyectos: respuesta?.proyectos || [], hoy: respuesta?.hoy || '' }),
    error => vigente() && setEstado(actual => ({ ...actual, cargando: false, error: error?.message || 'No se pudo cargar el portafolio.' })),
  ), [incluirArchivados]);
  useEffect(() => {
    let activo = true;
    void pedir(() => activo);
    return () => { activo = false; };
  }, [pedir]);
  const recargar = useCallback(() => {
    setEstado(actual => ({ ...actual, cargando: true, error: '' }));
    return pedir();
  }, [pedir]);
  return { ...estado, recargar };
}

export function useProyecto(id, showNotification) {
  const [estado, setEstado] = useState({ cargando: true, error: '', proyecto: null, plan: null });
  const [guardando, setGuardando] = useState(false);
  const pedir = useCallback((vigente = () => true) => apiService.obtenerProyecto(id).then(
    respuesta => vigente() && setEstado({ cargando: false, error: '', proyecto: respuesta.proyecto, plan: respuesta.plan || {} }),
    error => vigente() && setEstado({ cargando: false, error: error?.message || 'No se pudo cargar el proyecto.', proyecto: null, plan: null }),
  ), [id]);
  useEffect(() => {
    let activo = true;
    void pedir(() => activo);
    return () => { activo = false; };
  }, [pedir]);
  const recargar = useCallback(() => {
    setEstado(actual => ({ ...actual, cargando: true, error: '' }));
    return pedir();
  }, [pedir]);

  /** Ejecuta la operación; si otra persona cambió el registro (409) recarga para mostrar lo vigente. */
  const operar = useCallback(async (accion, datos, mensajeExito = 'Cambios guardados.') => {
    setGuardando(true);
    try {
      const respuesta = await apiService.operarProyecto(accion, id, datos);
      setEstado(actual => ({ ...actual, proyecto: respuesta.proyecto, plan: respuesta.plan || {} }));
      const movidas = respuesta?.respuesta?.movidas || [];
      const sucesoras = movidas.filter(movida => String(movida.id) !== String(respuesta?.respuesta?.id)).length;
      showNotification?.(sucesoras ? `${mensajeExito} Se reprogramaron ${sucesoras} tarea(s) sucesora(s) por sus dependencias.` : mensajeExito, 'success');
      return respuesta;
    } catch (error) {
      showNotification?.(error?.message || 'No se pudo guardar.', 'error');
      if (error?.status === 409) void recargar();
      return null;
    } finally {
      setGuardando(false);
    }
  }, [id, recargar, showNotification]);

  return { ...estado, guardando, operar, recargar };
}
