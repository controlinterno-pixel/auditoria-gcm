import React, { useState, useEffect, useMemo } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth'; 
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
// 🔥 NUEVA CONEXIÓN MODULAR A FIREBASE
import { auth, db } from './services/firebase';
import { obtenerSugerenciaIA, obtenerAnalisisEvidenciaIA } from './services/gemini';
import { 
  formatSafeDate, getMonthFromDate, getYearFromDate, 
  getItemAnio, getItemMesText, calcularMatriz5x5, applyFilters, mapMesNumATexto 
} from './utils/helpers';
import InformesAuditoria from './components/InformesAuditoria';
import Configuracion from './components/Configuracion';
import Incidentes from './components/Incidentes';
import Hallazgos from './components/Hallazgos';
import Planes from './components/Planes';
import Trazabilidad from './components/Trazabilidad';
import Evaluaciones from './components/Evaluaciones';
import Riesgos from './components/Riesgos';
import Apetito from './components/Apetito';
import PlanAnual from './components/PlanAnual';
import Tablero from './components/Tablero';
import DashboardRiesgos from './components/DashboardRiesgos';
import AuditorIA from './components/AuditorIA';
import Comites from './components/Comites';

// =====================================================================
// 🤖 CONEXIÓN SEGURA A GEMINI PRO IA
// =====================================================================
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
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
  
  // 💡 Lógica para identificar y mostrar el Tooltip (title) correcto
  let tooltipText = "";
  if (label === "MITIGACIÓN GLOBAL" || label === "PLANES DE ACCIÓN") {
    tooltipText = "📍 ORIGEN: Planes de Acción\n❓ POR QUÉ: Mide el esfuerzo de mitigación\n📝 EXPLICACIÓN: Tareas y acciones correctivas que el equipo tiene actualmente en progreso o pendientes.";
  } else if (label === "CONTROLES DE SALUD" || label === "SALUD DE CONTROLES") {
    tooltipText = "📍 ORIGEN: Auditoría de Controles\n❓ POR QUÉ: Indica la cobertura de nuestro aseguramiento\n📝 EXPLICACIÓN: Porcentaje de controles que han sido evaluados frente al universo total de riesgos.";
  }

  return (
    <div 
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center h-full hover:shadow-md transition-shadow cursor-help"
      title={tooltipText}
    >
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
const [auditoresLista, setAuditoresLista] = useState(["Rodolfo González", "Yehison Pineda", "Angelica Hernandez", "Luz Angela Chico"]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [matrizFiltro, setMatrizFiltro] = useState(null);

// =========================================================
  // 🤖 NUEVOS ESTADOS: AUDITOR IA (PANEL OSCURO FLOTANTE)
  // =========================================================
  const [showAuditorIA, setShowAuditorIA] = useState(false);
  const [auditorInput, setAuditorInput] = useState('');
  const [auditorRespuesta, setAuditorRespuesta] = useState('');
  const [isAuditorThinking, setIsAuditorThinking] = useState(false);

// 🔐 ESTADOS DE AUTENTICACIÓN
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // ✏️ ESTADOS DE EDICIÓN Y COMPONENTES
  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);
  const [editCronograma, setEditCronograma] = useState(null);
  const [editApetito, setEditApetito] = useState(null);
  const [editMonitoreo, setEditMonitoreo] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);
// --- NUEVOS ESTADOS PARA INFORMES DE AUDITORÍA ---
  const [informesAuditoria, setInformesAuditoria] = useState([]);
  const [editInformeAuditoria, setEditInformeAuditoria] = useState(null);
const [comites, setComites] = useState([]);
const [editComite, setEditComite] = useState(null);

 // =====================================================================
  // ⚙️ ENTIDADES PRINCIPALES (ESTADOS DE BASE DE DATOS)
  // =====================================================================
  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);

  const safeRiesgos = Array.isArray(riesgos) ? riesgos : [];
  const safeHallazgos = Array.isArray(hallazgos) ? hallazgos : [];
  const safePlanes = Array.isArray(planes) ? planes : [];
  const safeIncidentes = Array.isArray(incidentes) ? incidentes : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];
  const safeCronograma = Array.isArray(cronograma) ? cronograma : [];
  const safeMonitoreo = Array.isArray(monitoreo) ? monitoreo : [];
  const safeComites = Array.isArray(comites) ? comites : [];

  // =====================================================================
  // 🗓️ FILTROS DE PERIODICIDAD INTELIGENTES Y ABIERTOS
  // =====================================================================
  const [periodFilters, setPeriodFilters] = useState({});

  // 🔥 ESCÁNER DINÁMICO: Encuentra automáticamente todos los años con datos + año actual
  const defaultAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3]);

    // Extrae dinámicamente cualquier año registrado en tus módulos
    safeRiesgos.forEach(r => r.anio && yearsSet.add(Number(r.anio)));
    safeHallazgos.forEach(h => h.anio && yearsSet.add(Number(h.anio)));
    safePlanes.forEach(p => p.anio && yearsSet.add(Number(p.anio)));
    safeIncidentes.forEach(i => i.anio && yearsSet.add(Number(i.anio)));
    safeCronograma.forEach(c => c.anio && yearsSet.add(Number(c.anio)));

    // Devuelve la lista ordenada de menor a mayor
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [safeRiesgos, safeHallazgos, safePlanes, safeIncidentes, safeCronograma]);

  const defaultMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // El sistema lee la pestaña activa y saca su filtro correspondiente
  const selectedAnios = periodFilters[activeTab]?.anios || defaultAnios;
  const selectedMeses = periodFilters[activeTab]?.meses || defaultMeses;

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
        setShowWelcome(true); // 🛡️ ¡LÍNEA NUEVA! Cada vez que se cierre sesión, reinicia la bienvenida a true
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
setComites(data.comites || []);
setAuditoresLista(data.auditoresLista || ["Rodolfo González", "Yehison Pineda", "Angelica Hernandez", "Luz Angela Chico"]);
      } else {
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
           setDoc(docRef, { riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, cronograma: defaultCronograma, monitoreo: defaultMonitoreo, informesAuditoria: [], comites: [] });
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

const handleLogout = async () => { 
    await signOut(auth); 
    setShowWelcome(true); // 🛡️ Asegura que al dar clic al botón se active la pantalla de nuevo
  };
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

  // =====================================================================
  // 🧠 FUNCIÓN CENTRAL DEL "AUDITOR IA" (SOPORTE DE CLIC AUTOMÁTICO E INTEGRAL)
  // =====================================================================
  const handleAuditorSubmit = async (e, textoDirecto = null) => {
    if (e) e.preventDefault(); // Evita recargar la página si viene de un formulario
    
    // Si viene de un clic directo usa ese texto, si no, usa el del input bar
    const consultaFinal = textoDirecto || auditorInput;
    if (!consultaFinal.trim()) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;

    if (!apiKey) {
      setAuditorRespuesta("⚠️ Error: No se encontró la API Key en tu archivo .env local o en Vercel.");
      return;
    }

    setIsAuditorThinking(true);
    setAuditorRespuesta('');

    try {
      const hoy = new Date();

      // 🛑 EXTRACCIÓN DE DATOS FILTRADOS POR EL PERIODO SELECCIONADO
      const riesgosBase = rFiltrados;
      const hallazgosBase = hFiltrados;
      const planesBase = pFiltrados;
      const incidentesBase = incFiltrados;
      const cronogramaBase = cFiltrados;

      // 🛑 MÓDULO 1: MATRIZ DE RIESGOS
      const totalRiesgos = riesgosBase.length;
      let criticosTotal = 0;
      let riesgosOperativos = riesgosBase.filter(r => r.categoria === 'Operativo').length;
      let riesgosEstrategicos = riesgosBase.filter(r => r.categoria === 'Estratégico').length;
      let riesgosTecnologicos = riesgosBase.filter(r => r.categoria === 'Tecnológico').length;
      try {
        criticosTotal = riesgosBase.filter(r => r.probabilidadResidual && r.impactoResidual && calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
      } catch(err) {}

      // 📄 MÓDULO 2 & 3: HALLAZGOS Y PLANES
      const totalHallazgos = hallazgosBase.length;
      const hallazgosAbiertos = hallazgosBase.filter(h => h.estado === 'Abierto').length;
      const hallazgosCerrados = totalHallazgos - hallazgosAbiertos;
      const totalPlanes = planesBase.length;
      const planesVencidos = planesBase.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy).length;
      const avancePlanesGlobal = totalPlanes > 0 ? Math.round(planesBase.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / totalPlanes) : 0;

      // 🚨 MÓDULO 4: INCIDENTES Y PÉRDIDAS
      const totalIncidentes = incidentesBase.length;
      const lossesAcumuladas = incidentesBase.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);

      // 🔬 MÓDULO 5: AUDITORÍA DE CONTROLES
      const evalFiltradas = safeEvaluaciones.filter(filterByGlobalPeriod);
      const totalEvaluaciones = evalFiltradas.length;
      const controlesEficaces = evalFiltradas.filter(ev => ev.calificacion === 100).length;
      const efectividadControlesGlobal = totalEvaluaciones > 0 ? Math.round((controlesEficaces / totalEvaluaciones) * 100) : 0;

      // 🗓️ MÓDULO 6: PLAN ANUAL DE AUDITORÍA
      const totalCronograma = cronogramaBase.length;
      const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
      const avanceCronogramaGlobal = cronogramaIniciados.length > 0 
        ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) 
        : 0;
      const pendientesArray = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) < 100).map(c => c.proceso);
      const listadoPendientesCronograma = pendientesArray.length > 0 ? pendientesArray.join(', ') : 'Ninguno (100% de ejecución)';

      // 📁 NUEVO MÓDULO 7: INFORMES EMITIDOS
      const totalInformes = (Array.isArray(informesAuditoria) ? informesAuditoria : []).length;

      // 📈 NUEVO MÓDULO 8: INDICADORES DE MONITOREO
      const totalIndicadores = safeMonitoreo.length;
      const alertasIndicadores = safeMonitoreo.filter(m => m.valor > m.limite).map(m => m.indicador).join(', ') || 'Ninguno bajo alerta crítica';

      // 2. RE-ESTRUCTURACIÓN COMPLETA DEL PROMPT CON TODOS LOS MÓDULOS
      const megaContexto = `
        Actúas como el "Auditor IA", un asistente senior del equipo de CONTROL INTERNO de TERMALES DE SANTA ROSA.
        Eres directo, ejecutivo y experto en GRC. Responde utilizando únicamente esta radiografía matemática filtrada del sistema:

        [DATOS DEL DASHBOARD EJECUTIVO Y GENERAL]
        - Cumplimiento de Ejecución del Plan Anual: ${avanceCronogramaGlobal}%
        - Avance Físico de Planes de Mejoramiento: ${avancePlanesGlobal}%
        - Efectividad General de Controles Auditados: ${efectividadControlesGlobal}%

        [DATOS DE MATRIZ DE RIESGOS]
        - Total Riesgos Identificados: ${totalRiesgos}
        - Riesgos Críticos o Extremos (Zona Roja Crítica): ${criticosTotal}
        - Clasificación: Operativos (${riesgosOperativos}), Estratégicos (${riesgosEstrategicos}), Tecnológicos (${riesgosTecnologicos}).

        [DATOS DE PLANES DE MEJORAMIENTO Y GOBERNANZA]
        - Planes de Acción Totales: ${totalPlanes} (Planes Vencidos: ${planesVencidos})
        - Hallazgos/Desviaciones Abiertas detectadas: ${hallazgosAbiertos} (Cerradas: ${hallazgosCerrados})

        [DATOS DE EVENTOS DE PÉRDIDA E INCIDENTES]
        - Total Incidentes Materializados: ${totalIncidentes}
        - Impacto Financiero Acumulado: $${lossesAcumuladas.toLocaleString('es-CO')} COP

        [DATOS DE INFORMES EMITIDOS]
        - Total Informes Radicados Formalmente en el Repositorio: ${totalInformes} informes emitidos.

        [DATOS DE INDICADORES DE MONITOREO]
        - Total Indicadores en Seguimiento Continuo: ${totalIndicadores}
        - Indicadores que superan límites máximos de alerta: [ ${alertasIndicadores} ]

        REGLAS OBLIGATORIAS DE RESPUESTA:
        1. RESPONDE EXCLUSIVAMENTE SOBRE EL TEMA DE LA PREGUNTA. Si seleccionan Riesgos, habla de riesgos. Si seleccionan Informes, habla de informes. No mezcles métricas de otros módulos.
        2. COMIENZA RESPONDIENDO AL GRANO. La primera línea debe contener el dato exacto de forma contundente (Ej: "A hoy Control Interno registra un total de ${totalInformes} informes emitidos...", "La efectividad general de los controles se encuentra en un ${efectividadControlesGlobal}%...").
        3. SÉ UN CONSULTOR DE CONTROL INTERNO. Añade un breve párrafo analítico corporativo senior evaluando si la gestión de ese módulo va por buen camino o si requiere atención urgente según las cifras expuestas.
      `;

      const promptFinal = `${megaContexto}\n\nConsulta del Líder: "${consultaFinal}"`;

      // 3. LLAMADO DE BAJA TEMPERATURA A GEMINI 2.5 FLASH
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptFinal }] }],
          generationConfig: { temperature: 0.1 }
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error?.message || `Error HTTP ${response.status}`);
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        setAuditorRespuesta(data.candidates[0].content.parts[0].text.trim());
      } else {
        throw new Error("Respuesta vacía del servidor.");
      }

    } catch (error) {
      console.error("🔍 Error IA:", error);
      setAuditorRespuesta(`❌ Error en consolidación de datos: ${error.message}`);
    } finally {
      setIsAuditorThinking(false);
      setAuditorInput(''); 
    }
  };

