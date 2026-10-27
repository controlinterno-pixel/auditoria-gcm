// tests/proyectosDominio.test.js - Reglas de negocio, cronograma e indicadores de Gestión de Proyectos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { duracion, sumarDias } from '../src/utils/proyectos/fechas.js';
import { requisitosTransicion, rolesEnProyecto, validarFicha, validarMiembros, validarTarea } from '../src/utils/proyectos/modelo.js';
import { compararConLineaBase, crearLineaBase, detectarCiclo, erroresEstructura, holguras, propagarDependencias } from '../src/utils/proyectos/cronograma.js';
import { avancePorContenedor, calcularIndicadores, compactarPlan } from '../src/utils/proyectos/indicadores.js';

const tarea = (id, extra = {}) => ({
  id, titulo: `T${id}`, tipo: 'actividad', estado: 'pendiente', prioridad: 'media', avance: 0, inicio: '2026-03-02', fin: '2026-03-06', ...extra,
});

test('fechas: calendario laboral salta fines de semana', () => {
  assert.equal(sumarDias('2026-03-06', 1, 'laboral'), '2026-03-09'); // viernes + 1 hábil = lunes
  assert.equal(duracion('2026-03-02', '2026-03-08', 'laboral'), 5);
  assert.equal(duracion('2026-03-02', '2026-03-08'), 7);
});

test('ficha: obligatorios, fechas incoherentes y presupuesto', () => {
  const { errores } = validarFicha({ nombre: '', metodologia: 'x', prioridad: 'alta', inicioPlanificado: '2026-05-01', finPlanificado: '2026-04-01', manejaPresupuesto: true });
  assert.ok(errores.includes('Escribe el nombre del proyecto.'));
  assert.ok(errores.some(error => /metodología/.test(error)));
  assert.ok(errores.includes('La fecha planificada de fin no puede ser anterior a la de inicio.'));
  assert.ok(errores.some(error => /presupuesto aprobado/.test(error)));
  const valida = validarFicha({ nombre: 'ERP', objetivoGeneral: 'x', metodologia: 'hibrida', prioridad: 'alta', inicioPlanificado: '2026-01-01', finPlanificado: '2026-12-31' });
  assert.deepEqual(valida.errores, []);
  assert.equal(valida.ficha.presupuestoAprobado, null, 'sin presupuesto no se inventa un monto');
});

test('miembros: solo correos corporativos y patrocinador distinto del director', () => {
  const { errores } = validarMiembros({ director: 'a@termales.com.co', patrocinador: 'A@termales.com.co', equipo: 'x@gmail.com' });
  assert.ok(errores.some(error => /x@gmail\.com/.test(error)));
  assert.ok(errores.some(error => /patrocinador debe ser una persona distinta/.test(error)));
  const roles = rolesEnProyecto({ miembros: { director: 'a@termales.com.co', aprobadores: ['b@termales.com.co'] } }, 'B@termales.com.co');
  assert.deepEqual([...roles], ['aprobador']);
});

test('tareas: el avance no es arbitrario y completar exige los criterios de aceptación', () => {
  assert.ok(validarTarea(tarea(1, { avance: 30 })).some(error => /pendiente no puede tener avance/.test(error)));
  assert.ok(validarTarea(tarea(1, { estado: 'en_curso', avance: 100 })).some(error => /100 % solo se registra al completar/.test(error)));
  assert.ok(validarTarea(tarea(1, { estado: 'bloqueada', avance: 10 })).some(error => /qué bloquea/.test(error)));
  const sinCumplir = tarea(1, { estado: 'completada', avance: 100, criteriosAceptacion: [{ texto: 'Probado', cumplido: false }] });
  assert.ok(validarTarea(sinCumplir).some(error => /criterio\(s\) de aceptación/.test(error)));
  assert.deepEqual(validarTarea({ ...sinCumplir, criteriosAceptacion: [{ texto: 'Probado', cumplido: true }] }), []);
  assert.ok(validarTarea(tarea(2, { tipo: 'hito', fin: '2026-03-07' })).some(error => /hito es un punto/.test(error)));
});

