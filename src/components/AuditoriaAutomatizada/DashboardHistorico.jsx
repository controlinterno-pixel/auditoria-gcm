// Ruta: src/components/AuditoriaAutomatizada/DashboardHistorico.jsx
import React, { useState, useEffect } from 'react';
import { obtenerListaHistoricos, cargarNominaHistorica } from '../../services/historicoService';

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
      let totalCostoExtrasCompania = 0;
      let totalCostoRecargosCompania = 0;

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

        if (!empleadosStats[cedula]) {
          empleadosStats[cedula] = {
            cedula, nombre, cargo,
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

        if (esExtra) {
          emp.totalHorasExtras += cantidad;
          emp.totalValorExtras += valor;
          emp.mesesConNovedad.add(mesOrigen);
          totalCostoExtrasCompania += valor;
        } else if (esRecargo) {
          emp.totalHorasRecargos += cantidad;
          emp.totalValorRecargos += valor;
          emp.mesesConNovedad.add(mesOrigen);
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
        alertas: alertasForences
      });

    } catch (error) {
      console.error(error);
      alert("❌ Error al procesar la data histórica.");
    } finally {
      setIsAnalyzing(false);
    }
  };

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

          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span>⚠️</span> Ranking de Riesgo Histórico y Tendencias
              </h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="p-4">Alerta</th>
                    <th className="p-4">Empleado</th>
                    <th className="p-4">Cargo</th>
                    <th className="p-4 text-center">Meses c/Extras</th>
                    <th className="p-4 text-right">Total Hrs Extras (Histórico)</th>
                    <th className="p-4">Diagnóstico del Motor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datosHistoricos.alertas.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No se detectaron comportamientos anómalos en el histórico.</td></tr>
                  ) : (
                    datosHistoricos.alertas.map((alerta, idx) => (
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