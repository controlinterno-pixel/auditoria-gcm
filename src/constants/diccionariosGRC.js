// src/constants/diccionariosGRC.js

// 📚 1. LISTA MAESTRA DE AUDITORES OFICIALES
export const AUDITORES_OFICIALES = [
  "Rodolfo González",
  "Yehison Pineda",
  "Angelica Hernandez",
  "Luz Angela Chico"
];

// 🗺️ 2. MAPA DE PROCESOS EN CASCADA (MACROPROCESO -> SUBPROCESOS)
export const MAPA_PROCESOS = {
  "Gestión de mercadeo y comunicaciones": ["General"],
  "Gestión comercial": ["General"],
  "Gestión de Operaciones": ["Alojamiento", "Alimentos y bebidas", "Recreación", "Mantenimiento"],
  "Gestión de servicio al cliente": ["General"],
  "Gestión de la cadena de abastecimiento": ["Compras", "Gestión de almacenes", "Gestionar los activos fijos de la empresa", "Gestión de inventarios"],
  "Gestión del Talento Humano": ["Desarrollo de competencias", "Gestión del bienestar y la compensación", "Selección, vinculación y administración de colaboradores"],
  "Gestión Administrativa y Financiera": ["Gestión administrativa", "Gestión de cartera", "Gestión de contabilidad", "Gestión de costos", "Gestión de tesorería"],
  "Tecnologías de la información y la comunicación": ["General"],
  "Gestión estratégica": ["General"],
  "I+D+i": ["General"],
  "Gestión de la mejora continua (SIGCAS)": ["General", "Control interno y gestión de riesgos", "Protección de datos personales", "Gestión de calidad", "Seguridad y salud en el trabajo", "Gestión ambiental"]
};

// 🏢 3. DICCIONARIO INTELIGENTE EN CASCADA (SEDE -> CARGOS)
export const CARGOS_POR_SEDE = {
  "Hotel": [
    "Líderes Hotel", "Subdirector de Operaciones Hotel", "Líder de Proceso de alimentos y bebidas",
    "Chef Hotel", "Supervisor (a) mesa y servicio", "Coordinación de recepción",
    "Supervisor (a) de operaciones", "Coordinación SPA", "Coordinador de Mantenimiento", "Ama de llaves"
  ],
  "Ecoparque": [
    "Líderes Ecoparque", "Subdirección de Operaciones Balneario", "Líder táctico de alimentos y bebidas",
    "Jefe de Cocina", "Supervisor (a) mesa y servicio", "Coordinador Operaciones",
    "Supervisor Operaciones", "Coordinación SPA", "Terapeuta SPA", "Coordinador de mantenimiento",
    "Supervisor Ruta Ecológica"
  ],
  "Administrativos": [
    "Administrativos", "Gerente Administrativa y Judicial", "Auditoría Interna",
    "Líder Táctico de mejora Continua", "Coordinador de Servicio al Cliente", "Dirección Administrativa y Financiera",
    "Líder de Compras y Almacen", "Líder de Costos y Presupuestos", "Líder de Tesorería y Cartera",
    "Contadora de Socios", "Coordinación Administrativa Family Office", "Jefe de control interno",
    "Líder de Contabilidad", "Contador", "Líder Administrativa", "Dirección de Mercadeo y Comunicaciones",
    "Coordinación de Mercadeo y Comunicaciones", "Dirección Comercial", "Coordinación Comercial y Contact Center",
    "Dirección Talento Humano", "Coordinación Seguridad Y Salud en el trabajo", "Líder de Gestión Ambiental",
    "Lider Tactico de Infraestructura Tecnológica", "Director de TICS", "Desarrollador Junior",
    "Líder Táctico desarrollo de Software", "Coordinador de Marketing digital"
  ]
};

