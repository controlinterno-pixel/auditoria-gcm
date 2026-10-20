import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import nodemailer from 'nodemailer';
import {
  validarAdjuntoEvaluacion, descargarAdjuntoEvaluacion, MAX_EVALUATION_ATTACHMENT_BYTES,
} from '../src/utils/evaluationAttachment.js';
import { evidencias360 } from '../src/utils/reporte360.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const soporte = {
  nombre: 'Evaluación técnica.pdf', tamano: 8,
  url: 'https://repos.termalessantarosa.com.co/api/archivos/auditoria/controlInterno/soporte.pdf',
};
const bytes = new Uint8Array([37, 80, 68, 70, 0, 128, 254, 255]);

test('metadata de soporte exige repositorio corporativo, tipo y tamaño; descarta campos extra', () => {
  assert.deepEqual(validarAdjuntoEvaluacion({ ...soporte, contenidoBase64: 'no guardar' }), { ...soporte, tipo: 'application/pdf' });
  for (const changes of [
    { nombre: 'archivo.exe' }, { nombre: 'archivo\r\n.pdf' }, { tamano: 0 }, { tamano: '8' },
    { tamano: MAX_EVALUATION_ATTACHMENT_BYTES + 1 }, { url: 'https://example.test/a.pdf' },
    { url: soporte.url.replace('https:', 'http:') }, { url: `${soporte.url}?redirect=1` },
    { url: soporte.url.replace('/controlInterno/', '/otraApp/') },
    { url: soporte.url.replace('soporte.pdf', '%2Fetc%2Fpasswd') },
    { url: soporte.url.replace('repos.', 'repos.termalessantarosa.com.co@otro.') },
  ]) assert.throws(() => validarAdjuntoEvaluacion({ ...soporte, ...changes }));
});

test('descarga conserva bytes binarios, limita tamaño real y no permite redirecciones', async () => {
  const archivo = await descargarAdjuntoEvaluacion(soporte, async (url, options) => {
    assert.equal(url, soporte.url);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return new Response(bytes);
  });
  assert.deepEqual(archivo.contenido, bytes);
  await assert.rejects(descargarAdjuntoEvaluacion(soporte, async () => new Response('', { status: 404 })), /descargar/);
  await assert.rejects(descargarAdjuntoEvaluacion(soporte, async () => new Response('')), /vacío/);
  await assert.rejects(descargarAdjuntoEvaluacion(soporte, async () => new Response(bytes, {
    headers: { 'content-length': MAX_EVALUATION_ATTACHMENT_BYTES + 1 },
  })), /2 MB/);
  await assert.rejects(descargarAdjuntoEvaluacion(soporte, async () => new Response(new Uint8Array(MAX_EVALUATION_ATTACHMENT_BYTES + 1))), /2 MB/);
});

function gmailBuilder(prepararAdjuntoCorreo) {
  const text = read('../src/services/gmailService.js');
  const encoding = text.slice(text.indexOf('const encodeBase64 ='), text.indexOf('const escapeHtml ='));
  const builder = text.slice(text.indexOf('const buildRawMessage ='), text.indexOf('export const enviarCorreoGmail ='));
  return new Function('apiService', 'validarAdjuntoEvaluacion', 'buildHtml', `${encoding}\n${builder}\nreturn buildRawMessage;`)(
    { prepararAdjuntoCorreo }, validarAdjuntoEvaluacion, () => '<p>Evaluacion</p>',
  );
}

test('Gmail genera MIME multipart con el PDF binario y nombre internacional, también en reintento', async () => {
  const builder = gmailBuilder(async metadata => {
    assert.deepEqual(metadata, validarAdjuntoEvaluacion(soporte));
    return { contenidoBase64: Buffer.from(bytes).toString('base64') };
  });
  const payload = { asunto: 'Evaluación aprobada', adjuntosCorreo: [soporte] };
  const reintento = JSON.parse(JSON.stringify(payload));
  for (const params of [payload, reintento]) {
    const raw = Buffer.from(await builder(params, 'auditor@example.test', ['ejecutor@example.test']), 'base64url').toString();
    assert.match(raw, /Content-Type: multipart\/mixed/);
    assert.match(raw, /Content-Disposition: attachment/);
    assert.ok(raw.includes("filename*=UTF-8''Evaluaci%C3%B3n%20t%C3%A9cnica.pdf"));
    const contenido = raw.split('Content-Transfer-Encoding: base64\r\n\r\n')[2].split('\r\n--')[0];
    assert.deepEqual(new Uint8Array(Buffer.from(contenido, 'base64')), bytes);
  }
  assert.ok(!JSON.stringify(reintento).includes('contenidoBase64'));
  const simple = Buffer.from(await builder({}, 'auditor@example.test', ['ejecutor@example.test']), 'base64url').toString();
  assert.match(simple, /Content-Type: text\/html/);
  assert.ok(!simple.includes('multipart'));
});

test('Gmail no produce correo sin adjunto si la recuperación del soporte falla', async () => {
  await assert.rejects(gmailBuilder(async () => { throw new Error('Repositorio no disponible'); })(
    { adjuntosCorreo: [soporte] }, 'auditor@example.test', ['ejecutor@example.test'],
  ), /Repositorio no disponible/);
  await assert.rejects(gmailBuilder(async () => ({}))(
    { adjuntosCorreo: [soporte] }, 'auditor@example.test', ['ejecutor@example.test'],
  ), /preparar/);
});

