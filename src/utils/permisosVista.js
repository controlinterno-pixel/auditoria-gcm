// 🔐 Permisos de pantallas (casillas de Configuración → "Accesos modulares y submódulos").
// Un submódulo se ve si su casilla y la de su módulo están marcadas; un módulo aparece en el menú si tiene al
// menos un submódulo visible. Los administradores lo ven todo.

export const SUBMODULOS_POR_MODULO = {
  inicio: ['sub_mi_espacio', 'sub_dashboard'],
  auditorias: ['sub_cronograma', 'sub_programas', 'sub_campo'],
  riesgos: ['sub_matriz_riesgos', 'sub_apetito'],
  hallazgos: ['sub_informes', 'sub_hallazgos', 'sub_fuentes_mejora', 'sub_incidentes'],
  planes: ['sub_seguimiento_planes'],
  gobernanza: ['sub_comites', 'sub_trazabilidad', 'sub_auditoria_auto', 'sub_proyectos'],
};

// 🔐 Matriz de riesgos: por defecto un líder solo ve los riesgos de sus macroprocesos. Con esta casilla
// (Configuración → Riesgos → "Ver todos los riesgos") los consulta todos; editar sigue limitado a los suyos.
export const PERMISO_VER_TODOS_RIESGOS = 'riesgos_ver_todos';

// Sin tildes ni mayúsculas, igual que obtenerProcesosAsignados del servidor (que guarda "gestion …"): si una
// parte comparara con tildes y la otra sin ellas, ningún riesgo coincidiría.
const normalizarProceso = valor => String(valor || '').split('/')[0]
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const macroprocesosDelRiesgo = riesgo => [
  ...(Array.isArray(riesgo?.macroprocesos) ? riesgo.macroprocesos : []),
  riesgo?.macroproceso,
  riesgo?.proceso,
].map(normalizarProceso).filter(Boolean);

/**
 * Riesgos que puede consultar el usuario. veTodo: administrador o auditor. Sin macroprocesos asignados el
 * usuario tiene acceso global (igual que en el resto de la app); si no, solo los riesgos de alguno de ellos,
 * salvo que tenga la casilla "Ver todos los riesgos".
 */
export function riesgosVisiblesPara(riesgos, { veTodo = false, permisos = [], procesosAsignados = [] } = {}) {
  const lista = Array.isArray(riesgos) ? riesgos : [];
  if (veTodo || (Array.isArray(permisos) && permisos.includes(PERMISO_VER_TODOS_RIESGOS))) return lista;
  const propios = new Set((Array.isArray(procesosAsignados) ? procesosAsignados : []).map(normalizarProceso).filter(Boolean));
  if (propios.size === 0) return lista;
  return lista.filter(riesgo => macroprocesosDelRiesgo(riesgo).some(proceso => propios.has(proceso)));
}

// Paquete básico: el que rige para usuarios antiguos sin permisos guardados (y el que Configuración les muestra).
export const PERMISOS_BASICOS = ['inicio', 'sub_mi_espacio', 'hallazgos', 'sub_hallazgos', 'planes', 'sub_seguimiento_planes'];

// Usuario nuevo al aprobarlo: solo el módulo Riesgos (y solo los riesgos de sus macroprocesos). El
// administrador le habilita el resto en Configuración.
export const PERMISOS_NUEVOS_USUARIOS = ['riesgos', 'sub_matriz_riesgos', 'sub_apetito'];

const MODULO_DE = Object.fromEntries(Object.entries(SUBMODULOS_POR_MODULO).flatMap(([modulo, subs]) => subs.map(sub => [sub, modulo])));

/** Permisos que rigen para el usuario: los guardados o, si nunca se guardaron, el paquete básico. */
export const permisosEfectivos = perfil => (Array.isArray(perfil?.permisos) ? perfil.permisos : PERMISOS_BASICOS);

/** ¿Puede ver este submódulo? (casilla del submódulo y de su módulo). */
export function puedeVerSubmodulo(permisos, submodulo, isAdmin = false) {
  if (isAdmin) return true;
  const lista = Array.isArray(permisos) ? permisos : [];
  const modulo = MODULO_DE[submodulo];
  return lista.includes(submodulo) && (!modulo || lista.includes(modulo));
}

/** ¿El usuario está asignado al plan (ejecutor, revisor o auditor)? */
export const esPlanDelUsuario = (plan, correo) => {
  const propio = String(correo || '').trim().toLowerCase();
  return propio !== '' && [plan?.correoResponsable, plan?.correoRevisor, plan?.correoAuditor, plan?.correoAuditorResponsable, plan?.correo_auditor]
    .some(valor => String(valor || '').trim().toLowerCase() === propio);
};

/**
 * Cuando el módulo Planes muestra solo una parte (las tareas del usuario), un guardado reemplaza únicamente esa
 * parte: los planes que no se muestran se conservan tal cual.
 */
export function combinarPlanesVisibles(actuales, nuevos, esVisible) {
  const lista = Array.isArray(actuales) ? actuales : [];
  const visibles = lista.filter(esVisible);
  const resultado = typeof nuevos === 'function' ? nuevos(visibles) : nuevos;
  const idsVisibles = new Set(visibles.map(plan => String(plan.id)));
  return [...lista.filter(plan => !idsVisibles.has(String(plan.id))), ...(Array.isArray(resultado) ? resultado : [])];
}
