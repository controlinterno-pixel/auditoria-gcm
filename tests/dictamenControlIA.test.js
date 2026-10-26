// tests/dictamenControlIA.test.js - Dictamen por control: plan determinista + revisor de la redacción de la IA.
import assert from 'node:assert/strict';
import test from 'node:test';
import { analizarControlEnRiesgo, pruebasDeCampoDelRiesgo } from '../src/utils/explicacionRiesgoDetallada.js';
import { contextoRiesgo } from '../src/utils/contextoIARiesgos.js';
import { calcularEficaciaControl, calcularResiduales } from '../src/utils/explicacionControles.js';
import { explicarRiesgoDetallado } from '../src/utils/explicacionRiesgoDetallada.js';
import { contextoMatriz } from '../src/utils/contextoIARiesgos.js';
import { generarDictamenControl, limpiarRespuestaIA, planDeLaMatriz, planDelControl, planDelRiesgo, revisarRespuestaIA } from '../src/utils/dictamenControlIA.js';

const preparar = (riesgo, indice, evaluaciones = []) => {
  Object.assign(riesgo, calcularResiduales(riesgo.probabilidadInherente, riesgo.impactoInherente, riesgo.controlesDetallados));
  const ctx = contextoRiesgo(riesgo, { calcularEficacia: calcularEficaciaControl, calcularMitigacion: () => 50, evaluaciones });
  const { simulacion, ...analisis } = analizarControlEnRiesgo(riesgo, indice, { pruebasCampo: pruebasDeCampoDelRiesgo(evaluaciones, riesgo.id) });
  const plan = planDelControl({ riesgo, simulacion, control: ctx.controles[indice], ficha: ctx.riesgo, evaluaciones });
  return { ctx, analisis, plan };
};