// 👔 4. LISTADO MAESTRO DE CARGOS DE LA EMPRESA (Homologado para todos los módulos)
export const CARGOS_EMPRESA = [
  "AGENTE CONTACT CENTER", "ALMACENISTA", "AMA DE LLAVES", "ANALISTA CARTERA", 
  "ANALISTA CONTABILIDAD", "ANALISTA DE AUDITORIA", "ANALISTA DE COMPRAS", 
  "ANALISTA DE COSTOS E INVENTARIOS", "ANALISTA DE FORMACION Y DESARROLLO", 
  "ANALISTA DE MEJORA CONTINUA", "ANALISTA DE NOMINA", "ANALISTA DE TESORERIA", 
  "ANALISTA GESTION AMBIENTAL", "ANALISTA TALENTO HUMANO", "ANALISTA TESORERIA", 
  "ANALISTA TICS", "APRENDIZ SENA", "ASISTENTE DE GERENCIA", "AUDITOR INTERNO", 
  "AUXILIAR ADMINISTRATIVA Y CONTABLE", "AUXILIAR ADMINISTRATIVO Y LABOR SOCIAL", 
  "AUXILIAR ADMINISTRATIVO Y LOGISTICO", "AUXILIAR AUDITORIA NOCTURNA", 
  "AUXILIAR COMERCIAL", "AUXILIAR DE BARRA", "AUXILIAR DE COCINA", 
  "AUXILIAR DE CUADRILLA", "AUXILIAR DE DESPENSA", "AUXILIAR DE ENFERMERIA", 
  "AUXILIAR DE GESTION DOCUMENTAL", "AUXILIAR DE INVENTARIOS", "AUXILIAR DE LAVANDERIA", 
  "AUXILIAR DE MANTENIMIENTO", "AUXILIAR DE MANTENIMIENTO CARRETERA", 
  "AUXILIAR DE PORTERIA", "AUXILIAR DE PORTERIA - BOTONES", "AUXILIAR DE SEGURIDAD Y SALUD", 
  "AUXILIAR DE SERVICIO AL CLIENTE", "AUXILIAR DE ÁREAS COMUNES", "AUXILIAR PTAB", 
  "AUXILIAR PTAR AMBIENTAL", "AUXILIAR SUPERNUMERARIA", "AUXILIAR SUPERNUMERARIO", 
  "AUXILIAR TICS", "BARISTA - AUXILIAR DE BARRA", "CAJERO", "CAMARERA", "CHEF HOTEL", 
  "CONTADOR", "COORDINACION COMERCIAL Y CONTACT CENTER", 
  "COORDINACIÓN ADMINISTRATIVA FAMILY OFFICCE", "COORDINADOR CONTACT CENTER", 
  "COORDINADOR DE MARCA", "COORDINADOR DE OPERACIONES", 
  "COORDINADOR DE SERVICIO AL CLIENTE", "COORDINADORA DE RECEPCIÓN", 
  "COORDINADORA DE SEGURIDAD Y SALUD EN EL TRABAJO", "COORDINADORA SPA", 
  "DESARROLLADOR JUNIOR", "DIRECTOR COMERCIAL", "DIRECTOR DE MERCADEO Y COMUNICACIONES", 
  "DIRECTOR DE TICS", "DIRECTORA ADMINISTRATIVA Y FINANCIERA", 
  "DIRECTORA DE TALENTO HUMANO", "EJECUTIVO COMERCIAL", "EJECUTIVO COMERCIAL BOGOTA", 
  "EJECUTIVO COMERCIAL CALI", "EJECUTIVO COMERCIAL EJE CAFETERO", 
  "EJECUTIVO COMERCIAL MEDELLIN", "EJECUTIVO COMERCIAL SANTA ROSA", "GERENTE GENERAL", 
  "GUIA TURISTICO EXPERIENCIA NATURAL", "JARDINERO", "JEFE DE COCINA", "JEFE DE CONTROL INTERNO",
  "JEFE DE MANTENIMIENTO", "LIDER ADMINSITRATIVA", "LIDER DE COMUNICACIONES", 
  "LIDER DE MANTENIMIENTO", "LIDER DE PLANEACION FINANCIERA", 
  "LIDER DE PRODUCTO Y EXPERIENCIA", "LIDER DE TESORERIA Y CARTERA", 
  "LIDER TACTICO DE ALIMENTOS Y BEBIDAS", "LÍDER DE COSTOS E INVENTARIO", 
  "LÍDER DE GESTION AMBIENTAL", "LÍDER DE PROCESO DE ALIMENTOS Y BEBIDAS", 
  "LÍDER TÁCTICO DE ANALISIS DE DATOS", "LÍDER TÁCTICO DE COMPRAS Y ALMACEN", 
  "LÍDER TÁCTICO DE CONTABILIDAD", "LÍDER TÁCTICO DE FAMILY OFFICCE", 
  "LÍDER TÁCTICO DE INFRAESTRUCTURA TECNOLOGIA", "LÍDER TÁCTICO DE MEJORA CONTINUA", 
  "LÍDER TÁCTICO DESARROLLO DE SOFTWARE", "MENSAJERO", "MESERO", "PORCIONADOR", 
  "PRIMER COCINERO", "PRIMER COCINERO HOTEL", "RECEPCIONISTA", "RECEPCIONISTA BILINGUE", 
  "SALVAVIDAS", "SERVICIOS GENERALES", "STEWAR", 
  "SUBDIRECCIÓN DE OPERACIONES BALNEARIO", "SUBDIRECCIÓN DE OPERACIONES HOTEL", 
  "SUPERVISOR DE MESA Y SERVICIOS", "SUPERVISOR DE OPERACIONES", 
  "SUPERVISOR EXPERIENCIAS NATURALEZA", "SUPERVISOR OPERACIONES HOTEL", "TERAPEUTA SPA"
];

// Alias para compatibilidad hacia atrás: Evita que otros módulos que importaban la variable antigua fallen
export const CARGOS_SOCIALIZACION = CARGOS_EMPRESA;

export const CLASIFICACIONES_MANUAL = [
  "Ejecución y administración de procesos",
  "Fraude Externo",
  "Fraude Interno",
  "Fallas Tecnológicas",
  "Relaciones Laborales",
  "Usuarios, productos y practicas",
  "Daños a activos fijos/ eventos externos"
];