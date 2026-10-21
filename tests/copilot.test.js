// tests/copilot.test.js - H14: el copiloto de IA no manipula el DOM; devuelve la sugerencia al formulario.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../src/services/copilotService.js', import.meta.url), 'utf8');
assert.equal(/document\.|querySelector|nativeInputValueSetter|dispatchEvent/.test(fuente), false, 'sin acceso directo al DOM');

const consultas = [];
const cuerpo = fuente.replace(/^import [^;]*;\r?\n/gm, '').replaceAll('export const', 'const');
const crear = respuesta => new Function('apiService', 'secureLogger', `${cuerpo}\nreturn { solicitarSugerenciaIA };`)(
  { consultarAuditor: async payload => { consultas.push(payload); if (respuesta instanceof Error) throw respuesta; return respuesta; } },
  { error() {} },
);

const avisos = [];
const estados = [];
const opciones = { setIsThinking: valor => estados.push(valor), showNotification: (mensaje, tipo) => avisos.push(tipo || 'success') };

const { solicitarSugerenciaIA } = crear({ respuesta: '"Implementar doble verificación de pagos"' });
assert.equal(await solicitarSugerenciaIA('control', 'Pagos sin <script> soporte', opciones), 'Implementar doble verificación de pagos');
assert.deepEqual(consultas.at(-1), { tipoAccion: 'sugerir_grc', tipoTarget: 'control', prompt: 'Pagos sin script soporte' }, 'texto saneado');
assert.deepEqual(estados, [true, false], 'indicador de carga se activa y se apaga');

assert.equal(await solicitarSugerenciaIA('control', '   ', opciones), null, 'texto vacío no consulta');
assert.equal(await solicitarSugerenciaIA('desconocido', 'texto', opciones), null, 'tipo no permitido');
assert.equal(consultas.length, 1);
assert.equal(await crear(new Error('caída')).solicitarSugerenciaIA('plan', 'Hallazgo X', opciones), null, 'error controlado');
assert.ok(avisos.includes('error'));

console.log('copilot.test.js: OK (sin DOM, texto saneado, errores controlados)');
