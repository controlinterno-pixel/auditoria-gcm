import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sinImports = texto => texto.replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');

function cargarSemaforo(valorInicial) {
  const estado = { valor: valorInicial, invalidaciones: 0 };
  const referencia = {};
  const adminDb = {
    collection: () => ({ doc: () => referencia }),
    runTransaction: async fn => fn({
      get: async () => ({ exists: estado.valor !== undefined, data: () => ({ ultimaModificacion: estado.valor }) }),
      set: (_ref, datos) => { estado.valor = datos.ultimaModificacion; },
    }),
  };
  const modulo = new Function('adminDb', 'invalidarCacheWorkspaceGrc', 'logger', `${sinImports(read('../api/_lib/semaforo.js'))}\nreturn { notificarSemaforo };`)(
    adminDb, () => { estado.invalidaciones += 1; }, { info() {} },
  );
  return { ...modulo, estado };
}

test('semáforo devuelve revisión anterior y nueva, siempre creciente, en cabeceras', async () => {
  const futuro = Date.now() + 60_000;
  const { notificarSemaforo, estado } = cargarSemaforo(futuro);
  const cabeceras = {};
  const res = { headersSent: false, setHeader: (nombre, valor) => { cabeceras[nombre] = valor; } };
  const resultado = await notificarSemaforo(res);
  assert.equal(resultado.anterior, String(futuro));
  assert.equal(resultado.nueva, String(futuro + 1), 'nunca retrocede ni repite');
  assert.equal(cabeceras['X-GRC-Revision-Anterior'], String(futuro));
  assert.equal(cabeceras['X-GRC-Revision'], String(futuro + 1));
  assert.equal(estado.invalidaciones, 1);
  // Sin respuesta (otros endpoints) sigue funcionando igual que antes.
  const otro = await notificarSemaforo();
  assert.equal(otro.anterior, String(futuro + 1));
});

test('semáforo sin documento previo parte de 0', async () => {
  const { notificarSemaforo } = cargarSemaforo(undefined);
  const resultado = await notificarSemaforo();
  assert.equal(resultado.anterior, '0');
  assert.ok(Number(resultado.nueva) > 0);
});

test('solo las decisiones que aplican la respuesta completa omiten la recarga', () => {
  const api = read('../src/services/apiService.js');
  const bloque = nombre => api.slice(api.indexOf(`  ${nombre}:`), api.indexOf('}),', api.indexOf(`  ${nombre}:`)) + 3);
  for (const metodo of ['decidirRevisionPlanes', 'evaluarDisenoPlanes', 'restaurarReenvioPlanes', 'decidirPlanComoAuditor', 'decidirPlanesComoAuditor']) {
    assert.match(bloque(metodo), /aplicadoLocalmente: true/, metodo);
  }
  assert.equal(/aplicadoLocalmente: true/.test(bloque('guardarMatrizPlanes')), false, 'guardar matriz sigue recargando');
  assert.equal((read('../api/_grc/review-plans.js').match(/notificarSemaforo\(res\)/g) || []).length, 4);
});

test('el cliente no recarga en pestañas ocultas y verifica la revisión anterior', () => {
  const hook = read('../src/hooks/useGrcData.js');
  assert.match(hook, /document\.visibilityState === 'hidden'[\s\S]*cambiosPendientesOculta = true/);
  assert.match(hook, /revisionCargada !== anterior\) return;/);
  assert.match(hook, /cancelarRevisionPropia\(\);/);
});
