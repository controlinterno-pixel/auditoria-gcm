// Ruta: src/components/AuditoriaAutomatizada/DashboardHistorico.jsx
import React, { useState, useEffect } from 'react';
import { obtenerListaHistoricos, cargarNominaHistorica, guardarMarcacionesEnLaNube, cargarMarcacionesDeLaNube, obtenerListaMarcaciones, eliminarMarcacionesHistoricas } from '../../services/historicoService';
import * as XLSX from 'xlsx';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
const normalizarTexto = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const parsearMonto = (val) => {
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
// ✅ NUEVA FUNCIÓN PARA TRADUCIR MESES A FORMATO GERENCIAL
const formatearMes = (per) => {
  if (!per) return "Desconocido";
  const str = per.toString();
  const nombresMeses = { '01':'Enero', '02':'Febrero', '03':'Marzo', '04':'Abril', '05':'Mayo', '06':'Junio', '07':'Julio', '08':'Agosto', '09':'Septiembre', '10':'Octubre', '11':'Noviembre', '12':'Diciembre' };
  
  if (str.includes('-')) {
    const [ano, mes] = str.split('-');
    if (nombresMeses[mes]) return `${nombresMeses[mes]} ${ano}`;
  }
  return str; // Si es una quincena (Ej. "228"), la deja intacta
};
// --- ⚡ CACHÉ ULTRA-RÁPIDO (A PRUEBA DE BIG DATA Y FIREBASE) ---
const cacheNormalizacionLlaves = {};
const cacheLlavesExactas = {};

const buscarColumna = (fila, aliasPosibles) => {
  if (!fila || typeof fila !== 'object') return undefined;

  // 1. Vía ultra-rápida O(1)
  for (const alias of aliasPosibles) {
    const aliasNorm = alias.toUpperCase().replace(/[\s_]/g, '');
    const llaveExacta = cacheLlavesExactas[aliasNorm];
    if (llaveExacta && fila[llaveExacta] !== undefined) {
      return fila[llaveExacta];
    }
  }

  // 2. Vía de mapeo: Priorizamos el orden estricto de los alias solicitados
  for (const alias of aliasPosibles) {
    const aliasNorm = alias.toUpperCase().replace(/[\s_]/g, '');
    for (const key of Object.keys(fila)) {
      if (!cacheNormalizacionLlaves[key]) {
        cacheNormalizacionLlaves[key] = normalizarTexto(key).replace(/[\s_]/g, '');
      }
      if (cacheNormalizacionLlaves[key] === aliasNorm) {
        cacheLlavesExactas[aliasNorm] = key; 
        return fila[key];
      }
    }
  }

  return undefined;
};

// 🗓️ CÁLCULO DE QUINCENA SEGÚN CORTES REALES DE EMPRESA (23-7 / 8-22)
const calcularQuincenaCorte = (fechaStr) => {
  if (!fechaStr || fechaStr === 'Sin Fecha') return 'Desconocido';
  
  let dt = null;
  if (fechaStr.includes('-')) {
    const parts = fechaStr.split('-');
    if (parts.length === 3) {
      dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  if (!dt || isNaN(dt.getTime())) return fechaStr;

  const ano = dt.getFullYear();
  const mes = dt.getMonth() + 1;
  const dia = dt.getDate();

  // Corte 1: Día 23 del mes anterior al 7 del mes actual -> Q1 (pago el 15)
  if (dia >= 23) {
    const mesSiguiente = mes === 12 ? 1 : mes + 1;
    const anoSiguiente = mes === 12 ? ano + 1 : ano;
    return `${anoSiguiente}-${String(mesSiguiente).padStart(2, '0')}-Q1`;
  } else if (dia <= 7) {
    return `${ano}-${String(mes).padStart(2, '0')}-Q1`;
  } else {
    // Corte 2: Día 8 al 22 del mes actual -> Q2 (pago el 30/31)
    return `${ano}-${String(mes).padStart(2, '0')}-Q2`;
  }
};

const DashboardHistorico = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [datosHistoricos, setDatosHistoricos] = useState(null);
  const [listaBases, setListaBases] = useState([]);

  // --- FILTROS AVANZADOS Y TENDENCIAS ---
  const [busqueda, setBusqueda] = useState('');
  const [filtroUnidad, setFiltroUnidad] = useState('TODOS');
  const [filtroProceso, setFiltroProceso] = useState([]); 
  const [filtroCargo, setFiltroCargo] = useState([]);     
  const [filtroConceptoJornada, setFiltroConceptoJornada] = useState([]); 
  const [verTendencias, setVerTendencias] = useState(false);
const [modoDashboard, setModoDashboard] = useState('JORNADA'); // 'JORNADA', 'TRANSPORTE', 'MARCACIONES'
const [datosMarcaciones, setDatosMarcaciones] = useState(null);
const [isCargandoMarcaciones, setIsCargandoMarcaciones] = useState(false);
const [filtroEmpresaMarcaciones, setFiltroEmpresaMarcaciones] = useState('TODAS');
  const [filtroPeriodo, setFiltroPeriodo] = useState('TODOS');   
  const [filtroAlerta, setFiltroAlerta] = useState('TODOS');     
  const [agrupacionGrafica, setAgrupacionGrafica] = useState('SEDES'); 
  const [limiteTop, setLimiteTop] = useState('TODOS');                 
  const [metricaGrafica, setMetricaGrafica] = useState('HORAS');
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState([]); 
  const [empleadoModal, setEmpleadoModal] = useState(null);
  const [lineasOcultas, setLineasOcultas] = useState({}); 

  // ⚡ FILTROS AVANZADOS Y GRANULARIDAD PARA MARCACIONES
  const [granularidadMarcaciones, setGranularidadMarcaciones] = useState('MES'); // 'DIA', 'SEMANA', 'QUINCENA', 'MES'
  const [filtroQuincenaMarcaciones, setFiltroQuincenaMarcaciones] = useState('TODAS');
  const [ordenMarcacionesTabla, setOrdenMarcacionesTabla] = useState('ASC'); // 'ASC', 'DESC'
  
  // 🖱️ NUEVO ESTADO: Filtro Interactivo por Clic en la Gráfica
  const [filtroClicGrafica, setFiltroClicGrafica] = useState(null);


  const clasificarUnidad = (fila) => {
    const empresa = normalizarTexto(buscarColumna(fila, ['Empresa', 'Compania']) || '');
    const ccosto = normalizarTexto(buscarColumna(fila, ['NombreCcosto', 'CentroCosto', 'CentroPadre']) || '');
    const grupo = normalizarTexto(buscarColumna(fila, ['Grupo']) || '');
    const cargo = normalizarTexto(buscarColumna(fila, ['Cargo', 'DesCargo']) || '');

    const palabrasAdmin = ['ADMINISTRA', 'FINANCIER', 'TALENTO', 'HUMANA', 'CONTAB', 'TESORER', 'CONTROL INTERNO', 'TICS', 'MERCADEO', 'COMPRAS', 'FAMILY OFFICE', 'SISTEMAS', 'GERENCIA', 'DIRECTOR'];
    const excepOperativas = ['AUDITORIA NOCTURNA', 'RECEPCION', 'SPA', 'MESERO', 'CAMARERA', 'STEWAR', 'COCINA', 'MANTENIMIENTO', 'SALVAVIDAS'];

    if ((palabrasAdmin.some(p => ccosto.includes(p)) || palabrasAdmin.some(p => grupo.includes(p))) && !excepOperativas.some(ex => cargo.includes(ex))) {
      return 'ADMIN';
    }

    if (
      empresa.includes('RECREFAM') || 
      ccosto.includes('HOTEL') || ccosto.includes('ALOJAMIENTO') || grupo.includes('ALOJAMIENTO') || 
      ccosto.includes('SPA') || ccosto.includes('CASCADA') || ccosto.includes('MONTAÑA') || ccosto.includes('DEL RIO') ||
      ccosto.includes('JAIBANA') || ccosto.includes('PINDANA') || ccosto.includes('RUTA ECOLOGICA') || ccosto.includes('RECREACION')
    ) {
      return 'ECOPARQUE_HOTEL';
    }

    return 'BALNEARIO';
  };

  const [listaMarcacionesBD, setListaMarcacionesBD] = useState([]);

 useEffect(() => {
    // 1. Cargar bases de Nómina
    obtenerListaHistoricos().then(data => {
      setListaBases(data);
      // Auto-clic instantáneo al botón de analizar si hay bases
      if (data.length > 0) {
        setTimeout(() => {
          const btn = document.getElementById('btn-ejecutar-escaner');
          if (btn && !btn.disabled) btn.click();
        }, 1200);
      }
    });

    // 2. Cargar histórico de Marcaciones Biométricas desde la NUBE (Firebase)
    cargarMarcacionesDeLaNube().then(dataNube => {
       if (dataNube && dataNube.length > 0) setDatosMarcaciones(dataNube);
    });

    // 3. Obtener listado de archivos de marcaciones subidos
    obtenerListaMarcaciones().then(data => setListaMarcacionesBD(data));
  }, []);

  // Función para eliminar archivo de marcaciones de la nube
  const handleEliminarMarcaciones = async (id) => {
    if (window.confirm("⚠️ ¿Estás seguro de eliminar este lote de marcaciones de la nube?\n\nEsta acción no se puede deshacer y afectará las gráficas.")) {
      setIsCargandoMarcaciones(true);
      try {
        await eliminarMarcacionesHistoricas(id);
        
        // Refrescar las listas
        const nuevaLista = await obtenerListaMarcaciones();
        setListaMarcacionesBD(nuevaLista);
        
        const dataNube = await cargarMarcacionesDeLaNube();
        setDatosMarcaciones(dataNube.length > 0 ? dataNube : null);
        
        alert("🗑️ Archivo biométrico eliminado de la Nube con éxito.");
      } catch (error) {
        alert("❌ Error: " + error.message);
      } finally {
        setIsCargandoMarcaciones(false);
      }
    }
  };

  const ejecutarAnalisisForense = async () => {
    if (listaBases.length === 0) {
      alert("No hay bases históricas en la nube para analizar.");
      return;
    }

    setIsAnalyzing(true);
    try {
      let todasLasTransacciones = [];
      
      // Descargar todas las bases de Firebase
      for (const base of listaBases) {
        const dataBruta = await cargarNominaHistorica(base.periodo, base.empresa);
        let dataPlana = [];
        if (Array.isArray(dataBruta)) {
          dataBruta.forEach(item => {
            if (item?.transacciones) dataPlana.push(...item.transacciones);
            else if (item?.registros) dataPlana.push(...item.registros);
            else dataPlana.push(item);
          });
        } else if (dataBruta && typeof dataBruta === 'object') {
          dataPlana = dataBruta.transacciones || dataBruta.registros || Object.values(dataBruta) || [];
        }

        dataPlana.forEach(t => {
          t.mesOrigen = base.periodo;
          t.empresaOrigen = base.empresa; // 👈 Inyección clave de empresa de origen
        });
        todasLasTransacciones.push(...dataPlana);
      }

      // Procesamiento Forense 360
     const empleadosStats = {};
      const mesesDetectados = new Set();
      const procesosUnicos = new Set();
      const cargosUnicos = new Set();
      const conceptosJornadaUnicos = new Set(); // 💡 Colección de conceptos únicos
      
      let totalCostoExtrasCompania = 0;
      let tendenciasMeses = {};

      todasLasTransacciones.forEach(fila => {
       const cedulaRaw = buscarColumna(fila, ['Identificacion', 'Cedula', 'Documento', 'NIT', 'CEDULA']);
        if (!cedulaRaw) return;
        
        const cedula = cedulaRaw.toString().trim().replace(/\D/g, '');
        const mesOrigen = fila.mesOrigen;
        const quincenaReal = (buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']) || mesOrigen).toString().trim();
        mesesDetectados.add(mesOrigen);

        const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
        let conceptoLimpio = normalizarTexto(conceptoRaw);
        
        // 🧹 ESTANDARIZACIÓN FORENSE (Agrupa variaciones tipográficas de la nómina)
        if (conceptoLimpio.includes('DV06')) conceptoLimpio = 'DV06-HORA RECARGO DOMINICAL Y FESTIVO';
        if (conceptoLimpio.includes('DV07')) conceptoLimpio = 'DV07-HORA RECARGO NOCTURNO FESTIVOS O DOM.';
        
        const cantidad = parsearMonto(buscarColumna(fila, ['Cantidad', 'Horas', 'Cant', 'Minutos']));
        const valor = parsearMonto(buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'Total', 'Valor', 'Pago', 'Devengado']));
        const nombre = buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado']) || 'Sin Nombre';
        const cargo = buscarColumna(fila, ['Cargo', 'DesCargo', 'Ocupacion']) || 'Sin Cargo';
// 👁️ Ponemos 'Grupo' y 'NombreCcosto' de primeros para mostrar los nombres de los macro-procesos
        const proceso = buscarColumna(fila, ['Grupo', 'NombreCcosto', 'CentroCosto']) || 'GENERAL';
        const unidad = clasificarUnidad(fila);

        procesosUnicos.add(proceso);
        cargosUnicos.add(cargo);

       if (!tendenciasMeses[mesOrigen]) {
          tendenciasMeses[mesOrigen] = { 
            mes: mesOrigen, 
            ADMIN: 0, 
            BALNEARIO: 0, 
            ECOPARQUE_HOTEL: 0, 
            costoADMIN: 0, 
            costoBALNEARIO: 0, 
            costoECOPARQUE_HOTEL: 0 
          };
        }

const empresaFila = fila.empresaOrigen || buscarColumna(fila, ['Empresa', 'Compania', 'RazonSocial']) || 'GENERAL';
        if (!empleadosStats[cedula]) {
          empleadosStats[cedula] = {
            cedula, nombre, cargo, proceso, unidad,
           empresasGrupo: new Set([empresaFila]),
            totalHorasExtras: 0,
            totalValorExtras: 0,
            totalHorasRecargos: 0,
            totalValorRecargos: 0,
            mesesConNovedad: new Set(),
           historialMeses: {},
            desgloseJornadaPorMes: {}, // 💡 Desglose REAL por cada mes (para la gráfica)
            desgloseConceptosJornada: {}, // 💡 Desglose para el filtro dinámico
            fugaTransporteDinero: 0,
            mesesConFugaTransporte: 0
          };
        } else {
          empleadosStats[cedula].empresasGrupo.add(empresaFila);
        }

        const emp = empleadosStats[cedula];

       // 🚗 RECOLECCIÓN TRANSPORTE (Agrupamos por MES y por EMPRESA para doble contrato)
        if (!emp.historialMeses[mesOrigen]) {
          emp.historialMeses[mesOrigen] = { 
            mesContenedor: mesOrigen, devengadoSalarial: 0, transportePagado: 0, rodamientoPagado: 0,
            porEmpresa: {} // <-- NUEVO OBJETO PARA DESGLOSE
          };
        }

        // Clasificar la empresa de esta transacción
        let normEmpresa = 'OTRAS';
        const eUpper = (empresaFila || '').toUpperCase();
        if (eUpper.includes('RECREFAM')) normEmpresa = 'RECREFAM';
        else if (eUpper.includes('FAM') || eUpper.includes('TERMALES')) normEmpresa = 'FAM';

        if (!emp.historialMeses[mesOrigen].porEmpresa[normEmpresa]) {
            emp.historialMeses[mesOrigen].porEmpresa[normEmpresa] = { devengado: 0, transporte: 0 };
        }
        
        const esTransporte = conceptoLimpio.includes('SUBSIDIO DE TRANSPORTE') || conceptoLimpio.includes('AUXILIO DE TRANSPORTE');
        const esRodamiento = conceptoLimpio.includes('RODAMIENTO') || conceptoLimpio.includes('VIATICO');
        const esExcluidoIBC = ['NO REMUNERAD', 'CESANTIA', 'PRIMA', 'SUSPENSION', 'VACACION', 'INCAPACIDAD', 'INC.', 'RETEFUENTE', 'LIBRANZA', 'PRESTAMO', 'FONDO', 'SINDICATO', 'PLAN EXEQUIAL', 'ALIMENTACION'].some(kw => conceptoLimpio.includes(kw));
        const esTiempoSuplementario = ['EXTRA', 'RECARGO', 'DOMINICAL', 'FESTIVO', 'NOCTURN'].some(kw => conceptoLimpio.includes(kw));
        
        if (valor > 0 && !esExcluidoIBC && !esTiempoSuplementario && !esTransporte && !esRodamiento && !conceptoLimpio.includes('VEHICULO')) {
           emp.historialMeses[mesOrigen].devengadoSalarial += valor;
           emp.historialMeses[mesOrigen].porEmpresa[normEmpresa].devengado += valor; // Desglose
        }
        if (esTransporte && valor > 0) {
           emp.historialMeses[mesOrigen].transportePagado += valor;
           emp.historialMeses[mesOrigen].porEmpresa[normEmpresa].transporte += valor; // Desglose
        }
        if (esRodamiento && valor > 0) emp.historialMeses[mesOrigen].rodamientoPagado += valor;

        // ⏱️ RECOLECCIÓN JORNADA (Alineado 100% con Criterios de Auditoría)
        const codigosAuditoria = ['DV05', 'DV06', 'DV07', 'DV08', 'DV09', 'DV10', 'DV11', 'DV19', 'DV22'];
        
        // 1. Busca por código exacto (Máxima precisión para evitar descuadres)
        const tieneCodigoDV = codigosAuditoria.some(codigo => conceptoLimpio.includes(codigo));

        // 2. Mantiene la búsqueda por texto por si algún mes el ERP exportó el nombre sin el código DV
        const esExtra = conceptoLimpio.includes('EXTRA DIURNA') || conceptoLimpio.includes('EXTRAS DIURNAS') ||
                        conceptoLimpio.includes('EXTRA NOCTURNA') || conceptoLimpio.includes('EXTRAS NOCTURNAS') ||
                        conceptoLimpio.includes('EXTRA FESTIVA') || conceptoLimpio.includes('EXTRAS FESTIVAS') ||
                        conceptoLimpio.includes('EXTRA DOMINICAL');
        
        const esRecargo = (conceptoLimpio.includes('RECARGO') && !conceptoLimpio.includes('EXTRA')) || 
                          conceptoLimpio.includes('NOCTURNO') || conceptoLimpio.includes('DOMINICAL') ||
                          conceptoLimpio.includes('FESTIVO COMPENSADO') || conceptoLimpio.includes('FESTIVO NO COMPENSADO');

        if (tieneCodigoDV || esExtra || esRecargo) {
          conceptosJornadaUnicos.add(conceptoLimpio); // Guardar concepto único
          if (!emp.desgloseConceptosJornada[conceptoLimpio]) {
             emp.desgloseConceptosJornada[conceptoLimpio] = { horas: 0, valor: 0 };
          }
          emp.desgloseConceptosJornada[conceptoLimpio].horas += cantidad;
          emp.desgloseConceptosJornada[conceptoLimpio].valor += valor;

          // 💡 GUARDADO MENSUAL REAL PARA LA GRÁFICA DE TENDENCIAS
          if (!emp.desgloseJornadaPorMes[mesOrigen]) {
            emp.desgloseJornadaPorMes[mesOrigen] = { horas: 0, valor: 0, conceptos: {} };
          }
          emp.desgloseJornadaPorMes[mesOrigen].horas += cantidad;
          emp.desgloseJornadaPorMes[mesOrigen].valor += valor;
          
          if (!emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio]) {
             emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio] = { horas: 0, valor: 0 };
          }
          emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio].horas += cantidad;
          emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio].valor += valor;

          if (esExtra) {
            emp.totalHorasExtras += cantidad;
            emp.totalValorExtras += valor;
          } else {
            emp.totalHorasRecargos += cantidad;
            emp.totalValorRecargos += valor;
          }
          totalCostoExtrasCompania += valor; // Suma el total general para la compañía siempre
          emp.mesesConNovedad.add(mesOrigen);

          // Acumular tendencia por sede
          if (unidad === 'ADMIN') {
            tendenciasMeses[mesOrigen].ADMIN += cantidad;
            tendenciasMeses[mesOrigen].costoADMIN += valor;
          } else if (unidad === 'BALNEARIO') {
            tendenciasMeses[mesOrigen].BALNEARIO += cantidad;
            tendenciasMeses[mesOrigen].costoBALNEARIO += valor;
          } else if (unidad === 'ECOPARQUE_HOTEL') {
            tendenciasMeses[mesOrigen].ECOPARQUE_HOTEL += cantidad;
            tendenciasMeses[mesOrigen].costoECOPARQUE_HOTEL += valor;
          }
        }
      });

     const alertasJornada = [];
      const alertasTransporte = [];
      let totalFugaTransporteCompania = 0;

      Object.values(empleadosStats).forEach(emp => {
        // --- 1. EVALUACIÓN DE TRANSPORTE 360° (PROPORCIONAL, TELETRABAJO Y REINTEGROS) ---
        let tieneFuga = false;
        let detalleTransporte = [];
        let periodosFuga = new Set();
        let fugaNetaAcumulada = 0;
        let quincenasConInfraccion = 0;

        Object.entries(emp.historialMeses).forEach(([mesAgrupado, data]) => {
           const transporte = data.transportePagado || 0;
           const rodamiento = data.rodamientoPagado || 0;
           const devengado = data.devengadoSalarial || 0;
           
           // Tope Legal Mensual 2026 (2 SMLMV = $3.501.810 COP)
           const topeMensual = 3501810;

           // Gestión de Reintegros / Descuentos Negativos en Nómina
           if (transporte < 0 || devengado < 0) {
              fugaNetaAcumulada += transporte;
              detalleTransporte.push(`[Mes ${mesAgrupado}: Reintegro de Auxilio $${Math.abs(transporte).toLocaleString('es-CO')}]`);
              return;
           }

           if (transporte > 0) {
              let causalFuga = null;

              if (rodamiento > 0) {
                 causalFuga = `Doble Beneficio (Rodamiento $${rodamiento.toLocaleString('es-CO')})`;
              } else if (data.esTeletrabajo) {
                 causalFuga = `Incompatibilidad Teletrabajo / Conectividad`;
              } else if (devengado > topeMensual) {
                 causalFuga = `Base evaluada $${devengado.toLocaleString('es-CO')} excede tope mensual de $${topeMensual.toLocaleString('es-CO')} (Extras excluidas)`;
              }

              if (causalFuga) {
                 fugaNetaAcumulada += transporte;
                 quincenasConInfraccion += 1; // Aunque la variable se llame quincenas, ahora suma meses
                 tieneFuga = true;
                 periodosFuga.add(data.mesContenedor);
                 detalleTransporte.push(`[Mes ${mesAgrupado}: ${causalFuga}]`);
              }
           }
        });

        // Alerta Corporativa Especial: Doble Contrato / Multi-Empresa
        if (emp.empresasGrupo && emp.empresasGrupo.size > 1) {
           tieneFuga = true;
           detalleTransporte.push(`[ALERTA CORPORATIVA: Cobro simultáneo en ${Array.from(emp.empresasGrupo).join(' + ')}]`);
        }

        if (tieneFuga && fugaNetaAcumulada > 0) {
           emp.fugaTransporteDinero = fugaNetaAcumulada;
           emp.mesesConFugaTransporte = quincenasConInfraccion;
           totalFugaTransporteCompania += fugaNetaAcumulada;

           alertasTransporte.push({
              ...emp,
              periodosFuga,
              totalHorasVisual: quincenasConInfraccion,
              totalDineroVisual: fugaNetaAcumulada,
             fugaPorMes: Object.values(emp.historialMeses).reduce((acc, q) => {
                 if (q.transportePagado > 0) {
                    const topeMensual = 3501810; // 2 SMLMV 2026
                    if (q.rodamientoPagado > 0 || q.esTeletrabajo || q.devengadoSalarial > topeMensual) {
                       acc[q.mesContenedor] = (acc[q.mesContenedor] || 0) + q.transportePagado;
                    }
                 }
                 return acc;
              }, {}),
riesgo: (() => {
                // 1. CÁLCULO DINÁMICO REAL DE MULTI-EMPRESA
                if (emp.empresasGrupo && emp.empresasGrupo.size > 1) {
                  let empresasLista = Array.from(emp.empresasGrupo).join(' y ');
                  let totalAuxilioRecibido = fugaNetaAcumulada;
                  let sueldoPromedioEmpresa = 0;

                  Object.values(emp.historialMeses).forEach(q => {
                    if (q.transportePagado > 0 && q.devengadoSalarial > 0) {
                      sueldoPromedioEmpresa = q.devengadoSalarial;
                    }
                  });

                  return `🚨 DIAGNÓSTICO GERENCIAL (DOBLE COBRO CORPORATIVO):
• Doble Cobro en Nóminas Paralelas: Registra cobro simultáneo de Auxilio de Transporte en las razones sociales ${empresasLista}.
• Análisis Salarial por Empresa: Registra un sueldo básico quincenal promedio de $${sueldoPromedioEmpresa.toLocaleString('es-CO')} por unidad de empresa.
• Impacto Financiero Factual: Percibió $${totalAuxilioRecibido.toLocaleString('es-CO')} COP de auxilio en exceso acumulado en ${quincenasConInfraccion} quincena(s) auditada(s).`;
                }

                // 2. CÁLCULO DE PROMEDIOS FINANCIEROS REALES (Palacios, López y demás empleados)
                let totalSalarialAcumulado = 0;
                let totalRodamientoAcumulado = 0;
                let quincenasSuperaTope = 0;
                let quincenasConRodamiento = 0;

                Object.values(emp.historialMeses).forEach(q => {
                  if (q.transportePagado > 0) {
                    totalSalarialAcumulado += (q.devengadoSalarial || 0);
                    totalRodamientoAcumulado += (q.rodamientoPagado || 0);
                    if (q.devengadoSalarial > 1750905) quincenasSuperaTope++;
                    if (q.rodamientoPagado > 0) quincenasConRodamiento++;
                  }
                });

                const promSalarial = quincenasConInfraccion > 0 ? Math.round(totalSalarialAcumulado / quincenasConInfraccion) : 0;
                const promRodamiento = quincenasConRodamiento > 0 ? Math.round(totalRodamientoAcumulado / quincenasConRodamiento) : 0;

                // 3. ANÁLISIS DE DOBLE INCOMPATIBILIDAD (RODAMIENTO + TOPE EXCEDIDO)
                if (promRodamiento > 0 && promSalarial > 1750905) {
                  return `🚨 DOBLE INCOMPATIBILIDAD (RODAMIENTO + TOPE EXCEDIDO):
• Análisis de Ingresos: Devengado salarial promedio de $${promSalarial.toLocaleString('es-CO')} quincenales (Sueldo + Comisiones), superando el tope de 2 SMLMV ($1.750.905 COP) en ${quincenasSuperaTope} de ${quincenasConInfraccion} quincenas.
• Doble Beneficio Extralegal: Percibe $${promRodamiento.toLocaleString('es-CO')} quincenales de Auxilio de Rodamiento, concepto exento que inhabilita legalmente el pago de Auxilio de Transporte (Art. 15 Ley 15/59).
• Fuga de Capital Factual: El ERP continuó pagando el auxilio de transporte sin aplicar la regla de exclusión, acumulando $${fugaNetaAcumulada.toLocaleString('es-CO')} COP en exceso en ${quincenasConInfraccion} quincenas.`;
                }

               if (promRodamiento > 0) {
                  return `⚠️ REVISIÓN DE COMPATIBILIDAD (RODAMIENTO vs. TRANSPORTE LEGAL):
• Derecho Legal: Por devengar $${promSalarial.toLocaleString('es-CO')} quincenales (< 2 SMLMV), legalmente le corresponde el Auxilio de Transporte.
• Beneficio Adicional: Registra cobro de Auxilio de Rodamiento por $${promRodamiento.toLocaleString('es-CO')} quincenales.
• Validación Requerida: Si el rodamiento cubre la movilidad del empleado, el Auxilio de Transporte de Ley debía haberse excluido por sistema (ahorro potencial de $${fugaNetaAcumulada.toLocaleString('es-CO')} COP en ${quincenasConInfraccion} quincenas). Si es un beneficio extralegal independiente pactado por contrato, el pago dual es válido.`;
                }

                // 4. SUPERACIÓN ESTÁNDAR DEL TOPE LEGAL
                return `⚠️ SUPERACIÓN DE TOPE LEGAL (2 SMLMV):
• Análisis de Ingresos: Devengado salarial promedio de $${promSalarial.toLocaleString('es-CO')} quincenales, superando el límite legal de 2 SMLMV ($1.750.905 COP).
• Fuga de Capital Factual: Se pagaron $${fugaNetaAcumulada.toLocaleString('es-CO')} COP de auxilio de transporte sin derecho legal en ${quincenasConInfraccion} quincenas.`;
              })(),
              tipo: 'FUGA_TRANSPORTE',
              icono: '🚗',
              mesesActivos: quincenasConInfraccion
           });
        }

// --- 2. EVALUACIÓN DE JORNADA ---
        const totalHoras = emp.totalHorasExtras + emp.totalHorasRecargos;
        const totalDinero = emp.totalValorExtras + emp.totalValorRecargos;
        
        if (totalHoras > 0 || totalDinero > 0) {
            const mesesActivos = emp.mesesConNovedad.size;
            const promedioMensual = totalHoras / (mesesActivos || 1);
            const cargoLimpio = normalizarTexto(emp.cargo);

            const palabrasClaveAdmin = [
              'CONTABLE', 'CONTABILIDAD', 'FINANCIER', 'TESORERIA', 'CARTERA',
              'TALENTO', 'GERENT', 'DIRECTOR', 'MEJORA', 'SISTEMAS', 'TICS', 
              'DESARROLLADOR', 'COMERCIAL', 'CONTACT CENTER', 'COMPRAS', 
              'MERCADEO', 'COMUNICACIONES', 'PLANEACION', 'FAMILY', 
              'ADMINISTRATIV', 'COSTOS', 'AUDITOR'
            ];
            const excepcionesOperativas = ['AUDITORIA NOCTURNA', 'OPERACIONES', 'RECEPCION', 'SPA', 'SERVICIO AL CLIENTE'];

            const esAdminPuro = palabrasClaveAdmin.some(kw => cargoLimpio.includes(kw)) && !excepcionesOperativas.some(ex => cargoLimpio.includes(ex));
            const esLiderAdmin = (cargoLimpio.includes('COORDINADOR') || cargoLimpio.includes('LIDER')) && 
                                 !excepcionesOperativas.some(ex => cargoLimpio.includes(ex)) && 
                                 !['MANTENIMIENTO', 'ALIMENTOS', 'AMBIENTAL', 'EXPERIENCIA', 'INFRAESTRUCTURA'].some(kw => cargoLimpio.includes(kw));

            let riesgo = null;
            let tipo = null;
            let icono = null;

            if ((esAdminPuro || esLiderAdmin) && totalHoras > 5) {
              riesgo = `Alerta de Cargo Corporativo: Empleado administrativo (${emp.cargo}) acumuló ${totalHoras.toFixed(1)} hrs operativas. Requiere revisión estricta de autorización.`;
              tipo = 'CARGO_CORPORATIVO';
              icono = '🚨';
            } else if (emp.totalHorasExtras > 50 && mesesActivos >= 3) {
              riesgo = `Sobrecarga crónica: ${totalHoras.toFixed(1)} hrs en ${mesesActivos} meses. Riesgo alto de fatiga laboral (Burnout).`;
              tipo = 'BURNOUT';
              icono = '🔥';
            } else if (totalDinero > 1500000) {
              riesgo = `Alerta Financiera / Favoritismo: Ha cobrado $${totalDinero.toLocaleString('es-CO')} en recargos y extras. Revisar equidad en el equipo.`;
              tipo = 'FAVORITISMO';
              icono = '💰';
            } else if (mesesActivos >= 2 && totalHoras >= 10) {
              riesgo = `Comportamiento recurrente: Registra horas extras en ${mesesActivos} meses distintos. Requiere validación.`;
              tipo = 'RECURRENCIA';
              icono = '🔄';
            }

            if (riesgo) {
              alertasJornada.push({
                ...emp,
                totalHorasVisual: totalHoras,
                totalDineroVisual: totalDinero,
                riesgo,
                tipo,
                icono,
                mesesActivos
              });
            }
        }
      });

      alertasJornada.sort((a, b) => b.totalHorasVisual - a.totalHorasVisual);
      alertasTransporte.sort((a, b) => b.totalDineroVisual - a.totalDineroVisual);

      setDatosHistoricos({
        totalAnalizados: Object.keys(empleadosStats).length,
        totalMeses: mesesDetectados.size,
        totalCostoExtras: totalCostoExtrasCompania,
        totalFugaTransporte: totalFugaTransporteCompania, // 🚗
        alertasJornada, // ⏱️
        alertasTransporte, // 🚗
        empleadosStatsMaster: Object.values(empleadosStats), // 🧠 CATÁLOGO COMPLETO PARA EL CEREBRO
        procesos: Array.from(procesosUnicos).sort(),
        cargos: Array.from(cargosUnicos).sort(),
        conceptosJornada: Array.from(conceptosJornadaUnicos).sort(), // 💡 Lista de conceptos para la UI
        tendencias: Object.values(tendenciasMeses).sort((a, b) => a.mes.localeCompare(b.mes))
      });

    } catch (error) {
      console.error(error);
      alert("❌ Error al procesar la data histórica.");
    } finally {
      setIsAnalyzing(false);
    }
  };
