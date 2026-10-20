import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import { jsPDF } from 'jspdf';
import {
  construirReporte360, evaluacion360, evidencias360, informesPorFuente360, planCerrado360, plazoSemanas360, progreso360, tiposFuente360,
} from '../src/utils/reporte360.js';
import { crearPdfReporte360 } from '../src/services/reporte360Pdf.js';

const corte = new Date('2026-10-19T18:00:00-05:00');
const informes = [
  { id: 1, ref: 'INF-DEMO-001', titulo: 'Demostración: seguimiento de compromisos', tipoFuente: 'F-1', fecha: '2026-09-15', auditorResponsable: 'Auditor de demostración' },
  { id: '2', ref: 'INF-DEMO-002', titulo: 'Demostración: programa de auditoría', tipoFuente: 'Programa de Auditoría', programaId: 'P-1' },
  { id: 3, ref: 'INF-DEMO-003', titulo: 'Demostración: sin hallazgos' },
];
const fuentes = [{ codigo: 'F-1', tipoFuente: 'Auditoría Externa', alcance: 'Datos ficticios para validación del diseño' }];
const hallazgos = [
  { id: 10, idInforme: '1', ref: 'HAL-DEMO-010', titulo: 'Hallazgo de demostración', estado: 'Abierto' },
  { id: 11, idInforme: 1, ref: 'HAL-DEMO-011', titulo: 'Demostración: hallazgo sin acciones', estado: 'Abierto' },
  { id: 20, idInforme: 2, estado: 'Cerrado' },
  { id: 99, idInforme: 'fuera-de-alcance', estado: 'Abierto' },
];
const planes = [
  { id: 100, idHallazgo: '10', accion: 'Demostración: acción al 100% pendiente de evaluación', progreso: 100, estado: 'En Proceso', estadoWorkflow: 'En Revisión (100%)', fecha: '2026-10-01' },
  { id: 101, idHallazgo: 10, accion: 'Demostración: acción cerrada', progreso: 100, estado: 'Cerrado', estadoWorkflow: 'Cerrado', fecha: '2026-10-01', evaluacionEficaciaCierre: { fueEficaz: true, conclusion: 'Resultado verificado (demostración)', fecha: '19/10/2026', usuario: 'Auditor de demostración' } },
  { id: 102, idHallazgo: 10, progreso: 50, estadoWorkflow: 'En Ejecución', fecha: '2026-10-19' },
  { id: 200, idHallazgo: 20, progreso: 100, estadoWorkflow: 'Cerrado', evaluacionHolistica: { tipo: 'evaluacion-final-ejecucion', puntaje: 85, aprobado: true } },
  { id: 900, idInforme: 1, idHallazgo: 'no-visible', progreso: 30 },
  { id: 901, idHallazgo: 99, progreso: 0 },
  { id: 902, idHallazgo: 'inexistente', progreso: 20 },
];
const config = { informes, fuentes, hallazgos, planes, generadoEn: corte, generadoPor: 'Demostración · no contiene datos reales' };
const construir = cambios => construirReporte360({ ...config, ...cambios });

test('selección por informe normaliza IDs y preserva hallazgos sin acciones', () => {
  const reporte = construir({ modo: 'informe', idInforme: '1' });
  assert.equal(reporte.expedientes.length, 1);
  assert.equal(reporte.resumen.informes, 1);
  assert.equal(reporte.resumen.hallazgos, 2);
  assert.equal(reporte.resumen.acciones, 4);
  assert.equal(reporte.resumen.sinAcciones, 1);
  assert.equal(reporte.expedientes[0].planesSinHallazgo.length, 1);
  assert.equal(reporte.expedientes[0].tipoFuente, 'Auditoría Externa');
  assert.equal(reporte.expedientes[0].esPrograma, false);
  assert.throws(() => construir({ modo: 'informe', idInforme: '' }), /Selecciona un informe/);
  assert.throws(() => construir({ modo: 'informe', idInforme: '99' }), /Selecciona un informe/);
  assert.throws(() => construir({ modo: 'desconocido' }), /alcance válido/);
});

