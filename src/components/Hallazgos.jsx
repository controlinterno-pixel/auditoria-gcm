import React, { useState } from 'react';

// 📚 LISTAS MAESTRAS EXTRAÍDAS DE LOS MANUALES OFICIALES DE TERMALES
const AUDITORES_OFICIALES = [
  "Rodolfo González González",
  "Yehison Javier Pineda Martinez",
  "Angelica Fernanda Hernandez",
  "Luz Angela Chico Tique"
];

const PROCESOS_OFICIALES = [
  "Alimentos y Bebidas (AYB)", "Canales Alternos", "Compensaciones", "Compras", "Control Inventarios",
  "Cumplimiento Normativo", "Financiera", "Formación y Desarrollo", "Gestión Ambiental",
  "Gestión Clientes", "Gestión Contable", "Gestión de Crédito y Cartera", "Gestión de tecnologías de la información",
  "Gestión de Tesoreria", "Mantenimiento de Infraestructura", "Mercadeo", "Operaciones Alojamiento y recreación.",
  "Proyectos", "Seguridad y Salud en el Trabajo", "Selección y Vinculación"
];

// Organigrama unificado de Hotel, Balneario y Estructura Administrativa
const CARGOS_OFICIALES = [
  "Agente contact Center", "Almacenista", "Ama de Llaves", "Analista Ambiental", "Analista de auditoría", 
  "Analista de Cartera", "Analista de Compras", "Analista de Contabilidad", "Analista de costos e inventarios", 
  "Analista de Mejora continua", "Analista de nómina", "Analista de Sistemas", "Analista de Talento Humano", 
  "Analista de Tesorería", "Asistente de Gerencia", "Auditor Nocturno", "Auditoría Interna", "Auxiliar Administrativa y Contable de Socios", 
  "Auxiliar Administrativa y Labor social", "Auxiliar Administrativo y Logístico", "Auxiliar Comercial SRC", "Auxiliar Comercial Taquilla", 
  "Auxiliar de Almacén", "Auxiliar de barra", "Auxiliar de Cocina", "Auxiliar de despensa", "Auxiliar de enfermería", 
  "Auxiliar de Inventarios", "Auxiliar de lavandería", "Auxiliar de parqueadero - Botones", "Auxiliar de Portería", 
  "Auxiliar de Servicio al Cliente", "Auxiliar de Servicios Generales", "Auxiliar Gestión Documental", "Auxiliar mantenimiento", 
  "Auxiliar mantenimiento carretera", "Auxiliar Porcionador", "Auxiliar PTAP", "Auxiliar PTAR", "Auxiliar supernumerario", 
  "Auxiliares de Tics", "Barista", "Cajero", "Cajero Ay B", "Cajero recreación balneario", "Camareras", "Chef Hotel", 
  "Contador", "Contadora de Socios", "Coordinación Administrativa Family Office", "Coordinación Comercial y Contact Center", 
  "Coordinación de Mercadeo y Comunicaciones", "Coordinación de recepción", "Coordinación Seguridad Y Salud en el trabajo", 
  "Coordinación SPA", "Coordinador de Mantenimiento", "Coordinador de Marketing digital", "Coordinador de Servicio al Cliente", 
  "Coordinador Operaciones", "Creativo Gráfico", "Desarrollador Junior", "Dirección Administrativa y Financiera", "Dirección Comercial", 
  "Dirección de Mercadeo y Comunicaciones", "Dirección Talento Humano", "Director de TICS", "Ejecutivo Comercial", 
  "Gerente Administrativa y Judicial", "Guía Turístico y de experiencia natural", "Jardinero", "Jefe de Cocina", "Líder Administrativa", 
  "Líder de Compras y Almacen", "Líder de Contabilidad", "Líder de Costos y Presupuestos", "Líder de Gestión Ambiental", 
  "Líder de Proceso de alimentos y bebidas", "Líder de Tesorería y Cartera", "Lider Tactico de Infraestructura Tecnológica", 
  "Líder Táctico de mejora Continua", "Líder Táctico desarrollo de Software", "Líder táctico de alimentos y bebidas", 
  "Mensajero", "Mesero", "Porcionador", "Primer Cocinero (a)", "Recepcionista", "Salvavidas", "Steward", "Subdirección de Operaciones Balneario", 
  "Subdirector de Operaciones Hotel", "Supervisor (a) de operaciones", "Supervisor (a) mesa y servicio", "Supervisor Operaciones", 
  "Supervisor Ruta Ecológica", "Técnico de mantenimiento", "Terapeuta SPA"
];

