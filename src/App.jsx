import React, { useState, useMemo } from 'react';
import { 
  BarChart3, Shield, AlertTriangle, CheckCircle2, 
  XCircle, Calendar, Users, FileText, TrendingUp, 
  Layers, Settings, LogOut, ChevronRight, HelpCircle,
  Filter, Check, SlidersHorizontal
} from 'lucide-react';

// ==========================================
// 1. DATOS SIMULADOS POR DEFECTO (PRODUCCIÓN)
// ==========================================
const SECTOR_OPTIONS = ["Alojamiento", "Alimentos y Bebidas", "Spa y Relajación", "Mantenimiento", "Administración"];
const SEDE_OPTIONS = ["Sede Principal (Termales)", "Sede Hotel", "Sede Eco-Parque"];

const INITIAL_RIESGOS = [
  { id: 1, proceso: "Alimentos y Bebidas", descripcion: "Contaminación cruzada en la cocina principal por ruptura de cadena de frío.", impacto: "Catastrófico", probabilidad: "Alta", score: 20, apetito: "Crítico", control: "Monitoreo digital de temperatura 24/7 y auditorías semanales de sanidad.", sede: "Sede Principal (Termales)", anio: 2025, mes: "Mayo" },
  { id: 2, proceso: "Alojamiento", descripcion: "Falla general en el software de reservas que provoque sobreventa masiva.", impacto: "Mayor", probabilidad: "Media", score: 12, apetito: "Fuera de Apetito", control: "Servidor espejo en la nube con respaldo automático cada 10 minutos.", sede: "Sede Hotel", anio: 2025, mes: "Mayo" },
  { id: 3, proceso: "Mantenimiento", descripcion: "Fuga de agua termal en tuberías principales por falta de mantenimiento preventivo.", impacto: "Moderado", probabilidad: "Alta", score: 12, apetito: "Fuera de Apetito", control: "Plan de inspección por ultrasonido programado de forma trimestral.", sede: "Sede Principal (Termales)", anio: 2025, mes: "Junio" },
  { id: 4, proceso: "Spa y Relajación", descripcion: "Reacción alérgica de clientes por uso de productos vencidos o sin rotulación.", impacto: "Mayor", probabilidad: "Baja", score: 10, apetito: "Fuera de Apetito", control: "Kardex de inventario estricto con alertas automáticas de caducidad a los 90 días.", sede: "Sede Eco-Parque", anio: 2026, mes: "Enero" },
  { id: 5, proceso: "Administración", descripcion: "Fuga de información confidencial de clientes por credenciales débiles en el staff.", impacto: "Moderado", probabilidad: "Baja", score: 6, apetito: "Monitoreo", control: "Capacitación obligatoria en phishing y políticas de contraseñas seguras.", sede: "Sede Principal (Termales)", anio: 2026, mes: "Febrero" }
];

const INITIAL_HALLAZGOS = [
  { id: 1, proceso: "Alimentos y Bebidas", titulo: "Termómetros descalibrados en cavas de congelación", severidad: "Alta", estado: "Abierto", sede: "Sede Principal (Termales)", anio: 2025, mes: "Mayo" },
  { id: 2, proceso: "Alojamiento", titulo: "Falta de bitácora de contingencia para recepción nocturna", severidad: "Media", estado: "En Proceso", sede: "Sede Hotel", anio: 2025, mes: "Mayo" },
  { id: 3, proceso: "Mantenimiento", titulo: "Válvulas de presión sin sello de inspección vigente", severidad: "Alta", estado: "Abierto", sede: "Sede Principal (Termales)", anio: 2025, mes: "Junio" }
];

const INITIAL_PLANES = [
  { id: 1, hallazgoId: 1, accion: "Comprar 4 termómetros digitales certificados y calibrar mensualmente.", avance: 40, estado: "En Ejecución", fechaVence: "2025-08-15", anio: 2025, mes: "Mayo" },
  { id: 2, hallazgoId: 2, accion: "Diseñar e implementar el manual impreso para caída del sistema de reservas.", avance: 100, estado: "Finalizado", fechaVence: "2025-06-01", anio: 2025, mes: "Mayo" },
  { id: 3, hallazgoId: 3, accion: "Contratar proveedor externo para certificación de la línea de calderas.", avance: 15, estado: "Retrasado", fechaVence: "2025-07-20", anio: 2025, mes: "Junio" }
];

