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
    recomendacion: `Documentar ${codigo} en el procedimiento del proceso, porque sin documentar, si cambia quien lo ejecuta, nada garantiza que se siga haciendo`,
  }),
  Frecuencia: codigo => ({
    accion: `Definir una frecuencia continua para ${codigo}: aplicarlo cada vez que se realiza la actividad con riesgo.`,
    recomendacion: `Pasar ${codigo} de frecuencia aleatoria a continua, porque las veces que no se aplica el riesgo queda sin cubrir`,
  }),
  Evidencia: codigo => ({
    accion: `Definir el registro que deja ${codigo} en cada ejecución, como evidencia para auditoría.`,
    recomendacion: `Hacer que ${codigo} deje registro en cada ejecución, porque hoy no hay forma de demostrar que se ejecuta`,
  }),
};

const ORDEN_ZONA = { Bajo: 1, Moderado: 2, Alto: 3, Extremo: 4 };

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
export function planDelControl({ riesgo, simulacion: s, control, ficha, evaluaciones = [], planes = [] }) {
  if (!s) return { planAccion: [], recomendaciones: [], kris: '' };
  const codigoRiesgo = ficha?.codigo || `RSK-${riesgo?.id}`;
  const respControl = sinResponsable(control?.responsable) ? (control?.responsableSegunManual || 'Por asignar') : control.responsable;
  const respRiesgo = sinResponsable(ficha?.responsable) ? (control?.responsableSegunManual || respControl) : ficha.responsable;
  const zonaAlta = ['Extremo', 'Alto'].includes(s.actual.zona);
  const items = [];
  // Zona residual registrada en la matriz (la que evalúa el numeral 9), dicha con su nombre.
  const zonaRegistrada = ficha?.nivelResidual && ficha.nivelResidual !== 'Sin dato' ? ficha.nivelResidual : s.actual.zona;
  // accion: la tarea de la tabla · recomendacion: la misma idea con su porqué (sin repetir la tabla).
  const agregar = (prioridad, accion, recomendacion, responsable) => items.push({ prioridad, accion, recomendacion, responsable });

  // ALTA: falla demostrada en campo.
  if (s.prueba && s.prueba.calificacion < 100) {
    agregar('ALTA', `Corregir la falla de operación de ${s.codigo} detectada en Trabajo de Campo y volver a probarlo para confirmar que opera.`,
      `Corregir la operación de ${s.codigo}, porque fue reprobado en Trabajo de Campo con ${s.prueba.calificacion} %${s.prueba.comentarios ? ` («${s.prueba.comentarios}»)` : ''}: sigue contando en el cálculo, pero su mitigación no está demostrada; si no opera, la ${s.eje} quedaría en ${numero(s.siFalla.valor)} % (zona ${s.siFalla.zona})`,
      respControl);
  }
  // ALTA: obligación del numeral 9 en Extremo o Alto.
  if (incumpleCriterio(riesgo, 'sin-plan', evaluaciones, planes)) {
    agregar('ALTA', `Formular y registrar el plan de acción de ${codigoRiesgo}.`,
      `Formular el plan de acción de ${codigoRiesgo}, porque está en zona residual ${zonaRegistrada} sin plan registrado y el numeral 9 del manual lo exige`,
      respRiesgo);
  }
  // Acción que cambia la zona: automatizar este control si basta; si no, la primera de un paso; si no, dos pasos.
  const automatizarCambia = s.automatizado && s.automatizado.zona !== s.actual.zona;
  // Automatizar este control si basta; si no, la que deja la zona más baja (la misma que propone el
  // dictamen del riesgo, para que ambos paneles coincidan).
  const primera = s.cambianLaZona.find(o => o.accion === `Automatizar ${s.codigo}`)
    || [...s.cambianLaZona].sort((a, b) => ORDEN_ZONA[a.zona] - ORDEN_ZONA[b.zona])[0] || null;
  const combinada = !primera && s.dosPasos.length ? s.dosPasos[0] : null;
  const prioridadZona = zonaAlta ? 'ALTA' : 'MEDIA';
  if (s.actual.zona !== 'Bajo') {
    if (primera) {
      agregar(prioridadZona, `${conRiesgo(primera.accion, codigoRiesgo)}.`,
        `${conRiesgo(primera.accion, codigoRiesgo)}, porque según la simulación del sistema (Tabla 8) ${efecto(primera, s.actual)}`,
        primera.accion.startsWith('Automatizar') ? respControl : respRiesgo);
    } else if (combinada) {
      agregar(prioridadZona, `${combinada.accion.replace(/^./, l => l.toUpperCase())} en ${codigoRiesgo}.`,
        `${combinada.accion.replace(/^./, l => l.toUpperCase())} en ${codigoRiesgo}, porque ninguna acción de un solo paso cambia la zona y esta combinación ${efecto(combinada, s.actual)}`,
        respRiesgo);
    }
  }
  // MEDIA: primera prueba de campo, formalización y responsable de ESTE control.
  if (!s.prueba) {
    agregar('MEDIA', `Programar la primera prueba de Trabajo de Campo de ${s.codigo}.`,
      `Probar ${s.codigo} en Trabajo de Campo, porque aún no tiene pruebas: no es una falla, pero falta confirmar que opera como está diseñado`,
      respControl);
  }
  s.faltas.forEach(atributo => {
    const { accion, recomendacion } = ACCION_FALTA[atributo](s.codigo);
    agregar('MEDIA', accion, `${recomendacion} (no cambia su eficacia según la Tabla 6, pero lo formaliza)`, respControl);
  });
  if (sinResponsable(control?.responsable)) {
    agregar('MEDIA', `Asignar un responsable a ${s.codigo}.`,
      `Nombrar un responsable para ${s.codigo}, porque no tiene uno en la matriz; según el numeral 8.3.2 del manual le corresponde al líder del proceso`,
      control?.responsableSegunManual || 'Por asignar');
  }
  // MEDIA: seguimiento obligatorio en Moderado o Bajo (nunca BAJA).
  if (incumpleCriterio(riesgo, 'sin-seguimiento', evaluaciones, planes)) {
    agregar('MEDIA', `Programar la fecha de seguimiento de ${codigoRiesgo}.`,
      `Programar el seguimiento de ${codigoRiesgo}, porque está en zona residual ${zonaRegistrada} sin fecha y el numeral 9 del manual exige seguimiento`,
      respRiesgo);
  }
  // BAJA: automatizar cuando no cambia la zona (y no salió ya como acción que la cambia).
  if (s.automatizado && !automatizarCambia && !(primera && primera.accion === `Automatizar ${s.codigo}`)) {
    agregar('BAJA', `Evaluar automatizar ${s.codigo}.`,
      `Evaluar automatizar ${s.codigo}: subiría su eficacia de ${s.eficacia} % a ${s.eficacia + 10} % (Tabla 6) y la ${s.eje} a ${numero(s.automatizado.valor)} %, aunque el riesgo seguiría en zona ${s.actual.zona}`,
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
    recomendaciones: plan.map(({ recomendacion }) => `${recomendacion}.`),
    kris: kris.join('\n'),
  };
}

// ---------------------------------------------------------------------------------------------
// Plan del dictamen de un riesgo (botón "Dictamen IA" de la fila)
// ---------------------------------------------------------------------------------------------
const listaCodigos = codigos => (codigos.length > 1 ? `${codigos.slice(0, -1).join(', ')} y ${codigos[codigos.length - 1]}` : codigos[0] || '');
const mitigacion = (inh, p, i) => (inh.probabilidad * inh.impacto
  ? Math.max(0, Math.round(((inh.probabilidad * inh.impacto - p * i) / (inh.probabilidad * inh.impacto)) * 100))
  : 0);
const sinResponsableRiesgo = valor => sinResponsable(valor) || valor === 'Sin dato';

/**
 * Mismas prioridades que el plan del control, aplicadas al riesgo completo (Explícame este riesgo):
 * ALTA = controles reprobados en campo, plan obligatorio del numeral 9 y la primera acción que cambia la
 * zona en Extremo/Alto; MEDIA = esa acción en Moderado, seguimiento (numeral 9), primera prueba de campo,
 * formalización y responsable; BAJA = automatizar cuando no cambia la zona.
 */
export function planDelRiesgo({ riesgo, simulacion: s, ficha, controles = [], evaluaciones = [], planes = [] }) {
  if (!s) return { planAccion: [], recomendaciones: [], kris: '' };
  const codigoRiesgo = ficha?.codigo || `RSK-${riesgo?.id}`;
  const lider = controles.find(c => c.responsableSegunManual)?.responsableSegunManual || 'Por asignar';
  const resp = sinResponsableRiesgo(ficha?.responsable) ? lider : ficha.responsable;
  const zonaRegistrada = ficha?.nivelResidual && ficha.nivelResidual !== 'Sin dato' ? ficha.nivelResidual : s.actual.zona;
  const zonaAlta = ['Extremo', 'Alto'].includes(s.actual.zona);
  const items = [];
  const agregar = (prioridad, accion, recomendacion) => items.push({ prioridad, accion, recomendacion, responsable: resp });

  s.reprobados.forEach(r => agregar('ALTA', `Corregir la operación de ${r.codigo} y volver a probarlo en Trabajo de Campo.`,
    `Corregir ${r.codigo}, porque fue reprobado en Trabajo de Campo con ${r.calificacion} %${r.comentarios ? ` («${r.comentarios}»)` : ''}; si no opera, el ${r.eje} quedaría en ${numero(r.sinElControl)} % (zona ${r.zonaSinElControl})`));
  if (incumpleCriterio(riesgo, 'sin-plan', evaluaciones, planes)) {
    agregar('ALTA', `Formular y registrar el plan de acción de ${codigoRiesgo}.`,
      `Formular el plan de acción de ${codigoRiesgo}, porque está en zona residual ${zonaRegistrada} sin plan registrado y el numeral 9 del manual lo exige`);
  }
  const primera = s.bajanZona[0] || null;
  if (primera && s.actual.zona !== 'Bajo') {
    const accion = primera.accion.startsWith('automatizar')
      ? primera.accion.replace(/^./, letra => letra.toUpperCase())
      : `Agregar ${primera.accion} a ${codigoRiesgo}`;
    agregar(zonaAlta ? 'ALTA' : 'MEDIA', `${accion}.`, `${accion}, porque según la simulación del sistema (Tabla 8) ${efecto(primera, s.actual)}`);
  }
  if (incumpleCriterio(riesgo, 'sin-seguimiento', evaluaciones, planes)) {
    agregar('MEDIA', `Programar la fecha de seguimiento de ${codigoRiesgo}.`,
      `Programar el seguimiento de ${codigoRiesgo}, porque está en zona residual ${zonaRegistrada} sin fecha y el numeral 9 del manual exige seguimiento`);
  } else if (zonaAlta && !s.fecha) {
    agregar('MEDIA', `Programar la fecha de seguimiento del plan de acción de ${codigoRiesgo}.`,
      `Programar cuándo se revisa el avance del plan de ${codigoRiesgo}, porque no tiene fecha de seguimiento`);
  }
  if (s.vencido) {
    agregar('MEDIA', `Hacer el seguimiento de ${codigoRiesgo} programado para el ${s.fecha}.`,
      `Hacer el seguimiento de ${codigoRiesgo}, porque el programado para el ${s.fecha} ya venció`);
  }
  if (s.sinPruebaDeCampo.length) {
    const uno = s.sinPruebaDeCampo.length === 1;
    agregar('MEDIA', `Programar la primera prueba de Trabajo de Campo de ${listaCodigos(s.sinPruebaDeCampo)}.`,
      `Probar en campo ${listaCodigos(s.sinPruebaDeCampo)}, porque aún no ${uno ? 'tiene' : 'tienen'} pruebas: no es una falla, pero falta confirmar que ${uno ? 'opera' : 'operan'} como se diseñó`);
  }
  s.faltantesPorControl.forEach(({ codigo, faltantes }) => agregar('MEDIA', `Formalizar ${codigo}: ${faltantes.join(', ').toLowerCase()}.`,
    `Formalizar ${codigo} (${faltantes.join(', ').toLowerCase()}), porque el manual lo pide para considerarlo formalizado, aunque no cambia su eficacia (Tabla 6)`));
  if (sinResponsableRiesgo(ficha?.responsable)) {
    agregar('MEDIA', `Asignar un responsable a ${codigoRiesgo}.`,
      `Nombrar un responsable para ${codigoRiesgo}, porque no tiene uno en la matriz; según el numeral 8.3.2 del manual le corresponde al líder del proceso`);
  }
  const auto = s.automatizarManuales;
  if (auto && !(primera && primera.accion.startsWith('automatizar')) && auto.zona === s.actual.zona) {
    agregar('BAJA', `Evaluar automatizar ${listaCodigos(s.manuales)}.`,
      `Evaluar automatizar ${listaCodigos(s.manuales)}: dejaría la probabilidad en ${numero(auto.p)} % y el impacto en ${numero(auto.i)} %, aunque el riesgo seguiría en zona ${s.actual.zona}`);
  }

  const orden = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  const plan = items.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);

  const kris = [];
  if (primera) {
    const ejeImpacto = Math.round(primera.i * 10) !== Math.round(s.actual.impacto * 10);
    const accionMeta = primera.accion.startsWith('automatizar') ? primera.accion : `agregar ${primera.accion}`;
    kris.push(`${ejeImpacto ? 'Impacto' : 'Probabilidad'} residual de ${codigoRiesgo}: actual ${numero(ejeImpacto ? s.actual.impacto : s.actual.probabilidad)} % · meta ${numero(ejeImpacto ? primera.i : primera.p)} % (zona ${primera.zona}) si se ejecuta: ${accionMeta}.`);
    const actualMit = mitigacion(s.inherente, s.actual.probabilidad, s.actual.impacto);
    const metaMit = mitigacion(s.inherente, primera.p, primera.i);
    if (metaMit > actualMit) kris.push(`Mitigación de ${codigoRiesgo}: actual ${actualMit} % · meta ${metaMit} % con la misma acción.`);
  }
  if (s.reprobados.length) kris.push(`Controles de ${codigoRiesgo} reprobados en Trabajo de Campo: actual ${s.reprobados.length} · meta 0 en la siguiente prueba.`);
  const totalControles = controles.length;
  if (totalControles && s.faltantesPorControl.length) {
    kris.push(`Controles de ${codigoRiesgo} formalizados: actual ${totalControles - s.faltantesPorControl.length} de ${totalControles} · meta ${totalControles} de ${totalControles}.`);
  }
  return {
    planAccion: plan.map(({ prioridad, accion, responsable }) => ({ prioridad, accion, responsable })),
    recomendaciones: plan.map(({ recomendacion }) => `${recomendacion}.`),
    kris: kris.join('\n'),
  };
}