test('el general incluye todos los registros disponibles sin duplicar y sin perder huérfanos', () => {
  const reporte = construir();
  assert.equal(reporte.resumen.informes, 3);
  assert.equal(reporte.resumen.hallazgos, hallazgos.length);
  assert.equal(reporte.resumen.acciones, planes.length);
  const sinInforme = reporte.expedientes.find(grupo => !grupo.informe);
  assert.equal(sinInforme.esPrograma, null);
  assert.equal(sinInforme.hallazgos[0].planes[0].evaluacion.tipo, 'Origen sin verificar');
  assert.equal(sinInforme.planesSinHallazgo.length, 1);
  assert.ok(reporte.incidencias.some(item => item.includes('informe de origen no disponible')));
  assert.equal(reporte.expedientes.find(grupo => grupo.informe?.id === 3).resumen.acciones, 0);
  assert.deepEqual(construirReporte360({ generadoEn: corte }).resumen, {
    informes: 0, hallazgos: 0, hallazgosCerrados: 0, sinAcciones: 0,
    acciones: 0, cerradas: 0, abiertas: 0, vencidas: 0, enRevision: 0, avance: null, sinAvance: 0,
  });
});

test('tipos de fuente: resuelve fuentes vinculadas por código o ID y tipos directos sin duplicados', () => {
  assert.deepEqual(tiposFuente360([
    { tipoFuente: 'F-1' }, { tipoFuente: 'F-2' }, { tipoFuente: 'F-3' },
    { tipoFuente: 'Programa de Auditoría' },
  ], [...fuentes, { id: 'F-2', tipo: 'Auditoría Externa' }, { codigo: 'F-3', tipoFuente: 'Quejas' }]), [
    'Auditoría Externa', 'Programa de Auditoría', 'Quejas',
  ]);
});

test('filtra un tipo o consolida varios sin perder hallazgos sin acciones ni duplicar registros', () => {
  const uno = construir({ modo: 'fuentes', tiposFuente: ['Auditoría Externa'] });
  assert.equal(uno.resumen.informes, 1);
  assert.equal(uno.resumen.hallazgos, 2);
  assert.equal(uno.resumen.acciones, 4);
  assert.equal(uno.resumen.sinAcciones, 1);
  assert.equal(uno.expedientes[0].planesSinHallazgo.length, 1);
  assert.equal(uno.expedientes[0].hallazgos[0].planes[1].evaluacion.tipo, 'Evaluación de eficacia por acción');
  const varios = construir({ modo: 'fuentes', tiposFuente: ['Auditoría Externa', 'Programa de Auditoría', 'Auditoría Externa'] });
  assert.deepEqual(varios.tiposFuente, ['Auditoría Externa', 'Programa de Auditoría']);
  assert.equal(varios.resumen.informes, 2);
  assert.equal(varios.resumen.hallazgos, 3);
  assert.equal(varios.resumen.acciones, 5);
  assert.ok(varios.expedientes.every(grupo => grupo.informe));
  assert.equal(varios.expedientes[1].hallazgos[0].planes[0].evaluacion.tipo, 'Evaluación integral del paquete');
  assert.ok(!varios.incidencias.some(item => item.includes('informe de origen no disponible')));
  const conflicto = construir({ modo: 'fuentes', tiposFuente: ['Auditoría Externa'], planes: [{ ...planes[0], idInforme: 2 }] });
  assert.equal(conflicto.resumen.acciones, 1);
  assert.ok(conflicto.incidencias.some(item => item.includes('idInforme difiere')));
  const mismoTipo = construir({
    modo: 'fuentes', tiposFuente: ['Auditoría Externa'],
    informes: [...informes, { id: 4, tipoFuente: 'F-2' }],
    fuentes: [...fuentes, { id: 'F-2', tipoFuente: 'Auditoría Externa' }],
    hallazgos: [...hallazgos, { id: 40, idInforme: 4, estado: 'Abierto' }],
  });
  assert.equal(mismoTipo.resumen.informes, 2);
  assert.equal(mismoTipo.resumen.hallazgos, 3);
  assert.equal(mismoTipo.resumen.sinAcciones, 2);
  assert.equal(mismoTipo.resumen.acciones, 4);
  for (const seleccion of [[], ['Inexistente'], ['Auditoría Externa', 'Inexistente'], 'Auditoría Externa']) {
    assert.throws(() => construir({ modo: 'fuentes', tiposFuente: seleccion }), /tipos de fuente disponibles/);
  }
});

