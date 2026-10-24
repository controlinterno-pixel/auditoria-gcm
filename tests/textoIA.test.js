// El panel de IA convierte a texto cualquier forma que devuelva el modelo (antes un objeto tumbaba el módulo).
import assert from 'node:assert/strict';
import { aTexto } from '../src/utils/textoIA.js';

assert.equal(aTexto('texto'), 'texto');
assert.equal(aTexto(null), '');
assert.equal(aTexto(40), '40');
assert.equal(aTexto(['a', 'b']), 'a\nb');
assert.equal(aTexto({ indicador: 'Riesgos sin plan', valorActual: 1, meta: '0 (propuesta)' }), 'Indicador: Riesgos sin plan · Valor Actual: 1 · Meta: 0 (propuesta)');
assert.equal(aTexto([{ accion: 'Automatizar CTL-2-1' }, 'Registrar plan']), 'Accion: Automatizar CTL-2-1\nRegistrar plan');
assert.equal(aTexto({ vacio: '', nulo: null, ok: 'sí' }), 'Ok: sí');
console.log('textoIA.test.js: 7 comprobaciones OK');
