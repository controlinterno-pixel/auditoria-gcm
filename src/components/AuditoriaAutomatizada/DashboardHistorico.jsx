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
  const [lineasOcultas, setLineasOcultas] = useState({}); // 💡 Estado para ocultar/mostrar líneas con click


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
    obtenerListaHistoricos().then(data => setListaBases(data));

    // 2. Cargar histórico de Marcaciones Biométricas desde la NUBE (Firebase)
    cargarMarcacionesDeLaNube().then(dataNube => {
       if (dataNube && dataNube.length > 0) {
           setDatosMarcaciones(dataNube);
       }
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
  const handleCargarMarcaciones = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsCargandoMarcaciones(true);

    try {
      // 1. Leer el archivo físico
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      let todasLasMarcaciones = [];

      // 2. Recorrer todas las hojas del Excel (Ej: "FAM SAS", "RECREFAM SAS")
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        // 3. Limpiar y mapear los datos exactamente como los necesita el Dashboard
        const dataLimpia = jsonData.map((row, index) => ({
          id: `${sheetName}-${index}`,
          Empresa: row['Empresa'] || sheetName, 
          Empleado: row['Empleado'] || row['Nombre'] || 'Desconocido',
          Fecha: row['Fecha'] || '',
          Horario: row['Horario'] || row['Turno'] || 'Sin Registro',
          HT: row['HT'] || row['Horas'] || 0,
          Total_Recargos_Dia: parseFloat(row['Total_Recargos_Dia']) || parseFloat(row['Total_Recargos']) || 0,
        })).filter(row => row.Empleado !== 'Desconocido' && row.Total_Recargos_Dia > 0); 
        // Filtramos para ignorar filas vacías o días sin recargos y aligerar la memoria

        todasLasMarcaciones = [...todasLasMarcaciones, ...dataLimpia];
      });

      // 🛡️ ESCUDO ANTI-DUPLICADOS
      if (datosMarcaciones && datosMarcaciones.length > 0) {
         // Busca si hay al menos un registro en el Excel nuevo que coincida exactamente en Empleado y Fecha con la nube
         const posibleDuplicado = todasLasMarcaciones.find(nuevo => 
            datosMarcaciones.some(viejo => viejo.Empleado === nuevo.Empleado && viejo.Fecha === nuevo.Fecha)
         );

         if (posibleDuplicado) {
            const confirmar = window.confirm(`⚠️ ALERTA DE DUPLICIDAD:\n\nEl sistema detectó que ya existen marcaciones en la Nube para el mes que intentas subir (Ej: ${posibleDuplicado.Empleado} el ${posibleDuplicado.Fecha}).\n\nSi continúas, duplicarás los costos y horas de este período en tus gráficas.\n\n¿Estás completamente seguro de querer subir y guardar este archivo?`);
            
            if (!confirmar) {
               setIsCargandoMarcaciones(false);
               e.target.value = null; // Resetea el botón de subir
               return; // Aborta la operación sin guardar nada
            }
         }
      }

      // 4. GUARDAR EN LA NUBE (FIREBASE)
      await guardarMarcacionesEnLaNube(todasLasMarcaciones);

      // 5. Unir la data nueva con la vieja para que la gráfica se actualice de inmediato sin recargar la página
      const dataCombinada = datosMarcaciones ? [...datosMarcaciones, ...todasLasMarcaciones] : todasLasMarcaciones;
      setDatosMarcaciones(dataCombinada);
      
      alert(`✅ Se procesaron y guardaron ${todasLasMarcaciones.length} turnos exitosamente en la Nube.`);

    } catch (error) {
      console.error("Error leyendo Excel:", error);
      alert("❌ Hubo un error procesando el archivo Excel. Verifica que no esté corrupto.");
    } finally {
      setIsCargandoMarcaciones(false);
      e.target.value = null; // Resetea el input
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
  }, [alertasFiltradas, empleadosSeleccionados, filtroConceptoJornada]);
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
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-600 block mb-1">Empresa:</label>
                        <select 
                            value={filtroEmpresaMarcaciones} 
                            onChange={(e) => setFiltroEmpresaMarcaciones(e.target.value)}
                            className="w-full p-2 rounded border border-slate-300 text-sm font-bold text-slate-700"
                        >
                            <option value="TODAS">Ambas Empresas</option>
                            <option value="FAM SAS">FAM SAS (Termales)</option>
                            <option value="RECREFAM SAS">RECREFAM SAS</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-600 block mb-1">Colaborador en Revisión:</label>
                        <div className="w-full p-2 rounded border border-purple-300 bg-purple-50 text-sm font-bold text-purple-800 flex justify-between items-center">
                            {empleadosSeleccionados.length > 0 ? empleadosSeleccionados[0].nombre : 'Todos los colaboradores'}
                            {empleadosSeleccionados.length > 0 && (
                                <button onClick={() => setEmpleadosSeleccionados([])} className="text-xs font-bold bg-white text-red-500 px-2 py-1 rounded shadow-sm">✕ Limpiar</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-slate-800 mb-4">Comportamiento Diario (Marcaciones vs Recargos)</h4>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={datosMarcaciones.filter(d => empleadosSeleccionados.length === 0 || d.Empleado.includes(empleadosSeleccionados[0].nombre.split(' ')[0]))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="Fecha" fontSize={11} />
                                <YAxis yAxisId="left" />
                                <Tooltip formatter={(val) => `$${val.toLocaleString('es-CO')}`} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="Total_Recargos_Dia" fill="#a855f7" name="Costo Generado ($)" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-3">Empresa</th>
                                <th className="p-3">Empleado</th>
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Horario Real Biométrico</th>
                                <th className="p-3 text-center">Horas Trabs (HT)</th>
                                <th className="p-3 text-right">Recargos Día ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {datosMarcaciones
                                .filter(d => filtroEmpresaMarcaciones === 'TODAS' || d.Empresa === filtroEmpresaMarcaciones)
                                .filter(d => empleadosSeleccionados.length === 0 || d.Empleado.includes(empleadosSeleccionados[0].nombre.split(' ')[0]))
                                .map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-xs font-bold text-slate-500">{row.Empresa}</td>
                                    <td className="p-3 font-bold text-slate-800">{row.Empleado}</td>
                                    <td className="p-3">{row.Fecha}</td>
                                    <td className="p-3 font-mono text-purple-700 bg-purple-50 rounded px-2">{row.Horario}</td>
                                    <td className="p-3 text-center font-bold">{row.HT}</td>
                                    <td className="p-3 text-right font-extrabold text-amber-600">${row.Total_Recargos_Dia.toLocaleString('es-CO')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </>
          )}
        </div>
      )}
      {/* 🔍 MODAL DE DIAGNÓSTICO FORENSE MULTI-USO */}
      {empleadoModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative text-slate-800">
            
            {/* Header del Modal */}
            <div className="bg-slate-900 text-white p-6 sticky top-0 z-10 flex justify-between items-start border-b border-slate-800">
              <div>
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <span>🔍</span> Diagnóstico Forense de {modoDashboard === 'JORNADA' ? 'Tiempo Suplementario (Extras)' : 'Transporte y Rodamiento'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {empleadoModal.nombre} — Cédula: {empleadoModal.cedula} | Cargo: {empleadoModal.cargo}
                </p>
                
                {/* Aquí está el botón anidado correctamente */}
                <button onClick={() => irAMarcacionesEmpleado(empleadoModal)} className="mt-3 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded shadow-lg transition cursor-pointer border border-purple-500">
                  ⏰ Analizar Marcaciones Biométricas
                </button>
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
                {modoDashboard === 'JORNADA' ? (
                  <>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                      <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider">Períodos con Novedad</p>
                      <h4 className="text-2xl font-black text-blue-800 mt-1">{empleadoModal.mesesActivos} mes(es)</h4>
                      <p className="text-xs text-blue-600 mt-0.5">Rastreado en la base histórica de nómina</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                      <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Costo Total Sobretasa</p>
                      <h4 className="text-2xl font-black text-amber-800 mt-1">${(empleadoModal.totalDineroVisual || 0).toLocaleString('es-CO')}</h4>
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

              {/* Dictamen del Motor */}
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl">
                <p className="text-xs font-extrabold text-amber-800 uppercase mb-1 flex items-center gap-1">
                  📌 Dictamen Financiero Ejecutado por el Motor:
                </p>
                <p className="text-xs text-slate-700 font-medium whitespace-pre-line leading-relaxed">
                  {empleadoModal.riesgo}
                </p>
              </div>

              {/* Tablas de Desglose Condicionales */}
              <div>
                {modoDashboard === 'JORNADA' ? (
                  <>
                    <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-1.5">
                      📊 Desglose de Conceptos (Acumulado Histórico):
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
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