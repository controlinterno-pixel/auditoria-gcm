import React, { useState } from 'react';

const TIPOS_COMITE = [
  "Comité de Auditoría de Accionistas",
  "Junta Directiva",
  "Daily Scrum Meeting de Auditoría ST",
  "Comité de ambiente y control"
];
export default function Comites({
  isAdmin,
  editComite,
  setEditComite,
  handleComiteSubmit,
  setFormResetKey,
  formResetKey,
  scrollToForm,
  handleDeleteItem,
  applyFilters,
  comitesFiltrados,
  searchTerm,
  setSearchTerm,
  columnFilters,
  handleColFilterChange,
  FilterInput
}) {
  // 🗂️ ESTADO DEL ACORDEÓN
  const [grupoExpandido, setGrupoExpandido] = useState(null);

  // ☁️ ESTADOS Y MOTOR DE SUBIDA (API TERMALES)
  const [uploadProgressPres, setUploadProgressPres] = useState(0);
  const [isUploadingPres, setIsUploadingPres] = useState(false);
  const [presentacionSubidaUrl, setPresentacionSubidaUrl] = useState('');

  const [uploadProgressActa, setUploadProgressActa] = useState(0);
  const [isUploadingActa, setIsUploadingActa] = useState(false);
  const [actaSubidaUrl, setActaSubidaUrl] = useState('');

  // 🧹 Efecto limpiador: Reacciona a la llave maestra para vaciar los recuadros de archivos
  React.useEffect(() => {
    if (!editComite) {
      setPresentacionSubidaUrl('');
      setActaSubidaUrl('');
      setUploadProgressPres(0);
      setUploadProgressActa(0);
    }
  }, [editComite, formResetKey]);

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'presentacion') {
      setIsUploadingPres(true);
      setUploadProgressPres(20);
    } else {
      setIsUploadingActa(true);
      setUploadProgressActa(20);
    }

    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', `Soporte de Comité - ${type}`); 
    formData.append('file', file); 

    try {
      if (type === 'presentacion') setUploadProgressPres(50);
      else setUploadProgressActa(50);

      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);


      const data = await response.json();
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;

      if (type === 'presentacion') {
        setPresentacionSubidaUrl(urlFinal);
        setIsUploadingPres(false);
        setUploadProgressPres(100);
      } else {
        setActaSubidaUrl(urlFinal);
        setIsUploadingActa(false);
        setUploadProgressActa(100);
      }
      alert(`🎉 ¡${type === 'presentacion' ? 'Presentación' : 'Acta'} guardada con éxito en el servidor!`);
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor de archivos.");
      if (type === 'presentacion') setIsUploadingPres(false);
      else setIsUploadingActa(false);
    }
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">👥 Gestión de Comités y Actas</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Custodia de presentaciones expuestas, actas formales y control de compromisos.</p>
        </div>
      </div>

      {/* 📝 FORMULARIO DE REGISTRO */}
      <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">
            {editComite ? `✏️ Editando Sesión: ${editComite.nombre}` : '➕ RADICAR NUEVA SESIÓN DE COMITÉ'}
          </h3>
          {editComite && (
            <button onClick={() => setEditComite(null)} className="text-xs text-slate-500 hover:text-red-600 font-bold">
              ✖ Cancelar Edición
            </button>
          )}
        </div>