// 🔌 CARGAR MARCACIONES DESDE EXCEL REAL Y GUARDAR HISTÓRICO
  // 💡 HELPER FORENSE: Comparación de nombres inmune a diferencias de orden
const esMismoEmpleado = (nom1, nom2) => {
  if (!nom1 || !nom2) return false;
  const c1 = normalizarTexto(nom1).replace(/[^A-Z0-9\s]/g, '');
  const c2 = normalizarTexto(nom2).replace(/[^A-Z0-9\s]/g, '');
  if (c1 === c2) return true;
  const w1 = new Set(c1.split(/\s+/).filter(w => w.length > 2));
  const w2 = new Set(c2.split(/\s+/).filter(w => w.length > 2));
  if (w1.size >= 2 && w2.size >= 2) {
    const inter = [...w1].filter(x => w2.has(x));
    if (inter.length >= Math.min(w1.size, w2.size)) return true;
  }
  return false;
};

// 🔌 CARGAR MARCACIONES DESDE EXCEL REAL Y GUARDAR HISTÓRICO
  const handleCargarMarcaciones = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsCargandoMarcaciones(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      let todasLasMarcaciones = [];

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        const dataLimpia = jsonData.map((row, index) => {
          const empresaVal = buscarColumna(row, ['Empresa', 'EMPRESA', 'Compania']) || sheetName;
          const empleadoVal = buscarColumna(row, ['Empleado', 'EMPLEADO', 'Nombre', 'Nombres']);
          
          if (!empleadoVal || String(empleadoVal).trim() === '') return null; // Ignorar filas rotas

          let fechaRaw = buscarColumna(row, ['Fecha', 'FECHA', 'Fecha "', 'fecha']) || '';
          let fechaFormateada = '';

          if (typeof fechaRaw === 'number' && fechaRaw > 30000) {
            const fechaObj = new Date((fechaRaw - 25569) * 86400 * 1000);
            const ano = fechaObj.getUTCFullYear();
            const mes = String(fechaObj.getUTCMonth() + 1).padStart(2, '0');
            const dia = String(fechaObj.getUTCDate()).padStart(2, '0');
            fechaFormateada = `${ano}-${mes}-${dia}`;
          } else if (typeof fechaRaw === 'string' && fechaRaw.includes('/')) {
            const parteFecha = fechaRaw.includes('-') ? fechaRaw.split('-')[1].trim() : fechaRaw.trim();
            const [d, m, a] = parteFecha.split('/');
            if (d && m && a) fechaFormateada = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            else fechaFormateada = fechaRaw;
          } else if (fechaRaw instanceof Date) {
            fechaFormateada = fechaRaw.toISOString().split('T')[0];
          } else {
            fechaFormateada = String(fechaRaw).split('T')[0].trim();
          }

          return {
            id: `${sheetName}-${index}`,
            Empresa: String(empresaVal).trim(), 
            Empleado: String(empleadoVal).trim(),
            Fecha: fechaFormateada || 'Sin Fecha',
            Periodo_Corte: calcularQuincenaCorte(fechaFormateada), 
            Horario: String(buscarColumna(row, ['Horario', 'HORARIO', 'Turno']) || 'Sin Registro'),
            HT: String(buscarColumna(row, ['HT', 'Horas', 'HT_Horas']) || '00:00'),
            Total_Recargos_Dia: parsearMonto(buscarColumna(row, ['Total_Recargos_Dia', 'Total_Recargos', 'TOTAL_RECARGOS'])),
          };
        }).filter(row => row !== null && row.Empleado !== 'Desconocido'); // 👁️ DEJA PASAR TODO (0 y Novedades)

        todasLasMarcaciones = [...todasLasMarcaciones, ...dataLimpia];
      });

      if (datosMarcaciones && datosMarcaciones.length > 0) {
         const posibleDuplicado = todasLasMarcaciones.find(nuevo => 
            datosMarcaciones.some(viejo => viejo.Empleado === nuevo.Empleado && viejo.Fecha === nuevo.Fecha)
         );
         if (posibleDuplicado) {
            const confirmar = window.confirm(`⚠️ ALERTA DE DUPLICIDAD:\n\nYa existen marcaciones en la Nube para este mes. Si continúas, duplicarás los costos. ¿Subir de todos modos?`);
            if (!confirmar) {
               setIsCargandoMarcaciones(false);
               e.target.value = null;
               return;
            }
         }
      }

      // 🛡️ ESCUDO BIG DATA: DIVIDIR EN LOTES DE 10,000 PARA NO ESTALLAR FIREBASE
      const chunk_size = 10000;
      for (let i = 0; i < todasLasMarcaciones.length; i += chunk_size) {
         const lote = todasLasMarcaciones.slice(i, i + chunk_size);
         await guardarMarcacionesEnLaNube(lote); // Sube las cajas una por una
      }

      const dataCombinada = datosMarcaciones ? [...datosMarcaciones, ...todasLasMarcaciones] : todasLasMarcaciones;
      setDatosMarcaciones(dataCombinada);
      
      alert(`✅ ¡Big Data procesada! Se guardaron ${todasLasMarcaciones.length} turnos exitosamente en la Nube (divididos en lotes de seguridad).`);

    } catch (error) {
      console.error("Error leyendo Excel:", error);
      alert(`❌ Error procesando el archivo: ${error.message}`);
    } finally {
      setIsCargandoMarcaciones(false);
      e.target.value = null;
    }
  };

  // 🧠 NAVEGACIÓN RÁPIDA DE NÓMINA A MARCACIONES
  const irAMarcacionesEmpleado = (empleado) => {
      setEmpleadosSeleccionados([{ cedula: empleado.cedula, nombre: empleado.nombre }]);
      setModoDashboard('MARCACIONES');
      setEmpleadoModal(null); // Cierra el modal
  };
