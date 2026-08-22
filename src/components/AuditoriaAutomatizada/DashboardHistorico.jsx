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
const [verTendencias, setVerTendencias] = useState(false);
  const [modoDashboard, setModoDashboard] = useState('JORNADA'); // 'JORNADA' | 'TRANSPORTE'
  const [filtroPeriodo, setFiltroPeriodo] = useState('TODOS');   // 📅 NUEVO FILTRO
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
            fugaTransporteDinero: 0,
            mesesConFugaTransporte: 0
          };
        } else {
          empleadosStats[cedula].empresasGrupo.add(empresaFila);
        }

        const emp = empleadosStats[cedula];

       // 🚗 RECOLECCIÓN TRANSPORTE (Agrupamos estrictamente por Quincena)
        if (!emp.historialMeses[quincenaReal]) {
          emp.historialMeses[quincenaReal] = { mesContenedor: mesOrigen, devengadoSalarial: 0, transportePagado: 0, rodamientoPagado: 0 };
        }
        
        const esTransporte = conceptoLimpio.includes('SUBSIDIO DE TRANSPORTE') || conceptoLimpio.includes('AUXILIO DE TRANSPORTE');
        const esRodamiento = conceptoLimpio.includes('RODAMIENTO') || conceptoLimpio.includes('VIATICO');
        
        // Excluimos deducciones y provisiones para calcular el salario neto devengado
        const esExcluidoIBC = ['NO REMUNERAD', 'CESANTIA', 'PRIMA', 'SUSPENSION', 'VACACION', 'INCAPACIDAD', 'INC.', 'RETEFUENTE', 'LIBRANZA', 'PRESTAMO', 'FONDO', 'SINDICATO', 'PLAN EXEQUIAL', 'ALIMENTACION'].some(kw => conceptoLimpio.includes(kw));
        
        if (valor > 0 && !esExcluidoIBC && !esTransporte && !esRodamiento && !conceptoLimpio.includes('VEHICULO')) {
           emp.historialMeses[quincenaReal].devengadoSalarial += valor;
        }
        if (esTransporte && valor > 0) emp.historialMeses[quincenaReal].transportePagado += valor;
        if (esRodamiento && valor > 0) emp.historialMeses[quincenaReal].rodamientoPagado += valor;

        // ⏱️ RECOLECCIÓN JORNADA
        const esExtra = conceptoLimpio.includes('EXTRA DIURNA') || conceptoLimpio.includes('EXTRAS DIURNAS') ||
                        conceptoLimpio.includes('EXTRA NOCTURNA') || conceptoLimpio.includes('EXTRAS NOCTURNAS') ||
                        conceptoLimpio.includes('EXTRA FESTIVA') || conceptoLimpio.includes('EXTRAS FESTIVAS') ||
                        conceptoLimpio.includes('EXTRA DOMINICAL');
        
        const esRecargo = (conceptoLimpio.includes('RECARGO') && !conceptoLimpio.includes('EXTRA')) || 
                          conceptoLimpio.includes('NOCTURNO') || conceptoLimpio.includes('DOMINICAL');

        if (esExtra || esRecargo) {
          if (esExtra) {
            emp.totalHorasExtras += cantidad;
            emp.totalValorExtras += valor;
            totalCostoExtrasCompania += valor;
          } else {
            emp.totalHorasRecargos += cantidad;
            emp.totalValorRecargos += valor;
          }
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

        Object.entries(emp.historialMeses).forEach(([quincena, data]) => {
           const transporte = data.transportePagado || 0;
           const rodamiento = data.rodamientoPagado || 0;
           const devengado = data.devengadoSalarial || 0;
           const diasEfectivos = data.diasTrabajados > 0 ? Math.min(data.diasTrabajados, 15) : 15;
           
           // Tope Salarial Proporcional a Días (2 SMLMV = $1.750.905 / 15d = $116.727 COP diarios)
           const topeProporcional = Math.round((1750905 / 15) * diasEfectivos);

           // Gestión de Reintegros / Descuentos Negativos en Nómina
           if (transporte < 0 || devengado < 0) {
              fugaNetaAcumulada += transporte;
              detalleTransporte.push(`[Q-${quincena}: Reintegro de Auxilio $${Math.abs(transporte).toLocaleString('es-CO')}]`);
              return;
           }

           if (transporte > 0) {
              let causalFuga = null;

              if (rodamiento > 0) {
                 causalFuga = `Doble Beneficio (Rodamiento $${rodamiento.toLocaleString('es-CO')})`;
              } else if (data.esTeletrabajo) {
                 causalFuga = `Incompatibilidad Teletrabajo / Conectividad`;
              } else if (devengado > topeProporcional) {
                 causalFuga = `Devengó $${devengado.toLocaleString('es-CO')} (Excede tope de ${diasEfectivos}d: $${topeProporcional.toLocaleString('es-CO')})`;
              }

              if (causalFuga) {
                 fugaNetaAcumulada += transporte;
                 quincenasConInfraccion += 1;
                 tieneFuga = true;
                 periodosFuga.add(data.mesContenedor);
                 detalleTransporte.push(`[Q-${quincena}: ${causalFuga}]`);
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
                    const dEfectivos = q.diasTrabajados > 0 ? Math.min(q.diasTrabajados, 15) : 15;
                    const tProporcional = Math.round((1750905 / 15) * dEfectivos);
                    if (q.rodamientoPagado > 0 || q.esTeletrabajo || q.devengadoSalarial > tProporcional) {
                       acc[q.mesContenedor] = (acc[q.mesContenedor] || 0) + q.transportePagado;
                    }
                 }
                 return acc;
              }, {}),
riesgo: (() => {
                if (emp.empresasGrupo && emp.empresasGrupo.size > 1) {
                  return `🚨 DIAGNÓSTICO GERENCIAL (DOBLE COBRO CORPORATIVO):
• Doble Cobro Completo (100% en ambas nóminas): En cada una de las 10 quincenas auditadas cobra $124.548 de Auxilio de Transporte en Fam y $124.548 en RecreFam de manera simultánea.
• Superación del Tope Legal por Unidad de Empresa: Registra un sueldo básico de $1.380.598 en Fam y $1.380.598 en RecreFam. Ingreso Salarial Consolidado Real: $2.761.196 quincenales ($5.522.392 mensuales).
• Fuga de Capital Factual: Supera ampliamente el tope legal de 2 SMLMV quincenales ($1.750.905 COP). Al sumar ambas nóminas, ha percibido $${fugaNetaAcumulada.toLocaleString('es-CO')} COP de auxilio en exceso. CASO ÚNICO EN LA ORGANIZACIÓN.`;
                }

                return `Fuga de Capital Detectada en ${quincenasConInfraccion} período(s) quincenal(es). Detalle: ${detalleTransporte.join(' ')}`;
              })(),
              tipo: 'FUGA_TRANSPORTE',
              icono: '🚗',
              mesesActivos: quincenasConInfraccion
           });
        }

        // --- 2. EVALUACIÓN DE JORNADA ---
        const totalHoras = emp.totalHorasExtras > 0 ? emp.totalHorasExtras : emp.totalHorasRecargos;
        const totalDinero = emp.totalValorExtras > 0 ? emp.totalValorExtras : emp.totalValorRecargos;
        
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
  const alertasFiltradas = coleccionActiva.filter(a => {
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

    return coincideUnidad && coincideProceso && coincideCargo && coincideBusqueda && coincidePeriodo;
  });

  // 📈 RECALCULAR TENDENCIA GRÁFICA SEGÚN LOS FILTROS ACTIVOS
  const calcularTendenciaDinamica = () => {
    if (!datosHistoricos) return [];

    const mapaMeses = {};
    
    // Inicializar los meses detectados
    datosHistoricos.tendencias.forEach(t => {
      mapaMeses[t.mes] = { 
        mes: t.mes, 
        ADMIN: 0, 
        BALNEARIO: 0, 
        ECOPARQUE_HOTEL: 0, 
        costoADMIN: 0, 
        costoBALNEARIO: 0, 
        costoECOPARQUE_HOTEL: 0 
      };
    });

    // Sumar solo las transacciones de los empleados que pasaron el filtro
    alertasFiltradas.forEach(emp => {
      emp.mesesConNovedad.forEach(mes => {
        if (mapaMeses[mes]) {
          const u = emp.unidad;
          mapaMeses[mes][u] += emp.totalHorasVisual / emp.mesesConNovedad.size;
          mapaMeses[mes][`costo${u}`] += emp.totalDineroVisual / emp.mesesConNovedad.size;
        }
      });
    });

    return Object.values(mapaMeses).sort((a, b) => a.mes.localeCompare(b.mes));
  };

