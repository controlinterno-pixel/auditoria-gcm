// tests/coleccionesAgrupadas.test.js - Agrupación de planes, hallazgos e informes con un Firestore en memoria:
// etapa 1 (lectura doble), etapa 2 (copia) y etapa 3 (escrituras sobre partes).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fuente = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  .replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');
const codigo = `${fuente('../api/_lib/coleccionesAgrupadas.js')}\n${fuente('../api/_lib/grcWorkspace.js')}
return { leerWorkspaceGrc, leerWorkspaceGrcLigero, obtenerPlanesTx, obtenerHallazgosTx, obtenerPlanesDeInformeTx,
  obtenerHallazgoTx, obtenerPlanesDeHallazgosTx,
  listarHallazgosTx, reservarIdsPlanesTx, guardarPlanesGrc, guardarInformesGrc, guardarRegistrosGrc, leerInformeTx,
  guardarWorkspaceParcial, parteDeRegistro, agruparColecciones, planificarPartes };`;

const BORRAR = { __borrar: true };
class FieldPath { constructor(...segmentos) { this.segmentos = segmentos; } }

// Fusión profunda como `set(..., { merge: true })`: los mapas se fusionan, todo lo demás se reemplaza.
const fusionar = (base, cambios) => {
  const resultado = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === BORRAR) delete resultado[clave];
    else if (valor && typeof valor === 'object' && !Array.isArray(valor)) resultado[clave] = fusionar(resultado[clave], valor);
    else resultado[clave] = valor;
  });
  return resultado;
};

// Firestore mínimo: documentos por ruta, consultas `in`, escrituras y contadores de lecturas y escrituras.
function crearDb(documentos) {
  const datos = new Map(Object.entries(structuredClone(documentos)));
  const db = { lecturas: 0, escrituras: [], datos };
  const padre = ruta => ruta.slice(0, ruta.lastIndexOf('/'));
  const snapshot = ruta => {
    const valor = datos.get(ruta);
    return { id: ruta.split('/').pop(), exists: valor !== undefined, data: () => structuredClone(valor), get: campo => structuredClone(valor?.[campo]), ref: docRef(ruta) };
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
  const aplicar = ({ tipo, referencia, valor, opciones }) => {
    db.escrituras.push(referencia.path);
    if (tipo === 'eliminar') return datos.delete(referencia.path);
    const actual = datos.get(referencia.path);
    if (opciones?.merge) return datos.set(referencia.path, fusionar(actual, valor));
    if (opciones?.mergeFields) {
      const resultado = structuredClone(actual || {});
      opciones.mergeFields.forEach(({ segmentos }) => {
        let origen = valor;
        let destino = resultado;
        segmentos.slice(0, -1).forEach(segmento => {
          origen = origen[segmento];
          destino[segmento] = destino[segmento] && typeof destino[segmento] === 'object' ? destino[segmento] : {};
          destino = destino[segmento];
        });
        destino[segmentos.at(-1)] = structuredClone(origen[segmentos.at(-1)]);
      });
      return datos.set(referencia.path, resultado);
    }
    return datos.set(referencia.path, structuredClone(valor));
  };
  const escritor = () => {
    const pendientes = [];
    return {
      pendientes,
      get: referencia => referencia.get(),
      set: (referencia, valor, opciones) => { pendientes.push({ tipo: 'set', referencia, valor, opciones }); },
      delete: referencia => { pendientes.push({ tipo: 'eliminar', referencia }); },
      commit: async () => { pendientes.splice(0).forEach(aplicar); },
    };
  };
  db.collection = colRef;
  db.transaccion = escritor;
  db.batch = escritor;
  db.runTransaction = async funcion => {
    const transaccion = escritor();
    const resultado = await funcion(transaccion);
    await transaccion.commit();
    return resultado;
  };
  return db;
}

const cargar = db => new Function('adminDb', 'FieldValue', 'FieldPath', 'Filter', 'logger', codigo)(
  db, { delete: () => BORRAR }, FieldPath, { or: () => ({}), where: () => ({}) }, { info() {}, warn() {}, error() {} },
);

const RAIZ = 'workspace_compartido/base_de_datos_grc';
const PARTE = coleccion => `workspace_compartido/base_de_datos_grc_grupo_${coleccion}_0`;
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
const TODAS = { planes: { version: 1, partes: 1 }, hallazgos: { version: 1, partes: 1 }, informes: { version: 1, partes: 1 } };
const grupos = (indice = TODAS) => ({
  [RAIZ]: { catalogoCargos: [], coleccionesAgrupadas: indice },
  [PARTE('planes')]: { registros: { ...registros('planes_accion'), 10: plan(10, { idHallazgo: 'H1', idInforme: 'I1', progreso: 90 }) } },
  [PARTE('hallazgos')]: { registros: registros('hallazgos') },
  [PARTE('informes')]: { registros: registros('informes') },
});
const abrirTx = async (db, modulo) => {
  const transaccion = db.transaccion();
  return { transaccion, workspace: await modulo.leerWorkspaceGrcLigero(transaccion, { origen: 'prueba-tx' }) };
};

// ---------------------------------------------------------------------------- Etapa 1: lectura doble

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
  const db = crearDb({ ...subcolecciones, ...grupos({ planes: { version: 1, partes: 2 } }) });
  await assert.rejects(cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' }), /falta la parte 1 de planes/);
});

