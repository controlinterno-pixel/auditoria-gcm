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
        const cedulaRaw = fila['Identificacion'] || fila['Cedula'] || fila['Documento'] || fila['CEDULA'];
        if (!cedulaRaw) return;
        
        const cedula = cedulaRaw.toString().trim().replace(/\D/g, '');
        const mesOrigen = fila.mesOrigen;
        mesesDetectados.add(mesOrigen);

        const conceptoRaw = fila['NombreConcepto'] || fila['Concepto'] || fila['Nombre concepto'];
        const conceptoLimpio = normalizarTexto(conceptoRaw);
        
        const cantidad = parsearMonto(fila['Cantidad'] || fila['Horas'] || fila['Cant']);
        const valor = parsearMonto(fila['TotalDevengado'] || fila['ValorTotal'] || fila['Total'] || fila['Valor']);
        const nombre = fila['Nombres'] || fila['Nombre'] || fila['Empleado'] || 'Sin Nombre';
        const cargo = fila['Cargo'] || fila['DesCargo'] || 'Sin Cargo';

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

        // Detección Estricta: Extras vs Recargos
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
          totalCostoRecargosCompania += valor;
        }
      });

      // 🔥 MOTOR DE INFERENCIA DE ALERTAS INTELIGENTES
      const alertasForences = [];

      Object.values(empleadosStats).forEach(emp => {
        const totalTiempo = emp.totalHorasExtras + emp.totalHorasRecargos;
        const totalDinero = emp.totalValorExtras + emp.totalValorRecargos;
        if (totalTiempo === 0) return;

        const mesesActivos = emp.mesesConNovedad.size;
        let riesgo = null;
        let tipo = null;
        let icono = null;
        let color = null;

        const cargoLimpio = normalizarTexto(emp.cargo);

        // 🧠 Lexicón Exacto Termales: Cargos corporativos puros que NO deben cobrar recargos
        const palabrasClaveAdmin = [
          'CONTABLE', 'CONTABILIDAD', 'FINANCIER', 'TESORERIA', 'CARTERA',
          'TALENTO', 'GERENT', 'DIRECTOR', 'MEJORA', 'SISTEMAS', 'TICS', 
          'DESARROLLADOR', 'COMERCIAL', 'CONTACT CENTER', 'COMPRAS', 
          'MERCADEO', 'COMUNICACIONES', 'PLANEACION', 'FAMILY', 
          'ADMINISTRATIV', 'COSTOS', 'AUDITOR'
        ];

        // 🛡️ Excepciones: Cargos operativos que tienen palabras similares
        const excepcionesOperativas = [
          'AUDITORIA NOCTURNA', 'OPERACIONES', 'RECEPCION', 'SPA', 'SERVICIO AL CLIENTE'
        ];

        // 1. Filtrar Administrativos Puros
        const esAdminPuro = palabrasClaveAdmin.some(kw => cargoLimpio.includes(kw)) && !excepcionesOperativas.some(ex => cargoLimpio.includes(ex));
        
        // 2. Filtrar Coordinadores y Líderes que son de Oficina (Excluyendo a Mantenimiento, Alimentos, etc.)
        const esLiderAdmin = (cargoLimpio.includes('COORDINADOR') || cargoLimpio.includes('LIDER')) && !excepcionesOperativas.some(ex => cargoLimpio.includes(ex)) && !['MANTENIMIENTO', 'ALIMENTOS', 'AMBIENTAL', 'EXPERIENCIA', 'INFRAESTRUCTURA'].some(kw => cargoLimpio.includes(kw));

        const esPerfilRiesgoAdmin = esAdminPuro || esLiderAdmin;

        // 🚨 REGLA 1: Fraude Administrativo (El más grave)
        if (esPerfilRiesgoAdmin && totalTiempo > 5) {
          riesgo = `Alerta de Cargo Corporativo: Empleado administrativo (${emp.cargo}) acumuló ${totalTiempo.toFixed(1)} hrs operativas. Requiere revisión estricta de autorización de horas extras en roles de oficina / soporte.`;
          tipo = 'FRAUDE_CARGO';
          icono = '🚨';
          color = 'bg-red-100 text-red-800 border-red-300';
        }
        // 🔥 REGLA 2: Burnout Legal (Exceso crónico de horas extras)
        else if (emp.totalHorasExtras > 50 && mesesActivos >= 3) {
          riesgo = `Sobrecarga crónica: ${emp.totalHorasExtras.toFixed(1)} hrs extras puras en ${mesesActivos} meses. Riesgo legal de fatiga laboral (Mintrabajo) o asignación a dedo por la jefatura.`;
          tipo = 'BURNOUT';
          icono = '🔥';
          color = 'bg-orange-100 text-orange-800 border-orange-300';
        } 
        // 💰 REGLA 3: Favoritismo Financiero (Ganar mucha plata en variables)
        else if (totalDinero > 1500000) {
          riesgo = `Alerta Financiera / Favoritismo: Ha cobrado $${totalDinero.toLocaleString('es-CO')} solo en recargos y extras. Revisar equidad en la rotación del equipo.`;
          tipo = 'FAVORITISMO';
          icono = '💰';
          color = 'bg-amber-100 text-amber-800 border-amber-300';
        }
        // 🦇 REGLA 4: Vampirismo (Abuso de Recargos Nocturnos/Dominicales sin rotar)
        else if (emp.totalHorasRecargos > 150) {
          riesgo = `Riesgo SST (Falta de Rotación): Acumuló ${emp.totalHorasRecargos.toFixed(1)} hrs de turnos pesados (Nocturnos/Dominicales). Se recomienda auditar si le están dando el descanso compensatorio de ley.`;
          tipo = 'VAMPIRISMO';
          icono = '🦇';
          color = 'bg-purple-100 text-purple-800 border-purple-300';
        } 
        // 🔄 REGLA 5: Carrusel Recurrente
        else if (emp.totalHorasExtras >= 15 && mesesActivos >= 2) {
          riesgo = `Comportamiento recurrente: Cobra un volumen sospechoso constante. Validar que no sea un "bono salarial" oculto como tiempo extra para evadir aportes a seguridad social.`;
          tipo = 'CARRUSEL';
          icono = '🔄';
          color = 'bg-blue-100 text-blue-800 border-blue-300';
        }

        if (riesgo) {
          alertasForences.push({ ...emp, riesgo, tipo, icono, color, totalTiempo, totalDinero });
        }
      });

      // Ordenar por nivel de riesgo (Plata > Fraude > Burnout)
      alertasForences.sort((a, b) => {
        if (a.tipo === 'FRAUDE_CARGO') return -1;
        if (b.tipo === 'FRAUDE_CARGO') return 1;
        return b.totalDinero - a.totalDinero;
      });

      setDatosHistoricos({
        totalAnalizados: Object.keys(empleadosStats).length,
        totalMeses: mesesDetectados.size,
        totalCostoExtras: totalCostoExtrasCompania,
        totalCostoRecargos: totalCostoRecargosCompania,
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
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">🤖</div>
        <h2 className="text-2xl font-extrabold mb-2 flex items-center gap-2">
          <span>📉</span> Inteligencia de Datos: Histórico Anti-Fraude
        </h2>
        <p className="text-slate-400 mb-6 text-sm max-w-3xl">
          El Motor GCM cruza todas las nóminas de la base de datos (Enero a Mayo) para detectar anomalías operativas severas: cargos de oficina cobrando turnos de noche, vampirismo operativo, carrusel de horas y favoritismos financieros en la asignación de turnos.
        </p>

        <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700 w-fit">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Base de Conocimiento</p>
            <p className="text-xl font-bold text-cyan-400">{listaBases.length} Meses / Quincenas</p>
          </div>
          <button 
            onClick={ejecutarAnalisisForense}
            disabled={isAnalyzing || listaBases.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isAnalyzing ? '⏳ Procesando Algoritmos...' : '🚀 Ejecutar Escáner Histórico'}
          </button>
        </div>
      </div>

      {datosHistoricos && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase">Empleados Scaneados</p>
              <h3 className="text-3xl font-extrabold text-slate-800">{datosHistoricos.totalAnalizados} <span className="text-sm font-medium text-slate-400">empleados</span></h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm bg-red-50/50">
              <p className="text-xs font-bold text-red-600 uppercase">Anomalías Detectadas</p>
              <h3 className="text-3xl font-extrabold text-red-700">{datosHistoricos.alertas.length} <span className="text-sm font-medium text-red-400">casos críticos</span></h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-pink-200 shadow-sm">
              <p className="text-xs font-bold text-pink-600 uppercase">Costo Histórico Extras</p>
              <h3 className="text-2xl font-extrabold text-pink-700">${datosHistoricos.totalCostoExtras.toLocaleString('es-CO')}</h3>
            </div>
            <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-sm">
              <p className="text-xs font-bold text-indigo-600 uppercase">Costo Histórico Recargos</p>
              <h3 className="text-2xl font-extrabold text-indigo-700">${datosHistoricos.totalCostoRecargos.toLocaleString('es-CO')}</h3>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span>⚠️</span> Ranking de Alertas de Control Interno (Enero - Mayo)
              </h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-center">Tipo</th>
                    <th className="p-4">Empleado / Cargo</th>
                    <th className="p-4 text-center">Meses</th>
                    <th className="p-4 text-right bg-slate-50">Horas Acumuladas</th>
                    <th className="p-4 text-right bg-slate-50">Dinero Cobrado</th>
                    <th className="p-4 w-1/3">Diagnóstico Forense</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datosHistoricos.alertas.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500 italic">No se detectaron comportamientos anómalos en el histórico.</td></tr>
                  ) : (
                    datosHistoricos.alertas.map((alerta, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 text-xs font-extrabold rounded border ${alerta.color} whitespace-nowrap`}>
                            {alerta.icono} {alerta.tipo.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                          {alerta.nombre}
                          <span className="block text-[10px] text-slate-500 uppercase mt-0.5">{alerta.cargo}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{alerta.cedula}</span>
                        </td>
                        <td className="p-4 text-center font-bold text-indigo-600">
                          {alerta.mesesConNovedad.size} / {datosHistoricos.totalMeses}
                        </td>
                        <td className="p-4 text-right">
                          <div className="text-[11px] font-bold text-pink-600">Ext: {alerta.totalHorasExtras.toFixed(1)} h</div>
                          <div className="text-[11px] font-bold text-indigo-600">Rec: {alerta.totalHorasRecargos.toFixed(1)} h</div>
                          <div className="text-sm font-extrabold text-slate-800 mt-1">{alerta.totalTiempo.toFixed(1)} hrs</div>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-amber-700">
                          ${alerta.totalDinero.toLocaleString('es-CO')}
                        </td>
                        <td className="p-4 text-xs text-slate-700 font-medium leading-relaxed">
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