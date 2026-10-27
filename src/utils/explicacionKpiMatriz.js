// 💡 Tarjetas de "Ver matriz" (total, altos/extremos, residual promedio y controles): valor y explicación
// (chulito verde) calculados con los riesgos del filtro actual. Reglas del Manual E-GE-MAN-001 (Tablas 2–4, 6 y numeral 9).
import { desglosarEficaciaControl, eficaciaSobreMaximo } from './explicacionControles.js';
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, riesgoEnPorcentaje, zonaSeveridad } from './nivelRiesgo.js';
import { estaAnulado } from './anulacion.js';
import { clasificacionDeRiesgo } from './clasificacionRiesgo.js';
import { tienePlanDeAccion } from './planesDelRiesgo.js';

const ZONAS = ['Extremo', 'Alto', 'Moderado', 'Bajo'];
const numero = valor => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;
const codigos = (riesgos, max = 6) => `${riesgos.slice(0, max).map(riesgo => `RSK-${riesgo.id}`).join(', ')}${riesgos.length > max ? ` y ${riesgos.length - max} más` : ''}`;
const dato = valor => (valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor));
const controlesVigentes = riesgo => (Array.isArray(riesgo?.controlesDetallados) ? riesgo.controlesDetallados.filter(control => control && !estaAnulado(control)) : []);
const tieneResidual = riesgo => dato(riesgo.probabilidadResidual) !== null && dato(riesgo.impactoResidual) !== null;
// Los riesgos importados en niveles 1–5 se pasan a porcentaje con el tope de su nivel (Tablas 2 y 3: nivel × 20 %).
const enPorcentaje = (valor, riesgo) => (riesgoEnPorcentaje(riesgo) ? Number(valor) : nivelEscala(valor, false) * 20);

export const zonaResidual = riesgo => zonaSeveridad(riesgo.probabilidadResidual, riesgo.impactoResidual, riesgoEnPorcentaje(riesgo)).label;
const esAltoOExtremo = riesgo => ['Alto', 'Extremo'].includes(zonaResidual(riesgo));
const repartoZonas = riesgos => ZONAS.map(zona => [zona, riesgos.filter(riesgo => zonaResidual(riesgo) === zona).length]).filter(([, n]) => n > 0)
  .map(([zona, n]) => `${n} ${zona}`).join(', ');
const describirResidual = riesgo => {
  const porcentaje = riesgoEnPorcentaje(riesgo);
  const p = nivelEscala(riesgo.probabilidadResidual, porcentaje);
  const i = nivelEscala(riesgo.impactoResidual, porcentaje);
  const unidad = porcentaje ? ' %' : '';
  return `probabilidad ${numero(riesgo.probabilidadResidual)}${unidad} (${ESCALA_PROBABILIDAD[p - 1]}) × impacto ${numero(riesgo.impactoResidual)}${unidad} (${ESCALA_IMPACTO[i - 1]})`;
};

/** Promedio de la probabilidad y del impacto residuales (en %) y su zona en la Tabla 4. */
export function nivelResidualPromedio(riesgos = []) {
  const conDatos = riesgos.filter(tieneResidual);
  if (conDatos.length === 0) return { zona: null, p: 0, i: 0, conDatos };
  const p = conDatos.reduce((suma, riesgo) => suma + enPorcentaje(riesgo.probabilidadResidual, riesgo), 0) / conDatos.length;
  const i = conDatos.reduce((suma, riesgo) => suma + enPorcentaje(riesgo.impactoResidual, riesgo), 0) / conDatos.length;
  return { zona: zonaSeveridad(p, i, true).label, p, i, conDatos };
}

