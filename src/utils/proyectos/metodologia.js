// src/utils/proyectos/metodologia.js - Manual Metodológico de Gestión de Proyectos E-ID-MAN-01 (v4, 09/2025).
// Ciclo de vida: Preinversión (Prefactibilidad → Factibilidad), Inversión (planificación → Acta de
// Constitución → ejecución) y Operación y cierre. Cada apartado del manual se diligencia en la app; los
// archivos de soporte se guardan en el repositorio de archivos de Termales (no en carpetas de Drive).
import { esFecha } from './fechas.js';
import { resumenFinanciero } from './financiero.js';

// Mismos valores que modelo.js (se repiten para no crear una importación circular con requisitosTransicion).
const TIPOS_CONTENEDOR = ['fase', 'paquete', 'epica'];

// Capítulo II: pilares de la estrategia 2024-2030 y código E1_SP1_PY1.
export const PILARES = { E: 'Económico', S: 'Social', A: 'Ambiental' };
export function codigoEstrategico(ficha = {}) {
  const pilar = PILARES[ficha.pilar] ? ficha.pilar : '';
  const programa = Number(ficha.numPrograma);
  const proyecto = Number(ficha.numProyecto);
  const subprograma = Number(ficha.numSubprograma);
  if (!pilar || !(programa >= 1) || !(proyecto >= 1)) return '';
  return `${pilar}${programa}${subprograma >= 1 ? `_SP${subprograma}` : ''}_PY${proyecto}`;
}

export const FASES_CICLO = { preinversion: 'Preinversión', inversion: 'Inversión', operacion: 'Operación y cierre' };
// Fase del ciclo de vida a la que corresponde cada estado del proyecto.
export const FASE_DE_ESTADO = { propuesto: 'preinversion', factibilidad: 'preinversion', planificacion: 'inversion', ejecucion: 'inversion', operacion: 'operacion', cerrado: 'operacion' };

export const LETRAS_PESTEL = { P: 'Político', E: 'Económico', S: 'Social', T: 'Tecnológico', EC: 'Ecológico', L: 'Legal' };
export const BLOQUES_PROPUESTA_VALOR = {
  segmento: 'Segmento de clientes (interno o externo)', tareas: 'Tareas del cliente', dolores: 'Dolores o frustraciones', motivadores: 'Motivaciones o alegrías',
  productos: 'Productos y servicios', calmantes: 'Calmantes de dolores', detonantes: 'Detonantes de alegrías',
};
export const BLOQUES_MODELO_NEGOCIO = {
  segmentos: '1. Segmento de clientes', propuesta: '2. Propuesta de valor', canales: '3. Canales', relaciones: '4. Relaciones con los clientes',
  recursos: '5. Recursos clave', aliados: '6. Socios o aliados clave', actividades: '7. Actividades clave', costos: '8. Estructura de costos', ingresos: '9. Fuentes de ingresos',
};
export const TIPOS_INGENIERIA = { infraestructura: 'Infraestructura', producto: 'Producto o servicio', administrativo: 'Administrativo', rse: 'RSE' };
export const CATEGORIAS_LECCION = { tecnica: 'Técnica', administrativa: 'Administrativa', contractual: 'Contractual', operativa: 'Operativa' };
export const ESTRATEGIAS_INTERESADO = { cerca: 'Gestionar de cerca', satisfecho: 'Mantener satisfecho', informado: 'Mantener informado', monitorear: 'Monitorear' };

const lleno = valor => String(valor ?? '').trim().length > 0;
const datosDe = (plan, seccion) => plan?.secciones?.[seccion]?.datos || {};
const noAplica = (plan, seccion) => String(datosDe(plan, seccion).noAplica?.justificacion || '').trim().length >= 10;

/** Matriz poder–interés (escala 1–5; alto ≥ 3). */
export function estrategiaInteresado({ poder, interes } = {}) {
  const altoPoder = Number(poder) >= 3;
  const altoInteres = Number(interes) >= 3;
  if (altoPoder && altoInteres) return 'cerca';
  if (altoPoder) return 'satisfecho';
  if (altoInteres) return 'informado';
  return 'monitorear';
}

