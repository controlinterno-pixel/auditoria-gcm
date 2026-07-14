import React, { useState } from 'react';

// 📚 LISTAS MAESTRAS EXTRAÍDAS DE LOS MANUALES OFICIALES DE TERMALES
const AUDITORES_OFICIALES = [
  "Rodolfo González",
  "Yehison Pineda",
  "Angelica Hernandez",
  "Luz Angela Chico"
];

const PROCESOS_OFICIALES = [
  "Gestión comercial",
  "Gestión de la mejora continua (SIGCAS)",
  "Gestión de mercadeo y comunicaciones",
  "Gestión de servicio al cliente",
  "Gestión estratégica",
 "Gestión de Operaciones",
"Gestión Administrativa y Financiera ",
"Gestión Talento Humano ",
  "I+D+i",
  "Subproceso alojamiento",
  "Subproceso alimentos y bebidas",
  "Subproceso compras",
  "Subproceso desarrollo de competencias",
  "Subproceso gestión administrativa",
  "Subproceso gestión de almacenes",
  "Subproceso gestión de cartera",
  "Subproceso gestión de contabilidad",
  "Subproceso gestión de costos",
  "Subproceso gestión de inventarios",
  "Subproceso gestión de tesorería",
  "Subproceso gestión del bienestar y la compensación",
  "Subproceso gestionar los activos fijos de la empresa",
  "Subproceso mantenimiento",
  "Subproceso recreación",
"Subproceso Seguridad y salud en trabajo",
"Subproceso Gestion de calidad",
"Subproceso Gestión Ambiental",
"Subproceso Control interno y Gestion de riesgos",
"Subproceso Proteccion de datos personales",
  "Subproceso selección, vinculación y administración de colaboradores",
  "Tecnologías de la información y la comunicación"
];

