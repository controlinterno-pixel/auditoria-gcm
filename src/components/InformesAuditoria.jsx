import React, { useState } from 'react';

const PROCESOS_OFICIALES = [
  "Alimentos y Bebidas (AYB)", "Canales Alternos", "Compensaciones", "Compras", "Control Inventarios",
  "Cumplimiento Normativo", "Financiera", "Formación y Desarrollo", "Gestión Ambiental",
  "Gestión Clientes", "Gestión Contable", "Gestión de Crédito y Cartera", "Gestión de tecnologías de la información",
  "Gestión de Tesoreria", "Mantenimiento de Infraestructura", "Mercadeo", "Operaciones Alojamiento y recreación.",
  "Proyectos", "Seguridad y Salud en el Trabajo", "Selección y Vinculación"
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

const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];

// ⏳ ESTADOS LOCALES PARA FILTROS DE FECHA
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // 🧠 LÓGICA DE FILTRADO POR FECHA
  const informesFiltradosPorFecha = safeInformes.filter(inf => {
    if (!filtroAnio && !filtroMes) return true;
    if (!inf.fecha) return false;
    const [anio, mes] = inf.fecha.split('-'); 
    if (filtroAnio && anio !== filtroAnio) return false;
    if (filtroMes && mes !== filtroMes) return false;
    return true;
  });

  // ☁️ ESTADOS DE CARGA PARA API TERMALES
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');

  const [actaProgress, setActaProgress] = useState(0);
  const [isActaUploading, setIsActaUploading] = useState(false);
  const [actaSubidaUrl, setActaSubidaUrl] = useState('');