// 🧠 FILTRADO DINÁMICO MULTI-SELECCIÓN (Afecta Tabla y Gráficas)
  const coleccionActiva = React.useMemo(() => {
    if (!datosHistoricos) return [];
    return modoDashboard === 'JORNADA' ? datosHistoricos.alertasJornada : datosHistoricos.alertasTransporte;
  }, [datosHistoricos, modoDashboard]);
  
  // 💡 Mapeo previo para recalcular totales si hay un filtro de concepto activo
  const coleccionRecalculada = React.useMemo(() => {
    if (modoDashboard !== 'JORNADA' || filtroConceptoJornada.length === 0) return coleccionActiva;
    return coleccionActiva.map(a => {
      let nuevasHoras = 0;
      let nuevoDinero = 0;
      if (a.desgloseConceptosJornada) {
        filtroConceptoJornada.forEach(c => {
          if (a.desgloseConceptosJornada[c]) {
            nuevasHoras += a.desgloseConceptosJornada[c].horas;
            nuevoDinero += a.desgloseConceptosJornada[c].valor;
          }
        });
      }
      return { ...a, totalHorasVisual: nuevasHoras, totalDineroVisual: nuevoDinero };
    });
  }, [coleccionActiva, modoDashboard, filtroConceptoJornada]);

  const alertasFiltradas = React.useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    return coleccionRecalculada.filter(a => {
      if (modoDashboard === 'JORNADA' && filtroConceptoJornada.length > 0 && a.totalHorasVisual === 0 && a.totalDineroVisual === 0) return false;

      // 1. Las personas en tu Bandeja SIEMPRE se muestran
      const estaSeleccionado = empleadosSeleccionados.some(e => e.cedula === a.cedula);
      if (estaSeleccionado) return true;

      // 2. Evaluamos los filtros normales (Mantenimiento, etc.)
      const coincideUnidad = filtroUnidad === 'TODOS' ? true : a.unidad === filtroUnidad;
      const coincideProceso = filtroProceso.length === 0 ? true : filtroProceso.includes(a.proceso);
      const coincideCargo = filtroCargo.length === 0 ? true : filtroCargo.includes(a.cargo);
      
      let coincidePeriodo = true;
      if (filtroPeriodo !== 'TODOS') {
        coincidePeriodo = modoDashboard === 'JORNADA' ? a.mesesConNovedad.has(filtroPeriodo) : a.periodosFuga.has(filtroPeriodo);
      }
      const coincideAlerta = filtroAlerta === 'TODOS' ? true : a.tipo === filtroAlerta;

      const cumpleFiltrosBase = coincideUnidad && coincideProceso && coincideCargo && coincidePeriodo && coincideAlerta;

      // 3. Evaluamos la búsqueda
      if (term !== '') {
        const coincideBusqueda = a.nombre.toLowerCase().includes(term) || 
                                 a.cedula.includes(term) ||
                                 (a.periodosFuga && Array.from(a.periodosFuga).some(p => p.toString().toLowerCase().includes(term))) ||
                                 (a.mesesConNovedad && Array.from(a.mesesConNovedad).some(p => p.toString().toLowerCase().includes(term)));
        return cumpleFiltrosBase || coincideBusqueda;
      }
      return cumpleFiltrosBase;
    });
  }, [coleccionRecalculada, busqueda, empleadosSeleccionados, filtroUnidad, filtroProceso, filtroCargo, filtroPeriodo, filtroAlerta, modoDashboard, filtroConceptoJornada]);

  // 📈 RECALCULAR TENDENCIA GRÁFICA SEGÚN LOS FILTROS ACTIVOS
  const tendenciasDinamicas = React.useMemo(() => {
    if (!datosHistoricos) return [];

    const mapaMeses = {};
    datosHistoricos.tendencias.forEach(t => {
      mapaMeses[t.mes] = { 
        mes: t.mes, 
        ADMIN: 0, BALNEARIO: 0, ECOPARQUE_HOTEL: 0, 
        costoADMIN: 0, costoBALNEARIO: 0, costoECOPARQUE_HOTEL: 0,
        devengadoFAM: 0, devengadoRECREFAM: 0, 
        fugaFAM: 0, fugaRECREFAM: 0 
      };
    });

   // 💡 MAGIA: Si hay empleados seleccionados (con chulito), obligamos a que las gráficas
   // de líneas y los cuadros mensuales calculen EXCLUSIVAMENTE la data de esas personas.
   const baseGrafica = empleadosSeleccionados.length > 0
     ? alertasFiltradas.filter(a => empleadosSeleccionados.some(e => e.cedula === a.cedula))
     : alertasFiltradas;

   baseGrafica.forEach(emp => {
      if (modoDashboard === 'JORNADA') {
        emp.mesesConNovedad.forEach(mes => {
          if (mapaMeses[mes] && emp.desgloseJornadaPorMes && emp.desgloseJornadaPorMes[mes]) {
            const u = emp.unidad;
            const dataMes = emp.desgloseJornadaPorMes[mes];
            
            let horasFiltro = 0;
            let valorFiltro = 0;
            
            if (filtroConceptoJornada.length > 0) {
               filtroConceptoJornada.forEach(c => {
                 if (dataMes.conceptos[c]) {
                   horasFiltro += dataMes.conceptos[c].horas;
                   valorFiltro += dataMes.conceptos[c].valor;
                 }
               });
            } else {
               horasFiltro = dataMes.horas;
               valorFiltro = dataMes.valor;
            }

            if (agrupacionGrafica === 'CONCEPTOS') {
                Object.entries(dataMes.conceptos).forEach(([nombreConcepto, metricas]) => {
                   if (!mapaMeses[mes][nombreConcepto]) {
                       mapaMeses[mes][nombreConcepto] = 0;
                       mapaMeses[mes][`costo_${nombreConcepto}`] = 0;
                   }
                   mapaMeses[mes][nombreConcepto] += metricas.horas;
                   mapaMeses[mes][`costo_${nombreConcepto}`] += metricas.valor;

                   const llaveCruzada = `${nombreConcepto}_${emp.cedula}`;
                   mapaMeses[mes][llaveCruzada] = (mapaMeses[mes][llaveCruzada] || 0) + metricas.horas;
                   mapaMeses[mes][`costo_${llaveCruzada}`] = (mapaMeses[mes][`costo_${llaveCruzada}`] || 0) + metricas.valor;
                });
            }
            else if (agrupacionGrafica === 'EMPLEADOS' || agrupacionGrafica === 'SELECCIONADOS') {
                if (!mapaMeses[mes][emp.nombre]) {
                    mapaMeses[mes][emp.nombre] = 0;
                    mapaMeses[mes][`costo_${emp.nombre}`] = 0;
                }
                mapaMeses[mes][emp.nombre] += horasFiltro;
                mapaMeses[mes][`costo_${emp.nombre}`] += valorFiltro;
            }

            mapaMeses[mes][u] += horasFiltro;
            mapaMeses[mes][`costo${u}`] += valorFiltro;
          }
        });
      } else {
        if (emp.historialMeses) {
          Object.entries(emp.historialMeses).forEach(([mes, data]) => {
            if (mapaMeses[mes]) {
               if (data.porEmpresa) {
                  mapaMeses[mes].devengadoFAM += (data.porEmpresa['FAM']?.devengado || 0);
                  mapaMeses[mes].devengadoRECREFAM += (data.porEmpresa['RECREFAM']?.devengado || 0);
               }
               if (emp.fugaPorMes && emp.fugaPorMes[mes] > 0 && data.porEmpresa) {
                  mapaMeses[mes].fugaFAM += (data.porEmpresa['FAM']?.transporte || 0);
                  mapaMeses[mes].fugaRECREFAM += (data.porEmpresa['RECREFAM']?.transporte || 0);
               }
            }
          });
        }
      }
    });

    return Object.values(mapaMeses).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [datosHistoricos, alertasFiltradas, empleadosSeleccionados, modoDashboard, filtroConceptoJornada, agrupacionGrafica]);

 // 🧮 RECALCULAR TARJETAS SUPERIORES (KPIs) SEGÚN FILTROS ACTIVOS
  const kpisFiltrados = React.useMemo(() => {
    if (!datosHistoricos) return { totalMeses: 0, totalAlertas: 0, totalMonto: 0 };

    let universoAfectado = empleadosSeleccionados.length > 0 
      ? alertasFiltradas.filter(a => empleadosSeleccionados.some(e => e.cedula === a.cedula))
      : alertasFiltradas;

    universoAfectado = universoAfectado.filter(a => {
      if (agrupacionGrafica === 'EMPLEADOS' || agrupacionGrafica === 'SELECCIONADOS') {
        if (lineasOcultas[a.nombre] || lineasOcultas[`costo_${a.nombre}`]) return false;
      }
      if (agrupacionGrafica === 'SEDES') {
        if (lineasOcultas[a.unidad] || lineasOcultas[`costo${a.unidad}`]) return false;
      }
      return true;
    });

    let totalMonto = 0;
    
    // 💡 ANTI-BUG: Agregamos busqueda === '' para que el recuadro obedezca a los nombres escritos
    const vistaGlobalPura = empleadosSeleccionados.length === 0 && 
                            busqueda === '' && 
                            filtroPeriodo === 'TODOS' && 
                            filtroUnidad === 'TODOS' && 
                            filtroProceso.length === 0 && 
                            filtroCargo.length === 0 && 
                            filtroConceptoJornada.length === 0 && 
                            filtroAlerta === 'TODOS' && 
                            Object.values(lineasOcultas).every(v => !v);

    if (vistaGlobalPura) {
      totalMonto = modoDashboard === 'JORNADA' ? datosHistoricos.totalCostoExtras : datosHistoricos.totalFugaTransporte;
    } else {
      totalMonto = universoAfectado.reduce((acc, a) => {
        if (agrupacionGrafica === 'CONCEPTOS' && a.desgloseConceptosJornada) {
          let sumaVisible = 0;
          Object.entries(a.desgloseConceptosJornada).forEach(([concepto, metricas]) => {
            if (filtroConceptoJornada.length > 0 && !filtroConceptoJornada.includes(concepto)) return;
            if (lineasOcultas[concepto] || lineasOcultas[`costo_${concepto}`]) return;
            sumaVisible += metricas.valor;
          });
          return acc + sumaVisible;
        }

        if (filtroPeriodo !== 'TODOS' && a.fugaPorMes && a.fugaPorMes[filtroPeriodo]) {
          return acc + a.fugaPorMes[filtroPeriodo];
        }
        return acc + (a.totalDineroVisual || 0);
      }, 0);
    }

    const totalAlertas = universoAfectado.length; 

    const periodosUnicos = new Set();
    universoAfectado.forEach(a => {
      if (a.periodosFuga) a.periodosFuga.forEach(p => periodosUnicos.add(p));
      if (a.mesesConNovedad) a.mesesConNovedad.forEach(p => periodosUnicos.add(p));
    });

    const totalMeses = filtroPeriodo !== 'TODOS' ? 1 : (periodosUnicos.size || datosHistoricos.totalMeses);

    return {
      totalMeses,
      totalAlertas,
      totalMonto
    };
  }, [datosHistoricos, alertasFiltradas, filtroPeriodo, empleadosSeleccionados, lineasOcultas, agrupacionGrafica, filtroConceptoJornada, filtroUnidad, filtroProceso, filtroCargo, filtroAlerta, modoDashboard, busqueda]);
 // 📊 CÁLCULO DE DATA PARA BARRAS APILADAS POR TRABAJADOR
  const dataGraficasApiladas = React.useMemo(() => {
    if (!alertasFiltradas || alertasFiltradas.length === 0) return [];

    let baseParaMostrar = [];

    // 🛡️ ANTI-CONGELAMIENTO: Si no hay nadie seleccionado, graficamos máximo 20 para no explotar la RAM del navegador. La tabla inferior mostrará a todos de igual forma.
    if (empleadosSeleccionados.length > 0) {
      baseParaMostrar = alertasFiltradas.filter(a => empleadosSeleccionados.some(e => e.cedula === a.cedula));
    } else {
      baseParaMostrar = alertasFiltradas.slice(0, 20); 
    }

    return baseParaMostrar.map(emp => {
      const resumen = {
        nombre: emp.nombre.split(' ').slice(0, 2).join(' '),
        nombreCompleto: emp.nombre,
        cedula: emp.cedula,
      };

      if (emp.desgloseConceptosJornada) {
        Object.entries(emp.desgloseConceptosJornada).forEach(([concepto, metricas]) => {
          if (filtroConceptoJornada.length === 0 || filtroConceptoJornada.includes(concepto)) {
            resumen[`hrs_${concepto}`] = metricas.horas || 0;
            resumen[`val_${concepto}`] = metricas.valor || 0;
          }
        });
      }

     return resumen;
    });
  }, [alertasFiltradas, empleadosSeleccionados, limiteTop, filtroConceptoJornada, agrupacionGrafica]);
  
  // 🧠 LÓGICA DE VELOCIDAD: Agrupar marcaciones por empleado
  const resumenMarcaciones = React.useMemo(() => {
    if (!datosMarcaciones) return [];
    const agrupado = {};

    datosMarcaciones.forEach(row => {
        if (filtroEmpresaMarcaciones !== 'TODAS' && row.Empresa !== filtroEmpresaMarcaciones) return;
        
        if (!agrupado[row.Empleado]) {
            agrupado[row.Empleado] = { Empresa: row.Empresa, Empleado: row.Empleado, dias: 0, Total_Recargos_Dia: 0 };
        }
        agrupado[row.Empleado].dias += 1;
        agrupado[row.Empleado].Total_Recargos_Dia += (row.Total_Recargos_Dia || 0);
    });

    return Object.values(agrupado).sort((a, b) => b.Total_Recargos_Dia - a.Total_Recargos_Dia);
  }, [datosMarcaciones, filtroEmpresaMarcaciones]);

  // 📆 HELPER PARA ETIQUETA DE SEMANA
  const obtenerEtiquetaSemana = (fechaStr) => {
    if (!fechaStr || fechaStr === 'Sin Fecha') return 'Desconocida';
    const parts = fechaStr.split('-');
    if (parts.length !== 3) return fechaStr;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(d.getTime())) return fechaStr;
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNo = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `Sem ${String(weekNo).padStart(2, '0')} (${parts[0]}-${parts[1]})`;
  };

  const obtenerNombreDia = (fechaStr) => {
    if (!fechaStr || fechaStr === 'Sin Fecha') return '';
    const parts = fechaStr.split('-');
    if (parts.length !== 3) return '';
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(d.getTime())) return '';
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[d.getDay()];
  };

