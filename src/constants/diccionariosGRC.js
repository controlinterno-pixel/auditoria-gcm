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

// 👔 4. CARGOS SOCIALIZACIÓN
export const CARGOS_SOCIALIZACION = [
  "Auditoría Interna", "Chef Hotel", "Contador", "Contadora de Socios", "Coordinación Administrativa Family Office",
  "Coordinación Comercial y Contact Center", "Coordinación de Mercadeo y Comunicaciones", "Coordinación de Recepción",
  "Coordinación Seguridad y Salud en el Trabajo", "Coordinación SPA", "Coordinador de Mantenimiento",
  "Coordinador de Marketing Digital", "Coordinador de Servicio al Cliente", "Coordinador de Operaciones",
  "Desarrollador Junior", "Dirección Administrativa y Financiera", "Dirección Comercial",
  "Dirección de Mercadeo y Comunicaciones", "Dirección de Talento Humano", "Director de TICS",
  "Gerente Administrativa y Judicial", "Jefe de Control Interno", "Jefe de Cocina", "Líder Administrativa",
  "Líder de Compras y Almacén", "Líder de Costos y Presupuestos", "Líder de Contabilidad",
  "Líder de Gestión Ambiental", "Líder de Proceso de Alimentos y Bebidas", "Líder de Tesorería y Cartera",
  "Líder Táctico de Infraestructura Tecnológica", "Líder Táctico de Mejora Continua", "Líder Táctico de Desarrollo de Software",
  "Subdirección de Operaciones Balneario", "Subdirector de Operaciones Hotel", "Supervisor (a) de Operaciones",
  "Supervisor (a) Mesa y Servicio", "Supervisor de Operaciones", "Supervisor Ruta Ecológica", "Terapeuta SPA", "Ama de llaves"
];

// 📋 5. CLASIFICACIONES MANUAL DE RIESGO
export const CLASIFICACIONES_MANUAL = [
  "Ejecución y administracion del proceso", "Fraude interno", "Usuarios, productos y practicas", 
  "Fallas tecnologicas", "Daños a activos fisicos", "Relaciones laborales y seguridad en el puesto de trabajo"
];