// tests/miEspacioLider.test.js - En Mi Espacio el líder de proceso solo ve sus macroprocesos y subprocesos
// habilitados, y solo de los módulos que tiene marcados.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { crearAlcanceLider, esLiderProceso, filtrarMiEspacioLider, opcionesProcesoLider } from '../src/utils/alcanceMiEspacio.js';

const mapaProcesos = {
  'Gestión de servicio al cliente': ['Atención al usuario', 'PQRS'],
  'Gestión comercial y mercadeo': ['Ventas', 'Mercadeo'],
  'Gestión de talento humano': ['Nómina', 'Selección'],
};
const todos = ['inicio', 'sub_mi_espacio', 'auditorias', 'sub_cronograma', 'sub_programas', 'sub_campo', 'riesgos', 'sub_matriz_riesgos',
  'hallazgos', 'sub_informes', 'sub_hallazgos', 'planes', 'sub_seguimiento_planes', 'gobernanza', 'sub_comites'];
// Líder con dos macroprocesos: en servicio al cliente solo PQRS; en comercial ningún subproceso marcado (todo el macroproceso).
const lider = {
  rol: 'lider', permisos: todos,
  procesosAsignados: ['gestion de servicio al cliente', 'gestion comercial y mercadeo'],
  subprocesosAsignados: ['pqrs'],
};
const ids = lista => lista.map(registro => registro.id);

test('solo el rol lider pasa por el filtro', () => {
  assert.equal(esLiderProceso({ rol: 'Lider' }), true);
  for (const rol of ['admin', 'auditor', 'consulta', '']) assert.equal(esLiderProceso({ rol }), false, rol);
});

test('ve sus dos macroprocesos y, donde tiene subprocesos marcados, solo esos', () => {
  const dentro = crearAlcanceLider(lider, mapaProcesos);
  assert.equal(dentro({ proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' }), true);
  assert.equal(dentro({ proceso: 'Gestión de servicio al cliente', subproceso: 'Atención al usuario' }), false, 'otro subproceso del mismo macroproceso');
  assert.equal(dentro({ proceso: 'Gestión comercial y mercadeo', subproceso: 'Ventas' }), true, 'macroproceso sin subprocesos marcados: completo');
  assert.equal(dentro({ proceso: 'Gestión de talento humano', subproceso: 'Nómina' }), false, 'otro macroproceso');
  assert.equal(dentro({ proceso: 'Gestión de servicio al cliente / PQRS' }), true, 'formato antiguo "Macro / Sub"');
  assert.equal(dentro({ macroprocesos: ['Gestión de talento humano', 'Gestión de servicio al cliente'],
    subprocesosPorMacroproceso: { 'Gestión de talento humano': ['Nómina'], 'Gestión de servicio al cliente': ['PQRS'] } }), true);
  assert.equal(crearAlcanceLider({ rol: 'lider' }, mapaProcesos)({ proceso: 'Gestión de talento humano' }), false, 'sin procesos asignados no ve nada');
});

test('un informe con varios procesos no le muestra hallazgos ni planes de los otros subprocesos', () => {
  const listas = {
    informes: [{ id: 'INF-1', macroprocesos: ['Gestión de servicio al cliente', 'Gestión de talento humano'],
      subprocesosPorMacroproceso: { 'Gestión de servicio al cliente': ['PQRS'], 'Gestión de talento humano': ['Nómina'] } }],
    hallazgos: [
      { id: 'H1', idInforme: 'INF-1', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS', estado: 'Abierto' },
      { id: 'H2', idInforme: 'INF-1', proceso: 'Gestión de talento humano', subproceso: 'Nómina', estado: 'Abierto' },
      { id: 'H3', idInforme: 'INF-1', proceso: 'Gestión de servicio al cliente', subproceso: 'Atención al usuario', estado: 'Abierto' },
    ],
    planes: [
      { id: 'P1', idHallazgo: 'H1', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' },
      { id: 'P2', idHallazgo: 'H2', proceso: 'Gestión de talento humano', subproceso: 'Nómina' },
      { id: 'P3', idHallazgo: 'H1' },
      { id: 'P4', idHallazgo: 'H2' },
    ],
  };
  const visto = filtrarMiEspacioLider(lider, mapaProcesos, listas);
  assert.deepEqual(ids(visto.informes), ['INF-1']);
  assert.deepEqual(ids(visto.hallazgos), ['H1']);
  assert.deepEqual(ids(visto.planes), ['P1', 'P3'], 'el plan sin proceso hereda el de su hallazgo');
});

test('riesgos: solo los de su alcance; los de toda la empresa no aparecen en Mi Espacio', () => {
  const riesgos = [
    { id: 'R1', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' },
    { id: 'R2', proceso: 'Gestión de talento humano', subproceso: 'Nómina' },
    { id: 'R3', alcance: 'empresa', proceso: 'Gestión de talento humano' },
    { id: 'R4', alcance: 'macroproceso', macroprocesos: ['Gestión de servicio al cliente'] },
  ];
  const evaluaciones = [{ id: 'E1', idRiesgo: 'R1' }, { id: 'E2', idRiesgo: 'R2' }];
  const visto = filtrarMiEspacioLider({ ...lider, permisos: [...todos, 'riesgos_ver_todos'] }, mapaProcesos, { riesgos, evaluaciones });
  assert.deepEqual(ids(visto.riesgos), ['R1', 'R4'], '"Ver todos los riesgos" no amplía Mi Espacio');
  assert.deepEqual(ids(visto.evaluaciones), ['E1']);
});

test('un módulo sin casilla no aparece en Mi Espacio', () => {
  const listas = {
    riesgos: [{ id: 'R1', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' }],
    cronograma: [{ id: 'C1', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' }],
    hallazgos: [{ id: 'H1', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' }],
    comites: [{ id: 'CO1' }],
  };
  const visto = filtrarMiEspacioLider({ ...lider, permisos: ['inicio', 'sub_mi_espacio', 'hallazgos', 'sub_hallazgos'] }, mapaProcesos, listas);
  assert.deepEqual(ids(visto.hallazgos), ['H1']);
  assert.deepEqual([visto.riesgos, visto.cronograma, visto.comites], [[], [], []]);
  assert.deepEqual(ids(filtrarMiEspacioLider(lider, mapaProcesos, listas).comites), ['CO1'], 'con la casilla Comités se ven');
});

test('el selector del expediente lista solo sus procesos y subprocesos habilitados', () => {
  assert.deepEqual(opcionesProcesoLider(lider, mapaProcesos), [
    'Gestión comercial y mercadeo', 'Gestión de servicio al cliente', 'Subproceso mercadeo', 'Subproceso pqrs', 'Subproceso ventas',
  ]);
});

test('Mi Espacio aplica el filtro solo al rol lider y recibe el perfil desde App', () => {
  const miEspacio = readFileSync(new URL('../src/components/MiEspacio.jsx', import.meta.url), 'utf8');
  assert.match(miEspacio, /esLiderProceso\(perfilUsuario\)/);
  assert.match(miEspacio, /filtrarMiEspacioLider\(/);
  assert.match(miEspacio, /opcionesProcesoLider\(/);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /<MiEspacio[\s\S]{0,400}perfilUsuario=\{perfilUsuario\}/);
});
