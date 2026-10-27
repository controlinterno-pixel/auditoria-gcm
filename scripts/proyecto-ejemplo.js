// scripts/proyecto-ejemplo.js - Crea (o borra) el proyecto de demostración "Ejemplo" en Gestión de Proyectos.
// Usa las mismas reglas del servidor (aplicarAccion), así que el proyecto queda como si se hubiera diligenciado
// a mano, con su historial. Patrocinador, Comité, aprobador y equipo son correos ficticios "*.ejemplo": una
// aprobación no puede atribuirse a una persona real que no la hizo.
//   node scripts/proyecto-ejemplo.js --credenciales "C:\llaves-gcm\llave.json" --director correo@termales.com.co
//   node scripts/proyecto-ejemplo.js --credenciales "C:\llaves-gcm\llave.json" --borrar
//   node scripts/proyecto-ejemplo.js --credenciales "C:\llaves-gcm\llave.json" --actualizar-ejemplo [--crear-organizaciones]
//     (rehace solo los apartados 8, 11, 12 y 14 del ejemplo que ya existe, con su historial; el resto no se toca.
//     12 y 14 usan los cargos y organizaciones del catálogo de Cargos y Procesos; --crear-organizaciones agrega
//     al catálogo las organizaciones del ejemplo que falten)
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const argumento = nombre => { const i = process.argv.indexOf(`--${nombre}`); return i > -1 ? process.argv[i + 1] : ''; };
// --simular recorre todas las acciones con las reglas del servidor sin tocar Firestore.
const simular = process.argv.includes('--simular');
const rutaCredenciales = argumento('credenciales');
if (!rutaCredenciales && !simular) { console.error('Falta --credenciales "ruta de la llave .json".'); process.exit(1); }
if (!simular) {
  const llave = JSON.parse(readFileSync(rutaCredenciales, 'utf8'));
  process.env.FIREBASE_PROJECT_ID = llave.project_id;
  process.env.FIREBASE_CLIENT_EMAIL = llave.client_email;
  process.env.FIREBASE_PRIVATE_KEY = llave.private_key;
}
const { adminDb } = simular ? { adminDb: null } : await import('../api/_lib/firebaseAdmin.js');
const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
const { aplicarAccion, crearProyecto } = await import('../api/_lib/proyectosAcciones.js');
const { compactarPlan } = await import('../src/utils/proyectos/indicadores.js');
const { hoyColombia } = await import('../src/utils/proyectos/fechas.js');
const { FINANCIERO_EJEMPLO, INGRESOS_EJEMPLO } = await import('./datosFinancierosEjemplo.js');
const { ORGANIZACIONES_EJEMPLO, ajustarEjemploACatalogo } = await import('./catalogoEjemplo.js');
const { buscarEnCatalogo } = await import('../src/utils/proyectos/catalogos.js');

const coleccion = simular ? null : adminDb.collection('proyectos');
const MARCA = 'esEjemplo';

async function borrar() {
  const snapshot = await coleccion.where(MARCA, '==', true).get();
  for (const documento of snapshot.docs) {
    const historial = await documento.ref.collection('historial').get();
    const lote = adminDb.batch();
    historial.docs.forEach(evento => lote.delete(evento.ref));
    lote.delete(documento.ref.collection('detalle').doc('plan'));
    lote.delete(documento.ref);
    await lote.commit();
    console.log(`Borrado ${documento.get('codigo')} (${historial.size} eventos de historial).`);
  }
  if (!snapshot.size) console.log('No hay proyectos de ejemplo.');
}

if (process.argv.includes('--borrar') && !simular) { await borrar(); process.exit(0); }

