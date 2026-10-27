// src/utils/proyectos/modelo.js - Catálogos, validaciones y reglas de negocio de Gestión de Proyectos.
// Lo usan el servidor (que decide) y la pantalla (que solo anticipa los mismos mensajes).
import { esFecha } from './fechas.js';

export const METODOLOGIAS = { predictiva: 'Predictiva', agil: 'Ágil', hibrida: 'Híbrida' };
export const PRIORIDADES = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
export const MONEDAS = ['COP', 'USD', 'EUR'];

export const ESTADOS_PROYECTO = {
  propuesto: 'Propuesto',
  planificacion: 'En planificación',
  ejecucion: 'En ejecución',
  suspendido: 'Suspendido',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};
// Destino → estados desde los que se puede llegar. Cualquier otro salto se rechaza.
export const TRANSICIONES_PROYECTO = {
  planificacion: ['propuesto'],
  ejecucion: ['planificacion', 'suspendido'],
  suspendido: ['planificacion', 'ejecucion'],
  cerrado: ['ejecucion'],
  cancelado: ['propuesto', 'planificacion', 'ejecucion', 'suspendido'],
};
export const NOMBRE_TRANSICION = {
  planificacion: 'Autorizar el proyecto', ejecucion: 'Iniciar o reanudar la ejecución', suspendido: 'Suspender',
  cerrado: 'Cerrar', cancelado: 'Cancelar',
};
export const ESTADOS_ACTIVOS = ['propuesto', 'planificacion', 'ejecucion', 'suspendido'];

export const TIPOS_TAREA = {
  fase: 'Fase', paquete: 'Paquete de trabajo', actividad: 'Actividad', hito: 'Hito', epica: 'Épica', historia: 'Historia de usuario',
};
export const TIPOS_CONTENEDOR = ['fase', 'paquete', 'epica'];
export const ESTADOS_TAREA = {
  pendiente: 'Pendiente', en_curso: 'En curso', bloqueada: 'Bloqueada', en_revision: 'En revisión', completada: 'Completada', cancelada: 'Cancelada',
};
export const ESTADOS_CERRADOS_TAREA = ['completada', 'cancelada'];

export const ESTADOS_ENTREGABLE = {
  pendiente: 'Pendiente', en_elaboracion: 'En elaboración', presentado: 'Presentado', en_revision: 'En revisión',
  aprobado: 'Aprobado', requiere_ajustes: 'Requiere ajustes', rechazado: 'Rechazado',
};
// Los estados de decisión solo se alcanzan con la acción "decidir entregable" (otra persona distinta de quien presentó).
export const DECISIONES_ENTREGABLE = ['aprobado', 'requiere_ajustes', 'rechazado'];

export const TIPOS_RIESGO = {
  riesgo: 'Riesgo', problema: 'Problema materializado', incidencia: 'Incidencia', bloqueo: 'Bloqueo', dependencia: 'Dependencia externa',
};
export const ESTADOS_RIESGO = { abierto: 'Abierto', en_tratamiento: 'En tratamiento', cerrado: 'Cerrado' };
export const RESPUESTAS_RIESGO = { mitigar: 'Mitigar', evitar: 'Evitar', transferir: 'Transferir', aceptar: 'Aceptar' };

export const ESTADOS_CAMBIO = {
  solicitada: 'Solicitada', en_analisis: 'En análisis', aprobada: 'Aprobada', rechazada: 'Rechazada', implementada: 'Implementada', cancelada: 'Cancelada',
};
export const TRANSICIONES_CAMBIO = {
  en_analisis: ['solicitada'],
  aprobada: ['solicitada', 'en_analisis'],
  rechazada: ['solicitada', 'en_analisis'],
  implementada: ['aprobada'],
  cancelada: ['solicitada', 'en_analisis'],
};
export const ESTADOS_COMPROMISO = { pendiente: 'Pendiente', en_curso: 'En curso', cumplido: 'Cumplido', cancelado: 'Cancelado' };
export const CATEGORIAS_COSTO = { personal: 'Personal', servicios: 'Servicios', bienes: 'Bienes', tecnologia: 'Tecnología', otros: 'Otros' };
export const TIPOS_COSTO = { real: 'Real (ejecutado)', comprometido: 'Comprometido' };
export const ESTADOS_SPRINT = { planeado: 'Planeado', activo: 'Activo', cerrado: 'Cerrado' };

