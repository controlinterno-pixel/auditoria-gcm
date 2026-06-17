import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// =====================================================================
// 🤖 CONEXIÓN SEGURA A GEMINI PRO IA
// =====================================================================
let GEMINI_API_KEY = "";
try {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  }
} catch (error) { console.warn("Entorno simulado: variables de Vercel no detectadas."); }

// --- CONFIGURACIÓN DE FIREBASE ---
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

const ADMIN_EMAILS = [
  "controlinterno@termales.com.co", "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co", "analista.controlinterno@termales.com.co"
];

// =====================================================================
// 🛠️ FUNCIONES GLOBALES
// =====================================================================
const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };
const mapMesNumATexto = { "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre" };

const formatSafeDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString().split('T')[0];
  if (val instanceof Date) return val.toISOString().split('T')[0];
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
  if (dateStr) return mapMesNumATexto[getMonthFromDate(dateStr)] || "Mayo";
  return "Mayo";
};

const calcularMatriz5x5 = (probabilidad, impacto) => {
  const pVal = mapProbabilidadNum[probabilidad] || 3;
  const iVal = mapImpactoNum[impacto] || 2;
  const score = pVal * iVal;
  let apetito = "Dentro de Apetito", accion = "Aceptar / Monitorear", color = "bg-emerald-500 text-white", borderSemaforo = "border-emerald-200";

  if (score <= 4) { color = "bg-emerald-500 text-white"; borderSemaforo = "border-emerald-600"; } 
  else if (score <= 9) { color = "bg-yellow-400 text-slate-900"; borderSemaforo = "border-yellow-600"; accion = "Monitorear periódicamente"; } 
  else if (score <= 16) { color = "bg-orange-500 text-white"; borderSemaforo = "border-orange-600"; apetito = "Fuera de Apetito"; accion = "Mitigar / Ajustar Controles"; } 
  else { color = "bg-red-600 text-white"; borderSemaforo = "border-red-700"; apetito = "Fuera de Apetito"; accion = "Evitar / Suspender Proceso / Transferir"; }
  return { score, apetito, accion, color, borderSemaforo };
};

