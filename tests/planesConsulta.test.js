// tests/planesConsulta.test.js - Un plan cerrado se puede consultar completo, en solo lectura y sin decidir nada.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../src/components/Planes.jsx', import.meta.url), 'utf8');

// Botón "Ver plan completo" en las acciones cerradas (también las cerradas como No aplica).
const inicioBoton = fuente.indexOf('Plan cerrado: consulta completa en solo lectura');
assert.ok(inicioBoton > 0, 'existe el botón de consulta');
const bloqueBoton = fuente.slice(inicioBoton, fuente.indexOf('Ver plan completo', inicioBoton));
assert.match(bloqueBoton, /p\.estadoWorkflow === 'Cerrado' \|\| p\.estado === 'Cerrado' \|\| p\.estadoWorkflow === 'No aplica'/);
assert.match(bloqueBoton, /setModoRevisionMatriz\(true\);\s*setModoConsultaPlan\(true\);/, 'abre la vista de solo lectura en modo consulta');

// En consulta no hay decisiones: ni aprobar ni devolver, por acción o en bloque.
assert.ok(fuente.includes('const puedeDecidirRevision = modoRevisionMatriz && !modoConsultaPlan &&'));
assert.ok(fuente.includes('const pendienteDeMiRevision = modoRevisionMatriz && !modoConsultaPlan &&'));
assert.ok(fuente.includes("'Consulta del plan (Solo Lectura)'"));

// Toda salida del modo revisión apaga la consulta (no queda pegada en la siguiente revisión).
const salidas = fuente.match(/setModoRevisionMatriz\(false\);[^\n]*/g) || [];
assert.ok(salidas.length >= 5 && salidas.every(linea => linea.includes('setModoConsultaPlan(false)')));

// En la vista de solo lectura los soportes se abren y no se pueden quitar ni subir.
assert.match(fuente, /\{!modoRevisionMatriz && \(\s*<button type="button" onClick=\{async \(\) => \{\s*if \(!\(await confirmarEliminacion\(`Se quitará el soporte/, 'no se quitan soportes');
assert.match(fuente, /\{!modoRevisionMatriz && \(\s*<label className="cursor-pointer[^"]*">\s*<span[^>]*>➕ Agregar Soporte Adicional/, 'no se suben soportes');
assert.ok(fuente.includes('<a href={url} target="_blank" rel="noreferrer"'), 'los soportes se abren o descargan');

console.log('planesConsulta.test.js: OK (ver plan completo cerrado, solo lectura, sin decisiones)');
