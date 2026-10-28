// tests/correccionInicial.test.js - Al corregir el diseño devuelto en la evaluación inicial (programas de
// auditoría), el ejecutor solo ve sus acciones devueltas; las aprobadas quedan ocultas y bloqueadas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTADO_AJUSTES_INICIALES, accionesEnCorreccionInicial } from '../src/utils/programPlanWorkflow.js';

const planes = [
  { id: 1, estadoWorkflow: 'En Ejecución', correoResponsable: 'ejecutor@termales.com.co' },
  { id: 2, estadoWorkflow: ESTADO_AJUSTES_INICIALES, correoResponsable: 'Ejecutor@termales.com.co' },
  { id: 3, estadoWorkflow: ESTADO_AJUSTES_INICIALES, correoResponsable: 'otra@termales.com.co' },
  { id: 4, estadoWorkflow: ESTADO_AJUSTES_INICIALES, correoResponsable: 'otra@termales.com.co, ejecutor@termales.com.co' },
  null,
];

test('solo las acciones devueltas asignadas al ejecutor', () => {
  assert.deepEqual(accionesEnCorreccionInicial(planes, 'ejecutor@termales.com.co').map(plan => plan.id), [2, 4]);
  assert.deepEqual(accionesEnCorreccionInicial(planes, 'nadie@termales.com.co'), [], 'sin devueltas: el plan se ve completo');
  assert.deepEqual(accionesEnCorreccionInicial(planes, ''), []);
});

test('la matriz oculta las demás acciones, los otros hallazgos, "Sí/No aplica" y "Agregar acción" en corrección', () => {
  const fuente = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  assert.match(fuente, /if \(isAdmin \|\| modoRevisionMatriz \|\| modoConsultaPlan \|\| !formInformeId\) return null;/, 'administrador, revisión y consulta ven todo');
  assert.match(fuente, /if \(idsEnCorreccionInicial && !idsEnCorreccionInicial\.has\(String\(act\.id\)\)\) return null;/);
  assert.match(fuente, /if \(idsEnCorreccionInicial && !\(node\.actividades \|\| \[\]\)\.some\(/);
  assert.match(fuente, /\{!modoRevisionMatriz && !idsEnCorreccionInicial && \(\s*<button type="button" onClick=\{\(\) => handleAddActivity/);
  assert.equal((fuente.match(/\(!modoRevisionMatriz\) && !idsEnCorreccionInicial && !\['Aprobado', 'Pendiente'\]/g) || []).length, 2);
});
