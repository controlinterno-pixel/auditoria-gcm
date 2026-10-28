// src/utils/proyectos/cronograma.js - Dependencias, reprogramación, ruta crítica y línea base.
// Solo se manejan dependencias fin-inicio (FS) con desfase en días: la sucesora empieza después de que
// termina la predecesora. Es el tipo que usan casi todos los cronogramas de gestión; los demás no se ofrecen.
import { ajustarAHabil, diasEntre, duracion, esFecha, sumarDias } from './fechas.js';
import { ESTADOS_CERRADOS_TAREA, TIPOS_CONTENEDOR } from './modelo.js';

const porId = tareas => new Map(tareas.map(tarea => [String(tarea.id), tarea]));
const dependenciasDe = tarea => (Array.isArray(tarea?.dependencias) ? tarea.dependencias : [])
  .map(dependencia => ({ id: String(dependencia.id), desfase: Math.trunc(Number(dependencia.desfase) || 0) }));

/** Tareas que tienen hijas (fases, paquetes, épicas con contenido) no se planifican ni pesan por sí mismas. */
export function idsContenedores(tareas) {
  return new Set(tareas.filter(tarea => tarea.padreId).map(tarea => String(tarea.padreId)));
}
export const esHoja = (tarea, contenedores) => !contenedores.has(String(tarea.id)) && !TIPOS_CONTENEDOR.includes(tarea.tipo);

/** Primer ciclo encontrado como lista de ids (A → B → A), o null. También detecta padres circulares. */
export function detectarCiclo(tareas) {
  const mapa = porId(tareas);
  const estado = new Map();
  const pila = [];
  const visitar = id => {
    if (estado.get(id) === 2) return null;
    if (estado.get(id) === 1) return [...pila.slice(pila.indexOf(id)), id];
    estado.set(id, 1);
    pila.push(id);
    for (const { id: predecesora } of dependenciasDe(mapa.get(id))) {
      if (!mapa.has(predecesora)) continue;
      const ciclo = visitar(predecesora);
      if (ciclo) return ciclo;
    }
    pila.pop();
    estado.set(id, 2);
    return null;
  };
  for (const id of mapa.keys()) {
    const ciclo = visitar(id);
    if (ciclo) return ciclo;
  }
  for (const tarea of tareas) {
    const vistos = new Set([String(tarea.id)]);
    for (let actual = tarea; actual?.padreId;) {
      const padre = String(actual.padreId);
      if (vistos.has(padre)) return [...vistos, padre];
      vistos.add(padre);
      actual = mapa.get(padre);
    }
  }
  return null;
}

/** Problemas de estructura: dependencias a tareas que no existen, a sí mismas, a contenedores o en ciclo. */
export function erroresEstructura(tareas) {
  const mapa = porId(tareas);
  const contenedores = idsContenedores(tareas);
  const errores = [];
  tareas.forEach(tarea => {
    if (tarea.padreId && !mapa.has(String(tarea.padreId))) errores.push(`"${tarea.titulo}" pertenece a una fase o paquete que no existe.`);
    if (tarea.padreId && mapa.has(String(tarea.padreId)) && !TIPOS_CONTENEDOR.includes(mapa.get(String(tarea.padreId)).tipo)) {
      errores.push(`"${tarea.titulo}" solo puede colgar de una fase, paquete de trabajo o épica.`);
    }
    dependenciasDe(tarea).forEach(({ id }) => {
      if (id === String(tarea.id)) errores.push(`"${tarea.titulo}" no puede depender de sí misma.`);
      else if (!mapa.has(id)) errores.push(`"${tarea.titulo}" depende de una tarea que no existe.`);
      else if (contenedores.has(id) || TIPOS_CONTENEDOR.includes(mapa.get(id).tipo)) errores.push(`"${tarea.titulo}" debe depender de una actividad o hito, no de una fase o paquete.`);
    });
  });
  const ciclo = detectarCiclo(tareas);
  if (ciclo) errores.push(`Las dependencias forman un ciclo imposible: ${ciclo.map(id => mapa.get(id)?.titulo || id).join(' → ')}.`);
  return errores;
}

/** Orden topológico (predecesoras primero). Supone que no hay ciclos. */
function ordenTopologico(tareas) {
  const mapa = porId(tareas);
  const vistos = new Set();
  const orden = [];
  const visitar = id => {
    if (vistos.has(id) || !mapa.has(id)) return;
    vistos.add(id);
    dependenciasDe(mapa.get(id)).forEach(dependencia => visitar(dependencia.id));
    orden.push(mapa.get(id));
  };
  tareas.forEach(tarea => visitar(String(tarea.id)));
  return orden;
}

/**
 * Empuja hacia adelante las sucesoras que quedaron antes de que termine su predecesora (conserva la
 * duración). Las tareas cerradas no se mueven. Devuelve { tareas, movidas: [{ id, titulo, de, a }] }.
 */
