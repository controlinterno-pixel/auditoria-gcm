import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { useCatalogos } from '../context/useCatalogos';

const convertirResponsablesEnLista = responsables => (
  Array.isArray(responsables)
    ? responsables.map(responsable => String(responsable || '').trim()).filter(Boolean)
    : String(responsables || '').split(',').map(responsable => responsable.trim()).filter(Boolean)
);

export default function Hallazgos({
  isAdmin,
  puedeCrearHallazgos = false,
  safeRiesgos = [],
  informesAuditoria = [], 
  fuentesMejora = [],
  editHallazgo,
  setEditHallazgo,
  handleHallazgoSubmit,
  setFormResetKey = () => {},
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  hFiltrados = [],
  searchTerm = '',
  setSearchTerm = () => {},
  columnFilters = {},
  handleColFilterChange = () => {},
  FilterInput,
  exportToExcel
}) {
  const { mapaProcesos: MAPA_PROCESOS, cargosEmpresa: CARGOS_EMPRESA, sedesEmpresa } = useCatalogos();

  // 🧭 ESTADOS DE NAVEGACIÓN (TABS Y ACORDEÓN)
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [grupoExpandido, setGrupoExpandido] = useState(new Date().getFullYear().toString());
  const [informeHistorialExpandido, setInformeHistorialExpandido] = useState(null);

  // ✨ NUEVA FUNCIÓN DE UX: Previene salir por accidente si hay cambios
  const cambiarVistaSegura = (nuevaVista) => {
    if (nuevaVista === vistaActiva) return; // Si hace clic en la misma pestaña, ignoramos

    // Verificamos si estamos en el formulario ('nuevo') y NO estamos en modo solo lectura
    if (vistaActiva === 'nuevo' && !esSoloLectura) {
      const confirma = window.confirm("¿Estás seguro de que deseas salir sin guardar? Perderás todos los datos que hayas ingresado en el hallazgo.");
      if (confirma) {
        setVistaActiva(nuevaVista);
      }
    } else {
      // Si está en el dashboard, historial, o en modo solo lectura, navega sin preguntar
      setVistaActiva(nuevaVista);
    }
  };

  // 🎛️ ESTADOS DEL PANEL LATERAL (DASHBOARD)
  const [agruparPor, setAgruparPor] = useState('Año'); 
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroSubproceso, setDashFiltroSubproceso] = useState('Todos'); 
  const [dashFiltroSeveridad, setDashFiltroSeveridad] = useState('Todos');
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroResponsable, setDashFiltroResponsable] = useState('Todos');

  // ⏳ ESTADOS LOCALES PARA FILTROS DE HISTORIAL
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroTipoFuente, setFiltroTipoFuente] = useState(''); // ✨ Estado para filtrar por Tipo de Fuente

  // 🏢 ESTADOS Y LÓGICA DERIVADA PARA FORMULARIO DE EDICIÓN
  const [sedeTemp, setSedeTemp] = useState('');
  const [sedesState, setSedesState] = useState({});
  const [responsableTemp, setResponsableTemp] = useState('');
  const [responsablesState, setResponsablesState] = useState({});

  // 👁️ ESTADO DE MODO SOLO LECTURA (VISTA CONSULTA)
  const [esSoloLectura, setEsSoloLectura] = useState(false);

  // 🌟 ESTADOS DERIVADOS DE MACRO Y SUBPROCESO
  const [procesoFormState, setProcesoFormState] = useState({});
  const [subprocesoFormState, setSubprocesoFormState] = useState({});
  const [informeOrigenState, setInformeOrigenState] = useState({});
  const [metodologiaCausaState, setMetodologiaCausaState] = useState({});
  const [autoFillData] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const tempAuto = sessionStorage.getItem('hallazgo_emergente_auto');
      return tempAuto ? JSON.parse(tempAuto) : null;
    } catch { 
      return null; 
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('hallazgo_emergente_auto')) {
      sessionStorage.removeItem('hallazgo_emergente_auto');
    }
  }, []);

  const idEdicion = editHallazgo?.id || 'nuevo';
  const responsablesMultiples = responsablesState[idEdicion] ?? convertirResponsablesEnLista(editHallazgo?.responsable);
  const setResponsablesMultiples = responsables => setResponsablesState(prev => ({ ...prev, [idEdicion]: responsables }));
  const limpiarResponsablesNuevo = () => {
    setResponsablesState(prev => ({ ...prev, nuevo: [] }));
    setResponsableTemp('');
  };

  const fuentesMejoraDisponibles = Array.isArray(fuentesMejora) ? fuentesMejora : [];
  const informeOrigenSeleccionado = informeOrigenState[idEdicion] ?? String(editHallazgo?.idInforme || autoFillData?.idInforme || '');
  const metodologiaCausa = metodologiaCausaState[idEdicion] ?? (editHallazgo?.metodologiaCausa || autoFillData?.metodologiaCausa || '5 Porqués');

  const procesoForm = procesoFormState[idEdicion] ?? (editHallazgo?.proceso || autoFillData?.proceso || '');
  const subprocesoForm = subprocesoFormState[idEdicion] ?? (editHallazgo?.subproceso || autoFillData?.subproceso || 'General');

  const setProcesoForm = (val) => setProcesoFormState(prev => ({ ...prev, [idEdicion]: val }));
  const setSubprocesoForm = (val) => setSubprocesoFormState(prev => ({ ...prev, [idEdicion]: val }));

  const sedesMultiples = sedesState[idEdicion] ?? (editHallazgo?.sede
    ? (editHallazgo.sede.includes(',') ? editHallazgo.sede.split(',').map(s => s.trim()) : [editHallazgo.sede])
    : ['Administrativos']);

  const setSedesMultiples = (newSedes) => setSedesState(prev => ({ ...prev, [idEdicion]: newSedes }));

 const subprocesosDisponibles = procesoForm ? MAPA_PROCESOS[procesoForm] || [] : [];
  const subprocesoDeshabilitado = !procesoForm || subprocesosDisponibles.length === 0;
  const informeOrigen = informesAuditoria.find(informe => String(informe.id) === String(informeOrigenSeleccionado));
  const fuenteOrigen = fuentesMejoraDisponibles.find(fuente => (
    String(fuente.codigo || fuente.id) === String(informeOrigen?.tipoFuente || '')
  ));
  const normaReferencia = fuenteOrigen?.norma || fuenteOrigen?.tipoNorma || informeOrigen?.norma || '';

  // ✨ NUEVO: Extracción de la Fuente de Mejora y su Detalle desde el Informe Origen
  const tipoFuenteHallazgo = informeOrigen?.tipoFuente || editHallazgo?.tipoFuente || autoFillData?.tipoFuente || '';
  const metodologiaCausaDeshabilitada = esSoloLectura || tipoFuenteHallazgo === 'Programa de Auditoría';
  const detalleFuenteHallazgo = informeOrigen?.detalleFuente || editHallazgo?.detalleFuente || '';

  // 🧠 GENERADOR DE ID AUTOMÁTICO
  const anioActual = new Date().getFullYear();
  const consecutivos = hFiltrados
    .filter(h => h.ref && h.ref.includes(anioActual.toString()))
    .map(h => parseInt(h.ref.split('-')[2]) || 0);
  const maxConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) : 0;
  const nextIdVal = editHallazgo ? editHallazgo.ref : `HAL-${anioActual}-${String(maxConsecutivo + 1).padStart(3, '0')}`;

  // ☁️ MOTOR DE SUBIDA DE EVIDENCIAS A LA API DE TERMALES
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [archivosSubidosState, setArchivosSubidosState] = useState({});
  const evidenciasIniciales = Array.isArray(editHallazgo?.evidencias)
    ? editHallazgo.evidencias
    : editHallazgo?.evidenciaUrl
      ? [{ url: editHallazgo.evidenciaUrl, nombre: 'Evidencia anterior' }]
      : [];
  const archivosSubidos = archivosSubidosState[idEdicion] ?? evidenciasIniciales;
  const actualizarArchivosSubidos = (actualizador) => {
    setArchivosSubidosState(prev => {
      const actuales = prev[idEdicion] ?? evidenciasIniciales;
      const siguientes = typeof actualizador === 'function' ? actualizador(actuales) : actualizador;
      return { ...prev, [idEdicion]: siguientes };
    });
  };

 const handleFileUpload = async (e) => {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length === 0) return;

    // Límite unificado a 25 MB
    const MAX_MB = 25;
    const archivoPesado = archivos.find(archivo => archivo.size > MAX_MB * 1024 * 1024);
    if (archivoPesado) {
      alert(`🛑 ERROR DE TAMAÑO\n\nEl archivo ${archivoPesado.name} supera el límite máximo permitido de ${MAX_MB} MB.`);
      e.target.value = '';
      return;
    }

    setIsUploading(true); setUploadProgress(20);
    try {
      const nuevasEvidencias = [];
      for (let indice = 0; indice < archivos.length; indice += 1) {
        const archivo = archivos[indice];
        setUploadProgress(20 + Math.round((indice / archivos.length) * 70));
        const data = await apiService.subirEvidencia(archivo, { appName: 'controlInterno' });
        const urlFinal = apiService.resolveArchivoUrl({
          appName: data?.appName || 'controlInterno',
          fileName: data?.fileName || data?.filename || '',
          url: data?.url,
          file: data?.file,
        }) || `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${(data?.appName || 'controlInterno').toLowerCase()}/${encodeURIComponent(data?.fileName || 'archivo')}`;
        nuevasEvidencias.push({ url: urlFinal, nombre: archivo.name });
      }
      actualizarArchivosSubidos(prev => [...prev, ...nuevasEvidencias]);
      setIsUploading(false); setUploadProgress(100);
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
    // Generar campo unificado para soporte a datos viejos y nuevos
    const procesoLimpio = h.proceso || 'Sin Proceso';
    return { ...h, fechaReal, anioReal: fechaReal !== 'Sin Fecha' ? fechaReal.split('-')[0] : 'Sin Fecha', procesoLimpio };
  });

  // 1. Filtrar los datos del Dashboard según el menú lateral
  const hallazgosDashboard = hallazgosEnriquecidos.filter(h => {
    if (dashFiltroAnio !== 'Todos' && h.anioReal !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && h.procesoLimpio !== dashFiltroProceso) return false;
    if (dashFiltroSubproceso !== 'Todos' && h.subproceso !== dashFiltroSubproceso) return false; 
    if (dashFiltroSeveridad !== 'Todos' && h.severidad !== dashFiltroSeveridad) return false;
    if (dashFiltroEstado !== 'Todos' && h.estado !== dashFiltroEstado) return false;
    if (dashFiltroResponsable !== 'Todos' && !convertirResponsablesEnLista(h.responsable).includes(dashFiltroResponsable)) return false;
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
    if (agruparPor === 'Proceso') key = h.procesoLimpio;
    if (agruparPor === 'Subproceso') key = h.subproceso || 'General'; 
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
    acc[h.procesoLimpio] = (acc[h.procesoLimpio] || 0) + 1;
    return acc;
  }, {});
  const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos'); setDashFiltroProceso('Todos'); setDashFiltroSubproceso('Todos'); setDashFiltroSeveridad('Todos');
    setDashFiltroEstado('Todos'); setDashFiltroResponsable('Todos');
  };
  // 🧠 LÓGICA DE FILTRADO (Historial Completo)
  const hallazgosFiltradosPorFecha = hallazgosEnriquecidos.filter(h => {
    if (filtroAnio && h.anioReal !== filtroAnio) return false;
    if (filtroMes && h.fechaReal.split('-')[1] !== filtroMes) return false;
    
    // ✨ Filtrado inteligente por Tipo de Fuente (Buscando en el informe de origen)
    if (filtroTipoFuente) {
      const informeOrigen = informesAuditoria.find(inf => String(inf.id) === String(h.idInforme));
      if (!informeOrigen) return false; // Si no hay informe base, no puede cumplir el filtro
      
      const referencia = String(informeOrigen.tipoFuente || 'Auditoría Interna').trim();
      const fuenteReal = fuentesMejoraDisponibles.find(f => 
        String(f.codigo || '').toLowerCase() === referencia.toLowerCase() || 
        String(f.id || '').toLowerCase() === referencia.toLowerCase()
      );
      
      const nombreGrupo = fuenteReal ? (fuenteReal.norma || fuenteReal.tipoNorma || fuenteReal.tipoFuente || 'Fuente sin norma') : referencia;
      if (nombreGrupo !== filtroTipoFuente) return false;
    }
    
    return true;
  });

  // Extraer las fuentes únicas disponibles dinámicamente
  const fuentesUnicasDisponibles = [...new Set(hallazgosEnriquecidos.map(h => {
    const informeOrigen = informesAuditoria.find(inf => String(inf.id) === String(h.idInforme));
    if (!informeOrigen) return 'Auditoría Interna'; // Fallback de seguridad
    
    const referencia = String(informeOrigen.tipoFuente || 'Auditoría Interna').trim();
    const fuenteReal = fuentesMejoraDisponibles.find(f => 
      String(f.codigo || '').toLowerCase() === referencia.toLowerCase() || 
      String(f.id || '').toLowerCase() === referencia.toLowerCase()
    );
    return fuenteReal ? (fuenteReal.norma || fuenteReal.tipoNorma || fuenteReal.tipoFuente || 'Fuente sin norma') : referencia;
  }))].sort();

  const aniosDisponibles = [...new Set(hallazgosEnriquecidos.map(h => h.anioReal).filter(a => a !== 'Sin Fecha'))].sort().reverse();
  
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 📋 CABECERA PRINCIPAL CON BANNER DE IMAGEN ESTILO PREMIUM */}
      <div 
        className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-6 mb-6 z-20"
      >
        {/* IMAGEN DE FONDO CON OVERLAY */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url('/Informes.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070f1e] via-[#070f1e]/90 to-transparent z-10" />

        {/* CONTENIDO IZQUIERDA */}
        <div className="relative z-20 w-full md:w-3/5 flex flex-col gap-6">
          
          {/* Bloque 1: Título y descripción */}
          <div className="flex items-start gap-4">
            {/* Ícono Circular Campana */}
            <div className="w-12 h-12 rounded-full border-[3px] border-blue-500/80 bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] backdrop-blur-sm">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            
            <div className="pt-1">
              <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
                Hallazgos
              </h2>
              <p className="text-[13px] text-slate-300 font-medium mt-1.5 leading-relaxed max-w-md">
                Convierte la información en decisiones de alto impacto.
              </p>
            </div>
          </div>

          {/* Bloque 2: Frase destacada */}
          <div className="ml-[64px]">
            <h3 className="text-lg md:text-xl font-bold text-white drop-shadow-md leading-tight">
              Los hallazgos de hoy, <br className="hidden md:block" /> construyen un mejor mañana.
            </h3>
            <div className="h-1.5 w-14 bg-blue-500 mt-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </div>
        </div>

        {/* BOTONERA DERECHA */}
        <div className="relative z-20 flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <button onClick={() => cambiarVistaSegura('dashboard')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'dashboard' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📊 Resumen Visual</button>
          <button onClick={() => cambiarVistaSegura('historial')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'historial' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📜 Historial Completo</button>
          
          {(isAdmin || puedeCrearHallazgos) && (
            <button 
              type="button"
              onClick={() => { 
                // Protegemos si presiona "Nuevo Hallazgo" mientras ya estaba escribiendo uno
                if (vistaActiva === 'nuevo' && !esSoloLectura) {
                  if (window.confirm("¿Estás seguro de que deseas salir sin guardar? Perderás los datos de este hallazgo para crear uno nuevo.")) {
                    setEditHallazgo(null); 
                    setEsSoloLectura(false); 
                    limpiarResponsablesNuevo();
                  }
                } else {
                  setEditHallazgo(null); 
                  setEsSoloLectura(false); 
                  limpiarResponsablesNuevo();
                  setVistaActiva('nuevo'); 
                }
              }} 
              className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-lg border backdrop-blur-sm ${vistaActiva === 'nuevo' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white border-transparent' : 'bg-[#0A3B32] text-white hover:bg-[#062620] border-emerald-900'}`}
            >
              <span className="mr-2">➕</span> Nuevo Hallazgo
            </button>
          )}

          {vistaActiva === 'historial' && typeof exportToExcel === 'function' && (
             <button type="button" onClick={() => exportToExcel(hFiltrados, 'Historico_Hallazgos')} className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600/40 shadow-sm flex items-center backdrop-blur-sm">
               <span className="mr-2">📥</span> Exportar
             </button>
          )}
        </div>
      </div>

      {/* 🚀 VISTA 1: DASHBOARD DE KPIs CON MENÚ LATERAL */}
      {vistaActiva === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* 🚀 TARJETAS INTERACTIVAS */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
             <div onClick={() => { setDashFiltroSeveridad('Todos'); setDashFiltroEstado('Todos'); }} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroSeveridad === 'Todos' && dashFiltroEstado === 'Todos' ? 'border-slate-800 ring-4 ring-slate-800/10' : 'border-slate-200 hover:border-slate-400'}`}>
                <div className="absolute -right-4 -bottom-4 text-5xl opacity-5">📄</div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Hallazgos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black shadow-md">∑</div>
                  <p className="text-3xl font-black text-slate-800">{totalHallazgos}</p>
                </div>
             </div>
             
             <div onClick={() => { setDashFiltroSeveridad('Crítico'); setDashFiltroEstado('Todos'); }} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroSeveridad === 'Crítico' ? 'border-red-500 ring-4 ring-red-500/20' : 'border-red-200 hover:border-red-500'}`}>
                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1 flex justify-between">Críticos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-black shadow-md animate-pulse">!</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{criticos}</p>
                    <p className="text-[9px] font-bold text-red-500 mt-0.5">{pct(criticos)}% del total</p>
                  </div>
                </div>
             </div>

             <div onClick={() => { setDashFiltroSeveridad('Alto'); setDashFiltroEstado('Todos'); }} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroSeveridad === 'Alto' ? 'border-orange-500 ring-4 ring-orange-500/20' : 'border-orange-200 hover:border-orange-500'}`}>
                <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Altos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-black shadow-md">↑</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{altos}</p>
                    <p className="text-[9px] font-bold text-orange-500 mt-0.5">{pct(altos)}% del total</p>
                  </div>
                </div>
             </div>

             <div onClick={() => { setDashFiltroSeveridad('Medio'); setDashFiltroEstado('Todos'); }} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroSeveridad === 'Medio' ? 'border-amber-500 ring-4 ring-amber-500/20' : 'border-amber-200 hover:border-amber-500'}`}>
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Medios</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-black shadow-md">-</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{medios}</p>
                    <p className="text-[9px] font-bold text-amber-500 mt-0.5">{pct(medios)}% del total</p>
                  </div>
                </div>
             </div>

             <div onClick={() => { setDashFiltroSeveridad('Bajo'); setDashFiltroEstado('Todos'); }} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroSeveridad === 'Bajo' ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-emerald-200 hover:border-emerald-500'}`}>
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Bajos</p>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black shadow-md">↓</div>
                  <div>
                    <p className="text-3xl font-black text-slate-800 leading-none">{bajos}</p>
                    <p className="text-[9px] font-bold text-emerald-500 mt-0.5">{pct(bajos)}% del total</p>
                  </div>
                </div>
             </div>

             <div onClick={() => { setDashFiltroEstado('Cerrado'); setDashFiltroSeveridad('Todos'); }} className={`bg-white p-4 rounded-2xl border shadow-sm flex flex-col justify-center relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${dashFiltroEstado === 'Cerrado' ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-blue-200 hover:border-blue-500'}`}>
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
                      { id: 'Subproceso', label: 'Vista por Subproceso', icon: '🗂️' }, // ✨ NUEVO BOTÓN
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
                    <select 
                      value={dashFiltroProceso} 
                      onChange={e => { setDashFiltroProceso(e.target.value); setDashFiltroSubproceso('Todos'); }} 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]"
                    >
                      <option value="Todos">Todos</option>
                      {Object.keys(MAPA_PROCESOS).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                 {/* ✨ NUEVO: SELECTOR DE SUBPROCESO DINÁMICO */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Subproceso</label>
                    <select 
                      value={dashFiltroSubproceso} 
                      onChange={e => setDashFiltroSubproceso(e.target.value)} 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]"
                    >
                      <option value="Todos">Todos</option>
                      {[...new Set(dashFiltroProceso !== 'Todos' ? (MAPA_PROCESOS[dashFiltroProceso] || []) : Object.values(MAPA_PROCESOS).flat())].sort().map(sp => (
                        <option key={sp} value={sp}>{sp}</option>
                      ))}
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
                         <div className="flex items-center space-x-3 flex-1 pr-4">
                           <span className="text-xl shrink-0">{agruparPor === 'Año' ? '📅' : agruparPor === 'Proceso' ? '🏛️' : agruparPor === 'Estado' ? '🚩' : agruparPor === 'Nivel de Riesgo' ? '⚠️' : '👤'}</span>
                           <h4 className="text-sm sm:text-base font-black text-slate-800 leading-tight">{grupo} <span className="text-slate-400 font-medium text-xs ml-1 whitespace-nowrap">({hzs.length})</span></h4>
                           {grupo === new Date().getFullYear().toString() && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm shrink-0">Actual</span>}
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
                                   <tr 
                                     key={h.id} 
                                     onClick={() => {
                                        // 🚀 NAVEGACIÓN INTELIGENTE: Viaja a gestionar este hallazgo
                                        setEditHallazgo(h);
                                       setEsSoloLectura(!isAdmin);
                                        setVistaActiva('nuevo');
                                        scrollToForm();
                                     }}
                                     className="hover:bg-red-50 transition-colors cursor-pointer group/row"
                                     title="Clic para ver detalle o gestionar este hallazgo"
                                   >
                                     <td className="py-2.5 font-mono font-black text-slate-700 align-top group-hover/row:text-red-700">{h.ref}</td>
                                     <td className="py-2.5 font-bold text-slate-600 pr-3 leading-tight align-top group-hover/row:text-red-900" title={h.titulo}>{h.titulo}</td>
                                     <td className="py-2.5 pr-3 leading-tight align-top">
                                        <span className="block font-medium text-slate-500">{h.proceso || h.proceso}</span>
                                        {h.subproceso && h.subproceso !== 'General' && <span className="block text-[8px] font-bold text-slate-400 mt-0.5">↳ {h.subproceso}</span>}
                                     </td>
                                     <td className="py-2.5 text-center align-top">
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
                                     <td className="py-2.5 font-bold text-slate-500 truncate max-w-[120px]" title={convertirResponsablesEnLista(h.responsable).join(', ')}>{convertirResponsablesEnLista(h.responsable).join(', ') || 'Sin asignar'}</td>
                                     <td className="py-2.5 font-bold text-slate-400 text-right flex items-center justify-end space-x-2">
                                       <span>{h.fechaReal}</span>
                                       <span className="text-[10px] opacity-0 group-hover/row:opacity-100 text-red-600 transition-all font-bold">⚙️</span>
                                     </td>
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

      {/* 🚀 VISTA 2: FORMULARIO EXACTO INTACTO CON JERARQUÍA MACRO-SUB */}
      {vistaActiva === 'nuevo' && (isAdmin || puedeCrearHallazgos || esSoloLectura) && (
        <div id="edit-form" className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-200 space-y-4 relative animate-in slide-in-from-right-8 duration-500 max-w-5xl mx-auto">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-sm font-black text-[#0A3B32] uppercase tracking-widest flex items-center">
              <span className="text-xl mr-3 bg-red-50 p-2 rounded-lg">
                {esSoloLectura ? '👁️' : (editHallazgo ? '✏️' : '➕')}
              </span>
              {esSoloLectura 
                ? `Consulta Detallada: ${editHallazgo?.ref || ''}` 
                : (editHallazgo ? `Editando Hallazgo: ${editHallazgo.ref}` : 'DOCUMENTAR NUEVA DESVIACIÓN')
              }
            </h3>
            {esSoloLectura && (
              <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
                🔒 Modo Solo Lectura
              </span>
            )}
          </div>

          <form onSubmit={async (e) => {
            if (!esSoloLectura && responsablesMultiples.length === 0) {
              e.preventDefault();
              window.alert('Añade al menos un responsable antes de guardar el hallazgo.');
              return;
            }
            const guardado = await handleHallazgoSubmit(e);
            if (guardado) setVistaActiva('dashboard');
          }} key={editHallazgo?.id || 'nuevo-hallazgo'} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
            
            {/* Input Oculto de Compatibilidad (Legacy) */}
            <input type="hidden" name="proceso" value={procesoForm} />
            
            {/* ================= FILA 1: DATOS MAESTROS REBALANCED (1 + 1 + 2 = 4) ================= */}
            <div className="md:col-span-1">
              <label className="font-bold text-gray-600 block mb-1">ID / Código (Automático)</label>
              <input name="ref" value={nextIdVal} readOnly className="w-full border border-slate-200 bg-slate-100 text-slate-500 font-black rounded-lg p-2 cursor-not-allowed outline-none focus:ring-0" />
            </div>

            <div className="md:col-span-1">
              <label className="font-bold text-gray-600 block mb-1">Clase de Observación</label>
<select name="claseObservacion" disabled={esSoloLectura} defaultValue={editHallazgo?.claseObservacion || autoFillData?.claseObservacion || 'Hallazgo'} className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium text-slate-700 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                <option value="Hallazgo">Hallazgo</option>
                <option value="No Conformidad">No Conformidad</option>
                <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
                <option value="Observación">Observación</option>
              </select>
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="font-bold text-gray-600 block mb-1">Responsables</label>
              <div className="flex gap-2">
                <select
                  value={responsableTemp}
                  onChange={event => setResponsableTemp(event.target.value)}
                  disabled={esSoloLectura}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">-- Seleccione un Cargo --</option>
                  {CARGOS_EMPRESA.map(cargo => <option key={cargo} value={cargo} disabled={responsablesMultiples.includes(cargo)}>{cargo}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (responsableTemp && !responsablesMultiples.includes(responsableTemp)) {
                      setResponsablesMultiples([...responsablesMultiples, responsableTemp]);
                    }
                    setResponsableTemp('');
                  }}
                  disabled={esSoloLectura || !responsableTemp}
                  className="shrink-0 rounded-lg bg-[#0A3B32] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#062620] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Añadir
                </button>
              </div>
              <div className="mt-2 flex min-h-9 flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-2">
                {responsablesMultiples.length === 0 && <span className="w-full text-center text-[10px] italic text-slate-400">Ningún responsable añadido...</span>}
                {responsablesMultiples.map(responsable => (
                  <span key={responsable} className="flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                    {responsable}
                    {!esSoloLectura && <button type="button" onClick={() => setResponsablesMultiples(responsablesMultiples.filter(item => item !== responsable))} aria-label={`Quitar ${responsable}`} className="ml-1.5 font-black text-rose-500 hover:text-rose-700">×</button>}
                  </span>
                ))}
              </div>
              <input type="hidden" name="responsable" value={responsablesMultiples.join(', ')} />
            </div>
            
{/* ================= FILA 2: ORIGEN Y CONTEXTO JERÁRQUICO ================= */}
            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Informe de Auditoría Origen</label>
              <select 
                name="idInforme" 
                disabled={esSoloLectura}
                value={informeOrigenSeleccionado}
                onChange={(e) => {
                  const idInfSeleccionado = e.target.value;
                  setInformeOrigenState(prev => ({ ...prev, [idEdicion]: idInfSeleccionado }));

                  const infEncontrado = informesAuditoria.find(inf => String(inf.id) === String(idInfSeleccionado));
                  if (infEncontrado) {
                    const macroAuto = infEncontrado.macroproceso || infEncontrado.proceso || '';
                    const subAuto = infEncontrado.subproceso || 'General';

                    setProcesoFormState(prev => ({ ...prev, [idEdicion]: macroAuto }));
                    setSubprocesoFormState(prev => ({ ...prev, [idEdicion]: subAuto }));
                  }
                }} 
                required 
                className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700"
              >
                <option value="">-- Seleccione el Informe Radicado --</option>
                {informesAuditoria.map((inf) => (
                  <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Norma / Referencia *</label>
              <input name="normaReferencia" value={normaReferencia} readOnly placeholder="Se completa desde el Informe" className="w-full border border-slate-200 bg-slate-100 text-slate-600 font-bold rounded-lg p-2 outline-none cursor-not-allowed" />
            </div>

            {/* ✨ NUEVAS CASILLAS HEREDADAS DEL INFORME */}
            <div className="md:col-span-1">
              <label className="font-bold text-emerald-700 block mb-1">Fuente de Mejora</label>
              <input 
                name="tipoFuente" 
                value={tipoFuenteHallazgo} 
                readOnly 
                placeholder="Se hereda del informe..." 
                className="w-full border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold rounded-lg p-2 cursor-not-allowed outline-none shadow-inner" 
              />
            </div>

            <div className="md:col-span-3">
              <label className="font-bold text-emerald-700 block mb-1">Detalle de la Fuente</label>
              <input 
                name="detalleFuente" 
                value={detalleFuenteHallazgo} 
                readOnly 
                placeholder="Se hereda del informe..." 
                className="w-full border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold rounded-lg p-2 cursor-not-allowed outline-none shadow-inner" 
              />
            </div>
            
           {/* 🔍 MACROPROCESO / PROCESO */}
            <div className="md:col-span-1">
               <label className="font-bold text-gray-600 block mb-1">Proceso / Macroproceso</label>
               <select 
  name="proceso" 
  disabled={esSoloLectura}
  value={procesoForm}
                 onChange={(e) => {
                   const nuevoProceso = e.target.value;
                   const subprocesos = MAPA_PROCESOS[nuevoProceso] || [];
                   setProcesoForm(nuevoProceso);
                   setSubprocesoForm(subprocesos.length === 1 ? subprocesos[0] : '');
                 }} 
                 required 
                 className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700"
               >
                 <option value="">-- Seleccione --</option>
                 {Object.keys(MAPA_PROCESOS).map(m => <option key={m} value={m}>{m}</option>)}
               </select>
            </div>

            {/* 🔍 SUBPROCESO */}
            <div className="md:col-span-1">
               <label className="font-bold text-gray-600 block mb-1">Subproceso</label>
               <select 
  name="subproceso" 
  value={subprocesoForm} 
  onChange={(e) => setSubprocesoForm(e.target.value)} 
  required 
  className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
  disabled={subprocesoDeshabilitado || esSoloLectura}
>
                 <option value="">-- Seleccione --</option>
                 {subprocesosDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>

            {/* ================= FILA 3: ASIGNACIÓN COMPUESTA (2 + 2 = 4) ================= */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 md:col-span-2">
              <label className="font-bold text-gray-600 block mb-1">Sedes Afectadas</label>
              <div className="flex gap-2 mb-2">
                <select 
                  value={sedeTemp} 
                  onChange={(e) => setSedeTemp(e.target.value)} 
                  disabled={esSoloLectura}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">-- Escoger Sede --</option>
                  {sedesEmpresa.map(s => <option key={s} value={s} disabled={sedesMultiples.includes(s)}>{s}</option>)}
                </select>
                <button 
                  type="button" 
                  onClick={() => { if (sedeTemp && !sedesMultiples.includes(sedeTemp)) setSedesMultiples([...sedesMultiples, sedeTemp]); setSedeTemp(''); }} 
                  disabled={esSoloLectura}
                  className="bg-red-600 text-white px-4 rounded-lg text-xs font-bold hover:bg-red-700 shrink-0 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ➕ Añadir
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                {sedesMultiples.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Ninguna sede añadida...</span>}
                {sedesMultiples.map(s => (
                  <span key={s} className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                    {s} 
                    {!esSoloLectura && (
                      <button type="button" onClick={() => setSedesMultiples(sedesMultiples.filter(item => item !== s))} className="ml-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                    )}
                  </span>
                ))}
              </div>
              <input type="hidden" name="sede" value={sedesMultiples.join(', ')} />
            </div>

            {/* ================= BLOQUES ANCHOS COMPLETOS ================= */}
            <div className="md:col-span-4 bg-red-50/50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
              <div>
                <label className="font-black text-red-800 block mb-1 uppercase tracking-widest text-[10px]">⚠️ Nivel de Severidad</label>
                <p className="text-[9px] text-red-600 font-medium">Clasificación del riesgo asociado a esta desviación.</p>
              </div>
<select name="severidad" disabled={esSoloLectura} defaultValue={editHallazgo?.severidad || autoFillData?.severidad || 'Medio'} className="border border-red-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-800 w-48 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                <option value="Crítico">Crítico</option>
                <option value="Alto">Alto</option>
                <option value="Medio">Medio</option>
                <option value="Bajo">Bajo</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="font-bold text-gray-600 block mb-1">Título / Descripción de la Falla</label>
<textarea name="titulo" disabled={esSoloLectura} defaultValue={editHallazgo?.titulo || autoFillData?.titulo || ''} required rows="4" placeholder="Describa el hallazgo detalladamente..." className="w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none font-medium resize-y shadow-inner disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed" />
            </div>            

            {/* ✨ NUEVA SECCIÓN: ANÁLISIS DE CAUSAS RAÍZ */}
            <div className="md:col-span-4 bg-amber-50/60 p-5 rounded-2xl border border-amber-200 shadow-inner mt-1 mb-2">
              <div className="flex flex-col md:flex-row gap-5 mb-4">
                <div className="w-full md:w-1/3">
                  <label className="font-black text-amber-900 block mb-1.5 uppercase tracking-widest text-[10px]">
                    🧠 Metodología de Causa Raíz
                  </label>
                  <select 
  name="metodologiaCausa" 
  disabled={metodologiaCausaDeshabilitada}
  value={metodologiaCausa}
  onChange={(e) => setMetodologiaCausaState(prev => ({ ...prev, [idEdicion]: e.target.value }))}
  className="w-full border border-amber-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-amber-600 outline-none font-bold text-slate-800 shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
>
                    <option value="5 Porqués">Los 5 Porqués (ISO 9001)</option>
                    <option value="Ishikawa">Diagrama de Ishikawa (6M)</option>
                    <option value="Bow-Tie">Análisis Bow-Tie (Riesgos)</option>
                    <option value="Árbol de Fallas">Árbol de Fallas (FTA)</option>
                    <option value="Análisis Directo">Análisis Directo / Empírico</option>
                  </select>
                </div>
                <div className="w-full md:w-2/3 flex items-center">
                   <p className="text-[10px] text-amber-800 font-medium leading-relaxed bg-amber-100/50 p-3 rounded-xl border border-amber-200/60">
                     {metodologiaCausa === '5 Porqués' && "Recomendado por ISO 9001 para problemas lineales. Pregunte '¿Por qué?' de forma iterativa hasta llegar a la falla sistémica."}
                     {metodologiaCausa === 'Ishikawa' && "Recomendado para procesos complejos. Categorice en: Mano de obra, Maquinaria, Métodos, Materiales, Medición y Medio ambiente."}
                     {metodologiaCausa === 'Bow-Tie' && "Estándar Big Four (ISO 31000). Mapee las causas (lado preventivo), el evento principal, y las consecuencias (lado mitigador)."}
                     {metodologiaCausa === 'Árbol de Fallas' && "Recomendado para fallas técnicas o de TI. Analice mediante compuertas lógicas (Y/O) las vulnerabilidades del sistema."}
                     {metodologiaCausa === 'Análisis Directo' && "Útil para desviaciones simples o administrativas donde la causa es evidente y no requiere herramientas avanzadas."}
                   </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-amber-900 block mb-1">Desarrollo del Análisis *</label>
                 <textarea 
  name="analisisCausa" 
  disabled={metodologiaCausaDeshabilitada}
  defaultValue={editHallazgo?.analisisCausa || autoFillData?.analisisCausa || ''} 
  required 
  rows="6" 
  placeholder={
    metodologiaCausa === '5 Porqués' ? "1. ¿Por qué ocurrió la falla?\n2. ¿Por qué se dio la condición anterior?\n3. ¿Por qué falló el control preventivo?\n4. ¿Por qué el proceso lo permitió?\n5. Causa Raíz Sistémica:" :
    metodologiaCausa === 'Ishikawa' ? "Mano de Obra:\nMétodos:\nMaquinaria:\nMateriales:\nMedición:\nMedio Ambiente:\n\n=> Conclusión de Causa Raíz:" :
    metodologiaCausa === 'Bow-Tie' ? "Amenazas/Causas (Fallas Preventivas):\n\nEvento Principal (El Hallazgo):\n\nConsecuencias (Fallas Mitigadoras):" :
    metodologiaCausa === 'Árbol de Fallas' ? "Condición Inicial:\nFalla 1 (Y/O):\nFalla 2 (Y/O):\n\n=> Evento Cúspide:" :
    "Describa detalladamente la causa raíz del hallazgo..."
  }
  className="w-full border border-amber-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-600 outline-none font-medium resize-y shadow-inner bg-white placeholder-slate-400 disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
/>
              </div>
            </div>
            
            <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner mt-2">
              <div className="border-b pb-2 border-slate-200 flex justify-between items-center mb-4">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Evidencia del Hallazgo</label>
                  <p className="text-[9px] text-slate-500 font-medium">Puedes seleccionar uno o varios soportes (PDF o Imagen). Se guardarán en el repositorio oficial.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

              <input type="hidden" name="evidenciaUrlInput" value={archivosSubidos[0]?.url || ''} />
              <input type="hidden" name="evidenciasInput" value={JSON.stringify(archivosSubidos)} />

              <div className={`bg-white border-2 border-dashed ${esSoloLectura ? 'border-slate-200' : 'border-rose-300 hover:border-rose-500 hover:bg-rose-50/50'} p-6 rounded-2xl text-center relative transition-all flex flex-col items-center justify-center min-h-[160px] shadow-sm`}>
                {isUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-rose-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : archivosSubidos.length > 0 ? (
                  <div className="space-y-3 w-full">
                    <div className="text-4xl text-rose-500">✅</div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {archivosSubidos.map((evidencia, indice) => (
                        <div key={`${evidencia.url}-${indice}`} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 border border-blue-100">
                          <a href={evidencia.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline">{evidencia.nombre || `Evidencia ${indice + 1}`}</a>
                          
                          {/* Oculta la "X" para borrar evidencia si es solo lectura */}
                          {!esSoloLectura && (
                            <button type="button" onClick={() => actualizarArchivosSubidos(prev => prev.filter((_, posicion) => posicion !== indice))} className="text-rose-500 font-black" title="Quitar evidencia">×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Oculta la opción de añadir más archivos si es solo lectura */}
                    {!esSoloLectura && (
                      <label className="block mt-3 cursor-pointer text-slate-400 hover:text-rose-600 text-[9px] font-bold uppercase tracking-wider transition-colors underline">
                        Agregar más evidencias <input type="file" multiple className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                      </label>
                    )}
                  </div>
                ) : (
                  esSoloLectura ? (
                    /* Vista de estado vacío en SOLO LECTURA */
                    <div className="flex flex-col items-center space-y-2 opacity-60">
                      <div className="text-4xl">📂</div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg">Sin evidencias adjuntas</p>
                    </div>
                  ) : (
                    /* Vista para SUBIR archivo cuando SÍ se puede editar */
                    <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                      <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors">Seleccionar Archivo PDF o Imagen</p>
                      <input type="file" multiple className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                    </label>
                  )
                )}
              </div>
            </div>
            
          <div className="md:col-span-4 flex flex-col md:flex-row justify-end items-center gap-3 pt-4">
              {esSoloLectura ? (
                <button 
                  type="button" 
                  onClick={() => {
                    setEsSoloLectura(false);
                    setVistaActiva('historial');
                  }}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-black uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-md transition-all cursor-pointer w-full md:w-auto"
                >
                  ↩️ Volver al Historial
                </button>
              ) : (
                <>
                  {/* ✨ NUEVO BOTÓN: Salir sin guardar */}
                  <button 
                    type="button" 
                    onClick={() => {
                      if (window.confirm("¿Estás seguro de que deseas salir sin guardar? Perderás todos los datos ingresados en el hallazgo.")) {
                        setEditHallazgo(null);
                        limpiarResponsablesNuevo();
                        setVistaActiva('dashboard');
                      }
                    }}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs shadow-sm transition-all w-full md:w-auto"
                  >
                    ❌ Salir sin guardar
                  </button>

                  <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest px-10 py-3.5 rounded-xl shadow-lg transition-all w-full md:w-auto hover:scale-105 cursor-pointer">
                    {editHallazgo ? '💾 Guardar Cambios' : '➕ REGISTRAR HALLAZGO'}
                  </button>
                </>
              )}
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
                  
                  {/* ✨ NUEVO: FILTRO DINÁMICO DE PROCESO */}
                  <select 
                    value={columnFilters['proceso'] || ''} 
                    onChange={(e) => {
                      handleColFilterChange('proceso', e.target.value);
                      handleColFilterChange('subproceso', ''); // Limpia al cambiar
                    }} 
                    className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 bg-slate-50 font-black text-slate-700 shadow-sm cursor-pointer"
                  >
                    <option value="">🏛️ Todos los Procesos</option>
                    {Object.keys(MAPA_PROCESOS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
{/* ✨ NUEVO: FILTRO DINÁMICO DE SUBPROCESO */}
                  <select 
                    value={columnFilters['subproceso'] || ''} 
                    onChange={(e) => handleColFilterChange('subproceso', e.target.value)} 
                    className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-2 bg-slate-50 font-black text-slate-700 shadow-sm cursor-pointer max-w-[140px] truncate"
                  >
                    <option value="">🗂️ Todos los Subprocesos</option>
                    {[...new Set(columnFilters['proceso'] ? (MAPA_PROCESOS[columnFilters['proceso']] || []) : Object.values(MAPA_PROCESOS).flat())].sort().map(sp => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>

                  <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm cursor-pointer">
                    <option value="">📅 Todos los Años</option>
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(a => <option key={a} value={String(a)}>{a}</option>)}
                  </select>

                  <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm cursor-pointer">
                    <option value="">📆 Todos los Meses</option>
                    <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                    <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                    <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                    <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
                  </select>

                  {/* ✨ FILTRO DESPLEGABLE POR TIPO DE FUENTE (Alineado con el diseño visual) */}
                  <select 
                    value={filtroTipoFuente} 
                    onChange={(e) => setFiltroTipoFuente(e.target.value)} 
                    className="border border-slate-300 rounded-lg text-[10px] py-1.5 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm cursor-pointer max-w-[160px] truncate"
                  >
                    <option value="">⊞ Todas las Fuentes</option>
                    {fuentesUnicasDisponibles.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>

                 <div className="relative w-full sm:w-auto">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Búsqueda General..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-[10px] focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-56 shadow-sm font-bold" 
                    />
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
                  const procesoInforme = informeBase ? (informeBase.proceso || informeBase.proceso) : "Varios Procesos";
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
                                <th className="p-3 w-40">
                                  <div className="mb-1">PROCESO / SEDE</div>
                                  <FilterInput colKey="proceso" placeholder="Filtrar Macro..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
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
                                    <div className="font-bold text-slate-700 truncate max-w-[150px]" title={h.proceso || h.proceso}>{h.proceso || h.proceso}</div>
                                    {h.subproceso && h.subproceso !== 'General' && <div className="text-[8px] text-slate-500 font-bold mt-0.5">↳ {h.subproceso}</div>}
                                    <div className="text-[9px] uppercase tracking-widest text-slate-400 font-black mt-1">{h.sede || 'Hotel'}</div>
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
  <div className="text-[10px] space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200/80 shadow-sm">
    {(() => {
      // Priorizar la referencia directa del acordeón actual (informeBase) y fallback seguro con coerción de tipos
      const infPadre = (informeBase && String(informeBase.id) === String(idInf)) 
        ? informeBase 
        : informesAuditoria.find(inf => String(inf.id) === String(h.idInforme) || String(inf.id) === String(idInf));

      // Mapeo exhaustivo de campos legacy y actuales del informe y del hallazgo
      const auditorCargo = infPadre?.auditorResponsable || infPadre?.auditor || infPadre?.auditorLider || h.auditorResponsable || h.auditor || 'N/A';
      const auditorEmail = infPadre?.correoAuditor || infPadre?.correoAuditorResponsable || infPadre?.correo_auditor || h.correoAuditor || h.correo_auditor || '';

      return (
        <div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-slate-400 uppercase text-[8px]">Auditor:</span>
            <span className="font-black text-slate-800 break-words">{auditorCargo}</span>
          </div>
          {auditorEmail ? (
            <a 
              href={`mailto:${auditorEmail}`}
              className="block text-[9px] text-blue-600 hover:underline font-mono font-semibold truncate mt-0.5" 
              title={auditorEmail}
            >
              ✉️ {auditorEmail}
            </a>
          ) : (
            <span className="block text-[8px] text-slate-400 italic mt-0.5">Sin correo registrado</span>
          )}
        </div>
      );
    })()}

    <div className="pt-1 border-t border-slate-200/60 flex items-center gap-1">
      <span className="font-bold text-slate-400 uppercase text-[8px]">Dueño:</span>
      <span className="font-bold text-slate-700 break-words">{h.responsable || 'Sin Asignar'}</span>
    </div>
  </div>
</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest inline-block mb-2 ${h.estado === 'Cerrado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                      {h.estado}
                                    </span>
                                    <div className="flex justify-center items-center space-x-2 text-[10px] border-t border-slate-100 pt-1.5 mt-1">
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setEditHallazgo(h);
                                          setEsSoloLectura(true);
                                          setVistaActiva('nuevo');
                                          if (typeof setFormResetKey === 'function') setFormResetKey(Date.now());
                                          scrollToForm();
                                        }} 
                                        className="text-slate-600 hover:text-slate-900 hover:underline font-bold"
                                        title="Ver detalles sin modificar"
                                      >
                                        👁️ Ver
                                      </button>
                                      <span className="text-slate-200">|</span>
                                      {isAdmin && (
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setEditHallazgo(h);
                                            setEsSoloLectura(false);
                                            setVistaActiva('nuevo');
                                            if (typeof setFormResetKey === 'function') setFormResetKey(Date.now());
                                            scrollToForm();
                                          }} 
                                          className="text-blue-600 hover:underline font-bold"
                                        >
                                          ✏️ Editar
                                        </button>
                                      )}
                                      <span className="text-slate-300">|</span>
{(() => {
                                        const riesgoExistente = safeRiesgos?.find(r => String(r.idHallazgoOrigen) === String(h.id));
                                        if (riesgoExistente) {
                                          return (
                                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm" title={`Riesgo promovido: RSK-${riesgoExistente.id}`}>
                                              ✅ Vinculado a {riesgoExistente.ref || `RSK-${riesgoExistente.id}`}
                                            </span>
                                          );
                                        }
                                        return (
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              if (typeof window !== 'undefined') {
                                                sessionStorage.setItem('promover_riesgo_temp', JSON.stringify({
                                                  idHallazgo: h.id,
                                                  refHallazgo: h.ref,
                                                  proceso: h.proceso,
                                                  subproceso: h.subproceso,
                                                  causaInmediata: h.titulo,
                                                  sede: h.sede,
                                                  responsable: h.responsable
                                                }));
                                                alert(`🚀 Hallazgo [${h.ref}] preparado.\n\nDirígete al módulo "Matriz de Riesgos" y presiona "➕ Nuevo Riesgo" para cargar automáticamente sus datos.`);
                                              }
                                            }} 
                                            className="text-purple-600 hover:underline font-bold"
                                            title="Copiar datos a la Matriz de Riesgos Corporativa"
                                          >
                                            🚀 Promover
                                          </button>
                                        );
                                      })()}                                     
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