/** Elementos de la EDT sobre los que se asigna RACI: entregables y paquetes de trabajo (o fases). */
export function elementosRaci(plan = {}) {
  return [
    ...(plan.entregables || []).map(entregable => ({ id: `E:${entregable.id}`, nombre: `${entregable.codigo} · ${entregable.nombre}`, tipo: 'Entregable' })),
    ...(plan.tareas || []).filter(tarea => TIPOS_CONTENEDOR.includes(tarea.tipo) && tarea.estado !== 'cancelada')
      .map(tarea => ({ id: `T:${tarea.id}`, nombre: `${tarea.codigo} · ${tarea.titulo}`, tipo: tarea.tipo === 'fase' ? 'Fase' : 'Paquete de trabajo' })),
  ];
}

/** Regla del manual: cada elemento con exactamente un A y al menos un R. Devuelve los problemas. */
export function erroresRaci(plan = {}) {
  const elementos = elementosRaci(plan);
  const filas = datosDe(plan, 'raci').filas || {};
  if (!elementos.length) return ['Registra entregables o paquetes de trabajo en la EDT para asignar la matriz RACI.'];
  if (!(datosDe(plan, 'raci').roles || []).length) return ['Define los roles (cargos) de la matriz RACI.'];
  return elementos.flatMap(elemento => {
    const valores = Object.values(filas[elemento.id] || {});
    const a = valores.filter(valor => valor === 'A').length;
    const r = valores.filter(valor => valor === 'R').length;
    if (a !== 1 && r < 1) return [`"${elemento.nombre}": necesita exactamente un A y al menos un R.`];
    if (a !== 1) return [`"${elemento.nombre}": debe tener exactamente un A (tiene ${a}).`];
    if (r < 1) return [`"${elemento.nombre}": falta al menos un R.`];
    return [];
  });
}

const fechaFase = rango => esFecha(rango?.inicio) && esFecha(rango?.fin) && rango.fin >= rango.inicio;

/**
 * Apartados del manual: número, título, etapa (prefactibilidad, factibilidad, inversion, cierre), si admite
 * "No aplica" con justificación y qué falta para darlo por completo.
 */
