// 1. Cargar las variables de entorno desde el .env
import 'dotenv/config'; 

// 2. Importar el motor central de auditoría
import { AuditEngine } from '../core/AuditEngine.js';

async function runE2ETest() {
  console.log("🚀 Iniciando prueba del Motor IA GRC (Nueva Arquitectura)...\n");

  const query = "Realiza un análisis ejecutivo de los riesgos actuales asociados a la operación de termales.";
  
  // Simulamos IDs para el nuevo ExecutionContext
  const sessionId = "sesion_usuario_123";
  const conversationId = "conv_termales_001";

  console.log(`💬 Consulta de prueba: "${query}"\n`);

  try {
    // 3. Instanciar el nuevo motor
    const engine = new AuditEngine();

    // 4. Ejecutar el pipeline unidireccional
    const finalContext = await engine.execute(query, sessionId, conversationId);

    console.log("\n✅ Pipeline Finalizado. Estado del ExecutionContext:");
    console.log(JSON.stringify(finalContext, null, 2));

    // 5. Imprimir el payload final ensamblado para auditoría visual
    console.log("\n==================================================");
    console.log("📦 PAYLOAD ENSAMBLADO PARA EL LLM (Fase 4)");
    console.log("==================================================\n");
    console.log(finalContext.prompt.assembledPayload);
    console.log("\n==================================================");
    
  } catch (error) {
    console.error("❌ Fallo en la prueba del motor:", error.message || error);
  }
}

runE2ETest();