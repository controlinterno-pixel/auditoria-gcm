// api/_lib/proyectosAcciones.js - Autorización y reglas de cada operación de Gestión de Proyectos.
// Funciones puras: reciben el proyecto y su plan tal como están en Firestore y devuelven la versión nueva y los
// eventos del historial. El endpoint (api/_grc/proyectos.js) solo lee, llama aquí y escribe en una transacción.
import { esAdministradorTotal, puedeVerTodo } from './roles.js';
import { esFecha } from '../../src/utils/proyectos/fechas.js';
import {
  CATEGORIAS_COSTO, DECISIONES_ENTREGABLE, ESTADOS_COMPROMISO, ESTADOS_ENTREGABLE, ESTADOS_RIESGO,
  ESTADOS_SPRINT, ESTADOS_TAREA, LIMITES, NATURALEZAS_RIESGO, PRIORIDADES, RESPUESTAS_OPORTUNIDAD, RESPUESTAS_RIESGO, TIPOS_COSTO, TIPOS_RIESGO, TIPOS_TAREA,
  TRANSICIONES_CAMBIO, TRANSICIONES_PROYECTO, UMBRALES_POR_DEFECTO, correosConAcceso, nivelRiesgo, normalizarCorreo,
  requisitosTransicion, rolesEnProyecto, validarFicha, validarMiembros, validarTarea, CORREO_VALIDO,
} from '../../src/utils/proyectos/modelo.js';
import { crearLineaBase, erroresEstructura, propagarDependencias } from '../../src/utils/proyectos/cronograma.js';
import { compactarPlan } from '../../src/utils/proyectos/indicadores.js';
import { APARTADOS, DOCUMENTO, codigoEstrategico, elementosRaci } from '../../src/utils/proyectos/metodologia.js';

export const SUBMODULO_PROYECTOS = 'sub_proyectos';
export const TAMANO_MAXIMO_PLAN = 900 * 1024; // Firestore admite 1 MiB por documento.

export class ErrorProyecto extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}
const rechazar = (mensaje, status = 400) => { throw new ErrorProyecto(mensaje, status); };
const exigir = (condicion, mensaje, status = 403) => { if (!condicion) rechazar(mensaje, status); };

const texto = (valor, max = LIMITES.texto) => String(valor ?? '').trim().slice(0, max);
const textoLargo = valor => texto(valor, LIMITES.textoLargo);
const listaTextos = (valor, max = 50) => (Array.isArray(valor) ? valor : []).map(item => texto(item, 500)).filter(Boolean).slice(0, max);
const enlace = valor => {
  const url = texto(valor, 2000);
  if (!url) return '';
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : rechazar('Los enlaces de evidencias deben empezar por http:// o https://.');
  } catch (error) {
    if (error instanceof ErrorProyecto) throw error;
    return rechazar('Uno de los enlaces de evidencia no es válido.');
  }
};
const evidencias = valor => (Array.isArray(valor) ? valor : []).slice(0, 30).map(item => ({
  url: enlace(item?.url), nombre: texto(item?.nombre), subidoPor: normalizarCorreo(item?.subidoPor), fecha: texto(item?.fecha, 30),
})).filter(item => item.url);
const correoOpcional = (valor, campo) => {
  const correo = normalizarCorreo(valor);
  if (correo && !CORREO_VALIDO.test(correo)) rechazar(`El correo de ${campo} debe ser @termales.com.co.`);
  return correo;
};
const numeroONulo = valor => (valor === '' || valor === null || valor === undefined ? null : Number(valor));

/** ¿Puede entrar al módulo? Administrador, auditor (consulta) o casillas Gobernanza + Gestión de proyectos. */
export function accesoModulo(usuario) {
  const permisos = Array.isArray(usuario?.permisos) ? usuario.permisos : [];
  return puedeVerTodo(usuario?.rol) || (permisos.includes('gobernanza') && permisos.includes(SUBMODULO_PROYECTOS));
}
export const puedeCrearProyectos = usuario => esAdministradorTotal(usuario?.rol)
  || (Array.isArray(usuario?.permisos) && usuario.permisos.includes('gobernanza') && usuario.permisos.includes(SUBMODULO_PROYECTOS));

/**
 * Qué puede hacer el usuario en este proyecto. El rol global solo da consulta (auditor) o todo (administrador);
 * lo demás sale de los roles del proyecto: director gestiona, patrocinador autoriza, aprobadores revisan,
 * equipo ejecuta sus tareas y lectores consultan.
 */
export function capacidades(usuario, proyecto) {
  const admin = esAdministradorTotal(usuario?.rol);
  const roles = rolesEnProyecto(proyecto, usuario?.email);
  const abierto = !['cerrado', 'cancelado'].includes(proyecto?.estado) && !proyecto?.archivado;
  const ver = admin || puedeVerTodo(usuario?.rol) || roles.size > 0;
  const gestionar = abierto && (admin || roles.has('director'));
  return {
    roles: [...roles],
    ver,
    gestionar,
    aportar: abierto && (gestionar || roles.has('equipo')),
    decidir: abierto && (admin || roles.has('patrocinador') || roles.has('comite') || roles.has('aprobador') || roles.has('director')),
    autorizarEstado: abierto && (admin || roles.has('patrocinador') || roles.has('comite')),
    comentar: abierto && ver && (admin || roles.size > 0),
    archivar: admin || (roles.has('director') && !abierto && !proyecto?.archivado),
  };
}

const evento = (accion, recurso, idRecurso, extra = {}) => ({ accion, recurso, idRecurso: String(idRecurso ?? ''), ...extra });
const diferencias = (antes = {}, despues = {}, campos = Object.keys({ ...antes, ...despues })) => {
  const cambios = campos.filter(campo => JSON.stringify(antes?.[campo] ?? null) !== JSON.stringify(despues?.[campo] ?? null));
  return cambios.length ? {
    antes: Object.fromEntries(cambios.map(campo => [campo, antes?.[campo] ?? null])),
    despues: Object.fromEntries(cambios.map(campo => [campo, despues?.[campo] ?? null])),
  } : null;
};
const recortarHistorial = valor => JSON.parse(JSON.stringify(valor ?? null, (_, dato) => (typeof dato === 'string' && dato.length > 600 ? `${dato.slice(0, 600)}…` : dato)));

function siguienteCodigo(plan, tipo, prefijo) {
  const contadores = { ...(plan.contadores || {}) };
  contadores[tipo] = (Number(contadores[tipo]) || 0) + 1;
  plan.contadores = contadores;
  return `${prefijo}-${String(contadores[tipo]).padStart(3, '0')}`;
}

/** Busca el registro por id y comprueba que nadie lo cambió desde que el usuario lo cargó. */
function registroVigente(lista, id, versionBase, nombre) {
  const registro = (lista || []).find(item => String(item.id) === String(id));
  if (!registro) rechazar(`${nombre} no existe o fue eliminado.`, 404);
  if (registro.version && versionBase !== registro.version) {
    rechazar(`${registro.actualizadoPor || 'Otra persona'} modificó ${nombre.toLowerCase()} "${registro.titulo || registro.nombre || registro.codigo || id}" mientras lo editabas. Recarga para ver sus cambios y vuelve a guardar.`, 409);
  }
  return registro;
}
const reemplazar = (lista, registro) => (lista || []).map(item => (String(item.id) === String(registro.id) ? registro : item));
const sello = (registro, ctx) => ({ ...registro, version: ctx.generarId(), actualizadoPor: ctx.usuario.email, actualizadoEn: ctx.ahora });

// ---------------------------------------------------------------------------------------------------------
// Proyecto
// ---------------------------------------------------------------------------------------------------------

function normalizarConfiguracion(datos = {}, anterior = {}) {
  const umbrales = { ...UMBRALES_POR_DEFECTO, ...(anterior.umbrales || {}) };
  Object.keys(UMBRALES_POR_DEFECTO).forEach(clave => {
    const valor = Number(datos?.umbrales?.[clave]);
    if (datos?.umbrales?.[clave] !== undefined && datos.umbrales[clave] !== '') {
      if (!Number.isFinite(valor) || valor < 0) rechazar(`El umbral "${clave}" debe ser un número mayor o igual a cero.`);
      umbrales[clave] = valor;
    }
  });
  if (umbrales.desviacionAmarillo > umbrales.desviacionRojo) rechazar('El umbral amarillo de desviación no puede ser mayor que el rojo.');
  if (umbrales.costoAmarillo > umbrales.costoRojo) rechazar('El umbral amarillo de sobrecosto no puede ser mayor que el rojo.');
  return {
    umbrales,
    aprobarCambiosEstado: datos.aprobarCambiosEstado === undefined ? anterior.aprobarCambiosEstado !== false : datos.aprobarCambiosEstado !== false,
  };
}