const applyFilters = (dataArray, globalTerm, colFilters = {}) => {
  let result = dataArray;
  if (globalTerm) {
    const lowerTerm = globalTerm.toLowerCase();
    result = result.filter(item => Object.values(item).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(lowerTerm)));
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
      <div className="flex justify-between text-[10px] font-bold mb-1"><span className="text-slate-500">PROGRESO</span><span className="text-slate-800 notranslate" translate="no">{safeProgress}%</span></div>
      <div className="w-full bg-slate-200 rounded-full h-2"><div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${safeProgress}%` }}></div></div>
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
          <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={339} strokeDashoffset={339 - (339 * safeValue) / 100} className={`${colorClass} transition-all duration-1000`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-3xl font-black text-slate-800 notranslate" translate="no">{safeValue} %</span>
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-6">{label}</p>
      <p className="text-[10px] font-bold text-slate-500 mt-1">{sublabel}</p>
    </div>
  );
};

const FilterInput = ({ colKey, placeholder, dark, columnFilters, handleColFilterChange }) => (
  <input type="text" placeholder={placeholder || "Filtrar..."} className={`mt-2 w-full text-[10px] px-2 py-1.5 font-medium rounded-md border focus:outline-none focus:ring-2 transition-all ${dark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-[#004d40]'}`} value={columnFilters[colKey] || ''} onChange={(e) => handleColFilterChange(colKey, e.target.value)} onClick={(e) => e.stopPropagation()} />
);

const TrendChart = ({ data, title, isCurrency, color, fillColor }) => {
  const maxVal = Math.max(...data.map(d => d.valor), 1);
  const height = 120, width = 600, paddingY = 20, paddingX = 20;
  const points = data.map((d, i) => `${paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1))},${height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY))}`).join(' ');
  const fillPoints = `${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
       <div className="flex justify-between items-center mb-6"><h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h4><span className="text-xl">{isCurrency ? '📉' : '📊'}</span></div>
       <div className="relative w-full">
         <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm overflow-visible" preserveAspectRatio="none">
           <polygon points={fillPoints} fill={fillColor} opacity="0.5" />
           <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
           {data.map((d, i) => {
              const x = paddingX + (i * (width - 2 * paddingX) / (data.length - 1 || 1)), y = height - paddingY - ((d.valor / maxVal) * (height - 2 * paddingY));
              return (
                <g key={`point-${i}`} className="group cursor-pointer">
                    <circle cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="3" className="transition-all duration-200 group-hover:r-[8px]" />
                    <rect x={x - 35} y={y - 32} width="70" height="22" rx="6" fill="#1e293b" className="opacity-0 group-hover:opacity-100 transition-opacity" pointerEvents="none" />
                    <text x={x} y={y - 17} fontSize="11" fill="white" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none notranslate" translate="no">{isCurrency ? `$${(d.valor/1000000).toFixed(1)}M` : Math.round(d.valor)}</text>
                </g>
              );
           })}
         </svg>
         <div className="flex justify-between mt-4 text-[9px] font-bold text-slate-400 uppercase px-2 border-t border-slate-100 pt-3">{data.map((d, idx) => <span key={`chart-mes-${idx}`} className="notranslate" translate="no">{d.mes.substring(0,3)}</span>)}</div>
       </div>
    </div>
  );
};

// --- DATOS POR DEFECTO OPTIMIZADOS PARA EVITAR ERROR DE MEMORIA ---
const defaultCronograma = [
  { id: 1, codigo: '01', periodo: 'Enero - Febrero', proceso: 'Cumplimiento Normativo', enfoque: 'Verificación de cumplimiento normativo y legal.', cumplimiento: 100, responsable: 'Yehison J Pineda.', apoyo: 'Rodolfo González G.', meses: ['Enero', 'Febrero'] },
  { id: 2, codigo: '02', periodo: 'Mayo - Junio', proceso: 'Compras', enfoque: 'Auditoría a procesos de selección, cotización y pagos de proveedores.', cumplimiento: 0, responsable: 'Yehison J Pineda.', apoyo: 'Rodolfo Gonzalez G.', meses: ['Mayo', 'Junio'] },
  { id: 3, codigo: '03', periodo: 'Noviembre - Diciembre', proceso: 'Financiera', enfoque: 'Revisión de estados financieros y conciliaciones.', cumplimiento: 0, responsable: 'Rodolfo Gonzalez G.', apoyo: 'Yehison J Pineda.', meses: ['Noviembre', 'Diciembre'] }
];

const defaultRiesgos = [
  { id: 98, sede: 'Hotel', categoria: 'Operativo', proceso: 'Alimentos y bebidas', normativa: 'Norma Técnica de Salubridad', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Insatisfacción del cliente por mala calidad de los productos.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe A&B', anio: 2026, mes: 'Mayo', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, sede: 'Ecoparque', ref: 'HAL-2026-001', titulo: 'Acceso de usuarios genéricos a BD.', proceso: 'Sistemas', responsable: 'Jefe de TI', auditor: 'Auditoría TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultPlanes = [
  { id: 1, idHallazgo: 1, accion: 'Desactivar credenciales comunes.', responsable: 'Jefe de TI', fecha: '2026-07-15', estado: 'En Proceso', progreso: 30, anio: 2026, mes: 'Julio', historialCambios: [] }
];

const defaultIncidentes = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-05', titulo: 'Alarma de ataque contenida', descripcion: 'El firewall detectó 400 intentos.', costo: 1200000, impacto: 'Bajo', reportadoPor: 'analista@termales.com.co', estado: 'Cerrado', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultEvaluaciones = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-01', diseño: 'Eficaz', ejecucion: 'Eficaz', calificacion: 100, comentarios: 'Prueba exitosa.', auditor: 'controlinterno@termales.com.co', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultMonitoreo = [
  { id: 1, indicador: 'ARQUEOS DE CAJA', valor: 117, limite: 120, tendencia: 'up', proceso: 'Finanzas' }
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

  const [selectedAnios, setSelectedAnios] = useState([new Date().getFullYear(), new Date().getFullYear() + 1]);
  const [selectedMeses, setSelectedMeses] = useState(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]);

  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);

  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);
  const [editApetito, setEditApetito] = useState(null); 
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

  useEffect(() => {
    setSearchTerm(''); setColumnFilters({}); setFiltroHeatMap(null);
  }, [activeTab]);

  const handleColFilterChange = (key, value) => { setColumnFilters(prev => ({ ...prev, [key]: value })); };
  const toggleAnio = (anio) => { setSelectedAnios(prev => prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]); };
  const toggleMes = (mes) => { setSelectedMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]); };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser ? ADMIN_EMAILS.includes(currentUser.email?.toLowerCase().trim()) : false);
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
        setRiesgos(data.riesgos || defaultRiesgos); setHallazgos(data.hallazgos || defaultHallazgos); setPlanes(data.planes || defaultPlanes);
        setIncidentes(data.incidentes || defaultIncidentes); setEvaluaciones(data.evaluaciones || defaultEvaluaciones);
        setCronograma(data.cronograma || defaultCronograma); setMonitoreo(data.monitoreo || defaultMonitoreo);
      } else {
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
           setDoc(docRef, { riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, cronograma: defaultCronograma, monitoreo: defaultMonitoreo });
        }
      }
      setIsCloudLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (window.XLSX) { setXlsxLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true; script.onload = () => setXlsxLoaded(true);
    document.head.appendChild(script);
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault(); setAuthError('');
    try { isRegistering ? await createUserWithEmailAndPassword(auth, authEmail, authPassword) : await signInWithEmailAndPassword(auth, authEmail, authPassword); } 
    catch (error) { setAuthError('Error en credenciales.'); }
  };

  const handleLogout = async () => { await signOut(auth); };
  const saveToCloud = async (partialData) => { await setDoc(doc(db, 'workspace_compartido', 'base_de_datos_grc'), partialData, { merge: true }); };
  const showNotification = (message, type = 'success') => { setNotification({message, type}); setTimeout(() => setNotification(null), 4000); };
  
  // SOLUCIÓN AL SCROLL DE EDICIÓN
  const scrollToForm = () => {
    setTimeout(() => {
      const formEl = document.getElementById('edit-form');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const exportToExcel = (dataArray, fileName) => {
    if (!xlsxLoaded || !window.XLSX) return showNotification("La librería de exportación aún está cargando.", "error");
    const ws = window.XLSX.utils.json_to_sheet(dataArray.map(item => { const { historialCambios, ...rest } = item; return rest; }));
    const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    window.XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification(`Archivo ${fileName} exportado con éxito.`);
  };

  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ riesgos: safeRiesgos, hallazgos: safeHallazgos, planes: safePlanes, incidentes: safeIncidentes, evaluaciones: safeEvaluaciones, cronograma: safeCronograma, monitoreo: safeMonitoreo }, null, 2));
    const dlNode = document.createElement('a'); dlNode.setAttribute("href", dataStr); dlNode.setAttribute("download", "GCM_Backup.json");
    document.body.appendChild(dlNode); dlNode.click(); dlNode.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if(window.confirm("⚠️ ALERTA: Esto sobrescribirá TODA la base de datos actual. ¿Estás seguro?")) {
          setIsCloudLoaded(false); await saveToCloud(parsedData); showNotification("DB actualizada.", "success"); setIsCloudLoaded(true);
        }
      } catch(error) { showNotification("Error formato JSON.", "error"); }
      e.target.value = null; 
    }; reader.readAsText(file);
  };

  // --- FUNCIÓN RESTAURADA: CARGAR RIESGOS DESDE EXCEL ---
  const handleImportExcelRiesgos = (e) => {
    if (!window.XLSX) return showNotification("Cargando librería Excel...", "error");
    const file = e.target.files[0]; if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        if(window.confirm("⚠️ ¿Reemplazar tu Matriz de Riesgos actual con los datos del Excel?")) {
          setIsCloudLoaded(false);
          const nuevosRiesgos = json.map((r, i) => ({
            id: r.id || Date.now() + i, sede: r.sede || 'Hotel', proceso: r.proceso || 'Proceso General', categoria: r.categoria || 'Operativo', normativa: r.normativa || 'Ninguna', responsable: r.responsable || 'Sin Asignar', noControl: r.noControl || 'C-' + (100+i), descripcionControl: r.descripcionControl || r.control || 'Control no definido', descripcion: r.descripcion || 'Sin descripción', probabilidadInherente: r.probabilidadInherente || 'Posible', impactoInherente: r.impactoInherente || 'Medio', probabilidadResidual: r.probabilidadResidual || 'Posible', impactoResidual: r.impactoResidual || 'Medio', capacidadRiesgo: r.capacidadRiesgo || null, toleranciaFinanciera: r.toleranciaFinanciera || null, apetitoFinanciero: r.apetitoFinanciero || null, posturaEstrategica: r.posturaEstrategica || null, kriScore: r.kriScore || null, anio: r.anio || new Date().getFullYear(), mes: r.mes || "Mayo", historialCambios: [{ fecha: new Date().toLocaleString(), accion: 'Importado masivamente desde Excel' }]
          }));
          await saveToCloud({ riesgos: nuevosRiesgos });
          showNotification(`Matriz actualizada (${nuevosRiesgos.length} riesgos)`, "success");
          setIsCloudLoaded(true);
        }
      } catch (error) { showNotification("Error al procesar Excel.", "error"); setIsCloudLoaded(true); }
      e.target.value = null;
    }; reader.readAsArrayBuffer(file);
  };

  const forceUpdateCronograma = async () => {
    if(window.confirm("¿Seguro que deseas cargar los procesos por defecto del Plan Anual?")) {
      await saveToCloud({ cronograma: defaultCronograma }); showNotification("Plan actualizado!");
    }
  };

  const sugerirConIA = async (tipoTarget) => {
    let textoBase = "", inputDestino = null;
    if (tipoTarget === 'control') { textoBase = document.querySelector('input[name="descripcion"]')?.value || ""; inputDestino = document.querySelector('input[name="control"]'); } 
    else if (tipoTarget === 'plan') { const sel = document.querySelector('select[name="idHallazgo"]'); textoBase = sel ? sel.options[sel.selectedIndex]?.text : ""; inputDestino = document.querySelector('input[name="accion"]'); } 
    else if (tipoTarget === 'hallazgo') { textoBase = document.querySelector('input[name="proceso"]')?.value || ""; inputDestino = document.querySelector('input[name="titulo"]'); }

    if (!textoBase || textoBase.includes('-- Seleccione --')) return showNotification("Escribe descripción primero.", "error");
    if (!GEMINI_API_KEY) return showNotification("Falta API Key IA.", "error");

    setIsThinking(true); showNotification("Gemini analizando...");
    try {
      const prompt = tipoTarget === 'control' ? `Actúa como auditor. Evento: "${textoBase}". Redacta un CONTROL CLAVE mitigante (máximo 20 words). Solo responde texto.`
        : tipoTarget === 'plan' ? `Auditor. Hallazgo: "${textoBase}". Redacta ACCIÓN DE CHOQUE (máximo 20 words). Solo responde texto.`
        : `Auditor. Proceso: "${textoBase}". Redacta un HALLAZGO grave (máximo 20 palabras). Solo responde texto.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }) });
      const data = await response.json(); if (data.error) throw new Error(data.error.message);
      if (inputDestino) { inputDestino.value = data.candidates[0].content.parts[0].text.trim(); inputDestino.dispatchEvent(new Event('input', { bubbles: true })); inputDestino.dispatchEvent(new Event('change', { bubbles: true })); showNotification("¡Sugerencia insertada!"); }
    } catch (error) { showNotification("Error conectando IA.", "error"); } finally { setIsThinking(false); }
  };

  const analizarEvidenciaIA = async (evidenciaUrl, contextoItem, tipoItem) => {
    if (!GEMINI_API_KEY) return showNotification("Falta API Key IA.", "error");
    setIsThinking(true); showNotification("Analizando con Gemini...");
    try {
      const prompt = `Auditor ISO. Archivo para ${tipoItem}: "${contextoItem}". Genera 4 puntos exactos que el analista DEBE verificar al abrir la evidencia.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
      const data = await response.json(); if (data.error) throw new Error();
      alert(`📋 Checklist IA (Gemini)\n\n${data.candidates[0].content.parts[0].text.trim()}`);
    } catch (error) { showNotification("Error IA.", "error"); } finally { setIsThinking(false); }
  };

  const filterByGlobalPeriod = (item) => {
    const a = getItemAnio(item); const m = getItemMesText(item);
    return (selectedAnios.length === 0 || selectedAnios.includes(Number(a)) || selectedAnios.includes(String(a))) && (selectedMeses.length === 0 || selectedMeses.includes(m));
  };

  const rFiltrados = useMemo(() => safeRiesgos.filter(filterByGlobalPeriod), [safeRiesgos, selectedAnios, selectedMeses]);
  const hFiltrados = useMemo(() => safeHallazgos.filter(filterByGlobalPeriod), [safeHallazgos, selectedAnios, selectedMeses]);
  const pFiltrados = useMemo(() => safePlanes.filter(filterByGlobalPeriod), [safePlanes, selectedAnios, selectedMeses]);
  const incFiltrados = useMemo(() => safeIncidentes.filter(filterByGlobalPeriod), [safeIncidentes, selectedAnios, selectedMeses]);

  const avanceGlobal = useMemo(() => pFiltrados.length === 0 ? 0 : pFiltrados.reduce((acc, p) => acc + (p.progreso || p.avance || 0), 0) / pFiltrados.length, [pFiltrados]);
  const hAbiertos = hFiltrados.filter(h => h.estado === 'Abierto').length, pTotal = pFiltrados.length, pAbiertos = pFiltrados.filter(p => p.estado !== 'Cerrado').length, pCerrados = pFiltrados.filter(p => p.estado === 'Cerrado').length;
  const rendimientoControles = useMemo(() => {
    const evs = safeEvaluaciones.filter(filterByGlobalPeriod);
    return evs.length === 0 ? 0 : (evs.filter(e => e.calificacion === 100).length / evs.length) * 100;
  }, [safeEvaluaciones, selectedAnios, selectedMeses]);

  const handleRiesgoSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const ts = new Date().toLocaleString(); let updated;
    const base = { sede: fd.get('sede'), proceso: fd.get('proceso'), categoria: fd.get('categoria'), normativa: fd.get('normativa'), responsable: fd.get('responsable'), descripcionControl: fd.get('control'), descripcion: fd.get('descripcion'), probabilidadInherente: fd.get('probInh'), impactoInherente: fd.get('impInh'), probabilidadResidual: fd.get('probRes')||fd.get('probInh'), impactoResidual: fd.get('impRes')||fd.get('impInh') };
    if (editRiesgo) { updated = safeRiesgos.map(r => r.id === editRiesgo.id ? { ...editRiesgo, ...base, historialCambios: [...(editRiesgo.historialCambios||[]), {fecha:ts, accion:'Modificado'}] } : r); setEditRiesgo(null); } 
    else { updated = [{ id: Date.now(), noControl: 'C-'+Math.floor(Math.random()*100+100), anio: new Date().getFullYear(), mes: "Mayo", historialCambios: [{fecha:ts, accion:'Creado'}], ...base }, ...safeRiesgos]; }
    setRiesgos(updated); await saveToCloud({ riesgos: updated }); e.target.reset(); showNotification("Riesgo guardado.");
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const ts = new Date().toLocaleString(); const prog = parseInt(fd.get('progreso')||0);
    const base = { idHallazgo: parseInt(fd.get('idHallazgo')), accion: fd.get('accion'), responsable: fd.get('responsable'), fecha: fd.get('fecha'), progreso: prog, estado: prog===100?'Cerrado':'En Proceso', evidenciaUrl: fd.get('evidenciaUrlInput') || editPlan?.evidenciaUrl || '' };
    let updated;
    if (editPlan && isAdmin) { updated = safePlanes.map(p => p.id === editPlan.id ? { ...editPlan, ...base, historialCambios: [...(editPlan.historialCambios||[]), {fecha:ts, accion:'Plan act.'}] } : p); setEditPlan(null); } 
    else if (!isAdmin) { const pt = safePlanes.find(p => p.idHallazgo === base.idHallazgo); if(pt) updated = safePlanes.map(p => p.id === pt.id ? { ...pt, progreso: prog, estado: base.estado, evidenciaUrl: base.evidenciaUrl, historialCambios: [...(pt.historialCambios||[]), {fecha:ts, accion:'Avance'}] } : p); else return; }
    else { updated = [...safePlanes, { id: Date.now(), ...base, anio: new Date().getFullYear(), mes: "Mayo", historialCambios: [{fecha:ts, accion:'Asignado'}] }]; }
    setPlanes(updated); await saveToCloud({ planes: updated }); e.target.reset(); showNotification("Plan guardado.");
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const calif = (fd.get('diseno')==='Eficaz' && fd.get('ejecucion')==='Eficaz')?100:0; const ts = new Date().toLocaleString();
    const base = { idRiesgo: parseInt(fd.get('idRiesgo')), diseño: fd.get('diseno'), ejecucion: fd.get('ejecucion'), calificacion: calif, comentarios: fd.get('comentarios'), evidenciaUrl: fd.get('evidenciaUrlInput') || editEvaluacion?.evidenciaUrl || '' };
    let updated;
    if (editEvaluacion) { updated = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? { ...editEvaluacion, ...base } : ev); setEditEvaluacion(null); } 
    else { updated = [...safeEvaluaciones, { id: Date.now(), fecha: new Date().toISOString().split('T')[0], auditor: user.email, anio: new Date().getFullYear(), mes: "Mayo", historialCambios: [], ...base }]; }
    setEvaluaciones(updated); await saveToCloud({ evaluaciones: updated }); e.target.reset(); showNotification("Eval guardada.");
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const base = { sede: fd.get('sede'), ref: fd.get('ref'), proceso: fd.get('proceso'), responsable: fd.get('responsable'), auditor: fd.get('auditor'), titulo: fd.get('titulo'), severidad: fd.get('severidad'), evidenciaUrl: fd.get('evidenciaUrlInput') || editHallazgo?.evidenciaUrl || '' };
    let updated;
    if (editHallazgo) { updated = safeHallazgos.map(h => h.id === editHallazgo.id ? { ...editHallazgo, ...base } : h); setEditHallazgo(null); } 
    else { updated = [...safeHallazgos, { id: Date.now(), estado: 'Abierto', fecha: new Date().toISOString().split('T')[0], anio: new Date().getFullYear(), mes: "Mayo", historialCambios: [], ...base }]; }
    setHallazgos(updated); await saveToCloud({ hallazgos: updated }); e.target.reset(); showNotification("Hallazgo doc.");
  };

  const handleIncidenteSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const ts = new Date().toLocaleString();
    const base = { idRiesgo: parseInt(fd.get('idRiesgo')), titulo: fd.get('titulo'), descripcion: fd.get('descripcion'), costo: parseFloat(fd.get('costo')||0), impacto: fd.get('impacto') };
    let updated;
    if (editIncidente) { updated = safeIncidentes.map(i => i.id === editIncidente.id ? { ...editIncidente, ...base, historialCambios: [...(editIncidente.historialCambios||[]), {fecha:ts, accion:'Modificado'}] } : i); setEditIncidente(null); } 
    else { updated = [...safeIncidentes, { id: Date.now(), fecha: new Date().toISOString().split('T')[0], reportadoPor: user.email, estado: 'Abierto', anio: new Date().getFullYear(), mes: "Mayo", historialCambios: [], ...base }]; }
    setIncidentes(updated); await saveToCloud({ incidentes: updated }); e.target.reset(); showNotification("Incidente guardado.");
  };

  const handleCronogramaSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].filter(m => fd.get(`mes_${m}`));
    const base = { codigo: fd.get('codigo'), proceso: fd.get('proceso'), responsable: fd.get('responsable'), apoyo: fd.get('apoyo'), periodo: fd.get('periodo'), enfoque: fd.get('enfoque'), cumplimiento: parseInt(fd.get('cumplimiento')||0), meses };
    let updated;
    if (editCronograma) { updated = safeCronograma.map(c => c.id === editCronograma.id ? { ...editCronograma, ...base } : c); setEditCronograma(null); } 
    else { updated = [...safeCronograma, { id: Date.now(), ...base }]; }
    setCronograma(updated); await saveToCloud({ cronograma: updated }); e.target.reset(); showNotification("Plan actualizado.");
  };

  const handleApetitoSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const apetito = parseFloat(fd.get('apetitoFinanciero')||0), tolerancia = parseFloat(fd.get('toleranciaFinanciera')||0), capacidad = parseFloat(fd.get('capacidadRiesgo')||0);
    if (apetito > tolerancia || tolerancia > capacidad) return showNotification("Jerarquía inválida.", "error");
    const updated = safeRiesgos.map(r => r.id === editApetito.id ? { ...editApetito, posturaEstrategica: fd.get('posturaEstrategica'), kriScore: parseInt(fd.get('kriScore')), apetitoFinanciero: apetito, toleranciaFinanciera: tolerancia, capacidadRiesgo: capacidad } : r);
    setRiesgos(updated); setEditApetito(null); await saveToCloud({ riesgos: updated }); scrollToForm();
  };

  const handleMonitoreoSubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const base = { indicador: fd.get('indicador').toUpperCase(), proceso: fd.get('proceso'), valor: parseInt(fd.get('valor')||0), limite: parseInt(fd.get('limite')||0), tendencia: fd.get('tendencia')||'flat' };
    let updated;
    if (editMonitoreo && editMonitoreo.id) { updated = safeMonitoreo.map(m => m.id === editMonitoreo.id ? { ...editMonitoreo, ...base } : m); setEditMonitoreo(null); } 
    else { updated = [...safeMonitoreo, { id: Date.now(), ...base }]; setEditMonitoreo(null); }
    setMonitoreo(updated); await saveToCloud({ monitoreo: updated }); e.target.reset();
  };

  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin || !window.confirm('¿Borrar definitivamente?')) return;
    let updated;
    if (listType==='riesgos'){ updated=safeRiesgos.filter(r=>r.id!==id); setRiesgos(updated); }
    else if (listType==='evaluaciones'){ updated=safeEvaluaciones.filter(e=>e.id!==id); setEvaluaciones(updated); }
    else if (listType==='hallazgos'){ updated=safeHallazgos.filter(h=>h.id!==id); setHallazgos(updated); }
    else if (listType==='planes'){ updated=safePlanes.filter(p=>p.id!==id); setPlanes(updated); }
    else if (listType==='incidentes'){ updated=safeIncidentes.filter(i=>i.id!==id); setIncidentes(updated); }
    else if (listType==='cronograma'){ updated=safeCronograma.filter(c=>c.id!==id); setCronograma(updated); }
    else if (listType==='monitoreo'){ updated=safeMonitoreo.filter(m=>m.id!==id); setMonitoreo(updated); }
    await saveToCloud({ [listType]: updated }); showNotification("Eliminado.");
  };

  const renderHeaderFiltros = (title, subtitle, includeMatrizToggle = false) => {
    const añosSet = new Set([new Date().getFullYear()]);
    safeHallazgos.forEach(h => { const a = getYearFromDate(formatSafeDate(h.fecha)); if(a !== 'N/A') añosSet.add(Number(a)); });
    const availableYears = Array.from(añosSet).sort().reverse();
    const allMonths = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-6">
        <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>{subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}</div>
        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          <div className="bg-white px-4 py-1.5 rounded-full border border-slate-200 flex items-center shadow-sm space-x-4">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">PERIODO:</span>
            <div className="relative group">
              <button className="text-xs font-bold bg-transparent text-slate-700 outline-none flex items-center space-x-1 cursor-pointer"><span className="notranslate" translate="no">Años ({selectedAnios.length})</span> <span>▼</span></button>
              <div className="absolute top-full left-0 mt-2 bg-white border shadow-xl rounded-xl p-3 z-50 hidden group-hover:block w-max">
                <div className="flex space-x-4 mb-2 border-b pb-1"><button onClick={()=>setSelectedAnios(availableYears)} className="text-[9px] text-blue-600 font-bold">Todos</button><button onClick={()=>setSelectedAnios([])} className="text-[9px] text-red-600 font-bold">Ninguno</button></div>
                {availableYears.map(a => <label key={a} className="flex items-center space-x-2 cursor-pointer p-1"><input type="checkbox" checked={selectedAnios.includes(a)} onChange={()=>toggleAnio(a)}/><span className="text-xs font-bold notranslate" translate="no">{a}</span></label>)}
              </div>
            </div>
            <div className="relative group">
              <button className="text-xs font-bold bg-transparent text-slate-700 outline-none flex items-center space-x-1 cursor-pointer"><span className="notranslate" translate="no">Meses ({selectedMeses.length})</span> <span>▼</span></button>
              <div className="absolute top-full right-0 mt-2 bg-white border shadow-xl rounded-xl p-3 z-50 hidden group-hover:block w-max max-h-64 overflow-y-auto">
                <div className="flex space-x-4 mb-2 border-b pb-1 sticky top-0 bg-white"><button onClick={()=>setSelectedMeses(allMonths)} className="text-[9px] text-blue-600 font-bold">Todos</button><button onClick={()=>setSelectedMeses([])} className="text-[9px] text-red-600 font-bold">Ninguno</button></div>
                {allMonths.map(m => <label key={m} className="flex items-center space-x-2 cursor-pointer p-1"><input type="checkbox" checked={selectedMeses.includes(m)} onChange={()=>toggleMes(m)}/><span className="text-xs font-bold notranslate" translate="no">{m}</span></label>)}
              </div>
            </div>
          </div>
          {includeMatrizToggle && (
            <div className="bg-white p-1 rounded-full border flex shadow-sm">
              <button onClick={()=>{setTipoMatriz('inherente'); setFiltroHeatMap(null);}} className={`px-4 py-1 rounded-full font-bold text-[10px] transition-all ${tipoMatriz==='inherente'?'bg-[#004d40] text-white':'text-slate-500 hover:bg-slate-100'}`}>INHERENTE</button>
              <button onClick={()=>{setTipoMatriz('residual'); setFiltroHeatMap(null);}} className={`px-4 py-1 rounded-full font-bold text-[10px] transition-all ${tipoMatriz==='residual'?'bg-emerald-600 text-white':'text-slate-500 hover:bg-slate-100'}`}>RESIDUAL</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfiguracion = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">⚙️ Configuración y Backups</h2></div>
      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 flex justify-between items-center">
         <div><h3 className="font-black text-amber-900 text-sm mb-1">🚀 Restaurar Procesos Base</h3><p className="text-xs text-amber-700 max-w-2xl">Carga automáticamente los procesos auditables oficiales.</p></div>
         <button onClick={forceUpdateCronograma} className="bg-amber-600 text-white font-black px-6 py-3 rounded-xl shadow-md">Restaurar Cronograma</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600">
          <h3 className="font-black text-emerald-700 uppercase tracking-widest text-sm mb-4">📊 Cargar Matriz (Excel)</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo .xlsx para actualizar masivamente solo la Matriz de Riesgos.</p>
          <label className="block w-full cursor-pointer bg-emerald-50 text-emerald-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-emerald-200 transition-all">
            Seleccionar Excel <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcelRiesgos} />
          </label>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200">
          <h3 className="font-black text-slate-700 text-sm mb-4">📥 Exportar Backup (.JSON)</h3>
          <p className="text-xs text-slate-600 mb-6">Descarga toda la base de datos.</p>
          <button onClick={exportToJSON} className="w-full bg-slate-800 text-white font-black py-3 rounded-xl shadow-md">Descargar JSON</button>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-t-4 border-t-red-600">
          <h3 className="font-black text-red-600 text-sm mb-4">📤 Cargar JSON Completo</h3>
          <p className="text-xs text-slate-600 mb-6">Sobrescribe todos los módulos.</p>
          <label className="block w-full cursor-pointer bg-red-50 text-red-700 font-black py-3 text-center rounded-xl shadow-sm border border-red-200">
            Seleccionar JSON <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>
        </div>
      </div>
    </div>
  );

  const renderTablero = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {renderHeaderFiltros("Tablero Analítico de Auditoría", "Análisis integral de desviaciones operativas.")}
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">INDICADORES KRI EN TIEMPO REAL</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Gauge value={avanceGlobal} label="MITIGACIÓN GLOBAL" sublabel="Promedio Planes de Acción" colorClass="text-blue-500" />
        <Gauge value={rendimientoControles} label="CONTROLES DE SALUD" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
        <div className="bg-[#0f172a] text-white p-6 rounded-2xl shadow-lg border border-slate-800 text-center"><span className="text-[10px] font-black text-rose-500 uppercase">ALERTA CRÍTICA</span><span className="text-6xl font-black mt-4 block">{hAbiertos}</span><p className="text-xs font-bold text-slate-300 mt-4">Hallazgos Pendientes de Cierre</p></div>
      </div>
    </div>
  );

  const renderDashboardRiesgos = () => {
    const esRes = tipoMatriz === 'residual';
    const totalRiesgos = rFiltrados.length, riesgosCriticos = rFiltrados.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
    const riesgosFueraApetito = rFiltrados.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).apetito === "Fuera de Apetito").length, totalPerdidas = incFiltrados.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);
    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'], probabilidades = ['Rara', 'Posible', 'Frecuente'];
    const contarCelda = (imp, prob) => rFiltrados.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;
    
    const mesesCompletos = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mesesGrafica = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataIncidentes = mesesCompletos.map((mesTexto, idx) => ({ mes: mesesGrafica[idx], valor: incFiltrados.filter(i => getItemMesText(i) === mesTexto).reduce((acc, val) => acc + (Number(val.costo) || 0), 0) }));
    const dataHallazgos = mesesCompletos.map((mesTexto, idx) => ({ mes: mesesGrafica[idx], valor: hFiltrados.filter(h => getItemMesText(h) === mesTexto).length }));

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderHeaderFiltros("Panel de inteligencia GRC", "Análisis predictivo de apetito ISO 31000 y Evolución de KRI.", true)}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TrendChart data={dataIncidentes} title={`EVOLUCIÓN IMPACTO FINANCIERO`} isCurrency={true} color="#ef4444" fillColor="#fef2f2" />
          <TrendChart data={dataHallazgos} title={`VOLUMEN DE DESVIACIONES`} isCurrency={false} color="#3b82f6" fillColor="#eff6ff" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-l-blue-500"><h4 className="text-[10px] font-black text-slate-500">RIESGOS TOTALES</h4><span className="text-4xl font-black mt-2 block">{totalRiesgos}</span></div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-l-red-600"><h4 className="text-[10px] font-black text-slate-500">FUERA DE APETITO</h4><span className="text-4xl font-black mt-2 block text-red-600">{riesgosFueraApetito}</span></div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-l-orange-500"><h4 className="text-[10px] font-black text-slate-500">RIESGOS CRÍTICOS</h4><span className="text-4xl font-black mt-2 block text-orange-500">{riesgosCriticos}</span></div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-l-purple-600"><h4 className="text-[10px] font-black text-slate-500">PÉRDIDAS TOTALES</h4><span className="text-3xl font-black mt-2 block text-purple-700">${(totalPerdidas).toLocaleString('es-CO')}</span></div>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border p-8 flex flex-col items-center">
          <h3 className="font-black text-slate-600 text-xs uppercase mb-8 w-full flex items-center space-x-3"><span>🗺️ MAPA DE CALOR</span><span className="bg-slate-800 text-white px-3 py-1 rounded-full text-[9px]">{tipoMatriz}</span></h3>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 w-full max-w-3xl relative pb-4">
              <div className="absolute -left-16 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-black text-slate-400">IMPACTO</div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-400">PROBABILIDAD</div>
              <div></div>{probabilidades.map(p => <div key={`p-${p}`} className="text-center text-[10px] font-black bg-slate-50 py-2">{p}</div>)}
              {impactos.map(imp => (<React.Fragment key={`i-${imp}`}><div className="text-right pr-4 py-6 font-black text-[10px] bg-slate-50 flex items-center justify-end">{imp}</div>
                  {probabilidades.map(prob => {
                    const count = contarCelda(imp, prob), { score, color, borderSemaforo } = calcularMatriz5x5(prob, imp);
                    return (<div key={`c-${imp}-${prob}`} onClick={() => { if (count > 0) setFiltroHeatMap({ impacto: imp, probabilidad: prob, count }); }} className={`relative border-2 p-6 flex flex-col justify-center items-center h-28 rounded-2xl ${count > 0 ? 'cursor-pointer hover:scale-105 shadow-md' : 'opacity-20'} ${color} ${borderSemaforo}`}><span className="absolute top-2 right-3 text-[9px] font-mono text-slate-900 opacity-50">S:{score}</span><span className="text-4xl font-black text-slate-900">{count}</span></div>);
                  })}</React.Fragment>))}
          </div>
          {filtroHeatMap && (<div id="detalle-heatmap" className="mt-8 w-full bg-slate-50 rounded-xl p-4 border flex justify-between items-center"><h4 className="font-black text-slate-800 text-xs">🔎 Riesgos Cuadrante: {filtroHeatMap.probabilidad} / {filtroHeatMap.impacto}</h4><button onClick={() => setFiltroHeatMap(null)} className="bg-red-600 text-white text-xs px-4 py-2 rounded-lg">✖ Cerrar</button></div>)}
        </div>
      </div>
    );
  };

  const renderPlanAnual = () => {
    const allMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const cronogramaOrdenado = [...safeCronograma].sort((a, b) => {
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
    const avgCumplimiento = procesosActivos.length > 0 ? Math.round(procesosActivos.reduce((acc, c) => acc + c.cumplimiento, 0) / procesosActivos.length) : (cronogramaOrdenado.length > 0 ? Math.round(cronogramaOrdenado.reduce((acc, c) => acc + c.cumplimiento, 0) / cronogramaOrdenado.length) : 0);

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
          <div className="bg-[#004d40] text-white p-6 flex justify-between items-center">
            <h2 className="text-2xl font-black uppercase">Plan Anual de Auditoría 2026</h2>
            <div className="bg-[#00695c] px-6 py-2 rounded-full border border-[#00897b] flex items-center space-x-3"><span className="text-xl font-black">{avgCumplimiento}% Global</span></div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="md:col-span-1 space-y-6">
                <div className="border rounded-2xl p-6 text-center">
                   <h3 className="text-[10px] font-black uppercase text-slate-500">Índice General</h3>
                   <div className="text-6xl font-black text-[#004d40] mt-2 mb-2">{avgCumplimiento}%</div>
                   <div className="text-xs font-bold text-emerald-600 flex items-center justify-center space-x-1"><span>▲</span><span>Meta Alcanzada</span></div>
                </div>
                <div className="border rounded-2xl overflow-hidden shadow-sm">
                   <div className="bg-[#004d40] text-white p-3 flex justify-between items-center"><span className="text-[10px] font-black uppercase">Gestor KRIs</span>{isAdmin && <button onClick={() => {setEditMonitoreo({}); scrollToForm();}} className="text-xs bg-white text-[#004d40] px-2 py-0.5 rounded">➕</button>}</div>
                   <div className="divide-y p-2">
                     {editMonitoreo && isAdmin && (
                       <form onSubmit={(e) => handleSubmits(e, 'moni')} key={`moni-form-${formResetKey}`} className="p-3 bg-slate-50 rounded-lg mb-2 border">
                         <input name="indicador" defaultValue={editMonitoreo.indicador||''} placeholder="KRI..." required className="w-full text-xs p-1.5 mb-2 border rounded" />
                         <input name="proceso" defaultValue={editMonitoreo.proceso||''} placeholder="Proceso..." required className="w-full text-xs p-1.5 mb-2 border rounded" />
                         <div className="flex space-x-2 mb-2"><input name="valor" type="number" defaultValue={editMonitoreo.valor||''} required className="w-1/2 text-xs p-1.5 border rounded" /><input name="limite" type="number" defaultValue={editMonitoreo.limite||''} className="w-1/2 text-xs p-1.5 border rounded" /></div>
                         <div className="flex justify-between mt-1"><button type="button" onClick={() => setEditMonitoreo(null)} className="text-[10px] text-red-500 px-2">Cancel</button><button type="submit" className="text-[10px] bg-[#004d40] text-white px-3 py-1.5 rounded">Guardar</button></div>
                       </form>
                     )}
                     {safeMonitoreo.map((m) => (
                       <div key={m.id} className="p-3 hover:bg-slate-50 group flex justify-between items-center"><div className="text-[10px] font-bold">{m.indicador} <div className="text-slate-400 font-normal">{m.proceso}</div></div><div className="text-xs font-black">{m.valor}/{m.limite} {isAdmin && <span className="ml-2 space-x-1 opacity-0 group-hover:opacity-100"><button onClick={()=>{setEditMonitoreo(m); setFormResetKey(Date.now()); scrollToForm();}}>✏️</button><button onClick={()=>handleDeleteItem('monitoreo', m.id)}>🗑️</button></span>}</div></div>
                     ))}
                   </div>
                </div>
             </div>
             <div className="md:col-span-3">
                <div className="border rounded-2xl overflow-hidden shadow-sm h-full flex flex-col">
                   <div className="bg-[#1e293b] text-white p-4 flex justify-between items-center"><span className="text-xs font-black uppercase">Cronograma Técnico</span></div>
                   <div className="overflow-x-auto flex-1 p-2">
                     <table className="w-full text-xs text-left divide-y">
                       <thead className="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase"><tr><th className="p-3">ID</th><th className="p-3">Periodo</th><th className="p-3">Proceso</th><th className="p-3 text-center">% Acumul.</th>{isAdmin && <th className="p-3 text-center">Acción</th>}</tr></thead>
                       <tbody className="divide-y">
                         {applyFilters(cronogramaOrdenado, searchTerm, columnFilters).map((c) => (
                           <tr key={c.id} className="hover:bg-slate-50/50"><td className="p-3">0{c.codigo}</td><td className="p-3">{c.periodo}</td><td className="p-3 font-black">{c.proceso}</td><td className="p-3 text-center font-black">{c.cumplimiento}%</td>
                             {isAdmin && (<td className="p-3 text-center"><button onClick={() => {setEditCronograma(c); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 mx-1">✏️</button><button onClick={() => handleDeleteItem('cronograma', c.id)} className="text-slate-400 mx-1">🗑️</button></td>)}
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
            <div className="flex justify-between items-center border-b pb-3 mb-4"><h3 className="text-sm font-black text-slate-700">{editCronograma ? '✏️ Editando Proceso' : '➕ Agregar Proceso'}</h3>{editCronograma && <button onClick={() => setEditCronograma(null)} className="text-xs text-red-500 font-bold">✖ Cancelar</button>}</div>
            <form onSubmit={(e) => handleSubmits(e, 'crono')} key={editCronograma ? `edit-crono-${editCronograma.id}-${formResetKey}` : `new-crono-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div><label className="font-bold">Código ID</label><input name="codigo" defaultValue={editCronograma?.codigo||''} required className="w-full border rounded-lg p-2" /></div>
              <div><label className="font-bold">Periodo</label><input name="periodo" defaultValue={editCronograma?.periodo||''} required className="w-full border rounded-lg p-2" /></div>
              <div className="md:col-span-2"><label className="font-bold">Proceso</label><input name="proceso" defaultValue={editCronograma?.proceso||''} required className="w-full border rounded-lg p-2 font-bold" /></div>
              <div><label className="font-bold">Responsable</label><input name="responsable" defaultValue={editCronograma?.responsable||''} required className="w-full border rounded-lg p-2" /></div>
              <div><label className="font-bold">Apoyo</label><input name="apoyo" defaultValue={editCronograma?.apoyo||''} className="w-full border rounded-lg p-2" /></div>
              <div className="md:col-span-2"><label className="font-bold text-emerald-700">% Acumulado</label><input type="number" min="0" max="100" name="cumplimiento" defaultValue={editCronograma?.cumplimiento||0} required className="w-full border bg-emerald-50 rounded-lg p-2 font-black text-emerald-700" /></div>
              <div className="md:col-span-4"><label className="font-bold">Enfoque Técnico</label><textarea name="enfoque" defaultValue={editCronograma?.enfoque||''} required rows="2" className="w-full border rounded-lg p-2"></textarea></div>
              <div className="md:col-span-4"><label className="font-bold block mb-2">Meses (Gantt)</label>
                <div className="grid grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl border">{allMonths.map(mes => (<label key={mes} className="flex items-center space-x-2"><input type="checkbox" name={`mes_${mes}`} defaultChecked={editCronograma?.meses?.includes(mes)} className="rounded text-[#004d40]" /><span className="text-[10px] font-bold notranslate" translate="no">{mes.substring(0,3)}</span></label>))}</div>
              </div>
              <div className="md:col-span-4 flex justify-end mt-2"><button type="submit" className="bg-[#004d40] text-white font-black px-8 py-3 rounded-xl">Guardar</button></div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
           <div className="bg-slate-100 border-b p-4"><h3 className="text-[#004d40] font-black text-xl uppercase text-center">GANTT CONTROL INTERNO</h3></div>
           <div className="overflow-x-auto p-4">
             <table className="w-full text-[10px] text-left border-collapse border border-slate-300">
               <thead className="bg-slate-200 text-slate-700 font-bold uppercase"><tr><th className="border p-2 w-10">Cód</th><th className="border p-2 w-48">Proceso Auditable</th>{allMonths.map(m => <th key={m} className="border p-2 text-center w-16 notranslate" translate="no">{m.substring(0,3)}</th>)}{isAdmin && <th className="border p-2 text-center w-16">Acción</th>}</tr></thead>
               <tbody>
                 {cronogramaOrdenado.map((c) => (
                   <tr key={c.id} className="hover:bg-slate-50">
                     <td className="border p-2 text-center text-slate-500 font-mono">{c.codigo}</td><td className="border p-2 font-black">{c.proceso}</td>
                     {allMonths.map(mes => {
                       const isP = c.meses?.includes(mes); let bg = 'bg-transparent', txt = '';
                       if (isP) { if (c.cumplimiento === 100) { bg = 'bg-emerald-500'; txt = 'Completado'; } else if (c.cumplimiento > 0) { bg = 'bg-amber-500'; txt = `${c.cumplimiento}%`; } else { bg = 'bg-[#00695c]'; txt = 'Planeado'; } }
                       return <td key={mes} className="border text-center p-0">{isP && <div className={`${bg} text-white w-full h-full py-2 font-bold uppercase text-[8px] notranslate`} translate="no">{txt}</div>}</td>;
                     })}
                     {isAdmin && <td className="border p-2 text-center"><button onClick={() => {setEditCronograma(c); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 border border-orange-200 px-2 py-1 rounded">✏️ Modificar</button></td>}
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
    const rData = rFiltrados.map(r => ({ ...r, scoreInhVal: calcularMatriz5x5(r.probabilidadInherente, r.impactoInherente).score, ...calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual) }));
    return (
      <div className="space-y-6">
        <div className="border-b pb-4 flex justify-between items-center"><h2 className="text-2xl font-black text-slate-800">Matriz de Riesgos</h2><button onClick={() => exportToExcel(safeRiesgos, 'Matriz_Riesgos')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">📥 Exportar Excel</button></div>
        {isAdmin && (
          <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">{editRiesgo ? `✏️ Editando Riesgo #${editRiesgo.id}` : '➕ Nuevo Riesgo'}</h3>
            <form onSubmit={(e) => handleSubmits(e, 'riesgo')} key={editRiesgo ? `edit-r-${editRiesgo.id}-${formResetKey}` : `new-r-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div><label className="font-bold">Sede</label><select name="sede" defaultValue={editRiesgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
              <div><label className="font-bold">Proceso</label><input name="proceso" defaultValue={editRiesgo?.proceso||''} required className="w-full border rounded-lg p-2" /></div>
              <div><label className="font-bold">Categoría</label><select name="categoria" defaultValue={editRiesgo?.categoria||'Operativo'} className="w-full border rounded-lg p-2 bg-white"><option>Operativo</option><option>Estratégico</option><option>Tecnológico</option></select></div>
              <div><label className="font-bold">Responsable</label><input name="responsable" defaultValue={editRiesgo?.responsable||''} required className="w-full border rounded-lg p-2" /></div>
              <div className="md:col-span-2"><label className="font-bold flex justify-between"><span>Control Clave</span><button type="button" onClick={()=>sugerirConIA('control')} className="text-[9px] bg-purple-100 text-purple-700 px-2 rounded">🤖 IA</button></label><input name="control" defaultValue={editRiesgo?.descripcionControl||''} required className="w-full border rounded-lg p-2" /></div>
              <div className="md:col-span-2"><label className="font-bold text-purple-700">Normativa / Ley Aplicable</label><input name="normativa" defaultValue={editRiesgo?.normativa||'Ninguna'} required className="w-full border border-purple-300 bg-purple-50 rounded-lg p-2" /></div>
              <div className="md:col-span-4"><label className="font-bold">Descripción Evento</label><input name="descripcion" defaultValue={editRiesgo?.descripcion||''} required className="w-full border rounded-lg p-2" /></div>
              <div><label className="font-bold">Prob. Inherente</label><select name="probInh" defaultValue={editRiesgo?.probabilidadInherente||'Posible'} className="w-full border rounded-lg p-2 bg-white"><option>Rara</option><option>Posible</option><option>Frecuente</option></select></div>
              <div><label className="font-bold">Imp. Inherente</label><select name="impInh" defaultValue={editRiesgo?.impactoInherente||'Medio'} className="w-full border rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
              <div><label className="font-bold">Prob. Residual</label><select name="probRes" defaultValue={editRiesgo?.probabilidadResidual||'Posible'} className="w-full border rounded-lg p-2 bg-white"><option>Rara</option><option>Posible</option><option>Frecuente</option></select></div>
              <div><label className="font-bold">Imp. Residual</label><select name="impRes" defaultValue={editRiesgo?.impactoResidual||'Medio'} className="w-full border rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
              <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-blue-600 text-white font-bold px-6 py-2 rounded-lg">Guardar</button></div>
            </form>
          </div>
        )}
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase"><tr><th className="p-3">ID</th><th className="p-3">Proceso</th><th className="p-3">Riesgo</th><th className="p-3">Control Mitigante</th><th className="p-3">Apetito COSO</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y text-slate-700">
              {rData.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-400">#{r.id}</td><td className="p-3"><span className="font-black text-slate-900 block">{r.proceso}</span><span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded">{r.normativa}</span></td>
                  <td className="p-3 max-w-xs">{r.descripcion}</td><td className="p-3 italic max-w-xs">⚙️ {r.descripcionControl}</td><td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-[10px]">{r.apetito}</span></td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {isAdmin && <button onClick={() => {setEditRiesgo(r); setFormResetKey(Date.now()); scrollToForm();}} className="text-orange-500 mx-1 border p-1 rounded">✏️</button>}
                    {isAdmin && <button onClick={() => handleDeleteItem('riesgos', r.id)} className="text-slate-400 mx-1 border p-1 rounded">🗑️</button>}
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
    const apetitoData = rFiltrados.map(r => {
      const resScore = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score;
      const costoTotal = incFiltrados.filter(i => i.idRiesgo === r.id).reduce((sum, i) => sum + (Number(i.costo) || 0), 0);
      const estaConfigurado = r.posturaEstrategica && r.capacidadRiesgo;
      let zona = "Sin parametrizar", zonaColor = "bg-slate-100 text-slate-500", consumoPorcentaje = 0;
      if (estaConfigurado) {
        consumoPorcentaje = r.capacidadRiesgo ? Math.min((costoTotal / r.capacidadRiesgo) * 100, 100) : 0;
        if (costoTotal <= r.apetitoFinanciero) { zona = "Confort (Apetito)"; zonaColor = "bg-emerald-50 text-emerald-700 border-emerald-200"; } 
        else if (costoTotal <= r.toleranciaFinanciera) { zona = "Alerta (Tolerancia)"; zonaColor = "bg-yellow-50 text-yellow-700 border-yellow-300"; } 
        else if (costoTotal <= r.capacidadRiesgo) { zona = "Peligro (Brecha)"; zonaColor = "bg-orange-50 text-orange-700 border-orange-300"; } 
        else { zona = "Crítico (Excedida)"; zonaColor = "bg-red-50 text-red-700 border-red-300"; }
      }
      return { ...r, resScoreVal: resScore, costoTotalVal: costoTotal, estaConfiguradoVal: estaConfigurado, zonaVal: zona, zonaColorVal: zonaColor, consumoPorcentajeVal: consumoPorcentaje };
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {renderHeaderFiltros("⚖️ Apetito y Perfil de Riesgo (COSO ERM)", "Parametrización multinivel.")}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-l-blue-500"><h4 className="text-[10px] font-black text-slate-500">Parametrizados</h4><span className="text-4xl font-black mt-2 block">{configurados} / {rFiltrados.length}</span></div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-l-yellow-400"><h4 className="text-[10px] font-black text-slate-500">En Zona Alerta</h4><span className="text-4xl font-black mt-2 block text-yellow-500">{apetitoData.filter(x=>x.zonaVal.includes('Alerta')).length}</span></div>
          <div className="bg-[#0f172a] p-6 rounded-2xl shadow-md border-l-8 border-l-red-600 text-white"><h4 className="text-[10px] font-black text-slate-400">Capacidad Excedida</h4><span className="text-4xl font-black mt-2 block text-red-500">{apetitoData.filter(x=>x.zonaVal.includes('Crítico')).length}</span></div>
        </div>

        {editApetito && (
          <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-2xl border relative z-10">
            <div className="flex justify-between border-b pb-4 mb-4"><h3 className="font-black text-blue-900 uppercase">⚙️ Arquitectura COSO ERM: [{editApetito.id}]</h3><button onClick={() => setEditApetito(null)} className="text-xs text-red-600 font-bold border px-3 py-1 rounded">✖ Cerrar</button></div>
            <form onSubmit={(e) => handleSubmits(e, 'apetito')} key={`apetito-${formResetKey}`} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-4 rounded-2xl border">
                  <h4 className="font-black text-slate-700 uppercase mb-3">1. Límites Operativos (KRI)</h4>
                  <label className="font-bold text-gray-700">Postura Estratégica</label>
                  <select name="posturaEstrategica" defaultValue={editApetito.posturaEstrategica || 'Cauto'} className="w-full border rounded-lg p-2 mb-4 bg-white"><option value="Averso">Averso</option><option value="Cauto">Cauto</option><option value="Flexible">Flexible</option><option value="Buscador">Buscador</option></select>
                  <label className="font-bold text-gray-700">KRI: Puntaje Residual Máximo Permitido</label>
                  <input type="number" min="1" max="25" name="kriScore" defaultValue={editApetito.kriScore || ''} required className="w-full border rounded-lg p-2 bg-white" />
                </div>
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="font-black text-blue-800 uppercase mb-3">2. Umbrales Financieros (COP)</h4>
                  <label className="font-bold text-blue-900">🎯 Apetito de Riesgo (Deseado)</label><input type="number" name="apetitoFinanciero" defaultValue={editApetito.apetitoFinanciero || ''} required className="w-full border rounded-lg p-2 mb-4 bg-white" />
                  <label className="font-bold text-amber-700">⚠️ Tolerancia al Riesgo (Desv. Máx)</label><input type="number" name="toleranciaFinanciera" defaultValue={editApetito.toleranciaFinanciera || ''} required className="w-full border rounded-lg p-2 mb-4 bg-white" />
                  <label className="font-bold text-red-700">🛑 Capacidad de Riesgo (Límite Ruptura)</label><input type="number" name="capacidadRiesgo" defaultValue={editApetito.capacidadRiesgo || ''} required className="w-full border rounded-lg p-2 bg-white" />
                </div>
              </div>
              <div className="flex justify-end pt-4"><button type="submit" className="bg-slate-900 text-white font-black uppercase px-8 py-3 rounded-xl shadow-lg">💾 Aplicar</button></div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
          <div className="p-5 bg-[#0f172a] text-white flex justify-between"><h3 className="font-black text-xs uppercase">Monitor de Brechas</h3></div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs text-left divide-y">
              <thead className="text-slate-500 font-black uppercase text-[9px]"><tr><th className="p-4">Riesgo</th><th className="p-4 text-center">Score KRI</th><th className="p-4 w-1/3 text-center">Consumo Financiero</th><th className="p-4 text-center">Diagnóstico</th><th className="p-4 text-center">Gestión</th></tr></thead>
              <tbody className="divide-y">
                {apetitoData.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-4"><div className="font-black text-slate-800 text-sm">{r.proceso}</div><div className="text-[10px] text-slate-600">{r.descripcion}</div></td>
                    <td className="p-4 text-center">{r.kriScore ? (<div className="font-mono text-xs notranslate" translate="no"><span className="block text-[9px] text-slate-400">Lím: {r.kriScore}</span> <span className={r.resScoreVal>r.kriScore?'text-red-600':'text-slate-700'}>{r.resScoreVal}</span></div>) : '-'}</td>
                    <td className="p-4">{r.estaConfiguradoVal ? (<div><div className="w-full bg-slate-200 rounded-full h-2.5 mb-1"><div className={`h-full rounded-full transition-all ${r.consumoPorcentajeVal<80?'bg-emerald-500':'bg-red-600'}`} style={{width:`${r.consumoPorcentajeVal}%`}}></div></div><div className="flex justify-between text-[9px] font-mono"><span>${r.costoTotalVal.toLocaleString()}</span><span>Tope: ${r.capacidadRiesgo.toLocaleString()}</span></div></div>) : (<div className="text-center text-[10px] border border-dashed rounded py-2 text-slate-300">Requiere Parametrización</div>)}</td>
                    <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full font-black text-[9px] uppercase border ${r.zonaColorVal}`}>{r.zonaVal}</span></td>
                    <td className="p-4 text-center">{isAdmin && <button onClick={()=>{setEditApetito(r); setFormResetKey(Date.now()); scrollToForm();}} className="border px-3 py-1 rounded-lg text-[10px] font-bold">⚙️ Ajustar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEvaluaciones = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">Auditoría de Controles</h2></div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">{editEvaluacion ? '✏️ Editar Test' : '➕ Nuevo Test de Control'}</h3>
          <form onSubmit={(e) => handleSubmits(e, 'eval')} key={editEvaluacion ? `eval-${editEvaluacion.id}-${formResetKey}` : `new-eval-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="md:col-span-2"><label className="font-bold">Riesgo / Control</label><select name="idRiesgo" defaultValue={editEvaluacion?.idRiesgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white">{safeRiesgos.map((r) => <option key={r.id} value={r.id}>[{r.noControl}] {r.proceso}</option>)}</select></div>
            <div><label className="font-bold">Diseño</label><select name="diseno" defaultValue={editEvaluacion?.diseño||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold">Ejecución</label><select name="ejecucion" defaultValue={editEvaluacion?.ejecucion||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div className="md:col-span-4"><label className="font-bold">Enlace Externo de Evidencia</label><input type="url" name="evidenciaUrlInput" defaultValue={editEvaluacion?.evidenciaUrl||''} className="w-full border rounded-lg p-2 mt-1" /></div>
            <div className="md:col-span-4"><label className="font-bold">Comentarios</label><textarea name="comentarios" defaultValue={editEvaluacion?.comentarios||''} required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg">Guardar Test</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold uppercase text-[10px]"><tr><th className="p-3">ID Test</th><th className="p-3">Fecha / Autor</th><th className="p-3">Eficacia</th><th className="p-3">Anexos / Evidencia</th>{isAdmin && <th className="p-3 text-center">Gestión</th>}</tr></thead>
          <tbody className="divide-y">
            {safeEvaluaciones.map(ev => (
              <tr key={ev.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-400">#TEST-{ev.id}</td><td className="p-3"><b>{formatSafeDate(ev.fecha)}</b><p className="text-[9px]">{ev.auditor}</p></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded font-black ${ev.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} notranslate`} translate="no">{ev.calificacion}%</span></td>
                <td className="p-3">{ev.comentarios} {ev.evidenciaUrl && <a href={ev.evidenciaUrl} target="_blank" rel="noreferrer" className="block mt-1 text-blue-600 font-bold">🔗 Ver Enlace</a>}</td>
                {isAdmin && (<td className="p-3 text-center"><button onClick={() => {setEditEvaluacion(ev); setFormResetKey(Date.now()); scrollToForm();}} className="border px-2 py-1 rounded mx-1">✏️</button><button onClick={() => handleDeleteItem('evaluaciones', ev.id)} className="border px-2 py-1 rounded mx-1 text-red-500">🗑️</button></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHallazgos = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">📄 Hallazgos y Desviaciones</h2></div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border space-y-6">
          <h3 className="text-sm font-black text-slate-700 uppercase">{editHallazgo ? `✏️ Editando Hallazgo: ${editHallazgo.ref}` : '➕ DOCUMENTAR DESVIACIÓN'}</h3>
          <form onSubmit={(e) => handleSubmits(e, 'hallazgo')} key={editHallazgo ? `edit-hallazgo-${editHallazgo.id}-${formResetKey}` : `new-hallazgo-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
            <div><label className="font-bold">Código (Manual)</label><input name="ref" defaultValue={editHallazgo?.ref||''} required className="w-full border rounded-lg p-2" /></div>
            <div><label className="font-bold">Sede</label><select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
            <div><label className="font-bold">Proceso Auditado</label><input name="proceso" defaultValue={editHallazgo?.proceso||''} required className="w-full border rounded-lg p-2" /></div>
            <div><label className="font-bold">Severidad</label><select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="w-full border rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
            <div><label className="font-bold">Auditor</label><input name="auditor" defaultValue={editHallazgo?.auditor||''} required className="w-full border rounded-lg p-2" /></div>
            <div><label className="font-bold">Dueño</label><input name="responsable" defaultValue={editHallazgo?.responsable||''} required className="w-full border rounded-lg p-2" /></div>
            <div className="md:col-span-2"><label className="font-bold flex justify-between"><span>Título de la Falla</span><button type="button" onClick={()=>sugerirConIA('hallazgo')} className="text-[9px] bg-purple-100 text-purple-700 px-2 rounded">🤖 IA</button></label><input name="titulo" defaultValue={editHallazgo?.titulo||''} required className="w-full border rounded-lg p-2" /></div>
            <div className="md:col-span-4"><label className="font-bold text-blue-700 block">Enlace Externo de Evidencia</label><input type="url" name="evidenciaUrlInput" defaultValue={editHallazgo?.evidenciaUrl||''} className="w-full border border-blue-200 bg-blue-50/30 rounded-lg p-2" /></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-red-600 text-white font-black uppercase px-6 py-2.5 rounded-xl">Guardar</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]"><tr><th className="p-4">REF / Sede</th><th className="p-4">Proceso</th><th className="p-4 w-1/3">Título E Informes</th><th className="p-4 text-center">Estado</th>{isAdmin && <th className="p-4 text-center">Acción</th>}</tr></thead>
          <tbody className="divide-y">
            {hFiltrados.map(h => (
              <tr key={h.id} className="hover:bg-slate-50">
                <td className="p-4"><div className="font-black text-sm">{h.ref}</div><div className="text-[9px] uppercase mt-0.5">{h.sede}</div></td>
                <td className="p-4 font-bold">{h.proceso}</td>
                <td className="p-4"><div className="font-medium">{h.titulo}</div>{h.evidenciaUrl && <a href={h.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold block mt-1">🔗 Ver Evidencia</a>}</td>
                <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${h.estado==='Cerrado'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{h.estado}</span></td>
                {isAdmin && <td className="p-4 text-center"><button onClick={() => {setEditHallazgo(h); setFormResetKey(Date.now()); scrollToForm();}} className="border px-2 py-1 rounded mx-1">✏️</button><button onClick={() => handleDeleteItem('hallazgos', h.id)} className="border px-2 py-1 rounded text-red-500 mx-1">🗑️</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlanes = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">✅ Planes de Acción Remediales</h2></div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">{editPlan ? `✏️ Editando Avance de Plan` : '➕ Asignar Plan'}</h3>
          <form onSubmit={(e) => handleSubmits(e, 'plan')} key={editPlan ? `edit-plan-${editPlan.id}-${formResetKey}` : `new-plan-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="md:col-span-4"><label className="font-bold">Hallazgo Vinculado</label><select name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} required className="w-full border rounded-lg p-2 bg-white"><option value="">-- Seleccione --</option>{safeHallazgos.map(h => <option key={h.id} value={h.id}>[#HAL-{h.id}] {h.titulo}</option>)}</select></div>
            <div className="md:col-span-2"><label className="font-bold flex justify-between"><span>Acción de Choque</span><button type="button" onClick={()=>sugerirConIA('plan')} className="text-[9px] bg-purple-100 text-purple-700 px-2 rounded">🤖 IA</button></label><input name="accion" defaultValue={editPlan?.accion||''} required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold">Responsable</label><input name="responsable" defaultValue={editPlan?.responsable||''} required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold">Compromiso</label><input name="fecha" type="date" defaultValue={formatSafeDate(editPlan?.fecha)||''} required className="w-full border p-2 rounded" /></div>
            <div className="md:col-span-2"><label className="font-bold text-blue-600">% Avance Real</label><input name="progreso" type="number" min="0" max="100" defaultValue={editPlan?.progreso||0} className="w-full border p-2 bg-blue-50 border-blue-200 rounded" /></div>
            <div className="md:col-span-2"><label className="font-bold text-blue-700">Enlace de Evidencia (Drive)</label><input type="url" name="evidenciaUrlInput" defaultValue={editPlan?.evidenciaUrl||''} className="w-full border border-blue-200 bg-blue-50/30 rounded p-2" /></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold">Guardar Plan</button></div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase"><tr><th className="p-3">Ref Hallazgo</th><th className="p-3">Acción Remedial</th><th className="p-3 w-40">% Avance</th><th className="p-3">Estado</th>{isAdmin && <th className="p-3 text-center">Acción</th>}</tr></thead>
          <tbody className="divide-y">
            {pFiltrados.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="p-3 text-red-600 font-bold">#HAL-{p.idHallazgo}</td>
                <td className="p-3 text-slate-800 font-medium">{p.accion} <span className="text-[10px] text-slate-400 block font-normal mt-1">Límite: {p.fechaVal || p.fecha}</span>{p.evidenciaUrl && <a href={p.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[9px] text-blue-600 font-bold block mt-1">🔗 Evidencia</a>}</td>
                <td className="p-3"><ProgressBar progress={p.progreso || 0} /></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded font-black uppercase text-[9px] ${p.estado === 'Cerrado' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.estado}</span></td>
                {isAdmin && (<td className="p-3 text-center whitespace-nowrap space-x-1"><button onClick={() => {setEditPlan(p); setFormResetKey(Date.now()); scrollToForm();}} className="border px-2 py-1 rounded bg-amber-50">✏️</button><button onClick={() => handleDeleteItem('planes', p.id)} className="border px-2 py-1 rounded bg-red-50">🗑️</button></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderIncidentes = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">🚨 Eventos de Pérdida (COP)</h2></div>
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Registrar Evento de Pérdida</h3>
          <form onSubmit={(e) => handleSubmits(e, 'incidente')} key={editIncidente ? `edit-inc-${editIncidente.id}-${formResetKey}` : `new-inc-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <input name="idRiesgo" defaultValue={editIncidente?.idRiesgo||''} required placeholder="ID Riesgo Vinculado" className="border p-2 rounded" />
            <input name="titulo" defaultValue={editIncidente?.titulo||''} required placeholder="Título del Evento" className="border p-2 rounded md:col-span-2" />
            <select name="impacto" defaultValue={editIncidente?.impacto||'Medio'} className="border p-2 bg-white rounded"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select>
            <input name="costo" type="number" defaultValue={editIncidente?.costo||''} required placeholder="Pérdida Financiera (COP)" className="border p-2 rounded md:col-span-2" />
            <textarea name="descripcion" defaultValue={editIncidente?.descripcion||''} required placeholder="Descripción de la falla..." className="border p-2 rounded md:col-span-4"></textarea>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold">Registrar Evento</button></div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID Riesgo</th><th className="p-3">Descripción</th><th className="p-3">Impacto</th><th className="p-3 text-right">Costo (COP)</th>{isAdmin && <th className="p-3 text-center">Acción</th>}</tr></thead>
          <tbody className="divide-y">
            {incFiltrados.map(i => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="p-3 font-bold">#{i.idRiesgo}</td><td className="p-3"><b>{i.titulo}</b><p className="text-[10px] text-slate-400 mt-0.5">{i.descripcion}</p></td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">{i.impacto}</span></td><td className="p-3 text-right font-mono font-bold text-red-600 notranslate" translate="no">${Number(i.costo || 0).toLocaleString('es-CO')}</td>
                {isAdmin && (<td className="p-3 text-center whitespace-nowrap space-x-1"><button onClick={() => {setEditIncidente(i); setFormResetKey(Date.now()); scrollToForm();}} className="border px-2 py-1 rounded bg-amber-50">✏️</button><button onClick={() => handleDeleteItem('incidentes', i.id)} className="border px-2 py-1 rounded bg-red-50">🗑️</button></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInforme = () => {
    const logs = [...safeRiesgos, ...safeEvaluaciones, ...safeHallazgos, ...safePlanes, ...safeIncidentes].flatMap(item => (item.historialCambios || []).map(log => ({ ...log, ref: item.proceso || item.titulo || `Item: ${item.id}` })));
    return (
      <div className="space-y-6">
        <div className="border-b pb-2 font-black text-lg">📜 Trazabilidad de Auditoría e Historial de Cambios</div>
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b text-[10px] uppercase font-black text-slate-500"><tr><th className="p-3">Fecha y Hora</th><th className="p-3">Módulo afectado</th><th className="p-3">Acción en Base de Datos</th></tr></thead>
            <tbody className="divide-y text-slate-600">
              {logs.map((l, idx) => (
                <tr key={idx} className="hover:bg-slate-50"><td className="p-3 font-mono notranslate" translate="no">{l.fecha || new Date().toLocaleString()}</td><td className="p-3 font-bold text-slate-900">{l.ref}</td><td className="p-3 italic">{l.accion || 'Registro guardado'}</td></tr>
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
            {activeTab === 'config' && renderConfiguracion()}
          </div>
        </main>
      </div>
      
      {notification && (<div className={`fixed bottom-4 right-4 px-6 py-4 rounded-xl shadow-2xl font-bold text-sm z-50 animate-in slide-in-from-bottom-5 ${notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>{notification.message}</div>)}
    </div>
  );
}