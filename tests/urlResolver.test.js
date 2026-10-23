import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Se carga solo resolveArchivoUrl (función pura): importar apiService.js inicializa Firebase, que fuera del
// navegador no tiene las claves de Vite y hacía fallar la prueba antes de comprobar nada.
const fuente = readFileSync(new URL('../src/services/apiService.js', import.meta.url), 'utf8');
const inicio = fuente.indexOf('const resolveArchivoUrl = ');
const fin = fuente.indexOf('export const apiService', inicio);
const resolveArchivoUrl = new Function(`${fuente.slice(inicio, fin)}\nreturn resolveArchivoUrl;`)();

const result = resolveArchivoUrl({
  appName: 'controlInterno',
  fileName: '650744ce-7f6c-435e-bb34-82da48fa7a0d.pdf',
  file: { filename: '650744ce-7f6c-435e-bb34-82da48fa7a0d.pdf' },
});

assert.equal(
  result,
  'https://repos.termalessantarosa.com.co/api/archivos/auditoria/controlInterno/650744ce-7f6c-435e-bb34-82da48fa7a0d.pdf',
  'Debe conservar el nombre exacto del appName y no forzarlo a minúsculas, porque el repositorio distingue mayúsculas.'
);

console.log('urlResolver.test.js: OK');
