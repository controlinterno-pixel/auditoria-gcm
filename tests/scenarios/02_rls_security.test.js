// tests/scenarios/02_rls_security.test.js
import { TestClient, Assert } from '../integration.runner.js';

export async function runRlsTests() {
  console.log('\n🛡️ --- MÓDULO 2: Seguridad RLS y Control de Permisos Server-Side ---');
  const client = new TestClient();

  // 2.1 Intentar escritura estructural sin credenciales de Administrador
  const resEscrituraInsegura = await client.request('/api/grc/sync', {
    method: 'POST',
    body: { partialData: { hack: true } }
  });
  Assert.equals(resEscrituraInsegura.status, 401, 'Bloqueo 401 a usuario no autenticado intentando modificar DB');

  // 2.2 Intentar modificar datos personales para escalar RLS (Ataque de Inyección de Proceso)
  const resInyeccionPerfil = await client.request('/api/auth/profile', {
    method: 'POST',
    body: { 
      nombreResponsable: 'Usuario Test',
      procesoAsignado: 'GERENCIA_GENERAL' // Intento no permitido
    }
  });
  
  if (resInyeccionPerfil.status === 200) {
    Assert.isTrue(
      resInyeccionPerfil.body.data.user.procesoAsignado !== 'GERENCIA_GENERAL',
      'El endpoint de perfil rechaza/ignora la modificación no autorizada de procesoAsignado'
    );
  }
}