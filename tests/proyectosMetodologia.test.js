// tests/proyectosMetodologia.test.js - El módulo sigue el Manual Metodológico E-ID-MAN-01: ciclo de vida
// completo con sus aprobaciones, apartados, RACI, documentos por fase, análisis financiero y lecciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarAccion, crearProyecto } from '../api/_lib/proyectosAcciones.js';
import { van, tir, periodoRecuperacionDescontado, periodoRecuperacionSimple, ingresoPeriodo, roi, roiDescontado, aniosYMeses, textoAniosYMeses, tasaEfectivaAnual, alertasFinancieras, resumenFinanciero } from '../src/utils/proyectos/financiero.js';
import { FINANCIERO_EJEMPLO, INGRESOS_EJEMPLO } from '../scripts/datosFinancierosEjemplo.js';
import { DOCUMENTO, codigoEstrategico, erroresRaci, estadoDocumento, estrategiaInteresado, nombreArchivoDocumento } from '../src/utils/proyectos/metodologia.js';

const usuario = (nombre, extra = {}) => ({ email: `${nombre}@termales.com.co`, rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'], ...extra });
const DIRECTOR = usuario('director');
const GERENCIA = usuario('gerencia');
const COMITE = usuario('comite');
const EQUIPO = usuario('equipo');
let secuencia = 0;
const ctx = (persona, hoy = '2026-03-10') => ({ usuario: persona, ahora: `${hoy}T15:00:00.000Z`, hoy, generarId: () => `id${++secuencia}`, codigo: 'PRY-2026-001' });

function sesion() {
  let { proyecto, plan } = crearProyecto({
    ficha: { nombre: 'Sendero ecológico', objetivoGeneral: 'Abrir un nuevo producto de naturaleza', objetivosEspecificos: ['Diseñar el recorrido', 'Capacitar guías'], metodologia: 'predictiva', prioridad: 'alta',
      inicioPlanificado: '2026-03-01', finPlanificado: '2026-06-30', problema: 'Baja ocupación entre semana', justificacion: 'Diversificar la oferta', alcanceIncluido: 'Diseño y apertura',
      alcanceExcluido: 'Hospedaje', dependenciasRestricciones: 'Permiso de la CAR', criteriosExito: '500 visitantes en 3 meses', pilar: 'A', numPrograma: 2, numProyecto: 3 },
    miembros: { patrocinador: GERENCIA.email, comite: [COMITE.email], equipo: [EQUIPO.email] },
  }, ctx(DIRECTOR));
  const s = {
    get proyecto() { return proyecto; },
    get plan() { return plan; },
    hacer(persona, accion, datos, hoy) {
      ({ proyecto, plan } = aplicarAccion(proyecto, plan, accion, datos, ctx(persona, hoy)));
      return s;
    },
    seccion(nombre, datos) { return s.hacer(DIRECTOR, 'guardarSeccion', { seccion: nombre, datos, versionBase: plan.secciones?.[nombre]?.version }); },
    aprobar(destino, aprobador = GERENCIA) {
      s.hacer(DIRECTOR, 'solicitarEstado', { destino, motivo: `Solicitud de ${destino}` });
      const solicitud = proyecto.solicitudesEstado.find(item => item.estado === 'pendiente');
      return s.hacer(aprobador, 'decidirEstado', { idSolicitud: solicitud.id, decision: 'aprobada', comentario: 'Aprobado' });
    },
  };
  return s;
}

test('portafolio: el código E/S/A–SP–PY sigue el Capítulo II del manual', () => {
  assert.equal(codigoEstrategico({ pilar: 'E', numPrograma: 1, numSubprograma: 1, numProyecto: 1 }), 'E1_SP1_PY1');
  assert.equal(codigoEstrategico({ pilar: 'A', numPrograma: 2, numProyecto: 3 }), 'A2_PY3', 'sin subprograma');
  assert.equal(codigoEstrategico({ pilar: 'X', numPrograma: 1, numProyecto: 1 }), '');
  assert.equal(sesion().proyecto.codigoEstrategico, 'A2_PY3');
});

test('ciclo de vida completo del manual con sus aprobaciones', () => {
  const s = sesion();
  // Preinversión · Prefactibilidad: apartados 1 a 5.
  s.seccion('alternativas', { lista: [{ nombre: 'Sendero corto', descripcion: '2 km' }, { nombre: 'Sendero largo', descripcion: '5 km', seleccionada: true }] });
  s.seccion('entorno', { descripcion: 'Bosque de niebla junto a las piscinas' });
  s.seccion('aspectos', { permisos: 'Permiso de aprovechamiento de la CAR' });
  s.seccion('cronogramaFases', { preinversion: { inicio: '2026-01-01', fin: '2026-02-28' }, inversion: { inicio: '2026-03-01', fin: '2026-06-30' }, operacion: { inicio: '2026-07-01', fin: '2026-07-31' } });
  s.aprobar('factibilidad');
  assert.equal(s.proyecto.estado, 'factibilidad');

  // Factibilidad: apartados 6 a 11; los que no aplican se justifican.
  s.seccion('pestel', { factores: ['P', 'E', 'S', 'T', 'EC', 'L'].map(letra => ({ letra, hecho: `Factor ${letra}`, fuente: 'DANE', fechaFuente: '2026-01-15', tipo: 'oportunidad', importancia: 2, valoracion: 4 })) });
  s.seccion('propuestaValor', { segmento: 'Turistas de naturaleza', tareas: 'Desconectarse', dolores: 'Aglomeraciones', motivadores: 'Naturaleza', productos: 'Sendero guiado', calmantes: 'Grupos pequeños', detonantes: 'Avistamiento de aves' });
  s.seccion('modeloNegocio', { noAplica: { justificacion: 'El sendero se integra a la tarifa actual: no crea un modelo de negocio nuevo.' } });
  s.seccion('ingresos', { periodos: [{ periodo: 'Mes 1', clientes: 500, precio: 20000, ajuste: -10 }], supuestos: 'Ocupación de temporada baja' });
  s.seccion('localizacion', { ubicacion: 'Lote norte', capacidad: '30 personas por grupo' });
  s.seccion('ingenieria', { tipos: ['infraestructura', 'inventado'], proceso: 'Recorrido guiado de 2 horas' });
  s.seccion('organizacional', { preinversion: 'Líder de I+D+i', inversion: 'Director y contratista', operacion: 'Guías' });
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'planificacion', motivo: 'x' }), /Apartado 11/);
  s.seccion('financiero', { unidadPeriodo: 'anio', tasaDescuento: 12, flujos: [{ periodo: 0, egresos: 100000000 }, { periodo: 1, ingresos: 60000000 }, { periodo: 2, ingresos: 60000000 }] });
  assert.deepEqual(s.plan.secciones.ingenieria.datos.tipos, ['infraestructura'], 'solo se guardan opciones válidas');
  s.aprobar('planificacion', COMITE);
  assert.equal(s.proyecto.estado, 'planificacion', 'el Comité I+D+i también aprueba fases');

  // Inversión · planificación: apartados 12 a 17, luego la firma del Acta de constitución.
  const fase = s.hacer(DIRECTOR, 'guardarTarea', { tarea: { titulo: 'Construcción', tipo: 'paquete', prioridad: 'alta', estado: 'pendiente', avance: 0 } }).plan.tareas[0];
  s.hacer(DIRECTOR, 'guardarTarea', { tarea: { titulo: 'Obra civil', tipo: 'actividad', padreId: fase.id, prioridad: 'alta', estado: 'pendiente', avance: 0, inicio: '2026-03-02', fin: '2026-03-20', responsable: EQUIPO.email } });
  s.hacer(DIRECTOR, 'guardarTarea', { tarea: { titulo: 'Apertura', tipo: 'hito', prioridad: 'alta', estado: 'pendiente', avance: 0, inicio: '2026-03-23', fin: '2026-03-23' } });
  s.hacer(DIRECTOR, 'establecerLineaBase', { motivo: 'Cronograma aprobado' });
  s.hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', descripcion: 'Lluvias', probabilidad: 4, impacto: 3, estado: 'abierto' } });
  s.seccion('interesados', { lista: [{ nombre: 'Junta de acción comunal', tipo: 'externo', poder: 4, interes: 5, actitud: 'neutral' }] });
  s.seccion('organigrama', { roles: [{ fase: 'inversion', rol: 'Director del proyecto', persona: 'director' }] });
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'ejecucion', motivo: 'x' }), /Apartado 15 \(Matriz RACI\)/);
  s.seccion('raci', { roles: ['Director', 'Contratista'], filas: { [`T:${fase.id}`]: { Director: 'A', Contratista: 'R' }, 'T:inexistente': { Director: 'A' } } });
  assert.deepEqual(Object.keys(s.plan.secciones.raci.datos.filas), [`T:${fase.id}`], 'la RACI solo guarda elementos de la EDT');
  s.aprobar('ejecucion');
  assert.equal(s.proyecto.estado, 'ejecucion');
  assert.equal(s.proyecto.ficha.inicioReal, '2026-03-10');
  assert.equal(estadoDocumento(DOCUMENTO.formato3, s.proyecto, s.plan), 'app', 'el Acta de constitución queda firmada con la aprobación');

  // Ejecución → Operación y cierre → Acta de cierre.
  s.plan.tareas.filter(tarea => tarea.tipo !== 'paquete').forEach(tarea => s.hacer(DIRECTOR, 'guardarTarea', { tarea: { id: tarea.id, versionBase: s.plan.tareas.find(t => t.id === tarea.id).version, estado: 'completada', avance: 100 } }));
  s.aprobar('operacion');
  assert.equal(s.proyecto.estado, 'operacion');
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'cerrado', motivo: 'x' }), /Entrega a la operación[\s\S]*Lecciones aprendidas[\s\S]*Acta de cierre/);
  s.seccion('transferencia', { areaReceptora: 'Operaciones', responsableOperacion: 'Jefe de operaciones', fechaEntrega: '2026-07-01', capacitaciones: 'Guías certificados' });
  s.seccion('lecciones', { lista: [{ categoria: 'contractual', tipo: 'delta', fase: 'inversion', situacion: 'El permiso tardó 2 meses', recomendacion: 'Tramitarlo en la prefactibilidad' }] });
  s.seccion('actaCierre', { resultados: '520 visitantes', contratos: 'Contrato de obra liquidado', liberacionRecursos: 'Contratista liberado' });
  assert.equal(s.proyecto.leccionesBase[0].recomendacion, 'Tramitarlo en la prefactibilidad', 'la lección queda en la base corporativa');
  s.aprobar('cerrado');
  assert.equal(s.proyecto.estado, 'cerrado');
  assert.equal(s.proyecto.ficha.finReal, '2026-03-10');
});