test('cronograma: ciclos y dependencias imposibles se rechazan', () => {
  const tareas = [tarea(1, { dependencias: [{ id: 2 }] }), tarea(2, { dependencias: [{ id: 1 }] })];
  assert.deepEqual(detectarCiclo(tareas), ['1', '2', '1']);
  assert.ok(erroresEstructura(tareas).some(error => /ciclo imposible/.test(error)));
  assert.ok(erroresEstructura([tarea(1, { dependencias: [{ id: 1 }] })]).some(error => /sí misma/.test(error)));
  assert.ok(erroresEstructura([tarea(1, { dependencias: [{ id: 9 }] })]).some(error => /no existe/.test(error)));
});

test('cronograma: mover una predecesora empuja a sus sucesoras conservando la duración', () => {
  const tareas = [
    tarea(1, { inicio: '2026-03-02', fin: '2026-03-10' }),
    tarea(2, { inicio: '2026-03-07', fin: '2026-03-09', dependencias: [{ id: 1 }] }),
    tarea(3, { inicio: '2026-03-10', fin: '2026-03-10', dependencias: [{ id: 2, desfase: 2 }] }),
  ];
  const { tareas: nuevas, movidas } = propagarDependencias(tareas);
  assert.deepEqual(nuevas.map(t => [t.inicio, t.fin]), [['2026-03-02', '2026-03-10'], ['2026-03-11', '2026-03-13'], ['2026-03-16', '2026-03-16']]);
  assert.equal(movidas.length, 2);
  const cerrada = propagarDependencias([tareas[0], { ...tareas[1], estado: 'completada' }]);
  assert.equal(cerrada.movidas.length, 0, 'lo ya terminado no se reprograma');
});

test('ruta crítica: la cadena más larga tiene holgura 0 y la paralela corta tiene holgura', () => {
  const tareas = [
    tarea(1, { inicio: '2026-03-02', fin: '2026-03-06' }),
    tarea(2, { inicio: '2026-03-07', fin: '2026-03-16', dependencias: [{ id: 1 }] }),
    tarea(3, { inicio: '2026-03-07', fin: '2026-03-08', dependencias: [{ id: 1 }] }),
  ];
  const holgura = holguras(tareas);
  assert.equal(holgura.get('1'), 0);
  assert.equal(holgura.get('2'), 0);
  assert.equal(holgura.get('3'), 8);
});

test('línea base: conserva las fechas aprobadas y mide el atraso', () => {
  const base = crearLineaBase([tarea(1)], { version: 1, establecidaPor: 'a@termales.com.co', fecha: '2026-03-01' });
  const comparacion = compararConLineaBase([tarea(1, { fin: '2026-03-09' })], base);
  assert.equal(comparacion[0].base.fin, '2026-03-06');
  assert.equal(comparacion[0].atrasoDias, 3);
});

test('indicadores con datos conocidos: avance ponderado por esfuerzo, desviación, hitos y vencidas', () => {
  const plan = {
    tareas: [
      tarea(1, { esfuerzoHoras: 30, estado: 'completada', avance: 100, inicio: '2026-03-02', fin: '2026-03-04', finReal: '2026-03-04' }),
      tarea(2, { esfuerzoHoras: 10, estado: 'en_curso', avance: 50, inicio: '2026-03-05', fin: '2026-03-09' }),
      tarea(3, { tipo: 'hito', inicio: '2026-03-06', fin: '2026-03-06' }),
      tarea(4, { tipo: 'fase', inicio: '', fin: '' }),
    ],
    entregables: [{ fechaComprometida: '2026-03-05', estado: 'aprobado' }, { fechaComprometida: '2026-03-08', estado: 'presentado' }],
    riesgos: [{ tipo: 'riesgo', estado: 'abierto', probabilidad: 4, impacto: 4 }, { tipo: 'riesgo', estado: 'abierto', probabilidad: 2, impacto: 2 }],
  };
  plan.lineasBase = [crearLineaBase(plan.tareas, { version: 1 })];
  const resumen = compactarPlan(plan);
  assert.equal(resumen.tareas.length, 3, 'la fase no pesa por sí misma');
  const ind = calcularIndicadores({ estado: 'ejecucion', ficha: {}, actualizadoEn: '2026-03-10' }, '2026-03-10', resumen);
  assert.equal(ind.avanceReal, 87.5); // (30×100 + 10×50) ÷ 40
  assert.equal(ind.avancePlanificado, 100);
  assert.equal(ind.desviacionAvance, -12.5);
  assert.equal(ind.tareasVencidas, 1);
  assert.equal(ind.hitosVencidos, 1);
  assert.equal(ind.cumplimientoHitos, 0);
  assert.equal(ind.cumplimientoEntregables, 50);
  assert.equal(ind.entregablesPendientesAprobacion, 1);
  assert.equal(ind.riesgosCriticos, 1);
  assert.equal(ind.semaforo.color, 'rojo', 'hito vencido y riesgo crítico, aunque el avance sea alto');
});

