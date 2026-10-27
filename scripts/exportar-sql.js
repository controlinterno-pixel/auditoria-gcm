// scripts/exportar-sql.js - Exporta toda la información de Firestore a un script .sql para SQL Server.
// Solo lee: no modifica nada en Firebase. Uso:
//   node scripts/exportar-sql.js --credenciales "C:\ruta\llave-servicio.json" [--salida "C:\carpeta"]
// La llave se descarga en Firebase > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada.
// Guárdala y genera el .sql FUERA de la carpeta del proyecto, para que nunca se suba a GitHub.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { construirTablas, generarSql } from './sqlServer.js';

const argumento = nombre => {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice > -1 ? process.argv[indice + 1] : '';
};

const rutaCredenciales = argumento('credenciales');
if (!rutaCredenciales) {
  console.error('Falta --credenciales "ruta de la llave de servicio .json".');
  process.exit(1);
}
const llave = JSON.parse(readFileSync(rutaCredenciales, 'utf8'));
process.env.FIREBASE_PROJECT_ID = llave.project_id;
process.env.FIREBASE_CLIENT_EMAIL = llave.client_email;
process.env.FIREBASE_PRIVATE_KEY = llave.private_key;

// Después de cargar la llave: firebaseAdmin.js exige las variables al importarse.
const { adminDb } = await import('../api/_lib/firebaseAdmin.js');
const { leerWorkspaceGrc } = await import('../api/_lib/grcWorkspace.js');

// Listas del workspace que se exportan con otro nombre o no se exportan (copias o datos internos).
const NOMBRES_TABLA = { planes: 'PlanesAccion', informesAuditoria: 'InformesAuditoria' };
const LISTAS_OMITIDAS = new Set(['planesAccion', 'huellasRegistros']);
// Colecciones que se leen aparte o no tienen información de negocio.
const COLECCIONES_ESPECIALES = new Set(['workspace_compartido', 'riesgos', 'nominas_historicas', 'marcaciones_historicas', 'sistema']);
const CAMPOS_SENSIBLES = /token|password|contrasen|secret|hash/i;

const conId = (documento, campo = 'id') => ({ [campo]: documento.id, ...documento.data() });
const nombreTabla = llave => NOMBRES_TABLA[llave] || `${llave.charAt(0).toUpperCase()}${llave.slice(1)}`;

/** Índices de nómina o marcaciones con sus filas (subcolección chunks) como lista `detalle`. */
async function leerHistoricos(coleccion, campoLegado) {
  const indices = await adminDb.collection(coleccion).get();
  return Promise.all(indices.docs.map(async documento => {
    const chunks = await adminDb.collection(`${coleccion}/${documento.id}/chunks`).get();
    const detalle = chunks.docs.flatMap(chunk => (Array.isArray(chunk.get('datos')) ? chunk.get('datos') : []));
    const { [campoLegado]: legado, ...indice } = conId(documento);
    return { ...indice, detalle: detalle.length ? detalle : (Array.isArray(legado) ? legado : []) };
  }));
}

const { data: workspace } = await leerWorkspaceGrc(null, { origen: 'exportar-sql' });
const conjuntos = [];
const configuracion = [];
Object.entries(workspace).forEach(([llave, valor]) => {
  if (LISTAS_OMITIDAS.has(llave)) return;
  if (Array.isArray(valor) && valor.some(item => item && typeof item === 'object')) conjuntos.push([nombreTabla(llave), valor]);
  else configuracion.push({ clave: llave, valor: JSON.stringify(valor) });
});

if (!Array.isArray(workspace.riesgos)) {
  const riesgos = await adminDb.collection('riesgos').get();
  conjuntos.push(['Riesgos', riesgos.docs.map(documento => conId(documento))]);
}

const usuarios = await adminDb.collection('usuarios').get();
conjuntos.push(['Usuarios', usuarios.docs.map(documento => Object.fromEntries(
  Object.entries(conId(documento, 'uid')).filter(([campo]) => !CAMPOS_SENSIBLES.test(campo)),
))]);

conjuntos.push(['NominasHistoricas', await leerHistoricos('nominas_historicas', 'empleados')]);
conjuntos.push(['MarcacionesHistoricas', await leerHistoricos('marcaciones_historicas', 'transacciones')]);

// Cualquier otra colección (por ejemplo los consecutivos) se exporta tal cual, un documento por fila.
const otras = (await adminDb.listCollections()).filter(coleccion => !COLECCIONES_ESPECIALES.has(coleccion.id) && coleccion.id !== 'usuarios');
for (const coleccion of otras) {
  const documentos = await coleccion.get();
  conjuntos.push([nombreTabla(coleccion.id.replace(/^_+/, '')), documentos.docs.map(documento => conId(documento, 'documento_id'))]);
}
if (configuracion.length) conjuntos.push(['Configuracion', configuracion]);

const nombresUsados = new Set();
const tablas = conjuntos.flatMap(([nombre, registros]) => construirTablas(nombre, registros, { nombresUsados }));

const fecha = new Date().toISOString().slice(0, 10);
const carpeta = argumento('salida') || path.join(homedir(), 'Documents', 'exportacion-gcm');
mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, `gcm_sqlserver_${fecha}.sql`);
// Con BOM para que SQL Server Management Studio lea bien tildes y eñes.
writeFileSync(archivo, `\uFEFF${generarSql(tablas, { titulo: `Exportación GCM desde Firestore (${llave.project_id}) del ${fecha}` })}`, 'utf8');

console.table(tablas.map(tabla => ({ tabla: `gcm.${tabla.nombre}`, registros: tabla.filas.length, columnas: tabla.columnas.length })));
console.log(`\nArchivo generado: ${archivo}`);
process.exit(0);
