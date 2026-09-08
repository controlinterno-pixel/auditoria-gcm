// Ruta: src/components/AuditoriaAutomatizada/DashboardHistorico.jsx
import React, { useState, useEffect } from 'react';
import { obtenerListaHistoricos, cargarNominaHistorica } from '../../services/historicoService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [filtroProceso, setFiltroProceso] = useState([]); // Array para selección múltiple
  const [filtroCargo, setFiltroCargo] = useState([]);     // Array para selección múltiple
  const [filtroConceptoJornada, setFiltroConceptoJornada] = useState([]); // 💡 NUEVO FILTRO DE CONCEPTOS
const [verTendencias, setVerTendencias] = useState(false);
 const [modoDashboard, setModoDashboard] = useState('JORNADA'); // 'JORNADA' | 'TRANSPORTE'
  const [filtroPeriodo, setFiltroPeriodo] = useState('TODOS');   // 📅 NUEVO FILTRO
  const [filtroAlerta, setFiltroAlerta] = useState('TODOS');     // 🚨 NUEVO FILTRO DE ALERTA
  const [empleadoModal, setEmpleadoModal] = useState(null);      // 🔍 LUPITA 
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

  useEffect(() => {
    obtenerListaHistoricos().then(data => setListaBases(data));
  }, []);

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
        const conceptoLimpio = normalizarTexto(conceptoRaw);
        
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

        // ⏱️ RECOLECCIÓN JORNADA
        const esExtra = conceptoLimpio.includes('EXTRA DIURNA') || conceptoLimpio.includes('EXTRAS DIURNAS') ||
                        conceptoLimpio.includes('EXTRA NOCTURNA') || conceptoLimpio.includes('EXTRAS NOCTURNAS') ||
                        conceptoLimpio.includes('EXTRA FESTIVA') || conceptoLimpio.includes('EXTRAS FESTIVAS') ||
                        conceptoLimpio.includes('EXTRA DOMINICAL');
        
        const esRecargo = (conceptoLimpio.includes('RECARGO') && !conceptoLimpio.includes('EXTRA')) || 
                          conceptoLimpio.includes('NOCTURNO') || conceptoLimpio.includes('DOMINICAL');

        if (esExtra || esRecargo) {
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

// 🧠 FILTRADO DINÁMICO MULTI-SELECCIÓN (Afecta Tabla y Gráficas)
  const coleccionActiva = datosHistoricos ? (modoDashboard === 'JORNADA' ? datosHistoricos.alertasJornada : datosHistoricos.alertasTransporte) : [];
  
  // 💡 Mapeo previo para recalcular totales si hay un filtro de concepto activo
  const coleccionRecalculada = coleccionActiva.map(a => {
    if (modoDashboard === 'JORNADA' && filtroConceptoJornada.length > 0) {
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
    }
    return a;
  });

  const alertasFiltradas = coleccionRecalculada.filter(a => {
    // Si estamos en Jornada y filtramos por conceptos, ocultamos a los que no tengan ese concepto
    if (modoDashboard === 'JORNADA' && filtroConceptoJornada.length > 0 && a.totalHorasVisual === 0 && a.totalDineroVisual === 0) {
      return false;
    }

    const coincideUnidad = filtroUnidad === 'TODOS' ? true : a.unidad === filtroUnidad;
    
    const coincideProceso = filtroProceso.length === 0 ? true : filtroProceso.includes(a.proceso);
    const coincideCargo = filtroCargo.length === 0 ? true : filtroCargo.includes(a.cargo);
    
    const term = busqueda.toLowerCase().trim();
    const coincideBusqueda = term === '' ? true : 
      a.nombre.toLowerCase().includes(term) || 
      a.cedula.includes(term) ||
      (a.periodosFuga && Array.from(a.periodosFuga).some(p => p.toString().toLowerCase().includes(term))) ||
      (a.mesesConNovedad && Array.from(a.mesesConNovedad).some(p => p.toString().toLowerCase().includes(term)));

 // 📅 NUEVO FILTRO POR PERÍODO
    let coincidePeriodo = true;
    if (filtroPeriodo !== 'TODOS') {
      if (modoDashboard === 'JORNADA') {
         coincidePeriodo = a.mesesConNovedad.has(filtroPeriodo);
      } else {
         coincidePeriodo = a.periodosFuga.has(filtroPeriodo);
      }
    }

    // 🚨 NUEVO FILTRO POR TIPO DE ALERTA
    const coincideAlerta = filtroAlerta === 'TODOS' ? true : a.tipo === filtroAlerta;

    return coincideUnidad && coincideProceso && coincideCargo && coincideBusqueda && coincidePeriodo && coincideAlerta;
  });   

  // 📈 RECALCULAR TENDENCIA GRÁFICA SEGÚN LOS FILTROS ACTIVOS
  const calcularTendenciaDinamica = () => {
    if (!datosHistoricos) return [];

    // Detectar si el usuario está buscando un empleado específico
    const hayBusquedaEspecifica = busqueda.trim() !== '' && alertasFiltradas.length <= 3; // Menor a 3 por si hay homónimos

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

    alertasFiltradas.forEach(emp => {
      if (modoDashboard === 'JORNADA') {
        emp.mesesConNovedad.forEach(mes => {
          if (mapaMeses[mes] && emp.desgloseJornadaPorMes && emp.desgloseJornadaPorMes[mes]) {
            const u = emp.unidad;
            const dataMes = emp.desgloseJornadaPorMes[mes];
            
            // 💡 Si hay un empleado filtrado, creamos llaves por cada concepto dentro de ese mes
            if (hayBusquedaEspecifica) {
                Object.entries(dataMes.conceptos).forEach(([nombreConcepto, metricas]) => {
                   if (!mapaMeses[mes][nombreConcepto]) {
                       mapaMeses[mes][nombreConcepto] = 0;
                       mapaMeses[mes][`costo_${nombreConcepto}`] = 0;
                   }
                   mapaMeses[mes][nombreConcepto] += metricas.horas;
                   mapaMeses[mes][`costo_${nombreConcepto}`] += metricas.valor;
                });
            }

            // Mantenemos la lógica de Sedes y Filtro de Concepto Global
            if (filtroConceptoJornada.length > 0) {
               let horasFiltro = 0;
               let valorFiltro = 0;
               filtroConceptoJornada.forEach(c => {
                 if (dataMes.conceptos[c]) {
                   horasFiltro += dataMes.conceptos[c].horas;
                   valorFiltro += dataMes.conceptos[c].valor;
                 }
               });
               mapaMeses[mes][u] += horasFiltro;
               mapaMeses[mes][`costo${u}`] += valorFiltro;
            } else {
               mapaMeses[mes][u] += dataMes.horas;
               mapaMeses[mes][`costo${u}`] += dataMes.valor;
            }
          }
        });
      } else {
        if (emp.historialMeses) {
          Object.entries(emp.historialMeses).forEach(([mes, data]) => {
            if (mapaMeses[mes]) {
               // 1. Asignar Devengado Exacto por Empresa
               if (data.porEmpresa) {
                  mapaMeses[mes].devengadoFAM += (data.porEmpresa['FAM']?.devengado || 0);
                  mapaMeses[mes].devengadoRECREFAM += (data.porEmpresa['RECREFAM']?.devengado || 0);
               }

               // 2. Asignar Fuga Exacta por Empresa (Solo si hubo fuga real este mes)
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
  };

const tendenciasDinamicas = calcularTendenciaDinamica();

 // 🧮 RECALCULAR TARJETAS SUPERIORES (KPIs) SEGÚN FILTROS ACTIVOS
  const kpisFiltrados = React.useMemo(() => {
    if (!datosHistoricos) return { totalMeses: 0, totalAlertas: 0, totalMonto: 0 };

    let totalMonto = 0;
    
   // Si no hay filtros aplicados, mostramos el Gran Total de la compañía (Coincidiendo con el Excel)
    if (modoDashboard === 'JORNADA' && busqueda === '' && filtroUnidad === 'TODOS' && filtroProceso.length === 0 && filtroCargo.length === 0 && filtroPeriodo === 'TODOS' && filtroConceptoJornada.length === 0) {
      totalMonto = datosHistoricos.totalCostoExtras;
    } else {
      // Si hay filtros, sumamos solo lo que está visible en pantalla
      totalMonto = alertasFiltradas.reduce((acc, a) => {
        if (filtroPeriodo !== 'TODOS' && a.fugaPorMes && a.fugaPorMes[filtroPeriodo]) {
          return acc + a.fugaPorMes[filtroPeriodo];
        }
        return acc + (a.totalDineroVisual || 0);
      }, 0);
    }
    
    const totalAlertas = alertasFiltradas.length; 

    // Calcular cuántos períodos únicos están presentes en las alertas filtradas
    const periodosUnicos = new Set();
    alertasFiltradas.forEach(a => {
      if (a.periodosFuga) a.periodosFuga.forEach(p => periodosUnicos.add(p));
      if (a.mesesConNovedad) a.mesesConNovedad.forEach(p => periodosUnicos.add(p));
    });

    const totalMeses = filtroPeriodo !== 'TODOS' ? 1 : (periodosUnicos.size || datosHistoricos.totalMeses);

    return {
      totalMeses,
      totalAlertas,
      totalMonto
    };
  }, [datosHistoricos, alertasFiltradas, filtroPeriodo]);
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
          <button onClick={() => setModoDashboard('JORNADA')} className={`px-4 py-2 font-bold rounded-lg transition-all ${modoDashboard === 'JORNADA' ? 'bg-pink-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}>
            ⏱️ Analítica de Jornada (Extras)
          </button>
          <button onClick={() => setModoDashboard('TRANSPORTE')} className={`px-4 py-2 font-bold rounded-lg transition-all ${modoDashboard === 'TRANSPORTE' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}>
            🚗 Analítica de Fuga en Transporte
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

      {datosHistoricos && (
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
              <button 
                onClick={() => setVerTendencias(!verTendencias)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded border border-blue-200"
              >
                {verTendencias ? '🙈 Ocultar Gráfica' : '👁️ Ver Detalle de Evolución'}
              </button>
            </div>

           {verTendencias && (
              <div className="pt-4 border-t border-slate-100 space-y-6">
                {/* 📈 GRÁFICA INTERACTIVA COMPARATIVA DINÁMICA */}
                <div className="h-80 w-full bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tendenciasDinamicas}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                      <XAxis dataKey="mes" tickFormatter={formatearMes} stroke="#475569" fontSize={11} fontWeight="bold" />
                      
                      {/* Eje Y Principal (Izquierda) para Fugas y Horas */}
                      <YAxis yAxisId="left" stroke="#475569" fontSize={11} />
                      
                      {/* Eje Y Secundario (Derecha) solo para Devengado (escala de millones) */}
                      {modoDashboard === 'TRANSPORTE' && (
                        <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" fontSize={11} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                      )}

                     <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        labelFormatter={(label) => formatearMes(label)}
                        formatter={(value, name) => {
                          if (modoDashboard === 'TRANSPORTE') return [`$${Number(value).toLocaleString('es-CO')}`, name];
                          // Si es Jornada y la línea es de "Sede" normal (horas), pone hrs. Si es la oculta de "costo", pone $.
                          return [name.includes('Costo') ? `$${Number(value).toLocaleString('es-CO')}` : `${Number(value).toFixed(1)} hrs`, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      
{modoDashboard === 'JORNADA' ? (
                        <>
                          {/* 💡 Si el usuario buscó a un empleado específico, pintamos líneas por cada concepto */}
                          {busqueda.trim() !== '' && alertasFiltradas.length <= 3 ? (
                            datosHistoricos.conceptosJornada.map((conceptoName, idx) => {
                              // Solo pintamos los conceptos que el empleado realmente tuvo para no saturar la gráfica
                              const empleadoTieneConcepto = alertasFiltradas.some(e => e.desgloseConceptosJornada && e.desgloseConceptosJornada[conceptoName]);
                              if (!empleadoTieneConcepto) return null;
                              
                              // Asignamos colores vivos dinámicamente basados en el index del concepto
                              const colores = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#d946ef'];
                              const colorLinea = colores[idx % colores.length];
                              
                              return (
                                <Line key={idx} yAxisId="left" type="monotone" dataKey={conceptoName} name={`🔹 ${conceptoName}`} stroke={colorLinea} strokeWidth={3} dot={{ r: 4 }} />
                              );
                            })
                          ) : (
                            // Si NO hay búsqueda específica, mostramos la gráfica general por Sedes
                            <>
                              <Line yAxisId="left" type="monotone" dataKey="ADMIN" name="🏢 Sede Administrativa" stroke="#dc2626" strokeWidth={3} dot={{ r: 5 }} />
                              <Line yAxisId="left" type="monotone" dataKey="BALNEARIO" name="🏊 Balneario Santa Rosa" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
                              <Line yAxisId="left" type="monotone" dataKey="ECOPARQUE_HOTEL" name="🌲 Hotel & Ecoparque" stroke="#059669" strokeWidth={3} dot={{ r: 5 }} />
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <Line yAxisId="left" type="monotone" dataKey="fugaFAM" name="🚗 Fuga Termales (Fam)" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} />
                          <Line yAxisId="left" type="monotone" dataKey="fugaRECREFAM" name="🚗 Fuga RecreFam" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
                          <Line yAxisId="right" type="monotone" dataKey="devengadoFAM" name="💰 Devengado Termales (Fam)" stroke="#f87171" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} />
                          <Line yAxisId="right" type="monotone" dataKey="devengadoRECREFAM" name="💰 Devengado RecreFam" stroke="#60a5fa" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} />
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
              </div>
            )}
          </div>

       {/* 🎛️ SUITE DE FILTROS INTERACTIVOS CON ETIQUETAS (CHIPS) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
            {/* Buscador de Empleado y Filtro de Período */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-600 block mb-1.5">🔍 Buscar por Nombre o Cédula:</label>
                <input 
                  type="text" 
                  placeholder="Escribe un nombre o número de documento..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full max-w-lg px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-medium shadow-sm"
                />
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
                const coincideBusqueda = term === '' ? true : 
                  a.nombre.toLowerCase().includes(term) || a.cedula.includes(term);
                
                const coincideProceso = filtroProceso.length === 0 ? true : filtroProceso.includes(a.proceso);
                const coincideCargo = filtroCargo.length === 0 ? true : filtroCargo.includes(a.cargo);
                
                let coincidePeriodo = true;
                if (filtroPeriodo !== 'TODOS') {
                   coincidePeriodo = modoDashboard === 'JORNADA' ? a.mesesConNovedad.has(filtroPeriodo) : a.periodosFuga.has(filtroPeriodo);
                }
                return coincideBusqueda && coincideProceso && coincideCargo && coincidePeriodo;
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
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No se detectaron comportamientos anómalos.</td></tr>
                  ) : (
                    alertasFiltradas.map((alerta, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
      )}
    </div>
  );
};

export default DashboardHistorico;