import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Se cargan las funciones puras sin conectar a Firebase.
const fuente = readFileSync(new URL('../api/_lib/diagnosticoLecturas.js', import.meta.url), 'utf8')
  .replace(/^import [^;]*;\r?\n/gm, '').replace(/^export /gm, '');
const { resumirColeccion, proyectarLecturas, BYTES_OBJETIVO_PARTE } = new Function('adminDb',
  `${fuente}\nreturn { resumirColeccion, proyectarLecturas, BYTES_OBJETIVO_PARTE };`)(null);

const documentos = (cantidad, relleno) => Array.from({ length: cantidad }, (_, indice) => ({ id: String(indice), datos: { texto: 'x'.repeat(relleno) } }));

test('resumen por colección: documentos, bytes y partes propuestas con margen', () => {
  const resumen = resumirColeccion(documentos(200, 4000));
  assert.equal(resumen.documentos, 200);
  assert.ok(resumen.bytesTotal > 800_000 && resumen.bytesTotal < 900_000);
  assert.equal(resumen.partesPropuestas, Math.ceil(resumen.bytesTotal / BYTES_OBJETIVO_PARTE));
  assert.equal(resumen.documentosDemasiadoGrandes, 0);
  assert.equal(resumirColeccion([]).partesPropuestas, 0);
  assert.equal(resumirColeccion(documentos(1, 950_000)).documentosDemasiadoGrandes, 1);
});

test('proyección de lecturas por carga completa antes y después de agrupar', () => {
  const colecciones = {
    planes: resumirColeccion(documentos(180, 3000)),
    hallazgos: resumirColeccion(documentos(90, 3000)),
    informes: resumirColeccion(documentos(30, 3000)),
  };
  const proyeccion = proyectarLecturas({ colecciones, partesRiesgos: 4 });
  assert.equal(proyeccion.lecturasPorCargaActual, 2 + 4 + 300);
  assert.equal(proyeccion.lecturasPorCargaPropuesta, 2 + 4 + 2 + 1 + 1);
  assert.ok(proyeccion.reduccionPorcentaje > 90);
  assert.equal(proyeccion.cargasCompletasConCuotaActual, Math.floor(50_000 / 306));
});

test('el diagnóstico no escribe ni avisa al semáforo, y es solo para administradores', () => {
  const lib = readFileSync(new URL('../api/_lib/diagnosticoLecturas.js', import.meta.url), 'utf8');
  const endpoint = readFileSync(new URL('../api/_grc/diagnostico-lecturas.js', import.meta.url), 'utf8');
  assert.equal(/\.(set|update|delete|add|create)\(/.test(lib), false, 'sin escrituras');
  assert.equal(/notificarSemaforo/.test(endpoint), false);
  assert.match(endpoint, /Solo un administrador/);
  assert.match(readFileSync(new URL('../api/index.js', import.meta.url), 'utf8'), /'\/api\/grc\/diagnostico-lecturas'/);
});
