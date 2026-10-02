import { useEffect, useState } from 'react';
import { CARGOS_EMPRESA, MAPA_PROCESOS } from '../constants/diccionariosGRC';

const NORMAS_PREDETERMINADAS = ['ISO 9001', 'ISO 14001', 'ISO 45001'];

export default function ModalNuevaFuente({
  isOpen,
  onClose,
  onSave,
  codigoInicial = 'FA-001',
  normasDisponibles = NORMAS_PREDETERMINADAS,
  onAddNorma,
}) {
  const [step, setStep] = useState(1);
  const [nuevaNorma, setNuevaNorma] = useState('');
  const [formData, setFormData] = useState({
    tipoFuente: 'Auditoría Interna',
    codigo: codigoInicial,
    norma: normasDisponibles[0] || NORMAS_PREDETERMINADAS[0],
    fecha: '2026-03-12',
    responsable: CARGOS_EMPRESA[0],
    estado: 'Borrador',
    descripcion: '',
    alcance: '',
    macroproceso: '',
    subproceso: '',
    proceso: '',
    origen: 'interno',
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setNuevaNorma('');
      setFormData((prev) => ({
        ...prev,
        codigo: codigoInicial,
        macroproceso: '',
        subproceso: '',
        proceso: '',
      }));
    }
  }, [codigoInicial, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNormaChange = (e) => {
    setFormData((prev) => ({ ...prev, norma: e.target.value }));
  };

  const handleMacroprocesoChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      macroproceso: e.target.value,
      subproceso: '',
      proceso: '',
    }));
  };

  const handleSubprocesoChange = (e) => {
    const subproceso = e.target.value;
    setFormData((prev) => ({
      ...prev,
      subproceso,
      proceso: subproceso ? `${prev.macroproceso} / ${subproceso}` : '',
    }));
  };

  const handleAddNorma = () => {
    const norma = nuevaNorma.trim();
    if (!norma) return;

    onAddNorma?.(norma);
    setFormData((prev) => ({ ...prev, norma }));
    setNuevaNorma('');
  };

  const handleNext = () => setStep((prev) => Math.min(prev + 1, 3));
  const handlePrev = () => setStep((prev) => Math.max(prev - 1, 1));
  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  const steps = [
    { id: 1, label: 'Identificación' },
    { id: 2, label: 'Detalle de la fuente' },
    { id: 3, label: 'Responsables y alcance' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* CABECERA */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Nueva Fuente de Mejora</h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Registra un nuevo origen para la gestión de mejora continua.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* STEPPER */}
        <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between max-w-3xl mx-auto relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 z-0"></div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 z-0 transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
            
            {steps.map((s) => (
              <div key={s.id} className="relative z-10 flex items-center gap-3 bg-slate-50/50 px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${step >= s.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                  {step > s.id ? '✓' : s.id}
                </div>
                <span className={`text-[11px] font-bold ${step >= s.id ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CUERPO DEL MODAL */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* COLUMNA IZQUIERDA: FORMULARIO */}
          <div className="w-2/3 p-8 overflow-y-auto custom-scrollbar">
            
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="text-[11px] font-black text-blue-900 uppercase tracking-wider block mb-2">Tipo de Fuente *</label>
                    <select name="tipoFuente" value={formData.tipoFuente} onChange={handleInputChange} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm">
                      <option value="Auditoría Interna">🎯 Auditoría Interna</option>
                      <option value="Auditoría Externa">🏢 Auditoría Externa</option>
                      <option value="PQR">💬 PQR</option>
                      <option value="Indicador de Gestión">📈 Indicador de Gestión</option>
                      <option value="Incidente">⚠️ Incidente</option>
                      <option value="Riesgo">🛡️ Riesgo</option>
                      <option value="Otra Fuente">🔗 Otra Fuente</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Código / Referencia</label>
                    <input name="codigo" type="text" value={formData.codigo} readOnly className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 bg-slate-50 outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Norma / Referencia *</label>
                    <select name="norma" value={formData.norma} onChange={handleNormaChange} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm">
                      {normasDisponibles.map((norma) => (
                        <option key={norma} value={norma}>{norma}</option>
                      ))}
                      <option value="__nueva__">Otra / Crear nueva norma</option>
                    </select>
                    {formData.norma === '__nueva__' && (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={nuevaNorma}
                          onChange={(e) => setNuevaNorma(e.target.value)}
                          placeholder="Ej. ISO 31000"
                          className="min-w-0 flex-1 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm"
                        />
                        <button type="button" onClick={handleAddNorma} className="px-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700">
                          Agregar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Fecha de Registro *</label>
                    <input name="fecha" type="date" value={formData.fecha} onChange={handleInputChange} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Responsable / Cargo *</label>
                    <select name="responsable" value={formData.responsable} onChange={handleInputChange} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm">
                      {CARGOS_EMPRESA.map((cargo) => (
                        <option key={cargo} value={cargo}>{cargo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Estado *</label>
                    <select name="estado" value={formData.estado} onChange={handleInputChange} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm">
                      <option value="Borrador">🟠 Borrador</option>
                      <option value="Activa">🟢 Activa</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Descripción de la Fuente *</label>
                    <textarea name="descripcion" rows="4" value={formData.descripcion} onChange={handleInputChange} placeholder="Describa de manera clara y precisa el origen de la fuente de mejora..." className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm resize-none"></textarea>
                    <div className="text-right text-[10px] font-bold text-slate-400 mt-1">{formData.descripcion.length}/2000</div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Objetivo / Alcance</label>
                    <textarea name="alcance" rows="3" value={formData.alcance} onChange={handleInputChange} placeholder="Indique el objetivo de la fuente y el alcance (procesos, áreas, sedes, etc.)." className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 shadow-sm resize-none"></textarea>
                    <div className="text-right text-[10px] font-bold text-slate-400 mt-1">{formData.alcance.length}/1000</div>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Macroproceso *</label>
                    <select name="macroproceso" value={formData.macroproceso} onChange={handleMacroprocesoChange} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm">
                      <option value="">⚙️ Seleccione un macroproceso</option>
                      {Object.keys(MAPA_PROCESOS).map((macroproceso) => (
                        <option key={macroproceso} value={macroproceso}>{macroproceso}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Subproceso *</label>
                    <select name="subproceso" value={formData.subproceso} onChange={handleSubprocesoChange} disabled={!formData.macroproceso} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 shadow-sm disabled:bg-slate-100 disabled:text-slate-400">
                      <option value="">⚙️ Seleccione un subproceso</option>
                      {(MAPA_PROCESOS[formData.macroproceso] || []).map((subproceso) => (
                        <option key={subproceso} value={subproceso}>{subproceso}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider block mb-2">Origen *</label>
                    <div className="flex items-center gap-4 h-[46px] px-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="origen" value="interno" checked={formData.origen === 'interno'} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-700">Módulo interno</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="origen" value="externo" checked={formData.origen === 'externo'} onChange={handleInputChange} className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500" />
                        <span className="text-xs font-bold text-slate-700">Fuente externa</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: VISTA PREVIA LATERAL */}
          <div className="w-1/3 bg-slate-50 border-l border-slate-100 p-6 flex flex-col">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
              <span className="text-blue-500 text-lg">👁️</span> Vista previa
            </h3>
            
            <div className="space-y-5 flex-1">
              <div className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5">🎫</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Código</p>
                  <p className="text-sm font-bold text-slate-800">{formData.codigo || '---'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5">📑</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo de Fuente</p>
                  <p className="text-sm font-bold text-slate-800">{formData.tipoFuente || '---'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5">⚖️</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Norma / Referencia</p>
                  <p className="text-sm font-bold text-slate-800">{formData.norma || '---'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5">📅</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fecha de Registro</p>
                  <p className="text-sm font-bold text-slate-800">{formData.fecha || '---'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5">👤</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Responsable</p>
                  <p className="text-sm font-bold text-slate-800">{formData.responsable || '---'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-slate-400 mt-0.5">🏷️</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado</p>
                  <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded mt-1">
                    {formData.estado}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 mt-4">
              <span className="text-blue-500">ℹ️</span>
              <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                Esta fuente podrá generar hallazgos y posteriormente un Plan de Mejoramiento en el sistema.
              </p>
            </div>
          </div>
        </div>

        {/* PIE DEL MODAL (FOOTER) */}
        <div className="bg-white border-t border-slate-100 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Campos obligatorios: 6
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            {step > 1 && (
              <button onClick={handlePrev} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Anterior
              </button>
            )}
            {step < 3 ? (
              <button onClick={handleNext} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/30">
                Siguiente
              </button>
            ) : (
              <button onClick={handleSubmit} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/30 flex items-center gap-2">
                <span>Crear Fuente</span> <span className="text-lg leading-none">🚀</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}