// 🗓️ MARCACIONES FILTRADAS Y ORDENADAS CRONOLÓGICAMENTE (CON SOPORTE TOTAL AL CLIC)
  const marcacionesEmpleadoSeleccionado = React.useMemo(() => {
    if (!datosMarcaciones || empleadosSeleccionados.length === 0) return [];
    
    let base = datosMarcaciones.filter(d => esMismoEmpleado(d.Empleado, empleadosSeleccionados[0].nombre));
    
    if (filtroEmpresaMarcaciones !== 'TODAS') {
      base = base.filter(d => d.Empresa === filtroEmpresaMarcaciones);
    }

    if (filtroQuincenaMarcaciones !== 'TODAS') {
      base = base.filter(d => (d.Periodo_Corte || calcularQuincenaCorte(d.Fecha)) === filtroQuincenaMarcaciones);
    }

    // 🖱️ CEREBRO INTERACTIVO DE LA TABLA
    if (filtroClicGrafica) {
      base = base.filter(d => {
        const dFecha = d.Fecha || '';
        const dQuincena = d.Periodo_Corte || calcularQuincenaCorte(dFecha);
        const dSemana = obtenerEtiquetaSemana(dFecha);
        
        if (granularidadMarcaciones === 'MES') return dFecha.startsWith(filtroClicGrafica);
        if (granularidadMarcaciones === 'QUINCENA') return dQuincena === filtroClicGrafica;
        if (granularidadMarcaciones === 'SEMANA') return dSemana === filtroClicGrafica;
        if (granularidadMarcaciones === 'DIA') return dFecha === filtroClicGrafica;
        return true;
      });
    }

    return base.sort((a, b) => {
      const fA = a.Fecha || '';
      const fB = b.Fecha || '';
      return ordenMarcacionesTabla === 'ASC' ? fA.localeCompare(fB) : fB.localeCompare(fA);
    });
  }, [datosMarcaciones, empleadosSeleccionados, filtroEmpresaMarcaciones, filtroQuincenaMarcaciones, filtroClicGrafica, granularidadMarcaciones, ordenMarcacionesTabla]);

  const listaQuincenasUnicas = React.useMemo(() => {
    if (!datosMarcaciones || empleadosSeleccionados.length === 0) return [];
    const setQ = new Set();
    datosMarcaciones
      .filter(d => esMismoEmpleado(d.Empleado, empleadosSeleccionados[0].nombre))
      .forEach(d => {
        const q = d.Periodo_Corte || calcularQuincenaCorte(d.Fecha);
        if (q && q !== 'Sin Fecha' && q !== 'Desconocido') setQ.add(q);
      });
    return Array.from(setQ).sort();
  }, [datosMarcaciones, empleadosSeleccionados]);

  // 📊 DATA DINÁMICA PARA LA GRÁFICA (Aislamos la data sin el filtroClic para que no desaparezcan las otras barras)
  const dataGraficaMarcaciones = React.useMemo(() => {
    if (!datosMarcaciones || empleadosSeleccionados.length === 0) return [];
    let baseGrafica = datosMarcaciones.filter(d => esMismoEmpleado(d.Empleado, empleadosSeleccionados[0].nombre));
    if (filtroQuincenaMarcaciones !== 'TODAS') {
      baseGrafica = baseGrafica.filter(d => (d.Periodo_Corte || calcularQuincenaCorte(d.Fecha)) === filtroQuincenaMarcaciones);
    }

    if (granularidadMarcaciones === 'DIA') {
      return baseGrafica.map(d => ({
        ejeX: d.Fecha,
        Total_Recargos_Dia: d.Total_Recargos_Dia || 0,
        Horario: d.Horario,
        HT: d.HT
      })).sort((a, b) => a.ejeX.localeCompare(b.ejeX));
    }

    const mapaAgrupado = {};

    baseGrafica.forEach(d => {
      let llaveEje = d.Fecha;
      if (granularidadMarcaciones === 'SEMANA') llaveEje = obtenerEtiquetaSemana(d.Fecha);
      else if (granularidadMarcaciones === 'QUINCENA') llaveEje = d.Periodo_Corte || calcularQuincenaCorte(d.Fecha);
      else if (granularidadMarcaciones === 'MES') llaveEje = d.Fecha ? d.Fecha.substring(0, 7) : 'Desconocido';

      if (!mapaAgrupado[llaveEje]) {
        mapaAgrupado[llaveEje] = { ejeX: llaveEje, Total_Recargos_Dia: 0, diasConRecargo: 0 };
      }
      mapaAgrupado[llaveEje].Total_Recargos_Dia += (d.Total_Recargos_Dia || 0);
      mapaAgrupado[llaveEje].diasConRecargo += 1;
    });

    return Object.values(mapaAgrupado).sort((a, b) => a.ejeX.localeCompare(b.ejeX));
  }, [datosMarcaciones, empleadosSeleccionados, filtroQuincenaMarcaciones, granularidadMarcaciones]);

