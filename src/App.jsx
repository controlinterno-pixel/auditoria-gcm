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
// 🤖 MOTOR IA GEMINI INTEGRADO (Dual: Flash en pruebas / 1.5 Pro en Producción)
// =====================================================================
const apiKey = ""; // Llave inyectada automáticamente por el entorno de Canvas

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
  { id: 1, indicador: 'Intentos de acceso fallidos', proceso: 'TI', valor: 180, limite: 100, tendencia: 'up' },
  { id: 2, indicador: 'Usuarios con privilegios altos', proceso: 'TI', valor: 45, limite: 60, tendencia: 'down' },
  { id: 3, indicador: 'Transacciones inusuales', proceso: 'Finanzas', valor: 78, limite: 80, tendencia: 'flat' },
  { id: 4, indicador: 'Días sin backup', proceso: 'TI', valor: 3, limite: 2, tendencia: 'up' },
  { id: 5, indicador: 'Cambios no autorizados', proceso: 'Operaciones', valor: 5, limite: 10, tendencia: 'down' }
];

// --- COMPONENTES VISUALES ---
const ProgressBar = ({ progress }) => {
  let color = "bg-red-500";
  if (progress >= 40) color = "bg-amber-500";
  if (progress >= 80) color = "bg-emerald-500";
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-bold mb-1">
        <span className="text-slate-500">PROGRESO</span>
        <span className="text-slate-800">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
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

// BUSCADOR Y FILTROS POR COLUMNA
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

// ================= COMPONENTES GRÁFICOS PERSONALIZADOS (ESTILO EJECUTIVO) =================

const ExecutiveKpiCard = ({ icon, title, value, trend, isCurrency, bgClass, iconColorClass }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center space-x-4 shadow-sm relative overflow-hidden">
    {/* Fondo decorativo sutil */}
    <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 ${bgClass.replace('bg-', 'bg-').replace('-50', '-500')}`}></div>
    
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 z-10 ${bgClass} ${iconColorClass}`}>
      {icon}
    </div>
    <div className="z-10 flex-1">
      <h3 className="text-xs font-bold text-slate-500">{title}</h3>
      <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
        {isCurrency ? `$ ${value.toLocaleString('es-CO')}M` : value}
      </p>
      {trend && (
        <div className={`flex items-center space-x-1 text-[10px] font-bold mt-1 ${trend.includes('+') || trend.includes('↑') ? (trend.includes('Críticos')||trend.includes('Pérdidas')||trend.includes('Fuera') ? 'text-red-600' : 'text-emerald-600') : 'text-slate-400'}`}>
          <span>{trend}</span>
          <span className="text-slate-400 font-medium">vs. mes anterior</span>
        </div>
      )}
    </div>
  </div>
);

