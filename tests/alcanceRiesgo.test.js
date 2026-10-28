// tests/alcanceRiesgo.test.js - Riesgos transversales: de todo un macroproceso o de toda la empresa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alcanceDe, expandirUbicacion, subprocesosSinControl, textoAlcance } from '../src/utils/alcanceRiesgo.js';
import { riesgosVisiblesPara } from '../src/utils/permisosVista.js';

const MAPA = { 'Gestión comercial': ['Ventas', 'Mercadeo'], Operaciones: ['Taquilla', 'Piscinas', 'Mantenimiento'] };

test('un riesgo de todo el macroproceso incluye sus subprocesos, también los que se crean después', () => {
  const guardado = { alcance: 'macroproceso', macroprocesos: ['Operaciones'], subprocesosPorMacroproceso: { Operaciones: ['Taquilla', 'Piscinas'] } };
  const vigente = expandirUbicacion(guardado, MAPA);
  assert.deepEqual(vigente.subprocesosPorMacroproceso, { Operaciones: ['Taquilla', 'Piscinas', 'Mantenimiento'] }, 'Mantenimiento se creó después');
  assert.deepEqual(vigente.subprocesos, ['Taquilla', 'Piscinas', 'Mantenimiento']);
  assert.equal(textoAlcance(guardado, MAPA), 'Todo Operaciones');
});

test('un riesgo de toda la empresa cubre todos los macroprocesos del catálogo', () => {
  const vigente = expandirUbicacion({ alcance: 'empresa', macroprocesos: ['Operaciones'] }, MAPA);
  assert.deepEqual(vigente.macroprocesos, ['Gestión comercial', 'Operaciones']);
  assert.equal(vigente.subprocesos.length, 5);
  assert.equal(textoAlcance({ alcance: 'empresa' }, MAPA), 'Toda la empresa');
});

test('un riesgo específico (o sin alcance, como los existentes) conserva su ubicación', () => {
  const especifico = { macroprocesos: ['Operaciones'], subprocesosPorMacroproceso: { Operaciones: ['Taquilla'] } };
  assert.equal(alcanceDe(especifico), 'especifico');
  assert.equal(expandirUbicacion(especifico, MAPA), especifico);
  assert.equal(expandirUbicacion({ alcance: 'empresa', macroprocesos: ['X'] }, {}).macroprocesos[0], 'X', 'sin catálogo cargado no se inventa nada');
});

test('todos los líderes ven los riesgos de toda la empresa; los demás, solo los de sus procesos', () => {
  const riesgos = [{ id: 1, macroprocesos: ['Gestión comercial'] }, { id: 2, alcance: 'empresa', macroprocesos: ['Gestión comercial'] }];
  assert.deepEqual(riesgosVisiblesPara(riesgos, { procesosAsignados: ['Operaciones'] }).map(riesgo => riesgo.id), [2]);
});

test('controles por subproceso: avisa los subprocesos sin control propio; un control común los cubre a todos', () => {
  const subprocesos = ['Operaciones › Taquilla', 'Operaciones › Piscinas'];
  assert.deepEqual(subprocesosSinControl(subprocesos, [{ subprocesoEjecutor: 'Operaciones › Taquilla' }]), ['Operaciones › Piscinas']);
  assert.deepEqual(subprocesosSinControl(subprocesos, [{ subprocesoEjecutor: 'Operaciones › Taquilla' }, { subprocesoEjecutor: '' }]), [], 'hay un control común');
  assert.deepEqual(subprocesosSinControl(subprocesos, [{ subprocesoEjecutor: 'Operaciones › Taquilla' }, { subprocesoEjecutor: 'Operaciones › Piscinas', estado: 'Anulado' }]), ['Operaciones › Piscinas'], 'un control anulado no cubre');
  assert.deepEqual(subprocesosSinControl(subprocesos, []), [], 'sin controles el aviso es el de "riesgo sin controles"');
});
