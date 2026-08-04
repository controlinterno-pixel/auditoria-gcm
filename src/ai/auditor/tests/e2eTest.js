/**
 * @file e2eTest.js
 * @description Prueba End-to-End (E2E) para validar el flujo completo del AuditEngine con RiskSpecialist.
 */

import { AuditEngine } from '../core/AuditEngine.js';

async function runE2ETest() {
  console.log("🚀 Iniciando prueba End-to-End (E2E) del Motor IA GRC...\n");

  const queryMock = "Realiza un análisis ejecutivo de los riesgos actuales asociados a la operación de termales.";
  const contextMock = {
    userId: "USR-001",
    role: "AUDITOR_LEAD",
    tenant: "Termales Santa Rosa de Cabal"
  };

  try {
    console.log(`💬 Consulta de prueba: "${queryMock}"\n`);
    
    // Ejecutar flujo principal a través del AuditEngine
    const result = await AuditEngine.processQuery(queryMock, contextMock);

    console.log("--------------------------------------------------");
    console.log("📊 RESULTADO DEL AUDIT ENGINE:");
    console.log("--------------------------------------------------");
    console.log(`✅ ¿Es válido?: ${result.isValid}`);
    console.log(`📋 Esquema aplicado: ${result.schema || 'N/A'}`);
    console.log("--------------------------------------------------");
    console.log("📄 DATA RECIBIDA Y VALIDADA:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("--------------------------------------------------");

  } catch (error) {
    console.error("❌ Fallo en la prueba E2E:", error);
  }
}

// Ejecutar prueba
runE2ETest();