// Catálogo de Cargos y Procesos de la plataforma (solo lectura, salvo --crear-organizaciones).
async function leerCatalogo() {
  const refWorkspace = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
  const datos = (await refWorkspace.get()).data() || {};
  const cargos = [...new Set((datos.catalogoCargos || []).filter(registro => registro?.activo !== false).map(registro => String(registro?.cargo || '').trim()).filter(Boolean))];
  let organizaciones = Array.isArray(datos.organizacionesExternas) ? datos.organizacionesExternas : [];
  const nuevas = Object.values(ORGANIZACIONES_EJEMPLO).filter(nombre => !buscarEnCatalogo(nombre, organizaciones));
  if (process.argv.includes('--crear-organizaciones') && nuevas.length) {
    await refWorkspace.update({ organizacionesExternas: FieldValue.arrayUnion(...nuevas) });
    organizaciones = [...organizaciones, ...nuevas];
    console.log(`Organizaciones agregadas al catálogo: ${nuevas.join('; ')}`);
  }
  return { cargos, organizaciones };
}

// Actualiza los apartados 8, 11, 12 y 14 con las mismas reglas del servidor, como si el director los guardara.
async function actualizarEjemplo() {
  const { interesados, organigrama, faltan } = ajustarEjemploACatalogo(await leerCatalogo());
  const snapshot = await coleccion.where(MARCA, '==', true).limit(1).get();
  if (snapshot.empty) { console.error('No hay proyecto de ejemplo: créalo primero.'); process.exit(1); }
  const refProyecto = snapshot.docs[0].ref;
  const refPlan = refProyecto.collection('detalle').doc('plan');
  const eventos = await adminDb.runTransaction(async transaccion => {
    const [documento, documentoPlan] = await Promise.all([transaccion.get(refProyecto), transaccion.get(refPlan)]);
    let proyecto = documento.data();
    let plan = documentoPlan.data() || {};
    const director = { email: proyecto.miembros.director, rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'] };
    const contexto = () => { const ahora = new Date(); return { usuario: director, ahora: ahora.toISOString(), hoy: hoyColombia(ahora), generarId: randomUUID, codigo: proyecto.codigo }; };
    const nuevos = [];
    for (const [nombre, datos] of [['ingresos', INGRESOS_EJEMPLO], ['financiero', FINANCIERO_EJEMPLO], ['interesados', interesados], ['organigrama', organigrama]]) {
      const resultado = aplicarAccion(proyecto, plan, 'guardarSeccion', { seccion: nombre, datos, versionBase: plan.secciones?.[nombre]?.version }, contexto());
      ({ proyecto, plan } = resultado);
      nuevos.push(...resultado.eventos);
    }
    const limpiar = valor => JSON.parse(JSON.stringify(valor));
    transaccion.set(refProyecto, limpiar(proyecto));
    transaccion.set(refPlan, limpiar(plan));
    nuevos.forEach(evento => transaccion.set(refProyecto.collection('historial').doc(), { ...limpiar({
      ...evento, usuario: director.email, nombreUsuario: '', fechaIso: new Date().toISOString(),
    }), fecha: Timestamp.now() }));
    return nuevos.length;
  });
  console.table([{ proyecto: snapshot.docs[0].get('codigo'), apartados: '8, 11, 12 y 14', eventosHistorial: eventos }]);
  if (faltan.length) console.log(`No están en el catálogo (el apartado mostrará el aviso hasta crearlos): ${faltan.join('; ')}`);
}
if ((process.argv.includes('--actualizar-ejemplo') || process.argv.includes('--actualizar-financiero')) && !simular) { await actualizarEjemplo(); process.exit(0); }

const correoDirector = String(argumento('director') || '').toLowerCase();
if (!/@termales\.com\.co$/.test(correoDirector)) { console.error('Falta --director correo@termales.com.co (quien verá y editará el proyecto).'); process.exit(1); }
if (!simular && !(await coleccion.where(MARCA, '==', true).limit(1).get()).empty) { console.error('Ya existe un proyecto de ejemplo: bórralo primero con --borrar.'); process.exit(1); }
if (!simular && !(await coleccion.where('codigoEstrategico', '==', 'A9_SP9_PY99').limit(1).get()).empty) { console.error('El código A9_SP9_PY99 ya lo usa otro proyecto: no se crea el ejemplo.'); process.exit(1); }

const persona = nombre => ({ email: nombre.includes('@') ? nombre : `${nombre}.ejemplo@termales.com.co`, rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'], nombreResponsable: nombre });
const DIRECTOR = persona(correoDirector);
const PATROCINADOR = persona('patrocinador');
const COMITE = persona('comite');
const APROBADOR = persona('aprobador');
const EQUIPO = persona('equipo');

const anio = hoyColombia().slice(0, 4);
const refContador = simular ? null : adminDb.collection('_grc_counters').doc(`proyectos_${anio}`);
const siguiente = simular ? 0 : await adminDb.runTransaction(async transaccion => {
  const contador = await transaccion.get(refContador);
  const numero = (Number(contador.exists ? contador.get('ultimo') : 0) || 0) + 1;
  transaccion.set(refContador, { ultimo: numero, actualizadoEn: new Date().toISOString() }, { merge: true });
  return numero;
});
const codigo = `PRY-${anio}-${String(siguiente).padStart(3, '0')}`;
const ctx = usuario => { const ahora = new Date(); return { usuario, ahora: ahora.toISOString(), hoy: hoyColombia(ahora), generarId: randomUUID, codigo }; };

const eventos = [];
let { proyecto, plan, eventos: iniciales } = crearProyecto({
  ficha: {
    nombre: 'Ejemplo', descripcion: 'Proyecto de demostración con datos ficticios para conocer el módulo. Se puede borrar sin afectar nada más.',
    justificacion: 'Diversificar la oferta de naturaleza y aumentar la ocupación entre semana.', problema: 'La ocupación de lunes a jueves es 35 % menor que la de fin de semana y no hay una experiencia de naturaleza guiada que la impulse.',
    objetivoGeneral: 'Abrir un sendero ecológico guiado de 3 km antes del 18 de diciembre de 2026.',
    objetivosEspecificos: ['Diseñar el recorrido y sus estaciones de interpretación', 'Adecuar 3 km de sendero con señalización', 'Capacitar a 6 guías certificados', 'Recibir 500 visitantes en los primeros 3 meses'],
    alcanceIncluido: 'Diseño, adecuación del sendero, señalización, capacitación de guías y apertura.', alcanceExcluido: 'Hospedaje, transporte y nuevas piscinas.',
    area: 'Gestión de Operaciones', proceso: 'Experiencias de naturaleza', portafolio: 'Portafolio TSRC', programa: 'Turismo de naturaleza',
    pilar: 'A', numPrograma: 9, numSubprograma: 9, numProyecto: 99, metodologia: 'predictiva', prioridad: 'alta',
    fechaSolicitud: '2026-08-03', inicioPlanificado: '2026-08-03', finPlanificado: '2027-01-29', manejaPresupuesto: true, presupuestoAprobado: 85000000, moneda: 'COP',
    beneficios: 'Mayor ocupación entre semana y posicionamiento en turismo sostenible.', indicadoresEsperados: 'Visitantes por mes, ocupación de lunes a jueves, satisfacción.',
    criteriosExito: '500 visitantes en 3 meses y satisfacción mayor a 4,5 / 5.', dependenciasRestricciones: 'Permiso de la CAR; temporada de lluvias de octubre a noviembre.',
    riesgosIniciales: 'Lluvias, demoras en el permiso ambiental.', calendario: 'laboral',
  },
  miembros: { director: DIRECTOR.email, patrocinador: PATROCINADOR.email, comite: [COMITE.email], aprobadores: [APROBADOR.email], equipo: [EQUIPO.email] },
}, ctx(DIRECTOR));
eventos.push(...iniciales.map(evento => [evento, DIRECTOR]));

const hacer = (usuario, accion, datos) => {
  const resultado = aplicarAccion(proyecto, plan, accion, datos, ctx(usuario));
  ({ proyecto, plan } = resultado);
  eventos.push(...resultado.eventos.map(evento => [evento, usuario]));
  return resultado;
};
const seccion = (nombre, datos) => hacer(DIRECTOR, 'guardarSeccion', { seccion: nombre, datos, versionBase: plan.secciones?.[nombre]?.version });
const aprobar = (destino, aprobador, motivo) => {
  hacer(DIRECTOR, 'solicitarEstado', { destino, motivo });
  const solicitud = proyecto.solicitudesEstado.find(item => item.estado === 'pendiente');
  hacer(aprobador, 'decidirEstado', { idSolicitud: solicitud.id, decision: 'aprobada', comentario: `${motivo} (aprobación de ejemplo)` });
};
const tarea = datos => hacer(DIRECTOR, 'guardarTarea', { tarea: { prioridad: 'media', estado: 'pendiente', avance: 0, ...datos } }).respuesta.id;
const version = id => plan.tareas.find(item => item.id === id).version;

// Preinversión · Prefactibilidad (apartados 1 a 5)
seccion('alternativas', { lista: [
  { nombre: 'Sendero corto de 1,5 km', descripcion: 'Recorrido autoguiado con señalización', economica: 'Menor costo', impactosNegativos: 'Experiencia menos diferenciada' },
  { nombre: 'Sendero guiado de 3 km', descripcion: 'Recorrido con guías y estaciones de interpretación', economica: 'Inversión media', impactosPositivos: 'Experiencia diferenciada y empleo local', seleccionada: true },
  { nombre: 'Alianza con un operador externo', descripcion: 'El operador presta el servicio en el bosque vecino', impactosNegativos: 'Menor control de la calidad' },
] });
seccion('entorno', { descripcion: 'Bosque de niebla de 12 hectáreas junto a las piscinas, con quebrada y avifauna abundante.', ubicacion: 'Lote norte, acceso desde el parqueadero principal.', normativa: 'Plan de ordenamiento municipal y lineamientos de la CAR.', actores: 'Junta de acción comunal de la vereda y operadores turísticos locales.' });
seccion('aspectos', { supuestos: 'La CAR otorga el permiso en menos de 60 días.', estudios: 'Estudio topográfico y de capacidad de carga.', permisos: 'Permiso de aprovechamiento de la CAR.', expertos: 'Biólogo para el inventario de aves; asesoría jurídica para el permiso.' });
seccion('cronogramaFases', { preinversion: { inicio: '2026-08-03', fin: '2026-09-30' }, inversion: { inicio: '2026-10-01', fin: '2026-12-18' }, operacion: { inicio: '2026-12-21', fin: '2027-01-29' }, hitos: 'Aprobación de la factibilidad (30/09), diseño aprobado (23/10), obra terminada (04/12), apertura (18/12).' });
aprobar('factibilidad', PATROCINADOR, 'Estructura inicial completa');

// Preinversión · Factibilidad (apartados 6 a 11)
seccion('pestel', { factores: [
  { letra: 'P', hecho: 'Política nacional de turismo sostenible prioriza experiencias de naturaleza.', fuente: 'MinCIT', fechaFuente: '2026-02-10', tendencia: 'mejor', tipo: 'oportunidad', importancia: 3, valoracion: 5, impacto: 'alto' },
  { letra: 'E', hecho: 'Inflación de servicios turísticos del 6 % anual.', fuente: 'DANE', fechaFuente: '2026-06-30', tendencia: 'estable', tipo: 'amenaza', importancia: 2, valoracion: 2, impacto: 'medio' },
  { letra: 'S', hecho: 'Crece la demanda de turismo de bienestar y naturaleza.', fuente: 'FONTUR', fechaFuente: '2026-03-15', tendencia: 'mejor', tipo: 'oportunidad', importancia: 3, valoracion: 5, impacto: 'alto' },
  { letra: 'T', hecho: 'Reservas en línea y guías con aplicaciones de avistamiento.', fuente: 'Cámara de Comercio', fechaFuente: '2026-01-20', tendencia: 'mejor', tipo: 'oportunidad', importancia: 2, valoracion: 4, impacto: 'medio' },
  { letra: 'EC', hecho: 'Temporada de lluvias de octubre a noviembre.', fuente: 'IDEAM', fechaFuente: '2026-05-05', tendencia: 'estable', tipo: 'amenaza', importancia: 3, valoracion: 2, impacto: 'alto' },
  { letra: 'L', hecho: 'Se requiere permiso de la CAR para intervenir el bosque.', fuente: 'CARDER', fechaFuente: '2026-04-12', tendencia: 'estable', tipo: 'amenaza', importancia: 3, valoracion: 2, impacto: 'alto' },
] });
seccion('propuestaValor', { segmento: 'Familias y parejas de 30 a 55 años que visitan las termales entre semana.', tareas: 'Desconectarse, conocer la naturaleza, compartir en familia.', dolores: 'Aglomeraciones y experiencias poco diferenciadas.', motivadores: 'Bienestar, aprendizaje, fotografía de aves.', productos: 'Recorrido guiado de 2 horas con 5 estaciones de interpretación.', calmantes: 'Grupos de máximo 15 personas y horarios entre semana.', detonantes: 'Avistamiento de aves endémicas y bebida caliente al final.', encaje: '10 entrevistas: 8 de 10 pagarían un adicional por el recorrido.' });
seccion('modeloNegocio', { segmentos: 'Visitantes entre semana', propuesta: 'Experiencia de naturaleza guiada', canales: 'Taquilla, página web y agencias', relaciones: 'Guías y encuesta de satisfacción', recursos: 'Sendero, guías, señalización', aliados: 'Junta de acción comunal, CAR', actividades: 'Mantenimiento, guianza, mercadeo', costos: 'Guías, mantenimiento, señalización', ingresos: 'Tarifa adicional por recorrido' });
seccion('ingresos', INGRESOS_EJEMPLO);
seccion('localizacion', { ubicacion: 'Lote norte junto a la quebrada.', capacidad: '15 personas por grupo, 4 grupos por día.', superficie: '3 km de sendero', criterios: 'Accesibilidad 30 %, impacto ambiental 30 %, costo 20 %, atractivo 20 %: el lote norte obtuvo 4,3 / 5.', restricciones: 'No intervenir la ronda de la quebrada.' });
seccion('ingenieria', { tipos: ['infraestructura', 'producto'], proceso: 'Reserva → registro en taquilla → charla de seguridad → recorrido de 5 estaciones → cierre con bebida → encuesta.', layout: 'Sendero en anillo con salida y llegada en el parqueadero.', estudios: 'Topografía y capacidad de carga.' });
seccion('organizacional', { preinversion: 'Líder de I+D+i y biólogo asesor.', inversion: 'Director del proyecto, contratista de obra y diseñador de señalización.', operacion: 'Coordinador de experiencias y 6 guías.' });
seccion('financiero', FINANCIERO_EJEMPLO);
aprobar('planificacion', COMITE, 'Formulación completa y viable');

// Inversión · Planificación (EDT, cronograma, riesgos, interesados, organigrama y RACI)
const fase1 = tarea({ titulo: 'Diseño', tipo: 'paquete', prioridad: 'alta' });
const fase2 = tarea({ titulo: 'Construcción', tipo: 'paquete', prioridad: 'alta' });
const fase3 = tarea({ titulo: 'Puesta en marcha', tipo: 'paquete' });
const topografia = tarea({ titulo: 'Levantamiento topográfico', tipo: 'actividad', padreId: fase1, inicio: '2026-10-01', fin: '2026-10-09', esfuerzoHoras: 40, responsable: EQUIPO.email, prioridad: 'alta' });
const diseno = tarea({ titulo: 'Diseño del recorrido y estaciones', tipo: 'actividad', padreId: fase1, inicio: '2026-10-12', fin: '2026-10-23', esfuerzoHoras: 60, responsable: EQUIPO.email, prioridad: 'alta', dependencias: [{ id: topografia }], criteriosAceptacion: [{ texto: 'Validado por el biólogo' }, { texto: 'Aprobado por Operaciones' }] });
const hitoDiseno = tarea({ titulo: 'Diseño aprobado', tipo: 'hito', padreId: fase1, inicio: '2026-10-23', fin: '2026-10-23', prioridad: 'alta', dependencias: [{ id: diseno, desfase: -1 }] });
const adecuacion = tarea({ titulo: 'Adecuación del sendero', tipo: 'actividad', padreId: fase2, inicio: '2026-10-26', fin: '2026-11-27', esfuerzoHoras: 320, responsable: EQUIPO.email, prioridad: 'critica', dependencias: [{ id: hitoDiseno }] });
const senal = tarea({ titulo: 'Señalización e interpretación', tipo: 'actividad', padreId: fase2, inicio: '2026-11-16', fin: '2026-12-04', esfuerzoHoras: 80, responsable: EQUIPO.email, dependencias: [{ id: hitoDiseno }] });
const hitoObra = tarea({ titulo: 'Obra terminada', tipo: 'hito', padreId: fase2, inicio: '2026-12-04', fin: '2026-12-04', prioridad: 'alta', dependencias: [{ id: adecuacion, desfase: -1 }, { id: senal, desfase: -1 }] });
const capacitacion = tarea({ titulo: 'Capacitación de 6 guías', tipo: 'actividad', padreId: fase3, inicio: '2026-12-07', fin: '2026-12-11', esfuerzoHoras: 40, responsable: EQUIPO.email, dependencias: [{ id: hitoObra }], requiereRevision: true, criteriosAceptacion: [{ texto: '6 guías certificados' }] });
tarea({ titulo: 'Apertura al público', tipo: 'hito', padreId: fase3, inicio: '2026-12-18', fin: '2026-12-18', prioridad: 'alta', dependencias: [{ id: capacitacion, desfase: 4 }] });
hacer(DIRECTOR, 'guardarEntregable', { entregable: { nombre: 'Planos del recorrido y estaciones', responsable: EQUIPO.email, fechaComprometida: '2026-10-23', idTarea: diseno, criterios: 'Planos a escala con las 5 estaciones y su contenido.' } });
hacer(DIRECTOR, 'guardarEntregable', { entregable: { nombre: 'Sendero adecuado y señalizado', responsable: EQUIPO.email, fechaComprometida: '2026-12-04', idTarea: hitoObra, criterios: 'Recorrido de 3 km transitable y con señalización completa.' } });
hacer(DIRECTOR, 'guardarEntregable', { entregable: { nombre: 'Guías certificados', responsable: EQUIPO.email, fechaComprometida: '2026-12-11', idTarea: capacitacion, criterios: 'Certificado de 6 guías.' } });
hacer(DIRECTOR, 'establecerLineaBase', { motivo: 'Cronograma aprobado en el comité de inicio (ejemplo)' });
hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', naturaleza: 'amenaza', descripcion: 'Lluvias intensas retrasan la adecuación del sendero', causa: 'Temporada de lluvias', evento: 'Suspensión de la obra', consecuencia: 'Retraso de la apertura', probabilidad: 4, impacto: 4, responsable: EQUIPO.email, respuesta: 'mitigar', estado: 'en_tratamiento', costoContingencia: 4000000, disparador: 'Más de 3 días seguidos de lluvia', indicadorMonitoreo: 'Días perdidos por lluvia', probabilidadResidual: 3, impactoResidual: 3, acciones: [{ descripcion: 'Programar frentes de trabajo bajo cubierta', responsable: EQUIPO.email, fechaLimite: '2026-11-06' }] } });
hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', naturaleza: 'amenaza', descripcion: 'El permiso de la CAR no llega a tiempo', probabilidad: 2, impacto: 5, responsable: DIRECTOR.email, respuesta: 'evitar', estado: 'cerrado', acciones: [{ descripcion: 'Radicar la solicitud en la prefactibilidad', responsable: DIRECTOR.email, fechaLimite: '2026-09-15', cumplida: true }] } });
hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', naturaleza: 'oportunidad', descripcion: 'Temporada de aves migratorias atrae aviturismo', probabilidad: 4, impacto: 3, responsable: DIRECTOR.email, respuesta: 'explotar', estado: 'abierto', disparador: 'Llegada de las primeras especies migratorias', acciones: [{ descripcion: 'Paquete especial de avistamiento en enero', responsable: DIRECTOR.email, fechaLimite: '2026-12-15' }] } });
const catalogoEjemplo = ajustarEjemploACatalogo(simular ? {} : await leerCatalogo());
seccion('interesados', catalogoEjemplo.interesados);
seccion('organigrama', catalogoEjemplo.organigrama);
const filas = {
  [`T:${fase1}`]: { Director: 'A', Contratista: 'C', Operaciones: 'R', Gerencia: 'I' },
  [`T:${fase2}`]: { Director: 'A', Contratista: 'R', Operaciones: 'I', Gerencia: 'I' },
  [`T:${fase3}`]: { Director: 'A', Operaciones: 'R', Gerencia: 'I' },
  ...Object.fromEntries(plan.entregables.map(entregable => [`E:${entregable.id}`, { Director: 'A', Contratista: 'R', Operaciones: 'C', Gerencia: 'I' }])),
};
seccion('raci', { roles: ['Director', 'Contratista', 'Operaciones', 'Gerencia'], filas });
aprobar('ejecucion', PATROCINADOR, 'Acta de constitución firmada');

// Inversión · Ejecución: avance real, costos, cambios, reuniones y explicación del estado.
hacer(EQUIPO, 'guardarTarea', { tarea: { id: topografia, versionBase: version(topografia), estado: 'en_curso', avance: 50, inicioReal: '2026-10-01' } });
hacer(EQUIPO, 'guardarTarea', { tarea: { id: topografia, versionBase: version(topografia), estado: 'completada', avance: 100, finReal: '2026-10-09' } });
hacer(EQUIPO, 'guardarTarea', { tarea: { id: diseno, versionBase: version(diseno), estado: 'en_curso', avance: 60, inicioReal: '2026-10-12', criteriosAceptacion: [{ texto: 'Validado por el biólogo', cumplido: true }, { texto: 'Aprobado por Operaciones', cumplido: true }] } });
hacer(EQUIPO, 'guardarTarea', { tarea: { id: diseno, versionBase: version(diseno), estado: 'completada', avance: 100, finReal: '2026-10-23' } });
hacer(DIRECTOR, 'guardarTarea', { tarea: { id: hitoDiseno, versionBase: version(hitoDiseno), estado: 'completada', avance: 100, finReal: '2026-10-23' } });
hacer(EQUIPO, 'guardarTarea', { tarea: { id: adecuacion, versionBase: version(adecuacion), estado: 'en_curso', avance: 10, inicioReal: '2026-10-26' } });
hacer(DIRECTOR, 'comentarTarea', { idTarea: adecuacion, texto: 'Se perdieron 2 días por lluvia; se activó el plan de mitigación R-001.' });
hacer(DIRECTOR, 'guardarEntregable', { entregable: { ...plan.entregables[1], versionBase: plan.entregables[1].version, estado: 'en_elaboracion' } });
hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-10-09', tipo: 'real', categoria: 'servicios', monto: 4500000, descripcion: 'Levantamiento topográfico', idTarea: topografia } });
hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-10-23', tipo: 'real', categoria: 'servicios', monto: 8000000, descripcion: 'Diseño del recorrido', idTarea: diseno } });
hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-10-26', tipo: 'comprometido', categoria: 'servicios', monto: 30000000, descripcion: 'Contrato de obra (orden de compra)', idTarea: adecuacion } });
hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-10-26', tipo: 'comprometido', categoria: 'bienes', monto: 9000000, descripcion: 'Señalización', idTarea: senal } });
hacer(EQUIPO, 'guardarCambio', { cambio: { titulo: 'Agregar un mirador en la estación 3', descripcion: 'Plataforma de madera de 12 m² con vista a la quebrada.', justificacion: 'Las entrevistas muestran que la vista es el mayor atractivo.', elementosAfectados: 'Adecuación del sendero, presupuesto', impacto: { tiempo: '+5 días hábiles', costo: '+$6.000.000', riesgos: 'Trabajo en altura' }, nuevoPresupuesto: 91000000 } });
hacer(DIRECTOR, 'decidirCambio', { id: plan.cambios[0].id, versionBase: plan.cambios[0].version, estado: 'en_analisis', analisis: 'Viable si se hace después de la temporada de lluvias; requiere ampliar el presupuesto en $6 millones.' });
hacer(DIRECTOR, 'guardarReunion', { reunion: { titulo: 'Comité de seguimiento semanal', fecha: '2026-10-26', tipo: 'Seguimiento', asistentes: ['Director del proyecto', 'Contratista', 'Operaciones'], acta: 'Se revisó el avance del diseño (terminado) y el inicio de la obra.', decisiones: ['Iniciar la obra por el tramo norte', 'Analizar el mirador como solicitud de cambio'], compromisos: [
  { descripcion: 'Enviar cronograma detallado de obra', responsable: EQUIPO.email, fechaLimite: '2026-10-28' },
  { descripcion: 'Cotizar el mirador de la estación 3', responsable: EQUIPO.email, fechaLimite: '2026-11-04' },
] } });
const reunion = plan.reuniones[0];
hacer(EQUIPO, 'actualizarCompromiso', { idReunion: reunion.id, idCompromiso: reunion.compromisos[0].id, estado: 'cumplido', comentario: 'Cronograma enviado por correo al director.' });
hacer(DIRECTOR, 'explicarEstado', { explicacion: 'El diseño terminó a tiempo; la obra inició con 2 días de atraso por lluvia.', causa: 'Temporada de lluvias (riesgo R-001 materializado parcialmente).', planRecuperacion: 'Frentes de trabajo bajo cubierta y jornada extendida los sábados de noviembre.' });

proyecto.resumen = compactarPlan(plan, proyecto.ficha.calendario);
proyecto[MARCA] = true;
if (simular) {
  console.table([{ codigo: proyecto.codigo, portafolio: proyecto.codigoEstrategico, estado: proyecto.estado, tareas: plan.tareas.length, riesgos: plan.riesgos.length, costos: plan.costos.length, historial: eventos.length }]);
  console.table(plan.tareas.map(t => ({ codigo: t.codigo, tarea: t.titulo, inicio: t.inicio, fin: t.fin, estado: t.estado, avance: t.avance })));
  console.log('Simulación correcta: no se escribió nada.');
  process.exit(0);
}
const limpiar = valor => JSON.parse(JSON.stringify(valor));
const refProyecto = coleccion.doc();
const lote = adminDb.batch();
lote.set(refProyecto, limpiar(proyecto));
lote.set(refProyecto.collection('detalle').doc('plan'), limpiar(plan));
const inicio = Date.now() - eventos.length * 1000;
eventos.forEach(([evento, usuario], indice) => lote.set(refProyecto.collection('historial').doc(), limpiar({
  ...evento, usuario: usuario.email, nombreUsuario: usuario.email.includes('.ejemplo@') ? 'Persona de ejemplo' : '', fechaIso: new Date(inicio + indice * 1000).toISOString(),
  fecha: Timestamp.fromMillis(inicio + indice * 1000),
})));
await lote.commit();
console.table([{ codigo: proyecto.codigo, portafolio: proyecto.codigoEstrategico, estado: proyecto.estado, tareas: plan.tareas.length, riesgos: plan.riesgos.length, costos: plan.costos.length, historial: eventos.length }]);
console.log(`Proyecto de ejemplo creado (id ${refProyecto.id}). Para borrarlo: node scripts/proyecto-ejemplo.js --credenciales "..." --borrar`);
process.exit(0);
