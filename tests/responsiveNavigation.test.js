import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/SidebarNavigation.jsx', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('  const navigateTo ='), source.indexOf('  // 🔔'));

function navigation({ allowed = true, openMenu = null } = {}) {
  const events = [];
  const bindings = {
    guardNavigation: callback => { if (allowed) callback(); return allowed; },
    setActiveTab: tab => events.push(['tab', tab]),
    onCloseMobileNavigation: () => events.push(['close']),
    menuAbierto: openMenu,
    setMenuAbierto: menu => events.push(['menu', menu]),
  };
  const actions = new Function(...Object.keys(bindings), `${handlers}\nreturn { navigateTo, toggleMenuAndNavigate };`)(...Object.values(bindings));
  return { ...actions, events };
}

test('abrir un grupo conserva el menú móvil para poder elegir un submódulo', () => {
  const nav = navigation();
  nav.toggleMenuAndNavigate('planes', 'planes_tab', () => nav.events.push(['subtab', 'planes']));
  assert.deepEqual(nav.events, [['menu', 'planes'], ['subtab', 'planes'], ['tab', 'planes_tab']]);
});

test('elegir un submódulo cierra el menú después de navegar', () => {
  const nav = navigation();
  nav.navigateTo('planes_tab', () => nav.events.push(['subtab', 'reporte360']));
  assert.deepEqual(nav.events, [['subtab', 'reporte360'], ['tab', 'planes_tab'], ['close']]);
});

test('cancelar la salida por cambios sin guardar conserva el menú y la vista', () => {
  const nav = navigation({ allowed: false });
  assert.equal(nav.navigateTo('planes_tab'), false);
  nav.toggleMenuAndNavigate('planes', 'planes_tab');
  assert.deepEqual(nav.events, []);
});

test('contraer un grupo no navega ni cierra el menú móvil', () => {
  const nav = navigation({ openMenu: 'planes' });
  nav.toggleMenuAndNavigate('planes', 'planes_tab');
  assert.deepEqual(nav.events, [['menu', null]]);
});
