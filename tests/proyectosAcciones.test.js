// tests/proyectosAcciones.test.js - Autorización y reglas del servidor de Gestión de Proyectos:
// acceso cruzado, autoaprobación, conflictos de edición, línea base, presupuesto y trazabilidad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accesoModulo, aplicarAccion, crearProyecto } from '../api/_lib/proyectosAcciones.js';

const MODULO = ['gobernanza', 'sub_proyectos'];
const usuario = (email, extra = {}) => ({ email: `${email}@termales.com.co`, rol: 'lider', permisos: MODULO, ...extra });
const DIRECTOR = usuario('director');
const PATROCINADOR = usuario('patrocinador');
const APROBADOR = usuario('aprobador');
const EQUIPO = usuario('equipo');
const LECTOR = usuario('lector');
const AJENO = usuario('ajeno');
const ADMIN = usuario('admin', { rol: 'admin', permisos: [] });
const AUDITOR = usuario('auditor', { rol: 'auditor', permisos: [] });

let secuencia = 0;
const ctx = (persona, hoy = '2026-03-10') => ({ usuario: persona, ahora: `${hoy}T15:00:00.000Z`, hoy, generarId: () => `id${++secuencia}`, codigo: 'PRY-2026-001' });

function nuevoProyecto(extra = {}) {
  return crearProyecto({
    ficha: { nombre: 'Implementación ERP', objetivoGeneral: 'Integrar procesos', metodologia: 'predictiva', prioridad: 'alta', inicioPlanificado: '2026-03-01', finPlanificado: '2026-06-30', ...extra.ficha },
    miembros: { patrocinador: PATROCINADOR.email, aprobadores: [APROBADOR.email], equipo: [EQUIPO.email], lectores: [LECTOR.email] },
    configuracion: extra.configuracion,
  }, ctx(DIRECTOR));
}

/** Ejecuta acciones en cadena como lo haría el endpoint (estado → acción → nuevo estado). */
function sesion(extra) {
  let { proyecto, plan } = nuevoProyecto(extra);
  const eventos = [];
  return {
    get proyecto() { return proyecto; },
    get plan() { return plan; },
    eventos,
    hacer(persona, accion, datos, hoy) {
      const resultado = aplicarAccion(proyecto, plan, accion, datos, ctx(persona, hoy));
      ({ proyecto, plan } = resultado);
      eventos.push(...resultado.eventos);
      return resultado;
    },
  };
}
const tareaBase = extra => ({ titulo: 'Levantar requisitos', tipo: 'actividad', prioridad: 'alta', estado: 'pendiente', avance: 0, inicio: '2026-03-02', fin: '2026-03-06', responsable: EQUIPO.email, ...extra });

test('acceso al módulo: casillas Gobernanza + Gestión de proyectos, o administrador / auditor', () => {
  assert.equal(accesoModulo(usuario('x', { permisos: ['gobernanza'] })), false);
  assert.equal(accesoModulo(usuario('x')), true);
  assert.equal(accesoModulo(ADMIN), true);
  assert.equal(accesoModulo(AUDITOR), true);
  assert.throws(() => crearProyecto({ ficha: {} }, ctx(usuario('x', { permisos: [] }))), { status: 403 });
});

test('crear: el creador queda como director, en estado propuesto y con historial', () => {
  const { proyecto, eventos } = nuevoProyecto();
  assert.equal(proyecto.miembros.director, DIRECTOR.email);
  assert.equal(proyecto.estado, 'propuesto');
  assert.ok(proyecto.correosAcceso.includes(LECTOR.email));
  assert.equal(eventos[0].accion, 'crear');
});

test('acceso cruzado: un ajeno recibe 404 (no se revela que existe) y el lector no edita', () => {
  const s = sesion();
  assert.throws(() => s.hacer(AJENO, 'guardarTarea', { tarea: tareaBase() }), { status: 404 });
  assert.throws(() => s.hacer(LECTOR, 'guardarTarea', { tarea: tareaBase() }), { status: 403 });
  assert.throws(() => s.hacer(AUDITOR, 'guardarTarea', { tarea: tareaBase() }), { status: 403 }, 'el auditor consulta, no gestiona');
  assert.throws(() => s.hacer(usuario('sinmodulo', { permisos: [] }), 'guardarTarea', { tarea: tareaBase() }), { status: 403 });
});

