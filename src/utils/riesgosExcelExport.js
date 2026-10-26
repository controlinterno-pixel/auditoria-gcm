import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, riesgoEnPorcentaje, zonaPorNiveles } from './nivelRiesgo.js';
import { textoPlanDeAccion } from './planesDelRiesgo.js';
import { normalizarClasificacion } from './clasificacionRiesgo.js';
import { codigoControl, desglosarEficaciaControl, eficaciaSobreMaximo, promedioEficacia } from './explicacionControles.js';
const COLORES = {
  tinta: 'FF173B35',
  verde: 'FF176B5B',
  verdeClaro: 'FFE5F2ED',
  fondo: 'FFF4F7F5',
  borde: 'FFD5E1DC',
  texto: 'FF26352F',
  blanco: 'FFFFFFFF',
  extremo: 'FF9F2632',
  alto: 'FFCC6B28',
  moderado: 'FFE3B93F',
  bajo: 'FF4D9270',
};

const colorNivel = nivel => ({
  EXTREMO: COLORES.extremo,
  ALTO: COLORES.alto,
  MODERADO: COLORES.moderado,
  BAJO: COLORES.bajo,
}[nivel] || COLORES.borde);

const textoLista = valor => Array.isArray(valor) ? valor.join(', ') : (valor || '');

// Nivel del manual (Tablas 2 y 3: 20 % por nivel) con su nombre, para los mapas de calor 5 × 5.
const nivelManual = (valor, porcentaje, escala) => escala[nivelEscala(valor, porcentaje) - 1];

const configurarTitulo = (hoja, ultimaColumna, titulo, subtitulo) => {
  hoja.mergeCells(1, 1, 1, ultimaColumna);
  hoja.mergeCells(2, 1, 2, ultimaColumna);
  hoja.getCell(1, 1).value = titulo;
  hoja.getCell(2, 1).value = subtitulo;
  hoja.getRow(1).height = 34;
  hoja.getRow(2).height = 25;
  hoja.getCell(1, 1).font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: COLORES.blanco } };
  hoja.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.tinta } };
  hoja.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  hoja.getCell(2, 1).font = { name: 'Aptos', size: 10, color: { argb: COLORES.texto }, italic: true };
  hoja.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verdeClaro } };
  hoja.getCell(2, 1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
};

const crearTabla = (libro, nombre, titulo, subtitulo, filas, encabezados) => {
  const hoja = libro.addWorksheet(nombre, {
    properties: { tabColor: { argb: COLORES.verde } },
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja.properties.defaultRowHeight = 22;
  configurarTitulo(hoja, encabezados.length, titulo, subtitulo);
  hoja.columns = encabezados.map(encabezado => {
    const longitudMaxima = filas.reduce((maximo, fila) => Math.max(maximo, String(fila[encabezado] ?? '').length), encabezado.length);
    return {
      key: encabezado,
      width: Math.min(42, Math.max(14, longitudMaxima + 2)),
      style: { alignment: { vertical: 'top', wrapText: true } },
    };
  });
  encabezados.forEach((encabezado, indice) => {
    hoja.getCell(4, indice + 1).value = encabezado;
  });
  filas.forEach((fila, indiceFila) => {
    encabezados.forEach((encabezado, indiceColumna) => {
      hoja.getCell(indiceFila + 5, indiceColumna + 1).value = fila[encabezado] ?? null;
    });
  });
  hoja.getRow(4).height = 34;
  hoja.getRow(4).eachCell(cell => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verde } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: COLORES.tinta } } };
  });
  for (let indiceFila = 5; indiceFila < filas.length + 5; indiceFila += 1) {
    hoja.getRow(indiceFila).eachCell({ includeEmpty: true }, cell => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: COLORES.borde } } };
      if (indiceFila % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.fondo } };
      }
    });
  }
  return hoja;
};

const escribirFormula = (celda, formula, resultado, formato = '0') => {
  celda.value = { formula, result: resultado };
  celda.numFmt = formato;
};

