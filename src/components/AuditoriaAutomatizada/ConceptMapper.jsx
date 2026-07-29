// Ruta: src/components/AuditoriaAutomatizada/ConceptMapper.jsx
import React, { useState } from 'react';
import { auditarAuxilioTransporte } from '../../utils/motorAuditoria'; // Conexión al motor

const ConceptMapper = ({ datosExcel }) => {
  const systemCategories = [
    { id: 'salario_base', label: 'Salario Básico / Sueldo', required: true },
    { id: 'aux_transporte', label: 'Auxilio de Transporte', required: true }
  ];

  // Extraemos conceptos únicos del Excel (si datosExcel existe)
  const excelConcepts = datosExcel 
    ? [...new Set(datosExcel.map(fila => fila.NombreConcepto))].filter(Boolean)
    : ['SUELDO', 'AUXILIO DE TRANSPORTE', 'COMISIONES'];

  const [mapping, setMapping] = useState({});

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
    if (!datosExcel) {
      alert("Falta cargar los datos del Excel.");
      return;
    }
    
    console.log("Iniciando auditoría...");
    
    // Ejecutamos el motor pasando los datos, el mapeo y los valores de ley de 2026
    const resultados = auditarAuxilioTransporte(datosExcel, mapping, { 
      smlmv: 1300000, // Ajusta este valor al SMLMV real de tu auditoría
      auxTransporte: 162000 
    });
    
    console.log("⚠️ Hallazgos detectados:", resultados);
    alert(`Auditoría finalizada. Se encontraron ${resultados.length} hallazgos. Revisa la consola.`);
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">🤖 Mapeador de Conceptos</h1>
        <p className="text-slate-500 mt-2">Asigna los conceptos de la sábana de nómina al Motor GCM.</p>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
        <div className="space-y-6">
          {systemCategories.map((category) => {
            const selectedConcepts = mapping[category.id] || [];
            
            return (
              <div key={category.id} className="border-b border-slate-100 pb-6 last:border-0">
                <h3 className="text-lg font-medium text-slate-700 mb-3">
                  {category.label}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {excelConcepts.map((concept) => {
                    const isSelected = selectedConcepts.includes(concept);
                    return (
                      <button
                        key={concept}
                        onClick={() => toggleConcept(category.id, concept)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors border ${
                          isSelected ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium' : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        {isSelected && '✓ '} {concept}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end pt-6">
          <button 
            onClick={handleStartAudit}
            className="px-6 py-2 bg-blue-900 text-white font-semibold rounded-lg shadow hover:bg-blue-800"
          >
            ⚡ Confirmar Mapeo e Iniciar Auditoría
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConceptMapper;