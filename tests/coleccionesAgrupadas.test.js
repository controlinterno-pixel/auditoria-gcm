// tests/coleccionesAgrupadas.test.js - Etapa 1 de la agrupación (lectura doble) con un Firestore en memoria.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fuente = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  .replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');
const codigo = `${fuente('../api/_lib/coleccionesAgrupadas.js')}\n${fuente('../api/_lib/grcWorkspace.js')}
return { leerWorkspaceGrc, leerWorkspaceGrcLigero, obtenerPlanesTx, obtenerHallazgosTx, obtenerPlanesDeInformeTx,
  listarHallazgosTx, reservarIdsPlanesTx, guardarPlanesGrc, guardarWorkspaceParcial, parteDeRegistro };`;

// Firestore mínimo: documentos por ruta, consultas `in` y contador de lecturas facturables.
function crearDb(documentos) {
  const datos = new Map(Object.entries(documentos));
  const db = { lecturas: 0 };
  const padre = ruta => ruta.slice(0, ruta.lastIndexOf('/'));
  const snapshot = ruta => {
    const valor = datos.get(ruta);
    return { id: ruta.split('/').pop(), exists: valor !== undefined, data: () => structuredClone(valor), get: campo => valor?.[campo], ref: docRef(ruta) };
  };
  const consulta = (ruta, filtro) => ({
    get: async () => {
      const docs = [...datos.keys()].filter(clave => padre(clave) === ruta).sort().map(snapshot)
        .filter(doc => !filtro || filtro.valores.includes(doc.data()[filtro.campo]));
      db.lecturas += docs.length;
      return { size: docs.length, docs };
    },
  });
  function docRef(ruta) {
    return {
      id: ruta.split('/').pop(), path: ruta,
      get: async () => { db.lecturas += 1; return snapshot(ruta); },
      collection: nombre => colRef(`${ruta}/${nombre}`),
    };
  }
  function colRef(ruta) {
    return { id: ruta.split('/').pop(), path: ruta, doc: id => docRef(`${ruta}/${id}`), ...consulta(ruta), where: (campo, _op, valores) => consulta(ruta, { campo, valores }) };
  }
  db.collection = colRef;
  db.transaccion = () => ({ get: referencia => referencia.get(), set() { throw new Error('sin escrituras en esta prueba'); } });
  return db;
}

const cargar = db => new Function('adminDb', 'FieldValue', 'Filter', 'logger', codigo)(
  db, { delete: () => '__borrar__' }, { or: () => ({}), where: () => ({}) }, { info() {}, warn() {}, error() {} },
);

const RAIZ = 'workspace_compartido/base_de_datos_grc';
const plan = (id, extra = {}) => ({ id, accion: `Plan ${id}`, ...extra });
const subcolecciones = {
  [`${RAIZ}/planes_accion/10`]: plan(10, { idHallazgo: 'H1', idInforme: 'I1' }),
  [`${RAIZ}/planes_accion/2`]: plan(2, { idHallazgo: 'H2' }),
  [`${RAIZ}/hallazgos/H1`]: { titulo: 'Hallazgo 1', idInforme: 'I1' },
  [`${RAIZ}/hallazgos/H2`]: { titulo: 'Hallazgo 2', idInforme: 'I2' },
  [`${RAIZ}/informes/I1`]: { titulo: 'Informe 1', macroproceso: 'Finanzas' },
  [`${RAIZ}/informes/I2`]: { titulo: 'Informe 2', macroprocesos: ['Talento'] },
};
// Las mismas colecciones agrupadas, con una versión más nueva del plan 10 para distinguir el origen.
const registros = ruta => Object.fromEntries(Object.entries(subcolecciones)
  .filter(([clave]) => clave.startsWith(`${RAIZ}/${ruta}/`))
  .map(([clave, valor]) => [clave.split('/').pop(), valor]));
const grupos = (indice = { planes: { version: 1, partes: 1 }, hallazgos: { version: 1, partes: 1 }, informes: { version: 1, partes: 1 } }) => ({
  [RAIZ]: { catalogoCargos: [], coleccionesAgrupadas: indice },
  'workspace_compartido/base_de_datos_grc_grupo_planes_0': { registros: { ...registros('planes_accion'), 10: plan(10, { idHallazgo: 'H1', idInforme: 'I1', progreso: 90 }) } },
  'workspace_compartido/base_de_datos_grc_grupo_hallazgos_0': { registros: registros('hallazgos') },
  'workspace_compartido/base_de_datos_grc_grupo_informes_0': { registros: registros('informes') },
});

test('sin índice: se lee igual que antes (subcolecciones) y sin lecturas extra', async () => {
  const db = crearDb({ [RAIZ]: { catalogoCargos: [] }, ...subcolecciones });
  const { data } = await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' });
  assert.equal(db.lecturas, 2 + 6, 'documento principal + informes legados + 6 documentos');
  assert.deepEqual(data.planes.map(registro => registro.id), [10, 2], 'orden por ID de documento ("10" < "2")');
  assert.equal(data.hallazgos.length, 2);
  assert.equal(data.informesAuditoria.length, 2);
});