test('informes asociados resuelve tipos vinculados y permite seleccionar uno, varios o todos', () => {
  const datos = {
    modo: 'fuentes', tiposFuente: ['Auditoría Externa', 'Programa de Auditoría'],
    informes: [...informes, { id: 4, ref: 'INF-DEMO-004', tipoFuente: 'F-1' }],
    hallazgos: [...hallazgos, { id: 40, idInforme: 4, estado: 'Abierto' }],
  };
  assert.deepEqual(informesPorFuente360(datos.informes, fuentes, ['Auditoría Externa']).map(informe => informe.id), [1, 4]);
  const uno = construir({ ...datos, idsInformes: ['1', 1] });
  assert.equal(uno.resumen.informes, 1);
  assert.equal(uno.resumen.hallazgos, 2);
  assert.equal(uno.resumen.acciones, 4);
  assert.equal(uno.resumen.sinAcciones, 1);
  assert.equal(uno.expedientes[0].planesSinHallazgo.length, 1);
  const varios = construir({ ...datos, idsInformes: ['2', 4] });
  assert.deepEqual(varios.expedientes.map(grupo => grupo.informe.id), ['2', 4]);
  assert.equal(varios.resumen.hallazgos, 2);
  assert.equal(varios.resumen.sinAcciones, 1);
  assert.equal(varios.resumen.acciones, 1);
  assert.deepEqual(construir({ ...datos, idsInformes: null }), construir(datos));
  assert.equal(construir({ ...datos, idsInformes: null }).resumen.informes, 3);
});

test('selección vacía, informe retirado o ajeno al tipo no produce un PDF con alcance incorrecto', () => {
  for (const idsInformes of [[], ['inexistente'], [1, 3], [2], '1']) {
    assert.throws(() => construir({ modo: 'fuentes', tiposFuente: ['Auditoría Externa'], idsInformes }), /informes disponibles/);
  }
  assert.throws(() => construir({
    modo: 'fuentes', tiposFuente: ['Auditoría Externa'], idsInformes: [1],
    informes: [{ id: 1, tipoFuente: 'Programa de Auditoría' }, { id: 4, tipoFuente: 'F-1' }],
  }), /informes disponibles/);
  assert.deepEqual(construir({ idsInformes: [] }), construir());
  assert.equal(construir({ modo: 'informe', idInforme: 1, idsInformes: [] }).resumen.informes, 1);
});

test('PDF por tipos de fuente incluye únicamente los informes elegidos y sus registros', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const reporte = construir({
    modo: 'fuentes', tiposFuente: ['Auditoría Externa', 'Programa de Auditoría'], idsInformes: [1],
  });
  const { doc } = crearPdfReporte360(reporte, { logo });
  const texto = Object.values(doc.internal.pages).flat().join('\n');
  assert.match(texto, /INF-DEMO-001/);
  assert.match(texto, /HAL-DEMO-011/);
  assert.match(texto, /PLA-900/);
  assert.ok(!texto.includes('INF-DEMO-002'));
  assert.ok(!texto.includes('INF-DEMO-003'));
  assert.ok(!texto.includes('PLA-200'));
});

