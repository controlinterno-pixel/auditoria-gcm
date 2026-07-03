import React from 'react';

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
          
          {/* 🔒 ID AUTOMÁTICO BLOQUEADO */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">ID / Código (Automático)</label>
            <input 
              name="ref" 
              value={nextIdVal} 
              readOnly 
              className="w-full border border-slate-200 bg-slate-100 text-slate-500 font-black rounded-lg p-2 cursor-not-allowed outline-none focus:ring-0" 
              title="Este consecutivo se genera automáticamente"
            />
          </div>

          <div><label className="font-bold text-gray-600 block mb-1">Sede</label><select name="sede" defaultValue={editHallazgo?.sede||'Hotel'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Hotel</option><option>Ecoparque</option><option>Administrativo</option></select></div>
          
          {/* 🔍 BUSCADOR DE PROCESOS (DATALIST) */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Proceso Auditado</label>
            <input 
              name="proceso" 
              list="lista-procesos" 
              defaultValue={editHallazgo?.proceso||''} 
              required 
              placeholder="Escribe o selecciona..." 
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" 
            />
            <datalist id="lista-procesos">
              {PROCESOS_OFICIALES.map(proc => <option key={proc} value={proc} />)}
            </datalist>
          </div>
          
          <div><label className="font-bold text-gray-600 block mb-1">Severidad</label><select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
          
          {/* 👥 DESPLEGABLE DE AUDITORES */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Auditor Responsable</label>
            <select name="auditor" defaultValue={editHallazgo?.auditor||''} required className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">-- Seleccione un Auditor --</option>
              {AUDITORES_OFICIALES.map(aud => <option key={aud} value={aud}>{aud}</option>)}
            </select>
          </div>

          {/* 👔 DESPLEGABLE DE CARGOS OFICIALES */}
          <div>
            <label className="font-bold text-gray-600 block mb-1">Dueño del Proceso (Cargo)</label>
            <select name="responsable" defaultValue={editHallazgo?.responsable||''} required className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">-- Seleccione el Cargo --</option>
              {CARGOS_OFICIALES.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
          </div>

          {/* 🔍 CLASE DE OBSERVACIÓN */}
          <div className="md:col-span-2">
            <label className="font-bold text-gray-600 block mb-1">Clase de Observación</label>
            <select 
              name="claseObservacion" 
              defaultValue={editHallazgo?.claseObservacion||'Oportunidad de Mejora'} 
              className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700"
            >
              <option value="Oportunidad de Mejora">Oportunidad de Mejora</option>
              <option value="No Conformidad">No Conformidad</option>
              <option value="Observación">Observación</option>
            </select>
          </div>

          {/* 📝 TÍTULO EXPANDIDO */}
          <div className="md:col-span-4">
            <label className="font-bold text-gray-600 block mb-1">Título / Descripción de la Falla</label>
            <input name="titulo" defaultValue={editHallazgo?.titulo||''} required placeholder="Describa el hallazgo brevemente..." className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
          </div>            

          {/* 🧠 ANÁLISIS DE CAUSAS RAÍZ */}
          <div className="md:col-span-4">
            <label className="font-bold text-gray-600 block mb-1">Análisis de Causas (Causa Raíz)</label>
            <input 
              name="causa" 
              defaultValue={editHallazgo?.causa||''} 
              required
              placeholder="Ej: Ausencia de una herramienta que permita consolidar la satisfacción del cliente..." 
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700" 
            />
          </div>            
          
          <div className="md:col-span-4 bg-rose-50/50 p-4 rounded-xl border border-rose-100 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-rose-100 pb-3">
              <div>
                <label className="font-black text-rose-800 uppercase tracking-widest text-[10px]">Paso 1: Busca y copia el enlace de soporte</label>
                <p className="text-[9px] text-rose-600 font-medium mt-0.5">Ve a tu nube, busca el archivo del informe o foto, haz clic en "Compartir" y copia el link.</p>
              </div>
              <div className="flex space-x-2 mt-2 md:mt-0">
                <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>📁</span><span>Ir a Drive</span></a>
                <a href="https://onedrive.live.com" target="_blank" rel="noreferrer" className="text-[10px] bg-white border border-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center space-x-1"><span>☁️</span><span>Ir a OneDrive</span></a>
              </div>
            </div>
            <div>
              <label className="font-black text-rose-800 uppercase tracking-widest text-[10px] block mb-1.5">Paso 2: Pega el enlace de la evidencia aquí</label>
              <input type="url" name="evidenciaUrlInput" defaultValue={editHallazgo?.evidenciaUrl||''} placeholder="Ej: https://drive.google.com/file/d/1a2b3c..." className="w-full border border-rose-200 bg-white rounded-lg p-2.5 text-xs shadow-inner focus:ring-2 focus:ring-rose-500 outline-none transition-all" />
            </div>
            {editHallazgo?.evidenciaUrl && (
              <div className="mt-3 flex space-x-2 border-t border-rose-100 pt-2">
                <a href={editHallazgo.evidenciaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-[10px] font-bold hover:bg-rose-200 shadow-sm transition-colors">
                  👁️ Abrir Enlace Actual
                </a>
              </div>
            )}
          </div>
          
          <div className="md:col-span-4 flex justify-end items-end">
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all w-full md:w-auto">
              {editHallazgo ? '💾 Guardar Cambios' : '➕ REGISTRAR HALLAZGO'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">DESVIACIONES</h3>
           <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input type="text" placeholder="Búsqueda General..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-64 shadow-sm" />
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
              {applyFilters(hFiltrados, searchTerm, columnFilters).map((h, index) => (
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