export const crearLibroMatrizRiesgosExcel = async (riesgos, calculos) => {
  const { default: ExcelJS } = await import('exceljs');
  // Alcance descargado (toda la matriz o un macroproceso y sus subprocesos), visible en los títulos.
  const alcance = calculos.alcance || 'Toda la matriz';
  const riesgosExportados = riesgos.map(riesgo => {
    const zonaInherente = calculos.getSeverityZone(riesgo.probabilidadInherente, riesgo.impactoInherente, riesgoEnPorcentaje(riesgo));
    const zonaResidual = calculos.getSeverityZone(riesgo.probabilidadResidual, riesgo.impactoResidual, riesgoEnPorcentaje(riesgo));
    // Los controles anulados no se exportan como vigentes.
    const controles = Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.filter(control => control && control.estado !== 'Anulado') : [];
    const controlLegado = controles.length === 0 ? String(riesgo.descripcionControl || '').trim() : '';
    const eficaciaPromedio = controles.length > 0
      ? Math.round(controles.reduce((total, control) => total + calculos.calcularEficaciaControl(control), 0) / controles.length)
      : null;
    const eficaciaSobreMaximoRiesgo = promedioEficacia(controles)?.sobreMaximo ?? null;
    return { riesgo, zonaInherente, zonaResidual, controles, controlLegado, eficaciaPromedio, eficaciaSobreMaximoRiesgo };
  });

  const matrizRiesgos = riesgosExportados.map(({ riesgo, zonaInherente, zonaResidual, controles, controlLegado, eficaciaPromedio, eficaciaSobreMaximoRiesgo }) => ({
    'ID Riesgo': `RSK-${riesgo.id}`,
    Estado: riesgo.estado || 'Activo',
    Proceso: riesgo.proceso || riesgo.macroproceso || 'No definido',
    Subproceso: riesgo.subproceso || 'General',
    'Categoría ISO 31000': riesgo.categoria || 'N/A',
    Clasificación: normalizarClasificacion(riesgo.clasificacionRiesgo) || 'N/A',
    'Normativa Asociada': riesgo.normativa || 'N/A',
    'Sedes Afectadas': textoLista(riesgo.sede) || 'Sin sede',
    'Responsable(s)': textoLista(riesgo.responsable) || 'Sin asignar',
    'Tipo de Afectación': riesgo.afectacion || 'N/A',
    'Causa Inmediata': riesgo.causaInmediata || 'N/A',
    'Causa Raíz': riesgo.causaRaiz || 'N/A',
    'Escenario del Riesgo': riesgo.descripcion || riesgo.escenarioFinal || 'N/A',
    'Probabilidad Inherente (%)': riesgo.probabilidadInherente ?? 'Sin dato',
    'Impacto Inherente (%)': riesgo.impactoInherente ?? 'Sin dato',
    'Nivel Inherente': zonaInherente.label.toUpperCase(),
    'Probabilidad Inherente (Tabla 2)': nivelManual(riesgo.probabilidadInherente, riesgoEnPorcentaje(riesgo), ESCALA_PROBABILIDAD),
    'Impacto Inherente (Tabla 3)': nivelManual(riesgo.impactoInherente, riesgoEnPorcentaje(riesgo), ESCALA_IMPACTO),
    'Total Controles': controles.length || (controlLegado ? 1 : 0),
    'Controles Estructurados': controles.length,
    'Eficacia Promedio del Máximo Posible (%)': eficaciaSobreMaximoRiesgo,
    'Eficacia Promedio de Controles (%)': eficaciaPromedio,
    'Descripción de Control Legado': controlLegado || 'N/A',
    'Mitigación Lograda (%)': calculos.calcularMitigacionRiesgo(riesgo) ?? 'Sin dato',
    'Probabilidad Residual (%)': riesgo.probabilidadResidual ?? 'Sin dato',
    'Impacto Residual (%)': riesgo.impactoResidual ?? 'Sin dato',
    'Nivel Residual Final': zonaResidual.label.toUpperCase(),
    'Probabilidad Residual (Tabla 2)': nivelManual(riesgo.probabilidadResidual, riesgoEnPorcentaje(riesgo), ESCALA_PROBABILIDAD),
    'Impacto Residual (Tabla 3)': nivelManual(riesgo.impactoResidual, riesgoEnPorcentaje(riesgo), ESCALA_IMPACTO),
    'Estrategia de Tratamiento': riesgo.tratamiento || 'Reducir el riesgo',
    'Plan de Acción': textoPlanDeAccion(riesgo, calculos.planes) || 'N/A',
    'Fecha de Seguimiento': riesgo.fechaSeguimiento || 'No programada',
    'Bitácora de Seguimiento': riesgo.seguimientoBitacora || 'N/A',
    'Fecha de Registro': riesgo.fecha || 'N/A',
    'Cantidad de Cambios': Array.isArray(riesgo.historialCambios) ? riesgo.historialCambios.length : 0,
  }));

  const controlesPorRiesgo = riesgosExportados.flatMap(({ riesgo, zonaInherente, zonaResidual, controles, controlLegado }) => {
    const contexto = {
      'ID Riesgo': `RSK-${riesgo.id}`,
      'Descripción del Riesgo': riesgo.descripcion || riesgo.escenarioFinal || 'N/A',
      Proceso: riesgo.proceso || riesgo.macroproceso || 'No definido',
      Subproceso: riesgo.subproceso || 'General',
      Categoría: riesgo.categoria || 'N/A',
      Clasificación: normalizarClasificacion(riesgo.clasificacionRiesgo) || 'N/A',
      'Sedes Afectadas': textoLista(riesgo.sede) || 'Sin sede',
      'Responsable del Riesgo': textoLista(riesgo.responsable) || 'Sin asignar',
      'Causa Inmediata': riesgo.causaInmediata || 'N/A',
      'Causa Raíz': riesgo.causaRaiz || 'N/A',
      'Normativa Asociada': riesgo.normativa || 'N/A',
      'Nivel Inherente': zonaInherente.label.toUpperCase(),
      'Nivel Residual': zonaResidual.label.toUpperCase(),
      'Estrategia de Tratamiento': riesgo.tratamiento || 'N/A',
      'Plan de Acción': textoPlanDeAccion(riesgo, calculos.planes) || 'N/A',
    };
    if (controles.length === 0) {
      return [{
        ...contexto,
        'ID Control': 'N/A',
        'N° Control': 'N/A',
        'Control Estructurado': 'No',
        'Descripción del Control': controlLegado || 'Sin controles registrados',
        Tipo: 'N/A',
        Implementación: 'N/A',
        Documentación: 'N/A',
        Frecuencia: 'N/A',
        Evidencia: 'N/A',
        'Responsable del Control': 'N/A',
        'Eficacia Calculada (%)': null,
        'Eficacia del Máximo Posible (%)': null,
        'Observaciones del Control': 'N/A',
      }];
    }
    return controles.map((control, indice) => ({
      ...contexto,
      'ID Control': codigoControl(indice, riesgo.id),
      'N° Control': indice + 1,
      'Control Estructurado': 'Sí',
      'Descripción del Control': control.descripcion || 'Sin descripción',
      Tipo: desglosarEficaciaControl(control).tipo,
      Implementación: desglosarEficaciaControl(control).implementacion,
      Documentación: control.documentacion || 'No especificada',
      Frecuencia: control.frecuencia || 'No especificada',
      Evidencia: control.evidencia || 'No especificada',
      'Responsable del Control': control.responsable || control.responsableControl || contexto['Responsable del Riesgo'],
      'Eficacia Calculada (%)': calculos.calcularEficaciaControl(control),
      'Eficacia del Máximo Posible (%)': Math.round(eficaciaSobreMaximo(control)),
      'Observaciones del Control': control.observaciones || control.comentarios || 'N/A',
    }));
  });

  const encabezadosMatriz = Object.keys(matrizRiesgos[0]);
  const encabezadosControles = Object.keys(controlesPorRiesgo[0]);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Auditoría GCM';
  libro.subject = 'Matriz corporativa de riesgos y controles';
  libro.title = 'Matriz Corporativa de Riesgos';
  libro.created = new Date();
  libro.calcProperties.fullCalcOnLoad = true;
  libro.calcProperties.forceFullCalc = true;
  libro.views = [{ activeTab: 3, firstSheet: 0, visibility: 'visible' }];

  const hojaMatriz = crearTabla(
    libro,
    'Matriz Corporativa',
    'MATRIZ CORPORATIVA DE RIESGOS',
    `${alcance}  |  Inventario, evaluación inherente y residual, tratamiento y seguimiento.`,
    matrizRiesgos,
    encabezadosMatriz,
  );
  const hojaControles = crearTabla(
    libro,
    'Controles por Riesgo',
    'CONTROLES Y EVIDENCIAS',
    `${alcance}  |  Cada control se vincula con el riesgo de origen mediante su identificador.`,
    controlesPorRiesgo,
    encabezadosControles,
  );

  [hojaMatriz, hojaControles].forEach(hoja => {
    const indiceEficacia = hoja.columns.findIndex(columna => columna.key === 'Eficacia Calculada (%)') + 1;
    const indiceEficaciaPromedio = hoja.columns.findIndex(columna => columna.key === 'Eficacia Promedio de Controles (%)') + 1;
    const indiceMitigacion = hoja.columns.findIndex(columna => columna.key === 'Mitigación Lograda (%)') + 1;
    const indicesDelMaximo = ['Eficacia del Máximo Posible (%)', 'Eficacia Promedio del Máximo Posible (%)']
      .map(clave => hoja.columns.findIndex(columna => columna.key === clave) + 1);
    [indiceEficacia, indiceEficaciaPromedio, indiceMitigacion, ...indicesDelMaximo].filter(Boolean).forEach(indice => {
      hoja.getColumn(indice).numFmt = '0"%"';
    });
    const columnaNivel = hoja.columns.findIndex(columna => ['Nivel Residual Final', 'Nivel Residual'].includes(columna.key)) + 1;
    if (columnaNivel) {
      for (let numeroFila = 5; numeroFila <= hoja.rowCount; numeroFila += 1) {
        const celda = hoja.getCell(numeroFila, columnaNivel);
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorNivel(celda.value) } };
        celda.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
        celda.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
    hoja.autoFilter = { from: 'A4', to: `${hoja.getColumn(hoja.columnCount).letter}${hoja.rowCount}` };
  });

  const listaProcesos = [...new Set(matrizRiesgos.map(riesgo => riesgo.Proceso).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const niveles = ['EXTREMO', 'ALTO', 'MODERADO', 'BAJO'];
  const hojaListas = libro.addWorksheet('Listas');
  hojaListas.getCell('A1').value = 'Proceso';
  hojaListas.getCell('A2').value = 'Todos';
  listaProcesos.forEach((proceso, indice) => { hojaListas.getCell(indice + 3, 1).value = proceso; });
  hojaListas.getCell('B1').value = 'Nivel residual';
  ['Todos', ...niveles].forEach((nivel, indice) => { hojaListas.getCell(indice + 2, 2).value = nivel; });
  hojaListas.state = 'hidden';
  libro.definedNames.add(`'Listas'!$A$2:$A$${listaProcesos.length + 2}`, 'ListaProcesos');
  libro.definedNames.add("'Listas'!$B$2:$B$6", 'ListaNiveles');

  const dashboard = libro.addWorksheet('Dashboard', {
    properties: { tabColor: { argb: 'FFE3B93F' } },
    views: [{ showGridLines: false }],
  });
  dashboard.columns = [
    { width: 16 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 3 },
    { width: 16 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 },
  ];
  configurarTitulo(dashboard, 13, 'RIESGOS | PANEL EJECUTIVO', `Termales de Santa Rosa de Cabal  |  ${alcance}  |  Generado: ${new Date().toLocaleString('es-CO')}`);
  dashboard.getRow(4).height = 28;
  dashboard.getCell('A4').value = 'PROCESO';
  dashboard.getCell('B4').value = 'Todos';
  dashboard.getCell('H4').value = 'NIVEL RESIDUAL';
  dashboard.getCell('I4').value = 'Todos';
  dashboard.mergeCells('B4:F4');
  dashboard.mergeCells('I4:M4');
  dashboard.getCell('B4').dataValidation = { type: 'list', allowBlank: false, formulae: ['ListaProcesos'] };
  dashboard.getCell('I4').dataValidation = { type: 'list', allowBlank: false, formulae: ['ListaNiveles'] };
  ['A4', 'H4'].forEach(referencia => {
    dashboard.getCell(referencia).font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.tinta } };
  });
  ['B4', 'I4'].forEach(referencia => {
    const celda = dashboard.getCell(referencia);
    celda.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.verde } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4D6' } };
    celda.border = { top: { style: 'thin', color: { argb: COLORES.borde } }, bottom: { style: 'medium', color: { argb: COLORES.verde } } };
  });

  const matrizInicio = 5;
  const matrizFin = matrizInicio + matrizRiesgos.length - 1;
  const controlesFin = 4 + controlesPorRiesgo.length;
  const rango = (nombreHoja, columna, inicio, fin) => `'${nombreHoja}'!$${columna}$${inicio}:$${columna}$${fin}`;
  const columnaMatriz = encabezado => hojaMatriz.getColumn(encabezadosMatriz.indexOf(encabezado) + 1).letter;
  const columnaControles = encabezado => hojaControles.getColumn(encabezadosControles.indexOf(encabezado) + 1).letter;
  const rangoProceso = rango('Matriz Corporativa', columnaMatriz('Proceso'), matrizInicio, matrizFin);
  const rangoNivel = rango('Matriz Corporativa', columnaMatriz('Nivel Residual Final'), matrizInicio, matrizFin);
  const rangoMitigacion = rango('Matriz Corporativa', columnaMatriz('Mitigación Lograda (%)'), matrizInicio, matrizFin);
  const rangoProcesoControl = rango('Controles por Riesgo', columnaControles('Proceso'), 5, controlesFin);
  const rangoNivelControl = rango('Controles por Riesgo', columnaControles('Nivel Residual'), 5, controlesFin);
  const rangoEstructurado = rango('Controles por Riesgo', columnaControles('Control Estructurado'), 5, controlesFin);
  const rangoEficaciaControl = rango('Controles por Riesgo', columnaControles('Eficacia Calculada (%)'), 5, controlesFin);
  const rangoEficaciaMaximoControl = rango('Controles por Riesgo', columnaControles('Eficacia del Máximo Posible (%)'), 5, controlesFin);
  const rangoProbInherenteGrc = rango('Matriz Corporativa', columnaMatriz('Probabilidad Inherente (Tabla 2)'), matrizInicio, matrizFin);
  const rangoImpactoInherenteGrc = rango('Matriz Corporativa', columnaMatriz('Impacto Inherente (Tabla 3)'), matrizInicio, matrizFin);
  const rangoProbResidualGrc = rango('Matriz Corporativa', columnaMatriz('Probabilidad Residual (Tabla 2)'), matrizInicio, matrizFin);
  const rangoImpactoResidualGrc = rango('Matriz Corporativa', columnaMatriz('Impacto Residual (Tabla 3)'), matrizInicio, matrizFin);
  const criterioProceso = 'IF($B$4="Todos","*",$B$4)';
  const criterioNivel = 'IF($I$4="Todos","*",$I$4)';
  const formulaTotalRiesgos = `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},${criterioNivel})`;
  const conteoNivel = nivel => `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},"${nivel}")`;
  const riesgosAltos = `IF(OR($I$4="Todos",$I$4="EXTREMO"),${conteoNivel('EXTREMO')},0)+IF(OR($I$4="Todos",$I$4="ALTO"),${conteoNivel('ALTO')},0)`;
  const controlesFiltrados = `COUNTIFS(${rangoProcesoControl},${criterioProceso},${rangoNivelControl},${criterioNivel},${rangoEstructurado},"Sí")`;
  const formulaMitigacion = `IFERROR(AVERAGEIFS(${rangoMitigacion},${rangoProceso},${criterioProceso},${rangoNivel},${criterioNivel}),0)`;
  const formulaEficacia = `IFERROR(AVERAGEIFS(${rangoEficaciaControl},${rangoProcesoControl},${criterioProceso},${rangoNivelControl},${criterioNivel},${rangoEstructurado},"Sí"),0)`;
  // Lo que ve el usuario en la app: cada control frente al máximo de su tipo (un preventivo manual = 80 %).
  const formulaEficaciaMaximo = `IFERROR(AVERAGEIFS(${rangoEficaciaMaximoControl},${rangoProcesoControl},${criterioProceso},${rangoNivelControl},${criterioNivel},${rangoEstructurado},"Sí"),0)`;
  // 🧾 Explicación de la eficacia promedio con los controles del filtro (Tabla 6: tipo + implementación).
  const rangoTipoControl = rango('Controles por Riesgo', columnaControles('Tipo'), 5, controlesFin);
  const rangoImplementacionControl = rango('Controles por Riesgo', columnaControles('Implementación'), 5, controlesFin);
  const filtroControles = `${rangoProcesoControl},${criterioProceso},${rangoNivelControl},${criterioNivel},${rangoEstructurado},"Sí"`;
  const COMBINACIONES_TABLA_6 = [
    ['Preventivo', 'Automático', 'preventivo(s) automático(s)', 50],
    ['Preventivo', 'Manual', 'preventivo(s) manual(es)', 40],
    ['Detectivo', 'Automático', 'detectivo(s) automático(s)', 40],
    ['Detectivo', 'Manual', 'detectivo(s) manual(es)', 30],
    ['Correctivo', 'Automático', 'correctivo(s) automático(s)', 35],
    ['Correctivo', 'Manual', 'correctivo(s) manual(es)', 25],
  ];
  const MAXIMO_POR_TIPO = { Preventivo: 50, Detectivo: 40, Correctivo: 35 };
  const contarCombinacion = (tipo, implementacion) => `COUNTIFS(${filtroControles},${rangoTipoControl},"${tipo}",${rangoImplementacionControl},"${implementacion}")`;
  const contarTipo = tipo => `COUNTIFS(${filtroControles},${rangoTipoControl},"${tipo}")`;
  const manualesFiltro = `COUNTIFS(${filtroControles},${rangoImplementacionControl},"Manual")`;
  // Conteos en celdas auxiliares (columna P, oculta): la explicación las referencia y no supera el límite de largo de fórmula de Excel.
  const auxiliares = [
    ...COMBINACIONES_TABLA_6.map(([tipo, implementacion]) => contarCombinacion(tipo, implementacion)),
    controlesFiltrados,
    formulaEficacia,
    `IFERROR((${Object.entries(MAXIMO_POR_TIPO).map(([tipo, maximo]) => `${contarTipo(tipo)}*${maximo}`).join('+')})/${controlesFiltrados},0)`,
    manualesFiltro,
  ];
  const celdaAux = indice => `$P$${22 + indice}`;
  const [totalAux, promedioAux, maximoAux, manualesAux] = [6, 7, 8, 9].map(celdaAux);
  // Calificación sobre el máximo de la Tabla 6 (50 %, preventivo automático), con los rangos de color de la app:
  // verde ≥ 80 % del máximo (Excelente ≥ 90 %), ámbar 60–79 %, rojo < 60 %.
  const [calificacionAux, metaAux, faltanAux, porAutomatizarAux] = [10, 11, 12, 13].map(celdaAux);
  auxiliares.push(
    `IF(${totalAux}=0,"SIN CONTROLES",IF(ROUND(${promedioAux},0)>=45,"EXCELENTE",IF(ROUND(${promedioAux},0)>=40,"BUENO",IF(ROUND(${promedioAux},0)>=30,"MODERADO","MALO"))))`,
    `IF(ROUND(${promedioAux},0)>=45,0,IF(ROUND(${promedioAux},0)>=40,45,IF(ROUND(${promedioAux},0)>=30,40,30)))`,
    `MAX(0,${metaAux}-${promedioAux})`,
    `IFERROR(ROUNDUP(${faltanAux}*${totalAux}/10,0),0)`,
    formulaEficaciaMaximo,
  );
  const sobreMaximoAux = celdaAux(14);
  const detalleCombinaciones = `_xlfn.TEXTJOIN(", ",TRUE,${COMBINACIONES_TABLA_6.map(([, , etiqueta, puntos], indice) => (
    `IF(${celdaAux(indice)}>0,${celdaAux(indice)}&" ${etiqueta} (${puntos} %)","")`
  )).join(',')})`;
  const formulaExplicacionEficacia = `IF(${totalAux}=0,"No hay controles estructurados en este filtro, por eso la eficacia promedio es 0 %.",`
    + `"Se muestra "&TEXT(${sobreMaximoAux},"0")&" %: qué tan cerca está cada control del máximo posible para su tipo (Preventivo 50, Detectivo 40, Correctivo 35), promediado; un preventivo manual (40 de 50) está al 80 %. "&"Cómo se obtiene el "&TEXT(${promedioAux},"0")&" % de la Tabla 6: cada control vale su tipo (Preventivo 25, Detectivo 15, Correctivo 10) más su implementación (Automático 25, Manual 15), según la Tabla 6 del Manual del Sistema Integral de Riesgos (E-GE-MAN-001) de Termales Santa Rosa de Cabal. `
    + `En este filtro hay "&${totalAux}&" controles: "&${detalleCombinaciones}&". Promedio: "&TEXT(${promedioAux},"0")&" %. Con el tipo de estos controles, lo máximo alcanzable automatizándolos todos sería "&TEXT(${maximoAux},"0")&" %."`
    + `&IF(${manualesAux}>0," Si los "&${manualesAux}&" controles manuales se automatizaran, cada uno sumaría 10 puntos y el promedio subiría a "&TEXT(${promedioAux}+10*${manualesAux}/${totalAux},"0")&" %.",""))`;
  // Mismo texto calculado en JavaScript, para que el archivo lo muestre aunque Excel no haya recalculado.
  const controlesEstructurados = controlesPorRiesgo.filter(control => control['Control Estructurado'] === 'Sí');
  const explicacionEficaciaInicial = (() => {
    const total = controlesEstructurados.length;
    if (total === 0) return 'No hay controles estructurados en este filtro, por eso la eficacia promedio es 0 %.';
    const promedio = controlesEstructurados.reduce((suma, control) => suma + Number(control['Eficacia Calculada (%)'] || 0), 0) / total;
    const maximo = controlesEstructurados.reduce((suma, control) => suma + (MAXIMO_POR_TIPO[control.Tipo] || 50), 0) / total;
    const manuales = controlesEstructurados.filter(control => control['Implementación'] === 'Manual').length;
    const detalle = COMBINACIONES_TABLA_6.map(([tipo, implementacion, etiqueta, puntos]) => {
      const cantidad = controlesEstructurados.filter(control => control.Tipo === tipo && control['Implementación'] === implementacion).length;
      return cantidad > 0 ? `${cantidad} ${etiqueta} (${puntos} %)` : '';
    }).filter(Boolean).join(', ');
    const sobreMaximo = controlesEstructurados.reduce((suma, control) => suma + Number(control['Eficacia del Máximo Posible (%)'] || 0), 0) / total;
    return `Se muestra ${Math.round(sobreMaximo)} %: qué tan cerca está cada control del máximo posible para su tipo (Preventivo 50, Detectivo 40, Correctivo 35), promediado; un preventivo manual (40 de 50) está al 80 %. `
      + `Cómo se obtiene el ${Math.round(promedio)} % de la Tabla 6: cada control vale su tipo (Preventivo 25, Detectivo 15, Correctivo 10) más su implementación (Automático 25, Manual 15), según la Tabla 6 del Manual del Sistema Integral de Riesgos (E-GE-MAN-001) de Termales Santa Rosa de Cabal. `
      + `En este filtro hay ${total} controles: ${detalle}. Promedio: ${Math.round(promedio)} %. Con el tipo de estos controles, lo máximo alcanzable automatizándolos todos sería ${Math.round(maximo)} %.`
      + (manuales > 0 ? ` Si los ${manuales} controles manuales se automatizaran, cada uno sumaría 10 puntos y el promedio subiría a ${Math.round(promedio + (10 * manuales) / total)} %.` : '');
  })();
  const SIGNIFICADO_CALIFICACION = {
    EXCELENTE: 'Qué significa: casi todos los controles son preventivos y automáticos; evitan que el riesgo ocurra sin depender de una persona. Mantenerlos y verificar que sigan operando.',
    BUENO: 'Qué significa: predominan los controles preventivos, pero varios dependen de una persona (manuales).',
    MODERADO: 'Qué significa: muchos controles son manuales o solo detectan o corrigen después de que el riesgo ocurre; conviene volverlos preventivos o automatizarlos.',
    MALO: 'Qué significa: la mayoría de los controles actúa después de que el riesgo ocurre y de forma manual; hay que priorizar controles preventivos.',
  };
  // La escala es interna de la app (no la define el manual) y se aplica al promedio de la Tabla 6.
  const ESCALA_CALIFICACION = 'Escala interna de la app sobre el promedio de la Tabla 6 (no la define el manual): Excelente ≥ 45 % · Bueno 40–44 % · Moderado 30–39 % · Malo < 30 %.';
  const formulaCalificacionEficacia = `IF(${totalAux}=0,"Calificación: sin controles estructurados en este filtro.",`
    + `"Calificación interna: "&${calificacionAux}&" (promedio de la Tabla 6: "&TEXT(${promedioAux},"0")&" %). ${ESCALA_CALIFICACION} "`
    + `&IF(${calificacionAux}="EXCELENTE","${SIGNIFICADO_CALIFICACION.EXCELENTE}",IF(${calificacionAux}="BUENO","${SIGNIFICADO_CALIFICACION.BUENO}",IF(${calificacionAux}="MODERADO","${SIGNIFICADO_CALIFICACION.MODERADO}","${SIGNIFICADO_CALIFICACION.MALO}")))`
    + `&IF(${metaAux}>0," Para subir a "&IF(${metaAux}=45,"Excelente",IF(${metaAux}=40,"Bueno","Moderado"))&" ("&${metaAux}&" %) faltan "&TEXT(${faltanAux},"0.0")&" puntos"`
    + `&IF(AND(${porAutomatizarAux}>0,${porAutomatizarAux}<=${manualesAux}),": equivale a automatizar "&${porAutomatizarAux}&" de los "&${manualesAux}&" controles manuales.","."),""))`;
  const calificacionEficaciaInicial = (() => {
    const total = controlesEstructurados.length;
    if (total === 0) return 'Calificación: sin controles estructurados en este filtro.';
    const promedio = controlesEstructurados.reduce((suma, control) => suma + Number(control['Eficacia Calculada (%)'] || 0), 0) / total;
    const redondeado = Math.round(promedio);
    const calificacion = redondeado >= 45 ? 'EXCELENTE' : redondeado >= 40 ? 'BUENO' : redondeado >= 30 ? 'MODERADO' : 'MALO';
    const meta = redondeado >= 45 ? 0 : redondeado >= 40 ? 45 : redondeado >= 30 ? 40 : 30;
    const faltan = Math.max(0, meta - promedio);
    const porAutomatizar = Math.ceil((faltan * total) / 10);
    const manuales = controlesEstructurados.filter(control => control['Implementación'] === 'Manual').length;
    const subir = meta > 0
      ? ` Para subir a ${meta === 45 ? 'Excelente' : meta === 40 ? 'Bueno' : 'Moderado'} (${meta} %) faltan ${faltan.toFixed(1).replace('.', ',')} puntos`
        + (porAutomatizar > 0 && porAutomatizar <= manuales ? `: equivale a automatizar ${porAutomatizar} de los ${manuales} controles manuales.` : '.')
      : '';
    return `Calificación interna: ${calificacion} (promedio de la Tabla 6: ${redondeado} %). ${ESCALA_CALIFICACION} ${SIGNIFICADO_CALIFICACION[calificacion]}${subir}`;
  })();
  const riesgosAltosIniciales = matrizRiesgos.filter(riesgo => ['EXTREMO', 'ALTO'].includes(riesgo['Nivel Residual Final'])).length;
  // Los riesgos "Sin dato" no entran al promedio (igual que AVERAGEIFS, que ignora el texto).
  const mitigacionesConDato = matrizRiesgos.map(riesgo => riesgo['Mitigación Lograda (%)']).filter(valor => typeof valor === 'number');
  const mitigacionInicial = mitigacionesConDato.length ? mitigacionesConDato.reduce((total, valor) => total + valor, 0) / mitigacionesConDato.length : 0;
  const controlesIniciales = controlesPorRiesgo.filter(control => control['Control Estructurado'] === 'Sí').length;
  const eficaciaMaximoInicial = controlesPorRiesgo.filter(control => control['Control Estructurado'] === 'Sí')
    .reduce((total, control, indice, controles) => total + Number(control['Eficacia del Máximo Posible (%)'] || 0) / controles.length, 0);

  const tarjetas = [
    { inicio: 1, titulo: 'RIESGOS EN FILTRO', formula: formulaTotalRiesgos, resultado: matrizRiesgos.length, formato: '#,##0' },
    { inicio: 4, titulo: 'ALTOS / EXTREMOS', formula: riesgosAltos, resultado: riesgosAltosIniciales, formato: '#,##0' },
    { inicio: 8, titulo: 'CONTROLES ESTRUCTURADOS', formula: controlesFiltrados, resultado: controlesIniciales, formato: '#,##0' },
    { inicio: 11, titulo: 'MITIGACIÓN PROMEDIO', formula: formulaMitigacion, resultado: mitigacionInicial, formato: '0"%"' },
  ];
  tarjetas.forEach(({ inicio, titulo, formula, resultado, formato }) => {
    const fin = inicio + 2;
    dashboard.mergeCells(7, inicio, 7, fin);
    dashboard.mergeCells(8, inicio, 9, fin);
    const celdaTitulo = dashboard.getCell(7, inicio);
    celdaTitulo.value = titulo;
    celdaTitulo.font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.blanco } };
    celdaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verde } };
    celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const valor = dashboard.getCell(8, inicio);
    escribirFormula(valor, formula, resultado, formato);
    valor.font = { name: 'Aptos Display', size: 22, bold: true, color: { argb: COLORES.tinta } };
    valor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verdeClaro } };
    valor.alignment = { horizontal: 'center', vertical: 'middle' };
    valor.border = { bottom: { style: 'medium', color: { argb: COLORES.verde } } };
  });
  dashboard.getRow(7).height = 30;
  dashboard.getRow(8).height = 28;
  dashboard.getRow(9).height = 18;

  // Escalas del manual: probabilidad (Tabla 2) de izquierda a derecha, impacto (Tabla 3) de mayor a menor.
  const probabilidadesGrc = [...ESCALA_PROBABILIDAD];
  const impactosGrc = [...ESCALA_IMPACTO].reverse();
  const agregarMatrizGrc = (columnaInicio, titulo, rangoProbabilidad, rangoImpacto, campoProbabilidad, campoImpacto) => {
    dashboard.mergeCells(12, columnaInicio, 12, columnaInicio + 5);
    const encabezado = dashboard.getCell(12, columnaInicio);
    encabezado.value = titulo;
    encabezado.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
    encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.tinta } };
    encabezado.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    dashboard.getRow(12).height = 27;

    const etiquetaEjes = dashboard.getCell(13, columnaInicio);
    etiquetaEjes.value = 'Impacto ↓ / Prob. →';
    etiquetaEjes.font = { name: 'Aptos', size: 8, bold: true, color: { argb: COLORES.texto } };
    etiquetaEjes.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    probabilidadesGrc.forEach((probabilidad, indice) => {
      const celda = dashboard.getCell(13, columnaInicio + indice + 1);
      celda.value = probabilidad;
      celda.font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.tinta } };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verdeClaro } };
      celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    impactosGrc.forEach((impacto, indiceImpacto) => {
      const fila = 14 + indiceImpacto;
      const celdaImpacto = dashboard.getCell(fila, columnaInicio);
      celdaImpacto.value = impacto;
      celdaImpacto.font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.texto } };
      celdaImpacto.alignment = { vertical: 'middle', horizontal: 'right' };
      probabilidadesGrc.forEach((probabilidad, indiceProbabilidad) => {
        const columna = columnaInicio + indiceProbabilidad + 1;
        const celda = dashboard.getCell(fila, columna);
        const nivelP = indiceProbabilidad + 1;
        const nivelI = ESCALA_IMPACTO.indexOf(impacto) + 1;
        const puntaje = nivelP * nivelI;
        const zona = zonaPorNiveles(nivelP, nivelI).toUpperCase();
        const registrosCelda = matrizRiesgos.filter(riesgo => (
          riesgo[campoProbabilidad] === probabilidad
          && riesgo[campoImpacto] === impacto
          && (riesgo.Proceso === dashboard.getCell('B4').value || dashboard.getCell('B4').value === 'Todos')
          && (riesgo['Nivel Residual Final'] === dashboard.getCell('I4').value || dashboard.getCell('I4').value === 'Todos')
        ));
        const rangoProbabilidadCell = dashboard.getCell(13, columna).address;
        const rangoImpactoCell = dashboard.getCell(fila, columnaInicio).address;
        const formula = `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},${criterioNivel},${rangoProbabilidad},${rangoProbabilidadCell},${rangoImpacto},${rangoImpactoCell})`;
        const conteo = registrosCelda.length;
        escribirFormula(celda, `IF(${formula}=0,"",${formula}&CHAR(10)&"S: ${puntaje}")`, conteo ? `${conteo}\nS: ${puntaje}` : '');
        celda.font = { name: 'Aptos', size: 10, bold: true, color: { argb: zona === 'MODERADO' ? COLORES.texto : COLORES.blanco } };
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorNivel(zona) } };
        celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        celda.border = {
          top: { style: 'thin', color: { argb: COLORES.blanco } },
          bottom: { style: 'thin', color: { argb: COLORES.blanco } },
          left: { style: 'thin', color: { argb: COLORES.blanco } },
          right: { style: 'thin', color: { argb: COLORES.blanco } },
        };
      });
      dashboard.getRow(fila).height = 32;
    });
  };

  agregarMatrizGrc(1, 'MATRIZ INHERENTE · ANTES DE CONTROLES', rangoProbInherenteGrc, rangoImpactoInherenteGrc, 'Probabilidad Inherente (Tabla 2)', 'Impacto Inherente (Tabla 3)');
  agregarMatrizGrc(8, 'MATRIZ RESIDUAL · DESPUÉS DE CONTROLES', rangoProbResidualGrc, rangoImpactoResidualGrc, 'Probabilidad Residual (Tabla 2)', 'Impacto Residual (Tabla 3)');

  dashboard.mergeCells('A20:F20');
  dashboard.getCell('A20').value = 'DISTRIBUCIÓN DEL RIESGO RESIDUAL';
  dashboard.getCell('A20').font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
  dashboard.getCell('A20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.tinta } };
  dashboard.getCell('A21').value = 'Nivel';
  dashboard.getCell('B21').value = 'Riesgos';
  dashboard.getCell('C21').value = 'Distribución';
  dashboard.mergeCells('C21:F21');
  ['A21', 'B21', 'C21'].forEach(referencia => {
    dashboard.getCell(referencia).font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.tinta } };
    dashboard.getCell(referencia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.fondo } };
  });
  niveles.forEach((nivel, indice) => {
    const fila = 22 + indice;
    const resultado = matrizRiesgos.filter(riesgo => riesgo['Nivel Residual Final'] === nivel).length;
    const celdaNivel = dashboard.getCell(fila, 1);
    celdaNivel.value = nivel;
    celdaNivel.font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.blanco } };
    celdaNivel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorNivel(nivel) } };
    const conteo = dashboard.getCell(fila, 2);
    escribirFormula(conteo, `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},${criterioNivel},${rangoNivel},"${nivel}")`, resultado);
    conteo.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.texto } };
    const barra = dashboard.getCell(fila, 3);
    dashboard.mergeCells(fila, 3, fila, 6);
    const cantidadBarra = matrizRiesgos.length > 0 ? Math.round(resultado / Math.max(...niveles.map(n => matrizRiesgos.filter(r => r['Nivel Residual Final'] === n).length), 1) * 24) : 0;
    escribirFormula(barra, `REPT("■",IF(MAX($B$22:$B$25)=0,0,ROUND(B${fila}/MAX($B$22:$B$25)*24,0)))`, '■'.repeat(cantidadBarra));
    barra.font = { name: 'Aptos', size: 12, color: { argb: colorNivel(nivel) } };
    barra.alignment = { vertical: 'middle', horizontal: 'left' };
    dashboard.getRow(fila).height = 24;
  });

  // Regla real del manual: la zona sale de la Tabla 4 (no de rangos de puntaje) y la respuesta del numeral 9.
  dashboard.mergeCells('H20:M20');
  dashboard.getCell('H20').value = 'ZONAS DE RIESGO · TABLA 4 Y NUMERAL 9 DEL MANUAL E-GE-MAN-001';
  dashboard.getCell('H20').font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
  dashboard.getCell('H20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.tinta } };
  dashboard.getCell('H21').value = 'Zona';
  dashboard.getCell('I21').value = 'Cuándo (Tabla 4)';
  dashboard.mergeCells('I21:K21');
  dashboard.getCell('L21').value = 'Respuesta (numeral 9)';
  dashboard.mergeCells('L21:M21');
  const zonasTabla4 = [
    ['EXTREMO', 'Impacto Catastrófico, con cualquier probabilidad.', 'Plan de acción obligatorio.'],
    ['ALTO', 'Impacto Mayor con cualquier probabilidad; probabilidad Muy alta; o Alta con impacto Moderado.', 'Plan de acción obligatorio.'],
    ['MODERADO', 'Combinaciones intermedias que no son Extremo, Alto ni Bajo.', 'Seguimiento con fecha programada.'],
    ['BAJO', 'Probabilidad Muy baja con impacto Leve o Menor; o Baja con impacto Leve.', 'Seguimiento con fecha programada.'],
  ];
  zonasTabla4.forEach(([zona, regla, respuesta], indice) => {
    const fila = 22 + indice;
    const celdaZona = dashboard.getCell(fila, 8);
    celdaZona.value = zona;
    celdaZona.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorNivel(zona) } };
    celdaZona.font = { name: 'Aptos', size: 9, bold: true, color: { argb: zona === 'MODERADO' ? COLORES.texto : COLORES.blanco } };
    dashboard.mergeCells(fila, 9, fila, 11);
    dashboard.getCell(fila, 9).value = regla;
    dashboard.mergeCells(fila, 12, fila, 13);
    dashboard.getCell(fila, 12).value = respuesta;
    [9, 12].forEach(columna => {
      dashboard.getCell(fila, columna).font = { name: 'Aptos', size: 9, color: { argb: COLORES.texto } };
      dashboard.getCell(fila, columna).alignment = { wrapText: true, vertical: 'middle' };
    });
  });
  ['H21', 'I21', 'L21'].forEach(referencia => {
    dashboard.getCell(referencia).font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.tinta } };
    dashboard.getCell(referencia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.fondo } };
  });

  dashboard.mergeCells('H27:L27');
  dashboard.getCell('H27').value = 'EFICACIA PROMEDIO (DEL MÁXIMO POSIBLE)';
  dashboard.getCell('H27').font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.verde } };
  dashboard.getCell('H27').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verdeClaro } };
  escribirFormula(dashboard.getCell('M27'), formulaEficaciaMaximo, eficaciaMaximoInicial, '0"%"');
  dashboard.getCell('M27').font = { name: 'Aptos', size: 11, bold: true, color: { argb: COLORES.tinta } };
  dashboard.getCell('M27').alignment = { horizontal: 'center', vertical: 'middle' };
  dashboard.getRow(27).height = 26;
  dashboard.mergeCells('A28:M28');
  dashboard.getCell('A28').value = { formula: formulaExplicacionEficacia, result: explicacionEficaciaInicial };
  dashboard.getCell('A28').font = { name: 'Aptos', size: 9, color: { argb: COLORES.texto } };
  dashboard.getCell('A28').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verdeClaro } };
  dashboard.getCell('A28').alignment = { wrapText: true, vertical: 'top' };
  dashboard.getRow(28).height = 58;
  // Valores ya calculados de las celdas auxiliares: en Vista protegida Excel no recalcula, y sin ellos la
  // calificación quedaba sin color.
  const resultadosAux = (() => {
    const total = controlesEstructurados.length;
    const combos = COMBINACIONES_TABLA_6.map(([tipo, implementacion]) => controlesEstructurados
      .filter(control => control.Tipo === tipo && control['Implementación'] === implementacion).length);
    const promedio = total ? controlesEstructurados.reduce((suma, control) => suma + Number(control['Eficacia Calculada (%)'] || 0), 0) / total : 0;
    const maximo = total ? controlesEstructurados.reduce((suma, control) => suma + (MAXIMO_POR_TIPO[control.Tipo] || 50), 0) / total : 0;
    const manuales = controlesEstructurados.filter(control => control['Implementación'] === 'Manual').length;
    const redondeado = Math.round(promedio);
    const calificacion = !total ? 'SIN CONTROLES' : redondeado >= 45 ? 'EXCELENTE' : redondeado >= 40 ? 'BUENO' : redondeado >= 30 ? 'MODERADO' : 'MALO';
    const meta = redondeado >= 45 ? 0 : redondeado >= 40 ? 45 : redondeado >= 30 ? 40 : 30;
    const faltan = Math.max(0, meta - promedio);
    const sobreMaximo = total ? controlesEstructurados.reduce((suma, control) => suma + Number(control['Eficacia del Máximo Posible (%)'] || 0), 0) / total : 0;
    return [...combos, total, promedio, maximo, manuales, calificacion, meta, faltan, total ? Math.ceil((faltan * total) / 10) : 0, sobreMaximo];
  })();
  auxiliares.forEach((formula, indice) => { dashboard.getCell(celdaAux(indice).replace(/\$/g, '')).value = { formula, result: resultadosAux[indice] }; });
  dashboard.getColumn('P').hidden = true;
  dashboard.mergeCells('A29:M29');
  dashboard.getCell('A29').value = { formula: formulaCalificacionEficacia, result: calificacionEficaciaInicial };
  dashboard.getCell('A29').font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.texto } };
  dashboard.getCell('A29').alignment = { wrapText: true, vertical: 'top' };
  dashboard.getRow(29).height = 58;
  const colorCalificacion = [
    [`${calificacionAux}="EXCELENTE"`, COLORES.bajo, COLORES.blanco],
    [`${calificacionAux}="BUENO"`, COLORES.bajo, COLORES.blanco],
    [`${calificacionAux}="MODERADO"`, COLORES.moderado, COLORES.texto],
    [`${calificacionAux}="MALO"`, COLORES.extremo, COLORES.blanco],
  ];
  ['M27', 'A29:M29'].forEach(ref => dashboard.addConditionalFormatting({
    ref,
    rules: colorCalificacion.map(([formula, fondo, letra], indice) => ({
      type: 'expression', priority: indice + 1, formulae: [formula],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: fondo } }, font: { color: { argb: letra }, bold: true } },
    })),
  }));
  dashboard.mergeCells('A30:M30');
  dashboard.getCell('A30').value = 'Los filtros de proceso y nivel residual actualizan los indicadores y ambos mapas. Mapas de calor con las escalas de las Tablas 2 (probabilidad) y 3 (impacto) y el color de zona de la Tabla 4 del Manual del Sistema Integral de Riesgos E-GE-MAN-001. S = nivel de probabilidad × nivel de impacto (1 a 25), solo como referencia: la zona la define la Tabla 4.';
  dashboard.getCell('A30').font = { name: 'Aptos', size: 9, italic: true, color: { argb: 'FF64746C' } };
  dashboard.getCell('A30').alignment = { wrapText: true };
  dashboard.getRow(30).height = 28;

  return libro;
};