/** Diligencia los apartados 1 a 5 del manual (Estructura inicial) y el código del portafolio. */
function completarPrefactibilidad(s) {
  s.hacer(DIRECTOR, 'editarFicha', { version: s.proyecto.version, miembros: s.proyecto.miembros,
    ficha: { ...s.proyecto.ficha, problema: 'Procesos financieros manuales', pilar: 'E', numPrograma: 1, numSubprograma: 1, numProyecto: 1 } });
  const seccion = (nombre, datos) => s.hacer(DIRECTOR, 'guardarSeccion', { seccion: nombre, datos, versionBase: s.plan.secciones?.[nombre]?.version });
  seccion('alternativas', { lista: [{ nombre: 'ERP en la nube', descripcion: 'Licencia SaaS' }, { nombre: 'ERP propio', descripcion: 'Desarrollo interno' }] });
  seccion('entorno', { descripcion: 'Sede principal, 3 áreas usuarias' });
  seccion('aspectos', { supuestos: 'Disponibilidad del proveedor' });
  seccion('cronogramaFases', { preinversion: { inicio: '2026-01-01', fin: '2026-02-28' }, inversion: { inicio: '2026-03-01', fin: '2026-06-30' }, operacion: { inicio: '2026-07-01', fin: '2026-07-31' } });
}

test('cambios de estado: requisitos del manual, solicitud del director y decisión de otra persona', () => {
  const s = sesion();
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'cerrado', motivo: 'x' }), /No se puede pasar/);
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'planificacion', motivo: 'x' }), /No se puede pasar/, 'no se salta la Factibilidad');
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'factibilidad', motivo: 'x' }), /código del portafolio[\s\S]*Apartado 2/);
  completarPrefactibilidad(s);
  assert.equal(s.proyecto.codigoEstrategico, 'E1_SP1_PY1');
  s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'factibilidad', motivo: 'Estructura inicial lista' });
  assert.equal(s.proyecto.estado, 'propuesto', 'la solicitud no cambia el estado por sí sola');
  const idSolicitud = s.proyecto.solicitudesEstado[0].id;
  assert.throws(() => s.hacer(EQUIPO, 'decidirEstado', { idSolicitud, decision: 'aprobada' }), { status: 403 });
  assert.throws(() => s.hacer(ADMIN, 'decidirEstado', { idSolicitud, decision: 'rechazada' }), /Explica por qué/);
  s.hacer(PATROCINADOR, 'decidirEstado', { idSolicitud, decision: 'aprobada', comentario: 'Acta de aprobación de prefactibilidad' });
  assert.equal(s.proyecto.estado, 'factibilidad');
  assert.throws(() => s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'planificacion', motivo: 'x' }), /Apartado 7\.1 \(Análisis PESTEL\)/);
});

test('autoaprobación: quien solicita un cambio de estado no lo decide, aunque sea administrador', () => {
  const s = sesion();
  completarPrefactibilidad(s);
  s.hacer(ADMIN, 'solicitarEstado', { destino: 'factibilidad', motivo: 'Inicio' });
  assert.throws(() => s.hacer(ADMIN, 'decidirEstado', { idSolicitud: s.proyecto.solicitudesEstado[0].id, decision: 'aprobada', comentario: 'ok' }), /debe decidirla otra persona/);
});

test('flujo configurable: sin aprobación de estados el director cambia directamente (queda en el historial)', () => {
  const s = sesion({ configuracion: { aprobarCambiosEstado: false } });
  completarPrefactibilidad(s);
  s.hacer(DIRECTOR, 'solicitarEstado', { destino: 'factibilidad', motivo: 'Proyecto interno' });
  assert.equal(s.proyecto.estado, 'factibilidad');
  assert.equal(s.eventos.at(-1).accion, 'cambiar-estado');
});