export function crearProyecto(datos, ctx) {
  exigir(puedeCrearProyectos(ctx.usuario), 'No tienes permiso para crear proyectos. Pide a un administrador la casilla "Gestión de proyectos".');
  const { ficha, errores } = validarFicha(datos?.ficha);
  const { miembros, errores: erroresMiembros } = validarMiembros({ director: ctx.usuario.email, ...datos?.miembros });
  const todos = [...errores, ...erroresMiembros];
  if (todos.length) rechazar(todos.join(' '));
  const proyecto = {
    codigo: ctx.codigo,
    codigoEstrategico: codigoEstrategico(ficha),
    ficha,
    miembros,
    correosAcceso: correosConAcceso(miembros),
    estado: 'propuesto',
    presupuestoVigente: ficha.presupuestoAprobado,
    configuracion: normalizarConfiguracion(datos?.configuracion),
    solicitudesEstado: [],
    explicacionEstado: null,
    cierre: null,
    archivado: false,
    version: ctx.generarId(),
    creadoPor: ctx.usuario.email,
    creadoEn: ctx.ahora,
    actualizadoPor: ctx.usuario.email,
    actualizadoEn: ctx.ahora,
  };
  const plan = { tareas: [], entregables: [], riesgos: [], cambios: [], reuniones: [], costos: [], sprints: [], lineasBase: [], revisionesPresupuesto: [], secciones: {}, documentos: {}, contadores: {} };
  return { proyecto, plan, eventos: [evento('crear', 'proyecto', ctx.codigo, { despues: { nombre: ficha.nombre, director: miembros.director } })] };
}

function editarFicha(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador edita la ficha.');
  if (datos.version !== proyecto.version) {
    rechazar(`${proyecto.actualizadoPor || 'Otra persona'} modificó la ficha mientras la editabas. Recarga para ver sus cambios y vuelve a guardar.`, 409);
  }
  const { ficha, errores } = validarFicha(datos.ficha);
  const { miembros, errores: erroresMiembros } = validarMiembros(datos.miembros);
  const todos = [...errores, ...erroresMiembros];
  if (todos.length) rechazar(todos.join(' '));
  const admin = esAdministradorTotal(ctx.usuario.rol);
  if (!admin && miembros.director !== normalizarCorreo(proyecto.miembros?.director)) rechazar('Solo un administrador puede cambiar al director del proyecto.');
  if (!admin && miembros.patrocinador !== normalizarCorreo(proyecto.miembros?.patrocinador)) rechazar('Solo un administrador puede cambiar al patrocinador: es quien autoriza las solicitudes del director.');
  if (!admin && JSON.stringify([...(miembros.comite || [])].sort()) !== JSON.stringify([...(proyecto.miembros?.comite || [])].sort())) rechazar('Solo un administrador puede cambiar los integrantes del Comité I+D+i que aprueban las fases.');
  const presupuestoCambia = ficha.presupuestoAprobado !== (proyecto.ficha?.presupuestoAprobado ?? null) || ficha.manejaPresupuesto !== (proyecto.ficha?.manejaPresupuesto === true);
  if (presupuestoCambia && !['propuesto', 'factibilidad', 'planificacion'].includes(proyecto.estado)) {
    rechazar('El presupuesto aprobado ya no se edita en la ficha: registra una solicitud de cambio con el nuevo presupuesto.');
  }
  const configuracion = normalizarConfiguracion(datos.configuracion, proyecto.configuracion);
  const nuevo = {
    ...proyecto, ficha, miembros, correosAcceso: correosConAcceso(miembros), configuracion, codigoEstrategico: codigoEstrategico(ficha),
    presupuestoVigente: presupuestoCambia ? ficha.presupuestoAprobado : proyecto.presupuestoVigente,
  };
  const cambio = diferencias({ ...proyecto.ficha, miembros: proyecto.miembros, configuracion: proyecto.configuracion }, { ...ficha, miembros, configuracion });
  return { proyecto: nuevo, plan, eventos: cambio ? [evento('editar-ficha', 'proyecto', proyecto.codigo, recortarHistorial(cambio))] : [] };
}

function aplicarEstado(proyecto, plan, destino, ctx) {
  const faltantes = requisitosTransicion(proyecto, plan, destino);
  if (faltantes.length) rechazar(`No se puede ${destino === 'ejecucion' ? 'iniciar la ejecución' : `pasar a "${destino}"`}: ${faltantes.join(' ')}`);
  const ficha = { ...proyecto.ficha };
  const hoy = ctx.hoy;
  if (destino === 'ejecucion' && !ficha.inicioReal) ficha.inicioReal = hoy;
  if (destino === 'cerrado' && !ficha.finReal) ficha.finReal = hoy;
  const estadoAntesSuspension = destino === 'suspendido' ? proyecto.estado : null;
  return { ...proyecto, ficha, estado: destino, estadoAntesSuspension };
}

function solicitarEstado(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador solicita cambios de estado.');
  const destino = datos.destino;
  const motivo = textoLargo(datos.motivo);
  if (!TRANSICIONES_PROYECTO[destino]) rechazar('El estado solicitado no es válido.');
  if (!motivo) rechazar('Explica el motivo del cambio de estado.');
  const faltantes = requisitosTransicion(proyecto, plan, destino);
  if (faltantes.length) rechazar(faltantes.join(' '));
  if ((proyecto.solicitudesEstado || []).some(solicitud => solicitud.estado === 'pendiente')) rechazar('Ya hay una solicitud de cambio de estado pendiente de decisión.');
  if (proyecto.configuracion?.aprobarCambiosEstado === false) {
    const nuevo = aplicarEstado(proyecto, plan, destino, ctx);
    return { proyecto: nuevo, plan, eventos: [evento('cambiar-estado', 'proyecto', proyecto.codigo, { antes: { estado: proyecto.estado }, despues: { estado: destino }, motivo })] };
  }
  const solicitud = { id: ctx.generarId(), origen: proyecto.estado, destino, motivo, solicitante: ctx.usuario.email, fecha: ctx.ahora, estado: 'pendiente' };
  return {
    proyecto: { ...proyecto, solicitudesEstado: [...(proyecto.solicitudesEstado || []), solicitud] },
    plan,
    eventos: [evento('solicitar-estado', 'proyecto', proyecto.codigo, { despues: { destino }, motivo, referencia: solicitud.id })],
  };
}

function decidirEstado(proyecto, plan, datos, ctx, cap) {
  exigir(cap.autorizarEstado, 'Solo el patrocinador del proyecto o un administrador autoriza cambios de estado.');
  const solicitud = (proyecto.solicitudesEstado || []).find(item => item.id === datos.idSolicitud && item.estado === 'pendiente');
  if (!solicitud) rechazar('La solicitud no existe o ya fue decidida.', 404);
  exigir(normalizarCorreo(solicitud.solicitante) !== normalizarCorreo(ctx.usuario.email), 'No puedes autorizar una solicitud que hiciste tú: debe decidirla otra persona.');
  if (!['aprobada', 'rechazada'].includes(datos.decision)) rechazar('La decisión debe ser aprobar o rechazar.');
  const comentario = textoLargo(datos.comentario);
  if (datos.decision === 'rechazada' && !comentario) rechazar('Explica por qué se rechaza la solicitud.');
  if (solicitud.origen !== proyecto.estado) rechazar('El proyecto cambió de estado después de la solicitud: debe solicitarse de nuevo.', 409);
  const decidida = { ...solicitud, estado: datos.decision, decididaPor: ctx.usuario.email, fechaDecision: ctx.ahora, comentario };
  let nuevo = { ...proyecto, solicitudesEstado: proyecto.solicitudesEstado.map(item => (item.id === solicitud.id ? decidida : item)) };
  if (datos.decision === 'aprobada') nuevo = aplicarEstado(nuevo, plan, solicitud.destino, ctx);
  return {
    proyecto: nuevo,
    plan,
    eventos: [evento(datos.decision === 'aprobada' ? 'aprobar-estado' : 'rechazar-estado', 'proyecto', proyecto.codigo, {
      antes: { estado: proyecto.estado }, despues: { estado: nuevo.estado }, motivo: comentario || solicitud.motivo, referencia: solicitud.id,
    })],
  };
}

function explicarEstado(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador registra la explicación del estado.');
  const explicacionEstado = { explicacion: textoLargo(datos.explicacion), causa: textoLargo(datos.causa), planRecuperacion: textoLargo(datos.planRecuperacion), por: ctx.usuario.email, fecha: ctx.ahora };
  if (!explicacionEstado.explicacion) rechazar('Escribe la explicación del estado del proyecto.');
  return { proyecto: { ...proyecto, explicacionEstado }, plan, eventos: [evento('explicar-estado', 'proyecto', proyecto.codigo, { despues: recortarHistorial(explicacionEstado) })] };
}


function archivar(proyecto, plan, datos, ctx, cap) {
  const archivado = datos.archivado === true;
  if (archivado) exigir(cap.archivar, 'Solo se archivan proyectos cerrados o cancelados (el director o un administrador).');
  else exigir(esAdministradorTotal(ctx.usuario.rol), 'Solo un administrador desarchiva proyectos.');
  return { proyecto: { ...proyecto, archivado }, plan, eventos: [evento(archivado ? 'archivar' : 'desarchivar', 'proyecto', proyecto.codigo)] };
}

// ---------------------------------------------------------------------------------------------------------
// Tareas, línea base y sprints
// ---------------------------------------------------------------------------------------------------------

