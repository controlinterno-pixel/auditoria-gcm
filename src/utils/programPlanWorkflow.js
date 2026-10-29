export const ESTADO_EVALUACION_INICIAL = 'Pendiente Evaluación Auditor';
export const ESTADO_AJUSTES_INICIALES = 'Requiere Ajustes Auditor';
export const TIPO_EVALUACION_INICIAL = 'evaluacion-inicial-diseno';

// 👤 Revisor "No aplica": procesos de una sola persona. La acción registrada pasa directo a ejecución y, al 100 %,
// directo al auditor aprobador (sin los dos pasos del revisor). Exige explicar por qué.
export const MOTIVO_MINIMO_REVISOR_NO_APLICA = 10;
export const revisorNoAplica = plan => plan?.revisorNoAplica === true;
export const motivoRevisorNoAplicaValido = plan => !revisorNoAplica(plan) ||
  String(plan?.motivoRevisorNoAplica || '').trim().length >= MOTIVO_MINIMO_REVISOR_NO_APLICA;
/** Estado de una acción recién registrada. Los Programas de Auditoría siempre pasan por la evaluación del auditor. */
export const estadoInicialPlan = (esPrograma, plan) => (esPrograma
  ? ESTADO_EVALUACION_INICIAL
  : revisorNoAplica(plan) ? 'En Ejecución' : 'Pendiente Revisión Jefatura');
/** Estado al reportar el 100 %: validación del revisor o, sin revisor, aprobación del auditor. */
export const estadoAlCien = plan => (revisorNoAplica(plan) ? 'En Revisión (100%)' : 'Pendiente Validación Revisor');

const normalizar = valor => String(valor || '').trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function puedeEditarAsignacionPlan(plan, correoUsuario, esAdministrador) {
  if (!plan) return true;
  const correo = String(correoUsuario || '').trim().toLowerCase();
  const ejecutores = String(plan.correoResponsable || '').split(',').map(valor => valor.trim().toLowerCase()).filter(Boolean);
  return Boolean(esAdministrador && correo && !ejecutores.includes(correo));
}

const ESTADOS_EJECUCION_ENVIADA = ['Pendiente Validación Revisor', 'En Revisión (100%)', 'Pendiente Aprobación Auditor'];

// Ejecución reportada al 100%: el ejecutor ya no puede modificarla mientras sigue el flujo de revisión.
export function ejecucionEnviadaARevision(plan) {
  return Boolean(plan && Number(plan.progreso) === 100 && ESTADOS_EJECUCION_ENVIADA.includes(plan.estadoWorkflow));
}

// Cerrada con eficacia aprobada: ya no admite cambios del ejecutor.
export function accionCerrada(plan) {
  // "No aplica": acción cerrada porque el auditor aprobó que su hallazgo no aplica.
  return Boolean(plan && (plan.estadoWorkflow === 'Cerrado' || plan.estadoWorkflow === 'No aplica' || (!plan.estadoWorkflow && plan.estado === 'Cerrado')));
}

// El ejecutor solo trabaja lo que está en ejecución: lo enviado a revisión y lo cerrado queda bloqueado.
// Si el aprobador devuelve una acción, esa vuelve a "En Ejecución" y se desbloquea sin tocar las cerradas.
export function bloqueadaParaEjecutor(plan, correoUsuario) {
  const correo = normalizar(correoUsuario);
  const ejecutores = String(plan?.correoResponsable || '').split(',').map(normalizar).filter(Boolean);
  return Boolean(correo && ejecutores.includes(correo) && (ejecucionEnviadaARevision(plan) || accionCerrada(plan)));
}

const ESTADOS_POSTERIORES_A_APROBACION = ['En Ejecución', ...ESTADOS_EJECUCION_ENVIADA, 'Cerrado', 'No aplica'];

// Aprobado el diseño, solo el ejecutor trabaja la acción: revisor y auditor aprobador solo la consultan,
// aunque tengan rol administrador.
export function bloqueadaParaRevisorOAuditor(plan, correoUsuario, correoAuditorInforme = '') {
  const correo = normalizar(correoUsuario);
  if (!correo || !plan || !ESTADOS_POSTERIORES_A_APROBACION.includes(plan.estadoWorkflow)) return false;
  const lista = valor => String(valor || '').split(',').map(normalizar).filter(Boolean);
  if (lista(plan.correoResponsable).includes(correo)) return false;
  return lista(plan.correoRevisor).includes(correo) ||
    lista(plan.correoAuditor || correoAuditorInforme).includes(correo);
}

