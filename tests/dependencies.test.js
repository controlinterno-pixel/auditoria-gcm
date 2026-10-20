// tests/dependencies.test.js - Toda librería importada por api/ o src/ debe estar declarada y poder cargarse.
// Evita fallos como el de 'cookie' (llegaba como dependencia indirecta de express y desapareció al retirarla).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const declaradas = new Set([...Object.keys(paquete.dependencies || {}), ...Object.keys(paquete.devDependencies || {})]);
const backend = new Set(Object.keys(paquete.dependencies || {}));

const archivos = carpeta => readdirSync(carpeta).flatMap(nombre => {
  const ruta = join(carpeta, nombre);
  if (statSync(ruta).isDirectory()) return archivos(ruta);
  return /\.(js|jsx)$/.test(nombre) ? [ruta] : [];
});

const paqueteDe = especificador => (especificador.startsWith('@')
  ? especificador.split('/').slice(0, 2).join('/')
  : especificador.split('/')[0]);

const importados = new Map(); // paquete -> primer archivo que lo usa
for (const carpeta of ['api', 'src']) {
  for (const archivo of archivos(join(raiz, carpeta))) {
    const fuente = readFileSync(archivo, 'utf8');
    for (const [, especificador] of fuente.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"./][^'"]*)['"]/g)) {
      if (especificador.startsWith('node:')) continue;
      const nombre = paqueteDe(especificador);
      if (!importados.has(nombre)) importados.set(nombre, { archivo: archivo.slice(raiz.length), especificador, carpeta });
    }
  }
}

const noDeclaradas = [...importados].filter(([nombre]) => !declaradas.has(nombre));
assert.deepEqual(noDeclaradas.map(([nombre, uso]) => `${nombre} (${uso.archivo})`), [],
  'Librerías importadas que no están en package.json');

// El servidor (Vercel) instala solo `dependencies`: lo que usa api/ debe estar ahí, no en devDependencies.
const servidorEnDev = [...importados].filter(([nombre, uso]) => uso.carpeta === 'api' && !backend.has(nombre));
assert.deepEqual(servidorEnDev.map(([nombre]) => nombre), [], 'api/ usa librerías que no están en dependencies');

// Cada librería del servidor debe poder resolverse desde node_modules.
for (const [nombre, uso] of importados) {
  if (uso.carpeta !== 'api') continue;
  assert.doesNotThrow(() => import.meta.resolve(uso.especificador), `No se puede cargar '${uso.especificador}' (usada en ${uso.archivo})`);
}

console.log(`dependencies.test.js: OK (${importados.size} librerías importadas, todas declaradas y resolubles)`);