export const APARTADOS = [
  { id: 'problema', numero: '1', titulo: 'Problema u oportunidad', etapa: 'prefactibilidad',
    faltante: proyecto => (lleno(proyecto?.ficha?.problema) ? '' : 'Describe el problema u oportunidad (el "por qué" del proyecto) en la ficha.') },
  { id: 'alternativas', numero: '2', titulo: 'Alternativas de aprovechamiento o solución', etapa: 'prefactibilidad',
    faltante: (_, plan) => ((datosDe(plan, 'alternativas').lista || []).filter(item => lleno(item.nombre) && lleno(item.descripcion)).length >= 2 ? '' : 'Registra al menos 2 alternativas con su descripción.') },
  { id: 'entorno', numero: '3', titulo: 'Condiciones del entorno', etapa: 'prefactibilidad', admiteNoAplica: true,
    faltante: (_, plan) => (lleno(datosDe(plan, 'entorno').descripcion) ? '' : 'Describe el microentorno donde se desarrollará el proyecto.') },
  { id: 'aspectos', numero: '4', titulo: 'Aspectos a considerar', etapa: 'prefactibilidad',
    faltante: (_, plan) => (['supuestos', 'estudios', 'normas', 'permisos', 'expertos'].some(campo => lleno(datosDe(plan, 'aspectos')[campo])) ? '' : 'Registra los supuestos, estudios, normas, permisos o consultas a expertos que condicionan el proyecto.') },
  { id: 'cronogramaFases', numero: '5', titulo: 'Cronograma preliminar por ciclo de vida', etapa: 'prefactibilidad',
    faltante: (_, plan) => {
      const datos = datosDe(plan, 'cronogramaFases');
      if (!Object.keys(FASES_CICLO).every(fase => fechaFase(datos[fase]))) return 'Indica inicio y fin de Preinversión, Inversión y Operación y cierre.';
      if (datos.preinversion.inicio > datos.inversion.inicio || datos.inversion.inicio > datos.operacion.inicio) return 'Las fases deben seguir el orden Preinversión → Inversión → Operación y cierre.';
      return '';
    } },
  { id: 'objetivos', numero: '6 y 6.1', titulo: 'Objetivo general y específicos', etapa: 'factibilidad',
    faltante: (proyecto, plan) => {
      const especificos = (proyecto?.ficha?.objetivosEspecificos || []).length;
      if (!lleno(proyecto?.ficha?.objetivoGeneral)) return 'Escribe el objetivo general en la ficha.';
      if (!especificos) return 'Registra al menos un objetivo específico en la ficha.';
      if (especificos > 5 && !lleno(datosDe(plan, 'objetivos').justificacionExceso)) return 'El manual pide máximo 5 objetivos específicos: justifica por qué este proyecto necesita más.';
      return '';
    } },
  { id: 'pestel', numero: '7.1', titulo: 'Análisis PESTEL', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => {
      const factores = datosDe(plan, 'pestel').factores || [];
      const sinLetra = Object.keys(LETRAS_PESTEL).filter(letra => !factores.some(f => f.letra === letra && lleno(f.hecho)));
      if (sinLetra.length) return `Falta analizar: ${sinLetra.map(letra => LETRAS_PESTEL[letra]).join(', ')} (no se deja ninguna letra sin analizar).`;
      if (factores.some(f => lleno(f.hecho) && (!lleno(f.fuente) || !esFecha(f.fechaFuente)))) return 'Cada factor necesita su fuente y la fecha de consulta.';
      return '';
    } },
  { id: 'propuestaValor', numero: '7.2', titulo: 'CANVA propuesta de valor', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => (Object.keys(BLOQUES_PROPUESTA_VALOR).every(bloque => lleno(datosDe(plan, 'propuestaValor')[bloque])) ? '' : 'Completa el perfil del cliente y el mapa de valor.') },
  { id: 'modeloNegocio', numero: '7.3', titulo: 'CANVA modelo de negocio', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => (Object.keys(BLOQUES_MODELO_NEGOCIO).every(bloque => lleno(datosDe(plan, 'modeloNegocio')[bloque])) ? '' : 'Completa los 9 bloques del modelo de negocio.') },
  { id: 'ingresos', numero: '8', titulo: 'Proyección de ingresos', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => ((datosDe(plan, 'ingresos').periodos || []).length && lleno(datosDe(plan, 'ingresos').supuestos) ? '' : 'Proyecta clientes y precio por periodo y documenta los supuestos.') },
  { id: 'localizacion', numero: '9', titulo: 'Estudios técnicos de localización y tamaño', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => (lleno(datosDe(plan, 'localizacion').ubicacion) && lleno(datosDe(plan, 'localizacion').capacidad) ? '' : 'Define la ubicación y la capacidad o tamaño del proyecto.') },
  { id: 'ingenieria', numero: '10', titulo: 'Estudios de ingeniería (layout y proceso)', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => ((datosDe(plan, 'ingenieria').tipos || []).length && lleno(datosDe(plan, 'ingenieria').proceso) ? '' : 'Indica el tipo de proyecto y describe el proceso o la distribución.') },
  { id: 'organizacional', numero: '10.1', titulo: 'Análisis organizacional', etapa: 'factibilidad',
    faltante: (_, plan) => (Object.keys(FASES_CICLO).every(fase => lleno(datosDe(plan, 'organizacional')[fase])) ? '' : 'Describe el personal requerido en Preinversión, Inversión y Operación.') },
  { id: 'financiero', numero: '11', titulo: 'Análisis financiero (VAN, TIR, PRD, ROI)', etapa: 'factibilidad', admiteNoAplica: true,
    faltante: (_, plan) => {
      const datos = datosDe(plan, 'financiero');
      if (!datos.unidadPeriodo) return 'Indica la duración de cada periodo (mes, trimestre, semestre o año) para expresar la recuperación en años y meses.';
      if (!(Number(datos.tasaDescuento) >= 0) || (datos.flujos || []).length < 2) return 'Registra la tasa de descuento y al menos 2 periodos de flujo de caja.';
      const repetido = (datos.flujos || []).map(flujo => Number(flujo?.periodo)).find((periodo, i, lista) => lista.indexOf(periodo) !== i);
      if (repetido !== undefined) return `El periodo ${repetido} está repetido en el flujo de caja.`;
      return resumenFinanciero(datos).van === null ? 'Los flujos no permiten calcular el VAN.' : '';
    } },
  { id: 'interesados', numero: '12', titulo: 'Matriz de interesados', etapa: 'inversion',
    faltante: (_, plan) => ((datosDe(plan, 'interesados').lista || []).some(item => lleno(item.nombre)) ? '' : 'Registra los interesados con su poder, interés y actitud.') },
  { id: 'edt', numero: '13', titulo: 'Estructura de desglose de trabajo (EDT)', etapa: 'inversion',
    faltante: (proyecto, plan) => {
      if (!(plan?.tareas || []).some(tarea => tarea.estado !== 'cancelada')) return 'Construye la EDT en la pestaña Cronograma.';
      if (proyecto?.ficha?.metodologia !== 'agil' && !(plan?.lineasBase || []).length) return 'Establece la línea base del cronograma.';
      if (proyecto?.ficha?.metodologia !== 'agil' && !(plan?.tareas || []).some(tarea => tarea.tipo === 'hito' && tarea.estado !== 'cancelada')) return 'Define los hitos principales (forman parte del Acta de Constitución).';
      return '';
    } },
  { id: 'organigrama', numero: '14', titulo: 'Organigrama del proyecto por ciclo de vida', etapa: 'inversion',
    faltante: (_, plan) => ((datosDe(plan, 'organigrama').roles || []).some(rol => rol.fase === 'inversion' && lleno(rol.rol)) ? '' : 'Registra al menos los roles de la fase de Inversión.') },
  { id: 'raci', numero: '15', titulo: 'Matriz RACI', etapa: 'inversion', faltante: (_, plan) => erroresRaci(plan)[0] || '' },
  { id: 'riesgosProyecto', numero: '16', titulo: 'Gestión de riesgos', etapa: 'inversion',
    faltante: (_, plan) => ((plan?.riesgos || []).some(riesgo => riesgo.tipo === 'riesgo') ? '' : 'Registra la matriz de riesgos del proyecto (pestaña Riesgos).') },
  { id: 'acta', numero: '17', titulo: 'Acta de constitución', etapa: 'inversion',
    faltante: proyecto => {
      const f = proyecto?.ficha || {};
      const faltan = [['justificacion', 'justificación'], ['alcanceIncluido', 'alcance incluido'], ['alcanceExcluido', 'fuera del alcance'], ['dependenciasRestricciones', 'requisitos y restricciones'], ['criteriosExito', 'criterios de éxito']]
        .filter(([campo]) => !lleno(f[campo])).map(([, nombre]) => nombre);
      if (!proyecto?.miembros?.patrocinador) faltan.push('patrocinador');
      return faltan.length ? `Completa en la ficha: ${faltan.join(', ')}.` : '';
    } },
  { id: 'transferencia', numero: '4.3', titulo: 'Entrega a la operación', etapa: 'cierre',
    faltante: (_, plan) => {
      const datos = datosDe(plan, 'transferencia');
      return lleno(datos.areaReceptora) && lleno(datos.responsableOperacion) && esFecha(datos.fechaEntrega) && lleno(datos.capacitaciones) ? '' : 'Registra el área que recibe, su responsable, la fecha de entrega y las capacitaciones.';
    } },
  { id: 'lecciones', numero: '4.2.2', titulo: 'Lecciones aprendidas', etapa: 'cierre',
    faltante: (_, plan) => ((datosDe(plan, 'lecciones').lista || []).some(item => lleno(item.situacion)) ? '' : 'Documenta al menos una lección aprendida (categoría, situación y recomendación).') },
  { id: 'actaCierre', numero: 'Acta de cierre', titulo: 'Acta de cierre', etapa: 'cierre',
    faltante: (_, plan) => {
      const datos = datosDe(plan, 'actaCierre');
      const faltan = [['resultados', 'resultados frente a los objetivos'], ['contratos', 'cierre de contratos'], ['liberacionRecursos', 'liberación de recursos']].filter(([campo]) => !lleno(datos[campo])).map(([, nombre]) => nombre);
      return faltan.length ? `Completa: ${faltan.join(', ')}.` : '';
    } },
];
const APARTADO = Object.fromEntries(APARTADOS.map(apartado => [apartado.id, apartado]));

