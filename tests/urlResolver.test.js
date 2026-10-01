import assert from 'node:assert/strict';
import { apiService } from '../src/services/apiService.js';

const result = apiService.resolveArchivoUrl({
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
