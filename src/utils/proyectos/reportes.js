// src/utils/proyectos/reportes.js - Contenido de los reportes del proyecto. Las cifras salen de los mismos
// registros e indicadores que muestra el módulo; cada reporte declara fecha, periodo, filtros y origen.
import { ESTADOS_CAMBIO, ESTADOS_COMPROMISO, ESTADOS_ENTREGABLE, ESTADOS_PROYECTO, ESTADOS_RIESGO, ESTADOS_TAREA, METODOLOGIAS, TIPOS_COSTO, TIPOS_RIESGO, ESTADOS_CERRADOS_TAREA, TIPOS_CONTENEDOR } from './modelo.js';
import { compararConLineaBase } from './cronograma.js';
import { fecha, moneda, porcentaje, puntos, variacion } from './formato.js';

export const TIPOS_REPORTE = {
  ficha: 'Ficha ejecutiva del proyecto',
  semanal: 'Informe semanal de seguimiento',
  mensual: 'Informe mensual de dirección',
  cronograma: 'Cronograma y desviaciones',
  vencidas: 'Tareas vencidas',
  entregables: 'Estado de entregables',
  presupuesto: 'Presupuesto y costos',
  riesgos: 'Riesgos y problemas',
  cambios: 'Cambios aprobados y rechazados',
  compromisos: 'Decisiones y compromisos pendientes',
  cierre: 'Informe de cierre y lecciones aprendidas',
};
// Reportes que se acotan a un periodo (el resto muestra el estado a la fecha de generación).
export const REPORTES_CON_PERIODO = ['semanal', 'mensual', 'cambios'];

const enPeriodo = (valor, periodo) => Boolean(valor) && String(valor).slice(0, 10) >= periodo.desde && String(valor).slice(0, 10) <= periodo.hasta;
const tabla = (titulo, columnas, filas, vacio = 'Sin registros.') => ({ titulo, columnas, filas, vacio });
const texto = (titulo, contenido) => ({ titulo, texto: contenido || '—' });

function indicadoresClave(ind, codigoMoneda) {
  return tabla('Indicadores', ['Indicador', 'Valor'], [
    ['Estado de control', `${ind.semaforo.color.toUpperCase()}: ${ind.semaforo.motivos.join(' ')}`],
    ['Avance real', porcentaje(ind.avanceReal)], ['Avance planificado', porcentaje(ind.avancePlanificado)], ['Desviación de avance', puntos(ind.desviacionAvance)],
    ['Cumplimiento de hitos', porcentaje(ind.cumplimientoHitos)], ['Hitos vencidos', ind.hitosVencidos],
    ['Entregables aceptados', porcentaje(ind.cumplimientoEntregables)], ['Tareas vencidas', `${ind.tareasVencidas} de ${ind.tareasAbiertas}`],
    ['Riesgos críticos abiertos', ind.riesgosCriticos], ['Compromisos cumplidos a tiempo', porcentaje(ind.cumplimientoCompromisos)],
    ...(ind.maneja ? [['Presupuesto vigente', moneda(ind.presupuestoVigente, codigoMoneda)], ['Costo real', moneda(ind.costoReal, codigoMoneda)], ['Variación presupuestal', variacion(ind.variacionPresupuestal)]] : []),
    ['SPI / CPI', ind.evm ? `${ind.evm.spi} / ${ind.evm.cpi}` : 'No disponible (faltan presupuesto, línea base o costos reales)'],
    ['Fin vigente', fecha(ind.finVigente)],
  ]);
}