test('tareas: el ejecutor actualiza su avance pero no reprograma ni se autoaprueba', () => {
  const s = sesion();
  const { respuesta } = s.hacer(DIRECTOR, 'guardarTarea', { tarea: tareaBase({ requiereRevision: true, criteriosAceptacion: [{ texto: 'Validado por el área' }] }) });
  const id = respuesta.id;
  const tarea = () => s.plan.tareas.find(item => item.id === id);
  s.hacer(EQUIPO, 'guardarTarea', { tarea: { id, versionBase: tarea().version, estado: 'en_curso', avance: 40, fin: '2026-12-31', responsable: AJENO.email } });
  assert.equal(tarea().avance, 40);
  assert.equal(tarea().fin, '2026-03-06', 'el ejecutor no cambia fechas');
  assert.equal(tarea().responsable, EQUIPO.email, 'ni reasigna');
  assert.equal(tarea().inicioReal, '2026-03-10');
  assert.throws(() => s.hacer(EQUIPO, 'guardarTarea', { tarea: { id, versionBase: tarea().version, estado: 'completada', avance: 100 } }), /requiere revisión/);
  assert.throws(() => s.hacer(EQUIPO, 'guardarTarea', { tarea: { id, versionBase: tarea().version, estado: 'en_revision', avance: 100 } }), /criterio\(s\) de aceptación/);
  s.hacer(EQUIPO, 'guardarTarea', { tarea: { id, versionBase: tarea().version, estado: 'en_revision', criteriosAceptacion: [{ texto: 'Validado por el área', cumplido: true }] } });
  assert.throws(() => s.hacer(EQUIPO, 'revisarTarea', { idTarea: id, versionBase: tarea().version, decision: 'aprobar' }), { status: 403 });
  s.hacer(APROBADOR, 'revisarTarea', { idTarea: id, versionBase: tarea().version, decision: 'devolver', comentario: 'Falta la firma' });
  assert.equal(tarea().estado, 'en_curso');
  assert.equal(tarea().avance, 40, 'al devolver recupera el avance previo');
});

test('concurrencia: guardar sobre una versión vieja de la tarea da 409 y no pisa el cambio', () => {
  const s = sesion();
  const { respuesta } = s.hacer(DIRECTOR, 'guardarTarea', { tarea: tareaBase() });
  const versionVieja = s.plan.tareas[0].version;
  s.hacer(EQUIPO, 'guardarTarea', { tarea: { id: respuesta.id, versionBase: versionVieja, estado: 'en_curso', avance: 10 } });
  assert.throws(() => s.hacer(DIRECTOR, 'guardarTarea', { tarea: { id: respuesta.id, versionBase: versionVieja, titulo: 'Otro título' } }), { status: 409 });
  assert.equal(s.plan.tareas[0].avance, 10);
  assert.throws(() => s.hacer(DIRECTOR, 'editarFicha', { version: 'vieja', ficha: s.proyecto.ficha, miembros: s.proyecto.miembros }), { status: 409 });
});

test('dependencias: un ciclo se rechaza y mover la predecesora reprograma a la sucesora con trazabilidad', () => {
  const s = sesion();
  const a = s.hacer(DIRECTOR, 'guardarTarea', { tarea: tareaBase({ titulo: 'A' }) }).respuesta.id;
  const b = s.hacer(DIRECTOR, 'guardarTarea', { tarea: tareaBase({ titulo: 'B', inicio: '2026-03-09', fin: '2026-03-10', dependencias: [{ id: a }] }) }).respuesta.id;
  const version = id => s.plan.tareas.find(item => item.id === id).version;
  assert.throws(() => s.hacer(DIRECTOR, 'guardarTarea', { tarea: { id: a, versionBase: version(a), dependencias: [{ id: b }] } }), /ciclo imposible/);
  s.hacer(DIRECTOR, 'guardarTarea', { tarea: { id: a, versionBase: version(a), fin: '2026-03-12' } });
  const tareaB = s.plan.tareas.find(item => item.id === b);
  assert.deepEqual([tareaB.inicio, tareaB.fin], ['2026-03-13', '2026-03-14']);
  assert.ok(s.eventos.some(e => e.accion === 'reprogramar-por-dependencia'));
});

test('línea base: la primera la fija el director; las siguientes solo con un cambio aprobado; reprogramar exige motivo', () => {
  const s = sesion();
  const id = s.hacer(DIRECTOR, 'guardarTarea', { tarea: tareaBase() }).respuesta.id;
  s.hacer(DIRECTOR, 'establecerLineaBase', { motivo: 'Plan aprobado' });
  assert.throws(() => s.hacer(DIRECTOR, 'establecerLineaBase', { motivo: 'Nueva' }), /solicitud de cambio aprobada/);
  const version = () => s.plan.tareas[0].version;
  assert.throws(() => s.hacer(DIRECTOR, 'guardarTarea', { tarea: { id, versionBase: version(), fin: '2026-03-20' } }), /motivo de la reprogramación/);
  s.hacer(DIRECTOR, 'guardarTarea', { tarea: { id, versionBase: version(), fin: '2026-03-20', motivo: 'Proveedor retrasado' } });
  assert.equal(s.plan.lineasBase[0].tareas[id].fin, '2026-03-06', 'la línea base aprobada no se sobrescribe');
  assert.equal(s.proyecto.resumen.tareas[0].fb, '2026-03-06');
});