// =====================================================================
  // 📥 FUNCIONES DE EXPORTACIÓN (EXCEL Y JSON)
  // =====================================================================
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

// --- FILTROS GLOBALES OPTIMIZADOS ---
  const incFiltrados = useMemo(() => safeIncidentes.filter(filterByGlobalPeriod), [safeIncidentes, selectedAnios, selectedMeses]);
  const rFiltrados = useMemo(() => safeRiesgos.filter(filterByGlobalPeriod), [safeRiesgos, selectedAnios, selectedMeses]);
  const hFiltrados = useMemo(() => safeHallazgos.filter(filterByGlobalPeriod), [safeHallazgos, selectedAnios, selectedMeses]);
  const pFiltrados = useMemo(() => safePlanes.filter(filterByGlobalPeriod), [safePlanes, selectedAnios, selectedMeses]);

  // ✨ ESTA ES LA VERSIÓN REAL Y AUTOMÁTICA PARA TUS COMITÉS:
  const comitesFiltrados = useMemo(() => {
    return safeComites.filter(c => {
      const anioComite = Number(c.anio) || new Date().getFullYear();
      const mesComite = c.mes || '';
      const cumpleAnio = selectedAnios.length === 0 || selectedAnios.includes(anioComite);
      const cumpleMes = selectedMeses.length === 0 || selectedMeses.includes(mesComite);
      return cumpleAnio && cumpleMes;
    });
  }, [safeComites, selectedAnios, selectedMeses]);

  const cFiltrados = useMemo(() => safeCronograma.filter(c => {
    const anio = Number(c.anio) || new Date().getFullYear();
    return selectedAnios.length === 0 || selectedAnios.includes(anio);
  }), [safeCronograma, selectedAnios]);

// =====================================================================
  // --- SUBMITS DE ACCIONES CON TRAZABILIDAD DE AUTOR COMPLETA ---
  // =====================================================================
// =====================================================================
  // ⚡ MOTOR NATIVO GOOGLE GMAIL API OAUTH2 (REEMPLAZO TOTAL DE EMAILJS)
  // =====================================================================
  const ejecutarDespachoGmailApi = async (emailParams) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      alert("⚠️ El SDK de Google aún está cargando. Espere un segundo e intente de nuevo.");
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: '310037504694-oaut36369g0d9p508time7un94tkksjk.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/gmail.send',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error("Error OAuth:", tokenResponse);
            return;
          }

          const accessToken = tokenResponse.close || tokenResponse.access_token;

          // 🆔 DICCIONARIO PARA TRADUCIR EL CORREO AL NOMBRE REAL DEL AUDITOR
          const mapaNombresAudtores = {
            "controlinterno@termales.com.co": "Yehison Pineda",
            "analista.auditoria@termales.com.co": "Angelica Hernandez",
            "analista.controlinterno@termales.com.co": "Luz Angela Chico",
            "auditoria@termales.com.co": "Rodolfo Gonzalez"
          };

          // Extraemos el correo actual logueado y buscamos su nombre (o dejamos el correo si no coincide)
          const correoActual = String(user?.email || '').toLowerCase().trim();
          const nombreAuditorIdentificado = mapaNombresAudtores[correoActual] || correoActual;

