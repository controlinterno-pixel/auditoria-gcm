// tests/alertasPlanes.test.js - Cada etapa de un plan de acción alerta a un solo rol con la tarea exacta
// (ejecutar, corregir diseño o evidencias, revisar diseño, validar evidencias, evaluar diseño, aprobar cierre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESTADO_AJUSTES_INICIALES, ESTADO_EVALUACION_INICIAL, asuntoTareaPlan, etapaAccionPrograma, tareaPendientePlan } from '../src/utils/programPlanWorkflow.js';

const devuelta = (accion, estado, extra = {}) => ({ id: 1234, estadoWorkflow: estado, historialCambios: [{ accion, motivo: 'Falta soporte' }], ...extra });

test('programa de auditoría: cada etapa le toca a un solo rol', () => {
  const casos = [
    [{ estadoWorkflow: ESTADO_EVALUACION_INICIAL }, 'auditor', 'evaluar-diseno'],
    [{ estadoWorkflow: ESTADO_AJUSTES_INICIALES }, 'ejecutor', 'corregir-diseno'],
    [{ estadoWorkflow: 'En Ejecución', progreso: 40 }, 'ejecutor', 'ejecutar'],
    [{ estadoWorkflow: 'Pendiente Validación Revisor', progreso: 100 }, 'revisor', 'validar-evidencias'],
    [devuelta('Evidencias devueltas por el revisor al ejecutor', 'En Ejecución', { progreso: 90 }), 'ejecutor', 'corregir-evidencias'],
    [{ estadoWorkflow: 'En Revisión (100%)', progreso: 100 }, 'auditor', 'aprobar-cierre'],
    [devuelta('❌ Evidencia rechazada. Motivo: Falta soporte', 'En Ejecución', { progreso: 90 }), 'ejecutor', 'corregir-evidencias'],
    [devuelta('Corrección solicitada', 'Borrador'), 'ejecutor', 'corregir-diseno'],
  ];
  casos.forEach(([plan, rol, tarea]) => assert.deepEqual([tareaPendientePlan(plan, { esPrograma: true })?.rol, tareaPendientePlan(plan, { esPrograma: true })?.tarea], [rol, tarea], plan.estadoWorkflow));
});

test('otros planes: el revisor revisa el diseño y, al 100 %, valida las evidencias', () => {
  const casos = [
    [{ estadoWorkflow: 'Pendiente Revisión Jefatura' }, 'revisor', 'revisar-diseno'],
    [devuelta('Corrección solicitada por el revisor', 'Borrador'), 'ejecutor', 'corregir-diseno'],
    [{ estadoWorkflow: 'En Ejecución', progreso: 10 }, 'ejecutor', 'ejecutar'],
    [{ estadoWorkflow: 'Pendiente Validación Revisor', progreso: 100 }, 'revisor', 'validar-evidencias'],
    [{ estadoWorkflow: 'En Revisión (100%)', progreso: 100 }, 'auditor', 'aprobar-cierre'],
  ];
  casos.forEach(([plan, rol, tarea]) => assert.deepEqual([tareaPendientePlan(plan)?.rol, tareaPendientePlan(plan)?.tarea], [rol, tarea], plan.estadoWorkflow));
});

test('cerrada o No aplica: nadie recibe alertas', () => {
  assert.equal(tareaPendientePlan({ estadoWorkflow: 'Cerrado', estado: 'Cerrado' }), null);
  assert.equal(tareaPendientePlan({ estadoWorkflow: 'No aplica', estado: 'Cerrado' }), null);
});

test('la tarjeta del ejecutor dice "Corrige las evidencias" cuando se las devolvieron, no "Ejecución habilitada"', () => {
  const etapa = etapaAccionPrograma(devuelta('Evidencias devueltas por el revisor al ejecutor', 'En Ejecución', { progreso: 90 }));
  assert.deepEqual([etapa.rol, etapa.boton], ['ejecutor', 'Corregir evidencias']);
  assert.match(etapa.descripcion, /Falta soporte/);
  assert.equal(etapaAccionPrograma({ estadoWorkflow: 'En Ejecución', progreso: 30 }).boton, 'Ejecutar acción');
  assert.equal(etapaAccionPrograma(devuelta('Corrección solicitada', 'Borrador')).rol, 'ejecutor', 'devuelta: no espera al auditor');
});

