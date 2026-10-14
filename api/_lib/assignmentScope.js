const normalizar = valor => String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizarLista = valor => [...new Set(
  (Array.isArray(valor) ? valor : [valor])
    .map(normalizar)
    .filter(Boolean)
)];

export const obtenerProcesosAsignados = (perfil = {}, user = {}) => (
  Array.isArray(perfil.procesosAsignados)
    ? normalizarLista(perfil.procesosAsignados)
    : normalizarLista(perfil.procesoAsignado || user.procesosAsignados || user.procesoAsignado)
);

export const obtenerSubprocesosAsignados = (perfil = {}) => (
  Array.isArray(perfil.subprocesosAsignados)
    ? normalizarLista(perfil.subprocesosAsignados)
    : normalizarLista(perfil.subprocesoAsignado)
);

export const registroDentroDelAlcance = (
  procesosAsignados,
  subprocesosAsignados,
  proceso,
  subprocesos = [],
  subprocesosPorMacroproceso = null
) => {
  const procesosRegistro = normalizarLista(proceso);
  const procesosDentroDelAlcance = procesosAsignados.length === 0
    ? procesosRegistro
    : procesosRegistro.filter(macroproceso => procesosAsignados.includes(macroproceso));
  if (procesosAsignados.length > 0 && procesosDentroDelAlcance.length === 0) return false;
  if (subprocesosAsignados.length === 0) return true;

  return procesosDentroDelAlcance.some(macroproceso => {
    const subprocesosDelMacroproceso = subprocesosPorMacroproceso && typeof subprocesosPorMacroproceso === 'object'
      ? normalizarLista(subprocesosPorMacroproceso[macroproceso] || subprocesosPorMacroproceso[Object.keys(subprocesosPorMacroproceso).find(key => normalizar(key) === macroproceso)])
      : normalizarLista(subprocesos);
    return subprocesosDelMacroproceso.some(subproceso => subprocesosAsignados.includes(subproceso));
  });
};

export const registroDentroDelAlcanceAsignado = (registro = {}, procesosAsignados = [], subprocesosAsignados = []) => {
  const procesosNormalizados = normalizarLista(procesosAsignados);
  const subprocesosNormalizados = normalizarLista(subprocesosAsignados);
  const macroprocesos = Array.isArray(registro.macroprocesos) && registro.macroprocesos.length > 0
    ? registro.macroprocesos
    : registro.macroproceso || registro.proceso;
  const procesosRegistro = normalizarLista(macroprocesos)
    .map(proceso => proceso.split('/')[0].trim());
  const procesosEnAlcance = procesosRegistro.filter(proceso => procesosNormalizados.includes(proceso));
  if (procesosEnAlcance.length === 0) return false;
  if (subprocesosNormalizados.length === 0) return true;

  const subprocesosRegistroRaw = registro.subprocesos ?? registro.subproceso ?? 'General';
  const mapaSubprocesos = registro.subprocesosPorMacroproceso;
  return procesosEnAlcance.some(macroproceso => {
    const subprocesosDelMacroproceso = mapaSubprocesos && typeof mapaSubprocesos === 'object'
      ? normalizarLista(mapaSubprocesos[macroproceso] || mapaSubprocesos[Object.keys(mapaSubprocesos).find(key => normalizar(key) === macroproceso)])
      : Array.isArray(subprocesosRegistroRaw)
        ? normalizarLista(subprocesosRegistroRaw)
        : normalizarLista(String(subprocesosRegistroRaw || 'General').split(','));
    return subprocesosDelMacroproceso.some(subproceso => subprocesosNormalizados.includes(subproceso));
  });
};

export const normalizarProcesoAlcance = normalizar;
