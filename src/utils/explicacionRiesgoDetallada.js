// 📖 "Explícame este riesgo": explicación completa del resultado de mitigación, armada con los datos del riesgo
// (controles, inherentes, plan y seguimiento). Reglas del Manual E-GE-MAN-001: Tabla 6 (eficacia), Tabla 8
// (mitigación acumulativa), Tabla 4 (zona) y numeral 9 (plan de acción / seguimiento).
import { calcularResiduales, codigoControl, desglosarEficaciaControl, explicarControl } from './explicacionControles.js';
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, zonaPorNiveles } from './nivelRiesgo.js';
import { estaAnulado } from './anulacion.js';

const ORDEN_ZONA = { Bajo: 1, Moderado: 2, Alto: 3, Extremo: 4 };
const numero = valor => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const nivelP = valor => nivelEscala(Math.max(valor, 0.01), true);
const nivelI = valor => nivelEscala(Math.max(valor, 0.01), true);
const etiquetaP = valor => `${ESCALA_PROBABILIDAD[nivelP(valor) - 1]}`;
const etiquetaI = valor => `${ESCALA_IMPACTO[nivelI(valor) - 1]}`;
const zonaDe = (p, i) => zonaPorNiveles(nivelP(p), nivelI(i));

// Por qué la zona es la que es, según la regla de la Tabla 4 que aplica.
function razonZona(p, i) {
  const np = nivelP(p);
  const ni = nivelI(i);
  const zona = zonaPorNiveles(np, ni);
  if (ni >= 5) return `Con impacto Catastrófico, la Tabla 4 ubica el riesgo en Extremo sin importar la probabilidad: aunque la probabilidad bajara a Muy baja, seguiría en Extremo mientras el impacto no baje.`;
  if (ni === 4) return `Con impacto Mayor, la Tabla 4 ubica el riesgo en Alto en cualquier probabilidad: para bajar de Alto hay que reducir el impacto.`;
  if (np >= 5) return `Con probabilidad Muy alta, la Tabla 4 ubica el riesgo en Alto: bajar la probabilidad o el impacto lo saca de esa zona.`;
  return `En la Tabla 4, probabilidad ${ESCALA_PROBABILIDAD[np - 1]} (nivel ${np}) con impacto ${ESCALA_IMPACTO[ni - 1]} (nivel ${ni}) corresponde a zona ${zona}.`;
}

// Pasos del cálculo acumulativo (Tabla 8) para un eje.
function pasos(controles, inicial, eje) {
  let valor = Number(inicial) || 0;
  return controles.map(({ control, indice }) => {
    const d = desglosarEficaciaControl(control);
    const antes = valor;
    valor -= valor * (d.total / 100);
    return {
      texto: `${codigoControl(indice)} — ${d.tipo} ${d.implementacion.toLowerCase()} (${d.factores.map(f => f.puntos).join(' + ')} = ${d.total} %): ${numero(antes)} % − ${numero(antes)} % × ${d.total} % = ${numero(valor)} %.`,
      eje,
    };
  });
}

const CONTROLES_SIMULADOS = [
  { nombre: '1 control correctivo manual', controles: [{ tipo: 'Correctivo', implementacion: 'Manual' }] },
  { nombre: '1 control correctivo automático', controles: [{ tipo: 'Correctivo', implementacion: 'Automático' }] },
  { nombre: '2 controles correctivos manuales', controles: [{ tipo: 'Correctivo', implementacion: 'Manual' }, { tipo: 'Correctivo', implementacion: 'Manual' }] },
  { nombre: '1 control preventivo automático', controles: [{ tipo: 'Preventivo', implementacion: 'Automático' }] },
  { nombre: '1 control preventivo manual', controles: [{ tipo: 'Preventivo', implementacion: 'Manual' }] },
];

