import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { evidencias360, fecha360, plazoSemanas360, progreso360, texto360 } from '../utils/reporte360.js';

const COLORES = {
  verde: [10, 59, 50],
  azul: [29, 78, 137],
  tinta: [35, 52, 48],
  tenue: [79, 100, 94],
  linea: [170, 190, 180],
  fondo: [242, 247, 244],
  oro: [165, 137, 82],
  blanco: [255, 255, 255],
  cerrado: [228, 242, 232],
  vencido: [252, 237, 233],
  alerta: [153, 44, 35],
};
const CRITERIOS = {
  c1: 'Completitud y cobertura (30%)',
  c2: 'Análisis de causa raíz (20%)',
  c3: 'Planes de choque inmediato (20%)',
  c4: 'Temporalidad y fechas (20%)',
  c5: 'Controles e indicadores (10%)',
};
const lista = valor => Array.isArray(valor) ? valor : [];
const textoPdf = valor => texto360(valor)
  .replace(/\uFE0F/gu, '')
  .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu, '')
  .replace(/→/g, ' > ').replace(/≤/g, '<=').replace(/≥/g, '>=')
  .replace(/[·•‧∙–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
const avance = valor => valor === null ? 'No registrado' : `${valor}%`;

export function crearPdfReporte360(reporte, { logo } = {}) {
  if (!logo) throw new Error('El logo empresarial es obligatorio para generar el Reporte 360.');
  if (!reporte?.expedientes?.length) throw new Error('No hay registros disponibles para exportar.');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const margen = 14;
  const contenido = ancho - margen * 2;
  const inicio = 37;
  const limite = alto - 22;
  doc.setProperties({
    title: 'Reporte 360 · Informe ejecutivo',
    subject: 'Informe, hallazgos, acciones, evaluaciones y trazabilidad',
    author: reporte.generadoPor,
    creator: 'Auditoría GCM - Termales Santa Rosa de Cabal',
  });
  doc.setCreationDate(new Date(reporte.generadoEn));
  const identificador = `R360-${reporte.generadoEn.replace(/\D/g, '')}`;
  const fechaCorte = new Date(reporte.generadoEn).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const alcance = reporte.modo === 'general' ? 'General · registros disponibles'
    : reporte.modo === 'fuentes' ? `Tipos de fuente: ${reporte.tiposFuente.join(', ')}`
      : `Informe ${reporte.expedientes[0].referencia}`;
  let y = inicio;
  const nuevaPagina = () => { doc.addPage(); y = inicio; };
  const asegurarEspacio = espacio => { if (y + espacio > limite) nuevaPagina(); };
  const seccion = (titulo, subtitulo) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const lineas = doc.splitTextToSize(textoPdf(titulo), contenido - 10);
    const altoBanda = lineas.length * 5.5 + 6;
    asegurarEspacio(altoBanda + 24);
    doc.setFillColor(...COLORES.fondo);
    doc.setDrawColor(...COLORES.linea);
    doc.setLineWidth(0.25);
    doc.roundedRect(margen, y, contenido, altoBanda, 1.5, 1.5, 'FD');
    doc.setTextColor(...COLORES.verde);
    doc.text(lineas, margen + 5, y + 7, { lineHeightFactor: 1.3 });
    y += altoBanda + 5;
    if (subtitulo) parrafo(subtitulo);
  };
  const parrafo = contenido => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.tinta);
    const anchoTexto = ancho - margen * 2;
    textoPdf(contenido).split('\n').forEach(bloque => {
      const lineas = doc.splitTextToSize(bloque, anchoTexto);
      let indice = 0;
      while (indice < lineas.length) {
        asegurarEspacio(6);
        const cantidad = Math.max(1, Math.floor((limite - y) / 4.6));
        const fin = Math.min(indice + cantidad, lineas.length);
        const pagina = lineas.slice(indice, fin);
        // jsPDF no justifica la última línea; en una continuación no es el fin del párrafo.
        if (fin < lineas.length) pagina.push('');
        doc.text(pagina, margen, y, {
          align: 'justify',
          maxWidth: anchoTexto,
          lineHeightFactor: 4.6 * doc.internal.scaleFactor / 9,
        });
        y += (fin - indice) * 4.6;
        indice = fin;
        if (indice < lineas.length) nuevaPagina();
      }
    });
    y += 3;
  };
  const tabla = (cabeceras, filas, opciones = {}) => {
    if (!filas.length) return;
    asegurarEspacio(21);
    doc.setLineHeightFactor(1.15);
    autoTable(doc, {
      startY: y,
      head: cabeceras.length ? [cabeceras.map(textoPdf)] : [],
      body: filas.map(fila => fila.map(celda => typeof celda === 'object' && celda !== null
        ? { ...celda, content: textoPdf(celda.content) } : textoPdf(celda))),
      margin: { top: inicio, bottom: alto - limite, left: margen, right: margen },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: COLORES.tinta, overflow: 'linebreak', valign: 'top', lineWidth: 0.2, lineColor: COLORES.linea },
      headStyles: { fillColor: COLORES.verde, textColor: COLORES.blanco, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COLORES.fondo },
      tableLineColor: COLORES.linea,
      tableLineWidth: 0.3,
      rowPageBreak: 'avoid',
      ...opciones,
    });
    y = doc.lastAutoTable.finalY + 7;
  };
  const ficha = filas => tabla(['Campo', 'Registro'], filas, { columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' } } });
  const fichaEjecutiva = campos => {
    const filas = [];
    const etiqueta = content => ({ content, styles: { fontStyle: 'bold', textColor: COLORES.verde, fillColor: COLORES.fondo } });
    for (let i = 0; i < campos.length; i += 2) {
      const [nombre, valor] = campos[i];
      const siguiente = campos[i + 1];
      filas.push(siguiente
        ? [etiqueta(nombre), valor, etiqueta(siguiente[0]), siguiente[1]]
        : [etiqueta(nombre), { content: valor, colSpan: 3 }]);
    }
    tabla([], filas, {
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: contenido / 2 - 36 }, 2: { cellWidth: 36 }, 3: { cellWidth: contenido / 2 - 36 } },
    });
  };
  const archivos = (registro, etiqueta) => {
    const enlaces = evidencias360(registro);
    if (!enlaces.length) return;
    tabla([`Evidencias · ${etiqueta}`, 'Ubicación del soporte'], enlaces.map(archivo => [archivo.nombre, archivo.url]), {
      columnStyles: { 0: { cellWidth: 44 }, 1: { textColor: COLORES.azul } },
      didDrawCell: data => {
        if (data.section !== 'body' || data.column.index !== 1) return;
        const archivo = enlaces[data.row.index];
        if (archivo?.enlazable) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: archivo.url });
      },
    });
  };
  const historial = (registro, referencia) => lista(registro.historialCambios).map(evento => [
    referencia,
    fecha360(evento.timestamp || evento.fecha || evento.fechaHora),
    texto360(evento.usuario),
    [
      texto360(evento.accion, 'Cambio registrado'),
      texto360(evento.motivo || evento.detalle?.motivo, ''),
      texto360(evento.detalle?.resumen, ''),
      ...lista(evento.detalle?.campos).map(campo => `${texto360(campo.label || campo.campo)}: ${texto360(campo.antes)} > ${texto360(campo.ahora)}`),
    ].filter(Boolean).join('\n'),
  ]);
  const evaluacion = plan => {
    const { tipo, resultado, registro, anterior, cierre } = plan.evaluacion;
    const filas = [['Evaluación aplicable', tipo], ['Resultado registrado', resultado]];
    if (registro) {
      filas.push(['Fecha y evaluador', `${fecha360(registro.fecha)}\n${texto360(registro.usuario)}`]);
      if (tipo === 'Evaluación integral del paquete' || tipo === 'Evaluación inicial del diseño') {
        filas.push(['Puntaje / dictamen', `${avance(progreso360(registro.puntaje))} · ${resultado}`]);
        Object.entries(CRITERIOS).forEach(([clave, nombre]) => {
          filas.push([nombre, avance(progreso360(registro.criterios?.[clave]))]);
        });
        filas.push(['Justificación', texto360(registro.justificacion)]);
      } else {
        filas.push(['Conclusión de eficacia', texto360(registro.conclusion)]);
        filas.push(['Acciones adicionales', registro.requiereAccionesAdicionales === true ? 'Sí' : registro.requiereAccionesAdicionales === false ? 'No' : 'No registrado']);
        filas.push(['Observaciones', texto360(registro.observaciones)]);
      }
    }
    if (anterior) filas.push(['Evaluación anterior', `Tipo: ${texto360(anterior.tipo)}. Fecha: ${fecha360(anterior.fecha)}. Puntaje: ${avance(progreso360(anterior.puntaje))}.`]);
    if (tipo === 'Evaluación inicial del diseño' || tipo === 'Evaluación integral del paquete') {
      filas.push(['Dictamen final por acción', cierre
        ? `${cierre.fueEficaz ? 'Aprobado' : 'No aprobado'}. ${fecha360(cierre.fecha)}. Auditor: ${texto360(cierre.usuario)}\n${texto360(cierre.conclusion)}\n${texto360(cierre.observaciones, '')}`
        : 'Sin dictamen final registrado']);
    }
    ficha(filas);
    const historico = lista(plan.registro.historialEvaluaciones);
    if (historico.length) {
      tabla(['Historial de evaluaciones', 'Puntaje / aprobación', 'Criterios y justificación'],
        historico.map(item => [
          `${fecha360(item.fecha)}\n${texto360(item.usuario)}\n${texto360(item.tipo, 'Tipo no registrado')}`,
          `${avance(progreso360(item.puntaje))}\n${item.aprobado === true ? 'Aprobada' : item.aprobado === false ? 'No aprobada' : 'Sin dictamen'}`,
          [
            ...Object.entries(CRITERIOS).map(([clave, nombre]) => `${nombre}: ${avance(progreso360(item.criterios?.[clave]))}`),
            texto360(item.justificacion),
          ].join('\n'),
        ]));
    }
  };
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORES.verde);
  doc.setFontSize(30);
  doc.text('Reporte 360', margen, y + 10);
  doc.setDrawColor(...COLORES.oro);
  doc.setLineWidth(0.7);
  doc.line(margen, y + 15, margen + 38, y + 15);
  y += 20;
  doc.setFont('helvetica', 'normal');
  parrafo('Informe ejecutivo de seguimiento · Fuente, informe emitido, hallazgos y plan de acción.');
  fichaEjecutiva([
    ['Fecha de corte', `${fechaCorte} (Colombia)`],
    ['Generado por', reporte.generadoPor],
    ['Alcance', alcance],
  ]);
  const r = reporte.resumen;
  tabla(['Informes', 'Hallazgos', 'Acciones', 'Cerradas', 'Abiertas', 'Vencidas'], [[r.informes, r.hallazgos, r.acciones, r.cerradas, r.abiertas, r.vencidas]]);

  reporte.expedientes.forEach(grupo => {
    nuevaPagina();
    seccion(`${grupo.referencia} · ${grupo.titulo}`);
    const fuente = grupo.fuente;
    const informe = grupo.informe;
    seccion('Datos de la fuente');
    fichaEjecutiva([['Tipo de fuente', grupo.tipoFuente]]);
    seccion('Informe emitido');
    if (informe) {
      fichaEjecutiva([
        ['Referencia / fecha', `${grupo.referencia} · ${fecha360(informe.fecha)}\n${grupo.titulo}`],
        ['Programa vinculado', texto360(informe.programaId, 'No corresponde / no registrado')],
        ['Proceso / subproceso', `${texto360(informe.macroprocesos || informe.macroproceso || informe.proceso)}\n${texto360(informe.subprocesos || informe.subproceso)}`],
        ['Elaboró / revisó / aprobó', `Elaboró: ${texto360(informe.elaboradoPor)}\nRevisó: ${texto360(informe.revisadoPor)}\nAprobó: ${texto360(informe.aprobadoPor)}`],
        ['Auditor del informe', `${texto360(informe.auditorResponsable || informe.auditor)}\n${texto360(informe.correoAuditor || informe.correoAuditorResponsable)}`],
        ['Socialización', `${texto360(informe.socializado)}\nFecha: ${fecha360(informe.fechaSocializacion || informe.fecha_socializacion)}\nParticipantes: ${texto360(informe.participantes || informe.socializadoCon)}`],
        ['Ruta de evaluación', grupo.esPrograma ? 'Diseño inicial: mayor o igual al 80% habilita ejecución. Al 100%: validación del revisor y dictamen final del auditor por acción.' : 'Eficacia por acción. Dictamen de eficacia y observaciones del auditor.'],
      ]);
    } else parrafo('No se dispone del informe de origen. Se presentan los registros sin atribuirles una fuente o una ruta de evaluación no verificadas.');
    seccion('Cuadro de hallazgos');
    if (!grupo.hallazgos.length) parrafo('No hay hallazgos vinculados disponibles en este expediente.');
    tabla(['Hallazgo / descripción', 'Clasificación', 'Proceso / responsable', 'Causa y análisis', 'Estado / acciones'], grupo.hallazgos.map(hallazgo => {
      const h = hallazgo.registro;
      return [
        `${hallazgo.referencia}\n${texto360(h.titulo || h.descripcion || h.hallazgo || h.detalle || h.observacion)}\nFecha: ${fecha360(h.fecha)}`,
        `${texto360(h.claseObservacion)}\nSeveridad: ${texto360(h.severidad)}\nNorma: ${texto360(h.normaReferencia)}`,
        `${texto360(h.macroprocesos || h.macroproceso || h.proceso)}\n${texto360(h.subprocesos || h.subproceso)}\n${texto360(h.responsable)}`,
        grupo.tipoFuente === 'Programa de Auditoría' ? 'NO APLICA'
          : `Causa: ${texto360(h.causa)}\nMétodo: ${texto360(h.metodologiaCausa)}\nAnálisis: ${texto360(h.analisisCausa)}`,
        `${texto360(h.estado)}\nCierre: ${fecha360(h.fechaCierre)}\n${hallazgo.planes.length ? `${hallazgo.planes.length} acción(es)` : 'Sin acciones vinculadas'}`,
      ];
    }), { columnStyles: { 0: { cellWidth: 67 }, 1: { cellWidth: 39 }, 2: { cellWidth: 46 }, 4: { cellWidth: 32 } } });

    const acciones = [
      ...grupo.hallazgos.flatMap(hallazgo => hallazgo.planes.map(plan => ({ plan, hallazgo }))),
      ...grupo.planesSinHallazgo.map(plan => ({ plan, hallazgo: null })),
    ];
    if (acciones.length) nuevaPagina();
    seccion('Cuadro de acciones y estados', `${acciones.length} acción(es) · ${grupo.resumen.cerradas} cerrada(s) · ${grupo.resumen.abiertas} abierta(s) · ${grupo.resumen.vencidas} vencida(s) sin cierre.`);
    if (!acciones.length) parrafo('No hay acciones vinculadas disponibles. Esto no se interpreta como cumplimiento ni cierre.');
    tabla([
      'No.', 'Descripción Observación y/o Hallazgo', 'Clase de Observación',
      'Áreas / Procesos Vinculados', 'Acciones de Mejoramiento', 'Mecanismo de Seguimiento',
      'Resp. Seguimiento (Auditor)', 'Meta / Unidad', 'Fecha Inicio', 'Fecha Terminación',
      'Plazo (Semanas)', 'Estado / Observación', 'Responsable de Mejoramiento',
    ], acciones.map(({ plan, hallazgo }, indice) => {
      const p = plan.registro;
      const h = hallazgo?.registro;
      return [
        indice + 1,
        h ? `${hallazgo.referencia}\n${texto360(h.titulo || h.descripcion || h.hallazgo || h.detalle || h.observacion)}`
          : { content: `Sin hallazgo disponible\nID: ${texto360(p.idHallazgo)}`, styles: { halign: 'left' } },
        texto360(h?.claseObservacion),
        `${texto360(p.proceso || p.macroprocesos || p.macroproceso)}\n${texto360(p.sede)}`,
        `${plan.referencia}\n${texto360(p.accion)}`,
        texto360(p.mecanismo, 'Revisión de Evidencias Digitales GCM'),
        texto360(p.auditorAsignado || p.auditorResponsable || p.auditor, 'Auditoría Interna'),
        '100%',
        fecha360(p.fechaInicio),
        fecha360(p.fecha),
        plazoSemanas360(p.fechaInicio, p.fecha),
        {
          content: `${texto360(p.estadoWorkflow || p.estado)}\n${avance(plan.avance)} Avance\n${plan.cerrado ? 'Cerrada' : plan.vencido ? 'Vencida sin cierre' : 'Abierta'}\n${plan.evaluacion.tipo}\n${plan.evaluacion.resultado}${p.observaciones ? `\n${texto360(p.observaciones)}` : ''}`,
          styles: {
            textColor: plan.cerrado ? COLORES.verde : plan.vencido ? COLORES.alerta : COLORES.tinta,
            fillColor: plan.cerrado ? COLORES.cerrado : plan.vencido ? COLORES.vencido : COLORES.fondo,
          },
        },
        `${texto360(p.responsable, 'Sin asignar')}${p.revisor ? `\nRevisor: ${texto360(p.revisor)}` : ''}`,
      ];
    }), {
      styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.5, textColor: COLORES.tinta, overflow: 'linebreak', valign: 'top', lineWidth: 0.2, lineColor: COLORES.linea },
      headStyles: { fillColor: COLORES.verde, textColor: COLORES.blanco, fontStyle: 'bold', fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 38 },
        2: { cellWidth: 17, halign: 'center' },
        3: { cellWidth: 18 },
        4: { cellWidth: 38 },
        5: { cellWidth: 20 },
        6: { cellWidth: 22 },
        7: { cellWidth: 12, halign: 'center', textColor: COLORES.verde, fillColor: COLORES.cerrado },
        8: { cellWidth: 17, halign: 'center' },
        9: { cellWidth: 17, halign: 'center' },
        10: { cellWidth: 14, halign: 'center', textColor: COLORES.azul },
        11: { cellWidth: 25 },
        12: { cellWidth: contenido - 245 },
      },
    });

    const soportes = [
      ...(fuente ? [{ registro: fuente, referencia: texto360(fuente.codigo || fuente.id) }] : []),
      ...(informe ? [{ registro: informe, referencia: grupo.referencia }] : []),
      ...grupo.hallazgos.map(hallazgo => ({ registro: hallazgo.registro, referencia: hallazgo.referencia })),
      ...acciones.map(({ plan }) => ({ registro: plan.registro, referencia: plan.referencia })),
    ].filter(item => evidencias360(item.registro).length);
    const evaluadas = acciones.filter(({ plan }) => plan.evaluacion.registro || plan.evaluacion.anterior || lista(plan.registro.historialEvaluaciones).length);
    const eventos = [
      ...(grupo.fuente ? historial(grupo.fuente, `Fuente ${texto360(grupo.fuente.codigo || grupo.fuente.id)}`) : []),
      ...(informe ? historial(informe, grupo.referencia) : []),
      ...grupo.hallazgos.flatMap(hallazgo => [
        ...historial(hallazgo.registro, hallazgo.referencia),
        ...hallazgo.planes.flatMap(plan => historial(plan.registro, plan.referencia)),
      ]),
      ...grupo.planesSinHallazgo.flatMap(plan => historial(plan.registro, plan.referencia)),
    ];
    if (soportes.length || evaluadas.length || eventos.length) {
      nuevaPagina();
      seccion(`Anexo documental · ${grupo.referencia}`, 'Soportes, evaluaciones registradas e historial. El resumen ejecutivo se presenta en los cuatro bloques anteriores.');
      soportes.forEach(item => archivos(item.registro, item.referencia));
      evaluadas.forEach(({ plan }) => {
        seccion(`Evaluación · ${plan.referencia}`);
        evaluacion(plan);
      });
      if (eventos.length) {
        seccion('Trazabilidad documental', 'Eventos agrupados por registro, conservando el orden original de su historial.');
        tabla(['Registro', 'Fecha registrada', 'Usuario', 'Evento / motivo'], eventos, {
          columnStyles: { 0: { cellWidth: 29 }, 1: { cellWidth: 32 }, 2: { cellWidth: 40 } },
        });
      }
    }
  });

  if (reporte.incidencias.length) {
    nuevaPagina();
    seccion('Observaciones de integridad', 'Estas observaciones no modifican los registros. Señalan datos faltantes o vínculos que requieren validación.');
    tabla(['Observación'], reporte.incidencias.map(item => [item]));
  }
  const paginas = doc.getNumberOfPages();
  const propiedadesLogo = doc.getImageProperties(logo);
  const proporcion = propiedadesLogo.width / propiedadesLogo.height;
  const altoLogo = Math.min(21, 29 / proporcion);
  const anchoLogo = altoLogo * proporcion;
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.addImage(logo, 'PNG', 14, 7, anchoLogo, altoLogo, 'logo-termales', 'FAST');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORES.verde);
    doc.text('Termales Santa Rosa de Cabal', 49, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORES.tenue);
    doc.text(textoPdf('Informe ejecutivo de seguimiento'), 49, 21);
    doc.setFontSize(7);
    doc.text(identificador, ancho - margen, 20, { align: 'right' });
    doc.setDrawColor(...COLORES.oro);
    doc.setLineWidth(0.45);
    doc.line(margen, 30, ancho - margen, 30);
    doc.setDrawColor(...COLORES.linea);
    doc.setLineWidth(0.25);
    doc.line(margen, alto - 17, ancho - margen, alto - 17);
    doc.setFontSize(7);
    doc.text(`Corte: ${fechaCorte} (Colombia)`, margen, alto - 12);
    doc.text(`Página ${pagina} de ${paginas}`, ancho - margen, alto - 12, { align: 'right' });
    doc.text(textoPdf('Copia de seguimiento · Información disponible según alcance autorizado'), margen, alto - 7);
  }
  const referenciaArchivo = reporte.modo === 'general' ? 'general' : reporte.modo === 'fuentes' ? 'fuentes_consolidadas' : reporte.expedientes[0].referencia;
  const nombre = `Plan_Accion_360_${referenciaArchivo.replace(/[^a-zA-Z0-9_-]/g, '_')}_${reporte.diaCorte}.pdf`;
  return { doc, nombre };
}

export async function descargarReporte360(reporte) {
  const respuesta = await fetch(`${import.meta.env.BASE_URL}logo_termales.png`);
  if (!respuesta.ok) throw new Error(`No se pudo cargar el logo empresarial (HTTP ${respuesta.status}). Reintenta la descarga.`);
  const logo = new Uint8Array(await respuesta.arrayBuffer());
  const { doc, nombre } = crearPdfReporte360(reporte, { logo });
  await doc.save(nombre, { returnPromise: true });
  return nombre;
}
