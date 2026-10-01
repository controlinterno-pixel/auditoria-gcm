const ETIQUETAS = {
  titulo: 'Título',
  proceso: 'Proceso',
  subproceso: 'Subproceso',
  fecha: 'Fecha',
  elaboradoPor: 'Elaborado por',
  revisadoPor: 'Revisado por',
  aprobadoPor: 'Aprobado por',
  socializado: 'Socializado',
  evidenciaUrl: 'Documento principal',
  correoEnviadoA: 'Correo de notificación',
};

const formatearValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') return 'Sin valor';
  if (typeof valor === 'string') return valor.trim() || 'Sin valor';
  if (typeof valor === 'number') return String(valor);
  return JSON.stringify(valor);
};

const normalizarArchivo = (item) => {
  if (!item) return null;
  const url = item.url || item.href || '';
  if (!url) return null;

  const nombre = item.nombre || item.name || decodeURIComponent(new URL(url).pathname.split('/').pop() || 'archivo');
  const tipo = item.tipo || (url.toLowerCase().includes('.pdf') ? 'PDF' : 'Archivo');

  return {
    url,
    nombre: String(nombre),
    tipo: String(tipo),
  };
};

const extraerArchivosVersion = (actual = {}) => {
  const archivos = [];

  if (actual.evidenciaUrl) {
    archivos.push({
      url: actual.evidenciaUrl,
      nombre: actual.evidenciaUrl.split('/').pop() || 'Documento principal',
      tipo: 'Principal',
    });
  }

  const anexos = Array.isArray(actual.anexosMultiples)
    ? actual.anexosMultiples
    : Array.isArray(actual.anexos)
      ? actual.anexos
      : [];

  anexos.forEach((archivo) => {
    const normalizado = normalizarArchivo(archivo);
    if (normalizado) archivos.push(normalizado);
  });

  return archivos;
};

export function buildHistorialDetalle({ anterior = {}, actual = {}, motivo = '', correosNotificacionOut = '' }) {
  const campos = [];
  const claves = ['titulo', 'proceso', 'subproceso', 'fecha', 'elaboradoPor', 'revisadoPor', 'aprobadoPor', 'socializado', 'evidenciaUrl', 'correoEnviadoA'];

  claves.forEach((campo) => {
    const valorAnterior = anterior?.[campo];
    const valorActual = actual?.[campo];

    if (String(valorAnterior ?? '') !== String(valorActual ?? '')) {
      campos.push({
        campo,
        label: ETIQUETAS[campo] || campo,
        antes: formatearValor(valorAnterior),
        ahora: formatearValor(valorActual || correosNotificacionOut || 'Sin valor'),
      });
    }
  });

  const archivosActuales = extraerArchivosVersion(actual);
  const archivosAnteriores = extraerArchivosVersion(anterior);
  const archivosNuevos = archivosActuales.filter((archivo) => {
    const key = `${archivo.url}|${archivo.nombre}`;
    return !archivosAnteriores.some((prev) => `${prev.url}|${prev.nombre}` === key);
  });

  const resumen = [
    motivo || 'Actualización del registro',
    ...(campos.slice(0, 3).map((campo) => `${campo.label}: ${campo.antes} → ${campo.ahora}`)),
    ...(archivosNuevos.length ? [`Adjunto(s) nuevo(s): ${archivosNuevos.map((archivo) => archivo.nombre).join(', ')}`] : []),
  ].join(' | ');

  return {
    campos,
    archivos: archivosActuales,
    archivosNuevos,
    resumen,
    motivo: motivo || 'Actualización del registro',
    snapshot: {
      ...actual,
      anexosMultiples: Array.isArray(actual.anexosMultiples) ? actual.anexosMultiples : [],
      anexos: Array.isArray(actual.anexos) ? actual.anexos : [],
    },
  };
}

export function renderHistorialSummary(detalle = {}) {
  if (!detalle || typeof detalle !== 'object') return 'Cambio registrado';

  const resumen = typeof detalle.resumen === 'string' && detalle.resumen.trim()
    ? detalle.resumen
    : [
        detalle.motivo || 'Cambio registrado',
        ...(Array.isArray(detalle.campos) ? detalle.campos.slice(0, 3).map((campo) => `${campo.label}: ${campo.antes} → ${campo.ahora}`) : []),
        ...(Array.isArray(detalle.archivosNuevos) && detalle.archivosNuevos.length ? [`Adjuntos: ${detalle.archivosNuevos.map((archivo) => archivo.nombre).join(', ')}`] : []),
      ].join(' | ');

  return resumen || 'Cambio registrado';
}
