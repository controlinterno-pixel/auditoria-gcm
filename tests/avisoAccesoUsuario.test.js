// tests/avisoAccesoUsuario.test.js - Al aprobar o rechazar una solicitud se avisa al solicitante por Gmail,
// con el mismo envío y la misma bandeja de reintentos de las notificaciones de planes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { correoAccesoResuelto } from '../src/utils/avisoAccesoUsuario.js';

const usuario = { nombreResponsable: 'Ana Pérez', correo: 'ana@termales.com.co', rol: 'lider' };

test('la aprobación lleva rol, macroprocesos, subprocesos y el enlace del aplicativo', () => {
  const payload = correoAccesoResuelto(usuario, {
    estadoAcceso: 'activo', procesosAsignados: ['Gestión Humana'], subprocesosAsignados: ['Nómina'],
  }, 'https://gcm.example.com');
  assert.equal(payload.destinatarios, 'ana@termales.com.co');
  assert.equal(payload.titulo_informe, 'Tu acceso al aplicativo GCM fue aprobado');
  assert.equal(payload.proceso_auditado,
    'Hola, Ana Pérez: ya puedes ingresar con tu correo y contraseña. Rol: Líder de proceso. Macroprocesos: Gestión Humana. Subprocesos: Nómina.');
  assert.equal(payload.enlace_pdf, 'https://gcm.example.com');
});

test('sin subprocesos indica que son todos los de sus macroprocesos', () => {
  const payload = correoAccesoResuelto({ email: 'b@termales.com.co' }, { estadoAcceso: 'activo', procesosAsignados: ['Financiera'] }, '');
  assert.equal(payload.destinatarios, 'b@termales.com.co');
  assert.match(payload.proceso_auditado, /^Hola: /);
  assert.match(payload.proceso_auditado, /Subprocesos: todos los de esos macroprocesos\./);
});

test('el rechazo no menciona procesos ni lleva enlace', () => {
  const payload = correoAccesoResuelto(usuario, { estadoAcceso: 'rechazado' }, 'https://gcm.example.com');
  assert.equal(payload.titulo_informe, 'Solicitud de acceso rechazada');
  assert.equal(payload.enlace_pdf, undefined);
  assert.doesNotMatch(payload.proceso_auditado, /Macroprocesos/);
});

test('Configuración prepara Gmail en el clic, envía y, si falla, deja el reintento en la bandeja', () => {
  const pantalla = readFileSync(new URL('../src/components/Configuracion.jsx', import.meta.url), 'utf8');
  const inicio = pantalla.indexOf('const resolverSolicitudAcceso');
  const cuerpo = pantalla.slice(inicio, pantalla.indexOf('const guardarAlcanceUsuario'));
  assert.ok(cuerpo.indexOf('prepararEnvioGmail()') < cuerpo.indexOf('await apiService.resolverSolicitudAcceso'),
    'la autorización de Google se pide antes de esperar al servidor');
  assert.match(cuerpo, /ejecutarDespachoGmailApi\(payload\)/);
  assert.match(cuerpo, /encolarReintentoNotificacion\?\.\(payload, \{ tipo: 'acceso' \}\)/);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /<Configuracion[\s\S]*?ejecutarDespachoGmailApi=\{ejecutarDespachoGmailApi\}[\s\S]*?\/>/);
});
