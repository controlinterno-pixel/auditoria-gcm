// Revisión de los prompts de IA: reglas del manual, datos exactos del sistema y sin plantillas genéricas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { armarPanelIA, contextoMatriz, contextoRiesgo } from '../src/utils/contextoIARiesgos.js';
import { contextoTarjetaDashboard, mitigacionRiesgo } from '../src/utils/contextoIADashboard.js';
import { calcularEficaciaControl } from '../src/utils/explicacionControles.js';

const leer = ruta => readFileSync(new URL(ruta, import.meta.url), 'utf8');
let pruebas = 0;
const prueba = (nombre, fn) => { fn(); pruebas += 1; };
const calculos = { calcularEficacia: calcularEficaciaControl, calcularMitigacion: mitigacionRiesgo };

const rsk196 = { id: 196, descripcion: 'Pérdida por quiebra de entidad financiera', macroprocesos: ['Gestión Administrativa y Financiera'],
  probabilidadInherente: 100, impactoInherente: 100, probabilidadResidual: 60, impactoResidual: 100, planAccionRiesgo: '', fechaSeguimiento: '',
  controlesDetallados: [{ descripcion: 'Diversificación de recursos', tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' }] };
const evaluaciones = [{ id: Date.parse('2026-08-05T15:00:00Z'), idRiesgo: '196', control: 'CTL-196-1', calificacion: 50, diseno: 'Adecuado', ejecucion: 'Inefectiva', proceso: 'Gestión Administrativa y Financiera' }];

prueba('la instrucción general incluye las reglas del Manual E-GE-MAN-001', () => {
  const audit = leer('../api/_grc/audit.js');
  for (const regla of ['E-GE-MAN-001', 'Tabla 4', 'Tabla 6', 'Tabla 8', 'Numeral 9', 'impacto Catastrófico el riesgo es Extremo', 'analisisSistema', 'cumplimientoNumeral9']) {
    assert.ok(audit.includes(regla), `falta en la instrucción general: ${regla}`);
  }
  assert.ok(audit.includes('NO plan de acción'), 'Moderado o Bajo no exige plan de acción');
  assert.ok(audit.includes('Esa escala se aplica SOLO al promedio'), 'un control no se califica con la escala del promedio');
  assert.ok(audit.includes('nunca van con prioridad BAJA'), 'obligaciones del numeral 9 no van en BAJA');
  assert.ok(audit.includes('di a qué alcance corresponde'), 'cada cifra con su alcance');
  assert.ok(audit.includes('No escribas en el texto los nombres internos'), 'sin nombres internos');
  assert.ok(audit.includes('Cada recomendación debe tener su acción'), 'plan coherente con recomendaciones');
  assert.ok(audit.includes('redacta cada acción como una tarea'), 'acciones redactadas como tareas');
  assert.ok(audit.includes('No inventes numerales ni secciones'), 'citas exactas del manual');
  assert.ok(audit.includes('Solo llama "obligatorio"'), 'sin obligaciones inventadas');
  assert.ok(audit.includes('propongas 100 % de mitigación') && audit.includes('nunca inventes una meta'), 'metas alcanzables');
  assert.ok(leer('../src/components/Riesgos.jsx').includes('sobre ESTE control'), 'mejoras del propio control auditado');
  assert.equal(audit.includes('HALLAZGO grave'), false, 'la sugerencia de hallazgo no debe pedir exagerar la gravedad');
});

prueba('ISO, COSO y KRIs son opcionales (sin texto genérico)', () => {
  const motor = leer('../src/services/aiEngine.js');
  assert.match(motor, /"iso31000": "solo si aporta algo específico/);
  assert.equal(motor.includes('calcularMetricasMatematicas'), false, 'no debe quedar el cálculo de métricas falsas');
});

prueba('el dictamen por riesgo recibe el análisis exacto del sistema y las pruebas de campo', () => {
  const datos = contextoRiesgo(rsk196, { ...calculos, evaluaciones });
  assert.ok(datos.analisisSistema.porQueQuedaEnSuZona.some(linea => linea.includes('Con impacto Catastrófico')));
  assert.ok(datos.analisisSistema.pendientes.some(linea => linea.startsWith('Plan de acción')));
  assert.ok(datos.analisisSistema.pendientes.some(linea => linea.startsWith('CTL-196-1 fue reprobado en Trabajo de Campo')));
  assert.ok(datos.analisisSistema.simulacionDeMejoras.some(linea => linea.includes('correctivo')));
  assert.equal(datos.metricas.alcance, 'Solo el riesgo RSK-196 (no toda la matriz)');
  assert.deepEqual(datos.pruebasTrabajoDeCampo[0], { control: 'CTL-196-1', calificacion: 50, fecha: '2026-08-05', diseno: 'Adecuado', ejecucion: 'Inefectiva' });
});

prueba('el informe global recibe el cumplimiento del numeral 9', () => {
  const datos = contextoMatriz([rsk196], { ...calculos, evaluaciones });
  assert.deepEqual(datos.cumplimientoNumeral9.extremoOAltoSinPlanDeAccion, { total: 1, riesgos: ['RSK-196'] });
  assert.deepEqual(datos.cumplimientoNumeral9.conControlesReprobadosEnTrabajoDeCampo, { total: 1, riesgos: ['RSK-196'] });
});

prueba('Dashboard GRC: cada tarjeta envía registros con identificador y sus propios indicadores', () => {
  const hoy = new Date('2026-10-24T12:00:00');
  const planes = [
    { id: 1792000001234, accion: 'Actualizar inventario', responsable: 'Líder Administrativa', fecha: '2026-09-01', progreso: 40, idHallazgo: 'h1' },
    { id: 1792000005678, accion: 'Capacitar cajeros', responsable: 'Líder Comercial', fecha: '2026-12-01', progreso: 100, idHallazgo: 'h1' },
  ];
  const hallazgos = [{ id: 'h1', ref: 'HAL-2026-001', titulo: 'Inventario desactualizado', proceso: 'Cadena de abastecimiento', severidad: 'Alta', estado: 'Abierto', fecha: '2026-08-01' },
    { id: 'h2', ref: 'HAL-2026-002', titulo: 'Sin conciliación', proceso: 'Financiera', severidad: 'Media', estado: 'Abierto', fecha: '2026-09-01' }];
  const planesCtx = contextoTarjetaDashboard('planes', { planes, hallazgos, hoy });
  assert.equal(planesCtx.datos.resumen.vencidos, 1);
  assert.equal(planesCtx.datos.planesVencidosMasAntiguos[0].plan, 'PLA-1234');
  assert.equal(planesCtx.datos.planesVencidosMasAntiguos[0].proceso, 'Cadena de abastecimiento');
  assert.equal(planesCtx.indicadores[2].etiqueta, 'Vencidos');
  const hallazgosCtx = contextoTarjetaDashboard('hallazgos', { planes, hallazgos, hoy });
  assert.deepEqual(hallazgosCtx.datos.abiertosSinPlan, ['HAL-2026-002']);
  assert.equal(hallazgosCtx.datos.abiertosPrioritarios[0].hallazgo, 'HAL-2026-001');
  const controlesCtx = contextoTarjetaDashboard('controles', { evaluaciones, hoy });
  assert.equal(controlesCtx.datos.pruebasReprobadas[0].control, 'CTL-196-1');
  const riesgosCtx = contextoTarjetaDashboard('riesgos', { riesgos: [rsk196], evaluaciones, hoy });
  assert.equal(riesgosCtx.datos.cumplimientoNumeral9.extremoOAltoSinPlanDeAccion.total, 1);
});

prueba('el copiloto ya no usa la plantilla con niveles y confianza inventados', () => {
  const copiloto = leer('../src/handlers/auditorIaHandler.js');
  for (const inventado of ['Confianza del Análisis: 98%', 'Nivel de Riesgo Operativo: Alto', 'Urgencia de Intervención: Alta']) {
    assert.equal(copiloto.includes(inventado), false, `queda texto inventado: ${inventado}`);
  }
  assert.ok(copiloto.includes('contextoTarjetaDashboard'), 'debe enviar los resúmenes con identificadores');
});

prueba('el panel de riesgos muestra etiquetas que dicen lo que mide cada cifra', () => {
  const panel = JSON.parse(armarPanelIA('{}', { badges: {}, kpis: { scoreRiesgo: '3/25', scoreMadurez: 38, totalControles: 7, coberturaControles: 96 } }));
  assert.deepEqual(panel.indicadores.map(i => `${i.etiqueta}=${i.valor}`), ['Puntaje residual=3/25', 'Eficacia prom.=38%', 'Controles=7', 'Mitigación=96%']);
});

prueba('el responsable del control es el del riesgo cuando el control no tiene uno propio', () => {
  const datos = contextoRiesgo({ ...rsk196, responsable: ['Líder Financiera'] }, { ...calculos, evaluaciones: [] });
  assert.equal(datos.controles[0].responsable, 'Líder Financiera');
});

console.log(`promptsIA.test.js: ${pruebas} pruebas OK`);
