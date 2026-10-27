// src/components/proyectos/guias.js - Ayuda de cada casilla: qué es, cómo diligenciarla, por qué se pide y
// dónde lo exige el Manual Metodológico de Gestión de Proyectos E-ID-MAN-01 (v4, 09/2025). Las páginas son
// las del PDF del manual. Si una casilla no la pide el manual, la ayuda lo dice.
import { createContext } from 'react';

/** Formulario o apartado donde está la casilla: distingue "Estado" de una tarea del de un riesgo. */
export const ContextoGuia = createContext('');

const MANUAL = 'Manual E-ID-MAN-01';
const m = (numeral, pagina) => `${MANUAL}, numeral ${numeral} (pág. ${pagina}).`;
const MODULO = 'No lo exige el manual: es una herramienta del módulo para el seguimiento.';
const PMBOK_18 = m('4.2 · Apartado 18 "Ejecución del proyecto" (gestión del cronograma, presupuesto y riesgos)', 32);
const A1 = m('4.1.2.1 · Apartado 1 "Problema u oportunidad"', 8);
const A2 = m('4.1.2.1 · Apartado 2 "Alternativas de aprovechamiento o soluciones"', 9);
const A3 = m('4.1.2.1 · Apartado 3 "Condiciones del entorno"', 10);
const A4 = m('4.1.2.1 · Apartado 4 "Aspectos a considerar"', 11);
const A5 = m('4.1.2.1 · Apartado 5 "Cronograma preliminar por ciclo de vida"', 11);
const A6 = m('4.1.3.1 · Apartado 6 "Objetivos"', 16);
const A61 = m('4.1.3.1 · Apartado 6.1 "Objetivos específicos"', 17);
const A71 = m('4.1.3.1 · Apartado 7.1 "Análisis PESTEL" (figuras 1 a 3)', 17);
const A72 = m('4.1.3.1 · Apartado 7.2 "Canva modelo propuesta de valor" (figura 4)', 20);
const A73 = m('4.1.3.1 · Apartado 7.3 "Canva modelo de negocio" (figura 5)', 21);
const A8 = m('4.1.3.1 · Apartado 8 "Proyección de ingresos"', 24);
const A9 = m('4.1.3.1 · Apartado 9 "Estudios técnicos de localización y tamaño"', 24);
const A10 = m('4.1.3.1 · Apartado 10 "Estudios de ingeniería" (figura 6)', 24);
const A101 = m('4.1.3.1 · Apartado 10.1 "Análisis organizacional"', 26);
const A11 = m('4.1.3.1 · Apartado 11 "Análisis financiero"', 26);
const A12 = m('4.2 · Apartado 12 "Matriz de interesados"', 27);
const A13 = m('4.2 · Apartado 13 "Estructura de desglose de trabajo (EDT)"', 28);
const A14 = m('4.2 · Apartado 14 "Organigrama del proyecto"', 29);
const A15 = m('4.2 · Apartado 15 "Matriz RACI"', 29);
const A16 = m('4.2 · Apartado 16 "Gestión de riesgos"', 30);
const A17 = m('4.2 · Apartado 17 "Acta de constitución del proyecto"', 31);
const EVM = m('4.2.1 "Valor ganado"', 33);
const LECCIONES = m('4.2.2 "Lecciones aprendidas"', 33);
const CIERRE = m('4.2 · "Acta de cierre"', 34);
const OPERACION = m('4.3 "Operación y cierre"', 35);
const PORTAFOLIO = m('5 · Capítulo II "Portafolio de programas y proyectos" y 6.1 "Documentación del proyecto"', 37);
const PMO = m('3.1.8 "Oficina de Dirección de Proyectos (PMO)"', 6);
const DIRECTOR = m('3.1.6 "Director de proyecto"', 6);

