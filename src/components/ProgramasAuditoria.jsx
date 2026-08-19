// ☁️ IMPORTAR HOOK Y SERVICIO DE API
import { useDataFetching } from '../hooks/useDataFetching';
import { apiService } from '../services/apiService';

export default function ProgramasAuditoria({ 
  programas = [], 
  setProgramas, 
  saveToCloud, 
  isAdmin, 
  user, 
  handleDeleteItem 
}) {
  const [vistaActiva, setVistaActiva] = useState('kanban'); // 'kanban' o 'formulario'
  const [step, setStep] = useState(1);
  const [editPrograma, setEditPrograma] = useState(null);

  // Extraemos la lista de Macroprocesos del diccionario
  const listadoMacros = Object.keys(MAPA_PROCESOS);

  // 📝 Estados del Formulario (Paso 1: Contexto)
  const [entidad, setEntidad] = useState('RECREFAM S.A.S. (Termales Santa Rosa de Cabal)');
  const [vigencia, setVigencia] = useState('');
  
  // Cambiamos Proceso y Subproceso para inicializar con los valores del mapa
  const [proceso, setProceso] = useState(listadoMacros[0] || '');
  const [subproceso, setSubproceso] = useState(listadoMacros[0] ? MAPA_PROCESOS[listadoMacros[0]][0] : '');
  
  const [elaboradoPor, setElaboradoPor] = useState('');
  const [revisadoPor, setRevisadoPor] = useState('');
  const [aprobadoPor, setAprobadoPor] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [objetivosEspecificos, setObjetivosEspecificos] = useState('');
  const [alcance, setAlcance] = useState('');
  const [cronogramaTexto, setCronogramaTexto] = useState('');
  
  // Estado para el adjunto del programa
  const [archivoAdjuntoUrl, setArchivoAdjuntoUrl] = useState('');

  // 🛡️ Matriz de 3 Líneas de Defensa (Paso 2)
  const [matrizPruebas, setMatrizPruebas] = useState([]);
  
  // 🏁 Estado y Cierre (Paso 3)
  const [estadoPrograma, setEstadoPrograma] = useState('Borrador');

  const safeProgramas = Array.isArray(programas) ? programas : [];

  // Lógica de subprocesos dinámicos
  const subprocesosDisponibles = MAPA_PROCESOS[proceso] || [];
  const tieneSubprocesosReales = subprocesosDisponibles.length > 1 || (subprocesosDisponibles.length === 1 && subprocesosDisponibles[0] !== "General");

  const handleProcesoChange = (e) => {
    const nuevoProceso = e.target.value;
    setProceso(nuevoProceso);
    if (MAPA_PROCESOS[nuevoProceso] && MAPA_PROCESOS[nuevoProceso].length > 0) {
      setSubproceso(MAPA_PROCESOS[nuevoProceso][0]);
    } else {
      setSubproceso('');
    }
  };
// --- 🔍 NUEVOS ESTADOS Y LÓGICA DE FILTRADO ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroProceso, setFiltroProceso] = useState('');
  const [filtroSubproceso, setFiltroSubproceso] = useState('');

  const subprocesosFiltro = filtroProceso ? (MAPA_PROCESOS[filtroProceso] || []) : [];

  const programasFiltrados = safeProgramas.filter(p => {
    const matchBusqueda = (p.proceso?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (p.objetivo?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchProceso = filtroProceso ? p.proceso === filtroProceso : true;
    const matchSubproceso = filtroSubproceso ? p.subproceso === filtroSubproceso : true;
    return matchBusqueda && matchProceso && matchSubproceso;
  });

  // Agrupar para Kanban (ahora responden a los filtros en tiempo real)
  const programasBorrador = programasFiltrados.filter(p => p.estado === 'Borrador');
  const programasRevision = programasFiltrados.filter(p => p.estado === 'En Revisión');
  const programasAprobados = programasFiltrados.filter(p => p.estado === 'Aprobado');

  const handleNuevoPrograma = () => {
    setEditPrograma(null);
    setEntidad('RECREFAM S.A.S. (Termales Santa Rosa de Cabal)');
    setVigencia('');
    setProceso(listadoMacros[0] || '');
    setSubproceso(listadoMacros[0] ? MAPA_PROCESOS[listadoMacros[0]][0] : '');
    setElaboradoPor(user?.email || '');
    setRevisadoPor('');
    setAprobadoPor('');
    setObjetivo('');
    setObjetivosEspecificos('');
    setAlcance('');
    setCronogramaTexto('');
    setArchivoAdjuntoUrl('');
    setMatrizPruebas([{ id: Date.now(), riesgo: '', linea1: '', linea2: '', linea3: '' }]);
    setEstadoPrograma('Borrador');
    setStep(1);
    setVistaActiva('formulario');
  };

  const handleEditarPrograma = (prog) => {
    setEditPrograma(prog);
    setEntidad(prog.entidad || '');
    setVigencia(prog.vigencia || '');
    setProceso(prog.proceso || listadoMacros[0] || '');
    setSubproceso(prog.subproceso || '');
    setElaboradoPor(prog.elaboradoPor || '');
    setRevisadoPor(prog.revisadoPor || '');
    setAprobadoPor(prog.aprobadoPor || '');
    setObjetivo(prog.objetivo || '');
    setObjetivosEspecificos(prog.objetivosEspecificos || '');
    setAlcance(prog.alcance || '');
    setCronogramaTexto(prog.cronogramaTexto || '');
    setArchivoAdjuntoUrl(prog.archivoAdjuntoUrl || '');
    setMatrizPruebas(prog.matrizPruebas || []);
    setEstadoPrograma(prog.estado || 'Borrador');
    setStep(1);
    setVistaActiva('formulario');
  };

  // ☁️ HOOK PARA LA BÓVEDA DE TERMALES
  const { isLoading: isUploading, error: uploadError, ejecutarPeticion: ejecutarSubidaPrograma } = useDataFetching();

  // 🧹 Utilidad para limpiar nombres de archivos
  const sanitizarNombreArchivo = (nombreOriginal) => {
    return nombreOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9.\-_]/g, "")
      .toLowerCase();
  };

  // ☁️ Manejador de subida directa a la API oficial
  const handleFileUpload = async (e) => {
    const originalFile = e.target.files[0];
    if (!originalFile) return;

    const nombreLimpio = sanitizarNombreArchivo(originalFile.name);
    const file = new File([originalFile], nombreLimpio, {
      type: originalFile.type,
      lastModified: originalFile.lastModified,
    });

    try {
      const payloadMeta = {
        appName: 'controlInterno',
        description: 'Soporte del Programa de Auditoría',
        fieldName: 'file'
      };

      const data = await ejecutarSubidaPrograma(
        apiService.subirEvidencia(file, payloadMeta)
      );
      
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;
      setArchivoAdjuntoUrl(urlFinal);
      alert("✅ Programa adjuntado correctamente.");
    } catch (err) {
      alert(`⚠️ No se pudo subir el archivo:\n${err.message}`);
    }
  };

  const agregarFilaMatriz = () => {
    setMatrizPruebas([...matrizPruebas, { id: Date.now(), riesgo: '', linea1: '', linea2: '', linea3: '' }]);
  };

  const actualizarFilaMatriz = (id, campo, valor) => {
    setMatrizPruebas(matrizPruebas.map(fila => fila.id === id ? { ...fila, [campo]: valor } : fila));
  };

  const eliminarFilaMatriz = (id) => {
    setMatrizPruebas(matrizPruebas.filter(fila => fila.id !== id));
  };

  const handleGuardarPrograma = async () => {
    const ts = new Date().toLocaleString();
    
    // Validación básica
    if(!proceso || !objetivo) {
      alert("⚠️ Faltan campos obligatorios en el Paso 1 (Proceso y Objetivo General).");
      setStep(1);
      return;
    }

    let updatedList;
    if (editPrograma) {
      const mod = {
        ...editPrograma,
        entidad, vigencia, proceso, subproceso, elaboradoPor, revisadoPor, aprobadoPor,
        objetivo, objetivosEspecificos, alcance, cronogramaTexto, archivoAdjuntoUrl, 
        matrizPruebas, estado: estadoPrograma,
        historialCambios: [...(editPrograma.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: `Actualizado a estado: ${estadoPrograma}` }]
      };
      updatedList = safeProgramas.map(p => p.id === editPrograma.id ? mod : p);
    } else {
      const nuevo = {
        id: Date.now(),
        entidad, vigencia, proceso, subproceso, elaboradoPor, revisadoPor, aprobadoPor,
        objetivo, objetivosEspecificos, alcance, cronogramaTexto, archivoAdjuntoUrl, 
        matrizPruebas, estado: estadoPrograma,
        creadoPor: user?.email || 'Sistema',
        fechaCreacion: new Date().toISOString().split('T')[0],
        historialCambios: [{ fecha: ts, usuario: user?.email || 'Usuario', accion: 'Programa Creado' }]
      };
      updatedList = [...safeProgramas, nuevo];
    }

    setProgramas(updatedList);
    await saveToCloud({ programas: updatedList });
    alert(`✅ Programa guardado con éxito en estado: ${estadoPrograma}`);
    setVistaActiva('kanban');
  };

// --- 📥 FUNCIÓN EXPORTAR EXCEL (CSV) ---
  const handleExportarExcel = () => {
    if (programasFiltrados.length === 0) {
      alert("No hay programas para exportar con los filtros actuales.");
      return;
    }

    // Definir cabeceras y mapear los datos filtrados
    const cabeceras = ['Proceso', 'Subproceso', 'Responsable', 'Vigencia', 'Estado', 'Ultima Actualizacion', 'Objetivo'];
    const filas = programasFiltrados.map(p => [
      `"${p.proceso || 'General'}"`,
      `"${p.subproceso || '-'}"`,
      `"${p.elaboradoPor || 'Auditor'}"`,
      `"${p.vigencia || ''}"`,
      `"${p.estado || 'Borrador'}"`,
      `"${p.fechaCreacion || ''}"`,
      `"${(p.objetivo || '').replace(/"/g, '""')}"` // Escapar comillas en el texto
    ]);

    const contenidoCSV = [cabeceras.join(','), ...filas.map(f => f.join(','))].join('\n');
    
    // El Uint8Array(BOM) asegura que Excel lea bien los acentos en español
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Programas_Auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const TarjetaKanban = ({ p }) => (
<div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => handleEditarPrograma(p)}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2">
          <span className="text-blue-500 bg-blue-50 p-1.5 rounded-lg text-sm">📄</span>
          <h4 className="font-bold text-slate-800 text-[13px]">{p.proceso ? `Auditoría a ${p.proceso}` : 'Programa de Auditoría'}</h4>
        </div>
        <button className="text-slate-400 hover:text-slate-600 text-lg leading-none">⋯</button>
      </div>
      <p className="text-[10px] text-slate-500 mb-4 pl-9">{p.subproceso || 'Gestión General'} • {p.vigencia || '2025'}</p>
      
      <div className="flex justify-between items-end pt-2 mt-2 border-t border-slate-50">
        <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
          {p.elaboradoPor ? p.elaboradoPor.substring(0,2).toUpperCase() : 'AL'}
        </div>
        <div className="text-[9px] text-slate-400 flex flex-col items-end">
          {p.estado === 'Aprobado' && <span className="text-emerald-500 font-bold mb-1 flex items-center gap-1"><span className="border border-emerald-500 rounded-full w-3 h-3 flex items-center justify-center">✔</span> Aprobado: {p.fechaCreacion || '05/05/2025'}</span>}
          <span>Actualizado: {p.fechaCreacion || '12/05/2025'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* CABECERA ACTUALIZADA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <span className="bg-slate-800 text-white p-2 rounded-xl text-lg shadow-md">📄</span> 
            Programas de Auditoría
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-1 ml-14">Gobernanza y planeación bajo el enfoque de 3 Líneas (ISO 31000)</p>
        </div>
        <div>
          {vistaActiva === 'formulario' ? (
            <button onClick={() => setVistaActiva('kanban')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-sm">
              🔙 Volver al Tablero
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleExportarExcel}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 flex items-center transition-colors shadow-sm"
              >
                <span className="mr-2">📥</span> Exportar
              </button>
              {isAdmin && (
                <button onClick={handleNuevoPrograma} className="px-5 py-2.5 bg-[#0A3B32] hover:bg-[#062620] text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center shadow-md transition-colors">
                  <span className="mr-2">➕</span> Nuevo Programa
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* VISTA 1: DASHBOARD COMPLETO (KPIs, Kanban y Tabla) */}
      {vistaActiva === 'kanban' && (
        <div className="space-y-6">
          
          {/* 1. TARJETAS DE MÉTRICAS SUPERIORES (KPIs) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl mr-4">📄</div>
              <div>
                <p className="text-[10px] font-black text-slate-500">Total Programas</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-slate-800">{safeProgramas.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 mb-1">En todos los estados</span>
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center shadow-sm">
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center text-xl mr-4">✏️</div>
              <div>
                <p className="text-[10px] font-black text-slate-500">En Diseño / Borrador</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-slate-800">{programasBorrador.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 mb-1">{safeProgramas.length > 0 ? Math.round((programasBorrador.length / safeProgramas.length) * 100) : 0}% del total</span>
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center shadow-sm">
              <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center text-xl mr-4">👁️</div>
              <div>
                <p className="text-[10px] font-black text-slate-500">En Revisión</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-slate-800">{programasRevision.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 mb-1">{safeProgramas.length > 0 ? Math.round((programasRevision.length / safeProgramas.length) * 100) : 0}% del total</span>
                </div>
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center shadow-sm">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center text-xl mr-4">✅</div>
              <div>
                <p className="text-[10px] font-black text-slate-500">Aprobados</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-slate-800">{programasAprobados.length}</span>
                  <span className="text-[9px] font-bold text-slate-400 mb-1">{safeProgramas.length > 0 ? Math.round((programasAprobados.length / safeProgramas.length) * 100) : 0}% del total</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. TABLERO KANBAN ESTILO TARJETAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200 flex flex-col min-h-[300px]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="text-slate-400">⋮⋮</span> EN DISEÑO / BORRADOR</span>
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center">{programasBorrador.length}</span>
              </h3>
              <div className="space-y-3 flex-1">
                {programasBorrador.map(p => <TarjetaKanban key={p.id} p={p} />)}
                {programasBorrador.length === 0 && <div className="text-center text-slate-400 text-xs py-8 italic font-bold">Sin programas</div>}
              </div>
              {programasBorrador.length > 0 && <button className="text-blue-600 text-xs font-bold w-full text-center mt-3 hover:underline">Ver todos ({programasBorrador.length})</button>}
            </div>

            <div className="bg-orange-50/30 rounded-2xl p-4 border border-orange-100 flex flex-col min-h-[300px]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="text-slate-400">⋮⋮</span> EN REVISIÓN (GERENCIA)</span>
                <span className="bg-orange-100 text-orange-700 w-5 h-5 rounded-full flex items-center justify-center">{programasRevision.length}</span>
              </h3>
              <div className="space-y-3 flex-1">
                {programasRevision.map(p => <TarjetaKanban key={p.id} p={p} />)}
                {programasRevision.length === 0 && <div className="text-center text-orange-300 text-xs py-8 italic font-bold">Sin programas</div>}
              </div>
              {programasRevision.length > 0 && <button className="text-orange-600 text-xs font-bold w-full text-center mt-3 hover:underline">Ver todos ({programasRevision.length})</button>}
            </div>

            <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-100 flex flex-col min-h-[300px]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="text-slate-400">⋮⋮</span> APROBADOS (LISTOS)</span>
                <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center">{programasAprobados.length}</span>
              </h3>
              <div className="space-y-3 flex-1">
                {programasAprobados.map(p => <TarjetaKanban key={p.id} p={p} />)}
                {programasAprobados.length === 0 && <div className="text-center text-emerald-300 text-xs py-8 italic font-bold">Sin programas</div>}
              </div>
              {programasAprobados.length > 0 && <button className="text-emerald-600 text-xs font-bold w-full text-center mt-3 hover:underline">Ver todos ({programasAprobados.length})</button>}
            </div>
          </div>

  {/* 3. TABLA INFERIOR DE PROGRAMAS Y FILTROS */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            
            {/* BARRA DE BÚSQUEDA Y FILTROS DINÁMICOS */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-4">
              <h3 className="font-extrabold text-slate-800 text-sm w-full md:w-auto">Todos los Programas</h3>
              
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                {/* Selector Proceso */}
                <select 
                  value={filtroProceso} 
                  onChange={(e) => { setFiltroProceso(e.target.value); setFiltroSubproceso(''); }}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-white cursor-pointer text-slate-600 font-medium"
                >
                  <option value="">Todos los Procesos</option>
                  {listadoMacros.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                {/* Selector Subproceso (dependiente) */}
                <select 
                  value={filtroSubproceso} 
                  onChange={(e) => setFiltroSubproceso(e.target.value)}
                  disabled={!filtroProceso}
                  className={`px-3 py-2 border rounded-xl text-xs outline-none transition-colors font-medium ${!filtroProceso ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-600 cursor-pointer focus:border-blue-500'}`}
                >
                  <option value="">Todos los Subprocesos</option>
                  {subprocesosFiltro.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* Buscador de Texto */}
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400">🔍</span>
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar programa..." 
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 w-full md:w-48 lg:w-64 font-medium" 
                  />
                </div>
              </div>
            </div>

            {/* TABLA DE RESULTADOS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="p-4">Programa</th>
                    <th className="p-4">Proceso / Subproceso</th>
                    <th className="p-4">Responsable</th>
                    <th className="p-4">Vigencia</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Última actualización</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {programasFiltrados.length === 0 ? (
                    <tr><td colSpan="7" className="text-center p-8 italic text-slate-500 font-bold bg-white">No hay programas que coincidan con la búsqueda.</td></tr>
                  ) : (
                    programasFiltrados.map(p => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                          <span className="text-blue-500 text-lg bg-blue-50 p-1.5 rounded-lg">📄</span>
                          {p.proceso ? `Auditoría al Proceso de ${p.proceso}` : 'Programa sin título'}
                        </td>
                        <td className="p-4 text-slate-500">{p.proceso || '-'} <br/> <span className="text-[9px] font-bold text-slate-400">{p.subproceso}</span></td>
                        <td className="p-4 font-medium">{p.elaboradoPor?.split('@')[0] || 'Auditor Líder'}</td>
                        <td className="p-4">{p.vigencia || '2025'}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider border ${
                            p.estado === 'Aprobado' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            p.estado === 'En Revisión' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                            'bg-blue-50 text-blue-600 border-blue-200'
                          }`}>
                            {p.estado || 'Borrador'}
                          </span>
                        </td>
                        <td className="p-4 font-medium">{p.fechaCreacion || '12/05/2025'}</td>
                        <td className="p-4 flex items-center justify-center gap-2">
                          <button className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors shadow-sm">👁️</button>
                          <button onClick={() => handleEditarPrograma(p)} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center transition-colors shadow-sm">✏️</button>
                          {isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteItem('programas', p.id); }} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shadow-sm">⋯</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 flex justify-between items-center text-xs text-slate-500 bg-white">
              <span className="font-medium">Mostrando {programasFiltrados.length} programas filtrados (Total: {safeProgramas.length})</span>
              <div className="flex gap-1">
                <button className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center">&lt;</button>
                <button className="w-7 h-7 rounded-lg bg-[#0A3B32] text-white font-bold flex items-center justify-center shadow-md">1</button>
                <button className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* VISTA 2: ASISTENTE DE CREACIÓN (STEPPER) */}
      {vistaActiva === 'formulario' && (
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden max-w-5xl mx-auto mb-10">
          
          {/* Cabecera Stepper */}
          <div className="bg-slate-900 text-white p-6 flex items-center justify-center space-x-8 text-xs font-black uppercase tracking-widest">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-emerald-400 bg-emerald-400/20' : 'border-slate-500'}`}>1</span>
              <span>Contexto</span>
            </div>
            <div className="w-12 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 2 ? 'border-emerald-400 bg-emerald-400/20' : 'border-slate-500'}`}>2</span>
              <span>Matriz 3 Líneas</span>
            </div>
            <div className="w-12 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${step >= 3 ? 'border-emerald-400 bg-emerald-400/20' : 'border-slate-500'}`}>3</span>
              <span>Cierre</span>
            </div>
          </div>

          {/* 🛡️ Contenedor Principal. NOTA: NO usamos <form> para evitar submits accidentales al dar Enter */}
          <div className="p-8">
            
            {/* PASO 1: CONTEXTO GENERAL */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-8">
                <h3 className="text-sm font-black text-[#0A3B32] border-b pb-2">1. OBJETIVOS Y ALCANCE</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-bold text-slate-600">
                  
                  {/* Fila 1 */}
                  <div>
                    <label className="block mb-1.5">Entidad / Empresa</label>
                    <input type="text" value={entidad} onChange={e => setEntidad(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-[#0A3B32]" />
                  </div>
                  <div>
                    <label className="block mb-1.5">Vigencia (Ej. Segundo Semestre 2026)</label>
                    <input type="text" value={vigencia} onChange={e => setVigencia(e.target.value)} placeholder="Periodo de auditoría..." className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32]" />
                  </div>
                  
                  {/* Fila 2: Listas Desplegables de Procesos */}
                  <div>
                    <label className="block mb-1.5">Proceso a Auditar <span className="text-red-500">*</span></label>
                    <select 
                      value={proceso} 
                      onChange={handleProcesoChange} 
                      className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32] bg-white cursor-pointer"
                    >
                      <option value="" disabled>Seleccione un proceso...</option>
                      {listadoMacros.map(macro => (
                        <option key={macro} value={macro}>{macro}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1.5">Subproceso Específico</label>
                    <select 
                      value={subproceso} 
                      onChange={(e) => setSubproceso(e.target.value)} 
                      disabled={!tieneSubprocesosReales || !proceso}
                      className={`w-full p-2.5 border rounded-xl outline-none transition-colors ${
                        (!tieneSubprocesosReales || !proceso)
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                          : 'bg-white border-slate-300 focus:ring-2 focus:ring-[#0A3B32] cursor-pointer'      
                      }`}
                    >
                      {!proceso && <option value="">Esperando selección...</option>}
                      {proceso && subprocesosDisponibles.map(sub => (
                        <option key={sub} value={sub}>
                          {!tieneSubprocesosReales && sub === "General" ? "No aplica subdivisión" : sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fila 3: Firmas */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block mb-1.5 text-blue-700">✍️ Elaborado por</label>
                      <input type="text" value={elaboradoPor} onChange={e => setElaboradoPor(e.target.value)} placeholder="Nombre del auditor..." className="w-full p-2.5 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-amber-700">🔍 Revisado por</label>
                      <input type="text" value={revisadoPor} onChange={e => setRevisadoPor(e.target.value)} placeholder="Nombre del líder..." className="w-full p-2.5 border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white" />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-emerald-700">🔒 Aprobado por</label>
                      <input type="text" value={aprobadoPor} onChange={e => setAprobadoPor(e.target.value)} placeholder="Nombre del gerente..." className="w-full p-2.5 border border-emerald-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                    </div>
                  </div>

                  {/* Fila 4 */}
                  <div className="md:col-span-2">
                    <label className="block mb-1.5">Objetivo General <span className="text-red-500">*</span></label>
                    <textarea rows="2" value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Propósito principal del programa..." className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32] resize-none"></textarea>
                  </div>

                  {/* Fila 5 */}
                  <div className="md:col-span-2">
                    <label className="block mb-1.5">Objetivos Específicos</label>
                    <textarea rows="3" value={objetivosEspecificos} onChange={e => setObjetivosEspecificos(e.target.value)} placeholder="Listar los objetivos puntuales..." className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32] resize-none"></textarea>
                  </div>

                  {/* Fila 6 */}
                  <div>
                    <label className="block mb-1.5">Alcance</label>
                    <textarea rows="3" value={alcance} onChange={e => setAlcance(e.target.value)} placeholder="Periodos, áreas y sistemas involucrados..." className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32] resize-none"></textarea>
                  </div>
                  <div>
                    <label className="block mb-1.5">Cronograma Resumido</label>
                    <textarea rows="3" value={cronogramaTexto} onChange={e => setCronogramaTexto(e.target.value)} placeholder="Ej: Fase I: Julio, Fase II: Agosto..." className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32] resize-none"></textarea>
                  </div>

                </div>
              </div>
            )}

            {/* PASO 2: MATRIZ DE 3 LÍNEAS */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-8">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-black text-[#0A3B32]">2. MATRIZ DE AUDITORÍA (ENFOQUE TRES LÍNEAS)</h3>
                  <button type="button" onClick={agregarFilaMatriz} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors shadow-sm border border-blue-200">➕ Agregar Área de Riesgo</button>
                </div>
                
                <div className="space-y-4">
                  {matrizPruebas.map((fila) => (
                    <div key={fila.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl relative shadow-sm">
                      <button type="button" onClick={() => eliminarFilaMatriz(fila.id)} className="absolute -top-3 -right-2 bg-red-100 text-red-600 w-6 h-6 rounded-full flex items-center justify-center font-black hover:bg-red-200 shadow-md">✕</button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium text-slate-700">
                        <div>
                          <label className="font-bold mb-1 block">⚠️ Riesgo Inherente</label>
                          <textarea rows="4" value={fila.riesgo} onChange={e => actualizarFilaMatriz(fila.id, 'riesgo', e.target.value)} placeholder="Ej: Fraude por cuadres pendientes..." className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 resize-none text-xs bg-white shadow-inner"></textarea>
                        </div>
                        <div>
                          <label className="font-bold mb-1 block text-blue-700">🛡️ Controles 1ª Línea</label>
                          <textarea rows="4" value={fila.linea1} onChange={e => actualizarFilaMatriz(fila.id, 'linea1', e.target.value)} placeholder="Operación directa..." className="w-full p-2 border border-blue-200 bg-blue-50/50 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 resize-none text-xs"></textarea>
                        </div>
                        <div>
                          <label className="font-bold mb-1 block text-emerald-700">👁️ Controles 2ª Línea</label>
                          <textarea rows="4" value={fila.linea2} onChange={e => actualizarFilaMatriz(fila.id, 'linea2', e.target.value)} placeholder="Supervisión o Jefatura..." className="w-full p-2 border border-emerald-200 bg-emerald-50/50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 resize-none text-xs"></textarea>
                        </div>
                        <div>
                          <label className="font-bold mb-1 block text-purple-700">🎯 Pruebas (3ª Línea)</label>
                          <textarea rows="4" value={fila.linea3} onChange={e => actualizarFilaMatriz(fila.id, 'linea3', e.target.value)} placeholder="Procedimientos de auditoría interna..." className="w-full p-2 border border-purple-200 bg-purple-50/50 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 resize-none text-xs"></textarea>
                        </div>
                      </div>
                    </div>
                  ))}
                  {matrizPruebas.length === 0 && <p className="text-center text-xs text-slate-400 italic font-bold py-6">Haz clic en "Agregar Área de Riesgo" para empezar a diseñar la matriz.</p>}
                </div>
              </div>
            )}

            {/* PASO 3: GESTIÓN DE ESTADO, ADJUNTOS Y CIERRE */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-8">
                <h3 className="text-sm font-black text-[#0A3B32] border-b pb-2">3. ESTADO DE APROBACIÓN Y CIERRE</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Zona de Estado */}
                   <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center flex flex-col justify-center h-full">
                     <p className="text-xs text-emerald-800 font-medium mb-4">El programa contiene <strong className="font-black">{matrizPruebas.length}</strong> áreas de riesgo configuradas. Define el estado actual del programa para continuar.</p>
                     
                     <div className="inline-flex flex-col text-left w-full max-w-[250px] mx-auto">
                       <label className="font-black text-[10px] uppercase text-emerald-900 tracking-widest mb-1.5">Estado del Programa:</label>
                       <select value={estadoPrograma} onChange={e => setEstadoPrograma(e.target.value)} className="p-3 border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm cursor-pointer bg-white">
                         <option value="Borrador">📝 Borrador (Sigo diseñándolo)</option>
                         <option value="En Revisión">⏳ En Revisión (Enviado a Comité)</option>
                         <option value="Aprobado">✅ Aprobado (Listo para Auditoría en campo)</option>
                       </select>
                     </div>

                     {estadoPrograma === 'Aprobado' && (
                       <div className="mt-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest animate-pulse">
                         ¡Al guardar, este programa liberará la emisión de Informes de Auditoría!
                       </div>
                     )}
                   </div>

                   {/* Zona de Adjunto (Bóveda Documental) */}
                   <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col justify-center items-center text-center relative hover:border-slate-300 transition-colors">
                     <div className="absolute top-3 left-4 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                       Bóveda Documental
                     </div>
                     
                     {isUploading ? (
                        <div className="space-y-3 w-full mt-4">
                          <div className="text-3xl animate-bounce">🚀</div>
                          <div className="w-full bg-slate-200 rounded-full h-2 max-w-[80%] mx-auto overflow-hidden">
                            <div className="bg-blue-500 h-2 rounded-full w-full animate-pulse"></div>
                          </div>
                          <p className="text-[9px] font-bold text-blue-600 animate-pulse uppercase tracking-wider">Anexando Documento...</p>
                        </div>
                     ) : archivoAdjuntoUrl ? (
                        <div className="space-y-3 mt-4 w-full">
                           <div className="text-4xl">📎</div>
                           <p className="text-[10px] font-bold text-slate-600 px-4 line-clamp-2">Documento Anexado Correctamente</p>
                           <a href={archivoAdjuntoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-bold hover:underline">Ver Documento</a>
                           <label className="block mt-2 cursor-pointer text-slate-400 hover:text-slate-600 text-[9px] font-bold uppercase tracking-wider underline">
                             Reemplazar Archivo 
                             <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
                           </label>
                        </div>
                     ) : (
                        <label className="cursor-pointer flex flex-col items-center space-y-3 group w-full mt-4">
                          <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform text-blue-500">📁</div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Adjuntar PDF del Programa (Opcional)</p>
                          <span className="bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-[10px] font-bold shadow-sm group-hover:bg-blue-100 transition-colors">Seleccionar Archivo</span>
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileUpload} />
                        </label>
                     )}
                   </div>
                </div>
              </div>
            )}

            {/* BOTONERA INFERIOR (Blindada contra submits accidentales) */}
            <div className="mt-10 flex justify-between pt-4 border-t border-slate-100">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="px-6 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition-colors">
                  Anterior
                </button>
              ) : <div></div>}
              
              {step < 3 ? (
                <button 
                  type="button" 
                  onClick={() => setStep(step + 1)} 
                  className="px-8 py-2.5 bg-[#0A3B32] text-white font-black uppercase tracking-widest rounded-xl text-xs hover:bg-[#062620] shadow-md transition-all hover:scale-105"
                >
                  Siguiente
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={handleGuardarPrograma} 
                  className="px-8 py-2.5 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl text-xs hover:bg-emerald-700 shadow-md transition-all hover:scale-105 flex items-center"
                >
                  <span className="mr-2">💾</span> Guardar Programa
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}