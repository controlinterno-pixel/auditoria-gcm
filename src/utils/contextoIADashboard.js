// Datos reales para los dictámenes IA del Dashboard GRC (Inicio). Cada tarjeta envía registros con su
// identificador, no una frase con números sueltos: así la IA puede citar planes, hallazgos y controles concretos.
import { contextoMatriz } from './contextoIARiesgos.js';
import { calcularEficaciaControl } from './explicacionControles.js';

const texto = (valor, max = 160) => {
  const limpio = String(valor ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio;
};
const lista = valor => (Array.isArray(valor) ? valor.filter(Boolean) : []);
const contar = (registros, clave) => Object.entries(registros.reduce((conteo, registro) => {
  const valor = clave(registro) || 'Sin dato';
  return { ...conteo, [valor]: (conteo[valor] || 0) + 1 };
}, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nombre, cantidad]) => ({ nombre, cantidad }));
const dias = (fecha, hoy) => {
  const tiempo = Date.parse(String(fecha || '').slice(0, 10));
  return Number.isFinite(tiempo) ? Math.floor((hoy - tiempo) / 86400000) : null;
};

// Misma fórmula que la matriz: % de exposición (probabilidad × impacto) que eliminan los controles.
export const mitigacionRiesgo = riesgo => {
  const valores = [riesgo.probabilidadInherente, riesgo.impactoInherente, riesgo.probabilidadResidual, riesgo.impactoResidual];
  if (valores.some(valor => valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor)))) return null;
  const inherente = Number(riesgo.probabilidadInherente) * Number(riesgo.impactoInherente);
  const residual = Number(riesgo.probabilidadResidual) * Number(riesgo.impactoResidual);
  return inherente ? Math.max(0, Math.min(100, Math.round(((inherente - residual) / inherente) * 100))) : 0;
};

const procesoDePlan = (plan, hallazgos) => {
  const hallazgo = hallazgos.find(item => String(item.id) === String(plan.idHallazgo));
  return plan.proceso || hallazgo?.proceso || 'Sin proceso';
};
const planCerrado = plan => (Number(plan.progreso) || 0) >= 100 || plan.estadoWorkflow === 'Cerrado' || plan.estado === 'Cerrado';

function datosPlanes({ planes, hallazgos, hoy }) {
  const vencidos = planes.filter(plan => !planCerrado(plan) && plan.fecha && new Date(`${String(plan.fecha).slice(0, 10)}T23:59:59`) < hoy)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const cerrados = planes.filter(planCerrado).length;
  return {
    resumen: {
      totalPlanes: planes.length,
      cerrados,
      abiertos: planes.length - cerrados,
      vencidos: vencidos.length,
      porcentajeCerrados: planes.length ? Math.round((cerrados / planes.length) * 100) : 0,
      avancePromedio: planes.length ? Math.round(planes.reduce((suma, plan) => suma + (Number(plan.progreso) || 0), 0) / planes.length) : 0,
    },
    planesVencidosMasAntiguos: vencidos.slice(0, 12).map(plan => ({
      plan: `PLA-${String(plan.id).slice(-4)}`,
      accion: texto(plan.accion || plan.descripcion),
      responsable: plan.responsable || 'Sin responsable',
      proceso: procesoDePlan(plan, hallazgos),
      fechaLimite: String(plan.fecha).slice(0, 10),
      diasVencido: dias(plan.fecha, hoy),
      avance: Number(plan.progreso) || 0,
      estado: plan.estadoWorkflow || plan.estado || 'Sin estado',
    })),
    vencidosPorResponsable: contar(vencidos, plan => plan.responsable),
    vencidosPorProceso: contar(vencidos, plan => procesoDePlan(plan, hallazgos)),
    planesPorEstado: contar(planes, plan => plan.estadoWorkflow || plan.estado),
  };
}

