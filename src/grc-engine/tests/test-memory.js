import { AuditEngine } from './src/grc-engine/AuditEngine.js'; // Ajusta la ruta si es necesario

async function runMemoryTest() {
    const engine = new AuditEngine();
    const sessionId = "sesion-auditor-001"; // Usamos la misma sesión para ambas preguntas

    console.log("\n==================================================");
    console.log("🗣️ TURNO 1: Pregunta inicial (Sin memoria previa)");
    console.log("==================================================");
    
    const query1 = "¿Cuáles son los principales riesgos operativos en las piscinas termales?";
    console.log(`Usuario: "${query1}"\n`);
    
    const result1 = await engine.execute(query1, sessionId);
    console.log("\n🤖 Respuesta del Motor (Resumen):");
    console.log(result1.llm.parsedResponse?.summary || "Sin resumen");
    
    console.log("\n==================================================");
    console.log("🗣️ TURNO 2: Pregunta de seguimiento (Debe usar memoria)");
    console.log("==================================================");
    
    // Hacemos una pregunta ambigua que depende del contexto anterior
    const query2 = "¿Qué controles están implementados para el primero de esos riesgos que mencionaste?";
    console.log(`Usuario: "${query2}"\n`);
    
    const result2 = await engine.execute(query2, sessionId);
    console.log("\n🤖 Respuesta del Motor (Resumen):");
    console.log(result2.llm.parsedResponse?.summary || "Sin resumen");
    console.log("\n==================================================");
    console.log("✅ Prueba finalizada.");
}

runMemoryTest();