// 📖 "Explícame este riesgo": explicación completa del resultado de mitigación, armada con los datos del riesgo
// (controles, inherentes, plan y seguimiento). Reglas del Manual E-GE-MAN-001: Tabla 6 (eficacia), Tabla 8
// (mitigación acumulativa), Tabla 4 (zona) y numeral 9 (plan de acción / seguimiento).
import { calcularResiduales, codigoControl, desglosarEficaciaControl, explicarControl } from './explicacionControles.js';
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, zonaPorNiveles } from './nivelRiesgo.js';
import { estaAnulado } from './anulacion.js';
import { textoPlanDeAccion } from './planesDelRiesgo.js';

const ORDEN_ZONA = { Bajo: 1, Moderado: 2, Alto: 3, Extremo: 4 };
export const numero = valor => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const nivelP = valor => nivelEscala(Math.max(valor, 0.01), true);
const nivelI = valor => nivelEscala(Math.max(valor, 0.01), true);
export const etiquetaP = valor => `${ESCALA_PROBABILIDAD[nivelP(valor) - 1]}`;
export const etiquetaI = valor => `${ESCALA_IMPACTO[nivelI(valor) - 1]}`;
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
function pasos(controles, inicial, eje, idRiesgo) {
  let valor = Number(inicial) || 0;
  return controles.map(({ control, indice }) => {
    const d = desglosarEficaciaControl(control);
    const antes = valor;
    valor -= valor * (d.total / 100);
    return {
      valor,
      texto: `${codigoControl(indice, idRiesgo)} — ${d.tipo} ${d.implementacion.toLowerCase()} (${d.factores.map(f => f.puntos).join(' + ')} = ${d.total} %): ${numero(antes)} % − ${numero(antes)} % × ${d.total} % = ${numero(valor)} %.`,
      eje,
    };
  });
}

// La matriz guarda el residual en entero: si el cálculo exacto tiene decimales, se aclara el redondeo.
const redondeo = (pasosEje, entero) => {
  const exacto = pasosEje.length ? pasosEje[pasosEje.length - 1].valor : entero;
  return Math.abs(exacto - entero) >= 0.05 ? `; el cálculo da ${numero(exacto)} % y la matriz lo guarda redondeado` : '';
};

/**
 * Última prueba de Trabajo de Campo de cada control de un riesgo. Evaluaciones guarda el control como
 * "CTL-{idRiesgo}-{n}" (n desde 1); se empareja por riesgo y número, no por el código que muestra la matriz.
 * @returns {Map<number, {calificacion:number, fecha:string, diseno:string, ejecucion:string}>} índice del control → prueba
 */
export function pruebasDeCampoDelRiesgo(evaluaciones, idRiesgo) {
  const pruebas = new Map();
  (Array.isArray(evaluaciones) ? evaluaciones : [])
    .filter(ev => ev && String(ev.idRiesgo) === String(idRiesgo))
    .forEach(ev => {
      const coincide = /^CTL-[^-]+-(\d+)$/.exec(String(ev.control || '').trim());
      if (!coincide) return;
      const indice = Number(coincide[1]) - 1;
      const marca = Number(ev.id) > 1e12 ? Number(ev.id) : 0;
      const previa = pruebas.get(indice);
      if (previa && previa.marca >= marca) return;
      pruebas.set(indice, {
        marca,
        calificacion: Number(ev.calificacion),
        fecha: marca ? new Date(marca).toISOString().slice(0, 10)
          : (String(ev.fecha || '').slice(0, 10) || [ev.mes, ev.anio].filter(Boolean).join(' ')),
        diseno: ev.diseno || 'No evaluado',
        ejecucion: ev.ejecucion || 'No evaluado',
        // Lo que observó el auditor en campo: es la evidencia concreta de por qué falló.
        comentarios: String(ev.comentarios || '').replace(/\s+/g, ' ').trim().slice(0, 300),
      });
    });
  return pruebas;
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
const sinDatoInherente = riesgo => [riesgo?.probabilidadInherente, riesgo?.impactoInherente]
  .some(valor => valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor)));

