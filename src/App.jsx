import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// =====================================================================
// COMPONENTE DE MANEJO DE ERRORES (PROTECCIÓN)
// =====================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg m-4 text-sm font-bold">
          Algo salió mal en este módulo: {this.state.error?.message || "Error desconocido"}
        </div>
      );
    }
    return this.props.children;
  }
}

// =====================================================================
// CONFIGURACIÓN DE FIREBASE
// =====================================================================
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

const ADMIN_EMAILS = [
  "controlinterno@termales.com.co",
  "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co",
  "analista.controlinterno@termales.com.co"
];

export default function App() {
  // --- ESTADOS DE CONTROL Y NAVEGACIÓN ---
  const [activeTab, setActiveTab] = useState('plan_anual'); // Iniciamos en la vista de la captura
  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- ESTADOS DE FILTROS (INDIVIDUALES POR COLUMNA COMO EN LA IMAGEN) ---
  const [filtroId, setFiltroId] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroProceso, setFiltroProceso] = useState('');
  const [filtroEnfoque, setFiltroEnfoque] = useState('');

  // --- ESTADO DEL FORMULARIO DE AGREGAR PROCESO ---
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoPeriodo, setNuevoPeriodo] = useState('');
  const [nuevoProceso, setNuevoProceso] = useState('');
  const [nuevoEnfoque, setNuevoEnfoque] = useState('');
  const [nuevoCumplimiento, setNuevoCumplimiento] = useState(100);

  // --- DATA DEL CRONOGRAMA TÉCNICO EXACTA DE LA IMAGEN ---
  const [cronograma, setCronograma] = useState([
    {
      id: '0 01',
      periodo: 'Enero - Febrero',
      proceso: 'Operaciones Alojamiento y recreación.',
      enfoque: 'Hotel/Ecoparque (Rentabilidad AyB), Inventarios, Auditoría Locativa e Infraestructura, Calidad, Taquilla, Manillas, Estandarización de procesos y alimentación.',
      cumplimiento: 100
    },
    {
      id: '0 02',
      periodo: 'Marzo - Abril',
      proceso: 'Servicio al cliente',
      enfoque: 'Hotel/Ecoparque Análisis de Quejas y Reclamos, Verificación de efectividad de planos de acción y análisis de raíz de las cosas.',
      cumplimiento: 80
    },
    {
      id: '0 03',
      periodo: 'Marzo - Abril',
      proceso: 'Cartera (Notas Crédito y Descuentos)',
      enfoque: 'Verificación del comportamiento de NC en los procesos que generan estos documentos en la operación, análisis de cumplimiento de procedimientos y trazabilidad.',
      cumplimiento: 100
    }
  ]);

  // --- DATA DE KRIs EXACTA DE LA IMAGEN ---
  const [kris, setKris] = useState([
    { nombre: 'ARQUEOS DE CAJA', actual: 117, total: 120 },
    { nombre: 'INVENTARIO MANILLAS', actual: 16, total: 20 },
    { nombre: 'NOTAS CRÉDITO (AUDIT)', actual: 4, total: 10 }
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (error) {
      setAuthError('Error de autenticación. Verifique sus credenciales.');
    } 
  }; 
  
  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleAgregarProceso = (e) => {
    e.preventDefault();
    if (!nuevoCodigo || !nuevoProceso) return;
    const nuevo = {
      id: nuevoCodigo,
      periodo: nuevoPeriodo,
      proceso: nuevoProceso,
      enfoque: nuevoEnfoque,
      cumplimiento: Number(nuevoCumplimiento) || 0
    };
    setCronograma([...cronograma, nuevo]);
    setNuevoCodigo('');
    setNuevoPeriodo('');
    setNuevoProceso('');
    setNuevoEnfoque('');
    setNuevoCumplimiento(100);
  };

  const handleEliminarProceso = (id) => {
    setCronograma(cronograma.filter(p => p.id !== id));
  };

  // --- FILTRADO AVANZADO DE LA TABLA ---
  const cronogramaFiltrado = cronograma.filter(item => {
    return item.id.toLowerCase().includes(filtroId.toLowerCase()) &&
           item.periodo.toLowerCase().includes(filtroPeriodo.toLowerCase()) &&
           item.proceso.toLowerCase().includes(filtroProceso.toLowerCase()) &&
           item.enfoque.toLowerCase().includes(filtroEnfoque.toLowerCase());
  });

  // =====================================================================
  // VISTA PRINCIPAL: PLAN ANUAL DE AUDITORÍA 2026
  // =====================================================================
  const renderPlanAnualAuditoria = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* BANNER PRINCIPAL VERDE */}
        <div className="bg-[#034838] text-white p-6 rounded-2xl flex justify-between items-center shadow-md">
          <div className="flex items-center space-x-4">
            <div className="bg-white text-[#034838] rounded-full h-10 w-10 flex items-center justify-center font-black text-lg shadow-sm">
              T
            </div>
            <h2 className="text-xl font-bold uppercase tracking-wider">Plan Anual de Auditoría 2026</h2>
          </div>
          <div className="bg-[#005e46] px-4 py-2 rounded-xl flex items-center space-x-3 border border-emerald-500/30">
            <span className="text-xl font-black">93 %</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-200 block leading-tight">Cumplimiento<br/>Global</span>
          </div>
        </div>

        {/* DISTRIBUCIÓN EN PANALES (ÍNDICE, GESTOR KRIS Y CRONOGRAMA) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUMNA IZQUIERDA: ÍNDICE Y KRIS */}
          <div className="space-y-6">
            
            {/* CARD: ÍNDICE GENERAL */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm text-center">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left mb-2">Índice General</h3>
              <div className="text-5xl font-black text-[#034838] my-3">93 %</div>
              <div className="text-emerald-600 text-xs font-bold flex items-center justify-center space-x-1 mb-3">
                <span>▲ Meta Alcanzada</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-2 border-t pt-3">
                Evaluación integral de procesos administrativos, operativos y de soporte.
              </p>
            </div>

            {/* CARD: GESTOR DE KRIS */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="bg-[#034838] text-white p-3 px-4 flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-wider">Gestor de Kris</span>
                <button className="bg-white/20 hover:bg-white/30 text-white rounded-md h-5 w-5 flex items-center justify-center text-xs font-bold">+</button>
              </div>
              <div className="p-4 space-y-5">
                {kris.map((kri, index) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 tracking-tight">{kri.nombre}</span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 font-mono">
                      {kri.actual} <span className="text-slate-400 font-normal">/{kri.total}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA GRANDE: CRONOGRAMA TÉCNICO */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              
              {/* HEADER TABLA */}
              <div className="bg-[#1e293b] text-white p-3 px-4 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-[11px] font-black uppercase tracking-wider">
                  <span>📋 Cronograma Técnico</span>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold border border-emerald-800 px-2 py-0.5 rounded-full">
                  93 % Auditado
                </span>
              </div>

              {/* CONTENEDOR TABLA */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b uppercase text-[9px] tracking-wider">
                      <th className="p-3 pl-4 w-24">Identificación</th>
                      <th className="p-3 w-28">Periodo</th>
                      <th className="p-3 w-44">Área / Proceso</th>
                      <th className="p-3">Enfoque Técnico y Alcance</th>
                      <th className="p-3 text-center">Cumpl.</th>
                      <th className="p-3 text-center w-16">Acción</th>
                    </tr>
                    {/* FILTROS INTEGRADOS EXACTOS A LA IMAGEN */}
                    <tr className="bg-slate-50/50 border-b">
                      <td className="p-1 pl-4">
                        <input type="text" value={filtroId} onChange={e => setFiltroId(e.target.value)} placeholder="IDENTIFICACIÓN..." className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-slate-400" />
                      </td>
                      <td className="p-1">
                        <input type="text" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} placeholder="Filtrar..." className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-slate-400" />
                      </td>
                      <td className="p-1">
                        <input type="text" value={filtroProceso} onChange={e => setFiltroProceso(e.target.value)} placeholder="Filtrar..." className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-slate-400" />
                      </td>
                      <td className="p-1">
                        <input type="text" value={filtroEnfoque} onChange={e => setFiltroEnfoque(e.target.value)} placeholder="Filtrar..." className="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:border-slate-400" />
                      </td>
                      <td className="p-1"></td>
                      <td className="p-1"></td>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {cronogramaFiltrado.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4 font-mono text-slate-400 font-bold">{item.id}</td>
                        <td className="p-3 text-slate-500 font-semibold">{item.periodo}</td>
                        <td className="p-3 font-bold text-slate-900 leading-tight">{item.proceso}</td>
                        <td className="p-3 text-slate-500 text-[10.5px] leading-relaxed">{item.enfoque}</td>
                        <td className="p-3 text-center font-black text-emerald-600 text-xs">
                          {item.cumplimiento}%
                        </td>
                        <td className="p-3 text-center space-x-2">
                          <button className="text-slate-400 hover:text-blue-600 transition-colors">✏️</button>
                          <button onClick={() => handleEliminarProceso(item.id)} className="text-slate-300 hover:text-red-600 transition-colors">🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {cronogramaFiltrado.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-slate-400 italic bg-slate-50/30">
                          No se encontraron registros que coincidan con los filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </div>

        {/* SECCIÓN INFERIOR: AGREGAR PROCESO AL CRONOGRAMA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="text-xs font-black text-[#034838] uppercase tracking-wider flex items-center space-x-1 mb-4">
            <span>+</span> <span>Agregar Proceso al Cronograma</span>
          </h3>
          <form onSubmit={handleAgregarProceso} className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs font-semibold text-slate-600">
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">Código ID</label>
              <input type="text" required value={nuevoCodigo} onChange={e => setNuevoCodigo(e.target.value)} placeholder="Ej: 0 04" className="w-full border rounded-lg p-2 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">Periodo Texto</label>
              <input type="text" required value={nuevoPeriodo} onChange={e => setNuevoPeriodo(e.target.value)} placeholder="Ej: Mayo - Junio" className="w-full border rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">Área / Proceso</label>
              <input type="text" required value={nuevoProceso} onChange={e => setNuevoProceso(e.target.value)} placeholder="Nombre del proceso" className="w-full border rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-slate-400 mb-1">Enfoque Técnico y Alcance</label>
              <input type="text" required value={nuevoEnfoque} onChange={e => setNuevoEnfoque(e.target.value)} placeholder="Descripción del alcance..." className="w-full border rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-[#034838] hover:bg-[#003b2d] text-white p-2 rounded-lg font-bold transition-all shadow-sm">
                Insertar al Plan
              </button>
            </div>
          </form>
        </div>

      </div>
    );
  };

  // --- RENDERS OPCIONALES PARA OTRAS PESTAÑAS (MOCKUP) ---
  const renderGenerico = (titulo) => (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
      <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
      <p className="text-xs text-slate-500">Módulo en desarrollo y sincronizado con el entorno de Auditoría GCM v5.</p>
    </div>
  );

  // --- LOGIN SECURITY GUARD ---
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-12">
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-2xl">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900">Auditor GCM v5</h2>
            <p className="text-[10px] text-emerald-700 font-black uppercase tracking-widest mt-1">Termales GRC Platform</p>
          </div>
          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            {authError && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold">{authError}</div>}
            <div className="space-y-3 text-xs font-bold text-slate-500">
              <div>
                <label className="text-[10px] uppercase">Correo Institucional</label>
                <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="controlinterno@termales.com.co" className="block w-full rounded-lg border px-3 py-2 mt-1 text-slate-800 font-medium focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase">Contraseña</label>
                <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="block w-full rounded-lg border px-3 py-2 mt-1 text-slate-800 focus:outline-none" />
              </div>
            </div>
            <button type="submit" className="w-full bg-[#0f172a] hover:bg-slate-800 p-2.5 rounded-lg text-xs font-bold text-white transition-all">
              Ingresar al Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden select-none">
      
      {/* MENÚ LATERAL COMPLETO DE LA IMAGEN EN image_c57cb7.jpg */}
      <div className="w-64 bg-[#111827] text-white flex flex-col shadow-xl border-r border-slate-800 z-10">
        <div className="p-5 flex items-center space-x-3 border-b border-slate-800/60 bg-[#0f172a]">
          <div className="bg-emerald-600 p-1.5 rounded-lg text-white font-black text-xs shadow-sm">
            🛡️
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xs font-black tracking-wide text-slate-100">Auditor GCM v5</h1>
            <p className="text-[9px] text-slate-400 font-medium truncate tracking-tight">{user.email}</p>
          </div>
        </div>

        {/* NAVEGACIÓN EXACTA EN ORDEN Y TEXTO */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 text-[11px] font-bold text-slate-300 overflow-y-auto custom-scrollbar">
          {[
            { id: 'tablero', label: 'Tablero Analítico', icon: '📊' },
            { id: 'panel_inteligente', label: 'Panel de control inteligente', icon: '⚙️' },
            { id: 'plan_anual', label: 'Plan Anual de Auditoría', icon: '📅' },
            { id: 'riesgos', label: 'Matriz de Riesgos', icon: '⚠️' },
            { id: 'apetito', label: 'Apetito de Riesgo', icon: '📈' },
            { id: 'controles', label: 'Auditoría de Controles', icon: '🔒' },
            { id: 'hallazgos', label: 'Hallazgos', icon: '🔎' },
            { id: 'planes_accion', label: 'Planes de Acción', icon: '✅' },
            { id: 'eventos_perdida', label: 'Eventos de Pérdida', icon: '📉' },
            { id: 'trazabilidad', label: 'Trazabilidad', icon: '⛓️' },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center space-x-2.5 transition-all ${
                  isSelected 
                    ? 'bg-[#004D40] text-white font-black border-l-4 border-emerald-400 shadow-inner' 
                    : 'hover:bg-slate-800/60 hover:text-white text-slate-400'
                }`}
              >
                <span className="text-xs opacity-80">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 bg-[#0f172a] border-t border-slate-800/80">
          <button onClick={handleLogout} className="w-full text-[10px] text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/40 rounded-lg py-2 font-bold transition-all">
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL DE TRABAJO */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER DE CONTROL SUPERIOR */}
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-0">
          <span className="bg-slate-100 text-slate-600 text-[10px] px-3 py-1 rounded-full font-bold tracking-wide">
            Termales de Santa Rosa de Cabal
          </span>
          <div className="flex items-center space-x-4 text-slate-500">
            <button className="relative text-xs hover:text-slate-800">🔔</button>
            <div className="h-7 w-7 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-black text-slate-600 border">
              CI
            </div>
          </div>
        </header>
        
        {/* CONTENEDOR DINÁMICO */}
        <main className="flex-grow overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              {activeTab === 'plan_anual' && renderPlanAnualAuditoria()}
              {activeTab === 'tablero' && renderGenerico('Tablero Analítico')}
              {activeTab === 'panel_inteligente' && renderGenerico('Panel de control inteligente')}
              {activeTab === 'riesgos' && renderGenerico('Matriz de Riesgos')}
              {activeTab === 'apetito' && renderGenerico('Apetito de Riesgo')}
              {activeTab === 'controles' && renderGenerico('Auditoría de Controles')}
              {activeTab === 'hallazgos' && renderGenerico('Hallazgos')}
              {activeTab === 'planes_accion' && renderGenerico('Planes de Acción')}
              {activeTab === 'eventos_perdida' && renderGenerico('Eventos de Pérdida')}
              {activeTab === 'trazabilidad' && renderGenerico('Trazabilidad')}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Nota de desarrollo: Se ha suprimido el contenedor flotante e inyecciones de script pertenecientes al Asistente IA */}
    </div>
  );
}