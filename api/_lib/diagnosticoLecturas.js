// Etapa 0 de la agrupación de planes, hallazgos e informes: diagnóstico de SOLO LECTURA.
// Mide cuántos documentos y bytes tiene cada colección y cuántas lecturas costaría una carga completa
// si se agruparan en pocos documentos (como ya se hizo con riesgos). No escribe nada.
import { adminDb } from './firebaseAdmin.js';

// Tamaño objetivo de cada parte: la mitad del límite de 1 MiB, para que pueda crecer al doble sin tocarse.
export const BYTES_OBJETIVO_PARTE = 500_000;
const LIMITE_SEGURO_DOCUMENTO = 900_000;

const tamanoBytes = valor => Buffer.byteLength(JSON.stringify(valor ?? null));

/** Resumen de una colección a partir de sus documentos ({ id, datos }). Puro: se prueba sin Firestore. */
export function resumirColeccion(documentos) {
  const tamanos = documentos.map(documento => tamanoBytes({ id: documento.id, ...documento.datos }));
  const bytesTotal = tamanos.reduce((total, tamano) => total + tamano, 0);
  const bytesMaximo = tamanos.reduce((maximo, tamano) => Math.max(maximo, tamano), 0);
  return {
    documentos: documentos.length,
    bytesTotal,
    bytesPromedio: documentos.length ? Math.round(bytesTotal / documentos.length) : 0,
    bytesMaximo,
    partesPropuestas: documentos.length ? Math.max(1, Math.ceil(bytesTotal / BYTES_OBJETIVO_PARTE)) : 0,
    documentosDemasiadoGrandes: tamanos.filter(tamano => tamano > LIMITE_SEGURO_DOCUMENTO).length,
  };
}

/** Lecturas de una carga completa hoy y con la agrupación propuesta. Puro. */
export function proyectarLecturas({ colecciones, partesRiesgos = 0 }) {
  const documentosFijos = 2; // documento principal + documento de informes legados
  const actuales = documentosFijos + partesRiesgos +
    Object.values(colecciones).reduce((total, coleccion) => total + coleccion.documentos, 0);
  const propuestas = documentosFijos + partesRiesgos +
    Object.values(colecciones).reduce((total, coleccion) => total + coleccion.partesPropuestas, 0);
  return {
    lecturasPorCargaActual: actuales,
    lecturasPorCargaPropuesta: propuestas,
    reduccionPorcentaje: actuales ? Math.round((1 - propuestas / actuales) * 100) : 0,
    cargasCompletasConCuotaActual: actuales ? Math.floor(50_000 / actuales) : null,
    cargasCompletasConCuotaPropuesta: propuestas ? Math.floor(50_000 / propuestas) : null,
  };
}

export async function diagnosticarLecturas() {
  const raiz = adminDb.collection('workspace_compartido').doc('base_de_datos_grc');
  const [principal, informesLegados, planes, hallazgos, informes] = await Promise.all([
    raiz.get(),
    adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes').get(),
    raiz.collection('planes_accion').get(),
    raiz.collection('hallazgos').get(),
    raiz.collection('informes').get(),
  ]);
  const aDocumentos = snapshot => snapshot.docs.map(documento => ({ id: documento.id, datos: documento.data() }));
  const datosPrincipal = principal.exists ? principal.data() || {} : {};
  const partesRiesgos = Number.isInteger(datosPrincipal.riesgosFragmentados?.partes) ? datosPrincipal.riesgosFragmentados.partes : 0;
  const colecciones = {
    planes: resumirColeccion(aDocumentos(planes)),
    hallazgos: resumirColeccion(aDocumentos(hallazgos)),
    informes: resumirColeccion(aDocumentos(informes)),
  };
  const bytesPrincipal = tamanoBytes(datosPrincipal);
  return {
    generadoEn: new Date().toISOString(),
    soloLectura: true,
    lecturasDeEsteDiagnostico: 2 + planes.size + hallazgos.size + informes.size,
    documentoPrincipal: {
      bytes: bytesPrincipal,
      porcentajeDelLimite: Math.round((bytesPrincipal / 1_048_576) * 100),
      camposLegados: {
        planes: Array.isArray(datosPrincipal.planes) ? datosPrincipal.planes.length : 0,
        hallazgos: Array.isArray(datosPrincipal.hallazgos) ? datosPrincipal.hallazgos.length : 0,
        informesAuditoria: Array.isArray(datosPrincipal.informesAuditoria) ? datosPrincipal.informesAuditoria.length : 0,
      },
    },
    documentoInformesLegados: { existe: informesLegados.exists, bytes: informesLegados.exists ? tamanoBytes(informesLegados.data()) : 0 },
    riesgos: { migrados: partesRiesgos > 0, partes: partesRiesgos },
    colecciones,
    proyeccion: proyectarLecturas({ colecciones, partesRiesgos }),
  };
}