/**
 * @param {{ probabilidadInherente:number, impactoInherente:number, controlesDetallados:object[], planAccionRiesgo?:string, fechaSeguimiento?:string }} riesgo
 */
export function explicarRiesgoDetallado(riesgo, { hoy = new Date() } = {}) {
  const pInh = Number(riesgo.probabilidadInherente) || 60;
  const iInh = Number(riesgo.impactoInherente) || 60;
  const todos = (Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados : [])
    .map((control, indice) => ({ control, indice })).filter(({ control }) => control);
  const vigentesConIndice = todos.filter(({ control }) => !estaAnulado(control));
  const anulados = todos.filter(({ control }) => estaAnulado(control));
  const reducenP = vigentesConIndice.filter(({ control }) => desglosarEficaciaControl(control).tipo !== 'Correctivo');
  const reducenI = vigentesConIndice.filter(({ control }) => desglosarEficaciaControl(control).tipo === 'Correctivo');
  const { probabilidadResidual: pRes, impactoResidual: iRes } = calcularResiduales(pInh, iInh, vigentesConIndice.map(({ control }) => control));
  const zonaInh = zonaDe(pInh, iInh);
  const zonaRes = zonaDe(pRes, iRes);

  // 1. Probabilidad
  const probabilidad = [
    `Sin controles, la probabilidad es ${etiquetaP(pInh)} (${numero(pInh)} %).`,
    ...(reducenP.length
      ? [
        `La reducen los controles preventivos y detectivos, uno tras otro sobre lo que deja el anterior (Tabla 8):`,
        ...pasos(reducenP, pInh, 'p').map(paso => paso.texto),
        `Resultado: ${numero(pRes)} % (${etiquetaP(pRes)}).`,
        reducenP.length === 1 ? `Toda la reducción depende de ${codigoControl(reducenP[0].indice)}: si ese control falla, la probabilidad vuelve a ${numero(pInh)} %.` : '',
      ]
      : ['No tiene controles preventivos ni detectivos vigentes: la probabilidad no baja.']),
  ].filter(Boolean);

  // 2. Impacto
  const impacto = [
    `Sin controles, el impacto es ${etiquetaI(iInh)} (${numero(iInh)} %).`,
    ...(reducenI.length
      ? [
        `Lo reducen solo los controles correctivos (Tabla 8):`,
        ...pasos(reducenI, iInh, 'i').map(paso => paso.texto),
        `Resultado: ${numero(iRes)} % (${etiquetaI(iRes)}).`,
        reducenI.length === 1 ? `Toda la reducción del impacto depende de ${codigoControl(reducenI[0].indice)}.` : '',
      ]
      : [`Solo los controles correctivos reducen el impacto (Tabla 8) y este riesgo no tiene ninguno${reducenP.length ? `: ${reducenP.map(({ indice }) => codigoControl(indice)).join(', ')} ${reducenP.length === 1 ? 'evita' : 'evitan'} que ocurra, pero si ocurre el daño es el mismo` : ''}. El impacto se queda en ${numero(iInh)} %.`]),
  ].filter(Boolean);

  // 3. Zona
  const zona = [
    zonaInh === zonaRes ? `Sigue en zona ${zonaRes}: los controles no alcanzan a cambiarla.` : `Pasa de zona ${zonaInh} a zona ${zonaRes}.`,
    razonZona(pRes, iRes),
  ];

  // 4. Lo que falta según el numeral 9 y la formalización de los controles
  const plan = String(riesgo.planAccionRiesgo || '').trim();
  const fecha = String(riesgo.fechaSeguimiento || '').trim();
  const vencido = Boolean(fecha) && new Date(`${fecha}T23:59:59`) < hoy;
  const requierePlan = ['Alto', 'Extremo'].includes(zonaRes);
  const pendientes = [
    requierePlan && !plan ? `Plan de acción: en zona ${zonaRes} el numeral 9 del manual lo exige y el campo está vacío.` : '',
    !requierePlan && !fecha ? `Seguimiento: en zona ${zonaRes} el numeral 9 del manual exige seguimiento y no hay fecha programada.` : '',
    requierePlan && !fecha ? 'Fecha de seguimiento: no hay una programada para revisar el avance del plan.' : '',
    vencido ? `El seguimiento programado para el ${fecha} ya venció.` : '',
    ...vigentesConIndice
      .map(({ control, indice }) => ({ codigo: codigoControl(indice), faltantes: explicarControl(control).faltantes }))
      .filter(item => item.faltantes.length)
      .map(item => `${item.codigo} figura como ${item.faltantes.join(', ').toLowerCase()}: no cambia la eficacia, pero el manual lo pide para considerar el control formalizado.`),
    anulados.length ? `${anulados.map(({ indice }) => codigoControl(indice)).join(', ')} ${anulados.length === 1 ? 'está anulado y no cuenta' : 'están anulados y no cuentan'} en el cálculo.` : '',
  ].filter(Boolean);

  // 5. Qué lo mejoraría: simulación con los mismos inherentes y los controles vigentes + controles nuevos.
  const actuales = vigentesConIndice.map(({ control }) => control);
  const simulaciones = CONTROLES_SIMULADOS.map(opcion => {
    const r = calcularResiduales(pInh, iInh, [...actuales, ...opcion.controles]);
    return { ...opcion, p: r.probabilidadResidual, i: r.impactoResidual, zona: zonaDe(r.probabilidadResidual, r.impactoResidual) };
  });
  const manuales = vigentesConIndice.filter(({ control }) => desglosarEficaciaControl(control).implementacion === 'Manual');
  if (manuales.length) {
    const automatizados = actuales.map(control => (desglosarEficaciaControl(control).implementacion === 'Manual' ? { ...control, implementacion: 'Automático', ejecucion: 'Automático' } : control));
    const r = calcularResiduales(pInh, iInh, automatizados);
    simulaciones.push({ nombre: `automatizar ${manuales.map(({ indice }) => codigoControl(indice)).join(', ')}`, p: r.probabilidadResidual, i: r.impactoResidual, zona: zonaDe(r.probabilidadResidual, r.impactoResidual) });
  }
  const bajanZona = simulaciones.filter(s => ORDEN_ZONA[s.zona] < ORDEN_ZONA[zonaRes])
    .sort((a, b) => ORDEN_ZONA[a.zona] - ORDEN_ZONA[b.zona]);
  const mejoras = zonaRes === 'Bajo'
    ? []
    : (bajanZona.length ? bajanZona : simulaciones.filter(s => s.p < pRes || s.i < iRes).slice(0, 2))
      .slice(0, 4)
      .map(s => ({
        accion: s.nombre.startsWith('automatizar')
          ? `Si se ${s.nombre.replace('automatizar', 'automatiza')}`
          : `Si se ${s.nombre.startsWith('1 ') ? 'agrega' : 'agregan'} ${s.nombre}`,
        resultado: `probabilidad ${numero(s.p)} % (${etiquetaP(s.p)}), impacto ${numero(s.i)} % (${etiquetaI(s.i)}) → zona ${s.zona}`,
        bajaZona: ORDEN_ZONA[s.zona] < ORDEN_ZONA[zonaRes],
      }));
  const notaMejoras = zonaRes === 'Bajo'
    ? 'Está en la zona más baja: mantener los controles operando y el seguimiento programado.'
    : (bajanZona.length ? '' : `Ningún control adicional por sí solo lo saca de zona ${zonaRes}; estas opciones reducen el valor pero no cambian la zona.`);

  return {
    zonaInherente: zonaInh,
    zonaResidual: zonaRes,
    probabilidadResidual: pRes,
    impactoResidual: iRes,
    probabilidad,
    impacto,
    zona,
    pendientes,
    mejoras,
    notaMejoras,
  };
}