export function esInformePrograma(informe, fuentes = []) {
  const referencia = normalizar(informe?.tipoFuente);
  if (!referencia) return false;
  if (referencia === 'programa de auditoria') return true;
  const fuente = fuentes.find(item => [item.id, item.codigo].some(valor => (
    valor != null && normalizar(valor) === referencia
  )));
  return normalizar(fuente?.tipoFuente || fuente?.tipo) === 'programa de auditoria';
}

export function pendienteEvaluacionInicial(plan) {
  // "Pendiente Aprobación Auditor" es un estado antiguo: al 100 % es el cierre (evaluación de eficacia), no el diseño.
  if (plan?.estadoWorkflow === 'Pendiente Aprobación Auditor' && Number(plan?.progreso) >= 100) return false;
  return [
    ESTADO_EVALUACION_INICIAL, 'Pendiente Revisión Jefatura',
    'Pendiente Aprobación Auditor', 'Borrador',
  ].includes(plan?.estadoWorkflow);
}

// 🔁 Acción devuelta al ejecutor (diseño o evidencias rechazados): queda así hasta que el ejecutor la modifique.
const EVENTO_DEVOLUCION = /rechazad|devuelt|correcci[oó]n solicitada/i;
const ultimoEvento = plan => {
  const historial = Array.isArray(plan?.historialCambios) ? plan.historialCambios : [];
  return historial[historial.length - 1];
};
export function planDevueltoAlEjecutor(plan) {
  const estado = plan?.estadoWorkflow;
  const ultimoEsDevolucion = EVENTO_DEVOLUCION.test(String(ultimoEvento(plan)?.accion || ''));
  if (estado === ESTADO_AJUSTES_INICIALES) return true;
  if (estado === 'Borrador') return ultimoEsDevolucion || Boolean(String(plan?.motivoRechazo || '').trim());
  return estado === 'En Ejecución' && ultimoEsDevolucion;
}
export const motivoDevolucion = plan => String(ultimoEvento(plan)?.motivo || plan?.motivoRechazo || '').trim();

export function disenoInicialBloqueado(plan) {
  return pendienteEvaluacionInicial(plan) || plan?.estadoWorkflow === ESTADO_AJUSTES_INICIALES;
}

/**
 * Programas de Auditoría: el diseño ya pasó la evaluación inicial. Desde ahí ningún guardado (del ejecutor ni de un
 * administrador) lo devuelve a evaluar; la evaluación del diseño solo se repite tras un rechazo que el ejecutor corrige.
 */
export const disenoProgramaAprobado = plan => Boolean(plan) && !disenoInicialBloqueado(plan);