/** Total de riesgos: dónde están, en qué zona residual quedan y qué se dejó por fuera. */
export function explicarTotalRiesgos({ riesgos, alcance, totalMatriz, anuladosFiltro = 0, porSubproceso = false }) {
  const ubicacion = riesgo => (porSubproceso ? riesgo.subprocesos : riesgo.macroprocesos) || [];
  const conteo = new Map();
  riesgos.forEach(riesgo => (ubicacion(riesgo).length ? ubicacion(riesgo) : ['Sin ubicación']).forEach(lugar => conteo.set(lugar, (conteo.get(lugar) || 0) + 1)));
  const lugares = [...conteo].sort((a, b) => b[1] - a[1]);
  const clasificaciones = new Map();
  riesgos.forEach(riesgo => { const c = clasificacionDeRiesgo(riesgo) || 'Sin clasificación'; clasificaciones.set(c, (clasificaciones.get(c) || 0) + 1); });
  const sinResidual = riesgos.filter(riesgo => !tieneResidual(riesgo));
  return {
    titulo: 'Total de riesgos',
    valor: String(riesgos.length),
    lineas: [
      `Son los riesgos activos de ${alcance}${riesgos.length !== totalMatriz ? `: ${riesgos.length} de los ${totalMatriz} activos de la matriz` : ''}.`,
      lugares.length ? `Por ${porSubproceso ? 'subproceso' : 'macroproceso'}: ${lugares.slice(0, 6).map(([lugar, n]) => `${lugar} (${n})`).join(', ')}${lugares.length > 6 ? ` y ${lugares.length - 6} más` : ''}.` : '',
      clasificaciones.size ? `Por clasificación: ${[...clasificaciones].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(', ')}.` : '',
      riesgos.length ? `Zona residual (Tabla 4): ${repartoZonas(riesgos.filter(tieneResidual)) || 'sin datos'}.` : '',
      anuladosFiltro ? `${plural(anuladosFiltro, 'riesgo anulado coincide', 'riesgos anulados coinciden')} con el filtro y no se cuenta${anuladosFiltro === 1 ? '' : 'n'}.` : '',
    ].filter(Boolean),
    accion: sinResidual.length ? `${codigos(sinResidual)} no ${sinResidual.length === 1 ? 'tiene' : 'tienen'} probabilidad o impacto residual: no entra${sinResidual.length === 1 ? '' : 'n'} en los cálculos de nivel.` : '',
  };
}

/** Riesgos en zona residual Alto o Extremo, con su cálculo y si tienen plan de acción (numeral 9). */
export function explicarAltosExtremos({ riesgos, alcance, planes = [] }) {
  const altos = riesgos.filter(tieneResidual).filter(esAltoOExtremo)
    .sort((a, b) => ZONAS.indexOf(zonaResidual(a)) - ZONAS.indexOf(zonaResidual(b)));
  const porcentaje = riesgos.length ? Math.round((altos.length / riesgos.length) * 100) : 0;
  const sinPlan = altos.filter(riesgo => !tienePlanDeAccion(riesgo, planes));
  const moderados = riesgos.filter(tieneResidual).filter(riesgo => zonaResidual(riesgo) === 'Moderado');
  return {
    titulo: 'Riesgos altos y críticos',
    valor: String(altos.length),
    lineas: [
      `Cuenta los riesgos de ${alcance} cuyo nivel residual (después de controles) queda en zona Alto o Extremo de la Tabla 4: ${altos.length} de ${riesgos.length} (${porcentaje} %).`,
      ...altos.slice(0, 8).map(riesgo => `RSK-${riesgo.id}: ${describirResidual(riesgo)} → ${zonaResidual(riesgo)}. Plan de acción: ${tienePlanDeAccion(riesgo, planes) ? 'sí' : 'no'}.`),
      altos.length > 8 ? `Y ${altos.length - 8} más.` : '',
      altos.length === 0 && moderados.length ? `Ninguno está en Alto o Extremo. Los más cercanos están en Moderado: ${codigos(moderados)}.` : '',
    ].filter(Boolean),
    accion: altos.length === 0
      ? ''
      : sinPlan.length
        ? `Según el numeral 9 del manual, en zona Alto o Extremo se debe definir plan de acción: falta en ${codigos(sinPlan)}.`
        : `${altos.length === 1 ? 'Tiene' : 'Todos tienen'} plan de acción, como pide el numeral 9 del manual; verifica su avance en Planes.`,
  };
}