// 🏢 DICCIONARIO INTELIGENTE EN CASCADA (SEDE -> CARGOS)
// 🏢 DICCIONARIO INTELIGENTE EN CASCADA (SEDE -> CARGOS)
const CARGOS_POR_SEDE = {
  "Hotel": [
    "Líderes Hotel", "Subdirector de Operaciones Hotel", "Líder de Proceso de alimentos y bebidas",
    "Chef Hotel", "Supervisor (a) mesa y servicio", "Coordinación de recepción",
    "Supervisor (a) de operaciones", "Coordinación SPA", "Coordinador de Mantenimiento"
  ],
  "Ecoparque": [
    "Líderes Ecoparque", "Subdirección de Operaciones Balneario", "Líder táctico de alimentos y bebidas",
    "Jefe de Cocina", "Supervisor (a) mesa y servicio", "Coordinador Operaciones",
    "Supervisor Operaciones", "Coordinación SPA", "Terapeuta SPA", "Coordinador de mantenimiento",
    "Supervisor Ruta Ecológica"
  ],
  "Administrativos": [
    "Administrativos", "Gerente Administrativa y Judicial", "Auditoría Interna",
    "Líder Táctico de mejora Continua", "Coordinador de Servicio al Cliente", "Dirección Administrativa y Financiera",
    "Líder de de Compras y Almacen", "Líder de Costos y Presupuestos", "Líder de Tesorería y Cartera",
    "Contadora de Socios", "Coordinación Administrativa Family Office", "Jefe de control interno",
    "Líder de Contabilidad", "Contador", "Líder Administrativa", "Dirección de Mercadeo y Comunicaciones",
    "Coordinación de Mercadeo y Comunicaciones", "Dirección Comercial", "Coordinación Comercial y Contact Center",
    "Dirección Talento Humano", "Coordinación Seguridad Y Salud en el trabajo", "Líder de Gestión Ambiental",
    "Lider Tactico de Infraestructura Tecnológica", "Director de TICS", "Desarrollador Junior",
    "Líder Táctico desarrollo de Software", "Coordinador de Marketing digital"
  ]
};
export default function Hallazgos({
  isAdmin,
  informesAuditoria = [], 
  editHallazgo,
  setEditHallazgo,
  handleHallazgoSubmit,
  setFormResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  hFiltrados,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  FilterInput
}) {

// 🧭 ESTADOS DE NAVEGACIÓN (TABS Y ACORDEÓN)
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [grupoExpandido, setGrupoExpandido] = useState(new Date().getFullYear().toString());
  const [informeHistorialExpandido, setInformeHistorialExpandido] = useState(null);
// 🏢 NUEVOS ESTADOS PARA SEDES Y CARGOS MÚLTIPLES
  const [sedesMultiples, setSedesMultiples] = React.useState(['Administrativos']);
  const [sedeTemp, setSedeTemp] = React.useState('');
  
  const [responsablesMultiples, setResponsablesMultiples] = React.useState([]);
  const [responsableTemp, setResponsableTemp] = React.useState('');

  // 🧠 TRADUCTOR AUTOMÁTICO PARA EL BOTÓN "EDITAR"
  React.useEffect(() => {
    if (editHallazgo) {
      if (editHallazgo.sede) {
        setSedesMultiples(editHallazgo.sede.includes(',') ? editHallazgo.sede.split(',').map(s => s.trim()) : [editHallazgo.sede]);
      }
      if (editHallazgo.responsable) {
        setResponsablesMultiples(editHallazgo.responsable.includes(',') ? editHallazgo.responsable.split(',').map(r => r.trim()) : [editHallazgo.responsable]);
      }
    } else {
      setSedesMultiples(['Administrativos']);
      setResponsablesMultiples([]);
    }
  }, [editHallazgo]);

  // Consolidar todos los cargos de las sedes elegidas
  const cargosDisponibles = sedesMultiples.flatMap(s => CARGOS_POR_SEDE[s] || []);
  // 🎛️ ESTADOS DEL PANEL LATERAL (DASHBOARD)
  const [agruparPor, setAgruparPor] = useState('Año'); 
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroSeveridad, setDashFiltroSeveridad] = useState('Todos');
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroResponsable, setDashFiltroResponsable] = useState('Todos');

  // ⏳ ESTADOS LOCALES PARA FILTROS DE FECHA (Historial)
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // 🧠 GENERADOR DE ID AUTOMÁTICO
  const anioActual = new Date().getFullYear();
  let nextIdVal = "";
  if (editHallazgo) {
    nextIdVal = editHallazgo.ref; 
  } else {
    const consecutivos = hFiltrados
      .filter(h => h.ref && h.ref.includes(anioActual.toString()))
      .map(h => parseInt(h.ref.split('-')[2]) || 0);
    const maxConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) : 0;
    nextIdVal = `HAL-${anioActual}-${String(maxConsecutivo + 1).padStart(3, '0')}`;
  }

  // ☁️ MOTOR DE SUBIDA DE EVIDENCIAS A LA API DE TERMALES
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true); setUploadProgress(20);
    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', 'Evidencia de Hallazgo'); 
    formData.append('file', file); 
    try {
      setUploadProgress(50);
      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;
      setArchivoSubidoUrl(urlFinal); setIsUploading(false); setUploadProgress(100);
      alert("🎉 ¡Evidencia guardada con éxito en el servidor de Termales!");
    } catch (err) {
      console.error(err); alert("Error al conectar con el servidor de archivos."); setIsUploading(false);
    }
  };

  // =========================================================
  // 🧠 LÓGICA DASHBOARD: ENRIQUECIMIENTO DE DATOS
  // =========================================================
  const hallazgosEnriquecidos = hFiltrados.map(h => {
    const informeBase = informesAuditoria.find(inf => String(inf.id) === String(h.idInforme));
    const fechaReal = informeBase?.fecha || h.fecha || 'Sin Fecha';
    return { ...h, fechaReal, anioReal: fechaReal !== 'Sin Fecha' ? fechaReal.split('-')[0] : 'Sin Fecha' };
  });

  // 1. Filtrar los datos del Dashboard según el menú lateral
  const hallazgosDashboard = hallazgosEnriquecidos.filter(h => {
    if (dashFiltroAnio !== 'Todos' && h.anioReal !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && h.proceso !== dashFiltroProceso) return false;
    if (dashFiltroSeveridad !== 'Todos' && h.severidad !== dashFiltroSeveridad) return false;
    if (dashFiltroEstado !== 'Todos' && h.estado !== dashFiltroEstado) return false;
    if (dashFiltroResponsable !== 'Todos' && h.responsable !== dashFiltroResponsable) return false;
    return true;
  });

  // 2. Calcular KPIs basados en lo que está filtrado
  const totalHallazgos = hallazgosDashboard.length;
  const cerrados = hallazgosDashboard.filter(h => h.estado === 'Cerrado').length;
  const criticos = hallazgosDashboard.filter(h => h.severidad === 'Crítico').length;
  const altos = hallazgosDashboard.filter(h => h.severidad === 'Alto').length;
  const medios = hallazgosDashboard.filter(h => h.severidad === 'Medio').length;
  const bajos = hallazgosDashboard.filter(h => h.severidad === 'Bajo' || !h.severidad).length;

  const pct = (val) => totalHallazgos > 0 ? ((val / totalHallazgos) * 100).toFixed(1) : 0;

  // 3. Agrupador Dinámico según el botón "ORGANIZAR POR"
  const hallazgosAgrupados = hallazgosDashboard.reduce((acc, h) => {
    let key = 'Sin clasificar';
    if (agruparPor === 'Año') key = h.anioReal;
    if (agruparPor === 'Proceso') key = h.proceso || 'Sin Proceso';
    if (agruparPor === 'Estado') key = h.estado || 'Abierto';
    if (agruparPor === 'Nivel de Riesgo') key = h.severidad || 'Bajo';
    if (agruparPor === 'Responsable') key = h.responsable || 'Sin Asignar';

    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});
  const gruposOrdenados = Object.keys(hallazgosAgrupados).sort((a, b) => b.localeCompare(a));

  // 4. Lógica para el Top 5 de Procesos
  const conteoProcesos = hallazgosDashboard.reduce((acc, h) => {
    acc[h.proceso] = (acc[h.proceso] || 0) + 1;
    return acc;
  }, {});
  const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos'); setDashFiltroProceso('Todos'); setDashFiltroSeveridad('Todos');
    setDashFiltroEstado('Todos'); setDashFiltroResponsable('Todos');
  };

  // 🧠 LÓGICA DE FILTRADO (Historial Completo)
  const hallazgosFiltradosPorFecha = hallazgosEnriquecidos.filter(h => {
    if (filtroAnio && h.anioReal !== filtroAnio) return false;
    if (filtroMes && h.fechaReal.split('-')[1] !== filtroMes) return false;
    return true;
  });

  const aniosDisponibles = [...new Set(hallazgosEnriquecidos.map(h => h.anioReal).filter(a => a !== 'Sin Fecha'))].sort().reverse();
  const responsablesDisponibles = [...new Set(hallazgosEnriquecidos.map(h => h.responsable).filter(Boolean))].sort();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 📋 CABECERA PRINCIPAL RE-DISEÑADA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-40">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Hallazgos de Auditoría</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión y consulta de hallazgos identificados</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setVistaActiva('dashboard')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'dashboard' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📊 Resumen Visual</button>
          <button onClick={() => setVistaActiva('historial')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'historial' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📜 Historial Completo</button>
          {isAdmin && (
            <button onClick={() => { setEditHallazgo(null); setVistaActiva('nuevo'); }} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-md ${vistaActiva === 'nuevo' ? 'bg-[#0A3B32] text-white ring-4 ring-emerald-500/20' : 'bg-[#0A3B32] text-white hover:bg-[#062620]'}`}>
              <span className="mr-2">➕</span> Nuevo Hallazgo
            </button>
          )}
          {vistaActiva === 'historial' && (
             <button type="button" onClick={() => exportToExcel(hFiltrados, 'Historico_Hallazgos')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-widest shadow-md transition-colors flex items-center"><span className="mr-2">📥</span> Exportar</button>
          )}
        </div>
      </div>

      {/* 🚀 VISTA 1: DASHBOARD DE KPIs CON MENÚ LATERAL */}
      {vistaActiva === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Fila de 6 Tarjetas de KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 text-5xl opacity-5">📄</div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Hallazgos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-md">∑</div>
                  <p className="text-3xl font-black text-slate-800">{totalHallazgos}</p>
                </div>
             </div>
             
             <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-center relative overflow-hidden hover:border-red-400 transition-colors">
                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1 flex justify-between">Críticos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-black shadow-md animate-pulse">!</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{criticos}</p>
                    <p className="text-[9px] font-bold text-red-500 mt-0.5">{pct(criticos)}% del total</p>
                  </div>
                </div>
             </div>

             <div className="bg-white p-4 rounded-2xl border border-orange-200 shadow-sm flex flex-col justify-center relative overflow-hidden hover:border-orange-400 transition-colors">
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Altos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-black shadow-md">↑</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{altos}</p>
                    <p className="text-[9px] font-bold text-orange-500 mt-0.5">{pct(altos)}% del total</p>
                  </div>
                </div>
             </div>

             <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-center relative overflow-hidden hover:border-amber-400 transition-colors">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Medios</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-black shadow-md">-</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{medios}</p>
                    <p className="text-[9px] font-bold text-amber-500 mt-0.5">{pct(medios)}% del total</p>
                  </div>
                </div>
             </div>

             <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-center relative overflow-hidden hover:border-emerald-400 transition-colors">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Bajos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black shadow-md">↓</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{bajos}</p>
                    <p className="text-[9px] font-bold text-emerald-500 mt-0.5">{pct(bajos)}% del total</p>
                  </div>
                </div>
             </div>

             <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm flex flex-col justify-center relative overflow-hidden hover:border-blue-400 transition-colors">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Cerrados</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-black shadow-md">✓</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{cerrados}</p>
                    <p className="text-[9px] font-bold text-blue-500 mt-0.5">{pct(cerrados)}% del total</p>
                  </div>
                </div>
             </div>
          </div>

          {/* ESTRUCTURA 3 COLUMNAS: SIDEBAR | ACORDEONES | GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
             
             {/* 🎛️ COLUMNA IZQUIERDA: MENÚ LATERAL DE ORGANIZACIÓN */}
             <div className="lg:col-span-1 space-y-4">
                <div className="bg-white rounded-2xl border border-[#1A4B42]/20 shadow-sm overflow-hidden">
                  <div className="bg-[#f8fafa] p-4 border-b border-[#1A4B42]/10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-[#1A4B42] uppercase tracking-widest">ORGANIZAR POR</h3>
                    <div className="w-6 h-6 rounded-full bg-[#1A4B42] text-white flex items-center justify-center text-[10px] font-bold">1</div>
                  </div>
                  <div className="p-2 space-y-1">
                    {[
                      { id: 'Año', label: 'Vista por Año', icon: '📊' },
                      { id: 'Proceso', label: 'Vista por Proceso', icon: '🏛️' },
                      { id: 'Estado', label: 'Vista por Estado', icon: '🚩' },
                      { id: 'Nivel de Riesgo', label: 'Vista por Nivel', icon: '⚠️' },
                      { id: 'Responsable', label: 'Vista Responsable', icon: '👤' }
                    ].map(btn => (
                      <button 
                        key={btn.id}
                        onClick={() => { setAgruparPor(btn.id); setGrupoExpandido(null); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${agruparPor === btn.id ? 'bg-[#f0fdf4] text-[#0A3B32] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm grayscale opacity-70">{btn.icon}</span><span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#1A4B42]/20 shadow-sm p-4 space-y-4">
                  <h3 className="text-[10px] font-black text-[#1A4B42] uppercase tracking-widest border-b border-slate-100 pb-2">FILTROS</h3>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={dashFiltroAnio} onChange={e=>setDashFiltroAnio(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Proceso</label>
                    <select value={dashFiltroProceso} onChange={e=>setDashFiltroProceso(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {PROCESOS_OFICIALES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Nivel de Riesgo</label>
                    <select value={dashFiltroSeveridad} onChange={e=>setDashFiltroSeveridad(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Crítico">Crítico</option>
                      <option value="Alto">Alto</option>
                      <option value="Medio">Medio</option>
                      <option value="Bajo">Bajo</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Estado</label>
                    <select value={dashFiltroEstado} onChange={e=>setDashFiltroEstado(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Abierto">Abierto</option>
                      <option value="Cerrado">Cerrado</option>
                    </select>
                  </div>

                  <button onClick={limpiarFiltrosDashboard} className="w-full bg-[#f8fafa] hover:bg-slate-100 text-[#0A3B32] border border-[#1A4B42]/10 font-bold text-[10px] uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all">
                    <span>Limpiar Filtros</span> <span>⚗️</span>
                  </button>
                </div>
             </div>

             {/* 🗂️ COLUMNA CENTRAL: ACORDEONES */}
             <div className="lg:col-span-2 space-y-4">
               <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 ml-2">
                    <span>Agrupado por: <span className="text-[#0A3B32] bg-[#f0fdf4] px-2 py-1 rounded-md">{agruparPor}</span></span>
                    <span className="text-slate-400 font-medium">({gruposOrdenados.length} grupos)</span>
                  </div>
               </div>

               {hallazgosDashboard.length === 0 ? (
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">
                   No hay hallazgos que coincidan con los filtros.
                 </div>
               ) : (
                 gruposOrdenados.map(grupo => {
                   const hzs = hallazgosAgrupados[grupo];
                   
                   const gCriticos = hzs.filter(h => h.severidad === 'Crítico').length;
                   const gAltos = hzs.filter(h => h.severidad === 'Alto').length;
                   const gMedios = hzs.filter(h => h.severidad === 'Medio').length;
                   const gBajos = hzs.filter(h => h.severidad === 'Bajo' || !h.severidad).length;
                   const gCerrados = hzs.filter(h => h.estado === 'Cerrado').length;
                   
                   const isExpanded = grupoExpandido === grupo;

                   return (
                     <div key={grupo} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                       <div onClick={() => setGrupoExpandido(isExpanded ? null : grupo)} className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}>
                         <div className="flex items-center space-x-3">
                           <span className="text-xl">{agruparPor === 'Año' ? '📅' : agruparPor === 'Proceso' ? '🏛️' : agruparPor === 'Estado' ? '🚩' : agruparPor === 'Nivel de Riesgo' ? '⚠️' : '👤'}</span>
                           <h4 className="text-sm sm:text-base font-black text-slate-800 max-w-[150px] truncate" title={grupo}>{grupo} <span className="text-slate-400 font-medium text-xs ml-1">({hzs.length})</span></h4>
                           {grupo === new Date().getFullYear().toString() && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">Actual</span>}
                         </div>
                         {!isExpanded && (
                           <div className="hidden md:flex items-center space-x-4 text-[10px] font-bold bg-white px-4 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                             <span className="text-red-600 flex items-center" title="Críticos"><span className="text-red-500 mr-1 text-sm">⚠</span> {gCriticos}</span>
                             <span className="text-orange-500 flex items-center" title="Altos"><span className="text-orange-500 mr-1 text-sm">⬆</span> {gAltos}</span>
                             <span className="text-amber-500 flex items-center" title="Medios"><span className="text-amber-500 mr-1 text-sm">●</span> {gMedios}</span>
                             <span className="text-emerald-600 flex items-center" title="Bajos"><span className="text-emerald-500 mr-1 text-sm">⬇</span> {gBajos}</span>
                             <span className="text-blue-500 flex items-center ml-2 border-l pl-3" title="Cerrados"><span className="text-blue-500 mr-1 text-sm">✓</span> {gCerrados}</span>
                             <span className="text-slate-300 ml-2 pl-2 font-black">▼</span>
                           </div>
                         )}
                         {isExpanded && <span className="text-slate-400 font-black hidden md:block">▲</span>}
                       </div>

                       {isExpanded && (
                         <div className="p-4 sm:p-6 bg-white animate-in slide-in-from-top-2 duration-300">
                           
                           {/* KPIs Internos del Grupo */}
                           <div className="grid grid-cols-5 gap-2 mb-6 border-b border-slate-100 pb-6 text-center">
                             <div>
                               <p className="text-[9px] text-slate-400 font-black uppercase mb-1">Críticos</p>
                               <p className="text-lg font-black text-red-600">{gCriticos}</p>
                             </div>
                             <div className="border-l border-slate-100">
                               <p className="text-[9px] text-slate-400 font-black uppercase mb-1">Altos</p>
                               <p className="text-lg font-black text-orange-500">{gAltos}</p>
                             </div>
                             <div className="border-l border-slate-100">
                               <p className="text-[9px] text-slate-400 font-black uppercase mb-1">Medios</p>
                               <p className="text-lg font-black text-amber-500">{gMedios}</p>
                             </div>
                             <div className="border-l border-slate-100">
                               <p className="text-[9px] text-slate-400 font-black uppercase mb-1">Bajos</p>
                               <p className="text-lg font-black text-emerald-600">{gBajos}</p>
                             </div>
                             <div className="border-l border-slate-100">
                               <p className="text-[9px] text-slate-400 font-black uppercase mb-1">Cerrados</p>
                               <p className="text-lg font-black text-blue-600">{gCerrados}</p>
                             </div>
                           </div>

                           {/* Tabla Interna */}
                           <div className="overflow-x-auto">
                             <table className="w-full text-[10px] text-left">
                               <thead className="text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                 <tr>
                                   <th className="pb-2 font-bold">Código</th>
                                   <th className="pb-2 font-bold">Hallazgo</th>
                                   <th className="pb-2 font-bold">Proceso</th>
                                   <th className="pb-2 font-bold text-center">Nivel</th>
                                   <th className="pb-2 font-bold text-center">Estado</th>
                                   <th className="pb-2 font-bold">Responsable</th>
                                   <th className="pb-2 font-bold text-right">Fecha Inf.</th>
                                 </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-50">
                                 {hzs.slice(0, 10).map(h => (
                                   <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                     <td className="py-2.5 font-mono font-black text-slate-700">{h.ref}</td>
                                     <td className="py-2.5 font-bold text-slate-600 max-w-[150px] truncate" title={h.titulo}>{h.titulo}</td>
                                     <td className="py-2.5 font-medium text-slate-500 truncate max-w-[100px]" title={h.proceso}>{h.proceso}</td>
                                     <td className="py-2.5 text-center">
                                       <span className={`px-2 py-0.5 rounded-md font-black uppercase tracking-wider border ${
                                         h.severidad === 'Crítico' ? 'bg-red-50 text-red-600 border-red-200' :
                                         h.severidad === 'Alto' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                         h.severidad === 'Medio' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                         'bg-emerald-50 text-emerald-600 border-emerald-200'
                                       }`}>
                                         {h.severidad || 'Bajo'}
                                       </span>
                                     </td>
                                     <td className="py-2.5 text-center">
                                       <span className={`px-2 py-0.5 rounded-md font-black uppercase tracking-wider border ${h.estado === 'Cerrado' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                         {h.estado || 'Abierto'}
                                       </span>
                                     </td>
                                     <td className="py-2.5 font-bold text-slate-500 truncate max-w-[80px]" title={h.responsable}>{h.responsable}</td>
                                     <td className="py-2.5 font-bold text-slate-400 text-right">{h.fechaReal}</td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                           
                           {hzs.length > 10 && (
                             <div className="mt-4 text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                               <button onClick={() => { setFiltroAnio(agruparPor==='Año'?grupo:''); setVistaActiva('historial'); }} className="text-[10px] font-black uppercase tracking-widest text-[#0A3B32] hover:underline flex items-center justify-center w-full">
                                 Ver los {hzs.length} hallazgos completos <span className="ml-1 text-sm">➔</span>
                               </button>
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })
               )}
             </div>
             
             {/* 🍩 COLUMNA DERECHA: GRÁFICOS Y TOP 5 */}
             <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit sticky top-24">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">DISTRIBUCIÓN POR NIVEL</h3>
                
                <div className="flex items-center justify-center mb-8">
                   <div className="relative w-36 h-36 rounded-full border-[14px] border-emerald-500 border-l-red-500 border-t-red-500 border-r-orange-500 border-b-amber-500 flex items-center justify-center transform -rotate-45 shadow-inner">
                      <div className="transform rotate-45 text-center">
                         <span className="block text-3xl font-black text-slate-800 leading-none">{totalHallazgos}</span>
                         <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-3 mb-8">
                   <div className="flex justify-between items-center text-[10px] font-bold bg-white">
                     <span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2 shadow-sm"></span> Críticos</span>
                     <span className="text-slate-800">{criticos} <span className="text-[9px] ml-1 opacity-50">({pct(criticos)}%)</span></span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-bold bg-white">
                     <span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2 shadow-sm"></span> Altos</span>
                     <span className="text-slate-800">{altos} <span className="text-[9px] ml-1 opacity-50">({pct(altos)}%)</span></span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-bold bg-white">
                     <span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2 shadow-sm"></span> Medios</span>
                     <span className="text-slate-800">{medios} <span className="text-[9px] ml-1 opacity-50">({pct(medios)}%)</span></span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-bold bg-white">
                     <span className="flex items-center text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-sm"></span> Bajos</span>
                     <span className="text-slate-800">{bajos} <span className="text-[9px] ml-1 opacity-50">({pct(bajos)}%)</span></span>
                   </div>
                </div>

                {topProcesos.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Top 5 Procesos con más hallazgos</h3>
                    <div className="space-y-3">
                      {topProcesos.map(([proc, count], idx) => (
                        <div key={idx} className="flex items-center text-[10px]">
                          <span className="w-20 truncate text-slate-600 font-bold pr-2" title={proc}>{proc}</span>
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{width: `${(count/totalHallazgos)*100}%`}}></div>
                          </div>
                          <span className="w-6 text-right font-black text-slate-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

{/* 🚀 VISTA 2: FORMULARIO EXACTO INTACTO (Con Severidad Agregada) */}
      {vistaActiva === 'nuevo' && (
        <div id="edit-form" className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-200 space-y-4 relative animate-in slide-in-from-right-8 duration-500 max-w-5xl mx-auto">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-sm font-black text-[#0A3B32] uppercase tracking-widest flex items-center">
              <span className="text-xl mr-3 bg-red-50 p-2 rounded-lg">{editHallazgo ? '✏️' : '➕'}</span>
              {editHallazgo ? `Editando Hallazgo: ${editHallazgo.ref}` : 'DOCUMENTAR NUEVA DESVIACIÓN'}
            </h3>
          </div>

          <form onSubmit={(e) => { handleHallazgoSubmit(e); setVistaActiva('dashboard'); }} key={editHallazgo?.id || 'nuevo-hallazgo'} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
            
            {/* ================= FILA 1: DATOS MAESTROS REBALANCED (1 + 1 + 2 = 4) ================= */}
            <div className="md:col-span-1">
              <label className="font-bold text-gray-600 block mb-1">ID / Código (Automático)</label>
              <input name="ref" value={nextIdVal} readOnly className="w-full border border-slate-200 bg-slate-100 text-slate-500 font-black rounded-lg p-2 cursor-not-allowed outline-none focus:ring-0" />
            </div>

            <div className="md:col-span-1">
              <label className="font-bold text-gray-600 block mb-1">Clase de Observación</label>
              <select name="claseObservacion" defaultValue={editHallazgo?.claseObservacion||'Hallazgo'} className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium text-slate-700">
                <option value="Hallazgo">Hallazgo</option>
                <option value="No Conformidad">No Conformidad</option>
                <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
                <option value="Observación">Observación</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Auditor Responsable</label>
              <select name="auditor" defaultValue={editHallazgo?.auditor||''} required className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700">
                <option value="">-- Seleccione un Auditor --</option>
                {AUDITORES_OFICIALES.map(aud => <option key={aud} value={aud}>{aud}</option>)}
              </select>
            </div>
            {/* ================= FILA 2: ORIGEN Y CONTEXTO (2 + 2 = 4) ================= */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Informe de Auditoría Origen</label>
              <select name="idInforme" defaultValue={editHallazgo?.idInforme||''} required className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700">
                <option value="">-- Seleccione el Informe Radicado --</option>
                {informesAuditoria.map((inf) => (
                  <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo}</option>
                ))}
              </select>
            </div>
            
            {/* 🔍 PROCESO AUDITADO */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label>
              <input name="proceso" list="lista-procesos" defaultValue={editHallazgo?.proceso||''} required autoComplete="off" placeholder="Escribe o selecciona..." className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 outline-none font-medium" />
              <datalist id="lista-procesos">
                {PROCESOS_OFICIALES.map(proc => <option key={proc} value={proc} />)}
              </datalist>
            </div>
            {/* ================= FILA 3: ASIGNACIÓN COMPUESTA (2 + 2 = 4) ================= */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Sedes Afectadas</label>
              <div className="flex gap-2 mb-2">
                <select value={sedeTemp} onChange={(e) => setSedeTemp(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700">
                  <option value="">-- Escoger Sede --</option>
                  {Object.keys(CARGOS_POR_SEDE).map(s => <option key={s} value={s} disabled={sedesMultiples.includes(s)}>{s}</option>)}
                </select>
                <button type="button" onClick={() => { if(sedeTemp && !sedesMultiples.includes(sedeTemp)) setSedesMultiples([...sedesMultiples, sedeTemp]); setSedeTemp(''); }} className="bg-red-600 text-white px-4 rounded-lg text-xs font-bold hover:bg-red-700 shrink-0 transition-colors shadow-sm">➕ Añadir</button>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                {sedesMultiples.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Ninguna sede añadida...</span>}
                {sedesMultiples.map(s => (
                  <span key={s} className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                    {s} 
                    <button type="button" onClick={() => setSedesMultiples(sedesMultiples.filter(item => item !== s))} className="ml-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                  </span>
                ))}
              </div>
              <input type="hidden" name="sede" value={sedesMultiples.join(', ')} />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Responsables del Proceso (Cargos)</label>
              <div className="flex gap-2 mb-2">
                <select value={responsableTemp} onChange={(e) => setResponsableTemp(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700">
                  <option value="">-- Escoger de las sedes seleccionadas --</option>
                  {cargosDisponibles.map(cargo => (
                    <option key={cargo} value={cargo} disabled={responsablesMultiples.includes(cargo)}>{cargo}</option>
                    ))}
                </select>
                <button type="button" onClick={() => { if(responsableTemp && !responsablesMultiples.includes(responsableTemp)) setResponsablesMultiples([...responsablesMultiples, responsableTemp]); setResponsableTemp(''); }} className="bg-red-600 text-white px-4 rounded-lg text-xs font-bold hover:bg-red-700 shrink-0 transition-colors shadow-sm">➕ Añadir</button>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                {responsablesMultiples.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Ningún responsable añadido...</span>}
                {responsablesMultiples.map(r => (
                  <span key={r} className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                    {r} 
                    <button type="button" onClick={() => setResponsablesMultiples(responsablesMultiples.filter(item => item !== r))} className="ml-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                  </span>
                ))}
              </div>
              <input type="hidden" name="responsable" value={responsablesMultiples.join(', ')} />
            </div>

            {/* ================= BLOQUES ANCHOS COMPLETOS ================= */}
            <div className="md:col-span-4 bg-red-50/50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
              <div>
                <label className="font-black text-red-800 block mb-1 uppercase tracking-widest text-[10px]">⚠️ Nivel de Severidad</label>
                <p className="text-[9px] text-red-600 font-medium">Clasificación del riesgo asociado a esta desviación.</p>
              </div>
              <select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="border border-red-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-800 w-48 shadow-sm">
                <option value="Crítico">Crítico</option>
                <option value="Alto">Alto</option>
                <option value="Medio">Medio</option>
                <option value="Bajo">Bajo</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="font-bold text-gray-600 block mb-1">Título / Descripción de la Falla</label>
              <textarea name="titulo" defaultValue={editHallazgo?.titulo||''} required rows="5" placeholder="Describa el hallazgo detalladamente..." className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none font-medium resize-y shadow-inner" />
            </div>            
            
            <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner mt-2">
              <div className="border-b pb-2 border-slate-200 flex justify-between items-center mb-4">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Evidencia del Hallazgo</label>
                  <p className="text-[9px] text-slate-500 font-medium">Sube el soporte (PDF o Imagen). Se guardará en el repositorio oficial.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editHallazgo?.evidenciaUrl || ''} />

              <div className="bg-white border-2 border-dashed border-rose-300 p-6 rounded-2xl text-center relative hover:border-rose-500 hover:bg-rose-50/50 transition-all flex flex-col items-center justify-center min-h-[160px] shadow-sm">
                {isUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-rose-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : archivoSubidoUrl || editHallazgo?.evidenciaUrl ? (
                  <div className="space-y-2">
                    <div className="text-4xl text-rose-500">✅</div>
                    <a href={archivoSubidoUrl || editHallazgo?.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Soporte Subido</a>
                    <label className="block mt-3 cursor-pointer text-slate-400 hover:text-rose-600 text-[9px] font-bold uppercase tracking-wider transition-colors underline">
                      Reemplazar Archivo <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors">Seleccionar Archivo PDF o Imagen</p>
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                  </label>
                )}
              </div>
            </div>
            
            <div className="md:col-span-4 flex justify-end items-end pt-4">
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest px-10 py-3.5 rounded-xl shadow-lg transition-all w-full md:w-auto hover:scale-105">
                {editHallazgo ? '💾 Guardar Cambios' : '➕ REGISTRAR HALLAZGO'}
              </button>
            </div>
          </form>
        </div>
      )}
            
     {/* 🚀 VISTA 3: HISTORIAL AGRUPADO POR INFORME EMITIDO (ACORDEÓN ANIDADO) */}
      {vistaActiva === 'historial' && (() => {
        const hallazgosFiltradosFinal = applyFilters(hallazgosFiltradosPorFecha, searchTerm, columnFilters);
        
        // Agrupar dinámicamente los hallazgos filtrados bajo su respectivo informe de origen
        const hallazgosPorInforme = hallazgosFiltradosFinal.reduce((acc, h) => {
          const key = h.idInforme || 'sin-informe';
          if (!acc[key]) acc[key] = [];
          acc[key].push(h);
          return acc;
        }, {});

        const listaInformesIds = Object.keys(hallazgosPorInforme);

        return (
          <div className="space-y-4 animate-in slide-in-from-left-8 duration-500">
            {/* 🎛️ BARRA DE FILTROS TEMPORALES Y BÚSQUEDA SUPERIOR */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-4">
               <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest ml-2">Historial por Informe Emitido</h3>
               
               <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="border border-slate-300 rounded-lg text-xs py-1.5 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm cursor-pointer">
                    <option value="">📅 Todos los Años</option>
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(a => <option key={a} value={String(a)}>{a}</option>)}
                  </select>

                  <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="border border-slate-300 rounded-lg text-xs py-1.5 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm cursor-pointer">
                    <option value="">📆 Todos los Meses</option>
                    <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                    <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                    <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                    <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>

                 <div className="relative w-full sm:w-auto">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                    <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-64 shadow-sm font-bold" />
                 </div>
               </div>
            </div>

            {/* 📂 LISTADO PRINCIPAL DE INFORMES EMITIDOS */}
            {listaInformesIds.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">
                No se encontraron informes con hallazgos para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-3">
                {listaInformesIds.map(idInf => {
                  const hzsDelInforme = hallazgosPorInforme[idInf];
                  const informeBase = informesAuditoria.find(inf => String(inf.id) === String(idInf));
                  
                  const refInforme = informeBase ? informeBase.ref : "INF-S/N";
                  const tituloInforme = informeBase ? informeBase.titulo : "Informe general o registros huérfanos";
                  const procesoInforme = informeBase ? informeBase.proceso : "Varios Procesos";
                  const fechaInforme = informeBase ? informeBase.fecha : "Sin Fecha";

                  const nAbiertos = hzsDelInforme.filter(h => h.estado !== 'Cerrado').length;
                  const nCerrados = hzsDelInforme.filter(h => h.estado === 'Cerrado').length;
                  const isExpanded = informeHistorialExpandido === idInf;

                  return (
                    <div key={`inf-card-${idInf}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                      
                      {/* Fila Resumen del Informe (Línea de Trazabilidad Principal) */}
                      <div 
                        onClick={() => setInformeHistorialExpandido(isExpanded ? null : idInf)}
                        className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer transition-colors gap-3 ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <span className="text-xl shrink-0">📂</span>
                          <div className="truncate w-full">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 bg-[#0A3B32] text-white font-mono font-black rounded text-[9px] tracking-wider uppercase">{refInforme}</span>
                              <span className="text-[10px] text-slate-400 font-bold">📅 {fechaInforme}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-2 py-0.5 rounded uppercase max-w-[180px] truncate" title={procesoInforme}>🏛️ {procesoInforme}</span>
                            </div>
                            <h4 className="text-xs font-black text-slate-800 mt-1 truncate" title={tituloInforme}>{tituloInforme}</h4>
                          </div>
                        </div>

                        {/* Indicadores Cuantitativos del Informe */}
                        <div className="flex items-center space-x-4 shrink-0 self-end md:self-center">
                          <div className="flex items-center space-x-2 text-[10px] font-bold bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                            <span className="text-slate-500">Hallazgos: <span className="font-black text-slate-800">{hzsDelInforme.length}</span></span>
                            <span className="text-red-600 border-l pl-2 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1"></span> {nAbiertos} Abiertos</span>
                            <span className="text-blue-600 border-l pl-2 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></span> {nCerrados} Cerrados</span>
                          </div>
                          <span className="text-slate-400 font-black text-xs w-4 text-center">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Sub-tabla Desplegable de Hallazgos Amarrados */}
                      {isExpanded && (
                        <div className="p-3 bg-white border-t border-slate-50 overflow-x-auto">
                          <table className="w-full text-xs text-left divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                            <thead className="bg-slate-900 text-white font-bold uppercase tracking-widest text-[9px]">
                              <tr>
                                <th className="p-3 w-28">
                                  <div className="mb-1">ID / REF</div>
                                  <FilterInput colKey="ref" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                                </th>
                                <th className="p-3 w-36">
                                  <div className="mb-1">PROCESO / SEDE</div>
                                  <FilterInput colKey="proceso" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                                </th>
                                <th className="p-3 w-2/5">
                                  <div className="mb-1">DESCRIPCIÓN DEL HALLAZGO</div>
                                  <FilterInput colKey="titulo" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                                </th>
                                <th className="p-3">
                                  <div className="mb-1">RESPONSABLES</div>
                                  <FilterInput colKey="responsable" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                                </th>
                                <th className="p-3 text-center">
                                  <div className="mb-1">ESTADO</div>
                                  <FilterInput colKey="estado" placeholder="Filtrar..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                              {hzsDelInforme.map((h, hIdx) => (
                                <tr key={`h-child-${h.id}-${hIdx}`} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3 font-mono">
                                    <div className="font-black text-slate-800">{h.ref}</div>
                                    <div className="text-[9px] text-slate-400 mt-0.5">INT-#{h.id}</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-bold text-slate-700 truncate max-w-[130px]" title={h.proceso}>{h.proceso}</div>
                                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-black mt-0.5">{h.sede || 'Hotel'}</div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-medium text-slate-800 leading-relaxed">{h.titulo}</div>
                                    {h.evidenciaUrl ? (
                                      <a href={h.evidenciaUrl} target="_blank" rel="noreferrer" className="mt-2 bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-[9px] inline-flex items-center space-x-1 hover:bg-blue-100 transition-colors border border-blue-100 w-max shadow-sm">
                                        <span>🔗</span><span>Ver Evidencia</span>
                                      </a>
                                    ) : (
                                      <div className="mt-2 text-[8px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-1.5 py-0.5 rounded bg-slate-50">🚫 Sin evidencia</div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <div className="text-[10px] space-y-0.5 bg-slate-50 p-2 rounded border">
                                      <div><span className="font-bold text-slate-400 uppercase text-[8px]">Auditor:</span> <span className="font-bold text-slate-700">{h.auditor || 'N/A'}</span></div>
                                      <div><span className="font-bold text-slate-400 uppercase text-[8px]">Dueño:</span> <span className="font-bold text-slate-700">{h.responsable}</span></div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest inline-block mb-2 ${h.estado === 'Cerrado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                      {h.estado}
                                    </span>
                                    <div className="flex justify-center items-center space-x-2 text-[10px] border-t border-slate-100 pt-1.5 mt-1">
                                      <button onClick={() => {setEditHallazgo(h); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm();}} className="text-blue-600 hover:underline font-bold">✏️ Editar</button>
                                      {isAdmin && (
                                        <>
                                          <span className="text-slate-300">|</span>
                                          <button onClick={() => handleDeleteItem('hallazgos', h.id)} className="text-red-500 hover:underline font-bold">🗑️ Borrar</button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        );
      })()}

    </div>
  );
}