// ---------------------------------------------------------------------------------------------
// Plan del informe de la matriz (o de la vista filtrada)
// ---------------------------------------------------------------------------------------------
const esta = total => (total === 1 ? 'está' : 'están');
const conLista = (total, codigos = []) => `${total} riesgo${total === 1 ? '' : 's'}${codigos.length ? ` (${codigos.slice(0, 8).join(', ')}${total > 8 ? '…' : ''})` : ''}`;

/** Plan de la matriz desde contextoMatriz: incumplimientos del numeral 9 y vacíos de datos, con cifras exactas. */
export function planDeLaMatriz(datos) {
  const n9 = datos?.cumplimientoNumeral9 || {};
  const sinPlan = n9.extremoOAltoSinPlanDeAccion || { total: 0, riesgos: [] };
  const sinSeg = n9.moderadoOBajoSinFechaDeSeguimiento || { total: 0, riesgos: [] };
  const reprob = n9.conControlesReprobadosEnTrabajoDeCampo || { total: 0, riesgos: [] };
  const sinControles = datos?.riesgosSinControles || { total: 0, ejemplos: [] };
  const vencidos = datos?.seguimientosVencidos || { total: 0, ejemplos: [] };
  const sinDato = datos?.metricas?.riesgosSinDatoDeProbabilidadOImpacto || 0;
  const items = [];
  const agregar = (prioridad, accion, recomendacion) => items.push({ prioridad, accion, recomendacion, responsable: 'Líderes de los procesos' });
  if (sinPlan.total) {
    agregar('ALTA', `Registrar el plan de acción de ${conLista(sinPlan.total, sinPlan.riesgos)}.`,
      `Registrar el plan de acción de ${conLista(sinPlan.total, sinPlan.riesgos)}, porque ${esta(sinPlan.total)} en zona residual Extremo o Alto sin plan y el numeral 9 del manual lo exige`);
  }
  if (reprob.total) {
    agregar('ALTA', `Corregir y volver a probar los controles reprobados en Trabajo de Campo de ${conLista(reprob.total, reprob.riesgos)}.`,
      `Corregir los controles reprobados de ${conLista(reprob.total, reprob.riesgos)}, porque siguen contando en el residual sin que su mitigación esté demostrada`);
  }
  if (sinSeg.total) {
    agregar('MEDIA', `Programar la fecha de seguimiento de ${conLista(sinSeg.total, sinSeg.riesgos)}.`,
      `Programar el seguimiento de ${conLista(sinSeg.total, sinSeg.riesgos)}, porque ${esta(sinSeg.total)} en zona Moderado o Bajo sin fecha y el numeral 9 del manual exige seguimiento`);
  }
  if (vencidos.total) {
    agregar('MEDIA', `Hacer los seguimientos vencidos de ${conLista(vencidos.total, vencidos.ejemplos)}.`,
      `Hacer los seguimientos vencidos de ${conLista(vencidos.total, vencidos.ejemplos)}, porque ${vencidos.total === 1 ? 'su fecha programada ya pasó' : 'sus fechas programadas ya pasaron'}`);
  }
  if (sinControles.total) {
    agregar('MEDIA', `Definir controles para ${conLista(sinControles.total, sinControles.ejemplos)}.`,
      `Definir controles para ${conLista(sinControles.total, sinControles.ejemplos)}, porque hoy ${sinControles.total === 1 ? 'su residual es igual a su inherente' : 'su residual es igual a su inherente en cada uno'}`);
  }
  if (sinDato) {
    const plural = sinDato === 1 ? '' : 's';
    agregar('MEDIA', `Registrar la probabilidad y el impacto de ${sinDato} riesgo${plural} que figura${sinDato === 1 ? '' : 'n'} "Sin dato".`,
      `Completar la probabilidad (Tabla 2) y el impacto (Tabla 3) de ${sinDato} riesgo${plural}, porque sin ellos no se pueden calcular ni ubicar en la matriz`);
  }

  const total = datos?.metricas?.totalRiesgos || 0;
  const altos = (datos?.distribucionResidual?.Extremo || 0) + (datos?.distribucionResidual?.Alto || 0);
  const kris = [];
  if (altos) kris.push(`Riesgos Extremo o Alto con plan de acción: actual ${altos - sinPlan.total} de ${altos} · meta ${altos} de ${altos} (numeral 9).`);
  const bajos = total - altos - sinDato;
  if (bajos > 0 && sinSeg.total) kris.push(`Riesgos Moderado o Bajo con fecha de seguimiento: actual ${bajos - sinSeg.total} de ${bajos} · meta ${bajos} de ${bajos} (numeral 9).`);
  if (reprob.total) kris.push(`Riesgos con controles reprobados en Trabajo de Campo: actual ${reprob.total} · meta 0.`);
  return {
    planAccion: items.map(({ prioridad, accion, responsable }) => ({ prioridad, accion, responsable })),
    recomendaciones: items.map(({ recomendacion }) => `${recomendacion}.`),
    kris: kris.join('\n'),
  };
}