export function explicarRiesgoDetallado(riesgo, { hoy = new Date(), pruebasCampo = new Map(), planes = [] } = {}) {
  // Sin probabilidad o impacto inherente no se calcula nada con valores supuestos.
  if (sinDatoInherente(riesgo)) {
    return {
      zonaInherente: 'Sin dato', zonaResidual: 'Sin dato', probabilidadResidual: null, impactoResidual: null,
      probabilidad: ['Sin dato: el riesgo no tiene registrada la probabilidad o el impacto inherente.'],
      impacto: [], zona: [],
      pendientes: ['Registrar la probabilidad (Tabla 2) y el impacto (Tabla 3) inherentes del Manual E-GE-MAN-001 para poder calcular el riesgo.'],
      mejoras: [], notaMejoras: 'Sin dato para simular mejoras.',
    };
  }
  const pInh = Number(riesgo.probabilidadInherente);
  const iInh = Number(riesgo.impactoInherente);
  const todos = (Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados : [])
    .map((control, indice) => ({ control, indice })).filter(({ control }) => control);
  const vigentesConIndice = todos.filter(({ control }) => !estaAnulado(control));
  const anulados = todos.filter(({ control }) => estaAnulado(control));
  const reducenP = vigentesConIndice.filter(({ control }) => desglosarEficaciaControl(control).tipo !== 'Correctivo');
  const reducenI = vigentesConIndice.filter(({ control }) => desglosarEficaciaControl(control).tipo === 'Correctivo');
  const { probabilidadResidual: pRes, impactoResidual: iRes } = calcularResiduales(pInh, iInh, vigentesConIndice.map(({ control }) => control));
  const pasosP = pasos(reducenP, pInh, 'p', riesgo.id);
  const pasosI = pasos(reducenI, iInh, 'i', riesgo.id);
  const zonaInh = zonaDe(pInh, iInh);
  const zonaRes = zonaDe(pRes, iRes);

  // 1. Probabilidad
  const probabilidad = [
    `Sin controles, la probabilidad es ${etiquetaP(pInh)} (${numero(pInh)} %).`,
    ...(reducenP.length
      ? [
        `La reducen los controles preventivos y detectivos, uno tras otro sobre lo que deja el anterior (Tabla 8):`,
        ...pasosP.map(paso => paso.texto),
        `Resultado: ${numero(pRes)} % (${etiquetaP(pRes)})${redondeo(pasosP, pRes)}.`,
        nivelP(pRes) === nivelP(pInh)
          ? `${reducenP.length === 1 ? 'Este control baja' : `Estos ${reducenP.length} controles bajan`} el porcentaje, pero la probabilidad sigue en el mismo nivel (${etiquetaP(pInh)}, nivel ${nivelP(pInh)})${nivelP(pInh) === 1 ? ', que ya era el más bajo de la escala' : ''}: por eso no ${reducenP.length === 1 ? 'cambia' : 'cambian'} la zona.`
          : '',
        reducenP.length === 1 ? `Toda la reducción depende de ${codigoControl(reducenP[0].indice, riesgo.id)}: si ese control falla, la probabilidad vuelve a ${numero(pInh)} %.` : '',
      ]
      : ['No tiene controles preventivos ni detectivos vigentes: la probabilidad no baja.']),
  ].filter(Boolean);

  // 2. Impacto
  const impacto = [
    `Sin controles, el impacto es ${etiquetaI(iInh)} (${numero(iInh)} %).`,
    ...(reducenI.length
      ? [
        `Lo reducen solo los controles correctivos (Tabla 8):`,
        ...pasosI.map(paso => paso.texto),
        `Resultado: ${numero(iRes)} % (${etiquetaI(iRes)})${redondeo(pasosI, iRes)}.`,
        nivelI(iRes) === nivelI(iInh) ? `${reducenI.length === 1 ? 'Este control baja' : 'Estos controles bajan'} el porcentaje, pero el impacto sigue en el mismo nivel (${etiquetaI(iInh)}).` : '',
        reducenI.length === 1 ? `Toda la reducción del impacto depende de ${codigoControl(reducenI[0].indice, riesgo.id)}.` : '',
      ]
      : [`Solo los controles correctivos reducen el impacto (Tabla 8) y este riesgo no tiene ninguno${reducenP.length ? `: ${reducenP.map(({ indice }) => codigoControl(indice, riesgo.id)).join(', ')} ${reducenP.length === 1 ? 'evita' : 'evitan'} que ocurra, pero si ocurre el daño es el mismo` : ''}. El impacto se queda en ${numero(iInh)} %.`]),
  ].filter(Boolean);

  // 3. Zona
  const zona = [
    zonaInh === zonaRes ? `Sigue en zona ${zonaRes}: los controles no alcanzan a cambiarla.` : `Pasa de zona ${zonaInh} a zona ${zonaRes}.`,
    razonZona(pRes, iRes),
    nivelP(pRes) === 1 && ORDEN_ZONA[zonaRes] > 1 ? `La probabilidad ya está en el nivel más bajo (Muy baja): más controles preventivos o detectivos no cambian la zona. Para bajarla hay que reducir el impacto con controles correctivos.` : '',
  ].filter(Boolean);

  // 4. Lo que falta según el numeral 9 y la formalización de los controles
  const faltantesPorControl = vigentesConIndice
    .map(({ control, indice }) => ({ codigo: codigoControl(indice, riesgo.id), faltantes: explicarControl(control).faltantes }))
    .filter(item => item.faltantes.length);
  const reprobados = vigentesConIndice
    .filter(({ indice }) => pruebasCampo.get(indice) && pruebasCampo.get(indice).calificacion < 100)
    .map(({ control, indice }) => {
      const prueba = pruebasCampo.get(indice);
      const sinEl = calcularResiduales(pInh, iInh, vigentesConIndice.filter(item => item.indice !== indice).map(item => item.control));
      const correctivo = desglosarEficaciaControl(control).tipo === 'Correctivo';
      return {
        codigo: codigoControl(indice, riesgo.id), calificacion: prueba.calificacion, comentarios: prueba.comentarios || '',
        eje: correctivo ? 'impacto' : 'probabilidad', sinElControl: correctivo ? sinEl.impactoResidual : sinEl.probabilidadResidual,
        zonaSinElControl: zonaDe(sinEl.probabilidadResidual, sinEl.impactoResidual),
      };
    });
  const plan = textoPlanDeAccion(riesgo, planes);
  const fecha = String(riesgo.fechaSeguimiento || '').trim();
  const vencido = Boolean(fecha) && new Date(`${fecha}T23:59:59`) < hoy;
  const requierePlan = ['Alto', 'Extremo'].includes(zonaRes);
  const pendientes = [
    requierePlan && !plan ? `Plan de acción: en zona ${zonaRes} el numeral 9 del manual lo exige y el campo está vacío.` : '',
    !requierePlan && !fecha ? `Seguimiento: en zona ${zonaRes} el numeral 9 del manual exige seguimiento y no hay fecha programada.` : '',
    requierePlan && !fecha ? 'Fecha de seguimiento: no hay una programada para revisar el avance del plan.' : '',
    vencido ? `El seguimiento programado para el ${fecha} ya venció.` : '',
    ...faltantesPorControl
      .map(item => `${item.codigo} figura como ${item.faltantes.join(', ').toLowerCase()}: no cambia la eficacia, pero el manual lo pide para considerar el control formalizado.`),
    // Controles reprobados en Trabajo de Campo: el cálculo los cuenta (Tabla 6 valora el diseño), pero se muestra
    // cuánto quedaría el residual si en la práctica no operan.
    ...vigentesConIndice
      .filter(({ indice }) => pruebasCampo.get(indice) && pruebasCampo.get(indice).calificacion < 100)
      .map(({ control, indice }) => {
        const prueba = pruebasCampo.get(indice);
        const sinEl = calcularResiduales(pInh, iInh, vigentesConIndice.filter(item => item.indice !== indice).map(item => item.control));
        const eje = desglosarEficaciaControl(control).tipo === 'Correctivo' ? 'el impacto' : 'la probabilidad';
        const actual = eje === 'el impacto' ? iRes : pRes;
        const sinControl = eje === 'el impacto' ? sinEl.impactoResidual : sinEl.probabilidadResidual;
        return `${codigoControl(indice, riesgo.id)} fue reprobado en Trabajo de Campo${prueba.fecha ? ` el ${prueba.fecha}` : ''} (calificación ${prueba.calificacion} %; diseño: ${prueba.diseno}, ejecución: ${prueba.ejecucion}). El cálculo lo sigue contando porque el manual valora la eficacia por diseño (Tabla 6); si en la práctica no opera, ${eje} quedaría en ${numero(sinControl)} % en lugar de ${numero(actual)} % (zona ${zonaDe(sinEl.probabilidadResidual, sinEl.impactoResidual)}).`;
      }),
    anulados.length ? `${anulados.map(({ indice }) => codigoControl(indice, riesgo.id)).join(', ')} ${anulados.length === 1 ? 'está anulado y no cuenta' : 'están anulados y no cuentan'} en el cálculo.` : '',
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
    simulaciones.push({ nombre: `automatizar ${manuales.map(({ indice }) => codigoControl(indice, riesgo.id)).join(', ')}`, p: r.probabilidadResidual, i: r.impactoResidual, zona: zonaDe(r.probabilidadResidual, r.impactoResidual) });
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
    // Mismo cálculo en forma estructurada, para que el código arme el plan del dictamen (no va a la IA).
    simulacion: {
      inherente: { probabilidad: pInh, impacto: iInh },
      actual: { probabilidad: pRes, impacto: iRes, zona: zonaRes },
      bajanZona: bajanZona.map(s => ({ accion: s.nombre, p: s.p, i: s.i, zona: s.zona })),
      automatizarManuales: manuales.length ? simulaciones.find(s => s.nombre.startsWith('automatizar')) : null,
      manuales: manuales.map(({ indice }) => codigoControl(indice, riesgo.id)),
      sinPruebaDeCampo: vigentesConIndice.filter(({ indice }) => !pruebasCampo.get(indice)).map(({ indice }) => codigoControl(indice, riesgo.id)),
      reprobados,
      faltantesPorControl,
      plan, fecha, vencido,
    },
  };
}