/** Estado de un apartado: { completo, noAplica, faltante }. */
export function estadoApartado(id, proyecto, plan) {
  const apartado = APARTADO[id];
  if (apartado?.admiteNoAplica && noAplica(plan, id)) return { completo: true, noAplica: true, faltante: '' };
  const faltante = apartado ? apartado.faltante(proyecto, plan) : '';
  return { completo: !faltante, noAplica: false, faltante };
}
export const apartadosDeEtapa = etapa => APARTADOS.filter(apartado => apartado.etapa === etapa);
const faltantesEtapa = (etapa, proyecto, plan) => apartadosDeEtapa(etapa)
  .map(apartado => [apartado, estadoApartado(apartado.id, proyecto, plan)])
  .filter(([, estado]) => !estado.completo)
  .map(([apartado, estado]) => `Apartado ${apartado.numero} (${apartado.titulo}): ${estado.faltante}`);

// Documentos de cada fase (sección 6.1 del manual). Se guardan en el repositorio de archivos de Termales.
// "enApp" indica qué parte de la aplicación ya diligencia ese formato.
export const DOCUMENTOS = [
  { id: 'formato1', fase: 'preinversion', nombre: 'Formato 1 · Estructura inicial del proyecto', archivo: 'Formato1_Estructura_Inicial_del_Proyecto', enApp: (p, plan) => Boolean(aprobacionDe(p, 'factibilidad')) || !faltantesEtapa('prefactibilidad', p, plan).length },
  { id: 'anexo1', fase: 'preinversion', nombre: 'Anexo 1 · Resumen de presupuesto y cronograma', archivo: 'Anexo1_Resumen_Ppto_y_Cronograma', enApp: (p, plan) => estadoApartado('cronogramaFases', p, plan).completo },
  { id: 'anexosIniciales', fase: 'preinversion', nombre: 'Anexos iniciales (referencias y apoyo)', archivo: 'Anexos_Iniciales', opcional: true },
  { id: 'formato2', fase: 'inversion', nombre: 'Formato 2 · Formulación del proyecto', archivo: 'Formato2_Formulacion_del_Proyecto', enApp: (p, plan) => Boolean(aprobacionDe(p, 'planificacion')) || !faltantesEtapa('factibilidad', p, plan).length },
  { id: 'formato3', fase: 'inversion', nombre: 'Formato 3 · Acta de constitución', archivo: 'Formato3_Acta_de_Constitucion', enApp: p => Boolean(aprobacionDe(p, 'ejecucion')) },
  { id: 'anexo2', fase: 'inversion', nombre: 'Anexo 2 · Análisis PESTEL', archivo: 'Anexo2_Analisis_PESTEL', enApp: (p, plan) => estadoApartado('pestel', p, plan).completo },
  { id: 'anexo3', fase: 'inversion', nombre: 'Anexo 3 · Modelo CANVA', archivo: 'Anexo3_Formato_Modelo_Canva', enApp: (p, plan) => estadoApartado('propuestaValor', p, plan).completo && estadoApartado('modeloNegocio', p, plan).completo },
  { id: 'anexo4', fase: 'inversion', nombre: 'Anexo 4 · Matriz de selección de localización y tamaño', archivo: 'Anexo4_Matriz_de_Seleccion_Localizacion_y_Tamano', enApp: (p, plan) => estadoApartado('localizacion', p, plan).completo },
  { id: 'anexo5', fase: 'inversion', nombre: 'Anexo 5 · Registro y matriz de interesados', archivo: 'Anexo5_Registro_y_Matriz_de_Interesados', enApp: (p, plan) => estadoApartado('interesados', p, plan).completo },
  { id: 'anexo6', fase: 'inversion', nombre: 'Anexo 6 · Plantilla EDT', archivo: 'Anexo6_Plantilla_EDT', enApp: (p, plan) => (plan?.tareas || []).length > 0 },
  { id: 'anexo7', fase: 'inversion', nombre: 'Anexo 7 · Organigrama y matriz RACI', archivo: 'Anexo7_Organigrama_y_Matriz_RACI', enApp: (p, plan) => estadoApartado('organigrama', p, plan).completo && estadoApartado('raci', p, plan).completo },
  { id: 'anexo8', fase: 'inversion', nombre: 'Anexo 8 · Gestión de riesgos del proyecto', archivo: 'Anexo8_Gestion_de_Riesgos', enApp: (p, plan) => estadoApartado('riesgosProyecto', p, plan).completo },
  { id: 'anexosAdicionales', fase: 'inversion', nombre: 'Anexos adicionales (informes y estudios)', archivo: 'Anexos_Adicionales', opcional: true },
  { id: 'entregaOperacion', fase: 'operacion', nombre: 'Formatos de entrega a la operación (proceso de Calidad)', archivo: 'Entrega_a_Operacion', enApp: (p, plan) => estadoApartado('transferencia', p, plan).completo },
  { id: 'formato4', fase: 'operacion', nombre: 'Formato 4 · Acta de cierre', archivo: 'Formato4_Acta_de_Cierre', enApp: (p, plan) => estadoApartado('actaCierre', p, plan).completo },
  { id: 'anexosComplementarios', fase: 'operacion', nombre: 'Anexos complementarios', archivo: 'Anexos_Complementarios', opcional: true },
];
export const DOCUMENTO = Object.fromEntries(DOCUMENTOS.map(documento => [documento.id, documento]));