test('transacciones: cada parte se lee una sola vez y los filtros equivalen a las consultas `in`', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos() });
  const modulo = cargar(db);
  const { transaccion, workspace } = await abrirTx(db, modulo);
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
  const informe = await modulo.leerInformeTx(transaccion, workspace, 'I2');
  assert.equal(informe.exists, true);
  assert.equal(informe.data().titulo, 'Informe 2');
  assert.equal((await modulo.leerInformeTx(transaccion, workspace, 'I9')).exists, false);
  assert.equal(db.lecturas, 2 + 3, 'una lectura por colección para toda la transacción');
});

test('reservar IDs con planes agrupados no consulta cada candidato y evita IDs ocupados', async () => {
  const ocupado = Date.now() + 1000;
  const documentos = grupos();
  documentos[PARTE('planes')].registros[ocupado] = plan(ocupado);
  const db = crearDb(documentos);
  const modulo = cargar(db);
  const { transaccion, workspace } = await abrirTx(db, modulo);
  const ids = await modulo.reservarIdsPlanesTx(transaccion, workspace, 3);
  assert.equal(new Set(ids).size, 3);
  assert.equal(db.lecturas, 2 + 1);
});

test('sin índice, las transacciones siguen leyendo documento por documento', async () => {
  const db = crearDb({ [RAIZ]: {}, ...subcolecciones });
  const modulo = cargar(db);
  const { transaccion, workspace } = await abrirTx(db, modulo);
  const [plan10] = await modulo.obtenerPlanesTx(transaccion, workspace, ['10']);
  assert.equal(plan10.accion, 'Plan 10');
  const delInforme = await modulo.obtenerPlanesDeInformeTx(transaccion, workspace, 'I1');
  assert.deepEqual(delInforme.planes.map(registro => registro.id), [10]);
  assert.equal((await modulo.leerInformeTx(transaccion, workspace, 'I1')).data().titulo, 'Informe 1');
  assert.equal(db.lecturas, 2 + 1 + 1 + 1 + 1 + 1, 'plan + hallazgos del informe + planes del informe + planes del hallazgo + informe');
});

test('la parte de cada registro es estable', () => {
  const { parteDeRegistro } = cargar(crearDb({}));
  assert.equal(parteDeRegistro('1712345678901', 3), parteDeRegistro(String(1712345678901), 3));
  assert.ok([...Array(50).keys()].every(id => parteDeRegistro(id, 4) < 4));
});

// ---------------------------------------------------------------------------- Etapa 3: escrituras