test('suspender guarda la fase y solo se reanuda en ella', () => {
  const s = sesion();
  s.aprobar('suspendido');
  assert.equal(s.proyecto.estadoAntesSuspension, 'propuesto');
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'ejecucion', motivo: 'x' }), /solo puede reanudarse ahí/);
  s.aprobar('propuesto');
  assert.equal(s.proyecto.estado, 'propuesto');
});

test('apartados: "No aplica" exige justificación; solo el director los diligencia; conflictos por apartado', () => {
  const s = sesion();
  assert.throws(() => s.seccion('pestel', { noAplica: { justificacion: 'no' } }), /justificación/);
  assert.throws(() => s.hacer(EQUIPO, 'guardarSeccion', { seccion: 'entorno', datos: { descripcion: 'x' } }), { status: 403 });
  assert.throws(() => s.seccion('inventado', {}), /no existe/);
  s.seccion('entorno', { descripcion: 'Primera versión' });
  assert.throws(() => s.hacer(DIRECTOR, 'guardarSeccion', { seccion: 'entorno', datos: { descripcion: 'Otra' }, versionBase: 'vieja' }), { status: 409 });
  assert.throws(() => s.seccion('cronogramaFases', { preinversion: { inicio: '2026-13-45' } }), /no es válida/);
});

