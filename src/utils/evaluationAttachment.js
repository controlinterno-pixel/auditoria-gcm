export const MAX_EVALUATION_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const EVALUATION_ATTACHMENT_ACCEPT = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg';

const tipos = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};
const contieneControl = valor => Array.from(valor).some(caracter => caracter.charCodeAt(0) < 32);

export function validarArchivoEvaluacion({ nombre, tamano }) {
  const extension = typeof nombre === 'string' ? nombre.split('.').pop().toLowerCase() : '';
  if (!nombre || nombre.length > 180 || /[/\\]/.test(nombre) || contieneControl(nombre) || !tipos[extension]) {
    throw new Error('Selecciona un archivo PDF, DOCX, XLSX, PNG o JPG con un nombre de hasta 180 caracteres.');
  }
  if (!Number.isSafeInteger(tamano) || tamano <= 0 || tamano > MAX_EVALUATION_ATTACHMENT_BYTES) {
    throw new Error('El soporte de evaluación debe pesar entre 1 byte y 2 MB.');
  }
  return tipos[extension];
}

export function validarAdjuntoEvaluacion(adjunto) {
  if (!adjunto || typeof adjunto !== 'object') throw new Error('Adjunta el soporte de evaluación antes de guardar.');
  const tipo = validarArchivoEvaluacion(adjunto);
  let url;
  let archivo;
  try {
    url = new URL(adjunto.url);
    archivo = decodeURIComponent(url.pathname.split('/').pop());
  } catch {
    throw new Error('El soporte no tiene una dirección de descarga válida. Vuelve a cargarlo.');
  }
  if (url.origin !== 'https://repos.termalessantarosa.com.co' || url.username || url.password ||
      url.search || url.hash || !/^\/api\/archivos\/auditoria\/controlinterno\/[^/]+$/i.test(url.pathname) ||
      /[\\/]/.test(archivo) || contieneControl(archivo) || ['.', '..'].includes(archivo)) {
    throw new Error('El soporte debe estar guardado en el repositorio corporativo de Control Interno.');
  }
  return { nombre: adjunto.nombre, tamano: adjunto.tamano, tipo, url: url.href };
}

export async function descargarAdjuntoEvaluacion(adjunto, fetchArchivo = fetch) {
  const metadata = validarAdjuntoEvaluacion(adjunto);
  const respuesta = await fetchArchivo(metadata.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!respuesta.ok || !respuesta.body) throw new Error('No se pudo descargar el soporte de evaluación. Reintenta el envío.');
  if (Number(respuesta.headers.get('content-length')) > MAX_EVALUATION_ATTACHMENT_BYTES) {
    await respuesta.body.cancel();
    throw new Error('El soporte de evaluación supera los 2 MB permitidos.');
  }
  const reader = respuesta.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_EVALUATION_ATTACHMENT_BYTES) throw new Error('El soporte de evaluación supera los 2 MB permitidos.');
      chunks.push(value);
    }
    if (!total) throw new Error('El soporte de evaluación está vacío.');
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const contenido = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    contenido.set(chunk, offset);
    offset += chunk.length;
  }
  return { ...metadata, contenido };
}
