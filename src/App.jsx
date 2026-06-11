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
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 

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

// --- DATOS POR DEFECTO CON CAMPO PROGRESO ---
const defaultRiesgos = [
  { id: 98, categoria: 'Operativo', proceso: 'Alimentos y bebidas', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Afectación del sabor e higiene de alimentos por uso de insumos cárnicos de baja calidad.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío diaria e inspección organoléptica al recibir insumos.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe de Alimentos y Bebidas', historialCambios: [] },
  { id: 201, categoria: 'Tecnológico', proceso: 'Infraestructura TI', tipoRiesgo: 'Ciberseguridad', afectacion: 'Operacional', causaInmediata: 'Falta de parches de seguridad', causaRaiz: 'Obsolescencia de servidores locales', descripcion: 'Intrusión de ransomware que paralice el sistema hotelero de reservas.', probabilidadInherente: 'Posible', impactoInherente: 'Crítico', noControl: 'C-201', descripcionControl: 'Firewall activo con logs y copias de seguridad semanales inmutables.', probabilidadResidual: 'Posible', impactoResidual: 'Alto', responsable: 'CISO / Director de TI', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, ref: 'Aud. Interna TI-2026', titulo: 'Acceso de usuarios genéricos a la base de datos del ERP.', proceso: 'Sistemas', responsable: 'Jefe de TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', historialCambios: [] }
];

const defaultPlanes = [
  { id: 1, idHallazgo: 1, accion: 'Desactivar credenciales comunes y parametrizar roles individuales en base de datos.', responsable: 'Jefe de TI', fecha: '2026-07-15', estado: 'En Proceso', progreso: 65, historialCambios: [] }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('tablero');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('inherente'); 
  const [filtroAnio, setFiltroAnio] = useState('Todos');
  const [isThinking, setIsThinking] = useState(false); 

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
  const [filtroHeatMap, setFiltroHeatMap] = useState(null);

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
        setIsAdmin(ADMIN_EMAILS.some(email => email.toLowerCase().trim() === userEmailNormalized));
      } else { setIsAdmin(false); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);
    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        setRiesgos(data.riesgos || defaultRiesgos);
        setHallazgos(data.hallazgos || defaultHallazgos);
        setPlanes(data.planes || defaultPlanes);
        setIncidentes(data.incidentes || []);
        setEvaluaciones(data.evaluaciones || []);
      } else {
        setRiesgos(defaultRiesgos);
        setHallazgos(defaultHallazgos);
        setPlanes(defaultPlanes);
      }
      setIsCloudLoaded(true);
    });
    return () => unsubscribeSnapshot();
  }, [user]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault(); setAuthError('');
    try {
      if (isRegistering) { await createUserWithEmailAndPassword(auth, authEmail, authPassword); }
      else { await signInWithEmailAndPassword(auth, authEmail, authPassword); }
      showNotification("Sesión iniciada correctamente.");
    } catch { setAuthError('Error de autenticación. Verifique credenciales.'); }
  };

  const handleLogout = async () => { await signOut(auth); showNotification("Sesión cerrada."); };

  const saveToCloud = async (partialData) => {
    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    await setDoc(docRef, partialData, { merge: true });
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // --- LÓGICA DE IA GEMINI ---
  const sugerirConIA = async (tipoTarget) => {
    let textoBase = ""; let inputDestino = null;
    if (tipoTarget === 'control') {
      textoBase = document.querySelector('input[name="descripcion"]')?.value || "";
      inputDestino = document.querySelector('input[name="control"]');
    } else {
      const selectElement = document.querySelector('select[name="idHallazgo"]');
      textoBase = selectElement ? selectElement.options[selectElement.selectedIndex]?.text : "";
      inputDestino = document.querySelector('input[name="accion"]');
    }

    if (!textoBase || textoBase.trim() === '' || textoBase.includes('-- Seleccione --')) {
      showNotification("⚠️ Escribe algo para que la IA lo analice.", "error"); return;
    }
    if (!GEMINI_API_KEY) { showNotification("⚠️ Error de API Key.", "error"); return; }

    setIsThinking(true);
    try {
      const prompt = `Actúa como experto auditor corporativo ISO 31000. Escenario: "${textoBase}". Redacta una ${tipoTarget === 'control' ? 'descripción de un CONTROL mitigante' : 'ACCIÓN CORRECTIVA DE CHOQUE'}. Sé técnico y muy directo (máximo 15 palabras).`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
      });
      const data = await response.json();
      let sugerencia = data.candidates[0].content.parts[0].text.trim();
      if (inputDestino) { inputDestino.value = sugerencia; inputDestino.dispatchEvent(new Event('change', { bubbles: true })); }
      showNotification("✨ ¡IA Gemini ha respondido con éxito!");
    } catch { showNotification("Error conectando con la IA.", "error"); }
    finally { setIsThinking(false); }
  };

  // --- MATRIZ Y CÁLCULOS ---
  const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
  const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };

  const calcularMatriz5x5 = (probabilidad, impacto) => {
    const pVal = mapProbabilidadNum[probabilidad] || 3;
    const iVal = mapImpactoNum[impacto] || 2;
    const score = pVal * iVal;
    let color = "bg-emerald-500", label = "Aceptar", apetito = "Dentro de Apetito";
    if (score <= 4) { color = "bg-emerald-500"; }
    else if (score <= 9) { color = "bg-yellow-400"; label = "Monitorear"; }
    else if (score <= 16) { color = "bg-orange-500"; label = "Mitigar"; apetito = "Fuera de Apetito"; }
    else { color = "bg-red-600"; label = "Evitar"; apetito = "Fuera de Apetito"; }
    return { score, color, label, apetito };
  };

  const handleRiesgoSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin) return;
    const formData = new FormData(e.target);
    let updatedList;
    if (editRiesgo) {
      updatedList = safeRiesgos.map(r => r.id === editRiesgo.id ? { ...r, proceso: formData.get('proceso'), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion') } : r);
      setEditRiesgo(null);
    } else {
      const nuevo = { id: Date.now(), proceso: formData.get('proceso'), categoria: formData.get('categoria'), responsable: formData.get('responsable'), noControl: 'C-' + Math.floor(Math.random() * 900 + 100), descripcionControl: formData.get('control'), descripcion: formData.get('descripcion'), probabilidadInherente: 'Posible', impactoInherente: 'Medio', probabilidadResidual: 'Posible', impactoResidual: 'Medio' };
      updatedList = [...safeRiesgos, nuevo];
    }
    setRiesgos(updatedList); await saveToCloud({ riesgos: updatedList }); e.target.reset();
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin) return;
    const formData = new FormData(e.target);
    let updatedList;
    if (editHallazgo) {
      updatedList = safeHallazgos.map(h => h.id === editHallazgo.id ? { ...h, ref: formData.get('ref'), proceso: formData.get('proceso'), titulo: formData.get('titulo') } : h);
      setEditHallazgo(null);
    } else {
      const nuevo = { id: Date.now(), ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'), titulo: formData.get('titulo'), severidad: 'Medio', estado: 'Abierto', fecha: new Date().toISOString().split('T')[0] };
      updatedList = [...safeHallazgos, nuevo];
    }
    setHallazgos(updatedList); await saveToCloud({ hallazgos: updatedList }); e.target.reset();
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault(); if (!isAdmin) return;
    const formData = new FormData(e.target);
    const progresoValor = parseInt(formData.get('progreso') || 0);
    let updatedList;
    if (editPlan) {
      updatedList = safePlanes.map(p => p.id === editPlan.id ? { ...p, accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoValor, estado: progresoValor === 100 ? 'Cerrado' : 'En Proceso' } : p);
      setEditPlan(null);
    } else {
      const nuevo = { id: Date.now(), idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'), responsable: formData.get('responsable'), fecha: formData.get('fecha'), progreso: progresoValor, estado: progresoValor === 100 ? 'Cerrado' : 'En Proceso' };
      updatedList = [...safePlanes, nuevo];
    }
    setPlanes(updatedList); await saveToCloud({ planes: updatedList }); e.target.reset();
  };

  const ProgressBar = ({ progress }) => {
    let color = "bg-red-500";
    if (progress > 30) color = "bg-amber-500";
    if (progress > 75) color = "bg-emerald-500";
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
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
          <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
            strokeDasharray={251} strokeDashoffset={251 - (251 * value) / 100}
            className={`${colorClass} transition-all duration-1000`} />
        </svg>
        <span className="absolute text-xl font-black text-slate-800">{Math.round(value)}%</span>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">{label}</p>
      <p className="text-xs font-bold text-slate-700">{sublabel}</p>
    </div>
  );

  const renderTablero = () => {
    const avanceGlobal = safePlanes.reduce((acc, p) => acc + (p.progreso || 0), 0) / (safePlanes.length || 1);
    const efectividadControles = safeEvaluaciones.length > 0 ? (safeEvaluaciones.filter(e => e.calificacion === 100).length / safeEvaluaciones.length) * 100 : 85;
    const hAbiertos = safeHallazgos.filter(h => h.estado === 'Abierto').length;

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="border-b pb-4">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Consola de Control GCM</h2>
          <p className="text-sm text-slate-500 font-medium">Fase 5: Automatización de Avances e Indicadores KRI.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Gauge value={avanceGlobal} label="Mitigación Global" sublabel="Planes de Acción" colorClass="text-blue-600" />
          <Gauge value={efectividadControles} label="Salud Controles" sublabel="Test Auditoría" colorClass="text-emerald-500" />
          <div className="bg-slate-900 p-6 rounded-3xl shadow-xl flex flex-col justify-center text-white">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Estado Crítico</p>
            <h3 className="text-5xl font-black mt-2">{hAbiertos}</h3>
            <p className="text-sm opacity-70 mt-2 font-medium">Hallazgos Abiertos pendientes de gestión inmediata.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardRiesgos = () => {
    const esRes = tipoMatriz === 'residual';
    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];
    const contarCelda = (imp, prob) => safeRiesgos.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex justify-between items-center border-b pb-4">
          <h2 className="text-2xl font-black text-slate-800">Mapa de Calor Predictivo</h2>
          <div className="bg-white p-1 rounded-xl border flex">
            <button onClick={() => setTipoMatriz('inherente')} className={`px-4 py-1 rounded-lg text-xs font-bold ${!esRes ? 'bg-slate-950 text-white' : 'text-slate-500'}`}>Inherente</button>
            <button onClick={() => setTipoMatriz('residual')} className={`px-4 py-1 rounded-lg text-xs font-bold ${esRes ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Residual</button>
          </div>
        </div>
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 w-full max-w-2xl mx-auto">
          <div></div>
          {probabilidades.map(p => <div key={p} className="text-center font-bold text-[10px] uppercase text-slate-400">{p}</div>)}
          {impactos.map(imp => (
            <React.Fragment key={imp}>
              <div className="font-bold text-[10px] uppercase text-slate-400 flex items-center justify-end pr-2">{imp}</div>
              {probabilidades.map(prob => {
                const count = contarCelda(imp, prob);
                const { color } = calcularMatriz5x5(prob, imp);
                return (
                  <div key={prob} onClick={() => {
                    if (count > 0) {
                      setFiltroHeatMap({ impacto: imp, probabilidad: prob });
                      setTimeout(() => { document.getElementById('detalle-heatmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
                    }
                  }} className={`h-16 rounded-xl flex items-center justify-center font-black text-xl text-slate-900 cursor-pointer ${color} bg-opacity-30 border hover:scale-105 transition-all`}>
                    {count}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        {filtroHeatMap && (
          <div id="detalle-heatmap" className="mt-8 bg-white p-6 rounded-2xl border">
            <h4 className="font-black text-sm text-slate-800 mb-4">Riesgos en cuadrante: {filtroHeatMap.probabilidad} - {filtroHeatMap.impacto}</h4>
            <button onClick={() => setFiltroHeatMap(null)} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold">Limpiar Filtro</button>
          </div>
        )}
      </div>
    );
  };

  const renderRiesgos = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">Estructura de Riesgos</h2>
      {isAdmin && (
        <form onSubmit={handleRiesgoSubmit} className="bg-white p-6 rounded-2xl border space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="font-bold">Proceso</label><input name="proceso" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold">Responsable</label><input name="responsable" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div>
              <label className="font-bold flex justify-between"><span>Control Clave</span><button type="button" onClick={() => sugerirConIA('control')} className="text-purple-600 font-bold">🤖 Generar IA</button></label>
              <input name="control" required className="w-full border rounded-lg p-2 mt-1" />
            </div>
          </div>
          <div className="w-full"><label className="font-bold">Descripción Evento</label><input name="descripcion" required className="w-full border rounded-lg p-2 mt-1" /></div>
          <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg">Guardar Riesgo</button>
        </form>
      )}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white"><tr><th className="p-3">ID</th><th className="p-3">Proceso</th><th className="p-3">Descripción / Control</th></tr></thead>
          <tbody>
            {safeRiesgos.map(r => (
              <tr key={r.id} className="border-b">
                <td className="p-3 font-bold">#{r.id}</td><td className="p-3 font-bold">{r.proceso}</td>
                <td className="p-3"><div>{r.descripcion}</div><div className="text-slate-500 italic mt-1">⚙️ Control: {r.descripcionControl}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHallazgos = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">Hallazgos e Inconformidades</h2>
      {isAdmin && (
        <form onSubmit={handleHallazgoSubmit} className="bg-white p-6 rounded-2xl border space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="font-bold">Referencia</label><input name="ref" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold">Proceso</label><input name="proceso" required className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold">Título del Hallazgo</label><input name="titulo" required className="w-full border rounded-lg p-2 mt-1" /></div>
          </div>
          <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg">Guardar Hallazgo</button>
        </form>
      )}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white"><tr><th className="p-3">Ref</th><th className="p-3">Proceso</th><th className="p-3">Título</th></tr></thead>
          <tbody>
            {safeHallazgos.map(h => (
              <tr key={h.id} className="border-b"><td className="p-3 font-bold">{h.ref}</td><td className="p-3">{h.proceso}</td><td className="p-3">{h.titulo}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlanes = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800">Planes de Acción Corregidos</h2>
      {isAdmin && (
        <form onSubmit={handlePlanSubmit} className="bg-white p-6 rounded-2xl border space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="font-bold">Hallazgo Vinculado</label><select name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} className="w-full border rounded-lg p-2 mt-1 bg-white">{safeHallazgos.map(h => <option key={h.id} value={h.id}>[{h.ref}] {h.titulo}</option>)}</select></div>
            <div>
              <label className="font-bold flex justify-between"><span>Acción Correctiva</span><button type="button" onClick={() => sugerirConIA('plan')} className="text-purple-600 font-bold">🤖 Plan IA</button></label>
              <input name="accion" defaultValue={editPlan?.accion||''} required className="w-full border rounded-lg p-2 mt-1" />
            </div>
            <div><label className="font-bold">Porcentaje de Avance (KRI)</label><input type="number" min="0" max="100" name="progreso" defaultValue={editPlan?.progreso||0} className="w-full border rounded-lg p-2 mt-1" /></div>
            <div><label className="font-bold">Fecha Compromiso</label><input type="date" name="fecha" defaultValue={editPlan?.fecha||''} className="w-full border rounded-lg p-2 mt-1" /></div>
          </div>
          <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg">Asignar / Actualizar Plan</button>
        </form>
      )}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900 text-white"><tr><th className="p-3">Acción</th><th className="p-3">Estado</th><th className="p-3 w-48">Avance</th><th className="p-3">Acciones</th></tr></thead>
          <tbody>
            {safePlanes.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-3"><div>{p.accion}</div><div className="text-[10px] text-slate-400 mt-1">Límite: {p.fecha}</div></td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.estado === 'Cerrado' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{p.estado}</span></td>
                <td className="p-3"><ProgressBar progress={p.progreso || 0} /></td>
                <td className="p-3"><button onClick={() => { setEditPlan(p); scrollToTop(); }} className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold">Modificar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl space-y-6">
          <div className="text-center"><h2 className="text-3xl font-black text-slate-900">GCM Auditor v5</h2><p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">Fase 5 Dashboard</p></div>
          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {authError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">⚠️ {authError}</div>}
            <div><label className="text-[10px] font-bold uppercase text-slate-400">Correo Corporativo</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full border rounded-lg p-2.5 mt-1 text-xs"/></div>
            <div><label className="text-[10px] font-bold uppercase text-slate-400">Contraseña</label><input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full border rounded-lg p-2.5 mt-1 text-xs"/></div>
            <button type="submit" className="w-full bg-slate-900 text-white p-3 rounded-lg font-bold text-xs">Acceder al Ecosistema</button>
          </form>
        </div>
      </div>
    );
  }

  if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-slate-950 text-white flex-col space-y-2"><span className="text-4xl animate-bounce">☁️</span><p className="text-xs uppercase font-bold tracking-widest">Inyectando KRIs...</p></div>);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <div className="w-64 bg-slate-950 text-white flex flex-col justify-between p-6 shadow-2xl">
        <div className="space-y-8">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-4"><span className="text-xl">🛡️</span><h1 className="text-sm font-black tracking-wide">GCM Auditor v5</h1></div>
          <nav className="space-y-2 text-xs font-bold text-slate-400">
            <button onClick={() => setActiveTab('tablero')} className={`w-full text-left p-3 rounded-xl flex items-center space-x-2 ${activeTab === 'tablero' ? 'bg-blue-600 text-white' : 'hover:bg-slate-900'}`}><span>📊</span><span>Consola KRI</span></button>
            <button onClick={() => setActiveTab('dashboard_riesgos')} className={`w-full text-left p-3 rounded-xl flex items-center space-x-2 ${activeTab === 'dashboard_riesgos' ? 'bg-blue-600 text-white' : 'hover:bg-slate-900'}`}><span>📈</span><span>Mapa Calor</span></button>
            <button onClick={() => setActiveTab('riesgos')} className={`w-full text-left p-3 rounded-xl flex items-center space-x-2 ${activeTab === 'riesgos' ? 'bg-blue-600 text-white' : 'hover:bg-slate-900'}`}><span>⚠️</span><span>Estructura Riesgos</span></button>
            <button onClick={() => setActiveTab('hallazgos')} className={`w-full text-left p-3 rounded-xl flex items-center space-x-2 ${activeTab === 'hallazgos' ? 'bg-blue-600 text-white' : 'hover:bg-slate-900'}`}><span>📄</span><span>Hallazgos</span></button>
            <button onClick={() => setActiveTab('planes')} className={`w-full text-left p-3 rounded-xl flex items-center space-x-2 ${activeTab === 'planes' ? 'bg-blue-600 text-white' : 'hover:bg-slate-900'}`}><span>✅</span><span>Planes Acción</span></button>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-xs text-red-400 border border-red-900/30 p-2 rounded-lg font-bold hover:bg-red-950/20">Cerrar Sistema</button>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'tablero' && renderTablero()}
          {activeTab === 'dashboard_riesgos' && renderDashboardRiesgos()}
          {activeTab === 'riesgos' && renderRiesgos()}
          {activeTab === 'hallazgos' && renderHallazgos()}
          {activeTab === 'planes' && renderPlanes()}
        </div>
      </div>
    </div>
  );
}