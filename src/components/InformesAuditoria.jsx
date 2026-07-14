import React, { useState } from 'react';

const PROCESOS_OFICIALES = [
   "Gestión comercial",
  "Gestión de la mejora continua (SIGCAS)",
  "Gestión de mercadeo y comunicaciones",
  "Gestión de servicio al cliente",
  "Gestión estratégica",
 "Gestión de Operaciones",
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
  "Subproceso selección, vinculación y administración de colaboradores",
  "Tecnologías de la información y la comunicación"
];

// 👔 LISTA MAESTRA DE CARGOS PARA PARTICIPANTES DE SOCIALIZACIÓN
const CARGOS_SOCIALIZACION = [
  "Auditoría Interna",
  "Chef Hotel",
  "Contador",
  "Contadora de Socios",
  "Coordinación Administrativa Family Office",
  "Coordinación Comercial y Contact Center",
  "Coordinación de Mercadeo y Comunicaciones",
  "Coordinación de Recepción",
  "Coordinación Seguridad y Salud en el Trabajo",
  "Coordinación SPA",
  "Coordinador de Mantenimiento",
  "Coordinador de Marketing Digital",
  "Coordinador de Servicio al Cliente",
  "Coordinador de Operaciones",
  "Desarrollador Junior",
  "Dirección Administrativa y Financiera",
  "Dirección Comercial",
  "Dirección de Mercadeo y Comunicaciones",
  "Dirección de Talento Humano",
  "Director de TICS",
  "Gerente Administrativa y Judicial",
  "Jefe de Control Interno",
  "Jefe de Cocina",
  "Líder Administrativa",
  "Líder de Compras y Almacén",
  "Líder de Costos y Presupuestos",
  "Líder de Contabilidad",
  "Líder de Gestión Ambiental",
  "Líder de Proceso de Alimentos y Bebidas",
  "Líder de Tesorería y Cartera",
  "Líder Táctico de Infraestructura Tecnológica",
  "Líder Táctico de Mejora Continua",
  "Líder Táctico de Desarrollo de Software",
  "Subdirección de Operaciones Balneario",
  "Subdirector de Operaciones Hotel",
  "Supervisor (a) de Operaciones",
  "Supervisor (a) Mesa y Servicio",
  "Supervisor de Operaciones",
  "Supervisor Ruta Ecológica",
  "Terapeuta SPA"
];

