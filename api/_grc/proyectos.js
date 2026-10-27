// api/grc/proyectos.js - Gestión de proyectos: portafolio, detalle, historial y operaciones.
// Datos: proyectos/{id} (ficha, miembros, estado y resumen para el tablero), proyectos/{id}/detalle/plan
// (tareas, entregables, riesgos, cambios, reuniones, costos, sprints, líneas base) y proyectos/{id}/historial
// (solo lo escribe este endpoint). Las reglas de Firestore ya bloquean todo acceso directo desde el navegador.
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { applyCors } from '../_lib/cors.js';
import { requireAuth } from '../_lib/authMiddleware.js';
import { sendSuccess, sendError } from '../_lib/responseHelper.js';
import { logger } from '../_lib/logger.js';
import { parametrosConsulta } from '../_lib/seguridad.js';
import { puedeVerTodo } from '../_lib/roles.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import { ErrorProyecto, NOMBRES_ACCIONES, accesoModulo, aplicarAccion, capacidades, crearProyecto } from '../_lib/proyectosAcciones.js';
import { compactarPlan } from '../../src/utils/proyectos/indicadores.js';
import { hoyColombia } from '../../src/utils/proyectos/fechas.js';
import { codigoEstrategico } from '../../src/utils/proyectos/metodologia.js';

const coleccion = () => adminDb.collection('proyectos');
const refPlan = idProyecto => coleccion().doc(idProyecto).collection('detalle').doc('plan');
const refHistorial = idProyecto => coleccion().doc(idProyecto).collection('historial');
// Campos del portafolio: el tablero no descarga ni el plan ni el historial.
const CAMPOS_PORTAFOLIO = ['codigo', 'codigoEstrategico', 'ficha', 'miembros', 'estado', 'estadoAntesSuspension', 'presupuestoVigente', 'configuracion', 'resumen',
  'explicacionEstado', 'solicitudesEstado', 'archivado', 'actualizadoEn', 'actualizadoPor', 'creadoEn'];
const PAGINA_HISTORIAL = 50;
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

// Firestore rechaza `undefined`: se escribe la versión serializada.
const limpiar = valor => JSON.parse(JSON.stringify(valor));
const contexto = usuario => {
  const ahora = new Date();
  return { usuario, ahora: ahora.toISOString(), hoy: hoyColombia(ahora), generarId: randomUUID };
};
const entradaHistorial = (evento, usuario) => limpiar({
  ...evento,
  usuario: usuario.email,
  nombreUsuario: usuario.nombreResponsable || '',
  fechaIso: new Date().toISOString(),
});

async function listar(usuario, incluirArchivados) {
  const consulta = puedeVerTodo(usuario.rol)
    ? coleccion()
    : coleccion().where('correosAcceso', 'array-contains', String(usuario.email).toLowerCase());
  const snapshot = await consulta.select(...CAMPOS_PORTAFOLIO).get();
  logger.info('[FS-READS]', { origen: 'proyectos-portafolio', documentos: snapshot.size });
  return snapshot.docs
    .map(documento => ({ id: documento.id, ...documento.data() }))
    .filter(proyecto => incluirArchivados || !proyecto.archivado)
    .map(proyecto => ({ ...proyecto, capacidades: capacidades(usuario, proyecto) }));
}

async function detalle(usuario, id) {
  const [snapshotProyecto, snapshotPlan] = await Promise.all([coleccion().doc(id).get(), refPlan(id).get()]);
  logger.info('[FS-READS]', { origen: 'proyectos-detalle', documentos: 2 });
  const proyecto = snapshotProyecto.exists ? { id, ...snapshotProyecto.data() } : null;
  if (!proyecto || !capacidades(usuario, proyecto).ver) throw new ErrorProyecto('El proyecto no existe o no tienes acceso.', 404);
  return { proyecto: { ...proyecto, capacidades: capacidades(usuario, proyecto) }, plan: snapshotPlan.exists ? snapshotPlan.data() : {} };
}

async function historial(usuario, id, despuesDe) {
  const snapshotProyecto = await coleccion().doc(id).get();
  const proyecto = snapshotProyecto.exists ? snapshotProyecto.data() : null;
  if (!proyecto || !capacidades(usuario, proyecto).ver) throw new ErrorProyecto('El proyecto no existe o no tienes acceso.', 404);
  let consulta = refHistorial(id).orderBy('fecha', 'desc').limit(PAGINA_HISTORIAL);
  if (despuesDe && ID_VALIDO.test(despuesDe)) {
    const cursor = await refHistorial(id).doc(despuesDe).get();
    if (cursor.exists) consulta = consulta.startAfter(cursor);
  }
  const snapshot = await consulta.get();
  logger.info('[FS-READS]', { origen: 'proyectos-historial', documentos: snapshot.size + 1 });
  const eventos = snapshot.docs.map(documento => {
    const datos = documento.data();
    return { id: documento.id, ...datos, fecha: datos.fecha?.toDate?.().toISOString() || datos.fechaIso || '' };
  });
  return { eventos, siguiente: snapshot.size === PAGINA_HISTORIAL ? snapshot.docs.at(-1).id : null };
}

/** Base corporativa de lecciones aprendidas (manual 4.2.2): todas las lecciones de todos los proyectos. */
async function leccionesAprendidas() {
  const snapshot = await coleccion().select('codigo', 'codigoEstrategico', 'ficha.nombre', 'ficha.area', 'leccionesBase').get();
  logger.info('[FS-READS]', { origen: 'proyectos-lecciones', documentos: snapshot.size });
  return snapshot.docs.flatMap(documento => {
    const datos = documento.data();
    return (datos.leccionesBase || []).map(leccion => ({ ...leccion, codigo: datos.codigoEstrategico || datos.codigo, proyecto: datos.ficha?.nombre || '', area: datos.ficha?.area || '' }));
  });
}