// [qué es, cómo diligenciarlo, por qué se pide, dónde está en el manual]
const G = {
  // Ficha del proyecto
  'ficha|Nombre del proyecto': ['El nombre con el que se identificará el proyecto en el portafolio, actas y reportes.', 'Breve y descriptivo: qué se hará y dónde. Evita fechas o fases en el nombre; esas se registran en sus casillas.', 'Es el "título" que exigen el Acta de constitución y el Acta de cierre.', A17],
  'ficha|Descripción': ['Resumen de en qué consiste el proyecto.', 'Dos o tres frases: qué se va a construir o cambiar y para quién.', 'Da contexto a quien revisa el portafolio sin leer toda la formulación.', m('4.1.3 "Factibilidad" (formulación del proyecto)', 15)],
  'ficha|Justificación': ['Por qué la empresa debe invertir en este proyecto.', 'Dos o tres frases con el beneficio esperado y su alineación con la estrategia 2024-2030.', 'El Acta de constitución exige la justificación (2–3 frases).', A17],
  'ficha|Problema u oportunidad que atiende': ['El "por qué" del proyecto: la necesidad, situación crítica o posibilidad de mejora que lo origina.', 'Describe el problema central con evidencia (cifras, indicadores, auditorías, reclamos), sus impactos actuales y las consecuencias de no actuar. Si son varios problemas, uno por párrafo. Puedes apoyarte en el árbol de problemas o el análisis causa-raíz.', 'Es la base de toda la formulación y de la aprobación de la Prefactibilidad.', A1],
  'ficha|Pilar estratégico': ['El pilar de la estrategia 2024-2030 al que aporta el proyecto.', 'E = Económico, S = Social, A = Ambiental. Elige el pilar del indicador estratégico al que contribuye.', 'Forma la primera letra del código del portafolio (por ejemplo E1_SP1_PY1).', PORTAFOLIO],
  'ficha|N.° de programa': ['Número del programa dentro del pilar.', 'Según la posición del programa en los indicadores estratégicos (1, 2, 3…).', 'Segundo elemento del código del portafolio.', PORTAFOLIO],
  'ficha|N.° de subprograma': ['Número del subprograma dentro del programa (opcional).', 'Déjalo vacío si el proyecto cuelga directamente del programa. Si existe, usa su posición (SP1, SP2…).', 'Tercer nivel de la estructura del portafolio.', PORTAFOLIO],
  'ficha|N.° de proyecto': ['Número del proyecto dentro del subprograma (o del programa).', 'Su posición en el subprograma: PY1, PY2… El sistema no permite repetir un código ya usado.', 'Identifica al proyecto en el portafolio y es el prefijo de todos sus archivos.', PORTAFOLIO],
  'ficha|Metodología': ['Cómo se planificará y controlará el trabajo.', 'Predictiva: EDT, cronograma, línea base e hitos (proyectos de infraestructura o con alcance fijo). Ágil: backlog e historias priorizadas en sprints (alcance que se descubre). Híbrida: ambas, por ejemplo diseño ágil y obra predictiva.', 'Define qué pestañas y controles aplica el módulo (línea base, sprints, ruta crítica).', MODULO],
  'ficha|Prioridad': ['Importancia del proyecto frente a los demás del portafolio.', 'Crítica: no puede esperar o afecta la operación. Alta: aporta directo a la estrategia. Media: importante sin urgencia. Baja: puede postergarse.', 'Ayuda al Comité a ordenar recursos entre proyectos.', PMO],
  'ficha|Objetivo general': ['La meta principal: el estado futuro que se alcanza al terminar el proyecto.', 'Una sola frase SMART (específica, medible, alcanzable, relevante y con tiempo). Debe responder directamente al problema u oportunidad.', 'Se evalúa en el Acta de cierre para saber si el proyecto cumplió.', A6],
  'ficha|Objetivos específicos': ['Resultados parciales, medibles y temporales que juntos logran el objetivo general.', 'Uno por línea, con la fórmula "verbo + resultado + unidad de medida". Máximo 5, salvo que la naturaleza del proyecto lo justifique.', 'Guían la planificación, el diseño de actividades y la medición de avances.', A61],
  'ficha|Alcance incluido': ['Lo que el proyecto sí entregará (hasta dónde va).', 'Lista los entregables y el trabajo comprometido. Todo lo que esté aquí debe aparecer en la EDT (regla del 100 %).', 'Es el "alcance in" del Acta de constitución.', A17],
  'ficha|Fuera del alcance': ['Lo que el proyecto no hará, aunque alguien pueda esperarlo.', 'Escribe explícitamente lo excluido para evitar discusiones y cambios no aprobados.', 'Es el "alcance out" del Acta de constitución.', A17],
  'ficha|Dependencias y restricciones': ['Condiciones que limitan o condicionan el proyecto.', 'Permisos, temporadas, proveedores únicos, presupuesto máximo, fechas fijas, normas.', 'El Acta de constitución exige los "requisitos generales y restricciones".', A17],
  'ficha|Riesgos iniciales identificados': ['Primeros riesgos que se ven desde la idea.', 'Enuméralos brevemente. Para gestionarlos (probabilidad, impacto, responsable) regístralos en la pestaña Riesgos.', 'Forman parte de los aspectos a considerar en la Prefactibilidad.', A4],
  'ficha|Director o gerente del proyecto': ['La persona que lidera al equipo y responde por los objetivos.', 'Correo @termales.com.co del líder asignado por el Comité I+D+i o el Comité Estratégico.', 'Gestiona la ficha, el cronograma, los costos y solicita las aprobaciones de fase.', DIRECTOR],
  'ficha|Patrocinador': ['La Gerencia que autoriza el proyecto y aprueba cada fase.', 'Correo de la persona de Gerencia que firma las actas. Debe ser distinta del director: nadie aprueba sus propias solicitudes.', 'Aprueba la Prefactibilidad, la Factibilidad, el Acta de constitución y el Acta de cierre.', m('4.1.2 "Aprobación de Prefactibilidad" y 4.1.3 "Aprobación de Factibilidad"', 12)],
  'ficha|Comité I+D+i / Estratégico': ['Integrantes del Comité que cumple funciones de PMO.', 'Correos separados por coma. También pueden aprobar las fases. Después de crear el proyecto solo un administrador los cambia.', 'El manual asigna al Comité el control de la metodología y la autoridad para decidir sobre los proyectos.', PMO],
  'ficha|Responsable del área': ['Líder del área donde se implementa el proyecto.', 'Correo @termales.com.co. Tendrá acceso de consulta.', 'Es un interesado clave que recibe el resultado en la operación.', OPERACION],
  'ficha|Área': ['Área de la empresa a la que pertenece el proyecto.', 'Elige o escribe el macroproceso.', 'Permite filtrar el portafolio por área.', MODULO],
  'ficha|Proceso': ['Proceso que se mejora o se crea.', 'El proceso del mapa de procesos afectado.', 'Facilita la entrega a la operación y el control de cambios de Calidad.', OPERACION],
  'ficha|Portafolio': ['Nombre del portafolio al que pertenece.', 'Normalmente "Portafolio TSRC".', 'Agrupa los proyectos alineados con la estrategia.', PORTAFOLIO],
  'ficha|Programa': ['Nombre del programa estratégico.', 'El nombre del programa cuyo número usaste en el código.', 'Agrupa proyectos relacionados.', PORTAFOLIO],
  'ficha|Equipo de trabajo': ['Personas que ejecutan tareas del proyecto.', 'Correos separados por coma. Podrán actualizar el avance de las tareas que se les asignen.', 'El organigrama y la RACI se construyen sobre este equipo.', A14],
  'ficha|Aprobadores': ['Personas que revisan tareas, entregables y cambios.', 'Correos separados por coma. Nunca aprueban lo que ellos mismos ejecutaron o presentaron.', 'Corresponden al rol "A" (aprueba) de la matriz RACI.', A15],
  'ficha|Lectores': ['Personas que solo consultan.', 'Correos separados por coma; no pueden modificar nada.', 'Son los interesados "informados" del proyecto.', A12],
  'ficha|Fecha de solicitud': ['Cuándo se presentó la idea del proyecto.', 'Fecha en que la iniciativa llegó al Comité.', 'Marca el inicio de la Preinversión.', m('4.1 "Preinversión"', 7)],
  'ficha|Calendario del cronograma': ['Cómo se cuentan los días del cronograma.', 'Laboral: duraciones y dependencias de lunes a viernes. Todos los días: también fines de semana (útil para obras continuas). No descuenta festivos.', 'Hace realistas las fechas al reprogramar por dependencias.', MODULO],
  'ficha|Inicio planificado': ['Fecha prevista de inicio del proyecto.', 'La fecha de inicio de la primera fase del cronograma preliminar.', 'Es parte del cronograma de hitos del Acta de constitución.', A5],
  'ficha|Fin planificado': ['Fecha prevista de terminación.', 'El fin de la fase de Operación y cierre del cronograma preliminar.', 'Permite medir el cumplimiento del plazo en el cierre.', A5],
  'ficha|Inicio real': ['Fecha en que realmente inició la ejecución.', 'Se registra sola al aprobar el Acta de constitución; corrígela si fue otra.', 'Se compara con lo planificado en la evaluación del desempeño.', CIERRE],
  'ficha|Fin real': ['Fecha en que realmente terminó.', 'Se registra sola al aprobar el Acta de cierre.', 'Mide la desviación del plazo.', CIERRE],
  'ficha|Presupuesto aprobado': ['Monto aprobado por la Gerencia para el proyecto.', 'Valor total en la moneda elegida. Desde la ejecución solo cambia con una solicitud de cambio aprobada (queda la revisión registrada).', 'Es el "presupuesto preliminar" del Acta de constitución y la base del valor ganado.', A17],
  'ficha|Moneda': ['Moneda del presupuesto y los costos.', 'COP salvo que el proyecto se contrate en otra moneda.', 'Evita sumar cifras de monedas distintas en el portafolio.', MODULO],
  'ficha|Beneficios esperados': ['Lo que la empresa gana cuando el proyecto funcione.', 'Beneficios medibles: ingresos, ahorro, satisfacción, cumplimiento, posicionamiento.', 'Se contrastan en el Acta de cierre con los beneficios logrados.', CIERRE],
  'ficha|Indicadores esperados': ['Cómo se medirá el éxito una vez en operación.', 'Nombre del indicador, meta y frecuencia (por ejemplo "visitantes por mes ≥ 500").', 'La entrega a la operación incluye la revisión de indicadores clave.', OPERACION],
  'ficha|Criterios de éxito y aceptación': ['Condiciones para dar el proyecto por exitoso y aceptado.', 'Criterios verificables: cumplimiento de objetivos, calidad, plazo y presupuesto.', 'El Acta de constitución exige los criterios de éxito; el Acta de cierre los verifica.', A17],
  'ficha|Atraso para alerta': ['Puntos porcentuales de atraso que encienden el semáforo amarillo.', 'Diferencia entre avance real y planificado. Por defecto 5.', 'Define cuándo el proyecto requiere atención.', MODULO],
  'ficha|Atraso crítico': ['Puntos de atraso que encienden el semáforo rojo.', 'Debe ser mayor que el umbral de alerta. Por defecto 15.', 'Señala desviaciones que el Comité debe conocer.', MODULO],
  'ficha|Sobrecosto para alerta': ['% de sobrecosto proyectado que enciende el amarillo.', 'Frente al presupuesto vigente. Por defecto 5 %.', 'Anticipa desviaciones presupuestales (control de costos).', PMBOK_18],
  'ficha|Sobrecosto crítico': ['% de sobrecosto que enciende el rojo.', 'Por defecto 10 %.', 'Control de costos de la ejecución.', PMBOK_18],
  'ficha|Nivel de riesgo crítico': ['Nivel (probabilidad × impacto) desde el que un riesgo es crítico.', 'Entre 1 y 25. Por defecto 15 (prioridad alta).', 'Prioriza los riesgos alto / medio / bajo.', A16],
  'ficha|Días sin actualizar para alerta': ['Días sin registrar cambios que encienden el amarillo.', 'Por defecto 15 días.', 'El manual pide actualizar avances y desviaciones durante la ejecución.', PMBOK_18],
  'ficha|maneja presupuesto': ['Indica si el proyecto tiene presupuesto propio.', 'Márcalo si la Gerencia aprobó recursos para el proyecto. Sin presupuesto no se registran costos ni se calcula el valor ganado.', 'El Acta de constitución incluye el presupuesto preliminar.', A17],
  'ficha|aprobar estados': ['Si los cambios de fase requieren aprobación.', 'Déjalo marcado: el manual exige actas de aprobación por fase. Desmarcarlo solo para proyectos internos menores.', 'Cada fase se aprueba formalmente (Prefactibilidad, Factibilidad, Acta de constitución, Acta de cierre).', m('4.1.2, 4.1.3, 4.2 · Apartado 17 y Acta de cierre', 12)],

  // Apartados de la formulación
  'alternativas|Alternativa': ['Nombre de una opción para resolver el problema o aprovechar la oportunidad.', 'Registra 2 o 3 alternativas viables; incluye opciones innovadoras, de reutilización o híbridas, no solo la "solución obvia".', 'Permite comparar y elegir la que mejor cumple los criterios estratégicos.', A2],
  'alternativas|seleccionada': ['La alternativa elegida para formular el proyecto.', 'Márcala después de compararlas (análisis multicriterio o matriz de priorización).', 'La factibilidad se formula sobre la alternativa seleccionada.', A2],
  'alternativas|Descripción técnica': ['En qué consiste la alternativa.', 'Breve descripción técnica de la solución.', 'El manual pide una breve descripción técnica de cada opción.', A2],
  'alternativas|Pertinencia técnica': ['Qué tan viable es técnicamente.', 'Tecnología probada, capacidades internas, complejidad.', 'El manual evalúa la pertinencia técnica, económica, ambiental y social.', A2],
  'alternativas|Pertinencia económica': ['Costo y retorno aproximado.', 'Orden de magnitud de inversión y beneficio.', 'Ver arriba.', A2],
  'alternativas|Pertinencia ambiental': ['Impacto ambiental de la alternativa.', 'Uso de recursos, permisos, afectación del entorno.', 'Ver arriba.', A2],
  'alternativas|Pertinencia social': ['Impacto en comunidad, colaboradores y clientes.', 'Empleo local, aceptación, relación con vecinos.', 'Ver arriba.', A2],
  'alternativas|Impactos positivos': ['Beneficios que traería.', 'Lista breve.', 'El manual pide los posibles impactos positivos y negativos.', A2],
  'alternativas|Impactos negativos': ['Efectos indeseados.', 'Lista breve.', 'Ver arriba.', A2],
  'entorno|Descripción del entorno': ['Fotografía actual del lugar donde se desarrollará el proyecto (microentorno).', 'Responde "¿dónde se va a desenvolver el proyecto?": lugar, condiciones de operación, comunidad, clima, recursos. Puedes adjuntar imágenes en Documentación.', 'Identifica los factores que pueden afectar las alternativas.', A3],
  'entorno|Ubicación y condiciones físicas': ['Ubicación geográfica y características del lote o espacio.', 'Accesos, clima, afectaciones, riesgos cercanos.', 'Análisis del entorno físico.', A3],
  'entorno|Normativa aplicable': ['Normas locales que condicionan el proyecto.', 'POT, lineamientos de la CARDER, licencias previas.', 'Consulta a bases normativas.', A3],
  'entorno|Actores del entorno': ['Personas y organizaciones cercanas que influyen.', 'Juntas de acción comunal, líderes sociales, operadores turísticos.', 'Mapeo de actores del entorno.', A3],
  'aspectos|Supuestos': ['Condiciones que se dan por ciertas sin estar garantizadas.', 'Piensa "¿qué pasaría si…?" y "¿qué estoy asumiendo que puede no cumplirse?".', 'Análisis de supuestos (Assumptions Log) del PMBOK.', A4],
  'aspectos|Estudios técnicos o ambientales necesarios': ['Estudios que se requieren para desarrollar la idea.', 'Topografía, suelos, impacto ambiental, capacidad de carga, etc.', 'Aspectos indispensables para formular el proyecto.', A4],
  'aspectos|Normas a tener en cuenta': ['Normas técnicas o legales aplicables.', 'Normas sectoriales, de seguridad, sanitarias.', 'Ver arriba.', A4],
  'aspectos|Permisos y licencias': ['Trámites necesarios antes o durante el proyecto.', 'Permiso, entidad y tiempo estimado.', 'Los permisos suelen ser la principal dependencia del cronograma.', A4],
  'aspectos|Consultas a expertos': ['Juicio de expertos consultado.', 'Áreas jurídica, financiera, operaciones, compras y consultores; qué condiciones del proyecto podrían afectar.', 'El juicio de expertos mitiga la mayoría de los riesgos e incertidumbres.', A4],
  'cronogramaFases|Inicio': ['Fecha de inicio de la fase.', 'Estimación análoga con proyectos similares; considera contratación y verificación de proveedores.', 'Cronograma preliminar por ciclo de vida.', A5],
  'cronogramaFases|Fin': ['Fecha de fin de la fase.', 'Las fases van en orden: Preinversión → Inversión → Operación y cierre.', 'Ver arriba.', A5],
  'cronogramaFases|Hitos y actividades clave por fase': ['Momentos clave de cada fase.', 'Aprobaciones, entregas, diseños, planos o prototipos.', 'El cronograma preliminar describe hitos, fases y duraciones.', A5],
  'objetivos|Justificación para más de 5 objetivos específicos': ['Explicación de por qué el proyecto necesita más de 5 objetivos específicos.', 'Solo si es característico del proyecto (por ejemplo, varias líneas de producto).', 'El manual recomienda no superar 5 objetivos específicos.', A61],
  'pestel|Letra': ['Factor del macroentorno analizado.', 'P político, E económico, S social, T tecnológico, Ecológico, L legal. Ninguna letra puede quedar sin analizar (1 a 3 factores por letra).', 'Análisis estructurado del macroentorno.', A71],
  'pestel|Hecho o dato': ['El hecho que puede afectar el proyecto.', 'Un dato concreto, no una opinión (por ejemplo "inflación de servicios del 6 % anual").', 'Paso 1 de la figura 3: investigar y relacionar hechos por factor.', A71],
  'pestel|Fuente': ['De dónde sale el dato.', 'Fuentes confiables: DANE, ministerios, universidades, CAR, Cámara de Comercio. Si usaste IA, verifica la fuente original.', 'El manual exige documentar la fuente para no tomar datos falsos como ciertos.', A71],
  'pestel|Fecha de la fuente': ['Cuándo se publicó o consultó.', 'Si tiene más de 5 años, busca una fuente actual.', 'El manual pide fechas para no usar información vencida.', A71],
  'pestel|Oportunidad / amenaza': ['Si el factor favorece o limita el proyecto.', 'Oportunidad si lo impulsa; amenaza si pone barreras.', 'Paso 2 de la figura 3.', A71],
  'pestel|Tendencia': ['Cómo evoluciona el factor.', 'Mejor, estable o peor.', 'El manual pide documentar la tendencia de cada factor.', A71],
  'pestel|Importancia': ['Peso del factor para el proyecto.', '3 alta, 2 media, 1 baja.', 'Niveles de importancia de la figura 3.', A71],
  'pestel|Valoración': ['Efecto del factor.', '1 muy negativo · 2 negativo · 3 indiferente · 4 positivo · 5 muy positivo.', 'Valoración con código de color de la figura 3.', A71],
  'propuestaValor|Segmento de clientes': ['A quién va dirigida la propuesta (cliente interno o externo).', 'Edad, perfil, origen. El manual sugiere 2 o 3 clientes prioritarios; si hay más de uno, descríbelos aquí.', 'Perfil del cliente de la figura 4.', A72],
  'propuestaValor|Tareas del cliente': ['Qué quiere lograr o resolver el cliente.', 'Lo funcional, social y emocional (por ejemplo "relajarse", "compartir en familia").', 'Perfil del cliente.', A72],
  'propuestaValor|Dolores o frustraciones': ['Problemas y obstáculos que el cliente quiere evitar.', 'Por ejemplo estrés, aglomeraciones, falta de tiempo.', 'Perfil del cliente.', A72],
  'propuestaValor|Motivaciones o alegrías': ['Resultados y beneficios que el cliente busca.', 'Bienestar, momentos memorables, exclusividad.', 'Perfil del cliente.', A72],
  'propuestaValor|Productos y servicios': ['Lo que la empresa ofrece para esas tareas.', 'Lista de productos y servicios de la oferta.', 'Mapa de valor.', A72],
  'propuestaValor|Calmantes de dolores': ['Cómo se eliminan o mitigan los dolores del cliente.', 'Por ejemplo grupos pequeños, horarios sin aglomeración.', 'Mapa de valor.', A72],
  'propuestaValor|Detonantes de alegrías': ['Cómo se generan los beneficios que busca el cliente.', 'Experiencias personalizadas, paquetes exclusivos.', 'Mapa de valor.', A72],
  'propuestaValor|Encaje y evidencias': ['Prueba de que la propuesta coincide con el perfil del cliente.', 'Resultado de 8 a 12 entrevistas o encuestas: citas, % de aceptación, disposición a pagar.', 'El manual pide lograr el "encaje" y documentar evidencias.', A72],
  'modeloNegocio|1. Segmento de clientes': ['Grupo exacto al que va dirigido el producto o servicio.', 'Social, económica y demográficamente.', 'Bloque 1 del lienzo (figura 5).', A73],
  'modeloNegocio|2. Propuesta de valor': ['Beneficio único y diferenciador.', 'Una o dos frases.', 'Bloque 2.', A73],
  'modeloNegocio|3. Canales': ['Medios para comunicar, distribuir y entregar el servicio.', 'Digitales o presenciales; B2B o B2C; propios, compartidos o pagos.', 'Bloque 3.', A73],
  'modeloNegocio|4. Relaciones con los clientes': ['Cómo se interactúa y se retiene al cliente.', 'Asistencia personalizada, autoservicio, ejecutivo de cuenta.', 'Bloque 4.', A73],
  'modeloNegocio|5. Recursos clave': ['Activos y capacidades indispensables.', 'Humanos, físicos, financieros, intelectuales y legales.', 'Bloque 5.', A73],
  'modeloNegocio|6. Socios o aliados clave': ['Aliados estratégicos necesarios.', 'Proveedores, aportantes, juntas.', 'Bloque 6.', A73],
  'modeloNegocio|7. Actividades clave': ['Acciones esenciales para operar el modelo.', 'Las que hacen realidad la propuesta de valor.', 'Bloque 7.', A73],
  'modeloNegocio|8. Estructura de costos': ['Principales costos del modelo.', 'Costos inherentes, imprevistos e impuestos de cada bloque.', 'Bloque 8.', A73],
  'modeloNegocio|9. Fuentes de ingresos': ['De dónde vienen los ingresos.', 'La monetización: tarifas, ventas, aportes.', 'Bloque 9.', A73],
  'ingresos|Método': ['Cómo se estiman los ingresos.', 'Bottom-up: a partir de las ventas esperadas. Top-down: a partir de la participación de mercado.', 'Metodología aplicable a la proyección.', A8],
  'ingresos|Periodo': ['Mes, trimestre o año de la proyección.', 'Usa periodos consecutivos.', 'Estimar ingresos por periodo.', A8],
  'ingresos|Clientes': ['Número de clientes esperados en el periodo.', 'Estimación realista según capacidad y demanda.', 'Paso 1 del manual.', A8],
  'ingresos|Precio promedio': ['Precio promedio por cliente o servicio.', 'Precio esperado sin impuestos.', 'Paso 2 del manual.', A8],
  'ingresos|Ajuste por estacionalidad': ['Corrección por temporada alta o baja.', 'Porcentaje positivo o negativo (por ejemplo −10 en temporada baja).', 'El manual pide ajustar por estacionalidad y ocupación realista.', A8],
  'ingresos|Supuestos usados': ['Supuestos de la proyección.', 'Tasa de conversión, ocupación, temporadas.', 'El manual pide documentar los supuestos.', A8],
  'localizacion|Ubicación seleccionada': ['Dónde se ubicará el proyecto (decisión excluyente a largo plazo).', 'El lugar elegido tras evaluar criterios; adjunta planos o croquis en Documentación.', 'Fija el alcance y los parámetros de los que el proyecto no saldrá.', A9],
  'localizacion|Capacidad o tamaño': ['Capacidad física y productiva.', 'Aforo, metros cuadrados, infraestructura, capacidad por día.', 'El manual pide definir superficie y capacidad.', A9],
  'localizacion|Criterios y matriz de puntaje': ['Cómo se eligió la ubicación.', 'Criterios (demanda, accesibilidad, costos, impacto ambiental) con su peso y puntaje.', 'Matriz de puntaje para priorizar variables (Anexo 4).', A9],
  'localizacion|Restricciones legales o físicas': ['Límites del sitio.', 'Uso de suelo, rondas hídricas, servidumbres.', 'Incluir restricciones legales o físicas.', A9],
  'localizacion|Superficie': ['Área del proyecto.', 'm², km de recorrido, etc.', 'Definir superficie.', A9],
  'ingenieria|Proceso': ['El proceso productivo o de servicio.', 'Actividades en orden, responsables, entradas y salidas; revisa cuellos de botella y valida con el equipo operativo.', 'Define cómo se entregará el producto o servicio.', A10],
  'ingenieria|Layout o distribución física': ['Distribución de áreas y elementos clave.', 'Áreas funcionales, relaciones de proximidad, accesos, circulación y seguridad.', 'Distribución física preliminar.', A10],
  'ingenieria|Estudios, asesorías o prototipos': ['Apoyos técnicos requeridos.', 'Consultorías, diseños, modelos o prototipos.', 'El manual pide considerar asistencias técnicas cuando no hay experiencia.', A10],
  'organizacional|Preinversión': ['Personal requerido en la Preinversión.', 'Rol, función y por qué es importante que esté.', 'Estructura de personal por fase.', A101],
  'organizacional|Inversión': ['Personal requerido en la Inversión.', 'Ver arriba.', 'Ver arriba.', A101],
  'organizacional|Operación y cierre': ['Personal requerido en la operación.', 'Ver arriba.', 'Ver arriba.', A101],
  'financiero|Tasa de descuento por periodo': ['Rentabilidad mínima exigida por periodo.', 'Si los periodos son meses, usa la tasa mensual. Pídela a la Gerencia Financiera.', 'Necesaria para calcular VAN y PRD.', A11],
  'financiero|Periodo': ['Número del periodo del flujo de caja.', '0 es la inversión inicial; 1, 2, 3… los periodos siguientes.', 'Flujos de caja proyectados.', A11],
  'financiero|Ingresos': ['Ingresos del periodo.', 'Toma la proyección del apartado 8.', 'Ver arriba.', A11],
  'financiero|Egresos': ['Gastos e inversiones del periodo.', 'Inversión, operación y mantenimiento.', 'Ver arriba.', A11],
  'financiero|Descripción': ['Detalle del periodo.', 'Por ejemplo "inversión inicial" o "primer mes de operación".', 'Facilita la revisión.', A11],
  'financiero|Análisis de sensibilidad': ['Qué pasa si cambian las variables clave.', 'Por ejemplo "con 20 % menos visitantes la inversión se recupera en 18 meses".', 'Paso 5 del manual: analizar sensibilidad a cambios.', A11],

  // Planificación (Inversión)
  'interesados|Interesado': ['Persona, área o entidad que influye en el proyecto o se ve afectada.', 'Internos (operaciones, mercadeo, mantenimiento) y externos (comunidad, autoridades, proveedores, gremios).', 'Permite priorizar la gestión y la comunicación y reducir resistencias.', A12],
  'interesados|Tipo': ['Si es interno o externo a la empresa.', 'Interno o externo.', 'Caracterización del interesado.', A12],
  'interesados|Poder / influencia': ['Capacidad de afectar las decisiones del proyecto.', 'De 1 (muy bajo) a 5 (muy alto). Con el interés define la estrategia.', 'Matriz poder–interés.', A12],
  'interesados|Interés': ['Cuánto le importa el proyecto.', 'De 1 a 5.', 'Matriz poder–interés.', A12],
  'interesados|Actitud': ['Posición frente al proyecto.', 'A favor, neutral o en contra.', 'Ayuda a anticipar riesgos de oposición.', A12],
  'interesados|Expectativas': ['Qué espera del proyecto.', 'Lo que necesita o teme.', 'Base de los mensajes clave.', A12],
  'interesados|Mensajes clave': ['Qué se le comunica.', 'Mensajes según su estrategia.', 'Alimenta el plan de comunicaciones.', A12],
  'interesados|Riesgos asociados': ['Riesgos ligados al interesado.', 'Por ejemplo oposición comunitaria o retrasos por permisos.', 'La matriz se conecta con la matriz de riesgos.', A12],
  'interesados|Canal': ['Medio de comunicación.', 'Reunión, correo, oficio, comité.', 'Plan de comunicaciones.', A12],
  'interesados|Frecuencia': ['Cada cuánto se comunica.', 'Semanal, mensual, por hito.', 'Plan de comunicaciones.', A12],
  'interesados|Responsable de la relación': ['Quién gestiona la relación.', 'El "dueño de la relación".', 'Paso 5 del manual.', A12],
  'organigrama|Fase': ['Fase del ciclo de vida en que actúa el rol.', 'Preinversión, Inversión u Operación y cierre.', 'Organigrama acorde al ciclo de vida.', A14],
  'organigrama|Rol': ['Rol en el proyecto.', 'Director, comité de seguimiento, contratista, área de operación.', 'Identificar roles por fase.', A14],
  'organigrama|Persona o cargo': ['Quién ocupa el rol.', 'Preferible el cargo.', 'Asignación clara de responsabilidades.', A14],
  'organigrama|Reporta a': ['Línea de reporte.', 'El rol al que reporta.', 'Definir líneas de reporte y comunicación.', A14],
  'organigrama|Nivel': ['Nivel jerárquico.', 'Estratégico, táctico u operativo.', 'Clasificar roles según jerarquía.', A14],
  'organigrama|Funciones': ['Funciones del rol.', 'Responsabilidades principales.', 'Asignar funciones clave.', A14],
  'raci|Roles (cargos) separados por coma': ['Columnas de la matriz RACI.', 'Usa cargos o funciones, no personas aisladas, separados por coma.', 'La RACI evita ambigüedad y duplicidad de funciones.', A15],

  // Operación y cierre
  'transferencia|Área que recibe': ['Área operativa que recibe el resultado.', 'El área que lo operará y mantendrá.', 'Transferir formalmente los entregables al área operativa.', OPERACION],
  'transferencia|Responsable en la operación': ['Quién responde por el resultado en la operación.', 'Nombre o cargo.', 'Entrega formal a la operación.', OPERACION],
  'transferencia|Fecha de entrega': ['Cuándo se entregó a la operación.', 'Fecha del acta o reunión de entrega.', 'Entrega formal a la operación.', OPERACION],
  'transferencia|Capacitaciones realizadas': ['Capacitación del personal que opera.', 'Quiénes, cuándo y en qué.', 'El manual incluye la capacitación del personal responsable.', OPERACION],
  'transferencia|Manuales y formatos de Calidad actualizados': ['Documentos del proceso actualizados.', 'Manuales, procedimientos, control de cambios de Calidad.', 'Formalización de manuales y ajustes en procesos.', OPERACION],
  'transferencia|Ajustes a procesos': ['Cambios en los procesos afectados.', 'Qué cambió y en qué proceso.', 'Incorporar acciones relevantes a los procesos.', OPERACION],
  'transferencia|Ajustes al mantenimiento': ['Cambios en el mantenimiento.', 'Nuevos equipos, rutinas o frecuencias.', 'Ajustes en el proceso de mantenimiento.', OPERACION],
  'transferencia|Gestión del cambio': ['Cómo se maneja la resistencia al cambio.', 'Planes de mitigación y comunicación.', 'Planes de mitigación para la resistencia al cambio.', OPERACION],
  'lecciones|Categoría': ['Tipo de lección.', 'Técnica, administrativa, contractual u operativa.', 'El manual clasifica las lecciones en esas categorías.', LECCIONES],
  'lecciones|Tipo': ['Si fue un acierto o una mejora.', 'Plus: funcionó bien. Delta: por mejorar.', 'Matriz de hallazgos plus / delta.', LECCIONES],
  'lecciones|Fase': ['Fase en que ocurrió.', 'Preinversión, Inversión u Operación.', 'Las lecciones surgen en cualquier fase.', LECCIONES],
  'lecciones|Situación': ['Qué pasó.', 'La situación crítica o el acierto.', 'Documentar situaciones críticas.', LECCIONES],
  'lecciones|Cómo se resolvió': ['Qué se hizo.', 'La solución aplicada.', 'Documentar cómo se resolvieron.', LECCIONES],
  'lecciones|Recomendación para futuros proyectos': ['Qué deben hacer los próximos proyectos.', 'Recomendación concreta; se publica en la base corporativa.', 'La base se consulta antes de iniciar nuevas iniciativas.', LECCIONES],
  'actaCierre|Resultados alcanzados frente a los objetivos': ['Qué se logró frente a cada objetivo.', 'Contrasta con el objetivo general y los específicos.', 'Verificar el cumplimiento de objetivos.', CIERRE],
  'actaCierre|Cumplimiento de objetivos y beneficios': ['Beneficios reales frente al caso de negocio.', 'Compara con los beneficios esperados de la ficha.', 'Verificar beneficios frente al caso de negocio.', CIERRE],
  'actaCierre|Beneficios logrados': ['Beneficios obtenidos.', 'Cifras y evidencias.', 'Ver arriba.', CIERRE],
  'actaCierre|Cierre de contratos con terceros': ['Estado de los contratos.', 'Contratos liquidados o terminados y sus constancias.', 'Registrar el cierre de contratos.', CIERRE],
  'actaCierre|Liberación de recursos humanos, materiales y financieros': ['A dónde se reasignan los recursos.', 'Personas, equipos y saldos.', 'Indicar la liberación de recursos.', CIERRE],
  'actaCierre|Evaluación del desempeño': ['Cómo le fue al proyecto en plazo, costo y riesgos.', 'Usa los indicadores del módulo (valor ganado, hitos, desviación).', 'Presentar la evaluación del desempeño.', CIERRE],
  'actaCierre|Archivo de la documentación': ['Dónde queda la documentación.', 'Repositorio de archivos de Termales (pestaña Documentación).', 'Detallar el archivo de documentación.', CIERRE],

  // Tareas
  'tarea|Título': ['Nombre de la actividad, hito o paquete.', 'Verbo + objeto, por ejemplo "Adecuar el sendero".', 'Cada elemento de la EDT tiene descripción e identificador.', A13],
  'tarea|Tipo': ['Nivel de la EDT.', 'Fase o paquete de trabajo: agrupan. Actividad: trabajo con fechas. Hito: punto de control sin duración. Épica e historia: proyectos ágiles.', 'La EDT descompone el alcance en entregables y paquetes manejables.', A13],
  'tarea|Descripción': ['Qué incluye el trabajo.', 'Entradas, salidas y supuestos (diccionario de la EDT).', 'El manual pide un diccionario de la EDT.', A13],
  'tarea|Pertenece a': ['Fase, paquete o épica que lo contiene.', 'Así se arma la numeración 1, 1.1, 1.1.1.', 'Cada nivel está conectado a una tarea madre.', A13],
  'tarea|Prioridad': ['Urgencia de la tarea.', 'Crítica, alta, media o baja.', 'Ordena el trabajo del equipo.', MODULO],
  'tarea|Responsable principal': ['Quien ejecuta la tarea (R de la RACI).', 'Un correo @termales.com.co; podrá actualizar avance y evidencias.', 'Cada paquete debe tener responsable.', A13],
  'tarea|Colaboradores': ['Personas que apoyan.', 'Correos separados por coma.', 'Pueden actualizar el avance.', MODULO],
  'tarea|Inicio previsto': ['Fecha prevista de inicio.', 'Si depende de otra tarea, se ajusta sola cuando la predecesora se retrasa.', 'Cronograma detallado (Gantt).', PMBOK_18],
  'tarea|Fecha del hito': ['Día del punto de control.', 'Un hito no dura: inicio y fin son el mismo día.', 'Los hitos principales forman parte del Acta de constitución.', A17],
  'tarea|Fin previsto': ['Fecha prevista de terminación.', 'Si la tarea está en la línea base, reprogramarla pide un motivo.', 'Cronograma detallado.', PMBOK_18],
  'tarea|Esfuerzo estimado': ['Horas de trabajo estimadas.', 'Pondera el avance del proyecto: una tarea de 100 h pesa más que una de 10 h.', 'Estimar tiempo y costo por paquete.', A13],
  'tarea|Puntos de historia': ['Tamaño relativo de la historia (ágil).', 'Escala del equipo (1, 2, 3, 5, 8…).', 'Mide la velocidad de los sprints.', MODULO],
  'tarea|Sprint': ['Sprint en que se trabajará la historia.', 'Vacío = backlog.', 'Planificación ágil.', MODULO],
  'tarea|Motivo de la reprogramación': ['Por qué cambian las fechas aprobadas.', 'Causa concreta. La línea base no cambia: se mide la desviación.', 'Seguimiento de avances y desviaciones.', PMBOK_18],
  'tarea|Motivo de la cancelación': ['Por qué se cancela.', 'Causa concreta; queda en el historial.', 'Trazabilidad del alcance.', MODULO],
  'tarea|Estado': ['Situación de la tarea.', 'Pendiente (0 %), En curso, Bloqueada (explica qué la bloquea), En revisión (si requiere aprobación de otra persona) y Completada (100 %, con los criterios cumplidos).', 'Actualizar avances durante la ejecución.', PMBOK_18],
  'tarea|Avance': ['Porcentaje ejecutado.', 'En múltiplos de 5. El 100 % solo se registra al completar o enviar a revisión.', 'Base del avance real y del valor ganado.', EVM],
  'tarea|Inicio real': ['Cuándo empezó realmente.', 'Se registra solo al pasar a "En curso".', 'Comparar lo real con lo planificado.', PMBOK_18],
  'tarea|Fin real': ['Cuándo terminó realmente.', 'Se registra solo al completar.', 'Mide el cumplimiento de hitos y tareas.', PMBOK_18],
  'tarea|¿Qué la bloquea?': ['Causa del bloqueo.', 'Qué falta y quién debe resolverlo.', 'Permite escalar a tiempo.', MODULO],
  'tarea|Entregables de la tarea': ['Productos que deja la tarea.', 'Documentos, obras, informes.', 'La EDT se enfoca en entregables.', A13],
  'tarea|Restricciones': ['Limitaciones de la tarea.', 'Horarios, permisos, recursos.', 'Diccionario de la EDT (supuestos).', A13],
  'tarea|Desfase': ['Días de espera tras la predecesora.', 'Positivo: espera; negativo: puede empezar antes de que termine.', 'Dependencias del cronograma.', A13],

  // Entregables
  'entregable|Nombre': ['Producto, resultado o capacidad verificable.', 'Sustantivo concreto: "Planos aprobados", "Guías certificados".', 'Un entregable es cualquier producto único y verificable.', m('3.1.3.1 "Producto, servicio o resultado único"', 5)],
  'entregable|Responsable': ['Quién lo elabora y presenta.', 'Correo @termales.com.co. No puede aprobarlo.', 'Rol R de la RACI.', A15],
  'entregable|Fecha comprometida': ['Cuándo debe presentarse.', 'Alineada con el hito de la EDT.', 'Mide el cumplimiento de entregables.', PMBOK_18],
  'entregable|Tarea asociada': ['Tarea de la EDT que lo produce.', 'Elige la actividad o hito.', 'La EDT se basa en entregables.', A13],
  'entregable|Descripción': ['Qué contiene el entregable.', 'Alcance del producto.', 'Diccionario de la EDT.', A13],
  'entregable|Criterios de aceptación': ['Condiciones para aprobarlo.', 'Verificables: contenido, formato, firmas.', 'Cada elemento de la EDT tiene criterios de aceptación.', A13],
  'entregable|Comentario para el revisor': ['Nota para quien revisa.', 'Qué cambió frente a la versión anterior.', 'Trazabilidad de versiones.', MODULO],

  // Riesgos
  'riesgo|Categoría': ['Tipo de registro.', 'Riesgo (puede pasar), problema materializado, incidencia, bloqueo o dependencia externa.', 'La matriz documenta amenazas, oportunidades e incidentes.', A16],
  'riesgo|Estado': ['Situación del riesgo.', 'Abierto, en tratamiento o cerrado (solo con todas sus acciones cumplidas).', 'Monitorear y actualizar periódicamente.', A16],
  'riesgo|Responsable': ['Propietario del riesgo.', 'Quien vigila el disparador y ejecuta la respuesta.', 'El manual exige propietario por riesgo.', A16],
  'riesgo|Fecha límite': ['Plazo para tratarlo.', 'Fecha de la respuesta principal.', 'Contemplar plazos y responsables.', A16],
  'riesgo|Descripción': ['Título y descripción del riesgo.', 'Evento incierto y su efecto: "Lluvias retrasan la obra".', 'Documentar ID, título y descripción.', A16],
  'riesgo|Causa': ['Origen del riesgo.', 'Por qué podría ocurrir.', 'Documentar la causa.', A16],
  'riesgo|Evento de riesgo': ['Lo que podría ocurrir.', 'El hecho incierto.', 'Identificación de riesgos.', A16],
  'riesgo|Consecuencia': ['Efecto si ocurre.', 'En plazo, costo, calidad o reputación.', 'Análisis del impacto.', A16],
  'riesgo|Controles existentes': ['Lo que ya reduce el riesgo.', 'Controles vigentes antes de la respuesta.', 'Base del riesgo inherente frente al residual.', A16],
  'riesgo|Probabilidad': ['Qué tan probable es.', '1 muy baja … 5 muy alta.', 'Evaluar probabilidad (1–5).', A16],
  'riesgo|Impacto': ['Qué tan grave sería.', '1 muy bajo … 5 muy alto.', 'Evaluar impacto (1–5); nivel = P × I.', A16],
  'riesgo|Respuesta prevista': ['Estrategia de respuesta.', 'Amenaza: mitigar, evitar, transferir o aceptar. Oportunidad: explotar, mejorar, compartir o aceptar.', 'Definir la respuesta.', A16],
  'riesgo|Amenaza u oportunidad': ['Si el riesgo es negativo o positivo.', 'Amenaza: perjudica. Oportunidad: beneficia si ocurre.', 'La matriz incluye amenazas y oportunidades.', A16],
  'riesgo|Costo de contingencia': ['Reserva para la respuesta.', 'Monto estimado del tratamiento o contingencia.', 'Integrar la matriz con el presupuesto.', A16],
  'riesgo|Disparador': ['Señal de que el riesgo se activa.', 'Por ejemplo "más de 3 días seguidos de lluvia".', 'Establecer triggers.', A16],
  'riesgo|Indicador de monitoreo': ['KPI para vigilar el riesgo.', 'Por ejemplo "días perdidos por lluvia".', 'Establecer KPIs de monitoreo.', A16],
  'riesgo|Probabilidad residual': ['Probabilidad después de la respuesta.', '1 a 5.', 'Distinguir riesgo inherente y residual.', A16],
  'riesgo|Impacto residual': ['Impacto después de la respuesta.', '1 a 5.', 'Ver arriba.', A16],
  'riesgo|Vincular a la matriz de riesgos de GCM': ['Riesgo institucional relacionado.', 'Solo referencia; no copia ni modifica la matriz.', 'Relaciona el proyecto con la gestión de riesgos de la empresa.', MODULO],
  'riesgo|Tarea relacionada': ['Tarea afectada.', 'Elige la actividad.', 'Integrar riesgos con el cronograma.', A16],

  // Cambios
  'cambio|Título': ['Nombre del cambio solicitado.', 'Qué se quiere cambiar.', 'Control formal de cambios.', PMBOK_18],
  'cambio|Descripción': ['En qué consiste el cambio.', 'Qué se agrega, quita o modifica.', 'Control de cambios.', PMBOK_18],
  'cambio|Justificación': ['Por qué es necesario.', 'Causa y beneficio.', 'Fundamenta la decisión del patrocinador.', PMBOK_18],
  'cambio|Elementos afectados': ['Partes del proyecto que cambian.', 'Tareas, entregables, fases.', 'Evaluar impacto.', PMBOK_18],
  'cambio|Impacto en alcance': ['Efecto en el alcance.', 'Qué entra o sale.', 'Evaluar impacto.', PMBOK_18],
  'cambio|Impacto en tiempo': ['Efecto en el plazo.', 'Días de más o de menos.', 'Evaluar impacto.', PMBOK_18],
  'cambio|Impacto en costo': ['Efecto en el costo.', 'Valor adicional o ahorro.', 'Evaluar impacto.', PMBOK_18],
  'cambio|Impacto en calidad': ['Efecto en la calidad.', 'Mejora o riesgo.', 'Evaluar impacto.', PMBOK_18],
  'cambio|Impacto en riesgos': ['Riesgos nuevos o que cambian.', 'Descríbelos y regístralos en Riesgos.', 'Evaluar impacto.', A16],
  'cambio|Nuevo presupuesto': ['Presupuesto total si se aprueba.', 'Vacío si no cambia el presupuesto. Al implementarse queda la revisión registrada.', 'Revisiones presupuestales autorizadas.', PMBOK_18],

  // Reuniones y compromisos
  'reunion|Título': ['Nombre de la reunión.', 'Por ejemplo "Comité de seguimiento semanal".', 'Informar periódicamente al comité.', PMBOK_18],
  'reunion|Fecha': ['Cuándo se realizó.', 'Fecha de la sesión.', 'Trazabilidad del seguimiento.', PMBOK_18],
  'reunion|Tipo': ['Clase de reunión.', 'Seguimiento, comité directivo, planificación, cierre.', 'Gestión de interesados y comunicaciones.', A12],
  'reunion|Asistentes': ['Quiénes asistieron.', 'Uno por línea.', 'Soporte del acta.', MODULO],
  'reunion|Acta / temas tratados': ['Resumen de la reunión.', 'Temas, avances y problemas tratados.', 'Reportes de avance para la toma de decisiones.', PMBOK_18],
  'reunion|Decisiones': ['Decisiones tomadas.', 'Una por línea.', 'Permite tomar decisiones oportunas.', PMBOK_18],
  'reunion|Estado': ['Avance del compromiso.', 'Para darlo por cumplido explica cómo se cumplió o adjunta la evidencia.', 'Compromisos verificables.', MODULO],
  'reunion|Comentario': ['Seguimiento del compromiso.', 'Qué se hizo.', 'Trazabilidad.', MODULO],

  // Costos y presupuesto
  'costo|Fecha': ['Fecha del gasto o compromiso.', 'Fecha de la factura o de la orden.', 'Registrar gastos y compararlos con el presupuesto.', PMBOK_18],
  'costo|Tipo': ['Si ya se pagó o está comprometido.', 'Real: ejecutado (factura, pago). Comprometido: contratado u ordenado pero no pagado.', 'El valor ganado usa el costo real (AC).', EVM],
  'costo|Categoría': ['Clase de gasto.', 'Personal, servicios, bienes, tecnología u otros.', 'Costos por categoría.', PMBOK_18],
  'costo|Monto': ['Valor del costo.', 'Valor sin impuestos recuperables.', 'Control de costos.', PMBOK_18],
  'costo|Descripción': ['Qué se pagó o contrató.', 'Concepto y proveedor.', 'Control de costos.', PMBOK_18],
  'costo|Tarea asociada': ['Tarea que generó el costo.', 'Elige la actividad.', 'Costo por paquete de trabajo.', A13],
  'presupuesto|Monto': ['Estimación del costo final del proyecto.', 'Si la dejas vacía, la proyección usa el valor ganado (EAC).', 'Pronósticos de costo del valor ganado.', EVM],
  'presupuesto|Justificación de la variación': ['Por qué la estimación difiere del presupuesto.', 'Causa de la variación.', 'Justificación de variaciones.', EVM],

  // Sprints
  'sprint|Nombre': ['Nombre del sprint.', 'Por ejemplo "Sprint 3".', 'Gestión ágil.', MODULO],
  'sprint|Estado': ['Situación del sprint.', 'Planeado, activo (solo uno a la vez) o cerrado.', 'Gestión ágil.', MODULO],
  'sprint|Inicio': ['Primer día del sprint.', 'Normalmente un lunes; los sprints suelen durar 1 a 4 semanas.', 'Delimita el periodo de trabajo del equipo.', MODULO],
  'sprint|Fin': ['Último día del sprint.', 'Al terminar se hace la revisión y la retrospectiva.', 'Delimita el periodo de trabajo del equipo.', MODULO],
  'sprint|Capacidad': ['Puntos que el equipo puede completar.', 'Según la velocidad de sprints anteriores.', 'Planificación del sprint.', MODULO],
  'sprint|Objetivo del sprint': ['Qué se busca lograr.', 'Una frase.', 'Planificación del sprint.', MODULO],
  'sprint|Revisión del sprint': ['Resultado mostrado al cierre.', 'Qué se entregó.', 'Revisión del sprint.', MODULO],
  'sprint|Retrospectiva': ['Qué aprendió el equipo.', 'Qué funcionó y qué mejorar.', 'Se relaciona con las lecciones aprendidas.', LECCIONES],
  'sprint|Compromisos de mejora': ['Acciones de mejora.', 'Una por línea.', 'Mejora continua.', LECCIONES],

  // Estado y explicación
  'estado|Explicación del estado': ['Situación actual del proyecto en palabras del director.', 'Qué está pasando y por qué el semáforo está como está.', 'Informar periódicamente al comité sobre el estado del proyecto.', PMBOK_18],
  'estado|Causa de la desviación': ['Origen del atraso o sobrecosto.', 'Causa concreta.', 'Seguimiento de desviaciones.', PMBOK_18],
  'estado|Plan de recuperación': ['Acciones para volver al plan.', 'Qué, quién y para cuándo.', 'Tomar decisiones correctivas según tendencias.', EVM],

  // Apartados como bloque (título del apartado)
  'apartado|noAplica': ['Indica que el apartado no corresponde a este proyecto.', 'Escribe la justificación (por ejemplo "proyecto administrativo sin venta al público"). Queda en el historial y en el informe.', 'Algunos apartados, como el estudio de mercado, no aplican a todos los proyectos; la justificación deja trazabilidad.', m('4.1.3 "Factibilidad" (apartados 7 a 11)', 15)],
  'tarea|requiere revision': ['Si otra persona debe aprobar la tarea antes de completarse.', 'Márcalo en tareas críticas o con entregable. El ejecutor la envía a revisión y la aprueba el director o un aprobador.', 'Corresponde al rol A (aprueba) de la RACI.', A15],
};

const normalizar = texto => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)/g, '').replace(/[*:]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const INDICE = new Map(Object.entries(G).map(([clave, valor]) => {
  const [contexto, etiqueta] = clave.split('|');
  return [`${contexto}|${normalizar(etiqueta)}`, valor];
}));

/** Ayuda de la casilla en su formulario (sin contexto: la ficha del proyecto). */
export function buscarGuia(contexto, etiqueta) {
  const encontrada = INDICE.get(`${contexto || 'ficha'}|${normalizar(etiqueta)}`);
  if (!encontrada) return null;
  const [que, como, porque, manual] = encontrada;
  return { que, como, porque, manual };
}
