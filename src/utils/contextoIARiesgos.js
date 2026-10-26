// Datos reales que se envían a la IA en los análisis de Riesgos.
// Todo número sale de los registros; si algo no existe se reporta como 0 o "sin datos", nunca con un valor de relleno.
import { codigoControl } from './explicacionControles.js';
import { nivelEscala, riesgoEnPorcentaje, zonasRiesgo } from './nivelRiesgo.js';
import { normalizarClasificacion } from './clasificacionRiesgo.js';
import { explicarRiesgoDetallado, pruebasDeCampoDelRiesgo } from './explicacionRiesgoDetallada.js';
import { cumplimientoNumeral9 } from './cumplimientoManual.js';
import { textoPlanDeAccion } from './planesDelRiesgo.js';

const texto = (valor, max = 400) => {
  const limpio = String(valor ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio;
};
const lista = valor => (Array.isArray(valor) ? valor.filter(Boolean) : []);
const promedio = valores => (valores.length ? Math.round(valores.reduce((total, valor) => total + valor, 0) / valores.length) : null);

const tieneDato = valor => valor !== null && valor !== undefined && String(valor).trim() !== '' && Number.isFinite(Number(valor));

export function puntajesRiesgo(riesgo) {
  const porcentaje = riesgoEnPorcentaje(riesgo);
  const zonas = zonasRiesgo(riesgo);
  // Sin probabilidad o impacto registrados no hay zona ni puntaje: se dice "Sin dato", no se supone uno.
  const conDatos = (probabilidad, impacto) => tieneDato(probabilidad) && tieneDato(impacto);
  const inherenteOk = conDatos(riesgo?.probabilidadInherente, riesgo?.impactoInherente);
  const residualOk = conDatos(riesgo?.probabilidadResidual, riesgo?.impactoResidual);
  return {
    nivelInherente: inherenteOk ? zonas.inherente.label : 'Sin dato',
    nivelResidual: residualOk ? zonas.residual.label : 'Sin dato',
    puntajeInherente: inherenteOk ? nivelEscala(riesgo.probabilidadInherente, porcentaje) * nivelEscala(riesgo.impactoInherente, porcentaje) : null,
    puntajeResidual: residualOk ? nivelEscala(riesgo.probabilidadResidual, porcentaje) * nivelEscala(riesgo.impactoResidual, porcentaje) : null,
  };
}

const procesosDe = riesgo => {
  const macros = lista(riesgo?.macroprocesos);
  if (macros.length) return macros;
  return riesgo?.proceso ? [String(riesgo.proceso)] : [];
};

// "Sin Asignar", "Por asignar", "N/A"… guardados como texto no son un responsable.
const responsableReal = valor => {
  const textoValor = (Array.isArray(valor) ? valor.join(', ') : String(valor ?? '')).trim();
  return /^(sin asignar|por asignar|sin dato|sin responsable|n\/?a|-)?$/i.test(textoValor) ? '' : textoValor;
};

export function controlesDeRiesgo(riesgo, calcularEficacia) {
  const procesos = procesosDe(riesgo);
  // Los controles anulados no se envían a la IA (conservan su código por posición).
  return lista(riesgo?.controlesDetallados).map((control, indice) => ({ control, indice })).filter(({ control }) => control?.estado !== 'Anulado').map(({ control, indice }) => ({
    codigo: codigoControl(indice, riesgo?.id),
    descripcion: texto(control.descripcion, 300),
    tipo: control.tipo || 'Sin dato',
    ejecucion: control.implementacion || control.ejecucion || 'Sin dato',
    documentacion: control.documentacion || 'Sin dato',
    frecuencia: control.frecuencia || 'Sin dato',
    evidencia: control.evidencia || 'Sin dato',
    // Los controles no tienen responsable propio: la matriz y el Excel muestran el del riesgo.
    responsable: responsableReal(control.responsable) || responsableReal(control.responsableControl)
      || responsableReal(riesgo?.responsable) || 'Sin asignar',
    // Numeral 8.3.2: los responsables de los controles son los líderes de proceso.
    responsableSegunManual: responsableReal(control.responsable) || responsableReal(control.responsableControl)
      || responsableReal(riesgo?.responsable) || (procesos.length ? `Líder de ${procesos.join(' / ')}` : 'Por asignar'),
    eficacia: calcularEficacia(control),
  }));
}


// Ficha de un riesgo para el dictamen individual.
export function contextoRiesgo(riesgo, { calcularEficacia, calcularMitigacion, evaluaciones = [], planes = [] }) {
  const controles = controlesDeRiesgo(riesgo, calcularEficacia);
  const puntajes = puntajesRiesgo(riesgo);
  // Conclusiones exactas del sistema (las mismas de "Explícame este riesgo"): la IA las interpreta, no las recalcula.
  const pruebasCampo = pruebasDeCampoDelRiesgo(evaluaciones, riesgo.id);
  const detalle = explicarRiesgoDetallado(riesgo, { pruebasCampo, planes });
  return {
    riesgo: {
      codigo: `RSK-${riesgo.id}`,
      descripcion: texto(riesgo.descripcion || riesgo.escenarioFinal, 600),
      causaInmediata: texto(riesgo.causaInmediata) || 'Sin dato',
      causaRaiz: texto(riesgo.causaRaiz) || 'Sin dato',
      procesos: procesosDe(riesgo),
      subprocesos: lista(riesgo.subprocesos),
      clasificacion: normalizarClasificacion(riesgo.clasificacionRiesgo || riesgo.categoria) || 'Sin dato',
      responsable: Array.isArray(riesgo.responsable) ? riesgo.responsable.join(', ') : (riesgo.responsable || 'Sin dato'),
      ...puntajes,
      tratamiento: riesgo.tratamiento || 'Sin dato',
      planAccion: texto(textoPlanDeAccion(riesgo, planes), 600) || 'Sin plan registrado',
      fechaSeguimiento: riesgo.fechaSeguimiento || 'Sin fecha',
      bitacora: texto(riesgo.seguimientoBitacora, 800) || 'Sin registros en bitácora',
    },
    controles,
    analisisSistema: {
      probabilidad: detalle.probabilidad,
      impacto: detalle.impacto,
      porQueQuedaEnSuZona: detalle.zona,
      pendientes: detalle.pendientes.length ? detalle.pendientes : ['Sin pendientes del numeral 9 ni de formalización.'],
      simulacionDeMejoras: detalle.mejoras.length
        ? detalle.mejoras.map(mejora => `${mejora.accion}: ${mejora.resultado}`)
        : [detalle.notaMejoras || 'Sin opciones que cambien el resultado.'],
      notaSimulacion: detalle.notaMejoras || '',
    },
    pruebasTrabajoDeCampo: [...pruebasCampo].map(([indice, prueba]) => ({
      control: codigoControl(indice, riesgo.id), calificacion: prueba.calificacion, fecha: prueba.fecha, diseno: prueba.diseno, ejecucion: prueba.ejecucion,
    })),
    metricas: {
      alcance: `Solo el riesgo RSK-${riesgo.id} (no toda la matriz)`,
      totalControles: controles.length || (riesgo.descripcionControl ? 1 : 0),
      eficaciaPromedioControles: promedio(controles.map(control => control.eficacia)),
      mitigacionLograda: calcularMitigacion(riesgo),
      escala: '1-25 (probabilidad x impacto); niveles Bajo, Moderado, Alto, Extremo',
    },
  };
}

const planVencido = (plan, hoy) => {
  const cerrado = plan?.estadoWorkflow === 'Cerrado' || plan?.estado === 'Cerrado';
  if (cerrado || !plan?.fecha) return false;
  const limite = new Date(`${String(plan.fecha).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(limite.getTime()) && limite < hoy;
};

// Panorama de un conjunto de riesgos (toda la matriz o la vista filtrada del dashboard).
export function contextoMatriz(riesgos, { calcularEficacia, calcularMitigacion, hallazgos = [], planes = [], evaluaciones = [], hoy = new Date() }) {
  const registros = lista(riesgos);
  const niveles = ['Extremo', 'Alto', 'Moderado', 'Bajo'];
  const conPuntajes = registros.map(riesgo => ({ riesgo, ...puntajesRiesgo(riesgo) }));
  const distribucion = campo => Object.fromEntries(niveles.map(nivel => [nivel, conPuntajes.filter(item => item[campo] === nivel).length]));
  const controles = registros.flatMap(riesgo => controlesDeRiesgo(riesgo, calcularEficacia).map(control => ({ ...control, riesgo: `RSK-${riesgo.id}` })));

  const porProceso = {};
  conPuntajes.forEach(({ riesgo, nivelResidual, nivelInherente }) => {
    (procesosDe(riesgo).length ? procesosDe(riesgo) : ['Sin proceso']).forEach(proceso => {
      porProceso[proceso] ??= { proceso, riesgos: 0, altosOExtremosInherentes: 0, altosOExtremosResiduales: 0 };
      porProceso[proceso].riesgos += 1;
      if (['Alto', 'Extremo'].includes(nivelInherente)) porProceso[proceso].altosOExtremosInherentes += 1;
      if (['Alto', 'Extremo'].includes(nivelResidual)) porProceso[proceso].altosOExtremosResiduales += 1;
    });
  });

  const resumen = item => ({
    codigo: `RSK-${item.riesgo.id}`,
    descripcion: texto(item.riesgo.descripcion || item.riesgo.escenarioFinal, 180),
    procesos: procesosDe(item.riesgo),
    nivelInherente: item.nivelInherente,
    nivelResidual: item.nivelResidual,
    puntajeInherente: item.puntajeInherente,
    puntajeResidual: item.puntajeResidual,
    controles: lista(item.riesgo.controlesDetallados).length,
  });
  const ordenados = [...conPuntajes].sort((a, b) => ((b.puntajeResidual ?? -1) - (a.puntajeResidual ?? -1)) || ((b.puntajeInherente ?? -1) - (a.puntajeInherente ?? -1)));
  const sinControl = conPuntajes.filter(item => lista(item.riesgo.controlesDetallados).length === 0 && !item.riesgo.descripcionControl);
  const seguimientosVencidos = registros.filter(riesgo => riesgo.fechaSeguimiento
    && new Date(`${riesgo.fechaSeguimiento}T23:59:59`) < hoy && riesgo.estado !== 'Cerrado');
  const listaHallazgos = lista(hallazgos);
  const listaPlanes = lista(planes);
  const cumplimiento = cumplimientoNumeral9(registros, evaluaciones, listaPlanes);
  const resumenCumplimiento = criterio => ({ total: cumplimiento[criterio].length, riesgos: cumplimiento[criterio].slice(0, 20).map(riesgo => `RSK-${riesgo.id}`) });

  return {
    metricas: {
      alcance: `Conjunto analizado: ${registros.length} riesgo(s) con los filtros aplicados`,
      totalRiesgos: registros.length,
      totalControles: controles.length,
      eficaciaPromedioControles: promedio(controles.map(control => control.eficacia)),
      mitigacionPromedio: promedio(registros.map(calcularMitigacion).filter(valor => typeof valor === 'number')),
      riesgosSinDatoDeProbabilidadOImpacto: registros.filter(riesgo => calcularMitigacion(riesgo) === null).length,
      puntajeResidualPromedio: promedio(conPuntajes.map(item => item.puntajeResidual).filter(valor => valor !== null)),
      escala: '1-25 (probabilidad x impacto); niveles Bajo, Moderado, Alto, Extremo',
    },
    distribucionInherente: distribucion('nivelInherente'),
    distribucionResidual: distribucion('nivelResidual'),
    riesgosMayorExposicionResidual: ordenados.slice(0, 10).map(resumen),
    procesosMasExpuestos: Object.values(porProceso)
      .sort((a, b) => (b.altosOExtremosResiduales - a.altosOExtremosResiduales) || (b.altosOExtremosInherentes - a.altosOExtremosInherentes) || (b.riesgos - a.riesgos))
      .slice(0, 8),
    controlesDebiles: {
      manuales: controles.filter(control => !/autom/i.test(control.ejecucion)).length,
      noDocumentados: controles.filter(control => control.documentacion !== 'Documentado').length,
      sinEvidencia: controles.filter(control => /sin/i.test(control.evidencia)).length,
      // Tabla 6 del manual: un preventivo manual vale 40 %; por debajo quedan los detectivos y correctivos manuales.
      eficaciaMenorA40: controles.filter(control => control.eficacia < 40).map(control => `${control.codigo} (${control.riesgo})`).slice(0, 15),
    },
    riesgosSinControles: { total: sinControl.length, ejemplos: sinControl.slice(0, 15).map(item => `RSK-${item.riesgo.id}`) },
    seguimientosVencidos: { total: seguimientosVencidos.length, ejemplos: seguimientosVencidos.slice(0, 15).map(riesgo => `RSK-${riesgo.id}`) },
    // Numeral 9 del manual (calculado por el sistema): incumplimientos que el informe debe priorizar.
    cumplimientoNumeral9: {
      extremoOAltoSinPlanDeAccion: resumenCumplimiento('sin-plan'),
      moderadoOBajoSinFechaDeSeguimiento: resumenCumplimiento('sin-seguimiento'),
      conControlesReprobadosEnTrabajoDeCampo: resumenCumplimiento('reprobados'),
    },
    auditoria: {
      hallazgosTotal: listaHallazgos.length,
      hallazgosAbiertos: listaHallazgos.filter(hallazgo => hallazgo?.estado !== 'Cerrado').length,
      planesTotal: listaPlanes.length,
      planesVencidos: listaPlanes.filter(plan => planVencido(plan, hoy)).length,
      planesCerrados: listaPlanes.filter(plan => plan?.estadoWorkflow === 'Cerrado' || plan?.estado === 'Cerrado').length,
    },
  };
}

// Une la respuesta de la IA con las cifras del sistema (las cifras nunca vienen de la IA).
export function armarPanelIA(respuesta, { badges, kpis, indicadores }) {
  let datos;
  try {
    if (typeof respuesta === 'string') {
      let texto = respuesta.replace(/```json/gi, '').replace(/```/g, '').trim();
      const inicio = texto.indexOf('{');
      const fin = texto.lastIndexOf('}');
      if (inicio >= 0 && fin > inicio) texto = texto.slice(inicio, fin + 1);
      datos = JSON.parse(texto);
      if (typeof datos === 'string') datos = JSON.parse(datos);
    } else {
      datos = respuesta;
    }
  } catch {
    // Texto libre se muestra tal cual; un JSON roto nunca se muestra crudo: se pide generarlo de nuevo.
    const texto = String(respuesta || '');
    datos = { analisisEjecutivo: texto.includes('{') ? 'La IA respondió en un formato que no se pudo leer. Cierra y vuelve a generar el dictamen.' : texto };
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) datos = { analisisEjecutivo: String(respuesta || '') };
  // Etiquetas que dicen lo que mide cada cifra (antes "Madurez" era la eficacia y "Cobertura" la mitigación).
  const comoPorcentaje = valor => (typeof valor === 'number' ? `${valor}%` : valor ?? '—');
  const porDefecto = kpis && Object.keys(kpis).length ? [
    { etiqueta: 'Puntaje residual', valor: kpis.scoreRiesgo ?? '—' },
    { etiqueta: 'Eficacia prom.', valor: comoPorcentaje(kpis.scoreMadurez) },
    { etiqueta: 'Controles', valor: kpis.totalControles ?? '—' },
    { etiqueta: 'Mitigación', valor: comoPorcentaje(kpis.coberturaControles) },
  ] : null;
  const finales = indicadores || porDefecto;
  return JSON.stringify({ ...datos, headerBadges: badges, kpis, ...(finales ? { indicadores: finales } : {}) });
}
