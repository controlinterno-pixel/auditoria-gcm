// 🧮 Eficacia de controles y explicaciones en lenguaje sencillo, según el Manual del Sistema Integral de
// Riesgos (E-GE-MAN-001). Una sola fuente para la matriz, el desglose residual, Trabajo de Campo y el servidor.
//
// Tabla 6 (numeral 8.3.4): solo los ATRIBUTOS DE EFICIENCIA tienen peso.
//   Tipo: Preventivo 25 %, Detectivo 15 %, Correctivo 10 %.   Implementación: Automático 25 %, Manual 15 %.
// Documentación, Frecuencia y Evidencia son ATRIBUTOS INFORMATIVOS: no suman (peso "--" en el manual).
// Ejemplo del manual (Tabla 7): preventivo manual = 40 %; detectivo manual = 30 %.
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, riesgoEnPorcentaje, zonaSeveridad } from './nivelRiesgo.js';
import { vigentes } from './anulacion.js';

// Código del control: CTL-{riesgo}-{n}, el mismo que usa Trabajo de Campo (Evaluaciones). Sin riesgo: CTL-{n}.
export const codigoControl = (indice, idRiesgo) => (idRiesgo !== undefined && idRiesgo !== null && String(idRiesgo) !== ''
  ? `CTL-${idRiesgo}-${indice + 1}`
  : `CTL-${indice + 1}`);

const incluye = (valor, texto) => String(valor || '').includes(texto);
const esCorrectivo = control => incluye(control?.tipo, 'Correctivo');
const esDetectivo = control => incluye(control?.tipo, 'Detectivo');

const PESO_TIPO = { Preventivo: 25, Detectivo: 15, Correctivo: 10 };
const PESO_IMPLEMENTACION = { Automático: 25, Manual: 15 };

/**
 * Peso de cada atributo del control según la Tabla 6. `informativos` indica si el control cumple cada
 * atributo informativo (no cambian la eficacia, pero el manual los usa para valorar la formalización).
 * Valores vacíos: tipo Preventivo e implementación Manual (como en el formulario).
 */
export function desglosarEficaciaControl(control) {
  const tipo = esCorrectivo(control) ? 'Correctivo' : esDetectivo(control) ? 'Detectivo' : 'Preventivo';
  const implementacion = incluye(control?.implementacion || control?.ejecucion, 'Automático') ? 'Automático' : 'Manual';
  const documentacion = control?.documentacion || '';
  const evidencia = control?.evidencia || '';
  const informativos = [
    { atributo: 'Documentación', cumple: incluye(documentacion, 'Documentado') && !incluye(documentacion, 'No documentado'), si: 'Documentado', no: 'Sin documentar' },
    { atributo: 'Frecuencia', cumple: !(incluye(control?.frecuencia, 'Aleatoria') || incluye(control?.frecuencia, 'Periódica')), si: 'Continua', no: 'Aleatoria' },
    { atributo: 'Evidencia', cumple: (incluye(evidencia, 'Con') && !incluye(evidencia, 'Sin')) || incluye(evidencia, 'Trazable'), si: 'Con registro', no: 'Sin registro' },
  ].map(({ atributo, cumple, si, no }) => ({ atributo, cumple, valor: cumple ? si : no }));
  const factores = [
    { atributo: 'Tipo', valor: tipo, puntos: PESO_TIPO[tipo] },
    { atributo: 'Implementación', valor: implementacion, puntos: PESO_IMPLEMENTACION[implementacion] },
  ];
  return {
    total: factores.reduce((suma, factor) => suma + factor.puntos, 0),
    maximoPosible: PESO_TIPO[tipo] + PESO_IMPLEMENTACION.Automático,
    tipo,
    implementacion,
    factores,
    informativos,
  };
}

// Sin control estructurado se asume el caso más común del manual: preventivo manual (40 %).
export const calcularEficaciaControl = control => (control ? desglosarEficaciaControl(control).total : 40);

// Qué implica, para este control, cada atributo informativo que no cumple.
const CONSECUENCIA_FALTANTE = {
  Documentación: 'No está documentado: si cambia el responsable, nada garantiza que se siga haciendo.',
  Frecuencia: 'Se aplica de forma aleatoria: las veces que no se aplica, el riesgo queda sin cubrir.',
  Evidencia: 'No deja registro: no hay forma de demostrar que se ejecuta.',
};
const ACCION_FALTANTE = {
  Documentación: 'Documentarlo en el procedimiento del proceso.',
  Frecuencia: 'Aplicarlo cada vez que se realiza la actividad con riesgo.',
  Evidencia: 'Dejar registro de cada ejecución.',
};

