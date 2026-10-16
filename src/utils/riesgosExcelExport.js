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
      header: encabezado,
      key: encabezado,
      width: Math.min(42, Math.max(14, longitudMaxima + 2)),
      style: { alignment: { vertical: 'top', wrapText: true } },
    };
  });
  hoja.addTable({
    name: nombre.replace(/\s/g, ''),
    ref: 'A4',
    headerRow: true,
    style: { theme: 'TableStyleMedium4', showRowStripes: true },
    columns: encabezados.map(name => ({ name, filterButton: true })),
    rows: filas.map(fila => encabezados.map(encabezado => fila[encabezado] ?? null)),
  });
  hoja.getRow(4).height = 34;
  hoja.getRow(4).eachCell(cell => {
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.verde } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: COLORES.tinta } } };
  });
  return hoja;
};

const escribirFormula = (celda, formula, resultado, formato = '0') => {
  celda.value = { formula, result: resultado };
  celda.numFmt = formato;
};

export const crearLibroMatrizRiesgosExcel = async (riesgos, calculos) => {
  const { default: ExcelJS } = await import('exceljs');
  const riesgosExportados = riesgos.map(riesgo => {
    const zonaInherente = calculos.getSeverityZone(riesgo.probabilidadInherente, riesgo.impactoInherente);
    const zonaResidual = calculos.getSeverityZone(riesgo.probabilidadResidual, riesgo.impactoResidual);
    const controles = Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.filter(Boolean) : [];
    const controlLegado = controles.length === 0 ? String(riesgo.descripcionControl || '').trim() : '';
    const eficaciaPromedio = controles.length > 0
      ? Math.round(controles.reduce((total, control) => total + calculos.calcularEficaciaControl(control), 0) / controles.length)
      : null;
    return { riesgo, zonaInherente, zonaResidual, controles, controlLegado, eficaciaPromedio };
  });

  const matrizRiesgos = riesgosExportados.map(({ riesgo, zonaInherente, zonaResidual, controles, controlLegado, eficaciaPromedio }) => ({
    'ID Riesgo': `RSK-${riesgo.id}`,
    Estado: riesgo.estado || 'Activo',
    Proceso: riesgo.proceso || riesgo.macroproceso || 'No definido',
    Subproceso: riesgo.subproceso || 'General',
    'Categoría ISO 31000': riesgo.categoria || 'N/A',
    Clasificación: riesgo.clasificacionRiesgo || 'N/A',
    'Normativa Asociada': riesgo.normativa || 'N/A',
    'Sedes Afectadas': textoLista(riesgo.sede) || 'Sin sede',
    'Responsable(s)': textoLista(riesgo.responsable) || 'Sin asignar',
    'Tipo de Afectación': riesgo.afectacion || 'N/A',
    'Causa Inmediata': riesgo.causaInmediata || 'N/A',
    'Causa Raíz': riesgo.causaRaiz || 'N/A',
    'Escenario del Riesgo': riesgo.descripcion || riesgo.escenarioFinal || 'N/A',
    'Probabilidad Inherente (%)': riesgo.probabilidadInherente ?? 60,
    'Impacto Inherente (%)': riesgo.impactoInherente ?? 80,
    'Nivel Inherente': zonaInherente.label.toUpperCase(),
    'Total Controles': controles.length || (controlLegado ? 1 : 0),
    'Controles Estructurados': controles.length,
    'Eficacia Promedio de Controles (%)': eficaciaPromedio,
    'Descripción de Control Legado': controlLegado || 'N/A',
    'Mitigación Lograda (%)': calculos.calcularMitigacionRiesgo(riesgo),
    'Probabilidad Residual (%)': riesgo.probabilidadResidual ?? 15,
    'Impacto Residual (%)': riesgo.impactoResidual ?? 30,
    'Nivel Residual Final': zonaResidual.label.toUpperCase(),
    'Estrategia de Tratamiento': riesgo.tratamiento || 'Reducir el riesgo',
    'Plan de Acción': riesgo.planAccionRiesgo || 'N/A',
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
      Clasificación: riesgo.clasificacionRiesgo || 'N/A',
      'Sedes Afectadas': textoLista(riesgo.sede) || 'Sin sede',
      'Responsable del Riesgo': textoLista(riesgo.responsable) || 'Sin asignar',
      'Causa Inmediata': riesgo.causaInmediata || 'N/A',
      'Causa Raíz': riesgo.causaRaiz || 'N/A',
      'Normativa Asociada': riesgo.normativa || 'N/A',
      'Nivel Inherente': zonaInherente.label.toUpperCase(),
      'Nivel Residual': zonaResidual.label.toUpperCase(),
      'Estrategia de Tratamiento': riesgo.tratamiento || 'N/A',
      'Plan de Acción': riesgo.planAccionRiesgo || 'N/A',
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
        'Observaciones del Control': 'N/A',
      }];
    }
    return controles.map((control, indice) => ({
      ...contexto,
      'ID Control': `RSK-${riesgo.id}-C${indice + 1}`,
      'N° Control': indice + 1,
      'Control Estructurado': 'Sí',
      'Descripción del Control': control.descripcion || 'Sin descripción',
      Tipo: control.tipo || 'Preventivo',
      Implementación: control.implementacion || control.ejecucion || 'Manual',
      Documentación: control.documentacion || 'No especificada',
      Frecuencia: control.frecuencia || 'No especificada',
      Evidencia: control.evidencia || 'No especificada',
      'Responsable del Control': control.responsable || control.responsableControl || contexto['Responsable del Riesgo'],
      'Eficacia Calculada (%)': calculos.calcularEficaciaControl(control),
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
    'Inventario, evaluación inherente y residual, tratamiento y seguimiento.',
    matrizRiesgos,
    encabezadosMatriz,
  );
  const hojaControles = crearTabla(
    libro,
    'Controles por Riesgo',
    'CONTROLES Y EVIDENCIAS',
    'Cada control se vincula con el riesgo de origen mediante su identificador.',
    controlesPorRiesgo,
    encabezadosControles,
  );

  [hojaMatriz, hojaControles].forEach(hoja => {
    const indiceEficacia = hoja.columns.findIndex(columna => columna.key === 'Eficacia Calculada (%)') + 1;
    const indiceEficaciaPromedio = hoja.columns.findIndex(columna => columna.key === 'Eficacia Promedio de Controles (%)') + 1;
    const indiceMitigacion = hoja.columns.findIndex(columna => columna.key === 'Mitigación Lograda (%)') + 1;
    [indiceEficacia, indiceEficaciaPromedio, indiceMitigacion].filter(Boolean).forEach(indice => {
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
    { width: 20 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];
  configurarTitulo(dashboard, 8, 'RIESGOS | PANEL EJECUTIVO', `Termales de Santa Rosa de Cabal  |  Generado: ${new Date().toLocaleString('es-CO')}`);
  dashboard.getRow(4).height = 28;
  dashboard.getCell('A4').value = 'PROCESO';
  dashboard.getCell('B4').value = 'Todos';
  dashboard.getCell('D4').value = 'NIVEL RESIDUAL';
  dashboard.getCell('E4').value = 'Todos';
  dashboard.getCell('B4').dataValidation = { type: 'list', allowBlank: false, formulae: ['ListaProcesos'] };
  dashboard.getCell('E4').dataValidation = { type: 'list', allowBlank: false, formulae: ['ListaNiveles'] };
  ['A4', 'D4'].forEach(referencia => {
    dashboard.getCell(referencia).font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.tinta } };
  });
  ['B4', 'E4'].forEach(referencia => {
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
  const criterioProceso = 'IF($B$4="Todos","*",$B$4)';
  const criterioNivel = 'IF($E$4="Todos","*",$E$4)';
  const formulaTotalRiesgos = `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},${criterioNivel})`;
  const conteoNivel = nivel => `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},"${nivel}")`;
  const riesgosAltos = `IF(OR($E$4="Todos",$E$4="EXTREMO"),${conteoNivel('EXTREMO')},0)+IF(OR($E$4="Todos",$E$4="ALTO"),${conteoNivel('ALTO')},0)`;
  const controlesFiltrados = `COUNTIFS(${rangoProcesoControl},${criterioProceso},${rangoNivelControl},${criterioNivel},${rangoEstructurado},"Sí")`;
  const formulaMitigacion = `IFERROR(AVERAGEIFS(${rangoMitigacion},${rangoProceso},${criterioProceso},${rangoNivel},${criterioNivel}),0)`;
  const formulaEficacia = `IFERROR(AVERAGEIFS(${rangoEficaciaControl},${rangoProcesoControl},${criterioProceso},${rangoNivelControl},${criterioNivel},${rangoEstructurado},"Sí"),0)`;
  const riesgosAltosIniciales = matrizRiesgos.filter(riesgo => ['EXTREMO', 'ALTO'].includes(riesgo['Nivel Residual Final'])).length;
  const mitigacionInicial = matrizRiesgos.reduce((total, riesgo) => total + Number(riesgo['Mitigación Lograda (%)'] || 0), 0) / matrizRiesgos.length;
  const controlesIniciales = controlesPorRiesgo.filter(control => control['Control Estructurado'] === 'Sí').length;
  const eficaciaInicial = controlesPorRiesgo.filter(control => control['Control Estructurado'] === 'Sí')
    .reduce((total, control, indice, controles) => total + Number(control['Eficacia Calculada (%)'] || 0) / controles.length, 0);

  const tarjetas = [
    { inicio: 1, titulo: 'RIESGOS EN FILTRO', formula: formulaTotalRiesgos, resultado: matrizRiesgos.length, formato: '#,##0' },
    { inicio: 3, titulo: 'ALTOS / EXTREMOS', formula: riesgosAltos, resultado: riesgosAltosIniciales, formato: '#,##0' },
    { inicio: 5, titulo: 'CONTROLES ESTRUCTURADOS', formula: controlesFiltrados, resultado: controlesIniciales, formato: '#,##0' },
    { inicio: 7, titulo: 'MITIGACIÓN PROMEDIO', formula: formulaMitigacion, resultado: mitigacionInicial, formato: '0"%"' },
  ];
  tarjetas.forEach(({ inicio, titulo, formula, resultado, formato }) => {
    const fin = inicio + 1;
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

  dashboard.mergeCells('A12:D12');
  dashboard.getCell('A12').value = 'PERFIL DE RIESGO RESIDUAL POR PROCESO';
  dashboard.getCell('A12').font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
  dashboard.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.tinta } };
  dashboard.getCell('A13').value = 'Nivel';
  dashboard.getCell('B13').value = 'Riesgos';
  dashboard.getCell('C13').value = 'Distribución';
  dashboard.mergeCells('C13:D13');
  ['A13', 'B13', 'C13'].forEach(referencia => {
    dashboard.getCell(referencia).font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.tinta } };
    dashboard.getCell(referencia).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.fondo } };
  });
  niveles.forEach((nivel, indice) => {
    const fila = 14 + indice;
    const datosNivel = matrizRiesgos.filter(riesgo => riesgo['Nivel Residual Final'] === nivel);
    const resultado = datosNivel.length;
    const celdaNivel = dashboard.getCell(fila, 1);
    celdaNivel.value = nivel;
    celdaNivel.font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.blanco } };
    celdaNivel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorNivel(nivel) } };
    const conteo = dashboard.getCell(fila, 2);
    escribirFormula(conteo, `COUNTIFS(${rangoProceso},${criterioProceso},${rangoNivel},"${nivel}")`, resultado);
    conteo.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.texto } };
    const barra = dashboard.getCell(fila, 3);
    dashboard.mergeCells(fila, 3, fila, 4);
    const cantidadBarra = matrizRiesgos.length > 0 ? Math.round(resultado / Math.max(...niveles.map(n => matrizRiesgos.filter(r => r['Nivel Residual Final'] === n).length), 1) * 24) : 0;
    escribirFormula(barra, `REPT("■",IF(MAX($B$14:$B$17)=0,0,ROUND(B${fila}/MAX($B$14:$B$17)*24,0)))`, '■'.repeat(cantidadBarra));
    barra.font = { name: 'Aptos', size: 12, color: { argb: colorNivel(nivel) } };
    barra.alignment = { vertical: 'middle', horizontal: 'left' };
    dashboard.getRow(fila).height = 24;
  });

  dashboard.mergeCells('E12:H12');
  dashboard.getCell('E12').value = 'LECTURA EJECUTIVA';
  dashboard.getCell('E12').font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLORES.blanco } };
  dashboard.getCell('E12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORES.tinta } };
  dashboard.mergeCells('E14:H14');
  dashboard.getCell('E14').value = 'EFICACIA PROMEDIO DE CONTROLES';
  dashboard.mergeCells('E15:H16');
  escribirFormula(dashboard.getCell('E15'), formulaEficacia, eficaciaInicial, '0"%"');
  dashboard.getCell('E14').font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.verde } };
  dashboard.getCell('E15').font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: COLORES.tinta } };
  dashboard.getCell('E15').alignment = { horizontal: 'center', vertical: 'middle' };
  dashboard.mergeCells('E18:H18');
  dashboard.getCell('E18').value = 'CONTROLES ESTRUCTURADOS POR RIESGO';
  dashboard.mergeCells('E19:H20');
  const coberturaFormula = `IFERROR(${controlesFiltrados}/${formulaTotalRiesgos},0)`;
  const coberturaInicial = matrizRiesgos.length > 0 ? controlesIniciales / matrizRiesgos.length : 0;
  escribirFormula(dashboard.getCell('E19'), coberturaFormula, coberturaInicial, '0.0');
  dashboard.getCell('E18').font = { name: 'Aptos', size: 9, bold: true, color: { argb: COLORES.verde } };
  dashboard.getCell('E19').font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: COLORES.tinta } };
  dashboard.getCell('E19').alignment = { horizontal: 'center', vertical: 'middle' };
  dashboard.mergeCells('A22:H22');
  dashboard.getCell('A22').value = 'El panel se recalcula al abrir en Excel. Las hojas de matriz y controles incluyen filtros para análisis adicional.';
  dashboard.getCell('A22').font = { name: 'Aptos', size: 9, italic: true, color: { argb: 'FF64746C' } };
  dashboard.getCell('A22').alignment = { wrapText: true };
  dashboard.getRow(22).height = 28;

  return libro;
};