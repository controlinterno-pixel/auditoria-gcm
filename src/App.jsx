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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // =====================================================================
  // 🗓️ FILTROS DE PERIODICIDAD INTELIGENTES Y ABIERTOS
  // =====================================================================
  const [periodFilters, setPeriodFilters] = useState({});

  // 🔥 ESCÁNER DINÁMICO: Encuentra automáticamente todos los años con datos + año actual
  const defaultAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1]); // Asegura histórico, actual y futuro próximo

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

 // =====================================================================
  // 🧠 FUNCIÓN CENTRAL DEL "AUDITOR IA" (ENFOQUE DE CONTROL INTERNO)
  // =====================================================================
  const handleAuditorSubmit = async (e) => {
    e.preventDefault();
    if (!auditorInput.trim()) return;

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

      // 🗓️ MÓDULO 6: PLAN ANUAL DE AUDITORÍA (Fórmula espejo calibrada al 93%)
      const totalCronograma = cronogramaBase.length;
      const cronogramaIniciados = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) > 0);
      const avanceCronogramaGlobal = cronogramaIniciados.length > 0 
        ? Math.round(cronogramaIniciados.reduce((acc, c) => acc + (Number(c.cumplimiento) || 0), 0) / cronogramaIniciados.length) 
        : 0;
      const pendientesArray = cronogramaBase.filter(c => (Number(c.cumplimiento) || 0) < 100).map(c => c.proceso);
      const listadoPendientesCronograma = pendientesArray.length > 0 ? pendientesArray.join(', ') : 'Ninguno (100% de ejecución)';

      // 2. RE-ESTRUCTURACIÓN DEL PROMPT PARA MÁXIMA CONTUNDENCIA OPERATIVA
      const megaContexto = `
        Actúas como el "Auditor IA", un asistente senior del equipo de CONTROL INTERNO de TERMALES DE SANTA ROSA.
        Eres directo, ejecutivo y experto en GRC. Responde utilizando únicamente esta radiografía matemática filtrada del sistema:

        [DATOS DEL PLAN ANUAL DE AUDITORÍA]
        - CUMPLIMIENTO GLOBAL DE EJECUCIÓN: ${avanceCronogramaGlobal}%
        - Total Procesos Programados: ${totalCronograma}
        - Procesos pendientes de completar al 100%: [ ${listadoPendientesCronograma} ]

        [DATOS DE MATRIZ DE RIESGOS]
        - Total Riesgos Identificados: ${totalRiesgos}
        - Riesgos Críticos o Extremos (Zona Roja): ${criticosTotal}
        - Clasificación: Operativos (${riesgosOperativos}), Estratégicos (${riesgosEstrategicos}), Tecnológicos (${riesgosTecnologicos}).

        [DATOS DE PLANES DE ACCIÓN Y GOBERNANZA]
        - Avance Físico Global de Planes: ${avancePlanesGlobal}%
        - Planes de Acción Asignados: ${totalPlanes} (Vencidos Críticos: ${planesVencidos})
        - Hallazgos/Desviaciones Abiertas: ${hallazgosAbiertos} (Cerrados: ${hallazgosCerrados})

        [DATOS DE EVENTOS DE PÉRDIDA]
        - Total Incidentes Materializados: ${totalIncidentes}
        - Impacto Financiero Acumulado: $${lossesAcumuladas.toLocaleString('es-CO')} COP
        - Efectividad General de Controles: ${efectividadControlesGlobal}%

        REGLAS OBLIGATORIAS DE RESPUESTA:
        1. RESPONDE EXCLUSIVAMENTE SOBRE EL TEMA DE LA PREGUNTA. Si te preguntan por riesgos, habla SOLO de riesgos. Si te preguntan por el Plan Anual, habla SOLO del plan anual. NO mezcles métricas de otros módulos a menos que te lo pidan.
        2. COMIENZA RESPONDIENDO AL GRANO. La primera línea de tu respuesta debe contener la métrica exacta de forma contundente y sin saludos largos. (Ej: "A hoy el Plan Anual de Auditoría registra un cumplimiento global del ${avanceCronogramaGlobal}%..." o "A hoy contamos con un total de ${totalRiesgos} riesgos registrados...").
        3. SÉ UN CONSULTOR DE CONTROL INTERNO. Añade un breve párrafo analítico con criterio corporativo senior evaluando si la gestión va bien o si hay alarmas críticas basándote en los datos.
      `;

      const promptFinal = `${megaContexto}\n\nConsulta del Líder: "${auditorInput}"`;

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
const pendingPlansCount = pFiltrados.filter(p => p.estadoWorkflow === 'En Revisión').length;
  const hCerrados = hFiltrados.filter(h => h.estado === 'Cerrado').length;
  const pTotal = pFiltrados.length;
  const pAbiertos = pFiltrados.filter(p => p.estado !== 'Cerrado').length;
  const pCerrados = pFiltrados.filter(p => p.estado === 'Cerrado').length;

  const rendimientoControles = useMemo(() => {
    const evalFiltradas = safeEvaluaciones.filter(filterByGlobalPeriod);
    if (evalFiltradas.length === 0) return 0;
    return (evalFiltradas.filter(e => e.calificacion === 100).length / evalFiltradas.length) * 100;
  }, [safeEvaluaciones, selectedAnios, selectedMeses]);

