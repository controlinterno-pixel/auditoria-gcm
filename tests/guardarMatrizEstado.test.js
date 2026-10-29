// tests/guardarMatrizEstado.test.js - "Guardar matriz y sincronizar" no deshace un rechazo del diseño hecho con la
// matriz abierta (PLA-0075, 29/10/2026: rechazo 7:43:21 y "Actividad modificada en matriz" 7:43:56).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  disenoCambiadoEnMatriz, disenoCargadoMatriz, estadoAlGuardarMatriz, ESTADO_AJUSTES_INICIALES, ESTADO_EVALUACION_INICIAL,
} from '../src/utils/programPlanWorkflow.js';

const diseno = {
  accion: 'Errores operativos y en la toma de decisiones', sede: 'Sede Administrativa', responsable: 'ANALISTA CONTROL INTERNO',
  correoResponsable: 'analista.controlinterno@termales.com.co', revisor: 'ANALISTA DE AUDITORIA', correoRevisor: 'analista.auditoria@termales.com.co',
  auditorAsignado: 'JEFE DE CONTROL INTERNO', correoAuditor: 'controlinterno@termales.com.co', fechaInicio: '2026-10-27', fecha: '2026-10-31',
  tipoAccion: 'Acción Correctiva', progreso: 0,
};

test('la copia vieja del formulario no devuelve a evaluación una acción rechazada', () => {
  const copiaFormulario = { ...diseno, estadoWorkflow: ESTADO_EVALUACION_INICIAL };
  const vigente = { ...diseno, estadoWorkflow: ESTADO_AJUSTES_INICIALES, motivoRechazo: 'Diseño no aprobado (79%)' };
  assert.equal(estadoAlGuardarMatriz({ planVigente: vigente, actividad: copiaFormulario, esPrograma: true }), ESTADO_AJUSTES_INICIALES);
  // Lo mismo con una aprobación: la matriz abierta antes no la deshace.
  assert.equal(estadoAlGuardarMatriz({ planVigente: { ...diseno, estadoWorkflow: 'En Ejecución' }, actividad: copiaFormulario, esPrograma: true }), 'En Ejecución');
});

test('las reglas propias de la matriz se mantienen', () => {
  assert.equal(estadoAlGuardarMatriz({ planVigente: null, actividad: diseno, esPrograma: true }), ESTADO_EVALUACION_INICIAL, 'acción nueva');
  assert.equal(estadoAlGuardarMatriz({ planVigente: { estadoWorkflow: ESTADO_AJUSTES_INICIALES }, actividad: diseno, esPrograma: true, cambiaDiseno: true }),
    ESTADO_EVALUACION_INICIAL, 'el diseño corregido vuelve a evaluación');
  assert.equal(estadoAlGuardarMatriz({ planVigente: { estadoWorkflow: 'En Ejecución' }, actividad: { ...diseno, progreso: 100 } }), 'Pendiente Validación Revisor');
  assert.equal(estadoAlGuardarMatriz({ planVigente: { estadoWorkflow: 'En Ejecución' }, actividad: { ...diseno, progreso: 100, revisorNoAplica: true } }), 'En Revisión (100%)');
  assert.equal(estadoAlGuardarMatriz({ planVigente: { estadoWorkflow: 'En Revisión (100%)' }, actividad: { ...diseno, progreso: 90 } }), 'En Ejecución');
});

test('solo cuenta como corrección del diseño lo que la persona cambió en el formulario', () => {
  // Al abrir, la matriz completa el auditor heredado del informe: eso no es una corrección del diseño.
  const cargada = { ...diseno, correoAuditor: 'controlinterno@termales.com.co' };
  const cargado = disenoCargadoMatriz(cargada);
  assert.equal(disenoCambiadoEnMatriz(cargado, cargada), false);
  assert.equal(disenoCambiadoEnMatriz(cargado, { ...cargada, matrizRiesgos: undefined }), false, 'matriz vacía = No aplica');
  assert.equal(disenoCambiadoEnMatriz(cargado, { ...cargada, accion: 'Acción corregida' }), true);
  assert.equal(disenoCambiadoEnMatriz(cargado, { ...cargada, fecha: '2026-11-15' }), true);
});

test('Guardar matriz usa el estado vigente y el diseño cargado', () => {
  const planes = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  assert.match(planes, /const workflowCalculado = estadoAlGuardarMatriz\(\{\s+planVigente: isNew \? null : planOriginal, actividad: act/);
  assert.match(planes, /disenoCambiadoEnMatriz\(act\.disenoCargado \|\| disenoCargadoMatriz\(planOriginal\), act\)/);
  assert.match(planes, /return \{ \.\.\.actividad, disenoCargado: disenoCargadoMatriz\(actividad\) \};/);
  assert.doesNotMatch(planes, /let workflowCalculado = act\.estadoWorkflow/, 'el estado ya no sale de la copia del formulario');
});