test('el asunto de cada correo dice la tarea y la acción', () => {
  assert.equal(asuntoTareaPlan('validar-evidencias', { id: 1792000001234 }), 'Validar evidencias · PLA-1234');
  assert.equal(asuntoTareaPlan('corregir-diseno', { id: 7 }), 'Corregir diseño · PLA-7');
  const planes = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  // Ningún correo del flujo de planes sale sin asunto (llegaba "[GRC Termales] Notificación PLA-…").
  const envios = [...planes.matchAll(/enviarNotificacionPlanConReintento\(\{([\s\S]*?)\n\s*\}/g)].map(coincidencia => coincidencia[1]);
  assert.ok(envios.length >= 10, `${envios.length} envíos`);
  envios.forEach(cuerpo => assert.match(cuerpo, /asunto:/, cuerpo.slice(0, 160)));
});

test('la barra y el panel usan la misma regla y reconocen varios ejecutores o revisores', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /correoEn\(p\.correoResponsable\) && !noAplicaPendiente\(hallazgosPorId\.get\(String\(p\.idHallazgo\)\)\) && tareaDePlan\(p\)\?\.rol === 'ejecutor'/);
  assert.match(app, /correoEn\(p\.correoRevisor\) && tareaDePlan\(p\)\?\.rol === 'revisor'/);
  assert.match(app, /esAuditorDelPlan && tareaPendientePlan\(p, \{ esPrograma: esInformePrograma\(informe, fuentesMejora\) \}\)\?\.rol === 'auditor'/);
  assert.match(app, /String\(lista \|\| ''\)\.split\(','\)/);
});

test('al 100 % el auditor cierra con la evaluación de eficacia, nunca con la del diseño (también en programas)', async () => {
  const { pendienteEvaluacionInicial } = await import('../src/utils/programPlanWorkflow.js');
  const antiguo = { estadoWorkflow: 'Pendiente Aprobación Auditor', progreso: 100 };
  assert.equal(pendienteEvaluacionInicial(antiguo), false, 'estado antiguo al 100 %: no es diseño');
  assert.equal(tareaPendientePlan(antiguo, { esPrograma: true }).tarea, 'aprobar-cierre');
  assert.equal(pendienteEvaluacionInicial({ estadoWorkflow: 'Pendiente Aprobación Auditor', progreso: 0 }), true, 'sin ejecutar sí es diseño');
  assert.equal(tareaPendientePlan({ estadoWorkflow: 'En Revisión (100%)', progreso: 100 }, { esPrograma: true }).tarea, 'aprobar-cierre');
  const planes = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  assert.match(planes, /tareaPendientePlan\(plan, \{ esPrograma: esPlanProgramaAuditoria\(plan\) \}\)\?\.tarea === 'evaluar-diseno' && esPlanProgramaAuditoria\(plan\)\) \{/, 'el panel abre la evaluación según la tarea');
  assert.match(planes, /'Aprobar cierre · evaluación de eficacia'/);
  assert.match(planes, /\['En Revisión \(100%\)', 'Pendiente Aprobación Auditor'\]\.includes\(plan\?\.estadoWorkflow\) && Number\(plan\?\.progreso\) === 100/);
  const servidor = readFileSync(new URL('../api/_grc/review-plans.js', import.meta.url), 'utf8');
  assert.match(servidor, /\['En Revisión \(100%\)', 'Pendiente Aprobación Auditor'\]\.includes\(plan\.estadoWorkflow\)/, 'el servidor acepta el cierre con eficacia');
});

test('en Planes de Acción se ven las dos evaluaciones: la inicial del diseño y la de eficacia del cierre', () => {
  const planes = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  assert.match(planes, /⚖️ Evaluación inicial del diseño de acciones/);
  assert.match(planes, /⚖️ Evaluación de eficacia \(cierre\)/);
  assert.match(planes, /Ver evaluación de eficacia/);
  // Incluye las evaluaciones anteriores sin eficacia demostrada (historialEficacia), no solo la última.
  assert.match(planes, /Array\.isArray\(plan\.historialEficacia\) && plan\.historialEficacia\.length/);
});