test('RACI: exactamente un A y al menos un R por entregable o paquete', () => {
  const plan = { entregables: [{ id: 1, codigo: 'E-001', nombre: 'Planos' }], secciones: { raci: { datos: { roles: ['Director', 'Arquitecto', 'Contratista'], filas: { 'E:1': { Director: 'A', Arquitecto: 'A', Contratista: 'R' } } } } } };
  assert.match(erroresRaci(plan)[0], /exactamente un A \(tiene 2\)/);
  plan.secciones.raci.datos.filas['E:1'] = { Director: 'A', Arquitecto: 'R', Contratista: 'C' };
  assert.deepEqual(erroresRaci(plan), []);
});

test('interesados: estrategia por matriz poder–interés', () => {
  assert.equal(estrategiaInteresado({ poder: 5, interes: 5 }), 'cerca');
  assert.equal(estrategiaInteresado({ poder: 4, interes: 1 }), 'satisfecho');
  assert.equal(estrategiaInteresado({ poder: 1, interes: 4 }), 'informado');
  assert.equal(estrategiaInteresado({ poder: 1, interes: 1 }), 'monitorear');
});

test('análisis financiero (apartado 11) con valores conocidos', () => {
  const flujos = [{ periodo: 0, egresos: 1000 }, { periodo: 1, ingresos: 600 }, { periodo: 2, ingresos: 600 }];
  assert.equal(Math.round(van(flujos, 10) * 100) / 100, 41.32); // −1000 + 545,45 + 495,87
  assert.equal(Math.round(tir(flujos) * 100) / 100, 13.07);
  assert.equal(Math.round(periodoRecuperacionDescontado(flujos, 10) * 100) / 100, 1.92);
  assert.equal(tir([{ periodo: 0, ingresos: 10 }]), null, 'sin inversión no hay TIR');
  assert.equal(periodoRecuperacionDescontado([{ periodo: 0, egresos: 1000 }, { periodo: 1, ingresos: 100 }], 10), null, 'no se recupera');
  assert.equal(ingresoPeriodo({ clientes: 500, precio: 20000, ajuste: -10 }), 9000000);
});