// ⚙️ MOTOR DE SUBIDA CONECTADO A LA API DE TERMALES SANTA ROSA (POSTMAN CONFIG)
  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (type === 'informe') {
      setIsUploading(true);
      setUploadProgress(20);
    } else {
      setIsActaUploading(true);
      setActaProgress(20);
    }

    // 📦 EMPAQUETAMOS EXACTAMENTE COMO LO PIDE EL POSTMAN DE TI
    const formData = new FormData();
    formData.append('appName', 'controlInterno'); 
    formData.append('description', `Documento adjunto desde GCM Auditor - ${type}`); 
    formData.append('file', file); 

    try {
      if (type === 'informe') setUploadProgress(50);
      else setActaProgress(50);

      const response = await fetch('https://repos.termalessantarosa.com.co/api/archivos/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = await response.json();
      
      // 🔗 ARMAMOS LA URL CON EL NOMBRE ENCRIPTADO QUE NOS RESPONDE EL SERVIDOR
      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;

      if (type === 'informe') {
        setArchivoSubidoUrl(urlFinal);
        setIsUploading(false);
        setUploadProgress(100);
      } else {
        setActaSubidaUrl(urlFinal);
        setIsActaUploading(false);
        setActaProgress(100);
      }
      alert("🎉 ¡Archivo guardado con éxito en el repositorio oficial de Termales!");

    } catch (err) {
      console.error(err);
      alert("Error en la conexión con el servidor. Revisa la consola para más detalles.");
      if (type === 'informe') setIsUploading(false);
      else setIsActaUploading(false);
    }
  };

  const handleResetForm = () => {
    setEditInformeAuditoria(null);
    setArchivoSubidoUrl('');
    setActaSubidaUrl('');
    setUploadProgress(0);
    setActaProgress(0);
    setFormResetKey(Date.now());
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 📋 CABECERA PRINCIPAL */}
      <div className="border-b pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📁 Repositorio de Informes Emitidos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Archivo formal de dictámenes, consecutivos, actas de socialización y distribución electrónica.
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            type="button"
            onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-colors flex items-center space-x-1.5"
          >
            <span>📥</span>
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* ➕ FORMULARIO AVANZADO COMPLETO */}
      {isAdmin && (
        <div id="edit-form" className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4 relative">
          
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
              {editInformeAuditoria ? `✏️ Editando Flujo de Informe: ${editInformeAuditoria.ref}` : '➕ ARCHIVAR, RADICAR Y DISTRIBUIR NUEVO INFORME'}
            </h3>
            {editInformeAuditoria && (
              <button type="button" onClick={handleResetForm} className="text-[10px] font-bold text-red-500 hover:underline">Cancelar Edición</button>
            )}
          </div>

          <form key={editInformeAuditoria?.ref || 'form-nuevo'} onSubmit={handleInformeAuditoriaSubmit} className="space-y-6 text-xs">
{/* 📊 REJILLA DE CAMPOS PERFECTAMENTE ALINEADA (4 COLUMNAS) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* 📝 COLUMNA: TÍTULO (OCUPA 2 COLUMNAS) */}
              <div className="md:col-span-2">
                <label className="font-bold text-gray-600 block mb-1">Título del Informe Formal</label>
                <input 
                  name="titulo" 
                  defaultValue={editInformeAuditoria?.titulo || ''} 
                  required 
                  placeholder="Ej: Auditoría de Cumplimiento a Cadena de Suministros" 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800" 
                />
              </div>

              {/* 📋 COLUMNA: SELECCIÓN DE PROCESO (OCUPA 1 COLUMNA) */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">📋 Proceso Auditado</label>
                <select 
                  name="proceso" 
                  defaultValue={editInformeAuditoria?.proceso || ''} 
                  required 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 cursor-pointer shadow-sm"
                >
                  <option value="">-- Seleccionar Proceso --</option>
                  {PROCESOS_OFICIALES.map((proc) => (
                    <option key={proc} value={proc}>{proc}</option>
                  ))}
                </select>
              </div>               

              {/* 📅 COLUMNA: FECHA DE EMISIÓN (OCUPA 1 COLUMNA) */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">Fecha de Emisión</label>
                <input 
                  name="fecha" 
                  type="date" 
                  defaultValue={editInformeAuditoria?.fecha || ''} 
                  required 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800" 
                />
              </div>

              {/* ✍️ COLUMNA: ELABORADO POR (OCUPA 1 COLUMNA) */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">✍️ Elaborado Por (Auditor)</label>
                <select 
                  name="elaboradoPor" 
                  defaultValue={editInformeAuditoria?.elaboradoPor || ''} 
                  required 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-medium text-slate-800"
                >
                  <option value="">-- Asignar Auditor --</option>
                  {auditoresLista.map((aud, i) => <option key={`elab-${i}`} value={aud}>{aud}</option>)}
                </select>
              </div>

              {/* 🔍 COLUMNA: REVISADO POR (OCUPA 1 COLUMNA) */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">🔍 Revisado Por (Líder)</label>
                <select 
                  name="revisadoPor" 
                  defaultValue={editInformeAuditoria?.revisadoPor || ''} 
                  required 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-inner cursor-pointer text-slate-800"
                >
                  <option value="">-- Seleccionar --</option>
                  {auditoresLista.map((a, i) => <option key={`rev-${i}`} value={a}>{a}</option>)}
                </select>
              </div>

              {/* 🔒 COLUMNA: APROBADO POR (OCUPA 1 COLUMNA) */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">🔒 Aprobado Por (Gerencia)</label>
                <select 
                  name="aprobadoPor" 
                  defaultValue={editInformeAuditoria?.aprobadoPor || ''} 
                  required 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-inner cursor-pointer text-slate-800"
                >
                  <option value="">-- Seleccionar --</option>
                  {auditoresLista.map((a, i) => <option key={`apr-${i}`} value={a}>{a}</option>)}
                </select>
              </div>

              {/* 📢 COLUMNA: ¿FUE SOCIALIZADO? (OCUPA 1 COLUMNA) */}
              <div>
                <label className="font-bold text-gray-600 block mb-1">📢 ¿Fue Socializado?</label>
                <select 
                  name="socializado" 
                  defaultValue={editInformeAuditoria?.socializado || 'No'} 
                  className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800"
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </div>

              {/* 👥 COLUMNA: PARTICIPANTES (OCUPA LAS 4 COLUMNAS DE ANCHO COMPLETAS) */}
              <div className="md:col-span-4">
                <label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización</label>
                <input 
                  name="socializadoCon" 
                  defaultValue={editInformeAuditoria?.socializadoCon || ''} 
                  placeholder="Ej: Comité de Auditoría, Gerencia General..." 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0A3B32] outline-none text-slate-800" 
                />
              </div>

            </div>            
           
            {/* 📧 DISTRIBUCIÓN ELECTRÓNICA */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-inner">
              <label className="font-black text-blue-900 block mb-1 uppercase tracking-wider text-[10px]">📧 DISTRIBUCIÓN POR CORREO ELECTRÓNICO (NOTIFICACIÓN INMEDIATA)</label>
              <input name="correosNotificacionInput" type="text" placeholder="Ej: gerente@termales.com.co, compras@termales.com.co (Separa los correos por comas)" className="w-full border border-blue-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" />
              <p className="text-[9px] text-blue-600 mt-1 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
            </div>

         {/* ☁️ BÓVEDA SERVIDOR TERMALES: GESTOR DE EVIDENCIAS */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 border-b pb-2 border-slate-200 flex justify-between items-center">
                <div>
                  <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">Repositorio Oficial Termales Santa Rosa</label>
                  <p className="text-[9px] text-slate-500 font-medium">Sube tus PDFs. El sistema los enviará directo a repos.termalessantarosa.com.co.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

              {/* INPUTS OCULTOS: Guardan las URLs de tu API en el form */}
              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || editInformeAuditoria?.evidenciaUrl || ''} />
              <input type="hidden" name="actaSocializacionUrlInput" value={actaSubidaUrl || editInformeAuditoria?.actaSocializacionUrl || ''} />

              {/* CAJA 1: INFORME PDF */}
              <div className="bg-white border-2 border-dashed border-emerald-300 p-6 rounded-2xl text-center relative hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
                <span className="absolute top-2 left-3 text-[9px] font-black uppercase text-emerald-600 tracking-widest">📄 Documento Principal (Informe)</span>
                
                {isUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500">{uploadProgress}% Subiendo al servidor...</p>
                  </div>
                ) : archivoSubidoUrl || editInformeAuditoria?.evidenciaUrl ? (
                  <div className="space-y-2">
                    <div className="text-4xl text-emerald-500">✅</div>
                    <a href={archivoSubidoUrl || editInformeAuditoria?.evidenciaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Archivo Subido</a>
                    <label className="block mt-3 cursor-pointer text-slate-400 hover:text-emerald-600 text-[9px] font-bold uppercase tracking-wider transition-colors underline">
                      Reemplazar Archivo
                      <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => handleFileUpload(e, 'informe')} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">Seleccionar Archivo PDF</p>
                    <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => handleFileUpload(e, 'informe')} />
                  </label>
                )}
              </div>

              {/* CAJA 2: ACTA DE SOCIALIZACIÓN */}
              <div className="bg-white border-2 border-dashed border-purple-300 p-6 rounded-2xl text-center relative hover:border-purple-500 hover:bg-purple-50/50 transition-all flex flex-col items-center justify-center min-h-[160px]">
                 <span className="absolute top-2 left-3 text-[9px] font-black uppercase text-purple-600 tracking-widest">🤝 Acta de Reunión / Firmas</span>
                
                {isActaUploading ? (
                  <div className="space-y-3 w-full">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[80%] mx-auto overflow-hidden">
                      <div className="bg-purple-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${actaProgress}%` }}></div>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500">{actaProgress}% Subiendo al servidor...</p>
                  </div>
                ) : actaSubidaUrl || editInformeAuditoria?.actaSocializacionUrl ? (
                  <div className="space-y-2">
                    <div className="text-4xl text-purple-500">✅</div>
                    <a href={actaSubidaUrl || editInformeAuditoria?.actaSocializacionUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md">Ver Acta Subida</a>
                    <label className="block mt-3 cursor-pointer text-slate-400 hover:text-purple-600 text-[9px] font-bold uppercase tracking-wider transition-colors underline">
                      Reemplazar Archivo
                      <input type="file" className="hidden" accept=".pdf, .jpg, .png" onChange={(e) => handleFileUpload(e, 'acta')} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📷</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">Seleccionar Imagen o PDF</p>
                    <input type="file" className="hidden" accept=".pdf, .jpg, .png" onChange={(e) => handleFileUpload(e, 'acta')} />
                  </label>
                )}
              </div>
            </div>

<div className="md:col-span-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isSubmitting} 
                onClick={(e) => {
                  const form = e.target.closest('form');
                  if (!form) return;

                  // 🚨 1. INYECCIÓN DE SEGURIDAD: Pasa las URLs de los archivos cargados
                  const inputEvidencia = form.querySelector('input[name="evidenciaUrlInput"]');
                  const inputActa = form.querySelector('input[name="actaSocializacionUrlInput"]');
                  
                  if (inputEvidencia && archivoSubidoUrl) inputEvidencia.value = archivoSubidoUrl;
                  if (inputActa && actaSubidaUrl) inputActa.value = actaSubidaUrl;

                  // 🧼 2. RESETEO TOTAL DE LA INTERFAZ TRAS EL GUARDADO
                  // Esperamos 3 segundos para asegurar que Firebase y Gmail hayan respondido
                  setTimeout(() => {
                    // Limpia los archivos del estado local
                    handleResetForm();
                    
                    // Borra físicamente todos los textos e inputs escritos en el formulario
                    form.reset();
                    
                    // 🪄 TRUCO DE MAGIA: Forzamos una recarga limpia interna sin reiniciar el navegador
                    // Esto quitará el letrero "PROCESANDO..." al obligar a la interfaz a re-renderizarse limpia
                    if(typeof setFormResetKey === 'function') {
                      setFormResetKey(Date.now());
                    } else {
                      // Si todo falla, una pequeña ayuda visual para desbloquear el botón
                      e.target.disabled = false;
                    }
                    
                    alert("✨ Formulario desbloqueado y limpio. ¡Listo para el siguiente informe!");
                  }, 3000);
                }}
                className={`font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-md transition-all w-full md:w-auto text-center block ${isSubmitting ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#0A3B32] hover:bg-[#062620] text-white cursor-pointer'}`}
              >
                {isSubmitting ? '⏳ Procesando...' : (editInformeAuditoria ? 'Guardar Cambios' : 'RADICAR, ARCHIVAR Y ENVIAR DICTAMEN')}
              </button>
            </div>
          </form>

          {/* 🟢 PANEL DE CONTROL DE BAJAS Y ALTAS DEL PERSONAL DE AUDITORÍA */}
          <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 space-y-4 mt-6">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">👥 Gestión de Personal del Equipo de Auditoría</h4>
              <p className="text-[9px] text-slate-500 font-medium">Agregue o retire firmas autorizadas para los flujos del sistema en tiempo real.</p>
            </div>

            <div className="flex flex-wrap gap-2 py-1">
              {auditoresLista.map((auditor, index) => (
                <div key={`badge-${index}`} className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl flex items-center space-x-2 text-[11px] font-bold">
                  <span>{auditor}</span>
                  <button 
                    type="button"
                    onClick={() => {
                      if(window.confirm(`¿Desea eliminar permanentemente a ${auditor} de la lista de firmas autorizadas?`)) {
                        const filtrados = auditoresLista.filter(a => a !== auditor);
                        onActualizarAuditores(filtrados);
                      }
                    }}
                    className="text-red-400 hover:text-red-500 font-black text-[9px] ml-1 bg-red-500/10 w-4 h-4 rounded-full flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input 
                type="text" 
                id="inputNuevoAuditor"
                placeholder="Nombre del nuevo funcionario..." 
                className="bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs flex-1 outline-none focus:border-blue-500 font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('inputNuevoAuditor');
                  const nuevoNombre = input?.value?.trim();
                  if (!nuevoNombre) return;
                  if (auditoresLista.includes(nuevoNombre)) {
                    alert("Este funcionario ya se encuentra registrado en la lista corporativa.");
                    return;
                  }
                  onActualizarAuditores([...auditoresLista, nuevoNombre]);
                  input.value = "";
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shrink-0 uppercase tracking-wider"
              >
                ➕ Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 BARRA DE FILTROS Y BÚSQUEDA */}
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

      {/* 📊 REPOSITORIO TABULAR GENERAL */}
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
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400 font-bold italic">
                    No se encontraron informes con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                applyFilters(informesFiltradosPorFecha, searchTerm, columnFilters).map((inf, idx) => (
                  <tr key={inf.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">
                      {inf.ref || `INF-2026-${String(idx + 1).padStart(3, '0')}`}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">
                        {inf.proceso}
                      </span>
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
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block ${
                          inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          📢 Socializado: {inf.socializado || 'No'}
                        </span>
                        
                        {inf.socializadoCon && (
                          <div className="text-[10px] text-slate-500 font-semibold leading-relaxed">Con: {inf.socializadoCon}</div>
                        )}

                        {/* 📧 AUDIT TRAIL CON HOVER FIJO AL CENTRO DE LA PANTALLA */}
                        {inf.correoEnviadoA && (
                          <div className="mt-2 group inline-block cursor-help">
                            
                            {/* BOTÓN VISIBLE EN LA TABLA */}
                            <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm">
                              <span className="text-sm">📧</span>
                              <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Notificado al Líder</span>
                            </div>

                            {/* POPUP FIJO: APARECE EN EL CENTRO EXACTO DEL MONITOR (NO REQUIERE SCROLL) */}
                            <div className="fixed inset-0 z-[9999] pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible flex items-center justify-center transition-all duration-300">
                              
                              {/* Capa oscura difuminada detrás del letrero (Efecto Cine) */}
                              <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"></div>
                              
                              {/* Tarjeta del letrero centrada */}
                              <div className="relative bg-[#0f172a] border border-emerald-500/40 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] transform scale-95 group-hover:scale-100 transition-transform duration-300 w-80 text-left">
                                <h4 className="text-[12px] font-black text-emerald-400 uppercase tracking-widest mb-3 border-b border-slate-700/80 pb-2 flex items-center">
                                  <span className="mr-2 text-base">🔗</span> Audit Trail de Correo
                                </h4>
                                <div className="space-y-3 text-[10px] leading-relaxed text-slate-300 font-medium">
                                  <p className="flex flex-col">
                                    <b className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Destinatario(s):</b> 
                                    <span className="text-white font-mono break-all bg-slate-800/80 p-1.5 rounded border border-slate-700">{inf.correoEnviadoA}</span>
                                  </p>
                                  <p className="flex flex-col">
                                    <b className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Fecha y Hora de Despacho:</b> 
                                    <span className="text-emerald-400 font-black text-xs">{inf.fechaCorreoEnviado}</span>
                                  </p>
                                  <p className="text-[9px] text-slate-500 italic mt-3 border-t border-slate-700/80 pt-3">
                                    El sistema GRC certifica que este dictamen fue despachado de forma segura y radicado en las bandejas correspondientes.
                                  </p>
                                </div>
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center space-y-1.5 align-middle">
                      <a 
                        href={inf.evidenciaUrl || "#"} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-blue-50 text-blue-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full"
                      >
                        <span>📄</span><span>Ver Informe Final</span>
                      </a>
                      {inf.actaSocializacionUrl ? (
                        <a 
                          href={inf.actaSocializacionUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full"
                        >
                          <span>🤝</span><span>Ver Acta Socialización</span>
                        </a>
                      ) : (
                        <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1.5 rounded border border-dashed text-center">
                          Sin Acta Cargada
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                          <button 
                            type="button"
                            onClick={() => { setEditInformeAuditoria(inf); setFormResetKey(Date.now()); scrollToForm(); }} 
                            className="text-orange-500 hover:text-orange-700 text-xs font-bold"
                          >
                            ✏️ Editar
                          </button>
                          <span className="text-slate-200">|</span>
                          <button 
                            type="button"
                            onClick={() => handleDeleteItem('informesAuditoria', inf.id)} 
                            className="text-slate-400 hover:text-red-600 text-xs font-bold"
                          >
                            🗑️ Eliminar
                          </button>
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
  );
}
