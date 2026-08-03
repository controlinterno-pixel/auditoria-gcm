// Ruta: src/components/AuditoriaAutomatizada/ConceptMapper.jsx
import React, { useState } from 'react';
import { auditarAuxilioTransporte, auditarSeguridadSocial } from '../../utils/motorAuditoria';
import { guardarNominaHistorica } from '../../services/historicoService';

const normalizarTexto = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const ConceptMapper = () => {
  const [datosExcel, setDatosExcel] = useState(null);
  const [conceptosExtraidosUI, setConceptosExtraidosUI] = useState([]);

  const [fileName, setFileName] = useState("");
  const [hallazgos, setHallazgos] = useState(null);
  const [resumenKpi, setResumenKpi] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [tipoAuditoriaActiva, setTipoAuditoriaActiva] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState('TRANSPORTE'); 
  const [pasoRedondeo, setPasoRedondeo] = useState(500); 
  const [empleadoDiagonal, setEmpleadoDiagonal] = useState(null);
  
  // -- NUEVOS ESTADOS PARA HISTÓRICO --
  const [modoCarga, setModoCarga] = useState('auditar');
  const [periodoHistorico, setPeriodoHistorico] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [mapping, setMapping] = useState({
    salario_base: [], 
    aux_transporte: [], 
    vacaciones_incapacidades: [], 
    licencias_no_remuneradas: [], 
    salud: [], 
    pension: [], 
    devengados_no_salariales: [] 
  });

  const systemCategories = [
    { id: 'salario_base', label: 'Salariales y Constitutivos IBC', required: true },
    { id: 'aux_transporte', label: 'Auxilio de Transporte', required: true },
    { id: 'devengados_no_salariales', label: 'Devengados NO Salariales (Ley 1393)', required: false },
    { id: 'salud', label: 'Deducciones de Salud (4%)', required: true },
    { id: 'pension', label: 'Deducciones de Pensión (4%)', required: true },
    { id: 'vacaciones_incapacidades', label: 'Ausentismos que Cotizan (Vacaciones/Incapacidad)', required: false },
    { id: 'licencias_no_remuneradas', label: 'Licencias No Remuneradas / Suspensiones', required: false }
  ];
  
  // ⚡ AUTO-MAPEO AMPLIADO CON LEXICÓN DE NÓMINA COLOMBIANA
  const ejecutarAutoMapeoInteligente = (conceptos) => {
    const autoSalario = conceptos.filter(c => {
      if (
        c.includes('NO REMUNERAD') || 
        c.includes('SUSPENSION') || 
        c.includes('VACACIONES') || 
        c.includes('CESANTIA') || 
        c.includes('PRIMA DE SERVICIO')
      ) {
        return false;
      }
      const palabrasClave = [
        'SUELDO', 'BASICO', 'SALARIO', 'HORA', 'EXTRA', 'RECARGO', 'COMISION', 
        'BONIFICACION PRESTACIONAL', 'BONIFICACION SALARIAL', 'AUXILIO SALARIAL', 
        'PRIMA SALARIAL', 'AJUSTE SALARIAL', 'DIFERENCIA SALARIAL', 'COMPENSACION SALARIAL',
        'DIA DE LA FAMILIA', 'LICENCIA REMUNERADA', 'INCENTIVO', 'DESTAJO'
      ];
      return palabrasClave.some(kw => c.includes(kw));
    });

    const autoAuxilio = conceptos.filter(c => c.includes('TRANSPORTE'));

    const autoVacacionesIncap = conceptos.filter(c => 
      c === 'VACACIONES' || 
      c.includes('INCAPACIDAD') || 
      c.includes('INC.') || 
      c.includes('VACAC')
    );

    const autoLicenciasNoRem = conceptos.filter(c => 
      c.includes('NO REMUNERAD') || 
      c.includes('SUSPENSION') || 
      c.includes('PERMISO NO REMUNERADO') ||
      c.includes('LICENCIA NO REMUNERADA') ||
      c.includes('FALTA')
    );

    const autoSalud = conceptos.filter(c => 
      c.includes('SALUD') && 
      !c.includes('FONDO') &&
      !c.includes('PATRONAL') &&
      !c.includes('AJUSTE') &&
      !c.includes('PROVISION') &&
      !c.includes('EMPRESA')
    );

    const autoPension = conceptos.filter(c => 
      (c.includes('PENSION') || c.includes('PENSIONES') || c.includes('SOLIDARIDAD')) && 
      !c.includes('FONDO') && 
      !c.includes('VOLUNTARIA') &&
      !c.includes('PATRONAL') &&
      !c.includes('EMPRESA')
    );

    const autoNoSalarial = conceptos.filter(c => 
      c.includes('BONIFICACION NO PRESTACIONAL') || 
      c.includes('VIATICO') ||
      c.includes('RODAMIENTO') || 
      c.includes('SOSTENIMIENTO') 
    );
 
    setMapping({
      salario_base: autoSalario,
      aux_transporte: autoAuxilio,
      vacaciones_incapacidades: autoVacacionesIncap,
      licencias_no_remuneradas: autoLicenciasNoRem,
      salud: autoSalud,
      pension: autoPension,
      devengados_no_salariales: autoNoSalarial
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
        
        const jsonData = jsonDataRaw.filter(row => {
          const tipo = row['Tipo'] || row['tipo'] || row['TIPO'];
          if (tipo) {
            const tipoStr = tipo.toString().toUpperCase();
            return !tipoStr.includes('PROVISION') && !tipoStr.includes('PARAFISCAL');
          }
          return true;
        });
        setDatosExcel(jsonData);

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
    setTipoAuditoriaActiva('TRANSPORTE');
    setHallazgos(resultadoEngine.hallazgos);
    setResumenKpi(resultadoEngine.kpis);
  };

  const handleStartAuditUGPP = () => {
    if (!datosExcel || datosExcel.length === 0) return;
    const resultadoEngine = auditarSeguridadSocial(datosExcel, mapping, { pasoRedondeo });
    setTipoAuditoriaActiva('UGPP');
    setHallazgos(resultadoEngine.hallazgos);
    setResumenKpi(resultadoEngine.kpis);
  };

  const hallazgosFiltrados = hallazgos ? hallazgos.filter(h => {
    const coincideFiltro = 
      filtroTipo === 'TODOS' ? true :
      filtroTipo === 'CONFORME' ? h.tipoHallazgo === 'CONFORME' :
      filtroTipo === 'PAGO_EXCESO' ? h.tipoHallazgo === 'PAGO_EXCESO' :
      filtroTipo === 'PAGO_INSUFICIENTE' ? h.tipoHallazgo === 'PAGO_INSUFICIENTE' :
      filtroTipo === 'DESALINEACION_SUBSISTEMAS' ? h.tipoHallazgo === 'DESALINEACION_SUBSISTEMAS' : true;

    const term = busqueda.toLowerCase();
    const coincideBusqueda = 
      h.nombre.toLowerCase().includes(term) || 
      h.cedula.includes(term) ||
      (h.empresa && h.empresa.toLowerCase().includes(term));

    return coincideFiltro && coincideBusqueda;
  }) : [];

  const esConceptoConstitutivoAuto = (nombreConcepto) => {
    if (!nombreConcepto) return false;
    const norm = normalizarTexto(nombreConcepto);
    // Exclusiones estrictas
    if (
      norm.includes('NO REMUNERAD') || 
      norm.includes('CESANTIA') || 
      norm.includes('PRIMA DE SERVICIOS') ||
      norm.includes('SUSPENSION')
    ) {
      return false;
    }
    // Lexicón extendido completo (Coincide con el mapeo inteligente)
    const palabras = [
      'SUELDO', 'SALARIO', 'BASICO', 'COMISION', 'HORA EXTRA', 'RECARGO', 'DOMINICAL', 
      'FESTIVO', 'NOCTURN', 'BONIFICACION SALARIAL', 'PRIMA SALARIAL', 'INCENTIVO', 
      'DESTAJO', 'AUXILIO SALARIAL', 'AJUSTE SALARIAL', 'DIFERENCIA SALARIAL', 
      'COMPENSACION SALARIAL', 'BONIFICACION PRESTACIONAL', 'VACACIONES', 'INCAPACIDAD', 
      'INC.', 'DIA DE LA FAMILIA', 'LICENCIA REMUNERADA'
    ];
    return palabras.some(kw => norm.includes(kw));
  };

  // 🔍 MODAL DE DESGLOSE PIVOTEADO POR CÉDULA + PERÍODO
  const obtenerDesgloseEmpleado = (empleado) => {
    if (!datosExcel || !empleado) return [];
    
    // Función auxiliar idéntica a la del backend para extraer montos reales
    const parsearMontoModal = (val) => {
      if (!val) return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      let str = val.toString().trim().replace(/[^0-9.,-]/g, '');
      if (!str) return 0;
      if (str.includes('.') && str.includes(',')) {
        str = str.lastIndexOf('.') < str.lastIndexOf(',') ? str.replace(/\./g, '').replace(',', '.') : str.replace(/,/g, '');
      } else if (str.includes(',')) {
        const parts = str.split(',');
        str = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
      }
      return parseFloat(str) || 0;
    };

    const buscarColumnaModal = (fila, aliasPosibles) => {
      const llaves = Object.keys(fila);
      for (const alias of aliasPosibles) {
        const aliasNorm = alias.toUpperCase().replace(/[\s_]/g, '');
        const llaveReal = llaves.find(k => k.toUpperCase().replace(/[\s_]/g, '') === aliasNorm);
        if (llaveReal) return fila[llaveReal];
      }
      return undefined;
    };

    const transaccionesEmp = datosExcel.filter(row => {
      const cedulaRow = (buscarColumnaModal(row, ['Cedula', 'CEDULA', 'Documento', 'Identificacion']) || '').toString().trim();
      const periodoRow = (buscarColumnaModal(row, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']) || '').toString().trim();
      return cedulaRow === empleado.cedula && (periodoRow === empleado.periodo || !empleado.periodo);
    });

    return transaccionesEmp.map(t => {
      const conceptoRaw = buscarColumnaModal(t, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle', 'Nombre concepto']);
      const concepto = normalizarTexto(conceptoRaw);
      
      const valorRaw = buscarColumnaModal(t, ['TotalDevengado', 'ValorTotal', 'VRTotal', 'Total', 'Valor', 'Devengado', 'Monto', 'Pago', 'Deduccion']);
      const valor = parsearMontoModal(valorRaw);
      
      // Verificación robusta: Mira en salario base, en ausentismos, o usa el auto-analizador
      const esConstitutivo = 
        (mapping.salario_base || []).includes(concepto) || 
        (mapping.vacaciones_incapacidades || []).includes(concepto) || 
        esConceptoConstitutivoAuto(concepto);
        
      return { concepto, valor, incluidoEnIBC: esConstitutivo };
    });
  };
  // 🤖 ANALIZADOR INFORMATIVO DE CAUSALES DE LA BRECHA IMPLÍCITA (NIVEL 2)
  const obtenerAnalisisCausalesModal = (empleado) => {
    if (!empleado) return [];
    const desgloses = obtenerDesgloseEmpleado(empleado);
    const causales = [];

    const tieneVacaciones = desgloses.some(d => d.concepto.includes('VACACIONES'));
    const tieneIncapacidad = desgloses.some(d => d.concepto.includes('INCAPACIDAD') || d.concepto.includes('INC.'));
    const tieneExtras = desgloses.some(d => d.concepto.includes('HORA') || d.concepto.includes('EXTRA') || d.concepto.includes('RECARGO'));
    const tieneDiaFamilia = desgloses.some(d => d.concepto.includes('FAMILIA'));
    const tieneLicenciaRem = desgloses.some(d => d.concepto.includes('LICENCIA REMUNERADA'));
    
    const brecha = Math.abs(empleado.salarioBase - (empleado.ibcImplicito || 0));

    if (tieneVacaciones) causales.push({ titulo: "🏖️ Vacaciones Novedad/Ajuste", desc: "El ERP liquidó ausentismo pagado con fórmula desacumulada/promedio de días no hábiles." });
    if (tieneIncapacidad) causales.push({ titulo: "🏥 Incapacidad de Nómina", desc: "Base de cotización ajustada por la entidad según días de ausentismo médico." });
    if (tieneExtras) causales.push({ titulo: "⏰ Recargos / Horas Extras", desc: "Inclusión de variables operativas en el mes vencido por el ERP." });
    if (tieneDiaFamilia) causales.push({ titulo: "👨‍👩‍👧 Día de la Familia", desc: "El ERP incluyó el devengado salarial remunerado en la base de liquidación." });
    if (tieneLicenciaRem) causales.push({ titulo: "📜 Licencia Remunerada", desc: "Liquidación legal con auxilio completo conforme a Art. 127 CST." });
    if (brecha <= pasoRedondeo && brecha > 0) causales.push({ titulo: "📐 Redondeo del ERP", desc: `Aproximación por regla paramétrica ($${pasoRedondeo.toLocaleString('es-CO')}).` });

  if (causales.length === 0) {
      causales.push({ titulo: "⚙️ Regla Interna del ERP", desc: "Diferencia causada por promedio de IBC de períodos anteriores o redondeos de módulo." });
    }

    return causales;
  };

  const handleGuardarHistorico = async () => {
    if (!periodoHistorico) {
      alert("⚠️ Por favor selecciona el mes (Ej: Marzo 2026) antes de guardar el histórico.");
      return;
    }
    if (!datosExcel || datosExcel.length === 0) {
      alert("⚠️ Primero debes cargar un archivo Excel.");
      return;
    }
    
    setIsUploading(true);
    try {
      const res = await guardarNominaHistorica(datosExcel, periodoHistorico, 'Termales');
      alert("✅ " + res.message);
      setDatosExcel(null);
      setFileName("");
      setPeriodoHistorico("");
      setModoCarga('auditar');
    } catch (err) {
      alert("❌ Error guardando el histórico: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">🤖 Motor de Auditoría Quincenal GCM v5.0</h1>
        <p className="text-slate-500 mt-2">Termales Santa Rosa de Cabal — Sistema de Control Interno</p>
      </div>

      {/* --- INICIO NUEVO SELECTOR DE MODO --- */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-4 flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-700 mb-3">¿Qué deseas hacer con el archivo Excel?</h3>
          <div className="flex space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" name="modoCarga" value="auditar" checked={modoCarga === 'auditar'} onChange={() => setModoCarga('auditar')} className="form-radio text-blue-600 w-5 h-5" />
              <span className="text-sm font-semibold text-slate-800">Auditar mes actual (Motor v5.0)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input type="radio" name="modoCarga" value="historico" checked={modoCarga === 'historico'} onChange={() => setModoCarga('historico')} className="form-radio text-emerald-600 w-5 h-5" />
              <span className="text-sm font-semibold text-slate-800">Guardar como Histórico</span>
            </label>
          </div>
        </div>
        {modoCarga === 'historico' && (
          <div className="flex-1 animate-in fade-in slide-in-from-top-2 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <label className="text-xs font-bold text-emerald-800 block mb-1">Período de la Nómina a guardar</label>
            <input type="month" value={periodoHistorico} onChange={(e) => setPeriodoHistorico(e.target.value)} className="border border-emerald-300 rounded px-3 py-1.5 text-sm w-full focus:outline-none focus:border-emerald-500" />
          </div>
        )}
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

     {/* 2. Configuración o Guardado Histórico */}
      {modoCarga === 'historico' ? (
        <div className={`bg-white rounded-xl shadow-md p-6 border border-emerald-200 bg-emerald-50 mb-8 ${!datosExcel ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-lg font-medium text-emerald-800 mb-4">💾 2. Guardar en Base de Datos</h3>
          <p className="text-sm text-emerald-700 mb-4">Haz clic en el botón de abajo para enviar la nómina cargada a Firebase y usarla en promedios futuros.</p>
          <button 
            onClick={handleGuardarHistorico}
            disabled={isUploading || !datosExcel}
            className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-lg shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isUploading ? '⏳ Guardando...' : '💾 Confirmar y Guardar Histórico'}
          </button>
        </div>
      ) : (
      <div className={`bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8 ${!datosExcel ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-slate-700">🔗 2. Configuración de Auditoría</h3>
          {datosExcel && (
            <button 
              onClick={() => ejecutarAutoMapeoInteligente(conceptosExtraidosUI)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded border border-slate-300 transition"
            >
              🔄 Re-aplicar Auto-Mapeo Inteligente
            </button>
          )}
        </div>

        <div className="flex flex-wrap justify-between items-center mb-6 border-b border-slate-200 pb-2 gap-4">
          <div className="flex gap-2">
            <button 
              onClick={() => setPestanaActiva('TRANSPORTE')}
              className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${pestanaActiva === 'TRANSPORTE' ? 'bg-blue-900 text-white border-b-4 border-blue-500' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              ⚡ Motor Auxilio Transporte
            </button>
            <button 
              onClick={() => setPestanaActiva('UGPP')}
              className={`px-4 py-2 font-bold rounded-t-lg transition-colors ${pestanaActiva === 'UGPP' ? 'bg-indigo-700 text-white border-b-4 border-indigo-400' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              🛡️ Motor Riesgo UGPP (4%)
            </button>
          </div>

          {pestanaActiva === 'UGPP' && (
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-semibold text-indigo-900">
              <span>⚙️ Regla Redondeo IBC ERP:</span>
              <select 
                value={pasoRedondeo} 
                onChange={(e) => setPasoRedondeo(Number(e.target.value))}
                className="bg-white border border-indigo-300 font-bold rounded px-2 py-1 text-slate-800 focus:outline-none"
              >
                <option value={500}>Redondeo $500 (Ej: 1.177.500)</option>
                <option value={1000}>Redondeo $1.000 (PILA Estándar)</option>
                <option value={2500}>Redondeo $2.500</option>
                <option value={1}>Valor Exacto (Sin redondeo)</option>
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {systemCategories
            .filter(cat => 
              pestanaActiva === 'TRANSPORTE' 
                ? ['salario_base', 'aux_transporte', 'vacaciones_incapacidades', 'licencias_no_remuneradas'].includes(cat.id)
                : ['salario_base', 'devengados_no_salariales', 'salud', 'pension', 'vacaciones_incapacidades', 'licencias_no_remuneradas'].includes(cat.id)
            )
            .map((category) => (
            <div key={category.id} className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
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
        </div>

        <div className="mt-4 flex justify-end">
          {pestanaActiva === 'TRANSPORTE' ? (
            <button 
              onClick={handleStartAudit}
              className="px-8 py-3 bg-blue-900 text-white font-bold rounded-lg shadow-md hover:bg-blue-800 transition-colors w-full md:w-auto"
            >
              ⚡ Ejecutar Auditoría de Transporte
            </button>
          ) : (
            <button 
              onClick={handleStartAuditUGPP}
              className="px-8 py-3 bg-indigo-700 text-white font-bold rounded-lg shadow-md hover:bg-indigo-600 transition-colors w-full md:w-auto"
            >
              🛡️ Ejecutar Auditoría UGPP
            </button>
        )}
        </div>
      </div>
      )}

      {/* KPI Cards Reestructuradas */}
      {resumenKpi && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase">Total Auditados</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{resumenKpi.totalEmpleados}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase">🟢 Conformes (4%)</p>
            <h3 className="text-2xl font-extrabold text-emerald-700">{resumenKpi.conteoConformes}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm">
            <p className="text-xs font-bold text-red-600 uppercase">🔴 Pago Insuficiente (UGPP)</p>
            <h3 className="text-2xl font-extrabold text-red-700">{resumenKpi.conteoBajoPago}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
            <p className="text-xs font-bold text-amber-600 uppercase">🟠 Pagos en Exceso</p>
            <h3 className="text-2xl font-extrabold text-amber-700">{resumenKpi.conteoExcesos}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm">
            <p className="text-xs font-bold text-purple-600 uppercase">⚠️ Desalineación Subsistemas</p>
            <h3 className="text-2xl font-extrabold text-purple-700">{resumenKpi.conteoDesalineados || 0}</h3>
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
              <button onClick={() => setFiltroTipo('PAGO_INSUFICIENTE')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'PAGO_INSUFICIENTE' ? 'bg-red-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                🔴 Bajo Pago UGPP ({resumenKpi?.conteoBajoPago})
              </button>
              <button onClick={() => setFiltroTipo('PAGO_EXCESO')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'PAGO_EXCESO' ? 'bg-amber-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                🟠 Excesos ({resumenKpi?.conteoExcesos})
              </button>
              <button onClick={() => setFiltroTipo('DESALINEACION_SUBSISTEMAS')} className={`px-2.5 py-1 text-xs rounded transition ${filtroTipo === 'DESALINEACION_SUBSISTEMAS' ? 'bg-purple-600 font-bold' : 'bg-slate-800 hover:bg-slate-700'}`}>
                ⚠️ Desalineados ({resumenKpi?.conteoDesalineados || 0})
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
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3 text-center">Días</th>
                  {tipoAuditoriaActiva === 'TRANSPORTE' ? (
                    <>
                      <th className="px-4 py-3 text-right">Sueldo Básico</th>
                      <th className="px-4 py-3 text-right">Devengado Salarial</th>
                      <th className="px-4 py-3 text-right">Aux. Deber Ser</th>
                      <th className="px-4 py-3 text-right">Aux. Pagado</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-right">IBC Motor (Calculado)</th>
                      <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-900 border-b-2 border-indigo-200 font-extrabold">IBC Implícito (Nómina) 🔍</th>
                      <th className="px-4 py-3 text-right">Total Devengado</th>
                      <th className="px-4 py-3 text-right">Salud Deber Ser (4%)</th>
                      <th className="px-4 py-3 text-right">Salud Descontada</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right">Diferencia</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hallazgosFiltrados.map((h) => {
                  const esConforme = h.tipoHallazgo === 'CONFORME';
                  const esBajoPago = h.tipoHallazgo === 'PAGO_INSUFICIENTE';
                  const brechaIBC = tipoAuditoriaActiva === 'UGPP' && Math.abs(h.salarioBase - (h.ibcImplicito || 0)) > pasoRedondeo;

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
                      <td className="px-4 py-3 text-[10px] text-slate-500 uppercase">{h.cargo || 'Sin Cargo'}</td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {Number(h.diasTrabajados).toFixed(2).replace(/\.00$/, '')}
                      </td>
                      
                      <td className="px-4 py-3 text-right font-mono text-slate-700">${h.salarioBase.toLocaleString('es-CO')}</td>
                      
                      {tipoAuditoriaActiva !== 'TRANSPORTE' && (
                        <td 
                          onClick={() => setEmpleadoDiagonal(h)}
                          className={`px-4 py-3 text-right font-mono font-bold cursor-pointer hover:bg-indigo-100 transition-colors ${brechaIBC ? 'text-indigo-700 bg-indigo-50 border-x border-indigo-100' : 'text-slate-600'}`}
                          title="Hacer clic para abrir Diagnóstico Forense Informativo"
                        >
                          ${(h.ibcImplicito || 0).toLocaleString('es-CO')} 🔍
                        </td> 
                      )}
                      
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
                        {h.tipoHallazgo === 'DESALINEACION_SUBSISTEMAS' && (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-purple-100 text-purple-800 rounded-full border border-purple-300">
                            ⚠️ DESALINEACIÓN SALUD/PENSIÓN
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

      {/* 🔍 MODAL MODO DIAGNÓSTICO FORENSE (INFORMACIÓN NIVEL 2 ENRIQUECIDO CON CAUSALES) */}
      {empleadoDiagonal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">🔍 Diagnóstico Forense de IBC (Informativo)</h3>
                <p className="text-xs text-slate-400">{empleadoDiagonal.nombre} — Cédula: {empleadoDiagonal.cedula} | Período: {empleadoDiagonal.periodo}</p>
              </div>
              <button 
                onClick={() => setEmpleadoDiagonal(null)}
                className="text-slate-400 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">IBC Motor (Base Real Quincenal)</span>
                  <p className="text-xl font-extrabold text-blue-900">${empleadoDiagonal.salarioBase.toLocaleString('es-CO')}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">IBC Implícito (Registrado ERP)</span>
                  <p className="text-xl font-extrabold text-indigo-900">${(empleadoDiagonal.ibcImplicito || 0).toLocaleString('es-CO')}</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-xs font-semibold flex justify-between items-center">
                <span>⚠️ Brecha de bases sin afectar estado normativo:</span>
                <span className="font-mono text-sm font-bold">${Math.abs(empleadoDiagonal.salarioBase - (empleadoDiagonal.ibcImplicito || 0)).toLocaleString('es-CO')}</span>
              </div>

              {/* 🤖 SECCIÓN DE RECONCILIACIÓN INFORMATIVA DE CAUSALES */}
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-indigo-900 uppercase mb-2">📌 Posibles Causales de la Brecha ERP vs. Motor:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {obtenerAnalisisCausalesModal(empleadoDiagonal).map((c, i) => (
                    <div key={i} className="bg-white p-2.5 rounded border border-indigo-100 text-xs shadow-sm">
                      <p className="font-bold text-slate-800">{c.titulo}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-700 uppercase mt-4">Desglose de Transacciones (Período {empleadoDiagonal.periodo}):</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                    <tr>
                      <th className="p-2.5">Estado IBC</th>
                      <th className="p-2.5">Concepto Nómina</th>
                      <th className="p-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {obtenerDesgloseEmpleado(empleadoDiagonal).map((item, idx) => (
                      <tr key={idx} className={item.incluidoEnIBC ? 'bg-emerald-50/40' : 'bg-red-50/40'}>
                        <td className="p-2.5 font-sans font-bold">
                          {item.incluidoEnIBC ? (
                            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">✔ INCLUIDO</span>
                          ) : (
                            <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded text-[10px]">✘ OMITIDO</span>
                          )}
                        </td>
                        <td className="p-2.5 font-sans font-medium text-slate-800">{item.concepto}</td>
                        <td className="p-2.5 text-right font-bold">${item.valor.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setEmpleadoDiagonal(null)}
                className="px-5 py-2 bg-slate-800 text-white font-bold text-xs rounded-lg hover:bg-slate-700 transition"
              >
                Cerrar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptMapper;