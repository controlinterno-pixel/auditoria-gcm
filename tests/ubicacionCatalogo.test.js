// tests/ubicacionCatalogo.test.js - La ubicación de los riesgos se ajusta al catálogo de "Cargos y Procesos".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { revisarUbicacionRiesgo, sinProcesoDelCatalogo } from '../src/utils/ubicacionCatalogo.js';

const catalogo = {
  'Gestión Administrativa y Financiera': ['Gestión de Compras', 'Gestión de tesorería'],
  'Gestión del Talento Humano': ['Selección, vinculación y administración de colaboradores'],
  'Gestión estratégica': ['General'],
};

// 1. Coincide sin importar mayúsculas ni tildes: toma el nombre del catálogo, no queda nada en blanco.
{
  const r = revisarUbicacionRiesgo({ macroprocesos: ['gestion administrativa y financiera'], subprocesosPorMacroproceso: { 'gestion administrativa y financiera': ['gestión de compras'] } }, catalogo);
  assert.deepEqual(r.ubicacion.macroprocesos, ['Gestión Administrativa y Financiera']);
  assert.deepEqual(r.ubicacion.subprocesos, ['Gestión de Compras']);
  assert.deepEqual(r.fueraDeCatalogo, { macroprocesos: [], subprocesos: [] });
  assert.equal(r.cambia, true, 'unifica la escritura');
}

// 2. Macroproceso que no existe en el catálogo: queda en blanco (y sus subprocesos también).
{
  const r = revisarUbicacionRiesgo({ proceso: 'Gestión de la cadena de abastecimiento', subproceso: 'Compras' }, catalogo);
  assert.deepEqual(r.ubicacion, { proceso: '', macroproceso: '', macroprocesos: [], subproceso: '', subprocesos: [], subprocesosPorMacroproceso: {} });
  assert.deepEqual(r.fueraDeCatalogo.macroprocesos, ['Gestión de la cadena de abastecimiento']);
  assert.deepEqual(r.fueraDeCatalogo.subprocesos, ['Gestión de la cadena de abastecimiento / Compras']);
}

// 3. Macroproceso válido con un subproceso que no está en su lista: solo el subproceso queda en blanco.
{
  const r = revisarUbicacionRiesgo({ macroproceso: 'Gestión del Talento Humano', subprocesos: ['vinculación y administración de colaboradores'] }, catalogo);
  assert.deepEqual(r.ubicacion.macroprocesos, ['Gestión del Talento Humano']);
  assert.deepEqual(r.ubicacion.subprocesos, []);
  assert.deepEqual(r.fueraDeCatalogo.subprocesos, ['Gestión del Talento Humano / vinculación y administración de colaboradores']);
}

// 4. Ya está bien: no cambia nada. "General" se completa cuando es el único subproceso del catálogo.
{
  const bien = { macroprocesos: ['Gestión Administrativa y Financiera'], subprocesosPorMacroproceso: { 'Gestión Administrativa y Financiera': ['Gestión de tesorería'] } };
  assert.equal(revisarUbicacionRiesgo(bien, catalogo).cambia, false);
  assert.deepEqual(revisarUbicacionRiesgo({ macroproceso: 'Gestión estratégica' }, catalogo).ubicacion.subprocesos, ['General']);
  assert.equal(revisarUbicacionRiesgo(bien, {}).cambia, false, 'sin catálogo no se toca nada');
}

// 5. Filtro "Sin macroproceso del catálogo (por corregir)".
assert.equal(sinProcesoDelCatalogo({ macroprocesos: [] }, catalogo), true);
assert.equal(sinProcesoDelCatalogo({ proceso: 'Gestión de Almacenes' }, catalogo), true);
assert.equal(sinProcesoDelCatalogo({ macroprocesos: ['Gestión del Talento Humano'] }, catalogo), false);

// 6. El servidor simula por defecto, conserva el valor anterior y exige confirmación para escribir.
const servidor = readFileSync(new URL('../api/_lib/grcWorkspace.js', import.meta.url), 'utf8');
assert.ok(servidor.includes('ubicacionAnterior: anterior'), 'el valor anterior queda guardado en el riesgo');
assert.ok(servidor.includes("estado: ejecutar ? 'limpiado' : 'simulacion'"));
const endpoint = readFileSync(new URL('../api/_grc/limpiar-ubicaciones.js', import.meta.url), 'utf8');
assert.ok(endpoint.includes("CONFIRMACION_UBICACIONES = 'LIMPIAR-UBICACIONES'"));

console.log('ubicacionCatalogo.test.js: OK (unifica nombres, deja en blanco lo que no está en el catálogo, filtro por corregir)');