<form onSubmit={handleComiteSubmit} key={editComite ? `edit-${editComite.id}-${formResetKey}` : `nuevo-${formResetKey}`} className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">          
          <div>
            <label className="font-bold text-gray-600 block mb-1">Nombre de la Sesión / Tema Central</label>
            <input 
              name="nombre" 
              defaultValue={editComite?.nombre||''} 
              required 
              placeholder="Ej: Sesión Ordinaria Q2 - Evaluación de Control Interno" 
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800" 
            />
          </div>

          <div>
            <label className="font-bold text-gray-600 block mb-1">Tipo de Comité</label>
            <select 
              name="tipo" 
              defaultValue={editComite?.tipo||''} 
              required 
              className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            >
              <option value="">-- Seleccione el Comité --</option>
              {TIPOS_COMITE.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="font-bold text-gray-600 block mb-1">Fecha de Ejecución</label>
            <input 
              name="fecha" 
              type="date" 
              defaultValue={editComite?.fecha||''} 
              required 
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
            />
          </div>

          <div className="md:col-span-3">
            <label className="font-bold text-gray-600 block mb-1">Compromisos Adquiridos / Acuerdos Clave</label>
            <textarea 
              name="compromisos" 
              defaultValue={editComite?.compromisos||''} 
              required 
              rows="3"
              placeholder="Escriba los entregables, responsables asignados y fechas límites pactadas en el comité..." 
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* ☁️ BÓVEDA SERVIDOR TERMALES: PRESENTACIÓN Y ACTA */}
          <div className="md:col-span-3 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 border-b pb-2 border-slate-200 flex justify-between items-center">
              <div>
                <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Repositorio Documental Corporativo</label>
                <p className="text-[9px] text-slate-500 font-medium">Sube las presentaciones y actas. Se guardarán directo en la nube de Termales.</p>
              </div>
              <div className="text-slate-300 text-3xl">☁️</div>
            </div>

            {/* INPUTS OCULTOS */}
            <input type="hidden" name="presentacionUrl" value={presentacionSubidaUrl || editComite?.presentacionUrl || ''} />
            <input type="hidden" name="actaUrl" value={actaSubidaUrl || editComite?.actaUrl || ''} />

            {/* CAJA 1: PRESENTACION */}
            <div className="bg-white border-2 border-dashed border-blue-300 p-6 rounded-2xl text-center relative hover:border-blue-500 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
              <span className="absolute top-2 left-3 text-[9px] font-black uppercase text-blue-600 tracking-widest">🖥️ Presentación Expuesta</span>
              
              {isUploadingPres ? (
                <div className="space-y-3 w-full">
                  <div className="text-3xl animate-bounce">🚀</div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                    <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgressPres}%` }}></div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-500">{uploadProgressPres}% Subiendo...</p>
                </div>
              ) : presentacionSubidaUrl || editComite?.presentacionUrl ? (
                <div className="space-y-2">
                  <div className="text-4xl text-blue-500">✅</div>
                  <a href={presentacionSubidaUrl || editComite?.presentacionUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Presentación</a>
                  <label className="block mt-3 cursor-pointer text-slate-400 hover:text-blue-600 text-[9px] font-bold uppercase tracking-wider underline transition-colors">
                    Reemplazar
                    <input type="file" className="hidden" accept=".pdf, .ppt, .pptx" onChange={(e) => handleFileUpload(e, 'presentacion')} />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                  <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📊</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">Subir PPT o PDF</p>
                  <input type="file" className="hidden" accept=".pdf, .ppt, .pptx" onChange={(e) => handleFileUpload(e, 'presentacion')} />
                </label>
              )}
            </div>

            {/* CAJA 2: ACTA */}
            <div className="bg-white border-2 border-dashed border-purple-300 p-6 rounded-2xl text-center relative hover:border-purple-500 hover:bg-purple-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
              <span className="absolute top-2 left-3 text-[9px] font-black uppercase text-purple-600 tracking-widest">📜 Acta Formal Firmada</span>
              
              {isUploadingActa ? (
                <div className="space-y-3 w-full">
                  <div className="text-3xl animate-bounce">🚀</div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                    <div className="bg-purple-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgressActa}%` }}></div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-500">{uploadProgressActa}% Subiendo...</p>
                </div>
              ) : actaSubidaUrl || editComite?.actaUrl ? (
                <div className="space-y-2">
                  <div className="text-4xl text-purple-500">✅</div>
                  <a href={actaSubidaUrl || editComite?.actaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Acta</a>
                  <label className="block mt-3 cursor-pointer text-slate-400 hover:text-purple-600 text-[9px] font-bold uppercase tracking-wider underline transition-colors">
                    Reemplazar
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png, .doc, .docx" onChange={(e) => handleFileUpload(e, 'acta')} />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                  <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">✍️</div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">Subir Acta Firmada</p>
                  <input type="file" className="hidden" accept=".pdf, .jpg, .png, .doc, .docx" onChange={(e) => handleFileUpload(e, 'acta')} />
                </label>
              )}
            </div>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto">
              {editComite ? '💾 Guardar Cambios' : '➕ ARCHIVAR Y REGISTRAR COMITÉ'}
            </button>
          </div>
        </form>
      </div>
{/* 📊 REGISTROS AGRUPADOS POR COMITÉ (ACORDEONES) */}
      <div className="space-y-4">
        
        {/* BUSCADOR */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center bg-white rounded-2xl shadow-sm border border-slate-200 gap-4">
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest ml-2">Historial de Sesiones</h3>
           <div className="relative w-full md:w-auto">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input 
                type="text" 
                placeholder="Búsqueda General..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-8 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-72 shadow-sm font-bold" 
              />
           </div>
        </div>

        {(() => {
          // 1. Filtrar los datos
          const datosFiltrados = applyFilters(comitesFiltrados, searchTerm, columnFilters);
          
          // 2. Agrupar por Tipo de Comité
          const comitesAgrupados = datosFiltrados.reduce((acc, c) => {
            const key = c.tipo || 'Sin Clasificar';
            if (!acc[key]) acc[key] = [];
            acc[key].push(c);
            return acc;
          }, {});

          const gruposOrdenados = Object.keys(comitesAgrupados).sort();

          if (gruposOrdenados.length === 0) {
            return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">No hay sesiones registradas que coincidan con la búsqueda.</div>;
          }

          return gruposOrdenados.map(grupo => {
            const items = comitesAgrupados[grupo];
            const isExpanded = grupoExpandido === grupo;
            
            // Iconos y colores personalizados
            let icon = "👥";
            if (grupo.includes("Junta Directiva")) icon = "🏛️";
            if (grupo.includes("Daily") || grupo.includes("Scrum")) icon = "⚡";
            if (grupo.includes("Accionistas")) icon = "📈";

            return (
              <div key={grupo} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                
                {/* CABECERA DEL ACORDEÓN */}
                <div 
                  onClick={() => setGrupoExpandido(isExpanded ? null : grupo)} 
                  className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl bg-white p-2 rounded-xl shadow-sm border border-slate-100">{icon}</span>
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-slate-800 tracking-tight uppercase">{grupo}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{items.length} sesiones archivadas</p>
                    </div>
                  </div>
                  <span className="text-slate-400 font-black px-4">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* CONTENIDO DESPLEGABLE (TABLA INTERNA) */}
                {isExpanded && (
                  <div className="p-4 bg-white animate-in slide-in-from-top-2 duration-300 overflow-x-auto">
                    <table className="w-full text-xs text-left divide-y divide-slate-100">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                        <tr>
                          <th className="p-3 w-1/4">TEMA CENTRAL / SESIÓN</th>
                          <th className="p-3 w-1/3">ACUERDOS Y COMPROMISOS PACTADOS</th>
                          <th className="p-3 text-center">SOPORTES DOCUMENTALES</th>
                          <th className="p-3 text-center">ACCIÓN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {items.map((c, index) => (
                          <tr key={`comite-row-${c.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 align-top">
                              <div className="font-black text-slate-900 text-sm leading-tight mb-1">{c.nombre}</div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">📅 {c.fecha}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Periodo: {c.mes} / {c.anio}</div>
                            </td>
                            <td className="p-3 align-top">
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium text-slate-700 whitespace-pre-wrap leading-relaxed text-[10px] max-h-32 overflow-y-auto shadow-inner">
                                {c.compromisos}
                              </div>
                            </td>
                            <td className="p-3 align-top">
                              <div className="flex flex-col space-y-2 max-w-[160px] mx-auto">
                                
                                {/* Botón de Presentación (Condicional) */}
                                {c.presentacionUrl ? (
                                  <a href={c.presentacionUrl} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-700 font-black px-3 py-2 rounded-xl text-[9px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full">
                                    <span>🖥️</span> <span>Ver Presentación</span>
                                  </a>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-center italic w-full">
                                    Sin Presentación
                                  </span>
                                )}

                                {/* Botón de Acta Firmada (Condicional) */}
                                {c.actaUrl ? (
                                  <a href={c.actaUrl} target="_blank" rel="noreferrer" className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[9px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full">
                                    <span>📜</span> <span>Ver Acta Firmada</span>
                                  </a>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-center italic w-full">
                                    Sin Acta Adjunta
                                  </span>
                                )}

                              </div>
                            </td>
                            <td className="p-3 align-top text-center">
                               <div className="flex flex-col justify-center items-center space-y-1.5 w-full max-w-[100px] mx-auto">
                                <button onClick={() => { setEditComite(c); setFormResetKey(Date.now()); scrollToForm(); }} className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 w-full py-1.5 rounded-lg text-[10px] font-black transition-colors shadow-sm">
                                  ✏️ Editar
                                </button>
                                {isAdmin && (
                                  <button onClick={() => handleDeleteItem('comites', c.id)} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 w-full py-1.5 rounded-lg text-[10px] font-black transition-colors shadow-sm">
                                    🗑️ Borrar
                                  </button>
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
          });
        })()}
      </div>
     </div>
  );
}