export default function Hallazgos({
  isAdmin,
  informesAuditoria = [], // 🟢 Recibimos la lista de informes
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

  // 🧠 GENERADOR DE ID AUTOMÁTICO
  const anioActual = new Date().getFullYear();
  let nextIdVal = "";

  if (editHallazgo) {
    nextIdVal = editHallazgo.ref; // Si está editando, deja el ID quieto
  } else {
    // Si es nuevo, busca todos los hallazgos de este año, saca el mayor número y le suma 1
    const consecutivos = hFiltrados
      .filter(h => h.ref && h.ref.includes(anioActual.toString()))
      .map(h => parseInt(h.ref.split('-')[2]) || 0);
    const maxConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) : 0;
    nextIdVal = `HAL-${anioActual}-${String(maxConsecutivo + 1).padStart(3, '0')}`;
  }
// ⏳ ESTADOS LOCALES PARA FILTROS DE FECHA
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // 🧠 LÓGICA DE FILTRADO (Hereda la fecha del informe padre)
  const hallazgosFiltradosPorFecha = hFiltrados.filter(h => {
    if (!filtroAnio && !filtroMes) return true;
    const informeBase = informesAuditoria.find(inf => String(inf.id) === String(h.idInforme));
    if (!informeBase || !informeBase.fecha) return false;
    const [anio, mes] = informeBase.fecha.split('-');
    if (filtroAnio && anio !== filtroAnio) return false;
    if (filtroMes && mes !== filtroMes) return false;
    return true;
  });
// ☁️ MOTOR DE SUBIDA DE EVIDENCIAS A LA API DE TERMALES
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', 'Evidencia de Hallazgo'); 
    formData.append('file', file); 

    try {
      setUploadProgress(50);
      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;

      setArchivoSubidoUrl(urlFinal);
      setIsUploading(false);
      setUploadProgress(100);
      alert("🎉 ¡Evidencia guardada con éxito en el servidor de Termales!");
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor de archivos.");
      setIsUploading(false);
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📄 Hallazgos y Desviaciones</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión de auditorías y no conformidades encontradas.</p>
        </div>
      </div>

      <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{editHallazgo ? `✏️ Editando Hallazgo: ${editHallazgo.ref}` : '➕ DOCUMENTAR NUEVA DESVIACIÓN'}</h3>
          {editHallazgo && <button onClick={() => setEditHallazgo(null)} className="text-xs text-slate-500 hover:text-red-600 font-bold">✖ Cancelar Edición</button>}
        </div>

        <form onSubmit={handleHallazgoSubmit} key={editHallazgo?.id || 'nuevo-hallazgo'} className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
          
          {/* 🔒 ID AUTOMÁTICO */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">ID / Código (Automático)</label>
            <input 
              name="ref" 
              value={nextIdVal} 
              readOnly 
              className="w-full border border-slate-200 bg-slate-100 text-slate-500 font-black rounded-lg p-2 cursor-not-allowed outline-none focus:ring-0" 
            />
          </div>

          {/* 🏢 SEDE */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Sede</label>
            <select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border border-slate-300 rounded-lg p-2 bg-white">
              <option>Hotel</option>
              <option>Ecoparque</option>
              <option>Administrativo</option>
            </select>
          </div>

          {/* 📁 INFORME ORIGEN */}
          <div className="md:col-span-2">
            <label className="font-bold text-gray-600 block mb-1">Informe de Auditoría Origen</label>
            <select 
              name="idInforme" 
              defaultValue={editHallazgo?.idInforme||''} 
              required
              className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
            >
              <option value="">-- Seleccione el Informe Radicado --</option>
              {informesAuditoria.map((inf) => (
                <option key={inf.id} value={inf.id}>[{inf.ref}] {inf.titulo}</option>
              ))}
            </select>
          </div>
          
          {/* 🔍 PROCESO AUDITADO */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label>
            <input 
              name="proceso" 
              list="lista-procesos" 
              defaultValue={editHallazgo?.proceso||''} 
              required 
              placeholder="Escribe o selecciona..." 
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
            />
            <datalist id="lista-procesos">
              {PROCESOS_OFICIALES.map(proc => <option key={proc} value={proc} />)}
            </datalist>
          </div>
          
          {/* 👥 AUDITOR RESPONSABLE */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Auditor Responsable</label>
            <select name="auditor" defaultValue={editHallazgo?.auditor||''} required className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium">
              <option value="">-- Seleccione un Auditor --</option>
              {AUDITORES_OFICIALES.map(aud => <option key={aud} value={aud}>{aud}</option>)}
            </select>
          </div>

          {/* 👔 DUEÑO DEL PROCESO */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Dueño del Proceso (Cargo)</label>
            <select name="responsable" defaultValue={editHallazgo?.responsable||''} required className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium">
              <option value="">-- Seleccione el Cargo --</option>
              {CARGOS_OFICIALES.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
          </div>

          {/* ⚖️ CLASE DE OBSERVACIÓN (ACTUALIZADO) */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Clase de Observación</label>
            <select 
              name="claseObservacion" 
              defaultValue={editHallazgo?.claseObservacion||'Hallazgo'} 
              className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
            >
              <option value="Hallazgo">Hallazgo</option>
              <option value="No Conformidad">No Conformidad</option>
              <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
              <option value="Observación">Observación</option>
            </select>
          </div>

          {/* 📝 TÍTULO / DESCRIPCIÓN (AMPLIADO A TEXTAREA) */}
          <div className="md:col-span-4">
            <label className="font-bold text-gray-600 block mb-1">Título / Descripción de la Falla</label>
            <textarea 
              name="titulo" 
              defaultValue={editHallazgo?.titulo||''} 
              required 
              rows="5"
              placeholder="Describa el hallazgo detalladamente..." 
              className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-y shadow-inner" 
            />
          </div>            
          
          {/* ☁️ BÓVEDA SERVIDOR TERMALES: EVIDENCIA DEL HALLAZGO */}
          <div className="md:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner mt-2">
            <div className="border-b pb-2 border-slate-200 flex justify-between items-center mb-4">
              <div>
                <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Evidencia del Hallazgo</label>
                <p className="text-[9px] text-slate-500 font-medium">Sube el soporte (PDF o Imagen). Se guardará en el repositorio oficial.</p>
              </div>
              <div className="text-slate-300 text-3xl">☁️</div>
            </div>

            {/* INPUT OCULTO: Guarda la URL en el formulario */}
            <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editHallazgo?.evidenciaUrl || ''} />

            <div className="bg-white border-2 border-dashed border-rose-300 p-6 rounded-2xl text-center relative hover:border-rose-500 hover:bg-rose-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
              {isUploading ? (
                <div className="space-y-3 w-full">
                  <div className="text-3xl animate-bounce">🚀</div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                    <div className="bg-rose-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-500">{uploadProgress}% Subiendo al servidor...</p>
                </div>
              ) : archivoSubidoUrl || editHallazgo?.evidenciaUrl ? (
                <div className="space-y-2">
                  <div className="text-4xl text-rose-500">✅</div>
                  <a href={archivoSubidoUrl || editHallazgo?.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Soporte Subido</a>
                  <label className="block mt-3 cursor-pointer text-slate-400 hover:text-rose-600 text-[9px] font-bold uppercase tracking-wider transition-colors underline">
                    Reemplazar Archivo
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                  <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-rose-100 group-hover:text-rose-700 transition-colors">Seleccionar Archivo PDF o Imagen</p>
                  <input type="file" className="hidden" accept=".pdf, .jpg, .png, .docx" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          </div>
          
          {/* 🔘 BOTÓN */}
          <div className="md:col-span-4 flex justify-end items-end pt-2">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all w-full md:w-auto">
              {editHallazgo ? '💾 Guardar Cambios' : '➕ REGISTRAR HALLAZGO'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-4">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">DESVIACIONES</h3>
           
           <div className="flex flex-wrap items-center gap-3">
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
                <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-64 shadow-sm" />
             </div>
           </div>
        </div>
         <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              <tr>
                <th className="p-4">
                  <div>ID / REF</div>
                  <FilterInput colKey="ref" placeholder="Identificación..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>PROCESO</div>
                  <FilterInput colKey="proceso" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4 w-1/3">
                  <div>TÍTULO E INFORMES</div>
                  <FilterInput colKey="titulo" columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4">
                  <div>RESPONSABLES</div>
                  <FilterInput colKey="responsable" placeholder="Responsable..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
                <th className="p-4 text-center">
                  <div>ESTADO / GESTIÓN</div>
                  <FilterInput colKey="estado" placeholder="Estado..." columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applyFilters(hallazgosFiltradosPorFecha, searchTerm, columnFilters).map((h, index) => (
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
                    {h.evidenciaUrl ? (
                      <div className="flex items-center space-x-2 mt-2">
                        <a href={h.evidenciaUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-blue-100 flex items-center space-x-1 transition-colors shadow-sm">
                          <span>🔗</span><span>Abrir Enlace</span>
                        </a>
                      </div>
                    ) : (
                      <div className="mt-2 text-[9px] text-slate-400 font-medium italic border border-dashed border-slate-200 inline-block px-2 py-1 rounded bg-slate-50">🚫 Sin evidencia adjunta</div>
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
                    
                    <div className="flex justify-center items-center space-x-2 border-t border-slate-100 pt-3">
                      <button onClick={() => {setEditHallazgo(h); setFormResetKey(Date.now()); scrollToForm();}} className="text-slate-500 hover:text-blue-600 transition-colors font-bold" title="Editar">
                        ✏️ Editar
                      </button>
                      
                      {isAdmin && (
                        <>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => handleDeleteItem('hallazgos', h.id)} className="text-slate-500 hover:text-red-600 transition-colors font-bold" title="Eliminar">
                            🗑️ Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}