export default function App() {
  // --- ESTADOS PRINCIPALES ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAdmin, setIsAdmin] = useState(true); // Cambiar para alternar vistas (Admin / Portal Jefes)
  const [riesgos, setRiesgos] = useState(INITIAL_RIESGOS);
  const [hallazgos, setHallazgos] = useState(INITIAL_HALLAZGOS);
  const [planes, setPlanes] = useState(INITIAL_PLANES);

  // --- NUEVOS FILTROS DE SELECCIÓN MÚLTIPLE ---
  const [selectedAnios, setSelectedAnios] = useState([2025, 2026]); // Por defecto todos seleccionados
  const [selectedMeses, setSelectedMeses] = useState(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]);
  const [selectedSede, setSelectedSede] = useState("Todos");

  // --- ESTADOS PARA FORMULARIOS ---
  const [newRiesgo, setNewRiesgo] = useState({ proceso: "Alojamiento", descripcion: "", impacto: "Moderado", probabilidad: "Media", control: "", sede: "Sede Principal (Termales)", anio: 2026, mes: "Junio" });
  const [newHallazgo, setNewHallazgo] = useState({ proceso: "Alojamiento", titulo: "", severidad: "Media", estado: "Abierto", sede: "Sede Principal (Termales)", anio: 2026, mes: "Junio" });
  const [newPlan, setNewPlan] = useState({ hallazgoId: "", accion: "", avance: 0, estado: "En Ejecución", fechaVence: "", anio: 2026, mes: "Junio" });
  const [notifications, setNotifications] = useState([]);

  // --- UTILIDADES ---
  const showNotification = (msg, type = "success") => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  // --- MANEJADORES DE FILTROS MÚLTIPLES ---
  const toggleAnio = (anio) => {
    if (selectedAnios.includes(anio)) {
      if (selectedAnios.length > 1) setSelectedAnios(prev => prev.filter(a => a !== anio));
    } else {
      setSelectedAnios(prev => [...prev, { anio }.anio]);
    }
  };

  const toggleMes = (mes) => {
    if (selectedMeses.includes(mes)) {
      if (selectedMeses.length > 1) setSelectedMeses(prev => prev.filter(m => m !== mes));
    } else {
      setSelectedMeses(prev => [...prev, mes]);
    }
  };

  // --- FILTRADO DE DATOS UNIFICADO ---
  const filteredRiesgos = useMemo(() => {
    return riesgos.filter(r => {
      const matchAnio = selectedAnios.includes(Number(r.anio));
      const matchMes = selectedMeses.includes(r.mes);
      const matchSede = selectedSede === "Todos" || r.sede === selectedSede;
      return matchAnio && matchMes && matchSede;
    });
  }, [riesgos, selectedAnios, selectedMeses, selectedSede]);

  const filteredHallazgos = useMemo(() => {
    return hallazgos.filter(h => {
      const matchAnio = selectedAnios.includes(Number(h.anio));
      const matchMes = selectedMeses.includes(h.mes);
      const matchSede = selectedSede === "Todos" || h.sede === selectedSede;
      return matchAnio && matchMes && matchSede;
    });
  }, [hallazgos, selectedAnios, selectedMeses, selectedSede]);

  const filteredPlanes = useMemo(() => {
    return planes.filter(p => {
      const matchAnio = selectedAnios.includes(Number(p.anio));
      const matchMes = selectedMeses.includes(p.mes);
      return matchAnio && matchMes;
    });
  }, [planes, selectedAnios, selectedMeses]);

  // --- CÁLCULO DE MÉTRICAS ANALÍTICAS ---
  const totalRiesgos = filteredRiesgos.length;
  const fueraApetito = filteredRiesgos.filter(r => r.apetito === "Fuera de Apetito" || r.apetito === "Crítico").length;
  const hallazgosCriticos = filteredHallazgos.filter(h => h.severidad === "Alta" && h.estado === "Abierto").length;
  const planesVencidos = filteredPlanes.filter(p => p.estado === "Retrasado").length;
  
  const promedioAvancePlanes = useMemo(() => {
    if (filteredPlanes.length === 0) return 0;
    const suma = filteredPlanes.reduce((acc, curr) => acc + Number(curr.avance), 0);
    return Math.round(suma / filteredPlanes.length);
  }, [filteredPlanes]);

  // --- CONTROLADORES DE EVENTOS (ACCIONES DE GUARDADO MANUAL) ---
  const handleSaveRiesgo = (e) => {
    e.preventDefault();
    if (!newRiesgo.descripcion.trim() || !newRiesgo.control.trim()) {
      showNotification("Por favor rellene todos los campos del riesgo.", "error");
      return;
    }
    const score = 12; // Cálculo interno por defecto
    const nuevo = {
      id: riesgos.length + 1,
      ...newRiesgo,
      score,
      apetito: "Fuera de Apetito"
    };
    setRiesgos(prev => [nuevo, ...prev]);
    setNewRiesgo({ proceso: "Alojamiento", descripcion: "", impacto: "Moderado", probabilidad: "Media", control: "", sede: "Sede Principal (Termales)", anio: 2026, mes: "Junio" });
    showNotification("Riesgo registrado y mapeado con éxito.");
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      
      {/* NOTIFICACIONES FLOTANTES */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => (
          <div key={n.id} className={`p-3 rounded-lg shadow-xl text-xs font-bold border flex items-center space-x-2 animate-bounce ${n.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            <span>{n.type === 'error' ? '❌' : '✨'}</span>
            <span>{n.msg}</span>
          </div>
        ))}
      </div>

      {/* BARRA LATERAL IZQUIERDA (DISEÑO CLÁSICO) */}
      <aside className="w-64 bg-[#0A192F] text-slate-300 flex flex-col justify-between shadow-2xl">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="bg-blue-500 p-2 rounded-lg text-white">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="font-black text-sm text-white tracking-wider">GCM AUDITOR</h1>
              <p className="text-[10px] text-slate-400 font-medium">Gestión de Riesgos | v5.2</p>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
              <BarChart3 size={16} /> <span>Dashboard Ejecutivo</span>
            </button>
            <button onClick={() => setActiveTab('riesgos')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'riesgos' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
              <Shield size={16} /> <span>Matriz de Riesgos</span>
            </button>
            <button onClick={() => setActiveTab('hallazgos')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'hallazgos' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
              <AlertTriangle size={16} /> <span>Hallazgos Registrados</span>
            </button>
            <button onClick={() => setActiveTab('planes')} className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'planes' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}>
              <Calendar size={16} /> <span>Planes de Acción</span>
            </button>
          </nav>
        </div>

        {/* INTERRUPTOR DE PERFIL (ADMIN / PORTAL LITE) */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Vista de Usuario</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">{isAdmin ? "👨‍💼 Auditor Admin" : "👥 Jefe de Área"}</span>
              <button onClick={() => setIsAdmin(!isAdmin)} className="text-[9px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300 font-bold transition-all">
                Cambiar
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 text-center font-semibold pt-1">
            SGR - Termales | 2026
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* ENCABEZADO SUPERIOR CON FILTROS DE SELECCIÓN MÚLTIPLE */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-slate-900">Consola de Mando Corporativa</h2>
              <p className="text-xs text-slate-500 font-medium">Monitoreo en tiempo real de la primera y segunda línea de defensa</p>
            </div>
            
            {/* Filtro de Sede */}
            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-black text-slate-500 pl-2 uppercase">Sede:</span>
              <select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} className="bg-white border-0 rounded text-xs font-bold text-slate-700 shadow-sm focus:ring-1 focus:ring-blue-500 py-1 px-3">
                <option value="Todos">Todas las Sedes</option>
                {SEDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* BARRA DE FILTROS AVANZADOS DE SELECCIÓN MÚLTIPLE (AÑOS Y MESES) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col space-y-2.5">
            <div className="flex items-center space-x-2 text-slate-700 font-black text-xs border-b border-slate-200 pb-1.5">
              <SlidersHorizontal size={14} className="text-blue-600" />
              <span>FILTROS MÚLTIPLES ACTIVOS (Haz clic para sumar o restar periodos al Dashboard)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              {/* Selección Múltiple de Años */}
              <div className="md:col-span-3 border-r border-slate-200/60 pr-2">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Años:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[2025, 2026].map(anio => {
                    const active = selectedAnios.includes(anio);
                    return (
                      <button key={anio} onClick={() => toggleAnio(anio)} className={`px-2.5 py-1 rounded text-xs font-black transition-all border flex items-center space-x-1 ${active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                        {active && <Check size={10} strokeWidth={3} />}
                        <span>{anio}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selección Múltiple de Meses */}
              <div className="md:col-span-9 pl-1">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Meses:</span>
                <div className="flex flex-wrap gap-1">
                  {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(mes => {
                    const active = selectedMeses.includes(mes);
                    return (
                      <button key={mes} onClick={() => toggleMes(mes)} className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all border flex items-center space-x-1 ${active ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                        {active && <span className="text-blue-400 text-[9px]">●</span>}
                        <span>{mes}</span>
                      </button>
                    );
                  })}
                  <button onClick={() => setSelectedMeses(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"])} className="text-[10px] font-black text-blue-600 hover:underline ml-2 self-center">
                    [Todos]
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* CUERPO CENTRAL CON DESPLIEGUE DINÁMICO */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* PESTAÑA 1: DASHBOARD EJECUTIVO */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* FILA DE INDICADORES DE ALTO NIVEL */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Riesgos Totales</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">{totalRiesgos}</h3>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-blue-600"><Shield size={22} /></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Fuera de Apetito</p>
                    <h3 className="text-2xl font-black text-red-600 mt-1">{fueraApetito}</h3>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-red-600"><AlertTriangle size={22} /></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Hallazgos Críticos</p>
                    <h3 className="text-2xl font-black text-purple-600 mt-1">{hallazgosCriticos}</h3>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg text-purple-600"><XCircle size={22} /></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Cumplimiento Planes</p>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">{promedioAvancePlanes}%</h3>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600"><CheckCircle2 size={22} /></div>
                </div>
              </div>

              {/* MATRIZ GRÁFICA / MAPA DE CALOR ISO 31000 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm md:col-span-7">
                  <h4 className="text-xs font-black text-slate-900 uppercase mb-4 flex items-center space-x-1.5">
                    <span>🗺️</span> <span>Mapa de Calor de Riesgos (Distribución Residual)</span>
                  </h4>
                  
                  {/* Cuadrícula de Calor Estructurada */}
                  <div className="space-y-1">
                    <div className="flex items-center text-[10px] font-bold text-slate-400"><span className="w-16">Alta</span> <div className="flex-1 grid grid-cols-3 gap-1"><div className="bg-amber-100 p-4 text-center font-black text-amber-700">1</div><div className="bg-orange-200 p-4 text-center font-black text-orange-700">2</div><div className="bg-red-600 p-4 text-center font-black text-white rounded-md shadow-sm">1</div></div></div>
                    <div className="flex items-center text-[10px] font-bold text-slate-400"><span className="w-16">Media</span> <div className="flex-1 grid grid-cols-3 gap-1"><div className="bg-emerald-100 p-4 text-center font-black text-emerald-700">1</div><div className="bg-amber-200 p-4 text-center font-black text-amber-700">0</div><div className="bg-orange-500 p-4 text-center font-black text-white">1</div></div></div>
                    <div className="flex items-center text-[10px] font-bold text-slate-400"><span className="w-16">Baja</span> <div className="flex-1 grid grid-cols-3 gap-1"><div className="bg-emerald-100 p-4 text-center font-black text-emerald-700">0</div><div className="bg-emerald-100 p-4 text-center font-black text-emerald-700">1</div><div className="bg-amber-100 p-4 text-center font-black text-amber-700">0</div></div></div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 pt-1 pl-16"><span>Bajo</span><span>Moderado</span><span>Crítico</span></div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-3 text-center">Cruzando los datos de los {selectedAnios.length} años y {selectedMeses.length} meses seleccionados.</p>
                </div>

                {/* TOP DE RIESGOS EN OBSERVACIÓN */}
                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm md:col-span-5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase mb-3">🔥 Riesgos Críticos Detectados</h4>
                    <div className="space-y-2">
                      {filteredRiesgos.slice(0, 3).map(r => (
                        <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 border-l-4 border-red-500 text-xs">
                          <div className="flex justify-between font-black text-slate-700">
                            <span>{r.proceso}</span> <span className="text-red-600">Score {r.score}</span>
                          </div>
                          <p className="text-slate-500 font-medium text-[11px] mt-0.5 line-clamp-2">{r.descripcion}</p>
                        </div>
                      ))}
                      {filteredRiesgos.length === 0 && <p className="text-xs text-slate-400 italic py-4 text-center">Ningún riesgo para el periodo seleccionado.</p>}
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('riesgos')} className="text-[11px] font-black text-blue-600 hover:underline mt-2 flex items-center space-x-1"><span>Ver matriz completa</span> <ChevronRight size={12}/></button>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 2: MATRIZ DE RIESGOS */}
          {activeTab === 'riesgos' && (
            <div className="space-y-6">
              
              {/* FORMULARIO DE ENTRADA MANUAL (SOLO ADMINS) */}
              {isAdmin && (
                <form onSubmit={handleSaveRiesgo} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5"><span>➕</span> <span>Registrar Evento de Riesgo Manual</span></h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">Proceso Relacionado</label>
                      <select value={newRiesgo.proceso} onChange={(e) => setNewRiesgo({...newRiesgo, proceso: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium py-2 px-3">
                        {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">Sede de Operación</label>
                      <select value={newRiesgo.sede} onChange={(e) => setNewRiesgo({...newRiesgo, sede: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium py-2 px-3">
                        {SEDE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">Año</label>
                        <select value={newRiesgo.anio} onChange={(e) => setNewRiesgo({...newRiesgo, anio: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium py-2 px-3">
                          <option value={2025}>2025</option>
                          <option value={2026}>2026</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">Mes</label>
                        <select value={newRiesgo.mes} onChange={(e) => setNewRiesgo({...newRiesgo, mes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium py-2 px-3">
                          {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">Descripción del Escenario / Evento</label>
                    <textarea value={newRiesgo.descripcion} onChange={(e) => setNewRiesgo({...newRiesgo, descripcion: e.target.value})} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Ej: Pérdida de agua termal por fisuras..."></textarea>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-500 uppercase mb-1">Control Clave Mitigante o Preventivo</label>
                    <textarea value={newRiesgo.control} onChange={(e) => setNewRiesgo({...newRiesgo, control: e.target.value})} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Escriba el control diseñado..."></textarea>
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-lg shadow transition-all">Guardar en Matriz</button>
                  </div>
                </form>
              )}

              {/* TABLA PRINCIPAL DE RIESGOS */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-black text-slate-500 tracking-wider">
                      <th className="p-4">ID</th>
                      <th className="p-4">Proceso / Sede</th>
                      <th className="p-4">Evento de Riesgo</th>
                      <th className="p-4">Criticidad</th>
                      <th className="p-4">Control Diseñado</th>
                      <th className="p-4">Periodo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {filteredRiesgos.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-all">
                        <td className="p-4 font-bold text-slate-400">#{r.id}</td>
                        <td className="p-4">
                          <span className="font-black text-slate-900 block">{r.proceso}</span>
                          <span className="text-[10px] text-slate-400 font-bold block">{r.sede}</span>
                        </td>
                        <td className="p-4 text-slate-600 font-normal max-w-xs">{r.descripcion}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${r.apetito === 'Crítico' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{r.apetito}</span>
                        </td>
                        <td className="p-4 text-slate-600 font-normal max-w-xs">{r.control}</td>
                        <td className="p-4"><span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[10px]">{r.mes} / {r.anio}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRiesgos.length === 0 && <p className="text-xs text-slate-400 italic py-8 text-center bg-white">No hay datos que coincidan con la combinación de filtros seleccionada.</p>}
              </div>
            </div>
          )}

          {/* PESTAÑA 3: HALLAZGOS */}
          {activeTab === 'hallazgos' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">📂 Registro General de Desviaciones</h3>
              <div className="space-y-3">
                {filteredHallazgos.map(h => (
                  <div key={h.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-sm text-slate-900">{h.titulo}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${h.severidad === 'Alta' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{h.severidad}</span>
                      </div>
                      <p className="text-xs text-slate-400 font-bold mt-1">{h.proceso} • {h.sede} • Periodo: {h.mes} {h.anio}</p>
                    </div>
                    <span className="bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-[10px] font-black text-slate-600">{h.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PESTAÑA 4: PLANES DE ACCIÓN */}
          {activeTab === 'planes' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">🗓️ Estado de Avance de Planes Remediales</h3>
              <div className="space-y-4">
                {filteredPlanes.map(p => (
                  <div key={p.id} className="space-y-1.5 p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                    <div className="flex justify-between text-xs font-black text-slate-800">
                      <span>{p.accion}</span>
                      <span className="text-blue-600">{p.avance}%</span>
                    </div>
                    {/* Barra de Progreso Clásica con Signo de % */}
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${p.avance}%` }}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">Vence: {p.fechaVence} • Estado Actual: <span className="text-slate-600">{p.estado}</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
