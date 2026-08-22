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

const buscarColumna = (fila, aliasPosibles) => {
  if (!fila || typeof fila !== 'object') return undefined;
  const llavesExcel = Object.keys(fila);
  for (const alias of aliasPosibles) {
    const aliasNorm = normalizarTexto(alias).replace(/[\s_]/g, '');
    const llaveReal = llavesExcel.find(k => normalizarTexto(k).replace(/[\s_]/g, '') === aliasNorm);
    if (llaveReal !== undefined) return fila[llaveReal];
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

        dataPlana.forEach(t => t.mesOrigen = base.periodo);
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
        mesesDetectados.add(mesOrigen);

        const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
        const conceptoLimpio = normalizarTexto(conceptoRaw);
        
        const cantidad = parsearMonto(buscarColumna(fila, ['Cantidad', 'Horas', 'Cant', 'Minutos']));
        const valor = parsearMonto(buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'Total', 'Valor', 'Pago', 'Devengado']));
        const nombre = buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado']) || 'Sin Nombre';
        const cargo = buscarColumna(fila, ['Cargo', 'DesCargo', 'Ocupacion']) || 'Sin Cargo';
        const proceso = buscarColumna(fila, ['NombreCcosto', 'CentroCosto', 'Grupo']) || 'GENERAL';
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

        if (!empleadosStats[cedula]) {
          empleadosStats[cedula] = {
            cedula, nombre, cargo, proceso, unidad,
            totalHorasExtras: 0,
            totalValorExtras: 0,
            totalHorasRecargos: 0,
            totalValorRecargos: 0,
            mesesConNovedad: new Set()
          };
        }

        const emp = empleadosStats[cedula];

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

      const alertasForences = [];

      Object.values(empleadosStats).forEach(emp => {
        const totalHoras = emp.totalHorasExtras > 0 ? emp.totalHorasExtras : emp.totalHorasRecargos;
        const totalDinero = emp.totalValorExtras > 0 ? emp.totalValorExtras : emp.totalValorRecargos;
        
        if (totalHoras === 0 && totalDinero === 0) return;

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
          riesgo = `Alerta de Cargo Corporativo: Empleado administrativo (${emp.cargo}) acumuló ${totalHoras.toFixed(1)} hrs operativas. Requiere revisión estricta de autorización de horas extras en roles de oficina / soporte.`;
          tipo = 'CARGO_CORPORATIVO';
          icono = '🚨';
        } else if (emp.totalHorasExtras > 50 && mesesActivos >= 3) {
          riesgo = `Sobrecarga crónica: ${totalHoras.toFixed(1)} hrs en ${mesesActivos} meses. Promedio: ${promedioMensual.toFixed(1)} hrs/mes. Riesgo alto de fatiga laboral (Burnout) o posible asignación a dedo.`;
          tipo = 'BURNOUT';
          icono = '🔥';
        } else if (totalDinero > 1500000) {
          riesgo = `Alerta Financiera / Favoritismo: Ha cobrado $${totalDinero.toLocaleString('es-CO')} en recargos y extras. Revisar equidad en la rotación del equipo.`;
          tipo = 'FAVORITISMO';
          icono = '💰';
        } else if (mesesActivos >= 2 && totalHoras >= 10) {
          riesgo = `Comportamiento recurrente: Registra horas extras en ${mesesActivos} meses distintos. Requiere validación de que no sea un "bono salarial" disfrazado de tiempo extra.`;
          tipo = 'RECURRENCIA';
          icono = '🔄';
        }

        if (riesgo) {
          alertasForences.push({
            ...emp,
            totalHorasVisual: totalHoras,
            totalDineroVisual: totalDinero,
            riesgo,
            tipo,
            icono,
            mesesActivos
          });
        }
      });

      alertasForences.sort((a, b) => b.totalHorasVisual - a.totalHorasVisual);

      setDatosHistoricos({
        totalAnalizados: Object.keys(empleadosStats).length,
        totalMeses: mesesDetectados.size,
        totalCostoExtras: totalCostoExtrasCompania,
        alertas: alertasForences,
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
  const alertasFiltradas = datosHistoricos ? datosHistoricos.alertas.filter(a => {
    const coincideUnidad = filtroUnidad === 'TODOS' ? true : a.unidad === filtroUnidad;
    
    // Si no hay procesos seleccionados, muestra todos; de lo contrario, verifica si pertenece al grupo
    const coincideProceso = filtroProceso.length === 0 ? true : filtroProceso.includes(a.proceso);
    
    // Si no hay cargos seleccionados, muestra todos; de lo contrario, verifica el grupo
    const coincideCargo = filtroCargo.length === 0 ? true : filtroCargo.includes(a.cargo);
    
    const term = busqueda.toLowerCase().trim();
    const coincideBusqueda = term === '' ? true : 
      a.nombre.toLowerCase().includes(term) || a.cedula.includes(term);

    return coincideUnidad && coincideProceso && coincideCargo && coincideBusqueda;
  }) : [];

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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 rounded-xl shadow-2xl p-6 border border-slate-800 text-white mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">🕵️‍♂️</div>
        <h2 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <span>📉</span> Dashboard Histórico Anti-Fraude (BETA)
        </h2>
        <p className="text-slate-400 mb-6 text-sm max-w-2xl">
          Este módulo cruza todas las nóminas guardadas en la Nube (Firebase) para detectar patrones sospechosos a largo plazo, riesgo de "burnout" (fatiga) por horas extras crónicas y favoritismos ("carrusel").
        </p>

        <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700 w-fit">
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
              <h3 className="text-3xl font-extrabold text-slate-800">{datosHistoricos.totalMeses} <span className="text-sm font-medium text-slate-400">meses</span></h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm">
              <p className="text-xs font-bold text-rose-600 uppercase">Alertas Tempranas Detectadas</p>
              <h3 className="text-3xl font-extrabold text-rose-700">{datosHistoricos.alertas.length} <span className="text-sm font-medium text-rose-400">empleados</span></h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
              <p className="text-xs font-bold text-amber-600 uppercase">Costo Histórico Extras (Bases analizadas)</p>
              <h3 className="text-3xl font-extrabold text-amber-700">${datosHistoricos.totalCostoExtras.toLocaleString('es-CO')}</h3>
            </div>
          </div>

          {/* 📊 MÓDULO DE TENDENCIAS MENSUALES */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                📈 Comportamiento y Tendencia Histórica del Tiempo Suplementario (Mes a Mes)
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
                      <XAxis dataKey="mes" stroke="#475569" fontSize={11} fontWeight="bold" />
                      <YAxis stroke="#475569" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        formatter={(value, name) => [`${Number(value).toFixed(1)} hrs`, name]}
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
                        <span className="text-xs font-extrabold text-indigo-900 block">{t.mes}</span>
                        <div className="mt-2 space-y-1 font-mono text-[10px]">
                          <p className="text-red-600 font-bold">Admin: {(t.ADMIN || 0).toFixed(1)} h</p>
                          <p className="text-blue-600 font-bold">Balneario: {(t.BALNEARIO || 0).toFixed(1)} h</p>
                          <p className="text-emerald-600 font-bold">Hotel: {(t.ECOPARQUE_HOTEL || 0).toFixed(1)} h</p>
                          <p className="text-xs font-extrabold text-slate-800 pt-1 border-t border-slate-200">
                            Total: {totalMesHoras.toFixed(1)} hrs
                          </p>
                          <p className="text-[11px] font-extrabold text-amber-700">${totalMesCosto.toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        {/* 🎛️ SUITE DE FILTROS MULTI-SELECCIÓN MÚLTIPLE */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Buscador Nombre / Cédula */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">🔍 Buscar Empleado o Cédula:</label>
                <input 
                  type="text" 
                  placeholder="Escribe un nombre o número de cédula..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Filtra texto en tiempo real.</span>
              </div>

              {/* Selección Múltiple por Proceso */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500">⚙️ Procesos (Multiselección):</label>
                  {filtroProceso.length > 0 && (
                    <button onClick={() => setFiltroProceso([])} className="text-[10px] font-bold text-rose-600 hover:underline">
                      Limpiar ({filtroProceso.length})
                    </button>
                  )}
                </div>
                <select 
                  multiple
                  value={filtroProceso} 
                  onChange={(e) => {
                    const opciones = Array.from(e.target.selectedOptions, option => option.value);
                    setFiltroProceso(opciones);
                  }}
                  className="w-full h-24 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-medium overflow-y-auto"
                >
                  {datosHistoricos.procesos.map((p, i) => (
                    <option key={i} value={p} className="p-1 hover:bg-slate-100 rounded">{p}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Mantén presionado <b>Ctrl</b> (o Cmd) para elegir varios.</span>
              </div>

              {/* Selección Múltiple por Cargo */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-500">👔 Cargos (Multiselección):</label>
                  {filtroCargo.length > 0 && (
                    <button onClick={() => setFiltroCargo([])} className="text-[10px] font-bold text-rose-600 hover:underline">
                      Limpiar ({filtroCargo.length})
                    </button>
                  )}
                </div>
                <select 
                  multiple
                  value={filtroCargo} 
                  onChange={(e) => {
                    const opciones = Array.from(e.target.selectedOptions, option => option.value);
                    setFiltroCargo(opciones);
                  }}
                  className="w-full h-24 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white font-medium overflow-y-auto"
                >
                  {datosHistoricos.cargos.map((c, i) => (
                    <option key={i} value={c} className="p-1 hover:bg-slate-100 rounded">{c}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Mantén presionado <b>Ctrl</b> (o Cmd) para elegir varios.</span>
              </div>
            </div>

            {/* Segmentación por Sedes */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 self-center mr-2">🏢 Unidad:</span>
              <button
                onClick={() => setFiltroUnidad('TODOS')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filtroUnidad === 'TODOS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🌐 Todas ({datosHistoricos.alertas.length})
              </button>
              <button
                onClick={() => setFiltroUnidad('ADMIN')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filtroUnidad === 'ADMIN' ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🏢 Sede Administrativa ({datosHistoricos.alertas.filter(a => a.unidad === 'ADMIN').length})
              </button>
              <button
                onClick={() => setFiltroUnidad('BALNEARIO')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filtroUnidad === 'BALNEARIO' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🏊 Balneario ({datosHistoricos.alertas.filter(a => a.unidad === 'BALNEARIO').length})
              </button>
              <button
                onClick={() => setFiltroUnidad('ECOPARQUE_HOTEL')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filtroUnidad === 'ECOPARQUE_HOTEL' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🌲 Hotel & Ecoparque / RecreFam ({datosHistoricos.alertas.filter(a => a.unidad === 'ECOPARQUE_HOTEL').length})
              </button>
            </div>
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
                    <th className="p-4 text-center">Meses c/Extras</th>
                    <th className="p-4 text-right">Total Hrs Extras (Histórico)</th>
                    <th className="p-4">Diagnóstico del Motor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertasFiltradas.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No se detectaron comportamientos anómalos en esta unidad.</td></tr>
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
                          <span className="font-extrabold text-rose-600 text-lg">{alerta.totalHorasVisual.toFixed(1)}</span> hrs
                          <span className="block text-[10px] text-slate-500 font-bold mt-0.5">${alerta.totalDineroVisual.toLocaleString('es-CO')}</span>
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