import assert from 'node:assert/strict';
import { apiService } from '../src/services/apiService.js';

const result = apiService.resolveArchivoUrl({
  appName: 'controlInterno',
  fileName: '650744ce-7f6c-435e-bb34-82da48fa7a0d.pdf',
  file: { filename: '650744ce-7f6c-435e-bb34-82da48fa7a0d.pdf' },
});

assert.equal(
  result,
  'https://repos.termalessantarosa.com.co/api/archivos/auditoria/controlinterno/650744ce-7f6c-435e-bb34-82da48fa7a0d.pdf',
  'Debe construir la URL de descarga válida usando la API del repositorio y no una ruta física inexistente.'
);

console.log('urlResolver.test.js: OK');