test('cambios: el solicitante no decide; implementar un nuevo presupuesto deja la revisión registrada', () => {
  const s = sesion({ ficha: { manejaPresupuesto: true, presupuestoAprobado: 1000, moneda: 'COP' } });
  s.hacer(EQUIPO, 'guardarCambio', { cambio: { titulo: 'Ampliar alcance', descripcion: 'Módulo extra', justificacion: 'Requisito legal', nuevoPresupuesto: 1500 } });
  const cambio = () => s.plan.cambios[0];
  assert.throws(() => s.hacer(EQUIPO, 'decidirCambio', { id: cambio().id, versionBase: cambio().version, estado: 'aprobada', comentario: 'ok' }), { status: 403 });
  s.hacer(DIRECTOR, 'decidirCambio', { id: cambio().id, versionBase: cambio().version, estado: 'en_analisis', analisis: 'Impacto de 2 semanas' });
  assert.throws(() => s.hacer(DIRECTOR, 'decidirCambio', { id: cambio().id, versionBase: cambio().version, estado: 'aprobada', comentario: 'ok' }), { status: 403 }, 'el director no aprueba cambios');
  s.hacer(PATROCINADOR, 'decidirCambio', { id: cambio().id, versionBase: cambio().version, estado: 'aprobada', comentario: 'Aprobado en comité' });
  s.hacer(DIRECTOR, 'decidirCambio', { id: cambio().id, versionBase: cambio().version, estado: 'implementada' });
  assert.equal(s.proyecto.presupuestoVigente, 1500);
  assert.equal(s.proyecto.ficha.presupuestoAprobado, 1000, 'el presupuesto inicial aprobado se conserva');
  assert.deepEqual(s.plan.revisionesPresupuesto.map(r => [r.anterior, r.nuevo, r.codigoCambio]), [[1000, 1500, 'SC-001']]);
  assert.equal(cambio().decisiones.length, 3);
});

test('entregables: exigen evidencia y no los aprueba quien los presentó', () => {
  const s = sesion();
  s.hacer(DIRECTOR, 'guardarEntregable', { entregable: { nombre: 'Documento de requisitos', responsable: EQUIPO.email, fechaComprometida: '2026-03-15' } });
  const entregable = () => s.plan.entregables[0];
  assert.throws(() => s.hacer(EQUIPO, 'presentarEntregable', { id: entregable().id, versionBase: entregable().version, evidencias: [] }), /al menos una evidencia/);
  assert.throws(() => s.hacer(EQUIPO, 'presentarEntregable', { id: entregable().id, versionBase: entregable().version, evidencias: [{ url: 'javascript:alert(1)' }] }), /http/);
  s.hacer(EQUIPO, 'presentarEntregable', { id: entregable().id, versionBase: entregable().version, evidencias: [{ url: 'https://repos.termalessantarosa.com.co/x.pdf', nombre: 'x.pdf' }] });
  assert.throws(() => s.hacer(EQUIPO, 'decidirEntregable', { id: entregable().id, versionBase: entregable().version, decision: 'aprobado' }), { status: 403 });
  assert.throws(() => s.hacer(APROBADOR, 'decidirEntregable', { id: entregable().id, versionBase: entregable().version, decision: 'rechazado' }), /Explica/);
  s.hacer(APROBADOR, 'decidirEntregable', { id: entregable().id, versionBase: entregable().version, decision: 'aprobado' });
  assert.equal(entregable().estado, 'aprobado');
  assert.equal(entregable().aprobadoPor, APROBADOR.email);
});

