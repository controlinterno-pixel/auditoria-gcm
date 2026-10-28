// tests/guardadoSoloCambios.test.js - El cliente envía solo los registros nuevos o cambiados, con la huella
// con que se cargaron; los que el usuario no tocó no viajan (así no pisan cambios de otras personas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as huella from '../src/utils/huellaRegistro.js';

const fuente = readFileSync(new URL('../src/services/grcStorageService.js', import.meta.url), 'utf8')
  .replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');

function cargar(respuesta = {}) {
  const enviados = [];
  const apiService = { saveGrcData: async datos => { enviados.push(datos); return respuesta; } };
  const modulo = new Function('apiService', 'cargarXLSX', ...Object.keys(huella), `${fuente}
return { saveToCloud, registrarDatosServidor };`)(apiService, async () => ({}), ...Object.values(huella));
  return { ...modulo, enviados };
}

const servidor = {
  hallazgos: [{ id: 'h1', titulo: 'Uno' }, { id: 'h2', titulo: 'Dos' }],
  comites: [{ id: 'c1', nombre: 'Comité' }],
  fuentesMejora: [{ codigo: 'F-1', estado: 'Abierta' }],
};
const huellasServidor = huella.huellasDeDatos(servidor);

test('solo viajan los registros cambiados o nuevos, cada cambiado con su huella', async () => {
  const { saveToCloud, registrarDatosServidor, enviados } = cargar({ huellasRegistros: { hallazgos: { h1: 'nueva' } } });
  registrarDatosServidor({ ...servidor, huellasRegistros: huellasServidor });
  const editado = { ...servidor.hallazgos[0], titulo: 'Uno editado' };
  assert.equal(await saveToCloud({
    hallazgos: [editado, servidor.hallazgos[1], { id: 'h3', titulo: 'Nuevo' }],
    comites: [...servidor.comites],
  }), true);
  assert.deepEqual(enviados[0].hallazgos, [
    { ...editado, huellaBase: huellasServidor.hallazgos.h1 },
    { id: 'h3', titulo: 'Nuevo' },
  ]);
  assert.deepEqual(enviados[0].comites, [], 'lo que no se tocó no viaja');

  // La siguiente edición del mismo registro usa la huella que devolvió el servidor.
  await saveToCloud({ hallazgos: [{ ...editado, titulo: 'Otra vez' }] });
  assert.equal(enviados[1].hallazgos[0].huellaBase, 'nueva');
});

test('restaurar un respaldo envía todo tal cual', async () => {
  const { saveToCloud, registrarDatosServidor, enviados } = cargar();
  registrarDatosServidor({ ...servidor, huellasRegistros: huellasServidor });
  await saveToCloud({ ...servidor, reemplazoTotal: true });
  assert.deepEqual(enviados[0].hallazgos, servidor.hallazgos);
  assert.equal(enviados[0].hallazgos.some(registro => 'huellaBase' in registro), false);
});

test('un conflicto del servidor no se da por guardado y muestra su mensaje', async () => {
  const avisos = [];
  const apiService = { saveGrcData: async () => { throw new Error('Otra persona modificó el hallazgo "Uno" mientras lo editabas.'); } };
  const { saveToCloud, registrarDatosServidor } = new Function('apiService', 'cargarXLSX', ...Object.keys(huella), `${fuente}
return { saveToCloud, registrarDatosServidor };`)(apiService, async () => ({}), ...Object.values(huella));
  registrarDatosServidor({ ...servidor, huellasRegistros: huellasServidor });
  const guardado = await saveToCloud({ hallazgos: [{ id: 'h1', titulo: 'Cambio' }] }, (mensaje, tipo) => avisos.push([mensaje, tipo]));
  assert.equal(guardado, false);
  assert.match(avisos[0][0], /Otra persona modificó/);
  assert.equal(avisos[0][1], 'error');
});

test('lo guardado por otro endpoint ("Guardar acción", decisiones) renueva la huella: la matriz no choca consigo misma', async () => {
  const enviados = [];
  let observador = null;
  const apiService = { saveGrcData: async datos => { enviados.push(datos); return {}; }, observarGuardados: fn => { observador = fn; } };
  const { saveToCloud, registrarDatosServidor } = new Function('apiService', 'cargarXLSX', ...Object.keys(huella), `${fuente}
return { saveToCloud, registrarDatosServidor };`)(apiService, async () => ({}), ...Object.values(huella));
  assert.equal(typeof observador, 'function', 'el módulo de guardado se suscribe a los guardados del servidor');
  registrarDatosServidor({ planes: [{ id: 1, accion: 'A', progreso: 40 }], huellasRegistros: huella.huellasDeDatos({ planes: [{ id: 1, accion: 'A', progreso: 40 }] }) });
  // "Guardar acción" devolvió la acción al 60 %.
  const guardada = { id: 1, accion: 'A', progreso: 60 };
  observador({ planes: [guardada], hallazgos: [] });
  assert.equal(await saveToCloud({ planes: [{ ...guardada, sede: 'Hotel' }] }), true);
  assert.equal(enviados[0].planes[0].huellaBase, huella.huellaRegistro(guardada), 'viaja la huella de lo guardado, no la de la carga');
  // Si no cambió nada más, no viaja.
  assert.equal(await saveToCloud({ planes: [{ ...guardada, sede: 'Hotel' }] }), true);
  assert.deepEqual(enviados[1].planes, []);
});
