import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// =====================================================================
// 🤖 MOTOR IA GEMINI INTEGRADO (Dual: Entorno de Pruebas / Producción)
// =====================================================================
const canvasApiKey = ""; // Llave inyectada automáticamente por el Canvas

let GEMINI_API_KEY = "";
try {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  }
} catch (error) {
  console.warn("Entorno simulado detectado.");
}

// --- TUS LLAVES SECRETAS DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBGE2P-_oep_N7o8so6wubmaZXv12imZaE",
  authDomain: "gestion-de-riesgos-b4bf0.firebaseapp.com",
  projectId: "gestion-de-riesgos-b4bf0",
  storageBucket: "gestion-de-riesgos-b4bf0.firebasestorage.app",
  messagingSenderId: "507146405155",
  appId: "1:507146405155:web:574f89d0cc6256e629b896",
  measurementId: "G-WTZPTWV67Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 

// --- CONTROL DE ACCESO (ROLES) ---
const ADMIN_EMAILS = [
  "controlinterno@termales.com.co",
  "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co",
  "analista.controlinterno@termales.com.co"
];

// --- DATOS POR DEFECTO ---
const defaultRiesgos = [
  { id: 98, sede: 'Hotel', categoria: 'Operativo', proceso: 'Alimentos y bebidas', normativa: 'Norma Técnica de Salubridad', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Afectación del sabor e higiene de alimentos por uso de insumos cárnicos de baja calidad.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío diaria e inspección organoléptica al recibir insumos.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe de Alimentos y Bebidas', historialCambios: [] },
  { id: 186, sede: 'Administrativo', categoria: 'Estratégico', proceso: 'Gestión Estratégica', normativa: 'Estatuto Tributario (DIAN)', tipoRiesgo: 'Legal y Regulatorio', afectacion: 'Económica', causaInmediata: 'Cambios normativos tributarios', causaRaiz: 'Falta de comité legal interno', descripcion: 'Sanciones o pérdidas financieras por errores en la declaración de impuestos hoteleros.', probabilidadInherente: 'Rara', impactoInherente: 'Medio', noControl: 'C-186', descripcionControl: 'Revisión y auditoría externa por firma contable cada trimestre.', probabilidadResidual: 'Rara', impactoResidual: 'Bajo', responsable: 'Gerente Financiero', historialCambios: [] },
  { id: 201, sede: 'Ecoparque', categoria: 'Tecnológico', proceso: 'Infraestructura TI', normativa: 'Ley 1581 Protección de Datos', tipoRiesgo: 'Ciberseguridad', afectacion: 'Operacional', causaInmediata: 'Falta de parches de seguridad', causaRaiz: 'Obsolescencia de servidores locales', descripcion: 'Intrusión de ransomware que paralice el sistema de taquillas.', probabilidadInherente: 'Posible', impactoInherente: 'Crítico', noControl: 'C-201', descripcionControl: 'Firewall activo con logs y copias de seguridad semanales inmutables.', probabilidadResidual: 'Posible', impactoResidual: 'Alto', responsable: 'CISO / Director de TI', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, sede: 'Ecoparque', ref: 'HAL-2026-001', titulo: 'Acceso de usuarios genéricos a la base de datos de taquilla.', proceso: 'Sistemas', responsable: 'Jefe de TI', auditor: 'Auditoría TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', historialCambios: [] },
  { id: 2, sede: 'Hotel', ref: 'HAL-2025-089', titulo: 'Ausencia de actas de capacitación en higiene de alimentos.', proceso: 'Alimentos y bebidas', responsable: 'Jefe de A&B', auditor: 'Control Interno', severidad: 'Medio', idRiesgo: 98, estado: 'Cerrado', fecha: '2025-11-15', historialCambios: [] }
];

const defaultPlanes = [
  { id: 1, idHallazgo: 1, accion: 'Desactivar credenciales comunes y parametrizar roles individuales en base de datos.', responsable: 'Jefe de TI', fecha: '2026-07-15', estado: 'En Proceso', progreso: 30, historialCambios: [] },
  { id: 2, idHallazgo: 2, accion: 'Realizar capacitación certificada con entidad de salud y documentar firmas.', responsable: 'Jefe de A&B', fecha: '2025-12-10', estado: 'Cerrado', progreso: 100, historialCambios: [] }
];

const defaultIncidentes = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-05', titulo: 'Alarma de ataque de fuerza bruta contenida', descripcion: 'El firewall detectó 400 intentos de inicio de sesión fallidos de IPs externas. El puerto se bloqueó.', costo: 1200000, impacto: 'Bajo', reportadoPor: 'analista.controlinterno@termales.com.co', estado: 'Cerrado', historialCambios: [] }
];

const defaultEvaluaciones = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-01', diseño: 'Eficaz', ejecucion: 'Eficaz', calificacion: 100, comentarios: 'Prueba de penetración simulada arrojó contención del cortafuegos de manera instantánea.', auditor: 'controlinterno@termales.com.co', historialCambios: [] },
  { id: 2, idRiesgo: 98, fecha: '2026-06-02', diseño: 'Eficaz', ejecucion: 'Inadecuado', calificacion: 0, comentarios: 'No se encontraron los checklist del mes pasado en la cocina del Hotel.', auditor: 'controlinterno@termales.com.co', historialCambios: [] }
];

const defaultCronograma = [
  { id: 1, codigo: '01', periodo: 'Enero - Febrero', proceso: 'Operaciones Alojamiento y recreación.', enfoque: 'Hotel/Ecoparque (Rentabilidad AyB), Inventarios, Auditoria Locativa e Infraestructura, Calidad, Taquilla, Manillas, Estandarización de procesos y alimentación.', cumplimiento: 100, responsable: 'Todos', apoyo: '', meses: ['Enero', 'Febrero'] },
  { id: 2, codigo: '02', periodo: 'Marzo - Abril', proceso: 'Servicio al cliente', enfoque: 'Hotel/Ecoparque Análisis de Quejas y Reclamos, Verificación de efectividad de planes de acción y auditoría de raíz de las cosas.', cumplimiento: 80, responsable: 'Angelica F. Hernandez', apoyo: 'Yehison J Pineda', meses: ['Marzo', 'Abril'] },
  { id: 3, codigo: '03', periodo: 'Marzo - Abril', proceso: 'Cartera (Notas Crédito y Descuentos)', enfoque: 'Verificación del comportamiento de NC en los procesos que generan estos documentos en la operación, análisis de cumplimiento de procedimientos y trazabilidad.', cumplimiento: 100, responsable: 'Luz Angela Chico T.', apoyo: 'Yehison J Pineda', meses: ['Marzo', 'Abril'] }
];

const defaultMonitoreo = [
  { id: 1, indicador: 'ARQUEOS DE CAJA', valor: 117, limite: 120, tendencia: 'up', proceso: 'Finanzas' },
  { id: 2, indicador: 'INVENTARIO MANILLAS', valor: 16, limite: 20, tendencia: 'down', proceso: 'Operaciones' },
  { id: 3, indicador: 'NOTAS CRÉDITO', valor: 4, limite: 10, tendencia: 'flat', proceso: 'Auditoría' }
];

// =====================================================================
// 🛠️ FUNCIONES GLOBALES, CÁLCULOS Y FILTROS SEGURAS
// =====================================================================

const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };

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
  if (dateStr.includes('/')) return dateStr.split('/')[1];
  return 'N/A';
};