export function etapaAccionPrograma(plan) {
  // Devuelta al ejecutor ("Borrador" con motivo): le toca corregir, no está esperando al auditor.
  if (plan?.estadoWorkflow === 'Borrador' && planDevueltoAlEjecutor(plan)) return {
    clave: 'correccion', rol: 'ejecutor', titulo: 'Corrige el diseño de la acción',
    descripcion: `El diseño fue devuelto${motivoDevolucion(plan) ? ` (${motivoDevolucion(plan)})` : ''}. Guarda las correcciones para reenviarlo; todavía no puedes ejecutar.`,
    boton: 'Corregir matriz',
  };
  if (pendienteEvaluacionInicial(plan)) return {
    clave: 'evaluacion', rol: 'auditor', titulo: 'Evaluación inicial pendiente',
    descripcion: 'El auditor asignado debe evaluar la matriz. La ejecución sigue bloqueada hasta aprobar con 80% o más.',
    boton: 'Evaluar matriz',
  };
  if (plan?.estadoWorkflow === ESTADO_AJUSTES_INICIALES) return {
    clave: 'correccion', rol: 'ejecutor', titulo: 'Corrige el diseño de la acción',
    descripcion: 'La evaluación inicial no fue aprobada. Guarda las correcciones para reenviarlas al auditor; todavía no puedes ejecutar.',
    boton: 'Corregir matriz',
  };
  if (plan?.estadoWorkflow === 'En Ejecución' && planDevueltoAlEjecutor(plan)) return {
    clave: 'correccion-evidencias', rol: 'ejecutor', titulo: 'Corrige las evidencias de la acción',
    descripcion: `Las evidencias fueron devueltas${motivoDevolucion(plan) ? ` (${motivoDevolucion(plan)})` : ''}. Ajusta los soportes y guarda de nuevo al 100%: la acción vuelve al revisor.`,
    boton: 'Corregir evidencias',
  };
  if (plan?.estadoWorkflow === 'En Ejecución') return {
    clave: 'ejecucion', rol: 'ejecutor', titulo: 'Ejecución habilitada',
    descripcion: 'Registra el avance y las evidencias. Al guardar el 100%, la acción pasa al revisor; todavía no queda cerrada.',
    boton: 'Ejecutar acción',
  };
  if (plan?.estadoWorkflow === 'Pendiente Validación Revisor' && Number(plan.progreso) === 100) return {
    clave: 'revision', rol: 'revisor', titulo: 'Valida la ejecución al 100%',
    descripcion: 'Revisa las evidencias en la matriz. Tu aprobación remite las acciones pendientes de tu revisión al auditor asignado para el cierre final.',
    boton: 'Revisar matriz',
  };
  if (plan?.estadoWorkflow === 'En Revisión (100%)' && Number(plan.progreso) === 100) return {
    clave: 'cierre', rol: 'auditor', titulo: 'Acción lista para tu dictamen final',
    descripcion: 'El revisor aprobó la ejecución. Evalúa la eficacia y cierra esta acción individualmente, o devuélvela al ejecutor al 90% con un motivo.',
    boton: 'Evaluar y cerrar acción',
  };
  return null;
}

export function calcularPuntajeDiseno(criterios) {
  const pesos = { c1: 0.3, c2: 0.2, c3: 0.2, c4: 0.2, c5: 0.1 };
  if (!criterios || Object.keys(pesos).some(clave => (
    typeof criterios[clave] !== 'number' || !Number.isFinite(criterios[clave]) ||
    criterios[clave] < 0 || criterios[clave] > 100
  ))) throw new Error('Los cinco criterios deben ser números entre 0 y 100.');
  return Math.round(Object.entries(pesos).reduce((total, [clave, peso]) => total + criterios[clave] * peso, 0));
}

/**
 * Acciones devueltas al ejecutor (por el auditor en la evaluación inicial del diseño, por el revisor al revisar
 * el diseño o validar las evidencias, o por el aprobador final) y asignadas a su correo. Si hay alguna, el plan
 * solo le muestra esas para no confundirlo; las demás acciones del plan quedan ocultas y bloqueadas.
 */
export function accionesEnCorreccionInicial(planes, correo) {
  const usuario = String(correo || '').trim().toLowerCase();
  if (!usuario) return [];
  return (Array.isArray(planes) ? planes : []).filter(plan => planDevueltoAlEjecutor(plan)
    && String(plan?.correoResponsable || '').split(',').some(item => item.trim().toLowerCase() === usuario));
}

/**
 * A quién le toca la acción y qué debe hacer, para todas las etapas (programas de auditoría y demás planes).
 * La usan las alertas de la barra, el panel de pendientes y el asunto de los correos, para que digan lo mismo.
 * Devuelve { rol: 'ejecutor' | 'revisor' | 'auditor', tarea, verbo } o null si nadie tiene nada pendiente.
 */
export const TAREAS_PLAN = {
  ejecutar: { rol: 'ejecutor', verbo: 'Ejecutar acción' },
  'corregir-diseno': { rol: 'ejecutor', verbo: 'Corregir diseño' },
  'corregir-evidencias': { rol: 'ejecutor', verbo: 'Corregir evidencias' },
  'revisar-diseno': { rol: 'revisor', verbo: 'Revisar diseño' },
  'validar-evidencias': { rol: 'revisor', verbo: 'Validar evidencias' },
  'evaluar-diseno': { rol: 'auditor', verbo: 'Evaluar diseño' },
  'aprobar-cierre': { rol: 'auditor', verbo: 'Aprobar cierre' },
  'restaurar-estado': { rol: 'auditor', verbo: 'Restaurar acción' },
};