// Semáforo: umbrales por defecto; cada proyecto puede ajustarlos (configuracion.umbrales).
export const UMBRALES_POR_DEFECTO = {
  desviacionAmarillo: 5, // puntos porcentuales de atraso frente a lo planificado
  desviacionRojo: 15,
  costoAmarillo: 5, // % de sobrecosto proyectado frente al presupuesto vigente
  costoRojo: 10,
  nivelRiesgoCritico: 15, // probabilidad × impacto (escala 1–5 × 1–5)
  diasSinActualizacion: 15,
  diasProximoVencimiento: 15,
};

export const LIMITES = { texto: 200, textoLargo: 4000, lista: 300, miembros: 60 };
export const CORREO_VALIDO = /^[^\s@]+@termales\.com\.co$/i;

export const normalizarCorreo = valor => String(valor || '').trim().toLowerCase();
const texto = (valor, max = LIMITES.texto) => String(valor ?? '').trim().slice(0, max);
const numeroOpcional = valor => (valor === '' || valor === null || valor === undefined ? null : Number(valor));

/** Roles que tiene un correo dentro del proyecto (además del rol global que decide el servidor). */
export function rolesEnProyecto(proyecto, correo) {
  const email = normalizarCorreo(correo);
  const miembros = proyecto?.miembros || {};
  const roles = new Set();
  if (!email) return roles;
  if (normalizarCorreo(miembros.director) === email) roles.add('director');
  if (normalizarCorreo(miembros.patrocinador) === email) roles.add('patrocinador');
  if (normalizarCorreo(miembros.responsableArea) === email) roles.add('lector');
  (miembros.equipo || []).forEach(correoMiembro => normalizarCorreo(correoMiembro) === email && roles.add('equipo'));
  (miembros.aprobadores || []).forEach(correoMiembro => normalizarCorreo(correoMiembro) === email && roles.add('aprobador'));
  (miembros.lectores || []).forEach(correoMiembro => normalizarCorreo(correoMiembro) === email && roles.add('lector'));
  return roles;
}

/** Todos los correos con acceso (para la consulta array-contains del portafolio). */
export const correosConAcceso = miembros => [...new Set([
  miembros?.director, miembros?.patrocinador, miembros?.responsableArea,
  ...(miembros?.equipo || []), ...(miembros?.aprobadores || []), ...(miembros?.lectores || []),
].map(normalizarCorreo).filter(Boolean))];

const listaCorreos = valor => [...new Set((Array.isArray(valor) ? valor : String(valor || '').split(','))
  .map(normalizarCorreo).filter(Boolean))].slice(0, LIMITES.miembros);