// ---------------------------------------------------------------------------------------------
// Revisor automático de la respuesta de la IA
// ---------------------------------------------------------------------------------------------
const NOMBRES_INTERNOS = /\b(analisisSistema|analisisDelControl|DATOS_GRC|controlAuditado|metricas|pruebasTrabajoDeCampo|accionesQueCambianLaZona|combinacionesDeDosPasos|controlesDelRiesgoPorTipo|faltasDeFormalizacion|responsableSegunManual|planDelSistema)\b/;
const ESCALA_DEL_MANUAL = /(escala|categor[ií]a|calificaci[oó]n)[^.]{0,60}(del|seg[uú]n el)\s+manual|(excelente|bueno|moderado|malo)[^.]{0,40}(seg[uú]n|del)\s+(el\s+)?manual/i;
const AUSENCIA_PRUEBAS = /(corregir|subsanar|falla)[^.]{0,40}ausencia de pruebas/i;
// Conceptos que la IA suele afirmar sin que estén en los datos: solo se aceptan si los datos los traen.
const CONCEPTOS_CON_RESPALDO = [
  { patron: /apetito/i, clave: 'apetito', detalle: 'menciona el apetito de riesgo, que no está definido en los datos' },
  { patron: /tolerancia (al|de) riesgo/i, clave: 'tolerancia', detalle: 'menciona la tolerancia al riesgo, que no está definida en los datos' },
];
// Cifras que el manual o la Tabla 6 usan siempre (pesos, máximos, niveles de 20 %) y no salen de los datos.
const CIFRAS_FIJAS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 80, 100];