export function tareaPendientePlan(plan, { esPrograma = false } = {}) {
  const estado = plan?.estadoWorkflow;
  const alCien = Number(plan?.progreso) >= 100;
  const tarea = clave => ({ tarea: clave, ...TAREAS_PLAN[clave] });
  if (!plan || ['Cerrado', 'No aplica'].includes(estado) || plan.estado === 'Cerrado') return null;
  if (estado === ESTADO_AJUSTES_INICIALES) return tarea('corregir-diseno');
  // Devuelto (diseño por el revisor o evidencias por revisor/auditor): le toca al ejecutor corregir.
  if (estado === 'Borrador') return planDevueltoAlEjecutor(plan) || !esPrograma ? tarea('corregir-diseno') : tarea('evaluar-diseno');
  // Devuelta por error a la evaluación inicial estando al 100 %: se restaura, no se vuelve a evaluar el diseño.
  if (estado === ESTADO_EVALUACION_INICIAL) return reenvioErroneoAEvaluacion(plan) ? tarea('restaurar-estado') : tarea('evaluar-diseno');
  if (estado === 'Pendiente Revisión Jefatura') return esPrograma ? tarea('evaluar-diseno') : tarea('revisar-diseno');
  if (estado === 'Pendiente Aprobación Auditor') return alCien ? tarea('aprobar-cierre') : tarea('evaluar-diseno');
  if (estado === 'Pendiente Validación Revisor') return tarea('validar-evidencias');
  if (estado === 'En Revisión (100%)') return tarea('aprobar-cierre');
  if (estado === 'En Ejecución') {
    if (planDevueltoAlEjecutor(plan)) return tarea('corregir-evidencias');
    // Datos antiguos: al 100 % sin pasar a revisión, el auditor decide.
    if (alCien && !esPrograma) return tarea('aprobar-cierre');
    return tarea('ejecutar');
  }
  return null;
}

/** Formato de consecutivo lógico de una acción (`PLA-0001`, `PLA-0002`, ...). */
export const formatearConsecutivoPlan = numero => `PLA-${String(Math.max(1, Number(numero) || 1)).padStart(4, '0')}`;

/**
 * Asigna consecutivos lógicos únicos (`PLA-0001`, `PLA-0002`...) en orden de creación a las acciones que aún
 * no tengan un `ref` propio, respetando y sin repetir ningún `PLA-NNNN` ya asignado.
 */
export function asignarConsecutivosPlanes(planes = []) {
  if (!Array.isArray(planes) || planes.length === 0) return [];
  const ocupados = new Set();
  let mayorExistente = 0;
  planes.forEach(plan => {
    const coincidencia = /^PLA-(\d+)$/i.exec(String(plan?.ref || '').trim());
    if (coincidencia) {
      const numero = Number(coincidencia[1]);
      if (Number.isFinite(numero) && numero > 0) {
        ocupados.add(numero);
        if (numero > mayorExistente) mayorExistente = numero;
      }
    }
  });
  const sinRef = planes
    .map((plan, indice) => ({ plan, indice }))
    .filter(({ plan }) => plan && typeof plan === 'object' && !String(plan.ref || '').trim())
    .sort((a, b) => {
      const numA = Number(a.plan.id);
      const numB = Number(b.plan.id);
      if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
      return String(a.plan.id ?? '').localeCompare(String(b.plan.id ?? ''), 'es', { numeric: true }) || (a.indice - b.indice);
    });
  if (sinRef.length === 0) return planes;
  const refPorIndice = new Map();
  let siguiente = 1;
  sinRef.forEach(({ indice }) => {
    while (ocupados.has(siguiente)) siguiente += 1;
    ocupados.add(siguiente);
    refPorIndice.set(indice, formatearConsecutivoPlan(siguiente));
    siguiente += 1;
  });
  return planes.map((plan, indice) => (refPorIndice.has(indice) ? { ...plan, ref: refPorIndice.get(indice) } : plan));
}