test('PDF consolidado identifica los tipos seleccionados y conserva ambas rutas de evaluación', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const reporte = construir({ modo: 'fuentes', tiposFuente: ['Auditoría Externa', 'Programa de Auditoría'] });
  const { doc, nombre } = crearPdfReporte360(reporte, { logo });
  assert.match(nombre, /^Plan_Accion_360_fuentes_consolidadas_2026-10-19\.pdf$/);
  const texto = Object.values(doc.internal.pages).flat().join('\n');
  assert.match(texto, /Tipos de fuente:/);
  assert.match(texto, /Auditor.a Externa/);
  assert.match(texto, /Programa de Auditor.a/);
  assert.match(texto, /Evaluaci.n integral del paquete/);
  assert.match(texto, /Evaluaci.n de eficacia por acci.n/);
  assert.ok(!texto.includes('INF-DEMO-003'));
});

test('100% no implica cierre; fechas locales, límites y estados legacy', () => {
  const reporte = construir({ modo: 'informe', idInforme: 1 });
  assert.equal(reporte.resumen.cerradas, 1);
  assert.equal(reporte.resumen.abiertas, 3);
  assert.equal(reporte.resumen.vencidas, 1);
  assert.equal(reporte.resumen.enRevision, 1);
  assert.equal(reporte.resumen.avance, 70);
  assert.equal(planCerrado360({ estado: 'Cerrado' }), true);
  assert.equal(planCerrado360({ estado: 'Cerrado', estadoWorkflow: 'En Ejecución' }), false);
  const fechas = construir({
    planes: [
      { id: 1, idHallazgo: 10, progreso: 100, estadoWorkflow: 'En Revisión (100%)', fecha: '18/10/2026' },
      { id: 2, idHallazgo: 10, progreso: 10, fecha: '19/10/2026' },
      { id: 3, idHallazgo: 10, progreso: 10, fecha: '31/02/2026' },
    ],
    modo: 'informe', idInforme: 1,
  });
  assert.equal(fechas.resumen.vencidas, 1);
  assert.ok(fechas.incidencias.some(item => item.includes('fecha límite no interpretable')));
});

test('el corte y el nombre del PDF usan el mismo día de Colombia al cruzar medianoche UTC', () => {
  const reporte = construir({
    modo: 'informe', idInforme: 1, generadoEn: new Date('2026-10-20T02:30:00Z'),
    planes: [
      { id: 1, idHallazgo: 10, progreso: 50, fecha: '2026-10-19' },
      { id: 2, idHallazgo: 10, progreso: 50, fecha: '2026-10-18' },
    ],
  });
  assert.equal(reporte.diaCorte, '2026-10-19');
  assert.equal(reporte.resumen.vencidas, 1);
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  assert.match(crearPdfReporte360(reporte, { logo }).nombre, /_2026-10-19\.pdf$/);
});

test('evaluación inicial desde 80%, finales legadas y eficacia sin confundir diseño con cierre', () => {
  assert.equal(evaluacion360(planes[3], true).resultado, 'Aprobada');
  assert.equal(evaluacion360({ evaluacionHolistica: { tipo: 'evaluacion-final-ejecucion', puntaje: 80, aprobado: true } }, true).resultado, 'No aprobada');
  assert.equal(evaluacion360({ evaluacionHolistica: { puntaje: 100, aprobado: true } }, true).resultado, 'Pendiente de evaluación inicial');
  assert.equal(evaluacion360({ evaluacionHolistica: { tipo: 'evaluacion-inicial-diseno', puntaje: 80, aprobado: true } }, true).resultado, 'Aprobada');
  assert.equal(evaluacion360({ evaluacionHolistica: { tipo: 'evaluacion-inicial-diseno', puntaje: 79, aprobado: false } }, true).resultado, 'No aprobada');
  assert.equal(evaluacion360({ evaluacionHolistica: { tipo: 'evaluacion-inicial-diseno', puntaje: 80, aprobado: true }, evaluacionEficaciaCierre: { fueEficaz: true } }, true).cierre.fueEficaz, true);
  assert.equal(evaluacion360(planes[1], false).resultado, 'Eficaz');
  assert.equal(evaluacion360({ evaluacionEficaciaCierre: { fueEficaz: false } }, false).resultado, 'No eficaz');
  assert.equal(evaluacion360(planes[3], false).resultado, 'Pendiente');
  const r = construir({ modo: 'informe', idInforme: 2 });
  assert.equal(r.expedientes[0].esPrograma, true);
  const sinPrograma = construir({ informes: [{ id: 2, tipoFuente: 'Programa de Auditoría' }] });
  assert.equal(sinPrograma.expedientes.find(grupo => grupo.informe)?.esPrograma, true);
});

