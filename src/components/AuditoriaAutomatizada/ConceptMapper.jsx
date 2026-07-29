// Ruta: src/components/AuditoriaAutomatizada/ConceptMapper.jsx
import React, { useState } from 'react';
import { auditarAuxilioTransporte } from '../../utils/motorAuditoria';

// Helper para normalizar textos en la UI
const normalizarTexto = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const ConceptMapper = () => {
  const [datosExcel, setDatosExcel] = useState(null);
  const [conceptosExtraidosUI, setConceptosExtraidosUI] = useState([]);
  const [mapping, setMapping] = useState({ salario_base: [], aux_transporte: [], ausentismos: [] });
  const [fileName, setFileName] = useState("");
  const [hallazgos, setHallazgos] = useState(null);
  const [resumenKpi, setResumenKpi] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');

  const systemCategories = [
    { id: 'salario_base', label: 'Salario Básico y Devengados Salariales (Art. 127 CST)', required: true },
    { id: 'aux_transporte', label: 'Auxilio / Subsidio de Transporte', required: true },
    { id: 'ausentismos', label: 'Ausentismos (Vacaciones, Incapacidad, Licencias)', required: false }
  ];

  const ejecutarAutoMapeoInteligente = (conceptos) => {
    const autoSalario = conceptos.filter(c => {
      // Exclusiones explícitas
      if (c.includes('NO REMUNERAD') || c.includes('SUSPENSION') || c.includes('VACACIONES') || c.includes('CESANTIA') || c.includes('PRIMA')) {
        return false;
      }
      const palabrasClave = ['SUELDO', 'HORA', 'EXTRA', 'RECARGO', 'COMISION', 'BONIFICACION PRESTACIONAL'];
      return palabrasClave.some(kw => c.includes(kw));
    });

    const autoAuxilio = conceptos.filter(c => c.includes('TRANSPORTE'));
    
    const autoAusentismos = conceptos.filter(c => {
      // 1. Excluir explícitamente conceptos contables o de liquidación que NO son ausentismos
      if (
        c.includes('PRIMA') || 
        c.includes('CESANTIA') || 
        c.includes('INTERES') ||
        c.includes('DIAS NO HABILES') ||
        c.includes('PROVISION')
      ) {
        return false;
      }
      
      // 2. Incluir los verdaderos ausentismos
      return (
        c === 'VACACIONES' || 
        c.includes('INCAPACIDAD') || 
        c.includes('LICENCIA') || 
        c.includes('SUSPENSION') ||
        c.includes('FALTA') ||
        c.includes('PERMISO NO REMUNERADO')
      );
    });

    setMapping({
      salario_base: autoSalario,
      aux_transporte: autoAuxilio,
      ausentismos: autoAusentismos
    });
  }; 

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
        const jsonDataRaw = window.XLSX.utils.sheet_to_json(worksheet, { raw: true });
        
        // 🧹 Limpieza de origen: Filtrar provisiones contables y parafiscales
        const jsonData = jsonDataRaw.filter(row => {
          const tipo = row['Tipo'] || row['tipo'] || row['TIPO'];
          if (tipo) {
            const tipoStr = tipo.toString().toUpperCase();
            return !tipoStr.includes('PROVISION') && !tipoStr.includes('PARAFISCAL');
          }
          return true;
        });
        setDatosExcel(jsonData);

        // 🌟 Buscador dinámico de la columna de Conceptos para la UI
        let colConcepto = null;
        if (jsonData.length > 0) {
          const llavesExcel = Object.keys(jsonData[0]);
          colConcepto = llavesExcel.find(k => {
            const kNorm = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s_]/g, '');
            return ['NOMBRECONCEPTO', 'CONCEPTO', 'DESCRIPCION', 'DETALLE'].includes(kNorm);
          });
        }

        const conceptosLimpios = [...new Set(jsonData.map(f => normalizarTexto(f[colConcepto])))].filter(Boolean);
        
        setConceptosExtraidosUI(conceptosLimpios);
        ejecutarAutoMapeoInteligente(conceptosLimpios);

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
    
    const anoDetectado = datosExcel.length > 0 && datosExcel[0]['Ano'] 
      ? parseInt(datosExcel[0]['Ano']) 
      : new Date().getFullYear();

    const resultadoEngine = auditarAuxilioTransporte(datosExcel, mapping, anoDetectado);
    
    setHallazgos(resultadoEngine.hallazgos);
    setResumenKpi(resultadoEngine.kpis);
  };

  const hallazgosFiltrados = hallazgos ? hallazgos.filter(h => {
    const coincideFiltro = 
      filtroTipo === 'TODOS' ? true :
      filtroTipo === 'CONFORME' ? h.tipoHallazgo === 'CONFORME' :
      filtroTipo === 'PAGO_EXCESO' ? h.tipoHallazgo === 'PAGO_EXCESO' :
      filtroTipo === 'PAGO_INSUFICIENTE' ? h.tipoHallazgo === 'PAGO_INSUFICIENTE' : true;

    const term = busqueda.toLowerCase();
    const coincideBusqueda = 
      h.nombre.toLowerCase().includes(term) || 
      h.cedula.includes(term) ||
      (h.empresa && h.empresa.toLowerCase().includes(term));

    return coincideFiltro && coincideBusqueda;
  }) : [];

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">🤖 Motor de Auditoría Quincenal GCM</h1>
        <p className="text-slate-500 mt-2">Termales Santa Rosa de Cabal — Sistema de Control Interno</p>
      </div>

      {/* 1. Cargar Archivo */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
        <h3 className="text-lg font-medium text-slate-700 mb-4">📥 1. Cargar Nómina Quincenal</h3>
        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <span className="text-2xl mb-1">📁</span>
          <p className="text-sm font-semibold text-slate-600">Subir archivo Excel (.xlsx)</p>
          <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
        </label>
        {fileName && (
          <p className="mt-3 text-xs font-semibold text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
            ✅ Archivo cargado: {fileName} ({datosExcel?.length} transacciones)
          </p>
        )}
      </div>

      {/* 2. Mapeo con Auto-Selección */}
      <div className={`bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8 ${!datosExcel ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-slate-700">🔗 2. Mapeo Automático de Conceptos</h3>
          {datosExcel && (
            <button 
              onClick={() => ejecutarAutoMapeoInteligente(conceptosExtraidosUI)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded border border-slate-300 transition"
            >
              🔄 Re-aplicar Auto-Mapeo (Art. 127 CST)
            </button>
          )}
        </div>

        {systemCategories.map((category) => (
          <div key={category.id} className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-slate-800">{category.label}</h4>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {(mapping[category.id] || []).length} seleccionados
              </span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
              {conceptosExtraidosUI.map((concept) => {
                const isSelected = (mapping[category.id] || []).includes(concept);
                return (
                  <button
                    key={concept}
                    onClick={() => toggleConcept(category.id, concept)}
                    className={`px-3 py-1 text-xs rounded border transition-all ${
                      isSelected ? 'bg-blue-900 text-white border-blue-900 font-bold shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '} {concept}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <button 
          onClick={handleStartAudit}
          className="mt-2 px-6 py-3 bg-blue-900 text-white font-bold rounded-lg shadow-md hover:bg-blue-800 transition-colors cursor-pointer w-full md:w-auto"
        >
          ⚡ Ejecutar Auditoría Quincenal
        </button>
      </div>

      {/* KPI Cards */}
      {resumenKpi && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Auditados</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{resumenKpi.totalEmpleados}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase">Conformes (Correctos)</p>
            <h3 className="text-2xl font-extrabold text-emerald-700">{resumenKpi.conteoConformes}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
            <p className="text-xs font-bold text-amber-600 uppercase">Pagos en Exceso</p>
            <h3 className="text-2xl font-extrabold text-amber-700">{resumenKpi.conteoExcesos}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm">
            <p className="text-xs font-bold text-red-600 uppercase">Bajo Pago (Riesgo UGPP)</p>
            <h3 className="text-2xl font-extrabold text-red-700">{resumenKpi.conteoBajoPago}</h3>
          </div>
        </div>
      )}

      {/* Tabla de Resultados */}
      {hallazgos && (
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 flex flex-wrap justify-between items-center text-white gap-4">
            <h3 className="font-bold text-sm">📊 Auditoría Detallada ({hallazgosFiltrados.length})</h3>
            
            <input 
              type="text" 
              placeholder="🔍 Buscar por nombre, empresa o cédula..." 
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="px-3 py-1.5 text-xs rounded bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />

            <div className="flex gap-2">
              <button onClick={() => setFiltroTipo('TODOS')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'TODOS' ? 'bg-blue-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                Todos ({hallazgos.length})
              </button>
              <button onClick={() => setFiltroTipo('CONFORME')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'CONFORME' ? 'bg-emerald-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                🟢 Conformes ({resumenKpi?.conteoConformes})
              </button>
              <button onClick={() => setFiltroTipo('PAGO_EXCESO')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'PAGO_EXCESO' ? 'bg-amber-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                🟠 Excesos ({resumenKpi?.conteoExcesos})
              </button>
              <button onClick={() => setFiltroTipo('PAGO_INSUFICIENTE')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'PAGO_INSUFICIENTE' ? 'bg-red-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                🔴 Bajo Pago UGPP ({resumenKpi?.conteoBajoPago})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px]">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-100 text-slate-700 uppercase sticky top-0 shadow-sm border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Cédula</th>
                  <th className="px-4 py-3 text-center">Período</th>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3 text-center">Días</th>
                  <th className="px-4 py-3 text-right">Sueldo Básico</th>
                  <th className="px-4 py-3 text-right">Devengado Salarial</th>
                  <th className="px-4 py-3 text-right">Aux. Deber Ser</th>
                  <th className="px-4 py-3 text-right">Aux. Pagado</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hallazgosFiltrados.map((h) => {
                  const esConforme = h.tipoHallazgo === 'CONFORME';
                  const esBajoPago = h.tipoHallazgo === 'PAGO_INSUFICIENTE';

                  return (
                    <tr key={h.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          h.empresa === 'Fam' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          h.empresa === 'RecreFam' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {h.empresa || 'GENERAL'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{h.cedula}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600 bg-slate-50">{h.periodo}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-slate-900">{h.nombre}</td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {Number(h.diasTrabajados).toFixed(2).replace(/\.00$/, '')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">${h.salarioBase.toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">${(h.totalDevengadoSalarial || h.salarioBase).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-700 font-semibold">${h.auxilioDeberSer.toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800">${h.auxilioPagado.toLocaleString('es-CO')}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${
                        esConforme ? 'text-emerald-600' : esBajoPago ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        ${h.diferenciaExacta.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {esConforme && (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                            🟢 CONFORME
                          </span>
                        )}
                        {esBajoPago && (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-red-100 text-red-800 rounded-full border border-red-300">
                            🔴 BAJO PAGO (UGPP)
                          </span>
                        )}
                        {h.tipoHallazgo === 'PAGO_EXCESO' && (
                          <span className="px-2.5 py-1 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                            🟠 PAGO EN EXCESO
                          </span>
                        )}
                        {h.tipoHallazgo === 'NO_APLICA' && (
                          <span className="px-2.5 py-1 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-300">
                            ⚪ NO APLICA (&gt;2 SMLMV)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptMapper;