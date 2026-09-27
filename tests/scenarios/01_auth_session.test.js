// tests/scenarios/01_auth_session.test.js
import { TestClient, Assert } from '../integration.runner.js';

export async function runAuthTests() {
  console.log('\n🔒 --- MÓDULO 1: Autenticación, Cookies e Inmunidad Rate Limit ---');
  const client = new TestClient();

  // 1.1 Intentar acceder a endpoint protegido sin cookie
  const resUnauth = await client.request('/api/auth/me');
  Assert.equals(resUnauth.status, 401, 'Rechazo 401 a petición sin sesión activa');

  // 1.2 Envío de payload inválido en Login
  const resBadLogin = await client.request('/api/auth/login', {
    method: 'POST',
    body: { idToken: '' }
  });
  Assert.equals(resBadLogin.status, 400, 'Rechazo 400 por idToken ausente o malformado');

  // 1.3 Prueba de Rate Limiting (Agotamiento de intentos)
  console.log('  ⏳ Evaluando Rate Limiter (Simulación de 5 intentos fallidos consecutivas)...');
  for (let i = 0; i < 5; i++) {
    await client.request('/api/auth/login', {
      method: 'POST',
      body: { idToken: 'token_falso_intento_invalido' }
    });
  }

  const resRateLimited = await client.request('/api/auth/login', {
    method: 'POST',
    body: { idToken: 'token_falso_intento_invalido' }
  });
  Assert.equals(resRateLimited.status, 429, 'Bloqueo 429 Too Many Requests activado correctamente por IP');
}