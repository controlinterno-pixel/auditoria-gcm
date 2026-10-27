// src/utils/proyectos/reportes.js - Contenido de los reportes del proyecto. Las cifras salen de los mismos
// registros e indicadores que muestra el módulo; cada reporte declara fecha, periodo, filtros y origen.
import { ESTADOS_CAMBIO, ESTADOS_COMPROMISO, ESTADOS_ENTREGABLE, ESTADOS_PROYECTO, ESTADOS_RIESGO, ESTADOS_TAREA, METODOLOGIAS, TIPOS_COSTO, TIPOS_RIESGO, ESTADOS_CERRADOS_TAREA, TIPOS_CONTENEDOR } from './modelo.js';
import { compararConLineaBase } from './cronograma.js';
import { fecha, moneda, porcentaje, puntos, variacion } from './formato.js';
import {
  BLOQUES_MODELO_NEGOCIO, BLOQUES_PROPUESTA_VALOR, CATEGORIAS_LECCION, ESTRATEGIAS_INTERESADO, FASES_CICLO, LETRAS_PESTEL, PILARES, TIPOS_INGENIERIA,
  apartadosDeEtapa, aprobacionDe, elementosRaci, estadoApartado, estrategiaInteresado,
} from './metodologia.js';
import { UNIDADES_PERIODO, ingresoPeriodo, resumenFinanciero, textoAniosYMeses } from './financiero.js';

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
  formato1: 'Formato 1 · Estructura inicial del proyecto',
  formato2: 'Formato 2 · Formulación del proyecto',
  formato3: 'Formato 3 · Acta de constitución del proyecto',
  formato4: 'Formato 4 · Acta de cierre del proyecto',
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
  const seccion = nombre => plan.secciones?.[nombre]?.datos || {};
  const identificacion = () => tabla('Identificación', ['Campo', 'Valor'], [
    ['Código del portafolio', proyecto.codigoEstrategico ? `${proyecto.codigoEstrategico} (pilar ${PILARES[f.pilar]})` : 'Sin asignar'], ['Código interno', proyecto.codigo],
    ['Proyecto', f.nombre], ['Patrocinador', proyecto.miembros?.patrocinador || '—'], ['Director', proyecto.miembros?.director], ['Estado', ESTADOS_PROYECTO[proyecto.estado]],
  ]);
  const apartadoTexto = (nombre, titulo, campos, encabezado = '') => tabla(titulo, ['Aspecto', 'Detalle'], [...(encabezado ? [['Tipo', encabezado]] : []), ...campos.map(([c, n]) => [n, seccion(nombre)[c] || '—'])]);
  const noAplicaO = (nombre, generar, titulo) => (seccion(nombre).noAplica ? texto(titulo, `No aplica: ${seccion(nombre).noAplica.justificacion}`) : generar());
  const aprobacion = (destino, titulo) => {
    const registro = aprobacionDe(proyecto, destino);
    return texto(titulo, registro
      ? `Aprobado electrónicamente por ${registro.decididaPor} el ${fecha(registro.fechaDecision)}. Solicitó: ${registro.solicitante}. ${registro.comentario ? `Observación: ${registro.comentario}` : ''}`
      : 'Pendiente de aprobación.');
  };

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
    formato1: () => [
      identificacion(),
      texto('1. Problema u oportunidad', f.problema),
      tabla('2. Alternativas de aprovechamiento o solución', ['Alternativa', 'Descripción', 'Impactos positivos', 'Impactos negativos', 'Seleccionada'],
        (seccion('alternativas').lista || []).map(a => [a.nombre, a.descripcion, a.impactosPositivos || '—', a.impactosNegativos || '—', a.seleccionada ? 'Sí' : 'No'])),
      apartadoTexto('entorno', '3. Condiciones del entorno', [['descripcion', 'Descripción'], ['ubicacion', 'Ubicación'], ['normativa', 'Normativa'], ['actores', 'Actores']]),
      apartadoTexto('aspectos', '4. Aspectos a considerar', [['supuestos', 'Supuestos'], ['estudios', 'Estudios'], ['normas', 'Normas'], ['permisos', 'Permisos y licencias'], ['expertos', 'Consulta a expertos']]),
      tabla('5. Cronograma preliminar por ciclo de vida', ['Fase', 'Inicio', 'Fin'], Object.entries(FASES_CICLO).map(([clave, nombre]) => [nombre, fecha(seccion('cronogramaFases')[clave]?.inicio), fecha(seccion('cronogramaFases')[clave]?.fin)])),
      aprobacion('factibilidad', 'Aprobación de la Prefactibilidad'),
    ],
    formato2: () => {
      const financiero = resumenFinanciero(seccion('financiero'));
      return [
        identificacion(),
        texto('6. Objetivo general', f.objetivoGeneral),
        tabla('6.1 Objetivos específicos', ['#', 'Objetivo'], (f.objetivosEspecificos || []).map((objetivo, i) => [i + 1, objetivo])),
        noAplicaO('pestel', () => tabla('7.1 Análisis PESTEL', ['Factor', 'Hecho o dato', 'Fuente', 'Fecha', 'Tipo', 'Importancia', 'Valoración'],
          (seccion('pestel').factores || []).map(x => [LETRAS_PESTEL[x.letra], x.hecho, x.fuente, fecha(x.fechaFuente), x.tipo || '—', x.importancia || '—', x.valoracion || '—'])), '7.1 Análisis PESTEL'),
        noAplicaO('propuestaValor', () => tabla('7.2 CANVA propuesta de valor', ['Bloque', 'Contenido'], Object.entries(BLOQUES_PROPUESTA_VALOR).map(([c, n]) => [n, seccion('propuestaValor')[c] || '—'])), '7.2 CANVA propuesta de valor'),
        noAplicaO('modeloNegocio', () => tabla('7.3 CANVA modelo de negocio', ['Bloque', 'Contenido'], Object.entries(BLOQUES_MODELO_NEGOCIO).map(([c, n]) => [n, seccion('modeloNegocio')[c] || '—'])), '7.3 CANVA modelo de negocio'),
        noAplicaO('ingresos', () => tabla('8. Proyección de ingresos', ['Periodo', 'Clientes', 'Precio', 'Ajuste', 'Ingreso bruto'],
          (seccion('ingresos').periodos || []).map(x => [x.periodo, x.clientes, moneda(x.precio, codigoMoneda), `${x.ajuste || 0} %`, moneda(ingresoPeriodo(x), codigoMoneda)])), '8. Proyección de ingresos'),
        noAplicaO('localizacion', () => apartadoTexto('localizacion', '9. Localización y tamaño', [['ubicacion', 'Ubicación'], ['capacidad', 'Capacidad'], ['superficie', 'Superficie'], ['criterios', 'Criterios'], ['restricciones', 'Restricciones']]), '9. Localización y tamaño'),
        noAplicaO('ingenieria', () => apartadoTexto('ingenieria', '10. Estudios de ingeniería', [['proceso', 'Proceso'], ['layout', 'Layout'], ['estudios', 'Estudios']], (seccion('ingenieria').tipos || []).map(t => TIPOS_INGENIERIA[t]).join(', ')), '10. Estudios de ingeniería'),
        tabla('10.1 Análisis organizacional', ['Fase', 'Personal requerido'], Object.entries(FASES_CICLO).map(([c, n]) => [n, seccion('organizacional')[c] || '—'])),
        noAplicaO('financiero', () => tabla('11. Análisis financiero', ['Indicador', 'Valor'], [
          ['Duración de cada periodo', UNIDADES_PERIODO[seccion('financiero').unidadPeriodo] || '—'],
          ['Tasa de descuento por periodo', `${seccion('financiero').tasaDescuento ?? '—'} %${financiero.tasaAnual !== null && seccion('financiero').unidadPeriodo !== 'anio' ? ` (${porcentaje(financiero.tasaAnual)} E. A.)` : ''}`],
          ['Total ingresos', moneda(financiero.totalIngresos, codigoMoneda)], ['Total egresos', moneda(financiero.totalEgresos, codigoMoneda)],
          ['VAN', moneda(financiero.van, codigoMoneda)],
          ['TIR', financiero.tir === null ? 'No existe' : `${porcentaje(financiero.tir)}${financiero.tirAnual !== null && seccion('financiero').unidadPeriodo !== 'anio' ? ` (${porcentaje(financiero.tirAnual)} E. A.)` : ''}`],
          ['ROI', porcentaje(financiero.roi)], ['ROI descontado', porcentaje(financiero.roiDescontado)],
          ['Recuperación simple', financiero.pri === null ? 'No se recupera' : textoAniosYMeses(financiero.priTiempo) || `${financiero.pri.toFixed(2)} periodos`],
          ['PRD (recuperación descontada)', financiero.prd === null ? 'No se recupera' : `${textoAniosYMeses(financiero.prdTiempo) || ''} (${financiero.prd.toFixed(2)} periodos)`.trim()],
        ]), '11. Análisis financiero'),
        aprobacion('planificacion', 'Aprobación de la Factibilidad'),
      ];
    },
    formato3: () => {
      const hitos = (plan.tareas || []).filter(t => t.tipo === 'hito' && t.estado !== 'cancelada').sort((a, b) => String(a.fin).localeCompare(String(b.fin)));
      const amenazas = (plan.riesgos || []).filter(r => r.tipo === 'riesgo').sort((a, b) => (b.nivel ?? -1) - (a.nivel ?? -1));
      const raci = seccion('raci');
      return [
        identificacion(),
        texto('Justificación', f.justificacion), texto('Objetivo general', f.objetivoGeneral),
        texto('Alcance incluido', f.alcanceIncluido), texto('Fuera del alcance', f.alcanceExcluido), texto('Requisitos generales y restricciones', f.dependenciasRestricciones),
        tabla('Cronograma de hitos principales', ['Hito', 'Fecha'], hitos.map(h => [h.titulo, fecha(h.fin)])),
        tabla('Presupuesto preliminar', ['Concepto', 'Valor'], [['Presupuesto aprobado', f.manejaPresupuesto ? moneda(f.presupuestoAprobado, codigoMoneda) : 'No maneja presupuesto']]),
        tabla('Matriz de riesgos', ['Código', 'Riesgo', 'P', 'I', 'Nivel', 'Respuesta', 'Responsable'], amenazas.map(r => [r.codigo, r.descripcion, r.probabilidad, r.impacto, r.nivel, r.respuesta || '—', r.responsable || '—'])),
        tabla('Principales interesados', ['Interesado', 'Tipo', 'Poder', 'Interés', 'Estrategia'], (seccion('interesados').lista || []).map(x => [x.contacto ? `${x.nombre} · ${x.contacto}` : x.nombre, x.tipo === 'externo' ? 'Externo' : 'Interno', x.poder, x.interes, ESTRATEGIAS_INTERESADO[estrategiaInteresado(x)]])),
        tabla('Matriz RACI', ['Entregable o paquete', ...(raci.roles || [])], elementosRaci(plan).map(e => [e.nombre, ...(raci.roles || []).map(rol => raci.filas?.[e.id]?.[rol] || '')])),
        tabla('Organigrama', ['Fase', 'Rol', 'Persona o cargo', 'Organización', 'Reporta a'], (seccion('organigrama').roles || []).map(r => [FASES_CICLO[r.fase], r.rol, r.persona || '—', r.origen === 'externa' ? r.organizacion || '—' : 'La empresa', r.reportaA || '—'])),
        texto('Criterios de éxito y aceptación', f.criteriosExito),
        tabla('Estado de los apartados 12 a 17', ['Apartado', 'Estado'], apartadosDeEtapa('inversion').map(a => [`${a.numero}. ${a.titulo}`, estadoApartado(a.id, proyecto, plan).completo ? 'Completo' : estadoApartado(a.id, proyecto, plan).faltante])),
        aprobacion('ejecucion', 'Firma del patrocinador (autoriza el inicio de la ejecución)'),
      ];
    },
    formato4: () => {
      const cierre = seccion('actaCierre');
      const transferencia = seccion('transferencia');
      return [
        identificacion(),
        texto('Objetivos iniciales', [f.objetivoGeneral, ...(f.objetivosEspecificos || []).map(o => `• ${o}`)].filter(Boolean).join('\n')),
        tabla('Entregables', ['Código', 'Entregable', 'Estado', 'Aprobado por'], (plan.entregables || []).map(e => [e.codigo, e.nombre, ESTADOS_ENTREGABLE[e.estado], e.aprobadoPor || '—'])),
        texto('Resultados frente a los objetivos', cierre.resultados), texto('Cumplimiento de objetivos y beneficios', cierre.cumplimientoObjetivos),
        texto('Beneficios logrados', cierre.beneficiosLogrados), indicadoresClave(ind, codigoMoneda), texto('Evaluación del desempeño', cierre.evaluacionDesempeno),
        tabla('Lecciones aprendidas', ['Categoría', 'Tipo', 'Situación', 'Recomendación'], (seccion('lecciones').lista || []).map(l => [CATEGORIAS_LECCION[l.categoria], l.tipo === 'plus' ? 'Plus' : 'Delta', l.situacion, l.recomendacion || '—'])),
        texto('Cierre de contratos', cierre.contratos), texto('Liberación de recursos', cierre.liberacionRecursos),
        tabla('Entrega a la operación', ['Concepto', 'Detalle'], [['Área que recibe', transferencia.areaReceptora || '—'], ['Responsable', transferencia.responsableOperacion || '—'], ['Fecha de entrega', fecha(transferencia.fechaEntrega)], ['Capacitaciones', transferencia.capacitaciones || '—'], ['Manuales', transferencia.manuales || '—']]),
        texto('Archivo de la documentación', cierre.archivo || 'Repositorio de archivos de Termales (pestaña Documentación del proyecto).'),
        aprobacion('cerrado', 'Aceptación del patrocinador (firma del Acta de cierre)'),
      ];
    },
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
