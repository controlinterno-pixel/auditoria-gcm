// tests/securityRetest.test.js - Correcciones del informe "Retest 2 de Seguridad" (sin Firebase real)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizarUrls, validarDatosSync, esUrlPermitida } from '../api/_lib/validation.js';
import { applyCors } from '../api/_lib/cors.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// H10: lista blanca de claves y tipos en POST /api/grc/sync.
assert.equal(validarDatosSync({ riesgos: [{ id: 1 }], riesgosReemplazoTotal: true }).valido, true);
assert.equal(validarDatosSync({ mapaProcesos: { A: ['x'] }, catalogosInicializados: true, sedesEmpresa: ['Hotel'] }).valido, true);
assert.equal(validarDatosSync({ informesEliminados: ['i1'], planes: [] }).valido, true);
assert.match(validarDatosSync({ rol: 'admin' }).error, /no permitidos: rol/);
assert.match(validarDatosSync({ riesgos: [{ id: 1 }], usuarios: [] }).error, /usuarios/);
assert.match(validarDatosSync({ riesgos: 'texto' }).error, /Formato inválido en: riesgos/);
assert.match(validarDatosSync({ catalogosInicializados: 'true' }).error, /catalogosInicializados/);
assert.match(validarDatosSync({ planes: ['no-es-objeto'] }).error, /planes/);
assert.equal(validarDatosSync([]).valido, false);
assert.equal(validarDatosSync({}).valido, false);

// H13: solo enlaces http/https en campos de URL, también anidados.
assert.equal(esUrlPermitida('https://repos.termalessantarosa.com.co/x.pdf'), true);
assert.equal(esUrlPermitida('javascript:alert(1)'), false);
const limpio = sanitizarUrls({
  evidenciaUrl: 'javascript:alert(1)',
  actaUrl: 'https://repos.termalessantarosa.com.co/acta.pdf',
  titulo: 'javascript: no es un campo URL',
  evidencias: [{ url: 'data:text/html;base64,PHNjcmlwdD4=', nombre: 'a' }, { url: 'http://ejemplo.test/b' }],
  vacio: { presentacionUrl: '' },
});
assert.equal(limpio.evidenciaUrl, '');
assert.equal(limpio.actaUrl, 'https://repos.termalessantarosa.com.co/acta.pdf');
assert.equal(limpio.titulo, 'javascript: no es un campo URL', 'solo se tocan campos cuyo nombre contiene "url"');
assert.equal(limpio.evidencias[0].url, '');
assert.equal(limpio.evidencias[0].nombre, 'a');
assert.equal(limpio.evidencias[1].url, 'http://ejemplo.test/b');
assert.equal(limpio.vacio.presentacionUrl, '');

// N3: nunca '*' con credenciales; solo orígenes de la lista blanca reciben cabeceras CORS.
const respuesta = () => {
  const headers = {};
  return { headers, setHeader: (k, v) => { headers[k] = v; }, status() { return this; }, end() {} };
};
for (const origin of [undefined, 'https://atacante.example']) {
  const res = respuesta();
  applyCors({ headers: origin ? { origin } : {}, method: 'GET' }, res);
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined, `sin ACAO para ${origin || 'sin origen'}`);
  assert.equal(res.headers['Access-Control-Allow-Credentials'], undefined);
}
const permitido = respuesta();
applyCors({ headers: { origin: 'https://auditoria-gcm.vercel.app' }, method: 'GET' }, permitido);
assert.equal(permitido.headers['Access-Control-Allow-Origin'], 'https://auditoria-gcm.vercel.app');
assert.equal(permitido.headers['Access-Control-Allow-Credentials'], 'true');

// Contratos de código del retest.
const sync = read('../api/_grc/sync.js');
assert.ok(sync.includes('validarDatosSync(req.body?.partialData)'), 'H10: el POST valida el esquema');
assert.ok(sync.includes('sanitizarUrls(req.body.partialData)'), 'H13: el POST limpia URLs');
const bloqueRls = sync.slice(sync.indexOf('const filteredData = {'), sync.indexOf('logger.info(\'Datos entregados'));
assert.equal(bloqueRls.includes('...data'), false, 'H4: la respuesta RLS no copia todo el documento');
for (const archivo of ['update', 'create', 'riesgos']) {
  assert.ok(read(`../api/_grc/${archivo}.js`).includes('sanitizarUrls(req.body'), `H13: ${archivo}.js limpia URLs`);
}
assert.equal(read('../api/_grc/forense.js').includes('sendError(res, error.message'), false, 'H6');
assert.ok(read('../api/_grc/audit.js').includes('esUrlPermitida(urlCandidata)'), 'H14: enlace validado en el prompt');
assert.ok(read('../src/App.jsx').includes("activeTab === 'config' && isAdmin"), 'N2: Configuración solo para admin');
for (const archivo of ['components/Evaluaciones.jsx', 'components/Hallazgos.jsx', 'components/Riesgos.jsx']) {
  assert.equal(/sessionStorage/.test(read(`../src/${archivo}`)), false, `H3: ${archivo} sin sessionStorage`);
}
const fuentesCliente = ['App.jsx', 'handlers/grcFormHandlers.js'].map(archivo => read(`../src/${archivo}`)).join('\n');
assert.equal(/admin@termales\.com\.co|controlinterno@empresa\.com/.test(fuentesCliente), false, 'N5: sin correos fijos');
const paquete = JSON.parse(read('../package.json'));
for (const dependencia of ['express', 'cors', 'dotenv', 'crypto-js']) {
  assert.equal(dependencia in (paquete.dependencies || {}), false, `H12/N4: ${dependencia} retirada`);
}
assert.match(paquete.dependencies.xlsx, /xlsx-0\.20\.3/, 'N4: SheetJS mantenido');

console.log('securityRetest.test.js: OK (H3, H4, H6, H10, H12, H13, H14, N2, N3, N4, N5)');