test('finanzas: sin presupuesto no hay cifras; sin costos reales no hay EVM', () => {
  const sinPresupuesto = calcularIndicadores({ estado: 'ejecucion', ficha: { manejaPresupuesto: false } }, '2026-03-10', compactarPlan({ tareas: [tarea(1)] }));
  assert.equal(sinPresupuesto.costoReal, null);
  assert.equal(sinPresupuesto.variacionPresupuestal, null);
  const plan = { tareas: [tarea(1, { estado: 'en_curso', avance: 50 })], costos: [{ tipo: 'comprometido', monto: 500 }] };
  plan.lineasBase = [crearLineaBase(plan.tareas, { version: 1 })];
  const proyecto = { estado: 'ejecucion', ficha: { manejaPresupuesto: true, presupuestoAprobado: 1000 }, presupuestoVigente: 1000 };
  const sinReales = calcularIndicadores(proyecto, '2026-03-04', compactarPlan(plan));
  assert.equal(sinReales.evm, null, 'sin costos reales no se muestran SPI ni CPI');
  assert.equal(sinReales.variacionPresupuestal, null);
  plan.costos.push({ tipo: 'real', monto: 600 });
  const conReales = calcularIndicadores(proyecto, '2026-03-04', compactarPlan(plan));
  assert.equal(conReales.disponible, -100);
  assert.equal(conReales.evm.cpi, 0.83); // EV 500 ÷ AC 600
  assert.equal(conReales.origenProyeccion, 'evm');
  assert.equal(conReales.variacionPresupuestal, 20); // EAC = 1000 ÷ (500/600) = 1200 → +20 %
  assert.equal(conReales.consumoPresupuesto, 110); // (600 + 500) ÷ 1000: gastado a la fecha, no el costo final
  const conEstimacion = calcularIndicadores(proyecto, '2026-03-04', compactarPlan({ ...plan, estimadoFinal: { monto: 950 } }));
  assert.equal(conEstimacion.origenProyeccion, 'estimacion');
  assert.equal(conEstimacion.variacionPresupuestal, -5);
  const sinLineaBase = calcularIndicadores(proyecto, '2026-03-04', compactarPlan({ ...plan, lineasBase: [] }));
  assert.equal(sinLineaBase.variacionPresupuestal, null, 'sin estimación ni EVM no se inventa una proyección');
});

test('avance por fase y requisitos para cambiar de estado', () => {
  const tareas = [tarea('f', { tipo: 'fase', inicio: '', fin: '' }), tarea(1, { padreId: 'f', esfuerzoHoras: 10, estado: 'en_curso', avance: 40 }), tarea(2, { padreId: 'f', esfuerzoHoras: 30, estado: 'pendiente', avance: 0 })];
  assert.equal(avancePorContenedor(tareas).get('f'), 10);
  assert.deepEqual(requisitosTransicion({ estado: 'ejecucion' }, {}, 'planificacion'), ['No se puede pasar de "Inversión · Ejecución" a "Inversión · Planificación".']);
  const faltan = requisitosTransicion({ estado: 'planificacion', ficha: { metodologia: 'predictiva' } }, { tareas }, 'ejecucion');
  assert.ok(faltan.some(texto => /línea base/.test(texto)));
  assert.ok(faltan.some(texto => /Apartado 12 \(Matriz de interesados\)/.test(texto)), 'el Acta de constitución exige los apartados 12 a 17');
  const agil = requisitosTransicion({ estado: 'planificacion', ficha: { metodologia: 'agil' } }, { tareas }, 'ejecucion');
  assert.equal(agil.some(texto => /línea base/.test(texto)), false, 'un proyecto ágil no exige línea base');
  const entrega = requisitosTransicion({ estado: 'ejecucion' }, { tareas }, 'operacion');
  assert.ok(entrega.some(texto => /tarea\(s\) sin completar/.test(texto)), 'para entregar a la operación el trabajo debe estar cerrado');
  const cierre = requisitosTransicion({ estado: 'operacion' }, { tareas }, 'cerrado');
  assert.ok(cierre.some(texto => /Lecciones aprendidas/.test(texto)));
  assert.ok(cierre.some(texto => /Documentación pendiente/.test(texto)));
});
