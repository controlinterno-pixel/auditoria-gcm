// tests/estilosTablas.test.js - Las tablas no parten palabras ni cifras a la mitad ("10 / 0%") y, si no caben,
// se desplazan en su contenedor en vez de quedar recortadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const archivos = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entrada => (entrada.isDirectory() ? archivos(join(dir, entrada.name)) : /\.jsx$/.test(entrada.name) ? [join(dir, entrada.name)] : []));

test('en las tablas desplazables las palabras y cifras no se parten', () => {
  const estilos = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(estilos, /\.app-content :is\(\.overflow-x-auto, \.overflow-auto, \.overflow-x-scroll\) table \{\s*overflow-wrap: break-word;/);
});

test('ninguna tabla queda dentro de una caja que recorta lo que no cabe', () => {
  const recortadas = archivos('src').flatMap(archivo => {
    const lineas = readFileSync(archivo, 'utf8').split('\n');
    return lineas.flatMap((linea, i) => {
      if (!/<table\b/.test(linea)) return [];
      const padre = lineas.slice(0, i).reverse().find(anterior => anterior.trim());
      return /<div[^>]*\boverflow-hidden\b/.test(padre || '') ? [`${archivo}:${i + 1}`] : [];
    });
  });
  assert.deepEqual(recortadas, [], 'usa overflow-x-auto en el contenedor de la tabla');
});