test('ROI y recuperación en años y meses (complemento del apartado 11)', () => {
  const flujos = [{ periodo: 0, egresos: 1000 }, { periodo: 1, ingresos: 600 }, { periodo: 2, ingresos: 600 }];
  assert.equal(roi(flujos), 20); // (1200 − 1000) ÷ 1000
  assert.equal(Math.round(roiDescontado(flujos, 10) * 100) / 100, 4.13); // (1041,32 − 1000) ÷ 1000
  assert.equal(roi([{ periodo: 0, ingresos: 5 }]), null, 'sin egresos no hay ROI');
  assert.equal(roiDescontado(flujos, ''), null, 'sin tasa no hay ROI descontado');
  assert.equal(Math.round(periodoRecuperacionSimple(flujos) * 100) / 100, 1.67);
  // 1,92 años → 23,04 meses: el mes 24 cuenta completo.
  assert.deepEqual(aniosYMeses(1.92, 'anio'), { anios: 2, meses: 0, totalMeses: 24 });
  assert.equal(textoAniosYMeses(aniosYMeses(14.2, 'mes')), '1 año y 3 meses');
  assert.equal(textoAniosYMeses(aniosYMeses(3, 'trimestre')), '9 meses');
  assert.equal(textoAniosYMeses(aniosYMeses(3, 'semestre')), '1 año y 6 meses');
  assert.equal(aniosYMeses(5, ''), null, 'sin duración del periodo no se convierte');
  assert.equal(Math.round(tasaEfectivaAnual(1.2, 'mes') * 100) / 100, 15.39);
  assert.equal(Math.round(tasaEfectivaAnual(12, 'anio') * 1e6) / 1e6, 12, 'una tasa anual queda igual');
  assert.deepEqual(alertasFinancieras({ unidadPeriodo: 'mes', tasaDescuento: 12, flujos: [{ periodo: 0, ingresos: 5 }, { periodo: 2, egresos: 1 }, { periodo: 2, egresos: 1 }] }), [
    'El periodo 2 está repetido: suma sus valores en una sola fila.',
    'Faltan los periodos 1: regístralos aunque su flujo sea 0, o la TIR y la recuperación quedan mal.',
    'El periodo 0 no tiene egresos: ahí va la inversión inicial.',
    'La tasa equivale a 289,6 % efectivo anual: revisa que sea la tasa por mes y no la anual.',
  ]);
});