const numerosDe = valor => new Set((JSON.stringify(valor ?? '').match(/\d+(?:[.,]\d+)?/g) || [])
  .map(n => Number(n.replace(',', '.'))));

/** Problemas de un texto de la IA: [{ tipo, detalle }]. */
export function revisarTextoIA(texto, { codigosValidos = [], numerosValidos = new Set(), textoDatos = '' } = {}) {
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
  CONCEPTOS_CON_RESPALDO.forEach(({ patron, clave, detalle }) => {
    if (patron.test(contenido) && !textoDatos.includes(clave)) problemas.push({ tipo: 'concepto-sin-respaldo', detalle });
  });
  const interno = NOMBRES_INTERNOS.exec(contenido);
  if (interno) problemas.push({ tipo: 'nombre-interno', detalle: interno[0] });
  return problemas;
}

const CAMPOS_TEXTO = ['analisisEjecutivo', 'dictamenDirector', 'observacionCausaRaiz', 'iso31000', 'cosoErm'];

/** Revisa todos los campos redactados por la IA. Devuelve la lista de problemas (vacía si está bien). */
const textoDe = datos => JSON.stringify(datos ?? '').toLowerCase();

export function revisarRespuestaIA(respuesta, { datos, codigosValidos }) {
  const numerosValidos = numerosDe(datos);
  const textoDatos = textoDe(datos);
  return CAMPOS_TEXTO.flatMap(campo => revisarTextoIA(respuesta?.[campo], { codigosValidos, numerosValidos, textoDatos })
    .map(problema => ({ ...problema, campo })));
}

