import assert from 'node:assert/strict';
import { buildHistorialDetalle, renderHistorialSummary } from '../src/utils/historialCambios.js';

const anterior = {
  titulo: 'Informe inicial',
  proceso: 'Gestion comercial',
  subproceso: 'General',
  tipoFuente: 'Cliente',
  detalleFuente: 'Solicitado por cliente de la operación',
  socializado: 'No',
  evidenciaUrl: 'https://old.example.com/informe.pdf',
  anexosMultiples: [{ url: 'https://old.example.com/anexo1.pdf', nombre: 'anexo1.pdf' }],
  correoEnviadoA: 'jefe@termales.com',
};

const actual = {
  titulo: 'Informe actualizado',
  proceso: 'Gestión comercial',
  subproceso: 'General',
  tipoFuente: 'Auditoría',
  detalleFuente: 'Hallazgo identificado durante auditoría interna',
  socializado: 'Sí',
  evidenciaUrl: 'https://new.example.com/informe.pdf',
  anexosMultiples: [
    { url: 'https://old.example.com/anexo1.pdf', nombre: 'anexo1.pdf' },
    { url: 'https://new.example.com/anexo2.pdf', nombre: 'anexo2.pdf' },
  ],
  correoEnviadoA: 'control@termales.com',
};

const detalle = buildHistorialDetalle({
  anterior,
  actual,
  motivo: 'Se corrigió el nombre del proceso y se agregó un anexo',
  correosNotificacionOut: 'control@termales.com',
});

assert.ok(Array.isArray(detalle.campos), 'Debe devolver campos cambiados');
assert.ok(detalle.campos.some((campo) => campo.campo === 'titulo'), 'Debe detectar cambio del título');
assert.ok(detalle.campos.some((campo) => campo.campo === 'tipoFuente'), 'Debe detectar cambio de la fuente del informe');
assert.ok(detalle.campos.some((campo) => campo.campo === 'correoEnviadoA'), 'Debe detectar cambios en los correos de notificación');
assert.ok(detalle.campos.some((campo) => campo.campo === 'socializado'), 'Debe detectar cambio de socializado');
assert.ok(detalle.archivos.some((archivo) => archivo.nombre === 'anexo2.pdf'), 'Debe registrar el anexo nuevo');
assert.ok(detalle.snapshot && detalle.snapshot.evidenciaUrl === actual.evidenciaUrl, 'Debe guardar un snapshot completo para restaurar la versión');
assert.ok(detalle.snapshot && detalle.snapshot.tipoFuente === 'Auditoría', 'Debe conservar la fuente en el snapshot');
assert.ok(detalle.snapshot && detalle.snapshot.correoEnviadoA === 'control@termales.com', 'Debe conservar los correos en el snapshot');
assert.match(renderHistorialSummary(detalle), /titulo|proceso|socializado|anexo|fuente|correo/i, 'Debe generar un resumen legible');

console.log('Historial de cambios: OK');