const CAMPOS_EJECUCION = ['estado', 'avance', 'motivoBloqueo', 'inicioReal', 'finReal', 'criteriosAceptacion', 'evidencias'];

function normalizarTarea(datos, anterior = {}) {
  const criterios = (Array.isArray(datos.criteriosAceptacion) ? datos.criteriosAceptacion : anterior.criteriosAceptacion || [])
    .slice(0, 30).map(criterio => ({ texto: texto(criterio?.texto, 500), cumplido: criterio?.cumplido === true })).filter(criterio => criterio.texto);
  return {
    ...anterior,
    titulo: texto(datos.titulo ?? anterior.titulo),
    descripcion: textoLargo(datos.descripcion ?? anterior.descripcion),
    tipo: datos.tipo ?? anterior.tipo,
    padreId: texto(datos.padreId ?? anterior.padreId, 80),
    responsable: correoOpcional(datos.responsable ?? anterior.responsable, 'responsable'),
    colaboradores: (Array.isArray(datos.colaboradores) ? datos.colaboradores : anterior.colaboradores || []).map(correo => correoOpcional(correo, 'colaborador')).filter(Boolean).slice(0, 20),
    inicio: datos.inicio ?? anterior.inicio ?? '',
    fin: datos.fin ?? anterior.fin ?? '',
    inicioReal: datos.inicioReal ?? anterior.inicioReal ?? '',
    finReal: datos.finReal ?? anterior.finReal ?? '',
    prioridad: datos.prioridad ?? anterior.prioridad ?? 'media',
    estado: datos.estado ?? anterior.estado ?? 'pendiente',
    avance: Number(datos.avance ?? anterior.avance ?? 0),
    esfuerzoHoras: numeroONulo(datos.esfuerzoHoras ?? anterior.esfuerzoHoras),
    puntos: numeroONulo(datos.puntos ?? anterior.puntos),
    sprintId: texto(datos.sprintId ?? anterior.sprintId, 80),
    dependencias: (Array.isArray(datos.dependencias) ? datos.dependencias : anterior.dependencias || []).slice(0, 30)
      .map(dependencia => ({ id: texto(dependencia?.id, 80), desfase: Math.trunc(Number(dependencia?.desfase) || 0) })).filter(dependencia => dependencia.id),
    restricciones: textoLargo(datos.restricciones ?? anterior.restricciones),
    entregablesTexto: textoLargo(datos.entregablesTexto ?? anterior.entregablesTexto),
    motivoBloqueo: textoLargo(datos.motivoBloqueo ?? anterior.motivoBloqueo),
    requiereRevision: (datos.requiereRevision ?? anterior.requiereRevision) === true,
    criteriosAceptacion: criterios,
    evidencias: datos.evidencias ? evidencias(datos.evidencias) : anterior.evidencias || [],
    comentarios: anterior.comentarios || [],
  };
}

function guardarTarea(proyecto, plan, datos, ctx, cap) {
  const entrada = datos.tarea || {};
  const nueva = !entrada.id;
  const anterior = nueva ? null : registroVigente(plan.tareas, entrada.id, entrada.versionBase, 'La tarea');
  const correo = normalizarCorreo(ctx.usuario.email);
  const esEjecutor = anterior && (normalizarCorreo(anterior.responsable) === correo || (anterior.colaboradores || []).includes(correo));
  if (nueva) exigir(cap.gestionar, 'Solo el director del proyecto o un administrador crea tareas.');
  else exigir(cap.gestionar || (cap.aportar && esEjecutor), 'Solo el director, un administrador o las personas asignadas a la tarea pueden modificarla.');

  // Quien ejecuta (sin gestionar) solo cambia campos de ejecución: no reprograma ni reasigna.
  const datosPermitidos = cap.gestionar ? entrada : Object.fromEntries(Object.entries(entrada).filter(([campo]) => CAMPOS_EJECUCION.includes(campo)));
  let tarea = normalizarTarea(datosPermitidos, anterior || {});
  if (!TIPOS_TAREA[tarea.tipo] || !ESTADOS_TAREA[tarea.estado] || !PRIORIDADES[tarea.prioridad]) rechazar('Tipo, estado o prioridad de la tarea no válidos.');
  if (anterior?.estado === 'en_revision' && tarea.estado !== 'en_revision' && !['cancelada'].includes(tarea.estado)) {
    rechazar('La tarea está en revisión: debe aprobarla o devolverla el revisor.');
  }
  if (tarea.estado === 'completada' && anterior?.estado !== 'completada' && tarea.requiereRevision) {
    rechazar('Esta tarea requiere revisión: pásala a "En revisión" para que otra persona la apruebe.');
  }
  if (tarea.estado === 'en_revision' && !tarea.requiereRevision) rechazar('Esta tarea no requiere revisión: márcala como completada.');
  if (tarea.estado === 'en_revision' && tarea.avance !== 100) tarea.avance = 100;
  if (tarea.estado === 'cancelada' && anterior?.estado !== 'cancelada') {
    exigir(cap.gestionar, 'Solo el director del proyecto o un administrador cancela tareas.');
    if (!texto(entrada.motivo)) rechazar('Explica por qué se cancela la tarea.');
  }
  if (tarea.estado === 'en_curso' && !tarea.inicioReal) tarea.inicioReal = ctx.hoy;
  if (tarea.estado === 'completada' && !tarea.finReal) tarea.finReal = ctx.hoy;
  if (tarea.tipo === 'hito' && tarea.estado === 'completada' && !tarea.inicioReal) tarea.inicioReal = tarea.finReal;
  if (tarea.estado === 'en_revision' && anterior?.estado !== 'en_revision') tarea.avancePrevio = Math.min(Number(anterior?.avance) || 0, 99);

  const errores = validarTarea(tarea);
  if (errores.length) rechazar(errores.join(' '));

  // Reprogramar algo que está en la línea base exige motivo (la línea base no cambia; se mide la desviación).
  const enLineaBase = anterior && (plan.lineasBase || []).at(-1)?.tareas?.[String(anterior.id)];
  const fechasCambian = anterior && (anterior.inicio !== tarea.inicio || anterior.fin !== tarea.fin);
  if (enLineaBase && fechasCambian && !texto(entrada.motivo)) rechazar('Esta tarea está en la línea base: explica el motivo de la reprogramación.');

  if (nueva) tarea = { ...tarea, id: ctx.generarId(), codigo: siguienteCodigo(plan, 'tarea', 'T'), creadoPor: ctx.usuario.email, creadoEn: ctx.ahora, comentarios: [] };
  tarea = sello(tarea, ctx);
  const lista = nueva ? [...(plan.tareas || []), tarea] : reemplazar(plan.tareas, tarea);
  const estructura = erroresEstructura(lista);
  if (estructura.length) rechazar(estructura.join(' '));
  const { tareas, movidas } = propagarDependencias(lista, proyecto.ficha?.calendario);
  const tareasSelladas = tareas.map(item => (movidas.some(movida => String(movida.id) === String(item.id)) ? sello(item, ctx) : item));

  const cambio = nueva ? { despues: { titulo: tarea.titulo, responsable: tarea.responsable, inicio: tarea.inicio, fin: tarea.fin } }
    : diferencias(anterior, tarea, ['titulo', 'tipo', 'padreId', 'responsable', 'colaboradores', 'inicio', 'fin', 'estado', 'avance', 'prioridad', 'dependencias', 'motivoBloqueo', 'criteriosAceptacion', 'evidencias', 'sprintId']);
  const eventos = cambio ? [evento(nueva ? 'crear-tarea' : 'editar-tarea', 'tarea', tarea.codigo, { ...recortarHistorial(cambio), motivo: texto(entrada.motivo, 500) })] : [];
  movidas.filter(movida => String(movida.id) !== String(tarea.id)).forEach(movida => eventos.push(evento('reprogramar-por-dependencia', 'tarea', movida.titulo, { antes: { fechas: movida.de }, despues: { fechas: movida.a }, referencia: tarea.codigo })));
  return { proyecto, plan: { ...plan, tareas: tareasSelladas }, eventos, respuesta: { id: tarea.id, movidas } };
}

function revisarTarea(proyecto, plan, datos, ctx, cap) {
  const tarea = registroVigente(plan.tareas, datos.idTarea, datos.versionBase, 'La tarea');
  exigir(cap.decidir, 'Solo el director, los aprobadores, el patrocinador o un administrador revisan tareas.');
  if (tarea.estado !== 'en_revision') rechazar('La tarea no está en revisión.');
  const correo = normalizarCorreo(ctx.usuario.email);
  exigir(normalizarCorreo(tarea.responsable) !== correo && !(tarea.colaboradores || []).includes(correo), 'No puedes aprobar una tarea en la que trabajaste: debe revisarla otra persona.');
  const comentario = textoLargo(datos.comentario);
  if (datos.decision === 'devolver' && !comentario) rechazar('Explica qué falta para aprobar la tarea.');
  if (!['aprobar', 'devolver'].includes(datos.decision)) rechazar('La decisión debe ser aprobar o devolver.');
  const revisada = sello({
    ...tarea,
    estado: datos.decision === 'aprobar' ? 'completada' : 'en_curso',
    avance: datos.decision === 'aprobar' ? 100 : (tarea.avancePrevio ?? 90),
    finReal: datos.decision === 'aprobar' ? (tarea.finReal || ctx.hoy) : '',
    revisiones: [...(tarea.revisiones || []), { decision: datos.decision, comentario, por: ctx.usuario.email, fecha: ctx.ahora }],
  }, ctx);
  return {
    proyecto, plan: { ...plan, tareas: reemplazar(plan.tareas, revisada) },
    eventos: [evento(datos.decision === 'aprobar' ? 'aprobar-tarea' : 'devolver-tarea', 'tarea', tarea.codigo, { antes: { estado: tarea.estado }, despues: { estado: revisada.estado }, motivo: comentario })],
  };
}

