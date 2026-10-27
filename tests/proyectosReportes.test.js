// tests/proyectosReportes.test.js - Los reportes usan las mismas cifras que el módulo, escapan el contenido
// y el módulo queda integrado en Gobernanza & IA con su casilla de permiso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirReporte, htmlReporte, TIPOS_REPORTE } from '../src/utils/proyectos/reportes.js';
import { calcularIndicadores, compactarPlan } from '../src/utils/proyectos/indicadores.js';
import { SUBMODULOS_POR_MODULO, puedeVerSubmodulo } from '../src/utils/permisosVista.js';

const plan = {
  tareas: [
    { id: 1, codigo: 'T-001', titulo: 'Vencida', tipo: 'actividad', estado: 'en_curso', prioridad: 'alta', avance: 50, inicio: '2026-03-01', fin: '2026-03-05' },
    { id: 2, codigo: 'T-002', titulo: 'Hecha en la semana', tipo: 'actividad', estado: 'completada', prioridad: 'media', avance: 100, inicio: '2026-03-01', fin: '2026-03-08', finReal: '2026-03-08' },
    { id: 3, codigo: 'T-003', titulo: 'Futura', tipo: 'actividad', estado: 'pendiente', prioridad: 'media', avance: 0, inicio: '2026-03-20', fin: '2026-03-25' },
  ],
  cambios: [
    { codigo: 'SC-001', titulo: 'Dentro', estado: 'aprobada', fechaDecision: '2026-03-09', solicitante: 'a', aprobador: 'b' },
    { codigo: 'SC-002', titulo: 'Fuera', estado: 'rechazada', fechaDecision: '2026-01-01', solicitante: 'a', aprobador: 'b' },
  ],
};
const proyecto = { codigo: 'PRY-2026-001', estado: 'ejecucion', ficha: { nombre: '<b>ERP</b>', metodologia: 'predictiva' }, miembros: { director: 'd@termales.com.co' } };
const hoy = '2026-03-10';
const ind = calcularIndicadores(proyecto, hoy, compactarPlan(plan));
const periodo = { desde: '2026-03-04', hasta: '2026-03-10' };

test('tareas vencidas del reporte = indicador del módulo', () => {
  const { secciones } = construirReporte('vencidas', { proyecto, plan, ind, hoy, periodo });
  assert.equal(secciones[0].filas.length, ind.tareasVencidas);
  assert.equal(secciones[0].filas[0][0], 'T-001');
});

test('el informe semanal y el de cambios respetan el periodo', () => {
  const semanal = construirReporte('semanal', { proyecto, plan, ind, hoy, periodo });
  assert.deepEqual(semanal.secciones.find(s => s.titulo === 'Tareas completadas en el periodo').filas.map(f => f[0]), ['T-002']);
  const cambios = construirReporte('cambios', { proyecto, plan, ind, hoy, periodo });
  assert.deepEqual(cambios.secciones[0].filas.map(f => f[0]), ['SC-001']);
});

test('todos los reportes se generan y el HTML escapa el contenido del usuario', () => {
  Object.keys(TIPOS_REPORTE).forEach(tipo => assert.ok(construirReporte(tipo, { proyecto, plan, ind, hoy, periodo }).secciones.length > 0, tipo));
  const html = htmlReporte(construirReporte('ficha', { proyecto, plan, ind, hoy, periodo }), ['Generado el 10/03/2026', 'Origen: GCM']);
  assert.doesNotMatch(html, /<b>ERP<\/b>/);
  assert.match(html, /&lt;b&gt;ERP&lt;\/b&gt;/);
  assert.match(html, /Origen: GCM/);
});

test('navegación: Gestión de Proyectos está en Gobernanza & IA y respeta la casilla', () => {
  assert.ok(SUBMODULOS_POR_MODULO.gobernanza.includes('sub_proyectos'));
  assert.equal(puedeVerSubmodulo(['gobernanza'], 'sub_proyectos'), false);
  assert.equal(puedeVerSubmodulo(['gobernanza', 'sub_proyectos'], 'sub_proyectos'), true);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /subTabGobernanza === 'proyectos' && puedeVerProyectos/);
  assert.match(app, /lazyWithReload\(\(\) => import\('\.\/components\/proyectos\/GestionProyectos'\)\)/, 'se carga aparte, sin engordar la carga inicial');
  const menu = readFileSync(new URL('../src/components/SidebarNavigation.jsx', import.meta.url), 'utf8');
  assert.match(menu, /setSubTabGobernanza\('proyectos'\)\)[^>]*>[\s\S]*?Gestión de Proyectos/);
  const configuracion = readFileSync(new URL('../src/components/Configuracion.jsx', import.meta.url), 'utf8');
  assert.match(configuracion, /\{ id: 'sub_proyectos', label: 'Gestión de Proyectos' \}/);
});

test('formatos del manual: muestran la aprobación registrada como firma y los apartados que no aplican', () => {
  const conAprobacion = { ...proyecto, codigoEstrategico: 'E1_SP1_PY1', ficha: { ...proyecto.ficha, pilar: 'E' },
    solicitudesEstado: [{ destino: 'factibilidad', estado: 'aprobada', decididaPor: 'gerencia@termales.com.co', fechaDecision: '2026-02-01', solicitante: 'd@termales.com.co' }] };
  const planFormulacion = { ...plan, secciones: { pestel: { datos: { noAplica: { justificacion: 'Proyecto interno sin mercado externo' } } } } };
  const formato1 = construirReporte('formato1', { proyecto: conAprobacion, plan: planFormulacion, ind, hoy, periodo });
  assert.match(formato1.secciones.at(-1).texto, /Aprobado electrónicamente por gerencia@termales\.com\.co/);
  assert.equal(formato1.secciones[0].filas[0][1], 'E1_SP1_PY1 (pilar Económico)');
  const formato2 = construirReporte('formato2', { proyecto: conAprobacion, plan: planFormulacion, ind, hoy, periodo });
  assert.match(formato2.secciones.find(s => s.titulo === '7.1 Análisis PESTEL').texto, /No aplica: Proyecto interno/);
  assert.equal(formato2.secciones.at(-1).texto, 'Pendiente de aprobación.', 'la factibilidad aún no se aprueba');
  ['formato3', 'formato4'].forEach(tipo => assert.ok(construirReporte(tipo, { proyecto: conAprobacion, plan: planFormulacion, ind, hoy, periodo }).secciones.length > 5, tipo));
});
