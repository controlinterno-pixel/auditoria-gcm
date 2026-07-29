// Ruta: src/components/AuditoriaAutomatizada/ConceptMapper.jsx
import React, { useState } from 'react';
import { auditarAuxilioTransporte } from '../../utils/motorAuditoria';

const ConceptMapper = () => {
  const [datosExcel, setDatosExcel] = useState(null);
  const [mapping, setMapping] = useState({});
  const [fileName, setFileName] = useState("");
  const [hallazgos, setHallazgos] = useState(null);
  const [resumenKpi, setResumenKpi] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  const systemCategories = [
    { id: 'salario_base', label: 'Salario Básico / Sueldo', required: true },
    { id: 'aux_transporte', label: 'Auxilio de Transporte', required: true }
  ];

  const excelConcepts = datosExcel 
    ? [...new Set(datosExcel.map(fila => fila.NombreConcepto))].filter(Boolean)
    : [];

  // Ruta: src/components/AuditoriaAutomatizada/ConceptMapper.jsx

const handleFileUpload = (e) => {
  if (!window.XLSX) {
    alert("La librería de Excel aún no ha cargado. Intenta de nuevo en unos segundos.");
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
      
      console.log("📊 Datos extraídos del Excel:", jsonData.slice(0, 5));
      setDatosExcel(jsonData);

     // 🤖 AUTO-MAPEO DE CONCEPTOS
      const conceptosExtraidos = [...new Set(jsonData.map(f => (f.NombreConcepto || '').toString().trim()))].filter(Boolean);
      
      const autoSalario = conceptosExtraidos.filter(c => 
        c.toUpperCase() === 'SUELDO BASICO' || 
        c.toUpperCase() === 'SUELDO RETROACTIVO' ||
        c.toUpperCase() === 'SUELDO POR LICENCIA REMUNERADA'
      );
      
      const autoAuxilio = conceptosExtraidos.filter(c => 
        c.toUpperCase() === 'SUBSIDIO DE TRANSPORTE'
      );

      setMapping({
        salario_base: autoSalario,
        aux_transporte: autoAuxilio
      });

      setHallazgos(null);
      setResumenKpi(null);

    } catch (error) {
      console.error("Error leyendo el Excel:", error);
      alert("Hubo un error al leer el archivo Excel (.xlsx).");
    }
  };
  reader.readAsArrayBuffer(file);
};
  const toggleConcept = (categoryId, conceptName) => {
    setMapping((prev) => {
      const currentConcepts = prev[categoryId] || [];
      const hasConcept = currentConcepts.includes(conceptName);
      
      if (hasConcept) {
        return { ...prev, [categoryId]: currentConcepts.filter(c => c !== conceptName) };
      } else {
        return { ...prev, [categoryId]: [...currentConcepts, conceptName] };
      }
    });
  };

  const handleStartAudit = () => {
    if (!datosExcel || datosExcel.length === 0) {
      alert("⚠️ Falta cargar los datos del Excel.");
      return;
    }
    
    if (!mapping.salario_base?.length || !mapping.aux_transporte?.length) {
      alert("⚠️ Debes seleccionar al menos un concepto para Salario Base y otro para Auxilio de Transporte.");
      return;
    }
    
    console.log("🚀 Ejecutando Motor de Auditoría GCM...");
    
    const resultadoEngine = auditarAuxilioTransporte(datosExcel, mapping, { 
      smlmv: 1300000, 
      auxTransporte: 162000 
    });
    
    setHallazgos(resultadoEngine.hallazgos);
    setResumenKpi(resultadoEngine.kpis);
  };

  // Filtrado de hallazgos en UI
  const hallazgosFiltrados = hallazgos ? hallazgos.filter(h => {
    if (filtroTipo === 'PAGO_EXCESO') return h.tipoHallazgo === 'PAGO_EXCESO';
    if (filtroTipo === 'PAGO_INSUFICIENTE') return h.tipoHallazgo === 'PAGO_INSUFICIENTE';
    return true;
  }) : [];

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">🤖 Motor de Auditoría Automatizada</h1>
        <p className="text-slate-500 mt-2">Plataforma de Control Interno y Gobernanza - Termales Santa Rosa de Cabal</p>
      </div>

      {/* STEP 1: CARGA DE ARCHIVO */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
        <h3 className="text-lg font-medium text-slate-700 mb-4">📥 1. Cargar Archivo de Nómina</h3>
        <div className="flex items-center space-x-4">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-500">
              <span className="text-3xl mb-2">📁</span>
              <p className="mb-2 text-sm font-semibold">Haz clic para subir tu archivo Excel</p>
              <p className="text-xs">Soporta .xlsx o .xls</p>
            </div>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
        </div>
        {fileName && (
          <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-medium flex items-center">
            <span>✅ Archivo cargado: <strong>{fileName}</strong> ({datosExcel?.length} transacciones detectadas)</span>
          </div>
        )}
      </div>

      {/* STEP 2: MAPEO DE CONCEPTOS */}
      <div className={`bg-white rounded-xl shadow-md p-6 border border-slate-200 transition-opacity ${!datosExcel ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <h3 className="text-lg font-medium text-slate-700 mb-6">🔗 2. Mapeo de Conceptos</h3>
        
        <div className="space-y-6">
          {systemCategories.map((category) => {
            const selectedConcepts = mapping[category.id] || [];
            
            return (
              <div key={category.id} className="border-b border-slate-100 pb-6 last:border-0">
                <h4 className="text-md font-bold text-slate-800 mb-3">
                  {category.label} {category.required && <span className="text-red-500">*</span>}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {excelConcepts.length > 0 ? excelConcepts.map((concept) => {
                    const isSelected = selectedConcepts.includes(concept);
                    return (
                      <button
                        key={concept}
                        onClick={() => toggleConcept(category.id, concept)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors border shadow-sm ${
                          isSelected ? 'bg-blue-900 border-blue-900 text-white font-bold' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isSelected && '✓ '} {concept}
                      </button>
                    );
                  }) : (
                    <span className="text-sm text-slate-400 italic">Sin datos...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end pt-6 border-t border-slate-100">
          <button 
            onClick={handleStartAudit}
            disabled={!datosExcel}
            className={`px-6 py-3 font-bold rounded-lg shadow-md transition-colors flex items-center space-x-2 ${
              !datosExcel ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-900 text-white hover:bg-blue-800'
            }`}
          >
            <span>⚡ Ejecutar Auditoría (Motor GCM)</span>
          </button>
        </div>
      </div>

      {/* 📊 CARDS DE KPI EJECUTIVO */}
      {resumenKpi && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm bg-gradient-to-br from-red-50/50 to-white">
            <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Riesgo Financiero Expuesto</p>
            <h3 className="text-3xl font-extrabold text-red-700">
              ${resumenKpi.riesgoFinancieroTotal.toLocaleString('es-CO')} <span className="text-xs text-red-500 font-normal">COP</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2">Suma absoluta de desviaciones en nómina</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Población Auditada</p>
            <h3 className="text-3xl font-extrabold text-slate-800">
              {resumenKpi.totalEmpleados} <span className="text-sm font-normal text-slate-500">empleados</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2">Consolidados a partir del Excel</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/50 to-white">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Anomalías Detectadas</p>
            <h3 className="text-3xl font-extrabold text-amber-700">
              {resumenKpi.totalHallazgos} <span className="text-sm font-normal text-amber-600">hallazgos</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              Salud de nómina: <strong className="text-slate-700">{Math.round(((resumenKpi.totalEmpleados - resumenKpi.totalHallazgos) / resumenKpi.totalEmpleados) * 100)}% limpia</strong>
            </p>
          </div>
        </div>
      )}

      {/* 📊 TABLA DE RESULTADOS */}
      {hallazgos && (
        <div className="mt-8 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🚨 Resultados de Auditoría 
              <span className="text-xs font-normal bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full">
                {hallazgosFiltrados.length} visibles
              </span>
            </h3>

            {/* FILTROS RÁPIDOS */}
            <div className="flex items-center space-x-2 bg-slate-900/60 p-1 rounded-lg border border-slate-700">
              <button 
                onClick={() => setFiltroTipo('TODOS')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filtroTipo === 'TODOS' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Todos ({hallazgos.length})
              </button>
              <button 
                onClick={() => setFiltroTipo('PAGO_EXCESO')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filtroTipo === 'PAGO_EXCESO' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Pagos Exceso
              </button>
              <button 
                onClick={() => setFiltroTipo('PAGO_INSUFICIENTE')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filtroTipo === 'PAGO_INSUFICIENTE' ? 'bg-red-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                Pagos Insuficientes (UGPP)
              </button>
            </div>

            <button 
              onClick={() => { setHallazgos(null); setResumenKpi(null); }}
              className="text-slate-400 hover:text-white text-xs font-medium"
            >
              Limpiar Resultados
            </button>
          </div>
          
          <div className="p-0 overflow-x-auto max-h-[550px]">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-6 py-3">Cédula</th>
                  <th className="px-6 py-3">Empleado</th>
                  <th className="px-6 py-3 text-center">Días</th>
                  <th className="px-6 py-3 text-right">Salario Base</th>
                  <th className="px-6 py-3 text-right">Aux. Legal</th>
                  <th className="px-6 py-3 text-right">Aux. Pagado</th>
                  <th className="px-6 py-3 text-right">Diferencia</th>
                  <th className="px-6 py-3 text-center">Clasificación / Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {hallazgosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-slate-500 font-medium">
                      Sin anomalías registradas para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  hallazgosFiltrados.map((h) => (
                    <tr key={h.id} className="bg-white border-b hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{h.cedula}</td>
                      <td className="px-6 py-4 font-medium whitespace-nowrap">{h.nombre}</td>
                      <td className="px-6 py-4 text-center">{h.diasTrabajados}</td>
                      <td className="px-6 py-4 text-right">${h.salarioBase.toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 text-right font-medium text-blue-600">${h.auxilioDeberSer.toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">${h.auxilioPagado.toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-600">
                        ${h.diferenciaAbsoluta.toLocaleString('es-CO')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {h.tipoHallazgo === 'PAGO_INSUFICIENTE' ? (
                          <span className="px-2.5 py-1 text-xs font-extrabold bg-red-100 text-red-800 rounded-full border border-red-200">
                            🚨 BAJO PAGO (Riesgo UGPP)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                            ⚠️ PAGO EN EXCESO
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptMapper;