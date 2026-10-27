// scripts/sqlServer.js - Convierte listas de registros (como vienen de Firestore) en tablas e INSERT de SQL Server.
// Cada tabla lleva `registro_id` (consecutivo) como llave primaria; las listas anidadas de objetos pasan a
// tablas hijas enlazadas por `padre_registro_id`; lo demás que no es plano queda como JSON en NVARCHAR(MAX).

const ESQUEMA = 'gcm';
const FILAS_POR_INSERT = 500; // SQL Server admite hasta 1000 filas por VALUES.
const PROFUNDIDAD_MAXIMA = 3;
const LONGITUDES = [50, 100, 255, 500, 1000, 2000, 4000];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?(Z|[+-]\d{2}:?\d{2})?$/;

const esObjetoPlano = valor => Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor) && !(valor instanceof Date);
const vacio = valor => valor === undefined || valor === null;

/** Timestamps, referencias y GeoPoint de Firestore a valores simples. */
export function aValorSimple(valor) {
  if (vacio(valor)) return null;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  if (typeof valor?.path === 'string' && typeof valor?.firestore === 'object') return valor.path;
  if (typeof valor?.latitude === 'number' && typeof valor?.longitude === 'number') return `${valor.latitude},${valor.longitude}`;
  if (Array.isArray(valor)) return valor.map(aValorSimple);
  if (esObjetoPlano(valor)) return Object.fromEntries(Object.entries(valor).map(([llave, dato]) => [llave, aValorSimple(dato)]));
  return valor;
}

/** Nombre ASCII válido para SQL Server, sin repetir (SQL Server no distingue mayúsculas). */
function nombreUnico(texto, usados) {
  const base = String(texto || 'campo').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'campo';
  let nombre = base;
  for (let n = 2; usados.has(nombre.toLowerCase()); n += 1) nombre = `${base}_${n}`;
  usados.add(nombre.toLowerCase());
  return nombre;
}

const esListaDeObjetos = valor => Array.isArray(valor) && valor.length > 0 && valor.every(item => vacio(item) || esObjetoPlano(item));

function fechaIso(fecha) {
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().replace('Z', '').replace('T', ' ');
}

function inferirTipo(valores) {
  const presentes = valores.filter(valor => !vacio(valor) && valor !== '');
  if (!presentes.length) return 'NVARCHAR(255)';
  if (presentes.every(valor => typeof valor === 'boolean')) return 'BIT';
  if (presentes.every(valor => typeof valor === 'number' && Number.isFinite(valor))) {
    if (!presentes.every(Number.isSafeInteger)) return 'FLOAT';
    return presentes.every(valor => Math.abs(valor) <= 2147483647) ? 'INT' : 'BIGINT';
  }
  if (presentes.every(valor => valor instanceof Date)) return 'DATETIME2';
  if (presentes.every(valor => typeof valor === 'string')) {
    if (presentes.every(valor => FECHA.test(valor) && fechaIso(new Date(valor)))) return 'DATE';
    if (presentes.every(valor => (FECHA.test(valor) || FECHA_HORA.test(valor)) && fechaIso(new Date(valor)))) return 'DATETIME2';
  }
  const mayor = Math.max(...presentes.map(valor => textoDe(valor).length));
  const longitud = LONGITUDES.find(limite => mayor <= limite);
  return longitud ? `NVARCHAR(${longitud})` : 'NVARCHAR(MAX)';
}

const textoDe = valor => (typeof valor === 'string' ? valor
  : valor instanceof Date ? fechaIso(valor) || ''
  : typeof valor === 'object' ? JSON.stringify(valor) : String(valor));

/** Valor ya convertido al tipo de la columna (lo que se escribe en el INSERT). */
function valorParaColumna(valor, tipo) {
  if (vacio(valor) || (valor === '' && !tipo.startsWith('NVARCHAR'))) return null;
  if (tipo === 'BIT' || tipo === 'INT' || tipo === 'BIGINT' || tipo === 'FLOAT') return valor;
  if (tipo === 'DATE') return valor;
  if (tipo === 'DATETIME2') {
    if (valor instanceof Date) return fechaIso(valor);
    return /(Z|[+-]\d{2}:?\d{2})$/.test(valor) ? fechaIso(new Date(valor)) : valor.replace('T', ' ');
  }
  return textoDe(valor);
}

/**
 * Arma la tabla `nombre` y sus tablas hijas a partir de `registros`.
 * `padres` (opcional) da el registro_id del padre de cada registro, en el mismo orden.
 */
export function construirTablas(nombre, registros, { padres = null, profundidad = 0, nombresUsados = new Set() } = {}) {
  const filas = registros.map(registro => (esObjetoPlano(registro) ? aValorSimple(registro) : { valor: aValorSimple(registro) }));
  const tablaNombre = nombreUnico(nombre, nombresUsados);
  const columnasUsadas = new Set(['registro_id', ...(padres ? ['padre_registro_id', 'posicion'] : [])]);

  const llaves = [...new Set(filas.flatMap(Object.keys))];
  const hijas = [];
  const columnas = [];
  llaves.forEach(llave => {
    const valores = filas.map(fila => fila[llave]);
    const anidadas = valores.filter(valor => !vacio(valor));
    if (profundidad < PROFUNDIDAD_MAXIMA && anidadas.length && anidadas.every(valor => Array.isArray(valor))
      && anidadas.some(esListaDeObjetos) && anidadas.every(valor => valor.length === 0 || esListaDeObjetos(valor))) {
      hijas.push(llave);
      return;
    }
    const tipo = inferirTipo(valores);
    columnas.push({ llave, nombre: nombreUnico(llave, columnasUsadas), tipo });
  });

  const tabla = {
    nombre: tablaNombre,
    padre: padres ? padres.tabla : null,
    columnas: [
      { nombre: 'registro_id', tipo: 'INT NOT NULL PRIMARY KEY' },
      ...(padres ? [{ nombre: 'padre_registro_id', tipo: 'INT NOT NULL' }, { nombre: 'posicion', tipo: 'INT NOT NULL' }] : []),
      ...columnas.map(({ nombre: columna, tipo }) => ({ nombre: columna, tipo })),
    ],
    filas: filas.map((fila, indice) => [
      indice + 1,
      ...(padres ? [padres.ids[indice], padres.posiciones[indice]] : []),
      ...columnas.map(({ llave, tipo }) => valorParaColumna(fila[llave], tipo)),
    ]),
  };

  const resultado = [tabla];
  hijas.forEach(llave => {
    const hijos = [];
    const ids = [];
    const posiciones = [];
    filas.forEach((fila, indice) => (Array.isArray(fila[llave]) ? fila[llave] : []).forEach((hijo, posicion) => {
      if (vacio(hijo)) return;
      hijos.push(hijo);
      ids.push(indice + 1);
      posiciones.push(posicion + 1);
    }));
    resultado.push(...construirTablas(`${tablaNombre}_${llave}`, hijos, {
      padres: { tabla: tablaNombre, ids, posiciones }, profundidad: profundidad + 1, nombresUsados,
    }));
  });
  return resultado;
}

function literal(valor) {
  if (vacio(valor)) return 'NULL';
  if (typeof valor === 'boolean') return valor ? '1' : '0';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : 'NULL';
  return `N'${String(valor).replaceAll('\0', '').replace(/'/g, "''")}'`;
}

const id = nombre => `[${nombre.replace(/]/g, ']]')}]`;
const tablaSql = nombre => `${id(ESQUEMA)}.${id(nombre)}`;

/** Script completo: crea el esquema gcm, recrea sus tablas (solo las de gcm) e inserta los datos. */
export function generarSql(tablas, { titulo = '' } = {}) {
  const lineas = [
    `-- ${titulo}`.trim(),
    '-- Requiere SQL Server 2016 o superior. Solo crea y reemplaza tablas del esquema [gcm].',
    `-- Tablas: ${tablas.length}. Registros: ${tablas.reduce((suma, tabla) => suma + tabla.filas.length, 0)}.`,
    'SET NOCOUNT ON;',
    `IF SCHEMA_ID(N'${ESQUEMA}') IS NULL EXEC(N'CREATE SCHEMA ${id(ESQUEMA)}');`,
    'GO',
  ];
  [...tablas].reverse().forEach(tabla => lineas.push(`DROP TABLE IF EXISTS ${tablaSql(tabla.nombre)};`));
  lineas.push('GO');

  tablas.forEach(tabla => {
    lineas.push('', `CREATE TABLE ${tablaSql(tabla.nombre)} (`,
      tabla.columnas.map(columna => `  ${id(columna.nombre)} ${columna.tipo}`).join(',\n'), ');');
    if (tabla.padre) {
      lineas.push(`ALTER TABLE ${tablaSql(tabla.nombre)} ADD CONSTRAINT ${id(`FK_${tabla.nombre}`.slice(0, 128))} `
        + `FOREIGN KEY ([padre_registro_id]) REFERENCES ${tablaSql(tabla.padre)} ([registro_id]);`);
    }
    lineas.push('GO');
    const columnas = tabla.columnas.map(columna => id(columna.nombre)).join(', ');
    for (let inicio = 0; inicio < tabla.filas.length; inicio += FILAS_POR_INSERT) {
      const lote = tabla.filas.slice(inicio, inicio + FILAS_POR_INSERT);
      lineas.push(`INSERT INTO ${tablaSql(tabla.nombre)} (${columnas}) VALUES`,
        `${lote.map(fila => `(${fila.map(literal).join(', ')})`).join(',\n')};`, 'GO');
    }
  });
  return `${lineas.join('\n')}\n`;
}
