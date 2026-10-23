// 🧮 Eficacia de controles y explicaciones en lenguaje sencillo, según el Manual del Sistema Integral de
// Riesgos (E-GE-MAN-001). Una sola fuente para la matriz, el desglose residual, Trabajo de Campo y el servidor.
//
// Tabla 6 (numeral 8.3.4): solo los ATRIBUTOS DE EFICIENCIA tienen peso.
//   Tipo: Preventivo 25 %, Detectivo 15 %, Correctivo 10 %.   Implementación: Automático 25 %, Manual 15 %.
// Documentación, Frecuencia y Evidencia son ATRIBUTOS INFORMATIVOS: no suman (peso "--" en el manual).
// Ejemplo del manual (Tabla 7): preventivo manual = 40 %; detectivo manual = 30 %.
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, riesgoEnPorcentaje, zonaSeveridad } from './nivelRiesgo.js';

export const codigoControl = indice => `CTL-2${indice + 1}`;

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

const listar = elementos => (elementos.length <= 1
  ? elementos.join('')
  : `${elementos.slice(0, -1).join(', ')} y ${elementos.at(-1)}`);

const FALTANTE_INFORMATIVO = {
  Documentación: 'no está documentado en ningún procedimiento, manual o flujograma del proceso',
  Frecuencia: 'se aplica de forma aleatoria y no cada vez que se realiza la actividad con riesgo',
  Evidencia: 'no deja registro de su ejecución, así que no se puede verificar que se hizo',
};
const ACCION_INFORMATIVA = {
  Documentación: 'documentarlo en el procedimiento del proceso',
  Frecuencia: 'aplicarlo siempre que se realice la actividad con riesgo',
  Evidencia: 'dejar registro de cada ejecución (acta, formato, sistema)',
};

/**
 * Explicación personalizada de la eficacia de un control.
 * `estado`: 'maximo' (ya tiene el máximo de su tipo), 'mejorable' (manual) y `formal` indica si cumple los
 * tres atributos informativos.
 */
export function explicarControl(control) {
  const { total, maximoPosible, tipo, implementacion, informativos } = desglosarEficaciaControl(control);
  const efecto = tipo === 'Correctivo'
    ? `si el riesgo llega a ocurrir, reduce en un ${total}% la gravedad del daño (no evita que ocurra)`
    : tipo === 'Detectivo'
      ? `detecta la desviación durante el proceso y reduce en un ${total}% la probabilidad de que el riesgo ocurra, aunque puede generar reprocesos`
      : `actúa antes de la actividad que origina el riesgo y reduce en un ${total}% la probabilidad de que ocurra`;
  const calculo = `${total}% = ${tipo} ${PESO_TIPO[tipo]}% + ${implementacion} ${PESO_IMPLEMENTACION[implementacion]}% (Tabla 6 del manual).`;
  const delMaximo = `Tiene ${total} de ${maximoPosible} puntos posibles para un control ${tipo.toLowerCase()} (${Math.round((total / maximoPosible) * 100)}% del máximo).`;
  const techo = implementacion === 'Automático'
    ? `${delMaximo} Ya tiene el mejor diseño posible para su tipo.`
    : `${delMaximo} Al ser manual depende de una persona y tiene implícito el error humano; si se automatizara subiría a ${maximoPosible}%.`;
  const faltantes = informativos.filter(atributo => !atributo.cumple);
  const formalizacion = faltantes.length === 0
    ? 'Está documentado, se aplica de forma continua y deja registro: cumple los atributos informativos del manual.'
    : `Atención: ${listar(faltantes.map(atributo => FALTANTE_INFORMATIVO[atributo.atributo]))}. Estos atributos no cambian el porcentaje, pero sin ellos no hay cómo demostrar que el control funciona.`;

  const mejoras = [
    ...(implementacion === 'Manual' ? [{ texto: 'Automatizarlo (que un sistema lo ejecute sin intervención de personas)', efecto: `subiría de ${total}% a ${maximoPosible}%` }] : []),
    ...faltantes.map(atributo => ({ texto: ACCION_INFORMATIVA[atributo.atributo].replace(/^./, letra => letra.toUpperCase()), efecto: 'no suma porcentaje, pero lo formaliza y permite verificarlo' })),
  ];

  return {
    eficacia: total,
    maximoPosible,
    estado: implementacion === 'Automático' ? 'maximo' : 'mejorable',
    formal: faltantes.length === 0,
    resumen: `Este control ${efecto}.`,
    calculo,
    techo,
    formalizacion,
    mejoras,
  };
}