// RSK-49 real: dos preventivos manuales, impacto Catastrófico (zona Extremo), sin plan registrado.
const rsk49 = () => ({
  id: 49, proceso: 'Gestión comercial', responsable: 'Dirección Comercial', probabilidadInherente: 80, impactoInherente: 100,
  controlesDetallados: [
    { tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' },
    { tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Aleatoria', evidencia: 'Con registro' },
  ],
});

test('Extremo: el plan obligatorio y la acción que cambia la zona son ALTA; la primera prueba de campo es MEDIA', () => {
  const { plan } = preparar(rsk49(), 0);
  assert.deepEqual(plan.planAccion.map(p => p.prioridad), ['ALTA', 'ALTA', 'MEDIA', 'BAJA']);
  assert.match(plan.planAccion[0].accion, /plan de acción de RSK-49/);
  assert.match(plan.planAccion[1].accion, /^Agregar 2 controles correctivos manuales a RSK-49/, 'la acción que deja la zona más baja');
  assert.match(plan.planAccion[2].accion, /primera prueba de Trabajo de Campo de CTL-49-1/);
  assert.ok(plan.planAccion.every(p => p.responsable === 'Dirección Comercial'));
  assert.equal(plan.recomendaciones.length, plan.planAccion.length, 'una recomendación por acción');
  assert.match(plan.recomendaciones[0], /porque está en zona residual Extremo sin plan registrado/, 'nombra la zona real, no "Extremo o Alto"');
  assert.ok(plan.recomendaciones.every((rec, i) => rec !== plan.planAccion[i].accion), 'la recomendación no repite la tabla');
  assert.match(plan.kris, /Impacto residual de RSK-49: actual 100 % · meta 56 % \(zona Moderado\)/);
});

test('cada atributo faltante del control auditado tiene su acción; frecuencia aleatoria incluida', () => {
  const { plan } = preparar(rsk49(), 1);
  assert.ok(plan.planAccion.some(p => p.prioridad === 'MEDIA' && /frecuencia continua para CTL-49-2/.test(p.accion)));
  assert.equal(plan.planAccion.some(p => /CTL-49-1/.test(p.accion)), false, 'no recomienda formalizar otro control');
});

test('Bajo con responsable "Sin Asignar": seguimiento del numeral 9 en MEDIA y líder del proceso como responsable', () => {
  const riesgo = {
    id: 62, proceso: 'Gestión del Talento Humano', responsable: 'Sin Asignar', probabilidadInherente: 40, impactoInherente: 40,
    controlesDetallados: [
      { tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Aleatoria', evidencia: 'Con registro', responsable: 'Sin Asignar' },
      { tipo: 'Preventivo', implementacion: 'Automático', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' },
      { tipo: 'Correctivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' },
    ],
  };
  const { plan } = preparar(riesgo, 0);
  assert.equal(plan.planAccion.some(p => p.prioridad === 'ALTA'), false, 'en Bajo nada es ALTA');
  assert.ok(plan.planAccion.some(p => p.prioridad === 'MEDIA' && /fecha de seguimiento de RSK-62/.test(p.accion)));
  assert.ok(plan.planAccion.some(p => /Asignar un responsable a CTL-62-1/.test(p.accion)));
  assert.ok(plan.planAccion.every(p => p.responsable === 'Líder de Gestión del Talento Humano'));
});

test('control reprobado en campo: primera acción ALTA con la observación del auditor y KRI de calificación', () => {
  const riesgo = {
    id: 71, proceso: 'Financiero', responsable: 'Tesorero', probabilidadInherente: 80, impactoInherente: 60,
    controlesDetallados: [
      { tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' },
      { tipo: 'Detectivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' },
    ],
  };
  const { plan } = preparar(riesgo, 1, [{ idRiesgo: 71, control: 'CTL-71-2', calificacion: 60, comentarios: 'No hay conciliaciones de julio' }]);
  assert.equal(plan.planAccion[0].prioridad, 'ALTA');
  assert.match(plan.planAccion[0].accion, /Corregir la falla de operación de CTL-71-2/);
  assert.match(plan.recomendaciones[0], /«No hay conciliaciones de julio»/);
  assert.match(plan.kris, /Calificación de CTL-71-2 en Trabajo de Campo: actual 60 % · meta 100 %/);
});

const datos = { texto: 'probabilidad 29 % e impacto 100 %, queda en 28,8 %' };
const codigosValidos = ['RSK-49', 'CTL-49-1', 'CTL-49-2'];

test('revisor: detecta códigos y cifras inventadas, la escala atribuida al manual, la "ausencia de pruebas" y nombres internos', () => {
  const tipos = revisarRespuestaIA({
    analisisEjecutivo: 'CTL-49-1 baja la probabilidad a 29 %. Es Bueno según la escala del manual. CTL-49-9 aporta 33 %.',
    dictamenDirector: 'Hay que corregir la ausencia de pruebas que muestra analisisDelControl.',
  }, { datos, codigosValidos }).map(p => p.tipo).sort();
  assert.deepEqual(tipos, ['ausencia-de-pruebas-como-falla', 'cifra-sin-respaldo', 'codigo-inexistente', 'escala-atribuida-al-manual', 'nombre-interno']);
  assert.deepEqual(revisarRespuestaIA({ analisisEjecutivo: 'CTL-49-2 deja la probabilidad en 28,8 % y la Tabla 6 le da 40 %.' }, { datos, codigosValidos }), []);
  const apetito = revisarRespuestaIA({ cosoErm: 'RSK-49 supera el apetito de riesgo de la organización.' }, { datos, codigosValidos });
  assert.deepEqual(apetito.map(p => p.tipo), ['concepto-sin-respaldo'], 'apetito no definido en los datos');
  assert.deepEqual(revisarRespuestaIA({ cosoErm: 'Supera el apetito.' }, { datos: { apetito: 'Bajo' }, codigosValidos }), [], 'con apetito en los datos sí se acepta');
  const limpia = limpiarRespuestaIA({ analisisEjecutivo: 'CTL-49-1 baja la probabilidad a 29 %. CTL-49-9 aporta 33 %.' }, { datos, codigosValidos });
  assert.equal(limpia.analisisEjecutivo, 'CTL-49-1 baja la probabilidad a 29 %.');
});

test('generarDictamenControl: reintenta una vez indicando los errores, luego recorta, y nunca deja el análisis vacío', async () => {
  const plan = { planAccion: [{ prioridad: 'ALTA', accion: 'X', responsable: 'Y' }], recomendaciones: ['X — motivo'], kris: 'K' };
  const instrucciones = [];
  const malo = JSON.stringify({ analisisEjecutivo: 'CTL-49-9 aporta 33 %.', dictamenDirector: 'Bien.' });
  const bueno = JSON.stringify({ analisisEjecutivo: 'CTL-49-1 deja la probabilidad en 29 %.', dictamenDirector: 'Bien.', observacionCausaRaiz: 'Ataca la causa inmediata.' });
  const corregido = await generarDictamenControl({
    consultar: async ({ instruccion }) => { instrucciones.push(instruccion); return instrucciones.length === 1 ? malo : bueno; },
    instruccion: 'Redacta', datos, codigosValidos, plan, respaldo: 'Texto del sistema.',
  });
  assert.equal(instrucciones.length, 2);
  assert.match(instrucciones[1], /código que no existe en los datos: CTL-49-9/);
  assert.equal(corregido.analisisEjecutivo, 'CTL-49-1 deja la probabilidad en 29 %.\n\nCausa raíz: Ataca la causa inmediata.');
  assert.deepEqual(corregido.planAccion, plan.planAccion, 'el plan es del sistema, no de la IA');
  assert.equal(corregido.kris, 'K');

  const siempreMalo = await generarDictamenControl({ consultar: async () => malo, instruccion: 'Redacta', datos, codigosValidos, plan, respaldo: 'Texto del sistema.' });
  assert.equal(siempreMalo.analisisEjecutivo, 'Texto del sistema.', 'si todo se recorta, queda el texto del sistema');
  const noJson = await generarDictamenControl({ consultar: async () => 'no es json', instruccion: 'Redacta', datos, codigosValidos, plan, respaldo: 'Texto del sistema.' });
  assert.equal(noJson.analisisEjecutivo, 'Texto del sistema.');
});

test('dictamen del riesgo: mismas prioridades y la misma acción que el dictamen del control', () => {
  const riesgo = rsk49();
  Object.assign(riesgo, calcularResiduales(riesgo.probabilidadInherente, riesgo.impactoInherente, riesgo.controlesDetallados));
  const datos = contextoRiesgo(riesgo, { calcularEficacia: calcularEficaciaControl, calcularMitigacion: () => 64 });
  const { simulacion } = explicarRiesgoDetallado(riesgo);
  const plan = planDelRiesgo({ riesgo, simulacion, ficha: datos.riesgo, controles: datos.controles });
  assert.deepEqual(plan.planAccion.slice(0, 2).map(p => p.accion), ['Formular y registrar el plan de acción de RSK-49.', 'Agregar 2 controles correctivos manuales a RSK-49.']);
  assert.ok(plan.planAccion.slice(0, 2).every(p => p.prioridad === 'ALTA'));
  assert.ok(plan.planAccion.some(p => p.prioridad === 'MEDIA' && /primera prueba de Trabajo de Campo de CTL-49-1 y CTL-49-2/.test(p.accion)));
  assert.ok(plan.planAccion.some(p => /Formalizar CTL-49-2: frecuencia aleatoria/.test(p.accion)));
  assert.equal(plan.planAccion[plan.planAccion.length - 1].prioridad, 'BAJA');
  assert.match(plan.kris, /Mitigación de RSK-49: actual 64 % · meta 80 %/);
  assert.match(plan.kris, /formalizados: actual 1 de 2 · meta 2 de 2/);
  const delControl = preparar(rsk49(), 0).plan.planAccion.map(p => p.accion);
  assert.ok(delControl.includes('Agregar 2 controles correctivos manuales a RSK-49.'), 'el panel del control propone lo mismo');
});

test('informe de la matriz: incumplimientos del numeral 9 con sus RSK y metas exigidas por el manual', () => {
  const extremo = rsk49();
  const conReprobado = {
    id: 62, proceso: 'Gestión del Talento Humano', responsable: 'Líder TH', probabilidadInherente: 40, impactoInherente: 40,
    controlesDetallados: [{ tipo: 'Correctivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' }],
  };
  [extremo, conReprobado].forEach(r => Object.assign(r, calcularResiduales(r.probabilidadInherente, r.impactoInherente, r.controlesDetallados)));
  const evaluaciones = [{ idRiesgo: 62, control: 'CTL-62-1', calificacion: 50 }];
  const plan = planDeLaMatriz(contextoMatriz([extremo, conReprobado], { calcularEficacia: calcularEficaciaControl, calcularMitigacion: () => 50, evaluaciones }));
  assert.deepEqual(plan.planAccion.map(p => p.prioridad), ['ALTA', 'ALTA', 'MEDIA']);
  assert.match(plan.planAccion[0].accion, /plan de acción de 1 riesgo \(RSK-49\)/);
  assert.match(plan.recomendaciones[0], /porque está en zona residual/, 'concordancia en singular');
  assert.match(plan.planAccion[1].accion, /controles reprobados .* \(RSK-62\)/);
  assert.match(plan.kris, /Riesgos Extremo o Alto con plan de acción: actual 0 de 1 · meta 1 de 1 \(numeral 9\)/);
});
