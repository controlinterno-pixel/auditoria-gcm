import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { armarPanelIA, contextoMatriz, contextoRiesgo } from '../src/utils/contextoIARiesgos.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const eficacia = control => control.eficacia ?? 70;
const mitigacion = () => 50;
const calculos = { calcularEficacia: eficacia, calcularMitigacion: mitigacion };
const riesgo = (id, extra = {}) => ({
  id, descripcion: `Riesgo ${id}`, macroprocesos: ['Operaciones'],
  probabilidadInherente: 80, impactoInherente: 100, probabilidadResidual: 20, impactoResidual: 40,
  controlesDetallados: [{ descripcion: 'Control', tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', evidencia: 'Con registro' }],
  ...extra,
});

test('sin datos no se inventan cifras: 0 planes vencidos es 0, sin controles es null', () => {
  const datos = contextoMatriz([riesgo(1, { controlesDetallados: [] })], { ...calculos, hallazgos: [], planes: [] });
  assert.equal(datos.auditoria.planesVencidos, 0);
  assert.equal(datos.auditoria.hallazgosTotal, 0);
  assert.equal(datos.metricas.totalControles, 0);
  assert.equal(datos.metricas.eficaciaPromedioControles, null);
  assert.deepEqual(datos.riesgosSinControles.ejemplos, ['RSK-1']);
});

test('planes vencidos reales: fecha pasada y no cerrado', () => {
  const hoy = new Date('2026-10-22T12:00:00');
  const planes = [
    { fecha: '2026-10-01', estadoWorkflow: 'En Ejecución' },
    { fecha: '2026-10-01', estadoWorkflow: 'Cerrado' },
    { fecha: '2026-12-01', estadoWorkflow: 'En Ejecución' },
    { estadoWorkflow: 'En Ejecución' },
  ];
  assert.equal(contextoMatriz([riesgo(1)], { ...calculos, planes, hoy }).auditoria.planesVencidos, 1);
});

test('distribución inherente vs residual y top de exposición con su RSK', () => {
  const datos = contextoMatriz([riesgo(1), riesgo(2, { probabilidadResidual: 80, impactoResidual: 100 })], calculos);
  assert.equal(datos.distribucionInherente.Extremo, 2);
  assert.equal(datos.distribucionResidual.Extremo, 1);
  assert.equal(datos.riesgosMayorExposicionResidual[0].codigo, 'RSK-2');
  assert.equal(datos.procesosMasExpuestos[0].proceso, 'Operaciones');
});

test('ficha del riesgo incluye controles con código y eficacia', () => {
  const datos = contextoRiesgo(riesgo(7), calculos);
  assert.equal(datos.riesgo.codigo, 'RSK-7');
  assert.equal(datos.controles[0].codigo, 'CTL-21');
  assert.equal(datos.controles[0].eficacia, 70);
  assert.equal(datos.riesgo.nivelInherente, 'Extremo');
});

test('las cifras del sistema prevalecen sobre las que escriba la IA', () => {
  const respuesta = JSON.stringify({ analisisEjecutivo: 'Texto', kpis: { scoreRiesgo: '99%' }, headerBadges: { residual: 'INVENTADO' } });
  const panel = JSON.parse(armarPanelIA(respuesta, { badges: { residual: 'BAJO' }, kpis: { scoreRiesgo: '4/25' } }));
  assert.equal(panel.kpis.scoreRiesgo, '4/25');
  assert.equal(panel.headerBadges.residual, 'BAJO');
  assert.equal(panel.analisisEjecutivo, 'Texto');
  assert.equal(JSON.parse(armarPanelIA('no es json', { badges: {}, kpis: {} })).analisisEjecutivo, 'no es json');
});

test('Riesgos ya no inventa cifras ni reescribe porcentajes de la IA', () => {
  const fuente = read('../src/components/Riesgos.jsx');
  for (const relleno of ['|| 613', '|| 72', '|| 47', '|| 19', 'calidad: 90', 'probabilidadInherente: 80,']) {
    assert.equal(fuente.includes(relleno), false, `sin relleno: ${relleno}`);
  }
  assert.equal(/\.replace\(\/3\[0-9\]/.test(fuente), false, 'sin reemplazo de porcentajes con regex');
  const modal = read('../src/components/ModalIA.jsx');
  for (const relleno of ["'36%'", "'62%'", "'95%'", "'90/100'"]) assert.equal(modal.includes(relleno), false, `modal sin ${relleno}`);
});

test('servidor: instrucción de sistema, modo JSON, temperatura y modelo configurable', async () => {
  const fuente = read('../api/_grc/audit.js')
    .replace(/^import [^;]*;\r?\n/gm, '')
    .replace('export default async function handler', 'async function handler');
  const llamadas = [];
  class GoogleGenerativeAI {
    getGenerativeModel(config) {
      return { generateContent: async prompt => { llamadas.push({ config, prompt }); return { response: { text: () => '{"analisisEjecutivo":"ok"}' } }; } };
    }
  }
  const bindings = {
    GoogleGenerativeAI,
    requireAuth: async () => ({ email: 'auditor@example.test' }),
    sendSuccess: (res, data) => { res.data = data; },
    sendError: (res, message, code) => { res.error = { message, code }; },
    applyCors: () => false,
    logger: { error() {} },
    esUrlPermitida: () => true,
  };
  const handler = new Function(...Object.keys(bindings), `${fuente}\nreturn handler;`)(...Object.values(bindings));
  const anterior = { ...process.env };
  process.env.GEMINI_API_KEYS = 'k1';
  process.env.GEMINI_MODELOS = 'modelo-a,modelo-b';
  try {
    const res = {};
    await handler({ method: 'POST', body: { prompt: 'Analiza', datosContexto: { metricas: { totalRiesgos: 3 } }, formato: 'json' } }, res);
    assert.equal(res.data.respuesta, '{"analisisEjecutivo":"ok"}');
    const { config, prompt } = llamadas[0];
    assert.equal(config.model, 'modelo-a');
    assert.match(config.systemInstruction, /No inventes cifras/);
    assert.equal(config.generationConfig.responseMimeType, 'application/json');
    assert.equal(config.generationConfig.temperature, 0.3);
    assert.match(prompt, /<<<DATOS_GRC\n\{"metricas":\{"totalRiesgos":3\}\}\nDATOS_GRC>>>/);
    // Sin formato json la respuesta puede ser texto libre (copiloto, evidencias).
    await handler({ method: 'POST', body: { prompt: 'Texto' } }, {});
    assert.equal(llamadas[1].config.generationConfig.responseMimeType, undefined);
  } finally {
    process.env = anterior;
  }
  assert.equal(read('../api/_grc/audit.js').includes('gemini-1.5-flash'), false);
});
