import assert from 'node:assert/strict';
import { redactObject } from '../src/services/secureLogger.js';

const payload = {
  url: 'https://repos.termalessantarosa.com.co/api/archivos/upload?appName=controlInterno',
  email: 'juan.perez@empresa.com',
  fileName: 'informe_confidencial_2026.pdf',
  message: 'No se pudo procesar /var/data/informe_confidencial_2026.pdf',
  stack: 'Error: at /home/app/node_modules/repo/upload.js:99:12',
};

const redacted = redactObject(payload);

assert.equal(redacted.url, 'https://repos.termalessantarosa.com.co/[ruta-redactada]');
assert.ok(!String(redacted.email).includes('juan'));
assert.ok(!String(redacted.fileName).includes('informe'));
assert.ok(!String(redacted.message).includes('/var/data'));
assert.ok(!String(redacted.stack).includes('/home/app'));
assert.ok(/\*\*\*|\[redactado\]|\[ruta-redactada\]/.test(String(redacted.message)));
assert.ok(/\*\*\*|\[redactado\]|\[ruta-redactada\]/.test(String(redacted.stack)));

console.log('secureLogger.test.js: OK');