const FRASE_PROBABILIDAD = [
  'la actividad con riesgo se ejecuta como máximo 2 veces al año',
  'la actividad con riesgo se ejecuta de 3 a 24 veces al año',
  'la actividad con riesgo se ejecuta de 24 a 500 veces al año',
  'la actividad con riesgo se ejecuta de 500 a 5.000 veces al año',
  'la actividad con riesgo se ejecuta más de 5.000 veces al año',
];
const FRASE_IMPACTO = [
  'afectación menor a 10 SMLMV o a la imagen de algún área',
  'entre 10 y 50 SMLMV o afectación de imagen a nivel interno, de junta, accionistas o proveedores',
  'entre 50 y 100 SMLMV o afectación de imagen con usuarios relevantes para los objetivos',
  'entre 100 y 500 SMLMV o afectación de imagen sostenida a nivel de sector, departamento o municipio',
  'más de 500 SMLMV o afectación de imagen sostenida a nivel nacional',
];
const ACCION_POR_ZONA = {
  Extremo: 'Según el numeral 9 del manual, el dueño del proceso debe definir un plan de acción.',
  Alto: 'Según el numeral 9 del manual, el dueño del proceso debe definir un plan de acción.',
  Moderado: 'Según el numeral 9 del manual, el dueño del proceso debe hacer seguimiento para detectar a tiempo si los controles pierden efectividad y el riesgo sube de cuadrante.',
  Bajo: 'Según el numeral 9 del manual, el dueño del proceso debe hacer seguimiento para detectar a tiempo si los controles pierden efectividad y el riesgo sube de cuadrante.',
};
const redondear = valor => (Number.isInteger(valor) ? valor : Math.round(valor * 10) / 10);
const nivelP = porcentaje => nivelEscala(Math.max(porcentaje, 0.01), true);
const etiquetaProbabilidad = porcentaje => ESCALA_PROBABILIDAD[nivelP(porcentaje) - 1];
const etiquetaImpacto = porcentaje => ESCALA_IMPACTO[nivelP(porcentaje) - 1];
const aplicarCascada = (inicial, eficacias) => eficacias.reduce((actual, eficacia) => actual - actual * (eficacia / 100), inicial);

/**
 * Explicación en lenguaje sencillo del desglose residual (numeral 8.3.5 y Tabla 8: mitigación acumulativa).
 * `exp` es el resultado de obtenerExplicacionCalculo.
 */