test('el proyecto Ejemplo tiene cifras coherentes y su análisis de sensibilidad dice lo que calcula la app', () => {
  const r = resumenFinanciero(FINANCIERO_EJEMPLO);
  assert.deepEqual(alertasFinancieras(FINANCIERO_EJEMPLO), []);
  assert.equal(FINANCIERO_EJEMPLO.flujos[0].egresos, 85000000, 'la inversión inicial es el presupuesto aprobado');
  // Los ingresos del primer año del flujo son los del apartado 8.
  INGRESOS_EJEMPLO.periodos.forEach((periodo, i) => assert.equal(FINANCIERO_EJEMPLO.flujos[i + 1].ingresos, ingresoPeriodo(periodo)));
  const pesos = valor => `$${Math.round(valor).toLocaleString('es-CO')}`;
  assert.ok(FINANCIERO_EJEMPLO.sensibilidad.includes(`VAN ${pesos(r.van)}`));
  assert.ok(FINANCIERO_EJEMPLO.sensibilidad.includes(`TIR ${r.tir.toLocaleString('es-CO', { maximumFractionDigits: 2 })} % mensual`));
  assert.ok(FINANCIERO_EJEMPLO.sensibilidad.includes(`ROI ${r.roi.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`));
  assert.ok(FINANCIERO_EJEMPLO.sensibilidad.includes(`recuperación en ${textoAniosYMeses(r.priTiempo)} (${textoAniosYMeses(r.prdTiempo)} a valor presente)`));
});

test('documentos: se cargan al repositorio con el prefijo del proyecto y se conservan las versiones', () => {
  const s = sesion();
  assert.equal(nombreArchivoDocumento(s.proyecto, DOCUMENTO.formato3, 2, 'pdf'), 'A2_PY3_Formato3_Acta_de_Constitucion_v2.pdf');
  s.hacer(EQUIPO, 'subirDocumento', { idDocumento: 'anexo2', archivo: { url: 'https://repos.termalessantarosa.com.co/a.pdf', nombre: 'A2_PY3_Anexo2_Analisis_PESTEL_v1.pdf' } });
  s.hacer(EQUIPO, 'subirDocumento', { idDocumento: 'anexo2', archivo: { url: 'https://repos.termalessantarosa.com.co/b.pdf', nombre: 'A2_PY3_Anexo2_Analisis_PESTEL_v2.pdf' } });
  assert.deepEqual(s.plan.documentos.anexo2.versiones.map(version => version.version), [1, 2], 'la versión anterior se conserva');
  assert.equal(estadoDocumento(DOCUMENTO.anexo2, s.proyecto, s.plan), 'archivo');
  assert.throws(() => s.hacer(EQUIPO, 'subirDocumento', { idDocumento: 'anexo2', archivo: { url: 'javascript:alert(1)' } }), /http/);
  assert.throws(() => s.hacer(EQUIPO, 'marcarDocumento', { idDocumento: 'anexo4', justificacion: 'No hay lote nuevo' }), { status: 403 });
  s.hacer(DIRECTOR, 'marcarDocumento', { idDocumento: 'anexo4', justificacion: 'El proyecto usa un lote existente' });
  assert.equal(estadoDocumento(DOCUMENTO.anexo4, s.proyecto, s.plan), 'noAplica');
});

test('riesgos: amenazas y oportunidades con su respuesta, contingencia y disparador; las oportunidades no son críticas', () => {
  const s = sesion();
  assert.throws(() => s.hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', naturaleza: 'oportunidad', descripcion: 'Turismo de aves', probabilidad: 5, impacto: 5, estado: 'abierto', respuesta: 'mitigar' } }), /explotar, mejorar, compartir o aceptar/);
  s.hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', naturaleza: 'oportunidad', descripcion: 'Turismo de aves', probabilidad: 5, impacto: 5, estado: 'abierto', respuesta: 'explotar', costoContingencia: 0, disparador: 'Temporada de migración' } });
  assert.equal(s.plan.riesgos[0].naturaleza, 'oportunidad');
  assert.equal(s.plan.riesgos[0].disparador, 'Temporada de migración');
  assert.equal(s.proyecto.resumen.riesgos[0].o, 1);
});
