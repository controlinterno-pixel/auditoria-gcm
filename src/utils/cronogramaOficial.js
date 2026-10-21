// src/utils/cronogramaOficial.js - Restauración del Plan Anual oficial sin perder asignaciones (H11).

const clave = valor => String(valor ?? '').trim().toLowerCase();

/**
 * Devuelve la plantilla oficial conservando, por código de proceso, el responsable y el apoyo que ya
 * tiene el cronograma actual. Si un proceso no existe aún, queda sin asignar para elegir el cargo.
 */
export function restaurarCronogramaOficial(plantilla = [], actual = []) {
  const actualesPorCodigo = new Map();
  (Array.isArray(actual) ? actual : []).forEach(item => {
    const codigo = clave(item?.codigo);
    if (codigo && !actualesPorCodigo.has(codigo)) actualesPorCodigo.set(codigo, item);
  });
  return (Array.isArray(plantilla) ? plantilla : []).map(proceso => {
    const existente = actualesPorCodigo.get(clave(proceso.codigo));
    return {
      ...proceso,
      responsable: String(existente?.responsable || proceso.responsable || '').trim(),
      apoyo: String(existente?.apoyo || proceso.apoyo || '').trim(),
    };
  });
}
