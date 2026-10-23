// tests/permisosVista.test.js - Las casillas de Configuración deciden qué pantallas ve cada usuario.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { combinarPlanesVisibles, esPlanDelUsuario, PERMISOS_BASICOS, permisosEfectivos, puedeVerSubmodulo } from '../src/utils/permisosVista.js';

test('un submódulo se ve solo con su casilla y la de su módulo', () => {
  // Configuración de Cristian (servicio al cliente) en la captura del 23/10.
  const cristian = ['inicio', 'sub_mi_espacio', 'riesgos', 'sub_matriz_riesgos', 'sub_apetito', 'hallazgos', 'planes'];
  assert.equal(puedeVerSubmodulo(cristian, 'sub_mi_espacio'), true);
  assert.equal(puedeVerSubmodulo(cristian, 'sub_dashboard'), false);
  assert.equal(puedeVerSubmodulo(cristian, 'sub_matriz_riesgos'), true);
  assert.equal(puedeVerSubmodulo(cristian, 'sub_informes'), false, 'módulo marcado pero submódulo no');
  assert.equal(puedeVerSubmodulo(cristian, 'sub_hallazgos'), false);
  assert.equal(puedeVerSubmodulo(cristian, 'sub_incidentes'), false);
  assert.equal(puedeVerSubmodulo(cristian, 'sub_seguimiento_planes'), false);
  assert.equal(puedeVerSubmodulo(['sub_hallazgos'], 'sub_hallazgos'), false, 'submódulo marcado con el módulo desmarcado');
  assert.equal(puedeVerSubmodulo([], 'sub_informes', true), true, 'administrador ve todo');
});

test('sin permisos guardados rige el paquete básico (el mismo que muestra Configuración)', () => {
  assert.deepEqual(permisosEfectivos({}), PERMISOS_BASICOS);
  assert.deepEqual(permisosEfectivos({ permisos: [] }), [], 'una lista vacía guardada es explícita');
  assert.equal(puedeVerSubmodulo(permisosEfectivos({}), 'sub_hallazgos'), true);
  assert.equal(puedeVerSubmodulo(permisosEfectivos({}), 'sub_matriz_riesgos'), false);
});

test('Configuración y la aprobación de usuarios usan el mismo paquete básico', () => {
  const configuracion = readFileSync(new URL('../src/components/Configuracion.jsx', import.meta.url), 'utf8');
  assert.match(configuracion, /const userPermisos = permisosEfectivos\(u\);/);
  const usuarios = readFileSync(new URL('../api/_auth/users.js', import.meta.url), 'utf8');
  assert.match(usuarios, /permisos: PERMISOS_BASICOS/);
});

test('solo sus tareas: ve los planes donde está asignado y al guardar no se pierden los demás', () => {
  const planes = [
    { id: 1, correoResponsable: 'servicioalcliente@termales.com.co' },
    { id: 2, correoRevisor: 'SERVICIOALCLIENTE@termales.com.co ' },
    { id: 3, correoResponsable: 'otro@termales.com.co' },
  ];
  const propio = plan => esPlanDelUsuario(plan, 'servicioalcliente@termales.com.co');
  assert.deepEqual(planes.filter(propio).map(plan => plan.id), [1, 2]);
  assert.equal(esPlanDelUsuario(planes[2], ''), false);
  const guardado = combinarPlanesVisibles(planes, visibles => visibles.map(plan => ({ ...plan, progreso: 50 })), propio);
  assert.deepEqual(guardado.map(plan => [plan.id, plan.progreso]), [[3, undefined], [1, 50], [2, 50]], 'el plan 3 se conserva');
  assert.deepEqual(combinarPlanesVisibles(planes, [planes[0]], propio).map(plan => plan.id), [3, 1], 'borrar uno visible no toca los demás');
});

test('servidor: el auditor consulta todo, pero guardar la base completa e históricos es solo del administrador', () => {
  const sync = readFileSync(new URL('../api/_grc/sync.js', import.meta.url), 'utf8');
  assert.match(sync, /if \(!esAdministradorPleno\) \{\s*logger\.warn\('Intento de escritura RLS denegado'/);
  const historico = readFileSync(new URL('../api/_grc/historico.js', import.meta.url), 'utf8');
  assert.equal((historico.match(/if \(!esAdministradorPleno\)/g) || []).length, 2, 'cargar y eliminar');
  for (const archivo of ['create', 'update', 'review-plans', 'register-email', 'catalogo-cargos']) {
    const fuente = readFileSync(new URL(`../api/_grc/${archivo}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(fuente, /\['admin', 'administrador', 'auditor'\]/, `${archivo}.js ya no trata al auditor como administrador`);
  }
});