// =====================================================================
  // --- SUBMITS DE ACCIONES CON TRAZABILIDAD DE AUTOR COMPLETA ---
  // =====================================================================
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

    let updatedList;
    if (editPlan && isAdmin) {
      const modificado = { ...editPlan, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editPlan.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan actualizado' }] };
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);
    } else if (!isAdmin) {
      const idHallazgo = parseInt(formData.get('idHallazgo'));
      const planToUpdate = safePlanes.find(p => p.idHallazgo === idHallazgo);
      
      if (planToUpdate) {
        const mod = { ...planToUpdate, progreso: progresoVal, estado: estadoVal, evidenciaUrl: evidenciaUrlOut, historialCambios: [...(planToUpdate.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Avance reportado por Jefe de área' }] };
        updatedList = safePlanes.map(p => p.id === planToUpdate.id ? mod : p);
      } else {
        showNotification("Error: No se encontró el plan asociado a este hallazgo.", "error");
        return;
      }
    } else {
      const nuevo = { id: Date.now(), idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Plan asignado' }] };
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
      const mod = { ...editEvaluacion, idRiesgo: parseInt(formData.get('idRiesgo')), diseño: formData.get('diseno'), ejecucion: formData.get('ejecucion'), calificacion: calif, comentarios: formData.get('comentarios'), evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editEvaluacion.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación modificada' }] };
      updatedList = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? mod : ev);
      setEditEvaluacion(null);
    } else {
      const nuevo = { id: Date.now(), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], diseño: formData.get('diseno'), ejecucion: formData.get('ejecucion'), calificacion: calif, comentarios: formData.get('comentarios'), auditor: user.email, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Evaluación de control registrada' }] };
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
      const mod = { ...editHallazgo, sede: formData.get('sede'), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), auditor: formData.get('auditor'), titulo: formData.get('titulo'), severidad: formData.get('severidad'), evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editHallazgo.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: 'Hallazgo modificado' }] };
      updated = safeHallazgos.map(h => h.id === editHallazgo.id ? mod : h);
      setEditHallazgo(null);
    } else {
      const nuevo = { id: Date.now(), sede: formData.get('sede'), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), auditor: formData.get('auditor'), titulo: formData.get('titulo'), severidad: formData.get('severidad'), estado: 'Abierto', fecha: new Date().toISOString().split('T')[0], anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Desviación documentada' }] };
      updated = [...safeHallazgos, nuevo];
    }
    setHallazgos(updated); await saveToCloud({ hallazgos: updated }); e.target.reset(); showNotification("Desviación documentada.");
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
    setIsSubmitting(true); // 🛑 PRENDEMOS EL ESTADO DE CARGA Y BLOQUEAMOS BOTÓN
    console.log("🚀 Ejecución global V4 (Con Loading State)...");
    
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

      let updated;
      let refConsecutivoFinal = '';

      if (editInformeAuditoria) {
        refConsecutivoFinal = editInformeAuditoria.ref;
        const mod = { 
          ...editInformeAuditoria, titulo: tituloVal, proceso: procesoVal, fecha: fechaVal,
          elaboradoPor: elaboradoPorVal, revisadoPor: revisadoPorVal, aprobadoPor: aprobadoPorVal,
          socializado: socializadoVal, socializadoCon: socializadoConVal,
          evidenciaUrl: evidenciaUrlOut, actaSocializacionUrl: actaSocializacionUrlOut
        };
        updated = safeInformes.map(inf => inf.id === editInformeAuditoria.id ? mod : inf);
        setEditInformeAuditoria(null);
      } else {
        // 🛡️ Lógica robusta: Busca el número más alto usado para no repetir consecutivos
        const ultimo = Math.max(
          ...safeInformes.map(i => parseInt(i.ref?.split('-')[2] || 0)),
          0
        );
        const idx = ultimo + 1;

        refConsecutivoFinal = `INF-2026-${String(idx).padStart(3, '0')}`;
        const nuevo = {
          id: crypto.randomUUID(), ref: refConsecutivoFinal, titulo: tituloVal, proceso: procesoVal,
          fecha: fechaVal, elaboradoPor: elaboradoPorVal, revisadoPor: revisadoPorVal,
          aprobadoPor: aprobadoPorVal, socializado: socializadoVal, socializadoCon: socializadoConVal,
          evidenciaUrl: evidenciaUrlOut, actaSocializacionUrl: actaSocializacionUrlOut
        };
        updated = [nuevo, ...safeInformes];
      }

      // 📧 DISPARADOR GLOBAL DE EMAILJS CON ESPERA (AWAIT)
      if (correosNotificacionOut !== '') {
        console.log("📡 Disparando Fetch hacia la API de EmailJS para: " + correosNotificacionOut);
        const emailParams = {
          ref_consecutivo: refConsecutivoFinal, titulo_informe: tituloVal, proceso_auditado: procesoVal,
          enlace_pdf: evidenciaUrlOut, enlace_acta: actaSocializacionUrlOut || 'No adjunta', destinatarios: correosNotificacionOut
        };

        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: import.meta.env.VITE_EMAILJS_SERVICE_ID,
            template_id: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
            user_id: import.meta.env.VITE_EMAILJS_PUBLIC_KEY, 
            accessToken: import.meta.env.VITE_EMAILJS_PRIVATE_KEY, 
            template_params: emailParams
          })
        });

        if (res.ok) {
          showNotification("Notificación electrónica enviada con éxito.");
        } else {
          console.error("❌ EmailJS rechazó la petición. Verifica tus llaves en el .env");
        }
      } else {
        console.log("⚠️ No hay correos en la casilla, omitiendo EmailJS.");
      }   

      // Guardado final
      setInformesAuditoria(updated);    
      await saveToCloud({ informesAuditoria: updated });
      e.target.reset();
      showNotification("Informe de auditoría procesado y guardado correctamente.");

    } catch (error) {
      console.error("Error crítico al procesar informe:", error);
      showNotification("Hubo un error al procesar la solicitud.", "error");
    } finally {
      setIsSubmitting(false); // ✅ APAGAMOS EL ESTADO DE CARGA Y DESBLOQUEAMOS BOTÓN (Incluso si falló)
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
  type="submit" 
  disabled={isSubmitting}
  className={`font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center block ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#004d40] hover:bg-[#003d33] text-white cursor-pointer'}`}
>
  {isSubmitting ? '⏳ Procesando...' : (editInformeAuditoria ? 'Guardar Cambios' : 'Radicar, Archivar y Enviar Dictamen')}
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
      <Tablero 
        avanceGlobal={avanceGlobal}
        rendimientoControles={rendimientoControles}
        hAbiertos={hAbiertos}
        hFiltrados={hFiltrados}
        renderHeaderFiltros={renderHeaderFiltros}
      />
    );
  };
    const renderDashboardRiesgos = () => {
    return (
      <DashboardRiesgos 
        tipoMatriz={tipoMatriz}
        rFiltrados={rFiltrados}
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
        formatSafeDate={formatSafeDate}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        columnFilters={columnFilters}
        handleColFilterChange={handleColFilterChange}
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

            // 📧 DISPARADOR DE EMAILJS AUTOMÁTICO
            if (nuevoEstadoWorkflow === 'En Revisión') {
              // Notificamos al administrador principal
              const emailParams = {
                ref_consecutivo: `PLAN-${id}`,
                titulo_informe: 'Alerta: Plan de Acción listo para revisión',
                proceso_auditado: planModificado.accion.substring(0, 50) + '...',
                enlace_pdf: 'Revisa la plataforma GCM Auditor',
                enlace_acta: 'N/A',
                destinatarios: 'controlinterno@termales.com.co' // Correo del administrador
              };

fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  service_id: import.meta.env.VITE_EMAILJS_SERVICE_ID,
                  template_id: "template_dwr658j", // <-- AQUÍ PEGAMOS TU NUEVO ID
                  user_id: import.meta.env.VITE_EMAILJS_PUBLIC_KEY, 
                  accessToken: import.meta.env.VITE_EMAILJS_PRIVATE_KEY, 
                  template_params: emailParams
                })              
              }).catch(e => console.error("Error silencioso EmailJS:", e));
            }

            // Mensaje de éxito en pantalla
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

      {/* ===================================================================== */}
      {/* 🤖 UI DEL AUDITOR IA - RÉPLICA EXACTA DE ALTA FIDELIDAD CON TARJETAS  */}
      {/* ===================================================================== */}
      {!isPresentationMode && isAdmin && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end font-sans selection:bg-blue-500/30 text-white">
           {showAuditorIA && (
             <div className="mb-4 w-[360px] sm:w-[380px] bg-[#060b16] rounded-[28px] shadow-[0_15px_50px_rgba(0,0,0,0.9)] border border-blue-500/20 overflow-hidden animate-in slide-in-from-bottom-5 p-4 space-y-3.5">
               
               {/* 1. CABECERA INSTITUCIONAL */}
               <div className="flex justify-between items-center px-1">
                 {/* Pill Status */}
                 <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></div>
                   <span className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Online</span>
                 </div>
                 {/* Títulos */}
                 <div className="text-center flex-1 pr-4">
                   <h3 className="font-black text-sm tracking-widest text-slate-100">AUDITOR IA</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Asistente Inteligente</p>
                 </div>
                 {/* Botón Contraer / Cerrar */}
                 <button onClick={() => setShowAuditorIA(false)} className="text-slate-400 hover:text-white transition-colors p-1 text-base font-bold">
                   <svg className="w-4 h-4 transform rotate-90 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                 </button>
               </div>
               
               {/* 2. RECUADRO SUPERIOR: VISOR CIBERNETICO Y FRECUENCIA DE ONDA */}
               <div className="bg-[#0a1122] border border-blue-500/15 rounded-2xl p-4 flex flex-col items-center justify-center relative h-[170px] overflow-hidden shadow-inner">
                 <div className="absolute w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                 
                 {/* Robot Glossy en Vector Avanzado */}
                 <div className="relative z-10 w-24 h-24 flex items-center justify-center drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
                   <svg viewBox="0 0 100 100" className="w-full h-full">
                     <defs>
                       <linearGradient id="helmGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                         <stop offset="0%" stopColor="#ffffff" />
                         <stop offset="45%" stopColor="#f8fafc" />
                         <stop offset="100%" stopColor="#cbd5e1" />
                       </linearGradient>
                       <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                         <stop offset="0%" stopColor="#0a0f1d" />
                         <stop offset="100%" stopColor="#1e293b" />
                       </linearGradient>
                       <radialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
                         <stop offset="0%" stopColor="#38bdf8" />
                         <stop offset="40%" stopColor="#0284c7" />
                         <stop offset="100%" stopColor="#0a1122" />
                       </radialGradient>
                     </defs>
                     <path d="M24,36 L16,23 L24,19 Z" fill="#ef4444" />
                     <path d="M76,36 L85,23 L76,19 Z" fill="#ef4444" />
                     <rect x="16" y="36" width="6" height="18" rx="3" fill="#475569" />
                     <rect x="78" y="36" width="6" height="18" rx="3" fill="#475569" />
                     <circle cx="50" cy="45" r="28" fill="url(#helmGrad)" stroke="#94a3b8" strokeWidth="0.5" />
                     <rect x="28" y="31" width="44" height="28" rx="14" fill="url(#screenGrad)" stroke="#2563eb" strokeWidth="1" />
                     <circle cx="40" cy="45" r="3.5" fill="url(#neonGlow)" className="animate-pulse" />
                     <circle cx="60" cy="45" r="3.5" fill="url(#neonGlow)" className="animate-pulse" />
                     <path d="M42,72 L58,72 L55,83 L45,83 Z" fill="#94a3b8" />
                     <circle cx="50" cy="77" r="2.5" fill="#38bdf8" />
                   </svg>
                 </div>

                 {/* Ecualizador de Onda Cyan Fluido de Fondo */}
                 <div className="absolute inset-x-0 bottom-2 h-16 pointer-events-none z-0 opacity-90 flex items-center">
                   <svg viewBox="0 0 100 20" className="w-full h-full text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" preserveAspectRatio="none">
                     <path d="M0,10 Q8,10 12,2 T24,18 T36,10 T46,1 T56,19 T66,10 T76,2 T86,17 L100,10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                   </svg>
                 </div>
               </div>

               {/* 3. RECUADRO INTERMEDIO: TARJETA DE IDENTIDAD CORPORATIVA */}
               <div className="bg-[#0a1122] border border-blue-500/15 p-3 rounded-2xl flex items-center justify-between shadow-inner">
                 <div className="flex items-center space-x-3">
                   <div className="w-10 h-10 bg-[#050a14] rounded-xl flex items-center justify-center border border-blue-500/20 shadow-md">
                     <span className="text-xl">🤖</span>
                   </div>
                   <div className="space-y-0.5">
                     <h4 className="font-black text-slate-100 text-[12px] tracking-wide">TERMALES DE SANTA ROSA</h4>
                     <div className="flex items-center space-x-1 text-blue-400 font-bold tracking-widest text-[9px]">
                       <span className="text-amber-500 text-xs">👑</span>
                       <span>CONTROL INTERNO</span>
                     </div>
                   </div>
                 </div>
                 {/* Escudo de Verificación */}
                 <div className="text-blue-500 pr-1">
                   <svg className="w-5 h-5 text-blue-500 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                   </svg>
                 </div>
               </div>

               {/* 4. BLOQUE PRINCIPAL: RESPUESTA O SUGERENCIAS RÁPIDAS */}
               <div className="bg-[#0a1122]/70 border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-inner">
                 {auditorRespuesta ? (
                   // Si hay una respuesta generada por la IA, se muestra aquí de forma limpia
                   <div className="space-y-2.5">
                     <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                       <span className="text-[9px] uppercase tracking-widest text-blue-400 font-black">Dictamen Consolidado</span>
                       <button onClick={() => setAuditorRespuesta('')} className="text-[9px] text-slate-400 hover:text-white font-bold bg-slate-800 px-2 py-0.5 rounded-md transition-colors">← Volver</button>
                     </div>
                     <div className="text-slate-200 text-[11px] leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap font-medium pr-1 scrollbar-thin border-l-2 border-blue-500 pl-2.5">
                       {auditorRespuesta}
                     </div>
                   </div>
                 ) : (
                   // Interfaz Base: Saludo Personalizado y Tarjetas de Sugerencias Rápidas
                   <>
                     <div className="flex items-start space-x-2.5">
                       <div className="w-6 h-6 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 text-xs shadow-sm mt-0.5">🤖</div>
                       <div className="text-slate-300 text-[11px] leading-relaxed font-semibold">
                         ¡Hola Juan! 👋 <br />
                         Soy tu asistente de auditoría inteligente. Puedo ayudarte con análisis, riesgos, alertas, cumplimientos y mucho más.
                       </div>
                     </div>

                     {/* Subtítulo Sugerencias */}
                     <div className="text-blue-400 font-black text-[9px] tracking-wider uppercase flex items-center space-x-1 pt-1.5 border-t border-slate-800/40">
                       <span>⚡</span><span>Sugerencias Rápidas</span>
                     </div>

                     {/* Lista de Botones Dinámicos */}
                     <div className="flex flex-col space-y-1.5">
                       {[
                         { text: '¿Cuántas facturas fueron rechazadas hoy?', icon: '❌' },
                         { text: 'Mostrar clientes con mayor riesgo', icon: '⚠️' },
                         { text: '¿Qué usuarios tienen más anulaciones?', icon: '👤' },
                         { text: 'Resumen de eventos DIAN del mes', icon: '📑' }
                       ].map((sug, idx) => (
                         <button 
                           key={`sug-${idx}`}
                           type="button"
                           onClick={() => setAuditorInput(sug.text)}
                           className="w-full bg-[#050a14]/90 border border-slate-800/80 hover:border-blue-500/40 hover:bg-[#0a1122] px-3 py-2 rounded-xl flex items-center justify-between text-left transition-all duration-200 group"
                         >
                           <div className="flex items-center space-x-2.5 text-slate-300 text-[11px] font-medium truncate pr-2">
                             <span className="text-xs shrink-0">{sug.icon}</span>
                             <span className="truncate group-hover:text-slate-100">{sug.text}</span>
                           </div>
                           <span className="text-slate-500 group-hover:text-blue-400 text-[10px] font-bold transition-colors pl-1 shrink-0">➔</span>
                         </button>
                       ))}
                     </div>
                   </>
                 )}
               </div>

               {/* 5. INPUT DE ENTRADA CON BOTÓN DE AVIÓN INTEGRADO */}
               <form onSubmit={handleAuditorSubmit} className="w-full relative pt-0.5">
                 <input 
                   type="text" 
                   value={auditorInput}
                   onChange={(e) => setAuditorInput(e.target.value)}
                   placeholder="Escribe tu consulta aquí..."
                   disabled={isAuditorThinking}
                   className="w-full bg-[#0a1122] border border-slate-800 rounded-2xl pl-4 pr-12 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-inner font-medium transition-all"
                 />
                 <button 
                   type="submit" 
                   disabled={isAuditorThinking || !auditorInput.trim()} 
                   className="absolute right-2 top-[54%] -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:bg-slate-800 shadow-[0_0_12px_rgba(37,99,235,0.3)] flex items-center justify-center"
                 >
                   <svg className="w-3.5 h-3.5 transform rotate-45 mr-0.5 -mt-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                     <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                   </svg>
                 </button>
               </form>

             </div>
           )}

           {/* Botón Flotante Circular con Borde de Neón Luminoso */}
           <button 
             onClick={() => setShowAuditorIA(!showAuditorIA)} 
             className={`w-16 h-16 rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 border-2 bg-[#050a14] ${
               showAuditorIA 
                 ? 'border-slate-700 text-white scale-90' 
                 : 'border-cyan-500/80 shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-105'
             }`}
           >
             {showAuditorIA ? (
               <span className="text-xl font-bold">✕</span>
             ) : (
               <div className="w-12 h-12 flex items-center justify-center">
                 <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]">
                   <path d="M24,36 L15,23 L24,19 Z" fill="#ef4444" />
                   <path d="M76,36 L85,23 L76,19 Z" fill="#ef4444" />
                   <rect x="16" y="36" width="5" height="16" rx="2.5" fill="#475569" />
                   <rect x="79" y="36" width="5" height="16" rx="2.5" fill="#475569" />
                   <circle cx="50" cy="45" r="26" fill="#f8fafc" />
                   <rect x="29" y="32" width="42" height="26" rx="13" fill="#0f172a" />
                   <circle cx="41" cy="45" r="3" fill="#38bdf8" />
                   <circle cx="59" cy="45" r="3" fill="#38bdf8" />
                   <path d="M43,71 L57,71 L54,80 L46,80 Z" fill="#94a3b8" />
                 </svg>
               </div>
             )}
           </button>
        </div>
      )}

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