/** Código visible de una acción: su consecutivo lógico (`ref`), o `PLA-XXXX` para acciones sueltas sin `ref`. */
export const codigoPlan = plan => {
  const ref = String(plan?.ref || '').trim();
  if (ref) return ref;
  const id = String(plan?.id ?? '').trim();
  if (!id || id.startsWith('new-')) return 'PLA-NUEVO';
  return `PLA-${id.slice(-4)}`;
};

/** Asunto de correo que dice la tarea: "Validar evidencias · PLA-0004". */
export const asuntoTareaPlan = (clave, plan) => `${TAREAS_PLAN[clave]?.verbo || 'Plan de acción'} · ${codigoPlan(plan)}`;

// Campos que no son de diseño: avance, soportes, riesgos vinculados y las casillas de matrices (vacío = "No aplica").
const CAMPOS_NO_DISENO = ['progreso', 'evidenciaUrl', 'riesgosVinculados'];
const CAMPOS_MATRIZ = ['matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal'];
// También "Guardar matriz" (evento "Actividad modificada en matriz"), que devolvía a evaluación acciones aprobadas.
const REENVIO_A_EVALUACION = /reenviado a revisi[oó]n|actividad modificada en matriz/i;

/**
 * Acción de programa que volvió a la evaluación inicial del diseño cuando su diseño ya estaba aprobado: el ejecutor,
 * al registrar avance o corregir evidencias, guardó un cambio de diseño (p. ej. añadió "Corregido" a la descripción),
 * el sistema tomó como cambio las casillas de matrices (de vacío a "No aplica") o un administrador guardó la matriz
 * (p. ej. cambió el ejecutor, PLA-0073). El diseño aprobado no se vuelve a evaluar, lo cambie quien lo cambie:
 * devuelve a dónde restaurarla ({ destino, motivo }) o null. Al 100 %: validación del revisor o, si ya la
 * había validado (o no hay revisor), la evaluación de eficacia; con menos avance, ejecución.
 */
export function reenvioErroneoAEvaluacion(plan) {
  if (plan?.estadoWorkflow !== ESTADO_EVALUACION_INICIAL) return null;
  const historial = Array.isArray(plan.historialCambios) ? plan.historialCambios : [];
  const indice = historial.map(evento => REENVIO_A_EVALUACION.test(String(evento?.accion || ''))).lastIndexOf(true);
  if (indice === -1) return null;
  const anteriores = historial.slice(0, indice).map(evento => String(evento?.accion || ''));
  // La última decisión sobre el diseño antes del reenvío fue aprobarlo (no un "Diseño no aprobado" que se corrigió).
  const ultimaDecision = [...anteriores].reverse().find(accion => /Diseño (no )?aprobado/i.test(accion));
  if (!ultimaDecision || /Diseño no aprobado/i.test(ultimaDecision)) return null;
  const detalle = Array.isArray(historial[indice].detalleCambios) ? historial[indice].detalleCambios : [];
  const soloSinDiseno = detalle.length > 0 && detalle.every(({ campo, antes, despues }) => (
    CAMPOS_NO_DISENO.includes(campo) || (CAMPOS_MATRIZ.includes(campo) && (antes || 'No aplica') === (despues || 'No aplica'))
  ));
  const ejecutores = String(plan.correoResponsable || '').split(',').map(normalizar).filter(Boolean);
  const loHizoElEjecutor = ejecutores.includes(normalizar(historial[indice].usuario));
  const guardadoMatriz = /actividad modificada en matriz/i.test(String(historial[indice].accion || ''));
  const ultimaValidacion = anteriores.map(accion => /validada por el revisor/i.test(accion)).lastIndexOf(true);
  const ultimaDevolucion = anteriores.map(accion => /devuelt|rechazad/i.test(accion)).lastIndexOf(true);
  const yaValidada = revisorNoAplica(plan) || (ultimaValidacion !== -1 && ultimaValidacion > ultimaDevolucion);
  return {
    destino: Number(plan.progreso) !== 100 ? 'En Ejecución' : yaValidada ? 'En Revisión (100%)' : 'Pendiente Validación Revisor',
    motivo: soloSinDiseno
      ? 'El sistema devolvió la acción a la evaluación inicial al guardar el avance (solo cambiaron las casillas de matrices de vacío a "No aplica"); el diseño ya estaba aprobado.'
      : guardadoMatriz
        ? 'Un guardado de la matriz devolvió la acción a la evaluación inicial; el diseño ya estaba aprobado y no se vuelve a evaluar.'
        : loHizoElEjecutor
          ? 'El ejecutor modificó el diseño mientras registraba la ejecución; el diseño ya estaba aprobado y no se vuelve a evaluar.'
          : 'Se modificó el diseño ya aprobado; el diseño aprobado no se vuelve a evaluar.',
  };
}