const getYearFromDate = (dateVal) => {
  const dateStr = formatSafeDate(dateVal);
  if (!dateStr) return 'N/A';
  if (dateStr.includes('-')) return dateStr.split('-')[0];
  if (dateStr.includes('/')) return dateStr.split('/')[2].substring(0,4);
  return 'N/A';
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

const applyFilters = (dataArray, globalTerm, colFilters) => {
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
const InfoTooltip = ({ text }) => (
  <div className="relative group inline-block ml-2 align-middle z-50">
    <span className="bg-blue-100 text-blue-700 rounded-full w-4 h-4 flex items-center justify-center text-[10px] cursor-help font-black shadow-sm border border-blue-200 hover:bg-blue-200 transition-colors">?</span>
    <div className="absolute z-[100] left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 bg-slate-900 text-white text-[11px] p-3 rounded-xl shadow-2xl pointer-events-none font-medium leading-relaxed text-left">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

const ProgressBar = ({ progress }) => {
  let color = "bg-red-500";
  if (progress >= 40) color = "bg-amber-500";
  if (progress >= 80) color = "bg-emerald-500";
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold mb-1">
        <span className="text-slate-500">% AVANCE</span>
        <span className="text-slate-800">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
};

const Gauge = ({ value, label, sublabel, colorClass }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center h-full">
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
          strokeDasharray={251} strokeDashoffset={251 - (251 * (value || 0)) / 100}
          className={`${colorClass} transition-all duration-1000`} />
      </svg>
      <span className="absolute text-xl font-black text-slate-800">{Math.round(value || 0)}%</span>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">{label}</p>
    <p className="text-xs font-bold text-slate-700">{sublabel}</p>
  </div>
);

const TrendChart = ({ data, title, isCurrency, color, fillColor }) => {
  const maxVal = Math.max(...data.map(d => d.valor), 1);
  const height = 100;
  const width = 600;
  const paddingY = 20;
  const paddingX = 15;

  const points = data.map((d, i) => {
    const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1));
    const y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`;

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
       <div className="flex justify-between items-center mb-4">
         <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h4>
         <span className="text-lg">{isCurrency ? '📉' : '📊'}</span>
       </div>
       <div className="relative w-full">
         <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm overflow-visible" preserveAspectRatio="none">
           <polygon points={fillPoints} fill={fillColor} opacity="0.4" />
           <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
           {data.map((d, i) => {
              const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1));
              const y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
              return (
                <g key={i} className="group cursor-pointer">
                    <circle cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2" className="transition-all duration-200 group-hover:r-[7px]" />
                    <rect x={x - 30} y={y - 28} width="60" height="18" rx="4" fill="#1e293b" className="opacity-0 group-hover:opacity-100 transition-opacity" pointerEvents="none" />
                    <text x={x} y={y - 15} fontSize="9" fill="white" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none">
                       {isCurrency ? `$${(d.valor/1000000).toFixed(1)}M` : d.valor}
                    </text>
                </g>
              );
           })}
         </svg>
         <div className="flex justify-between mt-3 text-[8px] font-bold text-slate-400 uppercase px-1 border-t border-slate-100 pt-2">
            {data.map(d => <span key={d.mes}>{d.mes}</span>)}
         </div>
       </div>
    </div>
  );
}

const FilterInput = ({ colKey, placeholder, dark, columnFilters, handleColFilterChange }) => (
  <input 
    type="text" 
    placeholder={placeholder || "Filtrar..."}
    className={`mt-1.5 w-full text-[9px] px-1.5 py-1 font-normal rounded border focus:outline-none focus:ring-1 ${
      dark 
        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500' 
        : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-[#004d40]'
    }`}
    value={columnFilters[colKey] || ''}
    onChange={(e) => handleColFilterChange(colKey, e.target.value)}
    onClick={(e) => e.stopPropagation()} 
  />
);

// =====================================================================
// APLICACIÓN PRINCIPAL
// =====================================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('tablero');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('residual'); 
  const [filtroAnio, setFiltroAnio] = useState('Todos');
  const [filtroMes, setFiltroMes] = useState('Todos'); 
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const [filtroHeatMap, setFiltroHeatMap] = useState(null);
  const [isUploading, setIsUploading] = useState(false); 
  const [isThinking, setIsThinking] = useState(false); 
  const [detalleUniverso, setDetalleUniverso] = useState(null); 
  
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});

  const [aiModal, setAiModal] = useState(null);

  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);
  const [editApetito, setEditApetito] = useState(null); 
  const [editCronograma, setEditCronograma] = useState(null);
  const [editMonitoreo, setEditMonitoreo] = useState(null);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

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

  useEffect(() => {
    setSearchTerm('');
    setColumnFilters({});
  }, [activeTab]);

  const handleColFilterChange = (key, value) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const checkAlertasInteligentes = () => {
    let alertas = [];
    const hoyStr = new Date().toISOString().split('T')[0];

    safePlanes.forEach(p => {
      const fechaPlan = formatSafeDate(p.fecha);
      if (fechaPlan && fechaPlan < hoyStr && p.estado !== 'Cerrado') {
        alertas.push({ id: `alert-p-${p.id}`, tipo: 'vencido', titulo: `Plan de Acción Vencido`, desc: `El plan #${p.id} de ${p.responsable} tenía fecha límite ${fechaPlan}.`, icono: '⏰', color: 'bg-red-50 text-red-700 border-red-200' });
      }
    });

    safeEvaluaciones.forEach(e => {
      if (e.calificacion < 100) {
        alertas.push({ id: `alert-e-${e.id}`, tipo: 'control', titulo: `Falla Crítica de Control`, desc: `Test #${e.id} falló en auditoría. Riesgo asociado requiere atención.`, icono: '🛡️', color: 'bg-orange-50 text-orange-700 border-orange-200' });
      }
    });

    safeRiesgos.forEach(r => {
      if (r.capacidadRiesgo) {
        const costoTotal = safeIncidentes.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
        if (costoTotal > r.capacidadRiesgo) {
          alertas.push({ id: `alert-r-${r.id}`, tipo: 'apetito', titulo: `¡Ruptura de Capacidad!`, desc: `El riesgo "${r.proceso}" excedió las pérdidas permitidas por la gerencia.`, icono: '💥', color: 'bg-rose-100 text-rose-800 border-rose-300 shadow-md' });
        } else if (r.toleranciaFinanciera && costoTotal > r.toleranciaFinanciera) {
          alertas.push({ id: `alert-r-tol-${r.id}`, tipo: 'apetito', titulo: `Alerta de Tolerancia`, desc: `El riesgo "${r.proceso}" entró en zona naranja de pérdidas.`, icono: '⚠️', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' });
        }
      }

      if (r.normativa && r.normativa !== 'Ninguna' && r.normativa !== '') {
        const evalsAsociadas = safeEvaluaciones.filter(e => e.idRiesgo === r.id && e.calificacion < 100);
        if (evalsAsociadas.length > 0) {
           alertas.push({ id: `alert-comp-${r.id}`, tipo: 'legal', titulo: `Riesgo de Incumplimiento Legal`, desc: `Controles ineficaces detectados. Posible violación a: ${r.normativa}.`, icono: '⚖️', color: 'bg-purple-100 text-purple-800 border-purple-300 shadow-md' });
        }
      }
    });

    return alertas;
  };

  const alertasActivas = checkAlertasInteligentes();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userEmailNormalized = currentUser.email?.toLowerCase().trim();
        const hasAdminAccess = ADMIN_EMAILS.some(email => email.toLowerCase().trim() === userEmailNormalized);
        setIsAdmin(hasAdminAccess);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (window.XLSX) { setXlsxLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);
    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        setRiesgos(Array.isArray(data.riesgos) ? data.riesgos : defaultRiesgos);
        setHallazgos(Array.isArray(data.hallazgos) ? data.hallazgos : defaultHallazgos);
        setPlanes(Array.isArray(data.planes) ? data.planes : defaultPlanes);
        setIncidentes(Array.isArray(data.incidentes) ? data.incidentes : defaultIncidentes);
        setEvaluaciones(Array.isArray(data.evaluaciones) ? data.evaluaciones : defaultEvaluaciones);
        setCronograma(Array.isArray(data.cronograma) ? data.cronograma : defaultCronograma);
        setMonitoreo(Array.isArray(data.monitoreo) ? data.monitoreo : defaultMonitoreo);
      } else {
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
          setDoc(docRef, {
            riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones,
            cronograma: defaultCronograma, monitoreo: defaultMonitoreo
          });
        }
      }
      setIsCloudLoaded(true);
    }, (error) => {
      console.error("Error leyendo Firestore:", error);
      showNotification("Error de permisos en la nube.", "error");
      setIsCloudLoaded(true);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        showNotification("Cuenta registrada con éxito.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        showNotification("Sesión iniciada correctamente.");
      }
    } catch (error) {
      setAuthError('Error de autenticación. Verifique sus credenciales.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRiesgos([]); setHallazgos([]); setPlanes([]); setIncidentes([]); setEvaluaciones([]); setCronograma([]); setMonitoreo([]);
    showNotification("Sesión cerrada.");
  };

  const saveToCloud = async (partialData) => {
    try {
      const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
      await setDoc(docRef, partialData, { merge: true });
    } catch (error) {
      showNotification("Error al guardar en la nube.", "error");
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

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

  // --- IA: ANÁLISIS DE EVIDENCIAS VISUAL (MODAL) ---
  const analizarEvidenciaIA = async (evidenciaUrl, contextoItem, tipoItem) => {
    setIsThinking(true);
    showNotification("🤖 Extrayendo documento y enviando a Gemini...", "success");

    let finalApiKey = canvasApiKey || GEMINI_API_KEY;
    let modelName = "gemini-2.5-flash-preview-09-2025"; 
    
    if (GEMINI_API_KEY && GEMINI_API_KEY.length > 5) {
      modelName = "gemini-1.5-pro";
    }

    try {
      const prompt = `Actúa como un Auditor Senior de Control Interno y Cumplimiento Normativo ISO.
      Se acaba de adjuntar un archivo de evidencia (Foto o PDF) para el siguiente ${tipoItem}: "${contextoItem}".
      Tu tarea es generar un dictamen de pre-auditoría rápido y estricto. Genera una lista de 4 puntos exactos que el analista DEBE verificar OBLIGATORIAMENTE con sus propios ojos al abrir ese archivo para asegurar que la evidencia es legalmente válida, mitiga el riesgo y no es fraudulenta. Sé muy técnico y directo (sin saludos).`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${finalApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
          })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const analisis = data.candidates[0].content.parts[0].text.trim();
      setAiModal({ titulo: `📋 Checklist IA (${modelName})`, contenido: analisis, url: evidenciaUrl });

    } catch (error) {
        console.error(error);
        showNotification("Error conectando con la IA de Google.", "error");
    } finally {
        setIsThinking(false);
    }
  };

  // --- IA: RELLENAR FORMULARIOS ---
  const sugerirConIA = async (tipoTarget) => {
    let textoBase = "";
    let inputDestino = null;

    if (tipoTarget === 'control') {
      textoBase = document.getElementById('input-descripcion-riesgo')?.value || document.getElementById('input-proceso-riesgo')?.value || "";
      inputDestino = document.getElementById('input-control-riesgo');
    } else if (tipoTarget === 'plan') {
      const selectElement = document.getElementById('select-hallazgo-plan');
      textoBase = selectElement ? selectElement.options[selectElement.selectedIndex]?.text : "";
      inputDestino = document.getElementById('input-accion-plan');
    } else if (tipoTarget === 'hallazgo') {
      textoBase = document.getElementById('input-proceso-hallazgo')?.value || "";
      inputDestino = document.getElementById('input-titulo-hallazgo');
    }

    if (!textoBase || textoBase.trim() === '' || textoBase.includes('-- Seleccione --')) {
      showNotification("⚠️ Escribe primero el Proceso o Descripción para que la IA tenga contexto.", "error");
      return;
    }

    setIsThinking(true);
    showNotification("🧠 Inteligencia Artificial analizando el escenario...", "success");

    let finalApiKey = canvasApiKey || GEMINI_API_KEY;
    let modelName = "gemini-2.5-flash-preview-09-2025"; 
    
    if (GEMINI_API_KEY && GEMINI_API_KEY.length > 5) {
      modelName = "gemini-1.5-pro";
    }

    if (!finalApiKey || finalApiKey === "") {
        setIsThinking(false);
        showNotification("⚠️ Entorno sin API Key de IA detectada.", "error");
        return;
    }

    try {
      let prompt = "";
      if (tipoTarget === 'control') {
        prompt = `Actúa como un experto en auditoría GRC y ciberseguridad (ISO 31000). El siguiente es un evento de riesgo en una empresa: "${textoBase}". Redacta la descripción de un CONTROL CLAVE mitigante o preventivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto del control, sin comillas ni saludos.`;
      } else if (tipoTarget === 'plan') {
        prompt = `Actúa como un gerente de auditoría interno corporativo. Se ha detectado el siguiente hallazgo o desviación: "${textoBase}". Redacta una ACCIÓN DE CHOQUE o plan correctivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto de la acción, sin comillas ni saludos.`;
      } else if (tipoTarget === 'hallazgo') {
        prompt = `Actúa como un Auditor Senior de Control Interno. Estás auditando el siguiente proceso: "${textoBase}". Redacta la descripción de un HALLAZGO O DESVIACIÓN grave y realista (máximo 20 palabras) que se podría encontrar en este proceso. Sé muy ejecutivo, técnico y directo. Solo responde con el texto del hallazgo, sin comillas ni saludos.`;
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${finalApiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }] }] };

      let delays = [1000, 2000, 4000, 8000, 16000];
      let responseData = null;
      
      for (let i = 0; i < 6; i++) {
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          responseData = data;
          break;
        } catch (err) {
          if (i === 5) throw err;
          await new Promise(r => setTimeout(r, delays[i]));
        }
      }

      if (!responseData) throw new Error("Fallo de red al conectar con IA.");

      let sugerencia = responseData.candidates[0].content.parts[0].text.trim();

      if (inputDestino) {
        // Inyección nativa infalible para React
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(inputDestino, sugerencia);
        inputDestino.dispatchEvent(new Event('input', { bubbles: true }));
        inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
        showNotification(`✨ ¡Sugerencia ejecutiva insertada!`);
      } else {
        showNotification("Error: No se encontró el campo de destino.", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showNotification("Error conectando con la IA de Google. Inténtalo de nuevo.", "error");
    } finally {
      setIsThinking(false);
    }
  };

  const handleRiesgoSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const probInh = formData.get('probInh');
    const impInh = formData.get('impInh');
    const probRes = formData.get('probRes') || probInh;
    const impRes = formData.get('impRes') || impInh;
    const timestamp = new Date().toLocaleString();

    let updatedList;
    if (editRiesgo) {
      const modificado = {
        ...editRiesgo,
        sede: formData.get('sede'), 
        proceso: formData.get('proceso'), 
        categoria: formData.get('categoria'), 
        normativa: formData.get('normativa'), 
        responsable: formData.get('responsable'),
        descripcionControl: formData.get('control'), 
        descripcion: formData.get('descripcion'),
        probabilidadInherente: probInh, impactoInherente: impInh, probabilidadResidual: probRes, impactoResidual: impRes,
        historialCambios: [...(editRiesgo.historialCambios || []), { fecha: timestamp, accion: 'Registro modificado por Auditor' }]
      };
      updatedList = safeRiesgos.map(r => r.id === editRiesgo.id ? modificado : r);
      setEditRiesgo(null);
      showNotification("Riesgo actualizado.");
    } else {
      const nuevo = {
        id: safeRiesgos.length ? Math.max(...safeRiesgos.map(r => r.id)) + 1 : 1,
        sede: formData.get('sede'), 
        proceso: formData.get('proceso'), 
        categoria: formData.get('categoria'), 
        normativa: formData.get('normativa'), 
        responsable: formData.get('responsable'),
        noControl: 'C-' + Math.floor(Math.random() * 100 + 100), 
        descripcionControl: formData.get('control'),
        descripcion: formData.get('descripcion'), 
        probabilidadInherente: probInh, impactoInherente: impInh,
        probabilidadResidual: probRes, impactoResidual: impRes,
        historialCambios: [{ fecha: timestamp, accion: 'Riesgo e indicadores iniciales creados' }]
      };
      updatedList = [...safeRiesgos, nuevo];
      showNotification("Riesgo guardado.");
    }
    setRiesgos(updatedList);
    await saveToCloud({ riesgos: updatedList });
    e.target.reset();
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const idRiesgo = parseInt(formData.get('idRiesgo'));
    const diseno = formData.get('diseno');
    const ejecucion = formData.get('ejecucion');
    const calif = (diseno === 'Eficaz' && ejecucion === 'Eficaz') ? 100 : 0;
    const timestamp = new Date().toLocaleString();
    
    const archivo = formData.get('evidenciaArchivo');
    let evidenciaUrlOut = editEvaluacion?.evidenciaUrl || '';

    if (archivo && archivo.size > 0) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `evidencias/evaluaciones/${Date.now()}_${archivo.name}`);
        await uploadBytes(fileRef, archivo);
        evidenciaUrlOut = await getDownloadURL(fileRef);
        showNotification("Evidencia cargada a la nube.");
      } catch (error) {
        showNotification("Error al adjuntar el archivo.", "error");
      }
      setIsUploading(false);
    }

    let updatedList;
    if (editEvaluacion) {
      const modificada = {
        ...editEvaluacion, idRiesgo, diseño: diseno, ejecucion, calificacion: calif, comentarios: formData.get('comentarios'),
        evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editEvaluacion.historialCambios || []), { fecha: timestamp, accion: 'Evaluación modificada' }]
      };
      updatedList = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? modificada : ev);
      setEditEvaluacion(null);
    } else {
      const nuevaEval = {
        id: safeEvaluaciones.length ? Math.max(...safeEvaluaciones.map(ev => ev.id)) + 1 : 1, idRiesgo, fecha: new Date().toISOString().split('T')[0],
        diseño: diseno, ejecucion, calificacion: calif, comentarios: formData.get('comentarios'), 
        auditor: isAdmin ? user.email : `Autoevaluación (${user.email})`, 
        evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: timestamp, accion: 'Test de auditoría generado' }]
      };
      updatedList = [...safeEvaluaciones, nuevaEval];
    }

    const nuevosRiesgos = safeRiesgos.map(r => {
      if (r.id === idRiesgo) {
        let nuevaProb = (calif === 100) ? 'Rara' : r.probabilidadInherente;
        return { ...r, probabilidadResidual: nuevaProb, historialCambios: [...(r.historialCambios||[]), { fecha: timestamp, accion: `Test arrojó efectividad ${calif}%. Riesgo recalculado.` }] };
      }
      return r;
    });

    setEvaluaciones(updatedList); setRiesgos(nuevosRiesgos);
    await saveToCloud({ evaluaciones: updatedList, riesgos: nuevosRiesgos });
    e.target.reset();
    if(!isAdmin) showNotification("Autoevaluación enviada exitosamente al equipo de Control Interno.");
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const idRiesgo = formData.get('idRiesgo');
    const timestamp = new Date().toLocaleString();

    const archivo = formData.get('evidenciaArchivo');
    let evidenciaUrlOut = editHallazgo?.evidenciaUrl || '';

    if (archivo && archivo.size > 0) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `evidencias/hallazgos/${Date.now()}_${archivo.name}`);
        await uploadBytes(fileRef, archivo);
        evidenciaUrlOut = await getDownloadURL(fileRef);
        showNotification("Evidencia cargada a la nube.");
      } catch (error) {
        showNotification("Error al adjuntar el archivo.", "error");
      }
      setIsUploading(false);
    }

    let updatedList;
    if (editHallazgo) {
      const modificado = {
        ...editHallazgo, 
        sede: formData.get('sede'), 
        ref: formData.get('ref'), 
        proceso: formData.get('proceso'), 
        responsable: formData.get('responsable'),
        auditor: formData.get('auditor'), 
        titulo: formData.get('titulo'), 
        severidad: formData.get('severidad'), 
        idRiesgo: idRiesgo ? parseInt(idRiesgo) : null,
        evidenciaUrl: evidenciaUrlOut, 
        historialCambios: [...(editHallazgo.historialCambios || []), { fecha: timestamp, accion: 'Hallazgo editado' }]
      };
      updatedList = safeHallazgos.map(h => h.id === editHallazgo.id ? modificado : h);
      setEditHallazgo(null);
      showNotification("Hallazgo actualizado exitosamente.");
    } else {
      const nuevo = {
        id: safeHallazgos.length ? Math.max(...safeHallazgos.map(h => h.id)) + 1 : 1, 
        sede: formData.get('sede'), 
        ref: formData.get('ref'), 
        proceso: formData.get('proceso'), 
        responsable: formData.get('responsable'),
        auditor: formData.get('auditor'),
        titulo: formData.get('titulo'), 
        severidad: formData.get('severidad'), 
        idRiesgo: idRiesgo ? parseInt(idRiesgo) : null,
        estado: 'Abierto', 
        fecha: new Date().toISOString().split('T')[0], 
        evidenciaUrl: evidenciaUrlOut, 
        historialCambios: [{ fecha: timestamp, accion: 'Hallazgo documentado' }]
      };
      updatedList = [...safeHallazgos, nuevo];
      showNotification("Hallazgo creado exitosamente.");
    }
    
    setHallazgos(updatedList);
    await saveToCloud({ hallazgos: updatedList });
    e.target.reset();
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const timestamp = new Date().toLocaleString();
    const progresoVal = parseInt(formData.get('progreso') || 0);
    const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';
    
    const archivo = formData.get('evidenciaArchivo');
    let evidenciaUrlOut = editPlan?.evidenciaUrl || '';

    if (archivo && archivo.size > 0) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `evidencias/planes/${Date.now()}_${archivo.name}`);
        await uploadBytes(fileRef, archivo);
        evidenciaUrlOut = await getDownloadURL(fileRef);
        showNotification("Soporte de avance cargado a la nube.");
      } catch (error) {
        showNotification("Error al adjuntar el archivo.", "error");
      }
      setIsUploading(false);
    }

    let updatedList;
    if (editPlan) {
      const modificado = {
        ...editPlan, 
        idHallazgo: formData.get('idHallazgo') ? parseInt(formData.get('idHallazgo')) : editPlan.idHallazgo, 
        accion: formData.get('accion') || editPlan.accion, 
        responsable: formData.get('responsable') || editPlan.responsable, 
        fecha: formData.get('fecha') || editPlan.fecha, 
        progreso: progresoVal, estado: estadoVal,
        evidenciaUrl: evidenciaUrlOut,
        historialCambios: [...(editPlan.historialCambios || []), { fecha: timestamp, accion: isAdmin ? 'Plan modificado' : 'Avance actualizado por dueño de proceso' }]
      };
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);
      showNotification("Plan actualizado.");
    } else {
      if(!isAdmin) return; 
      const nuevo = {
        id: safePlanes.length ? Math.max(...safePlanes.map(p => p.id)) + 1 : 1, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'),
        responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, 
        evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: timestamp, accion: 'Plan asignado' }]
      };
      updatedList = [...safePlanes, nuevo];
      showNotification("Plan asignado exitosamente.");
    }

    setPlanes(updatedList);
    await saveToCloud({ planes: updatedList });
    if(e.target) e.target.reset();
  };

  const handleIncidenteSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const idRiesgo = parseInt(formData.get('idRiesgo'));
    const timestamp = new Date().toLocaleString();

    let updatedList;
    if (editIncidente) {
      const modificado = { ...editIncidente, idRiesgo, titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), costo: parseFloat(formData.get('costo') || 0), impacto: formData.get('impacto'), historialCambios: [...(editIncidente.historialCambios || []), { fecha: timestamp, accion: 'Incidente modificado' }] };
      updatedList = safeIncidentes.map(i => i.id === editIncidente.id ? modificado : i);
      setEditIncidente(null);
    } else {
      const nuevo = { id: safeIncidentes.length ? Math.max(...safeIncidentes.map(i => i.id)) + 1 : 1, idRiesgo, fecha: new Date().toISOString().split('T')[0], titulo: formData.get('titulo'), descripcion: formData.get('descripcion'), costo: parseFloat(formData.get('costo') || 0), impacto: formData.get('impacto'), reportadoPor: user.email, estado: 'Abierto', historialCambios: [{ fecha: timestamp, accion: 'Incidente reportado' }] };
      updatedList = [...safeIncidentes, nuevo];
    }

    const nuevosRiesgos = safeRiesgos.map(r => r.id === idRiesgo ? { ...r, historialCambios: [...(r.historialCambios||[]), { fecha: timestamp, accion: `Incidente registrado o modificado` }] } : r);
    setIncidentes(updatedList); setRiesgos(nuevosRiesgos);
    await saveToCloud({ incidentes: updatedList, riesgos: nuevosRiesgos });
    e.target.reset();
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
    showNotification("Registro eliminado.", "error");
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
      showNotification("Error: La jerarquía debe ser: Apetito ≤ Tolerancia ≤ Capacidad.", "error");
      return;
    }

    const modificado = {
      ...editApetito,
      posturaEstrategica: formData.get('posturaEstrategica'),
      kriScore: parseInt(formData.get('kriScore')),
      apetitoFinanciero: apetito,
      toleranciaFinanciera: tolerancia,
      capacidadRiesgo: capacidad,
      historialCambios: [...(editApetito.historialCambios || []), { fecha: timestamp, accion: 'Arquitectura de apetito COSO ERM / ISO 31000 parametrizada' }]
    };

    const updatedList = safeRiesgos.map(r => r.id === editApetito.id ? modificado : r);
    setRiesgos(updatedList);
    setEditApetito(null);
    await saveToCloud({ riesgos: updatedList });
    showNotification("Perfil COSO de Apetito guardado exitosamente.");
    scrollToTop();
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
        id: safeCronograma.length ? Math.max(...safeCronograma.map(c => c.id)) + 1 : 1,
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
        id: safeMonitoreo.length ? Math.max(...safeMonitoreo.map(m => m.id)) + 1 : 1,
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

  // ==================== RENDERS DE VISTAS (ADMIN) ====================

  const renderPlanAnual = () => {
    const avgCumplimiento = safeCronograma.length > 0 
      ? Math.round(safeCronograma.reduce((acc, c) => acc + (c.cumplimiento || 0), 0) / safeCronograma.length) 
      : 0;

    const allMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-[#004d40] text-white p-6 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.4) 0%, transparent 20%)', backgroundSize: '100px 100px' }}></div>
            <div className="relative z-10 flex items-center space-x-4">
               <div className="bg-white text-[#004d40] h-12 w-12 rounded-full flex items-center justify-center font-black text-xl shadow-lg">T</div>
               <h2 className="text-2xl font-black tracking-widest uppercase">Plan Anual de Auditoría 2026</h2>
            </div>
            <div className="relative z-10 mt-4 md:mt-0 bg-[#00695c] px-6 py-2 rounded-full border border-[#00897b] flex items-center space-x-3 shadow-inner">
               <span className="text-2xl">🎖️</span>
               <div>
                  <div className="text-xl font-black">{avgCumplimiento}%</div>
                  <div className="text-[9px] uppercase tracking-widest font-bold opacity-80">% Cumplimiento Global</div>
               </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="md:col-span-1 space-y-6">
                <div className="border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                   <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Índice General</h3>
                   <div className="text-6xl font-black text-[#004d40] leading-none mb-2">{avgCumplimiento}%</div>
                   <div className="text-xs font-bold text-emerald-600 flex items-center justify-center space-x-1"><span>▲</span><span>Meta Alcanzada</span></div>
                   <p className="text-[10px] text-slate-500 mt-4 leading-relaxed font-medium">Evaluación integral de procesos administrativos, operativos y de soporte.</p>
                </div>

                <div id="seccion-monitoreo" className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                   <div className="bg-[#004d40] text-white p-3 flex justify-between items-center">
                     <span className="text-[10px] font-black uppercase tracking-widest flex items-center space-x-2"><span>📈</span> <span>Gestor de KRIs</span></span>
                     {isAdmin && <button onClick={() => setEditMonitoreo({})} className="text-xs bg-white text-[#004d40] px-2 py-0.5 rounded font-bold hover:bg-slate-200 transition-colors">➕</button>}
                   </div>
                   <div className="divide-y divide-slate-100 p-2">
                     {editMonitoreo && isAdmin && (
                       <form onSubmit={handleMonitoreoSubmit} className="p-3 bg-slate-50 rounded-lg mb-2 border border-slate-200 shadow-inner">
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
                     
                     {safeMonitoreo.map(m => (
                       <div key={m.id} className="flex flex-col p-3 hover:bg-slate-50 transition-colors group rounded-lg border border-transparent hover:border-slate-200">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-800 truncate" title={m.indicador}>{m.indicador}</span>
                            {isAdmin && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5">
                                <button onClick={() => setEditMonitoreo(m)} className="text-blue-500 hover:text-blue-700 text-xs transition-colors" title="Editar">✏️</button>
                                <button onClick={() => handleDeleteItem('monitoreo', m.id)} className="text-red-500 hover:text-red-700 text-xs transition-colors" title="Eliminar">✖</button>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[9px] text-slate-400">{m.proceso}</span>
                            <span className={`text-xs font-black ${m.valor > (m.limite || 0) ? 'text-red-600' : 'text-emerald-600'}`}>{m.valor} {m.limite ? <span className="text-[8px] text-slate-400 font-medium">/ {m.limite}</span> : null}</span>
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
                     <span className="text-[10px] font-bold text-emerald-400 border border-emerald-400 px-2 py-1 rounded-full uppercase">⚙️ {avgCumplimiento}% Auditado</span>
                   </div>
                   <div className="overflow-x-auto flex-1">
                     <table className="w-full text-xs text-left divide-y divide-slate-100">
                       <thead className="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                         <tr>
                           <th className="p-3">
                             <div>ID</div>
                             <FilterInput colKey="codigo" placeholder="ID..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3 w-24">
                             <div>Periodo</div>
                             <FilterInput colKey="periodo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3 w-48">
                             <div>Área / Proceso</div>
                             <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3">
                             <div>Enfoque Técnico y Alcance</div>
                             <FilterInput colKey="enfoque" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                           </th>
                           <th className="p-3 text-center">% Cumpl.</th>
                           {isAdmin && <th className="p-3 text-center">Acción</th>}
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {applyFilters(safeCronograma, searchTerm, columnFilters).map(c => (
                           <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="p-3 text-slate-400 font-mono">0{c.codigo}</td>
                             <td className="p-3 font-medium text-slate-600">{c.periodo}</td>
                             <td className="p-3 font-black text-slate-800">{c.proceso}</td>
                             <td className="p-3 text-[10px] text-slate-500 leading-relaxed">{c.enfoque}</td>
                             <td className="p-3 text-center font-black text-sm" style={{ color: c.cumplimiento === 100 ? '#059669' : c.cumplimiento >= 50 ? '#d97706' : '#dc2626' }}>{c.cumplimiento}%</td>
                             {isAdmin && (
                               <td className="p-3 text-center whitespace-nowrap">
                                 <button onClick={() => {setEditCronograma(c); scrollToTop();}} className="text-blue-500 hover:text-blue-700 mx-1">✏️</button>
                                 <button onClick={() => handleDeleteItem('cronograma', c.id)} className="text-red-500 hover:text-red-700 mx-1">🗑️</button>
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
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editCronograma ? '✏️ Editando Proceso del Plan' : '➕ Agregar Proceso al Cronograma'}</h3>
              {editCronograma && <button onClick={() => setEditCronograma(null)} className="text-xs text-red-500 font-bold">✖ Cancelar</button>}
            </div>
            <form onSubmit={handleCronogramaSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div><label className="font-bold text-gray-600 block mb-1">Código ID</label><input name="codigo" defaultValue={editCronograma?.codigo||''} required placeholder="Ej: 05" className="w-full border rounded-lg p-2" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Periodo Texto</label><input name="periodo" defaultValue={editCronograma?.periodo||''} required placeholder="Ej: Enero - Abril" className="w-full border rounded-lg p-2" /></div>
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Área / Proceso</label><input name="proceso" defaultValue={editCronograma?.proceso||''} required className="w-full border rounded-lg p-2" /></div>
              
              <div><label className="font-bold text-gray-600 block mb-1">Responsable</label><input name="responsable" defaultValue={editCronograma?.responsable||''} required className="w-full border rounded-lg p-2" /></div>
              <div><label className="font-bold text-gray-600 block mb-1">Apoyo (Opcional)</label><input name="apoyo" defaultValue={editCronograma?.apoyo||''} className="w-full border rounded-lg p-2" /></div>
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">% Cumplimiento (0-100)</label><input type="number" min="0" max="100" name="cumplimiento" defaultValue={editCronograma?.cumplimiento||0} required className="w-full border rounded-lg p-2" /></div>
              
              <div className="md:col-span-4"><label className="font-bold text-gray-600 block mb-1">Enfoque Técnico y Alcance</label><textarea name="enfoque" defaultValue={editCronograma?.enfoque||''} required rows="2" className="w-full border rounded-lg p-2"></textarea></div>
              
              <div className="md:col-span-4">
                <label className="font-bold text-gray-600 block mb-2">Meses Planeados (Para gráfico de Gantt)</label>
                <div className="grid grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {allMonths.map(mes => (
                    <label key={mes} className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" name={`mes_${mes}`} defaultChecked={editCronograma?.meses?.includes(mes)} className="rounded text-[#004d40] focus:ring-[#004d40]" />
                      <span className="text-[10px] font-bold uppercase">{mes.substring(0,3)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-4 flex justify-end mt-2"><button type="submit" className="bg-[#004d40] hover:bg-[#00695c] text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-colors">{editCronograma ? 'Actualizar Plan' : 'Guardar en Plan'}</button></div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-slate-100 border-b border-slate-200 p-4 flex justify-between items-center">
             <h3 className="text-[#004d40] font-black text-xl uppercase tracking-wider text-center flex-1">GANTT CONTROL INTERNO</h3>
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
                   <th className="border border-slate-300 p-2 w-32">
                     <div>Apoyo</div>
                     <FilterInput colKey="apoyo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                   </th>
                   {allMonths.map(m => <th key={m} className="border border-slate-300 p-2 text-center w-16">{m.substring(0,3)}</th>)}
                 </tr>
               </thead>
               <tbody>
                 {applyFilters(safeCronograma, searchTerm, columnFilters).map(c => (
                   <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                     <td className="border border-slate-300 p-2 text-center text-slate-500 font-mono">{c.codigo}</td>
                     <td className="border border-slate-300 p-2 font-black text-slate-800">{c.proceso}</td>
                     <td className="border border-slate-300 p-2 text-slate-600 font-medium">{c.responsable}</td>
                     <td className="border border-slate-300 p-2 text-slate-600 font-medium">{c.apoyo}</td>
                     {allMonths.map(mes => {
                       const isPlanned = c.meses?.includes(mes);
                       return (
                         <td key={mes} className={`border border-slate-300 text-center p-0`}>
                           {isPlanned && <div className="bg-[#00695c] text-white w-full h-full py-2 font-bold uppercase text-[8px] tracking-widest shadow-inner">Planeado</div>}
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

      </div>
    );
  };

  const renderTablero = () => {
    const anioActual = filtroAnio;
    const mesActual = filtroMes; 

    const hFiltrados = safeHallazgos.filter(h => {
      const fechaStr = formatSafeDate(h.fecha);
      const passAnio = anioActual === 'Todos' || getYearFromDate(fechaStr) === anioActual;
      const passMes = mesActual === 'Todos' || getMonthFromDate(fechaStr) === mesActual;
      return passAnio && passMes;
    });

    const pFiltrados = safePlanes.filter(p => {
      const fechaStr = formatSafeDate(p.fecha);
      const passAnio = anioActual === 'Todos' || getYearFromDate(fechaStr) === anioActual;
      const passMes = mesActual === 'Todos' || getMonthFromDate(fechaStr) === mesActual;
      return passAnio && passMes;
    });

    const añosSet = new Set();
    safeHallazgos.forEach(h => { const str = formatSafeDate(h.fecha); if(str) añosSet.add(getYearFromDate(str)); });
    safePlanes.forEach(p => { const str = formatSafeDate(p.fecha); if(str) añosSet.add(getYearFromDate(str)); });
    const availableYears = Array.from(añosSet).filter(a => a !== 'N/A').sort().reverse();

    const sedes = ['Hotel', 'Ecoparque', 'Administrativo'];

    const obtenerMetricasSede = (sede) => {
      const hallazgosSede = hFiltrados.filter(h => h.sede === sede);
      const hallazgosAbiertos = hallazgosSede.filter(h => h.estado === 'Abierto').length;

      const planesSede = pFiltrados.filter(p => {
        const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
        return hallazgoAsociado && hallazgoAsociado.sede === sede;
      });
      const avancePlanes = planesSede.length > 0 
        ? planesSede.reduce((acc, p) => acc + (p.progreso || 0), 0) / planesSede.length 
        : 0;

      const evaluacionesSede = safeEvaluaciones.filter(e => {
        const riesgoAsociado = safeRiesgos.find(r => r.id === e.idRiesgo);
        return riesgoAsociado && riesgoAsociado.sede === sede;
      });
      const saludControles = evaluacionesSede.length > 0 
        ? (evaluacionesSede.filter(e => e.calificacion === 100).length / evaluacionesSede.length) * 100 
        : 0;

      return { hallazgosAbiertos, avancePlanes, saludControles };
    };

    const hTotal = hFiltrados.length;
    const hAbiertos = hFiltrados.filter(h => h.estado === 'Abierto').length;
    const hCerrados = hFiltrados.filter(h => h.estado === 'Cerrado').length;

    const pTotal = pFiltrados.length;
    const pAbiertos = pFiltrados.filter(p => p.estado !== 'Cerrado').length;
    const pCerrados = pFiltrados.filter(p => p.estado === 'Cerrado').length;

    const avanceGlobal = safePlanes.length > 0 
      ? safePlanes.reduce((acc, p) => acc + (p.progreso || 0), 0) / safePlanes.length 
      : 0;
      
    const efectividadControles = safeEvaluaciones.length > 0 
      ? (safeEvaluaciones.filter(e => e.calificacion === 100).length / safeEvaluaciones.length) * 100 
      : 0;

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4">
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Tablero Analítico de Auditoría</h2><p className="text-xs text-slate-500 mt-1 font-medium">Análisis integral de desviaciones operacionales.</p></div>
          <div className="mt-4 md:mt-0 bg-white p-1 rounded-xl border flex items-center shadow-sm space-x-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3">Periodo:</span>
            
            <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 focus:outline-none">
              <option value="Todos">Año (Todos)</option>
              {availableYears.map((a, index) => <option key={`year-${a}-${index}`} value={a}>{a}</option>)}
            </select>
            
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 focus:outline-none mr-1">
              <option value="Todos">Mes (Todos)</option>
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>

          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Indicadores KRI en Tiempo Real</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Gauge value={avanceGlobal} label="Mitigación Global" sublabel="Promedio Planes de Acción" colorClass="text-blue-500" />
            <Gauge value={efectividadControles} label="Salud Controles" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
            <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-center text-white text-center h-full">
              <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest">Alerta Crítica</h4>
              <span className="text-4xl font-black mt-2">{hAbiertos}</span>
              <p className="text-xs font-bold mt-2 opacity-80">Hallazgos Pendientes de Cierre</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 mt-8">Desempeño por Unidad de Negocio</h3>
          <p className="text-[10px] text-blue-500 font-bold mb-4">👆 Haz clic en cualquier tarjeta o velocímetro para ver su universo de datos detallado.</p>
          <div className="space-y-6">
            {sedes.map((sede) => {
              const metricas = obtenerMetricasSede(sede);
              return (
                <div key={`metrics-${sede}`} className="bg-slate-100/50 border border-slate-200 p-6 rounded-3xl shadow-sm">
                  <h4 className="text-lg font-black text-slate-800 mb-4 tracking-tight border-b pb-2">{sede}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    <div 
                      onClick={() => { setDetalleUniverso({ sede, tipo: 'hallazgos' }); setTimeout(() => document.getElementById('detalle-universo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                      className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center h-full hover:shadow-lg hover:ring-4 hover:ring-blue-100 transition-all cursor-pointer relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-600 text-[8px] px-2 py-1 rounded-full font-bold uppercase tracking-widest">Ver Universo ↗</div>
                      <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Hallazgos Abiertos</h4>
                      <span className="text-5xl font-black mt-3 text-slate-800">{metricas.hallazgosAbiertos}</span>
                      <p className="text-[10px] font-bold mt-3 opacity-60 text-slate-500">Pendientes de Cierre</p>
                    </div>

                    <div 
                      onClick={() => { setDetalleUniverso({ sede, tipo: 'evaluaciones' }); setTimeout(() => document.getElementById('detalle-universo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                      className="hover:shadow-lg hover:ring-4 hover:ring-emerald-100 transition-all cursor-pointer rounded-2xl relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-50 text-emerald-600 text-[8px] px-2 py-1 rounded-full font-bold uppercase tracking-widest z-10">Ver Universo ↗</div>
                      <Gauge value={metricas.saludControles} label="Salud de Controles" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
                    </div>

                    <div 
                      onClick={() => { setDetalleUniverso({ sede, tipo: 'planes' }); setTimeout(() => document.getElementById('detalle-universo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                      className="hover:shadow-lg hover:ring-4 hover:ring-blue-100 transition-all cursor-pointer rounded-2xl relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-600 text-[8px] px-2 py-1 rounded-full font-bold uppercase tracking-widest z-10">Ver Universo ↗</div>
                      <Gauge value={metricas.avancePlanes} label="Planes de Acción" sublabel="Promedio de Avance %" colorClass="text-blue-500" />
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {detalleUniverso && (
          <div id="detalle-universo" className="mt-12 bg-white p-8 rounded-3xl border border-slate-200 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h4 className="text-2xl font-black text-slate-800 tracking-tight">
                  Universo de {detalleUniverso.tipo === 'hallazgos' ? 'Hallazgos' : detalleUniverso.tipo === 'planes' ? 'Planes de Acción' : 'Controles Auditados'}
                </h4>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Sede: {detalleUniverso.sede}</p>
              </div>
              <button onClick={() => setDetalleUniverso(null)} className="text-xs bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-xl font-bold transition-colors">✖ Cerrar Universo</button>
            </div>

            {(() => {
              let universoData = [];
              let cards = [];
              
              if (detalleUniverso.tipo === 'hallazgos') {
                universoData = hFiltrados.filter(h => h.sede === detalleUniverso.sede);
                cards = [
                  { label: 'Total Histórico', val: universoData.length, textCol: 'text-slate-800', bgCol: 'bg-slate-100' },
                  { label: 'Abiertos', val: universoData.filter(h => h.estado === 'Abierto').length, textCol: 'text-red-600', bgCol: 'bg-red-50' },
                  { label: 'Cerrados', val: universoData.filter(h => h.estado === 'Cerrado').length, textCol: 'text-emerald-600', bgCol: 'bg-emerald-50' }
                ];
              } else if (detalleUniverso.tipo === 'planes') {
                universoData = pFiltrados.filter(p => {
                  const hAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
                  return hAsociado && hAsociado.sede === detalleUniverso.sede;
                });
                cards = [
                  { label: 'Total Asignados', val: universoData.length, textCol: 'text-slate-800', bgCol: 'bg-slate-100' },
                  { label: 'En Proceso', val: universoData.filter(p => p.estado !== 'Cerrado').length, textCol: 'text-amber-600', bgCol: 'bg-amber-50' },
                  { label: 'Cerrados (100%)', val: universoData.filter(p => p.estado === 'Cerrado').length, textCol: 'text-emerald-600', bgCol: 'bg-emerald-50' }
                ];
              } else if (detalleUniverso.tipo === 'evaluaciones') {
                universoData = safeEvaluaciones.filter(e => {
                  const rAsociado = safeRiesgos.find(r => r.id === e.idRiesgo);
                  return rAsociado && rAsociado.sede === detalleUniverso.sede;
                });
                cards = [
                  { label: 'Total Tests', val: universoData.length, textCol: 'text-slate-800', bgCol: 'bg-slate-100' },
                  { label: 'Eficaces (100%)', val: universoData.filter(e => e.calificacion === 100).length, textCol: 'text-emerald-600', bgCol: 'bg-emerald-50' },
                  { label: 'Con Deficiencias', val: universoData.filter(e => e.calificacion < 100).length, textCol: 'text-red-600', bgCol: 'bg-red-50' }
                ];
              }

              return (
                <div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {cards.map((c, i) => (
                      <div key={i} className={`${c.bgCol} p-4 rounded-2xl flex items-center justify-between`}>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{c.label}</span>
                        <span className={`text-2xl font-black ${c.textCol}`}>{c.val}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Desglose de Registros</p>
                    <div className="max-h-48 overflow-y-auto">
                      <ul className="space-y-2">
                        {universoData.length === 0 && <li className="text-xs text-slate-400 italic">No hay registros para esta categoría.</li>}
                        {universoData.map((item, idx) => (
                          <li key={idx} className="text-xs bg-white p-2 rounded border border-slate-100 flex justify-between items-center shadow-sm">
                            <span className="font-medium text-slate-700 truncate pr-4">
                              {item.titulo || item.accion || `Test ID: ${item.id} - Efectividad: ${item.calificacion}%`}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${item.estado === 'Cerrado' || item.calificacion === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {item.estado || (item.calificacion === 100 ? 'Eficaz' : 'Deficiente')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 mt-8">Métricas de Hallazgos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">📄</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Total Hallazgos</p><p className="text-3xl font-black mt-1 text-slate-800">{hTotal}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-red-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl">⚠️</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Hallazgos Abiertos</p><p className="text-3xl font-black mt-1 text-red-600">{hAbiertos}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-emerald-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl">✅</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Hallazgos Cerrados</p><p className="text-3xl font-black mt-1 text-emerald-600">{hCerrados}</p></div></div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 mt-8">Métricas de Planes de Acción</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">🤝</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Planes de Acción Totales</p><p className="text-3xl font-black mt-1 text-slate-800">{pTotal}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-amber-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-xl">⏳</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Planes Pendientes</p><p className="text-3xl font-black mt-1 text-amber-600">{pAbiertos}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-emerald-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl">✅</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Planes de Acción Cerrados</p><p className="text-3xl font-black mt-1 text-emerald-600">{pCerrados}</p></div></div>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardRiesgos = () => {
    const esRes = tipoMatriz === 'residual';
    const totalRiesgos = safeRiesgos.length;
    const riesgosCriticos = safeRiesgos.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
    const riesgosFueraApetito = safeRiesgos.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).apetito === "Fuera de Apetito").length;
    const totalPerdidas = safeIncidentes.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);

    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];

    const contarCelda = (imp, prob) => safeRiesgos.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;
    const riesgosFiltradosHeatMap = filtroHeatMap ? safeRiesgos.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === filtroHeatMap.impacto && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === filtroHeatMap.probabilidad) : [];

    // Lógica de Analítica de Tendencias Históricas
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const anioTendencia = filtroAnio !== 'Todos' ? String(filtroAnio) : new Date().getFullYear().toString();
    const mesTendencia = filtroMes;

    const incidentesPorMes = Array(12).fill(0);
    safeIncidentes.forEach(i => {
      const fechaStr = formatSafeDate(i.fecha);
      if (fechaStr && fechaStr.startsWith(anioTendencia)) {
        const monthStr = getMonthFromDate(fechaStr);
        if (mesTendencia === 'Todos' || monthStr === mesTendencia) {
           const monthIdx = parseInt(monthStr, 10) - 1;
           if (monthIdx >= 0 && monthIdx <= 11) {
             incidentesPorMes[monthIdx] += (Number(i.costo) || 0);
           }
        }
      }
    });
    const dataIncidentes = meses.map((m, i) => ({ mes: m, valor: incidentesPorMes[i] }));

    const hallazgosPorMes = Array(12).fill(0);
    safeHallazgos.forEach(h => {
      const fechaStr = formatSafeDate(h.fecha);
      if (fechaStr && fechaStr.startsWith(anioTendencia)) {
        const monthStr = getMonthFromDate(fechaStr);
        if (mesTendencia === 'Todos' || monthStr === mesTendencia) {
           const monthIdx = parseInt(monthStr, 10) - 1;
           if (monthIdx >= 0 && monthIdx <= 11) {
             hallazgosPorMes[monthIdx] += 1;
           }
        }
      }
    });
    const dataHallazgos = meses.map((m, i) => ({ mes: m, valor: hallazgosPorMes[i] }));

    const añosSet = new Set();
    safeHallazgos.forEach(h => { const s = formatSafeDate(h.fecha); if(s) añosSet.add(getYearFromDate(s)); });
    safeIncidentes.forEach(i => { const s = formatSafeDate(i.fecha); if(s) añosSet.add(getYearFromDate(s)); });
    const availableYears = Array.from(añosSet).filter(a => a !== 'N/A').sort().reverse();

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4">
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Intelligence Dashboard GRC</h2><p className="text-xs text-slate-500 mt-1 font-medium">Análisis predictivo de apetito ISO 31000 y Evolución de KRI.</p></div>
          <div className="mt-4 md:mt-0 flex flex-col md:flex-row items-center gap-3">
            
            {/* NUEVO SELECTOR DUAL (AÑO Y MES) */}
            <div className="bg-white p-1 rounded-xl border flex items-center shadow-sm space-x-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3">Periodo:</span>
              <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 focus:outline-none">
                <option value="Todos">Año Actual</option>
                {availableYears.map((a, index) => <option key={`year-${a}-${index}`} value={a}>{a}</option>)}
              </select>
              <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 focus:outline-none mr-1">
                <option value="Todos">Mes (Todos)</option>
                <option value="01">Enero</option>
                <option value="02">Febrero</option>
                <option value="03">Marzo</option>
                <option value="04">Abril</option>
                <option value="05">Mayo</option>
                <option value="06">Junio</option>
                <option value="07">Julio</option>
                <option value="08">Agosto</option>
                <option value="09">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
            </div>

            <div className="bg-white p-1 rounded-xl border flex items-center shadow-sm">
              <button onClick={() => {setTipoMatriz('inherente'); setFiltroHeatMap(null);}} className={`px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${!esRes ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Inherente</button>
              <button onClick={() => {setTipoMatriz('residual'); setFiltroHeatMap(null);}} className={`px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${esRes ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Residual</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TrendChart data={dataIncidentes} title={`Evolución de Impacto Financiero (${anioTendencia})`} isCurrency={true} color="#ef4444" fillColor="#fef2f2" />
          <TrendChart data={dataHallazgos} title={`Volumen de Desviaciones (${anioTendencia})`} isCurrency={false} color="#3b82f6" fillColor="#eff6ff" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500"><p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Total Riesgos</p><p className="text-3xl font-black mt-2 text-slate-800">{totalRiesgos}</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-red-600"><p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Fuera de Apetito</p><p className="text-3xl font-black mt-2 text-red-600">{riesgosFueraApetito}</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-orange-500"><p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Riesgos Críticos</p><p className="text-3xl font-black mt-2 text-orange-600">{riesgosCriticos}</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-purple-600"><p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Pérdidas Totales</p><p className="text-xl font-black mt-3 text-purple-700">${totalPerdidas.toLocaleString('es-CO')}</p></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-6 flex items-center space-x-2">
            <span>🎚️ Mapa de Calor Empresarial (Haz clic en un cuadrante con números)</span>
            <span className="px-2.5 py-0.5 text-[8px] rounded-full text-white font-extrabold bg-slate-800 uppercase tracking-widest font-mono">{tipoMatriz}</span>
          </h3>
          <div className="flex flex-col items-center justify-center">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 w-full max-w-2xl relative pb-4">
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-bold text-slate-400 uppercase tracking-widest">Impacto</div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">Probabilidad</div>
              <div></div>
              {probabilidades.map((p, index) => <div key={`header-${p}-${index}`} className="text-center py-2 text-slate-600 font-bold uppercase text-[9px] bg-slate-50 rounded-t-lg border-b border-slate-200">{p}</div>)}
              {impactos.map((imp, impIndex) => (
                <React.Fragment key={`row-${imp}-${impIndex}`}>
                  <div className="flex items-center justify-end pr-3 py-4 text-slate-600 font-bold uppercase text-[9px] bg-slate-50 rounded-l-lg text-right">{imp}</div>
                  {probabilidades.map((prob, probIndex) => {
                    const count = contarCelda(imp, prob);
                    const { score, color, borderSemaforo } = calcularMatriz5x5(prob, imp);
                    const isSelected = filtroHeatMap?.impacto === imp && filtroHeatMap?.probabilidad === prob;
                    
                    return (
                      <div key={`cell-${imp}-${prob}-${probIndex}`} onClick={() => { 
                        if (count > 0) {
                          setFiltroHeatMap({ impacto: imp, probabilidad: prob, count }); 
                          setTimeout(() => {
                            document.getElementById('detalle-heatmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 150);
                        }
                      }}
                        className={`relative border p-4 flex flex-col justify-center items-center h-20 rounded-xl transition-all duration-200 ${count > 0 ? 'cursor-pointer hover:scale-105 shadow-md opacity-100' : 'opacity-40 cursor-not-allowed'} ${color} ${isSelected ? 'ring-4 ring-slate-900 scale-105 shadow-xl bg-opacity-100' : 'bg-opacity-20'} ${borderSemaforo}`}>
                        <span className="absolute top-1 right-2 text-[8px] font-mono font-bold opacity-60 text-slate-700">S:{score}</span>
                        <span className={`text-2xl font-black text-slate-900`}>{count}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
          
          {filtroHeatMap && (
            <div id="detalle-heatmap" className="mt-8 bg-slate-50 p-6 rounded-xl border border-slate-200 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">🔎 Detalle de Riesgos en Cuadrante: {filtroHeatMap.probabilidad} / {filtroHeatMap.impacto}</h4>
                <button onClick={() => setFiltroHeatMap(null)} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg">✖ Limpiar Filtro</button>
              </div>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <table className="w-full text-xs text-left divide-y">
                  <thead className="bg-slate-800 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3">Proceso</th><th className="p-3 w-1/2">Descripción</th><th className="p-3">Responsable</th><th className="p-3 text-center">Estrategia</th></tr></thead>
                  <tbody className="divide-y">
                    {riesgosFiltradosHeatMap.map((r, index) => (
                      <tr key={`filtered-${r.id}-${index}`}>
                        <td className="p-3 font-bold">#{r.id}</td><td className="p-3 font-bold">{r.proceso}</td><td className="p-3">{r.descripcion}</td><td className="p-3">{r.responsable}</td>
                        <td className="p-3 text-center"><span className={`px-2 py-1 rounded block text-[10px] ${calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).color}`}>{calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).accion}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderApetito = () => {
    const configurados = safeRiesgos.filter(r => r.capacidadRiesgo).length;
    
    const enTolerancia = safeRiesgos.filter(r => {
      const costoTotal = safeIncidentes.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      return r.capacidadRiesgo && costoTotal > r.apetitoFinanciero && costoTotal <= r.toleranciaFinanciera;
    }).length;

    const capacidadExcedida = safeRiesgos.filter(r => {
      const costoTotal = safeIncidentes.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      return r.capacidadRiesgo && costoTotal > r.capacidadRiesgo;
    }).length;

    const apetitoData = safeRiesgos.map(r => {
      const resScore = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score;
      const costoTotal = safeIncidentes.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      const estaConfigurado = r.posturaEstrategica && r.capacidadRiesgo;
      
      let zona = "Sin parametrizar";
      let zonaColor = "bg-slate-100 text-slate-500 border-slate-200";
      let consumoPorcentaje = 0;

      if (estaConfigurado) {
        consumoPorcentaje = Math.min((costoTotal / r.capacidadRiesgo) * 100, 100);
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
        <div className="border-b pb-4">
          <h2 className="text-2xl font-black text-slate-800">⚖️ Apetito y Perfil de Riesgo (COSO ERM)</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Parametrización multinivel: Apetito, Tolerancia y Capacidad Financiera Máxima.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500"><p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Modelos Parametrizados</p><p className="text-3xl font-black mt-2 text-slate-800">{configurados} / {safeRiesgos.length}</p></div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-yellow-500"><p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">En Zona de Alerta (Tolerancia)</p><p className="text-3xl font-black mt-2 text-yellow-600">{enTolerancia}</p></div>
          <div className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 border-l-4 border-l-red-600"><p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Capacidad Excedida (Ruptura)</p><p className="text-3xl font-black mt-2 text-red-500">{capacidadExcedida}</p></div>
        </div>

        {editApetito && (
          <div className="bg-white p-6 rounded-3xl shadow-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white animate-in fade-in slide-in-from-top-4 space-y-6 relative z-10">
            <div className="flex justify-between items-center border-b border-blue-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">⚙️ Arquitectura COSO ERM</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Riesgo: [{editApetito.sede}] {editApetito.proceso}</p>
              </div>
              <button onClick={() => setEditApetito(null)} className="text-xs text-slate-500 hover:text-red-600 bg-white border border-slate-200 px-3 py-1 rounded-lg font-bold transition-colors">✖ Cerrar Panel</button>
            </div>
            
            <form onSubmit={handleApetitoSubmit} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2">1. Límites Operativos (KRI)</h4>
                  
                  <label className="font-bold text-gray-700 mb-1 flex items-center w-max">
                    Postura Estratégica
                    <InfoTooltip text="Actitud general de la gerencia hacia este riesgo. Define si la empresa prefiere evitarlo por completo (Averso), buscar un balance (Flexible) o tomar riesgos para innovar (Buscador)." />
                  </label>
                  <select name="posturaEstrategica" defaultValue={editApetito.posturaEstrategica || 'Cauto'} className="w-full border border-slate-300 rounded-lg p-2 mb-4 bg-white shadow-sm">
                    <option value="Averso">Averso (Evitar riesgo a toda costa)</option>
                    <option value="Cauto">Cauto (Preferencia por soluciones seguras)</option>
                    <option value="Flexible">Flexible (Equilibrio riesgo/recompensa)</option>
                    <option value="Buscador">Buscador (Alta aceptación para innovar)</option>
                  </select>

                  <label className="font-bold text-gray-700 mb-1 flex items-center w-max">
                    KRI: Puntaje Residual Máximo Permitido
                    <InfoTooltip text="Límite máximo aceptable en la Matriz 5x5 (Probabilidad x Impacto). Si el puntaje residual supera este número (Ej: 9), la plataforma disparará alertas pidiendo planes de acción." />
                  </label>
                  <input type="number" min="1" max="25" name="kriScore" defaultValue={editApetito.kriScore || ''} required placeholder="Ej: 9 (Puntos de Matriz 5x5)" className="w-full border border-slate-300 rounded-lg p-2 bg-white shadow-sm" />
                </div>

                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="font-black text-blue-800 uppercase tracking-widest mb-3 border-b border-blue-200 pb-2">2. Umbrales Financieros (COP)</h4>
                  
                  <label className="font-bold text-blue-900 mb-1 flex items-center w-max">
                    <span>🎯 Apetito de Riesgo (Deseado)</span>
                    <InfoTooltip text="Nivel de pérdida financiera que la empresa está dispuesta a asumir en su operación normal. Es tu 'Zona Verde' o escenario ideal." />
                  </label>
                  <input type="number" name="apetitoFinanciero" defaultValue={editApetito.apetitoFinanciero || ''} required placeholder="Pérdida esperada aceptable (Ej: 1000000)" className="w-full border border-blue-200 rounded-lg p-2 mb-4 bg-white shadow-sm" />

                  <label className="font-bold text-amber-700 mb-1 flex items-center w-max">
                    <span>⚠️ Tolerancia al Riesgo (Desv. Máx)</span>
                    <InfoTooltip text="Desviación máxima aceptable respecto al Apetito. Es el colchón de seguridad. Superar este monto pone a la sede en alerta amarilla/naranja." />
                  </label>
                  <input type="number" name="toleranciaFinanciera" defaultValue={editApetito.toleranciaFinanciera || ''} required placeholder="Pérdida máxima tolerada (Ej: 3000000)" className="w-full border border-amber-200 rounded-lg p-2 mb-4 bg-white shadow-sm" />

                  <label className="font-bold text-red-700 mb-1 flex items-center w-max">
                    <span>🛑 Capacidad de Riesgo (Límite Ruptura)</span>
                    <InfoTooltip text="Monto máximo absoluto de pérdida que la empresa puede soportar antes de entrar en crisis. Si se supera, la viabilidad del negocio peligra gravemente." />
                  </label>
                  <input type="number" name="capacidadRiesgo" defaultValue={editApetito.capacidadRiesgo || ''} required placeholder="Pérdida catastrófica (Ej: 10000000)" className="w-full border border-red-200 rounded-lg p-2 bg-white shadow-sm" />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button type="submit" className="bg-slate-900 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-colors transform hover:scale-105 duration-200">💾 Aplicar Arquitectura COSO</button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 bg-slate-900 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Monitor de Brechas Financieras</h3>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold border border-slate-700">Analítica</span>
            </div>
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-700 bg-slate-800 text-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm placeholder-slate-500" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-100">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[9px]">
                <tr>
                  <th className="p-4 w-1/3">
                    <div>Proceso / Riesgo / Postura</div>
                    <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 text-center">
                    <div>Score (KRI)</div>
                    <FilterInput colKey="kriScore" placeholder="Score..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 w-1/3">Consumo de Capacidad Financiera (Eventos)</th>
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
                    <tr key={`apetito-row-${r.id}-${index}`} className="hover:bg-slate-50/80 transition-colors">
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
                          <div className="flex flex-col items-center justify-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Límite: {r.kriScore} pts</span>
                            <span className={`px-2 py-1 rounded-lg font-black font-mono text-xs ${excedidoScore ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.resScoreVal} pts</span>
                          </div>
                        ) : <span className="text-slate-300 font-medium italic">-</span>}
                      </td>

                      <td className="p-4">
                        {r.estaConfiguradoVal ? (
                          <div className="w-full">
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                              <span className="text-slate-500">Consumo vs Capacidad Total</span>
                              <span className={r.consumoPorcentajeVal > 80 ? 'text-red-600' : 'text-slate-800'}>{r.consumoPorcentajeVal.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2 overflow-hidden shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-1000 ${r.consumoPorcentajeVal <= (r.apetitoFinanciero/r.capacidadRiesgo)*100 ? 'bg-emerald-500' : r.consumoPorcentajeVal <= (r.toleranciaFinanciera/r.capacidadRiesgo)*100 ? 'bg-yellow-400' : r.consumoPorcentajeVal < 100 ? 'bg-orange-500' : 'bg-red-600'}`} style={{ width: `${r.consumoPorcentajeVal}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400">
                              <span>Perdido: ${(r.costoTotalVal).toLocaleString('es-CO')}</span>
                              <span>Tope: ${(r.capacidadRiesgo).toLocaleString('es-CO')}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest border border-dashed border-slate-200 rounded-lg p-2 bg-slate-50/50">Requiere Parametrización</div>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest border ${r.zonaColorVal} shadow-sm block w-full truncate`} title={r.zonaVal}>
                          {r.zonaVal}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {isAdmin && <button onClick={() => {setEditApetito(r); scrollToTop();}} className="bg-white border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm flex items-center justify-center space-x-1 mx-auto w-full"><span>⚙️</span> <span>Ajustar</span></button>}
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

  const renderRiesgos = () => {
    // Pre-calcular valores para que el filtro funcione
    const riesgosData = safeRiesgos.map(r => {
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
            <button onClick={() => exportToExcel(safeRiesgos, 'Matriz_Riesgos')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-colors">📥 Exportar Excel</button>
          </div>
        </div>
        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">{editRiesgo ? `✏️ Editando Riesgo #${editRiesgo.id}` : '➕ Registrar Nuevo Riesgo'}</h3>
            <form onSubmit={handleRiesgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              
              <div><label className="font-bold text-gray-600">Sede</label><select name="sede" defaultValue={editRiesgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
              
              <div><label className="font-bold text-gray-600">Proceso</label><input id="input-proceso-riesgo" name="proceso" defaultValue={editRiesgo?.proceso||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
              <div><label className="font-bold text-gray-600">Categoría</label><select name="categoria" defaultValue={editRiesgo?.categoria||'Operativo'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Operativo</option><option>Estratégico</option><option>Tecnológico</option></select></div>
              <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editRiesgo?.responsable||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
              
              <div className="md:col-span-2">
                <label className="font-bold text-gray-600 flex justify-between items-center">
                  <span>Control Clave</span>
                  <button type="button" onClick={() => sugerirConIA('control')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                    <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                  </button>
                </label>
                <input id="input-control-riesgo" name="control" defaultValue={editRiesgo?.descripcionControl||''} required className="w-full border rounded-lg p-2 mt-1" />
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-purple-700">Normativa / Ley Aplicable (Compliance)</label>
                <input name="normativa" defaultValue={editRiesgo?.normativa||'Ninguna'} placeholder="Ej: Ley 1581, ISO 27001..." required className="w-full border border-purple-300 bg-purple-50 rounded-lg p-2 mt-1" />
              </div>

              <div className="md:col-span-4">
                <label className="font-bold text-gray-600">Descripción Evento</label>
                <input id="input-descripcion-riesgo" name="descripcion" defaultValue={editRiesgo?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1" />
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

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-3">
                    <div>ID</div>
                    <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-3 w-48">
                    <div>Proceso / Riesgo / Normativa</div>
                    <FilterInput colKey="proceso" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-3 w-48">
                    <div>Responsable / Control</div>
                    <FilterInput colKey="responsable" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-3 text-center">
                    <div>Score Inh</div>
                    <FilterInput colKey="scoreInhVal" placeholder="Puntos..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-3 text-center">
                    <div>Score Res</div>
                    <FilterInput colKey="scoreResVal" placeholder="Puntos..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-3">
                    <div>Apetito</div>
                    <FilterInput colKey="apetitoVal" placeholder="Estado..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-3">Acción Recomendada</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applyFilters(riesgosData, searchTerm, columnFilters).map((r, index) => (
                  <tr key={`riesgo-row-${r.id}-${index}`} className="hover:bg-slate-50">
                    <td className="p-3 font-bold">#{r.id}</td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2 mb-1"><span className="px-2 py-0.5 bg-slate-800 text-white text-[9px] rounded font-bold uppercase">{r.sede || 'Hotel'}</span><span className="font-black">{r.proceso}</span></div>
                      <div className="text-[9px] font-bold text-indigo-500 uppercase font-mono">{r.categoria}</div>
                      <div>{r.descripcion}</div>
                      {r.normativa && r.normativa !== 'Ninguna' && <div className="mt-1 inline-block bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border border-purple-200">⚖️ {r.normativa}</div>}
                    </td>
                    <td className="p-3"><div className="font-bold">{r.responsable}</div><div className="italic mt-1">⚙️ {r.descripcionControl}</div></td>
                    <td className="p-3 text-center font-mono">{r.scoreInhVal} pts</td>
                    <td className="p-3 text-center font-mono font-black">{r.scoreResVal} pts</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.apetitoVal === "Dentro de Apetito" || r.apetitoVal === "Aceptable" ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.apetitoVal}</span></td>
                    <td className="p-3"><span className={`px-2.5 py-1 rounded-xl text-[10px] block text-center font-black ${r.colorVal}`}>{r.accionVal}</span></td>
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      {isAdmin && <button onClick={() => {setEditRiesgo(r); scrollToTop();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️</button>}
                      {isAdmin && <button onClick={() => handleDeleteItem('riesgos', r.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>}
                    </td>
                  </tr>
                ))}
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Nuevo Test de Control</h3>
            <form onSubmit={handleEvaluacionSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div><label className="font-bold text-gray-600">Riesgo / Control</label><select name="idRiesgo" required className="w-full border rounded-lg p-2 mt-1 bg-white">{safeRiesgos.map((r, index) => <option key={`opt-riesgo-${r.id}-${index}`} value={r.id}>[{r.sede || 'Hotel'}] {r.proceso}</option>)}</select></div>
              <div><label className="font-bold text-gray-600">Diseño</label><select name="diseno" className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
              <div><label className="font-bold text-gray-600">Ejecución</label><select name="ejecucion" className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
              <div className="md:col-span-2"><label className="font-bold text-gray-600">Comentarios</label><textarea name="comentarios" required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea></div>
              <div><label className="font-bold text-gray-600">Adjuntar Evidencia</label><input type="file" name="evidenciaArchivo" className="w-full border rounded-lg p-1.5 mt-1 bg-slate-50 cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" /></div>
              <div className="md:col-span-3 flex justify-end"><button type="submit" disabled={isUploading} className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg shadow-md disabled:opacity-50">{isUploading ? 'Subiendo...' : 'Guardar Test'}</button></div>
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
            <thead className="bg-slate-900 text-white font-bold">
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
                  <td className="p-3"><span className={`px-2 py-0.5 rounded font-black ${ev.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ev.calificacion}%</span></td>
                  <td className="p-3">
                    <div>{ev.comentarios}</div>
                    {ev.evidenciaUrl && (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={ev.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-100 flex items-center space-x-1"><span>📎</span><span>Ver</span></a>
                        {isAdmin && <button onClick={() => analizarEvidenciaIA(ev.evidenciaUrl, ev.comentarios, 'Test de Auditoría')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded text-[10px] hover:bg-purple-100 flex items-center space-x-1"><span>🤖</span><span>Auditar con IA</span></button>}
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

  const renderHallazgos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📄 Hallazgos y Desviaciones</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión de auditorías y no conformidades encontradas.</p>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editHallazgo ? `✏️ Editando Hallazgo: ${editHallazgo.ref}` : '➕ Documentar Nueva Desviación'}</h3>
            {editHallazgo && <button onClick={() => setEditHallazgo(null)} className="text-xs text-slate-500 hover:text-red-600 font-bold">✖ Cancelar Edición</button>}
          </div>

          <form onSubmit={handleHallazgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
            <div><label className="font-bold text-gray-600 block mb-1">ID / Código (Manual)</label><input name="ref" defaultValue={editHallazgo?.ref||''} required placeholder="Ej: HAL-2026-01" className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Sede</label><select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
            <div><label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label><input id="input-proceso-hallazgo" name="proceso" defaultValue={editHallazgo?.proceso||''} required className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Severidad</label><select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
            
            <div><label className="font-bold text-gray-600 block mb-1">Auditor Responsable</label><input name="auditor" defaultValue={editHallazgo?.auditor||''} required placeholder="Quien levantó el hallazgo" className="w-full border border-slate-300 rounded-lg p-2" /></div>
            <div><label className="font-bold text-gray-600 block mb-1">Dueño del Proceso</label><input name="responsable" defaultValue={editHallazgo?.responsable||''} required placeholder="Responsable a cargo" className="w-full border border-slate-300 rounded-lg p-2" /></div>
            
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 flex justify-between items-center mb-1">
                <span>Título / Descripción de la Falla</span>
                <button type="button" onClick={() => sugerirConIA('hallazgo')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                  <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                </button>
              </label>
              <input id="input-titulo-hallazgo" name="titulo" defaultValue={editHallazgo?.titulo||''} required placeholder="Describa el hallazgo brevemente..." className="w-full border border-slate-300 rounded-lg p-2" />
            </div>
            
            <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">Informe / Evidencia (Opcional)</label><input type="file" name="evidenciaArchivo" className="w-full border border-slate-300 rounded-lg p-1 bg-slate-50 cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" /></div>
            
            <div className="md:col-span-2 flex justify-end items-end">
              <button type="submit" disabled={isUploading} className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50 w-full md:w-auto">
                {isUploading ? 'Subiendo Archivo...' : (editHallazgo ? '💾 Guardar Cambios' : '➕ Registrar Hallazgo')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Desviaciones Encontradas</h3>
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
                  <div>ID / Ref</div>
                  <FilterInput colKey="ref" placeholder="ID..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>Proceso</div>
                  <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4 w-1/3">
                  <div>Título e Informes</div>
                  <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>Responsables</div>
                  <FilterInput colKey="responsable" placeholder="Responsable..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4 text-center">
                  <div>Estado / Gestión</div>
                  <FilterInput colKey="estado" placeholder="Estado..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applyFilters(safeHallazgos, searchTerm, columnFilters).map((h, index) => (
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
                    {h.evidenciaUrl && (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={h.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-100 flex items-center space-x-1"><span>📎</span><span>Ver Informe</span></a>
                        {isAdmin && <button onClick={() => analizarEvidenciaIA(h.evidenciaUrl, h.titulo, 'Hallazgo')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded text-[10px] hover:bg-purple-100 flex items-center space-x-1"><span>🤖</span><span>Auditar con IA</span></button>}
                      </div>
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
                        <button onClick={() => {setEditHallazgo(h); scrollToTop();}} className="text-slate-500 hover:text-blue-600 transition-colors" title="Editar">
                          <i className="fa-solid fa-pen-to-square text-sm"></i> Editar
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => handleDeleteItem('hallazgos', h.id)} className="text-slate-500 hover:text-red-600 transition-colors" title="Eliminar">
                          <i className="fa-solid fa-trash text-sm"></i> Eliminar
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
    const planesData = safePlanes.map(p => ({ ...p, fechaVal: formatSafeDate(p.fecha) }));

    return (
      <div className="space-y-6">
        <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">Planes de Acción</h2></div>
        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">{editPlan ? `✏️ Editando Avance de Plan` : '➕ Asignar Plan'}</h3>
            
            <form onSubmit={handlePlanSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-4"><label className="font-bold text-gray-600">Hallazgo Vinculado</label><select id="select-hallazgo-plan" name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="">-- Seleccione --</option>{safeHallazgos.map((h, index) => <option key={`opt-hallazgo-${h.id}-${index}`} value={h.id}>[{h.sede || 'Hotel'}] {h.titulo}</option>)}</select></div>
              
              <div className="md:col-span-4">
                <label className="font-bold text-gray-600 flex justify-between items-center">
                  <span>Acción Correctiva</span>
                  <button type="button" onClick={() => sugerirConIA('plan')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                    <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                  </button>
                </label>
                <input id="input-accion-plan" name="accion" defaultValue={editPlan?.accion||''} required className="w-full border rounded-lg p-2 mt-1" />
              </div>

              <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editPlan?.responsable||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
              <div><label className="font-bold text-gray-600">Compromiso</label><input name="fecha" type="date" defaultValue={formatSafeDate(editPlan?.fecha)||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
              <div><label className="font-bold text-blue-600">% Avance Físico</label><input type="number" min="0" max="100" name="progreso" defaultValue={editPlan?.progreso||0} required className="w-full border-2 border-blue-200 bg-blue-50 rounded-lg p-2 mt-1" /></div>
              <div><label className="font-bold text-gray-600">Adjuntar Evidencia</label><input type="file" name="evidenciaArchivo" className="w-full border rounded-lg p-1.5 mt-1 bg-slate-50 cursor-pointer" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" /></div>
              
              <div className="md:col-span-4 flex justify-end"><button type="submit" disabled={isUploading} className="bg-slate-800 text-white font-bold px-6 py-2 rounded-lg shadow-md disabled:opacity-50">{isUploading ? 'Subiendo Archivo...' : (editPlan ? 'Actualizar Progreso' : 'Asignar Plan')}</button></div>
            </form>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-slate-50">
             <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Seguimiento de Planes</h3>
             <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 w-64 shadow-sm" />
             </div>
          </div>
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="p-3">
                  <div>ID</div>
                  <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Hallazgo</div>
                  <FilterInput colKey="idHallazgo" placeholder="Ref..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Acción y Evidencias</div>
                  <FilterInput colKey="accion" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3">
                  <div>Compromiso</div>
                  <FilterInput colKey="fechaVal" placeholder="Fecha..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3 w-40">Avance %</th>
                <th className="p-3">
                  <div>Estado</div>
                  <FilterInput colKey="estado" placeholder="Estado..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-3 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {applyFilters(planesData, searchTerm, columnFilters).map((p, index) => {
                const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
                return (
                  <tr key={`plan-row-${p.id}-${index}`}>
                    <td className="p-3 font-bold">#PLAN-{p.id}</td>
                    <td className="p-3"><span className="text-red-600 font-bold block">#HAL-{p.idHallazgo}</span><span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{hallazgoAsociado?.sede || 'Hotel'}</span></td>
                    <td className="p-3">
                      <div className="font-bold">{p.accion}</div>
                      {p.evidenciaUrl && (
                        <div className="flex items-center space-x-2 mt-2">
                          <a href={p.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-100 flex items-center space-x-1"><span>📎</span><span>Ver Soporte</span></a>
                          {isAdmin && <button onClick={() => analizarEvidenciaIA(p.evidenciaUrl, p.accion, 'Plan de Acción')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded text-[10px] hover:bg-purple-100 flex items-center space-x-1"><span>🤖</span><span>Auditar con IA</span></button>}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono">{p.fechaVal}</td>
                    <td className="p-3"><ProgressBar progress={p.progreso || 0} /></td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded font-black uppercase ${p.estado === 'Cerrado' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.estado}</span></td>
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      {isAdmin && <button onClick={() => {setEditPlan(p); scrollToTop();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>}
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
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">🚨 Eventos de Pérdida</h2></div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase">{editIncidente ? '✏️ Editar Evento' : '➕ Reportar Evento'}</h3>
        <form onSubmit={handleIncidenteSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div><label className="font-bold text-gray-600">Riesgo Vinculado</label><select name="idRiesgo" defaultValue={editIncidente?.idRiesgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="">-- Seleccione --</option>{safeRiesgos.map((r, index) => <option key={`opt-incidente-${r.id}-${index}`} value={r.id}>[ID: {r.id}] {r.proceso}</option>)}</select></div>
          <div><label className="font-bold text-gray-600">Título</label><input name="titulo" defaultValue={editIncidente?.titulo||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
          <div><label className="font-bold text-gray-600">Pérdida (COP)</label><input name="costo" type="number" defaultValue={editIncidente?.costo||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
          <div className="md:col-span-2"><label className="font-bold text-gray-600">Descripción</label><textarea name="descripcion" defaultValue={editIncidente?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea></div>
          <div><label className="font-bold text-gray-600">Impacto</label><select name="impacto" defaultValue={editIncidente?.impacto||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
          <div className="md:col-span-3 flex justify-end space-x-2">
            {editIncidente && <button type="button" onClick={() => setEditIncidente(null)} className="bg-slate-200 text-slate-700 font-bold px-6 py-2 rounded-lg shadow-md">Cancelar</button>}
            <button type="submit" className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow-md">{editIncidente ? 'Guardar Cambios' : 'Guardar Evento'}</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mt-6">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Historial de Incidentes</h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-64 shadow-sm" />
           </div>
        </div>
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold">
            <tr>
              <th className="p-3">
                <div>ID</div>
                <FilterInput colKey="id" placeholder="ID..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Riesgo</div>
                <FilterInput colKey="idRiesgo" placeholder="ID Riesgo..." dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3 w-1/3">
                <div>Título / Desc</div>
                <FilterInput colKey="titulo" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3">
                <div>Impacto</div>
                <FilterInput colKey="impacto" dark columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
              </th>
              <th className="p-3 text-right">Pérdida (COP)</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {applyFilters(safeIncidentes, searchTerm, columnFilters).map((inc, index) => (
              <tr key={`inc-${inc.id}-${index}`} className="hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-400">#INC-{inc.id}</td>
                <td className="p-3"><span className="text-[10px] bg-slate-200 px-2 py-1 rounded font-mono text-slate-800">#{inc.idRiesgo}</span></td>
                <td className="p-3"><div className="font-bold">{inc.titulo}</div><div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{inc.descripcion}</div></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded font-black uppercase text-[9px] ${inc.impacto === 'Crítico' ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{inc.impacto}</span></td>
                <td className="p-3 text-right font-mono font-bold text-red-600">${Number(inc.costo)?.toLocaleString('es-CO')}</td>
                <td className="p-3 text-center whitespace-nowrap space-x-1">
                  {isAdmin && <button onClick={() => {setEditIncidente(inc); scrollToTop();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>}
                  {isAdmin && <button onClick={() => handleDeleteItem('incidentes', inc.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️ Eliminar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInforme = () => {
    const getAllLogs = () => {
      let allLogs = [];
      
      safeRiesgos.forEach(r => {
        (r.historialCambios || []).forEach(log => {
          allLogs.push({ ...log, modulo: 'Riesgos', idRef: `RIESGO-${r.id}`, desc: r.proceso, icon: '⚠️', color: 'bg-amber-100 text-amber-700' });
        });
      });
      safeEvaluaciones.forEach(e => {
        (e.historialCambios || []).forEach(log => {
          allLogs.push({ ...log, modulo: 'Test Auditoría', idRef: `TEST-${e.id}`, desc: `Test a Riesgo #${e.idRiesgo}`, icon: '🔬', color: 'bg-purple-100 text-purple-700' });
        });
      });
      safeHallazgos.forEach(h => {
        (h.historialCambios || []).forEach(log => {
          allLogs.push({ ...log, modulo: 'Hallazgos', idRef: `HAL-${h.id}`, desc: h.titulo, icon: '📄', color: 'bg-red-100 text-red-700' });
        });
      });
      safePlanes.forEach(p => {
        (p.historialCambios || []).forEach(log => {
          allLogs.push({ ...log, modulo: 'Planes Acción', idRef: `PLAN-${p.id}`, desc: p.accion, icon: '✅', color: 'bg-blue-100 text-blue-700' });
        });
      });
      safeIncidentes.forEach(i => {
        (i.historialCambios || []).forEach(log => {
          allLogs.push({ ...log, modulo: 'Incidentes', idRef: `INC-${i.id}`, desc: i.titulo, icon: '🚨', color: 'bg-rose-100 text-rose-700' });
        });
      });

      return allLogs.sort((a, b) => {
        const dateA = new Date(formatSafeDate(a.fecha)).getTime() || 0;
        const dateB = new Date(formatSafeDate(b.fecha)).getTime() || 0;
        return dateB - dateA;
      }).map(log => ({ ...log, fechaVal: formatSafeDate(log.fecha) }));
    };

    const logsOrdenados = getAllLogs();

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="border-b pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-slate-800">📜 Logs del Sistema</h2>
            <p className="text-xs text-slate-500 font-bold mt-1">Módulo de trazabilidad y rastro de auditoría.</p>
          </div>
          <div className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-200">
            Total Registros: {logsOrdenados.length}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Línea de Tiempo de Cambios</h3>
            <div className="flex space-x-3 items-center">
              <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                  <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 w-64 shadow-sm" />
              </div>
              <button onClick={() => exportToExcel(logsOrdenados, 'Trazabilidad_GRC')} className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-700 transition-colors">📥 Exportar Logs</button>
            </div>
          </div>
          
          <div className="p-0">
            <table className="w-full text-xs text-left divide-y">
              <thead className="bg-white text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="p-4 w-40">
                    <div>Fecha y Hora</div>
                    <FilterInput colKey="fechaVal" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 w-32">
                    <div>Módulo</div>
                    <FilterInput colKey="modulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4">
                    <div>Acción Realizada</div>
                    <FilterInput colKey="accion" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                  <th className="p-4 w-64">
                    <div>Referencia</div>
                    <FilterInput colKey="desc" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsOrdenados.length === 0 && (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-medium italic">No se encontraron movimientos registrados en la base de datos.</td></tr>
                )}
                {applyFilters(logsOrdenados, searchTerm, columnFilters).map((log, index) => (
                  <tr key={`log-${index}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-medium text-slate-600">{log.fechaVal}</td>
                    <td className="p-4">
                      <span className={`flex items-center space-x-1.5 w-max px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${log.color}`}>
                        <span>{log.icon}</span>
                        <span>{log.modulo}</span>
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-800">{log.accion}</td>
                    <td className="p-4">
                      <div className="font-black text-slate-700 text-[10px] uppercase">{log.idRef}</div>
                      <div className="truncate w-56 text-slate-500 font-medium" title={log.desc}>{log.desc}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // FASE 7: RENDERIZADO DEL PORTAL RCSA (AUTOEVALUACIÓN LITE) PARA USUARIOS NO ADMINISTRADORES
  const renderRCSAPortal = () => {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <header className="bg-[#004d40] text-white p-6 shadow-md flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black tracking-widest uppercase flex items-center space-x-2"><span>🛡️</span> <span>Termales GRC</span></h1>
            <p className="text-xs text-[#deff9a] font-bold mt-1">Portal de Autoevaluación de Procesos (1ra Línea)</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs font-mono bg-[#00695c] px-3 py-1 rounded-full border border-[#00897b]">👤 {user.email}</span>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Cerrar Sesión</button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-black text-slate-800 mb-2">¡Bienvenido a su Panel de Control!</h2>
            <p className="text-sm text-slate-600">Como dueño de proceso, usted es responsable de certificar que los controles operan correctamente y de mantener actualizados sus planes de acción.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 overflow-hidden flex flex-col h-full">
              <div className="bg-emerald-50 p-5 border-b border-emerald-100">
                <h3 className="font-black text-emerald-800 text-sm uppercase tracking-widest flex items-center space-x-2"><span>🛡️</span> <span>Evaluar Mis Controles</span></h3>
              </div>
              <div className="p-6 flex-1 bg-white">
                <form onSubmit={handleEvaluacionSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Seleccione el Riesgo / Control a certificar:</label>
                    <select name="idRiesgo" required className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-emerald-500 focus:border-emerald-500">
                      <option value="">-- Seleccione un Riesgo --</option>
                      {safeRiesgos.map(r => <option key={`rcsa-r-${r.id}`} value={r.id}>[ID:{r.id}] {r.proceso} - {r.descripcionControl}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">El control está diseñado de forma:</label>
                      <select name="diseno" className="w-full border border-slate-300 rounded-lg p-2.5"><option>Eficaz</option><option>Inadecuado</option></select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">En la operación, el control es:</label>
                      <select name="ejecucion" className="w-full border border-slate-300 rounded-lg p-2.5"><option>Eficaz</option><option>Inadecuado</option></select>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Comentarios / Novedades del mes:</label>
                    <textarea name="comentarios" required rows="3" className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="Escriba aquí sus observaciones..."></textarea>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Adjuntar Evidencia (PDF, Imagen OBLIGATORIO):</label>
                    <input type="file" name="evidenciaArchivo" required className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50" accept=".pdf,.jpg,.png" />
                  </div>
                  <button type="submit" disabled={isUploading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest p-3 rounded-xl shadow-md transition-colors mt-2">
                    {isUploading ? 'Subiendo...' : 'Certificar Control'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-blue-100 overflow-hidden flex flex-col h-full">
              <div className="bg-blue-50 p-5 border-b border-blue-100">
                <h3 className="font-black text-blue-800 text-sm uppercase tracking-widest flex items-center space-x-2"><span>📈</span> <span>Actualizar Mis Planes de Acción</span></h3>
              </div>
              <div className="p-6 flex-1 bg-white">
                <form onSubmit={handlePlanSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Seleccione el Plan en curso:</label>
                    <select name="idHallazgo" required className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:ring-blue-500 focus:border-blue-500">
                      <option value="">-- Seleccione un Plan --</option>
                      {safePlanes.map(p => {
                         const hallazgo = safeHallazgos.find(h => h.id === p.idHallazgo);
                         return <option key={`rcsa-p-${p.id}`} value={p.idHallazgo}>Plan #{p.id}: {p.accion.substring(0, 50)}...</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">¿Qué % de avance real tiene hoy?</label>
                    <input type="number" name="progreso" min="0" max="100" required placeholder="Ej: 50" className="w-full border border-slate-300 rounded-lg p-2.5 text-lg font-black text-blue-600" />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Adjuntar Soporte de Avance:</label>
                    <input type="file" name="evidenciaArchivo" className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" />
                  </div>
                  <div className="pt-4 mt-auto">
                    <button type="submit" disabled={isUploading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest p-3 rounded-xl shadow-md transition-colors">
                      {isUploading ? 'Actualizando...' : 'Reportar Avance'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-2xl">
          <div className="text-center">
            <span className="text-5xl block animate-bounce">🛡️</span><h2 className="mt-4 text-3xl font-extrabold text-slate-900">GCM Auditor v5</h2><p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Termales GRC Platform</p>
          </div>
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

  // SI NO ES ADMINISTRADOR, RENDERIZA EL PORTAL RCSA (FASE 7)
  if (!isAdmin) {
    return renderRCSAPortal();
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* NOTIFICACIONES EMERGENTES */}
      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl font-bold text-xs z-50 animate-in fade-in slide-in-from-bottom-5 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {notification.type === 'error' ? '⚠️ ' : '✅ '} {notification.message}
        </div>
      )}

      {/* FASE 7: MODAL DE INTELIGENCIA ARTIFICIAL VISIÓN / CONTEXTO */}
      {aiModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="bg-purple-900 text-white p-5 flex justify-between items-center border-b border-purple-800">
                 <h3 className="font-black text-sm uppercase tracking-widest">{aiModal.titulo}</h3>
                 <button onClick={() => setAiModal(null)} className="text-purple-300 hover:text-white font-black text-xl">✖</button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                 <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6 flex space-x-4 items-start">
                    <span className="text-3xl">🧠</span>
                    <p className="text-xs text-purple-900 font-medium leading-relaxed">
                      El modelo de IA ha generado el siguiente pre-diagnóstico. Por favor, abre el archivo adjunto y utiliza esta guía para validar la evidencia de forma estricta.
                    </p>
                 </div>
                 <div className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                    {aiModal.contenido}
                 </div>
              </div>
              <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-end space-x-3">
                 <a href={aiModal.url} target="_blank" rel="noreferrer" className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-slate-700 transition-colors flex items-center space-x-2"><span>📎</span><span>Abrir Archivo Manualmente</span></a>
              </div>
           </div>
        </div>
      )}

      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
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
            { id: 'informe', icon: '📜', label: 'Trazabilidad' }
          ].map((tab, index) => (
            <button key={`nav-${tab.id}-${index}`} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center space-x-2 ${activeTab === tab.id ? 'bg-[#004d40] text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full text-[10px] text-slate-300 border border-slate-700/50 rounded-lg py-1.5 font-bold flex items-center justify-center space-x-1"><span>🚪</span> <span>Cerrar Sesión</span></button></div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white border-b h-16 flex items-center justify-between px-8 shadow-sm z-10">
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-mono font-bold">Termales de Santa Rosa de Cabal</span>
          
          <button onClick={() => setIsAlertPanelOpen(!isAlertPanelOpen)} className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors focus:outline-none">
            <span className="text-xl">🔔</span>
            {alertasActivas.length > 0 && <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-pulse">{alertasActivas.length}</span>}
          </button>
        </header>

        {isAlertPanelOpen && (
          <div className="absolute top-16 right-0 bottom-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="p-4 border-b bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center space-x-2"><span>🤖</span> <span>Centro de Alertas</span></h3>
<button onClick={() => setIsAlertPanelOpen(false)} className="text-slate-400 hover:text-white font-bold">X</button>
            </div>  
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {alertasActivas.length === 0 ? (
                <div className="text-center p-6 text-slate-400">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-xs font-bold uppercase tracking-widest">Todo bajo control</p>
                  <p className="text-[10px] mt-1">El sistema no detecta anomalías urgentes.</p>
                </div>
              ) : (
                alertasActivas.map(alerta => (
                  <div key={alerta.id} className={`p-3 rounded-xl border ${alerta.color} shadow-sm`}>
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">{alerta.icono}</span>
                      <div>
                        <h4 className="font-black text-[11px] uppercase tracking-wider">{alerta.titulo}</h4>
                        <p className="text-[10px] mt-1 font-medium opacity-90 leading-tight">{alerta.desc}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <main className="flex-grow overflow-y-auto p-8 relative">
          <div className="max-w-7xl mx-auto">
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
          </div>
        </main>
      </div>
    </div>
  );
}
