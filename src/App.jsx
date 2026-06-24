import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// =====================================================================
// 🤖 CONEXIÓN SEGURA A GEMINI PRO IA
// =====================================================================
let GEMINI_API_KEY = "AIzaSyBFP_jHfIsUV_wbc5EMbgmsYslcBbRltPo"; 

// --- CONFIGURACIÓN DE FIREBASE (Sin Storage, usaremos Enlaces Drive/OneDrive) ---
const firebaseConfig = {
  apiKey: "AIzaSyBGE2P-_oep_N7o8so6wubmaZXv12imZaE",
  authDomain: "gestion-de-riesgos-b4bf0.firebaseapp.com",
  projectId: "gestion-de-riesgos-b4bf0",
  messagingSenderId: "507146405155",
  appId: "1:507146405155:web:574f89d0cc6256e629b896",
  measurementId: "G-WTZPTWV67Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONTROL DE ACCESO (ROLES) ---
const ADMIN_EMAILS = [
  "controlinterno@termales.com.co",
  "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co",
  "analista.controlinterno@termales.com.co"
];

// =====================================================================
// 🛠️ FUNCIONES GLOBALES Y CÁLCULOS
// =====================================================================

const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };
const mapMesNumATexto = { 
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", 
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", 
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre" 
};

const formatSafeDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val);
};

const getMonthFromDate = (dateVal) => {
  const dateStr = formatSafeDate(dateVal);
  if (!dateStr || dateStr.length < 7) return 'N/A';
  if (dateStr.includes('-')) return dateStr.split('-')[1]; 
  return 'N/A';
};

const getYearFromDate = (dateVal) => {
  const dateStr = formatSafeDate(dateVal);
  if (!dateStr) return 'N/A';
  if (dateStr.includes('-')) return dateStr.split('-')[0];
  return 'N/A';
};

const getItemAnio = (item) => {
  if (item.anio) return Number(item.anio);
  const dateStr = formatSafeDate(item.fecha);
  if (dateStr) return Number(getYearFromDate(dateStr)) || new Date().getFullYear();
  return new Date().getFullYear();
};

const getItemMesText = (item) => {
  if (item.mes) return item.mes;
  const dateStr = formatSafeDate(item.fecha);
  if (dateStr) {
    const mNum = getMonthFromDate(dateStr);
    return mapMesNumATexto[mNum] || "Mayo";
  }
  return "Mayo";
};

const calcularMatriz5x5 = (probabilidad, impacto) => {
  const pVal = mapProbabilidadNum[probabilidad] || 3;
  const iVal = mapImpactoNum[impacto] || 2;
  const score = pVal * iVal;

  let apetito = "Dentro de Apetito";
  let accion = "Aceptar / Monitorear";
  let color = "bg-emerald-500 text-white";
  let borderSemaforo = "border-emerald-200";

  if (score <= 4) {
    color = "bg-emerald-500 text-white"; borderSemaforo = "border-emerald-600";
  } else if (score <= 9) {
    color = "bg-yellow-400 text-slate-900"; borderSemaforo = "border-yellow-600"; accion = "Monitorear periódicamente";
  } else if (score <= 16) {
    color = "bg-orange-500 text-white"; borderSemaforo = "border-orange-600"; apetito = "Fuera de Apetito"; accion = "Mitigar / Ajustar Controles";
  } else {
    color = "bg-red-600 text-white"; borderSemaforo = "border-red-700"; apetito = "Fuera de Apetito"; accion = "Evitar / Suspender Proceso / Transferir";
  }
  return { score, apetito, accion, color, borderSemaforo };
};

const applyFilters = (dataArray, globalTerm, colFilters = {}) => {
  let result = dataArray;
  if (globalTerm) {
    const lowerTerm = globalTerm.toLowerCase();
    result = result.filter(item => 
      Object.values(item).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(lowerTerm))
    );
  }
  if (colFilters && Object.keys(colFilters).length > 0) {
    Object.entries(colFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const lowerFilter = filterValue.toLowerCase();
        result = result.filter(item => {
          const val = item[key];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerFilter);
        });
      }
    });
  }
  return result;
};