export function propagarDependencias(tareas, calendario = 'calendario') {
  const resultado = new Map(tareas.map(tarea => [String(tarea.id), { ...tarea }]));
  const movidas = [];
  ordenTopologico(tareas).forEach(original => {
    const tarea = resultado.get(String(original.id));
    if (!esFecha(tarea.inicio) || !esFecha(tarea.fin) || ESTADOS_CERRADOS_TAREA.includes(tarea.estado)) return;
    let inicioMinimo = null;
    dependenciasDe(tarea).forEach(({ id, desfase }) => {
      const predecesora = resultado.get(id);
      if (!predecesora || !esFecha(predecesora.fin)) return;
      const candidato = sumarDias(predecesora.fin, 1 + desfase, calendario);
      if (!inicioMinimo || candidato > inicioMinimo) inicioMinimo = candidato;
    });
    if (!inicioMinimo || tarea.inicio >= inicioMinimo) return;
    const nuevoInicio = ajustarAHabil(inicioMinimo, calendario);
    const dias = duracion(tarea.inicio, tarea.fin, calendario);
    const nuevoFin = tarea.tipo === 'hito' ? nuevoInicio : sumarDias(nuevoInicio, Math.max(dias, 1) - 1, calendario);
    movidas.push({ id: tarea.id, titulo: tarea.titulo, de: `${tarea.inicio} a ${tarea.fin}`, a: `${nuevoInicio} a ${nuevoFin}` });
    tarea.inicio = nuevoInicio;
    tarea.fin = nuevoFin;
  });
  return { tareas: tareas.map(tarea => resultado.get(String(tarea.id))), movidas };
}

/**
 * Ruta crítica (método del camino crítico) sobre las actividades e hitos con fechas. Holgura total en días
 * calendario = último inicio permitido − inicio vigente. Crítica: holgura ≤ 0. Devuelve Map id → holgura.
 */
export function holguras(tareas) {
  const contenedores = idsContenedores(tareas);
  const planificables = tareas.filter(tarea => esHoja(tarea, contenedores) && tarea.estado !== 'cancelada' && esFecha(tarea.inicio) && esFecha(tarea.fin));
  if (!planificables.length) return new Map();
  const finProyecto = planificables.reduce((maximo, tarea) => (tarea.fin > maximo ? tarea.fin : maximo), planificables[0].fin);
  const sucesoras = new Map(planificables.map(tarea => [String(tarea.id), []]));
  planificables.forEach(tarea => dependenciasDe(tarea).forEach(({ id, desfase }) => sucesoras.get(id)?.push({ tarea, desfase })));
  const ultimoFin = new Map();
  [...ordenTopologico(planificables)].reverse().forEach(tarea => {
    const posteriores = sucesoras.get(String(tarea.id)) || [];
    const limite = posteriores.length
      ? posteriores.map(({ tarea: sucesora, desfase }) => {
        const ultimoInicio = sumarDias(ultimoFin.get(String(sucesora.id)), -(diasEntre(sucesora.inicio, sucesora.fin)));
        return sumarDias(ultimoInicio, -1 - desfase);
      }).sort()[0]
      : finProyecto;
    ultimoFin.set(String(tarea.id), limite);
  });
  return new Map(planificables.map(tarea => [String(tarea.id), diasEntre(tarea.fin, ultimoFin.get(String(tarea.id)))]));
}

/** Instantánea de fechas aprobadas (la línea base nunca se edita: se agrega una versión nueva). */
export function crearLineaBase(tareas, { version, establecidaPor, fecha, motivo = '', idCambio = '' }) {
  const fechas = Object.fromEntries(tareas.filter(tarea => esFecha(tarea.inicio) && esFecha(tarea.fin) && tarea.estado !== 'cancelada')
    .map(tarea => [String(tarea.id), { inicio: tarea.inicio, fin: tarea.fin }]));
  return { version, establecidaPor, fecha, motivo, idCambio, tareas: fechas };
}

/** Por tarea: fechas de la línea base vigente, vigentes y reales, y atraso del fin en días. */
export function compararConLineaBase(tareas, lineaBase) {
  return tareas.map(tarea => {
    const base = lineaBase?.tareas?.[String(tarea.id)] || null;
    const finComparado = tarea.finReal || tarea.fin;
    return {
      id: tarea.id,
      titulo: tarea.titulo,
      base,
      vigente: esFecha(tarea.inicio) ? { inicio: tarea.inicio, fin: tarea.fin } : null,
      real: tarea.inicioReal || tarea.finReal ? { inicio: tarea.inicioReal || '', fin: tarea.finReal || '' } : null,
      atrasoDias: base && esFecha(finComparado) ? diasEntre(base.fin, finComparado) : null,
    };
  });
}

/** Avance que una actividad debería llevar hoy según sus fechas (días transcurridos ÷ duración), o null si faltan fechas. */
export function avanceEsperado(inicio, fin, hoy) {
  if (!esFecha(inicio) || !esFecha(fin) || !esFecha(hoy)) return null;
  if (hoy < inicio) return 0;
  if (hoy >= fin) return 100;
  return Math.round(((diasEntre(inicio, hoy) + 1) / (diasEntre(inicio, fin) + 1)) * 100);
}