function emailHandler({ authenticated = true, failDownload = false } = {}) {
  const enviados = [];
  const bindings = {
    applyCors: () => false, requireAuth: async () => authenticated ? { email: 'auditor@example.test' } : null,
    sendSuccess: (res, data) => Object.assign(res, { code: 200, data }),
    sendError: (res, error, code) => Object.assign(res, { code, error }),
    logger: { info() {}, error() {} }, validarAdjuntoEvaluacion,
    descargarAdjuntoEvaluacion: async adjunto => {
      if (failDownload) throw new Error('Repositorio no disponible');
      return { ...validarAdjuntoEvaluacion(adjunto), contenido: bytes };
    },
    nodemailer: { createTransport: () => ({ sendMail: async options => { enviados.push(options); return { messageId: 'test' }; } }) },
  };
  const source = read('../api/_notifications/email.js').replace(/^import .*;\r?\n/gm, '').replace('export default ', '');
  const handler = new Function(...Object.keys(bindings), `${source}\nreturn handler;`)(...Object.values(bindings));
  return {
    enviados,
    call: async body => { const res = {}; await handler({ method: 'POST', body }, res); return res; },
  };
}

test('SMTP adjunta contenido binario y API autenticada prepara Gmail sin enviar un segundo correo', async () => {
  const smtp = emailHandler();
  assert.equal((await smtp.call({ destinatarios: 'ejecutor@example.test', adjuntosCorreo: [soporte] })).code, 200);
  assert.equal(smtp.enviados.length, 1);
  assert.deepEqual(smtp.enviados[0].attachments[0].content, Buffer.from(bytes));
  assert.equal(smtp.enviados[0].attachments[0].filename, soporte.nombre);
  const prepare = emailHandler();
  const response = await prepare.call({ operacion: 'preparar-adjunto', adjuntoEvaluacion: soporte });
  assert.equal(response.code, 200);
  assert.equal(response.data.contenidoBase64, Buffer.from(bytes).toString('base64'));
  assert.equal(prepare.enviados.length, 0);
  const unauthenticated = emailHandler({ authenticated: false });
  await unauthenticated.call({ operacion: 'preparar-adjunto', adjuntoEvaluacion: soporte });
  assert.equal(unauthenticated.enviados.length, 0);
});

test('SMTP no envía un mensaje incompleto ante un fallo del repositorio', async () => {
  const h = emailHandler({ failDownload: true });
  assert.equal((await h.call({ destinatarios: 'ejecutor@example.test', adjuntosCorreo: [soporte] })).code, 500);
  assert.equal(h.enviados.length, 0);
});

test('dependencia SMTP produce un correo descargable sin conectarse a un servidor real', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const result = await transport.sendMail({
    from: 'auditor@example.test', to: 'ejecutor@example.test', subject: 'Evaluación',
    text: 'Soporte de evaluación adjunto',
    attachments: [{ filename: soporte.nombre, contentType: 'application/pdf', content: Buffer.from(bytes) }],
  });
  const raw = result.message.toString();
  assert.match(raw, /Content-Type: multipart\/mixed/);
  assert.match(raw, /Content-Disposition: attachment/);
  assert.ok(raw.includes(Buffer.from(bytes).toString('base64')));
});

test('Reporte 360 conserva el soporte vigente e histórico sin duplicarlo', () => {
  const resultado = evidencias360({
    evaluacionHolistica: { adjuntoEvaluacion: soporte },
    historialEvaluaciones: [{ adjuntoEvaluacion: soporte }, { puntaje: 100 }],
  });
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].url, soporte.url);
  assert.equal(resultado[0].nombre, soporte.nombre);
});

test('formulario no guarda sin soporte ni notifica si la evaluación falla al persistir', async () => {
  const text = read('../src/components/Planes.jsx');
  const start = text.indexOf('  const confirmarEvaluacionHolistica =');
  const body = text.slice(start, text.indexOf('  const handleEliminarEvaluacion =', start));
  for (const adjuntoEvaluacion of [null, soporte]) {
    const calls = [];
    const resets = [];
    const bindings = {
      guardandoEvaluacionInicial: false, subiendoEvaluacion: false,
      informesAuditoria: [{ id: 'i1' }], modalEval: { idInforme: 'i1', planes: [{ id: 1 }] },
      paqueteListoParaEvaluacion: () => true, esAuditorAsignadoEvaluador: () => true,
      puntajeHolistico: 100, justificacion: 'Dictamen conservado', criterios: {},
      adjuntoEvaluacion, validarAdjuntoEvaluacion, window: { confirm: () => true },
      setErrorAdjuntoEvaluacion: error => calls.push(['error', error]),
      showNotification: (...args) => calls.push(['notification', ...args]),
      setGuardandoEvaluacionInicial: state => calls.push(['saving', state]),
      prepararEnvioGmail: null,
      apiService: { evaluarDisenoPlanes: async (...args) => { calls.push(['api', ...args]); throw new Error('Write failed'); } },
      setPlanes: () => calls.push(['setPlanes']),
      volverAlHistorialTrasGuardarAccion: () => resets.push('navigate'),
      setModalEval: () => resets.push('modal'), setJustificacion: () => resets.push('dictamen'),
      setAdjuntoEvaluacion: () => resets.push('soporte'), setCriterios: () => resets.push('criterios'),
      notificarResultadoEvaluacionInicial: async () => calls.push(['mail']),
    };
    const confirm = new Function(...Object.keys(bindings), `${body}\nreturn confirmarEvaluacionHolistica;`)(...Object.values(bindings));
    await confirm();
    assert.equal(calls.filter(call => call[0] === 'api').length, adjuntoEvaluacion ? 1 : 0);
    assert.equal(calls.filter(call => call[0] === 'mail').length, 0);
    assert.equal(calls.filter(call => call[0] === 'setPlanes').length, 0);
    assert.deepEqual(resets, []);
    if (adjuntoEvaluacion) assert.deepEqual(calls.find(call => call[0] === 'api')[5], validarAdjuntoEvaluacion(soporte));
  }
});
