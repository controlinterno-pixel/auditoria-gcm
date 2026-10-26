// 🤖 Dictamen de IA por control: lo que es regla lo arma el código y la IA solo redacta.
// - planDelControl: plan de acción, recomendaciones e indicadores (KRIs) desde el cálculo exacto del
//   sistema (Tablas 6 y 8, numeral 9 del Manual E-GE-MAN-001). Prioridades fijas, sin depender de la IA.
// - revisarRespuestaIA / limpiarRespuestaIA: revisor automático de lo que la IA redactó (códigos que no
//   existen, cifras que no están en los datos, atribuciones falsas al manual, nombres internos).
import { incumpleCriterio } from './cumplimientoManual.js';
import { etiquetaI, etiquetaP, numero } from './explicacionRiesgoDetallada.js';

const ACCION_FALTA = {
  Documentación: codigo => ({
    accion: `Documentar ${codigo} en el procedimiento del proceso.`,
    motivo: `${codigo} no está documentado: si cambia quien lo ejecuta, nada garantiza que se siga haciendo.`,
  }),
  Frecuencia: codigo => ({
    accion: `Definir una frecuencia continua para ${codigo}: aplicarlo cada vez que se realiza la actividad con riesgo.`,
    motivo: `${codigo} se aplica de forma aleatoria: las veces que no se aplica, el riesgo queda sin cubrir.`,
  }),
  Evidencia: codigo => ({
    accion: `Definir el registro que deja ${codigo} en cada ejecución, como evidencia para auditoría.`,
    motivo: `${codigo} no deja registro: no hay forma de demostrar que se ejecuta.`,
  }),
};

const sinResponsable = valor => !valor || /^(sin asignar|sin dato|por asignar)$/i.test(String(valor).trim());

// Describe el efecto de una acción simulada: qué eje cambia, a cuánto y a qué zona lleva el riesgo.
function efecto(opcion, actual) {
  const partes = [];
  if (Math.round(opcion.p * 10) !== Math.round(actual.probabilidad * 10)) partes.push(`la probabilidad a ${numero(opcion.p)} % (${etiquetaP(opcion.p)})`);
  if (Math.round(opcion.i * 10) !== Math.round(actual.impacto * 10)) partes.push(`el impacto a ${numero(opcion.i)} % (${etiquetaI(opcion.i)})`);
  return `${partes.length ? `bajaría ${partes.join(' y ')} y ` : ''}llevaría el riesgo de zona ${actual.zona} a zona ${opcion.zona}`;
}

// "Agregar 1 control correctivo manual" → "… a RSK-49"; "Automatizar CTL-49-1" queda igual.
const conRiesgo = (accion, codigoRiesgo) => (/^Agregar/.test(accion) ? `${accion} a ${codigoRiesgo}` : accion);
const enMinuscula = texto => texto.replace(/^./, letra => letra.toLowerCase());

/**
 * Plan del control auditado, con prioridades fijas:
 *   ALTA  = control reprobado en campo · plan de acción obligatorio (numeral 9, Extremo/Alto) ·
 *           primera acción que cambia la zona si el riesgo está en Extremo o Alto.
 *   MEDIA = acción que cambia la zona en Moderado · primera prueba de campo · formalización del control ·
 *           responsable · seguimiento obligatorio en Moderado/Bajo (numeral 9; nunca BAJA).
 *   BAJA  = automatizar el control cuando no cambia la zona.
 * Devuelve { planAccion, recomendaciones, kris } con cifras tomadas solo de la simulación.
 */
export function planDelControl({ riesgo, simulacion: s, control, ficha, evaluaciones = [] }) {
  if (!s) return { planAccion: [], recomendaciones: [], kris: '' };
  const codigoRiesgo = ficha?.codigo || `RSK-${riesgo?.id}`;
  const respControl = sinResponsable(control?.responsable) ? (control?.responsableSegunManual || 'Por asignar') : control.responsable;
  const respRiesgo = sinResponsable(ficha?.responsable) ? (control?.responsableSegunManual || respControl) : ficha.responsable;
  const zonaAlta = ['Extremo', 'Alto'].includes(s.actual.zona);
  const items = [];
  const agregar = (prioridad, accion, motivo, responsable) => items.push({ prioridad, accion, motivo, responsable });

  // ALTA: falla demostrada en campo.
  if (s.prueba && s.prueba.calificacion < 100) {
    agregar('ALTA', `Corregir la falla de operación de ${s.codigo} detectada en Trabajo de Campo y volver a probarlo para confirmar que opera.`,
      `${s.codigo} fue reprobado en Trabajo de Campo con ${s.prueba.calificacion} %${s.prueba.comentarios ? ` («${s.prueba.comentarios}»)` : ''}: sigue contando en el cálculo, pero su mitigación no está demostrada; si no opera, la ${s.eje} quedaría en ${numero(s.siFalla.valor)} % (zona ${s.siFalla.zona}).`,
      respControl);
  }
  // ALTA: obligación del numeral 9 en Extremo o Alto.
  if (incumpleCriterio(riesgo, 'sin-plan', evaluaciones)) {
    agregar('ALTA', `Formular y registrar el plan de acción de ${codigoRiesgo}.`,
      `${codigoRiesgo} está en zona residual Extremo o Alto y no tiene plan de acción registrado: el numeral 9 del manual lo exige.`,
      respRiesgo);
  }
  // Acción que cambia la zona: automatizar este control si basta; si no, la primera de un paso; si no, dos pasos.
  const automatizarCambia = s.automatizado && s.automatizado.zona !== s.actual.zona;
  const primera = s.cambianLaZona.find(o => o.accion === `Automatizar ${s.codigo}`) || s.cambianLaZona[0] || null;
  const combinada = !primera && s.dosPasos.length ? s.dosPasos[0] : null;
  const prioridadZona = zonaAlta ? 'ALTA' : 'MEDIA';
  if (s.actual.zona !== 'Bajo') {
    if (primera) {
      agregar(prioridadZona, `${conRiesgo(primera.accion, codigoRiesgo)}.`,
        `Según la simulación del sistema (Tabla 8), esta acción ${efecto(primera, s.actual)}.`,
        primera.accion.startsWith('Automatizar') ? respControl : respRiesgo);
    } else if (combinada) {
      agregar(prioridadZona, `${combinada.accion.replace(/^./, l => l.toUpperCase())} en ${codigoRiesgo}.`,
        `Ninguna acción de un solo paso cambia la zona; esta combinación ${efecto(combinada, s.actual)}.`,
        respRiesgo);
    }
  }
  // MEDIA: primera prueba de campo, formalización y responsable de ESTE control.
  if (!s.prueba) {
    agregar('MEDIA', `Programar la primera prueba de Trabajo de Campo de ${s.codigo}.`,
      `${s.codigo} aún no tiene pruebas de Trabajo de Campo: no es una falla, pero falta confirmar que opera como está diseñado.`,
      respControl);
  }
  s.faltas.forEach(atributo => {
    const { accion, motivo } = ACCION_FALTA[atributo](s.codigo);
    agregar('MEDIA', accion, `${motivo} No cambia su eficacia (Tabla 6), pero lo formaliza.`, respControl);
  });
  if (sinResponsable(control?.responsable)) {
    agregar('MEDIA', `Asignar un responsable a ${s.codigo}.`,
      `${s.codigo} no tiene responsable en la matriz; según el numeral 8.3.2 del manual le corresponde al líder del proceso.`,
      control?.responsableSegunManual || 'Por asignar');
  }
  // MEDIA: seguimiento obligatorio en Moderado o Bajo (nunca BAJA).
  if (incumpleCriterio(riesgo, 'sin-seguimiento', evaluaciones)) {
    agregar('MEDIA', `Programar la fecha de seguimiento de ${codigoRiesgo}.`,
      `${codigoRiesgo} está en zona residual Moderado o Bajo sin fecha de seguimiento: el numeral 9 del manual exige seguimiento.`,
      respRiesgo);
  }
  // BAJA: automatizar cuando no cambia la zona (y no salió ya como acción que la cambia).
  if (s.automatizado && !automatizarCambia && !(primera && primera.accion === `Automatizar ${s.codigo}`)) {
    agregar('BAJA', `Evaluar automatizar ${s.codigo}.`,
      `Subiría su eficacia de ${s.eficacia} % a ${s.eficacia + 10} % (Tabla 6) y la ${s.eje} a ${numero(s.automatizado.valor)} %, sin cambiar la zona ${s.actual.zona}.`,
      respControl);
  }

  const orden = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  const plan = items.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);

  // KRIs: valor actual y meta tomados de la simulación; si no hay meta calculada, el indicador no va.
  const kris = [];
  const meta = primera || combinada;
  if (meta) {
    const eje = Math.round(meta.i * 10) !== Math.round(s.actual.impacto * 10) ? 'impacto' : 'probabilidad';
    const actualEje = eje === 'impacto' ? s.actual.impacto : s.actual.probabilidad;
    const metaEje = eje === 'impacto' ? meta.i : meta.p;
    kris.push(`${eje === 'impacto' ? 'Impacto' : 'Probabilidad'} residual de ${codigoRiesgo}: actual ${numero(actualEje)} % · meta ${numero(metaEje)} % (zona ${meta.zona}) si se ejecuta: ${enMinuscula(meta.accion)}.`);
  }
  if (s.automatizado) {
    kris.push(`Eficacia de ${s.codigo}: actual ${s.eficacia} % · meta ${s.eficacia + 10} % si se automatiza (máximo de su tipo: ${s.eficaciaMaxima} %).`);
  }
  if (s.prueba && s.prueba.calificacion < 100) {
    kris.push(`Calificación de ${s.codigo} en Trabajo de Campo: actual ${s.prueba.calificacion} % · meta 100 % en la siguiente prueba.`);
  }

  return {
    planAccion: plan.map(({ prioridad, accion, responsable }) => ({ prioridad, accion, responsable })),
    recomendaciones: plan.map(({ accion, motivo }) => `${accion.replace(/\.$/, '')} — ${motivo}`),
    kris: kris.join('\n'),
  };
}

