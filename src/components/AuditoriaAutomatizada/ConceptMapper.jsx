// Ruta: src/components/AuditoriaAutomatizada/ConceptMapper.jsx
import React, { useState } from 'react';
import { auditarAuxilioTransporte } from '../../utils/motorAuditoria';

const ConceptMapper = () => {
  const [datosExcel, setDatosExcel] = useState(null);
  const [mapping, setMapping] = useState({
    salario_base: ['SUELDO BASICO', 'SUELDO RETROACTIVO', 'SUELDO POR LICENCIA REMUNERADA'],
    aux_transporte: ['SUBSIDIO DE TRANSPORTE']
  });
  const [fileName, setFileName] = useState("");
  const [hallazgos, setHallazgos] = useState(null);
  const [resumenKpi, setResumenKpi] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  const systemCategories = [
    { id: 'salario_base', label: 'Salario Básico / Sueldo', required: true },
    { id: 'aux_transporte', label: 'Auxilio de Transporte', required: true }
  ];

  const excelConcepts = datosExcel 
    ? [...new Set(datosExcel.map(fila => (fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || '').toString().trim()))].filter(Boolean)
    : [];

  const handleFileUpload = (e) => {
    if (!window.XLSX) {
      alert("La librería de Excel aún no ha cargado. Intenta de nuevo.");
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, { raw: true });

        setDatosExcel(jsonData);

        // Auto-mapeo quincenal automático de conceptos
        const conceptosExtraidos = [...new Set(jsonData.map(f => (f.NombreConcepto || f['Nombre Concepto'] || f.Concepto || '').toString().trim()))].filter(Boolean);
        
        const autoSalario = conceptosExtraidos.filter(c => {
          const upper = c.toUpperCase();
          return upper === 'SUELDO BASICO' || upper === 'SUELDO RETROACTIVO' || upper === 'SUELDO POR LICENCIA REMUNERADA';
        });
        
        const autoAuxilio = conceptosExtraidos.filter(c => {
          return c.toUpperCase() === 'SUBSIDIO DE TRANSPORTE';
        });

        setMapping({
          salario_base: autoSalario.length > 0 ? autoSalario : ['SUELDO BASICO', 'SUELDO RETROACTIVO', 'SUELDO POR LICENCIA REMUNERADA'],
          aux_transporte: autoAuxilio.length > 0 ? autoAuxilio : ['SUBSIDIO DE TRANSPORTE']
        });

        setHallazgos(null);
        setResumenKpi(null);
      } catch (error) {
        console.error("Error leyendo el Excel:", error);
        alert("Error al leer el archivo Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const toggleConcept = (categoryId, conceptName) => {
    setMapping((prev) => {
      const current = prev[categoryId] || [];
      return {
        ...prev,
        [categoryId]: current.includes(conceptName)
          ? current.filter(c => c !== conceptName)
          : [...current, conceptName]
      };
    });
  };

  const handleStartAudit = () => {
    if (!datosExcel || datosExcel.length === 0) return;

    // Garantiza que si el mapeo viene vacío se apliquen los conceptos por defecto
    const mappingAjustado = {
      salario_base: (mapping.salario_base && mapping.salario_base.length > 0) 
        ? mapping.salario_base 
        : ['SUELDO BASICO', 'SUELDO RETROACTIVO', 'SUELDO POR LICENCIA REMUNERADA'],
      aux_transporte: (mapping.aux_transporte && mapping.aux_transporte.length > 0) 
        ? mapping.aux_transporte 
        : ['SUBSIDIO DE TRANSPORTE']
    };
    
    const resultadoEngine = auditarAuxilioTransporte(datosExcel, mappingAjustado, { 
      smlmv: 1300000, 
      auxTransporte: 162000 
    });
    
    setHallazgos(resultadoEngine.hallazgos);
    setResumenKpi(resultadoEngine.kpis);
  };

  const hallazgosFiltrados = hallazgos ? hallazgos.filter(h => {
    if (filtroTipo === 'PAGO_EXCESO') return h.tipoHallazgo === 'PAGO_EXCESO';
    if (filtroTipo === 'PAGO_INSUFICIENTE') return h.tipoHallazgo === 'PAGO_INSUFICIENTE';
    return true;
  }) : [];

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">🤖 Motor de Auditoría Quincenal GCM</h1>
        <p className="text-slate-500 mt-2">Termales Santa Rosa de Cabal — Sistema de Control Interno</p>
      </div>

      {/* STEP 1: CARGA */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
        <h3 className="text-lg font-medium text-slate-700 mb-4">📥 1. Cargar Nómina Quincenal</h3>
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <span className="text-2xl mb-1">📁</span>
          <p className="text-sm font-semibold text-slate-600">Subir archivo Excel (.xlsx)</p>
          <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </label>
        {fileName && (
          <p className="mt-3 text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            ✅ Archivo: {fileName} ({datosExcel?.length} transacciones)
          </p>
        )}
      </div>

      {/* STEP 2: MAPEO */}
      <div className={`bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8 ${!datosExcel ? 'opacity-50 pointer-events-none' : ''}`}>
        <h3 className="text-lg font-medium text-slate-700 mb-4">🔗 2. Mapeo de Conceptos</h3>
        {systemCategories.map((category) => (
          <div key={category.id} className="mb-4">
            <h4 className="text-sm font-bold text-slate-700 mb-2">{category.label}</h4>
            <div className="flex flex-wrap gap-2">
              {excelConcepts.map((concept) => {
                const isSelected = (mapping[category.id] || []).includes(concept);
                return (
                  <button
                    key={concept}
                    onClick={() => toggleConcept(category.id, concept)}
                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                      isSelected ? 'bg-blue-900 text-white border-blue-900 font-bold' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && '✓ '} {concept}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button 
          onClick={handleStartAudit}
          className="mt-4 px-6 py-2.5 bg-blue-900 text-white font-bold rounded-lg shadow hover:bg-blue-800 transition-colors"
        >
          ⚡ Ejecutar Auditoría Quincenal
        </button>
      </div>

      {/* KPIS */}
      {resumenKpi && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
            <p className="text-xs font-bold text-red-600 uppercase">Riesgo Financiero Expuesto</p>
            <h3 className="text-3xl font-extrabold text-red-700">
              ${resumenKpi.riesgoFinancieroTotal.toLocaleString('es-CO')} <span className="text-xs text-red-500 font-normal">COP</span>
            </h3>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Registros Quincenales Auditados</p>
            <h3 className="text-3xl font-extrabold text-slate-800">{resumenKpi.totalEmpleados}</h3>
          </div>
          <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm">
            <p className="text-xs font-bold text-amber-600 uppercase">Anomalías Detectadas</p>
            <h3 className="text-3xl font-extrabold text-amber-700">{resumenKpi.totalHallazgos}</h3>
          </div>
        </div>
      )}

      {/* TABLA CON COLUMNA DE PERÍODO */}
      {hallazgos && (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 px-6 py-3 flex justify-between items-center text-white">
            <h3 className="font-bold text-sm">🚨 Resultados Quincenales ({hallazgosFiltrados.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => setFiltroTipo('TODOS')} className={`px-2.5 py-1 text-xs rounded ${filtroTipo === 'TODOS' ? 'bg-blue-600 font-bold' : 'bg-slate-700'}`}>Todos</button>
              <button onClick={() => setFiltroTipo('PAGO_EXCESO')} className={`px-2.5 py-1 text-xs rounded ${filtroTipo === 'PAGO_EXCESO' ? 'bg-amber-600 font-bold' : 'bg-slate-700'}`}>Excesos</button>
              <button onClick={() => setFiltroTipo('PAGO_INSUFICIENTE')} className={`px-2.5 py-1 text-xs rounded ${filtroTipo === 'PAGO_INSUFICIENTE' ? 'bg-red-600 font-bold' : 'bg-slate-700'}`}>Bajo Pago (UGPP)</button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3 text-center">Período</th>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3 text-center">Días</th>
                  <th className="px-4 py-3 text-right">Sueldo Quincenal</th>
                  <th className="px-4 py-3 text-right">Aux. Legal</th>
                  <th className="px-4 py-3 text-right">Aux. Pagado</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                  <th className="px-4 py-3 text-center">Clasificación</th>
                </tr>
              </thead>
              <tbody>
                {hallazgosFiltrados.map((h) => (
                  <tr key={h.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{h.cedula}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-800 bg-blue-50/50">{h.periodo}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{h.nombre}</td>
                    <td className="px-4 py-3 text-center">{h.diasTrabajados}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">${h.salarioBase.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">${h.auxilioDeberSer.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">${h.auxilioPagado.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">${h.diferenciaAbsoluta.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-center">
                      {h.tipoHallazgo === 'PAGO_INSUFICIENTE' ? (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold bg-red-100 text-red-800 rounded-full border border-red-200">
                          🚨 BAJO PAGO (UGPP)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                          ⚠️ PAGO EN EXCESO
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptMapper;