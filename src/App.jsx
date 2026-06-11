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

// --- DATOS POR DEFECTO (Con el nuevo campo 'Sede' integrado) ---
const defaultRiesgos = [
  { id: 98, sede: 'Hotel', categoria: 'Operativo', proceso: 'Alimentos y bebidas', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Afectación del sabor e higiene de alimentos por uso de insumos cárnicos de baja calidad.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío diaria e inspección organoléptica al recibir insumos.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe de Alimentos y Bebidas', historialCambios: [] },
  { id: 186, sede: 'Administrativo', categoria: 'Estratégico', proceso: 'Gestión Estratégica', tipoRiesgo: 'Legal y Regulatorio', afectacion: 'Económica', causaInmediata: 'Cambios normativos tributarios', causaRaiz: 'Falta de comité legal interno', descripcion: 'Sanciones o pérdidas financieras por errores en la declaración de impuestos hoteleros.', probabilidadInherente: 'Rara', impactoInherente: 'Medio', noControl: 'C-186', descripcionControl: 'Revisión y auditoría externa por firma contable cada trimestre.', probabilidadResidual: 'Rara', impactoResidual: 'Bajo', responsable: 'Gerente Financiero', historialCambios: [] },
  { id: 201, sede: 'Ecoparque', categoria: 'Tecnológico', proceso: 'Infraestructura TI', tipoRiesgo: 'Ciberseguridad', afectacion: 'Operacional', causaInmediata: 'Falta de parches de seguridad', causaRaiz: 'Obsolescencia de servidores locales', descripcion: 'Intrusión de ransomware que paralice el sistema de taquillas.', probabilidadInherente: 'Posible', impactoInherente: 'Crítico', noControl: 'C-201', descripcionControl: 'Firewall activo con logs y copias de seguridad semanales inmutables.', probabilidadResidual: 'Posible', impactoResidual: 'Alto', responsable: 'CISO / Director de TI', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, sede: 'Ecoparque', ref: 'Aud. Interna TI-2026', titulo: 'Acceso de usuarios genéricos a la base de datos de taquilla.', proceso: 'Sistemas', responsable: 'Jefe de TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', historialCambios: [] },
  { id: 2, sede: 'Hotel', ref: 'Aud. Op-2025', titulo: 'Ausencia de actas de capacitación en higiene de alimentos.', proceso: 'Alimentos y bebidas', responsable: 'Jefe de A&B', severidad: 'Medio', idRiesgo: 98, estado: 'Cerrado', fecha: '2025-11-15', historialCambios: [] }
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

export default function App() {
  const [activeTab, setActiveTab] = useState('tablero');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('inherente'); 
  const [filtroAnio, setFiltroAnio] = useState('Todos');
  const [xlsxLoaded, setXlsxLoaded] = useState(false);
  const [filtroHeatMap, setFiltroHeatMap] = useState(null);
  const [isUploading, setIsUploading] = useState(false); 
  const [isThinking, setIsThinking] = useState(false); 
  const [detalleUniverso, setDetalleUniverso] = useState(null); // NUEVO: Controla qué universo de datos se está viendo

  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);

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

  const safeRiesgos = Array.isArray(riesgos) ? riesgos : [];
  const safeHallazgos = Array.isArray(hallazgos) ? hallazgos : [];
  const safePlanes = Array.isArray(planes) ? planes : [];
  const safeIncidentes = Array.isArray(incidentes) ? incidentes : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];

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
      } else {
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
          setDoc(docRef, {
            riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones
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
    setRiesgos([]); setHallazgos([]); setPlanes([]); setIncidentes([]); setEvaluaciones([]);
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

  // --- CONEXIÓN REAL A LA API DE GOOGLE GEMINI ---
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
    }

    if (!textoBase || textoBase.trim() === '' || textoBase.includes('-- Seleccione --')) {
      showNotification("⚠️ Escribe una descripción o selecciona un hallazgo primero para que la IA lo analice.", "error");
      return;
    }

    if (!GEMINI_API_KEY) {
      showNotification("⚠️ La clave de API de Gemini no se ha cargado correctamente.", "error");
      return;
    }

    setIsThinking(true);
    showNotification("🧠 Gemini Pro está analizando el escenario...", "success");

    try {
      const prompt = tipoTarget === 'control'
        ? `Actúa como un experto en auditoría GRC y ciberseguridad (ISO 31000). El siguiente es un evento de riesgo en una empresa: "${textoBase}". Redacta la descripción de un CONTROL CLAVE mitigante o preventivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto del control, sin comillas ni saludos.`
        : `Actúa como un gerente de auditoría interno corporativo. Se ha detectado el siguiente hallazgo o desviación: "${textoBase}". Redacta una ACCIÓN DE CHOQUE o plan correctivo, de forma muy ejecutiva, técnica y directa (máximo 20 words). Solo responde con el texto de la acción, sin comillas ni saludos.`;

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
        inputDestino.value = sugerencia;
        inputDestino.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      showNotification("✨ ¡Gemini ha insertado una sugerencia ejecutiva de alto nivel!");
    } catch (error) {
      console.error("Error conectando a Gemini:", error);
      showNotification("Error conectando con la IA de Google. Verifica los ajustes.", "error");
    } finally {
      setIsThinking(false);
    }
  };

  const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
  const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };

  const getYearFromDate = (dateStr) => {
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
        sede: formData.get('sede'), // FASE 5: Se incluye Sede
        proceso: formData.get('proceso'), 
        categoria: formData.get('categoria'), 
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
        sede: formData.get('sede'), // FASE 5: Se incluye Sede
        proceso: formData.get('proceso'), 
        categoria: formData.get('categoria'), 
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
    if (!isAdmin) return;
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
        diseño: diseno, ejecucion, calificacion: calif, comentarios: formData.get('comentarios'), auditor: user.email,
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
        sede: formData.get('sede'), // FASE 5: Se incluye Sede
        ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'),
        titulo: formData.get('titulo'), severidad: formData.get('severidad'), idRiesgo: idRiesgo ? parseInt(idRiesgo) : null,
        evidenciaUrl: evidenciaUrlOut, historialCambios: [...(editHallazgo.historialCambios || []), { fecha: timestamp, accion: 'Hallazgo editado' }]
      };
      updatedList = safeHallazgos.map(h => h.id === editHallazgo.id ? modificado : h);
      setEditHallazgo(null);
    } else {
      const nuevo = {
        id: safeHallazgos.length ? Math.max(...safeHallazgos.map(h => h.id)) + 1 : 1, 
        sede: formData.get('sede'), // FASE 5: Se incluye Sede
        ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'),
        titulo: formData.get('titulo'), severidad: formData.get('severidad'), idRiesgo: idRiesgo ? parseInt(idRiesgo) : null,
        estado: 'Abierto', fecha: new Date().toISOString().split('T')[0], evidenciaUrl: evidenciaUrlOut, historialCambios: [{ fecha: timestamp, accion: 'Hallazgo documentado' }]
      };
      updatedList = [...safeHallazgos, nuevo];
    }
    
    setHallazgos(updatedList);
    await saveToCloud({ hallazgos: updatedList });
    e.target.reset();
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const timestamp = new Date().toLocaleString();
    const progresoVal = parseInt(formData.get('progreso') || 0);
    const estadoVal = progresoVal === 100 ? 'Cerrado' : 'En Proceso';
    
    let updatedList;
    if (editPlan) {
      const modificado = {
        ...editPlan, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal,
        historialCambios: [...(editPlan.historialCambios || []), { fecha: timestamp, accion: 'Plan modificado' }]
      };
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);
      showNotification("Plan actualizado.");
    } else {
      const nuevo = {
        id: safePlanes.length ? Math.max(...safePlanes.map(p => p.id)) + 1 : 1, idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'),
        responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoVal, estado: estadoVal, historialCambios: [{ fecha: timestamp, accion: 'Plan asignado' }]
      };
      updatedList = [...safePlanes, nuevo];
      showNotification("Plan asignado exitosamente.");
    }

    setPlanes(updatedList);
    await saveToCloud({ planes: updatedList });
    e.target.reset();
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
    await saveToCloud({ [listType]: updated });
    showNotification("Registro eliminado.", "error");
  };

  // ==================== RENDERS DE VISTAS ====================

  const renderTablero = () => {
    const anioActual = filtroAnio;
    const hFiltrados = safeHallazgos.filter(h => anioActual === 'Todos' || getYearFromDate(h.fecha) === anioActual);
    const pFiltrados = safePlanes.filter(p => anioActual === 'Todos' || getYearFromDate(p.fecha) === anioActual);

    const añosSet = new Set();
    safeHallazgos.forEach(h => { if(h.fecha) añosSet.add(getYearFromDate(h.fecha)); });
    safePlanes.forEach(p => { if(p.fecha) añosSet.add(getYearFromDate(p.fecha)); });
    const availableYears = Array.from(añosSet).sort().reverse();

    const sedes = ['Hotel', 'Ecoparque', 'Administrativo'];

    // FASE 5: Función para calcular métricas por Unidad de Negocio (Sede)
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

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4">
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Tablero Analítico de Auditoría</h2><p className="text-xs text-slate-500 mt-1 font-medium">Análisis integral de desviaciones operacionales.</p></div>
          <div className="mt-4 md:mt-0 bg-white p-1 rounded-xl border flex items-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 pr-2">Filtro de Año:</span>
            <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 focus:outline-none">
              <option value="Todos">Histórico Global</option>
              {availableYears.map((a, index) => <option key={`year-${a}-${index}`} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* FASE 5: Tarjetas de Velocímetros Separadas por Unidad de Negocio */}
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Desempeño por Unidad de Negocio</h3>
          <p className="text-[10px] text-blue-500 font-bold mb-4">👆 Haz clic en cualquier tarjeta o velocímetro para ver su universo de datos detallado.</p>
          <div className="space-y-6">
            {sedes.map((sede) => {
              const metricas = obtenerMetricasSede(sede);
              return (
                <div key={`metrics-${sede}`} className="bg-slate-100/50 border border-slate-200 p-6 rounded-3xl shadow-sm">
                  <h4 className="text-lg font-black text-slate-800 mb-4 tracking-tight border-b pb-2">{sede}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Tarjeta Clickable: Universo de Hallazgos */}
                    <div 
                      onClick={() => { setDetalleUniverso({ sede, tipo: 'hallazgos' }); setTimeout(() => document.getElementById('detalle-universo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                      className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center h-full hover:shadow-lg hover:ring-4 hover:ring-blue-100 transition-all cursor-pointer relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-600 text-[8px] px-2 py-1 rounded-full font-bold uppercase tracking-widest">Ver Universo ↗</div>
                      <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Hallazgos Abiertos</h4>
                      <span className="text-5xl font-black mt-3 text-slate-800">{metricas.hallazgosAbiertos}</span>
                      <p className="text-[10px] font-bold mt-3 opacity-60 text-slate-500">Pendientes de Cierre</p>
                    </div>

                    {/* Tarjeta Clickable: Universo de Controles */}
                    <div 
                      onClick={() => { setDetalleUniverso({ sede, tipo: 'evaluaciones' }); setTimeout(() => document.getElementById('detalle-universo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                      className="hover:shadow-lg hover:ring-4 hover:ring-emerald-100 transition-all cursor-pointer rounded-2xl relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-50 text-emerald-600 text-[8px] px-2 py-1 rounded-full font-bold uppercase tracking-widest z-10">Ver Universo ↗</div>
                      <Gauge value={metricas.saludControles} label="Salud de Controles" sublabel="Test Auditoría Exitosos" colorClass="text-emerald-500" />
                    </div>

                    {/* Tarjeta Clickable: Universo de Planes */}
                    <div 
                      onClick={() => { setDetalleUniverso({ sede, tipo: 'planes' }); setTimeout(() => document.getElementById('detalle-universo')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }}
                      className="hover:shadow-lg hover:ring-4 hover:ring-blue-100 transition-all cursor-pointer rounded-2xl relative group">
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-600 text-[8px] px-2 py-1 rounded-full font-bold uppercase tracking-widest z-10">Ver Universo ↗</div>
                      <Gauge value={metricas.avancePlanes} label="Planes de Acción" sublabel="Promedio de Avance Físico" colorClass="text-blue-500" />
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- NUEVO MÓDULO: DETALLE DEL UNIVERSO AL HACER CLIC --- */}
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

            {/* Renderizado condicional de métricas del universo según el tipo */}
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
                  
                  {/* Pequeña tabla resumen de lo que hay adentro */}
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

      </div>
    );
  };

  const renderDashboardRiesgos = () => {
    const esRes = tipoMatriz === 'residual';
    const totalRiesgos = safeRiesgos.length;
    const riesgosCriticos = safeRiesgos.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).score > 16).length;
    const riesgosFueraApetito = safeRiesgos.filter(r => calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual).apetito === "Fuera de Apetito").length;
    const totalPerdidas = safeIncidentes.reduce((acc, i) => acc + (i.costo || 0), 0);

    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];

    const contarCelda = (imp, prob) => safeRiesgos.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;
    const riesgosFiltradosHeatMap = filtroHeatMap ? safeRiesgos.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === filtroHeatMap.impacto && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === filtroHeatMap.probabilidad) : [];

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4">
          <div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Intelligence Dashboard GRC</h2><p className="text-xs text-slate-500 mt-1 font-medium">Análisis predictivo de apetito basado en matrices ISO 31000.</p></div>
          <div className="mt-4 md:mt-0 bg-white p-1 rounded-xl border flex items-center shadow-sm">
            <button onClick={() => {setTipoMatriz('inherente'); setFiltroHeatMap(null);}} className={`px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${!esRes ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Inherente</button>
            <button onClick={() => {setTipoMatriz('residual'); setFiltroHeatMap(null);}} className={`px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${esRes ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Residual</button>
          </div>
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

  const renderRiesgos = () => (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">Estructura de Riesgos</h2>
        <button onClick={() => exportToExcel(safeRiesgos, 'Matriz_Riesgos')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">📥 Exportar Excel</button>
      </div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">{editRiesgo ? `✏️ Editando Riesgo #${editRiesgo.id}` : '➕ Registrar Nuevo Riesgo'}</h3>
          <form onSubmit={handleRiesgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            {/* FASE 5: Selector de Sede en Riesgos */}
            <div><label className="font-bold text-gray-600">Sede</label><select name="sede" defaultValue={editRiesgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
            
            <div><label className="font-bold text-gray-600">Proceso</label><input name="proceso" defaultValue={editRiesgo?.proceso||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold text-gray-600">Categoría</label><select name="categoria" defaultValue={editRiesgo?.categoria||'Operativo'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Operativo</option><option>Estratégico</option><option>Tecnológico</option></select></div>
            <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editRiesgo?.responsable||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
            
            <div className="md:col-span-4"><label className="font-bold text-gray-600 flex justify-between items-center"><span>Control Clave</span><button type="button" onClick={() => sugerirConIA('control')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1"><span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span></button></label><input name="control" defaultValue={editRiesgo?.descripcionControl||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div className="md:col-span-4"><label className="font-bold text-gray-600">Descripción Evento</label><input name="descripcion" defaultValue={editRiesgo?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
            
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
            <thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3 w-48">Proceso / Riesgo</th><th className="p-3 w-48">Responsable / Control</th><th className="p-3 text-center">Score Inh</th><th className="p-3 text-center">Score Res</th><th className="p-3">Apetito</th><th className="p-3">Acción Recomendada</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y">
              {safeRiesgos.map((r, index) => {
                const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
                return (
                  <tr key={`riesgo-row-${r.id}-${index}`} className="hover:bg-slate-50">
                    <td className="p-3 font-bold">#{r.id}</td>
                    {/* FASE 5: Se muestra la sede en la tabla */}
                    <td className="p-3">
                      <div className="flex items-center space-x-2 mb-1"><span className="px-2 py-0.5 bg-slate-800 text-white text-[9px] rounded font-bold uppercase">{r.sede || 'Hotel'}</span><span className="font-black">{r.proceso}</span></div>
                      <div className="text-[9px] font-bold text-indigo-500 uppercase font-mono">{r.categoria}</div><div>{r.descripcion}</div>
                    </td>
                    <td className="p-3"><div className="font-bold">{r.responsable}</div><div className="italic mt-1">⚙️ {r.descripcionControl}</div></td>
                    <td className="p-3 text-center font-mono">{calcularMatriz5x5(r.probabilidadInherente, r.impactoInherente).score} pts</td>
                    <td className="p-3 text-center font-mono font-black">{res.score} pts</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${res.apetito === "Dentro de Apetito" ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{res.apetito}</span></td>
                    <td className="p-3"><span className={`px-2.5 py-1 rounded-xl text-[10px] block text-center font-black ${res.color}`}>{res.accion}</span></td>
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      {isAdmin && <button onClick={() => {setEditRiesgo(r); scrollToTop();}} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️</button>}
                      {isAdmin && <button onClick={() => handleDeleteItem('riesgos', r.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>}
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

  const renderEvaluaciones = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">Auditoría de Controles</h2></div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Nuevo Test de Control</h3>
          <form onSubmit={handleEvaluacionSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div><label className="font-bold text-gray-600">Riesgo / Control</label><select name="idRiesgo" required className="w-full border rounded-lg p-2 mt-1 bg-white">{safeRiesgos.map((r, index) => <option key={`opt-riesgo-${r.id}-${index}`} value={r.id}>[{r.sede || 'Hotel'}] {r.proceso}</option>)}</select></div>
            <div><label className="font-bold text-gray-600">Diseño</label><select name="diseno" className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold text-gray-600">Ejecución</label><select name="ejecucion" className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Comentarios</label><textarea name="comentarios" required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea></div>
            <div className="md:col-span-3 flex justify-end"><button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-lg shadow-md">Guardar Test</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID Test</th><th className="p-3">Fecha</th><th className="p-3">Diseño/Operación</th><th className="p-3">Eficacia</th><th className="p-3">Comentarios</th></tr></thead>
          <tbody className="divide-y">
            {safeEvaluaciones.map((ev, index) => (
              <tr key={`eval-row-${ev.id}-${index}`}>
                <td className="p-3 font-mono text-slate-400">#TEST-{ev.id}</td><td className="p-3">{ev.fecha}</td><td>D: {ev.diseño} / E: {ev.ejecucion}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded font-black ${ev.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ev.calificacion}%</span></td>
                <td className="p-3">{ev.comentarios}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHallazgos = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">Hallazgos y Desviaciones</h2></div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Documentar Desviación</h3>
          <form onSubmit={handleHallazgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* FASE 5: Selector de Sede en Hallazgos */}
            <div><label className="font-bold text-gray-600">Sede</label><select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
            
            <div><label className="font-bold text-gray-600">Referencia</label><input name="ref" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold text-gray-600">Proceso</label><input name="proceso" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" required className="w-full border rounded-lg p-2 mt-1" /></div>
            
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Título / Descripción</label><input name="titulo" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold text-gray-600">Severidad</label><select name="severidad" className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow-md">Guardar Hallazgo</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3">Ref</th><th className="p-3">Proceso</th><th className="p-3 w-1/2">Título</th><th className="p-3">Estado</th></tr></thead>
          <tbody className="divide-y">
            {safeHallazgos.map((h, index) => (
              <tr key={`hallazgo-row-${h.id}-${index}`}>
                <td className="p-3 font-bold text-slate-400">#HAL-{h.id}</td><td className="p-3 font-mono">{h.ref}</td>
                {/* FASE 5: Mostrar Sede en Hallazgos */}
                <td className="p-3"><div className="font-bold">{h.proceso}</div><div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{h.sede || 'Hotel'}</div></td>
                <td className="p-3">{h.titulo}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded font-black bg-slate-100">{h.estado}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlanes = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">Planes de Acción</h2></div>
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase">{editPlan ? `✏️ Editando Avance de Plan` : '➕ Asignar Plan'}</h3>
          
          <form onSubmit={handlePlanSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Hallazgo Vinculado</label><select name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white"><option value="">-- Seleccione --</option>{safeHallazgos.map((h, index) => <option key={`opt-hallazgo-${h.id}-${index}`} value={h.id}>[{h.sede || 'Hotel'}] {h.titulo}</option>)}</select></div>
            
            <div className="md:col-span-3">
              <label className="font-bold text-gray-600 flex justify-between items-center">
                <span>Acción Correctiva</span>
                <button type="button" onClick={() => sugerirConIA('plan')} className="text-[9px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded font-black flex items-center space-x-1">
                  <span>{isThinking ? '⏳' : '🤖'}</span> <span>{isThinking ? 'Pensando...' : 'Sugerir IA'}</span>
                </button>
              </label>
              <input name="accion" defaultValue={editPlan?.accion||''} required className="w-full border rounded-lg p-2 mt-1" />
            </div>

            <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editPlan?.responsable||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold text-gray-600">Compromiso</label><input name="fecha" type="date" defaultValue={editPlan?.fecha||''} required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold text-blue-600">% de Avance Físico</label><input type="number" min="0" max="100" name="progreso" defaultValue={editPlan?.progreso||0} required className="w-full border-2 border-blue-200 bg-blue-50 rounded-lg p-2 mt-1" /></div>
            
            <div className="md:col-span-3 flex justify-end"><button type="submit" className="bg-slate-800 text-white font-bold px-6 py-2 rounded-lg shadow-md">{editPlan ? 'Actualizar Progreso' : 'Asignar Plan'}</button></div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <table className="w-full text-xs text-left divide-y">
          <thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3">Hallazgo</th><th className="p-3">Acción</th><th className="p-3">Compromiso</th><th className="p-3 w-40">Avance</th><th className="p-3">Estado</th><th className="p-3 text-center">Gestión</th></tr></thead>
          <tbody className="divide-y">
            {safePlanes.map((p, index) => {
              const hallazgoAsociado = safeHallazgos.find(h => h.id === p.idHallazgo);
              return (
                <tr key={`plan-row-${p.id}-${index}`}>
                  <td className="p-3 font-bold">#PLAN-{p.id}</td>
                  {/* FASE 5: Se muestra la sede del hallazgo al que pertenece el plan */}
                  <td className="p-3"><span className="text-red-600 font-bold block">#HAL-{p.idHallazgo}</span><span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{hallazgoAsociado?.sede || 'Hotel'}</span></td>
                  <td className="p-3 font-bold">{p.accion}</td><td className="p-3 font-mono">{p.fecha}</td>
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

  const renderIncidentes = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">🚨 Eventos de Pérdida</h2></div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase">➕ Reportar Evento</h3>
        <form onSubmit={handleIncidenteSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div><label className="font-bold text-gray-600">Riesgo Vinculado</label><select name="idRiesgo" required className="w-full border rounded-lg p-2 mt-1 bg-white">{safeRiesgos.map((r, index) => <option key={`opt-incidente-${r.id}-${index}`} value={r.id}>[ID: {r.id}] {r.proceso}</option>)}</select></div>
          <div><label className="font-bold text-gray-600">Título</label><input name="titulo" required className="w-full border rounded-lg p-2 mt-1" /></div>
          <div><label className="font-bold text-gray-600">Pérdida (COP)</label><input name="costo" type="number" required className="w-full border rounded-lg p-2 mt-1" /></div>
          <div className="md:col-span-2"><label className="font-bold text-gray-600">Descripción</label><textarea name="descripcion" required className="w-full border rounded-lg p-2 mt-1" rows="2"></textarea></div>
          <div><label className="font-bold text-gray-600">Impacto</label><select name="impacto" className="w-full border rounded-lg p-2 mt-1 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
          <div className="md:col-span-3 flex justify-end"><button type="submit" className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow-md">Guardar Evento</button></div>
        </form>
      </div>
    </div>
  );

  const renderInforme = () => (
    <div className="space-y-6">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800">📜 Logs del Sistema</h2></div>
      <p className="text-xs text-slate-500">Módulo de trazabilidad activo de base de datos.</p>
    </div>
  );

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

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800"><span className="text-2xl">🛡️</span><div><h1 className="text-sm font-bold tracking-wide">GCM Auditor v5</h1><p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">{user.email}</p></div></div>
        <nav className="flex-1 px-4 py-4 space-y-1 text-xs font-medium overflow-y-auto">
          {[
            { id: 'tablero', icon: '📊', label: 'Tablero Analítico' },
            { id: 'dashboard_riesgos', icon: '📈', label: 'Dashboard Inteligente' },
            { id: 'riesgos', icon: '⚠️', label: 'Matriz de Riesgos' },
            { id: 'evaluaciones', icon: '🔬', label: 'Auditoría de Controles' },
            { id: 'hallazgos', icon: '📄', label: 'Hallazgos' },
            { id: 'planes', icon: '✅', label: 'Planes de Acción' },
            { id: 'incidentes', icon: '🚨', label: 'Eventos de Pérdida' },
            { id: 'informe', icon: '📜', label: 'Trazabilidad' }
          ].map((tab, index) => (
            <button key={`nav-${tab.id}-${index}`} onClick={() => setActiveTab(tab.id)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center space-x-2 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800"><button onClick={handleLogout} className="w-full text-[10px] text-slate-300 border border-slate-700/50 rounded-lg py-1.5 font-bold flex items-center justify-center space-x-1"><span>🚪</span> <span>Cerrar Sesión</span></button></div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white border-b h-16 flex items-center justify-between px-8 shadow-sm"><span className="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-mono font-bold">Termales de Santa Rosa</span></header>
        <main className="flex-grow overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'tablero' && renderTablero()}
            {activeTab === 'dashboard_riesgos' && renderDashboardRiesgos()}
            {activeTab === 'riesgos' && renderRiesgos()}
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