// Estructura Sobria y Elegante con URL Institucional de Google Cloud Storage (Inmune a Bloqueos)
          const mensajeMime = [
            `To: ${emailParams.destinatarios}`,
            `Subject: [GCM Auditor] ${emailParams.ref_consecutivo} - ${emailParams.proceso_auditado}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            '<div style="background-color: #f8fafc; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; min-height: 100%; width: 100%; box-sizing: border-box; text-align: center;">',
            '  <div style="max-width: 500px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 0; margin: 0 auto; text-align: left; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden;">',
            '    ',
            '    ',
            '    <div style="padding: 25px 25px 20px 25px; text-align: left; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">',
            '      <table style="width: 100%; border-collapse: collapse;">',
            '        <tr>',
            '          <td style="width: 65px; vertical-align: middle;">',
            '            <img src="https://firebasestorage.googleapis.com/v0/b/auditoria-gcm.appspot.com/o/logo_termales.png?alt=media" alt="Termales" width="55" style="width: 55px; height: auto; display: block; max-height: 55px; border: 0;" />',
            '          </td>',
            '          <td style="padding-left: 12px; vertical-align: middle; border-left: 1px solid #e2e8f0; padding-top: 2px; padding-bottom: 2px;">',
            '            <div style="color: #0f172a; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; font-family: sans-serif;">GCM AUDITOR</div>',
            '            <div style="color: #64748b; font-size: 10px; font-weight: 600; letter-spacing: 1px; margin-top: 1px;">Gestión • Control • Mejora</div>',
            '          </td>',
            '        </tr>',
            '      </table>',
            '    </div>',
            '    ',
            '    ',
            '    <div style="padding: 30px 25px;">',
            '      ',
            '      ',
            '      <div style="text-align: center; margin-bottom: 15px;">',
            '        <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 50%; border: 1px solid #10b981; text-align: center; font-size: 18px; color: #10b981; background-color: #f0fdf4;">📄</div>',
            '      </div>',
            '      ',
            '      ',
            '      <div style="text-align: center; margin-bottom: 25px;">',
            '        <div style="font-size: 11px; font-weight: 800; color: #10b981; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">NUEVO INFORME</div>',
            `        <div style="font-size: 34px; font-weight: 800; color: #0f172a; letter-spacing: -1px; margin-bottom: 8px;">${emailParams.ref_consecutivo}</div>`,
            '        <p style="font-size: 12px; color: #64748b; margin: 0; font-weight: 500; line-height: 1.5;">Se ha registrado y liberado un nuevo dictamen en el repositorio oficial de Control Interno.</p>',
            '      </div>',
            '      ',
            '      ',
            '      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #f1f5f9; border-radius: 14px; background-color: #ffffff;">',
            '        <tr>',
            '          <td style="width: 50%; padding: 14px; text-align: center; border-right: 1px solid #f1f5f9;">',
            '            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; display: block; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">ESTADO</span>',
            '            <span style="font-size: 12px; font-weight: 800; color: #0f172a;"><span style="color: #10b981; font-size: 14px; vertical-align: middle; margin-right: 3px;">●</span> NUEVO</span>',
            '          </td>',
            '          <td style="width: 50%; padding: 14px; text-align: center;">',
            '            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; display: block; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">PRIORIDAD</span>',
            '            <span style="font-size: 12px; font-weight: 800; color: #ef4444;"><span style="vertical-align: middle; margin-right: 3px;">🚩</span> ALTA</span>',
            '          </td>',
            '        </tr>',
            '      </table>',
            '      ',
            '      ',
            '      <div style="border: 1px solid #f1f5f9; border-radius: 14px; background-color: #ffffff; padding: 4px 16px; margin-bottom: 20px;">',
            '        <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-weight: 600;">',
            `          <tr style="border-bottom: 1px solid #f8fafc;"><td style="padding: 12px 0; color: #64748b; font-weight: 500;">📋 Módulo / Proceso:</td><td style="padding: 12px 0; color: #10b981; text-align: right; font-weight: 700; text-transform: capitalize;">${emailParams.proceso_auditado}</td></tr>`,
            `          <tr style="border-bottom: 1px solid #f8fafc;"><td style="padding: 12px 0; color: #64748b; font-weight: 500;">👤 Responsable Emisor:</td><td style="padding: 12px 0; color: #0f172a; text-align: right; font-weight: 700;">${nombreAuditorIdentificado}</td></tr>`,
            '          <tr><td style="padding: 12px 0; color: #64748b; font-weight: 500;">🗂️ Tipo de Novedad:</td><td style="padding: 12px 0; color: #10b981; text-align: right; font-weight: 700;">Informe de Auditoría</td></tr>',
            '        </table>',
            '      </div>',
            '      ',
            '      ',
            '      <div style="border: 1px solid #f1f5f9; border-radius: 14px; background-color: #f8fafc; padding: 16px; margin-bottom: 25px;">',
            '        <table style="width: 100%; border-collapse: collapse;">',
            '          <tr>',
            '            <td style="width: 24px; vertical-align: top; font-size: 16px; color: #10b981; padding-top: 1px;">🛡️</td>',
            '            <td style="padding-left: 10px; vertical-align: top; text-align: left;">',
            '              <div style="font-size: 9px; font-weight: 800; color: #10b981; letter-spacing: 1px; margin-bottom: 4px; text-transform: uppercase;">RESUMEN DEL DICTAMEN</div>',
            `              <div style="font-size: 12px; color: #334155; font-weight: 600; line-height: 1.4;">${emailParams.titulo_informe}</div>`,
            '            </td>',
            '          </tr>',
            '        </table>',
            '      </div>',
            '      ',
            '      ',
            '      <div style="text-align: center; margin-bottom: 30px;">',
            `        <a href="${emailParams.enlace_pdf}" style="display: block; background-color: #00965e; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 14px 20px; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px; text-align: center; font-family: sans-serif;">`,
            '          Ver Informe Completo &nbsp; →',
            '        </a>',
            '      </div>',
            '      ',
            '      ',
            '      <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">',
            '        <table style="width: 100%; border-collapse: collapse;">',
            '          <tr>',
            '            <td style="width: 50%; vertical-align: top; padding-right: 10px;">',
            '              <table style="width: 100%; border-collapse: collapse;">',
            '                <tr>',
            '                  <td style="width: 25px; vertical-align: top; font-size: 15px; color: #10b981;">🛡️</td>',
            '                  <td style="font-size: 10px; color: #64748b; font-weight: 500; line-height: 1.4; text-align: left;">',
            '                    Para ver el desglose, evidencias adjuntas y responder la matriz, ingrese a la app web corporativa.',
            '                  </td>',
            '                </tr>',
            '              </table>',
            '            </td>',
            '            <td style="width: 50%; vertical-align: top; padding-left: 10px; border-left: 1px solid #f1f5f9;">',
            '              <table style="width: 100%; border-collapse: collapse;">',
            '                <tr>',
            '                  <td style="width: 25px; vertical-align: top; font-size: 15px; color: #10b981;">🔒</td>',
            '                  <td style="font-size: 10px; color: #64748b; font-weight: 500; line-height: 1.4; text-align: left;">',
            '                    <span style="font-weight: 700; color: #334155;">Plataforma GCM Auditor</span><br>Gestión • Control • Mejora',
            '                  </td>',
            '                </tr>',
            '              </table>',
            '            </td>',
            '          </tr>',
            '        </table>',
            '      </div>',
            '      ',
            '    </div>',
            '  </div>',
            '</div>'
          ].join('\n');
          const base64Seguro = btoa(unescape(encodeURIComponent(mensajeMime)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const resGoogle = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ raw: base64Seguro })
          });

          if (resGoogle.ok) {
            showNotification("🚀 Notificación enviada físicamente desde tu cuenta de Gmail institucional.");
          } else {
            alert("❌ Error: Google Workspace rechazó el despacho del correo.");
          }
        }
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });

    } catch (err) {
      console.error("Error disparando login Gmail:", err);
    }
  };
 const handleRiesgoSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editRiesgo) {
      const mod = { ...editRiesgo, sede: formData.get('sede'), proceso: formData.get('proceso'), categoria: formData.get('categoria'), normativa: formData.get('normativa'), responsable: formData.get('responsable'), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: formData.get('probInh'), impactoInherente: formData.get('impInh'), probabilidadResidual: formData.get('probRes'), impactoResidual: formData.get('impRes'), capacidadRiesgo: editRiesgo.capacidadRiesgo||null, toleranciaFinanciera: editRiesgo.toleranciaFinanciera||null, apetitoFinanciero: editRiesgo.apetitoFinanciero||null, posturaEstrategica: editRiesgo.posturaEstrategica||null, kriScore: editRiesgo.kriScore||null, historialCambios: [...(editRiesgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado en matriz' }] };
      updated = safeRiesgos.map(r => r.id === editRiesgo.id ? mod : r); setEditRiesgo(null);
    } else {
      const nuevo = { id: Date.now(), sede: formData.get('sede'), proceso: formData.get('proceso'), categoria: formData.get('categoria'), normativa: formData.get('normativa'), responsable: formData.get('responsable'), noControl: 'C-' + Math.floor(Math.random() * 100 + 100), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: formData.get('probInh'), impactoInherente: formData.get('impInh'), probabilidadResidual: formData.get('probRes'), impactoResidual: formData.get('impRes'), anio: 2026, mes: "Junio", historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Creado' }] };
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

    // 🟢 CAMPOS CONECTADOS PARA EL PDF OFICIAL
    const fechaInicioVal = formData.get('fechaInicio') || '';
    const mecanismoVal = formData.get('mecanismo') || '';

    let updatedList;
    if (editPlan && isAdmin) {
      const modificado = { ...editPlan, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, evidenciaUrl: evidenciaUrlOut, fechaInicio: fechaInicioVal, mecanismo: mecanismoVal, historialCambios: [...(editPlan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan actualizado' }] };
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);
    } else if (!isAdmin) {
      const idHallazgo = parseInt(formData.get('idHallazgo'));
      const planToUpdate = safePlanes.find(p => p.idHallazgo === idHallazgo);
      
      if (planToUpdate) {
        const mod = { ...planToUpdate, progreso: progresoVal, estado: estadoVal, evidenciaUrl: evidenciaUrlOut, fechaInicio: fechaInicioVal, mecanismo: mecanismoVal, historialCambios: [...(planToUpdate.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Avance reportado por Jefe de área' }] };
        updatedList = safePlanes.map(p => p.id === planToUpdate.id ? mod : p);
      } else {
        showNotification("Error: No se encontró el plan asociado a este hallazgo.", "error");
        return;
      }
    } else {
      const nuevo = { id: Date.now(), idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, fechaInicio: fechaInicioVal, mecanismo: mecanismoVal, historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan asignado' }] };
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
    const idRiesgoVal = parseInt(formData.get('idRiesgo'));
    const noControlVal = formData.get('noControl') || ''; // 🆕 Capturamos el Control seleccionado

    let updatedList;
    if (editEvaluacion && isAdmin) {
      const mod = { 
        ...editEvaluacion, 
        idRiesgo: idRiesgoVal, 
        noControl: noControlVal, // 🆕 Guardamos el control en la edición
        diseño: formData.get('diseno'), 
        ejecucion: formData.get('ejecucion'), 
        calificacion: calif, 
        comentarios: formData.get('comentarios'), 
        evidenciaUrl: evidenciaUrlOut, 
        historialCambios: [...(editEvaluacion.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación modificada' }] 
      };
      updatedList = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? mod : ev);
      setEditEvaluacion(null);
    } else {
      const nuevo = { 
        id: Date.now(), 
        idRiesgo: idRiesgoVal, 
        noControl: noControlVal, // 🆕 Guardamos el control en el registro nuevo
        fecha: new Date().toISOString().split('T')[0], 
        diseño: formData.get('diseno'), 
        ejecucion: formData.get('ejecucion'), 
        calificacion: calif, 
        comentarios: formData.get('comentarios'), 
        auditor: user.email, 
        anio: 2026, 
        mes: "Junio", 
        evidenciaUrl: evidenciaUrlOut, 
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación de control registrada' }] 
      };
      updatedList = [...safeEvaluaciones, nuevo];
    }
    setEvaluaciones(updatedList); 
    await saveToCloud({ evaluaciones: updatedList }); 
    e.target.reset(); 
    showNotification("Evaluación registrada exitosamente.");
  };
const handleHallazgoSubmit = async (e) => {
  e.preventDefault(); 
  const formData = new FormData(e.target);
  const ts = new Date().toLocaleString();

  let evidenciaUrlOut = formData.get('evidenciaUrlInput') || editHallazgo?.evidenciaUrl || '';
  const causaVal = formData.get('causa') || '';
  const claseObservacionVal = formData.get('claseObservacion') || 'Oportunidad de Mejora';

  // 🔗 Captura del ID del informe seleccionado
  const idInformeVal = formData.get('idInforme') || '';

  let updated;
  if (editHallazgo) {
    const mod = { 
      ...editHallazgo, 
      idInforme: idInformeVal, 
      sede: formData.get('sede'), 
      ref: formData.get('ref'), 
      proceso: formData.get('proceso'), 
      responsable: formData.get('responsable'), 
      auditor: formData.get('auditor'), 
      titulo: formData.get('titulo'), 
      severidad: formData.get('severidad'), 
      evidenciaUrl: evidenciaUrlOut, 
      causa: causaVal, 
      claseObservacion: claseObservacionVal, 
      historialCambios: [...(editHallazgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Hallazgo modificado' }] 
    };
    updated = safeHallazgos.map(h => h.id === editHallazgo.id ? mod : h);
    setEditHallazgo(null);
  } else {
    const nuevo = { 
      id: Date.now(), 
      idInforme: idInformeVal, 
      sede: formData.get('sede'), 
      ref: formData.get('ref'), 
      proceso: formData.get('proceso'), 
      responsable: formData.get('responsable'), 
      auditor: formData.get('auditor'), 
      titulo: formData.get('titulo'), 
      severidad: formData.get('severidad'), 
      estado: 'Abierto', 
      fecha: new Date().toISOString().split('T')[0], 
      anio: 2026, 
      mes: "Junio", 
      evidenciaUrl: evidenciaUrlOut, 
      causa: causaVal, 
      claseObservacion: claseObservacionVal, 
      historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Desviación documentada' }] 
    };
    updated = [...safeHallazgos, nuevo];
  }
  setHallazgos(updated); 
  await saveToCloud({ hallazgos: updated }); 
  e.target.reset(); 
  showNotification("Desviación conectada al informe de origen correctamente.");
};
const handleComiteSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;

    if (editComite) {
      const mod = {
        ...editComite,
        nombre: formData.get('nombre'),
        tipo: formData.get('tipo'),
        fecha: formData.get('fecha'),
        presentacionUrl: formData.get('presentacionUrl'),
        actaUrl: formData.get('actaUrl'),
        compromisos: formData.get('compromisos'),
        historialCambios: [...(editComite.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado' }]
      };
      updated = safeComites.map(c => c.id === editComite.id ? mod : c);
      setEditComite(null);
    } else {
      const fechaCorte = new Date(formData.get('fecha') + 'T00:00:00');
      const nuevo = {
        id: Date.now(),
        nombre: formData.get('nombre'),
        tipo: formData.get('tipo'),
        fecha: formData.get('fecha'),
        presentacionUrl: formData.get('presentacionUrl'),
        actaUrl: formData.get('actaUrl'),
        compromisos: formData.get('compromisos'),
        anio: fechaCorte.getFullYear(),
        mes: defaultMeses[fechaCorte.getMonth()],
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Radicado sesión' }]
      };
      updated = [nuevo, ...safeComites];
    }

    setComites(updated);
    await saveToCloud({ comites: updated });
    e.target.reset();
    showNotification("Sesión de comité guardada con éxito.");
  };
  const handleIncidenteSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    let updated;
    if (editIncidente) {
      const mod = { ...editIncidente, idRiesgo: parseInt(formData.get('idRiesgo')), titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), costo: parseFloat(formData.get('costo') || 0), impacto: formData.get('impacto'), historialCambios: [...(editIncidente.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Modificado' }] };
      updated = safeIncidentes.map(i => i.id === editIncidente.id ? mod : i);
      setEditIncidente(null);
    } else {
      const nuevo = { id: Date.now(), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), costo: parseFloat(formData.get('costo') || 0), impacto: formData.get('impacto'), reportadoPor: user.email, estado: 'Abierto', anio: 2026, mes: "Junio", historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evento de pérdida registrado' }] };
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
    if (listType === 'informesAuditoria') { updated = informesAuditoria.filter(i => i.id !== id); setInformesAuditoria(updated); } // <--- LÍNEA CORREGIDA
if (listType === 'comites') { updated = safeComites.filter(c => c.id !== id); setComites(updated); }
    
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
    e.preventDefault(); 
    setIsSubmitting(true); 
    console.log("🚀 Ejecución global V5 (Con Campos PDF Big-4)...");
    
    try {
      const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
      const formData = new FormData(e.target);

      const tituloVal = formData.get('titulo') || 'Sin título';
      const procesoVal = formData.get('proceso') || 'Sin proceso';
      const evidenciaUrlOut = formData.get('evidenciaUrlInput') || editInformeAuditoria?.evidenciaUrl || '';
      const actaSocializacionUrlOut = formData.get('actaSocializacionUrlInput') || editInformeAuditoria?.actaSocializacionUrl || '';
      const correosNotificacionOut = String(formData.get('correosNotificacionInput') || '').trim();

      const fechaVal = formData.get('fecha') || editInformeAuditoria?.fecha || new Date().toISOString().split('T')[0];
      const elaboradoPorVal = formData.get('elaboradoPor') || editInformeAuditoria?.elaboradoPor || '';
      const revisadoPorVal = formData.get('revisadoPor') || editInformeAuditoria?.revisadoPor || '';
      const aprobadoPorVal = formData.get('aprobadoPor') || editInformeAuditoria?.aprobadoPor || '';
      const socializadoVal = formData.get('socializado') || editInformeAuditoria?.socializado || 'No';
      const socializadoConVal = formData.get('socializadoCon') || editInformeAuditoria?.socializadoCon || '';

      // 🌟 NUEVOS CAMPOS EDITORIALES PARA EL PDF
      const objetivoVal = formData.get('objetivo') || editInformeAuditoria?.objetivo || 'Evaluar la eficacia de los controles y la gestión de riesgos...';
      const alcanceVal = formData.get('alcance') || editInformeAuditoria?.alcance || 'La auditoría cubre los procesos y sistemas...';
      const conclusionVal = formData.get('conclusion') || editInformeAuditoria?.conclusion || '';
      const fortalezasVal = formData.get('fortalezas') || editInformeAuditoria?.fortalezas || '';
      
      // 🖼️ NUEVOS CAMPOS DE GALERÍA DE EVIDENCIAS
      const img1Url = formData.get('img1Url') || editInformeAuditoria?.img1Url || '';
      const img1Desc = formData.get('img1Desc') || editInformeAuditoria?.img1Desc || '';
      const img2Url = formData.get('img2Url') || editInformeAuditoria?.img2Url || '';
      const img2Desc = formData.get('img2Desc') || editInformeAuditoria?.img2Desc || '';
      const img3Url = formData.get('img3Url') || editInformeAuditoria?.img3Url || '';
      const img3Desc = formData.get('img3Desc') || editInformeAuditoria?.img3Desc || '';
      const img4Url = formData.get('img4Url') || editInformeAuditoria?.img4Url || '';
      const img4Desc = formData.get('img4Desc') || editInformeAuditoria?.img4Desc || '';

      let updated;
      let refConsecutivoFinal = '';

      if (editInformeAuditoria) {
        refConsecutivoFinal = editInformeAuditoria.ref;
        const mod = { 
          ...editInformeAuditoria, titulo: tituloVal, proceso: procesoVal, fecha: fechaVal,
          elaboradoPor: elaboradoPorVal, revisadoPor: revisadoPorVal, aprobadoPor: aprobadoPorVal,
          socializado: socializadoVal, socializadoCon: socializadoConVal,
          evidenciaUrl: evidenciaUrlOut, actaSocializacionUrl: actaSocializacionUrlOut,
          objetivo: objetivoVal, alcance: alcanceVal, conclusion: conclusionVal, fortalezas: fortalezasVal,
          img1Url, img1Desc, img2Url, img2Desc, img3Url, img3Desc, img4Url, img4Desc
        };
        updated = safeInformes.map(inf => inf.id === editInformeAuditoria.id ? mod : inf);
        setEditInformeAuditoria(null);
      } else {
        const ultimo = Math.max(...safeInformes.map(i => parseInt(i.ref?.split('-')[2] || 0)), 0);
        const idx = ultimo + 1;

        refConsecutivoFinal = `INF-2026-${String(idx).padStart(3, '0')}`;
        const nuevo = {
          id: crypto.randomUUID(), ref: refConsecutivoFinal, titulo: tituloVal, proceso: procesoVal,
          fecha: fechaVal, elaboradoPor: elaboradoPorVal, revisadoPor: revisadoPorVal,
          aprobadoPor: aprobadoPorVal, socializado: socializadoVal, socializadoCon: socializadoConVal,
          evidenciaUrl: evidenciaUrlOut, actaSocializacionUrl: actaSocializacionUrlOut,
          objetivo: objetivoVal, alcance: alcanceVal, conclusion: conclusionVal, fortalezas: fortalezasVal,
          img1Url, img1Desc, img2Url, img2Desc, img3Url, img3Desc, img4Url, img4Desc
        };
        updated = [nuevo, ...safeInformes];
      }

      // 🟢 DISPARADOR GMAIL API INTEGRADO (INFORME EMITIDO)
      if (correosNotificacionOut !== '') {
        await ejecutarDespachoGmailApi({
          ref_consecutivo: refConsecutivoFinal,
          titulo_informe: `Radicación de Informe: ${tituloVal}`,
          proceso_auditado: procesoVal,
          enlace_pdf: evidenciaUrlOut || 'https://auditoria-gcm.vercel.app',
          destinatarios: correosNotificacionOut
        });
      }
      setInformesAuditoria(updated);    
      await saveToCloud({ informesAuditoria: updated });
      e.target.reset();
      showNotification("Informe de auditoría procesado y guardado correctamente.");

    } catch (error) {
      console.error("Error crítico al procesar informe:", error);
      showNotification("Hubo un error al procesar la solicitud.", "error");
    } finally {
      setIsSubmitting(false); 
    }
  };
const renderHeaderFiltros = (titulo, subtitulo) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50"></div>
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{titulo}</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">{subtitulo}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Años de Análisis</label>
            <div className="flex flex-wrap gap-2">
              {defaultAnios.map(anio => (
                <button key={`filt-anio-${anio}`} onClick={() => toggleAnio(anio)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm border ${selectedAnios.includes(anio) ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {anio}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Meses de Análisis</label>
            <div className="flex flex-wrap gap-1.5">
              {defaultMeses.map(mes => (
                <button key={`filt-mes-${mes}`} onClick={() => toggleMes(mes)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border shadow-sm notranslate ${selectedMeses.includes(mes) ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`} translate="no" title={mes}>
                  {mes.substring(0,3)}
                </button>
              ))}
            </div>
          </div>
          {(selectedAnios.length > 0 || selectedMeses.length > 0) && (
            <div className="flex items-end">
              <button onClick={() => { setSelectedAnios([]); setSelectedMeses([]); }} className="h-[30px] px-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg text-[10px] font-bold transition-colors">
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // =====================================================================
  // RENDERS DE VISTAS (ADMIN INTERFACE)
  // =====================================================================


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

// =====================================================================
  // 📊 COMPONENTE AVANZADO: TABLERO ANALÍTICO EJECUTIVO E INTERACTIVO (GRC)
  // =====================================================================
const renderTableroAnalitico = () => {
    const hoy = new Date();

    const riesgosBase = typeof rFiltrados !== 'undefined' ? rFiltrados : (typeof riesgos !== 'undefined' ? riesgos : []);
    const hallazgosBase = typeof hFiltrados !== 'undefined' ? hFiltrados : (typeof hallazgos !== 'undefined' ? hallazgos : []);
    const planesBase = typeof pFiltrados !== 'undefined' ? pFiltrados : (typeof planes !== 'undefined' ? planes : []);

    const extraerNumeroPuro = (valor) => {
      if (!valor) return 0;
      const str = String(valor).toLowerCase().trim();
      const num = parseInt(str.charAt(0), 10);
      if (!isNaN(num)) return num;
      if (str === 'rara' || str === 'rara vez') return 1;
      if (str === 'improbable') return 2;
      if (str === 'posible') return 3;
      if (str === 'probable') return 4;
      if (str === 'casi seguro') return 5;
      if (str === 'insignificante') return 1;
      if (str === 'menor') return 2;
      if (str === 'moderado' || str === 'medio') return 3;
      if (str === 'mayor' || str === 'alto') return 4;
      if (str === 'catastrófico' || str === 'crítico') return 5;
      return 0;
    };

    const totalPlanes = planesBase.length;
    const planesActivos = planesBase.filter(p => p.estado !== 'Cerrado').length;
    const planesVencidos = planesBase.filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy).length;
    const planesCerrados = planesBase.filter(p => p.estado === 'Cerrado').length;
    const avancePlanesGlobal = totalPlanes > 0 ? Math.round((planesCerrados / totalPlanes) * 100) : 100;

    const totalRiesgos = riesgosBase.length;
    const riesgosCriticos = riesgosBase.filter(r => (extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual)) >= 16).length;
    const riesgosMedios = riesgosBase.filter(r => {
      const score = extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual);
      return score >= 6 && score < 16;
    }).length;
    const riesgosBajos = totalRiesgos - riesgosCriticos - riesgosMedios;

    const efectividadControlesGlobal = totalRiesgos > 0 ? Math.round(85 + (riesgosBajos * 1.5) - (riesgosCriticos * 2)) : 90; 

    const totalHallazgos = hallazgosBase.length;
    const hallazgosCriticosCount = hallazgosBase.filter(h => h.severidad === 'Crítica' || h.severidad === 'Alta' || h.severidad === 'Crítico').length;

    const contarRiesgosEnCelda = (p, i) => {
      return riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === p && extraerNumeroPuro(r.impactoResidual) === i).length;
    };

    const riesgosFiltradosPorMatriz = matrizFiltro 
      ? riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === matrizFiltro.p && extraerNumeroPuro(r.impactoResidual) === matrizFiltro.i)
      : riesgosBase.slice(0, 5);

    const planesVencidosList = planesBase
      .filter(p => p.estado !== 'Cerrado' && p.fecha && new Date(p.fecha) < hoy)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(0, 5);

    const cronogramaBase = typeof cFiltrados !== 'undefined' ? cFiltrados : (typeof cronograma !== 'undefined' ? cronograma : []);
    const proximasAuditorias = cronogramaBase
      .filter(c => (Number(c.cumplimiento) || 0) < 100)
      .slice(0, 4);

    let allActivity = [];
    const parseDateStr = (dateStr) => {
      try {
        const [datePart, timePart] = dateStr.split(', ');
        const [d, m, y] = datePart.split(/[\/\-]/);
        if (d && m && y) return new Date(`${y}-${m}-${d}T${timePart || '00:00:00'}`).getTime();
        return new Date(dateStr).getTime();
      } catch(e) { return 0; }
    };

    const addAct = (items, type, icon, colorClass) => {
      items.forEach(item => {
        if (item.historialCambios && item.historialCambios.length > 0) {
          const last = item.historialCambios[item.historialCambios.length - 1];
          allActivity.push({
             timestamp: parseDateStr(last.fecha),
             fechaStr: last.fecha,
             accion: last.accion,
             usuario: last.usuario || 'Sistema',
             ref: item.ref || (item.id ? `${type.substring(0,3).toUpperCase()}-${String(item.id).substring(0,5)}` : 'N/A'),
             proceso: item.proceso || 'General',
             type, icon, colorClass
          });
        }
      });
    };
    
    addAct(planesBase, 'Plan', '✅', 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30');
    addAct(hallazgosBase, 'Hallazgo', '⚠️', 'bg-amber-500/20 text-amber-400 border border-amber-500/30');
    addAct(riesgosBase, 'Riesgo', '🛡️', 'bg-red-500/20 text-red-400 border border-red-500/30');
    addAct(typeof informesAuditoria !== 'undefined' ? informesAuditoria : [], 'Informe', '📄', 'bg-blue-500/20 text-blue-400 border border-blue-500/30');
    
    allActivity.sort((a, b) => b.timestamp - a.timestamp);
    const recentActivityList = allActivity.slice(0, 4);

    return (
      <div className="flex-1 bg-[#060b16] text-slate-100 overflow-y-auto p-6 font-sans space-y-6 scrollbar-thin select-none">
        
        {/* ─── ENCABEZADO PREMIUM Y FILTROS INTEGRADOS ─── */}
        <div className="bg-[#0a1122] border border-blue-500/10 p-5 rounded-2xl shadow-md space-y-4 mb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800/80 pb-4 gap-4">
            <div>
              <h2 className="text-xl font-black tracking-wide text-white">Dashboard Ejecutivo</h2>
              <p className="text-xs text-slate-400 font-medium">Resumen general del Sistema de Control Interno y Gestión Integral del Riesgo</p>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              <div className="bg-[#111c35] border border-slate-700/50 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 flex items-center space-x-2">
                <span>📅</span> 
                <span>{`${String(hoy.getDate()).padStart(2, '0')} / ${defaultMeses[hoy.getMonth()]} / ${hoy.getFullYear()}`}</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-2 rounded-xl text-xs font-black tracking-widest uppercase flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span>En Línea</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-1 items-start md:items-end">
            <div className="flex flex-col">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Años de Análisis</label>
              <div className="flex flex-wrap gap-2">
                {defaultAnios.map(anio => (
                  <button key={`tablero-anio-${anio}`} onClick={() => toggleAnio(anio)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm border ${selectedAnios.includes(anio) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                    {anio}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Meses de Análisis</label>
              <div className="flex flex-wrap gap-1.5">
                {defaultMeses.map(mes => (
                  <button key={`tablero-mes-${mes}`} onClick={() => toggleMes(mes)} className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border shadow-sm notranslate ${selectedMeses.includes(mes) ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`} translate="no" title={mes}>
                    {mes.substring(0,3)}
                  </button>
                ))}
              </div>
            </div>
            {(selectedAnios.length > 0 || selectedMeses.length > 0) && (
              <div className="flex items-end mt-2 md:mt-0 md:ml-auto">
                <button onClick={() => { setSelectedAnios([]); setSelectedMeses([]); }} className="h-[30px] px-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-[10px] font-bold transition-colors uppercase tracking-wider">
                  Limpiar Filtros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── BLOQUE DE TARJETAS SUPERIORES CON TOOLTIPS PREMIUM ─── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
            <div className="flex justify-between items-start">
              <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Cumplimiento Global</span>
              <span className="text-lg">🎯</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-white">{avancePlanesGlobal}%</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Muy Bueno</span>
            </div>
            <div className="w-full h-8 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
              <svg viewBox="0 0 100 20" className="w-full h-full text-emerald-400" preserveAspectRatio="none">
                <path d="M0,15 Q20,5 40,12 T80,8 L100,2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-blue-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-blue-500/40 rotate-45"></div>
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Control</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Matriz Integrada de Planes de Acción.</p>
                <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Evalúa la efectividad de iniciativas de mitigación corporativa.</p>
                <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Avance físico promedio de tareas en progreso y cerradas.</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
            <div className="flex justify-between items-start">
              <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Riesgos Activos</span>
              <span className="text-lg">🔥</span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-black text-white">{totalRiesgos}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[9px] font-black tracking-wider uppercase">
              <span className="text-red-400">{riesgosCriticos} Críticos</span>
              <span className="text-amber-400">{riesgosMedios} Medios</span>
              <span className="text-emerald-400">{riesgosBajos} Bajos</span>
            </div>
            <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-red-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-red-500/40 rotate-45"></div>
              <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Riesgo</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Mapa de Calor Empresarial (Matriz 5x5).</p>
                <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Indica el grado de exposición al riesgo de la organización.</p>
                <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Total de riesgos vigentes mapeados por los líderes.</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
            <div className="flex justify-between items-start">
              <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Controles Auditados</span>
              <span className="text-lg">🛡️</span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-black text-white">{efectividadControlesGlobal}%</span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md">Eficaces</span>
            </div>
            <div className="w-full h-8 mt-2 opacity-60 group-hover:opacity-100 transition-opacity">
              <svg viewBox="0 0 100 20" className="w-full h-full text-cyan-400" preserveAspectRatio="none">
                <path d="M0,10 Q25,18 50,8 T100,5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-cyan-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-cyan-500/40 rotate-45"></div>
              <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Aseguramiento</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo de Auditoría de Controles.</p>
                <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Valida la efectividad real del diseño y operación de controles.</p>
                <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Porcentaje de pruebas evaluadas con éxito.</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
            <div className="flex justify-between items-start">
              <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Hallazgos Abiertos</span>
              <span className="text-lg">🔎</span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-black text-white">{totalHallazgos}</span>
            </div>
            <div className="mt-3 text-[10px] font-black uppercase text-red-400 tracking-wider">
              🚨 {hallazgosCriticosCount} Con Alerta Crítica
            </div>
            <div className="absolute top-[105%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-orange-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-t border-l border-orange-500/40 rotate-45"></div>
              <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Desviaciones</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Repositorio de Informes Emitidos.</p>
                <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Refleja la cantidad de brechas normativas no resueltas.</p>
                <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Conteo de no conformidades con estado 'Abierto'.</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg relative group overflow-visible hover:border-blue-500/50 transition-colors cursor-help">
            <div className="flex justify-between items-start">
              <span className="text-xs font-black tracking-wider text-slate-400 uppercase">Planes en Ejecución</span>
              <span className="text-lg">📝</span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-black text-white">{planesActivos}</span>
            </div>
            <div className="mt-3 text-[10px] font-black uppercase text-amber-500 tracking-wider">
              ⚠️ {planesVencidos} Vencidos / Retrasados
            </div>
            <div className="absolute top-[105%] left-[80%] -translate-x-[80%] w-64 bg-[#0f172a]/95 backdrop-blur-md border border-purple-500/40 p-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -top-2 left-[80%] -translate-x-[80%] w-4 h-4 bg-[#0f172a] border-t border-l border-purple-500/40 rotate-45"></div>
              <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 border-b border-slate-700/80 pb-1.5">Contexto de Gestión</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-300 font-medium">
                <p><b className="text-emerald-400 uppercase">📍 Origen:</b> Módulo de Planes de Acción.</p>
                <p><b className="text-amber-400 uppercase">❓ Justificación:</b> Indica la saturación operativa para el cierre de brechas.</p>
                <p><b className="text-slate-200 uppercase">📝 Metodología:</b> Sumatoria de planes cuyo estado es diferente a 'Cerrado'.</p>
              </div>
            </div>
          </div>

        </div>

        {/* ─── CUADRÍCULA PRINCIPAL CENTRAL CON POP-OVERS PREMIUM HACIA ARRIBA ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MAPA DE CALOR */}
          <div className="lg:col-span-2 bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">Mapa de Riesgos (Matriz 5x5)</h3>
              {matrizFiltro && (
                <button 
                  onClick={() => setMatrizFiltro(null)} 
                  className="text-[9px] bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-blue-400 font-bold uppercase tracking-wider"
                >
                  Clear Filtro
                </button>
              )}
            </div>

            <div className="flex items-center space-x-4 flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center -rotate-90 origin-center w-4">
                Impacto
              </div>

              <div className="flex-1 flex flex-col space-y-1">
                {[5, 4, 3, 2, 1].map((impactoLvl) => {
                  const etiquetasY = ["", "Insignificante", "Menor", "Moderado", "Mayor", "Catastrófico"];
                  return (
                    <div key={`row-${impactoLvl}`} className="flex items-center space-x-1 h-12">
                      <span className="w-24 text-[10px] font-bold text-slate-400 text-right pr-2 truncate">
                        {impactoLvl} {etiquetasY[impactoLvl]}
                      </span>
                      
                      {[1, 2, 3, 4, 5].map((probLvl) => {
                        const cant = contarRiesgosEnCelda(probLvl, impactoLvl);
                        let colorCelda = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"; 
                        const score = probLvl * impactoLvl;
                        if (score >= 5 && score <= 9) colorCelda = "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30";
                        else if (score >= 10 && score <= 15) colorCelda = "bg-orange-500/30 text-orange-400 border-orange-500/40 hover:bg-orange-500/40";
                        else if (score >= 16) colorCelda = "bg-red-500/30 text-red-400 border-red-500/50 hover:bg-red-500/40";

                        const isSelected = matrizFiltro?.p === probLvl && matrizFiltro?.i === impactoLvl;

                        return (
                          <button
                            key={`cell-${probLvl}-${impactoLvl}`}
                            onClick={() => {
                              setMatrizFiltro({ p: probLvl, i: impactoLvl });
                              const riesgosCelda = riesgosBase.filter(r => extraerNumeroPuro(r.probabilidadResidual) === probLvl && extraerNumeroPuro(r.impactoResidual) === impactoLvl);
                              
                              if (riesgosCelda.length > 0) {
                                setChartDetail({
                                  tipo: `Riesgos en Cuadrante (P:${probLvl} x I:${impactoLvl})`,
                                  mesCompleto: 'Detalle de Matriz 5x5',
                                  items: riesgosCelda.map(r => ({
                                     ref: r.id ? `RSG-${r.id}` : 'N/A',
                                     proceso: r.proceso || 'Proceso General',
                                     titulo: r.descripcion || r.riesgo || 'Riesgo sin descripción',
                                     sede: r.sede || 'No definida',
                                     responsable: r.responsable || 'Sin asignar',
                                     severidad: score >= 16 ? 'Crítico' : (score >= 10 ? 'Alto' : 'Medio')
                                  }))
                                });
                              }
                            }}
                            className={`flex-1 h-full rounded-lg border flex flex-col items-center justify-center font-black text-sm transition-all relative ${colorCelda} ${isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#060b16] scale-95 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : ''}`}
                          >
                            <span>{cant}</span>
                            {cant > 0 && <span className="absolute bottom-0.5 right-1 text-[12px] opacity-70 animate-pulse">🖱️</span>}
                          </button>
                        );
                      })}                      
                    </div>
                  );
                })}

                <div className="flex items-center space-x-1 pt-1 pl-24 text-center">
                  {["1 Rara vez", "2 Improbable", "3 Posible", "4 Probable", "5 Casi seguro"].map((probText, idx) => (
                    <span key={`prob-lbl-${idx}`} className="flex-1 text-[9px] font-bold text-slate-500 truncate">
                      {probText}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center mt-1">
                  Probabilidad
                </div>
              </div>
            </div>
            {/* TOOLTIP EXPULSADO HACIA ARRIBA */}
            <div className="absolute bottom-[102%] right-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Distribución Residual</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                <p><b className="text-emerald-400">📍 ORIGEN:</b> Matriz Integral de Riesgos.</p>
                <p><b className="text-amber-400">❓ POR QUÉ:</b> Interseca la Probabilidad x Impacto de la severidad del semáforo COSO.</p>
                <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Los cuadrantes filtran la grilla inferior automáticamente.</p>
              </div>
            </div>
          </div>

          {/* TENDENCIA HISTÓRICA */}
          {(() => {
            const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            const currentMonthIdx = hoy.getMonth();
            const ultimos6Meses = Array.from({length: 6}, (_, i) => {
                let m = currentMonthIdx - 5 + i;
                if (m < 0) m += 12;
                return { idx: m, nombre: mesesCortos[m], nombreLargo: defaultMeses[m] };
            });

            const trendData = ultimos6Meses.map(mInfo => {
               const riesgosMes = riesgosBase.filter(r => r.mes === mInfo.nombreLargo);
               const crit = riesgosMes.filter(r => (extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual)) >= 16).length;
               const med = riesgosMes.filter(r => {
                 const score = extraerNumeroPuro(r.probabilidadResidual) * extraerNumeroPuro(r.impactoResidual);
                 return score >= 6 && score < 16;
               }).length;
               const baj = riesgosMes.length - crit - med;
               return { mes: mInfo.nombre, crit, med, baj };
            });

            const maxVal = Math.max(1, ...trendData.flatMap(d => [d.crit, d.med, d.baj]));
            const getY = (val) => 35 - ((val / maxVal) * 25); 
            const getX = (idx) => (idx * (100 / 5)); 

            const pathCriticos = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.crit)}`).join(' ');
            const pathMedios = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.med)}`).join(' ');
            const pathBajos = trendData.map((d, i) => `${i===0?'M':'L'}${getX(i)},${getY(d.baj)}`).join(' ');

            const procesosCount = Object.entries(
              riesgosBase.reduce((acc, r) => {
                const proc = r.proceso || 'General / Otros';
                acc[proc] = (acc[proc] || 0) + 1;
                return acc;
              }, {})
            );
            
            const coloresMini = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899'];
            let offsetCirculo = 0;

            return (
              <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-2">Tendencia Histórica</h3>
                <div className="w-full h-36 mt-2 relative">
                  <svg viewBox="0 -5 100 45" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <line x1="0" y1="10" x2="100" y2="10" stroke="#1e293b" strokeWidth="0.2" strokeDasharray="1,1" />
                    <line x1="0" y1="20" x2="100" y2="20" stroke="#1e293b" strokeWidth="0.2" strokeDasharray="1,1" />
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#1e293b" strokeWidth="0.2" strokeDasharray="1,1" />
                    <path d={pathCriticos} fill="none" stroke="#ff4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={pathMedios} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={pathBajos} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex justify-between text-[8px] font-bold text-slate-500 mt-2 px-1 uppercase">
                    {trendData.map((d, i) => <span key={`mes-${i}`}>{d.mes}</span>)}
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-3 mt-3">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Distribución por Proceso</h4>
                  <div className="flex items-center justify-between space-x-4">
                    <div className="w-16 h-16 relative shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="4" />
                        {totalRiesgos > 0 && procesosCount.map(([proc, cant], idx) => {
                          const p = (cant / totalRiesgos) * 100;
                          const color = coloresMini[idx % coloresMini.length];
                          const dash = `${p} 100`;
                          const off = `-${offsetCirculo}`;
                          offsetCirculo += p;
                          return <circle key={`circ-${idx}`} cx="18" cy="18" r="15.915" fill="none" stroke={color} strokeWidth="4" strokeDasharray={dash} strokeDashoffset={off} className="transition-all duration-1000"/>;
                        })}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-[10px] font-black text-white leading-none">{totalRiesgos}</span>
                         <span className="text-[7px] text-slate-400 font-bold leading-none mt-0.5">Total</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 text-[9px] font-bold space-y-1 text-slate-400 overflow-y-auto max-h-20 scrollbar-none">
                      {totalRiesgos === 0 ? (
                        <div className="text-slate-500 italic text-[8px]">No hay riesgos registrados</div>
                      ) : (
                        procesosCount.map(([procesoNombre, cantidad], idx) => {
                          const porcentaje = Math.round((cantidad / totalRiesgos) * 100);
                          const colorActual = coloresMini[idx % coloresMini.length];
                          return (
                            <div key={`proc-dist-${idx}`} className="flex justify-between items-center hover:bg-slate-800/50 p-0.5 rounded transition-colors">
                              <span className="flex items-center truncate max-w-[140px]" title={procesoNombre}>
                                <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: colorActual }}></span>
                                {procesoNombre}
                              </span>
                              <span className="text-white ml-2 shrink-0">{porcentaje}% ({cantidad})</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                {/* TOOLTIP EXPULSADO HACIA ARRIBA */}
                <div className="absolute bottom-[102%] right-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
                  <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
                  <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Análisis de Tendencia</h4>
                  <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                    <p><b className="text-emerald-400">📍 ORIGEN:</b> Historial de Evaluaciones Corporativas.</p>
                    <p><b className="text-amber-400">❓ POR QUÉ:</b> Monitorea la concentración por área y la evolución mensual de criticidades.</p>
                    <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Histórico a 6 meses con distribución concéntrica por procesos.</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ─── ALERTAS INTELIGENTES (IA) ─── */}
        <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 flex items-center">
              <span className="text-base mr-1.5">🤖</span> Alertas y Recomendaciones IA
            </h3>
            <span className="text-[9px] font-black uppercase text-blue-400 cursor-pointer hover:underline">Monitoreo en vivo</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-left">
            <div className="bg-[#1c0d15] border border-red-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-red-500/40 transition-colors relative overflow-visible">
              <div className="text-red-400 text-lg bg-red-500/10 p-1.5 rounded-lg">⚠️</div>
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-black text-red-400">{riesgosCriticos} Riesgos Críticos Activos</h4>
                <p className="text-[9px] text-slate-400 font-medium">Requieren priorización de controles inmediata</p>
              </div>
            </div>

            <div className="bg-[#1c140d] border border-amber-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-amber-500/40 transition-colors relative overflow-visible">
              <div className="text-amber-400 text-lg bg-amber-500/10 p-1.5 rounded-lg">📝</div>
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-black text-amber-400">{planesVencidos} Planes de Acción Vencidos</h4>
                <p className="text-[9px] text-slate-400 font-medium">Planes retrasados fuera de la fecha límite establecida</p>
              </div>
            </div>

            <div className="bg-[#0d1624] border border-blue-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-blue-500/40 transition-colors relative overflow-visible">
              <div className="text-blue-400 text-lg bg-blue-500/10 p-1.5 rounded-lg">🔬</div>
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-black text-blue-400">{hallazgosCriticosCount} Hallazgos Críticos/Altos</h4>
                <p className="text-[9px] text-slate-400 font-medium">Pendientes de apertura de Plan de Acción formal</p>
              </div>
            </div>

            <div className="bg-[#091819] border border-cyan-500/20 p-3 rounded-xl flex items-start space-x-3 group cursor-pointer hover:border-cyan-500/40 transition-colors relative overflow-visible">
              <div className="text-cyan-400 text-lg bg-cyan-500/10 p-1.5 rounded-lg">💡</div>
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-black text-cyan-400">Eficiencia Global: {efectividadControlesGlobal}%</h4>
                <p className="text-[9px] text-slate-400 font-medium">Efectividad ponderada de la matriz de controles mitigantes</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── BLOQUE INFERIOR DE ACCIÓN (MÉTRICAS METAS Y KPI REALES) ─── */}
        {(() => {
          const totalHallazgosReal = hallazgosBase.length || 1; 
          const hCrit = hallazgosBase.filter(h => h.severidad === 'Crítico' || h.severidad === 'Crítica').length;
          const hAlt = hallazgosBase.filter(h => h.severidad === 'Alto' || h.severidad === 'Alta').length;
          const hMed = hallazgosBase.filter(h => h.severidad === 'Medio' || h.severidad === 'Media').length;
          const hBaj = hallazgosBase.filter(h => h.severidad === 'Bajo' || h.severidad === 'Baja').length;
          
          const pCrit = Math.round((hCrit / totalHallazgosReal) * 100) || 0;
          const pAlt = Math.round((hAlt / totalHallazgosReal) * 100) || 0;
          const pMed = Math.round((hMed / totalHallazgosReal) * 100) || 0;
          const pBaj = Math.round((hBaj / totalHallazgosReal) * 100) || 0;

          const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
          const kpiPlanAnual = cronogramaIniciados.length > 0 
            ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) 
            : 0;
          const kpiOportunidad = totalPlanes > 0 ? Math.round(((totalPlanes - planesVencidos) / totalPlanes) * 100) : 100;

          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
              
              <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-3">Severidad de Hallazgos</h3>
                <div className="flex items-center justify-around h-32">
                  <div className="w-24 h-24 relative">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90 drop-shadow-md">
                      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1e293b" strokeWidth="4" />
                      {pCrit > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ff4444" strokeWidth="4" strokeDasharray={`${pCrit} 100`} strokeDashoffset="0" className="transition-all duration-1000" />}
                      {pAlt > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#fbbf24" strokeWidth="4" strokeDasharray={`${pAlt} 100`} strokeDashoffset={`-${pCrit}`} className="transition-all duration-1000" />}
                      {pMed > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${pMed} 100`} strokeDashoffset={`-${pCrit + pAlt}`} className="transition-all duration-1000" />}
                      {pBaj > 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray={`${pBaj} 100`} strokeDashoffset={`-${pCrit + pAlt + pMed}`} className="transition-all duration-1000" />}
                    </svg>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 space-y-1">
                    <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>Críticos</span><span className="text-white">{hCrit} ({pCrit}%)</span></div>
                    <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>Altos</span><span className="text-white">{hAlt} ({pAlt}%)</span></div>
                    <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>Medios</span><span className="text-white">{hMed} ({pMed}%)</span></div>
                    <div className="flex items-center justify-between w-28"><span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>Bajos</span><span className="text-white">{hBaj} ({pBaj}%)</span></div>
                  </div>
                </div>
                {/* TOOLTIP EXPULSADO HACIA ARRIBA (CENTRAL) */}
                <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
                  <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Desglose de Criticidad</h4>
                  <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                    <p><b className="text-emerald-400">📍 ORIGEN:</b> Módulo Central de Hallazgos.</p>
                    <p><b className="text-amber-400">❓ POR QUÉ:</b> Clasifica la urgencia de atenciones de no conformidades operativas.</p>
                    <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Segmentación física de las desviaciones de auditoría.</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0a1122] border border-slate-800 p-5 rounded-2xl shadow-lg flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-3">Métricas de Planes</h3>
                <div className="space-y-3 font-bold text-xs text-slate-400">
                  <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-blue-500/30 transition-colors">
                    <span className="flex items-center">📈 Cumplimiento</span>
                    <span className="text-white font-black text-sm">{avancePlanesGlobal}%</span>
                  </div>
                  <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-cyan-500/30 transition-colors">
                    <span className="flex items-center">📂 Abiertos</span>
                    <span className="text-cyan-400 font-black">{planesActivos}</span>
                  </div>
                  <div className="bg-[#060b16] border border-slate-800/60 p-2.5 rounded-xl flex justify-between items-center hover:border-red-500/30 transition-colors">
                    <span className="text-slate-400 flex items-center">🚨 Vencidos</span>
                    <span className="text-red-400 font-black">{planesVencidos}</span>
                  </div>
                </div>
                {/* TOOLTIP EXPULSADO HACIA ARRIBA (CENTRAL) */}
                <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">KPI Operativo Metas</h4>
                  <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                    <p><b className="text-emerald-400">📍 ORIGEN:</b> Plan de Mejoramiento del Sistema.</p>
                    <p><b className="text-amber-400">❓ POR QUÉ:</b> Mide la velocidad institucional para subsanar los riesgos pitados.</p>
                    <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Alertas automáticas cruzando plazos vs fecha actual del servidor.</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
                <h3 className="text-xs font-black tracking-widest uppercase text-slate-300 mb-2">Indicadores (KPI)</h3>
                <div className="overflow-x-auto w-full flex-1">
                  <table className="w-full text-left text-[10px] font-bold text-slate-400 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[9px]">
                        <th className="py-2 font-black">Indicador</th>
                        <th className="py-2 font-black text-center">Valor Real</th>
                        <th className="py-2 font-black text-center">Meta</th>
                        <th className="py-2 font-black text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 text-white truncate max-w-[120px]">Ejecución Plan Anual</td>
                        <td className="py-2 text-center text-slate-200">{kpiPlanAnual}%</td>
                        <td className="py-2 text-center text-slate-500">85%</td>
                        <td className="py-2 text-right">{kpiPlanAnual >= 85 ? '✅' : (kpiPlanAnual >= 60 ? '⚠️' : '🚨')}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 text-white truncate max-w-[120px]">Eficiencia de Controles</td>
                        <td className="py-2 text-center text-slate-200">{efectividadControlesGlobal}%</td>
                        <td className="py-2 text-center text-slate-500">80%</td>
                        <td className="py-2 text-right">{efectividadControlesGlobal >= 80 ? '✅' : (efectividadControlesGlobal >= 60 ? '⚠️' : '🚨')}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 text-white truncate max-w-[120px]">Oportunidad Planes</td>
                        <td className="py-2 text-center text-slate-200">{kpiOportunidad}%</td>
                        <td className="py-2 text-center text-slate-500">85%</td>
                        <td className="py-2 text-right">{kpiOportunidad >= 85 ? '✅' : (kpiOportunidad >= 60 ? '⚠️' : '🚨')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* TOOLTIP EXPULSADO HACIA ARRIBA (CENTRAL) */}
                <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
                  <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Tablero de Control KRI</h4>
                  <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                    <p><b className="text-emerald-400">📍 ORIGEN:</b> Consolidado de los 3 Módulos de Metas.</p>
                    <p><b className="text-amber-400">❓ POR QUÉ:</b> Compara el rendimiento real frente a exigencias Big-4.</p>
                    <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Semáforos lógicos automáticos según el umbral de tolerancia.</p>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* ─── NUEVO: PANEL DE CONTROL OPERATIVO CON POP-OVERS PREMIUM HACIA ARRIBA ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* PLANES VENCIDOS */}
          <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
            <div className="flex items-center space-x-3 mb-4">
              <h3 className="text-sm font-black text-slate-200">Planes Vencidos</h3>
              <span className="bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-md text-[10px]">{planesVencidosList.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
              <table className="w-full text-left text-[10px]">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-2 font-bold">Plan</th>
                    <th className="pb-2 font-bold">Proceso</th>
                    <th className="pb-2 font-bold">Vencimiento</th>
                    <th className="pb-2 font-bold">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {planesVencidosList.map((p, i) => {
                    const hallazgoAsociado = hallazgosBase.find(h => h.id === p.idHallazgo) || {};
                    return (
                    <tr key={`venc-${i}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                        <span className="font-bold text-slate-300">PLAN-{p.id}</span>
                      </td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={hallazgoAsociado.proceso || 'N/A'}>{hallazgoAsociado.proceso || 'N/A'}</td>
                      <td className="py-2.5 text-slate-400">{formatSafeDate(p.fecha)}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={p.responsable}>{p.responsable}</td>
                    </tr>
                  )})}
                  {planesVencidosList.length === 0 && (
                    <tr><td colSpan="4" className="py-4 text-center text-slate-500 italic">No hay planes vencidos registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pt-3 mt-auto border-t border-slate-800/50 text-left">
               <button onClick={() => setActiveTab('planes')} className="text-red-400 text-[10px] font-bold hover:underline transition-colors">Ver todos los planes vencidos →</button>
            </div>
            {/* TOOLTIP EXPULSADO HACIA ARRIBA (CENTRAL) */}
            <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
              <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Alerta de Retrasos</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                <p><b className="text-emerald-400">📍 ORIGEN:</b> Módulo de Planes de Acción.</p>
                <p><b className="text-amber-400">❓ POR QUÉ:</b> Identifica inmediatamente las brechas vencidas sin cierre reportado.</p>
                <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Top 5 ordenado cronológicamente de forma ascendente.</p>
              </div>
            </div>
          </div>

          {/* PRÓXIMAS AUDITORÍAS */}
          <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
            <div className="flex items-center space-x-3 mb-4">
              <h3 className="text-sm font-black text-slate-200">Próximas Auditorías</h3>
              <span className="bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-md text-[10px]">{proximasAuditorias.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin">
               <table className="w-full text-left text-[10px]">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-2 font-bold">Auditoría</th>
                    <th className="pb-2 font-bold">Proceso</th>
                    <th className="pb-2 font-bold">Periodo</th>
                    <th className="pb-2 font-bold">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {proximasAuditorias.map((c, i) => (
                    <tr key={`aud-${i}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 font-bold text-slate-300">AUD-{c.codigo || `2026-${i+1}`}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={c.proceso}>{c.proceso}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[70px]">{c.periodo}</td>
                      <td className="py-2.5 text-slate-400 truncate max-w-[80px]" title={c.responsable}>{c.responsable}</td>
                    </tr>
                  ))}
                   {proximasAuditorias.length === 0 && (
                    <tr><td colSpan="4" className="py-4 text-center text-slate-500 italic">No hay auditorías pendientes en cronograma</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pt-3 mt-auto border-t border-slate-800/50 text-left">
               <button onClick={() => setActiveTab('plan_anual')} className="text-blue-400 text-[10px] font-bold hover:underline transition-colors">Ver calendario completo →</button>
            </div>
            {/* TOOLTIP EXPULSADO HACIA ARRIBA (CENTRAL) */}
            <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Calendario de Procesos</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                <p><b className="text-emerald-400">📍 ORIGEN:</b> Cronograma del Plan Anual de Auditoría.</p>
                <p><b className="text-amber-400">❓ POR QUÉ:</b> Brinda visibilidad de los próximos frentes regulatorios a intervenir.</p>
                <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Filtra procesos activos pendientes con ejecución menor al 100%.</p>
              </div>
            </div>
          </div>

          {/* ACTIVIDAD RECIENTE */}
          <div className="bg-[#0a1122] border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
             <div className="flex items-center space-x-3 mb-4">
              <h3 className="text-sm font-black text-slate-200">Actividad Reciente</h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[220px] scrollbar-thin space-y-4">
                {recentActivityList.map((act, i) => (
                  <div key={`act-${i}`} className="flex items-start space-x-3">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${act.colorClass} shrink-0`}>
                      {act.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-300 leading-snug">
                        <span className="font-bold text-white">{act.type} {act.ref}</span> {String(act.accion).toLowerCase()}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate mt-0.5">Por: {act.usuario}</p>
                    </div>
                    <div className="text-[9px] text-slate-500 shrink-0 text-right whitespace-nowrap">
                      {act.fechaStr.split(',')[0]}
                    </div>
                  </div>
                ))}
                 {recentActivityList.length === 0 && (
                    <div className="py-4 text-center text-slate-500 italic text-[10px]">No hay actividad reciente registrada en sistema</div>
                  )}
            </div>
            {/* TOOLTIP EXPULSADO HACIA ARRIBA (CENTRAL) */}
            <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
              <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Bitácora Global (Logs)</h4>
              <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
                <p><b className="text-emerald-400">📍 ORIGEN:</b> Nube Modular de Firebase Firestore.</p>
                <p><b className="text-amber-400">❓ POR QUÉ:</b> Garantiza la transparencia y el principio de responsabilidad (Audit Trail).</p>
                <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Historial unificado en tiempo real de los últimos movimientos.</p>
              </div>
            </div>
          </div>

        </div>

        {/* ─── ANEXO INTERACTIVO DE TRAZABILIDAD (REGISTROS REALES DESDE LA BD) ─── */}
        <div className="bg-[#0a1122] border border-slate-800 p-4 rounded-2xl shadow-xl text-left relative group overflow-visible hover:border-slate-700 transition-all cursor-help">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-xs font-black tracking-widest uppercase text-slate-300">
                {matrizFiltro ? `🔍 Riesgos en Cuadrante (Probabilidad: ${matrizFiltro.p} | Impacto: ${matrizFiltro.i})` : '📋 Resumen de Riesgos Críticos Recientes'}
              </h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-[#060b16] px-2 py-1 rounded-lg border border-slate-800">
              Registros: {riesgosFiltradosPorMatriz.length}
            </span>
          </div>

          <div className="space-y-2">
            {riesgosFiltradosPorMatriz.length === 0 ? (
              <p className="text-xs font-medium text-slate-500 py-4 text-center">No se registran riesgos mapeados en esta coordenada exacta.</p>
            ) : (
              riesgosFiltradosPorMatriz.map((r, idx) => {
                const score = (Number(r.probabilidadResidual) || 1) * (Number(r.impactoResidual) || 1);
                return (
                  <div key={`risk-row-${idx}`} className="bg-[#060b16] border border-slate-800/80 p-3 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-slate-700 transition-all">
                    <div className="flex items-start space-x-3">
                      <span className="bg-blue-600/10 text-blue-400 px-2 py-1 rounded-lg font-mono text-[10px] font-black border border-blue-500/10">
                        {r.id ? `RSG-${r.id}` : `RSG-${idx + 101}`}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-slate-200">
                          {r.proceso || 'Proceso No Asignado'} — <span className="font-semibold text-slate-400">{r.riesgo || r.descripcion || 'Riesgo sin descripción'}</span>
                        </h4>
                        <p className="text-[9px] text-slate-500 font-medium mt-0.5">
                          Factor/Causa: {r.factorRiesgo || r.causa || 'No especificada'} | Clasificación: {r.clasificacion || r.categoria || 'Operativo'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-right self-end sm:self-auto">
                      <div className="text-[10px] font-bold text-slate-400">
                        P: <span className="text-slate-200">{r.probabilidadResidual || 1}</span> / I: <span className="text-slate-200">{r.impactoResidual || 1}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase ${score >= 16 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : score >= 10 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        Score {score}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* TOOLTIP EXPULSADO HACIA ARRIBA (DERECHA) */}
          <div className="absolute bottom-[102%] right-4 w-64 bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none translate-y-2 group-hover:translate-y-0">
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-[#0f172a] border-b border-r border-slate-700 rotate-45"></div>
            <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1.5">Foco de Criticidades</h4>
            <div className="space-y-1.5 text-[9px] leading-relaxed text-slate-400 font-medium">
              <p><b className="text-emerald-400">📍 ORIGEN:</b> Base de Datos Firebase Firestore.</p>
              <p><b className="text-amber-400">❓ POR QUÉ:</b> Desglosa de forma analítica los picos de criticidad activos del inventario de Termales.</p>
              <p><b className="text-slate-300">📝 METODOLOGÍA:</b> Vista dinámica sincronizada con el motor relacional del Mapa de calor.</p>
            </div>
          </div>
        </div>

      </div>
    );
  };
const renderDashboardRiesgos = () => {
    // ✨ EL NUEVO TRADUCTOR INTELIGENTE PARA EL DASHBOARD GRIS
    const extraerNumeroPuro = (valor) => {
      if (!valor) return 0;
      const str = String(valor).toLowerCase().trim();
      
      const num = parseInt(str.charAt(0), 10);
      if (!isNaN(num)) return num;
      
      if (str === 'rara' || str === 'rara vez') return 1;
      if (str === 'improbable') return 2;
      if (str === 'posible') return 3;
      if (str === 'probable') return 4;
      if (str === 'casi seguro') return 5;
      
      if (str === 'insignificante') return 1;
      if (str === 'menor') return 2;
      if (str === 'moderado' || str === 'medio') return 3;
      if (str === 'mayor' || str === 'alto') return 4;
      if (str === 'catastrófico' || str === 'crítico') return 5;
      
      return 0;
    };

    // Copia de los riesgos con los números traducidos
    const riesgosLimpiosParaMatriz = (rFiltrados || []).map(r => ({
      ...r,
      probabilidadResidual: extraerNumeroPuro(r.probabilidadResidual),
      impactoResidual: extraerNumeroPuro(r.impactoResidual),
      probabilidadInherente: extraerNumeroPuro(r.probabilidadInherente),
      impactoInherente: extraerNumeroPuro(r.impactoInherente)
    }));

    return (
      <DashboardRiesgos 
        tipoMatriz={tipoMatriz}
        rFiltrados={riesgosLimpiosParaMatriz} 
        incFiltrados={incFiltrados}
        hFiltrados={hFiltrados}
        calcularMatriz5x5={calcularMatriz5x5}
        getItemMesText={getItemMesText}
        selectedAnios={selectedAnios}
        setChartDetail={setChartDetail}
        filtroHeatMap={filtroHeatMap}
        setFiltroHeatMap={setFiltroHeatMap}
        searchTerm={searchTerm}
        columnFilters={columnFilters}
        applyFilters={applyFilters}
        renderHeaderFiltros={renderHeaderFiltros}
      />
    );
  };
    
const renderPlanAnual = () => {
    return (
      <PlanAnual 
        isAdmin={isAdmin}
        cFiltrados={cFiltrados}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput}
        applyFilters={applyFilters}
        editCronograma={editCronograma}
        setEditCronograma={setEditCronograma}
        handleCronogramaSubmit={handleCronogramaSubmit}
        formResetKey={formResetKey}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        safeMonitoreo={safeMonitoreo}
        editMonitoreo={editMonitoreo}
        setEditMonitoreo={setEditMonitoreo}
        handleMonitoreoSubmit={handleMonitoreoSubmit}
        selectedAnios={selectedAnios}
        renderHeaderFiltros={renderHeaderFiltros}
      />
    );
  };  
  const renderRiesgos = () => {
    return (
      <Riesgos 
        isAdmin={isAdmin}
        editRiesgo={editRiesgo}
        setEditRiesgo={setEditRiesgo}
        handleRiesgoSubmit={handleRiesgoSubmit}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        applyFilters={applyFilters}
        FilterInput={FilterInput}
        rFiltrados={rFiltrados}
        calcularMatriz5x5={calcularMatriz5x5}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        exportToExcel={exportToExcel}
        safeRiesgos={safeRiesgos}
      />
    );
  };
const renderApetito = () => {
    return (
      <Apetito 
        isAdmin={isAdmin}
        editApetito={editApetito}
        setEditApetito={setEditApetito}
        handleApetitoSubmit={handleApetitoSubmit}
        activeTooltip={activeTooltip}
        setActiveTooltip={setActiveTooltip}
        setFormResetKey={setFormResetKey}
        formResetKey={formResetKey}
        scrollToForm={scrollToForm}
        rFiltrados={rFiltrados}
        incFiltrados={incFiltrados}
        calcularMatriz5x5={calcularMatriz5x5}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput}
        applyFilters={applyFilters}
      />
    );
  };
  const renderEvaluaciones = () => {
    return (
      <Evaluaciones 
        isAdmin={isAdmin}
        editEvaluacion={editEvaluacion}
        setEditEvaluacion={setEditEvaluacion}
        handleAuthorizationSubmit={handleEvaluacionSubmit} // Asegura que invoque handleEvaluacionSubmit
        handleEvaluacionSubmit={handleEvaluacionSubmit}
        safeRiesgos={safeRiesgos}
        user={user}
        analizarEvidenciaIA={analizarEvidenciaIA}
        safeEvaluaciones={safeEvaluaciones}
        formatSafeDate={formatSafeDate}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        FilterInput={FilterInput}
        applyFilters={applyFilters}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
      />
    );
  };
  
const renderHallazgos = () => {
  return (
    <Hallazgos 
      isAdmin={isAdmin}
      informesAuditoria={informesAuditoria} // 🟢 Envía los informes a la vista
      editHallazgo={editHallazgo}
      setEditHallazgo={setEditHallazgo}
      handleHallazgoSubmit={handleHallazgoSubmit}
      setFormResetKey={setFormResetKey}
      scrollToForm={scrollToForm}
      handleDeleteItem={handleDeleteItem}
      applyFilters={applyFilters}
      hFiltrados={hFiltrados}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      columnFilters={columnFilters}
      handleColFilterChange={handleColFilterChange}
      FilterInput={FilterInput}
    />
  );
};

const renderPlanes = () => {
    return (
      <Planes 
        isAdmin={isAdmin}
        editPlan={editPlan}
        setEditPlan={setEditPlan}
        handlePlanSubmit={handlePlanSubmit}
        formResetKey={formResetKey}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        applyFilters={applyFilters}
        FilterInput={FilterInput}
        pFiltrados={pFiltrados}
        safeHallazgos={safeHallazgos}
        setHallazgos={setHallazgos}
        safePlanes={safePlanes} 
        setPlanes={setPlanes}   
        saveToCloud={saveToCloud} 
        formatSafeDate={formatSafeDate}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        informesAuditoria={informesAuditoria} 
        defaultAnios={defaultAnios}
        defaultMeses={defaultMeses}
        selectedAnios={selectedAnios}
        selectedMeses={selectedMeses}
        toggleAnio={toggleAnio}
        toggleMes={toggleMes}
        setSelectedAnios={setSelectedAnios}
        setSelectedMeses={setSelectedMeses}
selectAllAnios={() => setSelectedAnios([...defaultAnios])}
        clearAllAnios={() => setSelectedAnios([])}
        selectAllMeses={() => setSelectedMeses([...defaultMeses])}
        clearAllMeses={() => setSelectedMeses([])}
        onUpdateItemStatus={async (coleccion, id, nuevoEstadoWorkflow) => {
          try {
            const ts = new Date().toLocaleString();
            const logTrazabilidad = {
              fecha: ts,
              usuario: user?.email || 'Usuario',
              accion: `Fase de Gobernanza actualizada a: ${nuevoEstadoWorkflow}`
            };

            const planActual = safePlanes.find(p => p.id === id);
            if (!planActual) return;

            const planModificado = {
              ...planActual,
              estadoWorkflow: nuevoEstadoWorkflow,
              historialCambios: [...(planActual.historialCambios || []), logTrazabilidad]
            };

            const updatedList = safePlanes.map(p => p.id === id ? planModificado : p);
            setPlanes(updatedList);
            await saveToCloud({ planes: updatedList });

            setEditPlan(planModificado);
            setFormResetKey(Date.now());

// 🟢 DISPARADOR GMAIL API INTEGRADO (PLAN DE ACCIÓN EN REVISIÓN)
            if (nuevoEstadoWorkflow === 'En Revisión') {
              await ejecutarDespachoGmailApi({
                ref_consecutivo: `PLAN-${id}`,
                titulo_informe: 'Plan de Acción Publicado Listo para Validación',
                proceso_auditado: planModificado.accion.substring(0, 50) + '...',
                enlace_pdf: 'https://auditoria-gcm.vercel.app',
                destinatarios: 'controlinterno@termales.com.co'
              });
            }           

            if (nuevoEstadoWorkflow === 'En Revisión') {
               showNotification("Plan enviado a revisión y administrador notificado.");
            } else {
               showNotification(`Fase del plan actualizada a: ${nuevoEstadoWorkflow}`);
            }
            
          } catch (err) {
            console.error("Error al actualizar la fase del Workflow:", err);
            alert("Hubo un error al actualizar el estado. Revisa la consola.");
          }
        }}
      />
    );
  };

  const renderIncidentes = () => {
    return (
      <Incidentes 
        incFiltrados={incFiltrados}
        isAdmin={isAdmin}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
        editIncidente={editIncidente}
        setEditIncidente={setEditIncidente}
        handleIncidenteSubmit={handleIncidenteSubmit}
        formResetKey={formResetKey}
        setFormResetKey={setFormResetKey}
        scrollToForm={scrollToForm}
        handleDeleteItem={handleDeleteItem}
        applyFilters={applyFilters}
        FilterInput={FilterInput}
      />
    );
  };
  const renderInforme = () => {
    return (
      <Trazabilidad 
        safeRiesgos={safeRiesgos}
        safeEvaluaciones={safeEvaluaciones}
        safeHallazgos={safeHallazgos}
        safePlanes={safePlanes}
        safeIncidentes={safeIncidentes}
      />
    );
  };

// =====================================================================
  // PANTALLA DE BIENVENIDA DINÁMICA (ADMINISTRADORES Y JEFES DE ÁREA)
  // =====================================================================
  const renderWelcomeScreen = () => {
    // Logo Vectorial (SVG Puro)
    const LogoTermales = () => (
      <svg viewBox="0 0 100 100" className="w-[75px] h-[75px] drop-shadow-sm shrink-0">
        <circle cx="16" cy="45" r="2" fill="#203d4a" />
        <circle cx="12" cy="49" r="1.5" fill="#203d4a" />
        <circle cx="18" cy="52" r="1.2" fill="#203d4a" />
        <circle cx="85" cy="42" r="1.8" fill="#203d4a" />
        <circle cx="92" cy="45" r="2.5" fill="#203d4a" />
        <circle cx="90" cy="50" r="1.5" fill="#203d4a" />
        <circle cx="84" cy="54" r="1.2" fill="#203d4a" />
        <path d="M 68 28 C 76 20, 88 22, 90 28 C 82 32, 72 32, 68 28 Z" fill="#4CAF50" />
        <path d="M 63 15 C 68 8, 76 10, 78 14 C 72 17, 65 18, 63 15 Z" fill="#4CAF50" />
        <path d="M 32 72 C 24 80, 12 78, 10 72 C 18 68, 28 68, 32 72 Z" fill="#4CAF50" />
        <path d="M 37 85 C 32 92, 24 90, 22 86 C 28 83, 35 82, 37 85 Z" fill="#4CAF50" />
        <circle cx="50" cy="50" r="25" stroke="#203d4a" strokeWidth="11" fill="none" />
        <circle cx="43" cy="55" r="7" stroke="#203d4a" strokeWidth="3.5" fill="none" />
        <circle cx="58" cy="62" r="4.5" stroke="#203d4a" strokeWidth="2.5" fill="none" />
        <circle cx="59" cy="48" r="2.2" fill="#203d4a" />
        <circle cx="53" cy="45" r="1.5" fill="#203d4a" />
      </svg>
    );

    return (
      <div className="relative flex min-h-screen w-full bg-[#f8fbfa] font-sans overflow-hidden">
        
        {/* ================= 1. FONDOS PRINCIPALES ================= */}
        
        {/* Lado Izquierdo: Cascada */}
        <div 
          className="absolute left-0 top-0 w-[45%] h-full bg-cover bg-center z-0"
          style={{ backgroundImage: "url('/cascada.jpg'), linear-gradient(to right, #0A1A12, #11322A)" }}
        >
          {/* Difuminado suave hacia el centro */}
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#f8fbfa] to-transparent z-10"></div>
        </div>

        {/* ================= 2. GEOMETRÍA Y VECTORES EXACTOS (HUD) ================= */}
        
        {/* A. Esquina Superior Derecha (Polígono verde oscuro con láser) */}
        <svg className="absolute top-0 right-0 w-[400px] h-[400px] z-10 pointer-events-none" viewBox="0 0 400 400">
          <defs>
            <linearGradient id="grad-top-right" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#051f15" />
              <stop offset="100%" stopColor="#0a3b2a" />
            </linearGradient>
            <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-dot" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Forma oscura */}
          <polygon points="120,0 400,0 400,280" fill="url(#grad-top-right)" />
          {/* Línea láser verde brillante en el borde diagonal */}
          <line x1="120" y1="0" x2="400" y2="280" stroke="#00FF87" strokeWidth="4" filter="url(#glow-green)" />
          {/* Destello/Estrella cerca del borde */}
          <circle cx="280" cy="80" r="2.5" fill="#eab308" filter="url(#glow-dot)" />
          <path d="M280,70 L280,90 M270,80 L290,80" stroke="#eab308" strokeWidth="1" filter="url(#glow-dot)" opacity="0.6"/>
        </svg>

        {/* B. Esquina Inferior Izquierda (Polígono oscuro con borde neón exacto a la maqueta) */}
        <svg className="absolute bottom-0 left-0 w-[250px] h-[250px] z-10 pointer-events-none" viewBox="0 0 250 250">
          <defs>
            <linearGradient id="grad-bottom-left" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#051f15" />
              <stop offset="100%" stopColor="#0a3b2a" />
            </linearGradient>
            <filter id="glow-green-bl" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Forma oscura anclada a la esquina */}
          <polygon points="0,100 150,250 0,250" fill="url(#grad-bottom-left)" />
          {/* Línea láser verde brillante en el borde diagonal */}
          <line x1="0" y1="100" x2="150" y2="250" stroke="#00FF87" strokeWidth="3" filter="url(#glow-green-bl)" />
          {/* Pequeños nodos decorativos de conexión */}
          <circle cx="75" cy="175" r="2.5" fill="#00FF87" filter="url(#glow-green-bl)" />
          <line x1="75" y1="175" x2="110" y2="175" stroke="#00FF87" strokeWidth="1" filter="url(#glow-green-bl)" opacity="0.5"/>
          <line x1="110" y1="175" x2="125" y2="190" stroke="#00FF87" strokeWidth="1" filter="url(#glow-green-bl)" opacity="0.5"/>
          <circle cx="125" cy="190" r="1.5" fill="#00FF87" opacity="0.8"/>
        </svg>

        {/* C. Fondo Tecnológico Derecho (Hexágonos y Líneas de puntos exactas) */}
        <svg className="absolute top-0 right-0 w-full h-full opacity-60 z-0 pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="xMaxYMid slice">
          {/* Línea segmentada principal */}
          <path d="M550,-50 L850,250 L850,600 L600,850 L200,850" fill="none" stroke="#64A338" strokeWidth="1.2" strokeDasharray="8,8" />
          {/* Nodos de intersección */}
          <circle cx="850" cy="250" r="4" fill="#64A338" />
          <circle cx="850" cy="600" r="4" fill="#64A338" />
          <circle cx="600" cy="850" r="4" fill="#64A338" />
          
          {/* Grupo de Hexágonos */}
          <g stroke="#64A338" strokeWidth="1.2" fill="none">
            {/* Hexágono Centro-Derecha */}
            <polygon points="760,400 785,415 785,445 760,460 735,445 735,415" />
            {/* Hexágono Pequeño anidado */}
            <polygon points="820,470 835,480 835,500 820,510 805,500 805,480" />
            {/* Hexágono Inferior */}
            <polygon points="680,700 700,712 700,736 680,748 660,736 660,712" />
          </g>
        </svg>

        {/* ================= 3. TARJETA CENTRAL ================= */}
        <div className="absolute inset-0 flex items-center justify-center p-4 z-20">
          
          <div className="relative w-full max-w-[620px] animate-in zoom-in-95 duration-700">
            
            {/* Resplandor Neon Verde debajo de la tarjeta */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-400 to-green-200 rounded-[3rem] blur-xl opacity-50"></div>
            
            {/* Contenedor Blanco Principal */}
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl p-3 overflow-hidden">
              
              {/* --- EL MARCO TECNOLÓGICO INTERNO (Idéntico a tu maqueta) --- */}
              <div className="relative border-[1.5px] border-gray-200 rounded-[2rem] p-10 sm:p-14">
                
                {/* Ocultadores para hacer los "cortes" del marco */}
                {/* Corte superior izquierdo */}
                <div className="absolute top-[-2px] left-10 w-8 h-1 bg-white"></div>
                <div className="absolute top-10 left-[-2px] w-1 h-8 bg-white"></div>
                <div className="absolute top-5 left-5 w-5 h-5 border-t-2 border-l-2 border-gray-300 rounded-tl-xl pointer-events-none"></div>

                {/* Corte superior derecho (con los 9 puntos) */}
                <div className="absolute top-[-2px] right-10 w-16 h-1 bg-white"></div>
                <div className="absolute top-10 right-[-2px] w-1 h-12 bg-white"></div>
                <div className="absolute top-6 right-6 grid grid-cols-3 gap-[4px] opacity-40 bg-white p-1">
                  {[...Array(9)].map((_, i) => <div key={i} className="w-[5px] h-[5px] bg-[#4A5D66] rounded-full"></div>)}
                </div>

                {/* Corte inferior derecho */}
                <div className="absolute bottom-[-2px] right-10 w-8 h-1 bg-white"></div>
                <div className="absolute bottom-10 right-[-2px] w-1 h-8 bg-white"></div>
                <div className="absolute bottom-5 right-5 w-5 h-5 border-b-2 border-r-2 border-gray-300 rounded-br-xl pointer-events-none"></div>

                {/* ---------------- CONTENIDO ---------------- */}
                
                {/* LOGO */}
                <div className="flex flex-col items-center mb-6 mt-1">
                  <div className="flex items-center space-x-2">
                    <LogoTermales />
                    <div className="flex flex-col leading-none ml-2">
                      <h1 className="text-[34px] font-black text-[#0B2A36] tracking-tight mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                        TERMALES
                      </h1>
                      <p className="text-[17px] font-bold text-[#64A338] -mt-1 tracking-wide">
                        Santa Rosa de Cabal
                      </p>
                    </div>
                  </div>
                </div>

                {/* TÍTULO Y SEPARADOR */}
                <div className="text-center mb-6">
                  <h2 className="text-[26px] font-black text-[#0A3B32] tracking-tight">
                    {isAdmin ? 'Centro de Mando GRC' : 'Portal Operativo GRC'}
                  </h2>
                  <div className="flex items-center justify-center my-4 opacity-80">
                    <div className="h-[1px] bg-gray-300 w-10"></div>
                    <div className="w-[5px] h-[5px] rounded-full bg-[#64A338] mx-2"></div>
                    <div className="h-[1px] bg-gray-300 w-10"></div>
                  </div>
                </div>

                {/* TEXTO DESCRIPTIVO */}
                <div className="text-center mb-10 px-2">
                  <p className="text-[14px] text-gray-500 leading-relaxed font-medium max-w-sm mx-auto">
                    {isAdmin
                      ? 'Bienvenido al panel de Administración y Auditoría. Desde aquí podrá supervisar los riesgos corporativos, emitir informes formales, aprobar planes de acción y gestionar la base de datos global.'
                      : 'Bienvenido, Líder de Proceso. Desde aquí podrá visualizar los tableros analíticos, reportar el avance de sus planes de acción y registrar eventos de pérdida operativos.'}
                  </p>
                </div>

                {/* BOTONES */}
                <div className="space-y-4 max-w-[400px] mx-auto relative z-20">
                  <button 
                    onClick={() => setShowWelcome(false)} 
                    className="w-full bg-[#0A3B32] hover:bg-[#062620] text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95 group"
                  >
                    <svg className="w-4 h-4 text-emerald-400 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Acceder al Tablero de Control</span>
                  </button>

                  <button 
                    onClick={handleLogout} 
                    className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-[#64A338] py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center space-x-3 active:scale-95 group shadow-sm"
                  >
                    <svg className="w-4 h-4 text-[#64A338]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
                
                {/* PUNTOS INFERIORES */}
                <div className="flex justify-center items-center space-x-2 mt-8">
                  <div className="w-[7px] h-[7px] rounded-full border border-[#64A338] bg-transparent"></div>
                  <div className="w-[7px] h-[7px] rounded-full border border-[#64A338] bg-transparent"></div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#64A338]"></div>
                  <div className="w-[7px] h-[7px] rounded-full bg-[#64A338]"></div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

// 🔔 Calculador de notificaciones para la barra lateral (Planes en Revisión)
  const pendingPlansCount = safePlanes.filter(p => p.estadoWorkflow === 'En Revisión').length;
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

if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white flex-col space-y-4"><span className="text-6xl animate-bounce">☁️</span><h2 className="text-xl font-bold tracking-widest uppercase">Conectando...</h2></div>);
  if (showWelcome) return renderWelcomeScreen();
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
            { id: 'comites', icon: '👥', label: 'Comités y Actas' },
            // 👇 ESTAS 3 PESTAÑAS SOLO APARECEN SI ERES ADMIN 👇
            ...(isAdmin ? [
               { id: 'informe', icon: '📜', label: 'Trazabilidad' },
               { id: 'informes_auditoria', icon: '📁', label: 'Informes Emitidos' },
               { id: 'config', icon: '⚙️', label: 'Configuración / Copias de seguridad' }
            ] : [])
          ].map((tab, index) => (
            <button key={`nav-${tab.id}-${index}`} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
              <div className="flex items-center space-x-2">
                <span>{tab.icon}</span><span>{tab.label}</span>
              </div>
              {/* BURBUJA ROJA DE NOTIFICACIÓN PARA PLANES */}
              {tab.id === 'planes' && isAdmin && pendingPlansCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                  {pendingPlansCount}
                </span>
              )}
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
            {activeTab === 'tablero' && renderTableroAnalitico()}
            {activeTab === 'dashboard_riesgos' && renderDashboardRiesgos()}
            {activeTab === 'plan_anual' && renderPlanAnual()}
            {activeTab === 'riesgos' && renderRiesgos()}
            {activeTab === 'apetito' && renderApetito()}
            {activeTab === 'evaluaciones' && renderEvaluaciones()}
            {activeTab === 'hallazgos' && renderHallazgos()}
            {activeTab === 'planes' && renderPlanes()}
            {activeTab === 'incidentes' && renderIncidentes()}
{activeTab === 'comites' && (
  <Comites 
    isAdmin={isAdmin}
    editComite={editComite}
    setEditComite={setEditComite}
    handleComiteSubmit={handleComiteSubmit}
    setFormResetKey={setFormResetKey}
    scrollToForm={scrollToForm}
    handleDeleteItem={handleDeleteItem}
    applyFilters={applyFilters}
    comitesFiltrados={comitesFiltrados}
    searchTerm={searchTerm}
    setSearchTerm={setSearchTerm}
    columnFilters={columnFilters}
    handleColFilterChange={handleColFilterChange}
    FilterInput={FilterInput}
  />
)}
            {activeTab === 'informe' && renderInforme()}
{activeTab === 'informes_auditoria' && (
              <InformesAuditoria 
                informesAuditoria={informesAuditoria}
                setInformesAuditoria={setInformesAuditoria}
                editInformeAuditoria={editInformeAuditoria}
                setEditInformeAuditoria={setEditInformeAuditoria}
                isAdmin={isAdmin}
                user={user}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                columnFilters={columnFilters}
                handleColFilterChange={handleColFilterChange}
                exportToExcel={exportToExcel}
                handleInformeAuditoriaSubmit={handleInformeAuditoriaSubmit}
                isSubmitting={isSubmitting}
                setFormResetKey={setFormResetKey}
                scrollToForm={scrollToForm}
                handleDeleteItem={handleDeleteItem}
                applyFilters={applyFilters}
                FilterInput={FilterInput}
                safeHallazgos={safeHallazgos}
                safePlanes={safePlanes}
                formatSafeDate={formatSafeDate}
                auditoresLista={auditoresLista}
                onActualizarAuditores={async (nuevaLista) => {
                  setAuditoresLista(nuevaLista);
                  await saveToCloud({ auditoresLista: nuevaLista });
                }}
              />
            )}
            {activeTab === 'config' && renderConfiguracion()}
          </div>
        </main>
      </div>

{/* 🤖 COMPONENTE REDISEÑADO EN MÓDULO SEPARADO (AUDITOR IA V5) */}
      <AuditorIA 
        isPresentationMode={isPresentationMode}
        isAdmin={isAdmin}
        showAuditorIA={showAuditorIA}
        setShowAuditorIA={setShowAuditorIA}
        auditorInput={auditorInput}
        setAuditorInput={setAuditorInput}
        auditorRespuesta={auditorRespuesta}
        setAuditorRespuesta={setAuditorRespuesta}
        isAuditorThinking={isAuditorThinking}
        handleAuditorSubmit={handleAuditorSubmit}
      />
                
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