function comentarTarea(proyecto, plan, datos, ctx, cap) {
  exigir(cap.comentar, 'No puedes comentar en este proyecto.');
  const tarea = (plan.tareas || []).find(item => String(item.id) === String(datos.idTarea));
  if (!tarea) rechazar('La tarea no existe.', 404);
  const comentario = textoLargo(datos.texto);
  if (!comentario) rechazar('Escribe el comentario.');
  // Los comentarios no cambian la versión de la tarea: comentar no debe provocar conflictos con quien la edita.
  const actualizada = { ...tarea, comentarios: [...(tarea.comentarios || []), { id: ctx.generarId(), texto: comentario, por: ctx.usuario.email, fecha: ctx.ahora }].slice(-200) };
  return { proyecto, plan: { ...plan, tareas: reemplazar(plan.tareas, actualizada) }, eventos: [evento('comentar-tarea', 'tarea', tarea.codigo, { despues: { comentario: comentario.slice(0, 300) } })] };
}

function establecerLineaBase(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador establece la línea base.');
  const anteriores = plan.lineasBase || [];
  const motivo = textoLargo(datos.motivo);
  let cambio = null;
  if (anteriores.length) {
    cambio = (plan.cambios || []).find(item => String(item.id) === String(datos.idCambio));
    if (!cambio || cambio.estado !== 'aprobada') rechazar('Una nueva línea base solo se establece con una solicitud de cambio aprobada (y aún no implementada).');
  }
  const conFechas = (plan.tareas || []).filter(tarea => esFecha(tarea.inicio) && esFecha(tarea.fin) && tarea.estado !== 'cancelada');
  if (!conFechas.length) rechazar('Registra actividades con fechas antes de establecer la línea base.');
  const lineaBase = crearLineaBase(plan.tareas || [], { version: anteriores.length + 1, establecidaPor: ctx.usuario.email, fecha: ctx.ahora, motivo, idCambio: cambio?.id || '' });
  return {
    proyecto, plan: { ...plan, lineasBase: [...anteriores, lineaBase] },
    eventos: [evento('establecer-linea-base', 'linea-base', `v${lineaBase.version}`, { motivo, referencia: cambio?.codigo || '', despues: { actividades: Object.keys(lineaBase.tareas).length } })],
  };
}