// 🤖 CEREBRO INTELIGENTE: CRUZAR LO SELECCIONADO EN MARCACIONES CON LA NÓMINA PAGADA
  const statsEmpleadoMarcaciones = React.useMemo(() => {
    if (!marcacionesEmpleadoSeleccionado || marcacionesEmpleadoSeleccionado.length === 0) {
      return { totalDias: 0, totalCosto: 0, primeraFecha: '-', ultimaFecha: '-', alertaInteligente: null };
    }
    const totalDias = marcacionesEmpleadoSeleccionado.length;
    const totalCosto = marcacionesEmpleadoSeleccionado.reduce((acc, d) => acc + (d.Total_Recargos_Dia || 0), 0);
    const fechas = marcacionesEmpleadoSeleccionado.map(d => d.Fecha).filter(Boolean).sort();
    
// Cruce inteligente con la data de Nómina (NARRATIVA FORENSE CORREGIDA Y PRECISA)
    let alertaInteligente = { texto: "Inspeccionando...", color: "bg-slate-50", textCol: "text-slate-600", icono: "ℹ️" };
    
    const empNomina = datosHistoricos?.empleadosStatsMaster?.find(a => 
                          a.cedula === empleadosSeleccionados[0].cedula || 
                          esMismoEmpleado(a.nombre, empleadosSeleccionados[0].nombre)
                      ) || 
                      alertasFiltradas.find(a => 
                          a.cedula === empleadosSeleccionados[0].cedula || 
                          esMismoEmpleado(a.nombre, empleadosSeleccionados[0].nombre)
                      );
    
    if (empNomina && empNomina.desgloseJornadaPorMes) {
      let totalPagadoNomina = (empNomina.totalValorExtras || 0) + (empNomina.totalValorRecargos || 0);
      const diffGeneral = Math.round(totalPagadoNomina - totalCosto);
      
      if (diffGeneral > 500) {
         alertaInteligente = { texto: `🚨 Sobrepago de Nómina (+$${diffGeneral.toLocaleString('es-CO')})`, color: "bg-rose-50 border-rose-200", textCol: "text-rose-700", icono: "⚠️" };
      } else if (diffGeneral < -500) {
         alertaInteligente = { texto: `🚨 Dinero Faltante en Nómina (-$${Math.abs(diffGeneral).toLocaleString('es-CO')})`, color: "bg-orange-50 border-orange-200", textCol: "text-orange-700", icono: "⚠️" };
      } else {
         alertaInteligente = { texto: `✅ Cuadre Exacto con Nómina (Dif: $0)`, color: "bg-emerald-50 border-emerald-200", textCol: "text-emerald-700", icono: "✅" };
      }

      // 🧠 MOTOR DE NARRATIVA AUDITORA EN TIEMPO REAL
      const baseBiometricoFull = datosMarcaciones ? datosMarcaciones.filter(d => esMismoEmpleado(d.Empleado, empleadosSeleccionados[0].nombre)) : [];
      
      const bioPorMes = {};
      baseBiometricoFull.forEach(m => {
         if (!m.Fecha || m.Fecha === 'Sin Fecha') return;
         const mesKey = m.Fecha.substring(0, 7).replace('-', '/');
         if (!bioPorMes[mesKey]) {
            bioPorMes[mesKey] = { costoTotal: 0, festivosDias: 0, turnosTotal: 0 };
         }
         const recargo = parsearMonto(m.Total_Recargos_Dia);
         bioPorMes[mesKey].costoTotal += recargo;
         bioPorMes[mesKey].turnosTotal += 1;
         
         // Se detecta jornada festiva si el recargo del día es superior a $0
         if (recargo > 0) {
            bioPorMes[mesKey].festivosDias += 1;
         }
      });

      const discrepancias = [];
      Object.keys(empNomina.desgloseJornadaPorMes).forEach(mesKey => {
         const dataNomMes = empNomina.desgloseJornadaPorMes[mesKey];
         const pagoNominaExtras = dataNomMes.valor || 0;
         const bioMes = bioPorMes[mesKey] || { costoTotal: 0, festivosDias: 0, turnosTotal: 0 };
         
         const diffMes = Math.round(pagoNominaExtras - bioMes.costoTotal);
         if (diffMes > 5000) {
            discrepancias.push({ mesKey, pagoNominaExtras, bioMes, diffMes });
         }
      });

      discrepancias.sort((a, b) => b.diffMes - a.diffMes);

      const nombresMesesMap = { '01':'Enero', '02':'Febrero', '03':'Marzo', '04':'Abril', '05':'Mayo', '06':'Junio', '07':'Julio', '08':'Agosto', '09':'Septiembre', '10':'Octubre', '11':'Noviembre', '12':'Diciembre' };
      const nombreEmpleado = empleadosSeleccionados[0].nombre.split(' ')[0] || 'El colaborador';

      empNomina.historiaForense = discrepancias.slice(0, 2).map((d, index) => {
         const [ano, mesNum] = d.mesKey.split('/');
         const nombreMesStr = (nombresMesesMap[mesNum] || mesNum).toUpperCase();
         
         let subtituloContexto = index === 0 ? '(El mayor descuadre)' : '(Descuadre Crítico)';
         if (nombreMesStr === 'ABRIL') subtituloContexto = '(El pico de Semana Santa)';
         if (nombreMesStr === 'JULIO') subtituloContexto = '(El mayor descuadre de festivos)';

         let detalleReloj = '';
         if (d.bioMes.costoTotal > 0) {
            detalleReloj = `${nombreEmpleado} registró ${d.bioMes.festivosDias} día(s) con recargos/festivos en el reloj. Por esos días, generó un costo real de $${d.bioMes.costoTotal.toLocaleString('es-CO')} COP.`;
         } else {
            detalleReloj = `${nombreEmpleado} no registró marcaciones con recargos en el reloj para este mes ($0 COP).`;
         }

         return {
            titulo: `${index + 1}. ${nombreMesStr} DE ${ano} ${subtituloContexto}`,
            reloj: detalleReloj,
            nomina: `El software contable le liquidó un total de $${d.pagoNominaExtras.toLocaleString('es-CO')} COP en recargos y extras.`,
            diferencia: `Se le pagaron +$${d.diffMes.toLocaleString('es-CO')} COP de más (dinero sin soporte físico suficiente en el reloj).`
         };
      });
    } else {
      alertaInteligente = { texto: "No hay datos de nómina cargados para este empleado.", color: "bg-slate-100", textCol: "text-slate-500", icono: "ℹ️" };
    }

    return {
      totalDias,
      totalCosto,
      primeraFecha: fechas[0] || '-',
      ultimaFecha: fechas[fechas.length - 1] || '-',
      alertaInteligente,
      empNominaRaw: empNomina
    };
  }, [marcacionesEmpleadoSeleccionado, datosHistoricos, alertasFiltradas, empleadosSeleccionados, filtroQuincenaMarcaciones, filtroClicGrafica, granularidadMarcaciones, datosMarcaciones]);
    return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
     <div className="bg-slate-900 rounded-xl shadow-2xl p-6 border border-slate-800 text-white mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">🕵️‍♂️</div>
        <h2 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <span>📉</span> Dashboard Histórico Inteligente (GCM)
        </h2>
        <p className="text-slate-400 mb-4 text-sm max-w-2xl">
          Analítica forense y financiera para múltiples períodos consolidados desde la Nube.
        </p>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <button onClick={() => setModoDashboard('JORNADA')} className={`px-4 py-2 font-bold rounded-lg transition-all ${modoDashboard === 'JORNADA' ? 'bg-pink-600 text-white shadow-lg ring-2 ring-pink-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            ⏱️ Nómina: Extras
          </button>
          <button onClick={() => setModoDashboard('TRANSPORTE')} className={`px-4 py-2 font-bold rounded-lg transition-all ${modoDashboard === 'TRANSPORTE' ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            🚗 Nómina: Transporte
          </button>
          <div className="w-px h-8 bg-slate-700 mx-2"></div>
          <button onClick={() => setModoDashboard('MARCACIONES')} className={`px-4 py-2 font-bold rounded-lg transition-all ${modoDashboard === 'MARCACIONES' ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            ⏰ Analítica Biométrica
          </button>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-lg border border-slate-700 w-fit">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Bases en la Nube</p>
            <p className="text-xl font-bold text-cyan-400">{listaBases.length} Períodos</p>
          </div>
          <button 
id="btn-ejecutar-escaner"
            onClick={ejecutarAnalisisForense}
disabled={isAnalyzing || listaBases.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isAnalyzing ? '⏳ Procesando Big Data...' : '🚀 Ejecutar Escáner Histórico'}
          </button>
        </div>
      </div>

      {datosHistoricos && (modoDashboard === 'JORNADA' || modoDashboard === 'TRANSPORTE') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Períodos Analizados</p>
              <h3 className="text-3xl font-extrabold text-slate-800">{kpisFiltrados.totalMeses} <span className="text-sm font-medium text-slate-400">meses/quincenas</span></h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm">
              <p className="text-xs font-bold text-rose-600 uppercase">Alertas Crónicas Detectadas</p>
              <h3 className="text-3xl font-extrabold text-rose-700">
                {kpisFiltrados.totalAlertas} 
                <span className="text-sm font-medium text-rose-400"> empleados</span>
              </h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
              <p className="text-xs font-bold text-amber-600 uppercase">
                {modoDashboard === 'JORNADA' ? 'Costo Histórico Extras' : 'Fuga Financiera (Transporte)'}
              </p>
              <h3 className="text-3xl font-extrabold text-amber-700">
                ${kpisFiltrados.totalMonto.toLocaleString('es-CO')}
              </h3>
            </div>
          </div>

          {/* 📊 MÓDULO DE TENDENCIAS MENSUALES */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                📈 {modoDashboard === 'JORNADA' ? 'Comportamiento Histórico de Tiempo Suplementario' : 'Evolución de Fuga Financiera en Subsidios de Transporte'} (Mes a Mes)
              </h3>
              <div className="flex items-center gap-3">
{/* 📏 SELECTOR DE MÉTRICA (Horas vs Dinero) */}
                {modoDashboard === 'JORNADA' && alertasFiltradas.length > 0 && (
                  <select
                    value={metricaGrafica}
                    onChange={(e) => setMetricaGrafica(e.target.value)}
                    className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 shadow-sm outline-none cursor-pointer animate-in fade-in"
                  >
                    <option value="HORAS">⏱️ Ver en Horas</option>
                    <option value="DINERO">💰 Ver en Dinero</option>
                  </select>
                )}

              {/* 💡 SELECTOR MANUAL DE AGRUPACIÓN GRÁFICA (CON DESPLEGABLE DE SELECCIONADOS) */}
                {modoDashboard === 'JORNADA' && alertasFiltradas.length > 0 && (
                  <select 
                    value={agrupacionGrafica}
                    onChange={(e) => setAgrupacionGrafica(e.target.value)}
                    className={`text-xs font-bold rounded px-2 py-1 shadow-sm outline-none cursor-pointer transition-all ${
                      agrupacionGrafica === 'SELECCIONADOS'
                        ? 'bg-indigo-600 text-white border border-indigo-700 ring-2 ring-indigo-300'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    <option value="SEDES">🏢 Agrupar líneas por Sedes</option>
                    {empleadosSeleccionados.length > 0 && (
                      <option value="SELECCIONADOS">👥 Comparar Seleccionados ({empleadosSeleccionados.length})</option>
                    )}
                    {alertasFiltradas.length <= 40 && <option value="EMPLEADOS">👤 Ver línea por Empleado</option>}
                    <option value="CONCEPTOS">📑 Ver línea por Conceptos</option>
                  </select>
                )}
                <button 
                  onClick={() => setVerTendencias(!verTendencias)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded border border-blue-200"
                >
                  {verTendencias ? '🙈 Ocultar Gráfica' : '👁️ Ver Detalle de Evolución'}
                </button>
              </div>
            </div>

           {/* 👥 PANEL INTERACTIVO DE COMPARACIÓN DIRECTA (JUNTO A LA GRÁFICA) */}
           {empleadosSeleccionados.length > 0 && (
              <div className="my-3 bg-indigo-50/90 border border-indigo-200 p-3 rounded-xl shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <span>👥</span> Personas en Comparación Directa ({empleadosSeleccionados.length}):
                  </span>
                  <button 
                    onClick={() => {
                      setEmpleadosSeleccionados([]);
                      setAgrupacionGrafica('SEDES');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                  >
                    ✕ Vaciar Todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {empleadosSeleccionados.map((emp) => (
                    <div 
                      key={emp.cedula} 
                      className="flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md animate-in fade-in"
                    >
                      <span>👤 {emp.nombre.split(' ').slice(0, 2).join(' ')}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const resto = empleadosSeleccionados.filter(e => e.cedula !== emp.cedula);
                          setEmpleadosSeleccionados(resto);
                          if (resto.length === 0) setAgrupacionGrafica('SEDES');
                        }}
                        className="text-indigo-200 hover:text-white font-black text-sm cursor-pointer border-l border-indigo-400 pl-1.5"
                        title="Desmarcar y quitar de la gráfica"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

           {verTendencias && (
              <div className="pt-4 border-t border-slate-100 space-y-6">
                {/* 📈 GRÁFICA INTERACTIVA COMPARATIVA DINÁMICA */}
                <div className="h-80 w-full bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tendenciasDinamicas}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="mes" tickFormatter={formatearMes} stroke="#475569" fontSize={11} fontWeight="bold" />
                      
                      {/* Eje Y Principal (Izquierda) adaptativo para Fugas, Horas o Dinero */}
                      <YAxis 
                        yAxisId="left" 
                        stroke="#475569" 
                        fontSize={11} 
                        tickFormatter={(val) => (modoDashboard === 'JORNADA' && metricaGrafica === 'DINERO') ? `$${(val / 1000000).toFixed(1)}M` : val}
                      />
                      
                      {/* Eje Y Secundario (Derecha) solo para Devengado (escala de millones) */}
                      {modoDashboard === 'TRANSPORTE' && (
                        <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={11} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                      )}

                     <Tooltip 
                        itemSorter={(item) => -item.value}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        labelFormatter={(label) => formatearMes(label)}
                        formatter={(value, name) => {
                          if (modoDashboard === 'TRANSPORTE') return [`$${Number(value).toLocaleString('es-CO')}`, name];
                          return [name.includes('Costo') ? `$${Number(value).toLocaleString('es-CO')}` : `${Number(value).toFixed(1)} hrs`, name];
                        }}
                      />

                          {/* 💡 MAGIA: Leyenda interactiva (clic para tachar y ocultar líneas) */}
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        onClick={(e) => {
                          if (e && e.dataKey) {
                            setLineasOcultas(prev => ({ ...prev, [e.dataKey]: !prev[e.dataKey] }));
                          }
                        }}
                        formatter={(value, entry) => (
                          <span style={{ 
                            color: lineasOcultas[entry.dataKey] ? '#cbd5e1' : entry.color, 
                            textDecoration: lineasOcultas[entry.dataKey] ? 'line-through' : 'none',
                            transition: 'all 0.3s ease'
                          }}>
                            {value}
                          </span>
                        )}
                      />
                      
{modoDashboard === 'JORNADA' ? (
                        <>
                         {/* 💡 1. Modo CONCEPTOS CRUZADOS CON EMPLEADOS */}
                          {agrupacionGrafica === 'CONCEPTOS' ? (
                            (() => {
                              if (empleadosSeleccionados.length > 0) {
                                let lineasConceptosMultiples = [];
                                let colorIdx = 0;
                                const colores = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#d946ef', '#14b8a6', '#f97316', '#6366f1'];
                                
                                const empleadosAAnalizar = alertasFiltradas.filter(a => empleadosSeleccionados.some(e => e.cedula === a.cedula));
                                
                                empleadosAAnalizar.forEach(emp => {
                                  datosHistoricos.conceptosJornada.forEach(conceptoName => {
                                    if (filtroConceptoJornada.length > 0 && !filtroConceptoJornada.includes(conceptoName)) return;
                                    if (!emp.desgloseConceptosJornada || !emp.desgloseConceptosJornada[conceptoName]) return;
                                    
                                    const llaveCruzada = `${conceptoName}_${emp.cedula}`;
                                    const keyData = metricaGrafica === 'DINERO' ? `costo_${llaveCruzada}` : llaveCruzada;
                                    const nameEtiqueta = metricaGrafica === 'DINERO' ? `Costo ${conceptoName} 👤 ${emp.nombre.split(' ')[0]}` : `🔹 ${conceptoName} 👤 ${emp.nombre.split(' ')[0]}`;
                                    
                                    lineasConceptosMultiples.push(
                                      <Line key={`${emp.cedula}-${conceptoName}`} yAxisId="left" type="monotone" dataKey={keyData} name={nameEtiqueta} stroke={colores[colorIdx % colores.length]} strokeWidth={3} dot={{ r: 5 }} connectNulls={true} hide={lineasOcultas[keyData]} />
                                    );
                                    colorIdx++;
                                  });
                                });
                                return lineasConceptosMultiples;
                              } 
                              
                              return datosHistoricos.conceptosJornada.map((conceptoName, idx) => {
                                const colores = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#d946ef', '#14b8a6', '#f97316', '#6366f1'];
                                const keyData = metricaGrafica === 'DINERO' ? `costo_${conceptoName}` : conceptoName;
                                const nameEtiqueta = metricaGrafica === 'DINERO' ? `Costo 🔹 ${conceptoName}` : `🔹 ${conceptoName}`;
                                
                                if (filtroConceptoJornada.length > 0 && !filtroConceptoJornada.includes(conceptoName)) return null;
                                
                                let tieneValoresMes = false;
                                tendenciasDinamicas.forEach(mesData => {
                                  if (mesData[conceptoName] > 0 || mesData[`costo_${conceptoName}`] > 0) tieneValoresMes = true;
                                });
                                if (!tieneValoresMes) return null;

                                return <Line key={idx} yAxisId="left" type="monotone" dataKey={keyData} name={nameEtiqueta} stroke={colores[idx % colores.length]} strokeWidth={3} dot={{ r: 5 }} hide={lineasOcultas[keyData]} />;
                              });
                            })()
                         ) : agrupacionGrafica === 'SELECCIONADOS' || (agrupacionGrafica === 'EMPLEADOS' && alertasFiltradas.length <= 40) ? (
                            (() => {
                              let baseLineas = [];
                              if (empleadosSeleccionados.length > 0) {
                                baseLineas = alertasFiltradas.filter(a => empleadosSeleccionados.some(e => e.cedula === a.cedula));
                              } else {
                                baseLineas = alertasFiltradas;
                              }
                              return baseLineas.map((emp, idx) => {
                                const colores = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#d946ef', '#14b8a6', '#f97316', '#6366f1'];
                                const keyData = metricaGrafica === 'DINERO' ? `costo_${emp.nombre}` : emp.nombre;
                                const nameEtiqueta = metricaGrafica === 'DINERO' ? `Costo 👤 ${emp.nombre}` : `👤 ${emp.nombre}`;
                                return <Line key={emp.cedula} yAxisId="left" type="monotone" dataKey={keyData} name={nameEtiqueta} stroke={colores[idx % colores.length]} strokeWidth={3} dot={{ r: 4 }} hide={lineasOcultas[keyData]} />;
                              });
                            })()
                          ) : (
                            <>
                              <Line yAxisId="left" type="monotone" dataKey={metricaGrafica === 'DINERO' ? "costoADMIN" : "ADMIN"} name={metricaGrafica === 'DINERO' ? "Costo 🏢 Admin" : "🏢 Sede Administrativa"} stroke="#dc2626" strokeWidth={3} dot={{ r: 5 }} hide={lineasOcultas[metricaGrafica === 'DINERO' ? "costoADMIN" : "ADMIN"]} />
                              <Line yAxisId="left" type="monotone" dataKey={metricaGrafica === 'DINERO' ? "costoBALNEARIO" : "BALNEARIO"} name={metricaGrafica === 'DINERO' ? "Costo 🏊 Balneario" : "🏊 Balneario Santa Rosa"} stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} hide={lineasOcultas[metricaGrafica === 'DINERO' ? "costoBALNEARIO" : "BALNEARIO"]} />
                              <Line yAxisId="left" type="monotone" dataKey={metricaGrafica === 'DINERO' ? "costoECOPARQUE_HOTEL" : "ECOPARQUE_HOTEL"} name={metricaGrafica === 'DINERO' ? "Costo 🌲 Hotel" : "🌲 Hotel & Ecoparque"} stroke="#059669" strokeWidth={3} dot={{ r: 5 }} hide={lineasOcultas[metricaGrafica === 'DINERO' ? "costoECOPARQUE_HOTEL" : "ECOPARQUE_HOTEL"]} />
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <Line yAxisId="left" type="monotone" dataKey="fugaFAM" name="🚗 Fuga Termales (Fam)" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} hide={lineasOcultas["fugaFAM"]} />
                          <Line yAxisId="left" type="monotone" dataKey="fugaRECREFAM" name="🚗 Fuga RecreFam" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} hide={lineasOcultas["fugaRECREFAM"]} />
                          <Line yAxisId="right" type="monotone" dataKey="devengadoFAM" name="💰 Devengado Termales (Fam)" stroke="#f87171" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} hide={lineasOcultas["devengadoFAM"]} />
                          <Line yAxisId="right" type="monotone" dataKey="devengadoRECREFAM" name="💰 Devengado RecreFam" stroke="#60a5fa" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} hide={lineasOcultas["devengadoRECREFAM"]} />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 💳 TARJETAS DE MUESTRA MENSUAL RECALCULADAS EN TIEMPO REAL */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {tendenciasDinamicas.map((t, i) => {
                    const totalMesHoras = (t.ADMIN || 0) + (t.BALNEARIO || 0) + (t.ECOPARQUE_HOTEL || 0);
                    const totalMesCosto = (t.costoADMIN || 0) + (t.costoBALNEARIO || 0) + (t.costoECOPARQUE_HOTEL || 0);
                    return (
                      <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center shadow-sm hover:border-blue-300 transition">
                        <span className="text-xs font-extrabold text-indigo-900 block uppercase">{formatearMes(t.mes)}</span>
                        <div className="mt-2 space-y-1 font-mono text-[10px]">
                          {modoDashboard === 'JORNADA' ? (
                            <>
                              <p className="text-red-600 font-bold">Admin: {(t.ADMIN || 0).toFixed(1)} h</p>
                              <p className="text-blue-600 font-bold">Balneario: {(t.BALNEARIO || 0).toFixed(1)} h</p>
                              <p className="text-emerald-600 font-bold">Hotel: {(t.ECOPARQUE_HOTEL || 0).toFixed(1)} h</p>
                              <p className="text-xs font-extrabold text-slate-800 pt-1 border-t border-slate-200">
                                Total: {totalMesHoras.toFixed(1)} hrs
                              </p>
                              <p className="text-[11px] font-extrabold text-amber-700">${totalMesCosto.toLocaleString('es-CO')}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-red-600 font-bold">Fuga Fam: ${(t.fugaFAM || 0).toLocaleString('es-CO')}</p>
                              <p className="text-blue-600 font-bold">Fuga Rec: ${(t.fugaRECREFAM || 0).toLocaleString('es-CO')}</p>
                              <p className="text-[9px] text-slate-500 mt-1">Dev. Fam: ${(t.devengadoFAM || 0).toLocaleString('es-CO')}</p>
                              <p className="text-[9px] text-slate-500">Dev. Rec: ${(t.devengadoRECREFAM || 0).toLocaleString('es-CO')}</p>
                              <p className="text-xs font-extrabold text-slate-800 pt-1 border-t border-slate-200 mt-2">
                                Fuga Total Mensual
                              </p>
                              <p className="text-[11px] font-extrabold text-amber-700">${((t.fugaFAM || 0) + (t.fugaRECREFAM || 0)).toLocaleString('es-CO')}</p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 📊 GRÁFICAS APILADAS DE COMPOSICIÓN INDIVIDUAL (SÓLO EN MODO JORNADA) */}
                {modoDashboard === 'JORNADA' && (
                  <div className="grid grid-cols-1 gap-6 pt-6 border-t border-slate-200">
                    {/* 1. HORAS DE EXTRAS Y RECARGOS POR TRABAJADOR */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase mb-1">1. Horas de extras y recargos por trabajador</h4>
                      <p className="text-[11px] text-slate-500 mb-3">Comparación de las horas registradas por concepto acumulado.</p>
                      
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={empleadosSeleccionados.length > 0 ? dataGraficasApiladas.filter(d => empleadosSeleccionados.some(e => e.cedula === d.cedula)) : dataGraficasApiladas}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                            <XAxis dataKey="nombre" stroke="#475569" fontSize={11} fontWeight="bold" />
                            <YAxis stroke="#475569" fontSize={11} unit=" hrs" />
                            <Tooltip 
                              itemSorter={(item) => -item.value}
                              contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px' }}
                              formatter={(value, name) => [`${Number(value).toFixed(1)} hrs`, name.replace('hrs_', '')]}
                              labelFormatter={(label) => `👤 Trabajador: ${label}`}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                              onClick={(e) => {
                                if (e && e.dataKey) {
                                  setLineasOcultas(prev => ({ ...prev, [e.dataKey]: !prev[e.dataKey] }));
                                }
                              }}
                              formatter={(value, entry) => (
                                <span style={{ 
                                  color: lineasOcultas[entry.dataKey] ? '#cbd5e1' : entry.color, 
                                  textDecoration: lineasOcultas[entry.dataKey] ? 'line-through' : 'none',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {value}
                                </span>
                              )}
                            />
                            
                            {datosHistoricos?.conceptosJornada?.map((concepto, idx) => {
                              // 💡 Paleta ampliada de 15 colores para que ningún concepto se repita
                              const colores = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#d946ef', '#14b8a6', '#f97316', '#6366f1', '#eab308', '#84cc16', '#ec4899', '#0ea5e9', '#a855f7'];
                              if (filtroConceptoJornada.length > 0 && !filtroConceptoJornada.includes(concepto)) return null;
                              return (
                                <Bar 
                                  key={concepto} 
                                  dataKey={`hrs_${concepto}`} 
                                  name={concepto} 
                                  stackId="horas" 
                                  fill={colores[idx % colores.length]} 
                                  hide={lineasOcultas[`hrs_${concepto}`]}
                                />
                              );
                            })}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 2. VALOR PAGADO POR EXTRAS Y RECARGOS */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase mb-1">2. Valor pagado por extras y recargos</h4>
                      <p className="text-[11px] text-slate-500 mb-3">Valor acumulado registrado en nómina por concepto.</p>
                      
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={empleadosSeleccionados.length > 0 ? dataGraficasApiladas.filter(d => empleadosSeleccionados.some(e => e.cedula === d.cedula)) : dataGraficasApiladas}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                            <XAxis dataKey="nombre" stroke="#475569" fontSize={11} fontWeight="bold" />
                            <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                            <Tooltip 
                              itemSorter={(item) => -item.value}
                              contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '11px' }}
                              formatter={(value, name) => [`$${Number(value).toLocaleString('es-CO')} COP`, name.replace('val_', '')]}
                              labelFormatter={(label) => `👤 Trabajador: ${label}`}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                              onClick={(e) => {
                                if (e && e.dataKey) {
                                  setLineasOcultas(prev => ({ ...prev, [e.dataKey]: !prev[e.dataKey] }));
                                }
                              }}
                              formatter={(value, entry) => (
                                <span style={{ 
                                  color: lineasOcultas[entry.dataKey] ? '#cbd5e1' : entry.color, 
                                  textDecoration: lineasOcultas[entry.dataKey] ? 'line-through' : 'none',
                                  transition: 'all 0.3s ease'
                                }}>
                                  {value}
                                </span>
                              )}
                            />

                            {datosHistoricos?.conceptosJornada?.map((concepto, idx) => {
                              // 💡 Paleta ampliada de 15 colores para que ningún concepto se repita
                              const colores = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#d946ef', '#14b8a6', '#f97316', '#6366f1', '#eab308', '#84cc16', '#ec4899', '#0ea5e9', '#a855f7'];
                              if (filtroConceptoJornada.length > 0 && !filtroConceptoJornada.includes(concepto)) return null;
                              return (
                                <Bar 
                                  key={concepto} 
                                  dataKey={`val_${concepto}`} 
                                  name={concepto} 
                                  stackId="valor" 
                                  fill={colores[idx % colores.length]}
                                  hide={lineasOcultas[`val_${concepto}`]} 
                                />
                              );
                            })}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        {/* 📋 NUEVO: CUADRO RESUMEN PARA PRIORIZACIÓN DE AUDITORÍA */}
          {modoDashboard === 'JORNADA' && empleadosSeleccionados.length > 0 && dataGraficasApiladas.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-6 animate-in fade-in slide-in-from-top-4">
              <h3 className="text-lg font-extrabold text-slate-800 mb-2">Resumen de Colaboradores Seleccionados ({empleadosSeleccionados.length})</h3>
              <p className="text-sm text-slate-500 mb-4 border-b border-slate-100 pb-4">
                Consolidado exacto de las horas y valores totales de las personas que estás comparando.
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-slate-600 font-bold border-b-2 border-slate-200 bg-slate-50 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-center w-10">
                        <button onClick={() => { setEmpleadosSeleccionados([]); setAgrupacionGrafica('SEDES'); }} className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-100 px-2 py-1 rounded cursor-pointer transition-colors" title="Desmarcar a todos y cerrar tabla">✕ Vaciar</button>
                      </th>
                      <th className="py-3 px-4">Trabajador (Cédula)</th>
                      <th className="py-3 px-4">Desglose por Concepto (Horas)</th>
                      <th className="py-3 px-4 text-right">Total Horas</th>
                      <th className="py-3 px-4 text-right">Total Pagado</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dataGraficasApiladas
                      .filter(empData => empleadosSeleccionados.some(e => e.cedula === empData.cedula))
                      .map(empData => {
                        const empOriginal = alertasFiltradas.find(a => a.cedula === empData.cedula);
                        const totalHoras = empOriginal ? empOriginal.totalHorasVisual : 0;
                        const totalValor = empOriginal ? empOriginal.totalDineroVisual : 0;
                        return { ...empOriginal, totalHoras, totalValor };
                      })
                      .sort((a, b) => b.totalValor - a.totalValor)
                      .map((emp, idx) => {
                        return (
                        <tr key={idx} className="transition-colors group hover:bg-slate-50 bg-indigo-50/10">
                          <td className="py-4 px-4 text-center align-middle">
                            <input 
                              type="checkbox" 
                              checked={true}
                              onChange={() => {
                                setEmpleadosSeleccionados(prev => {
                                  const resto = prev.filter(x => x.cedula !== emp.cedula);
                                  if(resto.length === 0) setAgrupacionGrafica('SEDES');
                                  return resto;
                                });
                              }}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-800 align-middle">
                            {emp.nombre}
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{emp.cedula}</span>
                          </td>
                          <td className="py-4 px-4 align-middle">
                            {/* 💡 CUADRÍCULA ELEGANTE DE DESGLOSE DE CONCEPTOS (HORAS Y DINERO) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-w-[320px]">
                              {Object.entries(emp.desgloseConceptosJornada || {})
                                .sort((a, b) => b[1].horas - a[1].horas)
                                .map(([concepto, metricas], i) => (
                                  <div key={i} className="flex justify-between items-center bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm hover:border-indigo-300 transition-colors">
                                    <div className="flex flex-col overflow-hidden mr-2">
                                      <span className="font-bold text-slate-600 text-[9px] truncate" title={concepto}>
                                        {concepto}
                                      </span>
                                      <span className="font-extrabold text-emerald-600 text-[9px] mt-0.5">
                                        ${metricas.valor.toLocaleString('es-CO')}
                                      </span>
                                    </div>
                                    <span className="font-black text-indigo-700 shrink-0 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[9px]">
                                      {metricas.horas.toFixed(1)}h
                                    </span>
                                  </div>
                                ))
                              }
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right text-slate-700 font-mono font-black text-sm align-middle">
                            {emp.totalHoras.toFixed(1)} hrs
                          </td>
                          <td className="py-4 px-4 text-right font-extrabold text-slate-900 font-mono text-sm align-middle">
                            ${emp.totalValor.toLocaleString('es-CO')}
                          </td>
                          <td className="py-4 px-4 text-center align-middle">
                            <button 
                              onClick={() => setEmpleadoModal(emp)} 
                              className="text-[10px] font-bold text-blue-600 bg-white hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-blue-200 uppercase tracking-widest shadow-sm whitespace-nowrap"
                            >
                              Ver Detalle 🔍
                            </button>
                          </td>
                        </tr>
                        );
                      })
                    }
                    {/* Fila de Totales Generales del Cuadro */}
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-black">
                      <td colSpan="3" className="py-4 px-4 text-slate-800 uppercase tracking-wider text-right text-[10px]">Gran Total de Seleccionados:</td>
                      <td className="py-4 px-4 text-right text-rose-600 text-sm font-mono">
                        {dataGraficasApiladas
                          .filter(empData => empleadosSeleccionados.some(e => e.cedula === empData.cedula))
                          .reduce((acc, empData) => {
                            const emp = alertasFiltradas.find(a => a.cedula === empData.cedula);
                            return acc + (emp ? emp.totalHorasVisual : 0);
                          }, 0).toFixed(1)} hrs
                      </td>
                      <td className="py-4 px-4 text-right text-rose-600 text-sm font-mono">
                        ${dataGraficasApiladas
                          .filter(empData => empleadosSeleccionados.some(e => e.cedula === empData.cedula))
                          .reduce((acc, empData) => {
                            const emp = alertasFiltradas.find(a => a.cedula === empData.cedula);
                            return acc + (emp ? emp.totalDineroVisual : 0);
                          }, 0).toLocaleString('es-CO')}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

       {/* 🎛️ SUITE DE FILTROS INTERACTIVOS CON ETIQUETAS (CHIPS) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5 mt-6">
            {/* Buscador de Empleado, Menú Desplegable de Selección y Filtro de Período */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="w-full md:w-1/3 relative group">
                <label className="text-xs font-bold text-slate-600 block mb-1.5">🔍 Buscar Empleado:</label>
                <input 
                  type="text" 
                  placeholder="Nombre o Cédula..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 font-medium shadow-sm"
                />
                
                {/* 🎯 Dropdown de Autocompletado */}
                {busqueda.trim().length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden hidden group-focus-within:block hover:block">
                    {alertasFiltradas.filter(emp => emp.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()) || emp.cedula.includes(busqueda.trim())).length === 0 ? (
                      <p className="text-[10px] text-slate-400 p-3 text-center italic">No hay coincidencias.</p>
                    ) : (
                      <div className="p-1">
                        {alertasFiltradas
                          .filter(emp => emp.nombre.toLowerCase().includes(busqueda.toLowerCase().trim()) || emp.cedula.includes(busqueda.trim()))
                          .slice(0, 15) // Limitamos a 15 resultados para no saturar
                          .map(emp => {
                            const isSelected = empleadosSeleccionados.some(e => e.cedula === emp.cedula);
                            return (
                              <button
                                key={emp.cedula}
                                type="button"
                                onClick={() => {
                                  if (!isSelected) {
                                    setEmpleadosSeleccionados(prev => {
                                      const nuevos = [...prev, { cedula: emp.cedula, nombre: emp.nombre }];
                                      setAgrupacionGrafica('SELECCIONADOS');
                                      return nuevos;
                                    });
                                  }
                                  setBusqueda(''); // Limpiamos el buscador después de seleccionar
                                }}
                                className="w-full text-left p-2 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-between group/btn border border-transparent hover:border-indigo-100"
                              >
                                <div>
                                  <p className="text-[11px] font-bold text-slate-700">{emp.nombre}</p>
                                  <p className="text-[9px] text-slate-500 font-mono">{emp.cedula}</p>
                                </div>
                                {isSelected ? (
                                  <span className="text-[10px] text-emerald-600 font-bold px-2 py-0.5 bg-emerald-50 rounded-md">Añadido</span>
                                ) : (
                                  <span className="text-[10px] text-indigo-600 font-bold px-2 py-0.5 bg-indigo-50 rounded-md opacity-0 group-hover/btn:opacity-100 transition-opacity">Añadir +</span>
                                )}
                              </button>
                            );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/3 relative">
                <label className="text-xs font-bold text-slate-600 block mb-1.5">👥 Lista para Comparar:</label>
                <details className="group w-full">
                  <summary className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 font-bold text-indigo-700 shadow-sm bg-indigo-50 cursor-pointer list-none flex justify-between items-center transition-colors hover:bg-indigo-100">
                    <span>✅ Elegir Empleados ({empleadosSeleccionados.length})</span>
                    <span className="group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
                    <div className="flex gap-2 mb-1 border-b border-slate-100 pb-2">
                      <button 
                        type="button"
                        onClick={() => {
                          const todos = alertasFiltradas.map(a => ({cedula: a.cedula, nombre: a.nombre}));
                          setEmpleadosSeleccionados(todos);
                          if(todos.length > 0) setAgrupacionGrafica('SELECCIONADOS');
                        }} 
                        className="flex-1 text-[10px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 py-1.5 rounded shadow-sm transition-colors cursor-pointer text-center"
                      >
                        + Seleccionar Todos
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setEmpleadosSeleccionados([]);
                          setAgrupacionGrafica('SEDES');
                        }} 
                        className="flex-1 text-[10px] font-extrabold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 rounded shadow-sm transition-colors cursor-pointer text-center"
                      >
                        ✕ Vaciar
                      </button>
                    </div>

                    {alertasFiltradas.length === 0 && (
                      <p className="text-[10px] text-slate-400 text-center py-2">No hay empleados con los filtros actuales.</p>
                    )}

                    {alertasFiltradas.map(emp => {
                      const isChecked = empleadosSeleccionados.some(e => e.cedula === emp.cedula);
                      return (
                        <label key={emp.cedula} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 m-0">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEmpleadosSeleccionados(prev => {
                                  const nuevos = [...prev, { cedula: emp.cedula, nombre: emp.nombre }];
                                  if (nuevos.length > 0) setAgrupacionGrafica('SELECCIONADOS');
                                  return nuevos;
                                });
                              } else {
                                setEmpleadosSeleccionados(prev => {
                                  const resto = prev.filter(x => x.cedula !== emp.cedula);
                                  if (resto.length === 0) setAgrupacionGrafica('SEDES');
                                  return resto;
                                });
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-bold text-slate-700 leading-tight">
                            {emp.nombre}
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{emp.cargo}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </details>
              </div>

              <div className="w-full md:w-1/3">
                <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 Filtrar por Período / Quincena:</label>
                <select 
                  value={filtroPeriodo}
                  onChange={(e) => setFiltroPeriodo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-bold text-slate-700 shadow-sm bg-slate-50"
                >
                  <option value="TODOS">Todos los períodos analizados</option>
                  {datosHistoricos.tendencias.map(t => (
                     <option key={t.mes} value={t.mes}>{formatearMes(t.mes)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 🛒 BANDEJA DE EMPLEADOS SELECCIONADOS PARA COMPARAR */}
            {empleadosSeleccionados.length > 0 && (
              <div className="bg-indigo-50/80 border border-indigo-200 p-4 rounded-xl shadow-inner mt-2">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-black text-indigo-900 flex items-center gap-2">
                    <span>👥</span> Lista de Comparación Activa
                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                      {empleadosSeleccionados.length} listos para graficar
                    </span>
                  </label>
                  <button 
                    onClick={() => {
                      setEmpleadosSeleccionados([]);
                      setAgrupacionGrafica('SEDES');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-100 hover:bg-rose-200 px-3 py-1 rounded-lg border border-rose-200 transition cursor-pointer"
                  >
                    ✕ Vaciar Lista
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {empleadosSeleccionados.map((emp) => (
                    <div 
                      key={emp.cedula} 
                      className="flex items-center gap-2 bg-white border border-indigo-300 text-indigo-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm animate-in fade-in"
                    >
                      <span>👤 {emp.nombre.split(' ').slice(0, 2).join(' ')}</span>
                    <button
                        type="button"
                        onClick={() => {
                          const resto = empleadosSeleccionados.filter((e) => e.cedula !== emp.cedula);
                          setEmpleadosSeleccionados(resto);
                          if (resto.length === 0) {
                            setAgrupacionGrafica('SEDES');
                          }
                        }}
                        className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded px-1.5 font-black text-sm cursor-pointer transition-colors"
                        title="Desmarcar y quitar del análisis"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selector de Procesos por Etiquetas */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>⚙️</span> Procesos Activos 
                  <span className="text-[11px] font-normal text-slate-400">
                    ({filtroProceso.length === 0 ? 'Todos mostrados' : `${filtroProceso.length} seleccionados`})
                  </span>
                </label>
                {filtroProceso.length > 0 && (
                  <button 
                    onClick={() => setFiltroProceso([])} 
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                  >
                    ✕ Limpiar Selección ({filtroProceso.length})
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-200/60">
                {datosHistoricos.procesos.map((p, i) => {
                  const estaSeleccionado = filtroProceso.includes(p);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (estaSeleccionado) {
                          setFiltroProceso(filtroProceso.filter(item => item !== p));
                        } else {
                          setFiltroProceso([...filtroProceso, p]);
                        }
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        estaSeleccionado 
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {estaSeleccionado ? '✓ ' : '+ '}{p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selector de Cargos por Etiquetas */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>👔</span> Cargos Específicos
                  <span className="text-[11px] font-normal text-slate-400">
                    ({filtroCargo.length === 0 ? 'Todos mostrados' : `${filtroCargo.length} seleccionados`})
                  </span>
                </label>
                {filtroCargo.length > 0 && (
                  <button 
                    onClick={() => setFiltroCargo([])} 
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                  >
                    ✕ Limpiar Selección ({filtroCargo.length})
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-200/60">
                {datosHistoricos.cargos.map((c, i) => {
                  const estaSeleccionado = filtroCargo.includes(c);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (estaSeleccionado) {
                          setFiltroCargo(filtroCargo.filter(item => item !== c));
                        } else {
                          setFiltroCargo([...filtroCargo, c]);
                        }
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        estaSeleccionado 
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {estaSeleccionado ? '✓ ' : '+ '}{c}
                    </button>
                );
                })}
              </div>
            </div>

            {/* 💡 Selector de Conceptos de Nómina (SOLO PARA JORNADA) */}
            {modoDashboard === 'JORNADA' && datosHistoricos.conceptosJornada && (
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span>📑</span> Conceptos de Tiempo Suplementario
                    <span className="text-[11px] font-normal text-slate-400">
                      ({filtroConceptoJornada.length === 0 ? 'Todos mostrados' : `${filtroConceptoJornada.length} seleccionados`})
                    </span>
                  </label>
                  {filtroConceptoJornada.length > 0 && (
                    <button 
                      onClick={() => setFiltroConceptoJornada([])} 
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                    >
                      ✕ Limpiar Selección ({filtroConceptoJornada.length})
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50/50 rounded-lg border border-slate-200/60">
                  {datosHistoricos.conceptosJornada.map((c, i) => {
                    const estaSeleccionado = filtroConceptoJornada.includes(c);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (estaSeleccionado) {
                            setFiltroConceptoJornada(filtroConceptoJornada.filter(item => item !== c));
                          } else {
                            setFiltroConceptoJornada([...filtroConceptoJornada, c]);
                          }
                        }}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                          estaSeleccionado 
                            ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {estaSeleccionado ? '✓ ' : '+ '}{c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

{/* Segmentación por Sedes - DINÁMICO EN TIEMPO REAL CON PERÍODO */}  
            {(() => {
              // Colección filtrada por todo EXCEPTO por la unidad actual
              const basePeriodo = coleccionActiva.filter(a => {
                const term = busqueda.toLowerCase().trim();
                const coincideBusqueda = term !== '' && (a.nombre.toLowerCase().includes(term) || a.cedula.includes(term));
                
                const coincideProceso = filtroProceso.length === 0 ? true : filtroProceso.includes(a.proceso);
                const coincideCargo = filtroCargo.length === 0 ? true : filtroCargo.includes(a.cargo);
                
                let coincidePeriodo = true;
                if (filtroPeriodo !== 'TODOS') {
                   coincidePeriodo = modoDashboard === 'JORNADA' ? a.mesesConNovedad.has(filtroPeriodo) : a.periodosFuga.has(filtroPeriodo);
                }
                
                const cumpleFiltrosBase = coincideProceso && coincideCargo && coincidePeriodo;
                if (term !== '') return coincideBusqueda || cumpleFiltrosBase;
                return cumpleFiltrosBase;
              });

              return (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500 self-center mr-2">🏢 Unidad:</span>
                  <button
                    onClick={() => setFiltroUnidad('TODOS')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      filtroUnidad === 'TODOS' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🌐 Todas ({basePeriodo.length})
                  </button>
                  <button
                    onClick={() => setFiltroUnidad('ADMIN')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      filtroUnidad === 'ADMIN' ? 'bg-red-700 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🏢 Sede Administrativa ({basePeriodo.filter(a => a.unidad === 'ADMIN').length})
                  </button>
                  <button
                    onClick={() => setFiltroUnidad('BALNEARIO')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      filtroUnidad === 'BALNEARIO' ? 'bg-blue-700 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🏊 Balneario ({basePeriodo.filter(a => a.unidad === 'BALNEARIO').length})
                  </button>
                  <button
                    onClick={() => setFiltroUnidad('ECOPARQUE_HOTEL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      filtroUnidad === 'ECOPARQUE_HOTEL' ? 'bg-emerald-700 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    🌲 Hotel & Ecoparque / RecreFam ({basePeriodo.filter(a => a.unidad === 'ECOPARQUE_HOTEL').length})
                  </button>
                </div>
              );
            })()}
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span>⚠️</span> Ranking de Riesgo Histórico — <span className="text-blue-700 font-extrabold">{filtroUnidad}</span>
              </h3>
              
              {/* SELECTOR DE TIPO DE ALERTA (SOLO EN JORNADA) */}
              {modoDashboard === 'JORNADA' && (
                <div className="flex items-center gap-2 text-xs font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm">
                  <span className="text-slate-500">Filtrar Diagnóstico:</span>
                  <select 
                    value={filtroAlerta} 
                    onChange={(e) => setFiltroAlerta(e.target.value)}
                    className="bg-transparent border-none outline-none text-slate-800 cursor-pointer font-extrabold"
                  >
                    <option value="TODOS">🌐 Todas las Alertas</option>
                    <option value="FAVORITISMO">💰 Financiera / Favoritismo</option>
                    <option value="BURNOUT">🔥 Riesgo Burnout</option>
                    <option value="CARGO_CORPORATIVO">🚨 Cargo Corporativo</option>
                    <option value="RECURRENCIA">🔄 Recurrencia</option>
                  </select>
                </div>
              )}
            </div>
           <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-center" title="Seleccionar para Graficar">
                       <button onClick={() => setEmpleadosSeleccionados([])} className="text-[10px] text-blue-600 underline cursor-pointer">Vaciar</button>
                    </th>
                    <th className="p-4">Alerta</th>
                    <th className="p-4">Empleado</th>
                    <th className="p-4">Cargo / Proceso</th>
                    <th className="p-4 text-center">{modoDashboard === 'JORNADA' ? 'Periodos c/Extras' : 'Periodos c/Fuga'}</th>
                    <th className="p-4 text-right">{modoDashboard === 'JORNADA' ? 'Total Hrs Extras' : 'Total Fuga Financiera'}</th>
                    <th className="p-4">Diagnóstico del Motor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertasFiltradas.length === 0 ? (
                    <tr><td colSpan="7" className="p-8 text-center text-slate-500 italic">No se detectaron comportamientos anómalos.</td></tr>
                  ) : (
                    alertasFiltradas.map((alerta, idx) => {
                      const isChecked = empleadosSeleccionados.some(e => e.cedula === alerta.cedula);
                      return (
                      <tr key={idx} className={`transition-colors ${isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="p-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEmpleadosSeleccionados(prev => [...prev, { cedula: alerta.cedula, nombre: alerta.nombre }]);
                              } else {
                                setEmpleadosSeleccionados(prev => prev.filter(emp => emp.cedula !== alerta.cedula));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 text-center text-2xl" title={alerta.tipo}>{alerta.icono}</td>
                       <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEmpleadoModal(alerta)}
                              className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-blue-200 cursor-pointer text-xs font-bold flex items-center gap-1 shadow-sm"
                              title="Ver Desglose Forense Quincenal"
                            >
                              🔍
                            </button>
                            <div>
                              <span>{alerta.nombre}</span>
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{alerta.cedula}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-600 uppercase">{alerta.cargo}</td>
                        <td className="p-4 text-center font-bold text-indigo-600">
                          {alerta.mesesActivos} / {datosHistoricos.totalMeses}
                        </td>
                        <td className="p-4 text-right">
                          {modoDashboard === 'JORNADA' ? (
                            <>
                              <span className="font-extrabold text-rose-600 text-lg">{alerta.totalHorasVisual.toFixed(1)}</span> hrs
                              <span className="block text-[10px] text-slate-500 font-bold mt-0.5">${alerta.totalDineroVisual.toLocaleString('es-CO')}</span>
                            </>
                          ) : (
                            <span className="font-extrabold text-rose-600 text-lg">${alerta.totalDineroVisual.toLocaleString('es-CO')}</span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-700 font-medium max-w-md leading-relaxed">
                          {alerta.riesgo}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
{/* 🟣 NUEVO MÓDULO: MARCACIONES BIOMÉTRICAS */}
     {modoDashboard === 'MARCACIONES' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                 <div>
                     <h3 className="text-lg font-bold text-slate-800">Repositorio de Marcaciones (Biométrico)</h3>
                     <p className="text-sm text-slate-500">Sube y gestiona los reportes del reloj para cruzar con la nómina.</p>
                 </div>
                 <div className="flex gap-4 items-center">
                     {datosMarcaciones && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shadow-sm">
                            ✅ Nube Activa: {datosMarcaciones.length} turnos
                        </span>
                     )}
                     <label className="cursor-pointer bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm">
                        {isCargandoMarcaciones ? 'Procesando...' : '📂 Subir Archivo Excel'}
                        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={async (e) => {
                           await handleCargarMarcaciones(e);
                           obtenerListaMarcaciones().then(data => setListaMarcacionesBD(data));
                        }} />
                     </label>
                 </div>
             </div>

             {/* 📋 LISTA DE ARCHIVOS SUBIDOS CON BOTÓN ELIMINAR */}
             {listaMarcacionesBD.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                   <h4 className="text-xs font-bold text-slate-500 mb-2">ARCHIVOS ALOJADOS EN FIREBASE:</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-2">
                     {listaMarcacionesBD.map(archivo => (
                       <div key={archivo.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-sm">
                          <div>
                             <p className="text-[11px] font-bold text-slate-700">🗓️ Subido: {new Date(archivo.fechaCarga).toLocaleDateString('es-CO')}</p>
                             <p className="text-[10px] text-purple-600 font-mono font-semibold">{archivo.totalRegistros} turnos procesados</p>
                          </div>
                          <button 
                             onClick={() => handleEliminarMarcaciones(archivo.id)} 
                             disabled={isCargandoMarcaciones}
                             className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg font-black hover:bg-red-600 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                          >
                             🗑️ Borrar
                          </button>
                       </div>
                     ))}
                   </div>
                </div>
             )}
          </div>

          {datosMarcaciones && (
             <>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:w-1/3">
                        <label className="text-xs font-bold text-slate-600 block mb-1">Empresa:</label>
                        <select 
                            value={filtroEmpresaMarcaciones} 
                            onChange={(e) => setFiltroEmpresaMarcaciones(e.target.value)}
                            className="w-full p-2 rounded border border-slate-300 text-sm font-bold text-slate-700 bg-white"
                        >
                            <option value="TODAS">Ambas Empresas</option>
                            <option value="FAM SAS">FAM SAS (Termales)</option>
                            <option value="RECREFAM SAS">RECREFAM SAS</option>
                        </select>
                    </div>

                    {empleadosSeleccionados.length > 0 && (
                      <div className="w-full md:w-1/3">
                          <label className="text-xs font-bold text-slate-600 block mb-1">📅 Filtrar por Quincena de Corte:</label>
                          <select 
                              value={filtroQuincenaMarcaciones} 
                              onChange={(e) => setFiltroQuincenaMarcaciones(e.target.value)}
                              className="w-full p-2 rounded border border-indigo-300 text-sm font-bold text-indigo-900 bg-indigo-50/50"
                          >
                              <option value="TODAS">🌐 Todas las Quincenas (Enero - Agosto)</option>
                              {listaQuincenasUnicas.map(q => (
                                <option key={q} value={q}>🗓️ Quincena {q}</option>
                              ))}
                          </select>
                      </div>
                    )}

                    <div className="w-full md:w-1/3">
                        <label className="text-xs font-bold text-slate-600 block mb-1">Colaborador en Revisión:</label>
                        <div className="w-full p-2 rounded border border-purple-300 bg-purple-50 text-sm font-bold text-purple-800 flex justify-between items-center">
                            <span>{empleadosSeleccionados.length > 0 ? `👤 ${empleadosSeleccionados[0].nombre}` : 'Todos los colaboradores'}</span>
                            {empleadosSeleccionados.length > 0 && (
                                <button 
                                  onClick={() => {
                                    setEmpleadosSeleccionados([]);
                                    setFiltroQuincenaMarcaciones('TODAS');
                                  }} 
                                  className="text-xs font-bold bg-white hover:bg-rose-50 text-red-500 border border-red-200 px-2 py-0.5 rounded shadow-sm cursor-pointer transition-colors"
                                >
                                  ✕ Ver Todos
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 🔀 LÓGICA DE RENDERIZADO INTELIGENTE (RESUMEN VS DETALLE) */}
                {empleadosSeleccionados.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                        <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800">📊 Resumen General por Colaborador</h3>
                                <p className="text-xs text-slate-500 mt-0.5">La base tiene <strong>{datosMarcaciones.length.toLocaleString('es-CO')}</strong> registros. Se agruparon en <strong>{resumenMarcaciones.length}</strong> empleados para optimizar la velocidad.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-3">Empresa</th>
                                        <th className="p-3">Empleado</th>
                                        <th className="p-3 text-center">Total Días Registrados</th>
                                        <th className="p-3 text-right">Costo Recargos Total</th>
                                        <th className="p-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {resumenMarcaciones.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-xs font-bold text-slate-500">{row.Empresa}</td>
                                            <td className="p-3 font-bold text-slate-800">{row.Empleado}</td>
                                            <td className="p-3 text-center font-bold text-indigo-600">{row.dias} días auditados</td>
                                            <td className="p-3 text-right font-extrabold text-amber-600">${row.Total_Recargos_Dia.toLocaleString('es-CO')}</td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => {
                                                      setEmpleadosSeleccionados([{ cedula: '', nombre: row.Empleado }]);
                                                      setFiltroQuincenaMarcaciones('TODAS');
                                                    }}
                                                    className="px-3 py-1.5 bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-600 hover:text-white rounded-lg font-bold text-[10px] transition-colors shadow-sm uppercase tracking-wider cursor-pointer"
                                                >
                                                    Ver Detalle Forense 📉
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
{/* 💳 TARJETA DE RESUMEN GERENCIAL Y CONCILIACIÓN */}
                        <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 relative">
                                {filtroClicGrafica && (
                                  <button onClick={() => setFiltroClicGrafica(null)} className="absolute top-2 right-2 text-[9px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.5 rounded cursor-pointer hover:bg-rose-500 hover:text-white">✕ Quitar Filtro</button>
                                )}
                                <span className="text-[10px] font-extrabold text-purple-700 uppercase">Colaborador Auditado</span>
                                <h4 className="text-sm font-extrabold text-slate-800 mt-1 truncate" title={empleadosSeleccionados[0].nombre}>{empleadosSeleccionados[0].nombre}</h4>
                                <p className="text-[11px] text-purple-600 font-medium mt-0.5">
                                  {filtroClicGrafica ? `Filtrando por: ${filtroClicGrafica}` : (filtroQuincenaMarcaciones === 'TODAS' ? 'Histórico General' : `Quincena ${filtroQuincenaMarcaciones}`)}
                                </p>
                            </div>
                            <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                                <span className="text-[10px] font-extrabold text-indigo-700 uppercase">Días Analizados en Tabla</span>
                                <h4 className="text-xl font-black text-indigo-900 mt-1">{statsEmpleadoMarcaciones.totalDias} días</h4>
                                <p className="text-[10px] text-indigo-600 font-mono mt-0.5">{statsEmpleadoMarcaciones.primeraFecha} ➔ {statsEmpleadoMarcaciones.ultimaFecha}</p>
                            </div>
                            <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                                <span className="text-[10px] font-extrabold text-amber-700 uppercase">Costo Biométrico Mostrado</span>
                                <h4 className="text-xl font-black text-amber-800 mt-1">${statsEmpleadoMarcaciones.totalCosto.toLocaleString('es-CO')}</h4>
                                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Suma de la vista actual</p>
                            </div>
                            <div className={`p-3 rounded-lg flex flex-col justify-between ${statsEmpleadoMarcaciones.alertaInteligente?.color || 'bg-slate-50'}`}>
                                <div>
                                  <span className={`text-[10px] font-extrabold uppercase ${statsEmpleadoMarcaciones.alertaInteligente?.textCol || 'text-slate-700'}`}>Auditoría vs Nómina Nube</span>
                                  <p className={`text-xs font-bold mt-1 leading-tight ${statsEmpleadoMarcaciones.alertaInteligente?.textCol || 'text-slate-800'}`}>
                                    {statsEmpleadoMarcaciones.alertaInteligente?.texto}
                                  </p>
                                </div>
                                
                                {/* 🔍 BOTÓN FORENSE: Aparece solo si hay datos de nómina y si el motor detectó un error (🚨) o si el usuario quiere ver */}
                                {statsEmpleadoMarcaciones.empNominaRaw && (
                                  <button 
                                     onClick={() => setEmpleadoModal(statsEmpleadoMarcaciones.empNominaRaw)}
                                     className="mt-3 text-[10px] font-extrabold bg-white/80 hover:bg-white text-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-slate-300 cursor-pointer flex items-center justify-center gap-1.5 w-full transition-colors"
                                  >
                                     🔍 Ver Detalle en Nómina
                                  </button>
                                )}
                            </div>
                        </div>

                        {/* 📊 GRÁFICA INTERACTIVA CON GRANULARIDAD (DÍA, SEMANA, QUINCENA, MES) */}
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                              <div>
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                  <span>📉</span> Evolución de Marcaciones: <span className="text-purple-700">{empleadosSeleccionados[0].nombre}</span>
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {filtroClicGrafica 
                                    ? `Filtro activo: ${filtroClicGrafica} (Da clic afuera para quitarlo)` 
                                    : `Da clic en cualquier barra para filtrar la tabla inferior por ${granularidadMarcaciones.toLowerCase()}.`
                                  }
                                </p>
                              </div>

                              {/* 📏 SELECTOR DE GRANULARIDAD DE LA GRÁFICA */}
                              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                                <button 
                                  onClick={() => { setGranularidadMarcaciones('DIA'); setFiltroClicGrafica(null); }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-all ${granularidadMarcaciones === 'DIA' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                                >
                                  📅 Día
                                </button>
                                <button 
                                  onClick={() => { setGranularidadMarcaciones('SEMANA'); setFiltroClicGrafica(null); }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-all ${granularidadMarcaciones === 'SEMANA' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                                >
                                  📆 Semana
                                </button>
                                <button 
                                  onClick={() => { setGranularidadMarcaciones('QUINCENA'); setFiltroClicGrafica(null); }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-all ${granularidadMarcaciones === 'QUINCENA' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                                >
                                  🗓️ Quincena
                                </button>
                                <button 
                                  onClick={() => { setGranularidadMarcaciones('MES'); setFiltroClicGrafica(null); }}
                                  className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-all ${granularidadMarcaciones === 'MES' ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                                >
                                  📊 Mes
                                </button>
                              </div>
                            </div>

                            <div className="h-72 w-full cursor-pointer">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart 
                                      data={dataGraficaMarcaciones}
                                      onClick={(e) => {
                                        if (e && e.activeLabel) {
                                          const valorEjeX = String(e.activeLabel);
                                          if (filtroClicGrafica === valorEjeX) {
                                              setFiltroClicGrafica(null); // Quitar filtro si se clica el mismo
                                          } else {
                                              setFiltroClicGrafica(valorEjeX); // Aplicar filtro
                                          }
                                        } else {
                                          setFiltroClicGrafica(null); // Si da clic en lo blanco, quita el filtro
                                        }
                                      }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="ejeX" fontSize={10} stroke="#64748b" interval={granularidadMarcaciones === 'DIA' ? 'preserveStartEnd' : 0} />
                                        <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={(val) => `$${(val/1000)}k`} />
                                        <Tooltip formatter={(val) => `$${val.toLocaleString('es-CO')}`} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} cursor={{fill: '#f3e8ff'}} />
                                        <Legend />
                                        <Bar 
                                          yAxisId="left" 
                                          dataKey="Total_Recargos_Dia" 
                                          radius={[4, 4, 0, 0]} 
                                          name="Costo Generado ($)"
                                          shape={(props) => {
                                            const { x, y, width, height, payload } = props;
                                            const isSelected = filtroClicGrafica === payload.ejeX;
                                            const isFaded = filtroClicGrafica && !isSelected;
                                            return <rect x={x} y={y} width={width} height={height} fill={isFaded ? "#cbd5e1" : "#8b5cf6"} rx={4} ry={4} style={{transition: 'fill 0.3s'}}/>;
                                          }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 📋 TABLA DETALLADA CRONOLÓGICAMENTE ORDENADA */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-slate-50 p-3.5 border-b border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                  <span>📋</span> Turnos Auditados Día a Día ({marcacionesEmpleadoSeleccionado.length})
                                </span>

                                {/* ⬆️⬇️ CONTROL DE ORDENAMIENTO CRONOLÓGICO */}
                                <button
                                  onClick={() => setOrdenMarcacionesTabla(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                                  className="text-xs font-bold bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1 rounded-lg text-indigo-700 shadow-sm transition cursor-pointer flex items-center gap-1.5"
                                >
                                  {ordenMarcacionesTabla === 'ASC' ? '⬆️ Orden: Enero ➔ Agosto' : '⬇️ Orden: Agosto ➔ Enero'}
                                </button>
                            </div>

                            <div className="overflow-x-auto max-h-[500px]">
                              <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs sticky top-0 shadow-sm">
                                      <tr>
                                          <th className="p-3">Fecha del Turno</th>
                                          <th className="p-3">Día</th>
                                          <th className="p-3 text-center">Quincena de Corte</th>
                                          <th className="p-3">Horario Real Biométrico</th>
                                          <th className="p-3 text-center">Horas Trabs (HT)</th>
                                          <th className="p-3 text-right">Recargos Día ($)</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {marcacionesEmpleadoSeleccionado.length === 0 ? (
                                        <tr><td colSpan="6" className="p-6 text-center text-slate-400 italic">No hay marcaciones para los filtros seleccionados.</td></tr>
                                      ) : (
                                        marcacionesEmpleadoSeleccionado.map((row) => (
                                          <tr key={row.id} className="hover:bg-purple-50/60 transition-colors font-medium">
                                              <td className="p-3 whitespace-nowrap font-bold text-slate-800 font-mono">{row.Fecha}</td>
                                              <td className="p-3 text-xs font-semibold text-slate-500">{obtenerNombreDia(row.Fecha)}</td>
                                              <td className="p-3 text-center font-mono text-xs font-bold text-indigo-600 bg-indigo-50/50 rounded">{row.Periodo_Corte || calcularQuincenaCorte(row.Fecha)}</td>
                                              <td className="p-3 font-mono text-purple-700 font-bold bg-white rounded px-2">{row.Horario}</td>
                                              <td className="p-3 text-center font-bold text-slate-600">{row.HT}</td>
                                              <td className="p-3 text-right font-extrabold text-amber-600 font-mono">${row.Total_Recargos_Dia.toLocaleString('es-CO')}</td>
                                          </tr>
                                      )))}
                                  </tbody>
                              </table>
                            </div>
                        </div>
                    </div>
                )}
             </>
          )}
        </div>
      )}
      {empleadoModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative text-slate-800">
            
            {/* Header del Modal */}
            <div className="bg-slate-900 text-white p-6 sticky top-0 z-10 flex justify-between items-start border-b border-slate-800">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <span>🔍</span> Diagnóstico Forense de {modoDashboard !== 'TRANSPORTE' ? 'Tiempo Suplementario (Extras)' : 'Transporte y Rodamiento'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {empleadoModal.nombre} — Cédula: {empleadoModal.cedula} | Cargo: {empleadoModal.cargo}
                </p>
                
                {modoDashboard !== 'MARCACIONES' && (
                  <button onClick={() => irAMarcacionesEmpleado(empleadoModal)} className="mt-3 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded shadow-lg transition cursor-pointer border border-purple-500">
                    ⏰ Analizar Marcaciones Biométricas
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => setEmpleadoModal(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-rose-600 rounded-lg text-lg w-8 h-8 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Tarjetas KPI de Resumen Condicionales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modoDashboard !== 'TRANSPORTE' ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                      <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">Períodos con Novedad</p>
                      <h4 className="text-2xl font-black text-blue-800 mt-1">{empleadoModal.mesesConNovedad?.size || 0} mes(es)</h4>
                      <p className="text-xs text-blue-600 mt-0.5">Rastreado en la base histórica de nómina</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                      <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Costo Total Pagado en Nómina</p>
                      <h4 className="text-2xl font-black text-amber-800 mt-1">
                        ${(empleadoModal.totalDineroVisual !== undefined ? empleadoModal.totalDineroVisual : ((empleadoModal.totalValorExtras || 0) + (empleadoModal.totalValorRecargos || 0))).toLocaleString('es-CO')}
                      </h4>
                      <p className="text-xs text-amber-600 mt-0.5">Suma total pagada en recargos y horas extras</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                      <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Períodos Evaluados con Fuga</p>
                      <h4 className="text-2xl font-black text-emerald-800 mt-1">{empleadoModal.mesesActivos} mes(es)</h4>
                      <p className="text-xs text-emerald-600 mt-0.5">Rastreado en la base histórica de nómina</p>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                      <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">Auxilio Pagado Indebidamente</p>
                      <h4 className="text-2xl font-black text-rose-800 mt-1">${(empleadoModal.totalDineroVisual || 0).toLocaleString('es-CO')}</h4>
                      <p className="text-xs text-rose-600 mt-0.5">Suma total de auxilio de transporte girado sin derecho legal</p>
                    </div>
                  </>
                )}
              </div>

              {/* Dictamen del Motor (Solo si hay un riesgo detectado) */}
              {empleadoModal.riesgo && (
                <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl">
                  <p className="text-xs font-extrabold text-amber-800 uppercase mb-1 flex items-center gap-1">
                    📌 Dictamen Financiero Ejecutado por el Motor:
                  </p>
                  <p className="text-xs text-slate-700 font-medium whitespace-pre-line leading-relaxed">
                    {empleadoModal.riesgo}
                  </p>
                </div>
              )}

{/* Tablas de Desglose Condicionales */}
              <div>
                {modoDashboard !== 'TRANSPORTE' ? (
                  <>
                    {/* 🕵️‍♂️ MINI-ASISTENTE DE AUDITORÍA FORENSE (IA NARRATIVA) */}
                    {empleadoModal.historiaForense && empleadoModal.historiaForense.length > 0 && (
                      <div className="mb-6 bg-slate-900 border border-slate-800 p-5 rounded-xl text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">🤖</div>
                        <h4 className="text-sm font-black text-cyan-400 uppercase mb-4 flex items-center gap-2">
                          <span>🤖</span> Análisis de Inteligencia Forense:
                        </h4>
                        <div className="space-y-4 relative z-10">
                          {empleadoModal.historiaForense.map((h, i) => (
                            <div key={i} className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
                              <h5 className="font-bold text-amber-400 mb-2 text-xs">{h.titulo}</h5>
                              <ul className="text-xs text-slate-300 space-y-2 font-medium">
                                <li><strong className="text-white">Lo que marcó en el reloj:</strong> {h.reloj}</li>
                                <li><strong className="text-white">Lo que pagó la Nómina:</strong> {h.nomina}</li>
                                <li className="text-rose-400 font-bold bg-rose-500/10 inline-block px-2 py-1 rounded mt-1">{h.diferencia}</li>
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-1.5">
                      📊 Desglose de Conceptos Pagados en el ERP:
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                          <tr>
                            <th className="p-3">Concepto de Nómina</th>
                            <th className="p-3 text-right">Horas Totales</th>
                            <th className="p-3 text-right">Costo Total Pagado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {Object.entries(empleadoModal.desgloseConceptosJornada || {})
                            .sort((a, b) => b[1].valor - a[1].valor) // Ordenar de mayor a menor costo
                            .map(([concepto, data], i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-800">{concepto}</td>
                                <td className="p-3 text-right font-medium text-pink-700">{data.horas.toFixed(1)} hrs</td>
                                <td className="p-3 text-right font-extrabold text-amber-600">${data.valor.toLocaleString('es-CO')}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-1.5">
                      📊 Desglose de Transacciones Históricas:
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                          <tr>
                            <th className="p-3">Período</th>
                            <th className="p-3 text-right">Devengado Salarial</th>
                            <th className="p-3 text-right">Aux. Rodamiento</th>
                            <th className="p-3 text-right">Aux. Transporte Pagado</th>
                            <th className="p-3 text-center">Estado Incompatibilidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {Object.entries(empleadoModal.historialMeses || {})
                            .filter(([_, q]) => q.transportePagado > 0 || q.rodamientoPagado > 0)
                            .map(([qKey, qData], i) => {
                              const excedeTope = qData.devengadoSalarial > 3501810; // Tope mensual 2026
                              const tieneRodamiento = qData.rodamientoPagado > 0;
                              
                              return (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-800">Mes {qKey}</td>
                                  <td className="p-3 text-right font-medium">${(qData.devengadoSalarial || 0).toLocaleString('es-CO')}</td>
                                  <td className="p-3 text-right font-bold text-blue-600">${(qData.rodamientoPagado || 0).toLocaleString('es-CO')}</td>
                                  <td className="p-3 text-right font-extrabold text-rose-600">${(qData.transportePagado || 0).toLocaleString('es-CO')}</td>
                                  <td className="p-3 text-center">
                                    {tieneRodamiento && excedeTope ? (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-sans font-bold rounded-full text-[10px]">🚨 Rodamiento + Tope</span>
                                    ) : tieneRodamiento ? (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-sans font-bold rounded-full text-[10px]">⚠️ Incompatibilidad Rodamiento</span>
                                    ) : excedeTope ? (
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-sans font-bold rounded-full text-[10px]">⚠️ Excede 2 SMLMV</span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-sans font-medium rounded-full text-[10px]">Cumple Norma</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setEmpleadoModal(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
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

export default DashboardHistorico;