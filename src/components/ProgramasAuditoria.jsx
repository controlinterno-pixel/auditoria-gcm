import React, { useState } from 'react';
// Importamos el diccionario oficial de procesos
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

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
  const [isUploading, setIsUploading] = useState(false);

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

  // Agrupar para Kanban
  const programasBorrador = safeProgramas.filter(p => p.estado === 'Borrador');
  const programasRevision = safeProgramas.filter(p => p.estado === 'En Revisión');
  const programasAprobados = safeProgramas.filter(p => p.estado === 'Aprobado');

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

  // Simulación de carga de archivo
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    // Simular un tiempo de carga (aquí reemplazarías con tu lógica real de API)
    setTimeout(() => {
      // url temporal simulada
      const fakeUrl = `https://repos.termalessantarosa.com.co/programas/${file.name.replace(/\s+/g, '_')}`;
      setArchivoAdjuntoUrl(fakeUrl);
      setIsUploading(false);
      alert("✅ Programa adjuntado correctamente.");
    }, 1500);
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

  const TarjetaKanban = ({ p }) => (
    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow relative cursor-pointer" onClick={() => handleEditarPrograma(p)}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-black uppercase text-[#0A3B32] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{p.vigencia || 'Sin Vigencia'}</span>
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); handleDeleteItem('programas', p.id); }} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
        )}
      </div>
      <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">{p.proceso || 'Sin Proceso Asignado'}</h4>
      <p className="text-[10px] text-slate-500 line-clamp-2 mb-3">{p.objetivo || 'Sin objetivo definido...'}</p>
      
      {p.archivoAdjuntoUrl && (
         <div className="mb-2">
            <span className="bg-blue-50 text-blue-700 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-blue-200 flex items-center w-fit">
              <span className="mr-1">📎</span> Adjunto
            </span>
         </div>
      )}

      <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[9px] font-bold text-slate-400">
        <span>👨‍💻 {p.creadoPor?.split('@')[0]}</span>
        <span>{p.matrizPruebas?.length || 0} Pruebas</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* CABECERA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Programas de Auditoría</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gobernanza y planeación bajo el enfoque de 3 Líneas (ISO 31000)</p>
        </div>
        <div>
          {vistaActiva === 'formulario' ? (
            <button onClick={() => setVistaActiva('kanban')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors">
              🔙 Volver al Tablero
            </button>
          ) : (
            isAdmin && (
              <button onClick={handleNuevoPrograma} className="px-5 py-2.5 bg-[#0A3B32] hover:bg-[#062620] text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center shadow-md transition-colors">
                <span className="mr-2">➕</span> Nuevo Programa
              </button>
            )
          )}
        </div>
      </div>

      {/* VISTA 1: TABLERO KANBAN */}
      {vistaActiva === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          
          {/* Columna Borrador */}
          <div className="bg-slate-100/50 rounded-2xl p-4 border border-slate-200 flex flex-col h-full min-h-[60vh]">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between">
              <span>📝 En Diseño / Borrador</span>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">{programasBorrador.length}</span>
            </h3>
            <div className="space-y-3 flex-1">
              {programasBorrador.map(p => <TarjetaKanban key={p.id} p={p} />)}
              {programasBorrador.length === 0 && <div className="text-center text-slate-400 text-xs py-8 italic font-bold">Sin programas en esta fase</div>}
            </div>
          </div>

          {/* Columna En Revisión */}
          <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-200/50 flex flex-col h-full min-h-[60vh]">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center justify-between">
              <span>⏳ En Revisión (Gerencia)</span>
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">{programasRevision.length}</span>
            </h3>
            <div className="space-y-3 flex-1">
              {programasRevision.map(p => <TarjetaKanban key={p.id} p={p} />)}
              {programasRevision.length === 0 && <div className="text-center text-amber-300 text-xs py-8 italic font-bold">Sin programas en esta fase</div>}
            </div>
          </div>

          {/* Columna Aprobados */}
          <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-200/50 flex flex-col h-full min-h-[60vh]">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center justify-between">
              <span>✅ Aprobados (Listos)</span>
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">{programasAprobados.length}</span>
            </h3>
            <div className="space-y-3 flex-1">
              {programasAprobados.map(p => <TarjetaKanban key={p.id} p={p} />)}
              {programasAprobados.length === 0 && <div className="text-center text-emerald-300 text-xs py-8 italic font-bold">Sin programas en esta fase</div>}
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