/** Quita de cada campo las oraciones con problemas (último recurso si el reintento también falla). */
export function limpiarRespuestaIA(respuesta, { datos, codigosValidos }) {
  const numerosValidos = numerosDe(datos);
  const textoDatos = textoDe(datos);
  const limpia = { ...respuesta };
  CAMPOS_TEXTO.forEach(campo => {
    if (typeof limpia[campo] !== 'string') return;
    limpia[campo] = limpia[campo].split(/\n\n/).map(parrafo => (parrafo.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [])
      .filter(oracion => revisarTextoIA(oracion, { codigosValidos, numerosValidos, textoDatos }).length === 0)
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
  'concepto-sin-respaldo': 'afirma algo que no está en los datos',
  'nombre-interno': 'usa un nombre interno de los datos en lugar de explicarlo con palabras',
};

/**
 * Pide a la IA solo la redacción, la revisa y, si tiene errores, la pide una vez más indicándolos;
 * si siguen, quita las oraciones con error. El plan, las recomendaciones y los KRIs vienen de `plan`.
 * `consultar({ instruccion, datos })` devuelve la respuesta cruda de la IA. `respaldo` es el texto del
 * sistema que se muestra si la IA no entrega un análisis utilizable.
 */
export async function generarDictamenIA({ consultar, instruccion, datos, codigosValidos, plan, respaldo }) {
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

// Nombre anterior (dictamen por control).
export const generarDictamenControl = generarDictamenIA;