// --- COMPONENTES VISUALES ---
const ProgressBar = ({ progress }) => {
  const safeProgress = Math.min(Math.max(Math.round(Number(progress) || 0), 0), 100);
  let color = "bg-red-500";
  if (safeProgress >= 40) color = "bg-amber-500";
  if (safeProgress >= 80) color = "bg-emerald-500";
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold mb-1">
        <span className="text-slate-500">PROGRESO</span>
        <span className="text-slate-800 notranslate" translate="no">{safeProgress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${safeProgress}%` }}></div>
      </div>
    </div>
  );
};

const Gauge = ({ value, label, sublabel, colorClass }) => {
  const safeValue = Math.min(Math.max(Math.round(Number(value) || 0), 0), 100);
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center h-full">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
          <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" 
            strokeDasharray={339} strokeDashoffset={339 - (339 * safeValue) / 100}
            className={`${colorClass} transition-all duration-1000`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-3xl font-black text-slate-800 notranslate" translate="no">{safeValue} %</span>
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-6">{label}</p>
      <p className="text-[10px] font-bold text-slate-500 mt-1">{sublabel}</p>
    </div>
  );
};

const FilterInput = ({ colKey, placeholder, dark, columnFilters, handleColFilterChange }) => (
  <input 
    type="text" 
    placeholder={placeholder || "Filtrar..."}
    className={`mt-2 w-full text-[10px] px-2 py-1.5 font-medium rounded-md border focus:outline-none focus:ring-2 transition-all ${
      dark 
        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500' 
        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-[#004d40]'
    }`}
    value={columnFilters[colKey] || ''}
    onChange={(e) => handleColFilterChange(colKey, e.target.value)}
    onClick={(e) => e.stopPropagation()} 
  />
);

const TrendChart = ({ data, title, isCurrency, color, fillColor, onPointClick }) => {
  const maxVal = Math.max(...data.map(d => d.valor), 1);
  const height = 120;
  const width = 600;
  const paddingY = 20;
  const paddingX = 20;

  const points = data.map((d, i) => {
    const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1));
    const y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
       <div className="flex justify-between items-center mb-6">
         <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h4>
         <span className="text-xl">{isCurrency ? '📉' : '📊'}</span>
       </div>
       <div className="relative w-full">
         <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm overflow-visible" preserveAspectRatio="none">
           <polygon points={fillPoints} fill={fillColor} opacity="0.5" />
           <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
           {data.map((d, i) => {
              const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1));
              const y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
              return (
                <g key={`point-${i}`} className="group cursor-pointer" onClick={() => onPointClick && onPointClick(d)}>
                    <circle cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="3" className="transition-all duration-200 group-hover:r-[7px] group-hover:fill-slate-800" />
                    <rect x={x - 35} y={y - 32} width="70" height="22" rx="6" fill="#1e293b" className="opacity-0 group-hover:opacity-100 transition-opacity" pointerEvents="none" />
                    <text x={x} y={y - 17} fontSize="11" fill="white" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none notranslate" translate="no">
                       {isCurrency ? `$${(d.valor/1000000).toFixed(1)}M` : Math.round(d.valor)}
                    </text>
                </g>
              );
           })}
         </svg>
         <div className="flex justify-between mt-4 text-[9px] font-bold text-slate-400 uppercase px-2 border-t border-slate-100 pt-3">
            {data.map((d, idx) => <span key={`chart-mes-${idx}`} className="notranslate" translate="no">{d.mes.substring(0,3)}</span>)}
         </div>
       </div>
    </div>
  );
};

// --- DATOS POR DEFECTO ACTUALIZADOS DE LA IMAGEN (20 PROCESOS) ---
const defaultCronograma = [
  { id: 1, codigo: '01', periodo: 'Diciembre', proceso: 'Cumplimiento Normativo', enfoque: 'Verificación de cumplimiento normativo y legal.', cumplimiento: 0, responsable: 'Yehison J Pineda.', apoyo: 'Rodolfo González G.', meses: ['Diciembre'] },
  { id: 2, codigo: '02', periodo: 'Mayo - Junio', proceso: 'Compras', enfoque: 'Auditoría a procesos de selección, cotización y pagos de proveedores.', cumplimiento: 100, responsable: 'Yehison J Pineda.', apoyo: 'Rodolfo Gonzalez G.', meses: ['Mayo', 'Junio'] },
  { id: 3, codigo: '03', periodo: 'Mayo - Junio', proceso: 'Financiera', enfoque: 'Revisión de estados financieros y conciliaciones.', cumplimiento: 100, responsable: 'Rodolfo Gonzalez G.', apoyo: 'Yehison J Pineda.', meses: ['Mayo', 'Junio'] },
  { id: 4, codigo: '04', periodo: 'Julio - Agosto', proceso: 'Gestión de Tesoreria', enfoque: 'Arqueos, flujo de caja y manejo de efectivo.', cumplimiento: 0, responsable: 'Angelica F. Hernandez.', apoyo: 'Yehison J Pineda.', meses: ['Julio', 'Agosto'] },
  { id: 5, codigo: '05', periodo: 'Noviembre - Diciembre', proceso: 'Gestión de Crédito y Cartera', enfoque: 'Verificación del comportamiento de Notas Crédito y Descuentos.', cumplimiento: 0, responsable: 'Luz Angela Chico T.', apoyo: 'Yehison J Pineda.', meses: ['Noviembre', 'Diciembre'] },
  { id: 6, codigo: '06', periodo: 'Noviembre - Diciembre', proceso: 'Gestión Contable', enfoque: 'Auditoría a cierres contables y causaciones.', cumplimiento: 0, responsable: 'Yehison J Pineda.', apoyo: 'Rodolfo Gonzalez G.', meses: ['Noviembre', 'Diciembre'] },
  { id: 7, codigo: '07', periodo: 'Septiembre - Diciembre', proceso: 'Proyectos', enfoque: 'Auditoría a la ejecución presupuestal de proyectos.', cumplimiento: 0, responsable: 'Yehison J Pineda.', apoyo: 'Rodolfo Gonzalez G.', meses: ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] },
  { id: 8, codigo: '08', periodo: 'Noviembre - Diciembre', proceso: 'Mantenimiento de Infraestructura', enfoque: 'Planes de mantenimiento preventivo y correctivo.', cumplimiento: 0, responsable: 'Rodolfo Gonzalez G.', apoyo: 'Yehison J Pineda.', meses: ['Noviembre', 'Diciembre'] },
  { id: 9, codigo: '09', periodo: 'Noviembre - Diciembre', proceso: 'Gestión Ambiental', enfoque: 'Cumplimiento de normativa ambiental y manejo de residuos.', cumplimiento: 0, responsable: 'Rodolfo Gonzalez G.', apoyo: 'Luz Angela Chico T.', meses: ['Noviembre', 'Diciembre'] },
  { id: 10, codigo: '10', periodo: 'Marzo', proceso: 'Gestión Clientes', enfoque: 'Análisis de PQRS y efectividad de planes de acción.', cumplimiento: 100, responsable: 'Angelica F. Hernandez.', apoyo: 'Yehison J Pineda.', meses: ['Marzo'] },
  { id: 11, codigo: '11', periodo: 'Julio - Agosto', proceso: 'Canales Alternos', enfoque: 'Revisión de canales de distribución y ventas.', cumplimiento: 0, responsable: 'Rodolfo Gonzalez G.', apoyo: 'Yehison J Pineda.', meses: ['Julio', 'Agosto'] },
  { id: 12, codigo: '12', periodo: 'Agosto - Octubre', proceso: 'Mercadeo', enfoque: 'Auditoría a campañas, pauta digital y ROI.', cumplimiento: 0, responsable: 'Yehison J Pineda.', apoyo: 'Angelica F. Hernandez.', meses: ['Agosto', 'Septiembre', 'Octubre'] },
  { id: 13, codigo: '13', periodo: 'Septiembre - Noviembre', proceso: 'Control Inventarios', enfoque: 'Toma física de inventarios e insumos operacionales.', cumplimiento: 0, responsable: 'Yehison J Pineda.', apoyo: 'Angelica F. Hernandez.', meses: ['Septiembre', 'Octubre', 'Noviembre'] },
  { id: 14, codigo: '14', periodo: 'Anual', proceso: 'Gestión de tecnologías de la información', enfoque: 'Primer semestre Verificación documental y segundo semestre auditoria externa', cumplimiento: 50, responsable: 'N/A', apoyo: 'N/A', meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] },
  { id: 15, codigo: '15', periodo: 'Febrero, Mayo, Junio', proceso: 'Operaciones Alojamiento y recreación.', enfoque: 'Rentabilidad AyB, Auditoria Locativa, Calidad, Taquilla, Manillas.', cumplimiento: 100, responsable: 'Todos', apoyo: '', meses: ['Febrero', 'Mayo', 'Junio'] },
  { id: 16, codigo: '16', periodo: 'Marzo, Abril, Julio, Agosto', proceso: 'Alimentos y Bebidas (AYB)', enfoque: 'Estandarización de procesos y alimentación.', cumplimiento: 100, responsable: 'Todos', apoyo: '', meses: ['Marzo', 'Abril', 'Julio', 'Agosto'] },
  { id: 17, codigo: '17', periodo: 'Agosto', proceso: 'Formación y Desarrollo', enfoque: 'Auditoría a planes de capacitación y matriz de habilidades.', cumplimiento: 0, responsable: 'Angelica F. Hernandez.', apoyo: 'Yehison J Pineda.', meses: ['Agosto'] },
  { id: 18, codigo: '18', periodo: 'Mayo - Junio', proceso: 'Selección y Vinculación', enfoque: 'Procesos de contratación y onboarding.', cumplimiento: 100, responsable: 'Angelica F. Hernandez.', apoyo: 'Yehison J Pineda.', meses: ['Mayo', 'Junio'] },
  { id: 19, codigo: '19', periodo: 'Julio - Agosto', proceso: 'Seguridad y Salud en el Trabajo', enfoque: 'Matriz legal, entrega de EPPs y reportes de AT.', cumplimiento: 0, responsable: 'Rodolfo Gonzalez G.', apoyo: 'Yehison J Pineda.', meses: ['Julio', 'Agosto'] },
  { id: 20, codigo: '20', periodo: 'Julio - Agosto', proceso: 'Compensaciones', enfoque: 'Nómina, liquidación de horas extras y parafiscales.', cumplimiento: 0, responsable: 'Angelica F. Hernández.', apoyo: 'Yehison J Pineda.', meses: ['Julio', 'Agosto'] }
];

const defaultRiesgos = [
  { id: 98, sede: 'Hotel', categoria: 'Operativo', proceso: 'Alimentos y bebidas', normativa: 'Norma Técnica de Salubridad', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Insatisfacción del cliente por mala calidad de los productos ofertados en A&B debido a una afectación de la cocción y sabor de los alimentos.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío diaria e inspección organoléptica al recibir insumos.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe de Alimentos y Bebidas', anio: 2026, mes: 'Mayo', historialCambios: [] },
  { id: 186, sede: 'Administrativo', categoria: 'Estratégico', proceso: 'Gestión Estratégica', normativa: 'Estatuto Tributario (DIAN)', tipoRiesgo: 'Legal y Regulatorio', afectacion: 'Económica', causaInmediata: 'Cambios normativos tributarios', causaRaiz: 'Falta de comité legal interno', descripcion: 'Pérdidas económicas por afectación al modelo de negocio debido a un entorno regulatorio negativo.', probabilidadInherente: 'Rara', impactoInherente: 'Medio', noControl: 'C-186', descripcionControl: 'Revisión y auditoría externa por firma contable cada trimestre.', probabilidadResidual: 'Rara', impactoResidual: 'Bajo', responsable: 'Gerente Financiero', anio: 2026, mes: 'Mayo', historialCambios: [] },
  { id: 201, sede: 'Ecoparque', categoria: 'Tecnológico', proceso: 'Infraestructura TI', normativa: 'Ley 1581 Protección de Datos', tipoRiesgo: 'Ciberseguridad', afectacion: 'Operacional', causaInmediata: 'Falta de parches de seguridad', causaRaiz: 'Obsolescencia de servidores locales', descripcion: 'Ataque de ransomware que paraliza la operation central y expone datos confidenciales.', probabilidadInherente: 'Posible', impactoInherente: 'Crítico', noControl: 'C-201', descripcionControl: 'Firewall activo con logs y copias de seguridad semanales inmutables.', probabilidadResidual: 'Posible', impactoResidual: 'Alto', responsable: 'CISO / Director de TI', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, sede: 'Ecoparque', ref: 'HAL-2026-001', titulo: 'Acceso de usuarios genéricos a la base de datos de taquilla.', proceso: 'Sistemas', responsable: 'Jefe de TI', auditor: 'Auditoría TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', anio: 2026, mes: 'Junio', historialCambios: [] },
  { id: 2, sede: 'Hotel', ref: 'HAL-2025-089', titulo: 'Ausencia de actas de capacitación en higiene de alimentos.', proceso: 'Alimentos y bebidas', responsable: 'Jefe de A&B', auditor: 'Control Interno', severidad: 'Medio', idRiesgo: 98, estado: 'Cerrado', fecha: '2025-11-15', anio: 2025, mes: 'Noviembre', historialCambios: [] }
];

const defaultPlanes = [
  { id: 1, idHallazgo: 1, accion: 'Desactivar credenciales comunes y parametrizar roles individuales en base de datos.', responsable: 'Jefe de TI', fecha: '2026-07-15', estado: 'En Proceso', progreso: 30, anio: 2026, mes: 'Julio', historialCambios: [] },
  { id: 2, idHallazgo: 2, accion: 'Realizar capacitación certificada con entidad de salud y documentar firmas.', responsable: 'Jefe de A&B', fecha: '2025-12-10', estado: 'Cerrado', progreso: 100, anio: 2025, mes: 'Diciembre', historialCambios: [] }
];

const defaultIncidentes = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-05', titulo: 'Alarma de ataque de fuerza bruta contenida', descripcion: 'El firewall detectó 400 intentos de inicio de sesión fallidos de IPs externas. El puerto se bloqueó.', costo: 1200000, impacto: 'Bajo', reportadoPor: 'analista.controlinterno@termales.com.co', estado: 'Cerrado', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultEvaluaciones = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-01', diseño: 'Eficaz', ejecucion: 'Eficaz', calificacion: 100, comentarios: 'Prueba de penetración simulada arrojó contención del cortafuegos de manera instantánea.', auditor: 'controlinterno@termales.com.co', anio: 2026, mes: 'Junio', historialCambios: [] },
  { id: 2, idRiesgo: 98, fecha: '2026-06-02', diseño: 'Eficaz', ejecucion: 'Inadecuado', calificacion: 0, comentarios: 'No se encontraron los checklist del mes pasado en la cocina del Hotel.', auditor: 'controlinterno@termales.com.co', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultMonitoreo = [
  { id: 1, indicador: 'ARQUEOS DE CAJA', valor: 117, limite: 120, tendencia: 'up', proceso: 'Finanzas' },
  { id: 2, indicador: 'INVENTARIO MANILLAS', valor: 16, limite: 20, tendencia: 'down', proceso: 'Operaciones' },
  { id: 3, indicador: 'NOTAS CRÉDITO (AUDIT)', valor: 4, limite: 10, tendencia: 'flat', proceso: 'Auditoría' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('tablero');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('residual'); 
  const [isPresentationMode, setIsPresentationMode] = useState(false); 
  const [formResetKey, setFormResetKey] = useState(Date.now()); 

  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [filtroHeatMap, setFiltroHeatMap] = useState(null);
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  const [chartDetail, setChartDetail] = useState(null);

// --- NUEVOS ESTADOS PARA INFORMES DE AUDITORÍA ---
  const [informesAuditoria, setInformesAuditoria] = useState([]);
  const [editInformeAuditoria, setEditInformeAuditoria] = useState(null);

  // --- SELECCIÓN MÚLTIPLE DE FECHAS ACTIVADA ---
 // --- FILTROS DE PERIODICIDAD INDEPENDIENTES POR MÓDULO ---
  const [periodFilters, setPeriodFilters] = useState({});
  
  const defaultAnios = [new Date().getFullYear(), new Date().getFullYear() + 1];
  const defaultMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // El sistema lee la pestaña activa y saca su filtro correspondiente (o le da los valores por defecto)
  const selectedAnios = periodFilters[activeTab]?.anios || defaultAnios;
  const selectedMeses = periodFilters[activeTab]?.meses || defaultMeses;

  // Secuestramos los actualizadores originales para guardarlos en el diccionario de la pestaña actual
  const setSelectedAnios = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[activeTab] || { anios: defaultAnios, meses: defaultMeses };
      return { ...prev, [activeTab]: { ...cur, anios: typeof valOrFunc === 'function' ? valOrFunc(cur.anios) : valOrFunc } };
    });
  };

  const setSelectedMeses = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[activeTab] || { anios: defaultAnios, meses: defaultMeses };
      return { ...prev, [activeTab]: { ...cur, meses: typeof valOrFunc === 'function' ? valOrFunc(cur.meses) : valOrFunc } };
    });
  };

  // --- ENTIDADES PRINCIPALES ---
  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);

  // --- CONTROL FORMULARIOS MODAL / EDICIÓN ---
  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);
  const [editApetito, setEditApetito] = useState(null); 
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [editCronograma, setEditCronograma] = useState(null); 
  const [editMonitoreo, setEditMonitoreo] = useState(null);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  const safeRiesgos = Array.isArray(riesgos) ? riesgos : [];
  const safeHallazgos = Array.isArray(hallazgos) ? hallazgos : [];
  const safePlanes = Array.isArray(planes) ? planes : [];
  const safeIncidentes = Array.isArray(incidentes) ? incidentes : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];
  const safeCronograma = Array.isArray(cronograma) ? cronograma : [];
  const safeMonitoreo = Array.isArray(monitoreo) ? monitoreo : [];

  // Limpiar buscador al cambiar de pestaña
  useEffect(() => {
    setSearchTerm('');
    setColumnFilters({});
    setFiltroHeatMap(null);
  }, [activeTab]);

  const handleColFilterChange = (key, value) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleAnio = (anio) => {
    setSelectedAnios(prev => prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]);
  };
  
  const toggleMes = (mes) => {
    setSelectedMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const emailNorm = currentUser.email?.toLowerCase().trim();
        setIsAdmin(ADMIN_EMAILS.includes(emailNorm));
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);
    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        setRiesgos(data.riesgos || defaultRiesgos);
        setHallazgos(data.hallazgos || defaultHallazgos);
        setPlanes(data.planes || defaultPlanes);
        setIncidentes(data.incidentes || defaultIncidentes);
        setEvaluaciones(data.evaluaciones || defaultEvaluaciones);
        setCronograma(data.cronograma || defaultCronograma);
        setMonitoreo(data.monitoreo || defaultMonitoreo);
setInformesAuditoria(data.informesAuditoria || []);
      } else {
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
           setDoc(docRef, { riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, cronograma: defaultCronograma, monitoreo: defaultMonitoreo, informesAuditoria: [] });
        }
      }
      setIsCloudLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (window.XLSX) { setXlsxLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxLoaded(true);
    document.head.appendChild(script);
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault(); setAuthError('');
    try {
      if (isRegistering) { await createUserWithEmailAndPassword(auth, authEmail, authPassword); }
      else { await signInWithEmailAndPassword(auth, authEmail, authPassword); }
    } catch (error) { setAuthError('Error en credenciales.'); }
  };

  const handleLogout = async () => { await signOut(auth); };
  const saveToCloud = async (partialData) => { await setDoc(doc(db, 'workspace_compartido', 'base_de_datos_grc'), partialData, { merge: true }); };
  const showNotification = (message, type = 'success') => { setNotification({message, type}); setTimeout(() => setNotification(null), 4000); };
  
  // SOLUCIÓN AL SCROLL DE EDICIÓN: Búsqueda precisa del contenedor central para evitar el salto
  const scrollToForm = () => {
    setTimeout(() => {
      const formEl = document.getElementById('edit-form');
      const mainArea = document.getElementById('main-scroll-area');
      if (formEl && mainArea) {
        mainArea.scrollTo({ top: formEl.offsetTop - 20, behavior: 'smooth' });
      } else if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  const exportToExcel = (dataArray, fileName) => {
    if (!xlsxLoaded || !window.XLSX) {
      showNotification("La librería de exportación aún está cargando.", "error");
      return;
    }
    const cleanData = dataArray.map(item => {
      const { historialCambios, ...rest } = item;
      return rest;
    });
    
    const ws = window.XLSX.utils.json_to_sheet(cleanData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    window.XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification(`Archivo ${fileName} exportado con éxito.`);
  };

  const exportToJSON = () => {
    const data = { riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, incidentes: safeIncidentes, evaluaciones: safeEvaluaciones, cronograma: safeCronograma, monitoreo: safeMonitoreo };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "GCM_Backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if(window.confirm("⚠️ ALERTA: Esto sobrescribirá TODA la base de datos actual con los datos del archivo. ¿Estás seguro?")) {
          setIsCloudLoaded(false); 
          await saveToCloud(parsedData);
          showNotification("Base de datos actualizada masivamente con éxito.", "success");
          setIsCloudLoaded(true);
        }
      } catch(error) {
        showNotification("Error: El archivo no tiene un formato JSON válido.", "error");
      }
      e.target.value = null; 
    };
    reader.readAsText(file);
  };

  const handleImportExcelRiesgos = (e) => {
    if (!window.XLSX) {
      showNotification("La librería de Excel aún no ha cargado. Intenta de nuevo en unos segundos.", "error");
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet);

        if(window.confirm("⚠️ ALERTA: Esto reemplazará tu Matriz de Riesgos actual con los datos de este archivo Excel. Los demás módulos (Planes, Hallazgos, etc) no se borrarán. ¿Estás seguro?")) {
          setIsCloudLoaded(false);
          
          const nuevosRiesgos = json.map((r, index) => ({
            id: r.id || Date.now() + index,
            sede: r.sede || 'Hotel',
            proceso: r.proceso || 'Proceso General',
            categoria: r.categoria || 'Operativo',
            normativa: r.normativa || 'Ninguna',
            responsable: r.responsable || 'Sin Asignar',
            noControl: r.noControl || 'C-' + Math.floor(Math.random() * 100 + 100),
            descripcionControl: r.descripcionControl || r.control || 'Control no definido',
            descripcion: r.descripcion || 'Sin descripción',
            probabilidadInherente: r.probabilidadInherente || 'Posible',
            impactoInherente: r.impactoInherente || 'Medio',
            probabilidadResidual: r.probabilidadResidual || 'Posible',
            impactoResidual: r.impactoResidual || 'Medio',
            capacidadRiesgo: r.capacidadRiesgo || null,
            toleranciaFinanciera: r.toleranciaFinanciera || null,
            apetitoFinanciero: r.apetitoFinanciero || null,
            posturaEstrategica: r.posturaEstrategica || null,
            kriScore: r.kriScore || null,
            anio: r.anio || new Date().getFullYear(),
            mes: r.mes || "Mayo",
            historialCambios: [{ fecha: new Date().toLocaleString(), accion: 'Importado masivamente desde Excel' }]
          }));

          await saveToCloud({ riesgos: nuevosRiesgos });
          showNotification(`Matriz de Riesgos actualizada masivamente. (${nuevosRiesgos.length} riesgos cargados)`, "success");
          setIsCloudLoaded(true);
        }
      } catch (error) {
        console.error(error);
        showNotification("Error: El archivo Excel no tiene un formato válido o está corrupto.", "error");
        setIsCloudLoaded(true);
      }
      e.target.value = null;
    };
    reader.readAsArrayBuffer(file);
  };

  const forceUpdateCronograma = async () => {
    if(window.confirm("¿Seguro que deseas cargar los 20 procesos del nuevo Plan Anual? Esto borrará el cronograma actual y lo reemplazará por la versión de Termales Santa Rosa.")) {
      await saveToCloud({ cronograma: defaultCronograma });
      showNotification("¡Plan Anual actualizado exitosamente con los 20 procesos!", "success");
    }
  };

  const sugerirConIA = async (tipoTarget) => {
    let textoBase = "";
    let inputDestino = null;

    if (tipoTarget === 'control') {
      textoBase = document.querySelector('input[name="descripcion"]')?.value || "";
      inputDestino = document.querySelector('input[name="control"]');
    } else if (tipoTarget === 'plan') {
      const selectElement = document.querySelector('select[name="idHallazgo"]');
      textoBase = selectElement ? selectElement.options[selectElement.selectedIndex]?.text : "";
      inputDestino = document.querySelector('input[name="accion"]');
    } else if (tipoTarget === 'hallazgo') {
      textoBase = document.querySelector('input[name="proceso"]')?.value || "";
      inputDestino = document.querySelector('input[name="titulo"]');
    }

    if (!textoBase || textoBase.trim() === '' || textoBase.includes('-- Seleccione --')) {
      showNotification("Escribe una descripción o selecciona un hallazgo primero para que la IA lo analice.", "error");
      return;
    }

    if (!GEMINI_API_KEY) {
      showNotification("La clave de API de Gemini no se ha cargado correctamente.", "error");
      return;
    }

    setIsThinking(true);
    showNotification("Gemini Pro está analizando el escenario...", "success");

    try {
      let prompt = "";
      if (tipoTarget === 'control') {
        prompt = `Actúa como un experto en auditoría GRC y ciberseguridad (ISO 31000). El siguiente es un evento de riesgo en una empresa: "${textoBase}". Redacta la descripción de un CONTROL CLAVE mitigante o preventivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto del control, sin comillas ni saludos.`;
      } else if (tipoTarget === 'plan') {
        prompt = `Actúa como un gerente de auditoría interno corporativo. Se ha detectado el siguiente hallazgo o desviación: "${textoBase}". Redacta una ACCIÓN DE CHOQUE o plan correctivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto de la acción, sin comillas ni saludos.`;
      } else if (tipoTarget === 'hallazgo') {
        prompt = `Actúa como un Auditor Senior de Control Interno. Estás auditando el siguiente proceso: "${textoBase}". Redacta la descripción de un HALLAZGO O DESVIACIÓN grave y realista (máximo 20 palabras) que se podría encontrar en este proceso. Sé muy ejecutivo, técnico y directo. Solo responde con el texto del hallazgo, sin comillas ni saludos.`;
      }

const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
       method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      let sugerencia = data.candidates[0].content.parts[0].text.trim();

      if (inputDestino) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(inputDestino, sugerencia);
        inputDestino.dispatchEvent(new Event('input', { bubbles: true }));
        inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
        showNotification("¡Gemini ha insertado una sugerencia ejecutiva de alto nivel!");
      }
    } catch (error) {
      console.error("Error conectando a Gemini:", error);
      showNotification("Error conectando con la IA de Google. Verifica los ajustes.", "error");
    } finally {
      setIsThinking(false);
    }
  };

  const analizarEvidenciaIA = async (evidenciaUrl, contextoItem, tipoItem) => {
    setIsThinking(true);
    showNotification("🤖 Extrayendo documento y enviando a Gemini...", "success");

    if (!GEMINI_API_KEY) {
      showNotification("⚠️ La clave de API de Gemini no se ha cargado correctamente.", "error");
      setIsThinking(false);
      return;
    }

    try {
      const prompt = `Actúa como un Auditor Senior de Control Interno y Cumplimiento Normativo ISO.
      Se acaba de adjuntar un archivo de evidencia (Foto o PDF o Enlace) para el siguiente ${tipoItem}: "${contextoItem}".
      Tu tarea es generar un dictamen de pre-auditoría rápido y estricto. Genera una lista de 4 puntos exactos que el analista DEBE verificar OBLIGATORIAMENTE con sus propios ojos al abrir ese archivo para asegurar que la evidencia es legalmente válida, mitiga el riesgo y no es fraudulenta. Sé muy técnico y directo (sin saludos).`;

const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
          })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const analisis = data.candidates[0].content.parts[0].text.trim();
      setAiModal({ titulo: `📋 Checklist IA (Gemini)`, contenido: analisis, url: evidenciaUrl });

    } catch (error) {
        console.error(error);
        showNotification("Error conectando con la IA de Google.", "error");
    } finally {
        setIsThinking(false);
    }
  };

  // --- FILTRADO GLOBAL COMPACTO (AÑOS Y MESES MÚLTIPLES) ---
  const filterByGlobalPeriod = (item) => {
    const a = getItemAnio(item);
    const m = getItemMesText(item);
    
    const passAnio = selectedAnios.length === 0 || selectedAnios.includes(Number(a)) || selectedAnios.includes(String(a));
    const passMes = selectedMeses.length === 0 || selectedMeses.includes(m);
    
    return passAnio && passMes;
  };

  const rFiltrados = useMemo(() => safeRiesgos.filter(filterByGlobalPeriod), [safeRiesgos, selectedAnios, selectedMeses]);
  const hFiltrados = useMemo(() => safeHallazgos.filter(filterByGlobalPeriod), [safeHallazgos, selectedAnios, selectedMeses]);
  const pFiltrados = useMemo(() => safePlanes.filter(filterByGlobalPeriod), [safePlanes, selectedAnios, selectedMeses]);
  const incFiltrados = useMemo(() => safeIncidentes.filter(filterByGlobalPeriod), [safeIncidentes, selectedAnios, selectedMeses]);
  const cFiltrados = useMemo(() => safeCronograma.filter(c => {
    const anio = Number(c.anio) || new Date().getFullYear();
    return selectedAnios.length === 0 || selectedAnios.includes(anio);
  }), [safeCronograma, selectedAnios]);

  const avanceGlobal = useMemo(() => {
    if (pFiltrados.length === 0) return 0;
    return pFiltrados.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / pFiltrados.length;
  }, [pFiltrados]);

  const hAbiertos = hFiltrados.filter(h => h.estado === 'Abierto').length;
  const hCerrados = hFiltrados.filter(h => h.estado === 'Cerrado').length;
  const pTotal = pFiltrados.length;
  const pAbiertos = pFiltrados.filter(p => p.estado !== 'Cerrado').length;
  const pCerrados = pFiltrados.filter(p => p.estado === 'Cerrado').length;

  const rendimientoControles = useMemo(() => {
    const evalFiltradas = safeEvaluaciones.filter(filterByGlobalPeriod);
    if (evalFiltradas.length === 0) return 0;
    return (evalFiltradas.filter(e => e.calificacion === 100).length / evalFiltradas.length) * 100;
  }, [safeEvaluaciones, selectedAnios, selectedMeses]);

  // --- SUBMITS DE ACCIONES ---
  const handleRiesgoSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editRiesgo) {
      const mod = { ...editRiesgo, sede: formData.get('sede'), proceso: formData.get('proceso'), categoria: formData.get('categoria'), normativa: formData.get('normativa'), responsable: formData.get('responsable'), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: formData.get('probInh'), impactoInherente: formData.get('impInh'), probabilidadResidual: formData.get('probRes'), impactoResidual: formData.get('impRes'), capacidadRiesgo: editRiesgo.capacidadRiesgo||null, toleranciaFinanciera: editRiesgo.toleranciaFinanciera||null, apetitoFinanciero: editRiesgo.apetitoFinanciero||null, posturaEstrategica: editRiesgo.posturaEstrategica||null, kriScore: editRiesgo.kriScore||null, historialCambios: [...(editRiesgo.historialCambios || []), { fecha: ts, accion: 'Modificado en matriz' }] };
      updated = safeRiesgos.map(r => r.id === editRiesgo.id ? mod : r); setEditRiesgo(null);
    } else {
      const nuevo = { id: Date.now(), sede: formData.get('sede'), proceso: formData.get('proceso'), categoria: formData.get('categoria'), normativa: formData.get('normativa'), responsable: formData.get('responsable'), noControl: 'C-' + Math.floor(Math.random() * 100 + 100), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: formData.get('probInh'), impactoInherente: formData.get('impInh'), probabilidadResidual: formData.get('probRes'), impactoResidual: formData.get('impRes'), anio: 2026, mes: "Junio", historialCambios: [{ fecha: ts, accion: 'Creado' }] };
      updated = [nuevo, ...safeRiesgos];
    }
    setRiesgos(updated); await saveToCloud({ riesgos: updated }); e.target.reset(); showNotification("Riesgo estructurado.");
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    
    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editPlan?.evidenciaUrl || '';
    const progresoVal = parseInt(formData.get('progreso') || 0);
    const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';

    let updatedList;
    if (editPlan && isAdmin) {
      const modificado = { ...editPlan, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editPlan.historialCambios || []), { fecha: ts, accion: 'Plan actualizado' }] };
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);
    } else if (!isAdmin) {
      const idHallazgo = parseInt(formData.get('idHallazgo'));
      const planToUpdate = safePlanes.find(p => p.idHallazgo === idHallazgo);
      
      if (planToUpdate) {
        const mod = { ...planToUpdate, progreso: progresoVal, estado: estadoVal, evidenciaUrl: evidenciaUrlOut, historialCambios: [...(planToUpdate.historialCambios || []), { fecha: ts, accion: 'Avance reportado por Jefe de área' }] };
        updatedList = safePlanes.map(p => p.id === planToUpdate.id ? mod : p);
      } else {
        showNotification("Error: No se encontró el plan asociado a este hallazgo.", "error");
        return;
      }
    } else {
      const nuevo = { id: Date.now(), idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: ts, accion: 'Plan asignado' }] };
      updatedList = [...safePlanes, nuevo];
    }
    
    setPlanes(updatedList); 
    await saveToCloud({ planes: updatedList }); 
    e.target.reset(); 
    showNotification("Progreso del plan guardado correctamente.");
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault(); 
    const formData = new FormData(e.target);
    const calif = (formData.get('diseno') === 'Eficaz' && formData.get('ejecucion') === 'Eficaz') ? 100 : 0;
    const ts = new Date().toLocaleString();
    
    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editEvaluacion?.evidenciaUrl || '';

    let updatedList;
    if (editEvaluacion && isAdmin) {
      const mod = { ...editEvaluacion, idRiesgo: parseInt(formData.get('idRiesgo')), diseño: formData.get('diseno'), ejecucion: formData.get('ejecucion'), calificacion: calif, comentarios: formData.get('comentarios'), evidenciaUrl: evidenciaUrlOut };
      updatedList = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? mod : ev);
      setEditEvaluacion(null);
    } else {
      const nuevo = { id: Date.now(), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], diseño: formData.get('diseno'), ejecucion: formData.get('ejecucion'), calificacion: calif, comentarios: formData.get('comentarios'), auditor: user.email, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [] };
      updatedList = [...safeEvaluaciones, nuevo];
    }
    setEvaluaciones(updatedList); await saveToCloud({ evaluaciones: updatedList }); e.target.reset(); showNotification("Evaluación registrada exitosamente.");
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    
    let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editHallazgo?.evidenciaUrl || '';

    let updated;
    if (editHallazgo) {
      const mod = { ...editHallazgo, sede: formData.get('sede'), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), auditor: formData.get('auditor'), titulo: formData.get('titulo'), severidad: formData.get('severidad'), evidenciaUrl: evidenciaUrlOut };
      updated = safeHallazgos.map(h => h.id === editHallazgo.id ? mod : h);
      setEditHallazgo(null);
    } else {
      const nuevo = { id: Date.now(), sede: formData.get('sede'), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), auditor: formData.get('auditor'), titulo: formData.get('titulo'), severidad: formData.get('severidad'), estado: 'Abierto', fecha: new Date().toISOString().split('T')[0], anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [] };
      updated = [...safeHallazgos, nuevo];
    }
    setHallazgos(updated); await saveToCloud({ hallazgos: updated }); e.target.reset(); showNotification("Desviación documentada.");
  };

  const handleIncidenteSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editIncidente) {
      const mod = { ...editIncidente, idRiesgo: parseInt(formData.get('idRiesgo')), titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), costo: parseFloat(formData.get('costo') || 0), impacto: formData.get('impacto'), historialCambios: [...(editIncidente.historialCambios || []), { fecha: ts, accion: 'Modificado' }] };
      updated = safeIncidentes.map(i => i.id === editIncidente.id ? mod : i);
      setEditIncidente(null);
    } else {
      const nuevo = { id: Date.now(), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), costo: parseFloat(formData.get('costo') || 0), impacto: formData.get('impacto'), reportadoPor: user.email, estado: 'Abierto', anio: 2026, mes: "Junio", historialCambios: [] };
      updated = [...safeIncidentes, nuevo];
    }
    setIncidentes(updated); await saveToCloud({ incidentes: updated }); e.target.reset(); showNotification("Evento registrado.");
  };

  const handleCronogramaSubmit = async (e) => {
    e.preventDefault(); 
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    
    const mesesSeleccionados = [];
    ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].forEach(mes => {
      if (formData.get(`mes_${mes}`)) mesesSeleccionados.push(mes);
    });

    let updatedList;
    if (editCronograma) {
      const modificado = {
        ...editCronograma,
        codigo: formData.get('codigo'),
        proceso: formData.get('proceso'),
        responsable: formData.get('responsable'),
        apoyo: formData.get('apoyo'),
        periodo: formData.get('periodo'),
        enfoque: formData.get('enfoque'),
        cumplimiento: parseInt(formData.get('cumplimiento') || 0),
        meses: mesesSeleccionados
      };
      updatedList = safeCronograma.map(c => c.id === editCronograma.id ? modificado : c);
      setEditCronograma(null);
      showNotification("Proceso del plan actualizado.");
    } else {
      const nuevo = {
        id: Date.now(),
        codigo: formData.get('codigo'),
        proceso: formData.get('proceso'),
        responsable: formData.get('responsable'),
        apoyo: formData.get('apoyo'),
        periodo: formData.get('periodo'),
        enfoque: formData.get('enfoque'),
        cumplimiento: parseInt(formData.get('cumplimiento') || 0),
        meses: mesesSeleccionados
      };
      updatedList = [...safeCronograma, nuevo];
      showNotification("Proceso agregado al Plan Anual.");
    }

    setCronograma(updatedList);
    await saveToCloud({ cronograma: updatedList });
    e.target.reset();
  };

 const handleApetitoSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin || !editApetito) return;
    const formData = new FormData(e.target);
    const timestamp = new Date().toLocaleString();

    const apetito = parseFloat(formData.get('apetitoFinanciero') || 0);
    const tolerancia = parseFloat(formData.get('toleranciaFinanciera') || 0);
    const capacidad = parseFloat(formData.get('capacidadRiesgo') || 0);

    if (apetito > tolerancia || tolerancia > capacidad) {
      showNotification({ message: "Error: La jerarquía debe ser: Apetito ≤ Tolerancia ≤ Capacidad.", type: "error" });
      return;
    }

    const modificado = {
      ...editApetito,
      posturaEstrategica: formData.get('posturaEstrategica'),
      kriScore: parseInt(formData.get('kriScore')),
      apetitoFinanciero: apetito,
      toleranciaFinanciera: tolerancia,
      capacidadRiesgo: capacidad,
      // --- NUEVAS DIMENSIONES COSO ERM ---
      impactoOperativo: formData.get('impactoOperativo') || 'No definido',
      impactoReputacional: formData.get('impactoReputacional') || 'No definido',
      impactoLegal: formData.get('impactoLegal') || 'No definido',
      escalamiento: formData.get('escalamiento') || 'Jefe de Área',
      historialCambios: [...(editApetito.historialCambios || []), { fecha: timestamp, accion: 'Arquitectura de apetito COSO ERM (Integral) parametrizada' }]
    };

    const updatedList = safeRiesgos.map(r => r.id === editApetito.id ? modificado : r);
    setRiesgos(updatedList);
    setEditApetito(null);
    await saveToCloud({ riesgos: updatedList });
    showNotification("Perfil COSO de Apetito Integral guardado exitosamente.");
    scrollToForm();
  };

  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin) return;
    if (!window.confirm('¿Seguro que desea eliminar este registro permanentemente?')) return;
    let updated;
    if (listType === 'riesgos') { updated = safeRiesgos.filter(r => r.id !== id); setRiesgos(updated); }
    if (listType === 'evaluaciones') { updated = safeEvaluaciones.filter(e => e.id !== id); setEvaluaciones(updated); }
    if (listType === 'hallazgos') { updated = safeHallazgos.filter(h => h.id !== id); setHallazgos(updated); }
    if (listType === 'planes') { updated = safePlanes.filter(p => p.id !== id); setPlanes(updated); }
    if (listType === 'incidentes') { updated = safeIncidentes.filter(i => i.id !== id); setIncidentes(updated); }
    if (listType === 'cronograma') { updated = safeCronograma.filter(c => c.id !== id); setCronograma(updated); }
    if (listType === 'monitoreo') { updated = safeMonitoreo.filter(m => m.id !== id); setMonitoreo(updated); }
    await saveToCloud({ [listType]: updated });
    showNotification("Registro eliminado.", "success");
  };

  const handleMonitoreoSubmit = async (e) => {
    e.preventDefault(); 
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    let updatedList;
    if (editMonitoreo && editMonitoreo.id) {
      const modificado = {
        ...editMonitoreo,
        indicador: formData.get('indicador').toUpperCase(),
        proceso: formData.get('proceso') || '',
        valor: parseInt(formData.get('valor') || 0),
        limite: parseInt(formData.get('limite') || 0),
        tendencia: formData.get('tendencia') || 'flat'
      };
      updatedList = safeMonitoreo.map(m => m.id === editMonitoreo.id ? modificado : m);
      setEditMonitoreo(null);
      showNotification("Indicador actualizado exitosamente.");
    } else {
      const nuevo = {
        id: Date.now(),
        indicador: formData.get('indicador').toUpperCase(),
        proceso: formData.get('proceso') || '',
        valor: parseInt(formData.get('valor') || 0),
        limite: parseInt(formData.get('limite') || 0),
        tendencia: formData.get('tendencia') || 'flat'
      };
      updatedList = [...safeMonitoreo, nuevo];
      setEditMonitoreo(null);
      showNotification("Nuevo indicador agregado.");
    }
    setMonitoreo(updatedList);
    await saveToCloud({ monitoreo: updatedList });
    e.target.reset();
  };

const handleInformeAuditoriaSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    console.log("🚀 Ejecución global de envío y radicación...");
    
    const ts = new Date().toLocaleString();
    const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
    
    // 🔍 Lectura directa de elementos en pantalla
    const tituloVal = document.getElementsByName('tituloInput')[0]?.value || document.getElementsByName('titulo')[0]?.value || document.getElementById('tituloInput')?.value || 'Sin título';
    const procesoVal = document.getElementsByName('procesoInput')[0]?.value || document.getElementsByName('proceso')[0]?.value || document.getElementById('procesoInput')?.value || 'Sin proceso';
    const evidenciaUrlOut = document.getElementsByName('evidenciaUrlInput')[0]?.value || document.getElementById('evidenciaUrlInput')?.value || editInformeAuditoria?.evidenciaUrl || '';
    const actaSocializacionUrlOut = document.getElementsByName('actaSocializacionUrlInput')[0]?.value || document.getElementById('actaSocializacionUrlInput')?.value || editInformeAuditoria?.actaSocializacionUrl || '';
    
    const correoPorName1 = document.getElementsByName('correosNotificacioInput')[0]?.value;
    const correoPorName2 = document.getElementsByName('correosNotificacionInput')[0]?.value;
    const correoPorId1 = document.getElementById('correosNotificacioInput')?.value;
    const correoPorId2 = document.getElementById('correosNotificacionInput')?.value;
    
    const correosNotificacionOut = String(correoPorName1 || correoPorName2 || correoPorId1 || correoPorId2 || '').trim();

    let updated;
    let refConsecutivoFinal = '';

    if (editInformeAuditoria) {
      refConsecutivoFinal = editInformeAuditoria.ref || 'INF-MOD';
      const mod = {
        ...editInformeAuditoria,
        titulo: tituloVal,
        proceso: procesoVal,
        fecha: document.getElementsByName('fecha')[0]?.value || document.getElementById('fecha')?.value || ts,
        elaboradoPor: document.getElementsByName('elaboradoPor')[0]?.value || document.getElementById('elaboradoPor')?.value || '',
        revisadoPor: document.getElementsByName('revisadoPor')[0]?.value || document.getElementById('revisadoPor')?.value || '',
        aprobadoPor: document.getElementsByName('aprobadoPor')[0]?.value || document.getElementById('aprobadoPor')?.value || '',
        socializado: document.getElementsByName('socializado')[0]?.value || 'No',
        socializadoCon: document.getElementsByName('socializadoCon')[0]?.value || 'N/A',
        evidenciaUrl: evidenciaUrlOut,
        actaSocializacionUrl: actaSocializacionUrlOut,
        historialCambios: [...(editInformeAuditoria.historialCambios || []), { fecha: ts, accion: 'Informe de auditoría modificado' }]
      };
      updated = safeInformes.map(i => i.id === editInformeAuditoria.id ? mod : i);
      setEditInformeAuditoria(null);
    } else {
      const nextNum = safeInformes.length + 1;
      const anioActual = new Date().getFullYear();
      refConsecutivoFinal = `INF-${anioActual}-${String(nextNum).padStart(3, '0')}`;
      
      const nuevo = {
        id: Date.now(),
        ref: refConsecutivoFinal,
        titulo: tituloVal,
        proceso: procesoVal,
        fecha: document.getElementsByName('fecha')[0]?.value || document.getElementById('fecha')?.value || ts,
        elaboradoPor: document.getElementsByName('elaboradoPor')[0]?.value || document.getElementById('elaboradoPor')?.value || '',
        revisadoPor: document.getElementsByName('revisadoPor')[0]?.value || document.getElementById('revisadoPor')?.value || '',
        aprobadoPor: document.getElementsByName('aprobadoPor')[0]?.value || document.getElementById('aprobadoPor')?.value || '',
        socializado: document.getElementsByName('socializado')[0]?.value || 'No',
        socializadoCon: document.getElementsByName('socializadoCon')[0]?.value || 'N/A',
        evidenciaUrl: evidenciaUrlOut,
        actaSocializacionUrl: actaSocializacionUrlOut,
        anio: anioActual,
        mes: "Junio",
        historialCambios: [{ fecha: ts, accion: 'Informe firmado, indexado y notificado por correo' }]
      };
      updated = [nuevo, ...safeInformes];
    }

    // 📧 DISPARADOR GLOBAL DE EMAILJS
    if (correosNotificacionOut !== '') {
      console.log("📡 Disparando Fetch hacia la API de EmailJS para: " + correosNotificacionOut);
      const emailParams = {
        ref_consecutivo: refConsecutivoFinal,
        titulo_informe: tituloVal,
        proceso_auditado: procesoVal,
        enlace_pdf: evidenciaUrlOut,
        enlace_acta: actaSocializacionUrlOut || 'No adjunta',
        destinatarios: correosNotificacionOut
      };

fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 'service_alaojyc',
          template_id: 'template_o2df1a9',
          user_id: 'KKvlQtlZQIdTQP0Xe', // <--- ¡AQUÍ ESTABA LA 'L' MINÚSCULA INVISIBLE!
          accessToken: '5M20ONuh2Lk2w731_uqdz', 
          template_params: emailParams
        })
      })
      .then((res) => {
        console.log("📬 API Response Status:", res.status);
        if (res.ok) {
          showNotification("Notificación electrónica enviada con éxito.");
        } else {
          console.error("❌ EmailJS rechazó la petición. Verifica tus 3 IDs.");
        }
      })
      .catch((err) => console.error("Error de red en EmailJS:", err)); } else {
      console.log("⚠️ No hay correos en la casilla, omitiendo EmailJS.");
    }   

    // Actualización del estado visual de la tabla
    setInformesAuditoria(updated);    
    // Almacenamiento seguro en la nube
    try {
      await saveToCloud({ informesAuditoria: updated });
    } catch (firebaseError) {
      console.warn("Advertencia de Firebase ignorada:", firebaseError);
    }
    
    // Limpieza total de los campos
    const inputsParaLimpiar = ['tituloInput', 'titulo', 'procesoInput', 'proceso', 'correosNotificacioInput', 'correosNotificacionInput', 'evidenciaUrlInput', 'actaSocializacionUrlInput'];
    inputsParaLimpiar.forEach(name => {
      const el = document.getElementsByName(name)[0] || document.getElementById(name);
      if (el) el.value = '';
    });

    showNotification("Informe de auditoría procesado y notificado correctamente.");
  };
// =====================================================================
  // REUSABLE HEADER COMPONENT (Dropdown Filters MULTIPLES)
  // =====================================================================
  const renderHeaderFiltros = (title, subtitle, includeMatrizToggle = false) => {
    const añosSet = new Set([new Date().getFullYear()]);
    safeHallazgos.forEach(h => { const a = getYearFromDate(formatSafeDate(h.fecha)); if(a !== 'N/A') añosSet.add(Number(a)); });
    safePlanes.forEach(p => { const a = getYearFromDate(formatSafeDate(p.fecha)); if(a !== 'N/A') añosSet.add(Number(a)); });
    safeIncidentes.forEach(i => { const a = getYearFromDate(formatSafeDate(i.fecha)); if(a !== 'N/A') añosSet.add(Number(a)); });
    const availableYears = Array.from(añosSet).sort().reverse();
    const allMonths = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <div className="bg-white px-4 py-1.5 rounded-full border border-slate-200 flex items-center shadow-sm space-x-4">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">PERIODO:</span>
            
            {/* DROPDOWN AÑOS MULTIPLE */}
            <div className="relative group">
              <button className="text-xs font-bold bg-transparent text-slate-700 outline-none flex items-center space-x-1 cursor-pointer">
                <span className="notranslate" translate="no">Años ({selectedAnios.length})</span> <span className="text-[8px]">▼</span>
              </button>
              <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl p-3 z-50 hidden group-hover:block min-w-[120px]">
                <div className="flex justify-between items-center mb-2 border-b pb-1">
                  <button onClick={() => setSelectedAnios(availableYears)} className="text-[9px] text-blue-600 font-bold hover:underline">Todos</button>
                  <button onClick={() => setSelectedAnios([])} className="text-[9px] text-red-600 font-bold hover:underline">Ninguno</button>
                </div>
                <div className="flex flex-col space-y-1">
                  {availableYears.map(a => (
                    <label key={`filter-year-${a}`} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input type="checkbox" checked={selectedAnios.includes(a)} onChange={() => toggleAnio(a)} className="rounded text-[#004d40] focus:ring-[#004d40]"/>
                      <span className="text-xs font-bold text-slate-700 notranslate" translate="no">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* DROPDOWN MESES MULTIPLE */}
            <div className="relative group">
              <button className="text-xs font-bold bg-transparent text-slate-700 outline-none flex items-center space-x-1 cursor-pointer">
                <span className="notranslate" translate="no">Meses ({selectedMeses.length})</span> <span className="text-[8px]">▼</span>
              </button>
              <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl p-3 z-50 hidden group-hover:block min-w-[140px] max-h-64 overflow-y-auto">
                <div className="flex justify-between items-center mb-2 border-b pb-1 sticky top-0 bg-white">
                  <button onClick={() => setSelectedMeses(allMonths)} className="text-[9px] text-blue-600 font-bold hover:underline">Todos</button>
                  <button onClick={() => setSelectedMeses([])} className="text-[9px] text-red-600 font-bold hover:underline">Ninguno</button>
                </div>
                <div className="flex flex-col space-y-1">
                  {allMonths.map(m => (
                    <label key={`filter-month-${m}`} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input type="checkbox" checked={selectedMeses.includes(m)} onChange={() => toggleMes(m)} className="rounded text-[#004d40] focus:ring-[#004d40]"/>
                      <span className="text-xs font-bold text-slate-700 notranslate" translate="no">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {includeMatrizToggle && (
            <div className="bg-white p-1 rounded-full border flex shadow-sm">
              <button onClick={() => {setTipoMatriz('inherente'); setFiltroHeatMap(null);}} className={`px-4 py-1 rounded-full font-bold text-[10px] uppercase transition-all ${tipoMatriz === 'inherente' ? 'bg-[#004d40] text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>INHERENTE</button>
              <button onClick={() => {setTipoMatriz('residual'); setFiltroHeatMap(null);}} className={`px-4 py-1 rounded-full font-bold text-[10px] uppercase transition-all ${tipoMatriz === 'residual' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}>RESIDUAL</button>
            </div>
          )}
        </div>
      </div>
    );
  };  
  // =====================================================================
  // RENDERS DE VISTAS (ADMIN INTERFACE)
  // =====================================================================

const renderInformesAuditoria = () => {
    const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
    
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="border-b pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-slate-800">📁 Repositorio de Informes Emitidos</h2>
            <p className="text-xs text-slate-500 font-bold mt-1">Archivo formal de dictámenes, consecutivos, actas de socialización y distribución electrónica.</p>
          </div>
          <div className="flex space-x-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
            </div>
            <button onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
          </div>
        </div>

        {isAdmin && (
          <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">{editInformeAuditoria ? `✏️ Editando Flujo de Informe: ${editInformeAuditoria.ref}` : '➕ Archivar, Radicar y Distribuir Nuevo Informe'}</h3>
            <form onSubmit={handleInformeAuditoriaSubmit} key={editInformeAuditoria?.id || 'nuevo-informe-form'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Título del Informe Formal</label><input name="titulo" defaultValue={editInformeAuditoria?.titulo||''} required placeholder="Ej: Auditoría de Cumplimiento a Cadena de Suministros" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold text-slate-800" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editInformeAuditoria?.proceso||''} required placeholder="Ej: Compras / Finanzas" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Fecha de Emisión</label><input name="fecha" type="date" defaultValue={editInformeAuditoria?.fecha||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              
              <div><label className="font-bold text-gray-600 block mb-1">✍️ Elaborado Por (Auditor)</label><input name="elaboradoPor" defaultValue={editInformeAuditoria?.elaboradoPor||''} required placeholder="Nombre del auditor" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">🔍 Revisado Por (Líder)</label><input name="revisadoPor" defaultValue={editInformeAuditoria?.revisadoPor||''} required placeholder="Nombre de quien revisó" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">🔒 Aprobado Por (Gerencia)</label><input name="aprobadoPor" defaultValue={editInformeAuditoria?.aprobadoPor||''} required placeholder="Nombre de quien aprobó" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">📢 ¿Fue Socializado?</label><select name="socializado" defaultValue={editInformeAuditoria?.socializado||'No'} className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#004d40] outline-none font-bold"><option>No</option><option>Sí</option></select></div>
              
              <div className="md:col-span-4"><label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Líderes y convocados)</label><input name="socializadoCon" defaultValue={editInformeAuditoria?.socializadoCon||''} placeholder="Ej: Comité de Auditoría, Gerencia General, Jefe de Compras..." className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>

              {/* 📬 CASILLA: PROTOCOLO DE DISTRIBUCIÓN DE CORREOS */}
<div className="md:col-span-4 bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-inner">
  <label className="font-black text-blue-900 block mb-1 uppercase tracking-wider text-[10px]">📧 Distribución por Correo Electrónico (Notificación Inmediata)</label>
  <input 
    name="correosNotificacionInput" // <--- ASEGÚRATE DE QUE ESTA LÍNEA ESTÉ EXACTAMENTE ASÍ
    type="text" 
    placeholder="Ej: gerente@termales.com.co, compras@termales.com.co (Separa los correos por comas)" 
    className="w-full border border-blue-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" 
  />
  <p className="text-[9px] text-blue-600 mt-1 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
</div>

              {/* REPOSITORIO DE CARGA DRIVE / ONEDRIVE AMPLIADO (INFORME + ACTA) */}
              <div className="md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex justify-between items-center border-b pb-2 border-slate-200">
                  <div>
                    <label className="font-black text-slate-700 uppercase tracking-widest text-[10px]">Gestor de Evidencias Digitales</label>
                    <p className="text-[9px] text-slate-500 font-medium">Sube los soportes a tu repositorio corporativo institucional y pega sus links públicos.</p>
                  </div>
                  <div className="flex space-x-2">
                    <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">📁 Drive</a>
                    <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg shadow-sm hover:bg-slate-50">☁ OneDrive</a>
                  </div>
                </div>
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[10px] block mb-1">📄 Link del Informe Final (PDF)</label>
                  <input type="url" name="evidenciaUrlInput" defaultValue={editInformeAuditoria?.evidenciaUrl||''} required placeholder="https://drive.google.com/..." className="w-full border border-slate-300 bg-white rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-[#004d40] outline-none" />
                </div>
                <div>
                  <label className="font-black text-purple-800 uppercase tracking-widest text-[10px] block mb-1">🤝 Link del Acta de Socialización</label>
                  <input type="url" name="actaSocializacionUrlInput" defaultValue={editInformeAuditoria?.actaSocializacionUrl||''} placeholder="https://drive.google.com/..." className="w-full border border-purple-300 bg-white rounded-lg p-2 text-xs shadow-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>

           <div className="md:col-span-4 flex justify-end">
                <button 
                  type="button" 
                  onClick={handleInformeAuditoriaSubmit} 
                  className="bg-[#004d40] hover:bg-[#003d33] text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center cursor-pointer block"
                >
                  {editInformeAuditoria ? 'Guardar Cambios' : 'Radicar, Archivar y Enviar Dictamen'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
              <tr>
                <th className="p-4 w-28">
                  <div>Consecutivo</div>
                  <FilterInput colKey="ref" placeholder="Filtrar..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>Proceso / Título</div>
                  <FilterInput colKey="proceso" placeholder="Filtrar Proceso..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">Trazabilidad de Firmas</th>
                <th className="p-4">Socialización e Impacto</th>
                <th className="p-4 text-center">Documentos Custodiados</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700 bg-white">
              {applyFilters(safeInformes, searchTerm, columnFilters).map((inf, idx) => (
                <tr key={`inf-row-${inf.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">{inf.ref || `INF-2026-${String(idx+1).padStart(3, '0')}`}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">{inf.proceso}</span>
                    <div className="font-bold text-slate-900 text-sm">{inf.titulo}</div>
                    <div className="text-[9px] text-slate-400 font-medium mt-1">Emitido el: {inf.fecha}</div>
                  </td>
                  <td className="p-4">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px] font-medium text-slate-600">
                      <div><span className="text-slate-400 font-bold">✍ ELABORÓ:</span> <span className="font-black text-slate-800">{inf.elaboradoPor}</span></div>
                      <div><span className="text-slate-400 font-bold">🔍 REVISÓ:</span> <span className="font-black text-slate-800">{inf.revisadoPor}</span></div>
                      <div><span className="text-slate-400 font-bold">🔒 APROBÓ:</span> <span className="font-black text-slate-800">{inf.aprobadoPor}</span></div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block mb-1.5 ${inf.socializado === 'Sí' ? 'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado}</span>
                    <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">Con: {inf.socializadoCon}</div>
                  </td>
                  <td className="p-4 text-center space-y-1.5">
                    <a href={inf.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-black px-3 py-1.5 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full">
                      <span>📄</span><span>Ver Informe Final</span>
                    </a>
                    {inf.actaSocializacionUrl ? (
                      <a href={inf.actaSocializacionUrl} target="_blank" rel="noreferrer" className="bg-purple-50 text-purple-700 font-black px-3 py-1.5 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full">
                        <span>🤝</span><span>Ver Acta Socialización</span>
                      </a>
                    ) : (
                      <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1 rounded border border-dashed text-center">Sin Acta Cargada</div>
                    )}
                    {isAdmin && (
                      <div className="flex justify-center items-center space-x-2 pt-1">
                        <button onClick={() => {setEditInformeAuditoria(inf); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏ Editar</button>
                        <span className="text-slate-200">|</span>
                        <button onClick={() => handleDeleteItem('informesAuditoria', inf.id)} className="text-slate-400 hover:text-red-600 text-xs font-bold">🗑 Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

const renderConfiguracion = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-black text-slate-800">⚙️ Configuración y Cargas Masivas</h2>
        <p className="text-xs text-slate-500 font-bold mt-1">Gestión avanzada de la base de datos y copias de seguridad.</p>
      </div>

      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200">
        <div className="flex justify-between items-center">
           <div>
              <h3 className="font-black text-amber-900 uppercase tracking-widest text-sm mb-1">🚀 Forzar Actualización de Cronograma (NUEVO)</h3>
              <p className="text-xs text-amber-700 max-w-2xl">Utiliza este botón para borrar el cronograma de prueba antiguo de tu base de datos y cargar automáticamente los <b>procesos auditables</b> oficiales de Termales Santa Rosa.</p>
           </div>
           <button onClick={forceUpdateCronograma} className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all">
             Cargar Procesos
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* NUEVO BOTON PARA IMPORTAR MATRIZ RIESGOS DESDE EXCEL */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600">
          <h3 className="font-black text-emerald-700 uppercase tracking-widest text-sm mb-4">📊 Cargar Matriz de Riesgos (Excel)</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo .xlsx para actualizar masivamente <b>solo la Matriz de Riesgos</b>. Asegúrate de usar la plantilla descargada previamente.</p>
          
          <label className="block w-full cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-emerald-200 transition-all">
            Seleccionar Archivo Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcelRiesgos} />
          </label>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm mb-4">📥 Exportar Backup (Descarga)</h3>
          <p className="text-xs text-slate-600 mb-6">Descarga una copia completa de toda tu base de datos actual en formato JSON. Útil para tener respaldos de seguridad o para editar los datos masivamente en un editor de texto o Excel.</p>
          <button onClick={exportToJSON} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-md transition-all">
            Descargar Base de Datos (.JSON)
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-red-600">
          <h3 className="font-black text-red-600 uppercase tracking-widest text-sm mb-4">📤 Carga Masiva Completa DB</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo JSON con la estructura correcta para actualizar masivamente. <b>ADVERTENCIA:</b> Esta acción borrará todos los datos actuales de todos los módulos.</p>
          
          <label className="block w-full cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-red-200 transition-all">
            Seleccionar Archivo JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>
        </div>
      </div>
      
      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200">
        <h3 className="font-black text-blue-800 uppercase tracking-widest text-sm mb-2">💡 ¿Cómo hacer una carga masiva desde Excel?</h3>
        <ol className="list-decimal pl-5 text-xs text-blue-900 space-y-2 mt-4 font-medium">
          <li>Ve a la pestaña <b>Matriz de Riesgos</b> y presiona el botón de <b>Exportar</b> para obtener la estructura actual en Excel.</li>
          <li>Abre el Excel y agrega tus cientos de filas nuevas en el Excel asegurándote de no cambiar los nombres de las columnas (ej. <i>id, proceso, sede</i>).</li>
          <li>Ve a esta pestaña de Configuración y usa el botón verde <b>Cargar Matriz de Riesgos (Excel)</b> para subir el archivo actualizado.</li>
        </ol>
      </div>
    </div>
  );

  const renderTablero = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderHeaderFiltros("Tablero Analítico de Auditoría", "Análisis integral de desviaciones operativas.")}
        
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">INDICADORES KRI EN TIEMPO REAL</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Gauge value={avanceGlobal} label="MITIGACIÓN GLOBAL" sublabel="Promedio Planes de Acción" colorClass="text-blue-500" />
          <Gauge value={rendimientoControles} label="CONTROLES DE SALUD" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
          <div className="bg-[#0f172a] text-white p-6 rounded-2xl flex flex-col justify-center text-center shadow-lg border border-slate-800">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">ALERTA CRÍTICA</span>
            <span className="text-6xl font-black mt-4 notranslate" translate="no">{hAbiertos}</span>
            <p className="text-xs font-bold text-slate-300 mt-4">Hallazgos Pendientes de Cierre</p>
          </div>
        </div>

        <div className="space-y-4 mt-8">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">DESEMPEÑO POR UNIDAD DE NEGOCIO</h3>
          
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-xl font-black text-slate-800 mb-6 border-b pb-2">Hotel</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow cursor-pointer">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">HALLAZGOS ABIERTOS</span>
                <span className="text-5xl font-black mt-4 text-slate-800 notranslate" translate="no">{hFiltrados.filter(h => h.sede === 'Hotel' && h.estado === 'Abierto').length}</span>
                <p className="text-[10px] font-bold mt-4 opacity-60 text-slate-500">Pendientes de Cierre</p>
              </div>
              <Gauge value={rendimientoControles} label="SALUD DE CONTROLES" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
              <Gauge value={avanceGlobal} label="PLANES DE ACCIÓN" sublabel="Promedio de Avance Físico" colorClass="text-blue-500" />
            </div>
          </div>
        </div>
      </div>
    );
  };

    const renderDashboardRiesgos = () => {
    const esRes = tipoMatriz === 'residual';
    const totalRiesgos = rFiltrados.length;
    const riesgosCriticos = rFiltrados.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
    const riesgosFueraApetito = rFiltrados.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).apetito === "Fuera de Apetito").length;
    const totalPerdidas = incFiltrados.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);

    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];

    const contarCelda = (imp, prob) => rFiltrados.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;

    const mesesCompletos = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mesesGrafica = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const dataIncidentes = mesesCompletos.map((mesTexto, idx) => {
      const itemsMes = incFiltrados.filter(i => getItemMesText(i) === mesTexto);
      const valorMes = itemsMes.reduce((acc, val) => acc + (Number(val.costo) || 0), 0);
      return { mes: mesesGrafica[idx], mesCompleto: mesTexto, valor: valorMes, items: itemsMes, tipo: 'Incidentes Financiados' };
    });

    const dataHallazgos = mesesCompletos.map((mesTexto, idx) => {
      const itemsMes = hFiltrados.filter(h => getItemMesText(h) === mesTexto);
      const valorMes = itemsMes.length;
      return { mes: mesesGrafica[idx], mesCompleto: mesTexto, valor: valorMes, items: itemsMes, tipo: 'Hallazgos Detectados' };
    });

    const chartTitleLabel = selectedAnios.length === 0 ? 'TODOS LOS AÑOS' : selectedAnios.length <= 2 ? selectedAnios.join(' y ') : `${selectedAnios.length} AÑOS`;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderHeaderFiltros("Panel de inteligencia GRC", "Análisis predictivo de apetito ISO 31000 y Evolución de KRI.", true)}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TrendChart data={dataIncidentes} title={`EVOLUCIÓN DE IMPACTO FINANCIERO (${chartTitleLabel})`} isCurrency={true} color="#ef4444" fillColor="#fef2f2" onPointClick={setChartDetail} />
          <TrendChart data={dataHallazgos} title={`VOLUMEN DE DESVIACIONES (${chartTitleLabel})`} isCurrency={false} color="#3b82f6" fillColor="#eff6ff" onPointClick={setChartDetail} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-blue-500">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">RIESGOS TOTALES</h4>
             <span className="text-4xl font-black mt-2 block text-slate-800 notranslate" translate="no">{totalRiesgos}</span>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-red-600">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FUERA DE APETITO</h4>
             <span className="text-4xl font-black mt-2 block text-red-600 notranslate" translate="no">{riesgosFueraApetito}</span>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-orange-500">
             <h4 className="text-xl font-black text-slate-500 uppercase tracking-widest">RIESGOS CRÍTICOS</h4>
             <span className="text-4xl font-black mt-2 block text-orange-500 notranslate" translate="no">{riesgosCriticos}</span>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-l-8 border-l-purple-600">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">PÉRDIDAS TOTALES</h4>
             <span className="text-3xl font-black mt-2 block text-purple-700 notranslate" translate="no">$ {(totalPerdidas).toLocaleString('es-CO')}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col items-center relative">
          <h3 className="font-black text-slate-600 text-xs uppercase tracking-widest mb-8 w-full flex items-center space-x-3">
            <span>🗺️ MAPA DE CALOR EMPRESARIAL (HAZ CLIC EN UN CUADRANTE CON NÚMEROS)</span>
            <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-[9px] font-bold tracking-widest">{tipoMatriz}</span>
          </h3>
          
          <div className="flex flex-col items-center justify-center w-full">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 w-full max-w-3xl relative pb-4">
              <div className="absolute -left-16 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-black text-slate-400 uppercase tracking-widest">IMPACTO</div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">PROBABILIDAD</div>
              <div></div>
              {probabilidades.map(p => <div key={`prob-${p}`} className="text-center text-[10px] font-black uppercase text-slate-500 bg-slate-50 py-2 rounded-t-lg border-b border-slate-200">{p}</div>)}
              {impactos.map(imp => (
                <React.Fragment key={`imp-${imp}`}>
                  <div className="text-right pr-4 py-6 flex items-center justify-end text-[10px] font-black uppercase text-slate-500 bg-slate-50 rounded-l-lg">{imp}</div>
                  {probabilidades.map(prob => {
                    const count = contarCelda(imp, prob);
                    const { score, color, borderSemaforo } = calcularMatriz5x5(prob, imp);
                    const isSelected = filtroHeatMap?.impacto === imp && filtroHeatMap?.probabilidad === prob;
                    
                    return (
                      <div key={`cell-${imp}-${prob}`} onClick={() => { 
                        if (count > 0) {
                          setFiltroHeatMap({ impacto: imp, probabilidad: prob, count }); 
                          setTimeout(() => { document.getElementById('detalle-heatmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
                        }
                      }}
                        className={`relative border-2 p-6 flex flex-col justify-center items-center h-28 rounded-2xl transition-all duration-200 ${count > 0 ? 'cursor-pointer hover:scale-105 shadow-md opacity-100' : 'opacity-20 cursor-not-allowed'} ${color} ${isSelected ? 'ring-4 ring-slate-900 scale-105 shadow-xl bg-opacity-100 border-black' : borderSemaforo}`}>
                        <span className="absolute top-2 right-3 text-[9px] font-mono font-black opacity-50 text-slate-900 notranslate" translate="no">S: {score}</span>
                        <span className={`text-4xl font-black text-slate-900 drop-shadow-sm notranslate`} translate="no">{count}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* DETALLE DEL HEATMAP */}
          {filtroHeatMap && (
            <div id="detalle-heatmap" className="mt-8 w-full bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4 p-4 border-b bg-slate-50 rounded-t-xl">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">🔎 Detalle de Riesgos en Cuadrante: {filtroHeatMap.probabilidad} / {filtroHeatMap.impacto}</h4>
                <button onClick={() => setFiltroHeatMap(null)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors">✖ Limpiar Filtro</button>
              </div>
              <div className="overflow-x-auto p-4 pt-0">
                <table className="w-full text-xs text-left divide-y border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-3">Identificación</th>
                      <th className="p-3">Proceso</th>
                      <th className="p-3 w-1/2">Descripción</th>
                      <th className="p-3">Responsable</th>
                      <th className="p-3 text-center">Estrategia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 bg-white">
                    {rFiltrados.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === filtroHeatMap.impacto && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === filtroHeatMap.probabilidad).map((r, index) => {
                       const matrizData = calcularMatriz5x5(esRes ? r.probabilidadResidual : r.probabilidadInherente, esRes ? r.impactoResidual : r.impactoInherente);
                       return (
                        <tr key={`filtered-${r.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">#{r.id}</td>
                          <td className="p-3">
                            <span className="font-black text-slate-900 block">{r.proceso}</span>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">{r.sede || 'Hotel'}</span>
                          </td>
                          <td className="p-3 font-medium">{r.descripcion}</td>
                          <td className="p-3">{r.responsable || 'No Asignado'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-3 py-1.5 rounded text-[9px] uppercase font-black shadow-sm block w-full truncate ${matrizData.color}`}>
                              {matrizData.accion}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  const renderPlanAnual = () => {
    const allMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // ORDEN CRONOLÓGICO: Enero a Diciembre según el array de meses (USANDO cFiltrados)
    const cronogramaOrdenado = [...cFiltrados].sort((a, b) => {
        const getMinIdx = (arr) => {
            if (!arr || !Array.isArray(arr) || arr.length === 0) return 99;
            const indices = arr.map(m => allMonths.indexOf(m)).filter(i => i >= 0);
            return indices.length ? Math.min(...indices) : 99;
        };
        const minA = getMinIdx(a.meses);
        const minB = getMinIdx(b.meses);
        if (minA !== minB) return minA - minB;
        return (a.codigo || '').localeCompare(b.codigo || '');
    });

    const procesosActivos = cronogramaOrdenado.filter(c => c.cumplimiento > 0);
    const avgCumplimiento = procesosActivos.length > 0 
      ? Math.round(procesosActivos.reduce((acc, c) => acc + c.cumplimiento, 0) / procesosActivos.length)
      : (cronogramaOrdenado.length > 0 ? Math.round(cronogramaOrdenado.reduce((acc, c) => acc + c.cumplimiento, 0) / cronogramaOrdenado.length) : 0);

    const labelAnio = selectedAnios.length === 0 ? 'HISTÓRICO MULTIANUAL' : selectedAnios.join(' - ');

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        
        {/* FILTROS GLOBALES DEL MÓDULO AÑADIDOS */}
        {renderHeaderFiltros("Gestión de Auditoría", "Filtra el cronograma y los procesos por periodo.")}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-[#004d40] text-white p-6 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.4) 0%, transparent 20%)', backgroundSize: '100px 100px' }}></div>
            <div className="relative z-10 flex items-center space-x-4">
               <div className="bg-white text-[#004d40] h-12 w-12 rounded-full flex items-center justify-center font-black text-xl shadow-lg">T</div>
               <h2 className="text-2xl font-black tracking-widest uppercase">Plan Anual de Auditoría {labelAnio}</h2>
            </div>
            <div className="relative z-10 mt-4 md:mt-0 bg-[#00695c] px-6 py-2 rounded-full border border-[#00897b] flex items-center space-x-3 shadow-inner">
               <span className="text-2xl">🎖️</span>
               <div>
                  <div className="text-xl font-black notranslate" translate="no">{avgCumplimiento}%</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold opacity-80">% Cumplimiento Global</div>
               </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="md:col-span-1 space-y-6">
                <div className="border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                   <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Índice General</h3>
                   <div className="text-6xl font-black text-[#004d40] leading-none mb-2 notranslate" translate="no">{avgCumplimiento}%</div>
                   <div className="text-xs font-bold text-emerald-600 flex items-center justify-center space-x-1"><span>▲</span><span>Meta Alcanzada</span></div>
                   <p className="text-[10px] text-slate-500 mt-4 leading-relaxed font-medium">Evaluación integral de procesos administrativos, operativos y de soporte.</p>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                   <div className="bg-[#004d40] text-white p-3 flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase tracking-widest flex items-center space-x-2"><span>📈</span> <span>Gestor de KRIs</span></span>
                     {isAdmin && <button onClick={() => {setEditMonitoreo({}); scrollToForm();}} className="text-xs bg-white text-[#004d40] px-2 py-0.5 rounded font-bold hover:bg-slate-200 transition-colors">➕</button>}
                   </div>
                   <div className="divide-y divide-slate-100 p-2">
                     {editMonitoreo && isAdmin && (
                       <form onSubmit={handleMonitoreoSubmit} key={editMonitoreo?.id ? `edit-monitoreo-${editMonitoreo.id}-${formResetKey}` : `new-monitoreo-${formResetKey}`} className="p-3 bg-slate-50 rounded-lg mb-2 border border-slate-200 shadow-inner">
                         <input name="indicador" defaultValue={editMonitoreo.indicador||''} placeholder="Nombre KRI..." required className="w-full text-xs p-1.5 mb-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                         <input name="proceso" defaultValue={editMonitoreo.proceso||''} placeholder="Proceso..." required className="w-full text-xs p-1.5 mb-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                         <div className="flex space-x-2 mb-2">
                           <input name="valor" type="number" defaultValue={editMonitoreo.valor||''} placeholder="Valor actual" required className="w-1/2 text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                           <input name="limite" type="number" defaultValue={editMonitoreo.limite||''} placeholder="Límite rojo" required className="w-1/2 text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none" />
                         </div>
                         <select name="tendencia" defaultValue={editMonitoreo.tendencia||'flat'} className="w-full text-xs p-1.5 mb-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#004d40] outline-none">
                           <option value="up">Tendencia al Alza</option>
                           <option value="down">Tendencia a la Baja</option>
                           <option value="flat">Estable</option>
                         </select>
                         <div className="flex justify-between items-center mt-1">
                           <button type="button" onClick={() => setEditMonitoreo(null)} className="text-[10px] text-red-500 hover:text-red-700 font-bold px-2">Cancelar</button>
                           <button type="submit" className="text-[10px] bg-[#004d40] text-white px-3 py-1.5 rounded shadow-sm hover:bg-[#00695c] font-bold">{editMonitoreo.id ? 'Actualizar' : 'Guardar'}</button>
                         </div>
                       </form>
                     )}
                     
                     {safeMonitoreo.map((m, index) => (
                       <div key={`moni-${m.id}-${index}`} className="flex flex-col p-3 hover:bg-slate-50 transition-colors group rounded-lg border border-transparent hover:border-slate-200">
                         <div className="flex justify-between items-center">
                           <span className="text-[10px] font-bold text-slate-800 truncate" title={m.indicador}>{m.indicador}</span>
                           {isAdmin && (
                             <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5">
                               <button onClick={() => {setEditMonitoreo(m); setFormResetKey(Date.now()); scrollToForm();}} className="text-blue-500 hover:text-blue-700 text-xs transition-colors" title="Editar">✏️</button>
                               <button onClick={() => handleDeleteItem('monitoreo', m.id)} className="text-red-500 hover:text-red-700 text-xs transition-colors" title="Eliminar">✖</button>
                             </div>
                           )}
                         </div>
                         <div className="flex justify-between items-center mt-1">
                           <span className="text-[9px] text-slate-400">{m.proceso}</span>
                           <span className={`text-xs font-black ${m.valor > (m.limite || 0) ? 'text-red-600' : 'text-emerald-600'} notranslate`} translate="no">{m.valor} {m.limite ? <span className="text-[8px] text-slate-400 font-medium">/ {m.limite}</span> : null}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>

             <div className="md:col-span-3">
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                   <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center">
                     <span className="text-xs font-black uppercase tracking-widest flex items-center space-x-2"><span>📋</span> <span>Cronograma Técnico</span></span>
                     <span className="text-[10px] font-bold text-emerald-400 border border-emerald-400 px-2 py-1 rounded-full uppercase notranslate" translate="no">⚙️ {avgCumplimiento}% Auditado</span>
                   </div>
                   <div className="overflow-x-auto flex-1 p-2">
                     <table className="w-full text-xs text-left divide-y divide-slate-100">
                       <thead className="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                         <tr>
                           <th className="p-3">
                             <div>Identificación</div>
                             <FilterInput colKey="codigo" placeholder="ID..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3 w-24">
                             <div>Año / Periodo</div>
                             <FilterInput colKey="periodo" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3 w-48">
                             <div>Área / Proceso</div>
                             <FilterInput colKey="proceso" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3">
                             <div>Enfoque Técnico y Alcance</div>
                             <FilterInput colKey="enfoque" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3 text-center">% Acumulado.</th>
                           {isAdmin && <th className="p-3 text-center">Acción</th>}
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {applyFilters(cronogramaOrdenado, searchTerm, columnFilters).map((c, index) => (
                           <tr key={`crono-${c.id}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                             <td className="p-3 text-slate-400 font-mono">0{c.codigo}</td>
                             <td className="p-3 font-medium text-slate-600"><span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black mr-1">{c.anio || new Date().getFullYear()}</span>{c.periodo}</td>
                             <td className="p-3 font-black text-slate-800">{c.proceso}</td>
                             <td className="p-3 text-[10px] text-slate-500 leading-relaxed">{c.enfoque}</td>
                             <td className="p-3 text-center font-black text-sm notranslate" translate="no" style={{ color: c.cumplimiento === 100 ? '#059669' : c.cumplimiento >= 50 ? '#d97706' : '#dc2626' }}>{c.cumplimiento}%</td>
                             {isAdmin && (
                               <td className="p-3 text-center whitespace-nowrap">
                                 <button onClick={() => {setEditCronograma(c); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 mx-1 text-sm">✏️</button>
                                 <button onClick={() => handleDeleteItem('cronograma', c.id)} className="text-slate-400 hover:text-red-700 mx-1 text-sm">🗑️</button>
                               </td>
                             )}
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {isAdmin && (
          <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editCronograma ? '✏️ Editando Proceso del Plan' : '➕ Agregar Proceso al Cronograma'}</h3>
              {editCronograma && <button onClick={() => setEditCronograma(null)} className="text-xs text-red-500 font-bold hover:text-red-700">✖ Cancelar</button>}
            </div>
            <form onSubmit={handleCronogramaSubmit} key={editCronograma ? `edit-crono-${editCronograma.id}-${formResetKey}` : `new-crono-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
              <div><label className="font-bold text-gray-600 block mb-1">Identificación</label><input name="codigo" defaultValue={editCronograma?.codigo||''} required placeholder="Ej: 05" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Año</label><input type="number" name="anio" defaultValue={editCronograma?.anio||new Date().getFullYear()} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-black text-slate-800 bg-slate-50" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Periodo Texto</label><input name="periodo" defaultValue={editCronograma?.periodo||''} required placeholder="Ej: Enero - Abril" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Área / Proceso</label><input name="proceso" defaultValue={editCronograma?.proceso||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-bold text-slate-800" /></div>
              
              <div><label className="font-bold text-gray-600 block mb-1">Responsable</label><input name="responsable" defaultValue={editCronograma?.responsable||''} required className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Apoyo (Opcional)</label><input name="apoyo" defaultValue={editCronograma?.apoyo||''} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none" /></div>
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">% Acumulado (0-100)</label><input type="number" min="0" max="100" name="cumplimiento" defaultValue={editCronograma?.cumplimiento||0} required className="w-full border border-emerald-300 bg-emerald-50 rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none font-black text-emerald-700" /></div>
              
              <div className="md:col-span-5"><label className="font-bold text-gray-600 block mb-1">Enfoque Técnico y Alcance</label><textarea name="enfoque" defaultValue={editCronograma?.enfoque||''} required rows="2" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#004d40] outline-none"></textarea></div>
              
              <div className="md:col-span-5">
                <label className="font-bold text-gray-600 block mb-2">Meses Planeados (Para gráfico de Gantt)</label>
                <div className="grid grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {allMonths.map(mes => (
                    <label key={`gantt-label-${mes}`} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors">
                      <input type="checkbox" name={`mes_${mes}`} defaultChecked={editCronograma?.meses?.includes(mes)} className="rounded text-[#004d40] focus:ring-[#004d40]" />
                      <span className="text-[10px] font-bold uppercase notranslate" translate="no">{mes.substring(0,3)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-5 flex justify-end mt-2"><button type="submit" className="bg-[#004d40] hover:bg-[#00695c] text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all transform hover:scale-105">{editCronograma ? 'Actualizar Plan' : 'Guardar en Plan'}</button></div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-8">
           <div className="bg-slate-100 border-b border-slate-200 p-4 flex justify-between items-center">
             <h3 className="text-[#004d40] font-black text-xl uppercase tracking-wider text-center flex-1">GANTT CONTROL INTERNO (ORDEN CRONOLÓGICO)</h3>
             <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
             </div>
           </div>
           <div className="overflow-x-auto p-4">
             <table className="w-full text-[10px] text-left border-collapse border border-slate-300">
               <thead className="bg-slate-200 text-slate-700 font-bold uppercase">
                 <tr>
                   <th className="border border-slate-300 p-2 w-10 text-center">
                     <div>Cód</div>
                     <FilterInput colKey="codigo" placeholder="ID..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                   </th>
                   <th className="border border-slate-300 p-2 w-48">
                     <div>Proceso Auditable</div>
                     <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                   </th>
                   <th className="border border-slate-300 p-2 w-32">
                     <div>Responsable</div>
                     <FilterInput colKey="responsable" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                   </th>
                   {allMonths.map(m => <th key={`gantt-col-${m}`} className="border border-slate-300 p-2 text-center w-16 notranslate" translate="no">{m.substring(0,3)}</th>)}
                   {isAdmin && <th className="border border-slate-300 p-2 text-center w-16 notranslate" translate="no">ACCIÓN</th>}
                 </tr>
               </thead>
               <tbody>
                 {applyFilters(cronogramaOrdenado, searchTerm, columnFilters).map((c, index) => (
                   <tr key={`gantt-table-${c.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                     <td className="border border-slate-300 p-2 text-center text-slate-500 font-mono">{c.codigo}</td>
                     <td className="border border-slate-300 p-2 font-black text-slate-800"><span className="bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-bold mr-1 text-[8px]">{c.anio || new Date().getFullYear()}</span>{c.proceso}</td>
                     <td className="border border-slate-300 p-2 text-slate-600 font-medium">{c.responsable}</td>
                     {allMonths.map(mes => {
                       const isPlanned = c.meses?.includes(mes);
                       let bgColor = 'bg-transparent';
                       let textLabel = '';
                       
                       if (isPlanned) {
                           if (c.cumplimiento === 100) {
                               bgColor = 'bg-emerald-500';
                               textLabel = 'Completado';
                           } else if (c.cumplimiento > 0) {
                               bgColor = 'bg-amber-500';
                               textLabel = `${c.cumplimiento}%`;
                           } else {
                               bgColor = 'bg-[#00695c]';
                               textLabel = 'Planeado';
                           }
                       }

                       return (
                         <td key={`gantt-cell-${c.id}-${mes}`} className={`border border-slate-300 text-center p-0`}>
                           {isPlanned && <div className={`${bgColor} text-white w-full h-full py-2 font-bold uppercase text-[8px] tracking-widest shadow-inner notranslate`} translate="no">{textLabel}</div>}
                         </td>
                       );
                     })}
                     {isAdmin && (
                       <td className="border border-slate-300 p-2 text-center bg-slate-50">
                         <button onClick={() => {setEditCronograma(c); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 bg-white border border-orange-200 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition-colors">✏️ Modificar</button>
                       </td>
                     )}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  };
  const renderRiesgos = () => {
    const rData = rFiltrados.map(r => {
      const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
      const inh = calcularMatriz5x5(r.probabilidadInherente, r.impactoInherente);
      return { ...r, scoreInhVal: inh.score, scoreResVal: res.score, apetitoVal: res.apetito, accionVal: res.accion, colorVal: res.color };
    });

    return (
      <div className="space-y-6">
        <div className="border-b pb-4 flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800">Estructura de Riesgos</h2>
          <div className="flex space-x-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#004d40] w-64 shadow-sm" />
            </div>
            <button onClick={() => exportToExcel(safeRiesgos, 'Matriz_Riesgos')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar</button>
          </div>
        </div>
        {isAdmin && (
          <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">{editRiesgo ? `✏️ Editando Riesgo #${editRiesgo.id}` : '➕ Registrar Nuevo Riesgo'}</h3>
            <form onSubmit={handleRiesgoSubmit} key={editRiesgo?.id || 'nuevo-riesgo'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              
              <div><label className="font-bold text-gray-600">Sede</label><select name="sede" defaultValue={editRiesgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
              
              <div><label className="font-bold text-gray-600">Proceso</label><input name="proceso" defaultValue={editRiesgo?.proceso||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
              <div><label className="font-bold text-gray-600">Categoría</label><select name="categoria" defaultValue={editRiesgo?.categoria||'Operativo'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Operativo</option><option>Estratégico</option><option>Tecnológico</option></select></div>
              <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editRiesgo?.responsable||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
              
              <div className="md:col-span-2">
  <label className="font-bold text-gray-600 block">Control Clave</label>
  <input name="control" defaultValue={editRiesgo?.descripcionControl||''} required className="w-full border rounded-lg p-2 mt-1" />
</div>
              <div className="md:col-span-2">
                <label className="font-bold text-purple-700">Normativa / Ley Aplicable</label>
                <input name="normativa" defaultValue={editRiesgo?.normativa||'Ninguna'} placeholder="Ej: Ley 1581, ISO 31000..." required className="w-full border border-purple-300 bg-purple-50 rounded-lg p-2 mt-1" />
              </div>

              <div className="md:col-span-4">
                <label className="font-bold text-gray-600">Descripción Evento</label>
                <input name="descripcion" defaultValue={editRiesgo?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1" />
              </div>
              
              <div><label className="font-bold text-gray-600">Prob. Inherente</label><select name="probInh" defaultValue={editRiesgo?.probabilidadInherente||'Posible'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="Rara">Rara</option><option value="Posible">Posible</option><option value="Frecuente">Frecuente</option></select></div>
              <div><label className="font-bold text-gray-600">Imp. Inherente</label><select name="impInh" defaultValue={editRiesgo?.impactoInherente||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="Bajo">Bajo</option><option value="Medio">Medio</option><option value="Alto">Alto</option><option value="Crítico">Crítico</option></select></div>
              <div><label className="font-bold text-gray-600">Prob. Residual</label><select name="probRes" defaultValue={editRiesgo?.probabilidadResidual||'Posible'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="Rara">Rara</option><option value="Posible">Posible</option><option value="Frecuente">Frecuente</option></select></div>
              <div><label className="font-bold text-gray-600">Imp. Residual</label><select name="impRes" defaultValue={editRiesgo?.impactoResidual||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="Bajo">Bajo</option><option value="Medio">Medio</option><option value="Alto">Alto</option><option value="Crítico">Crítico</option></select></div>
              
              <div className="md:col-span-4 flex justify-end space-x-2">
                <button type="submit" className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow-md">Guardar</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
              <tr>
                <th className="p-3">ID <FilterInput colKey="id" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Proceso / Ley <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Escenario de Riesgo <FilterInput colKey="descripcion" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Control Mitigante <FilterInput colKey="descripcionControl" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Apetito COSO <FilterInput colKey="apetitoVal" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {applyFilters(rData, searchTerm, columnFilters).map((r, index) => (
                <tr key={`riesgo-${r.id}-${index}`} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-400">#{r.id}</td>
                  <td className="p-3">
                    <span className="font-black text-slate-900 block">{r.proceso}</span>
                    <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded tracking-wider mt-0.5 inline-block uppercase">⚖️ {r.normativa || 'Compliance'}</span>
                  </td>
                  <td className="p-3 max-w-xs">{r.descripcion}</td>
                  <td className="p-3 italic max-w-xs">⚙️ {r.descripcionControl}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px]">{r.apetitoVal}</span></td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {isAdmin && <button onClick={() => {setEditRiesgo(r); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 hover:text-orange-700 mx-1">✏️</button>}
                    {isAdmin && <button onClick={() => handleDeleteItem('riesgos', r.id)} className="text-slate-400 hover:text-red-700 mx-1">🗑️</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

const renderApetito = () => {
    const configurados = rFiltrados.filter(r => r.capacidadRiesgo).length;
    
    const enTolerancia = rFiltrados.filter(r => {
      const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      return r.capacidadRiesgo && costoTotal > r.apetitoFinanciero && costoTotal <= r.toleranciaFinanciera;
    }).length;

    const capacidadExcedida = rFiltrados.filter(r => {
      const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      return r.capacidadRiesgo && costoTotal > r.capacidadRiesgo;
    }).length;

    const apetitoData = rFiltrados.map(r => {
      const resScore = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score;
      const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      const estaConfigurado = r.posturaEstrategica && r.capacidadRiesgo;
      
      let zona = "Sin parametrizar";
      let zonaColor = "bg-slate-100 text-slate-500 border-slate-200";
      let consumoPorcentaje = 0;

      if (estaConfigurado) {
        consumoPorcentaje = r.capacidadRiesgo ? Math.min((costoTotal / r.capacidadRiesgo) * 100, 100) : 0;
        if (costoTotal <= r.apetitoFinanciero) { 
          zona = "Confort (Apetito)"; 
          zonaColor = "bg-emerald-50 text-emerald-700 border-emerald-200"; 
        } else if (costoTotal <= r.toleranciaFinanciera) { 
          zona = "Alerta (Tolerancia)"; 
          zonaColor = "bg-yellow-50 text-yellow-700 border-yellow-300"; 
        } else if (costoTotal <= r.capacidadRiesgo) { 
          zona = "Peligro (Brecha)"; 
          zonaColor = "bg-orange-50 text-orange-700 border-orange-300"; 
        } else { 
          zona = "Crítico (Cap. Excedida)"; 
          zonaColor = "bg-red-50 text-red-700 border-red-300"; 
        }
      }

      return { ...r, resScoreVal: resScore, costoTotalVal: costoTotal, estaConfiguradoVal: estaConfigurado, zonaVal: zona, zonaColorVal: zonaColor, consumoPorcentajeVal: consumoPorcentaje };
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderHeaderFiltros("⚖️ Apetito y Perfil de Riesgo (COSO ERM)", "Parametrización multinivel: Apetito, Tolerancia y Capacidad Financiera Máxima.")}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-8 border-l-blue-500">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modelos Parametrizados</h4>
             <span className="text-4xl font-black mt-2 block text-slate-800 notranslate" translate="no">{configurados} <span className="text-xl text-slate-400">/ {rFiltrados.length}</span></span>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-l-8 border-l-yellow-400">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">En Zona de Alerta (Tolerancia)</h4>
             <span className="text-4xl font-black mt-2 block text-yellow-500 notranslate" translate="no">{enTolerancia}</span>
          </div>
          <div className="bg-[#0f172a] p-6 rounded-2xl shadow-md border border-slate-800 border-l-8 border-l-red-600 text-white">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capacidad Excedida (Ruptura)</h4>
             <span className="text-4xl font-black mt-2 block text-red-500 notranslate" translate="no">{capacidadExcedida}</span>
          </div>
        </div>

        {editApetito && (
          <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white animate-in fade-in slide-in-from-top-4 space-y-6 relative z-10 overflow-visible">
            <div className="flex justify-between items-center border-b border-blue-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">⚙️ Arquitectura COSO ERM</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Riesgo: [{editApetito.sede}] {editApetito.proceso}</p>
              </div>
              <button onClick={() => setEditApetito(null)} className="text-xs text-slate-500 hover:text-red-600 bg-white border border-slate-200 px-3 py-1 rounded-lg font-bold transition-colors">✖ Cerrar Panel</button>
            </div>
            
            <form onSubmit={handleApetitoSubmit} key={editApetito?.id || 'nuevo-apetito'} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. LÍMITES OPERATIVOS */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2">1. Límites Base (KRI)</h4>
                  
                  <div className={`mb-1 flex items-center w-max relative ${activeTooltip === 'postura' ? 'z-[100]' : 'z-10'}`}>
                    <label className="font-bold text-gray-700">Postura Estratégica</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'postura' ? null : 'postura')} className="ml-1.5 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                    {activeTooltip === 'postura' && (
                      <div className="absolute top-full left-0 mt-3 w-[450px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-blue-400 uppercase tracking-widest text-[9px]">Ayuda: Postura Estratégica</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3">
                          <b className="text-blue-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                          Define la "personalidad" o la actitud que la gerencia decide tomar frente a este riesgo específico. No todos los riesgos se tratan igual.
                        </div>
                        <div className="mb-3">
                          <b className="text-blue-300 text-xs block mb-1">Opciones y Ejemplos de diligenciamiento:</b>
                          <ul className="list-disc pl-4 space-y-1.5">
                            <li><b>Averso (Cero tolerancia):</b> No aceptamos este riesgo bajo ninguna circunstancia. <i>Ejemplo: Riesgos de seguridad humana. Si hay riesgo de que un empleado se accidente en el Ecoparque, somos aversos.</i></li>
                            <li><b>Cauto (Preferencia segura):</b> Aceptamos un riesgo mínimo, preferimos ir a lo seguro. <i>Ejemplo: Contratar proveedores de alimentos. Preferimos proveedores certificados.</i></li>
                            <li><b>Flexible (Equilibrio):</b> Tomamos riesgos calculados si el beneficio vale la pena. <i>Ejemplo: Probar un nuevo software de reservas.</i></li>
                            <li><b>Buscador (Amante del riesgo):</b> Buscamos activamente este riesgo porque trae grandes ganancias. <i>Ejemplo: Lanzar una campaña de marketing disruptiva.</i></li>
                          </ul>
                        </div>
                        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                          <b className="text-blue-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                          Le indica al auditor interno qué tan estricto debe ser. Si eres "Averso", el auditor exigirá controles extremos. Si eres "Buscador", el auditor será más permisivo.
                        </div>
                      </div>
                    )}
                  </div>
                  <select name="posturaEstrategica" defaultValue={editApetito.posturaEstrategica || 'Cauto'} className="w-full border border-slate-300 rounded-lg p-2 mb-4 bg-white shadow-sm relative z-0">
                    <option value="Averso">Averso (Evitar riesgo a toda costa)</option>
                    <option value="Cauto">Cauto (Preferencia por soluciones seguras)</option>
                    <option value="Flexible">Flexible (Equilibrio riesgo/recompensa)</option>
                    <option value="Buscador">Buscador (Alta aceptación para innovar)</option>
                  </select>

                  <div className={`mb-1 flex items-center w-max relative ${activeTooltip === 'kri' ? 'z-[100]' : 'z-10'}`}>
                    <label className="font-bold text-gray-700">KRI: Puntaje Residual Máx</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'kri' ? null : 'kri')} className="ml-1.5 text-[12px] text-blue-500 hover:scale-125 transition-transform bg-blue-50 rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                    {activeTooltip === 'kri' && (
                      <div className="absolute top-full left-0 mt-3 w-[450px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-blue-400 uppercase tracking-widest text-[9px]">Ayuda: Score Residual Máximo</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3">
                          <b className="text-blue-300 text-xs block mb-1">¿Qué significa y de dónde sale el dato?</b>
                          Es tu límite de tolerancia basado en la "Matriz 5x5". Se calcula multiplicando la <b>Probabilidad</b> (del 1 al 5) por el <b>Impacto</b> (del 1 al 5) de un riesgo.
                        </div>
                        <div className="mb-3">
                          <b className="text-blue-300 text-xs block mb-1">Escala para diligenciar (1 al 25):</b>
                          <ul className="list-disc pl-4 space-y-1.5">
                            <li><b>De 1 a 4 (Zona Verde):</b> Riesgos casi imposibles o sin impacto.</li>
                            <li><b>De 5 a 9 (Zona Amarilla):</b> Riesgos tolerables y monitoreables.</li>
                            <li><b>De 10 a 16 (Zona Naranja):</b> Riesgos peligrosos que requieren mitigación.</li>
                            <li><b>De 17 a 25 (Zona Roja):</b> Riesgos inaceptables y críticos.</li>
                          </ul>
                        </div>
                        <div className="mb-3">
                          <b className="text-blue-300 text-xs block mb-1">Ejemplo práctico de diligenciamiento:</b>
                          Si decides que para el "Riesgo de falla en internet" lo máximo que estás dispuesto a soportar es estar en la zona amarilla, ingresas el número <b>9</b>. Si el mes siguiente el internet falla y el puntaje sube a <b>12</b>, el sistema lanzará una alerta.
                        </div>
                        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                          <b className="text-blue-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                          Define numéricamente cuándo el sistema debe declarar un riesgo como 'Fuera de Control'.
                        </div>
                      </div>
                    )}
                  </div>
                  <input type="number" min="1" max="25" name="kriScore" defaultValue={editApetito.kriScore || ''} required placeholder="Ej: 9 (Puntos de Matriz 5x5)" className="w-full border border-slate-300 rounded-lg p-2 bg-white shadow-sm relative z-0" />
                </div>

                {/* 2. UMBRALES FINANCIEROS */}
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="font-black text-blue-800 uppercase tracking-widest mb-3 border-b border-blue-200 pb-2">2. Umbrales Financieros (COP)</h4>
                  
                  <div className={`mb-1 flex items-center w-max relative ${activeTooltip === 'apetito' ? 'z-[100]' : 'z-10'}`}>
                    <label className="font-bold text-blue-900">🎯 Apetito de Riesgo (Deseado)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'apetito' ? null : 'apetito')} className="ml-1.5 text-[12px] text-blue-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-blue-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                    {activeTooltip === 'apetito' && (
                      <div className="absolute bottom-full left-0 mb-3 w-[450px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-emerald-400 uppercase tracking-widest text-[9px]">Ayuda: Apetito (Zona Verde)</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3">
                          <b className="text-emerald-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                          Es el "presupuesto" de pérdidas normales que la empresa acepta en su día a día. Operar un negocio implica pequeñas pérdidas inevitables; esta es la "zona verde" o de confort.
                        </div>
                        <div className="mb-3">
                          <b className="text-emerald-300 text-xs block mb-1">Ejemplo práctico de diligenciamiento:</b>
                          En las piscinas de Termales, es predecible que los clientes rompan o se lleven por error 20 toallas al mes. Si reponer esas toallas cuesta <b>$1.000.000 COP</b> al año, ese es nuestro Apetito. Ponemos "1000000" en esta casilla.
                        </div>
                        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                          <b className="text-emerald-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b> 
                          Para no activar falsas alarmas por pérdidas operativas que son completamente normales en el negocio.
                        </div>
                      </div>
                    )}
                  </div>
                  <input type="number" name="apetitoFinanciero" defaultValue={editApetito.apetitoFinanciero || ''} required placeholder="Pérdida esperada aceptable (Ej: 1000000)" className="w-full border border-blue-200 rounded-lg p-2 mb-4 bg-white shadow-sm relative z-0" />

                  <div className={`mb-1 flex items-center w-max relative ${activeTooltip === 'tolerancia' ? 'z-[100]' : 'z-10'}`}>
                    <label className="font-bold text-amber-700">⚠️ Tolerancia al Riesgo (Desv. Máx)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'tolerancia' ? null : 'tolerancia')} className="ml-1.5 text-[12px] text-amber-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-amber-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                    {activeTooltip === 'tolerancia' && (
                      <div className="absolute bottom-full left-0 mb-3 w-[450px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-amber-400 uppercase tracking-widest text-[9px]">Ayuda: Tolerancia (Zona Amarilla)</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3">
                          <b className="text-amber-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                          La zona amarilla. Es una pérdida económica que nos duele, nos incomoda, pero no nos quiebra.
                        </div>
                        <div className="mb-3">
                          <b className="text-amber-300 text-xs block mb-1">Ejemplo práctico de diligenciamiento:</b>
                          Si nuestro apetito en toallas era de 1 millón, pero por una falla se dañan toallas por <b>$3.000.000 COP</b>. Ingresamos "3000000" aquí.<br/>
                          Si esto ocurre, superamos lo normal (Apetito), pero estamos dentro del límite soportable (Tolerancia).
                        </div>
                        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                          <b className="text-amber-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                          Es el límite exacto donde el equipo de control interno debe empezar a "intervenir" de urgencia.
                        </div>
                      </div>
                    )}
                  </div>
                  <input type="number" name="toleranciaFinanciera" defaultValue={editApetito.toleranciaFinanciera || ''} required placeholder="Pérdida máxima tolerada (Ej: 3000000)" className="w-full border border-amber-200 rounded-lg p-2 mb-4 bg-white shadow-sm relative z-0" />

                  <div className={`mb-1 flex items-center w-max relative ${activeTooltip === 'capacidad' ? 'z-[100]' : 'z-10'}`}>
                    <label className="font-bold text-red-700">🛑 Capacidad de Riesgo (Límite)</label>
                    <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'capacidad' ? null : 'capacidad')} className="ml-1.5 text-[12px] text-red-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-red-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                    {activeTooltip === 'capacidad' && (
                      <div className="absolute bottom-full left-0 mb-3 w-[450px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-red-400 uppercase tracking-widest text-[9px]">Ayuda: Capacidad (Zona Roja)</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3">
                          <b className="text-red-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                          El abismo. La cantidad de dinero máxima que podemos perder antes de una catástrofe real.
                        </div>
                        <div className="mb-3">
                          <b className="text-red-300 text-xs block mb-1">Ejemplo práctico de diligenciamiento:</b>
                          Si por un incendio se pierden toallas por <b>$20.000.000 COP</b>, y la empresa solo tenía $15 millones en caja. Ingresamos "20000000" aquí. Llegar a este número significa que no habrá flujo de caja. Es un límite que <b>jamás</b> se debe alcanzar.
                        </div>
                        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                          <b className="text-red-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                          Fija la "línea de muerte" financiera. Si un riesgo se acerca a esta capacidad, la orden debe ser suspender inmediatamente el proceso.
                        </div>
                      </div>
                    )}
                  </div>
                  <input type="number" name="capacidadRiesgo" defaultValue={editApetito.capacidadRiesgo || ''} required placeholder="Pérdida catastrófica (Ej: 10000000)" className="w-full border border-red-200 rounded-lg p-2 bg-white shadow-sm relative z-0" />
                </div>

                {/* 3. IMPACTOS NO FINANCIEROS Y ESCALAMIENTO */}
                <div className="md:col-span-2 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 shadow-inner mt-4">
                  <h4 className="font-black text-purple-800 uppercase tracking-widest mb-3 border-b border-purple-200 pb-2">3. Impactos No Financieros y Protocolo de Escalamiento</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`relative ${activeTooltip === 'operativo' ? 'z-[100]' : 'z-10'}`}>
                      <div className="mb-1 flex items-center w-max">
                        <label className="font-bold text-purple-900">⚙️ Límite Operativo</label>
                        <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'operativo' ? null : 'operativo')} className="ml-1.5 text-[12px] text-purple-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-purple-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                      </div>
                      {activeTooltip === 'operativo' && (
                        <div className="absolute top-full left-0 mt-3 w-[350px] md:w-[400px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                          <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                            <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Límite Operativo</span>
                            <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                          </div>
                          <div className="mb-3">
                            <b className="text-purple-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                            Tolerancia en la operación física o de servicio antes de declarar emergencia o llamar al área técnica.
                          </div>
                          <div className="mb-3">
                            <b className="text-purple-300 text-xs block mb-1">Ejemplos de diligenciamiento:</b>
                            <ul className="list-disc pl-4 space-y-1.5">
                              <li><i>En Taquilla, aceptamos máximo 15 minutos de caída del sistema antes de aplicar el plan de contingencia manual.</i></li>
                              <li><i>En Mantenimiento, aceptamos máximo 2 quejas a la semana por agua fría en las piscinas del Hotel.</i></li>
                            </ul>
                          </div>
                          <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                            <b className="text-purple-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                            Porque no todos los riesgos generan pérdida de dinero inmediato; este límite protege la experiencia del usuario turista y el flujo de la operación.
                          </div>
                        </div>
                      )}
                      <input name="impactoOperativo" defaultValue={editApetito.impactoOperativo || ''} required placeholder="Ej: Máx 2 hrs de caída del sistema" className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0" />
                    </div>

                    <div className={`relative ${activeTooltip === 'reputacional' ? 'z-[100]' : 'z-10'}`}>
                      <div className="mb-1 flex items-center w-max">
                        <label className="font-bold text-purple-900">🗣️ Límite Reputacional</label>
                        <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'reputacional' ? null : 'reputacional')} className="ml-1.5 text-[12px] text-purple-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-purple-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                      </div>
                      {activeTooltip === 'reputacional' && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[350px] md:w-[400px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                          <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                            <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Daño de Imagen</span>
                            <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                          </div>
                          <div className="mb-3">
                            <b className="text-purple-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                            Tolerancia al daño de imagen de la marca Termales Santa Rosa frente a clientes y público externo.
                          </div>
                          <div className="mb-3">
                            <b className="text-purple-300 text-xs block mb-1">Opciones y Ejemplos:</b>
                            <ul className="list-disc pl-4 space-y-1.5">
                              <li><b>Ninguno (Averso):</b> <i>Cero tolerancia a crisis de imagen, como una intoxicación masiva en el restaurante.</i></li>
                              <li><b>Quejas Locales:</b> <i>Un cliente molesto en recepción por una demora, que se maneja con una cortesía.</i></li>
                              <li><b>Medios Regionales:</b> <i>Una noticia en radio sobre alto tráfico en la vía a los termales en temporada alta.</i></li>
                            </ul>
                          </div>
                          <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                            <b className="text-purple-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                            Protege el activo más valioso del turismo: el buen nombre y las recomendaciones.
                          </div>
                        </div>
                      )}
                      <select name="impactoReputacional" defaultValue={editApetito.impactoReputacional || 'Quejas Locales'} className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0">
                        <option value="Ninguno">Ninguno (Averso)</option>
                        <option value="Quejas Locales">Solo quejas locales controlables</option>
                        <option value="Medios Regionales">Impacto en medios regionales</option>
                      </select>
                    </div>

                    <div className={`relative ${activeTooltip === 'legal' ? 'z-[100]' : 'z-10'}`}>
                      <div className="mb-1 flex items-center w-max">
                        <label className="font-bold text-purple-900">⚖️ Límite Legal / Normativo</label>
                        <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'legal' ? null : 'legal')} className="ml-1.5 text-[12px] text-purple-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-purple-200 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                      </div>
                      {activeTooltip === 'legal' && (
                        <div className="absolute top-full right-0 mt-3 w-[350px] md:w-[400px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                          <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                            <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Riesgo Regulatorio</span>
                            <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                          </div>
                          <div className="mb-3">
                            <b className="text-purple-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                            Tolerancia a faltas regulatorias o multas de entes gubernamentales.
                          </div>
                          <div className="mb-3">
                            <b className="text-purple-300 text-xs block mb-1">Opciones y Ejemplos:</b>
                            <ul className="list-disc pl-4 space-y-1.5">
                              <li><b>Cero Tolerancia:</b> <i>Incumplimientos de sanidad en A&B, vertimientos de aguas termales o normas de seguridad humana.</i></li>
                              <li><b>Sanciones Leves:</b> <i>Un retraso menor en un reporte contable que genera una multa administrativa pequeña y asumible.</i></li>
                            </ul>
                          </div>
                          <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                            <b className="text-purple-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                            Evita que la empresa sea sellada, multada masivamente o clausurada por ignorar normas obligatorias.
                          </div>
                        </div>
                      )}
                      <select name="impactoLegal" defaultValue={editApetito.impactoLegal || 'Cero Tolerancia'} className="w-full border border-purple-200 rounded-lg p-2 bg-white shadow-sm relative z-0">
                        <option value="Cero Tolerancia">Cero Tolerancia (Averso)</option>
                        <option value="Sanciones Leves">Acepta sanciones o multas leves</option>
                        <option value="Demandas">Acepta riesgo de demandas</option>
                      </select>
                    </div>
                  </div>

                  <div className={`mt-4 pt-4 border-t border-purple-200 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4 relative ${activeTooltip === 'escalamiento' ? 'z-[100]' : 'z-10'}`}>
                    <div className="mb-1 flex items-center w-max">
                      <label className="font-black text-purple-900">🚨 ¿A quién escalar en caso de alerta?</label>
                      <button type="button" onClick={() => setActiveTooltip(activeTooltip === 'escalamiento' ? null : 'escalamiento')} className="ml-2 text-[12px] text-purple-600 hover:scale-125 transition-transform bg-white rounded-full px-1.5 py-0.5 border border-purple-300 shadow-sm cursor-pointer font-bold">ℹ️ Info</button>
                    </div>
                    {activeTooltip === 'escalamiento' && (
                      <div className="absolute bottom-full left-0 mb-3 w-[450px] max-h-80 overflow-y-auto p-5 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl border border-slate-700">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2 sticky top-0 bg-slate-900">
                          <span className="font-black text-purple-400 uppercase tracking-widest text-[9px]">Ayuda: Cadena de Mando</span>
                          <button type="button" onClick={() => setActiveTooltip(null)} className="text-white hover:bg-red-600 bg-red-500 font-bold text-xs px-2 py-0.5 rounded transition-colors">✖</button>
                        </div>
                        <div className="mb-3">
                          <b className="text-purple-300 text-xs block mb-1">¿Qué significa este concepto?</b>
                          Define el protocolo de emergencia y quién toma la decisión final cuando el riesgo pasa a zona Amarilla o Roja.
                        </div>
                        <div className="mb-3">
                          <b className="text-purple-300 text-xs block mb-1">Opciones y Ejemplos:</b>
                          <ul className="list-disc pl-4 space-y-1.5">
                            <li><b>Jefe de Área:</b> <i>Riesgos tácticos que se resuelven con el equipo interno sin afectar a los demás.</i></li>
                            <li><b>Comité de Gerencia:</b> <i>Riesgos que requieren aprobación de presupuesto extra o apoyo urgente de otras áreas.</i></li>
                            <li><b>Junta Directiva:</b> <i>Riesgos catastróficos que amenazan la continuidad del negocio o exigen cierres prolongados.</i></li>
                          </ul>
                        </div>
                        <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 mt-2">
                          <b className="text-purple-300 text-xs block mb-1">¿Por qué es vital llenarlo?</b>
                          Evita la parálisis por análisis; establece una cadena de mando clara para actuar rápido en medio de una crisis real.
                        </div>
                      </div>
                    )}
                    <select name="escalamiento" defaultValue={editApetito.escalamiento || 'Comité de Gerencia'} className="w-full md:w-1/2 border border-purple-300 rounded-lg p-2 bg-white font-bold text-slate-800 shadow-sm relative z-0 mt-1">
                      <option value="Jefe de Área">Jefe de Área (Bajo Impacto)</option>
                      <option value="Comité de Gerencia">Comité de Gerencia (Impacto Medio)</option>
                      <option value="Junta Directiva">Junta Directiva (Alto Impacto / Crítico)</option>
                    </select>
                  </div>
                </div>

              </div>
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button type="submit" className="bg-slate-900 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-colors transform hover:scale-105 duration-200 relative z-10">💾 Aplicar Arquitectura Integral</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="p-5 bg-[#0f172a] flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Monitor de Brechas Financieras</h3>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold border border-slate-700">Analítica</span>
            </div>
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-700 bg-slate-800 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm placeholder-slate-500" />
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left divide-y divide-slate-100">
              <thead className="bg-white text-slate-500 font-black uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="p-4 w-1/3">
                    <div>Proceso / Riesgo / Postura</div>
                    <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 text-center">
                    <div>Puntuación (KRI)</div>
                    <FilterInput colKey="kriScore" placeholder="Puntaje..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 w-1/3 text-center">Consumo de Capacidad Financiera (Eventos)</th>
                  <th className="p-4 text-center">
                    <div>Diagnóstico COSO</div>
                    <FilterInput colKey="zonaVal" placeholder="Estado..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applyFilters(apetitoData, searchTerm, columnFilters).map((r, index) => {
                  const excedidoScore = r.kriScore && r.resScoreVal > r.kriScore;

                  return (
                    <tr key={`apetito-row-${r.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-2 mb-1.5">
                          <span className="px-2 py-0.5 bg-slate-800 text-white text-[9px] rounded font-bold uppercase">{r.sede || 'Hotel'}</span>
                          <span className="font-bold text-slate-400 text-[10px] font-mono">#{r.id}</span>
                          <span className="font-black text-slate-800 text-sm tracking-tight">{r.proceso}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-medium pr-4 line-clamp-2" title={r.descripcion}>{r.descripcion}</div>
                        {r.posturaEstrategica && <div className="mt-2 text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded border border-indigo-100">Postura: {r.posturaEstrategica}</div>}
                      </td>
                      
                      <td className="p-4 text-center">
                        {r.kriScore ? (
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Límite: {r.kriScore}</span>
                            <span className={`px-2 py-1 rounded font-black font-mono text-xs ${excedidoScore ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'} notranslate`} translate="no">{r.resScoreVal}</span>
                          </div>
                        ) : <span className="text-slate-300 font-medium italic">-</span>}
                      </td>

                      <td className="p-4">
                        {r.estaConfiguradoVal ? (
                          <div className="w-full">
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-1000 ${r.consumoPorcentajeVal <= (r.apetitoFinanciero/r.capacidadRiesgo)*100 ? 'bg-emerald-500' : r.consumoPorcentajeVal <= (r.toleranciaFinanciera/r.capacidadRiesgo)*100 ? 'bg-yellow-400' : r.consumoPorcentajeVal < 100 ? 'bg-orange-500' : 'bg-red-600'}`} style={{ width: `${r.consumoPorcentajeVal}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400 notranslate" translate="no">
                              <span>Perdido: ${(r.costoTotalVal).toLocaleString('es-CO')}</span>
                              <span>Tope: ${(r.capacidadRiesgo).toLocaleString('es-CO')}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest border border-dashed border-slate-200 rounded-lg py-2 bg-slate-50">Requiere Parametrización</div>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-3 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest border ${r.zonaColorVal} mx-auto block w-max`}>
                          {r.zonaVal.toUpperCase()}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {isAdmin && <button onClick={() => {setEditApetito(r); setFormResetKey(Date.now()); scrollToForm();}} className="bg-white border border-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center space-x-1 mx-auto w-full"><span>⚙️</span> <span>Ajustador</span></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEvaluaciones = () => {
    const evaluacionesData = safeEvaluaciones.map(e => ({ ...e, fechaVal: formatSafeDate(e.fecha) }));

    return (
      <div className="space-y-6">
        <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">Auditoría de Controles</h2></div>
        {isAdmin && (
          <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">{editEvaluacion ? '✏️ Editar Test' : '➕ Nuevo Test de Control'}</h3>
            <form onSubmit={handleEvaluacionSubmit} key={editEvaluacion?.id || 'nueva-evaluacion'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
              <div className="md:col-span-2"><label className="font-bold text-gray-600">Riesgo / Control</label><select name="idRiesgo" defaultValue={editEvaluacion?.idRiesgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white">{safeRiesgos.map((r, index) => <option key={`opt-riesgo-${r.id}-${index}`} value={r.id}>[{r.noControl}] {r.proceso}</option>)}</select></div>
              <div><label className="font-bold text-gray-600">Diseño</label><select name="diseno" defaultValue={editEvaluacion?.diseño||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
              <div><label className="font-bold text-gray-600">Ejecución</label><select name="ejecucion" defaultValue={editEvaluacion?.ejecucion||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
              
<div className="md:col-span-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-indigo-100 pb-3">
                  <div>
                    <label className="font-black text-indigo-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace</label>
                    <p className="text-[9px] text-indigo-600 font-medium mt-0.5">Ve a tu nube, busca el archivo, haz clic en "Compartir" y copia el link.</p>
                  </div>
                  <div className="flex space-x-2 mt-2 md:mt-0">
                    <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                    <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
                         </div>
      </div>
      <div>
        <label className="font-black text-indigo-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace copiado aquí</label>
        <input type="url" name="evidenciaUrlInput" defaultValue={editEvaluacion?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-indigo-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
      </div>
    </div>
    <div className="md:col-span-4"><label className="font-bold text-gray-600">Comentarios y Observaciones</label><textarea name="comentarios" defaultValue={editEvaluacion?.comentarios||''} required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea></div>
    <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg shadow-md hover:bg-indigo-700">Guardar Test</button></div>
  </form>
</div>
)}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
             <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Registros de Auditoría</h3>
             <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm" />
             </div>
          </div>
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">
                  <div>ID Test</div>
                  <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Fecha / Autor</div>
                  <FilterInput colKey="auditor" placeholder="Autor..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Diseño/Operación</div>
                  <FilterInput colKey="diseno" placeholder="Filtrar..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Eficacia</div>
                  <FilterInput colKey="calificacion" placeholder="%" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Comentarios / Anexos</div>
                  <FilterInput colKey="comentarios" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                {isAdmin && <th className="p-3 text-center">Gestión</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {applyFilters(evaluacionesData, searchTerm, columnFilters).map((ev, index) => (
                <tr key={`eval-row-${ev.id}-${index}`} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-400">#TEST-{ev.id}</td>
                  <td className="p-3">
                    <div className="font-bold">{ev.fechaVal}</div>
                    <div className="text-[9px] text-slate-500 mt-1 uppercase truncate w-32" title={ev.auditor}>{ev.auditor}</div>
                  </td>
                  <td>D: {ev.diseño} / E: {ev.ejecucion}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded font-black ${ev.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} notranslate`} translate="no">{ev.calificacion}%</span></td>
                  <td className="p-3">
                    <div className="mb-1">{ev.comentarios}</div>
                    {ev.evidenciaUrl ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={ev.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                          <span>🔗</span><span>Abrir Enlace</span>
                        </a>
                        {isAdmin && <button onClick={() => analizarEvidenciaIA(ev.evidenciaUrl, ev.comentarios, 'Test de Auditoría')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-purple-100 flex items-center space-x-1 transition-colors shadow-sm"><span>🤖</span><span>Auditar IA</span></button>}
                      </div>
                    ) : (
                      <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      <button onClick={() => {setEditEvaluacion(ev); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>
                      <button onClick={() => handleDeleteItem('evaluaciones', ev.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHallazgos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📄 Hallazgos y Desviaciones</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión de auditorías y no conformidades encontradas.</p>
        </div>
      </div>

      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editHallazgo ? `✏️ Editando Hallazgo: ${editHallazgo.ref}` : '➕ DOCUMENTAR NUEVA DESVIACIÓN'}</h3>
            {editHallazgo && <button onClick={() => setEditHallazgo(null)} className="text-xs text-slate-500 hover:text-red-600 font-bold">✖ Cancelar Edición</button>}
          </div>

          <form onSubmit={handleHallazgoSubmit} key={editHallazgo?.id || 'nuevo-hallazgo'} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
            <div><label className="font-bold text-gray-600 block mb-1">ID / Código (Manual)</label><input name="ref" defaultValue={editHallazgo?.ref||''} required placeholder="Ej: HAL-2026-01" className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Sede</label><select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
            <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input name="proceso" defaultValue={editHallazgo?.proceso||''} required className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Severidad</label><select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
            
            <div><label className="font-bold text-gray-600 block mb-1">Auditor Responsable</label><input name="auditor" defaultValue={editHallazgo?.auditor||''} required placeholder="Quien levantó el hallazgo" className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Dueño del Proceso</label><input name="responsable" defaultValue={editHallazgo?.responsable||''} required placeholder="Responsable a cargo" className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div className="md:col-span-2">
  <label className="font-bold text-gray-600 block mb-1">Título / Descripción de la Falla</label>
  <input name="titulo" defaultValue={editHallazgo?.titulo||''} required placeholder="Describa el hallazgo brevemente..." className="w-full border border-slate-300 rounded-lg p-2" />
</div>            
                        <div className="md:col-span-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-rose-100 pb-3">
                <div>
                  <label className="font-black text-rose-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace de soporte</label>
                  <p className="text-[9px] text-rose-600 font-medium mt-0.5">Ve a tu nube, busca el archivo del informe o foto, haz clic en "Compartir" y copia el link.</p>
                </div>
                <div className="flex space-x-2 mt-2 md:mt-0">
                  <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                  <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
                </div>
              </div>
              <div>
                <label className="font-black text-rose-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace de la evidencia aquí</label>
                <input type="url" name="evidenciaUrlInput" defaultValue={editHallazgo?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-rose-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-rose-500 outline-none transition-all" />
              </div>
              {editHallazgo?.evidenciaUrl && (
                <div className="mt-3 flex space-x-2 border-t border-rose-100 pt-2">
                  <a href={editHallazgo.evidenciaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold hover:bg-rose-200 shadow-sm transition-colors">
                    👁️ Abrir Enlace Actual
                  </a>
                </div>
              )}
            </div>
            
            <div className="md:col-span-4 flex justify-end items-end">
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-md transition-all w-full md:w-auto">
                {editHallazgo ? '💾 Guardar Cambios' : '➕ REGISTRAR HALLAZGO'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">DESVIACIONES</h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-64 shadow-sm" />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              <tr>
                <th className="p-4">
                  <div>ID / REF</div>
                  <FilterInput colKey="ref" placeholder="Identificación..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>PROCESO</div>
                  <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4 w-1/3">
                  <div>TÍTULO E INFORMES</div>
                  <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>RESPONSABLES</div>
                  <FilterInput colKey="responsable" placeholder="Responsable..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4 text-center">
                  <div>ESTADO / GESTIÓN</div>
                  <FilterInput colKey="estado" placeholder="Estado..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applyFilters(hFiltrados, searchTerm, columnFilters).map((h, index) => (
                <tr key={`hallazgo-row-${h.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-black text-slate-800 text-sm">{h.ref}</div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">INT-#{h.id}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{h.proceso}</div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-black mt-0.5">{h.sede || 'Hotel'}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800 leading-relaxed">{h.titulo}</div>
                    {h.evidenciaUrl ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={h.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                          <span>🔗</span><span>Abrir Enlace</span>
                        </a>
                      </div>
                    ) : (
                      <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="mb-1"><span className="font-bold text-slate-400 uppercase">Auditor:</span> <span className="font-black text-slate-700">{h.auditor || 'N/A'}</span></div>
                      <div><span className="font-bold text-slate-400 uppercase">Dueño:</span> <span className="font-black text-slate-700">{h.responsable}</span></div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-widest block mx-auto w-max mb-3 ${h.estado === 'Cerrado' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {h.estado}
                    </span>
                    {isAdmin && (
                      <div className="flex justify-center items-center space-x-2 border-t border-slate-100 pt-3">
                        <button onClick={() => {setEditHallazgo(h); setFormResetKey(Date.now()); scrollToForm();}} className="text-slate-500 hover:text-blue-600 transition-colors" title="Editar">
                          ✏️ Editar
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => handleDeleteItem('hallazgos', h.id)} className="text-slate-500 hover:text-red-600 transition-colors" title="Eliminar">
                          🗑️ Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPlanes = () => {
    const planesData = pFiltrados.map(p => ({ ...p, fechaVal: formatSafeDate(p.fecha) }));

    return (
      <div className="space-y-6">
        <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">✅ Planes de Acción Remediales</h2></div>
        {isAdmin && (
          <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">{editPlan ? `✏️ Editando Avance de Plan` : '➕ Asignar Plan'}</h3>
            
            <form onSubmit={handlePlanSubmit} key={editPlan?.id || 'nuevo-plan'} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
              <div className="md:col-span-4"><label className="font-bold text-gray-600">Hallazgo Vinculado</label><select name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="">-- Seleccione --</option>{safeHallazgos.map((h, index) => <option key={`opt-hallz-${h.id}-${index}`} value={h.id}>[#HAL-{h.id}] {h.titulo}</option>)}</select></div>
              
              <div className="md:col-span-2">
  <label className="font-bold text-gray-600 block mb-1">Acción de Choque / Mitigación</label>
  <input name="accion" defaultValue={editPlan?.accion||''} required placeholder="Acción de Choque / Mitigación" className="w-full border p-2 rounded" />
</div>

              <div><label className="font-bold text-gray-600">Responsable de Ejecución</label><input name="responsable" defaultValue={editPlan?.responsable||''} required className="w-full border p-2 rounded" /></div>
              <div><label className="font-bold text-gray-600">Compromiso</label><input name="fecha" type="date" defaultValue={formatSafeDate(editPlan?.fecha)||''} required className="w-full border p-2 rounded" /></div>
              <div><label className="font-bold text-blue-600">% Avance Real</label><input name="progreso" type="number" min="0" max="100" defaultValue={editPlan?.progreso||0} placeholder="% Avance Real" className="w-full border p-2 bg-blue-50 border-blue-200 rounded" /></div>
              
                           <div className="md:col-span-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-emerald-100 pb-3">
                  <div>
                    <label className="font-black text-emerald-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace del entregable</label>
                    <p className="text-[9px] text-emerald-600 font-medium mt-0.5">Ve a tu nube, busca el archivo de evidencia que demuestre la mitigación, haz clic en "Compartir" y copia el link.</p>
                  </div>
                  <div className="flex space-x-2 mt-2 md:mt-0">
                    <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                    <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
                  </div>
                </div>
                <div>
                  <label className="font-black text-emerald-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace del soporte aquí</label>
                  <input type="url" name="evidenciaUrlInput" defaultValue={editPlan?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-emerald-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                </div>
                {editPlan?.evidenciaUrl && (
                  <div className="mt-3 flex space-x-2 border-t border-emerald-100 pt-2">
                    <a href={editPlan.evidenciaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold hover:bg-emerald-200 shadow-sm transition-colors">
                      👁️ Abrir Enlace Actual
                    </a>
                  </div>
                )}
              </div>
              
              <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold hover:bg-[#003d33]">{editPlan ? 'Actualizar Plan' : 'Asignar Plan'}</button></div>
            </form>
          </div>
        )}
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
             <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Planes</h3>
             <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 w-64 shadow-sm" />
             </div>
          </div>
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
              <tr>
                <th className="p-3">
                  <div>ID Plan</div>
                  <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Hallazgo</div>
                  <FilterInput colKey="idHallazgo" placeholder="Ref..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Acción Remedial Programada</div>
                  <FilterInput colKey="accion" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3 w-40">% Avance</th>
                <th className="p-3">
                  <div>Estado</div>
                  <FilterInput colKey="estado" placeholder="Estado..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {applyFilters(planesData, searchTerm, columnFilters).map((p, index) => {
                const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
                return (
                  <tr key={`plan-row-${p.id}-${index}`} className="hover:bg-slate-50">
                    <td className="p-3 font-bold">#PLAN-{p.id}</td>
                    <td className="p-3 text-red-600 font-bold">#HAL-{p.idHallazgo}<span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold block mt-1">{hallazgoAsociado?.sede || 'Hotel'}</span></td>
                    <td className="p-3 text-slate-800 font-medium">
                      {p.accion} <span className="text-[10px] text-slate-400 block font-normal mt-1">Resp: {p.responsable} • Límite: {p.fechaVal}</span>
                      {p.evidenciaUrl ? (
                        <div className="flex items-center space-x-2 mt-2">
                          <a href={p.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                            <span>🔗</span><span>Abrir Enlace</span>
                          </a>
                        </div>
                      ) : (
                        <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
                      )}
                    </td>
                    <td className="p-3"><ProgressBar progress={p.progreso || p.avance || 0} /></td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded font-black uppercase text-[9px] ${p.estado === 'Cerrado' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.estado}</span></td>
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      {isAdmin && <button onClick={() => {setEditPlan(p); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>}
                      {isAdmin && <button onClick={() => handleDeleteItem('planes', p.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

    const renderIncidentes = () => (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">🚨 Registro de Eventos de Pérdida (COP)</div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
             <h3 className="text-xs font-bold text-slate-700 uppercase">
               {editIncidente ? `✏️ Editando Evento #${editIncidente.id}` : '➕ Registrar Evento de Pérdida'}
             </h3>
             {editIncidente && <button onClick={() => setEditIncidente(null)} className="text-xs text-red-500 font-bold hover:text-red-700">✖ Cancelar</button>}
          </div>
          <form onSubmit={handleIncidenteSubmit} key={editIncidente ? `edit-incidente-${editIncidente.id}-${formResetKey}` : `new-incidente-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <input name="idRiesgo" defaultValue={editIncidente?.idRiesgo || ''} required placeholder="ID Riesgo Vinculado" className="border p-2 rounded" />
            <input name="titulo" defaultValue={editIncidente?.titulo || ''} required placeholder="Título del Evento" className="border p-2 rounded" />
            <input name="costo" type="number" defaultValue={editIncidente?.costo || ''} required placeholder="Monto de la Pérdida Financiera" className="border p-2 rounded" />
            <select name="impacto" defaultValue={editIncidente?.impacto || 'Bajo'} className="border p-2 bg-white rounded"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select>
            <textarea name="descripcion" defaultValue={editIncidente?.descripcion || ''} required placeholder="Descripción de la falla operacional..." className="border p-2 rounded md:col-span-4"></textarea>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold hover:bg-[#003d33]">
                {editIncidente ? 'Actualizar Evento' : 'Registrar Evento'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold">
            <tr>
              <th className="p-3">ID <FilterInput colKey="id" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Riesgo ID <FilterInput colKey="idRiesgo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Descripción <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Impacto <FilterInput colKey="impacto" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3 text-right">Costo (COP)</th>
              {isAdmin && <th className="p-3 text-center">Acción</th>}
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(incFiltrados, searchTerm, columnFilters).map(i => (
              <tr key={i.id}>
                <td className="p-3 text-slate-400">#INC-{i.id}</td>
                <td className="p-3 font-bold">#{i.idRiesgo}</td>
                <td className="p-3"><b>{i.titulo}</b><p className="text-[10px] text-slate-400 mt-0.5">{i.descripcion}</p></td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">{i.impacto}</span></td>
                <td className="p-3 text-right font-mono font-bold text-red-600 notranslate" translate="no">${Number(i.costo || 0).toLocaleString('es-CO')}</td>
                {isAdmin && (
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => {setEditIncidente(i); setFormResetKey(Date.now()); scrollToForm();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>
                    <button onClick={() => handleDeleteItem('incidentes', i.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInforme = () => {
    const logs = [...safeRiesgos, ...safeEvaluaciones, ...safeHallazgos, ...safePlanes, ...safeIncidentes]
      .flatMap(item => (item.historialCambios || []).map(log => ({ ...log, ref: item.proceso || item.titulo || `Item: ${item.id}` })));
    return (
      <div className="space-y-6">
        <div className="border-b pb-2 font-black text-lg">📜 Trazabilidad de Auditoría e Historial de Cambios</div>
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-500">
              <tr><th className="p-3">Fecha y Hora</th><th className="p-3">Módulo afectado</th><th className="p-3">Acción en Base de Datos</th></tr>
            </thead>
            <tbody className="divide-y text-slate-600">
              {logs.map((l, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-mono">{l.fecha || new Date().toLocaleString()}</td>
                  <td className="p-3 font-bold text-slate-900">{l.ref}</td>
                  <td className="p-3 italic">{l.accion || 'Registro guardado'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRCSAPortal = () => (
    <div className="min-h-screen bg-slate-100 font-sans text-xs flex flex-col items-center justify-center p-8">
      <div className="bg-white p-12 rounded-3xl shadow-xl max-w-lg text-center border-t-8 border-[#004d40]">
        <h1 className="text-2xl font-black mb-4">Portal RCSA Jefes de Área</h1>
        <p className="text-slate-500 mb-8 text-sm">Bienvenido a la vista de Primera Línea de Defensa. Actualmente la parametrización de auto-reportes de % de avance se encuentra en configuración por el equipo de Control Interno.</p>
        <button onClick={handleLogout} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold w-full uppercase tracking-widest">Cerrar Sesión</button>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-2xl">
          <div className="text-center"><span className="text-5xl block animate-bounce">🛡️</span><h2 className="mt-4 text-3xl font-extrabold text-slate-900">GCM Auditor v5</h2><p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Termales GRC Platform</p></div>
          <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
            {authError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">⚠️ {authError}</div>}
            <div className="space-y-3">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Correo</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="tu_correo@termales.com.co" className="block w-full rounded-lg border px-3 py-2 text-xs mt-1"/></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Contraseña</label><input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="block w-full rounded-lg border px-3 py-2 text-xs mt-1"/></div>
            </div>
            <button type="submit" className="w-full flex justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-md">{isRegistering ? 'Crear Cuenta' : 'Ingresar al Portal'}</button>
          </form>
          <div className="text-center pt-2 border-t"><button onClick={() => {setIsRegistering(!isRegistering); setAuthError('');}} className="text-xs font-bold text-blue-600">{isRegistering ? '¿Ya tiene cuenta? Iniciar Sesión' : '¿No tiene acceso? Regístrese aquí'}</button></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return renderRCSAPortal();
  if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white flex-col space-y-4"><span className="text-6xl animate-bounce">☁️</span><h2 className="text-xl font-bold tracking-widest uppercase">Conectando...</h2></div>);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* BOTÓN FLOTANTE: SALIR DE MODO PRESENTACIÓN */}
      {isPresentationMode && (
        <button 
          onClick={() => setIsPresentationMode(false)} 
          className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all hover:scale-105 flex items-center space-x-2 border-2 border-slate-700 animate-in slide-in-from-bottom-10"
        >
          <span>✖</span><span>Salir de Presentación</span>
        </button>
      )}

      {/* SIDEBAR */}
      <div className={`w-64 bg-slate-900 text-white flex-col shadow-xl z-20 ${isPresentationMode ? 'hidden' : 'flex'}`}>
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800"><span className="text-2xl">🛡️</span><div><h1 className="text-sm font-bold tracking-wide">GCM Auditor v5</h1><p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">{user.email}</p></div></div>
        <nav className="flex-1 px-4 py-4 space-y-1 text-xs font-medium overflow-y-auto">
          {[
            { id: 'tablero', icon: '📊', label: 'Tablero Analítico' },
            { id: 'dashboard_riesgos', icon: '📈', label: 'Dashboard Inteligente' },
            { id: 'plan_anual', icon: '🗓️', label: 'Plan Anual de Auditoría' },
            { id: 'riesgos', icon: '⚠️', label: 'Matriz de Riesgos' },
            { id: 'apetito', icon: '⚖️', label: 'Apetito de Riesgo' },
            { id: 'evaluaciones', icon: '🔬', label: 'Auditoría de Controles' },
            { id: 'hallazgos', icon: '📄', label: 'Hallazgos' },
            { id: 'planes', icon: '✅', label: 'Planes de Acción' },
            { id: 'incidentes', icon: '🚨', label: 'Eventos de Pérdida' },
            { id: 'informe', icon: '📜', label: 'Trazabilidad' },
                             { id: 'informes_auditoria', icon: '📁', label: 'Informes Emitidos' },
            { id: 'config', icon: '⚙️', label: 'Configuración / Copias de seguridad' }
          ].map((tab, index) => (
            <button key={`nav-${tab.id}-${index}`} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center space-x-2 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full text-[10px] text-slate-300 border border-slate-700/50 rounded-lg py-1.5 font-bold flex items-center justify-center space-x-1"><span>🚪</span> <span>Cerrar Sesión</span></button></div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER SUPERIOR */}
        <header className={`bg-white border-b h-16 items-center justify-between px-8 shadow-sm flex-shrink-0 z-10 ${isPresentationMode ? 'hidden' : 'flex'}`}>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">Termales de Santa Rosa de Cabal — Sistema de Gestión Integral</span>
          <button 
            onClick={() => setIsPresentationMode(true)} 
            className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-2 shadow"
          >
            <span>📺</span><span>Modo Presentación</span>
          </button>
        </header>
        
        <main id="main-scroll-area" className={`flex-grow overflow-y-auto ${isPresentationMode ? 'p-12' : 'p-8'} bg-slate-50 scroll-smooth relative`}>
          <div className={`${isPresentationMode ? 'max-w-none' : 'max-w-7xl'} mx-auto transition-all duration-500`}>
            {activeTab === 'tablero' && renderTablero()}
            {activeTab === 'dashboard_riesgos' && renderDashboardRiesgos()}
            {activeTab === 'plan_anual' && renderPlanAnual()}
            {activeTab === 'riesgos' && renderRiesgos()}
            {activeTab === 'apetito' && renderApetito()}
            {activeTab === 'evaluaciones' && renderEvaluaciones()}
            {activeTab === 'hallazgos' && renderHallazgos()}
            {activeTab === 'planes' && renderPlanes()}
            {activeTab === 'incidentes' && renderIncidentes()}
            {activeTab === 'informe' && renderInforme()}
                            {activeTab === 'informes_auditoria' && renderInformesAuditoria()}
            {activeTab === 'config' && renderConfiguracion()}
          </div>
        </main>
      </div>

      {/* CÓDIGO AÑADIDO: Renderizado del Modal de Inteligencia Artificial */}
      {aiModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-purple-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center space-x-2">
                <span>🤖</span> <span>{aiModal.titulo}</span>
              </h3>
              <button onClick={() => setAiModal(null)} className="hover:text-purple-200 font-bold text-lg">✖</button>
            </div>
            <div className="p-6 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border-b border-slate-100">
              {aiModal.contenido}
            </div>
            <div className="bg-slate-50 p-4 flex justify-between items-center">
              {aiModal.url && (
                <a href={aiModal.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center space-x-1">
                  <span>🔗</span> <span>Ver Evidencia</span>
                </a>
              )}

              <button onClick={() => setAiModal(null)} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors">
                Cerrar Análisis
              </button>
            </div>
          </div>
        </div>
      )}
{/* 📊 MODAL DE INFORME DETALLADO POR PUNTO DE GRÁFICA */}
      {chartDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-black text-xs uppercase tracking-widest flex items-center space-x-2">
                <span>📈</span> <span>Foco de Control: {chartDetail.tipo} — {chartDetail.mesCompleto.toUpperCase()}</span>
              </h3>
              <button onClick={() => setChartDetail(null)} className="hover:text-slate-300 font-bold text-lg">✖</button>
            </div>
            
            <div className="p-6 max-h-[380px] overflow-y-auto text-xs">
              {chartDetail.items.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-wider border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                  🚫 No se encontraron eventos ni novedades en este periodo.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden p-2 bg-white">
                  {chartDetail.tipo === 'Incidentes Financiados' ? (
                    chartDetail.items.map((item, idx) => (
                      <div key={`modal-inc-${idx}`} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-start space-x-4">
                        <div>
                          <div className="font-black text-slate-800 text-sm">{item.titulo}</div>
                          <div className="text-slate-500 mt-1 font-medium leading-relaxed">{item.descripcion}</div>
                          <div className="text-[9px] text-slate-400 font-mono font-bold mt-2 uppercase tracking-wide">Vinculado a Riesgo: #{item.idRiesgo} • Reporta: {item.reportadoPor}</div>
                        </div>
                       <div className="font-mono font-black text-red-600 text-right text-sm whitespace-nowrap bg-red-50 px-3 py-1 rounded-lg border border-red-100">
  ${Number(item.costo || 0).toLocaleString('es-CO')}
</div>
                      </div>
                    ))
                  ) : (
                    chartDetail.items.map((item, idx) => (
                      <div key={`modal-hal-${idx}`} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-start space-x-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-black text-slate-900 text-sm">{item.ref}</span>
                            <span className="px-2 py-0.5 bg-slate-800 text-white font-bold text-[8px] rounded uppercase tracking-wider">{item.proceso}</span>
                          </div>
                          <div className="text-slate-600 font-semibold leading-relaxed">{item.titulo}</div>
                          <div className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Sede: {item.sede} • Dueño de Proceso: {item.responsable}</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border shrink-0 ${
                          item.severidad === 'Crítico' || item.severidad === 'Alto' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{item.severidad}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex justify-end border-t">
              <button onClick={() => setChartDetail(null)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-colors shadow-md">
                Cerrar Análisis
              </button>
            </div>
          </div>
        </div>
      )}
     {notification && (<div className={`fixed bottom-4 right-4 px-6 py-4 rounded-xl shadow-2xl font-bold text-sm z-50 animate-in slide-in-from-bottom-5 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>{notification.message}</div>)}
    </div>
  );
}





