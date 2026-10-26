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

test('Configuración muestra el paquete básico a usuarios antiguos; un usuario nuevo aprobado solo ve Riesgos', async () => {
  const configuracion = readFileSync(new URL('../src/components/Configuracion.jsx', import.meta.url), 'utf8');
  assert.match(configuracion, /const userPermisos = permisosEfectivos\(u\);/);
  const usuarios = readFileSync(new URL('../api/_auth/users.js', import.meta.url), 'utf8');
  assert.match(usuarios, /permisos: PERMISOS_NUEVOS_USUARIOS/);
  const { PERMISOS_NUEVOS_USUARIOS } = await import('../src/utils/permisosVista.js');
  assert.deepEqual(PERMISOS_NUEVOS_USUARIOS, ['riesgos', 'sub_matriz_riesgos', 'sub_apetito']);
  assert.equal(puedeVerSubmodulo(PERMISOS_NUEVOS_USUARIOS, 'sub_matriz_riesgos'), true);
  for (const otro of ['sub_mi_espacio', 'sub_hallazgos', 'sub_informes', 'sub_seguimiento_planes', 'sub_comites']) {
    assert.equal(puedeVerSubmodulo(PERMISOS_NUEVOS_USUARIOS, otro), false, `${otro} no se ve`);
  }
  assert.equal(PERMISOS_NUEVOS_USUARIOS.includes('planes'), false, 'sin módulo Planes');
  assert.equal(PERMISOS_NUEVOS_USUARIOS.includes('riesgos_ver_todos'), false, 'solo los riesgos de sus macroprocesos');
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

test('matriz de riesgos: el líder ve solo sus macroprocesos salvo la casilla "Ver todos los riesgos"', async () => {
  const { riesgosVisiblesPara, PERMISO_VER_TODOS_RIESGOS } = await import('../src/utils/permisosVista.js');
  const riesgos = [
    { id: 1, macroprocesos: ['Gestión Administrativa y Financiera'] },
    { id: 2, proceso: 'Gestión de la cadena de abastecimiento / Compras' },
    { id: 3, macroprocesos: ['Gestión comercial', 'Gestión Administrativa y Financiera'] },
    { id: 4, macroproceso: 'Gestión del Talento Humano' },
  ];
  const ids = lista => lista.map(riesgo => riesgo.id);
  const lider = { permisos: ['riesgos', 'sub_matriz_riesgos'], procesosAsignados: ['gestión administrativa y financiera'] };
  assert.deepEqual(ids(riesgosVisiblesPara(riesgos, lider)), [1, 3], 'solo los de su macroproceso (sin importar mayúsculas)');
  // Como los entrega el servidor (obtenerProcesosAsignados): en minúsculas y SIN tildes.
  const { obtenerProcesosAsignados } = await import('../api/_lib/assignmentScope.js');
  const procesosServidor = obtenerProcesosAsignados({ procesosAsignados: ['Gestión Administrativa y Financiera'] });
  assert.deepEqual(procesosServidor, ['gestion administrativa y financiera']);
  assert.deepEqual(ids(riesgosVisiblesPara(riesgos, { permisos: [], procesosAsignados: procesosServidor })), [1, 3], 'coincide aunque el servidor quite las tildes');
  assert.deepEqual(ids(riesgosVisiblesPara(riesgos, { ...lider, procesosAsignados: ['Gestión de la cadena de abastecimiento'] })), [2], 'proceso escrito como "Macro / Sub"');
  assert.deepEqual(ids(riesgosVisiblesPara(riesgos, { ...lider, permisos: [...lider.permisos, PERMISO_VER_TODOS_RIESGOS] })), [1, 2, 3, 4], 'con la casilla ve todos');
  assert.deepEqual(ids(riesgosVisiblesPara(riesgos, { veTodo: true })), [1, 2, 3, 4], 'administrador o auditor');
  assert.deepEqual(ids(riesgosVisiblesPara(riesgos, { permisos: [], procesosAsignados: [] })), [1, 2, 3, 4], 'sin macroprocesos asignados: acceso global');
  // El servidor aplica la misma regla (no solo la pantalla).
  const leer = archivo => readFileSync(new URL(`../api/_grc/${archivo}`, import.meta.url), 'utf8');
  assert.ok(leer('sync.js').includes('riesgos: riesgosVisiblesPara(data.riesgos'), 'sync filtra la matriz');
  assert.ok(leer('riesgos.js').includes('riesgosVisiblesPara('), 'GET /api/grc/riesgos filtra la matriz');
});

test('sin la casilla del módulo "Planes de Acción" no se ve el módulo, ni siquiera las tareas propias', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("const puedeVerModuloPlanes = isAdmin || esAuditorConsulta || permisosUsuario.includes('planes');"));
  assert.ok(app.includes('tienePlanesPropios={puedeVerModuloPlanes && planesDelModulo.length > 0}'), 'el menú no aparece por tener tareas');
  assert.ok(app.includes("{subTabPlanes === 'planes' && puedeVerModuloPlanes && ("), 'la pantalla no se dibuja');
  assert.ok(app.includes('misTareasAprobacion={puedeVerModuloPlanes ? misTareasAprobacion : 0}'), 'sin avisos de tareas');
});
