# Motor de Inteligencia GRC (Auditor IA)

**Filosofia del Proyecto:**
"La IA no es el producto. La IA es un componente del producto."

## Reglas de Arquitectura Estricta

1. **REGLA #1: Aislamiento de Datos**
   La IA NUNCA accedera directamente a la base de datos. Todo dato debe pasar por el `KnowledgeManager`.

2. **REGLA #2: Contratos JSON**
   La IA NUNCA construira texto libre para la interfaz. Siempre debe responder bajo un esquema estricto (ubicados en `schemas/`), validado por el `ResponseValidator`.

3. **REGLA #3: Prompts Aislados**
   Los prompts NUNCA estaran mezclados con logica JavaScript. Todo texto o instruccion para el LLM vivira en formato `.md` dentro de la carpeta `prompts/`.

4. **REGLA #4: Responsabilidad Unica**
   Cada archivo en `core/` tiene una unica tarea. React se comunicara de forma exclusiva con `index.js`, ignorando el resto de la implementacion interna.