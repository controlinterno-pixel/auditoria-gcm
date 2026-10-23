// tests/recalculoResiduales.test.js - Recálculo del residual de toda la matriz con la regla del manual.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calcularResiduales } from '../src/utils/explicacionControles.js';
import { riesgoEnPorcentaje, zonaSeveridad } from '../src/utils/nivelRiesgo.js';
import { normalizarClasificacion } from '../src/utils/clasificacionRiesgo.js';
import { CLASIFICACIONES_MANUAL } from '../src/constants/diccionariosGRC.js';

const fuente = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  .replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');
const BORRAR = { __borrar: true };
const fusionar = (base, cambios) => {
  const resultado = { ...(base || {}) };
  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === BORRAR) delete resultado[clave];
    else if (valor && typeof valor === 'object' && !Array.isArray(valor)) resultado[clave] = fusionar(resultado[clave], valor);
    else resultado[clave] = valor;
  });
  return resultado;
};

function crearDb(documentos) {
  const datos = new Map(Object.entries(structuredClone(documentos)));
  const docRef = ruta => ({ path: ruta, get: async () => ({ exists: datos.has(ruta), data: () => structuredClone(datos.get(ruta)), get: campo => structuredClone(datos.get(ruta)?.[campo]) }) });
  return {
    datos,
    collection: coleccion => ({ doc: id => docRef(`${coleccion}/${id}`) }),
    runTransaction: async funcion => {
      const pendientes = [];
      const resultado = await funcion({ get: referencia => referencia.get(), set: (referencia, valor, opciones) => pendientes.push({ referencia, valor, opciones }) });
      pendientes.forEach(({ referencia, valor, opciones }) => datos.set(referencia.path, opciones?.merge ? fusionar(datos.get(referencia.path), valor) : structuredClone(valor)));
      return resultado;
    },
  };
}

const cargar = db => new Function('adminDb', 'FieldValue', 'Filter', 'logger', 'calcularResiduales', 'riesgoEnPorcentaje', 'zonaSeveridad', 'normalizarClasificacion', 'CLASIFICACIONES_MANUAL',
  `${fuente('../api/_lib/coleccionesAgrupadas.js')}\n${fuente('../api/_lib/grcWorkspace.js')}\nreturn { recalcularResidualesMatriz, corregirEscalaInherente, normalizarClasificacionesMatriz };`)(
  db, { delete: () => BORRAR }, {}, { info() {}, warn() {}, error() {} }, calcularResiduales, riesgoEnPorcentaje, zonaSeveridad,
  normalizarClasificacion, CLASIFICACIONES_MANUAL,
);