function guardarSprint(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador gestiona los sprints.');
  if (proyecto.ficha?.metodologia === 'predictiva') rechazar('Los sprints son para proyectos ágiles o híbridos.');
  const entrada = datos.sprint || {};
  const anterior = entrada.id ? registroVigente(plan.sprints, entrada.id, entrada.versionBase, 'El sprint') : null;
  const sprint = {
    ...(anterior || {}),
    nombre: texto(entrada.nombre), objetivo: textoLargo(entrada.objetivo), inicio: entrada.inicio || '', fin: entrada.fin || '',
    capacidad: numeroONulo(entrada.capacidad), estado: entrada.estado || 'planeado',
    revision: textoLargo(entrada.revision), retrospectiva: textoLargo(entrada.retrospectiva), mejoras: listaTextos(entrada.mejoras, 30),
  };
  if (!sprint.nombre) rechazar('Escribe el nombre del sprint.');
  if (!esFecha(sprint.inicio) || !esFecha(sprint.fin) || sprint.fin < sprint.inicio) rechazar('Indica fechas de inicio y fin válidas para el sprint.');
  if (!ESTADOS_SPRINT[sprint.estado]) rechazar('El estado del sprint no es válido.');
  if (sprint.capacidad !== null && !(sprint.capacidad >= 0)) rechazar('La capacidad debe ser un número de puntos mayor o igual a cero.');
  if (sprint.estado === 'activo' && (plan.sprints || []).some(item => item.estado === 'activo' && item.id !== sprint.id)) rechazar('Ya hay un sprint activo: ciérralo antes de activar otro.');
  const sellado = sello(anterior ? sprint : { ...sprint, id: ctx.generarId(), codigo: siguienteCodigo(plan, 'sprint', 'S') }, ctx);
  const cambio = anterior ? diferencias(anterior, sellado, ['nombre', 'objetivo', 'inicio', 'fin', 'capacidad', 'estado', 'revision', 'retrospectiva', 'mejoras']) : { despues: { nombre: sellado.nombre } };
  return {
    proyecto, plan: { ...plan, sprints: anterior ? reemplazar(plan.sprints, sellado) : [...(plan.sprints || []), sellado] },
    eventos: cambio ? [evento(anterior ? 'editar-sprint' : 'crear-sprint', 'sprint', sellado.codigo, recortarHistorial(cambio))] : [],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Entregables
// ---------------------------------------------------------------------------------------------------------

function guardarEntregable(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador define entregables.');
  const entrada = datos.entregable || {};
  const anterior = entrada.id ? registroVigente(plan.entregables, entrada.id, entrada.versionBase, 'El entregable') : null;
  const entregable = {
    ...(anterior || {}),
    nombre: texto(entrada.nombre), descripcion: textoLargo(entrada.descripcion), responsable: correoOpcional(entrada.responsable, 'responsable'),
    fechaComprometida: entrada.fechaComprometida || '', idTarea: texto(entrada.idTarea, 80), criterios: textoLargo(entrada.criterios),
    estado: anterior?.estado || 'pendiente', presentaciones: anterior?.presentaciones || [], revisiones: anterior?.revisiones || [],
  };
  if (!entregable.nombre) rechazar('Escribe el nombre del entregable.');
  if (!entregable.responsable) rechazar('Asigna el responsable del entregable.');
  if (!esFecha(entregable.fechaComprometida)) rechazar('Indica la fecha comprometida del entregable.');
  if (entregable.idTarea && !(plan.tareas || []).some(tarea => String(tarea.id) === entregable.idTarea)) rechazar('La tarea asociada al entregable no existe.');
  if (entrada.estado === 'en_elaboracion' && ['pendiente', 'requiere_ajustes'].includes(entregable.estado)) entregable.estado = 'en_elaboracion';
  const sellado = sello(anterior ? entregable : { ...entregable, id: ctx.generarId(), codigo: siguienteCodigo(plan, 'entregable', 'E') }, ctx);
  const cambio = anterior ? diferencias(anterior, sellado, ['nombre', 'descripcion', 'responsable', 'fechaComprometida', 'idTarea', 'criterios', 'estado']) : { despues: { nombre: sellado.nombre, fechaComprometida: sellado.fechaComprometida } };
  return {
    proyecto, plan: { ...plan, entregables: anterior ? reemplazar(plan.entregables, sellado) : [...(plan.entregables || []), sellado] },
    eventos: cambio ? [evento(anterior ? 'editar-entregable' : 'crear-entregable', 'entregable', sellado.codigo, recortarHistorial(cambio))] : [],
  };
}

function presentarEntregable(proyecto, plan, datos, ctx, cap) {
  const entregable = registroVigente(plan.entregables, datos.id, datos.versionBase, 'El entregable');
  const esResponsable = normalizarCorreo(entregable.responsable) === normalizarCorreo(ctx.usuario.email);
  exigir(cap.gestionar || (cap.aportar && esResponsable), 'Solo el responsable del entregable, el director o un administrador lo presentan.');
  if (!['pendiente', 'en_elaboracion', 'requiere_ajustes'].includes(entregable.estado)) rechazar(`El entregable está "${ESTADOS_ENTREGABLE[entregable.estado]}": no se puede presentar ahora.`);
  const soportes = evidencias(datos.evidencias);
  if (!soportes.length) rechazar('Adjunta al menos una evidencia para presentar el entregable.');
  const presentacion = { version: (entregable.presentaciones || []).length + 1, comentario: textoLargo(datos.comentario), evidencias: soportes, por: ctx.usuario.email, fecha: ctx.ahora };
  const actualizado = sello({ ...entregable, estado: 'presentado', presentaciones: [...(entregable.presentaciones || []), presentacion] }, ctx);
  return {
    proyecto, plan: { ...plan, entregables: reemplazar(plan.entregables, actualizado) },
    eventos: [evento('presentar-entregable', 'entregable', entregable.codigo, { antes: { estado: entregable.estado }, despues: { estado: 'presentado', version: presentacion.version, evidencias: soportes.length } })],
  };
}

function decidirEntregable(proyecto, plan, datos, ctx, cap) {
  const entregable = registroVigente(plan.entregables, datos.id, datos.versionBase, 'El entregable');
  exigir(cap.decidir, 'Solo los aprobadores, el patrocinador, el director o un administrador revisan entregables.');
  const ultima = (entregable.presentaciones || []).at(-1);
  const correo = normalizarCorreo(ctx.usuario.email);
  exigir(normalizarCorreo(ultima?.por) !== correo && normalizarCorreo(entregable.responsable) !== correo, 'No puedes revisar un entregable que presentaste o del que eres responsable.');
  const decision = datos.decision;
  if (decision === 'en_revision') {
    if (entregable.estado !== 'presentado') rechazar('Solo un entregable presentado pasa a revisión.');
  } else {
    if (!DECISIONES_ENTREGABLE.includes(decision)) rechazar('La decisión no es válida.');
    if (!['presentado', 'en_revision'].includes(entregable.estado)) rechazar('Solo se decide sobre un entregable presentado o en revisión.');
  }
  const comentario = textoLargo(datos.comentario);
  if (['requiere_ajustes', 'rechazado'].includes(decision) && !comentario) rechazar('Explica qué debe ajustarse o por qué se rechaza.');
  const actualizado = sello({
    ...entregable, estado: decision,
    revisiones: [...(entregable.revisiones || []), { decision, comentario, versionRevisada: ultima?.version || null, por: ctx.usuario.email, fecha: ctx.ahora }],
    ...(decision === 'aprobado' ? { fechaAprobacion: ctx.hoy, aprobadoPor: ctx.usuario.email } : {}),
  }, ctx);
  return {
    proyecto, plan: { ...plan, entregables: reemplazar(plan.entregables, actualizado) },
    eventos: [evento('revisar-entregable', 'entregable', entregable.codigo, { antes: { estado: entregable.estado }, despues: { estado: decision }, motivo: comentario })],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Riesgos, incidencias y problemas
// ---------------------------------------------------------------------------------------------------------

function guardarRiesgo(proyecto, plan, datos, ctx, cap) {
  const entrada = datos.riesgo || {};
  const anterior = entrada.id ? registroVigente(plan.riesgos, entrada.id, entrada.versionBase, 'El riesgo') : null;
  const esResponsable = anterior && normalizarCorreo(anterior.responsable) === normalizarCorreo(ctx.usuario.email);
  if (anterior) exigir(cap.gestionar || (cap.aportar && esResponsable), 'Solo el responsable del riesgo, el director o un administrador lo modifican.');
  else exigir(cap.aportar, 'Solo el equipo del proyecto registra riesgos e incidencias.');
  const riesgo = {
    ...(anterior || {}),
    tipo: entrada.tipo, naturaleza: entrada.tipo === 'riesgo' && entrada.naturaleza === 'oportunidad' ? 'oportunidad' : 'amenaza', descripcion: textoLargo(entrada.descripcion),
    costoContingencia: numeroONulo(entrada.costoContingencia), disparador: textoLargo(entrada.disparador), indicadorMonitoreo: textoLargo(entrada.indicadorMonitoreo), causa: textoLargo(entrada.causa), evento: textoLargo(entrada.evento),
    consecuencia: textoLargo(entrada.consecuencia), probabilidad: numeroONulo(entrada.probabilidad), impacto: numeroONulo(entrada.impacto),
    responsable: correoOpcional(entrada.responsable, 'responsable'), controles: textoLargo(entrada.controles), respuesta: entrada.respuesta || '',
    fechaLimite: entrada.fechaLimite || '', probabilidadResidual: numeroONulo(entrada.probabilidadResidual), impactoResidual: numeroONulo(entrada.impactoResidual),
    estado: entrada.estado || 'abierto', idRiesgoMatriz: texto(entrada.idRiesgoMatriz, 80), idTarea: texto(entrada.idTarea, 80),
    evidencias: evidencias(entrada.evidencias),
    acciones: (Array.isArray(entrada.acciones) ? entrada.acciones : []).slice(0, 30).map(accion => ({
      id: texto(accion?.id, 80) || ctx.generarId(), descripcion: texto(accion?.descripcion, 500), responsable: correoOpcional(accion?.responsable, 'responsable de la acción'),
      fechaLimite: accion?.fechaLimite || '', cumplida: accion?.cumplida === true, fechaCumplimiento: accion?.cumplida === true ? (accion?.fechaCumplimiento || ctx.hoy) : '',
    })).filter(accion => accion.descripcion),
  };
  if (!TIPOS_RIESGO[riesgo.tipo]) rechazar('Elige si es un riesgo, problema, incidencia, bloqueo o dependencia externa.');
  if (!riesgo.descripcion) rechazar('Describe el riesgo o la incidencia.');
  if (!ESTADOS_RIESGO[riesgo.estado]) rechazar('El estado no es válido.');
  if (riesgo.tipo === 'riesgo' && nivelRiesgo(riesgo.probabilidad, riesgo.impacto) === null) rechazar('Califica probabilidad e impacto de 1 a 5.');
  if (!NATURALEZAS_RIESGO[riesgo.naturaleza]) rechazar('Indica si es una amenaza o una oportunidad.');
  if (riesgo.respuesta && !(riesgo.naturaleza === 'oportunidad' ? RESPUESTAS_OPORTUNIDAD : RESPUESTAS_RIESGO)[riesgo.respuesta]) rechazar(riesgo.naturaleza === 'oportunidad' ? 'Para una oportunidad la respuesta es explotar, mejorar, compartir o aceptar.' : 'La respuesta a una amenaza es mitigar, evitar, transferir o aceptar.');
  if (riesgo.costoContingencia !== null && !(riesgo.costoContingencia >= 0)) rechazar('El costo de contingencia debe ser un número mayor o igual a cero.');
  if ((riesgo.probabilidadResidual !== null || riesgo.impactoResidual !== null) && nivelRiesgo(riesgo.probabilidadResidual, riesgo.impactoResidual) === null) rechazar('El riesgo residual se califica con probabilidad e impacto de 1 a 5.');
  if (riesgo.fechaLimite && !esFecha(riesgo.fechaLimite)) rechazar('La fecha límite no es válida.');
  if (riesgo.estado === 'cerrado' && riesgo.acciones.some(accion => !accion.cumplida)) rechazar('Para cerrarlo, todas sus acciones de tratamiento deben estar cumplidas.');
  riesgo.nivel = nivelRiesgo(riesgo.probabilidad, riesgo.impacto);
  riesgo.nivelResidual = nivelRiesgo(riesgo.probabilidadResidual, riesgo.impactoResidual);
  const prefijo = riesgo.tipo === 'riesgo' ? 'R' : 'I';
  const sellado = sello(anterior ? riesgo : { ...riesgo, id: ctx.generarId(), codigo: siguienteCodigo(plan, prefijo === 'R' ? 'riesgo' : 'incidencia', prefijo), creadoPor: ctx.usuario.email, creadoEn: ctx.ahora }, ctx);
  const cambio = anterior ? diferencias(anterior, sellado, ['tipo', 'naturaleza', 'descripcion', 'probabilidad', 'impacto', 'responsable', 'respuesta', 'estado', 'acciones', 'probabilidadResidual', 'impactoResidual', 'fechaLimite', 'costoContingencia', 'disparador'])
    : { despues: { tipo: sellado.tipo, descripcion: sellado.descripcion.slice(0, 200), nivel: sellado.nivel } };
  return {
    proyecto, plan: { ...plan, riesgos: anterior ? reemplazar(plan.riesgos, sellado) : [...(plan.riesgos || []), sellado] },
    eventos: cambio ? [evento(anterior ? 'editar-riesgo' : 'crear-riesgo', 'riesgo', sellado.codigo, recortarHistorial(cambio))] : [],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Cambios
// ---------------------------------------------------------------------------------------------------------

function guardarCambio(proyecto, plan, datos, ctx, cap) {
  const entrada = datos.cambio || {};
  const anterior = entrada.id ? registroVigente(plan.cambios, entrada.id, entrada.versionBase, 'La solicitud de cambio') : null;
  if (anterior) {
    exigir(anterior.estado === 'solicitada', 'Solo se edita una solicitud que aún no se analiza.');
    exigir(cap.gestionar || normalizarCorreo(anterior.solicitante) === normalizarCorreo(ctx.usuario.email), 'Solo quien la solicitó o el director editan la solicitud.');
  } else {
    exigir(cap.aportar || cap.decidir, 'Solo los miembros del proyecto solicitan cambios.');
  }
  const nuevoPresupuesto = numeroONulo(entrada.nuevoPresupuesto);
  const cambio = {
    ...(anterior || {}),
    titulo: texto(entrada.titulo), descripcion: textoLargo(entrada.descripcion), justificacion: textoLargo(entrada.justificacion),
    elementosAfectados: textoLargo(entrada.elementosAfectados),
    impacto: {
      alcance: textoLargo(entrada.impacto?.alcance), tiempo: textoLargo(entrada.impacto?.tiempo), costo: textoLargo(entrada.impacto?.costo),
      calidad: textoLargo(entrada.impacto?.calidad), riesgos: textoLargo(entrada.impacto?.riesgos),
    },
    nuevoPresupuesto,
    estado: anterior?.estado || 'solicitada',
    solicitante: anterior?.solicitante || ctx.usuario.email,
    fechaSolicitud: anterior?.fechaSolicitud || ctx.hoy,
    evidencias: evidencias(entrada.evidencias),
    decisiones: anterior?.decisiones || [],
  };
  if (!cambio.titulo || !cambio.descripcion || !cambio.justificacion) rechazar('Escribe el título, la descripción y la justificación del cambio.');
  if (nuevoPresupuesto !== null) {
    if (proyecto.ficha?.manejaPresupuesto !== true) rechazar('Este proyecto no maneja presupuesto.');
    if (!(nuevoPresupuesto > 0)) rechazar('El nuevo presupuesto debe ser mayor que cero.');
  }
  const sellado = sello(anterior ? cambio : { ...cambio, id: ctx.generarId(), codigo: siguienteCodigo(plan, 'cambio', 'SC') }, ctx);
  const diff = anterior ? diferencias(anterior, sellado, ['titulo', 'descripcion', 'justificacion', 'elementosAfectados', 'impacto', 'nuevoPresupuesto']) : { despues: { titulo: sellado.titulo, nuevoPresupuesto } };
  return {
    proyecto, plan: { ...plan, cambios: anterior ? reemplazar(plan.cambios, sellado) : [...(plan.cambios || []), sellado] },
    eventos: diff ? [evento(anterior ? 'editar-cambio' : 'solicitar-cambio', 'cambio', sellado.codigo, recortarHistorial(diff))] : [],
  };
}

function decidirCambio(proyecto, plan, datos, ctx, cap) {
  const cambio = registroVigente(plan.cambios, datos.id, datos.versionBase, 'La solicitud de cambio');
  const destino = datos.estado;
  if (!(TRANSICIONES_CAMBIO[destino] || []).includes(cambio.estado)) rechazar(`No se puede pasar una solicitud "${cambio.estado}" a "${destino}".`);
  const correo = normalizarCorreo(ctx.usuario.email);
  const esSolicitante = normalizarCorreo(cambio.solicitante) === correo;
  const comentario = textoLargo(datos.comentario);
  if (destino === 'en_analisis' || destino === 'implementada') exigir(cap.gestionar, 'Solo el director del proyecto o un administrador analiza o implementa cambios.');
  if (destino === 'aprobada' || destino === 'rechazada') {
    exigir(cap.autorizarEstado || (cap.decidir && !rolesEnProyecto(proyecto, correo).has('director')), 'Solo el patrocinador, los aprobadores o un administrador deciden sobre los cambios.');
    exigir(!esSolicitante, 'No puedes aprobar ni rechazar un cambio que solicitaste.');
    if (!comentario) rechazar('Registra el fundamento de la decisión.');
  }
  if (destino === 'cancelada') exigir(cap.gestionar || esSolicitante, 'Solo quien lo solicitó o el director cancelan la solicitud.');
  const analisis = destino === 'en_analisis' ? textoLargo(datos.analisis) : cambio.analisis;
  if (destino === 'en_analisis' && !analisis) rechazar('Registra el análisis técnico del cambio.');

  let nuevoProyecto = proyecto;
  let versionLineaBase = cambio.versionLineaBase ?? null;
  let nuevoPlan = plan;
  const eventos = [];
  if (destino === 'implementada') {
    versionLineaBase = (plan.lineasBase || []).at(-1)?.version ?? null;
    if (cambio.nuevoPresupuesto !== null && cambio.nuevoPresupuesto !== undefined) {
      const revision = { fecha: ctx.ahora, anterior: proyecto.presupuestoVigente ?? null, nuevo: cambio.nuevoPresupuesto, idCambio: cambio.id, codigoCambio: cambio.codigo, por: ctx.usuario.email };
      nuevoProyecto = { ...proyecto, presupuestoVigente: cambio.nuevoPresupuesto };
      nuevoPlan = { ...plan, revisionesPresupuesto: [...(plan.revisionesPresupuesto || []), revision] };
      eventos.push(evento('revisar-presupuesto', 'presupuesto', cambio.codigo, { antes: { presupuestoVigente: revision.anterior }, despues: { presupuestoVigente: revision.nuevo }, referencia: cambio.codigo }));
    }
  }
  const actualizado = sello({
    ...cambio, estado: destino, analisis, versionLineaBase,
    ...(destino === 'aprobada' || destino === 'rechazada' ? { aprobador: ctx.usuario.email, fechaDecision: ctx.hoy } : {}),
    decisiones: [...(cambio.decisiones || []), { estado: destino, comentario, por: ctx.usuario.email, fecha: ctx.ahora }],
  }, ctx);
  eventos.unshift(evento('decidir-cambio', 'cambio', cambio.codigo, { antes: { estado: cambio.estado }, despues: { estado: destino }, motivo: comentario || analisis || '' }));
  return { proyecto: nuevoProyecto, plan: { ...nuevoPlan, cambios: reemplazar(nuevoPlan.cambios, actualizado) }, eventos };
}

// ---------------------------------------------------------------------------------------------------------
// Reuniones y compromisos
// ---------------------------------------------------------------------------------------------------------

function guardarReunion(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador registra reuniones y actas.');
  const entrada = datos.reunion || {};
  const anterior = entrada.id ? registroVigente(plan.reuniones, entrada.id, entrada.versionBase, 'La reunión') : null;
  const compromisosAnteriores = new Map((anterior?.compromisos || []).map(compromiso => [compromiso.id, compromiso]));
  const reunion = {
    ...(anterior || {}),
    titulo: texto(entrada.titulo), fecha: entrada.fecha || '', tipo: texto(entrada.tipo), asistentes: listaTextos(entrada.asistentes, 60),
    acta: textoLargo(entrada.acta), decisiones: listaTextos(entrada.decisiones, 50), documentos: evidencias(entrada.documentos),
    compromisos: (Array.isArray(entrada.compromisos) ? entrada.compromisos : []).slice(0, 50).map(compromiso => {
      const previo = compromisosAnteriores.get(compromiso?.id) || {};
      return {
        ...previo,
        id: previo.id || ctx.generarId(), descripcion: texto(compromiso?.descripcion, 500), responsable: correoOpcional(compromiso?.responsable, 'responsable del compromiso'),
        fechaLimite: compromiso?.fechaLimite || '', estado: previo.estado || 'pendiente', fechaCumplimiento: previo.fechaCumplimiento || '', seguimiento: previo.seguimiento || [],
      };
    }).filter(compromiso => compromiso.descripcion),
  };
  if (!reunion.titulo || !esFecha(reunion.fecha)) rechazar('Escribe el título y la fecha de la reunión.');
  const incompletos = reunion.compromisos.filter(compromiso => !compromiso.responsable || !esFecha(compromiso.fechaLimite));
  if (incompletos.length) rechazar('Cada compromiso necesita responsable y fecha límite: así se puede verificar su cumplimiento.');
  // Un compromiso con seguimiento no se borra del acta: queda la trazabilidad de lo acordado.
  const borrados = [...compromisosAnteriores.values()].filter(compromiso => !reunion.compromisos.some(item => item.id === compromiso.id));
  if (borrados.some(compromiso => compromiso.estado !== 'pendiente')) rechazar('No se puede quitar del acta un compromiso que ya tiene seguimiento: cancélalo.');
  const sellado = sello(anterior ? reunion : { ...reunion, id: ctx.generarId(), codigo: siguienteCodigo(plan, 'reunion', 'RN') }, ctx);
  const cambio = anterior ? diferencias(anterior, sellado, ['titulo', 'fecha', 'asistentes', 'acta', 'decisiones', 'compromisos']) : { despues: { titulo: sellado.titulo, compromisos: sellado.compromisos.length } };
  return {
    proyecto, plan: { ...plan, reuniones: anterior ? reemplazar(plan.reuniones, sellado) : [...(plan.reuniones || []), sellado] },
    eventos: cambio ? [evento(anterior ? 'editar-reunion' : 'registrar-reunion', 'reunion', sellado.codigo, recortarHistorial(cambio))] : [],
  };
}

function actualizarCompromiso(proyecto, plan, datos, ctx, cap) {
  const reunion = (plan.reuniones || []).find(item => String(item.id) === String(datos.idReunion));
  if (!reunion) rechazar('La reunión no existe.', 404);
  const compromiso = (reunion.compromisos || []).find(item => item.id === datos.idCompromiso);
  if (!compromiso) rechazar('El compromiso no existe.', 404);
  const esResponsable = normalizarCorreo(compromiso.responsable) === normalizarCorreo(ctx.usuario.email);
  exigir(cap.gestionar || (cap.comentar && esResponsable), 'Solo el responsable del compromiso, el director o un administrador lo actualizan.');
  if (!ESTADOS_COMPROMISO[datos.estado]) rechazar('El estado del compromiso no es válido.');
  if (datos.estado === 'cancelado') exigir(cap.gestionar, 'Solo el director o un administrador cancelan compromisos.');
  const comentario = textoLargo(datos.comentario);
  const soporte = enlace(datos.evidencia);
  if (datos.estado === 'cumplido' && !comentario && !soporte) rechazar('Para darlo por cumplido registra cómo se cumplió o adjunta la evidencia.');
  const actualizado = {
    ...compromiso, estado: datos.estado,
    fechaCumplimiento: datos.estado === 'cumplido' ? ctx.hoy : '',
    seguimiento: [...(compromiso.seguimiento || []), { estado: datos.estado, comentario, evidencia: soporte, por: ctx.usuario.email, fecha: ctx.ahora }],
  };
  const reunionActualizada = { ...reunion, compromisos: reunion.compromisos.map(item => (item.id === compromiso.id ? actualizado : item)) };
  return {
    proyecto, plan: { ...plan, reuniones: reemplazar(plan.reuniones, reunionActualizada) },
    eventos: [evento('actualizar-compromiso', 'compromiso', `${reunion.codigo}: ${compromiso.descripcion.slice(0, 60)}`, { antes: { estado: compromiso.estado }, despues: { estado: datos.estado }, motivo: comentario })],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Finanzas
// ---------------------------------------------------------------------------------------------------------

function registrarCosto(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador registran costos.');
  if (proyecto.ficha?.manejaPresupuesto !== true) rechazar('Este proyecto no maneja presupuesto: actívalo en la ficha mientras esté en planificación.');
  const entrada = datos.costo || {};
  const costo = {
    fecha: entrada.fecha || '', tipo: entrada.tipo, categoria: entrada.categoria, monto: Number(entrada.monto), descripcion: texto(entrada.descripcion, 500),
    idTarea: texto(entrada.idTarea, 80), soporte: enlace(entrada.soporte), estado: 'vigente',
  };
  if (!esFecha(costo.fecha)) rechazar('Indica la fecha del costo.');
  if (!TIPOS_COSTO[costo.tipo]) rechazar('Indica si el costo es real (ejecutado) o comprometido.');
  if (!CATEGORIAS_COSTO[costo.categoria]) rechazar('Elige la categoría del costo.');
  if (!(costo.monto > 0)) rechazar('El monto debe ser mayor que cero.');
  if (!costo.descripcion) rechazar('Describe el costo.');
  const sellado = sello({ ...costo, id: ctx.generarId(), codigo: siguienteCodigo(plan, 'costo', 'C'), registradoPor: ctx.usuario.email }, ctx);
  return {
    proyecto, plan: { ...plan, costos: [...(plan.costos || []), sellado] },
    eventos: [evento('registrar-costo', 'costo', sellado.codigo, { despues: { tipo: costo.tipo, categoria: costo.categoria, monto: costo.monto } })],
  };
}

function anularCosto(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador anulan costos.');
  const costo = registroVigente(plan.costos, datos.id, datos.versionBase, 'El costo');
  if (costo.estado === 'anulado') rechazar('El costo ya está anulado.');
  const motivo = textoLargo(datos.motivo);
  if (!motivo) rechazar('Explica por qué se anula el costo.');
  const anulado = sello({ ...costo, estado: 'anulado', motivoAnulacion: motivo }, ctx);
  return { proyecto, plan: { ...plan, costos: reemplazar(plan.costos, anulado) }, eventos: [evento('anular-costo', 'costo', costo.codigo, { antes: { estado: 'vigente', monto: costo.monto }, despues: { estado: 'anulado' }, motivo })] };
}

function estimarCostoFinal(proyecto, plan, datos, ctx, cap) {
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador estiman el costo final.');
  if (proyecto.ficha?.manejaPresupuesto !== true) rechazar('Este proyecto no maneja presupuesto.');
  const monto = numeroONulo(datos.monto);
  const justificacion = textoLargo(datos.justificacion);
  if (monto !== null && !(monto > 0)) rechazar('La estimación debe ser mayor que cero (o déjala vacía para usar real + comprometido).');
  if (monto !== null && !justificacion) rechazar('Justifica la estimación del costo final.');
  const estimadoFinal = monto === null ? null : { monto, justificacion, por: ctx.usuario.email, fecha: ctx.ahora };
  return {
    proyecto, plan: { ...plan, estimadoFinal },
    eventos: [evento('estimar-costo-final', 'presupuesto', proyecto.codigo, { antes: { estimadoFinal: plan.estimadoFinal?.monto ?? null }, despues: { estimadoFinal: monto }, motivo: justificacion })],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Apartados del manual E-ID-MAN-01 (secciones), documentos por fase y lecciones aprendidas
// ---------------------------------------------------------------------------------------------------------

// Esquema de cada sección: 'texto', 'largo', 'fecha', 'numero', 'bool', 'id', una lista de opciones, una
// lista ['multi', ...opciones], un objeto anidado o [esquemaDeElemento] para listas.
const OPCIONES_1_5 = [1, 2, 3, 4, 5];
const FASE = ['preinversion', 'inversion', 'operacion'];
const ESQUEMAS_SECCION = {
  alternativas: { lista: [{ id: 'id', nombre: 'texto', descripcion: 'largo', tecnica: 'largo', economica: 'largo', ambiental: 'largo', social: 'largo', impactosPositivos: 'largo', impactosNegativos: 'largo', seleccionada: 'bool' }] },
  entorno: { descripcion: 'largo', ubicacion: 'largo', normativa: 'largo', actores: 'largo' },
  aspectos: { supuestos: 'largo', estudios: 'largo', normas: 'largo', permisos: 'largo', expertos: 'largo' },
  cronogramaFases: { preinversion: { inicio: 'fecha', fin: 'fecha' }, inversion: { inicio: 'fecha', fin: 'fecha' }, operacion: { inicio: 'fecha', fin: 'fecha' }, hitos: 'largo' },
  objetivos: { justificacionExceso: 'largo' },
  pestel: { factores: [{ id: 'id', letra: ['P', 'E', 'S', 'T', 'EC', 'L'], hecho: 'largo', fuente: 'texto', fechaFuente: 'fecha', tendencia: ['mejor', 'peor', 'estable'], tipo: ['oportunidad', 'amenaza'], importancia: [1, 2, 3], valoracion: OPCIONES_1_5, impacto: ['alto', 'medio', 'bajo'] }] },
  propuestaValor: { segmento: 'largo', tareas: 'largo', dolores: 'largo', motivadores: 'largo', productos: 'largo', calmantes: 'largo', detonantes: 'largo', encaje: 'largo' },
  modeloNegocio: { segmentos: 'largo', propuesta: 'largo', canales: 'largo', relaciones: 'largo', recursos: 'largo', aliados: 'largo', actividades: 'largo', costos: 'largo', ingresos: 'largo' },
  ingresos: { metodo: ['bottom-up', 'top-down'], periodos: [{ id: 'id', periodo: 'texto', clientes: 'numero', precio: 'numero', ajuste: 'numero' }], supuestos: 'largo' },
  localizacion: { ubicacion: 'largo', criterios: 'largo', superficie: 'texto', capacidad: 'largo', restricciones: 'largo' },
  ingenieria: { tipos: ['multi', 'infraestructura', 'producto', 'administrativo', 'rse'], proceso: 'largo', layout: 'largo', estudios: 'largo' },
  organizacional: { preinversion: 'largo', inversion: 'largo', operacion: 'largo' },
  financiero: { tasaDescuento: 'numero', flujos: [{ id: 'id', periodo: 'numero', descripcion: 'texto', ingresos: 'numero', egresos: 'numero' }], sensibilidad: 'largo' },
  interesados: { lista: [{ id: 'id', nombre: 'texto', tipo: ['interno', 'externo'], poder: OPCIONES_1_5, interes: OPCIONES_1_5, actitud: ['favor', 'neutral', 'contra'], expectativas: 'largo', mensajes: 'largo', canal: 'texto', frecuencia: 'texto', responsable: 'texto', riesgosAsociados: 'largo' }] },
  organigrama: { roles: [{ id: 'id', fase: FASE, rol: 'texto', persona: 'texto', reportaA: 'texto', nivel: ['estrategico', 'tactico', 'operativo'], funciones: 'largo' }] },
  raci: 'raci',
  transferencia: { areaReceptora: 'texto', responsableOperacion: 'texto', fechaEntrega: 'fecha', capacitaciones: 'largo', manuales: 'largo', ajustesProcesos: 'largo', mantenimiento: 'largo', gestionCambio: 'largo' },
  lecciones: { lista: [{ id: 'id', categoria: ['tecnica', 'administrativa', 'contractual', 'operativa'], tipo: ['plus', 'delta'], fase: FASE, situacion: 'largo', solucion: 'largo', recomendacion: 'largo' }] },
  actaCierre: { resultados: 'largo', cumplimientoObjetivos: 'largo', beneficiosLogrados: 'largo', contratos: 'largo', liberacionRecursos: 'largo', evaluacionDesempeno: 'largo', archivo: 'largo' },
};
const ADMITE_NO_APLICA = new Set(APARTADOS.filter(apartado => apartado.admiteNoAplica).map(apartado => apartado.id));

function normalizarConEsquema(esquema, valor, ctx, ruta) {
  if (Array.isArray(esquema) && esquema[0] === 'multi') return [...new Set((Array.isArray(valor) ? valor : []).filter(item => esquema.includes(item) && item !== 'multi'))];
  if (Array.isArray(esquema) && esquema.length === 1 && typeof esquema[0] === 'object') {
    return (Array.isArray(valor) ? valor : []).slice(0, 100).map((item, indice) => normalizarConEsquema(esquema[0], item, ctx, `${ruta} #${indice + 1}`));
  }
  if (Array.isArray(esquema)) {
    const opcion = esquema.find(item => String(item) === String(valor));
    return opcion === undefined ? '' : opcion;
  }
  if (esquema && typeof esquema === 'object') {
    return Object.fromEntries(Object.entries(esquema).map(([campo, tipo]) => [campo, normalizarConEsquema(tipo, valor?.[campo], ctx, `${ruta}.${campo}`)]));
  }
  if (esquema === 'id') return texto(valor, 80) || ctx.generarId();
  if (esquema === 'texto') return texto(valor);
  if (esquema === 'largo') return textoLargo(valor);
  if (esquema === 'bool') return valor === true;
  if (esquema === 'numero') {
    const numero = numeroONulo(valor);
    if (numero !== null && !Number.isFinite(numero)) rechazar(`El valor de "${ruta}" debe ser un número.`);
    return numero;
  }
  if (esquema === 'fecha') {
    if (valor && !esFecha(valor)) rechazar(`La fecha de "${ruta}" no es válida.`);
    return valor || '';
  }
  return null;
}

/** RACI: roles (cargos) y, por cada entregable o paquete de la EDT, la letra de cada rol. */
function normalizarRaci(valor, plan) {
  const roles = [...new Set((Array.isArray(valor?.roles) ? valor.roles : []).map(rol => texto(rol, 80)).filter(Boolean))].slice(0, 30);
  const elementos = new Set(elementosRaci(plan).map(elemento => elemento.id));
  const filas = Object.fromEntries(Object.entries(valor?.filas || {}).filter(([id]) => elementos.has(id)).map(([id, fila]) => [id,
    Object.fromEntries(Object.entries(fila || {}).filter(([rol, letra]) => roles.includes(rol) && ['R', 'A', 'C', 'I'].includes(letra)))]));
  return { roles, filas };
}

function guardarSeccion(proyecto, plan, datos, ctx, cap) {
  const seccion = datos.seccion;
  const esquema = ESQUEMAS_SECCION[seccion];
  if (!esquema) rechazar('El apartado no existe.');
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador diligencia los apartados de la metodología.');
  const anterior = plan.secciones?.[seccion] || null;
  if (anterior?.version && datos.versionBase !== anterior.version) {
    rechazar(`${anterior.actualizadoPor || 'Otra persona'} modificó este apartado mientras lo editabas. Recarga para ver sus cambios y vuelve a guardar.`, 409);
  }
  const contenido = esquema === 'raci' ? normalizarRaci(datos.datos, plan) : normalizarConEsquema(esquema, datos.datos || {}, ctx, seccion);
  if (ADMITE_NO_APLICA.has(seccion) && datos.datos?.noAplica) {
    const justificacion = textoLargo(datos.datos.noAplica.justificacion);
    if (justificacion.length < 10) rechazar('Para marcar el apartado como "No aplica" escribe una justificación (al menos 10 caracteres).');
    contenido.noAplica = { justificacion, por: ctx.usuario.email, fecha: ctx.ahora };
  }
  const nueva = { datos: contenido, version: ctx.generarId(), actualizadoPor: ctx.usuario.email, actualizadoEn: ctx.ahora };
  const cambio = diferencias({ datos: anterior?.datos || null }, { datos: contenido }, ['datos']);
  if (!cambio) return { proyecto, plan, eventos: [] };
  // Las lecciones se copian, resumidas, al documento del proyecto para la base corporativa de consulta.
  const leccionesBase = seccion === 'lecciones'
    ? contenido.lista.filter(leccion => leccion.situacion).map(leccion => ({ categoria: leccion.categoria, tipo: leccion.tipo, fase: leccion.fase, situacion: leccion.situacion.slice(0, 400), recomendacion: leccion.recomendacion.slice(0, 400) })).slice(0, 50)
    : proyecto.leccionesBase;
  return {
    proyecto: { ...proyecto, ...(seccion === 'lecciones' ? { leccionesBase } : {}) },
    plan: { ...plan, secciones: { ...(plan.secciones || {}), [seccion]: nueva } },
    eventos: [evento('guardar-apartado', 'apartado', seccion, recortarHistorial(cambio))],
  };
}

function subirDocumento(proyecto, plan, datos, ctx, cap) {
  const documento = DOCUMENTO[datos.idDocumento];
  if (!documento) rechazar('El documento no existe en la metodología.');
  exigir(cap.aportar, 'Solo el equipo del proyecto carga documentos.');
  const url = enlace(datos.archivo?.url);
  if (!url) rechazar('Falta el enlace del archivo cargado en el repositorio de Termales.');
  const registro = plan.documentos?.[documento.id] || { versiones: [], noAplica: null };
  const version = { version: registro.versiones.length + 1, url, nombre: texto(datos.archivo?.nombre), por: ctx.usuario.email, fecha: ctx.ahora };
  return {
    proyecto,
    plan: { ...plan, documentos: { ...(plan.documentos || {}), [documento.id]: { ...registro, versiones: [...registro.versiones, version], noAplica: null } } },
    eventos: [evento('cargar-documento', 'documento', documento.nombre, { despues: { version: version.version, archivo: version.nombre } })],
  };
}

function marcarDocumento(proyecto, plan, datos, ctx, cap) {
  const documento = DOCUMENTO[datos.idDocumento];
  if (!documento) rechazar('El documento no existe en la metodología.');
  exigir(cap.gestionar, 'Solo el director del proyecto o un administrador marcan un documento como "No aplica".');
  const registro = plan.documentos?.[documento.id] || { versiones: [], noAplica: null };
  const justificacion = textoLargo(datos.justificacion);
  if (datos.noAplica !== false && justificacion.length < 10) rechazar('Justifica por qué el documento no aplica (al menos 10 caracteres).');
  const noAplica = datos.noAplica === false ? null : { justificacion, por: ctx.usuario.email, fecha: ctx.ahora };
  return {
    proyecto,
    plan: { ...plan, documentos: { ...(plan.documentos || {}), [documento.id]: { ...registro, noAplica } } },
    eventos: [evento(noAplica ? 'documento-no-aplica' : 'documento-aplica', 'documento', documento.nombre, { motivo: justificacion })],
  };
}

// ---------------------------------------------------------------------------------------------------------

const ACCIONES = {
  editarFicha, solicitarEstado, decidirEstado, explicarEstado, archivar, guardarSeccion, subirDocumento, marcarDocumento,
  guardarTarea, revisarTarea, comentarTarea, establecerLineaBase, guardarSprint,
  guardarEntregable, presentarEntregable, decidirEntregable,
  guardarRiesgo, guardarCambio, decidirCambio,
  guardarReunion, actualizarCompromiso,
  registrarCosto, anularCosto, estimarCostoFinal,
};
export const NOMBRES_ACCIONES = Object.keys(ACCIONES);

/**
 * Aplica `accion` y devuelve { proyecto, plan, eventos, respuesta } con el resumen recalculado.
 * ctx: { usuario: { email, rol, permisos }, ahora (ISO), hoy (AAAA-MM-DD), generarId }.
 */
export function aplicarAccion(proyecto, plan, accion, datos, ctx) {
  const operacion = ACCIONES[accion];
  if (!operacion) rechazar('Operación no reconocida.');
  exigir(accesoModulo(ctx.usuario), 'No tienes acceso al módulo de Gestión de proyectos.');
  const cap = capacidades(ctx.usuario, proyecto);
  // Sin acceso al proyecto se responde 404: no se confirma que exista.
  if (!cap.ver) rechazar('El proyecto no existe o no tienes acceso.', 404);
  if (proyecto.archivado && accion !== 'archivar') rechazar('El proyecto está archivado: es de solo consulta.');
  const resultado = operacion(proyecto, { ...plan }, datos || {}, ctx, cap);
  const huboCambios = resultado.eventos.length > 0;
  const proyectoFinal = huboCambios
    ? { ...resultado.proyecto, version: ctx.generarId(), actualizadoPor: ctx.usuario.email, actualizadoEn: ctx.ahora, resumen: compactarPlan(resultado.plan, resultado.proyecto.ficha?.calendario) }
    : resultado.proyecto;
  if (huboCambios && Buffer.byteLength(JSON.stringify(resultado.plan)) > TAMANO_MAXIMO_PLAN) {
    rechazar('El proyecto alcanzó el tamaño máximo de almacenamiento. Divide el trabajo en otro proyecto o pide al administrador que archive registros antiguos.', 413);
  }
  return { ...resultado, proyecto: proyectoFinal, huboCambios };
}