/** Riesgo residual promedio: promedios de probabilidad e impacto ubicados en la Tabla 4. */
export function explicarResidualPromedio({ riesgos, alcance }) {
  const { zona, p, i, conDatos } = nivelResidualPromedio(riesgos);
  const sinDatos = riesgos.filter(riesgo => !tieneResidual(riesgo));
  if (!zona) {
    return { titulo: 'Riesgo residual promedio', valor: 'Sin dato', lineas: [`Los riesgos de ${alcance} no tienen probabilidad e impacto residuales registrados.`], accion: '' };
  }
  const nivelP = nivelEscala(p, true);
  const nivelI = nivelEscala(i, true);
  const importados = conDatos.filter(riesgo => !riesgoEnPorcentaje(riesgo)).length;
  const altos = conDatos.filter(esAltoOExtremo);
  const ocultos = ['Bajo', 'Moderado'].includes(zona) ? altos : [];
  return {
    titulo: 'Riesgo residual promedio',
    valor: zona,
    lineas: [
      `Promedio de los ${plural(conDatos.length, 'riesgo', 'riesgos')} de ${alcance} con datos residuales: probabilidad ${numero(p)} % (nivel ${nivelP}, ${ESCALA_PROBABILIDAD[nivelP - 1]}) e impacto ${numero(i)} % (nivel ${nivelI}, ${ESCALA_IMPACTO[nivelI - 1]}).`,
      `En la matriz de calor (Tabla 4), probabilidad ${ESCALA_PROBABILIDAD[nivelP - 1]} con impacto ${ESCALA_IMPACTO[nivelI - 1]} es zona ${zona}.`,
      `Riesgo por riesgo: ${repartoZonas(conDatos)}.`,
      importados ? `${plural(importados, 'riesgo está registrado', 'riesgos están registrados')} en niveles 1–5; para promediar se tomó cada nivel como su porcentaje (nivel × 20 %).` : '',
      sinDatos.length ? `No entran en el promedio por falta de datos: ${codigos(sinDatos)}.` : '',
    ].filter(Boolean),
    accion: ocultos.length
      ? `El promedio queda en ${zona}, pero ${codigos(ocultos)} ${ocultos.length === 1 ? 'está' : 'están'} en ${ocultos.length === 1 ? `zona ${zonaResidual(ocultos[0])}` : 'zona Alto o Extremo'}: el promedio no reemplaza revisar cada riesgo.`
      : '',
  };
}

/** Controles vigentes: cuántos, de qué tipo, su eficacia frente al máximo y qué riesgos no tienen. */
export function explicarControlesMatriz({ riesgos, alcance }) {
  const desgloses = riesgos.flatMap(controlesVigentes).map(control => ({ ...desglosarEficaciaControl(control), sobreMaximo: eficaciaSobreMaximo(control) }));
  const legados = riesgos.filter(riesgo => !(riesgo.controlesDetallados || []).length && riesgo.descripcionControl).length;
  const anulados = riesgos.reduce((suma, riesgo) => suma + (Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.filter(control => control && estaAnulado(control)).length : 0), 0);
  const sinControles = riesgos.filter(riesgo => controlesVigentes(riesgo).length === 0 && !riesgo.descripcionControl);
  const total = desgloses.length + legados;
  const masControles = [...riesgos].sort((a, b) => controlesVigentes(b).length - controlesVigentes(a).length)[0];
  const tabla6 = desgloses.length ? desgloses.reduce((suma, d) => suma + d.total, 0) / desgloses.length : 0;
  const sobreMaximo = desgloses.length ? desgloses.reduce((suma, d) => suma + d.sobreMaximo, 0) / desgloses.length : 0;
  const porTipo = ['Preventivo', 'Detectivo', 'Correctivo'].map(tipo => [tipo, desgloses.filter(d => d.tipo === tipo).length]).filter(([, n]) => n > 0);
  const manuales = desgloses.filter(d => d.implementacion === 'Manual').length;
  return {
    titulo: 'Controles implementados',
    valor: String(total),
    lineas: [
      `Son los controles vigentes de los ${plural(riesgos.length, 'riesgo', 'riesgos')} de ${alcance}${riesgos.length ? `, ${numero(total / riesgos.length)} por riesgo en promedio` : ''}.`,
      porTipo.length ? `Por tipo: ${porTipo.map(([tipo, n]) => `${n} ${tipo.toLowerCase()}${n === 1 ? '' : 's'}`).join(', ')}. Por implementación: ${desgloses.length - manuales} automáticos y ${manuales} manuales.` : '',
      legados ? `${plural(legados, 'riesgo tiene', 'riesgos tienen')} el control solo como texto de una matriz anterior (sin tipo ni implementación): cuenta como 1 control y no entra en la eficacia.` : '',
      desgloses.length ? `Eficacia promedio: ${Math.round(sobreMaximo)} % del máximo posible para el tipo de cada control; en la Tabla 6 equivale a ${numero(tabla6)} % (tipo + implementación, máximo 50 %).` : '',
      masControles && controlesVigentes(masControles).length ? `El riesgo con más controles es RSK-${masControles.id} (${controlesVigentes(masControles).length}).` : '',
      anulados ? `${plural(anulados, 'control anulado no se cuenta', 'controles anulados no se cuentan')}.` : '',
    ].filter(Boolean),
    accion: sinControles.length
      ? `${codigos(sinControles)} no ${sinControles.length === 1 ? 'tiene' : 'tienen'} controles: su residual no se reduce hasta registrarlos.`
      : manuales
        ? `Los ${plural(manuales, 'control manual', 'controles manuales')} ${manuales === 1 ? 'es el' : 'son los'} que tienen margen: según la Tabla 6, pasar uno a automático le suma 10 puntos.`
        : '',
  };
}