test('PDF separa evaluación inicial aprobada al 80% del dictamen final por acción', () => {
  const reporte = construir({
    modo: 'informe', idInforme: 2,
    planes: [{
      id: 200, idHallazgo: 20, estadoWorkflow: 'En Ejecución', progreso: 40,
      evaluacionHolistica: { tipo: 'evaluacion-inicial-diseno', puntaje: 80, aprobado: true, usuario: 'auditor-inicial@example.test' },
      evaluacionEficaciaCierre: { fueEficaz: false, conclusion: 'Soporte insuficiente', usuario: 'auditor-final@example.test' },
    }],
  });
  assert.equal(reporte.resumen.cerradas, 0);
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const { doc } = crearPdfReporte360(reporte, { logo });
  const texto = Object.values(doc.internal.pages).flat().join('\n');
  assert.match(texto, /Evaluaci.n inicial del dise.o/);
  assert.match(texto, /Dictamen final por acci.n/);
  assert.match(texto, /auditor-inicial@example\.test/);
  assert.match(texto, /auditor-final@example\.test/);
  assert.match(texto, /Soporte insuficiente/);
});

test('no inventa avances y señala conflictos de vínculos y cierre', () => {
  assert.equal(progreso360('85'), 85);
  for (const valor of ['', '  ', null, undefined, 'invalido', -1, 101, Infinity, false, true, []]) assert.equal(progreso360(valor), null);
  const r = construir({ planes: [{ id: 1, idHallazgo: 10, idInforme: 2, estado: 'Cerrado', estadoWorkflow: 'En Ejecución' }], modo: 'informe', idInforme: 1 });
  assert.equal(r.resumen.acciones, 1);
  assert.equal(r.resumen.avance, null);
  assert.equal(r.resumen.abiertas, 1);
  assert.equal(r.incidencias.length, 3);
  const original = JSON.stringify(config);
  construir();
  assert.equal(JSON.stringify(config), original);
});

test('evidencias: múltiples formatos, deduplicación y enlaces seguros', () => {
  const evidencias = evidencias360({
    evidenciaUrl: ['https://example.test/soporte.pdf', 'javascript:alert(1)'],
    evidencias: [{ nombre: 'Soporte', url: 'https://example.test/soporte.pdf' }],
    anexos: [{ nombre: 'Anexo', url: 'https://example.test/anexo.pdf' }],
  });
  assert.equal(evidencias.length, 3);
  assert.equal(evidencias[0].nombre, 'Soporte');
  assert.equal(evidencias.find(item => item.url.startsWith('javascript:')).enlazable, false);
  assert.equal(evidencias360({ evidenciaUrl: 'https://example.test/uno.pdf' }).length, 1);
});