// Datos del diseño de una acción (lo que evalúa el auditor en programas o el revisor en las otras fuentes).
export const CAMPOS_DISENO_PLAN = ['accion', 'sede', 'fechaInicio', 'fecha', 'tipoAccion'];

/**
 * Con el diseño ya aprobado, el ejecutor solo registra avance y evidencias: sus cambios de diseño se ignoran y nunca
 * reabren la evaluación del diseño (corregir evidencias devueltas no vuelve a pedirla). El administrador sí puede
 * cambiarlo. En otras fuentes sin revisor el diseño nunca se revisó: el ejecutor lo sigue ajustando.
 */
export function disenoBloqueadoParaEjecutor(plan, { esPrograma = false, admin = false } = {}) {
  // Solo en ejecución: en las etapas de revisión la acción ya está cerrada para el ejecutor (bloqueadaParaEjecutor).
  if (admin || !plan || plan.estadoWorkflow !== 'En Ejecución') return false;
  return esPrograma || !revisorNoAplica(plan);
}

// 🧮 "Guardar matriz y sincronizar". Los campos del diseño se comparan contra lo que se cargó en el formulario: así
// los valores que la matriz completa al abrirse (auditor heredado del informe, valores por defecto) no cuentan como
// una corrección del diseño, y solo cuenta lo que la persona cambió.
export const CAMPOS_DISENO_MATRIZ = ['accion', 'sede', 'responsable', 'correoResponsable', 'revisor', 'correoRevisor',
  'auditorAsignado', 'correoAuditor', 'fechaInicio', 'fecha', 'tipoAccion', 'matrizRiesgos', 'matrizAspectos', 'matrizPeligros', 'matrizLegal'];
const valorDisenoMatriz = (campo, valor) => (/^matriz/.test(campo) ? valor || 'No aplica' : JSON.stringify(valor ?? ''));
export const disenoCargadoMatriz = actividad => Object.fromEntries(
  CAMPOS_DISENO_MATRIZ.map(campo => [campo, valorDisenoMatriz(campo, actividad?.[campo])]));
export const disenoCambiadoEnMatriz = (cargado, actividad) => CAMPOS_DISENO_MATRIZ.some(campo => (
  (cargado?.[campo] ?? valorDisenoMatriz(campo, undefined)) !== valorDisenoMatriz(campo, actividad?.[campo])));

/**
 * Estado con que "Guardar matriz" deja una acción. Parte del estado vigente de la acción (lo dejan las evaluaciones,
 * revisiones y correcciones), nunca de la copia que tenía el formulario: una matriz abierta antes de un rechazo del
 * diseño no lo deshace al guardar (PLA-0075, 29/10/2026).
 */
export function estadoAlGuardarMatriz({ planVigente, actividad, esPrograma = false, cambiaDiseno = false } = {}) {
  if (!planVigente) return estadoInicialPlan(esPrograma, actividad);
  if (cambiaDiseno) return ESTADO_EVALUACION_INICIAL;
  const estado = planVigente.estadoWorkflow || actividad?.estadoWorkflow || 'Pendiente Revisión Jefatura';
  const progreso = Math.min(Math.max(parseInt(actividad?.progreso || 0, 10) || 0, 0), 100);
  if (progreso === 100 && estado === 'En Ejecución') return estadoAlCien(actividad);
  if (progreso < 100 && ['Pendiente Validación Revisor', 'En Revisión (100%)'].includes(estado)) return 'En Ejecución';
  return estado;
}