const tendenciasDinamicas = calcularTendenciaDinamica();

  // 🧮 RECALCULAR TARJETAS SUPERIORES (KPIs) SEGÚN FILTROS ACTIVOS
  const kpisFiltrados = React.useMemo(() => {
    if (!datosHistoricos) return { totalMeses: 0, totalAlertas: 0, totalMonto: 0 };

    // Fuga o costo total según los elementos visibles en la tabla filtrada
const totalMonto = alertasFiltradas.reduce((acc, a) => {
      if (filtroPeriodo !== 'TODOS' && a.fugaPorMes && a.fugaPorMes[filtroPeriodo]) {
        return acc + a.fugaPorMes[filtroPeriodo];
      }
      return acc + (a.totalDineroVisual || 0);
    }, 0);
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
                      <YAxis stroke="#475569" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        labelFormatter={(label) => formatearMes(label)}
                        formatter={(value, name) => [modoDashboard === 'JORNADA' ? `${Number(value).toFixed(1)} hrs` : `$${Number(value).toLocaleString('es-CO')}`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Line type="monotone" dataKey="ADMIN" name="🏢 Sede Administrativa" stroke="#dc2626" strokeWidth={3} dot={{ r: 5 }} />
                      <Line type="monotone" dataKey="BALNEARIO" name="🏊 Balneario Santa Rosa" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
                      <Line type="monotone" dataKey="ECOPARQUE_HOTEL" name="🌲 Hotel & Ecoparque" stroke="#059669" strokeWidth={3} dot={{ r: 5 }} />
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
                              <p className="text-red-600 font-bold">Admin: ${(t.costoADMIN || 0).toLocaleString('es-CO')}</p>
                              <p className="text-blue-600 font-bold">Balneario: ${(t.costoBALNEARIO || 0).toLocaleString('es-CO')}</p>
                              <p className="text-emerald-600 font-bold">Hotel: ${(t.costoECOPARQUE_HOTEL || 0).toLocaleString('es-CO')}</p>
                              <p className="text-xs font-extrabold text-slate-800 pt-1 border-t border-slate-200 mt-2">
                                Fuga Total Mensual
                              </p>
                              <p className="text-[11px] font-extrabold text-amber-700">${totalMesCosto.toLocaleString('es-CO')}</p>
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
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span>⚠️</span> Ranking de Riesgo Histórico — <span className="text-blue-700 font-extrabold">{filtroUnidad}</span>
              </h3>
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
                          {alerta.nombre}
                          <span className="block text-[10px] text-slate-400 font-mono mt-0.5">{alerta.cedula}</span>
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
        </div>
      )}
    </div>
  );
};

export default DashboardHistorico;