test('PDF ejecutivo: fuente simplificada, textos depurados y todas las acciones con su estado real', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const reporte = construir({
    modo: 'informe', idInforme: 1,
    fuentes: [{
      ...fuentes[0], fecha: '2026-09-01', estado: 'Activa', responsable: 'Responsable fuente demo',
      descripcion: 'Descripcion de origen demo', norma: ['ISO 9001'], macroprocesos: ['Proceso demo'],
    }],
    planes: [
      { ...planes[0], ref: 'PLA-PENDIENTE', mecanismo: 'Verificacion mensual demo', responsable: 'Ejecutor demo', auditorAsignado: 'Auditor demo', revisor: 'Jefatura demo', proceso: 'Operacion demo', sede: 'Sede demo', fechaInicio: '2026-09-20' },
      { ...planes[1], ref: 'PLA-CERRADA' },
      { id: 'sin-padre', idInforme: 1, idHallazgo: 'no-visible', ref: 'PLA-HUERFANA', accion: 'Accion sin hallazgo demo', estadoWorkflow: 'En Ejecución' },
    ],
  });
  const { doc } = crearPdfReporte360(reporte, { logo });
  assert.ok(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight());
  const comandos = Object.values(doc.internal.pages).flat().join('\n');
  const textoContinuo = [...comandos.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
    .map(match => match[1].replace(/\\([()\\])/g, '$1')).join(' ');
  for (const texto of [
    'Datos de la fuente', 'Informe emitido', 'Cuadro de hallazgos', 'Cuadro de acciones y estados',
    'Tipo de fuente',
    'PLA-PENDIENTE', 'PLA-CERRADA', 'PLA-HUERFANA', 'HAL-DEMO-011',
    'Ejecutor demo', 'Auditor demo', 'Jefatura demo', 'Operacion demo', 'Sede demo',
    '100%', 'Sin acciones vinculadas', 'Sin hallazgo disponible', 'Vencida sin cierre',
    'No.', 'Descripción Observación y/o Hallazgo', 'Clase de Observación',
    'Áreas / Procesos Vinculados', 'Acciones de Mejoramiento', 'Mecanismo de Seguimiento',
    'Resp. Seguimiento (Auditor)', 'Meta / Unidad', 'Fecha Inicio', 'Fecha Terminación',
    'Plazo (Semanas)', 'Estado / Observación', 'Responsable de Mejoramiento', '1.6',
  ]) assert.ok(textoContinuo.includes(texto), `Falta contenido: ${texto}`);
  assert.match(textoContinuo, /En Revisi.n \(100%\)/);
  assert.match(comandos, /Cerrada/);
  assert.match(comandos, /Anexo documental/);
  assert.match(textoContinuo, /Auditor.a Externa/);
  for (const texto of [
    'Responsable fuente demo', 'Descripcion de origen demo', 'ISO 9001', 'Proceso demo',
    'Avance de ejecución promedio', 'Ejecutar al 100%', 'estado legado',
    'Copia de seguimiento de los registros disponibles', 'No certifica la integridad',
    'Sin ficha de fuente vinculada disponible', 'Tipo / referencia',
  ]) assert.ok(!textoContinuo.includes(texto), `Texto que debe omitirse: ${texto}`);
  assert.ok(doc.lastAutoTable.settings.tableLineWidth > 0);
  assert.ok(doc.lastAutoTable.styles.styles.lineWidth > 0);
  assert.deepEqual(doc.lastAutoTable.styles.headStyles.fillColor, [10, 59, 50]);
  assert.ok(!comandos.includes('Mapa de informes y compromisos'));
  assert.ok(!textoContinuo.includes('·'));
  assert.ok(!textoContinuo.includes('\uFFFD'));
  assert.ok(doc.internal.pages[2].join('\n').includes('INF-DEMO-001 - Demostraci'));
  // La ficha compacta de origen e informe debe caber en la primera página del expediente.
  assert.ok(doc.internal.pages[2].join('\n').includes('Socializaci'));
  if (process.env.REPORTE360_EXECUTIVE_SAMPLE_PATH) {
    writeFileSync(process.env.REPORTE360_EXECUTIVE_SAMPLE_PATH, Buffer.from(doc.output('arraybuffer')));
  }
});

test('plazo en semanas: mismo cálculo institucional con fechas de calendario válidas', () => {
  assert.equal(plazoSemanas360('2026-08-01', '2026-09-30'), '8.6');
  assert.equal(plazoSemanas360('01/08/2026', '30/09/2026'), '8.6');
  assert.equal(plazoSemanas360('2026-09-30', '2026-08-01'), '8.6');
  assert.equal(plazoSemanas360('2026-10-19', '2026-10-19'), '0.0');
  assert.equal(plazoSemanas360('2026-02-30', '2026-03-10'), 'No registrado');
  assert.equal(plazoSemanas360(null, '2026-10-19'), 'No registrado');
  assert.equal(plazoSemanas360('2026-10-19', 'invalida'), 'No registrado');
});