/** Ficha normalizada y lista de errores (vacía si es válida). */
export function validarFicha(datos = {}) {
  const errores = [];
  const ficha = {
    nombre: texto(datos.nombre),
    descripcion: texto(datos.descripcion, LIMITES.textoLargo),
    justificacion: texto(datos.justificacion, LIMITES.textoLargo),
    problema: texto(datos.problema, LIMITES.textoLargo),
    objetivoGeneral: texto(datos.objetivoGeneral, LIMITES.textoLargo),
    objetivosEspecificos: (Array.isArray(datos.objetivosEspecificos) ? datos.objetivosEspecificos : []).map(item => texto(item, 500)).filter(Boolean).slice(0, 30),
    alcanceIncluido: texto(datos.alcanceIncluido, LIMITES.textoLargo),
    alcanceExcluido: texto(datos.alcanceExcluido, LIMITES.textoLargo),
    area: texto(datos.area),
    proceso: texto(datos.proceso),
    portafolio: texto(datos.portafolio),
    programa: texto(datos.programa),
    metodologia: datos.metodologia,
    prioridad: datos.prioridad,
    fechaSolicitud: datos.fechaSolicitud || '',
    inicioPlanificado: datos.inicioPlanificado || '',
    finPlanificado: datos.finPlanificado || '',
    inicioReal: datos.inicioReal || '',
    finReal: datos.finReal || '',
    manejaPresupuesto: datos.manejaPresupuesto === true,
    presupuestoAprobado: numeroOpcional(datos.presupuestoAprobado),
    moneda: datos.moneda || 'COP',
    beneficios: texto(datos.beneficios, LIMITES.textoLargo),
    indicadoresEsperados: texto(datos.indicadoresEsperados, LIMITES.textoLargo),
    criteriosExito: texto(datos.criteriosExito, LIMITES.textoLargo),
    dependenciasRestricciones: texto(datos.dependenciasRestricciones, LIMITES.textoLargo),
    riesgosIniciales: texto(datos.riesgosIniciales, LIMITES.textoLargo),
    calendario: datos.calendario === 'laboral' ? 'laboral' : 'calendario',
  };
  if (!ficha.nombre) errores.push('Escribe el nombre del proyecto.');
  if (!ficha.objetivoGeneral) errores.push('Escribe el objetivo general.');
  if (!METODOLOGIAS[ficha.metodologia]) errores.push('Elige la metodología (predictiva, ágil o híbrida).');
  if (!PRIORIDADES[ficha.prioridad]) errores.push('Elige la prioridad.');
  ['fechaSolicitud', 'inicioPlanificado', 'finPlanificado', 'inicioReal', 'finReal'].forEach(campo => {
    if (ficha[campo] && !esFecha(ficha[campo])) errores.push(`La fecha "${campo}" no es válida.`);
  });
  if (!ficha.inicioPlanificado || !ficha.finPlanificado) errores.push('Indica las fechas planificadas de inicio y fin.');
  if (ficha.inicioPlanificado && ficha.finPlanificado && ficha.finPlanificado < ficha.inicioPlanificado) {
    errores.push('La fecha planificada de fin no puede ser anterior a la de inicio.');
  }
  if (ficha.inicioReal && ficha.finReal && ficha.finReal < ficha.inicioReal) errores.push('La fecha real de fin no puede ser anterior a la real de inicio.');
  if (ficha.manejaPresupuesto) {
    if (!Number.isFinite(ficha.presupuestoAprobado) || ficha.presupuestoAprobado <= 0) errores.push('Indica el presupuesto aprobado (mayor que cero) o desmarca "Maneja presupuesto".');
    if (!MONEDAS.includes(ficha.moneda)) errores.push('Elige una moneda válida.');
  } else {
    ficha.presupuestoAprobado = null;
  }
  return { ficha, errores };
}

export function validarMiembros(datos = {}) {
  const errores = [];
  const miembros = {
    director: normalizarCorreo(datos.director),
    patrocinador: normalizarCorreo(datos.patrocinador),
    responsableArea: normalizarCorreo(datos.responsableArea),
    equipo: listaCorreos(datos.equipo),
    aprobadores: listaCorreos(datos.aprobadores),
    lectores: listaCorreos(datos.lectores),
  };
  if (!miembros.director) errores.push('Indica el correo del director del proyecto.');
  const todos = [miembros.director, miembros.patrocinador, miembros.responsableArea, ...miembros.equipo, ...miembros.aprobadores, ...miembros.lectores].filter(Boolean);
  const invalidos = todos.filter(correo => !CORREO_VALIDO.test(correo));
  if (invalidos.length) errores.push(`Estos correos no son de @termales.com.co: ${[...new Set(invalidos)].join(', ')}.`);
  if (miembros.patrocinador && miembros.patrocinador === miembros.director) errores.push('El patrocinador debe ser una persona distinta del director (es quien autoriza sus solicitudes).');
  return { miembros, errores };
}

/** Requisitos pendientes para pasar el proyecto a `destino` (lista vacía si se puede). */
export function requisitosTransicion(proyecto, plan, destino) {
  const faltantes = [];
  const origen = proyecto?.estado;
  if (!(TRANSICIONES_PROYECTO[destino] || []).includes(origen)) {
    return [`No se puede pasar de "${ESTADOS_PROYECTO[origen] || origen}" a "${ESTADOS_PROYECTO[destino] || destino}".`];
  }
  const tareas = (plan?.tareas || []).filter(tarea => tarea.estado !== 'cancelada');
  const metodologia = proyecto?.ficha?.metodologia;
  if (destino === 'ejecucion' && origen === 'planificacion') {
    if (!tareas.length) faltantes.push('Registra al menos una tarea o historia antes de iniciar la ejecución.');
    if (metodologia !== 'agil' && !(plan?.lineasBase || []).length) faltantes.push('Establece la línea base del cronograma antes de iniciar la ejecución.');
  }
  if (destino === 'cerrado') {
    const abiertas = tareas.filter(tarea => !ESTADOS_CERRADOS_TAREA.includes(tarea.estado));
    if (abiertas.length) faltantes.push(`Hay ${abiertas.length} tarea(s) sin completar ni cancelar.`);
    const entregablesAbiertos = (plan?.entregables || []).filter(entregable => !['aprobado', 'rechazado'].includes(entregable.estado));
    if (entregablesAbiertos.length) faltantes.push(`Hay ${entregablesAbiertos.length} entregable(s) sin decisión final.`);
    const cambiosAbiertos = (plan?.cambios || []).filter(cambio => ['solicitada', 'en_analisis', 'aprobada'].includes(cambio.estado));
    if (cambiosAbiertos.length) faltantes.push(`Hay ${cambiosAbiertos.length} solicitud(es) de cambio sin cerrar.`);
    if (!String(proyecto?.cierre?.leccionesAprendidas || '').trim()) faltantes.push('Registra las lecciones aprendidas en el informe de cierre.');
  }
  return faltantes;
}

