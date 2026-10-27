// tests/exportarSql.test.js - La exportación a SQL Server arma tablas, tablas hijas y literales correctos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirTablas, generarSql } from '../scripts/sqlServer.js';

const riesgos = [
  {
    id: 'R-1', nombre: "Pérdida de información d'archivo", probabilidad: 3, activo: true,
    fechaIdentificacion: '2026-10-01', ultimaActualizacion: '2026-10-27T15:30:00.000Z',
    controlesDetallados: [{ descripcion: 'Respaldo diario', eficacia: 0.75 }, { descripcion: 'Revisión' }],
    responsables: ['Ana', 'Luis'], Estado: 'Vigente', estado: 'duplicado',
  },
  { id: 'R-2', nombre: 'Fraude', probabilidad: 5, activo: false, controlesDetallados: [] },
];

test('las listas de objetos pasan a tablas hijas enlazadas al padre', () => {
  const [padre, hija] = construirTablas('Riesgos', riesgos);
  assert.equal(padre.nombre, 'Riesgos');
  assert.equal(hija.nombre, 'Riesgos_controlesDetallados');
  assert.equal(hija.padre, 'Riesgos');
  assert.deepEqual(hija.filas.map(fila => fila.slice(0, 3)), [[1, 1, 1], [2, 1, 2]]);
  assert.equal(padre.columnas.some(columna => columna.nombre === 'controlesDetallados'), false);
});

test('los tipos se infieren y los nombres no chocan en SQL Server', () => {
  const [padre] = construirTablas('Riesgos', riesgos);
  const tipo = nombre => padre.columnas.find(columna => columna.nombre === nombre)?.tipo;
  assert.equal(tipo('probabilidad'), 'INT');
  assert.equal(tipo('activo'), 'BIT');
  assert.equal(tipo('fechaIdentificacion'), 'DATE');
  assert.equal(tipo('ultimaActualizacion'), 'DATETIME2');
  assert.match(tipo('responsables'), /^NVARCHAR/);
  assert.ok(tipo('Estado') && tipo('estado_2'), 'Estado y estado quedan en columnas distintas');
});

test('el script escapa comillas, conserva tildes y crea las llaves foráneas', () => {
  const sql = generarSql(construirTablas('Riesgos', riesgos));
  assert.match(sql, /N'Pérdida de información d''archivo'/);
  assert.match(sql, /N'\["Ana","Luis"\]'/);
  assert.match(sql, /N'2026-10-27 15:30:00.000'/);
  assert.match(sql, /FOREIGN KEY \(\[padre_registro_id\]\) REFERENCES \[gcm\]\.\[Riesgos\]/);
  assert.ok(sql.indexOf('DROP TABLE IF EXISTS [gcm].[Riesgos_controlesDetallados]') < sql.indexOf('DROP TABLE IF EXISTS [gcm].[Riesgos];'),
    'borra primero la tabla hija');
  assert.doesNotMatch(sql, /DROP TABLE IF EXISTS \[dbo\]/, 'nunca toca tablas fuera del esquema gcm');
});

test('Timestamps de Firestore se exportan como fecha', () => {
  const [tabla] = construirTablas('Usuarios', [{ uid: 'u1', creado: { toDate: () => new Date('2026-01-02T03:04:05Z') } }]);
  assert.equal(tabla.columnas.find(columna => columna.nombre === 'creado').tipo, 'DATETIME2');
  assert.equal(tabla.filas[0][2], '2026-01-02 03:04:05.000');
});