/** El código del portafolio (E1_SP1_PY1) identifica un solo proyecto. */
async function verificarCodigoUnico(ficha, idProyecto = '') {
  const codigo = codigoEstrategico(ficha || {});
  if (!codigo) return;
  const snapshot = await coleccion().where('codigoEstrategico', '==', codigo).limit(2).get();
  const otro = snapshot.docs.find(documento => documento.id !== idProyecto);
  if (otro) throw new ErrorProyecto(`El código ${codigo} ya lo usa el proyecto ${otro.get('codigo')} (${otro.get('ficha')?.nombre || 'sin nombre'}).`, 409);
}

async function crear(usuario, datos) {
  const ctx = contexto(usuario);
  const anio = ctx.hoy.slice(0, 4);
  const refContador = adminDb.collection('_grc_counters').doc(`proyectos_${anio}`);
  const refProyecto = coleccion().doc();
  return adminDb.runTransaction(async transaccion => {
    const contador = await transaccion.get(refContador);
    const siguiente = (Number(contador.exists ? contador.get('ultimo') : 0) || 0) + 1;
    const codigo = `PRY-${anio}-${String(siguiente).padStart(3, '0')}`;
    const { proyecto, plan, eventos } = crearProyecto(datos, { ...ctx, codigo });
    const conResumen = { ...proyecto, resumen: compactarPlan(plan, proyecto.ficha.calendario) };
    transaccion.set(refContador, { ultimo: siguiente, actualizadoEn: ctx.ahora }, { merge: true });
    transaccion.set(refProyecto, limpiar(conResumen));
    transaccion.set(refPlan(refProyecto.id), limpiar(plan));
    eventos.forEach(evento => transaccion.set(refHistorial(refProyecto.id).doc(), { ...entradaHistorial(evento, usuario), fecha: FieldValue.serverTimestamp() }));
    return { proyecto: { id: refProyecto.id, ...conResumen, capacidades: capacidades(usuario, conResumen) }, plan };
  });
}

async function operar(usuario, idProyecto, accion, datos) {
  const ctx = contexto(usuario);
  const refProyecto = coleccion().doc(idProyecto);
  return adminDb.runTransaction(async transaccion => {
    const [snapshotProyecto, snapshotPlan] = await Promise.all([transaccion.get(refProyecto), transaccion.get(refPlan(idProyecto))]);
    if (!snapshotProyecto.exists) throw new ErrorProyecto('El proyecto no existe o no tienes acceso.', 404);
    const resultado = aplicarAccion(snapshotProyecto.data(), snapshotPlan.exists ? snapshotPlan.data() : {}, accion, datos, ctx);
    if (resultado.huboCambios) {
      transaccion.set(refProyecto, limpiar(resultado.proyecto));
      transaccion.set(refPlan(idProyecto), limpiar(resultado.plan));
      resultado.eventos.forEach(evento => transaccion.set(refHistorial(idProyecto).doc(), { ...entradaHistorial(evento, usuario), fecha: FieldValue.serverTimestamp() }));
    }
    return {
      proyecto: { id: idProyecto, ...resultado.proyecto, capacidades: capacidades(usuario, resultado.proyecto) },
      plan: resultado.plan,
      respuesta: resultado.respuesta || null,
    };
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST') return sendError(res, 'Método no permitido.', 405);

  const usuario = await requireAuth(req, res);
  if (!usuario) return;
  if (!accesoModulo(usuario)) return sendError(res, 'No tienes acceso al módulo de Gestión de proyectos.', 403);

  try {
    if (req.method === 'GET') {
      const { id, historial: verHistorial, despuesDe, archivados } = parametrosConsulta(req);
      if (id && !ID_VALIDO.test(String(id))) return sendError(res, 'Identificador de proyecto no válido.', 400);
      if (parametrosConsulta(req).lecciones === '1') return sendSuccess(res, { lecciones: await leccionesAprendidas() });
      if (id && verHistorial) return sendSuccess(res, await historial(usuario, String(id), String(despuesDe || '')));
      if (id) return sendSuccess(res, await detalle(usuario, String(id)));
      return sendSuccess(res, { proyectos: await listar(usuario, archivados === '1'), hoy: hoyColombia() });
    }

    const { accion, idProyecto, datos } = req.body || {};
    if (accion === 'crear') {
      await verificarCodigoUnico(datos?.ficha);
      return sendSuccess(res, await crear(usuario, datos || {}), 201);
    }
    if (!NOMBRES_ACCIONES.includes(accion)) return sendError(res, 'Operación no reconocida.', 400);
    if (!ID_VALIDO.test(String(idProyecto || ''))) return sendError(res, 'Identificador de proyecto no válido.', 400);
    if (accion === 'editarFicha') await verificarCodigoUnico(datos?.ficha, String(idProyecto));
    return sendSuccess(res, await operar(usuario, String(idProyecto), accion, datos || {}));
  } catch (error) {
    if (error instanceof ErrorProyecto) {
      if (error.status === 403 || error.status === 404) {
        logger.warn('[PROYECTOS] Operación rechazada', { usuario: usuario.email, accion: req.body?.accion || 'consulta', status: error.status });
      }
      return sendError(res, error.message, error.status);
    }
    logger.error('[PROYECTOS] Error no controlado', error, { accion: req.body?.accion || 'consulta' });
    return sendError(res, 'No se pudo completar la operación del proyecto. Intenta de nuevo; si persiste, avisa al administrador.', 500);
  }
}