test('matriz institucional: 13 columnas, espaciado natural y encabezados repetidos', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const reporte = construir({
    modo: 'informe', idInforme: 1,
    planes: [{ ...planes[0], fechaInicio: '2026-08-01', fecha: '2026-09-30' }],
    hallazgos: [hallazgos[0]],
  });
  const { doc } = crearPdfReporte360(reporte, { logo });
  const tabla = doc.lastAutoTable;
  assert.equal(tabla.columns.length, 13);
  assert.equal(tabla.body[0].cells[0].raw, '1');
  assert.equal(tabla.body[0].cells[7].raw, '100%');
  assert.equal(tabla.body[0].cells[10].raw, '8.6');
  assert.equal(tabla.body[0].cells[1].styles.halign, 'left');
  assert.equal(tabla.body[0].cells[4].styles.halign, 'left');
  assert.equal(tabla.body[0].cells[8].styles.halign, 'center');
  assert.equal(tabla.settings.showHead, 'everyPage');
  const anchoTabla = tabla.columns.reduce((suma, columna) => suma + columna.width, 0);
  assert.ok(Math.abs(anchoTabla - (doc.internal.pageSize.getWidth() - 28)) < 0.01);
});

test('causa y análisis: NO APLICA para Programa de Auditoría, contenido real para otras fuentes', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  for (const tipo of ['Programa de Auditoría', 'Auditoría Interna', 'Auditoría Externa', 'Quejas']) {
    const reporte = construir({
      modo: 'informe', idInforme: 1,
      informes: [{ ...informes[0], tipoFuente: 'FUENTE-PRUEBA' }],
      fuentes: [{ codigo: 'FUENTE-PRUEBA', tipoFuente: tipo }],
      hallazgos: [{ ...hallazgos[0], causa: 'Origen comprobado', metodologiaCausa: 'Metodo documentado', analisisCausa: 'Analisis completo verificado' }],
      planes: [],
    });
    const { doc } = crearPdfReporte360(reporte, { logo });
    const celda = doc.lastAutoTable.body[0].cells[3];
    assert.equal(celda.styles.halign, 'left');
    if (tipo === 'Programa de Auditoría') assert.equal(celda.raw, 'NO APLICA');
    else assert.equal(celda.raw, 'Causa: Origen comprobado\nMétodo: Metodo documentado\nAnálisis: Analisis completo verificado');
  }
});