// ---------------------------------------------------------------------------------------------
// Revisor automático de la respuesta de la IA
// ---------------------------------------------------------------------------------------------
const NOMBRES_INTERNOS = /\b(analisisSistema|analisisDelControl|DATOS_GRC|controlAuditado|metricas|pruebasTrabajoDeCampo|accionesQueCambianLaZona|combinacionesDeDosPasos|controlesDelRiesgoPorTipo|faltasDeFormalizacion|responsableSegunManual|planDelSistema)\b/;
const ESCALA_DEL_MANUAL = /(escala|categor[ií]a|calificaci[oó]n)[^.]{0,60}(del|seg[uú]n el)\s+manual|(excelente|bueno|moderado|malo)[^.]{0,40}(seg[uú]n|del)\s+(el\s+)?manual/i;
const AUSENCIA_PRUEBAS = /(corregir|subsanar|falla)[^.]{0,40}ausencia de pruebas/i;
// Cifras que el manual o la Tabla 6 usan siempre (pesos, máximos, niveles de 20 %) y no salen de los datos.
const CIFRAS_FIJAS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 80, 100];

const numerosDe = valor => new Set((JSON.stringify(valor ?? '').match(/\d+(?:[.,]\d+)?/g) || [])
  .map(n => Number(n.replace(',', '.'))));

/** Problemas de un texto de la IA: [{ tipo, detalle }]. */
export function revisarTextoIA(texto, { codigosValidos = [], numerosValidos = new Set() } = {}) {
  const problemas = [];
  const contenido = String(texto || '');
  const validos = new Set(codigosValidos.map(c => c.toUpperCase()));
  (contenido.match(/\b(?:RSK|CTL)-\d+(?:-\d+)?\b/gi) || []).forEach(codigo => {
    if (!validos.has(codigo.toUpperCase())) problemas.push({ tipo: 'codigo-inexistente', detalle: codigo });
  });
  (contenido.match(/\d+(?:[.,]\d+)?\s?%/g) || []).forEach(cifra => {
    const valor = Number(cifra.replace(/\s?%/, '').replace(',', '.'));
    if (!numerosValidos.has(valor) && !CIFRAS_FIJAS.includes(valor)) problemas.push({ tipo: 'cifra-sin-respaldo', detalle: cifra });
  });
  if (ESCALA_DEL_MANUAL.test(contenido)) problemas.push({ tipo: 'escala-atribuida-al-manual', detalle: 'La escala de eficacia promedio es interna de la app, no del manual.' });
  if (AUSENCIA_PRUEBAS.test(contenido)) problemas.push({ tipo: 'ausencia-de-pruebas-como-falla', detalle: 'No tener pruebas de Trabajo de Campo no es una falla.' });
  const interno = NOMBRES_INTERNOS.exec(contenido);
  if (interno) problemas.push({ tipo: 'nombre-interno', detalle: interno[0] });
  return problemas;
}

const CAMPOS_TEXTO = ['analisisEjecutivo', 'dictamenDirector', 'observacionCausaRaiz', 'iso31000', 'cosoErm'];

