// 🗂️ Ubicación de un riesgo frente al catálogo de "Cargos y Procesos" (mapaProcesos: macroproceso → subprocesos).
// Lo que coincide (sin importar mayúsculas ni tildes) queda con el nombre exacto del catálogo; lo que no existe
// en el catálogo se deja en blanco para corregirlo a mano. Lo usan el servidor (limpieza) y los filtros.

export const normalizarNombreProceso = valor => String(valor ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const comoLista = valor => (Array.isArray(valor)
  ? valor.map(item => String(item ?? '').trim()).filter(Boolean)
  : String(valor ?? '').split(',').map(item => item.trim()).filter(Boolean));

const buscarEnCatalogo = (valor, opciones) => opciones.find(opcion => normalizarNombreProceso(opcion) === normalizarNombreProceso(valor)) || null;

/**
 * Revisa la ubicación guardada del riesgo contra el catálogo.
 * Devuelve { ubicacion, fueraDeCatalogo: { macroprocesos, subprocesos }, renombrados, cambia }.
 * `ubicacion` trae los campos ya limpios (proceso, macroproceso, macroprocesos, subproceso, subprocesos,
 * subprocesosPorMacroproceso). Si el catálogo está vacío no se toca nada.
 */
export function revisarUbicacionRiesgo(riesgo, mapaProcesos = {}) {
  const catalogo = mapaProcesos && typeof mapaProcesos === 'object' ? mapaProcesos : {};
  const nombresMacro = Object.keys(catalogo);
  const vacio = { ubicacion: null, fueraDeCatalogo: { macroprocesos: [], subprocesos: [] }, renombrados: [], cambia: false };
  if (!nombresMacro.length || !riesgo) return vacio;

  const partesLegado = String(riesgo.proceso || '').split('/').map(parte => parte.trim()).filter(Boolean);
  const guardados = comoLista(riesgo.macroprocesos);
  const candidatos = guardados.length ? guardados : comoLista(riesgo.macroproceso || partesLegado[0] || '');
  const relaciones = riesgo.subprocesosPorMacroproceso && typeof riesgo.subprocesosPorMacroproceso === 'object' ? riesgo.subprocesosPorMacroproceso : {};
  const subLegado = comoLista(riesgo.subprocesos).length ? comoLista(riesgo.subprocesos) : comoLista(riesgo.subproceso || partesLegado.slice(1).join('/'));

  const fueraMacro = [];
  const fueraSub = [];
  const renombrados = [];
  const macroprocesos = [];
  const subprocesosPorMacroproceso = {};
  candidatos.forEach((candidato, indice) => {
    const nombre = String(candidato).split('/')[0].trim();
    const canonico = buscarEnCatalogo(nombre, nombresMacro);
    const claveRelacion = Object.keys(relaciones).find(clave => normalizarNombreProceso(clave) === normalizarNombreProceso(nombre));
    const subGuardados = claveRelacion ? comoLista(relaciones[claveRelacion]) : (indice === 0 ? subLegado : []);
    if (!canonico) {
      fueraMacro.push(nombre);
      subGuardados.forEach(sub => fueraSub.push(`${nombre} / ${sub}`));
      return;
    }
    if (canonico !== nombre) renombrados.push(`${nombre} → ${canonico}`);
    if (macroprocesos.includes(canonico)) return;
    macroprocesos.push(canonico);
    const disponibles = Array.isArray(catalogo[canonico]) ? catalogo[canonico] : [];
    const validos = [];
    subGuardados.forEach(sub => {
      const subCanonico = buscarEnCatalogo(sub, disponibles);
      if (!subCanonico) { fueraSub.push(`${canonico} / ${sub}`); return; }
      if (subCanonico !== sub) renombrados.push(`${canonico} / ${sub} → ${subCanonico}`);
      if (!validos.includes(subCanonico)) validos.push(subCanonico);
    });
    if (!validos.length && disponibles.length === 1 && disponibles[0] === 'General') validos.push('General');
    subprocesosPorMacroproceso[canonico] = validos;
  });

  const subprocesos = [...new Set(Object.values(subprocesosPorMacroproceso).flat())];
  const ubicacion = {
    proceso: macroprocesos[0] || '',
    macroproceso: macroprocesos[0] || '',
    macroprocesos,
    subproceso: subprocesos[0] || '',
    subprocesos,
    subprocesosPorMacroproceso,
  };
  const cambia = fueraMacro.length > 0 || fueraSub.length > 0 || renombrados.length > 0;
  return { ubicacion, fueraDeCatalogo: { macroprocesos: fueraMacro, subprocesos: fueraSub }, renombrados, cambia };
}

/** ¿El riesgo quedó sin macroproceso del catálogo? (para el filtro "Sin proceso (por corregir)"). */
export function sinProcesoDelCatalogo(riesgo, mapaProcesos = {}) {
  const nombres = Object.keys(mapaProcesos || {});
  const guardados = comoLista(riesgo?.macroprocesos);
  const candidatos = guardados.length ? guardados : comoLista(riesgo?.macroproceso || String(riesgo?.proceso || '').split('/')[0]);
  return candidatos.length === 0 || candidatos.some(nombre => !buscarEnCatalogo(String(nombre).split('/')[0].trim(), nombres));
}
