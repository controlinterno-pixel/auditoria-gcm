import React, { useState } from 'react';

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

  // Estados del Formulario (Basado en el PDF de Termales)
  const [entidad, setEntidad] = useState('RECREFAM S.A.S. (Termales Santa Rosa de Cabal)');
  const [vigencia, setVigencia] = useState('');
  const [proceso, setProceso] = useState('');
  const [objetivo, setObjetivo] = useState('');
  
  // Matriz de 3 Líneas de Defensa (Dinámica)
  const [matrizPruebas, setMatrizPruebas] = useState([]);
  const [estadoPrograma, setEstadoPrograma] = useState('Borrador');

  const safeProgramas = Array.isArray(programas) ? programas : [];

  // Agrupar para Kanban
  const programasBorrador = safeProgramas.filter(p => p.estado === 'Borrador');
  const programasRevision = safeProgramas.filter(p => p.estado === 'En Revisión');
  const programasAprobados = safeProgramas.filter(p => p.estado === 'Aprobado');

  const handleNuevoPrograma = () => {
    setEditPrograma(null);
    setEntidad('RECREFAM S.A.S. (Termales Santa Rosa de Cabal)');
    setVigencia('');
    setProceso('');
    setObjetivo('');
    setMatrizPruebas([{ id: Date.now(), riesgo: '', linea1: '', linea2: '', linea3: '' }]);
    setEstadoPrograma('Borrador');
    setStep(1);
    setVistaActiva('formulario');
  };

  const handleEditarPrograma = (prog) => {
    setEditPrograma(prog);
    setEntidad(prog.entidad || '');
    setVigencia(prog.vigencia || '');
    setProceso(prog.proceso || '');
    setObjetivo(prog.objetivo || '');
    setMatrizPruebas(prog.matrizPruebas || []);
    setEstadoPrograma(prog.estado || 'Borrador');
    setStep(1);
    setVistaActiva('formulario');
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

  const handleGuardarPrograma = async (e) => {
    e.preventDefault();
    const ts = new Date().toLocaleString();
    
    let updatedList;
    if (editPrograma) {
      const mod = {
        ...editPrograma,
        entidad, vigencia, proceso, objetivo, matrizPruebas, estado: estadoPrograma,
        historialCambios: [...(editPrograma.historialCambios || []), { fecha: ts, usuario: user?.email || 'Usuario', accion: `Actualizado a estado: ${estadoPrograma}` }]
      };
      updatedList = safeProgramas.map(p => p.id === editPrograma.id ? mod : p);
    } else {
      const nuevo = {
        id: Date.now(),
        entidad, vigencia, proceso, objetivo, matrizPruebas, estado: estadoPrograma,
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
        <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden max-w-5xl mx-auto">
          
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

          <form onSubmit={handleGuardarPrograma} className="p-8">
            
            {/* PASO 1: CONTEXTO GENERAL */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-8">
                <h3 className="text-sm font-black text-[#0A3B32] border-b pb-2">1. OBJETIVOS Y ALCANCE</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-bold text-slate-600">
                  <div>
                    <label className="block mb-1.5">Entidad / Empresa</label>
                    <input type="text" value={entidad} onChange={e => setEntidad(e.target.value)} required className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-[#0A3B32]" />
                  </div>
                  <div>
                    <label className="block mb-1.5">Vigencia (Ej. Segundo Semestre 2026)</label>
                    <input type="text" value={vigencia} onChange={e => setVigencia(e.target.value)} required placeholder="Periodo de auditoría..." className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32]" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-1.5">Proceso a Auditar</label>
                    <input type="text" value={proceso} onChange={e => setProceso(e.target.value)} required placeholder="Ej: Tesorería y Recaudo..." className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32]" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block mb-1.5">Objetivo General</label>
                    <textarea rows="3" value={objetivo} onChange={e => setObjetivo(e.target.value)} required placeholder="Propósito principal del programa..." className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-[#0A3B32] resize-none"></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* PASO 2: MATRIZ DE 3 LÍNEAS */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-8">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-black text-[#0A3B32]">2. MATRIZ DE AUDITORÍA (ENFOQUE TRES LÍNEAS)</h3>
                  <button type="button" onClick={agregarFilaMatriz} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">➕ Agregar Área de Riesgo</button>
                </div>
                
                <div className="space-y-4">
                  {matrizPruebas.map((fila, index) => (
                    <div key={fila.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl relative">
                      <button type="button" onClick={() => eliminarFilaMatriz(fila.id)} className="absolute -top-3 -right-2 bg-red-100 text-red-600 w-6 h-6 rounded-full flex items-center justify-center font-black hover:bg-red-200">✕</button>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium text-slate-700">
                        <div>
                          <label className="font-bold mb-1 block">⚠️ Riesgo Inherente</label>
                          <textarea rows="4" value={fila.riesgo} onChange={e => actualizarFilaMatriz(fila.id, 'riesgo', e.target.value)} placeholder="Ej: Fraude por cuadres pendientes..." className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-400 resize-none text-xs" required></textarea>
                        </div>
                        <div>
                          <label className="font-bold mb-1 block text-blue-700">🛡️ Controles 1ª Línea (Operación)</label>
                          <textarea rows="4" value={fila.linea1} onChange={e => actualizarFilaMatriz(fila.id, 'linea1', e.target.value)} placeholder="Ej: Ingreso de billetes a Cash Today al cierre..." className="w-full p-2 border border-blue-200 bg-blue-50/30 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 resize-none text-xs" required></textarea>
                        </div>
                        <div>
                          <label className="font-bold mb-1 block text-emerald-700">👁️ Controles 2ª Línea (Supervisión)</label>
                          <textarea rows="4" value={fila.linea2} onChange={e => actualizarFilaMatriz(fila.id, 'linea2', e.target.value)} placeholder="Ej: Revisión en piso por supervisor..." className="w-full p-2 border border-emerald-200 bg-emerald-50/30 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 resize-none text-xs" required></textarea>
                        </div>
                        <div>
                          <label className="font-bold mb-1 block text-purple-700">🎯 Pruebas de Auditoría (3ª Línea)</label>
                          <textarea rows="4" value={fila.linea3} onChange={e => actualizarFilaMatriz(fila.id, 'linea3', e.target.value)} placeholder="Ej: PT-REC-01 Arqueo Sorpresivo..." className="w-full p-2 border border-purple-200 bg-purple-50/30 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 resize-none text-xs" required></textarea>
                        </div>
                      </div>
                    </div>
                  ))}
                  {matrizPruebas.length === 0 && <p className="text-center text-xs text-slate-400 italic font-bold">Haz clic en "Agregar Área de Riesgo" para empezar a diseñar la matriz de controles y pruebas.</p>}
                </div>
              </div>
            )}

            {/* PASO 3: GESTIÓN DE ESTADO Y CIERRE */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-8">
                <h3 className="text-sm font-black text-[#0A3B32] border-b pb-2">3. ESTADO DE APROBACIÓN Y CIERRE</h3>
                
                <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center space-y-4">
                  <p className="text-xs text-emerald-800 font-medium">El programa contiene <strong className="font-black">{matrizPruebas.length}</strong> áreas de riesgo configuradas. Define el estado actual del programa para continuar.</p>
                  
                  <div className="inline-flex flex-col text-left max-w-sm w-full mx-auto">
                    <label className="font-black text-[10px] uppercase text-emerald-900 tracking-widest mb-1.5">Estado del Programa:</label>
                    <select value={estadoPrograma} onChange={e => setEstadoPrograma(e.target.value)} className="p-3 border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm cursor-pointer">
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
              </div>
            )}

            {/* BOTONERA INFERIOR */}
            <div className="mt-10 flex justify-between pt-4 border-t border-slate-100">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="px-6 py-2.5 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition-colors">
                  Anterior
                </button>
              ) : <div></div>}
              
              {step < 3 ? (
                <button type="button" onClick={() => setStep(step + 1)} className="px-8 py-2.5 bg-[#0A3B32] text-white font-black uppercase tracking-widest rounded-xl text-xs hover:bg-[#062620] shadow-md transition-all hover:scale-105">
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="px-8 py-2.5 bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl text-xs hover:bg-emerald-700 shadow-md transition-all hover:scale-105">
                  💾 Guardar Programa
                </button>
              )}
            </div>

          </form>
        </div>
      )}

    </div>
  );
}