/** Revisa todos los campos redactados por la IA. Devuelve la lista de problemas (vacía si está bien). */
export function revisarRespuestaIA(respuesta, { datos, codigosValidos }) {
  const numerosValidos = numerosDe(datos);
  return CAMPOS_TEXTO.flatMap(campo => revisarTextoIA(respuesta?.[campo], { codigosValidos, numerosValidos })
    .map(problema => ({ ...problema, campo })));
}

/** Quita de cada campo las oraciones con problemas (último recurso si el reintento también falla). */
export function limpiarRespuestaIA(respuesta, { datos, codigosValidos }) {
  const numerosValidos = numerosDe(datos);
  const limpia = { ...respuesta };
  CAMPOS_TEXTO.forEach(campo => {
    if (typeof limpia[campo] !== 'string') return;
    limpia[campo] = limpia[campo].split(/\n\n/).map(parrafo => (parrafo.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [])
      .filter(oracion => revisarTextoIA(oracion, { codigosValidos, numerosValidos }).length === 0)
      .join('').trim()).filter(Boolean).join('\n\n');
  });
  return limpia;
}

/** Interpreta la respuesta JSON de la IA (con o sin ```json). Devuelve null si no se pudo leer. */
export function leerJsonIA(respuesta) {
  if (respuesta && typeof respuesta === 'object') return respuesta;
  try {
    let texto = String(respuesta || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}');
    if (inicio >= 0 && fin > inicio) texto = texto.slice(inicio, fin + 1);
    const datos = JSON.parse(texto);
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : null;
  } catch {
    return null;
  }
}

const QUE_CORREGIR = {
  'codigo-inexistente': 'cita un código que no existe en los datos',
  'cifra-sin-respaldo': 'trae una cifra que no está en los datos',
  'escala-atribuida-al-manual': 'atribuye al manual la escala de eficacia promedio, que es interna de la app',
  'ausencia-de-pruebas-como-falla': 'presenta la falta de pruebas de Trabajo de Campo como una falla',
  'nombre-interno': 'usa un nombre interno de los datos en lugar de explicarlo con palabras',
};

/**
 * Pide a la IA solo la redacción, la revisa y, si tiene errores, la pide una vez más indicándolos;
 * si siguen, quita las oraciones con error. El plan, las recomendaciones y los KRIs vienen de `plan`.
 * `consultar({ instruccion, datos })` devuelve la respuesta cruda de la IA. `respaldo` es el texto del
 * sistema que se muestra si la IA no entrega un análisis utilizable.
 */
export async function generarDictamenControl({ consultar, instruccion, datos, codigosValidos, plan, respaldo }) {
  const revisar = respuesta => (respuesta ? revisarRespuestaIA(respuesta, { datos, codigosValidos }) : [{ tipo: 'formato' }]);
  let respuesta = leerJsonIA(await consultar({ instruccion, datos }));
  let problemas = revisar(respuesta);
  let intentos = 1;
  if (problemas.length) {
    const correccion = respuesta
      ? `\n\nTu respuesta anterior tenía estos errores; corrígelos sin cambiar lo que estaba bien:\n${problemas
        .map(p => `- En "${p.campo}" ${QUE_CORREGIR[p.tipo] || 'hay un error'}: ${p.detalle}`).join('\n')}`
      : '\n\nTu respuesta anterior no era un objeto JSON válido: responde solo con el JSON pedido.';
    const segunda = leerJsonIA(await consultar({ instruccion: `${instruccion}${correccion}`, datos }));
    intentos = 2;
    if (segunda) {
      respuesta = segunda;
      problemas = revisar(segunda);
    }
  }
  const final = respuesta ? (problemas.length ? limpiarRespuestaIA(respuesta, { datos, codigosValidos }) : respuesta) : {};
  const texto = valor => (typeof valor === 'string' ? valor.trim() : '');
  const analisis = texto(final.analisisEjecutivo) || respaldo;
  return {
    analisisEjecutivo: [analisis, texto(final.observacionCausaRaiz) && `Causa raíz: ${texto(final.observacionCausaRaiz)}`].filter(Boolean).join('\n\n'),
    dictamenDirector: texto(final.dictamenDirector),
    iso31000: texto(final.iso31000),
    cosoErm: texto(final.cosoErm),
    recomendaciones: plan.recomendaciones,
    planAccion: plan.planAccion,
    kris: plan.kris,
    revision: { intentos, oracionesQuitadas: respuesta ? problemas.length : 0 },
  };
}