/** Aprobación registrada (solicitud aprobada) que llevó el proyecto a `destino`. */
export const aprobacionDe = (proyecto, destino) => [...(proyecto?.solicitudesEstado || [])].reverse()
  .find(solicitud => solicitud.destino === destino && solicitud.estado === 'aprobada') || null;

/** 'archivo' (hay versión cargada), 'app' (diligenciado en la aplicación), 'noAplica' o 'pendiente'. */
export function estadoDocumento(documento, proyecto, plan) {
  const registro = plan?.documentos?.[documento.id];
  if ((registro?.versiones || []).length) return 'archivo';
  if (documento.enApp?.(proyecto, plan)) return 'app';
  if (registro?.noAplica?.justificacion) return 'noAplica';
  return documento.opcional ? 'opcional' : 'pendiente';
}

/** Nombre del archivo con el prefijo del proyecto, como pide el manual: E1_SP1_PY1_Formato3_..._v2.pdf */
export function nombreArchivoDocumento(proyecto, documento, version, extension) {
  const prefijo = proyecto?.codigoEstrategico || proyecto?.codigo || 'PROYECTO';
  return `${prefijo}_${documento.archivo}_v${version}${extension ? `.${extension}` : ''}`;
}

/** Requisitos del manual para pasar a `destino` (los de cronograma y cierre de trabajo están en modelo.js). */
export function requisitosMetodologia(proyecto, plan, destino) {
  const origen = proyecto?.estado;
  if (destino === 'factibilidad') {
    return [
      ...(codigoEstrategico(proyecto?.ficha) ? [] : ['Asigna el código del portafolio en la ficha (pilar, programa y número de proyecto).']),
      ...faltantesEtapa('prefactibilidad', proyecto, plan),
    ];
  }
  if (destino === 'planificacion') return faltantesEtapa('factibilidad', proyecto, plan);
  if (destino === 'ejecucion' && origen === 'planificacion') return faltantesEtapa('inversion', proyecto, plan);
  if (destino === 'cerrado') {
    const documentos = DOCUMENTOS.filter(documento => !documento.opcional && estadoDocumento(documento, proyecto, plan) === 'pendiente');
    return [
      ...faltantesEtapa('cierre', proyecto, plan),
      ...(documentos.length ? [`Documentación pendiente: ${documentos.map(documento => documento.nombre).join('; ')}.`] : []),
    ];
  }
  return [];
}

