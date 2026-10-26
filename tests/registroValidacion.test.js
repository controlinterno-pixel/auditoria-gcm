// tests/registroValidacion.test.js - Registro: correo y contraseña escritos dos veces y contraseña segura.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requisitosClave } from '../src/utils/requisitosClave.js';

const cumple = clave => requisitosClave(clave).every(requisito => requisito.cumple);
assert.equal(cumple('Termales#2026'), true);
for (const debil of ['termales#2026', 'Termales2026', 'Termales#', 'Te#1']) assert.equal(cumple(debil), false, debil);
assert.deepEqual(requisitosClave('abc').map(r => r.cumple), [false, false, false, false]);

const pantalla = readFileSync(new URL('../src/components/AuthScreen.jsx', import.meta.url), 'utf8');
assert.ok(pantalla.includes('Confirmar correo *') && pantalla.includes('Confirmar contraseña *'), 'se escriben dos veces');
assert.ok(pantalla.includes('if (cleanEmail !== emailConfirmacion.trim().toLowerCase())'), 'no crea la cuenta con correos distintos');
assert.ok(pantalla.includes('if (!requisitosClave(password).every(requisito => requisito.cumple))'), 'no crea la cuenta con contraseña débil');
assert.ok(/disabled=\{loading \|\| !email\.trim\(\) \|\| email\.trim\(\)\.toLowerCase\(\) !== emailConfirmacion\.trim\(\)\.toLowerCase\(\) \|\| !password \|\| password !== confirmPassword \|\| !requisitosClave\(password\)/.test(pantalla), 'botón bloqueado hasta que todo esté en verde');
assert.ok(pantalla.includes('Para que sea segura debe tener como mínimo:'), 'explica los requisitos');
assert.ok(pantalla.includes('|| !habeasDataAccepted}'), 'botón bloqueado sin aceptar el tratamiento de datos');

console.log('registroValidacion.test.js: OK (doble correo, doble contraseña, requisitos visibles y obligatorios)');