function datosHallazgos({ hallazgos, planes, hoy }) {
  const abiertos = hallazgos.filter(hallazgo => hallazgo.estado !== 'Cerrado');
  const ordenSeveridad = { Crítica: 0, Crítico: 0, Alta: 1, Media: 2, Baja: 3 };
  const conPlan = new Set(planes.map(plan => String(plan.idHallazgo)));
  const sinPlan = abiertos.filter(hallazgo => !conPlan.has(String(hallazgo.id)));
  return {
    resumen: {
      totalHallazgos: hallazgos.length,
      abiertos: abiertos.length,
      criticosOAltosAbiertos: abiertos.filter(hallazgo => ['Crítica', 'Crítico', 'Alta'].includes(hallazgo.severidad)).length,
      abiertosSinPlanDeAccion: sinPlan.length,
    },
    abiertosPrioritarios: [...abiertos]
      .sort((a, b) => ((ordenSeveridad[a.severidad] ?? 4) - (ordenSeveridad[b.severidad] ?? 4)) || String(a.fecha).localeCompare(String(b.fecha)))
      .slice(0, 12)
      .map(hallazgo => ({
        hallazgo: hallazgo.ref || `HAL-${hallazgo.id}`,
        titulo: texto(hallazgo.titulo),
        proceso: hallazgo.proceso || 'Sin proceso',
        severidad: hallazgo.severidad || 'Sin dato',
        diasAbierto: dias(hallazgo.fecha, hoy),
        tienePlan: conPlan.has(String(hallazgo.id)),
      })),
    abiertosSinPlan: sinPlan.slice(0, 15).map(hallazgo => hallazgo.ref || `HAL-${hallazgo.id}`),
    abiertosPorProceso: contar(abiertos, hallazgo => hallazgo.proceso),
    abiertosPorSeveridad: contar(abiertos, hallazgo => hallazgo.severidad),
  };
}

function datosControles({ evaluaciones }) {
  const reprobadas = evaluaciones.filter(evaluacion => Number(evaluacion.calificacion) < 100);
  return {
    resumen: {
      pruebasDeCampo: evaluaciones.length,
      aprobadasAl100: evaluaciones.length - reprobadas.length,
      reprobadas: reprobadas.length,
      efectividadPorcentaje: evaluaciones.length ? Math.round(((evaluaciones.length - reprobadas.length) / evaluaciones.length) * 100) : null,
      regla: 'Efectividad = pruebas de Trabajo de Campo con calificación 100 % sobre el total de pruebas.',
    },
    pruebasReprobadas: reprobadas.slice(0, 15).map(evaluacion => ({
      riesgo: `RSK-${evaluacion.idRiesgo}`,
      control: evaluacion.control || 'Sin código',
      calificacion: Number(evaluacion.calificacion) || 0,
      diseno: evaluacion.diseno || 'No evaluado',
      ejecucion: evaluacion.ejecucion || 'No evaluado',
      comentarios: texto(evaluacion.comentarios, 200) || 'Sin comentarios',
    })),
    reprobadasPorProceso: contar(reprobadas, evaluacion => evaluacion.proceso),
  };
}

const INSTRUCCIONES = {
  cumplimiento: 'Analiza el cumplimiento del programa de planes de acción. Explica qué tan avanzado está, qué parte está vencida, dónde se concentran los vencimientos (procesos y responsables) y qué planes concretos (por PLA) deben destrabarse primero.',
  planes: 'Analiza los planes de acción en ejecución. Identifica los cuellos de botella con los planes vencidos más antiguos (por PLA), los responsables y procesos con más vencimientos, y propone cómo recuperar la cartera vencida.',
  hallazgos: 'Analiza los hallazgos abiertos. Prioriza por severidad y antigüedad (cita los hallazgos por su referencia), señala los que no tienen plan de acción y los procesos donde se concentran, y propone el orden de atención.',
  controles: 'Analiza la efectividad de los controles probados en Trabajo de Campo. Explica qué controles fallaron (por riesgo y control), si la falla es de diseño o de ejecución según los datos, en qué procesos se concentran y qué hacer con cada uno.',
  riesgos: 'Analiza el inventario de riesgos residuales. Explica dónde se concentra la exposición (procesos y RSK), si los controles sostienen la reducción de inherente a residual y prioriza los incumplimientos de "cumplimientoNumeral9".',
};