/**
 * Análisis exacto de un control dentro de su riesgo: qué pasa con el residual y la zona si el control
 * falla (no opera) y si se automatiza. Lo usa la auditoría de control con IA para no deducirlo.
 */
export function analizarControlEnRiesgo(riesgo, indiceControl, { pruebasCampo = new Map() } = {}) {
  if (sinDatoInherente(riesgo)) return null;
  const pInh = Number(riesgo.probabilidadInherente);
  const iInh = Number(riesgo.impactoInherente);
  const todos = Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados : [];
  const control = todos[indiceControl];
  if (!control) return null;
  const vigentes = todos.map((item, indice) => ({ item, indice })).filter(({ item }) => item && !estaAnulado(item));
  const d = desglosarEficaciaControl(control);
  const eje = d.tipo === 'Correctivo' ? 'impacto' : 'probabilidad';
  const etiqueta = eje === 'impacto' ? etiquetaI : etiquetaP;
  const resultado = lista => {
    const r = calcularResiduales(pInh, iInh, lista);
    const valor = eje === 'impacto' ? r.impactoResidual : r.probabilidadResidual;
    return { valor, nivel: etiqueta(valor), zona: zonaDe(r.probabilidadResidual, r.impactoResidual) };
  };
  const actual = resultado(vigentes.map(({ item }) => item));
  const siFalla = resultado(vigentes.filter(({ indice }) => indice !== indiceControl).map(({ item }) => item));
  const automatizado = d.implementacion === 'Automático' ? null : resultado(vigentes.map(({ item, indice }) => (
    indice === indiceControl ? { ...item, implementacion: 'Automático', ejecucion: 'Automático' } : item)));
  const codigo = codigoControl(indiceControl, riesgo.id);
  // Acciones de un solo paso que cambian la zona del riesgo (calculadas una por una, no en conjunto).
  const base = vigentes.map(({ item }) => item);
  const opciones = [
    ...vigentes.filter(({ item }) => desglosarEficaciaControl(item).implementacion !== 'Automático').map(({ item, indice }) => ({
      accion: `Automatizar ${codigoControl(indice, riesgo.id)}`,
      controles: vigentes.map(otro => (otro.indice === indice ? { ...item, implementacion: 'Automático', ejecucion: 'Automático' } : otro.item)),
    })),
    { accion: 'Agregar 1 control preventivo manual', controles: [...base, { tipo: 'Preventivo', implementacion: 'Manual' }] },
    { accion: 'Agregar 1 control preventivo automático', controles: [...base, { tipo: 'Preventivo', implementacion: 'Automático' }] },
    { accion: 'Agregar 1 control correctivo manual', controles: [...base, { tipo: 'Correctivo', implementacion: 'Manual' }] },
    { accion: 'Agregar 2 controles correctivos manuales', controles: [...base, { tipo: 'Correctivo', implementacion: 'Manual' }, { tipo: 'Correctivo', implementacion: 'Manual' }] },
  ];
  const evaluar = (accion, controles) => {
    const r = calcularResiduales(pInh, iInh, controles);
    return { accion, p: r.probabilidadResidual, i: r.impactoResidual, zona: zonaDe(r.probabilidadResidual, r.impactoResidual) };
  };
  const texto = opcion => `${opcion.accion}: probabilidad ${numero(opcion.p)} % (${etiquetaP(opcion.p)}), impacto ${numero(opcion.i)} % (${etiquetaI(opcion.i)}) → zona ${opcion.zona}.`;
  const bajaZona = opcion => ORDEN_ZONA[opcion.zona] < ORDEN_ZONA[actual.zona];
  const opcionesQueCambianLaZona = opciones.map(opcion => evaluar(opcion.accion, opcion.controles)).filter(bajaZona);
  const accionesQueCambianLaZona = opcionesQueCambianLaZona.map(texto);
  // Si ningún paso único cambia la zona, se prueban combinaciones de dos pasos (automatizar y/o agregar).
  const pasosAplicables = [
    ...vigentes.filter(({ item }) => desglosarEficaciaControl(item).implementacion !== 'Automático').map(({ indice }) => ({ accion: `automatizar ${codigoControl(indice, riesgo.id)}`, automatizar: indice })),
    { accion: 'agregar 1 control preventivo manual', agregar: { tipo: 'Preventivo', implementacion: 'Manual' } },
    { accion: 'agregar 1 control correctivo manual', agregar: { tipo: 'Correctivo', implementacion: 'Manual' } },
    { accion: 'agregar 1 control preventivo automático', agregar: { tipo: 'Preventivo', implementacion: 'Automático' } },
    { accion: 'agregar 1 control correctivo automático', agregar: { tipo: 'Correctivo', implementacion: 'Automático' } },
  ];
  const aplicar = pasos => [
    ...vigentes.map(({ item, indice }) => (pasos.some(paso => paso.automatizar === indice) ? { ...item, implementacion: 'Automático', ejecucion: 'Automático' } : item)),
    ...pasos.filter(paso => paso.agregar).map(paso => paso.agregar),
  ];
  const opcionesDeDosPasos = accionesQueCambianLaZona.length ? [] : pasosAplicables
    .flatMap((primero, i) => pasosAplicables.slice(i + 1).map(segundo => evaluar(`${primero.accion.replace(/^./, l => l.toUpperCase())} + ${segundo.accion}`, aplicar([primero, segundo]))))
    .filter(bajaZona)
    .sort((a, b) => ORDEN_ZONA[a.zona] - ORDEN_ZONA[b.zona] || (/automatizar.*automatizar/i.test(b.accion) - /automatizar.*automatizar/i.test(a.accion)))
    .slice(0, 4);
  const combinacionesDeDosPasos = opcionesDeDosPasos.map(texto);
  const residualActual = calcularResiduales(pInh, iInh, base);
  const controlesPorTipo = ['Preventivo', 'Detectivo', 'Correctivo'].map(tipo => {
    const codigos = vigentes.filter(({ item }) => desglosarEficaciaControl(item).tipo === tipo).map(({ indice }) => codigoControl(indice, riesgo.id));
    return `${tipo}s: ${codigos.length ? codigos.join(', ') : 'ninguno'}`;
  }).join(' · ');
  const describe = (titulo, r) => `${titulo}: ${eje} ${numero(r.valor)} % (${r.nivel}) → zona ${r.zona}${r.zona === actual.zona ? ' (la zona no cambia)' : ` (cambia desde ${actual.zona})`}.`;
  const prueba = pruebasCampo.get(indiceControl) || null;
  return {
    control: codigo,
    reduce: eje,
    eficacia: `${d.tipo} ${d.implementacion.toLowerCase()}: ${d.factores.map(f => f.puntos).join(' + ')} = ${d.total} % de ${d.maximoPosible} % posible para su tipo${d.total < d.maximoPosible ? ` (no está en el máximo: le faltan ${d.maximoPosible - d.total} puntos, que se ganan automatizándolo)` : ' (está en el máximo de su tipo)'}.`,
    situacionActual: `Con todos los controles vigentes: ${eje} ${numero(actual.valor)} % (${actual.nivel}) → zona ${actual.zona}.`,
    siElControlFalla: describe(`Si ${codigo} falla o no opera`, siFalla),
    siSeAutomatiza: automatizado ? describe(`Si ${codigo} se automatiza (${d.total} % → ${d.total + 10} %)`, automatizado) : `${codigo} ya es automático.`,
    // Última prueba de Trabajo de Campo de este control (null si nunca se probó).
    pruebaTrabajoDeCampo: (() => {
      if (!prueba) return 'Aún no tiene pruebas de Trabajo de Campo: no es una falla del control; falta confirmar en campo que opera como está diseñado.';
      return prueba.calificacion < 100
        ? `ALERTA: ${codigo} fue REPROBADO en Trabajo de Campo${prueba.fecha ? ` el ${prueba.fecha}` : ''} con ${prueba.calificacion} % (diseño: ${prueba.diseno}, ejecución: ${prueba.ejecucion}).${prueba.comentarios ? ` Observación del auditor: «${prueba.comentarios}».` : ''} Su eficacia de diseño sigue contando en el cálculo, pero en la práctica puede no estar operando: la mitigación que aporta no está demostrada.`
        : `${codigo} aprobó su última prueba de Trabajo de Campo (${prueba.fecha ? `${prueba.fecha}, ` : ''}100 %).`;
    })(),
    controlesDelRiesgoPorTipo: controlesPorTipo,
    accionesQueCambianLaZona: accionesQueCambianLaZona.length ? accionesQueCambianLaZona : [`Ninguna acción de un solo paso saca el riesgo de zona ${actual.zona}.`],
    combinacionesDeDosPasos: combinacionesDeDosPasos.length ? combinacionesDeDosPasos
      : (accionesQueCambianLaZona.length ? [] : [`Tampoco hay combinaciones de dos pasos que saquen el riesgo de zona ${actual.zona}.`]),
    // Atributos que le faltan a ESTE control para estar formalizado (cada uno pide su propia acción).
    faltasDeFormalizacion: d.informativos.filter(i => !i.cumple).map(i => `${i.atributo}: ${i.valor.toLowerCase()}`),
    documentarlo: d.informativos.some(i => !i.cumple)
      ? `Documentarlo, darle frecuencia continua y registro (${d.informativos.filter(i => !i.cumple).map(i => i.valor.toLowerCase()).join(', ')}) no cambia su eficacia según la Tabla 6, pero lo formaliza y da evidencia para auditoría.`
      : 'Está formalizado: documentado, con frecuencia continua y con registro.',
    // Mismo cálculo en forma estructurada, para que el código arme el plan y los indicadores (no se envía a la IA).
    simulacion: {
      codigo, eje, tipo: d.tipo, implementacion: d.implementacion, eficacia: d.total, eficaciaMaxima: d.maximoPosible,
      actual: { probabilidad: residualActual.probabilidadResidual, impacto: residualActual.impactoResidual, valor: actual.valor, nivel: actual.nivel, zona: actual.zona },
      siFalla, automatizado,
      cambianLaZona: opcionesQueCambianLaZona,
      dosPasos: opcionesDeDosPasos,
      prueba,
      faltas: d.informativos.filter(i => !i.cumple).map(i => i.atributo),
    },
  };
}
