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

export function zonaSeveridad(prob, imp, porcentaje) {
  const p = nivelEscala(prob, porcentaje);
  const i = nivelEscala(imp, porcentaje);
  if (p >= 4 && i >= 4) return { label: 'Extremo', color: 'bg-red-600 text-white' };
  if ((p >= 3 && i >= 4) || (p >= 4 && i >= 3)) return { label: 'Alto', color: 'bg-orange-500 text-white' };
  if (p >= 2 && i >= 2) return { label: 'Moderado', color: 'bg-amber-400 text-slate-900' };
  return { label: 'Bajo', color: 'bg-emerald-500 text-white' };
}

export function zonasRiesgo(riesgo) {
  const porcentaje = riesgoEnPorcentaje(riesgo);
  return {
    inherente: zonaSeveridad(riesgo?.probabilidadInherente, riesgo?.impactoInherente, porcentaje),
    residual: zonaSeveridad(riesgo?.probabilidadResidual, riesgo?.impactoResidual, porcentaje),
  };
}
