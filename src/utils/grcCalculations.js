/**
 * Calcula las métricas de GRC de forma matemática y determinista.
 */
export const calcularMetricasGRC = ({
  riesgoInherente = 'ALTO', // 'BAJO', 'MEDIO', 'ALTO'
  controlesTotales = 7,
  controlesEfectivos = 5,
  hallazgosCriticos = 1,
  hallazgosModerados = 2
}) => {
  // 1. Cobertura: Porcentaje de controles evaluados/existentes
  // Asumiendo un estándar de 8-10 controles óptimos por proceso
  const controlesDeseados = 8;
  const cobertura = Math.min(Math.round((controlesTotales / controlesDeseados) * 100), 100);

  // 2. Madurez: Basada en la efectividad de los controles implementados
  const madurez = Math.round((controlesEfectivos / controlesTotales) * 100) || 0;

  // 3. Score de Riesgo: Impacto de hallazgos sobre la exposición
  // Factor de peso: Crítico = 25%, Moderado = 10%
  const penalizacionHallazgos = (hallazgosCriticos * 25) + (hallazgosModerados * 10);
  const baseRiesgo = riesgoInherente === 'ALTO' ? 80 : riesgoInherente === 'MEDIO' ? 50 : 20;
  
  // El score de riesgo final baja según la madurez pero sube por hallazgos
  let scoreRiesgo = Math.round(baseRiesgo * (1 - madurez / 100) + penalizacionHallazgos);
  scoreRiesgo = Math.min(Math.max(scoreRiesgo, 10), 95); // Límite entre 10% y 95%

  // 4. Riesgo Residual: Clasificación cualitativa según Score de Riesgo
  let riesgoResidual = 'BAJO';
  if (scoreRiesgo > 60) riesgoResidual = 'ALTO';
  else if (scoreRiesgo > 35) riesgoResidual = 'MEDIO';

  // 5. Calidad del Análisis: Basado en la completitud de los datos recopilados
  const calidad = 90; // Puedes ajustarlo según campos llenados en el formulario

  return {
    scoreRiesgo: `${scoreRiesgo}%`,
    madurez: `${madurez}%`,
    controles: controlesTotales,
    cobertura: `${cobertura}%`,
    riesgoInherente,
    riesgoResidual,
    calidad: `${calidad}/100`
  };
};