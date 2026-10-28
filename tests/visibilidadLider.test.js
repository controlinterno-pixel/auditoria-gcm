// tests/visibilidadLider.test.js - Qué informes, hallazgos y planes recibe un líder de proceso: completo lo de su
// alcance, lo que creó y donde fue nombrado; los demás hallazgos de sus informes, solo como contexto bloqueado.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { visibilidadLider } from '../src/utils/visibilidadLider.js';

const mapaProcesos = {
  'Gestión de servicio al cliente': ['Atención al usuario', 'PQRS'],
  'Gestión de talento humano': ['Nómina', 'Selección'],
  'Gestión comercial y mercadeo': ['Ventas'],
};
const lider = {
  rol: 'lider', email: 'lider@termales.com.co', cargo: 'Coordinador de PQRS',
  procesosAsignados: ['gestion de servicio al cliente'], subprocesosAsignados: ['pqrs'],
};
const informes = [
  { id: 'INF-SC', macroprocesos: ['Gestión de servicio al cliente', 'Gestión de talento humano'],
    subprocesosPorMacroproceso: { 'Gestión de servicio al cliente': ['PQRS'], 'Gestión de talento humano': ['Nómina'] } },
  { id: 'INF-TH', proceso: 'Gestión de talento humano', subproceso: 'Nómina' },
  { id: 'INF-COM', proceso: 'Gestión comercial y mercadeo', subproceso: 'Ventas' },
  { id: 'INF-AJENO', proceso: 'Gestión comercial y mercadeo', subproceso: 'Ventas' },
];
const hallazgos = [
  { id: 'H-PQRS', idInforme: 'INF-SC', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS', titulo: 'Propio', descripcion: 'detalle' },
  { id: 'H-NOM', idInforme: 'INF-SC', proceso: 'Gestión de talento humano', subproceso: 'Nómina', titulo: 'Ajeno', descripcion: 'detalle privado', responsable: 'Jefe de nómina', evidenciaUrl: 'https://x' },
  { id: 'H-ATN', idInforme: 'INF-SC', proceso: 'Gestión de servicio al cliente', subproceso: 'Atención al usuario', titulo: 'Otro subproceso' },
  { id: 'H-TH-REV', idInforme: 'INF-TH', proceso: 'Gestión de talento humano', subproceso: 'Nómina', titulo: 'Revisor' },
  { id: 'H-TH-OTRO', idInforme: 'INF-TH', proceso: 'Gestión de talento humano', subproceso: 'Selección', titulo: 'Contexto' },
  { id: 'H-COM-CARGO', idInforme: 'INF-COM', proceso: 'Gestión comercial y mercadeo', subproceso: 'Ventas', responsable: 'Gerente comercial, Coordinador de PQRS' },
  { id: 'H-AJENO', idInforme: 'INF-AJENO', proceso: 'Gestión comercial y mercadeo', subproceso: 'Ventas' },
];
const planes = [
  { id: 'P-PQRS', idHallazgo: 'H-PQRS', proceso: 'Gestión de servicio al cliente', subproceso: 'PQRS' },
  { id: 'P-NOM', idHallazgo: 'H-NOM', proceso: 'Gestión de talento humano', subproceso: 'Nómina' },
  { id: 'P-REV', idHallazgo: 'H-TH-REV', proceso: 'Gestión de talento humano', subproceso: 'Nómina', correoRevisor: 'LIDER@termales.com.co' },
  { id: 'P-SIN-PROCESO', idHallazgo: 'H-PQRS' },
];
const visto = (extra = {}) => visibilidadLider({ informes, hallazgos, planes, perfil: lider, mapaProcesos, ...extra });
const ids = lista => lista.map(registro => registro.id).sort();
const porId = (lista, id) => lista.find(registro => registro.id === id);

test('informes: los de su alcance y el informe completo de cada hallazgo o plan donde fue nombrado', () => {
  assert.deepEqual(ids(visto().informes), ['INF-COM', 'INF-SC', 'INF-TH']);
});

test('hallazgos: completos los suyos; los demás de esos informes llegan solo con el encabezado', () => {
  const { hallazgos: recibidos } = visto();
  assert.equal(porId(recibidos, 'H-AJENO'), undefined, 'un informe ajeno no aparece');
  assert.equal(porId(recibidos, 'H-PQRS').soloContexto, undefined);
  assert.equal(porId(recibidos, 'H-PQRS').descripcion, 'detalle');
  for (const id of ['H-NOM', 'H-ATN', 'H-TH-OTRO']) assert.equal(porId(recibidos, id).soloContexto, true, id);
  const contexto = porId(recibidos, 'H-NOM');
  assert.equal(contexto.titulo, 'Ajeno');
  for (const campo of ['descripcion', 'responsable', 'evidenciaUrl']) assert.equal(contexto[campo], undefined, `${campo} no sale del servidor`);
});

test('nombrado: como revisor de una acción o por su cargo en Responsable, el hallazgo llega completo y resaltado', () => {
  const { hallazgos: recibidos } = visto();
  assert.equal(porId(recibidos, 'H-TH-REV').nombradoUsuario, true);
  assert.equal(porId(recibidos, 'H-TH-REV').soloContexto, undefined);
  assert.equal(porId(recibidos, 'H-COM-CARGO').nombradoUsuario, true);
  assert.equal(porId(recibidos, 'H-PQRS').nombradoUsuario, undefined, 'de su alcance sin nombramiento: normal, sin resaltar');
});

test('planes: los de su alcance y donde está nombrado; no los de hallazgos ajenos', () => {
  assert.deepEqual(ids(visto().planes), ['P-PQRS', 'P-REV', 'P-SIN-PROCESO']);
  const conCreador = visto({ planes: [...planes, { id: 'P-CREADO', idHallazgo: 'H-AJENO', proceso: 'Gestión comercial y mercadeo', correoCreador: 'lider@termales.com.co' }] });
  assert.ok(ids(conCreador.planes).includes('P-CREADO'), 'el plan que creó');
  assert.ok(ids(conCreador.informes).includes('INF-AJENO'), 'y el informe de ese plan');
});

test('lo que crea el líder le aparece completo', () => {
  const informesConCreado = [...informes, { id: 'INF-CREADO', proceso: 'Gestión comercial y mercadeo', creadoPor: 'lider@termales.com.co' }];
  const hallazgosConCreado = [...hallazgos,
    { id: 'H-DEL-CREADO', idInforme: 'INF-CREADO', proceso: 'Gestión comercial y mercadeo', subproceso: 'Ventas', descripcion: 'completo' }];
  const planesConCreado = [...planes, { id: 'P-DEL-CREADO', idHallazgo: 'H-DEL-CREADO', proceso: 'Gestión comercial y mercadeo' }];
  const r = visto({ informes: informesConCreado, hallazgos: hallazgosConCreado, planes: planesConCreado });
  assert.ok(ids(r.informes).includes('INF-CREADO'));
  assert.equal(porId(r.hallazgos, 'H-DEL-CREADO').descripcion, 'completo', 'hallazgos de su informe: completos');
  assert.ok(ids(r.planes).includes('P-DEL-CREADO'));

  const hallazgoCreado = { id: 'H-CREADO', idInforme: 'INF-AJENO', proceso: 'Gestión comercial y mercadeo', correoCreador: 'lider@termales.com.co' };
  const r2 = visto({ hallazgos: [...hallazgos, hallazgoCreado], planes: [...planes, { id: 'P-H-CREADO', idHallazgo: 'H-CREADO', proceso: 'Gestión comercial y mercadeo' }] });
  assert.equal(porId(r2.hallazgos, 'H-CREADO').nombradoUsuario, true);
  assert.ok(ids(r2.planes).includes('P-H-CREADO'), 'planes del hallazgo que creó');
});

test('el servidor aplica la regla solo al rol lider y la pantalla bloquea el contexto', () => {
  const sync = readFileSync(new URL('../api/_grc/sync.js', import.meta.url), 'utf8');
  assert.match(sync, /if \(normalizarProceso\(user\.rol\) === 'lider'\) \{\s+const visibles = visibilidadLider\(/);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /const safeHallazgos = useMemo\(\(\) => hallazgosRecibidos\.filter\(hallazgo => !hallazgo\?\.soloContexto\)/);
  const pantalla = readFileSync(new URL('../src/components/Hallazgos.jsx', import.meta.url), 'utf8');
  assert.match(pantalla, /h\.soloContexto \? \(\s+<tr[^>]*aria-disabled="true" className="hallazgo-bloqueado"/);
  assert.match(pantalla, /h\.nombradoUsuario \? 'hallazgo-nombrado'/);
  // Editar un hallazgo ajeno lo rechaza el servidor: solo su creador (o un administrador) puede hacerlo.
  const update = readFileSync(new URL('../api/_grc/update.js', import.meta.url), 'utf8');
  assert.match(update, /if \(!admin && autor !== normalizar\(user\.email\)\) return \{ error: 'forbidden' \};/);
});
