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
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// =====================================================================
// 🤖 CONEXIÓN SEGURA A GEMINI PRO (Inyectada desde Vercel / .env)
// =====================================================================
let GEMINI_API_KEY = "";
try {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  }
} catch (error) {
  console.warn("Entorno simulado: variables de Vercel no detectadas.");
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

// --- CONTROL DE ACCESO ---
const ADMIN_EMAILS = [
  "controlinterno@termales.com.co",
  "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co",
  "analista.controlinterno@termales.com.co"
];

// --- DATOS POR DEFECTO ---
const defaultRiesgos = [
  { id: 98, sede: 'Hotel', categoria: 'Operativo', proceso: 'Alimentos y bebidas', normativa: 'Norma Técnica de Salubridad', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Afectación del sabor e higiene de alimentos por uso de insumos cárnicos de baja calidad.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío diaria e inspección organoléptica al recibir insumos.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe de Alimentos y Bebidas', anio: 2025, mes: 'Mayo', historialCambios: [] },
  { id: 186, sede: 'Administrativo', categoria: 'Estratégico', proceso: 'Gestión Estratégica', normativa: 'Estatuto Tributario (DIAN)', tipoRiesgo: 'Legal y Regulatorio', afectacion: 'Económica', causaInmediata: 'Cambios normativos tributarios', causaRaiz: 'Falta de comité legal interno', descripcion: 'Sanciones o pérdidas financieras por errores en la declaración de impuestos hoteleros.', probabilidadInherente: 'Rara', impactoInherente: 'Medio', noControl: 'C-186', descripcionControl: 'Revisión y auditoría externa por firma contable cada trimestre.', probabilidadResidual: 'Rara', impactoResidual: 'Bajo', responsable: 'Gerente Financiero', anio: 2025, mes: 'Mayo', historialCambios: [] },
  { id: 201, sede: 'Ecoparque', categoria: 'Tecnológico', proceso: 'Infraestructura TI', normativa: 'Ley 1581 Protección de Datos', tipoRiesgo: 'Ciberseguridad', afectacion: 'Operacional', causaInmediata: 'Falta de parches de seguridad', causaRaiz: 'Obsolescencia de servidores locales', descripcion: 'Intrusión de ransomware que paralice el sistema hotelero de reservas.', probabilidadInherente: 'Posible', impactoInherente: 'Crítico', noControl: 'C-201', descripcionControl: 'Firewall activo con logs y copias de seguridad semanales inmutables.', probabilidadResidual: 'Posible', impactoResidual: 'Alto', responsable: 'CISO / Director de TI', anio: 2026, mes: 'Junio', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, sede: 'Ecoparque', ref: 'Aud. Interna TI-2026', titulo: 'Acceso de usuarios genéricos a la base de datos del ERP.', proceso: 'Sistemas', responsable: 'Jefe de TI', auditor: 'Auditoría TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', anio: 2026, mes: 'Junio', historialCambios: [] },
  { id: 2, sede: 'Hotel', ref: 'Aud. Op-2025', titulo: 'Ausencia de actas de capacitación en higiene de alimentos.', proceso: 'Alimentos y bebidas', responsable: 'Jefe de A&B', auditor: 'Control Interno', severidad: 'Medio', idRiesgo: 98, estado: 'Cerrado', fecha: '2025-11-15', anio: 2025, mes: 'Noviembre', historialCambios: [] }
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

const defaultCronograma = [
  { id: 1, codigo: '01', periodo: 'Enero - Febrero', proceso: 'Operaciones Alojamiento y recreación.', enfoque: 'Hotel/Ecoparque (Rentabilidad AyB), Inventarios, Auditoria Locativa e Infraestructura, Calidad, Taquilla, Manillas, Estandarización de procesos y alimentación.', cumplimiento: 100, responsable: 'Todos', apoyo: '', meses: ['Enero', 'Febrero'] },
  { id: 2, codigo: '02', periodo: 'Marzo - Abril', proceso: 'Servicio al cliente', enfoque: 'Hotel/Ecoparque Análisis de Quejas y Reclamos, Verificación de efectividad de planes de acción y auditoría de raíz de las cosas.', cumplimiento: 80, responsable: 'Angelica F. Hernandez', apoyo: 'Yehison J Pineda', meses: ['Marzo', 'Abril'] },
  { id: 3, codigo: '03', periodo: 'Marzo - Abril', proceso: 'Cartera (Notas Crédito y Descuentos)', enfoque: 'Verificación del comportamiento de NC en los procesos que generan estos documentos en la operación, análisis de cumplimiento de procedimientos y trazabilidad.', cumplimiento: 100, responsable: 'Luz Angela Chico T.', apoyo: 'Yehison J Pineda', meses: ['Marzo', 'Abril'] }
];

const defaultMonitoreo = [
  { id: 1, indicador: 'ARQUEOS DE CAJA', valor: 117, limite: 120, tendencia: 'up', proceso: 'Finanzas' },
  { id: 2, indicador: 'INVENTARIO MANILLAS', valor: 16, limite: 20, tendencia: 'down', proceso: 'Operaciones' },
  { id: 3, indicador: 'NOTAS CRÉDITO (AUDIT)', valor: 4, limite: 10, tendencia: 'flat', proceso: 'Auditoría' }
];

// =====================================================================
// 🛠️ FUNCIONES GLOBALES, CÁLCULOS Y FILTROS
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
  if (dateStr) return Number(getYearFromDate(dateStr)) || 2026;
  return 2026;
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
    <p className="text-[10px] font-bold text-slate-500">{sublabel}</p>
  </div>
);

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

export default function App() {
  const [activeTab, setActiveTab] = useState('tablero');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('residual'); 
  
  // --- SELECCIÓN MÚLTIPLE DE FECHAS ACTIVADA ---
  const [selectedAnios, setSelectedAnios] = useState([2025, 2026]);
  const [selectedMeses, setSelectedMeses] = useState(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]);

  const [searchTerm, setSearchTerm] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [filtroHeatMap, setFiltroHeatMap] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [aiModal, setAiModal] = useState(null);

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
  const [editCronograma, setEditCronograma] = useState(null);
  const [editApetito, setEditApetito] = useState(null); 

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

  const toggleAnio = (anio) => {
    setSelectedAnios(prev => prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]);
  };
  
  const toggleMes = (mes) => {
    setSelectedMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);
  };

  const handleColFilterChange = (key, value) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
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
      } else {
        setDoc(docRef, { riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, cronograma: defaultCronograma, monitoreo: defaultMonitoreo });
      }
      setIsCloudLoaded(true);
    });
  }, [user]);

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
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // --- IA CONEXIÓN ---
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
      Se acaba de adjuntar un archivo de evidencia (Foto o PDF) para el siguiente ${tipoItem}: "${contextoItem}".
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

  // --- FILTRADO DE COMPONENTES MULTI-SELECT ---
  const rFiltrados = useMemo(() => {
    return safeRiesgos.filter(r => {
      const a = getItemAnio(r); const m = getItemMesText(r);
      return selectedAnios.includes(a) && selectedMeses.includes(m);
    });
  }, [safeRiesgos, selectedAnios, selectedMeses]);

  const hFiltrados = useMemo(() => {
    return safeHallazgos.filter(h => {
      const a = getItemAnio(h); const m = getItemMesText(h);
      return selectedAnios.includes(a) && selectedMeses.includes(m);
    });
  }, [safeHallazgos, selectedAnios, selectedMeses]);

  const pFiltrados = useMemo(() => {
    return safePlanes.filter(p => {
      const a = getItemAnio(p); const m = getItemMesText(p);
      return selectedAnios.includes(a) && selectedMeses.includes(m);
    });
  }, [safePlanes, selectedAnios, selectedMeses]);

  const incFiltrados = useMemo(() => {
    return safeIncidentes.filter(i => {
      const a = getItemAnio(i); const m = getItemMesText(i);
      return selectedAnios.includes(a) && selectedMeses.includes(m);
    });
  }, [safeIncidentes, selectedAnios, selectedMeses]);

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
    if (safeEvaluaciones.length === 0) return 0;
    return (safeEvaluaciones.filter(e => e.calificacion === 100).length / safeEvaluaciones.length) * 100;
  }, [safeEvaluaciones]);

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
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    
    const archivo = formData.get('evidenciaArchivo');
    let evidenciaUrlOut = editPlan?.evidenciaUrl || '';

    if (archivo && archivo.size > 0) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `evidencias/planes/${Date.now()}_${archivo.name}`);
        await uploadBytes(fileRef, archivo);
        evidenciaUrlOut = await getDownloadURL(fileRef);
        showNotification("Evidencia cargada a la nube.", "success");
      } catch (error) {
        showNotification("Error al adjuntar el archivo.", "error");
      }
      setIsUploading(false);
    }

    let updated; const progreso = parseInt(formData.get('progreso')||0); const estado = progreso === 100 ? 'Cerrado' : 'En Proceso';
    if (editPlan) {
      const mod = { ...editPlan, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso, estado, evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editPlan.historialCambios || []), { fecha: ts, accion: 'Actualizado' }] };
      updated = safePlanes.map(p => p.id === editPlan.id ? mod : p); setEditPlan(null);
    } else {
      const nuevo = { id: Date.now(), idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso, estado, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: ts, accion: 'Asignado' }] };
      updated = [nuevo, ...safePlanes];
    }
    setPlanes(updated); await saveToCloud({ planes: updated }); e.target.reset(); showNotification("Plan remedial registrado.");
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const calif = (formData.get('diseno') === 'Eficaz' && formData.get('ejecucion') === 'Eficaz') ? 100 : 0;
    const ts = new Date().toLocaleString();
    
    const archivo = formData.get('evidenciaArchivo');
    let evidenciaUrlOut = editEvaluacion?.evidenciaUrl || '';

    if (archivo && archivo.size > 0) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `evidencias/evaluaciones/${Date.now()}_${archivo.name}`);
        await uploadBytes(fileRef, archivo);
        evidenciaUrlOut = await getDownloadURL(fileRef);
        showNotification("Evidencia cargada a la nube.", "success");
      } catch (error) {
        showNotification("Error al adjuntar el archivo.", "error");
      }
      setIsUploading(false);
    }

    let updated;
    if (editEvaluacion) {
      const mod = { ...editEvaluacion, idRiesgo: parseInt(formData.get('idRiesgo')), diseño: formData.get('diseno'), ejecucion: formData.get('ejecucion'), calificacion: calif, comentarios: formData.get('comentarios'), evidenciaUrl: evidenciaUrlOut };
      updated = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? mod : ev);
      setEditEvaluacion(null);
    } else {
      const nuevo = { id: Date.now(), idRiesgo: parseInt(formData.get('idRiesgo')), fecha: new Date().toISOString().split('T')[0], diseño: formData.get('diseno'), ejecucion: formData.get('ejecucion'), calificacion: calif, comentarios: formData.get('comentarios'), auditor: user.email, anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [] };
      updated = [nuevo, ...safeEvaluaciones];
    }
    setEvaluaciones(updated); await saveToCloud({ evaluaciones: updated }); e.target.reset(); showNotification("Test guardado.");
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    const ts = new Date().toLocaleString();
    
    const archivo = formData.get('evidenciaArchivo');
    let evidenciaUrlOut = editHallazgo?.evidenciaUrl || '';

    if (archivo && archivo.size > 0) {
      setIsUploading(true);
      try {
        const fileRef = ref(storage, `evidencias/hallazgos/${Date.now()}_${archivo.name}`);
        await uploadBytes(fileRef, archivo);
        evidenciaUrlOut = await getDownloadURL(fileRef);
        showNotification("Evidencia cargada a la nube.", "success");
      } catch (error) {
        showNotification("Error al adjuntar el archivo.", "error");
      }
      setIsUploading(false);
    }

    let updated;
    if (editHallazgo) {
      const mod = { ...editHallazgo, sede: formData.get('sede'), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), auditor: formData.get('auditor'), titulo: formData.get('titulo'), severidad: formData.get('severidad'), evidenciaUrl: evidenciaUrlOut };
      updated = safeHallazgos.map(h => h.id === editHallazgo.id ? mod : h);
      setEditHallazgo(null);
    } else {
      const nuevo = { id: Date.now(), sede: formData.get('sede'), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), auditor: formData.get('auditor'), titulo: formData.get('titulo'), severidad: formData.get('severidad'), estado: 'Abierto', fecha: new Date().toISOString().split('T')[0], anio: 2026, mes: "Junio", evidenciaUrl: evidenciaUrlOut, historialCambios: [] };
      updated = [nuevo, ...safeHallazgos];
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
      updated = [nuevo, ...safeIncidentes];
    }
    setIncidentes(updated); await saveToCloud({ incidentes: updated }); e.target.reset(); showNotification("Evento registrado.");
  };

  const handleCronogramaSubmit = async (e) => {
    e.preventDefault(); const formData = new FormData(e.target);
    let updated;
    if (editCronograma) {
      const mod = { ...editCronograma, codigo: formData.get('codigo'), periodo: formData.get('periodo'), proceso: formData.get('proceso'), enfoque: formData.get('enfoque'), cumplimiento: parseInt(formData.get('cumplimiento') || 0), responsable: formData.get('responsable'), apoyo: formData.get('apoyo') };
      updated = safeCronograma.map(c => c.id === editCronograma.id ? mod : c);
      setEditCronograma(null);
    } else {
      const nuevo = { id: Date.now(), codigo: formData.get('codigo'), periodo: formData.get('periodo'), proceso: formData.get('proceso'), enfoque: formData.get('enfoque'), cumplimiento: parseInt(formData.get('cumplimiento') || 0), responsable: formData.get('responsable'), apoyo: formData.get('apoyo'), meses: ['Enero'] };
      updated = [nuevo, ...safeCronograma];
    }
    setCronograma(updated); await saveToCloud({ cronograma: updated }); e.target.reset(); showNotification("Cronograma guardado.");
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
      historialCambios: [...(editApetito.historialCambios || []), { fecha: timestamp, accion: 'Arquitectura de apetito COSO ERM parametrizada' }]
    };

    const updatedList = safeRiesgos.map(r => r.id === editApetito.id ? modificado : r);
    setRiesgos(updatedList);
    setEditApetito(null);
    await saveToCloud({ riesgos: updatedList });
    showNotification("Perfil COSO de Apetito guardado exitosamente.");
    scrollToTop();
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
    await saveToCloud({ [listType]: updated });
    showNotification("Registro eliminado.", "error");
  };

  // =====================================================================
  // RENDERS DE VISTAS (ADMIN INTERFACE)
  // =====================================================================

  const renderSelectorFiltrosMultiples = () => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col space-y-3 shadow-sm">
      <div className="text-xs font-black text-[#004d40] uppercase tracking-wider flex items-center space-x-2">
        <span>🎛️</span> <span>Consola de Mando Temporal (Agrupación Activa)</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3 border-r pr-2">
          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Años:</span>
          <div className="flex gap-1.5">
            {[2025, 2026].map(a => {
              const act = selectedAnios.includes(a);
              return (
                <button key={a} type="button" onClick={() => toggleAnio(a)} className={`px-3 py-1 rounded text-xs font-black border transition-all ${act ? 'bg-[#004d40] text-white border-[#004d40]' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{a}</button>
              );
            })}
          </div>
        </div>
        <div className="md:col-span-9">
          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Meses:</span>
          <div className="flex flex-wrap gap-1">
            {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => {
              const act = selectedMeses.includes(m);
              return (
                <button key={m} type="button" onClick={() => toggleMes(m)} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${act ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{m}</button>
              );
            })}
            <button type="button" onClick={() => setSelectedMeses(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"])} className="text-[10px] font-black text-blue-600 hover:underline ml-2">Seleccionar Todos</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTablero = () => {
    const sedes = ['Hotel', 'Ecoparque', 'Administrativo'];
    return (
      <div className="space-y-6">
        {renderSelectorFiltrosMultiples()}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Gauge value={avanceGlobal} label="Mitigación Global" sublabel="Promedio de Avance %" colorClass="text-blue-500" />
          <Gauge value={rendimientoControles} label="Salud Controles" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
          <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-center text-center shadow-sm">
            <span className="text-[10px] font-black text-red-400 uppercase">Hallazgos Abiertos en Grupo</span>
            <span className="text-4xl font-black mt-2">{hAbiertos}</span>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Desempeño Operativo por Sede</h3>
          {sedes.map(s => {
            const hSede = hFiltrados.filter(h => h.sede === s).length;
            return (
              <div key={s} className="bg-white p-4 border rounded-xl flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                <span className="font-black text-slate-800 text-sm">{s}</span>
                <span className="text-xs font-bold text-slate-500">Hallazgos Activos en Periodo: <b className="text-red-600 font-black">{hSede}</b></span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDashboardRiesgos = () => {
    const esRes = tipoMatriz === 'residual';
    const totalRiesgos = rFiltrados.length;
    const totalPerdidas = incFiltrados.reduce((acc, i) => acc + (Number(i.costo) || 0), 0);
    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];

    const contarCelda = (imp, prob) => rFiltrados.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;

    return (
      <div className="space-y-6">
        {renderSelectorFiltrosMultiples()}
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="text-sm font-black text-slate-700 uppercase">Matriz de Riesgo Tradicional (ISO 31000)</h3>
          <div className="bg-white p-1 rounded-xl border flex shadow-sm">
            <button onClick={() => setTipoMatriz('inherente')} className={`px-4 py-1 rounded-lg font-bold text-[10px] uppercase ${!esRes ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Inherente</button>
            <button onClick={() => setTipoMatriz('residual')} className={`px-4 py-1 rounded-lg font-bold text-[10px] uppercase ${esRes ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Residual</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 border rounded-xl shadow-sm"><span className="text-[10px] text-slate-400 font-bold uppercase block">Riesgos Totales Consolidados</span><span className="text-2xl font-black text-slate-800">{totalRiesgos}</span></div>
          <div className="bg-white p-4 border rounded-xl shadow-sm"><span className="text-[10px] text-slate-400 font-bold uppercase block">Impacto Económico Realizado</span><span className="text-2xl font-black text-purple-700">${totalPerdidas.toLocaleString('es-CO')}</span></div>
        </div>

        <div className="bg-white rounded-2xl border p-6 flex flex-col items-center shadow-sm">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 w-full max-w-xl">
            <div></div>
            {probabilidades.map(p => <div key={p} className="text-center text-[10px] font-black uppercase text-slate-500 bg-slate-50 py-1 rounded border">{p}</div>)}
            {impactos.map(imp => (
              <React.Fragment key={imp}>
                <div className="text-right pr-2 flex items-center justify-end text-[10px] font-black uppercase text-slate-500">{imp}</div>
                {probabilidades.map(prob => {
                  const count = contarCelda(imp, prob);
                  const { color } = calcularMatriz5x5(prob, imp);
                  return (
                    <div key={prob} className={`h-14 rounded-lg flex items-center justify-center font-black border text-lg cursor-pointer transition-all hover:scale-105 ${color} ${count > 0 ? 'opacity-100 shadow-md' : 'opacity-20'}`}>{count}</div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPlanAnual = () => {
    const avg = safeCronograma.length ? Math.round(safeCronograma.reduce((acc, c) => acc + (c.cumplimiento || 0), 0) / safeCronograma.length) : 0;
    return (
      <div className="space-y-6">
        <div className="bg-[#004d40] text-white p-6 rounded-2xl flex justify-between items-center shadow-md">
          <div><h2 className="text-xl font-black uppercase tracking-wider">Plan Anual de Auditoría Interna</h2><p className="text-xs opacity-70">Aseguramiento y Cumplimiento de Procesos</p></div>
          <div className="bg-[#00695c] px-4 py-2 rounded-xl text-center"><span className="text-xl font-black block">{avg}%</span><span className="text-[9px] uppercase tracking-widest block opacity-80">Avance Cronograma</span></div>
        </div>

        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Agregar Proceso al Cronograma</h3>
            <form onSubmit={handleCronogramaSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
              <input name="codigo" required placeholder="Cód ID (Ej: 04)" className="border p-2 rounded" />
              <input name="periodo" required placeholder="Periodo (Ej: Enero)" className="border p-2 rounded" />
              <input name="proceso" required placeholder="Proceso o Área" className="border p-2 rounded" />
              <input name="responsable" required placeholder="Auditor Líder" className="border p-2 rounded" />
              <input name="cumplimiento" type="number" required placeholder="Cumplimiento Inicial %" className="border p-2 rounded" />
              <textarea name="enfoque" required placeholder="Alcance y Enfoque Técnico" className="border p-2 rounded md:col-span-3"></textarea>
              <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-[#004d40] text-white px-6 py-2 rounded font-bold">Agregar Proceso</button></div>
            </form>
          </div>
        )}

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-100 border-b text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="p-3">ID <FilterInput colKey="codigo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Periodo <FilterInput colKey="periodo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Proceso <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3">Alcance Técnico <FilterInput colKey="enfoque" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
                <th className="p-3 text-center">Cumpl. %</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {applyFilters(safeCronograma, searchTerm, columnFilters).map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono">0{c.codigo}</td>
                  <td className="p-3 font-bold">{c.periodo}</td>
                  <td className="p-3 font-black text-slate-900">{c.proceso}</td>
                  <td className="p-3 text-slate-500 max-w-xs">{c.enfoque}</td>
                  <td className="p-3 text-center font-black text-emerald-700">{c.cumplimiento}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRiesgos = () => {
    const rData = safeRiesgos.map(r => {
      const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
      return { ...r, scoreResVal: res.score, apetitoVal: res.apetito, accionVal: res.accion, colorVal: res.color };
    });
    return (
      <div className="space-y-6">
        <div className="border-b pb-2 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-800">Estructura General de Riesgos</h2>
          <input type="text" placeholder="🔍 Buscar en matriz..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border rounded-lg px-3 py-1 text-xs w-64 shadow-sm" />
        </div>
        {isAdmin && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Registrar Nuevo Riesgo</h3>
            <form onSubmit={handleRiesgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
              <div><label className="font-bold">Sede</label><select name="sede" className="w-full border rounded p-1.5 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
              <div><label className="font-bold">Proceso Auditable</label><input name="proceso" required className="w-full border rounded p-1.5" /></div>
              <div><label className="font-bold">Categoría COSO</label><select name="categoria" className="w-full border rounded p-1.5 bg-white"><option>Operativo</option><option>Estratégico</option><option>Tecnológico</option></select></div>
              <div><label className="font-bold">Normativa Compliance</label><input name="normativa" required className="w-full border rounded p-1.5" placeholder="Ej: ISO 31000" /></div>
              <div className="md:col-span-2">
                <label className="font-bold flex justify-between">
                  Descripción Evento
                </label>
                <input name="descripcion" required className="w-full border rounded p-1.5" />
              </div>
              <div className="md:col-span-2">
                <label className="font-bold flex justify-between items-center">
                  <span>Control Clave Diseñado</span>
                  <button type="button" onClick={() => sugerirConIA('control')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                    <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                  </button>
                </label>
                <input name="control" required className="w-full border rounded p-1.5" />
              </div>
              <div><label className="font-bold">Responsable</label><input name="responsable" required className="w-full border rounded p-1.5" /></div>
              <div><label className="font-bold">Prob. Inherente</label><select name="probInh" className="w-full border rounded p-1.5 bg-white"><option>Rara</option><option>Posible</option><option>Frecuente</option></select></div>
              <div><label className="font-bold">Imp. Inherente</label><select name="impInh" className="w-full border rounded p-1.5 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
              <div><label className="font-bold">Prob. Residual</label><select name="probRes" className="w-full border rounded p-1.5 bg-white"><option>Rara</option><option>Posible</option><option>Frecuente</option></select></div>
              <div><label className="font-bold">Imp. Residual</label><select name="impRes" className="w-full border rounded p-1.5 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
              <div className="flex items-end md:col-span-4"><button type="submit" className="bg-[#004d40] text-white px-6 py-2 rounded font-bold uppercase shadow-sm">Guardar en Matriz</button></div>
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
              {applyFilters(rData, searchTerm, columnFilters).map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-400">#{r.id}</td>
                  <td className="p-3">
                    <span className="font-black text-slate-900 block">{r.proceso}</span>
                    <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded tracking-wider mt-0.5 inline-block uppercase">⚖️ {r.normativa || 'Compliance'}</span>
                  </td>
                  <td className="p-3 max-w-xs">{r.descripcion}</td>
                  <td className="p-3 italic max-w-xs">⚙️ {r.descripcionControl}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-[10px]">{r.apetitoVal}</span></td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {isAdmin && <button onClick={() => handleDeleteItem('riesgos', r.id)} className="text-red-600 font-bold px-2 py-1 bg-red-50 rounded text-[10px] hover:bg-red-100">Eliminar</button>}
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
                  </label>
                  <select name="posturaEstrategica" defaultValue={editApetito.posturaEstrategica || 'Cauto'} className="w-full border border-slate-300 rounded-lg p-2 mb-4 bg-white shadow-sm">
                    <option value="Averso">Averso (Evitar riesgo a toda costa)</option>
                    <option value="Cauto">Cauto (Preferencia por soluciones seguras)</option>
                    <option value="Flexible">Flexible (Equilibrio riesgo/recompensa)</option>
                    <option value="Buscador">Buscador (Alta aceptación para innovar)</option>
                  </select>

                  <label className="font-bold text-gray-700 mb-1 flex items-center w-max">
                    KRI: Puntaje Residual Máximo Permitido
                  </label>
                  <input type="number" min="1" max="25" name="kriScore" defaultValue={editApetito.kriScore || ''} required placeholder="Ej: 9 (Puntos de Matriz 5x5)" className="w-full border border-slate-300 rounded-lg p-2 bg-white shadow-sm" />
                </div>

                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                  <h4 className="font-black text-blue-800 uppercase tracking-widest mb-3 border-b border-blue-200 pb-2">2. Umbrales Financieros (COP)</h4>
                  
                  <label className="font-bold text-blue-900 mb-1 flex items-center w-max">
                    <span>🎯 Apetito de Riesgo (Deseado)</span>
                  </label>
                  <input type="number" name="apetitoFinanciero" defaultValue={editApetito.apetitoFinanciero || ''} required placeholder="Pérdida esperada aceptable (Ej: 1000000)" className="w-full border border-blue-200 rounded-lg p-2 mb-4 bg-white shadow-sm" />

                  <label className="font-bold text-amber-700 mb-1 flex items-center w-max">
                    <span>⚠️ Tolerancia al Riesgo (Desv. Máx)</span>
                  </label>
                  <input type="number" name="toleranciaFinanciera" defaultValue={editApetito.toleranciaFinanciera || ''} required placeholder="Pérdida máxima tolerada (Ej: 3000000)" className="w-full border border-amber-200 rounded-lg p-2 mb-4 bg-white shadow-sm" />

                  <label className="font-bold text-red-700 mb-1 flex items-center w-max">
                    <span>🛑 Capacidad de Riesgo (Límite Ruptura)</span>
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
                  <th className="p-4 w-1/3">% Consumo vs Capacidad Total (Eventos)</th>
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
                              <span className="text-slate-500">% Consumo vs Capacidad</span>
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

  const renderEvaluaciones = () => (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">🔬 Auditoría de Controles Clave</div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Nuevo Test de Control</h3>
          <form onSubmit={handleEvaluacionSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <div><label className="font-bold">ID Riesgo Vinculado</label><input name="idRiesgo" required className="w-full border rounded p-2" /></div>
            <div><label className="font-bold">Test de Diseño</label><select name="diseno" className="w-full border rounded p-2 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold">Test de Ejecución</label><select name="ejecucion" className="w-full border rounded p-2 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold">Adjuntar Evidencia (PDF/IMG)</label><input type="file" name="evidenciaArchivo" className="w-full border rounded p-1.5 bg-slate-50 cursor-pointer" accept=".pdf,.jpg,.png" /></div>
            <div className="md:col-span-4"><label className="font-bold">Comentarios y Observaciones</label><input name="comentarios" required className="w-full border rounded p-2" /></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" disabled={isUploading} className="bg-[#004d40] text-white px-5 py-2 rounded font-bold">{isUploading ? 'Subiendo...' : 'Guardar Test'}</button></div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold">
            <tr>
              <th className="p-3">ID Test <FilterInput colKey="id" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Riesgo <FilterInput colKey="idRiesgo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Diseño <FilterInput colKey="diseño" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Ejecución <FilterInput colKey="ejecucion" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Calificación %</th>
              <th className="p-3">Comentarios / Evidencia</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(safeEvaluaciones, searchTerm, columnFilters).map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-400">#TEST-{e.id}</td>
                <td className="p-3 font-bold">Riesgo #{e.idRiesgo}</td>
                <td className="p-3">{e.diseño}</td>
                <td className="p-3">{e.ejecucion}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded font-black ${e.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{e.calificacion}%</span></td>
                <td className="p-3">
                  <div className="mb-1">{e.comentarios}</div>
                  {e.evidenciaUrl && (
                    <div className="flex items-center space-x-2 mt-2">
                      <a href={e.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-100 flex items-center space-x-1"><span>📎</span><span>Ver</span></a>
                      {isAdmin && <button onClick={() => analizarEvidenciaIA(e.evidenciaUrl, e.comentarios, 'Test de Auditoría')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded text-[10px] hover:bg-purple-100 flex items-center space-x-1"><span>🤖</span><span>Auditar IA</span></button>}
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

  const renderHallazgos = () => (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">📄 Hallazgos y No Conformidades</div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Registrar Hallazgo</h3>
          <form onSubmit={handleHallazgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <input name="ref" required placeholder="Cód Referencia (HAL-01)" className="border p-2 rounded" />
            <select name="sede" className="border p-2 bg-white rounded"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select>
            <input name="proceso" required placeholder="Proceso o Área" className="border p-2 rounded" />
            <input name="responsable" required placeholder="Dueño del Proceso" className="border p-2 rounded" />
            <input name="auditor" required placeholder="Auditor que reporta" className="border p-2 rounded" />
            <select name="severidad" className="border p-2 bg-white rounded"><option>Bajo</option><option>Medio</option><option>Alto</option></select>
            <div className="md:col-span-2">
              <label className="font-bold flex justify-between items-center mb-1">
                <span>Título / Descripción de la Falla</span>
                <button type="button" onClick={() => sugerirConIA('hallazgo')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                  <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                </button>
              </label>
              <input name="titulo" required placeholder="Descripción de la desviación encontrada" className="w-full border p-2 rounded" />
            </div>
            <div className="md:col-span-4"><label className="font-bold">Adjuntar Evidencia (Opcional)</label><input type="file" name="evidenciaArchivo" className="w-full border rounded p-1.5 bg-slate-50 cursor-pointer" accept=".pdf,.jpg,.png" /></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" disabled={isUploading} className="bg-[#004d40] text-white px-5 py-2 rounded font-bold">{isUploading ? 'Subiendo...' : 'Registrar Desviación'}</button></div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b text-[10px] uppercase text-slate-500 font-black">
            <tr>
              <th className="p-3">Ref <FilterInput colKey="ref" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Proceso / Sede <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Descripción de la Desviación <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Responsables <FilterInput colKey="responsable" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Estado <FilterInput colKey="estado" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(hFiltrados, searchTerm, columnFilters).map(h => (
              <tr key={h.id} className="hover:bg-slate-50">
                <td className="p-3 font-black text-red-600">{h.ref}</td>
                <td className="p-3"><b>{h.proceso}</b><span className="text-[10px] text-slate-400 block">{h.sede}</span></td>
                <td className="p-3">
                  <div className="font-medium text-slate-800">{h.titulo}</div>
                  {h.evidenciaUrl && (
                    <div className="flex items-center space-x-2 mt-2">
                      <a href={h.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-100 flex items-center space-x-1"><span>📎</span><span>Ver Evidencia</span></a>
                      {isAdmin && <button onClick={() => analizarEvidenciaIA(h.evidenciaUrl, h.titulo, 'Hallazgo')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded text-[10px] hover:bg-purple-100 flex items-center space-x-1"><span>🤖</span><span>Auditar IA</span></button>}
                    </div>
                  )}
                </td>
                <td className="p-3">Auditor: {h.auditor}<span className="text-[10px] text-slate-400 block">Dueño: {h.responsable}</span></td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold uppercase text-[9px]">{h.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlanes = () => (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">✅ Planes de Acción Remediales</div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Registrar Plan Remedial</h3>
          <form onSubmit={handlePlanSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <div className="md:col-span-4"><label className="font-bold">Hallazgo Vinculado</label><select name="idHallazgo" required className="w-full border rounded p-2 bg-white"><option value="">-- Seleccione --</option>{safeHallazgos.map((h, i) => <option key={`opt-hallz-${h.id}-${i}`} value={h.id}>[#HAL-{h.id}] {h.titulo}</option>)}</select></div>
            <div className="md:col-span-2">
              <label className="font-bold flex justify-between items-center mb-1">
                <span>Acción de Choque / Mitigación</span>
                <button type="button" onClick={() => sugerirConIA('plan')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                  <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                </button>
              </label>
              <input name="accion" required placeholder="Acción de Choque / Mitigación" className="w-full border p-2 rounded" />
            </div>
            <div><label className="font-bold">Responsable de Ejecución</label><input name="responsable" required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold">Compromiso</label><input name="fecha" type="date" required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold text-blue-600">% Avance Real</label><input name="progreso" type="number" min="0" max="100" placeholder="% Avance Real" className="w-full border p-2 bg-blue-50 border-blue-200 rounded" /></div>
            <div className="md:col-span-3"><label className="font-bold">Evidencia de Avance</label><input type="file" name="evidenciaArchivo" className="w-full border rounded p-1.5 bg-slate-50 cursor-pointer" accept=".pdf,.jpg,.png" /></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" disabled={isUploading} className="bg-[#004d40] text-white px-5 py-2 rounded font-bold">{isUploading ? 'Subiendo...' : 'Asignar Plan'}</button></div>
          </form>
        </div>
      )}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
            <tr>
              <th className="p-3">ID Plan <FilterInput colKey="id" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Hallazgo <FilterInput colKey="idHallazgo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Acción Remedial Programada <FilterInput colKey="accion" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
              <th className="p-3">Avance %</th>
              <th className="p-3">Estado <FilterInput colKey="estado" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(pFiltrados, searchTerm, columnFilters).map(p => (
              <tr key={p.id}>
                <td className="p-3 font-bold">#PLAN-{p.id}</td>
                <td className="p-3 text-red-600 font-bold">#HAL-{p.idHallazgo}</td>
                <td className="p-3 text-slate-800 font-medium">
                  {p.accion} <span className="text-[10px] text-slate-400 block font-normal">Resp: {p.responsable} • Límite: {p.fecha}</span>
                  {p.evidenciaUrl && (
                    <div className="flex items-center space-x-2 mt-2">
                      <a href={p.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-[10px] hover:bg-blue-100 flex items-center space-x-1"><span>📎</span><span>Ver Avance</span></a>
                      {isAdmin && <button onClick={() => analizarEvidenciaIA(p.evidenciaUrl, p.accion, 'Plan de Acción')} className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded text-[10px] hover:bg-purple-100 flex items-center space-x-1"><span>🤖</span><span>Auditar IA</span></button>}
                    </div>
                  )}
                </td>
                <td className="p-3"><ProgressBar progress={p.progreso || p.avance || 0} /></td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold uppercase text-[9px]">{p.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderIncidentes = () => (
    <div className="space-y-6">
      <div className="border-b pb-2 font-black text-lg">🚨 Registro de Eventos de Pérdida (COP)</div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Registrar Evento de Pérdida</h3>
          <form onSubmit={handleIncidenteSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-sm">
            <input name="idRiesgo" required placeholder="ID Riesgo Vinculado" className="border p-2 rounded" />
            <input name="titulo" required placeholder="Título del Evento" className="border p-2 rounded" />
            <input name="costo" type="number" required placeholder="Monto de la Pérdida Financiera" className="border p-2 rounded" />
            <select name="impacto" className="border p-2 bg-white rounded"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select>
            <textarea name="descripcion" required placeholder="Descripción de la falla operacional..." className="border p-2 rounded md:col-span-4"></textarea>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-[#004d40] text-white px-5 py-2 rounded font-bold">Registrar Evento</button></div>
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
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {applyFilters(incFiltrados, searchTerm, columnFilters).map(i => (
              <tr key={i.id}>
                <td className="p-3 text-slate-400">#INC-{i.id}</td>
                <td className="p-3 font-bold">#{i.idRiesgo}</td>
                <td className="p-3"><b>{i.titulo}</b><p className="text-[10px] text-slate-400 mt-0.5">{i.descripcion}</p></td>
                <td className="p-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[9px]">{i.impacto}</span></td>
                <td className="p-3 text-right font-mono font-bold text-red-600">${Number(i.costo || 0).toLocaleString('es-CO')}</td>
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
    <div className="min-h-screen bg-slate-100 font-sans text-xs">
      <header className="bg-[#004d40] text-white p-6 flex justify-between items-center shadow-md">
        <div><h1 className="text-lg font-black uppercase tracking-widest">Portal RCSA Jefes (1ra Línea)</h1><p className="text-xs text-[#deff9a]">Certificación obligatoria de controles operacionales</p></div>
        <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-xs font-bold shadow">Cerrar Sesión</button>
      </header>
      <main className="max-w-4xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 border rounded-2xl shadow-sm">
          <h3 className="font-black text-emerald-800 text-sm mb-3">🛡️ Certificar Mi Control Operativo</h3>
          <form onSubmit={handleEvaluacionSubmit} className="space-y-3">
            <div><label className="font-bold">ID del Riesgo</label><input name="idRiesgo" required className="w-full border p-2 rounded" /></div>
            <div><label className="font-bold">Test de Diseño</label><select name="diseno" className="w-full border p-2 bg-white rounded"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold">Test de Ejecución</label><select name="ejecucion" className="w-full border p-2 bg-white rounded"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold">Novedades / Observaciones del mes</label><textarea name="comentarios" required className="w-full border p-2 rounded" rows="3"></textarea></div>
            <div><label className="font-bold">Evidencia (PDF/IMG)</label><input type="file" name="evidenciaArchivo" required className="w-full border p-2 bg-slate-50 rounded" accept=".pdf,.jpg,.png" /></div>
            <button type="submit" disabled={isUploading} className="bg-[#004d40] text-white w-full py-2.5 rounded font-black uppercase shadow">{isUploading ? 'Enviando...' : 'Enviar Certificación'}</button>
          </form>
        </div>
        <div className="bg-white p-6 border rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-blue-800 text-sm mb-3">📈 Reportar Avance de Plan</h3>
            <form onSubmit={handlePlanSubmit} className="space-y-3">
              <div><label className="font-bold">ID del Hallazgo Vinculado</label><input name="idHallazgo" required className="w-full border p-2 rounded" /></div>
              <div><label className="font-bold text-blue-600">% de Avance Físico Real</label><input name="progreso" type="number" min="0" max="100" required className="w-full border border-blue-300 bg-blue-50 p-2.5 rounded text-lg font-black text-blue-600" /></div>
              <div><label className="font-bold">Evidencia de Avance</label><input type="file" name="evidenciaArchivo" className="w-full border p-2 bg-slate-50 rounded" accept=".pdf,.jpg,.png" /></div>
              <button type="submit" disabled={isUploading} className="bg-blue-600 text-white w-full py-2.5 rounded font-black uppercase shadow">{isUploading ? 'Actualizando...' : 'Actualizar Avance'}</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
        <form className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-2xl space-y-4 text-xs" onSubmit={handleAuthSubmit}>
          <div className="text-center font-black text-lg text-slate-800 uppercase tracking-wider">🛡️ GCM Auditor v5</div>
          {authError && <div className="bg-red-50 text-red-700 p-2 rounded font-bold">⚠️ {authError}</div>}
          <div><label className="font-bold text-slate-500 uppercase">Correo Corporativo</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="block w-full border rounded p-2 mt-1" placeholder="ejemplo@termales.com.co"/></div>
          <div><label className="font-bold text-slate-500 uppercase">Contraseña</label><input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="block w-full border rounded p-2 mt-1" placeholder="••••••••"/></div>
          <button type="submit" className="w-full bg-slate-800 text-white py-2.5 rounded font-bold shadow-md">{isRegistering ? 'Registrar Cuenta' : 'Ingresar'}</button>
          <div className="text-center"><button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-blue-600 font-bold underline">{isRegistering ? 'Volver' : 'Solicitar Acceso RCSA'}</button></div>
        </form>
      </div>
    );
  }

  if (!isCloudLoaded) return <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-white font-mono text-xs uppercase tracking-widest animate-pulse">☁️ Sincronizando Nube GRC...</div>;
  if (!isAdmin) return renderRCSAPortal();

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden text-xs">
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
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 font-black text-sm text-white uppercase tracking-wider">🛡️ GCM Auditor v5</div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center space-x-3 font-bold transition-all ${activeTab === tab.id ? 'bg-[#004d40] text-white shadow' : 'hover:bg-slate-800'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full border border-slate-700 rounded py-2 font-bold text-center hover:bg-slate-800 transition-all">🚪 Cerrar Sesión</button></div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b h-16 flex items-center justify-between px-8 shadow-sm z-10 flex-shrink-0">
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">Termales de Santa Rosa de Cabal — Sistema de Gestión Integral</span>
        </header>
        <div className="flex-grow overflow-y-auto p-8 bg-slate-50">
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
      </div>
    </div>
  );
}