test('texto de celdas permanece dentro de sus bordes al continuar filas extensas', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const dibujos = [];
  const alIniciar = function () {
    const rectOriginal = this.rect;
    const textOriginal = this.text;
    let celda = null;
    this.rect = (...args) => {
      celda = args.slice(0, 4);
      return rectOriginal.apply(this, args);
    };
    this.text = (texto, x, y, opciones) => {
      if (celda && this.getFontSize() <= 8 && y >= 37 && y <= this.internal.pageSize.getHeight() - 22) {
        dibujos.push({
          celda, texto: Array.isArray(texto) ? texto : [texto], x, y,
          tamano: this.getFontSize() / this.internal.scaleFactor,
          interlineado: this.getLineHeightFactor(), opciones,
          anchos: (Array.isArray(texto) ? texto : [texto]).map(linea => this.getTextWidth(linea)),
        });
      }
      return textOriginal.call(this, texto, x, y, opciones);
    };
  };
  const evento = ['initialized', alIniciar];
  jsPDF.API.events.push(evento);
  let resultado;
  try {
    const descripcion = 'Detalle verificado con palabras de longitud variable y seguimiento de la actividad. '.repeat(65);
    resultado = crearPdfReporte360(construir({
      modo: 'informe', idInforme: 1,
      hallazgos: [{ ...hallazgos[0], titulo: descripcion, analisisCausa: descripcion }],
      planes: [
        { ...planes[0], accion: `INICIO-DE-ACCION\n${descripcion}\nFIN-DE-ACCION`, evaluacionHolistica: null },
        { ...planes[2], accion: 'SEGUNDA-ACCION-COMPLETA' },
      ],
    }), { logo });
  } finally {
    jsPDF.API.events.splice(jsPDF.API.events.indexOf(evento), 1);
  }
  assert.ok(dibujos.length > 100);
  for (const dibujo of dibujos) {
    const [izquierda, arriba, ancho, alto] = dibujo.celda;
    assert.notEqual(dibujo.opciones?.align, 'justify');
    assert.ok(dibujo.x >= izquierda - 0.01, 'El texto empieza antes de la celda');
    assert.ok(dibujo.x + Math.max(...dibujo.anchos) <= izquierda + ancho + 0.4, 'El texto supera el borde derecho');
    const ultimaBase = dibujo.y + (dibujo.texto.length - 1) * dibujo.tamano * dibujo.interlineado;
    assert.ok(dibujo.y >= arriba, 'El texto empieza encima de la celda');
    assert.ok(ultimaBase + dibujo.tamano * 0.2 <= arriba + alto + 0.2, 'El texto supera el borde inferior');
  }
  const comandos = Object.values(resultado.doc.internal.pages).flat().join('\n');
  assert.ok(comandos.includes('FIN-DE-ACCION'));
  assert.ok(comandos.includes('SEGUNDA-ACCION-COMPLETA'));
  if (process.env.REPORTE360_LAYOUT_SAMPLE_PATH) {
    writeFileSync(process.env.REPORTE360_LAYOUT_SAMPLE_PATH, Buffer.from(resultado.doc.output('arraybuffer')));
  }
});

test('PDF vectorial extenso: logo, paginación, texto completo, metadatos y vínculos', () => {
  const logo = new Uint8Array(readFileSync(new URL('../public/logo_termales.png', import.meta.url)));
  const textoLargo = 'Detalle de demostración: causa, soporte y verificación documentada. '.repeat(140);
  const largo = construir({
    modo: 'informe', idInforme: 1,
    hallazgos: [{ ...hallazgos[0], titulo: 'Hallazgo demostrativo para prueba de paginación', analisisCausa: textoLargo }],
    planes: [
      { ...planes[1], accion: textoLargo, evidenciaUrl: 'https://example.test/evidencia-demo.pdf', historialCambios: Array.from({ length: 45 }, (_, i) => ({ fecha: `19/10/2026, 10:${String(i).padStart(2, '0')}`, usuario: 'Usuario ficticio', accion: `Hito de demostración ${i + 1}: avance y revisión.` })) },
      { ...planes[0], accion: 'Cierre final de demostración' },
    ],
  });
  const { doc, nombre } = crearPdfReporte360(largo, { logo });
  assert.match(nombre, /Plan_Accion_360_INF-DEMO-001_2026-10-19\.pdf/);
  assert.ok(doc.getNumberOfPages() >= 8);
  const comandos = Object.values(doc.internal.pages).flat().join('\n');
  assert.match(comandos, /Hito de demostraci/);
  assert.match(comandos, /Cierre final de demostraci/);
  assert.match(comandos, /No se dispone|No registrado/);
  assert.match(comandos, /P.gina/);
  const pdf = doc.output('arraybuffer');
  const contenido = Buffer.from(pdf);
  assert.equal(contenido.subarray(0, 5).toString(), '%PDF-');
  assert.ok(contenido.includes(Buffer.from('https://example.test/evidencia-demo.pdf')));
  assert.ok(contenido.includes(Buffer.from('/Subtype /Image')));
  assert.throws(() => crearPdfReporte360(largo), /logo empresarial/);
  assert.throws(() => crearPdfReporte360(construirReporte360(), { logo }), /No hay registros/);
  if (process.env.REPORTE360_SAMPLE_PATH) writeFileSync(process.env.REPORTE360_SAMPLE_PATH, contenido);
});
