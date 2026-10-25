import { formatSafeDate } from './helpers.js';
import { esInformePrograma, TIPO_EVALUACION_INICIAL } from './programPlanWorkflow.js';

export const texto360 = (valor, vacio = 'No registrado') => {
  if (Array.isArray(valor)) return valor.map(item => texto360(item, '')).filter(Boolean).join(', ') || vacio;
  if (valor === null || valor === undefined || valor === '') return vacio;
  if (typeof valor === 'object') return vacio;
  return String(valor).trim() || vacio;
};

const id = valor => texto360(valor, '');
const lista = valor => Array.isArray(valor) ? valor : [];
const normalizar = valor => texto360(valor, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const fecha360 = valor => texto360(formatSafeDate(valor));

const fuenteInforme360 = (informe, fuentes) => lista(fuentes).find(item => (
  [item.codigo, item.id].some(valor => id(valor) && id(valor) === id(informe.tipoFuente))
));

export const tipoFuente360 = (informe, fuentes = []) => {
  const fuente = fuenteInforme360(informe, fuentes);
  return texto360(fuente?.tipoFuente || fuente?.tipo || informe.tipoFuente);
};

export const tiposFuente360 = (informes = [], fuentes = []) => (
  [...new Set(lista(informes).map(informe => tipoFuente360(informe, fuentes)))]
    .sort((a, b) => a.localeCompare(b, 'es'))
);

export const informesPorFuente360 = (informes = [], fuentes = [], tiposFuente = []) => (
  lista(informes).filter(informe => lista(tiposFuente).includes(tipoFuente360(informe, fuentes)))
);

export const progreso360 = valor => {
  if (!['number', 'string'].includes(typeof valor) || texto360(valor, '') === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 && numero <= 100 ? numero : null;
};

// Una acción cerrada como "No aplica" (hallazgo que no aplica, aprobado por el auditor) también está cerrada.
export const planCerrado360 = plan => (
  plan.estadoWorkflow
    ? ['cerrado', 'no aplica'].includes(normalizar(plan.estadoWorkflow))
    : normalizar(plan.estado) === 'cerrado'
);

export const referencia360 = (registro, prefijo) => (
  texto360(registro?.ref || registro?.codigo || (id(registro?.id) ? `${prefijo}-${registro.id}` : ''))
);

// Las fechas de calendario se comparan sin convertirlas a UTC ni desplazar el día.
const diaCalendario = valor => {
  const texto = texto360(formatSafeDate(valor), '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(texto);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:$|[,\s])/.exec(texto);
  const partes = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local ? [Number(local[3]), Number(local[2]), Number(local[1])] : null;
  if (!partes) return null;
  const [anio, mes, dia] = partes;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

export const plazoSemanas360 = (inicio, fin) => {
  const desde = diaCalendario(inicio);
  const hasta = diaCalendario(fin);
  if (!desde || !hasta) return 'No registrado';
  return (Math.abs(Date.parse(hasta) - Date.parse(desde)) / (86400000 * 7)).toFixed(1);
};

export function evidencias360(registro) {
  const archivos = [
    ...lista(registro.evidencias),
    ...lista(registro.anexosMultiples || registro.anexos),
    ...lista(registro.historialEvaluaciones).map(evaluacion => evaluacion.adjuntoEvaluacion).filter(Boolean),
    ...(registro.evaluacionHolistica?.adjuntoEvaluacion ? [registro.evaluacionHolistica.adjuntoEvaluacion] : []),
    ...lista(registro.evidenciaUrl || []).concat(
      typeof registro.evidenciaUrl === 'string' ? [registro.evidenciaUrl] : []
    ),
    ...(registro.actaSocializacionUrl ? [{ url: registro.actaSocializacionUrl, nombre: 'Acta de socialización' }] : []),
  ];
  const unicos = new Map();
  archivos.forEach(archivo => {
    const url = typeof archivo === 'string' ? archivo : archivo?.url || archivo?.href;
    if (!id(url)) return;
    const enlace = id(url);
    if (!unicos.has(enlace)) unicos.set(enlace, {
      url: enlace,
      nombre: texto360(typeof archivo === 'object' ? archivo.nombre || archivo.name : '', 'Soporte documental'),
      enlazable: /^https?:\/\/[^\s]+$/i.test(enlace),
    });
  });
  return [...unicos.values()];
}

export function evaluacion360(plan, esPrograma) {
  if (esPrograma === null) {
    return { tipo: 'Origen sin verificar', resultado: 'No se puede determinar la ruta sin el informe de origen', registro: null };
  }
  if (esPrograma) {
    const registro = plan.evaluacionHolistica;
    const inicial = registro?.tipo === TIPO_EVALUACION_INICIAL;
    const vigente = inicial || registro?.tipo === 'evaluacion-final-ejecucion';
    const puntaje = progreso360(registro?.puntaje);
    return {
      tipo: inicial || !vigente ? 'Evaluación inicial del diseño' : 'Evaluación integral del paquete',
      resultado: !vigente ? 'Pendiente de evaluación inicial'
        : registro.aprobado === true && puntaje !== null && (inicial ? puntaje >= 80 : puntaje > 80)
          ? 'Aprobada' : 'No aprobada',
      registro: vigente ? registro : null,
      anterior: !vigente ? registro : null,
      cierre: plan.evaluacionEficaciaCierre || null,
    };
  }
  const registro = plan.evaluacionEficaciaCierre;
  return {
    tipo: 'Evaluación de eficacia por acción',
    resultado: registro?.fueEficaz === true ? 'Eficaz' : registro?.fueEficaz === false ? 'No eficaz' : 'Pendiente',
    registro: registro || null,
  };
}

function resumen360(hallazgos, planes) {
  const conAvance = planes.filter(plan => plan.avance !== null);
  return {
    hallazgos: hallazgos.length,
    hallazgosCerrados: hallazgos.filter(hallazgo => normalizar(hallazgo.registro.estado) === 'cerrado').length,
    sinAcciones: hallazgos.filter(hallazgo => hallazgo.planes.length === 0).length,
    acciones: planes.length,
    cerradas: planes.filter(plan => plan.cerrado).length,
    abiertas: planes.filter(plan => !plan.cerrado).length,
    vencidas: planes.filter(plan => plan.vencido).length,
    enRevision: planes.filter(plan => !plan.cerrado && /revision|validacion/.test(normalizar(plan.registro.estadoWorkflow))).length,
    avance: conAvance.length ? Math.round(conAvance.reduce((suma, plan) => suma + plan.avance, 0) / conAvance.length) : null,
    sinAvance: planes.length - conAvance.length,
  };
}

export function construirReporte360({
  informes = [], hallazgos = [], planes = [], fuentes = [],
  modo = 'general', idInforme = '', tiposFuente = [], idsInformes = null, generadoEn = new Date(), generadoPor = '',
} = {}) {
  if (!['general', 'informe', 'fuentes'].includes(modo)) throw new Error('Selecciona un alcance válido para el Reporte 360.');
  if (!(generadoEn instanceof Date) || !Number.isFinite(generadoEn.getTime())) throw new Error('La fecha de corte del reporte no es válida.');
  const informesLista = lista(informes);
  const hallazgosLista = lista(hallazgos);
  const planesLista = lista(planes);
  if (modo === 'informe' && !informesLista.some(informe => id(informe.id) === id(idInforme))) {
    throw new Error('Selecciona un informe disponible antes de generar el PDF.');
  }
  const tiposSeleccionados = [...new Set(lista(tiposFuente))];
  const tiposDisponibles = tiposFuente360(informesLista, fuentes);
  if (modo === 'fuentes' && (!tiposSeleccionados.length || tiposSeleccionados.some(tipo => !tiposDisponibles.includes(tipo)))) {
    throw new Error('Selecciona uno o varios tipos de fuente disponibles antes de generar el PDF.');
  }
  const informesDeFuentes = informesPorFuente360(informesLista, fuentes, tiposSeleccionados);
  const idsSeleccionados = idsInformes === null ? null : [...new Set(lista(idsInformes).map(id))];
  if (modo === 'fuentes' && idsSeleccionados !== null && (
    !idsSeleccionados.length || idsSeleccionados.some(valor => !informesDeFuentes.some(informe => id(informe.id) === valor))
  )) {
    throw new Error('Selecciona uno o varios informes disponibles de los tipos de fuente elegidos antes de generar el PDF.');
  }
  const incluyeInforme = informe => modo === 'general' || Boolean(informe && (
    modo === 'informe' ? id(informe.id) === id(idInforme)
      : tiposSeleccionados.includes(tipoFuente360(informe, fuentes)) &&
        (idsSeleccionados === null || idsSeleccionados.includes(id(informe.id)))
  ));
  const porInforme = new Map(informesLista.map(informe => [id(informe.id), informe]));
  const porHallazgo = new Map(hallazgosLista.map(hallazgo => [id(hallazgo.id), hallazgo]));
  const corte = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(generadoEn);
  const grupos = new Map();
  const incidencias = [];
  const agregarGrupo = informe => {
    const clave = informe ? id(informe.id) : '__sin_informe__';
    if (!grupos.has(clave)) {
      const fuente = informe && fuenteInforme360(informe, fuentes);
      grupos.set(clave, {
        clave, informe,
        referencia: informe ? referencia360(informe, 'INF') : 'Sin informe disponible',
        titulo: informe ? texto360(informe.titulo) : 'Registros sin vínculo verificable con un informe',
        fuente,
        tipoFuente: informe ? tipoFuente360(informe, fuentes) : 'Origen sin verificar',
        esPrograma: informe ? esInformePrograma(informe, fuentes) : null,
        hallazgos: [], planesSinHallazgo: [],
      });
    }
    return grupos.get(clave);
  };
  informesLista.filter(incluyeInforme).forEach(agregarGrupo);
  const nodosHallazgo = new Map();
  hallazgosLista.forEach(hallazgo => {
    const informe = porInforme.get(id(hallazgo.idInforme));
    if (!incluyeInforme(informe)) return;
    const grupo = agregarGrupo(informe);
    const nodo = { registro: hallazgo, referencia: referencia360(hallazgo, 'HAL'), planes: [] };
    grupo.hallazgos.push(nodo);
    nodosHallazgo.set(id(hallazgo.id), nodo);
    if (!informe) incidencias.push(`${nodo.referencia}: informe de origen no disponible (${texto360(hallazgo.idInforme)}).`);
  });
  planesLista.forEach(plan => {
    const hallazgo = porHallazgo.get(id(plan.idHallazgo));
    // La relación canónica es acción -> hallazgo -> informe; idInforme cubre acciones sin hallazgo visible.
    const idOrigen = id(hallazgo?.idInforme) || id(plan.idInforme);
    const informe = porInforme.get(idOrigen);
    if (!incluyeInforme(informe)) return;
    const grupo = agregarGrupo(informe);
    const vencimiento = diaCalendario(plan.fecha);
    const cerrado = planCerrado360(plan);
    const nodo = {
      registro: plan, referencia: referencia360(plan, 'PLA'), cerrado,
      avance: progreso360(plan.progreso ?? plan.avance),
      vencido: !cerrado && vencimiento !== null && vencimiento < corte,
      evaluacion: evaluacion360(plan, grupo.esPrograma),
    };
    const padre = nodosHallazgo.get(id(plan.idHallazgo));
    if (padre && grupo.hallazgos.includes(padre)) padre.planes.push(nodo);
    else {
      grupo.planesSinHallazgo.push(nodo);
      incidencias.push(`${nodo.referencia}: hallazgo de origen no disponible (${texto360(plan.idHallazgo)}).`);
    }
    if (hallazgo && id(hallazgo.idInforme) && id(plan.idInforme) && id(hallazgo.idInforme) !== id(plan.idInforme)) {
      incidencias.push(`${nodo.referencia}: idInforme difiere del hallazgo; se usa la relación del hallazgo (${hallazgo.idInforme}).`);
    }
    if (!informe) incidencias.push(`${nodo.referencia}: informe de origen no disponible (${texto360(idOrigen)}).`);
    if (nodo.avance === null) incidencias.push(`${nodo.referencia}: avance ausente o fuera del rango 0–100%.`);
    if (id(plan.fecha) && vencimiento === null) incidencias.push(`${nodo.referencia}: fecha límite no interpretable (${fecha360(plan.fecha)}).`);
    if (cerrado && nodo.avance !== 100) incidencias.push(`${nodo.referencia}: figura cerrada con avance distinto de 100% o sin avance registrado.`);
    if (plan.estadoWorkflow && normalizar(plan.estado) === 'cerrado' && !cerrado) incidencias.push(`${nodo.referencia}: estado Cerrado en conflicto con workflow ${plan.estadoWorkflow}; se reporta como abierta.`);
  });
  const expedientes = [...grupos.values()].map(grupo => {
    const acciones = [...grupo.hallazgos.flatMap(hallazgo => hallazgo.planes), ...grupo.planesSinHallazgo];
    return { ...grupo, resumen: resumen360(grupo.hallazgos, acciones) };
  });
  const todosHallazgos = expedientes.flatMap(grupo => grupo.hallazgos);
  const todasAcciones = expedientes.flatMap(grupo => [...grupo.hallazgos.flatMap(hallazgo => hallazgo.planes), ...grupo.planesSinHallazgo]);
  return {
    modo, tiposFuente: modo === 'fuentes' ? tiposSeleccionados : [],
    generadoEn: generadoEn.toISOString(), diaCorte: corte, generadoPor: texto360(generadoPor),
    expedientes, incidencias,
    resumen: { informes: expedientes.filter(grupo => grupo.informe).length, ...resumen360(todosHallazgos, todasAcciones) },
  };
}