/** Color del diseño del control según el % del máximo de su tipo: verde ≥ 80 %, ámbar 60–79 %, rojo < 60 %. */
export const tonoDiseno = porcentajeDelMaximo => (porcentajeDelMaximo >= 80 ? 'verde' : porcentajeDelMaximo >= 60 ? 'ambar' : 'rojo');

/**
 * Lectura de un control con sus datos reales: cuánto reduce, de dónde sale el valor, qué le falta y cómo subirlo.
 * `estado`: 'maximo' (automático) o 'mejorable'; `formal`: cumple los tres atributos informativos.
 */
export function explicarControl(control) {
  const { total, maximoPosible, tipo, implementacion, informativos } = desglosarEficaciaControl(control);
  const porcentajeDelMaximo = Math.round((total / maximoPosible) * 100);
  const faltantes = informativos.filter(atributo => !atributo.cumple);
  return {
    eficacia: total,
    maximoPosible,
    estado: implementacion === 'Automático' ? 'maximo' : 'mejorable',
    formal: faltantes.length === 0,
    // Atributos informativos que no cumple, en pocas palabras (p. ej. "Frecuencia aleatoria").
    faltantes: faltantes.map(atributo => (atributo.atributo === 'Frecuencia' ? 'Frecuencia aleatoria' : atributo.valor)),
    porcentajeDelMaximo,
    resumen: `Reduce ${total}% ${tipo === 'Correctivo' ? 'el impacto' : 'la probabilidad'}.`,
    calculo: `${tipo} ${PESO_TIPO[tipo]}% + ${implementacion} ${PESO_IMPLEMENTACION[implementacion]}% = ${total}% (${total} de ${maximoPosible} puntos · ${porcentajeDelMaximo}% del máximo).`,
    formalizacion: faltantes.map(atributo => CONSECUENCIA_FALTANTE[atributo.atributo]).join(' '),
    mejoras: [
      ...(implementacion === 'Manual' ? [{ texto: 'Automatizarlo', efecto: `subiría de ${total}% a ${maximoPosible}%` }] : []),
      ...faltantes.map(atributo => ({ texto: ACCION_FALTANTE[atributo.atributo], efecto: '' })),
    ],
  };
}

const nivelP = porcentaje => nivelEscala(Math.max(porcentaje, 0.01), true);
const etiquetaProbabilidad = porcentaje => ESCALA_PROBABILIDAD[nivelP(porcentaje) - 1];
const etiquetaImpacto = porcentaje => ESCALA_IMPACTO[nivelP(porcentaje) - 1];
const aplicarCascada = (inicial, eficacias) => eficacias.reduce((actual, eficacia) => actual - actual * (eficacia / 100), inicial);

// De qué control depende la reducción: qué pasa si falla el único o el más fuerte.
const dependencia = (pasos, inicial, unidad) => {
  if (pasos.length === 1) return `Depende solo de ${pasos[0].codigo}: si falla, ${unidad} vuelve a ${inicial}%.`;
  const masFuerte = [...pasos].sort((a, b) => b.eficacia - a.eficacia)[0];
  const sinEl = Math.round(aplicarCascada(inicial, pasos.filter(paso => paso !== masFuerte).map(paso => paso.eficacia)));
  return `Si ${masFuerte.codigo} deja de aplicarse, ${unidad} sube a ${sinEl}%.`;
};

/**
 * Lectura del residual con los datos reales del riesgo: cuánto bajó y con qué controles, de cuál depende, qué
 * controles tienen fallas de formalización y si tiene el plan de acción o el seguimiento que su zona exige.
 * `exp` es el resultado de obtenerExplicacionCalculo; `riesgo` aporta controles, plan y fecha de seguimiento.
 */
