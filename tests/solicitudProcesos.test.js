// tests/solicitudProcesos.test.js - Registro: uno o varios macroprocesos con todos o algunos subprocesos.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armarSolicitudProcesos, validarSolicitudProcesos } from '../src/utils/solicitudProcesos.js';

const mapa = {
  'Gestión comercial': ['Ventas', 'Contact Center'],
  'Gestión de servicio al cliente': ['PQRS', 'Encuestas'],
  'Gestión del Talento Humano': ['Selección', 'Nómina'],
};

// 1. Un director con dos macroprocesos completos: subprocesos vacío = todos.
assert.deepEqual(
  armarSolicitudProcesos({ 'Gestión comercial': { todos: true, subprocesos: [] }, 'Gestión de servicio al cliente': { todos: true, subprocesos: [] } }, mapa),
  { procesos: ['Gestión comercial', 'Gestión de servicio al cliente'], subprocesos: [], error: '' },
);

// 2. Uno completo y otro con algunos: se listan explícitos (el completo con toda su lista).
assert.deepEqual(
  armarSolicitudProcesos({ 'Gestión comercial': { todos: true, subprocesos: [] }, 'Gestión del Talento Humano': { todos: false, subprocesos: ['Nómina'] } }, mapa).subprocesos,
  ['Ventas', 'Contact Center', 'Nómina'],
);

// 3. Errores claros: sin macroproceso, o uno sin "todos" y sin subprocesos.
assert.match(armarSolicitudProcesos({}, mapa).error, /al menos un macroproceso/);
assert.match(armarSolicitudProcesos({ 'Gestión comercial': { todos: false, subprocesos: [] } }, mapa).error, /Gestión comercial/);

// 4. El servidor solo acepta lo que existe en el catálogo y subprocesos de los macroprocesos elegidos.
assert.deepEqual(validarSolicitudProcesos({ procesos: ['Gestión comercial'], subprocesos: [] }, mapa), { procesos: ['Gestión comercial'], subprocesos: [] });
assert.equal(validarSolicitudProcesos({ procesos: ['Gestión inventada'], subprocesos: [] }, mapa), null);
assert.equal(validarSolicitudProcesos({ procesos: ['Gestión comercial'], subprocesos: ['Nómina'] }, mapa), null, 'Nómina no es de Gestión comercial');
assert.equal(validarSolicitudProcesos({ procesos: [], subprocesos: [] }, mapa), null);
assert.equal(validarSolicitudProcesos({ procesos: ['Gestión comercial'], subprocesos: null }, mapa), null);

// 5. Registro y aprobación usan esta regla; la aprobación acepta subprocesos vacíos (= todos).
const registro = readFileSync(new URL('../api/_auth/register.js', import.meta.url), 'utf8');
assert.ok(registro.includes('validarSolicitudProcesos(solicitud, mapaProcesos)'));
assert.ok(registro.includes('subprocesosSolicitados: solicitudValida.subprocesos'));
const usuarios = readFileSync(new URL('../api/_auth/users.js', import.meta.url), 'utf8');
assert.ok(usuarios.includes('const subprocesosValidos = subprocesos.every('), 'aprobar con "todos los subprocesos"');

console.log('solicitudProcesos.test.js: OK (varios macroprocesos, todos o algunos subprocesos, validación del servidor)');
