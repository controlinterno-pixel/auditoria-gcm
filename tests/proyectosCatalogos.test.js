// tests/proyectosCatalogos.test.js - Interesados y participantes de los proyectos se eligen del catálogo de
// Cargos y Procesos (cargos de la empresa u organizaciones externas); lo que no existe se crea primero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buscarEnCatalogo, faltantesEnCatalogo, mensajeFaltantes } from '../src/utils/proyectos/catalogos.js';
import { validarDatosSync } from '../api/_lib/validation.js';
import { aplicarAccion } from '../api/_lib/proyectosAcciones.js';

const catalogo = { cargos: ['Gerente General', 'Director de Operaciones'], organizaciones: ['CARDER', 'Junta de Acción Comunal'], inicializado: true };

test('el valor se reconoce sin importar tildes, mayúsculas ni espacios', () => {
  assert.equal(buscarEnCatalogo('  gerente   general ', catalogo.cargos), 'Gerente General');
  assert.equal(buscarEnCatalogo('Junta de Accion Comunal', catalogo.organizaciones), 'Junta de Acción Comunal');
  assert.equal(buscarEnCatalogo('Alcaldía', catalogo.organizaciones), null);
  assert.equal(buscarEnCatalogo('', catalogo.cargos), null);
});

test('interesados: los internos son cargos, los externos organizaciones, y el responsable es un cargo', () => {
  const datos = { lista: [
    { tipo: 'interno', nombre: 'Gerente General', responsable: 'Director de Operaciones' },
    { tipo: 'externo', nombre: 'CARDER', contacto: 'Subdirector ambiental', responsable: 'Director de Operaciones' },
    { tipo: 'externo', nombre: 'Alcaldía de Santa Rosa', responsable: 'Jefe de Prensa' },
    { tipo: 'interno', nombre: 'CARDER' },
  ] };
  assert.deepEqual(faltantesEnCatalogo('interesados', datos, catalogo).map(item => [item.valor, item.tipo]), [
    ['Alcaldía de Santa Rosa', 'organizacion'], ['Jefe de Prensa', 'cargo'], ['CARDER', 'cargo'],
  ]);
  const mensaje = mensajeFaltantes(faltantesEnCatalogo('interesados', datos, catalogo));
  assert.match(mensaje, /No están en el catálogo de cargos: «Jefe de Prensa», «CARDER»\. Créalos en Informes y Hallazgos → Cargos y Procesos → Cargos y correos\./);
  assert.match(mensaje, /No están en el catálogo de organizaciones: «Alcaldía de Santa Rosa»\. Créalas en .*Organizaciones externas\. Luego vuelve y guarda el apartado\.$/);
  assert.equal(mensajeFaltantes(faltantesEnCatalogo('interesados', { lista: datos.lista.slice(0, 2) }, catalogo)), '', 'todo existe: se puede guardar');
});

test('organigrama: un rol de otra organización exige la organización; uno de la empresa, el cargo', () => {
  const datos = { roles: [
    { rol: 'Director', persona: 'Director de Operaciones' },
    { rol: 'Contratista', origen: 'externa', organizacion: 'Constructora Andina', persona: 'Residente de obra' },
    { rol: 'Interventoría', origen: 'externa', organizacion: 'CARDER', persona: 'Ingeniero' },
  ] };
  assert.deepEqual(faltantesEnCatalogo('organigrama', datos, catalogo).map(item => item.valor), ['Constructora Andina']);
});

test('sin catálogo inicializado no se bloquea nada (no habría de dónde elegir)', () => {
  assert.deepEqual(faltantesEnCatalogo('interesados', { lista: [{ nombre: 'Cualquiera' }] }, { ...catalogo, inicializado: false }), []);
});

