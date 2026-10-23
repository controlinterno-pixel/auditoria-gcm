// Etapa 0 de la agrupación de planes, hallazgos e informes: diagnóstico de SOLO LECTURA.
// Mide cuántos documentos y bytes tiene cada colección y cuántas lecturas costaría una carga completa
// si se agruparan en pocos documentos (como ya se hizo con riesgos). No escribe nada.
import { adminDb } from './firebaseAdmin.js';
import { crearLectorGrupos, indiceAgrupado, informesLegadosEliminados } from './coleccionesAgrupadas.js';

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

/**
 * Lecturas de una carga completa hoy y con la agrupación propuesta. Puro.
 * Una colección ya agrupada (`partesActuales`) cuesta sus partes, no sus documentos.
 */
export function proyectarLecturas({ colecciones, partesRiesgos = 0, informesLegadosEliminados = false }) {
  const documentosFijos = informesLegadosEliminados ? 1 : 2; // documento principal (+ documento de informes legados)
  const actuales = documentosFijos + partesRiesgos +
    Object.values(colecciones).reduce((total, coleccion) => total + (coleccion.partesActuales ?? coleccion.documentos), 0);
  const propuestas = documentosFijos + partesRiesgos +
    Object.values(colecciones).reduce((total, coleccion) => total + (coleccion.partesActuales ?? coleccion.partesPropuestas), 0);
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
  const principal = await raiz.get();
  const datosPrincipal = principal.exists ? principal.data() || {} : {};
  const sinInformesLegados = informesLegadosEliminados(datosPrincipal);
  const grupos = crearLectorGrupos(datosPrincipal);
  let lecturas = 1;
  // Colección agrupada: se miden sus partes vigentes. Si no, sus documentos (como antes de agrupar).
  const resumir = async (coleccion, subcoleccion) => {
    const agrupados = await grupos.mapa(coleccion);
    if (agrupados) {
      return { ...resumirColeccion([...agrupados].map(([id, datos]) => ({ id, datos }))), partesActuales: indiceAgrupado(datosPrincipal, coleccion).partes };
    }
    const snapshot = await raiz.collection(subcoleccion).get();
    lecturas += snapshot.size;
    return resumirColeccion(snapshot.docs.map(documento => ({ id: documento.id, datos: documento.data() })));
  };
  const [informesLegados, planes, hallazgos, informes] = await Promise.all([
    sinInformesLegados ? null : adminDb.collection('workspace_compartido').doc('base_de_datos_grc_informes').get(),
    resumir('planes', 'planes_accion'),
    resumir('hallazgos', 'hallazgos'),
    resumir('informes', 'informes'),
  ]);
  if (!sinInformesLegados) lecturas += 1;
  const partesRiesgos = Number.isInteger(datosPrincipal.riesgosFragmentados?.partes) ? datosPrincipal.riesgosFragmentados.partes : 0;
  const colecciones = { planes, hallazgos, informes };
  const bytesPrincipal = tamanoBytes(datosPrincipal);
  return {
    generadoEn: new Date().toISOString(),
    soloLectura: true,
    lecturasDeEsteDiagnostico: lecturas + grupos.documentos,
    documentoPrincipal: {
      bytes: bytesPrincipal,
      porcentajeDelLimite: Math.round((bytesPrincipal / 1_048_576) * 100),
      camposLegados: {
        planes: Array.isArray(datosPrincipal.planes) ? datosPrincipal.planes.length : 0,
        hallazgos: Array.isArray(datosPrincipal.hallazgos) ? datosPrincipal.hallazgos.length : 0,
        informesAuditoria: Array.isArray(datosPrincipal.informesAuditoria) ? datosPrincipal.informesAuditoria.length : 0,
      },
    },
    documentoInformesLegados: { existe: Boolean(informesLegados?.exists), bytes: informesLegados?.exists ? tamanoBytes(informesLegados.data()) : 0 },
    riesgos: { migrados: partesRiesgos > 0, partes: partesRiesgos },
    colecciones,
    proyeccion: proyectarLecturas({ colecciones, partesRiesgos, informesLegadosEliminados: sinInformesLegados }),
  };
}
