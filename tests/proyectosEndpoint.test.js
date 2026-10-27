// tests/proyectosEndpoint.test.js - El endpoint /api/grc/proyectos de punta a punta sobre un Firestore en
// memoria: persistencia, portafolio filtrado por miembro, detalle, historial, acceso cruzado y conflictos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as acciones from '../api/_lib/proyectosAcciones.js';
import { compactarPlan } from '../src/utils/proyectos/indicadores.js';
import { hoyColombia } from '../src/utils/proyectos/fechas.js';
import { puedeVerTodo } from '../api/_lib/roles.js';

// ---- Firestore mínimo en memoria (lo que usa el endpoint) ----
// Copia profunda que conserva las marcas de tiempo del servidor (objetos con toDate).
const copiar = valor => (valor && typeof valor === 'object'
  ? (typeof valor.toDate === 'function' ? valor : Array.isArray(valor) ? valor.map(copiar) : Object.fromEntries(Object.entries(valor).map(([clave, dato]) => [clave, copiar(dato)])))
  : valor);

function crearDb() {
  const datos = new Map();
  let secuencia = 0;
  const snapshot = (ruta, valor) => ({ id: ruta.split('/').at(-1), exists: valor !== undefined, data: () => (valor === undefined ? undefined : copiar(valor)), get: campo => valor?.[campo], ruta });
  const docRef = ruta => ({
    id: ruta.split('/').at(-1), ruta,
    get: async () => snapshot(ruta, datos.get(ruta)),
    collection: nombre => colRef(`${ruta}/${nombre}`),
  });
  const consulta = (ruta, filtros = [], orden = null, limite = Infinity, despues = null) => ({
    where: (campo, op, valor) => consulta(ruta, [...filtros, { campo, op, valor }], orden, limite, despues),
    select: () => consulta(ruta, filtros, orden, limite, despues),
    orderBy: (campo, direccion) => consulta(ruta, filtros, { campo, direccion }, limite, despues),
    limit: n => consulta(ruta, filtros, orden, n, despues),
    startAfter: cursor => consulta(ruta, filtros, orden, limite, cursor),
    get: async () => {
      let docs = [...datos.entries()].filter(([clave]) => clave.startsWith(`${ruta}/`) && !clave.slice(ruta.length + 1).includes('/'))
        .map(([clave, valor]) => snapshot(clave, valor))
        .filter(doc => filtros.every(({ campo, op, valor }) => op === 'array-contains' && (doc.data()[campo] || []).includes(valor)));
      if (orden) docs.sort((a, b) => (a.data()[orden.campo].orden - b.data()[orden.campo].orden) * (orden.direccion === 'desc' ? -1 : 1));
      if (despues) docs = docs.slice(docs.findIndex(doc => doc.ruta === despues.ruta) + 1);
      docs = docs.slice(0, limite);
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const colRef = ruta => ({ ...consulta(ruta), doc: id => docRef(`${ruta}/${id || `auto${++secuencia}`}`) });
  return {
    datos,
    collection: colRef,
    runTransaction: async funcion => {
      const escrituras = [];
      const resultado = await funcion({ get: ref => ref.get(), set: (ref, valor) => escrituras.push([ref.ruta, valor]) });
      escrituras.forEach(([ruta, valor]) => datos.set(ruta, copiar(valor)));
      return resultado;
    },
  };
}

let reloj = 0;
const FieldValue = { serverTimestamp: () => ({ orden: ++reloj, toDate: () => new Date(Date.UTC(2026, 0, 1) + reloj * 1000) }) };

function cargarHandler(db, usuarios) {
  const fuente = readFileSync(new URL('../api/_grc/proyectos.js', import.meta.url), 'utf8')
    .replace(/^import [\s\S]*?;\r?\n/gm, '')
    .replace('export default async function handler', 'async function handler');
  const enlaces = {
    randomUUID, FieldValue, applyCors: () => false,
    requireAuth: async req => usuarios[req.headers.usuario] || null,
    sendSuccess: (res, data = {}, status = 200) => res.status(status).json({ success: true, ...data }),
    sendError: (res, mensaje, status = 500) => res.status(status).json({ success: false, error: mensaje }),
    logger: { info() {}, warn() {}, error: (mensaje, error) => { if (process.env.DEPURAR) console.error(mensaje, error); } },
    parametrosConsulta: req => req.query || {},
    puedeVerTodo, adminDb: db, ...acciones, compactarPlan, hoyColombia,
  };
  // FieldValue también se usa desde el objeto (FieldValue.serverTimestamp()).
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(enlaces), `${fuente}\nreturn handler;`)(...Object.values(enlaces));
}

const usuario = (email, extra = {}) => ({ email: `${email}@termales.com.co`, rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'], nombreResponsable: email, ...extra });
const USUARIOS = { director: usuario('director'), patrocinador: usuario('patrocinador'), ajeno: usuario('ajeno'), admin: usuario('admin', { rol: 'admin' }), sinPermiso: usuario('sinpermiso', { permisos: [] }) };

async function llamar(handler, quien, { method = 'GET', query, body } = {}) {
  let status = 0;
  let json = null;
  const res = { status(codigo) { status = codigo; return this; }, json(valor) { json = valor; return this; }, setHeader() {} };
  await handler({ method, query, body, headers: { usuario: quien } }, res);
  return { status, json };
}

test('crear, listar solo para miembros, consultar detalle e historial, y conflictos', async () => {
  const db = crearDb();
  const handler = cargarHandler(db, USUARIOS);
  const creado = await llamar(handler, 'director', { method: 'POST', body: { accion: 'crear', datos: {
    ficha: { nombre: 'Portal de proveedores', objetivoGeneral: 'Digitalizar compras', metodologia: 'hibrida', prioridad: 'alta', inicioPlanificado: '2026-02-01', finPlanificado: '2026-08-31' },
    miembros: { patrocinador: USUARIOS.patrocinador.email },
  } } });
  assert.equal(creado.status, 201, JSON.stringify(creado.json));
  const id = creado.json.proyecto.id;
  assert.match(creado.json.proyecto.codigo, /^PRY-\d{4}-001$/);
  assert.equal(creado.json.proyecto.capacidades.gestionar, true);

  // Persistencia: proyecto, plan, historial y consecutivo quedan escritos.
  const rutas = [...db.datos.keys()];
  assert.ok(rutas.includes(`proyectos/${id}`));
  assert.ok(rutas.includes(`proyectos/${id}/detalle/plan`));
  assert.ok(rutas.some(ruta => ruta.startsWith(`proyectos/${id}/historial/`)));
  assert.ok(rutas.some(ruta => ruta.startsWith('_grc_counters/proyectos_')));

  // Portafolio: el patrocinador lo ve; un ajeno no; el administrador ve todos.
  assert.equal((await llamar(handler, 'patrocinador')).json.proyectos.length, 1);
  assert.equal((await llamar(handler, 'ajeno')).json.proyectos.length, 0);
  assert.equal((await llamar(handler, 'admin')).json.proyectos.length, 1);
  assert.equal((await llamar(handler, 'sinPermiso')).status, 403);
  const enPortafolio = (await llamar(handler, 'patrocinador')).json.proyectos[0];
  assert.equal(enPortafolio.capacidades.autorizarEstado, true);

  // Acceso cruzado: el detalle y las operaciones de un ajeno dan 404.
  assert.equal((await llamar(handler, 'ajeno', { query: { id } })).status, 404);
  assert.equal((await llamar(handler, 'ajeno', { method: 'POST', body: { accion: 'guardarTarea', idProyecto: id, datos: { tarea: { titulo: 'x' } } } })).status, 404);
  assert.equal((await llamar(handler, 'director', { query: { id: '../usuarios' } })).status, 400, 'no se aceptan rutas arbitrarias');

  // Operación + lectura posterior (los datos permanecen).
  const tarea = await llamar(handler, 'director', { method: 'POST', body: { accion: 'guardarTarea', idProyecto: id, datos: { tarea: {
    titulo: 'Diseño', tipo: 'actividad', prioridad: 'media', estado: 'pendiente', avance: 0, inicio: '2026-02-02', fin: '2026-02-13',
  } } } });
  assert.equal(tarea.status, 200, JSON.stringify(tarea.json));
  const detalle = await llamar(handler, 'patrocinador', { query: { id } });
  assert.equal(detalle.json.plan.tareas.length, 1);
  assert.equal(detalle.json.proyecto.resumen.tareas.length, 1, 'el resumen del tablero se recalcula al guardar');
  assert.equal(detalle.json.proyecto.capacidades.gestionar, false, 'el patrocinador no gestiona');

  // Conflicto: guardar con una versión vieja responde 409 y no escribe.
  const version = detalle.json.plan.tareas[0].version;
  await llamar(handler, 'director', { method: 'POST', body: { accion: 'guardarTarea', idProyecto: id, datos: { tarea: { id: detalle.json.plan.tareas[0].id, versionBase: version, titulo: 'Diseño funcional' } } } });
  const conflicto = await llamar(handler, 'director', { method: 'POST', body: { accion: 'guardarTarea', idProyecto: id, datos: { tarea: { id: detalle.json.plan.tareas[0].id, versionBase: version, titulo: 'Otro' } } } });
  assert.equal(conflicto.status, 409);
  assert.equal((await llamar(handler, 'director', { query: { id } })).json.plan.tareas[0].titulo, 'Diseño funcional');

  // Historial: más reciente primero, con usuario y sin campos sensibles.
  const historial = await llamar(handler, 'patrocinador', { query: { id, historial: '1' } });
  assert.deepEqual(historial.json.eventos.map(evento => evento.accion), ['editar-tarea', 'crear-tarea', 'crear']);
  assert.equal(historial.json.eventos[0].usuario, USUARIOS.director.email);
  assert.ok(historial.json.eventos[0].antes.titulo === 'Diseño' && historial.json.eventos[0].despues.titulo === 'Diseño funcional');

  // Operación desconocida.
  assert.equal((await llamar(handler, 'director', { method: 'POST', body: { accion: 'borrarTodo', idProyecto: id } })).status, 400);
});
