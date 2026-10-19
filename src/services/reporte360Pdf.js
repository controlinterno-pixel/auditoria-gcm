import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { evidencias360, fecha360, progreso360, texto360 } from '../utils/reporte360.js';

const COLORES = {
  verde: [10, 59, 50],
  azul: [62, 101, 112],
  oro: [155, 119, 55],
  tinta: [38, 53, 60],
  tenue: [92, 108, 116],
  linea: [218, 227, 225],
  fondo: [242, 247, 245],
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
  .replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
const avance = valor => valor === null ? 'No registrado' : `${valor}%`;

export function crearPdfReporte360(reporte, { logo } = {}) {
  if (!logo) throw new Error('El logo empresarial es obligatorio para generar el Reporte 360.');
  if (!reporte?.expedientes?.length) throw new Error('No hay registros disponibles para exportar.');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: 'Plan de acción 360',
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
  let y = 44;
  const nuevaPagina = () => { doc.addPage(); y = 44; };
  const asegurarEspacio = alto => { if (y + alto > 273) nuevaPagina(); };
  const seccion = (titulo, subtitulo) => {
    asegurarEspacio(42);
    doc.setFillColor(...COLORES.verde);
    doc.rect(14, y, 182, 1, 'F');
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORES.verde);
    const lineas = doc.splitTextToSize(textoPdf(titulo), 180);
    lineas.forEach(linea => {
      asegurarEspacio(6);
      doc.text(linea, 14, y);
      y += 5;
    });
    y += 2;
    if (subtitulo) parrafo(subtitulo);
  };
  const parrafo = contenido => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.tinta);
    const lineas = doc.splitTextToSize(textoPdf(contenido), 180);
    lineas.forEach(linea => {
      asegurarEspacio(6);
      doc.text(linea, 14, y);
      y += 4.6;
    });
    y += 3;
  };
  const tabla = (cabeceras, filas, opciones = {}) => {
    if (!filas.length) return;
    asegurarEspacio(21);
    autoTable(doc, {
      startY: y,
      head: [cabeceras.map(textoPdf)],
      body: filas.map(fila => fila.map(celda => typeof celda === 'object' && celda !== null
        ? { ...celda, content: textoPdf(celda.content) } : textoPdf(celda))),
      margin: { top: 44, bottom: 23, left: 14, right: 14 },
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.6, textColor: COLORES.tinta, overflow: 'linebreak', valign: 'top', lineWidth: 0 },
      headStyles: { fillColor: COLORES.verde, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: COLORES.fondo },
      rowPageBreak: 'avoid',
      ...opciones,
    });
    y = doc.lastAutoTable.finalY + 7;
  };
  const ficha = filas => tabla(['Campo', 'Registro'], filas, { columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' } } });
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
    const { tipo, resultado, registro, anterior } = plan.evaluacion;
    const filas = [['Evaluación aplicable', tipo], ['Resultado registrado', resultado]];
    if (registro) {
      filas.push(['Fecha y evaluador', `${fecha360(registro.fecha)}\n${texto360(registro.usuario)}`]);
      if (tipo === 'Evaluación integral del paquete') {
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
    if (anterior) filas.push(['Evaluación anterior', `No es una evaluación final de ejecución. Fecha: ${fecha360(anterior.fecha)}. Puntaje: ${avance(progreso360(anterior.puntaje))}.`]);
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
  const accion = (plan, referenciaHallazgo) => {
    const registro = plan.registro;
    seccion(`${plan.referencia} · ${plan.cerrado ? 'Cerrada' : 'Abierta'} · ${avance(plan.avance)}`, registro.accion);
    ficha([
      ['Vínculo de origen', `Hallazgo: ${referenciaHallazgo}\nID de la acción: ${texto360(registro.id)}`],
      ['Estado / workflow', `${texto360(registro.estado)}\n${texto360(registro.estadoWorkflow)}`],
      ['Oportunidad', plan.cerrado ? 'Cerrada' : plan.vencido ? 'Vencida sin cierre' : 'Abierta · consultar fecha límite'],
      ['Responsable ejecutor', `${texto360(registro.responsable)}\n${texto360(registro.correoResponsable)}`],
      ['Revisor / jefatura', `${texto360(registro.revisor)}\n${texto360(registro.correoRevisor)}`],
      ['Auditor asignado', `${texto360(registro.auditorAsignado || registro.auditorResponsable || registro.auditor)}\n${texto360(registro.correoAuditor || registro.correoAuditorResponsable)}`],
      ['Fechas', `Inicio: ${fecha360(registro.fechaInicio)}\nLímite: ${fecha360(registro.fecha)}\nCierre explícito: ${fecha360(registro.fechaCierre)}`],
      ['Aprobación del diseño', `${texto360(registro.aprobadoPorCorreo)}\n${fecha360(registro.aprobadoEn)}`],
      ['Validación del revisor', `${texto360(registro.validadoPorRevisorCorreo)}\n${fecha360(registro.validadoPorRevisorEn)}`],
      ['Tipo / sede', `${texto360(registro.tipoAccion)}\n${texto360(registro.sede)}`],
      ['Mecanismo / observaciones', [registro.mecanismo, registro.observaciones, registro.motivoRechazo].map(item => texto360(item, '')).filter(Boolean).join('\n') || 'No registrado'],
      ['Matrices relacionadas', `Riesgos: ${texto360(registro.matrizRiesgos)}\nAspectos: ${texto360(registro.matrizAspectos)}\nPeligros: ${texto360(registro.matrizPeligros)}\nLegal: ${texto360(registro.matrizLegal)}`],
    ]);
    evaluacion(plan);
    archivos(registro, plan.referencia);
  };

  doc.setFillColor(...COLORES.verde);
  doc.roundedRect(14, y, 182, 40, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('Plan de acción 360', 22, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Del informe emitido a la evidencia de cierre', 22, y + 23);
  doc.setFontSize(8);
  const subtituloAlcance = reporte.modo === 'fuentes' ? `Consolidado de ${reporte.tiposFuente.length} tipo(s) de fuente de mejora` : alcance;
  doc.text(doc.splitTextToSize(textoPdf(subtituloAlcance), 165).slice(0, 2), 22, y + 31);
  y += 49;
  ficha([
    ['Fecha de corte', `${fechaCorte} (Colombia)`],
    ['Generado por', reporte.generadoPor],
    ['Identificador documental', identificador],
    ['Alcance', alcance],
  ]);
  seccion('Síntesis ejecutiva');
  const r = reporte.resumen;
  tabla(['Informes', 'Hallazgos', 'Acciones', 'Cerradas', 'Abiertas', 'Vencidas'], [[r.informes, r.hallazgos, r.acciones, r.cerradas, r.abiertas, r.vencidas]]);
  ficha([
    ['Avance de ejecución', `${avance(r.avance)}${r.sinAvance ? ` · ${r.sinAvance} acción(es) sin avance válido, excluidas del promedio` : ''}`],
    ['Cierre y revisión', `${r.hallazgosCerrados} hallazgo(s) cerrado(s) · ${r.sinAcciones} sin acciones\n${r.enRevision} acción(es) en revisión o validación`],
  ]);
  parrafo('Lectura de gestión: ejecutar al 100% no equivale a cerrar. El cierre se toma del workflow y, solo si no existe, del estado legado. Una acción sin cierre y con fecha límite anterior al corte se considera vencida, incluso si su avance es 100%.');
  parrafo('Alcance de información: incluye únicamente los registros disponibles en la sesión autorizada al generar este documento. No certifica la integridad total del repositorio ni consulta soportes externos.');
  seccion('Mapa de informes y compromisos');
  tabla(['Informe / origen', 'Hallazgos', 'Acciones', 'Cierre', 'Avance'], reporte.expedientes.map(grupo => [
    `${grupo.referencia}\n${grupo.titulo}\n${grupo.tipoFuente}`,
    grupo.resumen.hallazgos,
    grupo.resumen.acciones,
    `${grupo.resumen.cerradas} cerradas\n${grupo.resumen.abiertas} abiertas`,
    avance(grupo.resumen.avance),
  ]), { columnStyles: { 0: { cellWidth: 83 } } });

  reporte.expedientes.forEach(grupo => {
    nuevaPagina();
    seccion(`${grupo.referencia} · Expediente de seguimiento`, grupo.titulo);
    const informe = grupo.informe;
    if (informe) {
      ficha([
        ['Informe emitido', `${grupo.referencia}\nID: ${texto360(informe.id)}\nFecha: ${fecha360(informe.fecha)}`],
        ['Fuente de mejora', `${grupo.tipoFuente}\nReferencia: ${texto360(informe.tipoFuente)}\nDetalle: ${texto360(informe.detalleFuente || grupo.fuente?.alcance || grupo.fuente?.descripcion)}`],
        ['Programa vinculado', texto360(informe.programaId, 'No corresponde / no registrado')],
        ['Proceso / subproceso', `${texto360(informe.macroprocesos || informe.macroproceso || informe.proceso)}\n${texto360(informe.subprocesos || informe.subproceso)}`],
        ['Elaboró / revisó / aprobó', `Elaboró: ${texto360(informe.elaboradoPor)}\nRevisó: ${texto360(informe.revisadoPor)}\nAprobó: ${texto360(informe.aprobadoPor)}`],
        ['Auditor del informe', `${texto360(informe.auditorResponsable || informe.auditor)}\n${texto360(informe.correoAuditor || informe.correoAuditorResponsable)}`],
        ['Socialización', `${texto360(informe.socializado)}\nFecha: ${fecha360(informe.fechaSocializacion || informe.fecha_socializacion)}\nParticipantes: ${texto360(informe.participantes || informe.socializadoCon)}`],
        ['Ruta de evaluación', grupo.esPrograma ? 'Integral del paquete. Mayor a 80% aprueba; 80% o menos requiere ajustes.' : 'Eficacia por acción. Dictamen de eficacia y observaciones del auditor.'],
      ]);
      archivos(informe, grupo.referencia);
    } else parrafo('No se dispone del informe de origen. Se presentan los registros sin atribuirles una fuente o una ruta de evaluación no verificadas.');
    if (!grupo.hallazgos.length) parrafo('No hay hallazgos vinculados disponibles en este expediente.');
    grupo.hallazgos.forEach(hallazgo => {
      const h = hallazgo.registro;
      seccion(`${hallazgo.referencia} · ${texto360(h.estado)}`, h.titulo);
      ficha([
        ['Identificación', `ID: ${texto360(h.id)}\nInforme: ${texto360(h.idInforme)}\nFecha: ${fecha360(h.fecha)}`],
        ['Proceso / responsable', `${texto360(h.macroprocesos || h.macroproceso || h.proceso)}\n${texto360(h.subprocesos || h.subproceso)}\n${texto360(h.responsable)}`],
        ['Clasificación', `${texto360(h.claseObservacion)}\nSeveridad: ${texto360(h.severidad)}\nNorma: ${texto360(h.normaReferencia)}`],
        ['Causa y análisis', `Causa: ${texto360(h.causa)}\nMétodo: ${texto360(h.metodologiaCausa)}\nAnálisis: ${texto360(h.analisisCausa)}`],
        ['Estado / cierre', `${texto360(h.estado)}\nFecha de cierre explícita: ${fecha360(h.fechaCierre)}\nAcciones: ${hallazgo.planes.length}`],
      ]);
      archivos(h, hallazgo.referencia);
      if (!hallazgo.planes.length) parrafo('Hallazgo sin acciones vinculadas disponibles. Esto no se interpreta como cumplimiento ni cierre.');
      hallazgo.planes.forEach(plan => accion(plan, hallazgo.referencia));
    });
    if (grupo.planesSinHallazgo.length) {
      seccion('Acciones sin hallazgo disponible', 'Se conservan para asegurar cobertura; requieren revisar su vínculo de origen.');
      grupo.planesSinHallazgo.forEach(plan => accion(plan, texto360(plan.registro.idHallazgo)));
    }
    const eventos = [
      ...(grupo.fuente ? historial(grupo.fuente, `Fuente ${texto360(grupo.fuente.codigo || grupo.fuente.id)}`) : []),
      ...(informe ? historial(informe, grupo.referencia) : []),
      ...grupo.hallazgos.flatMap(hallazgo => [
        ...historial(hallazgo.registro, hallazgo.referencia),
        ...hallazgo.planes.flatMap(plan => historial(plan.registro, plan.referencia)),
      ]),
      ...grupo.planesSinHallazgo.flatMap(plan => historial(plan.registro, plan.referencia)),
    ];
    seccion('Trazabilidad documental', 'Eventos agrupados por registro, conservando el orden original de su historial. Las fechas y usuarios se muestran como fueron registrados.');
    if (eventos.length) tabla(['Registro', 'Fecha registrada', 'Usuario', 'Evento / motivo'], eventos, {
      columnStyles: { 0: { cellWidth: 29 }, 1: { cellWidth: 32 }, 2: { cellWidth: 40 } },
    });
    else parrafo('No hay eventos de historial disponibles para este expediente.');
  });

  if (reporte.incidencias.length) {
    nuevaPagina();
    seccion('Observaciones de integridad', 'Estas observaciones no modifican los registros. Señalan datos faltantes o vínculos que requieren validación.');
    tabla(['Observación'], reporte.incidencias.map(item => [item]));
  }
  const paginas = doc.getNumberOfPages();
  const propiedadesLogo = doc.getImageProperties(logo);
  const proporcion = propiedadesLogo.width / propiedadesLogo.height;
  const altoLogo = Math.min(27, 34 / proporcion);
  const anchoLogo = altoLogo * proporcion;
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.addImage(logo, 'PNG', 14, 7, anchoLogo, altoLogo, 'logo-termales', 'FAST');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORES.verde);
    doc.text('Termales Santa Rosa de Cabal', 54, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORES.tenue);
    doc.text('Control interno · Seguimiento de planes de acción', 54, 22);
    doc.setFontSize(7);
    doc.text(identificador, 54, 28);
    doc.setDrawColor(...COLORES.linea);
    doc.line(14, 37, 196, 37);
    doc.line(14, 278, 196, 278);
    doc.setFontSize(7);
    doc.text(`Corte: ${fechaCorte} (Colombia)`, 14, 283);
    doc.text(`Página ${pagina} de ${paginas}`, 196, 283, { align: 'right' });
    doc.text('Copia de seguimiento · Información disponible según alcance autorizado', 14, 288);
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
