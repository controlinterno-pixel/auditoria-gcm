import React, { useState } from 'react';
import { auditarAuxilioTransporte } from '../../utils/motorAuditoria';

const ConceptMapper = () => {
  const [datosExcel, setDatosExcel] = useState(null);
  const [mapping, setMapping] = useState({});
  const [fileName, setFileName] = useState("");
  const [hallazgos, setHallazgos] = useState(null);

  const systemCategories = [
    { id: 'salario_base', label: 'Salario Básico / Sueldo', required: true },
    { id: 'aux_transporte', label: 'Auxilio de Transporte', required: true }
  ];

  const excelConcepts = datosExcel 
    ? [...new Set(datosExcel.map(fila => fila.NombreConcepto))].filter(Boolean)
    : [];

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
        
        console.log("📊 Datos extraídos del Excel:", jsonData.slice(0, 5), "... (mostrando 5 filas)");
        setDatosExcel(jsonData);
      } catch (error) {
        console.error("Error leyendo el Excel:", error);
        alert("Hubo un error al leer el archivo. Asegúrate de que sea un formato válido de Excel (.xlsx).");
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
    
    if (!mapping.salario_base || !mapping.aux_transporte) {
      alert("⚠️ Debes mapear al menos un concepto para el Salario Base y otro para el Auxilio de Transporte.");
      return;
    }
    
    console.log("🚀 Iniciando auditoría automatizada...");
    
    const resultados = auditarAuxilioTransporte(datosExcel, mapping, { 
      smlmv: 1300000, 
      auxTransporte: 162000 
    });
    
    setHallazgos(resultados);
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">🤖 Motor de Auditoría Automatizada</h1>
        <p className="text-slate-500 mt-2">Carga tu sábana de nómina y mapea los conceptos para que el robot aplique las reglas de negocio.</p>
      </div>

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

      <div className={`bg-white rounded-xl shadow-md p-6 border border-slate-200 transition-opacity ${!datosExcel ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <h3 className="text-lg font-medium text-slate-700 mb-6">🔗 2. Mapeo de Conceptos</h3>
        
        {!datosExcel && (
          <div className="mb-4 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
            Carga un archivo arriba para ver los conceptos extraídos.
          </div>
        )}

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

      {/* 📊 SECCIÓN DE RESULTADOS */}
      {hallazgos && (
        <div className="mt-8 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">
              🚨 Resultados del Motor ({hallazgos.length} anomalías detectadas)
            </h3>
            <button 
              onClick={() => setHallazgos(null)}
              className="text-slate-300 hover:text-white text-sm"
            >
              Limpiar Resultados
            </button>
          </div>
          
          <div className="p-0 overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-6 py-3">Cédula</th>
                  <th className="px-6 py-3">Empleado</th>
                  <th className="px-6 py-3 text-right">Días Lab.</th>
                  <th className="px-6 py-3 text-right">Salario Base Calc.</th>
                  <th className="px-6 py-3 text-right">Aux. Deber Ser</th>
                  <th className="px-6 py-3 text-right">Aux. Pagado</th>
                  <th className="px-6 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {hallazgos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-emerald-600 font-medium">
                      ✅ ¡No se detectaron diferencias matemáticas en la nómina analizada!
                    </td>
                  </tr>
                ) : (
                  hallazgos.map((h, index) => (
                    <tr key={index} className="bg-white border-b hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{h.cedula}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{h.nombre}</td>
                      <td className="px-6 py-4 text-right">{h.diasTrabajados}</td>
                      <td className="px-6 py-4 text-right">${h.salarioBase.toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 text-right font-medium text-blue-600">${h.auxilioDeberSer.toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600">${h.auxilioPagado.toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 text-right font-bold text-red-500">
                        ${h.diferenciaExacta.toLocaleString('es-CO')}
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