/** Errores de una tarea frente a su estado (completar exige criterios de aceptación cumplidos, etc.). */
export function validarTarea(tarea) {
  const errores = [];
  if (!texto(tarea.titulo)) errores.push('Escribe el título de la tarea.');
  if (!TIPOS_TAREA[tarea.tipo]) errores.push('Elige el tipo de tarea.');
  if (!ESTADOS_TAREA[tarea.estado]) errores.push('El estado de la tarea no es válido.');
  if (!PRIORIDADES[tarea.prioridad]) errores.push('Elige la prioridad de la tarea.');
  const conFechas = tarea.inicio || tarea.fin;
  if (conFechas && (!esFecha(tarea.inicio) || !esFecha(tarea.fin))) errores.push('Indica inicio y fin con fechas válidas.');
  if (esFecha(tarea.inicio) && esFecha(tarea.fin) && tarea.fin < tarea.inicio) errores.push('La fecha de fin no puede ser anterior a la de inicio.');
  if (tarea.tipo === 'hito' && tarea.inicio !== tarea.fin) errores.push('Un hito es un punto en el tiempo: inicio y fin deben ser la misma fecha.');
  if (tarea.tipo !== 'hito' && !TIPOS_CONTENEDOR.includes(tarea.tipo) && !conFechas && tarea.tipo !== 'historia') {
    errores.push('Las actividades necesitan fechas de inicio y fin.');
  }
  const avance = Number(tarea.avance);
  if (!Number.isInteger(avance) || avance < 0 || avance > 100) errores.push('El avance debe ser un número entero entre 0 y 100.');
  if (tarea.estado === 'pendiente' && avance > 0) errores.push('Una tarea pendiente no puede tener avance: pásala a "En curso".');
  if (avance === 100 && tarea.estado !== 'completada' && tarea.estado !== 'en_revision') errores.push('El 100 % solo se registra al completar la tarea.');
  if (tarea.estado === 'completada' && avance !== 100) errores.push('Una tarea completada tiene 100 % de avance.');
  if (tarea.estado === 'bloqueada' && !texto(tarea.motivoBloqueo)) errores.push('Explica qué bloquea la tarea.');
  if (['completada', 'en_revision'].includes(tarea.estado)) {
    const pendientes = (tarea.criteriosAceptacion || []).filter(criterio => !criterio.cumplido);
    if (pendientes.length) errores.push(`Faltan ${pendientes.length} criterio(s) de aceptación por cumplir.`);
  }
  if (tarea.esfuerzoHoras !== null && tarea.esfuerzoHoras !== undefined && tarea.esfuerzoHoras !== '' && !(Number(tarea.esfuerzoHoras) >= 0)) {
    errores.push('El esfuerzo estimado debe ser un número de horas mayor o igual a cero.');
  }
  if (tarea.puntos !== null && tarea.puntos !== undefined && tarea.puntos !== '' && !(Number(tarea.puntos) >= 0)) errores.push('Los puntos deben ser un número mayor o igual a cero.');
  return errores;
}

/** Nivel de un riesgo (probabilidad × impacto, escala 1–5). null si falta alguno. */
export const nivelRiesgo = (probabilidad, impacto) => {
  const p = Number(probabilidad);
  const i = Number(impacto);
  return p >= 1 && p <= 5 && i >= 1 && i <= 5 ? p * i : null;
};