test('riesgos y compromisos: nivel calculado, cierre con acciones cumplidas y cumplimiento verificable', () => {
  const s = sesion();
  s.hacer(EQUIPO, 'guardarRiesgo', { riesgo: { tipo: 'riesgo', descripcion: 'Retraso del proveedor', probabilidad: 4, impacto: 5, estado: 'abierto', acciones: [{ descripcion: 'Contrato con multas', responsable: DIRECTOR.email }] } });
  const riesgo = s.plan.riesgos[0];
  assert.equal(riesgo.nivel, 20);
  assert.equal(riesgo.codigo, 'R-001');
  assert.throws(() => s.hacer(DIRECTOR, 'guardarRiesgo', { riesgo: { ...riesgo, versionBase: riesgo.version, estado: 'cerrado' } }), /acciones de tratamiento/);
  s.hacer(DIRECTOR, 'guardarReunion', { reunion: { titulo: 'Seguimiento semanal', fecha: '2026-03-10', compromisos: [{ descripcion: 'Enviar cronograma', responsable: EQUIPO.email, fechaLimite: '2026-03-12' }] } });
  const reunion = s.plan.reuniones[0];
  const compromiso = reunion.compromisos[0];
  assert.throws(() => s.hacer(EQUIPO, 'actualizarCompromiso', { idReunion: reunion.id, idCompromiso: compromiso.id, estado: 'cumplido' }), /cómo se cumplió/);
  s.hacer(EQUIPO, 'actualizarCompromiso', { idReunion: reunion.id, idCompromiso: compromiso.id, estado: 'cumplido', comentario: 'Enviado por correo' }, '2026-03-11');
  assert.equal(s.plan.reuniones[0].compromisos[0].fechaCumplimiento, '2026-03-11');
  assert.throws(() => s.hacer(DIRECTOR, 'guardarReunion', { reunion: { ...s.plan.reuniones[0], versionBase: s.plan.reuniones[0].version, compromisos: [] } }), /ya tiene seguimiento/);
});

test('finanzas: solo con presupuesto; costos reales y comprometidos separados; anular exige motivo', () => {
  const sinPresupuesto = sesion();
  assert.throws(() => sinPresupuesto.hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-03-05', tipo: 'real', categoria: 'servicios', monto: 10, descripcion: 'x' } }), /no maneja presupuesto/);
  const s = sesion({ ficha: { manejaPresupuesto: true, presupuestoAprobado: 1000, moneda: 'COP' } });
  s.hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-03-05', tipo: 'real', categoria: 'servicios', monto: 300, descripcion: 'Consultoría' } });
  s.hacer(DIRECTOR, 'registrarCosto', { costo: { fecha: '2026-03-05', tipo: 'comprometido', categoria: 'tecnologia', monto: 200, descripcion: 'Licencias' } });
  assert.deepEqual([s.proyecto.resumen.finanzas.real, s.proyecto.resumen.finanzas.comprometido], [300, 200]);
  const costo = s.plan.costos[0];
  assert.throws(() => s.hacer(DIRECTOR, 'anularCosto', { id: costo.id, versionBase: costo.version }), /Explica/);
  s.hacer(DIRECTOR, 'anularCosto', { id: costo.id, versionBase: costo.version, motivo: 'Duplicado' });
  assert.equal(s.proyecto.resumen.finanzas.real, 0);
  assert.equal(s.plan.costos.length, 2, 'el costo anulado se conserva');
  const enEjecucion = { ...s.proyecto, estado: 'ejecucion' };
  assert.throws(() => aplicarAccion(enEjecucion, s.plan, 'editarFicha', { version: enEjecucion.version, ficha: { ...enEjecucion.ficha, presupuestoAprobado: 5000 }, miembros: enEjecucion.miembros }, ctx(DIRECTOR)),
    /solicitud de cambio con el nuevo presupuesto/, 'en ejecución el presupuesto solo cambia con un cambio aprobado');
});

test('ficha: el director no cambia al patrocinador ni a sí mismo; el administrador sí', () => {
  const s = sesion();
  const ficha = s.proyecto.ficha;
  assert.throws(() => s.hacer(DIRECTOR, 'editarFicha', { version: s.proyecto.version, ficha, miembros: { ...s.proyecto.miembros, patrocinador: EQUIPO.email } }), /patrocinador/);
  s.hacer(ADMIN, 'editarFicha', { version: s.proyecto.version, ficha, miembros: { ...s.proyecto.miembros, patrocinador: EQUIPO.email } });
  assert.equal(s.proyecto.miembros.patrocinador, EQUIPO.email);
  assert.ok(s.eventos.at(-1).antes.miembros, 'el historial guarda el valor anterior');
});

test('el endpoint usa la sesión del servidor, transacciones y registra el historial solo desde el backend', () => {
  const endpoint = readFileSync(new URL('../api/_grc/proyectos.js', import.meta.url), 'utf8');
  assert.match(endpoint, /requireAuth\(req, res\)/);
  assert.match(endpoint, /runTransaction/);
  assert.match(endpoint, /FieldValue\.serverTimestamp\(\)/);
  assert.match(endpoint, /array-contains/);
  assert.match(readFileSync(new URL('../api/index.js', import.meta.url), 'utf8'), /'\/api\/grc\/proyectos'/);
  const reglas = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(reglas, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/, 'el navegador no lee ni escribe proyectos directamente');
});