/** { instruccion, datos, indicadores, insignias } para la tarjeta del Dashboard GRC. */
export function contextoTarjetaDashboard(tarjeta, { riesgos = [], hallazgos = [], planes = [], evaluaciones = [], hoy = new Date() }) {
  const base = { riesgos: lista(riesgos), hallazgos: lista(hallazgos), planes: lista(planes), evaluaciones: lista(evaluaciones), hoy };
  if (tarjeta === 'cumplimiento' || tarjeta === 'planes') {
    const datos = datosPlanes(base);
    const { resumen } = datos;
    return {
      instruccion: INSTRUCCIONES[tarjeta], datos,
      indicadores: [
        { etiqueta: 'Planes', valor: resumen.totalPlanes },
        { etiqueta: 'Cerrados', valor: `${resumen.porcentajeCerrados}%` },
        { etiqueta: 'Vencidos', valor: resumen.vencidos },
        { etiqueta: 'Avance prom.', valor: `${resumen.avancePromedio}%` },
      ],
      insignias: [{ etiqueta: 'Abiertos', valor: resumen.abiertos }, { etiqueta: 'Vencidos', valor: resumen.vencidos }],
    };
  }
  if (tarjeta === 'hallazgos') {
    const datos = datosHallazgos(base);
    const { resumen } = datos;
    return {
      instruccion: INSTRUCCIONES.hallazgos, datos,
      indicadores: [
        { etiqueta: 'Hallazgos', valor: resumen.totalHallazgos },
        { etiqueta: 'Abiertos', valor: resumen.abiertos },
        { etiqueta: 'Críticos/Altos', valor: resumen.criticosOAltosAbiertos },
        { etiqueta: 'Sin plan', valor: resumen.abiertosSinPlanDeAccion },
      ],
      insignias: [{ etiqueta: 'Abiertos', valor: resumen.abiertos }, { etiqueta: 'Sin plan', valor: resumen.abiertosSinPlanDeAccion }],
    };
  }
  if (tarjeta === 'controles') {
    const datos = datosControles(base);
    const { resumen } = datos;
    return {
      instruccion: INSTRUCCIONES.controles, datos,
      indicadores: [
        { etiqueta: 'Pruebas', valor: resumen.pruebasDeCampo },
        { etiqueta: 'Al 100 %', valor: resumen.aprobadasAl100 },
        { etiqueta: 'Reprobadas', valor: resumen.reprobadas },
        { etiqueta: 'Efectividad', valor: resumen.efectividadPorcentaje === null ? 'Sin pruebas' : `${resumen.efectividadPorcentaje}%` },
      ],
      insignias: [{ etiqueta: 'Pruebas', valor: resumen.pruebasDeCampo }, { etiqueta: 'Reprobadas', valor: resumen.reprobadas }],
    };
  }
  const datos = contextoMatriz(base.riesgos, {
    calcularEficacia: calcularEficaciaControl, calcularMitigacion: mitigacionRiesgo,
    hallazgos: base.hallazgos, planes: base.planes, evaluaciones: base.evaluaciones, hoy,
  });
  const altosExtremos = distribucion => distribucion.Extremo + distribucion.Alto;
  return {
    instruccion: INSTRUCCIONES.riesgos, datos,
    indicadores: [
      { etiqueta: 'Riesgos', valor: datos.metricas.totalRiesgos },
      { etiqueta: 'Altos/Extremos', valor: altosExtremos(datos.distribucionResidual) },
      { etiqueta: 'Eficacia prom.', valor: datos.metricas.eficaciaPromedioControles === null ? 'Sin controles' : `${datos.metricas.eficaciaPromedioControles}%` },
      { etiqueta: 'Mitigación', valor: datos.metricas.mitigacionPromedio === null ? 'Sin datos' : `${datos.metricas.mitigacionPromedio}%` },
    ],
    insignias: [
      { etiqueta: 'Inherente altos/extremos', valor: altosExtremos(datos.distribucionInherente) },
      { etiqueta: 'Residual altos/extremos', valor: altosExtremos(datos.distribucionResidual) },
    ],
  };
}