export default function InformesAuditoria({ 
  informesAuditoria, 
  editInformeAuditoria, 
  setEditInformeAuditoria, 
  isAdmin, 
  searchTerm, 
  setSearchTerm, 
  columnFilters, 
  handleColFilterChange, 
  exportToExcel, 
  handleInformeAuditoriaSubmit, 
  isSubmitting, 
  setFormResetKey, 
  scrollToForm, 
  handleDeleteItem, 
  applyFilters, 
  FilterInput,
  auditoresLista = [], 
  onActualizarAuditores 
}) {

// 🏢 CONTROL DE CARGOS MÚLTIPLES EN SOCIALIZACIÓN (PEGAR AQUÍ)
  const [participantesMultiples, setParticipantesMultiples] = useState([]);
  const [participanteTemp, setParticipanteTemp] = useState('');

  // Sincronizador automático si se carga un informe en modo edición
  React.useEffect(() => {
    if (editInformeAuditoria?.participantes) {
      setParticipantesMultiples(editInformeAuditoria.participantes.includes(',') ? editInformeAuditoria.participantes.split(',').map(p => p.trim()) : [editInformeAuditoria.participantes]);
    } else {
      setParticipantesMultiples([]);
    }
  }, [editInformeAuditoria]);
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];

  // 🧭 ESTADOS DE NAVEGACIÓN (TABS Y ACORDEÓN)
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [grupoExpandido, setGrupoExpandido] = useState(null);

  // 🎛️ ESTADOS DEL PANEL LATERAL (NUEVO)
  const [agruparPor, setAgruparPor] = useState('Año'); 
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroResponsable, setDashFiltroResponsable] = useState('Todos');

  // ⏳ ESTADOS LOCALES PARA FILTROS DE FECHA (Historial)
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // 🧠 LÓGICA DE FILTRADO (Historial Completo)
  const informesFiltradosPorFecha = safeInformes.filter(inf => {
    if (!filtroAnio && !filtroMes) return true;
    if (!inf.fecha) return false;
    const [anio, mes] = inf.fecha.split('-'); 
    if (filtroAnio && anio !== filtroAnio) return false;
    if (filtroMes && mes !== filtroMes) return false;
    return true;
  });

  // =========================================================
  // 🧠 NUEVA LÓGICA DASHBOARD: FILTROS + AGRUPACIÓN DINÁMICA
  // =========================================================
  
  // 1. Filtrar los datos del Dashboard según el menú lateral
  const informesDashboard = safeInformes.filter(inf => {
    if (dashFiltroAnio !== 'Todos' && inf.fecha?.split('-')[0] !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && inf.proceso !== dashFiltroProceso) return false;
    if (dashFiltroEstado !== 'Todos' && (dashFiltroEstado === 'Socializado' ? inf.socializado === 'Sí' : inf.socializado !== 'Sí')) return false;
    if (dashFiltroResponsable !== 'Todos' && inf.elaboradoPor !== dashFiltroResponsable) return false;
    return true;
  });

  // 2. Calcular KPIs basados en lo que está filtrado
  const totalInformes = informesDashboard.length;
  const socializados = informesDashboard.filter(i => i.socializado === 'Sí').length;
  const pctSocializados = totalInformes > 0 ? Math.round((socializados / totalInformes) * 100) : 0;
  const pendientes = totalInformes - socializados;
  const pctPendientes = totalInformes > 0 ? Math.round((pendientes / totalInformes) * 100) : 0;
  const procesosAuditados = new Set(informesDashboard.map(i => i.proceso)).size;
  const sortedInformes = [...informesDashboard].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimoInforme = sortedInformes.length > 0 ? sortedInformes[0] : null;

  // 3. Agrupador Dinámico según el botón "ORGANIZAR POR"
  const informesAgrupados = informesDashboard.reduce((acc, inf) => {
    let key = 'Sin clasificar';
    if (agruparPor === 'Año') key = inf.fecha ? inf.fecha.split('-')[0] : 'Sin Fecha';
    if (agruparPor === 'Proceso') key = inf.proceso || 'Sin Proceso';
    if (agruparPor === 'Estado') key = inf.socializado === 'Sí' ? 'Socializados' : 'Pendientes';
    if (agruparPor === 'Responsable') key = inf.elaboradoPor || 'Sin Asignar';

    if (!acc[key]) acc[key] = [];
    acc[key].push(inf);
    return acc;
  }, {});

  const gruposOrdenados = Object.keys(informesAgrupados).sort((a, b) => b.localeCompare(a));

  // 4. Lógica para el Top 5 de Procesos
  const conteoProcesos = informesDashboard.reduce((acc, inf) => {
    acc[inf.proceso] = (acc[inf.proceso] || 0) + 1;
    return acc;
  }, {});
  const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos'); setDashFiltroProceso('Todos'); 
    setDashFiltroEstado('Todos'); setDashFiltroResponsable('Todos');
  };

  // ☁️ ESTADOS DE CARGA PARA API TERMALES
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');
  const [actaProgress, setActaProgress] = useState(0);
  const [isActaUploading, setIsActaUploading] = useState(false);
  const [actaSubidaUrl, setActaSubidaUrl] = useState('');

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'informe') { setIsUploading(true); setUploadProgress(20); } 
    else { setIsActaUploading(true); setActaProgress(20); }

    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', `Documento adjunto desde GCM Auditor - ${type}`); 
    formData.append('file', file); 

    try {
      if (type === 'informe') setUploadProgress(50); else setActaProgress(50);
      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;

      if (type === 'informe') { setArchivoSubidoUrl(urlFinal); setIsUploading(false); setUploadProgress(100); } 
      else { setActaSubidaUrl(urlFinal); setIsActaUploading(false); setActaProgress(100); }
      alert("🎉 ¡Archivo guardado con éxito en el repositorio oficial de Termales!");
    } catch (err) {
      console.error(err); alert("Error en la conexión con el servidor. Revisa la consola.");
      if (type === 'informe') setIsUploading(false); else setIsActaUploading(false);
    }
  };

  const handleResetForm = () => {
    setEditInformeAuditoria(null); setArchivoSubidoUrl(''); setActaSubidaUrl('');
    setUploadProgress(0); setActaProgress(0); setFormResetKey(Date.now());
    setVistaActiva('dashboard');
  };

  // Extraer años y responsables únicos para los selects
  const aniosDisponibles = [...new Set(safeInformes.map(i => i.fecha?.split('-')[0]).filter(Boolean))].sort().reverse();
  const responsablesDisponibles = [...new Set(safeInformes.map(i => i.elaboradoPor).filter(Boolean))].sort();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 📋 CABECERA PRINCIPAL */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-40">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Informes Emitidos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Centro de gestión y consulta de informes de auditoría</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setVistaActiva('dashboard')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'dashboard' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📊 Resumen Visual</button>
          <button onClick={() => setVistaActiva('historial')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'historial' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📜 Historial Completo</button>
          {isAdmin && (
            <button onClick={() => { setEditInformeAuditoria(null); setVistaActiva('nuevo'); }} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-md ${vistaActiva === 'nuevo' ? 'bg-[#0A3B32] text-white ring-4 ring-emerald-500/20' : 'bg-[#0A3B32] text-white hover:bg-[#062620]'}`}>
              <span className="mr-2">➕</span> Nuevo Informe
            </button>
          )}
          {vistaActiva === 'historial' && (
             <button type="button" onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-widest shadow-md transition-colors flex items-center"><span className="mr-2">📥</span> Exportar</button>
          )}
        </div>
      </div>

      {/* 🚀 VISTA 1: DASHBOARD DE KPIs CON MENÚ LATERAL */}
      {vistaActiva === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Fila de 5 Tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-slate-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl shrink-0">📄</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Informes</p>
                   <p className="text-2xl font-black text-slate-800">{totalInformes}</p>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-emerald-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">✅</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Socializados</p>
                   <div className="flex items-baseline space-x-2">
                     <p className="text-2xl font-black text-slate-800">{socializados}</p>
                     <p className="text-[10px] font-bold text-emerald-500">{pctSocializados}%</p>
                   </div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-orange-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xl shrink-0">🕒</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pendientes</p>
                   <div className="flex items-baseline space-x-2">
                     <p className="text-2xl font-black text-slate-800">{pendientes}</p>
                     <p className="text-[10px] font-bold text-orange-500">{pctPendientes}%</p>
                   </div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">🏛️</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Procesos Auditados</p>
                   <p className="text-2xl font-black text-slate-800">{procesosAuditados}</p>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-purple-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">📅</div>
                <div className="overflow-hidden">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Último Informe</p>
                   <p className="text-[13px] font-black text-slate-800 truncate mt-1">{ultimoInforme ? ultimoInforme.fecha : '---'}</p>
                   <p className="text-[9px] font-bold text-slate-400 truncate">{ultimoInforme ? ultimoInforme.proceso : 'Sin datos'}</p>
                </div>
             </div>
          </div>

          {/* ESTRUCTURA 3 COLUMNAS: SIDEBAR | ACORDEONES | GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
             
             {/* 🎛️ COLUMNA IZQUIERDA: MENÚ LATERAL DE ORGANIZACIÓN */}
             <div className="lg:col-span-1 space-y-4">
                
                {/* Bloque: Organizar Por */}
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
                      { id: 'Responsable', label: 'Vista por Responsable', icon: '👤' }
                    ].map(btn => (
                      <button 
                        key={btn.id}
                        onClick={() => { setAgruparPor(btn.id); setGrupoExpandido(null); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${agruparPor === btn.id ? 'bg-[#f0fdf4] text-[#0A3B32] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm grayscale opacity-70">{btn.icon}</span>
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bloque: Filtros */}
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
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Estado</label>
                    <select value={dashFiltroEstado} onChange={e=>setDashFiltroEstado(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Socializado">Socializado</option>
                      <option value="Pendiente">Pendiente</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Responsable</label>
                    <select value={dashFiltroResponsable} onChange={e=>setDashFiltroResponsable(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {responsablesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
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

               {informesDashboard.length === 0 ? (
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">
                   No hay informes que coincidan con los filtros.
                 </div>
               ) : (
                 gruposOrdenados.map(grupo => {
                   const infs = informesAgrupados[grupo];
                   const soc = infs.filter(i => i.socializado === 'Sí').length;
                   const pend = infs.length - soc;
                   const procs = new Set(infs.map(i => i.proceso)).size;
                   const isExpanded = grupoExpandido === grupo;

                   return (
                     <div key={grupo} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                       <div onClick={() => setGrupoExpandido(isExpanded ? null : grupo)} className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}>
                         <div className="flex items-center space-x-3">
                           <span className="text-xl">{agruparPor === 'Año' ? '📅' : agruparPor === 'Proceso' ? '🏛️' : agruparPor === 'Estado' ? '🚩' : '👤'}</span>
                           <h4 className="text-sm sm:text-base font-black text-slate-800 max-w-[200px] truncate" title={grupo}>{grupo} <span className="text-slate-400 font-medium text-xs ml-1">({infs.length})</span></h4>
                           {grupo === new Date().getFullYear().toString() && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">Actual</span>}
                         </div>
                         {!isExpanded && (
                           <div className="hidden md:flex items-center space-x-4 text-xs font-bold bg-white px-4 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                             <span className="text-emerald-600 flex items-center"><span className="mr-1.5 text-base">✅</span> {soc}</span>
                             <span className="text-orange-500 flex items-center"><span className="mr-1.5 text-base">🕒</span> {pend}</span>
                             <span className="text-slate-300 ml-4 border-l pl-4 font-black">▼</span>
                           </div>
                         )}
                         {isExpanded && <span className="text-slate-400 font-black hidden md:block">▲</span>}
                       </div>

                       {isExpanded && (
                         <div className="p-4 sm:p-6 bg-white animate-in slide-in-from-top-2 duration-300">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-b border-slate-100 pb-6">
                             <div className="text-center">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Socializados</p>
                               <p className="text-xl font-black text-emerald-600">{soc} <span className="text-[10px] font-bold text-emerald-400 ml-1">({Math.round((soc/infs.length)*100)}%)</span></p>
                             </div>
                             <div className="text-center border-l border-slate-100">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Pendientes</p>
                               <p className="text-xl font-black text-orange-500">{pend} <span className="text-[10px] font-bold text-orange-300 ml-1">({Math.round((pend/infs.length)*100)}%)</span></p>
                             </div>
                             <div className="text-center border-l border-slate-100 hidden md:block">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Procesos</p>
                               <p className="text-xl font-black text-slate-700">{procs}</p>
                             </div>
                             <div className="text-center border-l border-slate-100 hidden md:block">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Última Emisión</p>
                               <p className="text-sm font-black text-slate-700 mt-1.5">{infs.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0]?.fecha}</p>
                             </div>
                           </div>

                           <div className="space-y-2">
                             {infs.slice(0, 5).map(inf => (
                               <div key={inf.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200">
                                 <div className="flex items-center space-x-4 w-full md:w-1/3">
                                   <div className={`w-1 h-10 rounded-full ${inf.socializado === 'Sí' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                                   <div className="overflow-hidden">
                                     <p className="text-xs font-bold text-slate-800 truncate" title={inf.proceso}>{inf.proceso}</p>
                                     <p className="text-[10px] text-slate-400 font-mono mt-0.5">{inf.ref}</p>
                                   </div>
                                 </div>
                                 <div className="w-1/6 hidden lg:block">
                                   <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${inf.socializado === 'Sí' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                                     {inf.socializado === 'Sí' ? 'Socializado' : 'Pendiente'}
                                   </span>
                                 </div>
                                 <div className="w-1/4 hidden md:block text-[10px] font-bold text-slate-600 truncate">
                                   <span className="text-slate-400 font-normal mr-1">Auditor:</span>{inf.elaboradoPor}
                                 </div>
                                 <div className="w-auto md:w-1/6 text-right text-[10px] font-bold text-slate-500">
                                   {inf.fecha}
                                 </div>
                               </div>
                             ))}
                           </div>
                           
                           {infs.length > 5 && (
                             <div className="mt-5 text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                               <button onClick={() => { setFiltroAnio(agruparPor==='Año'?grupo:''); setVistaActiva('historial'); }} className="text-[10px] font-black uppercase tracking-widest text-[#0A3B32] hover:underline flex items-center justify-center w-full">
                                 Ver los {infs.length} informes <span className="ml-1 text-sm">➔</span>
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
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">RESUMEN VISUAL</h3>
                
                <div className="flex items-center justify-center mb-8">
                   <div className="relative w-36 h-36 rounded-full border-[14px] border-slate-100 border-l-emerald-500 border-t-emerald-500 border-r-orange-500 border-b-slate-200 flex items-center justify-center transform -rotate-45 shadow-inner">
                      <div className="transform rotate-45 text-center">
                         <span className="block text-3xl font-black text-slate-800 leading-none">{totalInformes}</span>
                         <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4 mb-8">
                   <div className="flex justify-between items-center text-xs font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                     <span className="flex items-center text-emerald-900"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-sm"></span> Socializados</span>
                     <span className="text-emerald-700 bg-white px-2 py-0.5 rounded shadow-sm">{socializados}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs font-bold bg-orange-50 p-2.5 rounded-xl border border-orange-100">
                     <span className="flex items-center text-orange-900"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2 shadow-sm"></span> Pendientes</span>
                     <span className="text-orange-700 bg-white px-2 py-0.5 rounded shadow-sm">{pendientes}</span>
                   </div>
                </div>

                {topProcesos.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Top Procesos Auditados</h3>
                    <div className="space-y-3">
                      {topProcesos.map(([proc, count], idx) => (
                        <div key={idx} className="flex items-center text-[10px]">
                          <span className="w-20 truncate text-slate-600 font-bold pr-2" title={proc}>{proc}</span>
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#0A3B32] h-full rounded-full" style={{width: `${(count/totalInformes)*100}%`}}></div>
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

      {/* 🚀 VISTA 2: FORMULARIO EXACTO INTACTO */}
      {vistaActiva === 'nuevo' && isAdmin && (
        <div id="edit-form" className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-200 space-y-4 relative animate-in slide-in-from-right-8 duration-500 max-w-5xl mx-auto">
          
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-sm font-black text-[#0A3B32] uppercase tracking-widest flex items-center">
              <span className="text-xl mr-3 bg-emerald-50 p-2 rounded-lg">{editInformeAuditoria ? '✏️' : '➕'}</span>
              {editInformeAuditoria ? `Editando Flujo de Informe: ${editInformeAuditoria.ref}` : 'ARCHIVAR, RADICAR Y DISTRIBUIR NUEVO INFORME'}
            </h3>
          </div>

          <form key={editInformeAuditoria?.ref || 'form-nuevo'} onSubmit={(e) => { handleInformeAuditoriaSubmit(e); setVistaActiva('dashboard'); }} className="space-y-6 text-xs">
            {/* 📊 REJILLA DE CAMPOS PERFECTAMENTE ALINEADA (4 COLUMNAS) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              
              {/* 📝 COLUMNA: TÍTULO */}
              <div className="md:col-span-2">
                <label className="font-bold text-gray-600 block mb-1.5">Título del Informe Formal</label>
                <input 
                  name="titulo" 
                  defaultValue={editInformeAuditoria?.titulo || ''} 
                  required 
                  placeholder="Ej: Auditoría de Cumplimiento a Cadena de Suministros" 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm" 
                />
              </div>

              {/* 📋 COLUMNA: SELECCIÓN DE PROCESO */}
              <div>
                <label className="font-bold text-gray-600 block mb-1.5">📋 Proceso Auditado</label>
                <select 
                  name="proceso" 
                  defaultValue={editInformeAuditoria?.proceso || ''} 
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 cursor-pointer shadow-sm"
                >
                  <option value="">-- Seleccionar Proceso --</option>
                  {PROCESOS_OFICIALES.map((proc) => (
                    <option key={proc} value={proc}>{proc}</option>
                  ))}
                </select>
              </div>               

              {/* 📅 COLUMNA: FECHA DE EMISIÓN */}
              <div>
                <label className="font-bold text-gray-600 block mb-1.5">Fecha de Emisión</label>
                <input 
                  name="fecha" 
                  type="date" 
                  defaultValue={editInformeAuditoria?.fecha || ''} 
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm" 
                />
              </div>

              {/* ✍️ COLUMNA: ELABORADO POR */}
              <div>
                <label className="font-bold text-gray-600 block mb-1.5">✍️ Elaborado Por (Auditor)</label>
                <select 
                  name="elaboradoPor" 
                  defaultValue={editInformeAuditoria?.elaboradoPor || ''} 
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-medium text-slate-800 shadow-sm cursor-pointer"
                >
                  <option value="">-- Asignar Auditor --</option>
                  {auditoresLista.map((aud, i) => <option key={`elab-${i}`} value={aud}>{aud}</option>)}
                </select>
              </div>

              {/* 🔍 COLUMNA: REVISADO POR */}
              <div>
                <label className="font-bold text-gray-600 block mb-1.5">🔍 Revisado Por (Líder)</label>
                <select 
                  name="revisadoPor" 
                  defaultValue={editInformeAuditoria?.revisadoPor || ''} 
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-sm cursor-pointer text-slate-800"
                >
                  <option value="">-- Seleccionar --</option>
                  {auditoresLista.map((a, i) => <option key={`rev-${i}`} value={a}>{a}</option>)}
                </select>
              </div>

              {/* 🔒 COLUMNA: APROBADO POR */}
              <div>
                <label className="font-bold text-gray-600 block mb-1.5">🔒 Aprobado Por (Gerencia)</label>
                <select 
                  name="aprobadoPor" 
                  defaultValue={editInformeAuditoria?.aprobadoPor || ''} 
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-sm cursor-pointer text-slate-800"
                >
                  <option value="">-- Seleccionar --</option>
                  {auditoresLista.map((a, i) => <option key={`apr-${i}`} value={a}>{a}</option>)}
                </select>
              </div>

              {/* 📢 COLUMNA: ¿FUE SOCIALIZADO? */}
              <div>
                <label className="font-bold text-gray-600 block mb-1.5">📢 ¿Fue Socializado?</label>
                <select 
                  name="socializado" 
                  defaultValue={editInformeAuditoria?.socializado || 'No'} 
                  className="w-full border rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm cursor-pointer"
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </div>

             {/* 👥 SECTOR MÚLTIPLE: PARTICIPANTES DE LA SOCIALIZACIÓN */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 col-span-full space-y-2">
              <label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Cargos)</label>
              <div className="flex gap-2">
                <select 
                  value={participanteTemp} 
                  onChange={(e) => setParticipanteTemp(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-700 text-xs shadow-sm cursor-pointer"
                >
                  <option value="">-- Seleccionar Cargo Participante --</option>
                  {CARGOS_SOCIALIZACION.map(cargo => (
                    <option key={cargo} value={cargo} disabled={participantesMultiples.includes(cargo)}>{cargo}</option>
                  ))}
                </select>
                <button 
                  type="button" 
                  onClick={() => { 
                    if(participanteTemp && !participantesMultiples.includes(participanteTemp)) {
                      setParticipantesMultiples([...participantesMultiples, participanteTemp]); 
                    }
                    setParticipanteTemp(''); 
                  }} 
                  className="bg-[#0A3B32] text-white px-5 rounded-lg text-xs font-bold hover:bg-[#062620] shrink-0 transition-colors shadow-sm flex items-center"
                >
                  ➕ Añadir
                </button>
              </div>
              
              {/* 🏷️ VISUALIZADOR DE CHIPS / FICHAS SELECCIONADAS */}
              <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                {participantesMultiples.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Ningún cargo seleccionado aún...</span>}
                {participantesMultiples.map(cargo => (
                  <span key={cargo} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                    {cargo} 
                    <button 
                      type="button" 
                      onClick={() => setParticipantesMultiples(participantesMultiples.filter(item => item !== cargo))} 
                      className="ml-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors font-sans"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              
              {/* 🔒 INPUT OCULTO: Envía los cargos unificados por comas automáticamente */}
              <input type="hidden" name="participantes" value={participantesMultiples.join(', ')} />
            </div>
            </div>            
           
            {/* 📧 DISTRIBUCIÓN ELECTRÓNICA */}
            <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl shadow-inner mt-4">
              <label className="font-black text-blue-900 block mb-2 uppercase tracking-wider text-[10px]">📧 DISTRIBUCIÓN POR CORREO ELECTRÓNICO (NOTIFICACIÓN INMEDIATA)</label>
              <input name="correosNotificacionInput" type="text" placeholder="Ej: gerente@termales.com.co, compras@termales.com.co (Separa los correos por comas)" className="w-full border border-blue-300 bg-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 shadow-sm" />
              <p className="text-[10px] text-blue-600 mt-2 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
            </div>

            {/* ☁️ BÓVEDA SERVIDOR TERMALES */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="md:col-span-2 border-b pb-3 border-slate-200 flex justify-between items-center">
                <div>
                  <label className="font-black text-slate-800 uppercase tracking-widest text-xs">Repositorio Oficial Termales Santa Rosa</label>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Sube tus PDFs. El sistema los enviará directo a repos.termalessantarosa.com.co.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editInformeAuditoria?.evidenciaUrl || ''} />
              <input type="hidden" name="actaSocializacionUrlInput" value={actaSubidaUrl || editInformeAuditoria?.actaSocializacionUrl || ''} />

              <div className="bg-white border-2 border-dashed border-emerald-300 p-6 rounded-2xl text-center relative hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex flex-col items-center justify-center min-h-[160px] shadow-sm">
                <span className="absolute top-3 left-4 text-[9px] font-black uppercase text-emerald-600 tracking-widest bg-emerald-50 px-2 py-0.5 rounded">📄 Documento Principal</span>
                {isUploading ? (
                  <div className="space-y-3 w-full mt-4">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : archivoSubidoUrl || editInformeAuditoria?.evidenciaUrl ? (
                  <div className="space-y-2 mt-4">
                    <div className="text-4xl text-emerald-500">✅</div>
                    <label className="block mt-3 cursor-pointer text-slate-400 hover:text-emerald-600 text-[10px] font-bold uppercase tracking-wider underline transition-colors">
                      Reemplazar Archivo <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => handleFileUpload(e, 'informe')} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full mt-4">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">Seleccionar Archivo PDF</p>
                    <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => handleFileUpload(e, 'informe')} />
                  </label>
                )}
              </div>

              <div className="bg-white border-2 border-dashed border-purple-300 p-6 rounded-2xl text-center relative hover:border-purple-500 hover:bg-purple-50/50 transition-all flex flex-col items-center justify-center min-h-[160px] shadow-sm">
                 <span className="absolute top-3 left-4 text-[9px] font-black uppercase text-purple-600 tracking-widest bg-purple-50 px-2 py-0.5 rounded">🤝 Acta de Reunión</span>
                {isActaUploading ? (
                  <div className="space-y-3 w-full mt-4">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-purple-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${actaProgress}%` }}></div>
                    </div>
                  </div>
                ) : actaSubidaUrl || editInformeAuditoria?.actaSocializacionUrl ? (
                  <div className="space-y-2 mt-4">
                    <div className="text-4xl text-purple-500">✅</div>
                    <label className="block mt-3 cursor-pointer text-slate-400 hover:text-purple-600 text-[10px] font-bold uppercase tracking-wider underline transition-colors">
                      Reemplazar Archivo <input type="file" className="hidden" accept=".pdf, .jpg, .png" onChange={(e) => handleFileUpload(e, 'acta')} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full mt-4">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📷</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">Seleccionar Imagen o PDF</p>
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png" onChange={(e) => handleFileUpload(e, 'acta')} />
                  </label>
                )}
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={isSubmitting} 
                onClick={(e) => {
                  const form = e.target.closest('form');
                  if (!form) return;
                  const inputEvidencia = form.querySelector('input[name="evidenciaUrlInput"]');
                  const inputActa = form.querySelector('input[name="actaSocializacionUrlInput"]');
                  if (inputEvidencia && archivoSubidoUrl) inputEvidencia.value = archivoSubidoUrl;
                  if (inputActa && actaSubidaUrl) inputActa.value = actaSubidaUrl;

                  setTimeout(() => {
                    handleResetForm();
                    form.reset();
                    if(typeof setFormResetKey === 'function') setFormResetKey(Date.now());
                    else e.target.disabled = false;
                  }, 3000);
                }}
                className={`font-black uppercase tracking-widest px-10 py-3.5 rounded-xl shadow-lg transition-all w-full md:w-auto text-center block text-sm ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#0A3B32] hover:bg-[#062620] hover:scale-105 text-white cursor-pointer'}`}
              >
                {isSubmitting ? '⏳ Procesando...' : (editInformeAuditoria ? 'Guardar Cambios' : 'RADICAR Y ENVIAR DICTAMEN')}
              </button>
            </div>
          </form>

          {/* 🟢 PANEL DE CONTROL DE PERSONAL */}
          <div className="bg-slate-900 text-slate-100 p-6 rounded-3xl border border-slate-800 space-y-4 mt-8 shadow-inner">
            <div className="border-b border-slate-800 pb-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-300">👥 Gestión de Personal del Equipo de Auditoría</h4>
              <p className="text-[10px] text-slate-500 font-medium mt-1">Agregue o retire firmas autorizadas para los flujos del sistema en tiempo real.</p>
            </div>
            <div className="flex flex-wrap gap-2 py-2">
              {auditoresLista.map((auditor, index) => (
                <div key={`badge-${index}`} className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-[11px] font-bold shadow-sm">
                  <span>{auditor}</span>
                  <button 
                    type="button"
                    onClick={() => {
                      if(window.confirm(`¿Desea eliminar a ${auditor}?`)) {
                        onActualizarAuditores(auditoresLista.filter(a => a !== auditor));
                      }
                    }}
                    className="text-red-400 hover:text-white font-black text-[9px] ml-1 bg-red-500/10 hover:bg-red-500 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                  >✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <input type="text" id="inputNuevoAuditor" placeholder="Nombre del nuevo funcionario..." className="bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-xs flex-1 outline-none focus:border-blue-500 font-bold shadow-inner" />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('inputNuevoAuditor');
                  const nuevoNombre = input?.value?.trim();
                  if (!nuevoNombre) return;
                  if (auditoresLista.includes(nuevoNombre)) return alert("Ya registrado.");
                  onActualizarAuditores([...auditoresLista, nuevoNombre]);
                  input.value = "";
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-6 py-2.5 rounded-xl font-bold transition-all shrink-0 uppercase tracking-wider shadow-md"
              >➕ Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 VISTA 3: TABLA DE HISTORIAL EXACTA INTACTA */}
      {vistaActiva === 'historial' && (
        <div className="space-y-6 animate-in slide-in-from-left-8 duration-500">
          <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Filtros:</span>
              <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="border border-slate-300 rounded-lg text-xs py-2 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0A3B32] shadow-sm cursor-pointer">
                <option value="">📅 Todos los Años</option>
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(a => <option key={a} value={String(a)}>{a}</option>)}
              </select>
              <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="border border-slate-300 rounded-lg text-xs py-2 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0A3B32] shadow-sm cursor-pointer">
                <option value="">📆 Todos los Meses</option>
                <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-full md:w-64 shadow-inner">
              <span className="text-slate-400">🔍</span>
              <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-xs outline-none bg-transparent text-slate-700 font-bold placeholder-slate-400" />
            </div>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                    <th className="p-4 w-32">Consecutivo</th>
                    <th className="p-4">Proceso / Título</th>
                    <th className="p-4">Trazabilidad de Firmas</th>
                    <th className="p-4">Socialización e Impacto</th>
                    <th className="p-4 text-center w-56">Documentos Custodiados</th>
                  </tr>
                  <tr className="bg-slate-100">
                    <td className="p-2"><FilterInput colKey="ref" placeholder="Filtrar..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></td>
                    <td className="p-2"><FilterInput colKey="proceso" placeholder="Filtrar proceso..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 bg-slate-50"></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {applyFilters(informesFiltradosPorFecha, searchTerm, columnFilters).length === 0 ? (
                    <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold italic">No se encontraron informes.</td></tr>
                  ) : (
                    applyFilters(informesFiltradosPorFecha, searchTerm, columnFilters).map((inf, idx) => (
                      <tr key={inf.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">{inf.ref || `INF-2026-${String(idx + 1).padStart(3, '0')}`}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">{inf.proceso}</span>
                          <div className="font-bold text-slate-900 text-sm leading-tight">{inf.titulo}</div>
                          <div className="text-[9px] text-slate-400 font-medium mt-1">Emitido el: {inf.fecha}</div>
                        </td>
                        <td className="p-4">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px] font-medium text-slate-600">
                            <div><span className="text-slate-400 font-bold">✍️ ELABORÓ:</span> <span className="font-black text-slate-800">{inf.elaboradoPor}</span></div>
                            <div><span className="text-slate-400 font-bold">🔍 REVISÓ:</span> <span className="font-black text-slate-800">{inf.revisadoPor}</span></div>
                            <div><span className="text-slate-400 font-bold">🔒 APROBÓ:</span> <span className="font-black text-slate-800">{inf.aprobadoPor}</span></div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-start space-y-1.5">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block ${inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado || 'No'}</span>
                            {inf.socializadoCon && <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">Con: {inf.socializadoCon}</div>}
                            {inf.correoEnviadoA && (
                              <div className="mt-2 group inline-block cursor-help">
                                <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm">
                                  <span className="text-sm">📧</span><span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Notificado al Líder</span>
                                </div>
                                <div className="fixed inset-0 z-[9999] pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible flex items-center justify-center transition-all duration-300">
                                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"></div>
                                  <div className="relative bg-[#0f172a] border border-emerald-500/40 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] transform scale-95 group-hover:scale-100 transition-transform duration-300 w-80 text-left">
                                    <h4 className="text-[12px] font-black text-emerald-400 uppercase tracking-widest mb-3 border-b border-slate-700/80 pb-2 flex items-center"><span className="mr-2 text-base">🔗</span> Audit Trail de Correo</h4>
                                    <div className="space-y-3 text-[10px] leading-relaxed text-slate-300 font-medium">
                                      <p className="flex flex-col"><b className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Destinatario(s):</b> <span className="text-white font-mono break-all bg-slate-800/80 p-1.5 rounded border border-slate-700">{inf.correoEnviadoA}</span></p>
                                      <p className="flex flex-col"><b className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Fecha y Hora de Despacho:</b> <span className="text-emerald-400 font-black text-xs">{inf.fechaCorreoEnviado}</span></p>
                                      <p className="text-[9px] text-slate-500 italic mt-3 border-t border-slate-700/80 pt-3">El sistema GRC certifica que este dictamen fue despachado de forma segura.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center space-y-1.5 align-middle">
                          <a href={inf.evidenciaUrl || "#"} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full"><span>📄</span><span>Ver Informe Final</span></a>
                          {inf.actaSocializacionUrl ? (
                            <a href={inf.actaSocializacionUrl} target="_blank" rel="noreferrer" className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full"><span>🤝</span><span>Ver Acta Socialización</span></a>
                          ) : <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1.5 rounded border border-dashed text-center">Sin Acta Cargada</div>}
                          {isAdmin && (
                            <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                              <button type="button" onClick={() => { setEditInformeAuditoria(inf); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm(); }} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏️ Editar</button>
                              <span className="text-slate-200">|</span>
                              <button type="button" onClick={() => handleDeleteItem('informesAuditoria', inf.id)} className="text-slate-400 hover:text-red-600 text-xs font-bold">🗑️ Eliminar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}