// 👥 Roles: el auditor VE todo, pero GESTIONA como un líder (sus macroprocesos y los planes donde está asignado
// como ejecutor, revisor o auditor aprobador). Solo el administrador gestiona todo.
const normalizarRol = rol => String(rol || '').trim().toLowerCase();

/** Administrador: crea, edita, evalúa y borra en cualquier proceso. */
export const esAdministradorTotal = rol => ['admin', 'administrador'].includes(normalizarRol(rol));

/** Administrador o auditor: consulta los datos de todos los procesos (sin poder gestionarlos todos). */
export const puedeVerTodo = rol => esAdministradorTotal(rol) || normalizarRol(rol) === 'auditor';