export function explicarCalculoResidual(exp, riesgo = {}, { hoy = new Date() } = {}) {
  const pasosP = exp.pasosP || [];
  const pasosI = exp.pasosI || [];
  const codigos = pasos => pasos.map(paso => paso.codigo).join(', ');

  const probabilidad = pasosP.length === 0
    ? [`Ningún control preventivo o detectivo: la probabilidad sigue en ${exp.probInh}%.`]
    : [
      `Baja de ${exp.probInh}% a ${exp.probFinal}% (${etiquetaProbabilidad(exp.probFinal)}) con ${pasosP.length === 1 ? '1 control' : `${pasosP.length} controles`}: ${codigos(pasosP)}.`,
      dependencia(pasosP, exp.probInh, 'la probabilidad'),
    ];

  const impacto = pasosI.length === 0
    ? [`Ningún control correctivo: si el riesgo ocurre, el impacto sigue en ${exp.impInh}% (${etiquetaImpacto(exp.impInh)}).`]
    : [
      `Baja de ${exp.impInh}% a ${exp.impFinal}% (${etiquetaImpacto(exp.impFinal)}) con ${codigos(pasosI)}.`,
      dependencia(pasosI, exp.impInh, 'el impacto'),
    ];

  // Controles vigentes de este riesgo a los que les falta documentación, continuidad o evidencia.
  const fallas = (Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados : [])
    .map((control, indice) => ({ control, indice }))
    .filter(({ control }) => control && control.estado !== 'Anulado')
    .map(({ control, indice }) => ({ codigo: codigoControl(indice, riesgo.id), faltantes: explicarControl(control).faltantes }))
    .filter(item => item.faltantes.length > 0);

  const zonaInherente = zonaSeveridad(exp.probInh, exp.impInh, true).label;
  const zonaResidual = zonaSeveridad(Math.max(exp.probFinal, 0.01), Math.max(exp.impFinal, 0.01), true).label;
  const requierePlan = ['Alto', 'Extremo'].includes(zonaResidual);
  const plan = String(riesgo.planAccionRiesgo || '').trim();
  const fecha = String(riesgo.fechaSeguimiento || '').trim();
  const vencido = Boolean(fecha) && new Date(`${fecha}T23:59:59`) < hoy;

  const seguimiento = vencido
    ? `El seguimiento programado venció el ${fecha}.`
    : fecha
      ? `Próximo seguimiento: ${fecha}.`
      : `No tiene fecha de seguimiento programada${requierePlan ? '' : ` y en zona ${zonaResidual} el manual exige seguimiento`}.`;
  const conclusion = [
    zonaInherente === zonaResidual ? `Sigue en zona ${zonaResidual}.` : `Pasa de zona ${zonaInherente} a zona ${zonaResidual}.`,
    requierePlan
      ? (plan ? `Plan de acción registrado: "${plan}".` : `No tiene plan de acción registrado y en zona ${zonaResidual} es obligatorio (numeral 9 del manual).`)
      : '',
    seguimiento,
    fallas.length > 0 ? `Controles con fallas de formalización: ${fallas.map(item => `${item.codigo} (${item.faltantes.join(', ').toLowerCase()})`).join('; ')}.` : '',
  ].filter(Boolean).join(' ');

  // El residual guardado se calculó al guardar el riesgo; si no coincide, se actualiza al volver a guardarlo.
  const guardadoP = Number(riesgo.probabilidadResidual);
  const guardadoI = Number(riesgo.impactoResidual);
  const desactualizado = riesgoEnPorcentaje(riesgo) && Number.isFinite(guardadoP) && Number.isFinite(guardadoI) &&
    (Math.round(guardadoP) !== exp.probFinal || Math.round(guardadoI) !== exp.impFinal);
  const aviso = desactualizado
    ? `El residual guardado en la matriz (${Math.round(guardadoP)}% / ${Math.round(guardadoI)}%) no coincide con este cálculo (${exp.probFinal}% / ${exp.impFinal}%). Se actualiza al guardar el riesgo.`
    : '';

  return { probabilidad, impacto, conclusion, aviso, zonaInherente, zonaResidual, requierePlan, planRegistrado: Boolean(plan), seguimientoVencido: vencido };
}

/**
 * Riesgo residual (numeral 8.3.5, Tabla 8): los controles mitigan de forma acumulativa. Preventivos y detectivos
 * reducen la probabilidad; correctivos, el impacto. Valores en porcentaje, redondeados a entero.
 */
export function calcularResiduales(probabilidadInherente, impactoInherente, controles = []) {
  let probabilidad = Number(probabilidadInherente) || 60;
  let impacto = Number(impactoInherente) || 60;
  // Los controles anulados no mitigan.
  vigentes(controles).forEach(control => {
    const eficacia = calcularEficaciaControl(control) / 100;
    if (esCorrectivo(control)) impacto -= impacto * eficacia;
    else probabilidad -= probabilidad * eficacia;
  });
  return { probabilidadResidual: Math.max(Math.round(probabilidad), 0), impactoResidual: Math.max(Math.round(impacto), 0) };
}
