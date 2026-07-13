import React, { useState } from 'react';

// 📚 LISTA MAESTRA UNIFICADA DE PROCESOS (IDÉNTICA A PLANES Y HALLAZGOS)
const PROCESOS_OFICIALES = [
  "Alimentos y Bebidas (AYB)", "Canales Alternos", "Compensaciones", "Compras", "Control Inventarios",
  "Cumplimiento Normativo", "Financiera", "Formación y Desarrollo", "Gestión Ambiental",
  "Gestión Clientes", "Gestión Contable", "Gestión de Crédito y Cartera", "Gestión de tecnologías de la información",
  "Gestión de Tesoreria", "Mantenimiento de Infraestructura", "Mercadeo", "Operaciones Alojamiento y recreación.",
  "Proyectos", "Seguridad y Salud en el Trabajo", "Selección y Vinculación", "Proceso General"
];

export default function Riesgos({ isAdmin, safeRiesgos, setRiesgos, saveToCloud, showNotification }) {
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editRiesgo, setEditRiesgo] = useState(null);
  const [riesgoId, setRiesgoId] = useState('');
  const [proceso, setProceso] = useState(PROCESOS_OFICIALES[0]);
  const [categoria, setCategoria] = useState('');
  const [normativa, setNormativa] = useState('');
  const [responsable, setResponsable] = useState('');
  
  // 🧠 ESTADOS PARA LA NUEVA SINTAXIS DEL RIESGO Y CÁLCULO
  const [afectacion, setAfectacion] = useState('Económico');
  const [causaInmediata, setCausaInmediata] = useState('');
  const [causaRaiz, setCausaRaiz] = useState('');
  const [probInherente, setProbInherente] = useState(60);
  const [impInherente, setImpInherente] = useState(60);
  const [controles, setControles] = useState([]); // Ahora es un Array dinámico

  // 🧮 MOTOR MATEMÁTICO EN TIEMPO REAL
  const calcularRiesgoResidual = () => {
    let curr_p = probInherente / 100;
    let curr_i = impInherente / 100;

    controles.forEach(c => {
      let weight = 0;
      if (c.tipo === 'Preventivo') weight += 0.25;
      else if (c.tipo === 'Detectivo') weight += 0.15;
      else if (c.tipo === 'Correctivo') weight += 0.10;

      if (c.implementacion === 'Automático' || c.implementacion === 'Automatico') weight += 0.25;
      else if (c.implementacion === 'Manual') weight += 0.15;

      if (c.tipo === 'Preventivo' || c.tipo === 'Detectivo') {
        curr_p = curr_p - (curr_p * weight);
      } else {
        curr_i = curr_i - (curr_i * weight);
      }
    });

    return {
      probabilidad: Math.max(Math.round(curr_p * 100), 0),
      impacto: Math.max(Math.round(curr_i * 100), 0)
    };
  };

  const residuales = calcularRiesgoResidual();
  const descripcionAutomatica = `Posibilidad de afectación ${afectacion.toLowerCase()} por ${causaInmediata.toLowerCase()} debido a ${causaRaiz.toLowerCase()}`;

  const getSeverityZone = (prob, imp) => {
    const p = Number(prob);
    const i = Number(imp);
    if (p >= 80 && i >= 80) return { label: 'Extremo', color: 'bg-red-600 text-white' };
    if ((p >= 60 && i >= 80) || (p >= 80 && i >= 60)) return { label: 'Alto', color: 'bg-orange-500 text-white' };
    if ((p >= 40 && i >= 60) || (p >= 60 && i >= 40) || (p >= 40 && i >= 40)) return { label: 'Moderado', color: 'bg-amber-400 text-slate-900' };
    return { label: 'Bajo', color: 'bg-emerald-500 text-white' };
  };

  const handleEditRiesgo = (riesgo) => {
    setEditRiesgo(riesgo);
    setRiesgoId(riesgo.id);
    setProceso(riesgo.proceso);
    setCategoria(riesgo.categoria);
    setNormativa(riesgo.normativa);
    setResponsable(riesgo.responsable);
    
    // Configuración para el autogenerador de texto
    setAfectacion('Económico'); 
    setCausaInmediata(riesgo.descripcion || '');
    setCausaRaiz('');
    
    setProbInherente(riesgo.probabilidadInherente || 60);
    setImpInherente(riesgo.impactoInherente || 60);
    
    // Carga los controles detallados estructurados o array vacío
    setControles(riesgo.controlesDetallados || []);
    setVistaActiva('nuevo');
  };

  const handleDeleteRiesgo = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar este riesgo permanentemente?")) {
      try {
        const updated = safeRiesgos.filter(r => r.id !== id);
        setRiesgos(updated);
        await saveToCloud({ riesgos: updated });
        showNotification("Riesgo eliminado correctamente.", "success");
      } catch (error) {
        showNotification("Error al eliminar el riesgo.", "error");
      }
    }
  };

  const handleRiesgoSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const ts = new Date().toLocaleString();

    try {
      let updatedList = [...safeRiesgos];
      
      // Consolidar controles para la vista clásica
      const textoControlesConsolidados = controles.map(c => `🔹 [${c.tipo}] ${c.descripcion}`).join('\n');

      const nuevoRiesgo = {
        id: editRiesgo ? editRiesgo.id : crypto.randomUUID(),
        sede: 'Hotel',
        proceso,
        categoria,
        normativa,
        responsable,
        descripcion: descripcionAutomatica, // 👈 SINTAXIS OBLIGATORIA ISO
        probabilidadInherente: probInherente,
        impactoInherente: impInherente,
        probabilidadResidual: residuales.probabilidad, // 👈 CÁLCULO MATEMÁTICO REAL
        impactoResidual: residuales.impacto, // 👈 CÁLCULO MATEMÁTICO REAL
        descripcionControl: textoControlesConsolidados,
        controlesDetallados: controles, // 👈 ARRAY PARA EDICIONES FUTURAS
        anio: new Date().getFullYear(),
        mes: "Junio",
        historialCambios: editRiesgo 
          ? [...(editRiesgo.historialCambios || []), { fecha: ts, accion: 'Modificación de Riesgo y/o Controles (Cálculo ISO)' }]
          : [{ fecha: ts, accion: 'Creación Inicial Manual' }]
      };

      if (editRiesgo) {
        const idx = updatedList.findIndex(r => r.id === editRiesgo.id);
        if (idx !== -1) updatedList[idx] = nuevoRiesgo;
      } else {
        updatedList.push(nuevoRiesgo);
      }

      setRiesgos(updatedList);
      await saveToCloud({ riesgos: updatedList });

      showNotification(`Riesgo ${editRiesgo ? 'actualizado' : 'creado'} correctamente con valoración ISO.`, "success");
      setVistaActiva('dashboard');
      setEditRiesgo(null);
      
      // Limpiar Formulario
      setProceso(PROCESOS_OFICIALES[0]); setCategoria(''); setNormativa(''); setResponsable('');
      setAfectacion('Económico'); setCausaInmediata(''); setCausaRaiz('');
      setProbInherente(60); setImpInherente(60); setControles([]);

    } catch (error) {
      console.error(error);
      showNotification("Error al guardar el riesgo.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDashboard = () => {
    const totalRiesgos = safeRiesgos.length;
    const extremos = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Extremo').length;
    const altos = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Alto').length;
    const moderados = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Moderado').length;
    const bajos = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Bajo').length;

    // Distribución por procesos
    const conteoProcesos = safeRiesgos.reduce((acc, r) => {
      acc[r.proceso] = (acc[r.proceso] || 0) + 1;
      return acc;
    }, {});
    const topProcesos = Object.entries(conteoProcesos).sort((a,b) => b[1] - a[1]).slice(0, 5);

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        {/* Tarjetas KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Riesgos</p>
            <p className="text-3xl font-black text-slate-800">{totalRiesgos}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-2xl shadow-sm border border-red-200">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Extremos</p>
            <p className="text-3xl font-black text-red-700">{extremos}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl shadow-sm border border-orange-200">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Altos</p>
            <p className="text-3xl font-black text-orange-700">{altos}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl shadow-sm border border-amber-200">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Moderados</p>
            <p className="text-3xl font-black text-amber-700">{moderados}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl shadow-sm border border-emerald-200">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Bajos</p>
            <p className="text-3xl font-black text-emerald-700">{bajos}</p>
          </div>
        </div>

        {/* Top Procesos con más riesgos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 border-b pb-2">Procesos con mayor exposición</h3>
          <div className="space-y-3">
            {topProcesos.map(([proc, count], idx) => (
              <div key={idx} className="flex items-center text-xs">
                <span className="w-1/3 truncate text-slate-600 font-bold pr-2">{proc}</span>
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#0A3B32] h-full rounded-full" style={{width: `${(count/totalRiesgos)*100}%`}}></div>
                </div>
                <span className="w-12 text-right font-black text-slate-800">{count}</span>
              </div>
            ))}
            {topProcesos.length === 0 && <p className="text-xs text-slate-400 italic">No hay riesgos mapeados aún.</p>}
          </div>
        </div>
      </div>
    );
  };

  const renderMatriz = () => {
    return (
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Matriz de Riesgos Corporativa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
              <tr>
                <th className="p-3 whitespace-nowrap">ID Riesgo</th>
                <th className="p-3">Proceso</th>
                <th className="p-3 w-64">Descripción / Evento</th>
                <th className="p-3 text-center">Zona Inherente</th>
                <th className="p-3 text-center">Zona Residual</th>
                <th className="p-3">Controles Asociados</th>
                <th className="p-3 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {safeRiesgos.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400 font-bold italic">No hay riesgos registrados en la matriz.</td></tr>
              ) : (
                safeRiesgos.map((r, index) => {
                  const zoneInh = getSeverityZone(r.probabilidadInherente, r.impactoInherente);
                  const zoneRes = getSeverityZone(r.probabilidadResidual, r.impactoResidual);
                  return (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-black text-slate-900">RSK-{String(r.id).substring(0,4)}</td>
                      <td className="p-3 font-bold text-[#0A3B32]">{r.proceso}</td>
                      <td className="p-3 text-[10px] leading-tight">{r.descripcion}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded font-black text-[9px] uppercase ${zoneInh.color}`}>{zoneInh.label}</span>
                        <div className="text-[8px] text-slate-400 mt-1 font-bold">P:{r.probabilidadInherente}% | I:{r.impactoInherente}%</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded font-black text-[9px] uppercase shadow-sm ${zoneRes.color}`}>{zoneRes.label}</span>
                        <div className="text-[8px] text-slate-400 mt-1 font-bold">P:{r.probabilidadResidual}% | I:{r.impactoResidual}%</div>
                      </td>
                      <td className="p-3 text-[9px] whitespace-pre-wrap leading-tight text-slate-500">{r.descripcionControl || 'Sin controles asignados'}</td>
                      <td className="p-3 text-center flex flex-col space-y-1">
                        <button onClick={() => handleEditRiesgo(r)} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">Editar</button>
                        {isAdmin && <button onClick={() => handleDeleteRiesgo(r.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">Eliminar</button>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* CABECERA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-40">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Matriz de Riesgos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión corporativa de riesgos y controles (ISO 31000)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setVistaActiva('dashboard')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'dashboard' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📊 Dashboard</button>
          <button onClick={() => setVistaActiva('matriz')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'matriz' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📋 Ver Matriz</button>
          {isAdmin && (
            <button onClick={() => { setEditRiesgo(null); setVistaActiva('nuevo'); }} className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-md bg-[#0A3B32] text-white hover:bg-[#062620]">
              <span className="mr-2">➕</span> Nuevo Riesgo
            </button>
          )}
        </div>
      </div>

      {vistaActiva === 'dashboard' && renderDashboard()}
      {vistaActiva === 'matriz' && renderMatriz()}

      {vistaActiva === 'nuevo' && (
        <form onSubmit={handleRiesgoSubmit} className="space-y-6">
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">1. Datos Generales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Proceso</label>
                <select value={proceso} onChange={(e) => setProceso(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  {PROCESOS_OFICIALES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Categoría</label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" required>
                  <option value="">Seleccione...</option>
                  <option value="Estratégico">Estratégico</option>
                  <option value="Operativo">Operativo</option>
                  <option value="Cumplimiento">Cumplimiento</option>
                  <option value="Financiero">Financiero</option>
                  <option value="Tecnológico">Tecnológico</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Normativa Aplicable</label>
                <input type="text" value={normativa} onChange={(e) => setNormativa(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" placeholder="Ej. ISO 31000..." />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Líder Responsable</label>
                <input type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" placeholder="Cargo o Nombre..." required/>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: REDACCIÓN SINTÁCTICA DEL RIESGO */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">2. Estructura del Riesgo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo de Afectación</label>
                <select value={afectacion} onChange={e => setAfectacion(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value="Económico">Económico</option>
                  <option value="Reputacional">Reputacional</option>
                  <option value="Económico-Reputacional">Económico-Reputacional</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Causa Inmediata (¿Qué pasa?)</label>
                <input type="text" value={causaInmediata} onChange={e => setCausaInmediata(e.target.value)} placeholder="Ej: fallas en la plataforma..." className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Causa Raíz (¿Por qué pasa?)</label>
                <input type="text" value={causaRaiz} onChange={e => setCausaRaiz(e.target.value)} placeholder="Ej: falta de mantenimiento preventivo..." className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" required />
              </div>
            </div>
            <div className="bg-[#f0fdf4] border border-emerald-200 p-3 rounded-lg">
              <label className="text-[9px] font-black text-emerald-800 uppercase block mb-1">Descripción Final del Riesgo (Autogenerada)</label>
              <p className="text-xs font-medium text-emerald-900">{descripcionAutomatica}</p>
            </div>
          </div>

          {/* BLOQUE 3: VALORACIÓN INHERENTE */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">3. Valoración Inherente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Probabilidad Inherente</label>
                <select value={probInherente} onChange={e => setProbInherente(Number(e.target.value))} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value={20}>Muy Baja (20%) - Máximo 2 veces/año</option>
                  <option value={40}>Baja (40%) - 3 a 24 veces/año</option>
                  <option value={60}>Media (60%) - 24 a 500 veces/año</option>
                  <option value={80}>Alta (80%) - 500 a 5000 veces/año</option>
                  <option value={100}>Muy Alta (100%) - Más de 5000 veces/año</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Impacto Inherente</label>
                <select value={impInherente} onChange={e => setImpInherente(Number(e.target.value))} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value={20}>Leve (20%) - Menor a 10 SMLMV</option>
                  <option value={40}>Menor (40%) - 10 a 50 SMLMV</option>
                  <option value={60}>Moderado (60%) - 50 a 100 SMLMV</option>
                  <option value={80}>Mayor (80%) - 100 a 500 SMLMV</option>
                  <option value={100}>Catastrófico (100%) - Mayor a 500 SMLMV</option>
                </select>
              </div>
            </div>
          </div>

          {/* BLOQUE 4: CONTROLES DINÁMICOS */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">4. Controles Asociados</h3>
              <button type="button" onClick={() => setControles([...controles, { descripcion: '', tipo: 'Preventivo', implementacion: 'Manual' }])} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-200 transition-colors">➕ Agregar Control</button>
            </div>
            {controles.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">No hay controles agregados. El riesgo residual será igual al inherente.</p>}
            {controles.map((ctrl, idx) => (
              <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end relative">
                <div className="md:col-span-6">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Descripción del Control</label>
                  <input type="text" value={ctrl.descripcion} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].descripcion = e.target.value; setControles(nuevos); }} className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-[#0A3B32]" placeholder="Ej: Revisión quincenal..." required />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Tipo de Control</label>
                  <select value={ctrl.tipo} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].tipo = e.target.value; setControles(nuevos); }} className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                    <option value="Preventivo">Preventivo (25%)</option>
                    <option value="Detectivo">Detectivo (15%)</option>
                    <option value="Correctivo">Correctivo (10%)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Implementación</label>
                  <select value={ctrl.implementacion} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].implementacion = e.target.value; setControles(nuevos); }} className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                    <option value="Automático">Automático (25%)</option>
                    <option value="Manual">Manual (15%)</option>
                  </select>
                </div>
                <div className="md:col-span-1 flex justify-center">
                  <button type="button" onClick={() => { const nuevos = controles.filter((_, i) => i !== idx); setControles(nuevos); }} className="text-red-500 hover:text-red-700 text-lg" title="Eliminar control">🗑️</button>
                </div>
              </div>
            ))}
          </div>

          {/* BLOQUE 5: VALORACIÓN RESIDUAL (MATEMÁTICA EN VIVO) */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-slate-700 pb-2">5. Riesgo Residual (Cálculo Automático ISO)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Probabilidad Residual</label>
                <input type="text" value={`${residuales.probabilidad}%`} disabled className="w-full text-xs p-2 border border-slate-600 rounded-lg bg-slate-800 text-emerald-400 font-black text-center cursor-not-allowed" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Impacto Residual</label>
                <input type="text" value={`${residuales.impacto}%`} disabled className="w-full text-xs p-2 border border-slate-600 rounded-lg bg-slate-800 text-emerald-400 font-black text-center cursor-not-allowed" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setVistaActiva('dashboard')} className="mr-3 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-md disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : (editRiesgo ? 'Actualizar Riesgo' : 'Crear Riesgo ISO')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}