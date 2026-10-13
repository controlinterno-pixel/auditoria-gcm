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

export const registroDentroDelAlcance = (procesosAsignados, subprocesosAsignados, proceso, subprocesos = []) => {
  const procesoNormalizado = normalizar(proceso);
  const subprocesosNormalizados = normalizarLista(subprocesos);
  return (
    (procesosAsignados.length === 0 || procesosAsignados.includes(procesoNormalizado)) &&
    (subprocesosAsignados.length === 0 || subprocesosNormalizados.some(subproceso => subprocesosAsignados.includes(subproceso)))
  );
};

export const registroDentroDelAlcanceAsignado = (registro = {}, procesosAsignados = [], subprocesosAsignados = []) => {
  const procesosNormalizados = normalizarLista(procesosAsignados);
  const subprocesosNormalizados = normalizarLista(subprocesosAsignados);
  const procesoRegistro = normalizar(registro.macroproceso || registro.proceso).split('/')[0].trim();
  if (!procesoRegistro || !procesosNormalizados.includes(procesoRegistro)) return false;
  if (subprocesosNormalizados.length === 0) return true;

  const subprocesosRegistroRaw = registro.subprocesos ?? registro.subproceso ?? 'General';
  const subprocesosRegistro = Array.isArray(subprocesosRegistroRaw)
    ? normalizarLista(subprocesosRegistroRaw)
    : normalizarLista(String(subprocesosRegistroRaw || 'General').split(','));
  return subprocesosRegistro.some(subproceso => subprocesosNormalizados.includes(subproceso));
};

export const normalizarProcesoAlcance = normalizar;
