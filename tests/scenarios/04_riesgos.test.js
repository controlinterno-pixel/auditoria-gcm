// tests/scenarios/04_riesgos.test.js - Pruebas del Motor de Cálculo de Riesgos
import { TestClient, Assert } from '../integration.runner.js';

export async function runRiesgosTests() {
  console.log('\n📊 --- MÓDULO 4: Motor de Cálculo de Riesgos (ISO 31000 / E-GE-MAN-001) ---');
  const client = new TestClient();

  // 4.1 Intento de lectura no autenticada
  const resUnauth = await client.request('/api/grc/riesgos');
  Assert.equals(resUnauth.status, 401, 'Zero Trust: Rechazo 401 a consulta de riesgos sin sesión activa');

  // 4.2 Intento de creación sin autenticación
  const resBadCreate = await client.request('/api/grc/riesgos', {
    method: 'POST',
    body: {
      id: 9999,
      proceso: 'TALENTO_HUMANO',
      probabilidadInherente: 80,
      impactoInherente: 80
    }
  });
  Assert.equals(resBadCreate.status, 401, 'Zero Trust: Rechazo 401 a creación de riesgos sin autenticación');

  // 4.3 Intento de eliminación sin autenticación
  const resBadDelete = await client.request('/api/grc/riesgos?id=9999', {
    method: 'DELETE'
  });
  Assert.equals(resBadDelete.status, 401, 'Zero Trust: Rechazo 401 a eliminación de riesgos sin permisos');
}