const CustomDonutChart = ({ data, total }) => {
  let currentOffset = 0;
  return (
    <div className="relative w-48 h-48">
      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full drop-shadow-sm">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const strokeDasharray = `${percentage} ${100 - percentage}`;
          const offset = currentOffset;
          currentOffset -= percentage;
          
          if (item.value === 0) return null;
          
          return (
            <circle
              key={index}
              cx="50" cy="50" r="40"
              fill="transparent"
              stroke={item.color}
              strokeWidth="20"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out cursor-pointer hover:opacity-80"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-slate-800 leading-none">{total}</span>
        <span className="text-[10px] font-bold text-slate-500 uppercase">Total</span>
      </div>
    </div>
  );
};

const SimpleSparkline = ({ trend, color }) => {
  const points = trend === 'up' ? "0,20 10,15 20,25 30,10 40,5" : trend === 'down' ? "0,5 10,10 20,5 30,15 40,20" : "0,15 10,10 20,15 30,10 40,15";
  return (
    <svg width="40" height="25" viewBox="0 0 40 25" className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const SemiCircleGauge = ({ percentage, label, subtext }) => {
  const radius = 80;
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative w-48 h-24 overflow-hidden mb-2">
        <svg viewBox="0 0 200 100" className="w-full h-full drop-shadow-sm">
          {/* Fondo gris */}
          <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" />
          {/* Relleno verde */}
          <path 
            d="M 20 90 A 80 80 0 0 1 180 90" 
            fill="none" 
            stroke="#84cc16" 
            strokeWidth="20" 
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1500 ease-out"
          />
        </svg>
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-black text-slate-800 leading-none">{Math.round(percentage)}%</span>
          <span className="text-sm font-bold text-emerald-600 mt-1">{label}</span>
        </div>
      </div>
      <p className="text-xs text-slate-500 font-medium px-4 mt-4">{subtext}</p>
    </div>
  );
};


// =====================================================================
// APLICACIÓN PRINCIPAL
// =====================================================================

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard_ejecutivo');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('residual'); 
  const [filtroAnio, setFiltroAnio] = useState('Todos');
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

  const FilterInput = ({ colKey, placeholder, dark }) => (
    <input 
      type="text" 
      placeholder={placeholder || "Filtrar..."}
      className={`mt-1.5 w-full text-[9px] px-1.5 py-1 font-normal rounded border focus:outline-none focus:ring-1 ${
        dark 
          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-500' 
          : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:ring-[#2563eb]'
      }`}
      value={columnFilters[colKey] || ''}
      onChange={(e) => handleColFilterChange(colKey, e.target.value)}
      onClick={(e) => e.stopPropagation()} 
    />
  );

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

  // --- IA: ANÁLISIS DE EVIDENCIAS (MODAL) ---
  const analizarEvidenciaIA = async (evidenciaUrl, contextoItem, tipoItem) => {
    setIsThinking(true);
    showNotification("🤖 Extrayendo documento y enviando a Gemini...", "success");

    let finalApiKey = apiKey;
    let modelName = "gemini-2.5-flash-preview-09-2025"; 
    
    if (GEMINI_API_KEY && GEMINI_API_KEY.length > 5) {
      finalApiKey = GEMINI_API_KEY;
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

    // Conexión estricta a los IDs del DOM para que siempre encuentre el campo
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

    let finalApiKey = apiKey;
    let modelName = "gemini-2.5-flash-preview-09-2025"; 
    
    if (GEMINI_API_KEY && GEMINI_API_KEY.length > 5) {
      finalApiKey = GEMINI_API_KEY;
      modelName = "gemini-1.5-pro";
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
        inputDestino.value = sugerencia;
        // Lanzamos eventos para que React registre el cambio
        inputDestino.dispatchEvent(new Event('input', { bubbles: true }));
        inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
        showNotification(`✨ ¡Sugerencia insertada correctamente!`);
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

  const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
  const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };

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

    let apetito = "Aceptable";
    let accion = "Aceptar / Monitorear";
    let color = "bg-green-500 text-white";
    let borderSemaforo = "border-green-600";

    if (score <= 4) {
      color = "bg-green-500 text-white"; borderSemaforo = "border-green-600";
    } else if (score <= 9) {
      color = "bg-yellow-400 text-slate-900"; borderSemaforo = "border-yellow-500"; accion = "Monitorear periódicamente"; apetito = "Monitoreo";
    } else if (score <= 16) {
      color = "bg-orange-500 text-white"; borderSemaforo = "border-orange-600"; apetito = "Fuera de Apetito"; accion = "Mitigar / Ajustar Controles";
    } else {
      color = "bg-red-600 text-white"; borderSemaforo = "border-red-700"; apetito = "Crítico"; accion = "Evitar / Escalar";
    }
    return { score, apetito, accion, color, borderSemaforo };
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
        indicador: formData.get('indicador'),
        proceso: formData.get('proceso'),
        valor: parseInt(formData.get('valor') || 0),
        limite: parseInt(formData.get('limite') || 0),
        tendencia: formData.get('tendencia')
      };
      updatedList = safeMonitoreo.map(m => m.id === editMonitoreo.id ? modificado : m);
      setEditMonitoreo(null);
      showNotification("KRI actualizado exitosamente.");
    } else {
      const nuevo = {
        id: safeMonitoreo.length ? Math.max(...safeMonitoreo.map(m => m.id)) + 1 : 1,
        indicador: formData.get('indicador'),
        proceso: formData.get('proceso'),
        valor: parseInt(formData.get('valor') || 0),
        limite: parseInt(formData.get('limite') || 0),
        tendencia: formData.get('tendencia')
      };
      updatedList = [...safeMonitoreo, nuevo];
      setEditMonitoreo(null);
      showNotification("Nuevo KRI agregado.");
    }
    setMonitoreo(updatedList);
    await saveToCloud({ monitoreo: updatedList });
    e.target.reset();
  };

  // ==================== RENDERS DE VISTAS (ADMIN) ====================

  // NUEVO: DASHBOARD EJECUTIVO (ESTILO SERVICENOW/ARCHER)
  const renderDashboardEjecutivo = () => {
    // 1. Cálculos de KPIs
    const totalRiesgos = safeRiesgos.length;
    const riesgosFueraApetitoList = safeRiesgos.filter(r => {
      const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
      return res.score > 9; // Fuera de Apetito o Crítico
    });
    const riesgosFueraApetitoCount = riesgosFueraApetitoList.length;
    const perdidasTotales = safeIncidentes.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);
    const hallazgosCriticos = safeHallazgos.filter(h => h.severidad === 'Crítico' || h.severidad === 'Alto').length;
    const planesVencidos = safePlanes.filter(p => {
      const hoy = new Date().toISOString().split('T')[0];
      const fechaPlan = formatSafeDate(p.fecha);
      return fechaPlan && fechaPlan < hoy && p.estado !== 'Cerrado';
    }).length;
    const controlesIneficaces = safeEvaluaciones.filter(e => e.calificacion < 100).length;

    // 2. Datos para Gráfico de Dona
    const donutDataMap = { Aceptable: 0, Monitoreo: 0, 'Fuera de Apetito': 0, Crítico: 0 };
    safeRiesgos.forEach(r => {
      const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
      if (res.score <= 4) donutDataMap.Aceptable++;
      else if (res.score <= 9) donutDataMap.Monitoreo++;
      else if (res.score <= 16) donutDataMap['Fuera de Apetito']++;
      else donutDataMap.Crítico++;
    });
    const donutData = [
      { label: 'Aceptable', value: donutDataMap.Aceptable, color: '#22c55e' },
      { label: 'Monitoreo', value: donutDataMap.Monitoreo, color: '#eab308' },
      { label: 'Fuera de Apetito', value: donutDataMap['Fuera de Apetito'], color: '#f97316' },
      { label: 'Crítico', value: donutDataMap.Crítico, color: '#ef4444' },
    ];

    // 3. Cálculos Nivel de Madurez (Gauge)
    // Ejemplo de cálculo: Peso 40% a controles eficaces, 40% a planes cerrados, 20% a riesgos en apetito
    const pctControles = safeEvaluaciones.length ? (safeEvaluaciones.filter(e => e.calificacion === 100).length / safeEvaluaciones.length) * 100 : 100;
    const pctPlanes = safePlanes.length ? (safePlanes.filter(p => p.estado === 'Cerrado').length / safePlanes.length) * 100 : 100;
    const pctApetito = safeRiesgos.length ? ((totalRiesgos - riesgosFueraApetitoCount) / totalRiesgos) * 100 : 100;
    const nivelMadurez = (pctControles * 0.4) + (pctPlanes * 0.4) + (pctApetito * 0.2);
    const etiquetaMadurez = nivelMadurez >= 80 ? 'Gestionado' : nivelMadurez >= 60 ? 'En Desarrollo' : 'Deficiente';

    // 4. Mapa de Calor Data
    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];
    const contarCelda = (imp, prob) => safeRiesgos.filter(r => r.impactoResidual === imp && r.probabilidadResidual === prob).length;

    // 5. Próximas Actividades (Mock/Calculadas)
    const actividades = safePlanes.filter(p => p.estado !== 'Cerrado').sort((a,b) => new Date(formatSafeDate(a.fecha)) - new Date(formatSafeDate(b.fecha))).slice(0,4);

    return (
      <div className="space-y-6 animate-in fade-in duration-500 bg-[#f8fafc] p-2 min-h-full">
        
        {/* HEADER DASHBOARD */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-2">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Ejecutivo</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Visión general del estado de riesgos de la organización</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 flex items-center space-x-2 shadow-sm">
              <span>Periodo:</span>
              <select className="bg-transparent border-none outline-none font-black text-slate-800 cursor-pointer">
                <option>Mayo 2026</option>
                <option>Abril 2026</option>
                <option>Histórico</option>
              </select>
              <span>📅</span>
            </div>
          </div>
        </div>

        {/* TOP KPIs GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <ExecutiveKpiCard icon="🛡️" title="Riesgos Totales" value={totalRiesgos} trend="↑ 2 vs. mes anterior" bgClass="bg-blue-50 text-blue-600" />
          <ExecutiveKpiCard icon="⚠️" title="Fuera de Apetito" value={riesgosFueraApetitoCount} trend="↑ 1 vs. mes anterior" bgClass="bg-red-50 text-red-600" />
          <ExecutiveKpiCard icon="💰" title="Pérdidas Materializadas" value={perdidasTotales} isCurrency trend="↑ 5% vs. mes anterior" bgClass="bg-amber-50 text-amber-600" />
          <ExecutiveKpiCard icon="🚩" title="Hallazgos Críticos" value={hallazgosCriticos} trend="→ Sin cambios" bgClass="bg-purple-50 text-purple-600" />
          <ExecutiveKpiCard icon="⏳" title="Planes Vencidos" value={planesVencidos} trend="↓ 1 vs. mes anterior" bgClass="bg-teal-50 text-teal-600" />
          <ExecutiveKpiCard icon="❌" title="Controles Ineficaces" value={controlesIneficaces} trend="↑ 2 vs. mes anterior" bgClass="bg-rose-50 text-rose-600" />
        </div>

        {/* MIDDLE SECTION (Donut, Heatmap, List) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Dona de Apetito */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
            <h3 className="font-bold text-slate-800 mb-6">Riesgos por Nivel de Apetito</h3>
            <div className="flex-1 flex items-center justify-center space-x-8">
              <CustomDonutChart data={donutData} total={totalRiesgos} />
              <div className="space-y-4">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                    <div>
                      <div className="text-xs font-bold text-slate-700">{d.label}</div>
                      <div className="text-[10px] text-slate-500">{d.value} ({totalRiesgos ? Math.round((d.value/totalRiesgos)*100) : 0}%)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mapa de Calor Clásico */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800">Mapa de Calor de Riesgos (Residual)</h3>
              <select value={tipoMatriz} onChange={(e) => setTipoMatriz(e.target.value)} className="text-[10px] bg-slate-50 border rounded px-2 py-1 font-bold">
                <option value="inherente">Inherente</option>
                <option value="residual">Residual</option>
              </select>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1 w-full max-w-[280px] relative">
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Impacto</div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Probabilidad</div>
                
                <div></div>
                {probabilidades.map((p, index) => <div key={`th-${index}`} className="text-center pb-1 text-slate-500 font-bold text-[8px] uppercase">{p}</div>)}
                
                {impactos.map((imp, impIndex) => (
                  <React.Fragment key={`tr-${impIndex}`}>
                    <div className="flex items-center justify-end pr-2 text-slate-500 font-bold text-[8px] uppercase">{imp}</div>
                    {probabilidades.map((prob, probIndex) => {
                      const count = tipoMatriz === 'residual' ? contarCelda(imp, prob) : safeRiesgos.filter(r => r.impactoInherente === imp && r.probabilidadInherente === prob).length;
                      const { color } = calcularMatriz5x5(prob, imp);
                      // Traducir colores a opacidades sólidas para el heatmap clásico
                      let solidColor = '#22c55e'; // default green
                      if (color.includes('yellow')) solidColor = '#facc15';
                      if (color.includes('orange')) solidColor = '#f97316';
                      if (color.includes('red')) solidColor = '#ef4444';

                      return (
                        <div key={`td-${impIndex}-${probIndex}`} 
                             className="h-14 flex items-center justify-center text-white font-black text-sm transition-transform hover:scale-105 cursor-pointer shadow-sm"
                             style={{ backgroundColor: solidColor }}>
                          {count > 0 ? count : ''}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Lista Top Riesgos */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[380px]">
            <h3 className="font-bold text-slate-800 mb-4">Top Riesgos Fuera de Apetito</h3>
            <div className="flex-1 overflow-y-auto pr-2">
              <table className="w-full text-xs text-left">
                <thead className="text-[9px] text-slate-400 uppercase tracking-widest border-b">
                  <tr><th className="pb-2 font-medium">Proceso / Riesgo</th><th className="pb-2 text-center font-medium">Score</th><th className="pb-2 font-medium">Acción</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {riesgosFueraApetitoList.sort((a,b) => calcularMatriz5x5(b.probabilidadResidual, b.impactoResidual).score - calcularMatriz5x5(a.probabilidadResidual, a.impactoResidual).score).slice(0,5).map(r => {
                    const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="font-bold text-slate-800 truncate w-32" title={r.descripcion}>{r.proceso}</div>
                          <div className="text-[9px] text-slate-500">{r.categoria}</div>
                        </td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-black text-white ${res.color.split(' ')[0]}`}>{res.score}</span>
                        </td>
                        <td className="py-3">
                          <span className="text-[9px] font-bold text-red-600 uppercase">Mitigar</span>
                        </td>
                      </tr>
                    );
                  })}
                  {riesgosFueraApetitoList.length === 0 && <tr><td colSpan="3" className="py-4 text-center text-slate-400 italic">No hay riesgos fuera de apetito.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION (KRIs, Madurez, Actividades) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
          
          {/* Tabla de KRIs */}
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">KRIs - Indicadores Clave</h3>
              {isAdmin && <button onClick={() => {setActiveTab('plan_anual'); setTimeout(() => document.getElementById('seccion-monitoreo')?.scrollIntoView(), 100)}} className="text-xs text-blue-600 font-bold">Gestionar &rarr;</button>}
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[9px] text-slate-400 uppercase tracking-widest border-b">
                  <tr><th className="pb-2 font-medium">Indicador</th><th className="pb-2 text-center font-medium">Valor</th><th className="pb-2 text-center font-medium">Estado</th><th className="pb-2 text-center font-medium">Tendencia</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safeMonitoreo.map(m => {
                    const excedido = m.valor > m.limite;
                    const alerta = m.valor === m.limite || m.valor === m.limite - 1;
                    let estadoObj = excedido ? { text: 'Excedido', color: 'bg-red-100 text-red-700' } : alerta ? { text: 'Alerta', color: 'bg-amber-100 text-amber-700' } : { text: 'Normal', color: 'bg-emerald-100 text-emerald-700' };
                    let trendColor = m.tendencia === 'up' && m.limite ? (excedido ? '#ef4444' : '#f59e0b') : m.tendencia === 'down' ? '#10b981' : '#94a3b8';
                    
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3">
                          <div className="font-bold text-slate-700 truncate w-32" title={m.indicador}>{m.indicador}</div>
                          <div className="text-[9px] text-slate-400">{m.proceso}</div>
                        </td>
                        <td className="py-3 text-center font-mono font-black text-slate-800">{m.valor}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${estadoObj.color}`}>{estadoObj.text}</span>
                        </td>
                        <td className="py-3 flex justify-center">
                          <SimpleSparkline trend={m.tendencia} color={trendColor} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nivel de Madurez Gauge */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-[350px]">
            <h3 className="font-bold text-slate-800 mb-6 w-full text-left">Nivel de Madurez (SGR)</h3>
            <SemiCircleGauge percentage={nivelMadurez} label={etiquetaMadurez} subtext="La gestión de riesgos está integrada en los procesos y se monitorea continuamente. Refleja eficacia de controles y avance de planes." />
          </div>

          {/* Próximas Actividades */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[350px]">
            <h3 className="font-bold text-slate-800 mb-4">Actividades Próximas (Planes)</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {actividades.length === 0 ? (
                 <p className="text-sm text-slate-400 italic text-center mt-10">No hay planes de acción pendientes.</p>
              ) : (
                actividades.map((p, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="mt-1 text-slate-400"><i className="fa-regular fa-calendar-check"></i></div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-700 line-clamp-2" title={p.accion}>{p.accion}</div>
                      <div className="text-[10px] text-slate-500 flex justify-between mt-1">
                        <span>Resp: {p.responsable.split(' ')[0]}</span>
                        <span className={`font-black ${new Date(formatSafeDate(p.fecha)) < new Date() ? 'text-red-500' : 'text-blue-600'}`}>{formatSafeDate(p.fecha)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {isAdmin && <button onClick={() => setActiveTab('planes')} className="text-xs text-blue-600 font-bold mt-4 w-full text-left border-t pt-3">Ver calendario completo &rarr;</button>}
          </div>

        </div>

      </div>
    );
  };

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
                  <div className="text-[9px] uppercase tracking-widest font-bold opacity-80">Cumplimiento Global</div>
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
                            <span className={`text-xs font-black ${m.valor > m.limite ? 'text-red-600' : 'text-emerald-600'}`}>{m.valor} <span className="text-[8px] text-slate-400 font-medium">/ {m.limite}</span></span>
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
                             <FilterInput colKey="codigo" placeholder="ID..." />
                           </th>
                           <th className="p-3 w-24">
                             <div>Periodo</div>
                             <FilterInput colKey="periodo" />
                           </th>
                           <th className="p-3 w-48">
                             <div>Área / Proceso</div>
                             <FilterInput colKey="proceso" />
                           </th>
                           <th className="p-3">
                             <div>Enfoque Técnico y Alcance</div>
                             <FilterInput colKey="enfoque" />
                           </th>
                           <th className="p-3 text-center">Cumpl.</th>
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
              <div className="md:col-span-2"><label className="font-bold text-gray-600 block mb-1">% de Cumplimiento (0-100)</label><input type="number" min="0" max="100" name="cumplimiento" defaultValue={editCronograma?.cumplimiento||0} required className="w-full border rounded-lg p-2" /></div>
              
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
                     <FilterInput colKey="codigo" placeholder="ID..." />
                   </th>
                   <th className="border border-slate-300 p-2 w-48">
                     <div>Proceso Auditable</div>
                     <FilterInput colKey="proceso" />
                   </th>
                   <th className="border border-slate-300 p-2 w-32">
                     <div>Responsable</div>
                     <FilterInput colKey="responsable" />
                   </th>
                   <th className="border border-slate-300 p-2 w-32">
                     <div>Apoyo</div>
                     <FilterInput colKey="apoyo" />
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
                    <FilterInput colKey="proceso" />
                  </th>
                  <th className="p-4 text-center">
                    <div>Score (KRI)</div>
                    <FilterInput colKey="kriScore" placeholder="Score..." />
                  </th>
                  <th className="p-4 w-1/3">Consumo de Capacidad Financiera (Eventos)</th>
                  <th className="p-4 text-center">
                    <div>Diagnóstico COSO</div>
                    <FilterInput colKey="zonaVal" placeholder="Estado..." />
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
                    <FilterInput colKey="id" placeholder="ID..." dark />
                  </th>
                  <th className="p-3 w-48">
                    <div>Proceso / Riesgo / Normativa</div>
                    <FilterInput colKey="proceso" dark />
                  </th>
                  <th className="p-3 w-48">
                    <div>Responsable / Control</div>
                    <FilterInput colKey="responsable" dark />
                  </th>
                  <th className="p-3 text-center">
                    <div>Score Inh</div>
                    <FilterInput colKey="scoreInhVal" placeholder="Puntos..." dark />
                  </th>
                  <th className="p-3 text-center">
                    <div>Score Res</div>
                    <FilterInput colKey="scoreResVal" placeholder="Puntos..." dark />
                  </th>
                  <th className="p-3">
                    <div>Apetito</div>
                    <FilterInput colKey="apetitoVal" placeholder="Estado..." dark />
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
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${r.apetitoVal === "Aceptable" ? 'bg-green-100 text-green-800' : r.apetitoVal === "Monitoreo" ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{r.apetitoVal}</span></td>
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
                  <FilterInput colKey="id" placeholder="ID..." dark />
                </th>
                <th className="p-3">
                  <div>Fecha / Autor</div>
                  <FilterInput colKey="auditor" placeholder="Autor..." dark />
                </th>
                <th className="p-3">
                  <div>Diseño/Operación</div>
                  <FilterInput colKey="diseno" placeholder="Filtrar..." dark />
                </th>
                <th className="p-3">
                  <div>Eficacia</div>
                  <FilterInput colKey="calificacion" placeholder="%" dark />
                </th>
                <th className="p-3">
                  <div>Comentarios / Anexos</div>
                  <FilterInput colKey="comentarios" dark />
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
                  <FilterInput colKey="ref" placeholder="ID..." />
                </th>
                <th className="p-4">
                  <div>Proceso</div>
                  <FilterInput colKey="proceso" />
                </th>
                <th className="p-4 w-1/3">
                  <div>Título e Informes</div>
                  <FilterInput colKey="titulo" />
                </th>
                <th className="p-4">
                  <div>Responsables</div>
                  <FilterInput colKey="responsable" placeholder="Responsable..." />
                </th>
                <th className="p-4 text-center">
                  <div>Estado / Gestión</div>
                  <FilterInput colKey="estado" placeholder="Estado..." />
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
              <div><label className="font-bold text-blue-600">% de Avance Físico</label><input type="number" min="0" max="100" name="progreso" defaultValue={editPlan?.progreso||0} required className="w-full border-2 border-blue-200 bg-blue-50 rounded-lg p-2 mt-1" /></div>
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
                  <FilterInput colKey="id" placeholder="ID..." dark />
                </th>
                <th className="p-3">
                  <div>Hallazgo</div>
                  <FilterInput colKey="idHallazgo" placeholder="Ref..." dark />
                </th>
                <th className="p-3">
                  <div>Acción y Evidencias</div>
                  <FilterInput colKey="accion" dark />
                </th>
                <th className="p-3">
                  <div>Compromiso</div>
                  <FilterInput colKey="fechaVal" placeholder="Fecha..." dark />
                </th>
                <th className="p-3 w-40">Avance</th>
                <th className="p-3">
                  <div>Estado</div>
                  <FilterInput colKey="estado" placeholder="Estado..." dark />
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
                <FilterInput colKey="id" placeholder="ID..." dark />
              </th>
              <th className="p-3">
                <div>Riesgo</div>
                <FilterInput colKey="idRiesgo" placeholder="ID Riesgo..." dark />
              </th>
              <th className="p-3 w-1/3">
                <div>Título / Desc</div>
                <FilterInput colKey="titulo" dark />
              </th>
              <th className="p-3">
                <div>Impacto</div>
                <FilterInput colKey="impacto" dark />
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
                    <FilterInput colKey="fechaVal" />
                  </th>
                  <th className="p-4 w-32">
                    <div>Módulo</div>
                    <FilterInput colKey="modulo" />
                  </th>
                  <th className="p-4">
                    <div>Acción Realizada</div>
                    <FilterInput colKey="accion" />
                  </th>
                  <th className="p-4 w-64">
                    <div>Referencia</div>
                    <FilterInput colKey="desc" />
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
        <header className="bg-[#0f172a] text-white p-6 shadow-md flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black tracking-widest uppercase flex items-center space-x-2"><span>🛡️</span> <span>Termales GRC</span></h1>
            <p className="text-xs text-blue-400 font-bold mt-1">Portal de Autoevaluación de Procesos (1ra Línea)</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full border border-slate-700">👤 {user.email}</span>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors">Cerrar Sesión</button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-black text-slate-800 mb-2">¡Bienvenido a su Panel de Control!</h2>
            <p className="text-sm text-slate-600">Como dueño de proceso, usted es responsable de certificar que los controles operan correctamente y de mantener actualizados sus planes de acción.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Módulo de Autoevaluación RCSA */}
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

            {/* Módulo de Actualización de Planes */}
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
                    <label className="font-bold text-slate-700 block mb-1">¿Qué porcentaje de avance real tiene hoy?</label>
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

  // CÁLCULO GAUGE SIDEBAR
  const pctControlesSidebar = safeEvaluaciones.length ? (safeEvaluaciones.filter(e => e.calificacion === 100).length / safeEvaluaciones.length) * 100 : 100;
  const pctPlanesSidebar = safePlanes.length ? (safePlanes.filter(p => p.estado === 'Cerrado').length / safePlanes.length) * 100 : 100;
  const madurezSidebar = (pctControlesSidebar * 0.5) + (pctPlanesSidebar * 0.5);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      
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

      {/* SIDEBAR ESTILO EJECUTIVO */}
      <div className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800/50">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <span className="text-lg font-black">🛡️</span>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wide text-white">SGR Termales</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Gestión de Riesgos</p>
          </div>
        </div>
        
        <div className="px-6 py-4 border-b border-slate-800/50 flex items-center space-x-3 cursor-pointer hover:bg-slate-800/30 transition-colors">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">{user.email.substring(0,2)}</div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-white truncate">{user.email.split('@')[0]}</div>
            <div className="text-[9px] text-slate-400">Auditor Administrador</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-[11px] font-bold overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard_ejecutivo', icon: '🏠', label: 'Dashboard Ejecutivo' },
            { id: 'riesgos', icon: '⚠️', label: 'Matriz de Riesgos' },
            { id: 'plan_anual', icon: '🗓️', label: 'Plan de Auditoría' },
            { id: 'evaluaciones', icon: '🔬', label: 'Eval. Controles' },
            { id: 'hallazgos', icon: '🚩', label: 'Hallazgos' },
            { id: 'planes', icon: '✅', label: 'Planes de Acción' },
            { id: 'incidentes', icon: '💰', label: 'Pérdidas Reales' },
            { id: 'apetito', icon: '⚖️', label: 'Config. COSO' },
            { id: 'informe', icon: '📜', label: 'Trazabilidad' }
          ].map((tab, index) => (
            <button 
              key={`nav-${tab.id}-${index}`} 
              onClick={() => setActiveTab(tab.id)} 
              className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center space-x-3 transition-all ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-400 font-black' : 'hover:bg-slate-800/50 hover:text-white'}`}
            >
              <span className={`text-sm ${activeTab === tab.id ? '' : 'opacity-70'}`}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* WIDGET MADUREZ SIDEBAR */}
        <div className="mx-4 mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
           <div className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-2">Nivel de Madurez</div>
           <div className="flex items-end justify-between">
              <div>
                 <div className={`text-xl font-black ${madurezSidebar >= 80 ? 'text-emerald-400' : madurezSidebar >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(madurezSidebar)}%</div>
                 <div className="text-[10px] text-slate-300 mt-0.5">{madurezSidebar >= 80 ? 'Gestionado' : 'En Desarrollo'}</div>
              </div>
              <button onClick={() => setActiveTab('dashboard_ejecutivo')} className="text-[10px] text-blue-400 hover:text-blue-300">Ver &rarr;</button>
           </div>
           <div className="w-full bg-slate-700 h-1 mt-3 rounded-full overflow-hidden">
              <div className={`h-full ${madurezSidebar >= 80 ? 'bg-emerald-400' : madurezSidebar >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${madurezSidebar}%`}}></div>
           </div>
        </div>

        <div className="p-4 border-t border-slate-800/50">
          <button onClick={handleLogout} className="w-full text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg py-2 font-bold flex items-center justify-center space-x-2 transition-colors">
            <span>🚪</span> <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <main className="flex-grow overflow-y-auto p-8 relative">
          <div className="max-w-[1400px] mx-auto">
            {activeTab === 'dashboard_ejecutivo' && renderDashboardEjecutivo()}
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