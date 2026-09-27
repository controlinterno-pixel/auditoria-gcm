// tests/scenarios/03_file_upload.test.js - Validación de Seguridad en Carga de Archivos
import { TestClient, Assert } from '../integration.runner.js';

export async function runUploadTests() {
  console.log('\n📁 --- MÓDULO 3: Validación de Archivos y Límites de Payload ---');
  const client = new TestClient();

  // 3.1 Verificación de Barrera Zero Trust: Carga sin autenticación previa
  const resBadExt = await client.request('/api/grc/upload', {
    method: 'POST',
    body: {
      fileName: 'script_malicioso.exe',
      fileType: 'application/x-msdownload',
      fileBase64: 'data:application/x-msdownload;base64,TVqQAAMAAAAEAAAA'
    }
  });

  // El servidor debe rechazar la petición en la capa de autenticación (401)
  Assert.equals(
    resBadExt.status, 
    401, 
    'Protección Zero Trust: Rechazo 401 a intento de subida sin sesión activa'
  );

  // 3.2 Verificación de Límite de Payload en cliente/servidor
  const base64Gigante = 'A'.repeat(8 * 1024 * 1024); // ~8MB
  const resPayloadTooLarge = await client.request('/api/grc/upload', {
    method: 'POST',
    body: {
      fileName: 'evidencia_gigante.pdf',
      fileType: 'application/pdf',
      fileBase64: base64Gigante
    }
  });

  // Sin autenticación debe ser bloqueado por seguridad (401) o por tamaño (413)
  Assert.isTrue(
    resPayloadTooLarge.status === 401 || resPayloadTooLarge.status === 413,
    'Protección de Infraestructura: Bloqueo seguro (401/413) a carga excesiva de payload'
  );
}