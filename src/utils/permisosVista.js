// 🔐 Permisos de pantallas (casillas de Configuración → "Accesos modulares y submódulos").
// Un submódulo se ve si su casilla y la de su módulo están marcadas; un módulo aparece en el menú si tiene al
// menos un submódulo visible. Los administradores lo ven todo.

export const SUBMODULOS_POR_MODULO = {
  inicio: ['sub_mi_espacio', 'sub_dashboard'],
  auditorias: ['sub_cronograma', 'sub_programas', 'sub_campo'],
  riesgos: ['sub_matriz_riesgos', 'sub_apetito'],
  hallazgos: ['sub_informes', 'sub_hallazgos', 'sub_fuentes_mejora', 'sub_incidentes'],
  planes: ['sub_seguimiento_planes'],
  gobernanza: ['sub_comites', 'sub_trazabilidad', 'sub_auditoria_auto'],
};

// Paquete básico: el que Configuración muestra a un usuario sin permisos guardados y el que recibe al aprobarlo.
export const PERMISOS_BASICOS = ['inicio', 'sub_mi_espacio', 'hallazgos', 'sub_hallazgos', 'planes', 'sub_seguimiento_planes'];

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