test('transacción agrupada: reemplaza solo los registros indicados, en una escritura por parte', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos() });
  const modulo = cargar(db);
  const { transaccion, workspace } = await abrirTx(db, modulo);
  modulo.guardarPlanesGrc(transaccion, workspace, [plan(10, { idHallazgo: 'H1', estado: 'Cerrado' }), plan(3)]);
  modulo.guardarRegistrosGrc(transaccion, workspace, 'hallazgos', [{ titulo: 'Nuevo' }], { claveDe: () => 'H3' });
  await transaccion.commit();
  assert.deepEqual(db.escrituras, [PARTE('planes'), PARTE('hallazgos')]);
  const partePlanes = db.datos.get(PARTE('planes')).registros;
  assert.equal(partePlanes[10].estado, 'Cerrado');
  assert.equal(partePlanes[10].progreso, undefined, 'reemplazo completo del registro (como set sin merge)');
  assert.equal(partePlanes[2].accion, 'Plan 2', 'los demás registros no se tocan');
  assert.equal(partePlanes[3].accion, 'Plan 3');
  assert.equal(db.datos.get(PARTE('hallazgos')).registros.H3.titulo, 'Nuevo');
  assert.equal(db.datos.get(`${RAIZ}/planes_accion/10`).estado, undefined, 'la subcolección (respaldo) no cambia');
  const { data } = await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' });
  assert.deepEqual(data.planes.map(registro => registro.id), [10, 2, 3]);
});

test('informes agrupados se fusionan campo a campo (como set con merge)', async () => {
  const db = crearDb({ ...subcolecciones, ...grupos() });
  const modulo = cargar(db);
  const { transaccion, workspace } = await abrirTx(db, modulo);
  modulo.guardarInformesGrc(transaccion, workspace, [{ id: 'I1', correoEnviadoA: 'a@b.co' }]);
  await transaccion.commit();
  assert.deepEqual(db.datos.get(PARTE('informes')).registros.I1, { titulo: 'Informe 1', macroproceso: 'Finanzas', correoEnviadoA: 'a@b.co', id: 'I1' });
});

test('sin índice, las escrituras siguen yendo a cada documento de la subcolección', async () => {
  const db = crearDb({ [RAIZ]: {}, ...subcolecciones });
  const modulo = cargar(db);
  const { transaccion, workspace } = await abrirTx(db, modulo);
  modulo.guardarPlanesGrc(transaccion, workspace, [plan(10, { estado: 'Cerrado' })]);
  modulo.guardarRegistrosGrc(transaccion, workspace, 'hallazgos', [{ id: 'H1', titulo: 'Editado' }]);
  await transaccion.commit();
  assert.deepEqual(db.escrituras, [`${RAIZ}/planes_accion/10`, `${RAIZ}/hallazgos/H1`]);
  assert.equal(db.datos.get(`${RAIZ}/planes_accion/10`).idHallazgo, undefined, 'reemplazo como antes');
});

test('sync del administrador agrupado: guarda cambios, borra ausentes, omite iguales y lee una parte', async () => {
  const documentos = grupos();
  // Como en producción, cada hallazgo guardado incluye su campo id.
  Object.entries(documentos[PARTE('hallazgos')].registros).forEach(([id, hallazgo]) => { hallazgo.id = id; });
  const db = crearDb({ ...subcolecciones, ...documentos });
  const modulo = cargar(db);
  await modulo.guardarWorkspaceParcial({
    planes: [plan(10, { idHallazgo: 'H1', idInforme: 'I1', progreso: 95 })],
    hallazgos: [{ id: 'H1', titulo: 'Hallazgo 1', idInforme: 'I1' }, { id: 'H2', titulo: 'Hallazgo 2', idInforme: 'I2' }],
    informesAuditoria: [{ id: 'I3', titulo: 'Informe 3' }],
    catalogoCargos: ['Auditor'],
  });
  assert.equal(db.lecturas, 2 + 2, 'principal + informes legados + parte de hallazgos + parte de planes');
  const partePlanes = db.datos.get(PARTE('planes')).registros;
  assert.equal(partePlanes[10].progreso, 95);
  assert.equal(partePlanes[2], undefined, 'el plan ausente se elimina (igual que en la subcolección)');
  assert.ok(db.datos.get(`${RAIZ}/planes_accion/2`), 'la subcolección de respaldo no se toca');
  assert.equal(db.datos.get(PARTE('informes')).registros.I3.titulo, 'Informe 3');
  assert.deepEqual(db.datos.get(RAIZ).catalogoCargos, ['Auditor']);
  assert.ok(db.datos.get(RAIZ).coleccionesAgrupadas.planes, 'el índice se conserva');
  assert.equal(db.escrituras.filter(ruta => ruta === PARTE('hallazgos')).length, 0, 'hallazgos sin cambios: cero escrituras');
});

