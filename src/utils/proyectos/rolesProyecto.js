// src/utils/proyectos/rolesProyecto.js - Roles del organigrama del proyecto (apartado 14 del manual E-ID-MAN-01).
// Se administran en Cargos y Procesos → Roles de proyecto; mientras no se guarde el catálogo, rigen los del manual.

export const NIVELES_ROL = { estrategico: 'Estratégico', tactico: 'Táctico', operativo: 'Operativo' };
export const ORIGENES_ROL = { empresa: 'La empresa', externa: 'Otra organización' };

const MANUAL = 'Manual E-ID-MAN-01';
export const ROLES_BASE = [
  { id: 'rol-patrocinador', nombre: 'Patrocinador', nivel: 'estrategico', origen: 'empresa', descripcion: 'Respalda el proyecto desde la alta dirección: lo autoriza, aporta los recursos, firma el Acta de constitución y acepta los entregables al cierre.', referencia: `${MANUAL}, Acta de constitución (pág. 31) y Acta de cierre (págs. 34 y 35)` },
  { id: 'rol-comite-idi', nombre: 'Comité de I+D+i / Comité Estratégico', nivel: 'estrategico', origen: 'empresa', descripcion: 'Cumple las funciones de PMO en la empresa: asigna el líder de cada proyecto, da soporte y control y aprueba el avance entre fases.', referencia: `${MANUAL}, numeral 3.1.8 (pág. 6)` },
  { id: 'rol-gerencia-aj', nombre: 'Gerencia Administrativa y Judicial', nivel: 'estrategico', origen: 'empresa', descripcion: 'Aprueba la Prefactibilidad y la Factibilidad del proyecto mediante sus actas de aprobación.', referencia: `${MANUAL}, numerales 4.1.2 y 4.2 (págs. 12, 26 y 27)` },
  { id: 'rol-director', nombre: 'Director del proyecto', nivel: 'tactico', origen: 'empresa', descripcion: 'Persona asignada para liderar al equipo y alcanzar los objetivos: planifica, controla, reporta y gestiona riesgos y cambios.', referencia: `${MANUAL}, numerales 3.1.6 y 3.1.7 (pág. 6)` },
  { id: 'rol-comite-seguimiento', nombre: 'Comité de seguimiento', nivel: 'tactico', origen: 'empresa', descripcion: 'Revisa periódicamente el avance, los riesgos y los cambios del proyecto y toma decisiones de control.', referencia: `${MANUAL}, apartado 14 (pág. 29)` },
  { id: 'rol-lider-proceso', nombre: 'Líder de proceso o de área', nivel: 'tactico', origen: 'empresa', descripcion: 'Responsable del proceso o área que interviene en el proyecto o lo recibe; valida el organigrama y los entregables de su área.', referencia: `${MANUAL}, apartado 14 (pág. 29)` },
  { id: 'rol-coordinador-proyectos', nombre: 'Coordinador de proyectos', nivel: 'tactico', origen: 'empresa', descripcion: 'Custodia la documentación de los proyectos y apoya su gestión; lo designa la Gerencia General.', referencia: `${MANUAL}, numeral 6.1 (pág. 38)` },
  { id: 'rol-equipo', nombre: 'Equipo del proyecto', nivel: 'operativo', origen: 'empresa', descripcion: 'Personas que ejecutan las actividades y producen los entregables bajo la dirección del director del proyecto.', referencia: `${MANUAL}, numeral 3.1.6 (pág. 6)` },
  { id: 'rol-area-operacion', nombre: 'Área de operación', nivel: 'operativo', origen: 'empresa', descripcion: 'Área que recibe el producto o servicio y lo opera después del cierre (transferencia a operación).', referencia: `${MANUAL}, apartado 14 (pág. 29) y cierre (pág. 35)` },
  { id: 'rol-contratista', nombre: 'Contratista', nivel: 'operativo', origen: 'externa', descripcion: 'Organización externa contratada para ejecutar una parte del proyecto, por ejemplo obras de infraestructura.', referencia: `${MANUAL}, apartado 14 (pág. 29)` },
  { id: 'rol-aliado', nombre: 'Aliado externo', nivel: 'tactico', origen: 'externa', descripcion: 'Organización que participa en el proyecto sin ser contratista: socio, entidad de apoyo o cofinanciador.', referencia: `${MANUAL}, apartado 14 (pág. 29)` },
];

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Roles vigentes: los guardados en el catálogo (activos) o, si nunca se guardó, los del manual. */
export function rolesVigentes(guardados) {
  const lista = Array.isArray(guardados) ? guardados : ROLES_BASE;
  return lista.filter(rol => rol && rol.activo !== false && String(rol.nombre || '').trim());
}

/** El rol del catálogo con ese nombre (sin importar tildes ni mayúsculas), o null. */
export const buscarRol = (nombre, roles) => roles.find(rol => normalizar(rol.nombre) === normalizar(nombre)) || null;

/** Revisión del catálogo antes de guardarlo: nombre obligatorio, sin repetidos, nivel y origen válidos. */
export function erroresRol(rol, roles) {
  if (!String(rol?.nombre || '').trim()) return 'Escribe el nombre del rol.';
  if (roles.some(otro => otro.id !== rol.id && normalizar(otro.nombre) === normalizar(rol.nombre))) return 'Ya existe un rol con ese nombre.';
  if (!NIVELES_ROL[rol.nivel]) return 'Elige el nivel del rol.';
  if (!ORIGENES_ROL[rol.origen]) return 'Indica si el rol es de la empresa o de otra organización.';
  return '';
}