const control = extra => ({ tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro', ...extra });
const matriz = () => {
  const riesgos = [
    // Ejemplo del manual, guardado con la regla anterior (75 % y 65 %): 60 % → 9 %.
    { id: 1, proceso: 'Contratación', probabilidadInherente: 60, impactoInherente: 80, probabilidadResidual: 9, impactoResidual: 80, controlesDetallados: [control(), control({ tipo: 'Detectivo' })], historialCambios: [{ accion: 'Creación' }] },
    { id: 2, proceso: 'Sin controles', probabilidadInherente: 60, impactoInherente: 60, probabilidadResidual: 20, impactoResidual: 40, controlesDetallados: [] },
    { id: 3, proceso: 'Importado 1–5', probabilidadInherente: 4, impactoInherente: 3, probabilidadResidual: 2, impactoResidual: 3, controlesDetallados: [control()] },
    // Ya coincide con el manual: no se toca.
    { id: 4, proceso: 'Al día', probabilidadInherente: 40, impactoInherente: 40, probabilidadResidual: 24, impactoResidual: 40, controlesDetallados: [control()] },
  ];
  return {
    'workspace_compartido/base_de_datos_grc': { riesgosFragmentados: { version: 1, partes: 1, orden: riesgos.map(riesgo => String(riesgo.id)) } },
    'workspace_compartido/base_de_datos_grc_riesgos_0': { riesgos },
  };
};
const riesgosGuardados = db => db.datos.get('workspace_compartido/base_de_datos_grc_riesgos_0').riesgos;

test('simulación: reporta cambios y zonas sin escribir nada', async () => {
  const db = crearDb(matriz());
  const reporte = await cargar(db).recalcularResidualesMatriz({ ejecutar: false, usuario: 'admin@x' });
  assert.equal(reporte.estado, 'simulacion');
  assert.equal(reporte.riesgosConCambio, 1);
  assert.deepEqual(reporte.omitidos, { sinControlesEstructurados: 1, escalaEnNiveles: 1 });
  assert.deepEqual(reporte.cambios[0], {
    id: '1', proceso: 'Contratación',
    antes: { probabilidad: 9, impacto: 80, zona: 'Alto' },
    despues: { probabilidad: 25, impacto: 80, zona: 'Alto' },
  });
  assert.equal(reporte.cambianDeZona, 0);
  assert.equal(riesgosGuardados(db)[0].probabilidadResidual, 9, 'no escribe');
});

test('ejecución: actualiza solo los riesgos que cambian y deja trazabilidad; es idempotente', async () => {
  const db = crearDb(matriz());
  const reporte = await cargar(db).recalcularResidualesMatriz({ ejecutar: true, usuario: 'admin@x' });
  assert.equal(reporte.estado, 'recalculado');
  const [uno, dos, tres, cuatro] = riesgosGuardados(db);
  assert.equal(uno.probabilidadResidual, 25);
  assert.equal(uno.nivelResidual, 'Alto');
  assert.equal(uno.historialCambios.length, 2);
  assert.deepEqual(uno.historialCambios[1].antes, { probabilidad: 9, impacto: 80, zona: 'Alto' });
  assert.equal(uno.historialCambios[1].usuario, 'admin@x');
  assert.equal(dos.probabilidadResidual, 20, 'sin controles estructurados: no se toca');
  assert.equal(tres.probabilidadResidual, 2, 'escala 1–5: no se toca');
  assert.equal(cuatro.historialCambios, undefined, 'ya coincidía: sin entrada nueva');

  const repetido = await cargar(db).recalcularResidualesMatriz({ ejecutar: true, usuario: 'admin@x' });
  assert.equal(repetido.estado, 'sin-cambios');
});

test('corrección de escala: un inherente 1–5 en un riesgo en porcentaje pasa a N × 20 % y se recalcula', async () => {
  const riesgos = [
    // Como RSK-2: probabilidad inherente 1 (nivel Muy baja) con impacto en porcentaje.
    { id: 2, probabilidadInherente: 1, impactoInherente: 60, probabilidadResidual: 0, impactoResidual: 45, controlesDetallados: [control(), control({ tipo: 'Correctivo' })] },
    // Como RSK-206: impacto inherente 1, sin controles correctivos.
    { id: 206, probabilidadInherente: 60, impactoInherente: 1, probabilidadResidual: 24, impactoResidual: 1, controlesDetallados: [control(), control()] },
    // Sin controles estructurados: el residual también estaba en nivel.
    { id: 7, probabilidadInherente: 80, impactoInherente: 3, probabilidadResidual: 80, impactoResidual: 3, controlesDetallados: [] },
    { id: 8, probabilidadInherente: 10, impactoInherente: 40, probabilidadResidual: 10, impactoResidual: 40, controlesDetallados: [] },
    { id: 9, probabilidadInherente: 4, impactoInherente: 3, probabilidadResidual: 2, impactoResidual: 3, controlesDetallados: [] },
  ];
  const db = crearDb({
    'workspace_compartido/base_de_datos_grc': { riesgosFragmentados: { version: 1, partes: 1, orden: riesgos.map(riesgo => String(riesgo.id)) } },
    'workspace_compartido/base_de_datos_grc_riesgos_0': { riesgos },
  });
  const simulacion = await cargar(db).corregirEscalaInherente({ ejecutar: false });
  assert.equal(simulacion.riesgosCorregidos, 3);
  assert.deepEqual(simulacion.dudosos, [{ id: '8', campo: 'probabilidadInherente', valor: 10 }], '10 % no es un nivel: solo se reporta');
  assert.equal(riesgosGuardados(db)[0].probabilidadInherente, 1, 'simular no escribe');

  const reporte = await cargar(db).corregirEscalaInherente({ ejecutar: true, usuario: 'admin@x' });
  assert.equal(reporte.estado, 'corregido');
  const [dos, dosCientos, siete, ocho, nueve] = riesgosGuardados(db);
  assert.deepEqual([dos.probabilidadInherente, dos.probabilidadResidual, dos.impactoResidual], [20, 12, 45]);
  assert.deepEqual([dosCientos.impactoInherente, dosCientos.impactoResidual, dosCientos.nivelResidual], [20, 20, 'Bajo']);
  assert.deepEqual([siete.impactoInherente, siete.impactoResidual], [60, 60]);
  assert.equal(ocho.probabilidadInherente, 10);
  assert.equal(nueve.probabilidadInherente, 4, 'un riesgo importado en escala 1–5 completo no se toca');
  assert.match(dos.historialCambios.at(-1).accion, /Corrección de escala/);
  assert.equal((await cargar(db).corregirEscalaInherente({ ejecutar: true })).estado, 'sin-cambios');
});

test('clasificaciones: las variantes se unifican a la Tabla 5; lo no reconocido solo se reporta', async () => {
  const riesgos = [
    { id: 1, clasificacionRiesgo: 'Fraude interno' },
    { id: 2, clasificacionRiesgo: 'Daños a activos y eventos extremos' },
    { id: 3, clasificacionRiesgo: 'Ejecución y administracion del proceso' },
    { id: 4, clasificacionRiesgo: 'Fraude Externo' },
    { id: 5, clasificacionRiesgo: 'Operativo' },
  ];
  const db = crearDb({
    'workspace_compartido/base_de_datos_grc': { riesgosFragmentados: { version: 1, partes: 1, orden: riesgos.map(riesgo => String(riesgo.id)) } },
    'workspace_compartido/base_de_datos_grc_riesgos_0': { riesgos },
  });
  const simulacion = await cargar(db).normalizarClasificacionesMatriz({ ejecutar: false });
  assert.equal(simulacion.riesgosCorregidos, 3);
  assert.deepEqual(simulacion.noReconocidas, { Operativo: 1 });
  assert.equal(riesgosGuardados(db)[0].clasificacionRiesgo, 'Fraude interno', 'simular no escribe');

  await cargar(db).normalizarClasificacionesMatriz({ ejecutar: true, usuario: 'admin@x' });
  assert.deepEqual(riesgosGuardados(db).map(riesgo => riesgo.clasificacionRiesgo), [
    'Fraude Interno', 'Daños a activos fijos/ eventos externos', 'Ejecución y administración de procesos', 'Fraude Externo', 'Operativo',
  ]);
  assert.equal(riesgosGuardados(db)[0].historialCambios.at(-1).cambios[0].antes, 'Fraude interno');
  assert.equal((await cargar(db).normalizarClasificacionesMatriz({ ejecutar: true })).estado, 'sin-cambios');
});
