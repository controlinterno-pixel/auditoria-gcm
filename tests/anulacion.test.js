// tests/anulacion.test.js - Anulación de riesgos y controles con trazabilidad.
import assert from 'node:assert/strict';
import test from 'node:test';
import { anular, entradaHistorial, estaAnulado, reactivar, revisarControlesEliminados, validarMotivo, vigentes } from '../src/utils/anulacion.js';
import { calcularResiduales } from '../src/utils/explicacionControles.js';

const ahora = new Date('2026-10-23T15:00:00Z');
const control = extra => ({ tipo: 'Preventivo', implementacion: 'Manual', descripcion: 'Control', ...extra });

test('anular y reactivar conservan el registro, el motivo y quién lo hizo', () => {
  const anulado = anular(control(), { usuario: 'lider@termales.com.co', tipoMotivo: 'Reemplazado por otro', motivo: '  Se reemplaza por conciliación automática  ', ahora });
  assert.equal(estaAnulado(anulado), true);
  assert.equal(anulado.descripcion, 'Control', 'no se borra nada');
  assert.deepEqual(anulado.anulacion, {
    fecha: ahora.toLocaleString('es-CO'), timestamp: '2026-10-23T15:00:00.000Z',
    usuario: 'lider@termales.com.co', tipoMotivo: 'Reemplazado por otro', motivo: 'Se reemplaza por conciliación automática',
  });
  const reactivado = reactivar(anulado);
  assert.equal(estaAnulado(reactivado), false);
  assert.equal(reactivado.anulacion, null, 'null (no undefined) para que el guardado por fusión la quite');
  assert.deepEqual(vigentes([anulado, control(), null].filter(Boolean)).length, 1);
  assert.match(entradaHistorial({ usuario: 'x', accion: 'Control CTL-2-1 anulado', motivo: 'Ya no aplica: cambio de proceso', ahora }).accion, /anulado/);
});

test('el motivo es obligatorio', () => {
  assert.match(validarMotivo({ tipoMotivo: '', motivo: 'un motivo largo' }), /Selecciona el motivo/);
  assert.match(validarMotivo({ tipoMotivo: 'Ya no aplica', motivo: 'corto' }), /mínimo 10/);
  assert.equal(validarMotivo({ tipoMotivo: 'Ya no aplica', motivo: 'El proceso dejó de existir' }), '');
  assert.equal(validarMotivo({ motivo: 'Se volvió a aplicar' }, { exigirTipo: false }), '', 'reactivar no pide tipo');
});

test('un control anulado no reduce el riesgo', () => {
  const anulado = anular(control(), { usuario: 'x', tipoMotivo: 'Ya no aplica', motivo: 'ya no se realiza', ahora });
  assert.deepEqual(calcularResiduales(60, 60, [control(), anulado]), calcularResiduales(60, 60, [control()]));
  assert.deepEqual(calcularResiduales(60, 60, [anulado]), { probabilidadResidual: 60, impactoResidual: 60 });
});

test('quien no es administrador no puede borrar controles guardados', () => {
  const existente = { controlesDetallados: [control(), control()] };
  assert.match(revisarControlesEliminados(existente, { controlesDetallados: [control()] }), /anúlalos/);
  assert.equal(revisarControlesEliminados(existente, { controlesDetallados: [control(), anular(control(), { usuario: 'x', tipoMotivo: 'Otro', motivo: 'motivo suficiente', ahora })] }), '');
  assert.equal(revisarControlesEliminados(existente, { controlesDetallados: [control(), control(), control()] }), '', 'agregar sí se puede');
  assert.equal(revisarControlesEliminados(existente, {}), '', 'si no envía controles, no los cambia');
});