test('el cliente no puede escribir el índice de agrupación', async () => {
  const modulo = cargar(crearDb({ ...subcolecciones, ...grupos() }));
  await assert.rejects(modulo.guardarWorkspaceParcial({ coleccionesAgrupadas: {} }), /solo lo administra/);
});

// ---------------------------------------------------------------------------- Etapa 2: copia

test('copia: simular no escribe; ejecutar deja exactamente los mismos datos y es idempotente', async () => {
  const documentos = {
    [RAIZ]: { catalogoCargos: [], hallazgos: [{ id: 'H9', titulo: 'Legado', idInforme: 'I1' }, { id: 'H1', titulo: 'Legado viejo' }] },
    ...subcolecciones,
  };
  const db = crearDb(documentos);
  const antes = (await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' })).data;

  const simulacion = await cargar(db).agruparColecciones({ ejecutar: false, usuario: 'admin@x' });
  assert.equal(simulacion.estado, 'simulacion');
  assert.equal(db.escrituras.length, 0);
  assert.equal(simulacion.colecciones.hallazgos.registros, 3);
  assert.equal(simulacion.colecciones.hallazgos.legadosSinDocumento, 1);
  assert.equal(simulacion.colecciones.planes.partes, 1);

  const copia = await cargar(db).agruparColecciones({ ejecutar: true, usuario: 'admin@x' });
  assert.equal(copia.estado, 'agrupado');
  assert.deepEqual(db.datos.get(RAIZ).coleccionesAgrupadas.planes.partes, 1);
  assert.equal(db.datos.get(PARTE('hallazgos')).registros.H1.titulo, 'Hallazgo 1', 'la subcolección prevalece sobre el legado');

  db.lecturas = 0;
  const despues = (await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' })).data;
  assert.equal(db.lecturas, 2 + 3);
  const ordenar = lista => [...lista].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const campo of ['planes', 'hallazgos', 'informesAuditoria']) {
    assert.deepEqual(ordenar(despues[campo]), ordenar(antes[campo]), `${campo} idénticos tras la copia`);
  }

  db.escrituras.length = 0;
  const repetida = await cargar(db).agruparColecciones({ ejecutar: true, usuario: 'admin@x' });
  assert.equal(repetida.estado, 'sin-cambios');
  assert.equal(repetida.colecciones.planes.estado, 'ya-agrupada');
  assert.equal(db.escrituras.length, 0);
});

test('copia por colección y bloqueo si hay legados sin ID', async () => {
  const db = crearDb({ [RAIZ]: { planes: [{ accion: 'sin id' }] }, ...subcolecciones });
  const reporte = await cargar(db).agruparColecciones({ ejecutar: true, colecciones: ['planes', 'informes'] });
  assert.equal(reporte.colecciones.planes.estado, 'bloqueada');
  assert.equal(reporte.colecciones.informes.estado, 'agrupada');
  assert.equal(reporte.colecciones.hallazgos, undefined);
  assert.deepEqual(Object.keys(db.datos.get(RAIZ).coleccionesAgrupadas), ['informes']);
});

test('el reparto respeta tamaño y número de campos por parte', () => {
  const { planificarPartes } = cargar(crearDb({}));
  const grandes = Array.from({ length: 200 }, (_, indice) => [String(indice), { texto: 'x'.repeat(4000) }]);
  const porTamano = planificarPartes(grandes);
  assert.ok(porTamano.partes >= 3);
  assert.equal(porTamano.resumen.reduce((total, parte) => total + parte.registros, 0), 200);
  const muchosCampos = Array.from({ length: 300 }, (_, indice) => [String(indice), Object.fromEntries(Array.from({ length: 40 }, (_, campo) => [`c${campo}`, 1]))]);
  assert.ok(planificarPartes(muchosCampos).partes >= 2, '12.300 campos se reparten en varias partes');
  assert.equal(planificarPartes([]).partes, 1);
});

// ---------------------------------------------------------------------------- Punta a punta (endpoints reales)

const workflow = await import('../src/utils/programPlanWorkflow.js');
const alcance = await import('../api/_lib/assignmentScope.js');
const validacion = await import('../api/_lib/validation.js');
const { validarAdjuntoEvaluacion } = await import('../src/utils/evaluationAttachment.js');
const { randomUUID } = await import('node:crypto');

function endpoints(db) {
  const errores = [];
  const bindings = {
    ...workflow, ...alcance, ...validacion, ...cargar(db), validarAdjuntoEvaluacion, randomUUID, adminDb: db,
    applyCors: () => false,
    requireAuth: async () => ({ uid: 'admin', email: 'admin@termales.com.co', rol: 'admin' }),
    sendSuccess: (res, body) => Object.assign(res, { code: 200, body }),
    sendError: (res, error, code) => Object.assign(res, { code, error }),
    notificarSemaforo: async () => {},
    logger: { info() {}, warn() {}, error: (...args) => errores.push(args.map(arg => (arg instanceof Error ? arg.stack : arg))) },
  };
  const cuerpo = archivo => readFileSync(new URL(archivo, import.meta.url), 'utf8')
    .replace(/^import [^;]*;\r?\n/gm, '').replace('export default ', '').replaceAll('export ', '');
  const handler = archivo => new Function(...Object.keys(bindings), `${cuerpo(archivo)}\nreturn handler;`)(...Object.values(bindings));
  const llamar = archivo => async (method, body) => {
    const res = {};
    await handler(archivo)({ method, body, url: '/prueba', headers: {} }, res);
    return res;
  };
  return { errores, registerEmail: llamar('../api/_grc/register-email.js'), update: llamar('../api/_grc/update.js'), create: llamar('../api/_grc/create.js') };
}

test('punta a punta con colecciones agrupadas: correo de informe, edición y creación de hallazgos', async () => {
  const documentos = grupos();
  documentos['usuarios/admin'] = { rol: 'admin', permisos: [] };
  Object.values(documentos[PARTE('informes')].registros).forEach(informe => Object.assign(informe, { proceso: 'Operaciones', subprocesos: ['General'] }));
  const db = crearDb({ ...subcolecciones, ...documentos });
  const api = endpoints(db);

  const correo = await api.registerEmail('POST', { id: 'I2', destinatarios: 'jefe@termales.com.co', fechaCorreoEnviado: '2026-10-23' });
  assert.equal(correo.code, 200, JSON.stringify(api.errores));
  assert.equal(db.datos.get(PARTE('informes')).registros.I2.correoEnviadoA, 'jefe@termales.com.co');

  const edicion = await api.update('PUT', { coleccion: 'hallazgos', id: 'H1', registro: { titulo: 'Corregido', proceso: 'Operaciones', subprocesos: ['General'] } });
  assert.equal(edicion.code, 200, JSON.stringify(api.errores));
  const h1 = db.datos.get(PARTE('hallazgos')).registros.H1;
  assert.equal(h1.titulo, 'Corregido');
  assert.equal(h1.idInforme, 'I1', 'conserva los campos no editados');

  const creacion = await api.create('POST', { coleccion: 'hallazgos', registro: { titulo: 'Nuevo hallazgo', idInforme: 'I1', proceso: 'Operaciones', subprocesos: ['General'] } });
  assert.equal(creacion.code, 200, JSON.stringify([creacion, api.errores]));

  const { data } = await cargar(db).leerWorkspaceGrc(null, { origen: 'prueba' });
  assert.equal(data.hallazgos.length, 3);
  assert.ok(data.hallazgos.some(hallazgo => hallazgo.titulo === 'Nuevo hallazgo' && /^HAL-\d{4}-001$/.test(hallazgo.ref)));
  assert.ok(db.escrituras.every(ruta => !ruta.includes('/hallazgos/') && !ruta.includes('/informes/')), 'nada se escribe en las subcolecciones');
});
