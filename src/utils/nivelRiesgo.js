// Escala de probabilidad/impacto de un riesgo.
// El formulario y el cálculo del servidor guardan porcentajes (0–100); la importación de Excel guarda niveles 1–5.
// Si alguno de los cuatro valores del riesgo supera 5, el riesgo está en porcentaje y todos sus valores se leen así
// (un residual de 4 % es nivel 1, no nivel 4). Si los cuatro están entre 0 y 5, es un riesgo importado en niveles.
const CAMPOS_ESCALA = ['probabilidadInherente', 'impactoInherente', 'probabilidadResidual', 'impactoResidual'];

export function riesgoEnPorcentaje(riesgo) {
  return CAMPOS_ESCALA.some(campo => {
    const valor = Number(riesgo?.[campo]);
    return Number.isFinite(valor) && valor > 5;
  });
}

// Nivel 1–5 de un valor. `porcentaje` undefined conserva la lectura por valor (>5 = porcentaje, si no nivel).
export function nivelEscala(valor, porcentaje) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return 1;
  const comoPorcentaje = porcentaje === undefined ? numero > 5 : porcentaje;
  const nivel = comoPorcentaje ? Math.ceil(numero / 20) : Math.round(numero);
  return Math.min(5, Math.max(1, nivel));
}

// Manual de Riesgos (E-GE-MAN-001), Tablas 2 y 3: nombres de cada nivel 1–5 (20 %, 40 %, 60 %, 80 %, 100 %).
// Un porcentaje intermedio (p. ej. un residual de 25,2 %) cae en el rango del nivel: ≤20 % = 1, 21–40 % = 2…
export const ESCALA_PROBABILIDAD = ['Muy baja', 'Baja', 'Media', 'Alta', 'Muy alta'];
export const ESCALA_IMPACTO = ['Leve', 'Menor', 'Moderado', 'Mayor', 'Catastrófico'];

// Manual de Riesgos, Tabla 4 (matriz de calor): con impacto Catastrófico el riesgo es Extremo y con impacto
// Mayor es Alto en cualquier probabilidad; con probabilidad Muy alta es Alto; el resto según la tabla.
export function zonaPorNiveles(p, i) {
  if (i >= 5) return 'Extremo';
  if (i === 4 || p >= 5 || (p === 4 && i === 3)) return 'Alto';
  if ((p <= 1 && i <= 2) || (p === 2 && i <= 1)) return 'Bajo';
  return 'Moderado';
}

const COLOR_ZONA = {
  Extremo: 'bg-red-600 text-white',
  Alto: 'bg-orange-500 text-white',
  Moderado: 'bg-amber-400 text-slate-900',
  Bajo: 'bg-emerald-500 text-white',
};

export function zonaSeveridad(prob, imp, porcentaje) {
  const label = zonaPorNiveles(nivelEscala(prob, porcentaje), nivelEscala(imp, porcentaje));
  return { label, color: COLOR_ZONA[label] };
}

export function zonasRiesgo(riesgo) {
  const porcentaje = riesgoEnPorcentaje(riesgo);
  return {
    inherente: zonaSeveridad(riesgo?.probabilidadInherente, riesgo?.impactoInherente, porcentaje),
    residual: zonaSeveridad(riesgo?.probabilidadResidual, riesgo?.impactoResidual, porcentaje),
  };
}
