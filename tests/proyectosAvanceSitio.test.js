// tests/proyectosAvanceSitio.test.js - Reportes fotográficos de avance en sitio: quién los sube, qué exigen y
// cómo se oculta uno equivocado sin borrarlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarAccion, capacidades } from '../api/_lib/proyectosAcciones.js';
import { correosConAcceso, validarMiembros } from '../src/utils/proyectos/modelo.js';

const DIRECTOR = { email: 'director@termales.com.co', rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'] };
const RESIDENTE = { email: 'residente@termales.com.co', rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'] };
const LECTOR = { email: 'lector@termales.com.co', rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'] };
const proyecto = {
  estado: 'ejecucion', version: 'v1', ficha: { calendario: 'laboral' },
  miembros: { director: DIRECTOR.email, lectores: [LECTOR.email], reportanAvance: [RESIDENTE.email] },
};
const plan = { tareas: [{ id: 't1', codigo: 'T-001', titulo: 'Adecuación del sendero', tipo: 'actividad', estado: 'en_curso', avance: 40 }] };
let n = 0;
const ctx = usuario => ({ usuario, ahora: '2026-10-27T15:00:00.000Z', hoy: '2026-10-27', generarId: () => `id${++n}`, codigo: 'PRY-1' });
const foto = { url: 'https://repos.termalessantarosa.com.co/archivos/controlInterno/obra1.jpg', nombre: 'obra1.jpg' };
const reporte = { fecha: '2026-10-26', titulo: 'Tramo norte terminado', frente: 'Tramo norte', idTarea: 't1', avanceFisico: 55, fotos: [foto] };

test('la lista "Reportan avance en sitio" da acceso al proyecto y solo permite reportar', () => {
  const { miembros, errores } = validarMiembros({ director: DIRECTOR.email, reportanAvance: 'residente@termales.com.co, otro@gmail.com' });
  assert.deepEqual(miembros.reportanAvance, ['residente@termales.com.co', 'otro@gmail.com']);
  assert.match(errores.join(' '), /otro@gmail\.com/, 'solo correos de la empresa');
  assert.ok(correosConAcceso(proyecto.miembros).includes(RESIDENTE.email), 've el proyecto en su portafolio');
  const cap = capacidades(RESIDENTE, proyecto);
  assert.deepEqual([cap.ver, cap.reportarAvance, cap.gestionar, cap.aportar], [true, true, false, false]);
  assert.equal(capacidades(LECTOR, proyecto).reportarAvance, false);
  assert.equal(capacidades(DIRECTOR, proyecto).reportarAvance, true, 'el director siempre puede');
  assert.equal(capacidades(RESIDENTE, { ...proyecto, estado: 'cerrado' }).reportarAvance, false, 'un proyecto cerrado no recibe reportes');
});

test('un autorizado publica un reporte con fotos, fecha y actividad; queda en el historial', () => {
  const resultado = aplicarAccion(proyecto, plan, 'registrarAvanceSitio', { reporte }, ctx(RESIDENTE));
  const guardado = resultado.plan.avancesSitio[0];
  assert.equal(guardado.codigo, 'AS-001');
  assert.deepEqual([guardado.reportadoPor, guardado.frente, guardado.idTarea, guardado.avanceFisico, guardado.fotos.length], [RESIDENTE.email, 'Tramo norte', 't1', 55, 1]);
  assert.equal(resultado.eventos[0].accion, 'reportar-avance-sitio');
  assert.equal(resultado.plan.tareas[0].avance, 40, 'reportar no cambia el avance del cronograma');
});

test('reglas del reporte: con foto, sin fecha futura, actividad existente y % entero', () => {
  const intentar = (cambios, usuario = RESIDENTE) => () => aplicarAccion(proyecto, plan, 'registrarAvanceSitio', { reporte: { ...reporte, ...cambios } }, ctx(usuario));
  assert.throws(intentar({ fotos: [] }), /al menos una foto/);
  assert.throws(intentar({ fecha: '2026-10-28' }), /no puede ser futura/);
  assert.throws(intentar({ titulo: '' }), /qué muestra el reporte/);
  assert.throws(intentar({ idTarea: 'no-existe' }), /no existe en el cronograma/);
  assert.throws(intentar({ avanceFisico: 120 }), /entre 0 y 100/);
  assert.throws(intentar({ fotos: [{ url: 'javascript:alert(1)' }] }), /deben empezar por http/);
  assert.throws(intentar({}, LECTOR), /personas autorizadas/);
});

test('el director oculta un reporte equivocado con motivo; no se borra', () => {
  const conReporte = aplicarAccion(proyecto, plan, 'registrarAvanceSitio', { reporte }, ctx(RESIDENTE)).plan;
  const guardado = conReporte.avancesSitio[0];
  assert.throws(() => aplicarAccion(proyecto, conReporte, 'ocultarAvanceSitio', { id: guardado.id, versionBase: guardado.version, motivo: 'Fotos de otro proyecto' }, ctx(RESIDENTE)), /Solo el director/);
  assert.throws(() => aplicarAccion(proyecto, conReporte, 'ocultarAvanceSitio', { id: guardado.id, versionBase: guardado.version, motivo: 'error' }, ctx(DIRECTOR)), /al menos 10 caracteres/);
  const resultado = aplicarAccion(proyecto, conReporte, 'ocultarAvanceSitio', { id: guardado.id, versionBase: guardado.version, motivo: 'Fotos de otro proyecto' }, ctx(DIRECTOR));
  assert.equal(resultado.plan.avancesSitio.length, 1, 'se conserva');
  assert.deepEqual([resultado.plan.avancesSitio[0].oculto.motivo, resultado.plan.avancesSitio[0].oculto.por], ['Fotos de otro proyecto', DIRECTOR.email]);
  assert.equal(resultado.eventos[0].accion, 'ocultar-avance-sitio');
});