test('con índice: lee las partes (no las subcolecciones) con el mismo formato y orden', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos() });
  const { data } = await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' });
  assert.equal(db.lecturas, 2 + 3, 'documento principal + informes legados + una parte por colección');
  assert.deepEqual(data.planes.map(registro => registro.id), [10, 2]);
  assert.equal(data.planes[0].progreso, 90, 'los datos vienen de la parte agrupada');
  assert.deepEqual(data.hallazgos.map(registro => registro.id), ['H1', 'H2'], 'sin campo id se usa la clave');
  assert.equal(data.coleccionesAgrupadas, undefined, 'el índice nunca se entrega al cliente');
  assert.deepEqual(data.planesAccion, data.planes);
});

test('se puede agrupar una colección a la vez', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos({ informes: { version: 1, partes: 1 } }) });
  const { data } = await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' });
  assert.equal(db.lecturas, 2 + 1 + 4, 'informes agrupados; planes y hallazgos desde sus subcolecciones');
  assert.equal(data.planes[0].progreso, undefined);
});

test('informes por proceso: mismo criterio que las consultas de Firestore', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos() });
  const { data } = await cargar(db).leerWorkspaceGrc(null, { procesosAsignados: [' Talento '], origen: 'prueba' });
  assert.deepEqual(data.informesAuditoria.map(informe => informe.id), ['I2']);
});

test('una parte faltante detiene la lectura (nunca datos viejos o incompletos)', async () => {
  const documentos = { ...subcolecciones, ...grupos({ planes: { version: 1, partes: 2 } }) };
  const db = crearDb(documentos);
  await assert.rejects(cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' }), /falta la parte 1 de planes/);
});

test('transacciones: cada parte se lee una sola vez y los filtros equivalen a las consultas `in`', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos() });
  const modulo = cargar(db);
  const transaccion = db.transaccion();
  const workspace = await modulo.leerWorkspaceGrcLigero(transaccion, { origen: 'prueba-tx' });
  assert.equal(db.lecturas, 2);
  const [plan10, inexistente, plan2] = await modulo.obtenerPlanesTx(transaccion, workspace, [10, 'nada', '2']);
  assert.equal(plan10.progreso, 90);
  assert.equal(inexistente, null);
  assert.equal(plan2.id, 2);
  const hallazgos = await modulo.obtenerHallazgosTx(transaccion, workspace, ['H1', 'H9']);
  assert.deepEqual([...hallazgos.keys()], ['H1']);
  const delInforme = await modulo.obtenerPlanesDeInformeTx(transaccion, workspace, 'I1');
  assert.deepEqual(delInforme.planes.map(registro => registro.id), [10]);
  assert.deepEqual(delInforme.hallazgos.map(registro => registro.id), ['H1']);
  assert.equal((await modulo.listarHallazgosTx(transaccion, workspace)).length, 2);
  assert.equal(db.lecturas, 2 + 2, 'una lectura de planes y una de hallazgos para toda la transacción');
});

test('reservar IDs con planes agrupados no consulta cada candidato y evita IDs ocupados', async () => {
  const ocupado = Date.now() + 1000;
  const documentos = grupos();
  documentos['workspace_compartido/base_de_datos_grc_grupo_planes_0'].registros[ocupado] = plan(ocupado);
  const db = crearDb(documentos);
  const modulo = cargar(db);
  const transaccion = db.transaccion();
  const workspace = await modulo.leerWorkspaceGrcLigero(transaccion, { origen: 'prueba-tx' });
  const ids = await modulo.reservarIdsPlanesTx(transaccion, workspace, 3);
  assert.equal(new Set(ids).size, 3);
  assert.equal(db.lecturas, 2 + 1);
});

test('sin índice, las transacciones siguen leyendo documento por documento', async () => {
  const db = crearDb({ [RAIZ]: {}, ...subcolecciones });
  const modulo = cargar(db);
  const transaccion = db.transaccion();
  const workspace = await modulo.leerWorkspaceGrcLigero(transaccion, { origen: 'prueba-tx' });
  const [plan10] = await modulo.obtenerPlanesTx(transaccion, workspace, ['10']);
  assert.equal(plan10.accion, 'Plan 10');
  const delInforme = await modulo.obtenerPlanesDeInformeTx(transaccion, workspace, 'I1');
  assert.deepEqual(delInforme.planes.map(registro => registro.id), [10]);
  assert.equal(db.lecturas, 2 + 1 + 1 + 1 + 1, 'plan por ID + hallazgos del informe + planes del informe + planes del hallazgo');
});

test('mientras no existan las escrituras sobre partes, una colección agrupada no admite escrituras', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos({ planes: { version: 1, partes: 1 } }) });
  const modulo = cargar(db);
  const transaccion = db.transaccion();
  const workspace = await modulo.leerWorkspaceGrcLigero(transaccion, { origen: 'prueba-tx' });
  assert.throws(() => modulo.guardarPlanesGrc(transaccion, workspace, [plan(10)]), /agrupada/);
  await assert.rejects(modulo.guardarWorkspaceParcial({ planes: [plan(10)] }), /agrupada/);
  await assert.rejects(modulo.guardarWorkspaceParcial({ coleccionesAgrupadas: {} }), /solo lo administra/);
});

test('la parte de cada registro es estable', () => {
  const { parteDeRegistro } = cargar(crearDb({}));
  assert.equal(parteDeRegistro('1712345678901', 3), parteDeRegistro(String(1712345678901), 3));
  assert.ok([...Array(50).keys()].every(id => parteDeRegistro(id, 4) < 4));
});