/** { titulo, secciones } del reporte `tipo`. periodo: { desde, hasta } (AAAA-MM-DD). */
export function construirReporte(tipo, { proyecto, plan, ind, hoy, periodo }) {
  const f = proyecto.ficha || {};
  const codigoMoneda = f.moneda || 'COP';
  const tareas = (plan.tareas || []).filter(tarea => !TIPOS_CONTENEDOR.includes(tarea.tipo));
  const abiertas = tareas.filter(tarea => !ESTADOS_CERRADOS_TAREA.includes(tarea.estado));
  const vencidas = abiertas.filter(tarea => tarea.tipo !== 'hito' && tarea.fin && tarea.fin < hoy);
  const compromisos = (plan.reuniones || []).flatMap(reunion => (reunion.compromisos || []).map(compromiso => ({ ...compromiso, reunion })));
  const pendientes = compromisos.filter(compromiso => !['cumplido', 'cancelado'].includes(compromiso.estado));
  const filaTarea = tarea => [tarea.codigo, tarea.titulo, tarea.responsable || '—', ESTADOS_TAREA[tarea.estado], `${tarea.avance} %`, fecha(tarea.fin)];
  const filaRiesgo = riesgo => [riesgo.codigo, TIPOS_RIESGO[riesgo.tipo], riesgo.descripcion, riesgo.nivel ?? '—', riesgo.responsable || '—', ESTADOS_RIESGO[riesgo.estado]];
  const riesgosAbiertos = (plan.riesgos || []).filter(riesgo => riesgo.estado !== 'cerrado').sort((a, b) => (b.nivel ?? -1) - (a.nivel ?? -1));

  const secciones = {
    ficha: () => [
      tabla('Identificación', ['Campo', 'Valor'], [['Código', proyecto.codigo], ['Nombre', f.nombre], ['Estado', ESTADOS_PROYECTO[proyecto.estado]], ['Metodología', METODOLOGIAS[f.metodologia]],
        ['Director', proyecto.miembros?.director], ['Patrocinador', proyecto.miembros?.patrocinador || '—'], ['Área', f.area || '—'],
        ['Fechas planificadas', `${fecha(f.inicioPlanificado)} → ${fecha(f.finPlanificado)}`], ['Fechas reales', f.inicioReal ? `${fecha(f.inicioReal)} → ${f.finReal ? fecha(f.finReal) : 'en curso'}` : 'Sin iniciar']]),
      texto('Objetivo general', f.objetivoGeneral), texto('Alcance', f.alcanceIncluido),
      indicadoresClave(ind, codigoMoneda),
      texto('Explicación del estado', proyecto.explicacionEstado ? `${proyecto.explicacionEstado.explicacion}\nCausa: ${proyecto.explicacionEstado.causa || '—'}\nPlan de recuperación: ${proyecto.explicacionEstado.planRecuperacion || '—'}` : 'Sin explicación registrada.'),
    ],
    semanal: () => [
      indicadoresClave(ind, codigoMoneda),
      tabla('Tareas completadas en el periodo', ['Código', 'Tarea', 'Responsable', 'Estado', 'Avance', 'Fin previsto'], tareas.filter(tarea => tarea.estado === 'completada' && enPeriodo(tarea.finReal, periodo)).map(filaTarea)),
      tabla('Tareas vencidas', ['Código', 'Tarea', 'Responsable', 'Estado', 'Avance', 'Fin previsto'], vencidas.map(filaTarea)),
      tabla('Hitos próximos', ['Código', 'Hito', 'Responsable', 'Estado', 'Avance', 'Fecha'], tareas.filter(tarea => tarea.tipo === 'hito' && tarea.estado !== 'completada' && tarea.fin >= hoy).sort((a, b) => a.fin.localeCompare(b.fin)).slice(0, 10).map(filaTarea)),
      tabla('Compromisos pendientes', ['Compromiso', 'Responsable', 'Fecha límite', 'Estado'], pendientes.map(c => [c.descripcion, c.responsable, fecha(c.fechaLimite), ESTADOS_COMPROMISO[c.estado]])),
    ],
    mensual: () => [
      indicadoresClave(ind, codigoMoneda),
      texto('Explicación del estado', proyecto.explicacionEstado?.explicacion || 'Sin explicación registrada.'),
      tabla('Entregables aprobados en el periodo', ['Código', 'Entregable', 'Aprobado por', 'Fecha'], (plan.entregables || []).filter(e => e.estado === 'aprobado' && enPeriodo(e.fechaAprobacion, periodo)).map(e => [e.codigo, e.nombre, e.aprobadoPor, fecha(e.fechaAprobacion)])),
      tabla('Cambios decididos en el periodo', ['Código', 'Cambio', 'Decisión', 'Fecha'], (plan.cambios || []).filter(c => ['aprobada', 'rechazada', 'implementada'].includes(c.estado) && enPeriodo(c.fechaDecision, periodo)).map(c => [c.codigo, c.titulo, ESTADOS_CAMBIO[c.estado], fecha(c.fechaDecision)])),
      tabla('Riesgos e incidencias abiertos', ['Código', 'Categoría', 'Descripción', 'Nivel', 'Responsable', 'Estado'], riesgosAbiertos.slice(0, 15).map(filaRiesgo)),
      ...(ind.maneja ? [tabla('Costos del periodo', ['Código', 'Fecha', 'Tipo', 'Descripción', 'Monto'], (plan.costos || []).filter(c => c.estado !== 'anulado' && enPeriodo(c.fecha, periodo)).map(c => [c.codigo, fecha(c.fecha), TIPOS_COSTO[c.tipo], c.descripcion, moneda(c.monto, codigoMoneda)]))] : []),
    ],
    cronograma: () => {
      const lineaBase = (plan.lineasBase || []).at(-1);
      return [
        texto('Línea base', lineaBase ? `Versión ${lineaBase.version} del ${fecha(lineaBase.fecha)}${lineaBase.motivo ? ` · ${lineaBase.motivo}` : ''}` : 'Sin línea base establecida: no hay desviaciones contra lo aprobado.'),
        tabla('Fechas por actividad', ['Actividad', 'Línea base', 'Vigente', 'Real', 'Desviación del fin'], compararConLineaBase(tareas.filter(t => t.estado !== 'cancelada'), lineaBase).map(item => [
          item.titulo, item.base ? `${fecha(item.base.inicio)} → ${fecha(item.base.fin)}` : '—', item.vigente ? `${fecha(item.vigente.inicio)} → ${fecha(item.vigente.fin)}` : '—',
          item.real ? `${fecha(item.real.inicio)} → ${item.real.fin ? fecha(item.real.fin) : 'en curso'}` : '—', item.atrasoDias === null ? '—' : `${item.atrasoDias > 0 ? '+' : ''}${item.atrasoDias} días`,
        ])),
      ];
    },
    vencidas: () => [tabla(`Tareas vencidas a ${fecha(hoy)} (${vencidas.length})`, ['Código', 'Tarea', 'Responsable', 'Estado', 'Avance', 'Fin previsto'], vencidas.map(filaTarea))],
    entregables: () => [tabla('Entregables', ['Código', 'Entregable', 'Responsable', 'Comprometido', 'Estado', 'Versiones'], (plan.entregables || []).map(e => [e.codigo, e.nombre, e.responsable, fecha(e.fechaComprometida), ESTADOS_ENTREGABLE[e.estado], (e.presentaciones || []).length]))],
    presupuesto: () => (ind.maneja ? [
      tabla('Resumen', ['Concepto', 'Valor'], [['Aprobado inicial', moneda(f.presupuestoAprobado, codigoMoneda)], ['Vigente', moneda(ind.presupuestoVigente, codigoMoneda)], ['Real', moneda(ind.costoReal, codigoMoneda)], ['Comprometido', moneda(ind.costoComprometido, codigoMoneda)], ['Disponible', moneda(ind.disponible, codigoMoneda)], ['Proyección final', moneda(ind.proyeccionFinal, codigoMoneda)], ['Variación', variacion(ind.variacionPresupuestal)]]),
      tabla('Revisiones autorizadas', ['Fecha', 'Anterior', 'Nuevo', 'Cambio'], (plan.revisionesPresupuesto || []).map(r => [fecha(r.fecha), moneda(r.anterior, codigoMoneda), moneda(r.nuevo, codigoMoneda), r.codigoCambio])),
      tabla('Costos', ['Código', 'Fecha', 'Tipo', 'Descripción', 'Monto', 'Estado'], (plan.costos || []).map(c => [c.codigo, fecha(c.fecha), TIPOS_COSTO[c.tipo], c.descripcion, moneda(c.monto, codigoMoneda), c.estado === 'anulado' ? `Anulado: ${c.motivoAnulacion}` : 'Vigente'])),
    ] : [texto('Presupuesto', 'Este proyecto no maneja presupuesto.')]),
    riesgos: () => [tabla('Riesgos, problemas e incidencias', ['Código', 'Categoría', 'Descripción', 'Nivel', 'Responsable', 'Estado'], [...(plan.riesgos || [])].sort((a, b) => (b.nivel ?? -1) - (a.nivel ?? -1)).map(filaRiesgo))],
    cambios: () => [tabla('Cambios decididos en el periodo', ['Código', 'Cambio', 'Solicitante', 'Decisión', 'Aprobador', 'Fecha'], (plan.cambios || []).filter(c => ['aprobada', 'rechazada', 'implementada'].includes(c.estado) && enPeriodo(c.fechaDecision, periodo)).map(c => [c.codigo, c.titulo, c.solicitante, ESTADOS_CAMBIO[c.estado], c.aprobador || '—', fecha(c.fechaDecision)]))],
    compromisos: () => [
      tabla('Decisiones registradas', ['Reunión', 'Fecha', 'Decisión'], (plan.reuniones || []).flatMap(reunion => (reunion.decisiones || []).map(decision => [`${reunion.codigo} ${reunion.titulo}`, fecha(reunion.fecha), decision]))),
      tabla('Compromisos pendientes', ['Compromiso', 'Responsable', 'Fecha límite', 'Estado', 'Reunión'], pendientes.map(c => [c.descripcion, c.responsable, fecha(c.fechaLimite), `${ESTADOS_COMPROMISO[c.estado]}${c.fechaLimite < hoy ? ' (vencido)' : ''}`, c.reunion.codigo])),
    ],
    cierre: () => [
      indicadoresClave(ind, codigoMoneda),
      texto('Resultados obtenidos', proyecto.cierre?.resultados), texto('Beneficios logrados', proyecto.cierre?.beneficiosLogrados), texto('Lecciones aprendidas', proyecto.cierre?.leccionesAprendidas),
      texto('Criterios de éxito definidos', f.criteriosExito),
    ],
  };
  return { titulo: TIPOS_REPORTE[tipo], secciones: (secciones[tipo] || secciones.ficha)() };
}

const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, caracter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caracter]));

/** HTML imprimible del reporte (todo el contenido escapado). */
export function htmlReporte({ titulo, secciones }, encabezado) {
  const cuerpo = secciones.map(seccion => (seccion.columnas
    ? `<h2>${escapar(seccion.titulo)}</h2>${seccion.filas.length ? `<table><thead><tr>${seccion.columnas.map(c => `<th>${escapar(c)}</th>`).join('')}</tr></thead><tbody>${seccion.filas.map(fila => `<tr>${fila.map(c => `<td>${escapar(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<p class="vacio">${escapar(seccion.vacio)}</p>`}`
    : `<h2>${escapar(seccion.titulo)}</h2><p>${escapar(seccion.texto).replace(/\n/g, '<br>')}</p>`)).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>
body{font-family:Arial,sans-serif;color:#1e293b;margin:24px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f5f9}.meta{color:#475569;margin:4px 0 0}.vacio{color:#64748b}
</style></head><body><h1>${escapar(titulo)}</h1>${encabezado.map(linea => `<p class="meta">${escapar(linea)}</p>`).join('')}${cuerpo}</body></html>`;
}
