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

// PLA-0073 / PLA-0074 (29/10/2026): con el diseño aprobado, un administrador cambió el ejecutor y guardó la matriz;
// las acciones volvieron a la evaluación inicial y el aprobador tuvo que evaluar el diseño otra vez.
import { disenoProgramaAprobado, reenvioErroneoAEvaluacion } from '../src/utils/programPlanWorkflow.js';

test('aprobado el diseño, ningún guardado lo devuelve a la evaluación inicial', () => {
  for (const estado of ['En Ejecución', 'Pendiente Validación Revisor', 'En Revisión (100%)', 'Cerrado']) {
    assert.equal(disenoProgramaAprobado({ estadoWorkflow: estado }), true, estado);
  }
  for (const estado of [ESTADO_EVALUACION_INICIAL, ESTADO_AJUSTES_INICIALES, 'Borrador']) {
    assert.equal(disenoProgramaAprobado({ estadoWorkflow: estado }), false, `${estado}: el diseño aún se corrige y vuelve a evaluarse`);
  }
  const planes = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  assert.match(planes, /const cambiaDisenoPrograma = esProgramaInforme && !isNew && !disenoProgramaAprobado\(planOriginal\)/);
  assert.match(planes, /accion: 'Actividad modificada en matriz', \.\.\.\(detalleCambios\.length \? \{ detalleCambios \} : \{\}\)/);
  const update = readFileSync(new URL('../api/_grc/update.js', import.meta.url), 'utf8');
  assert.match(update, /const reenviaRevision = esPrograma\s+\? corrigeDisenoInicial && camposCambiados\.length > 0/);
});

test('las acciones que un guardado de la matriz devolvió a evaluación se pueden restaurar', () => {
  const aprobado = { accion: 'Diseño aprobado (100%). Ejecución habilitada por el auditor asignado.' };
  const matriz = { usuario: 'Auditor', accion: 'Actividad modificada en matriz' };
  const pla0073 = { estadoWorkflow: ESTADO_EVALUACION_INICIAL, progreso: 100, correoResponsable: 'auditor.interno@termales.com.co', historialCambios: [aprobado, matriz] };
  assert.equal(reenvioErroneoAEvaluacion(pla0073).destino, 'Pendiente Validación Revisor');
  assert.match(reenvioErroneoAEvaluacion(pla0073).motivo, /guardado de la matriz/);
  const validada = { ...pla0073, historialCambios: [aprobado, { accion: 'Ejecución al 100% validada por el revisor y enviada al aprobador' }, matriz] };
  assert.equal(reenvioErroneoAEvaluacion(validada).destino, 'En Revisión (100%)', 'ya validada: a la evaluación de eficacia');
  const pla0074 = { ...pla0073, progreso: 50 };
  assert.equal(reenvioErroneoAEvaluacion(pla0074).destino, 'En Ejecución');
  // Un rechazo del diseño que se está corrigiendo no se restaura: ese sí se vuelve a evaluar.
  const rechazado = { ...pla0073, historialCambios: [aprobado, { accion: 'Diseño no aprobado (79%). Devuelto para correcciones.' }, matriz] };
  assert.equal(reenvioErroneoAEvaluacion(rechazado), null);
  assert.equal(reenvioErroneoAEvaluacion({ ...pla0073, historialCambios: [matriz] }), null, 'nunca aprobado: se evalúa normalmente');
});

test('el avance lo registra solo el ejecutor, aunque el revisor o el aprobador sean administradores', () => {
  const planes = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');
  assert.match(planes, /const puedeEditarAvance = [^;]*esResponsableActividad && act\.estadoWorkflow === 'En Ejecución';/);
  assert.doesNotMatch(planes, /const puedeEditarAvance = [^;]*isAdmin/, 'ser administrador ya no habilita el avance');
  const update = readFileSync(new URL('../api/_grc/update.js', import.meta.url), 'utf8');
  assert.match(update, /if \(camposCambiados\.includes\('progreso'\) && !esEjecutorDelPlan\) return \{ error: 'progress-owner-only' \};/);
});