export function explicarCalculoResidual(exp, riesgo = {}) {
  const pasosP = exp.pasosP || [];
  const pasosI = exp.pasosI || [];

  const probabilidad = [`Sin controles, la probabilidad es ${exp.probInh}% (${etiquetaProbabilidad(exp.probInh)}): ${FRASE_PROBABILIDAD[nivelP(exp.probInh) - 1]}.`];
  if (pasosP.length === 0) {
    probabilidad.push('No tiene controles preventivos ni detectivos, así que nada reduce esa probabilidad.');
  } else {
    probabilidad.push(pasosP.length === 1
      ? `Su control ${pasosP[0].codigo} (${pasosP[0].eficacia}%) la reduce a ${redondear(pasosP[0].despues)}%.`
      : `Los controles se aplican uno tras otro: cada uno reduce lo que dejó el anterior (mitigación acumulativa, Tabla 8). ${pasosP.map(paso => `${paso.codigo} (${paso.eficacia}%) la deja en ${redondear(paso.despues)}%`).join('; ')}.`);
    probabilidad.push(`Probabilidad residual: ${exp.probFinal}% (${etiquetaProbabilidad(exp.probFinal)}).`);
    if (pasosP.length > 1) {
      const masFuerte = [...pasosP].sort((a, b) => b.eficacia - a.eficacia)[0];
      const sinEl = Math.round(aplicarCascada(exp.probInh, pasosP.filter(paso => paso !== masFuerte).map(paso => paso.eficacia)));
      probabilidad.push(`Si ${masFuerte.codigo} dejara de aplicarse, la probabilidad subiría a ${sinEl}%.`);
    }
  }

  const impacto = [`Si el riesgo ocurre, el impacto sin controles es ${exp.impInh}% (${etiquetaImpacto(exp.impInh)}): ${FRASE_IMPACTO[nivelP(exp.impInh) - 1]}.`];
  if (pasosI.length === 0) {
    impacto.push('No tiene controles correctivos: los preventivos y detectivos bajan la probabilidad, pero no la gravedad. El impacto residual queda igual al inherente.');
  } else {
    impacto.push(`${pasosI.map(paso => `${paso.codigo} (${paso.eficacia}%) lo deja en ${redondear(paso.despues)}%`).join('; ')}. Impacto residual: ${exp.impFinal}% (${etiquetaImpacto(exp.impFinal)}). Los correctivos no evitan que ocurra, pero limitan el daño.`);
  }

  const zonaInherente = zonaSeveridad(exp.probInh, exp.impInh, true).label;
  const zonaResidual = zonaSeveridad(Math.max(exp.probFinal, 0.01), Math.max(exp.impFinal, 0.01), true).label;
  const movimiento = zonaInherente === zonaResidual
    ? `En la matriz de calor (Tabla 4) el riesgo sigue en zona ${zonaResidual}: los controles reducen los valores, pero no lo cambian de zona.`
    : `En la matriz de calor (Tabla 4) los controles mueven el riesgo de zona ${zonaInherente} a zona ${zonaResidual}.`;
  const conclusion = `${movimiento} ${ACCION_POR_ZONA[zonaResidual]}`;

  // El residual guardado se calculó al guardar el riesgo; si la regla cambió, se actualiza al recalcular.
  const guardadoP = Number(riesgo.probabilidadResidual);
  const guardadoI = Number(riesgo.impactoResidual);
  const desactualizado = riesgoEnPorcentaje(riesgo) && Number.isFinite(guardadoP) && Number.isFinite(guardadoI) &&
    (Math.round(guardadoP) !== exp.probFinal || Math.round(guardadoI) !== exp.impFinal);
  const aviso = desactualizado
    ? `El residual guardado en la matriz (${Math.round(guardadoP)}% / ${Math.round(guardadoI)}%) se calculó con la regla anterior; según el manual es ${exp.probFinal}% / ${exp.impFinal}%. Se actualiza al guardar el riesgo o con el recálculo de la matriz.`
    : '';

  return { probabilidad, impacto, conclusion, aviso, zonaInherente, zonaResidual };
}

/**
 * Riesgo residual (numeral 8.3.5, Tabla 8): los controles mitigan de forma acumulativa. Preventivos y detectivos
 * reducen la probabilidad; correctivos, el impacto. Valores en porcentaje, redondeados a entero.
 */
export function calcularResiduales(probabilidadInherente, impactoInherente, controles = []) {
  let probabilidad = Number(probabilidadInherente) || 60;
  let impacto = Number(impactoInherente) || 60;
  (Array.isArray(controles) ? controles : []).forEach(control => {
    const eficacia = calcularEficaciaControl(control) / 100;
    if (esCorrectivo(control)) impacto -= impacto * eficacia;
    else probabilidad -= probabilidad * eficacia;
  });
  return { probabilidadResidual: Math.max(Math.round(probabilidad), 0), impactoResidual: Math.max(Math.round(impacto), 0) };
}