test('el catálogo de organizaciones externas se guarda y se entrega como las sedes', () => {
  assert.equal(validarDatosSync({ organizacionesExternas: ['CARDER'], sedesEmpresa: ['Hotel'] }).valido, true);
  assert.equal(validarDatosSync({ organizacionesExternas: [{ nombre: 'CARDER' }] }).valido, false, 'solo textos');
  const sync = readFileSync(new URL('../api/_grc/sync.js', import.meta.url), 'utf8');
  assert.match(sync, /organizacionesExternas: Array\.isArray\(data\.organizacionesExternas\) \? data\.organizacionesExternas : \[\]/, 'en la lista blanca de lectura');
  const pantalla = readFileSync(new URL('../src/components/CargosProcesos.jsx', import.meta.url), 'utf8');
  assert.match(pantalla, />Organizaciones externas<\/button>/);
  assert.match(pantalla, /onSaveCatalogos\(cargos, procesos, sedes, organizaciones, roles\)/);
});

test('el servidor conserva el contacto del interesado y la organización del rol', () => {
  const proyecto = { estado: 'planificacion', ficha: { calendario: 'laboral' }, miembros: { director: 'dir@termales.com.co' }, version: 'v1' };
  const ctx = { usuario: { email: 'dir@termales.com.co', rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'] }, ahora: '2026-10-27T12:00:00.000Z', hoy: '2026-10-27', generarId: () => 'id1', codigo: 'PRY-1' };
  const conInteresado = aplicarAccion(proyecto, {}, 'guardarSeccion', { seccion: 'interesados', datos: { lista: [{ tipo: 'externo', nombre: 'CARDER', contacto: 'Subdirector ambiental', poder: 5, interes: 3, actitud: 'neutral' }] } }, ctx);
  assert.equal(conInteresado.plan.secciones.interesados.datos.lista[0].contacto, 'Subdirector ambiental');
  const conRol = aplicarAccion(proyecto, {}, 'guardarSeccion', { seccion: 'organigrama', datos: { roles: [{ fase: 'inversion', rol: 'Contratista', origen: 'externa', organizacion: 'Constructora Andina', persona: 'Residente', nivel: 'operativo' }] } }, ctx);
  assert.deepEqual([conRol.plan.secciones.organigrama.datos.roles[0].origen, conRol.plan.secciones.organigrama.datos.roles[0].organizacion], ['externa', 'Constructora Andina']);
});

test('el proyecto Ejemplo usa cargos del catálogo base y, con sus organizaciones creadas, no muestra avisos', async () => {
  const { ajustarEjemploACatalogo, ORGANIZACIONES_EJEMPLO } = await import('../scripts/catalogoEjemplo.js');
  const { CARGOS_EMPRESA, CARGOS_POR_SEDE } = await import('../src/constants/diccionariosGRC.js');
  const cargos = [...new Set([...CARGOS_EMPRESA, ...Object.values(CARGOS_POR_SEDE).flat()])];
  const sinOrganizaciones = ajustarEjemploACatalogo({ cargos, organizaciones: [] });
  assert.deepEqual(sinOrganizaciones.faltan.filter(item => item.startsWith('cargo')), [], 'todos los cargos existen en el catálogo base');
  const completo = ajustarEjemploACatalogo({ cargos, organizaciones: Object.values(ORGANIZACIONES_EJEMPLO) });
  assert.deepEqual(completo.faltan, []);
  const contexto = { cargos, organizaciones: Object.values(ORGANIZACIONES_EJEMPLO), inicializado: true };
  assert.deepEqual(faltantesEnCatalogo('interesados', completo.interesados, contexto), []);
  assert.deepEqual(faltantesEnCatalogo('organigrama', completo.organigrama, contexto), []);
  assert.equal(completo.organigrama.roles.find(rol => rol.origen === 'externa').organizacion, ORGANIZACIONES_EJEMPLO.contratista);
});

test('roles de proyecto: los del manual rigen hasta que se administre el catálogo', async () => {
  const { ROLES_BASE, rolesVigentes, buscarRol, erroresRol } = await import('../src/utils/proyectos/rolesProyecto.js');
  const nombres = ROLES_BASE.map(rol => rol.nombre);
  ['Patrocinador', 'Comité de I+D+i / Comité Estratégico', 'Gerencia Administrativa y Judicial', 'Director del proyecto', 'Comité de seguimiento', 'Contratista', 'Área de operación']
    .forEach(nombre => assert.ok(nombres.includes(nombre), nombre));
  assert.ok(!nombres.some(nombre => /Judicial y Financiera/.test(nombre)), 'solo existe la Gerencia Administrativa y Judicial');
  assert.ok(ROLES_BASE.every(rol => rol.descripcion && /E-ID-MAN-01/.test(rol.referencia)), 'cada rol dice qué hace y dónde lo pide el manual');
  assert.equal(buscarRol('contratista', ROLES_BASE).origen, 'externa');
  assert.equal(rolesVigentes(null).length, ROLES_BASE.length, 'sin catálogo guardado: los del manual');
  assert.deepEqual(rolesVigentes([{ id: 'a', nombre: 'Interventoría', nivel: 'tactico', origen: 'externa' }, { id: 'b', nombre: 'Patrocinador', activo: false }]).map(rol => rol.nombre), ['Interventoría'], 'guardado: solo los activos');
  assert.equal(erroresRol({ id: 'x', nombre: 'patrocinador', nivel: 'tactico', origen: 'empresa' }, ROLES_BASE), 'Ya existe un rol con ese nombre.');
  assert.equal(erroresRol({ nombre: 'Interventoría', nivel: 'tactico', origen: 'externa' }, ROLES_BASE), '');
  assert.equal(validarDatosSync({ rolesProyecto: ROLES_BASE }).valido, true);
  const sync = readFileSync(new URL('../api/_grc/sync.js', import.meta.url), 'utf8');
  assert.match(sync, /Array\.isArray\(data\.rolesProyecto\) \? \{ rolesProyecto: data\.rolesProyecto \} : \{\}/);
  const pantalla = readFileSync(new URL('../src/components/CargosProcesos.jsx', import.meta.url), 'utf8');
  assert.match(pantalla, />Roles de proyecto<\/button>/);
});

test('el servidor conserva el rol escrito a mano ("Otro")', () => {
  const proyecto = { estado: 'planificacion', ficha: { calendario: 'laboral' }, miembros: { director: 'dir@termales.com.co' }, version: 'v1' };
  const ctx = { usuario: { email: 'dir@termales.com.co', rol: 'lider', permisos: ['gobernanza', 'sub_proyectos'] }, ahora: '2026-10-27T12:00:00.000Z', hoy: '2026-10-27', generarId: () => 'id1', codigo: 'PRY-1' };
  const resultado = aplicarAccion(proyecto, {}, 'guardarSeccion', { seccion: 'organigrama', datos: { roles: [{ fase: 'inversion', rol: 'Residente de obra', rolLibre: true, origen: 'externa', organizacion: 'Constructora', persona: 'Ingeniero', nivel: 'operativo', reportaA: 'Director del proyecto' }] } }, ctx);
  const rol = resultado.plan.secciones.organigrama.datos.roles[0];
  assert.deepEqual([rol.rol, rol.rolLibre, rol.reportaA], ['Residente de obra', true, 'Director del proyecto']);
});

test('los roles del organigrama del Ejemplo son del catálogo de roles del manual', async () => {
  const { ajustarEjemploACatalogo } = await import('../scripts/catalogoEjemplo.js');
  const { ROLES_BASE, buscarRol } = await import('../src/utils/proyectos/rolesProyecto.js');
  const { organigrama } = ajustarEjemploACatalogo({});
  organigrama.roles.forEach(rol => {
    const delCatalogo = buscarRol(rol.rol, ROLES_BASE);
    assert.ok(delCatalogo, rol.rol);
    assert.equal(rol.origen, delCatalogo.origen, `${rol.rol}: pertenece a`);
    if (rol.reportaA) assert.ok(organigrama.roles.some(otro => otro.rol === rol.reportaA), `${rol.rol} reporta a un rol del organigrama`);
  });
});
