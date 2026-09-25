// Ruta: api/forense.js
import { adminAuth, adminDb } from '../_lib/firebaseAdmin.js';

// --- HELPERS MATEMÁTICOS PARA EL SERVIDOR ---
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
  for (const alias of aliasPosibles) {
    const aliasNorm = alias.toUpperCase().replace(/[\s_]/g, '');
    for (const key of Object.keys(fila)) {
      if (normalizarTexto(key).replace(/[\s_]/g, '') === aliasNorm) return fila[key];
    }
  }
  return undefined;
};

const clasificarUnidad = (fila) => {
    const empresa = normalizarTexto(buscarColumna(fila, ['Empresa', 'Compania']) || '');
    const ccosto = normalizarTexto(buscarColumna(fila, ['NombreCcosto', 'CentroCosto', 'CentroPadre']) || '');
    const grupo = normalizarTexto(buscarColumna(fila, ['Grupo']) || '');
    const cargo = normalizarTexto(buscarColumna(fila, ['Cargo', 'DesCargo']) || '');

    const palabrasAdmin = ['ADMINISTRA', 'FINANCIER', 'TALENTO', 'HUMANA', 'CONTAB', 'TESORER', 'CONTROL INTERNO', 'TICS', 'MERCADEO', 'COMPRAS', 'FAMILY OFFICE', 'SISTEMAS', 'GERENCIA', 'DIRECTOR'];
    const excepOperativas = ['AUDITORIA NOCTURNA', 'RECEPCION', 'SPA', 'MESERO', 'CAMARERA', 'STEWAR', 'COCINA', 'MANTENIMIENTO', 'SALVAVIDAS'];

    if ((palabrasAdmin.some(p => ccosto.includes(p)) || palabrasAdmin.some(p => grupo.includes(p))) && !excepOperativas.some(ex => cargo.includes(ex))) return 'ADMIN';
    if (empresa.includes('RECREFAM') || ccosto.includes('HOTEL') || ccosto.includes('ALOJAMIENTO') || grupo.includes('ALOJAMIENTO') || ccosto.includes('SPA') || ccosto.includes('CASCADA') || ccosto.includes('MONTAÑA') || ccosto.includes('DEL RIO') || ccosto.includes('JAIBANA') || ccosto.includes('PINDANA') || ccosto.includes('RUTA ECOLOGICA') || ccosto.includes('RECREACION')) return 'ECOPARQUE_HOTEL';
    return 'BALNEARIO';
};

// 2. ENDPOINT PRINCIPAL (LA RUTA QUE LLAMARÁ REACT)
export default async function handler(req, res) {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://auditoria-gcm.vercel.app',
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173'] : [])
  ];
  const origin = req.headers.origin;

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo se acepta POST.' });

  try {
    // 🔒 Verificación de Seguridad (Rechaza la petición si no tiene sesión activa)
    const { parse } = await import('cookie');
    const cookies = parse(req.headers.cookie || '');
    const sessionCookie = cookies.grc_session;

  if (!sessionCookie) return res.status(401).json({ error: 'Falta sesión HttpOnly de servidor.' });
    await adminAuth.verifySessionCookie(sessionCookie, true);

    const { listaBases } = req.body;
    if (!listaBases || listaBases.length === 0) return res.status(400).json({ error: 'No se enviaron bases.' });

    let todasLasTransacciones = [];

    // 📥 DESCARGA DIRECTA DE LA BASE DE DATOS AL SERVIDOR (Ultra-rápido)
    for (const base of listaBases) {
      const empresaLimpia = base.empresa.toString().trim().replace(/[\s/]/g, '_');
      const periodoLimpio = base.periodo.toString().trim().replace('/', '-');
      const docBaseId = `${empresaLimpia}_${periodoLimpio}`;
      
const chunksSnapshot = await adminDb.collection(`nominas_historicas/${docBaseId}/chunks`).get();      
      let dataPlana = [];
      chunksSnapshot.forEach(doc => {
        const info = doc.data();
        if (info.datos && Array.isArray(info.datos)) dataPlana.push(...info.datos);
      });

      dataPlana.forEach(t => { t.mesOrigen = base.periodo; t.empresaOrigen = base.empresa; });
      todasLasTransacciones.push(...dataPlana);
    }

    // 🧠 MOTOR DE CÁLCULO GRC
    const empleadosStats = {};
    const mesesDetectados = new Set();
    const procesosUnicos = new Set();
    const cargosUnicos = new Set();
    const conceptosJornadaUnicos = new Set();
    let totalCostoExtrasCompania = 0;
    let tendenciasMeses = {};

    todasLasTransacciones.forEach(fila => {
      const cedulaRaw = buscarColumna(fila, ['Identificacion', 'Cedula', 'Documento', 'NIT', 'CEDULA']);
      if (!cedulaRaw) return;
      
      const cedula = cedulaRaw.toString().trim().replace(/\D/g, '');
      const mesOrigen = fila.mesOrigen;
      mesesDetectados.add(mesOrigen);

      const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
      let conceptoLimpio = normalizarTexto(conceptoRaw);
      if (conceptoLimpio.includes('DV06')) conceptoLimpio = 'DV06-HORA RECARGO DOMINICAL Y FESTIVO';
      if (conceptoLimpio.includes('DV07')) conceptoLimpio = 'DV07-HORA RECARGO NOCTURNO FESTIVOS O DOM.';
      
      const cantidad = parsearMonto(buscarColumna(fila, ['Cantidad', 'Horas', 'Cant', 'Minutos']));
      const valor = parsearMonto(buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'Total', 'Valor', 'Pago', 'Devengado']));
      const nombre = buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado']) || 'Sin Nombre';
      const cargo = buscarColumna(fila, ['Cargo', 'DesCargo', 'Ocupacion']) || 'Sin Cargo';
      const proceso = buscarColumna(fila, ['Grupo', 'NombreCcosto', 'CentroCosto']) || 'GENERAL';
      const unidad = clasificarUnidad(fila);

      procesosUnicos.add(proceso);
      cargosUnicos.add(cargo);

      if (!tendenciasMeses[mesOrigen]) {
        tendenciasMeses[mesOrigen] = { mes: mesOrigen, ADMIN: 0, BALNEARIO: 0, ECOPARQUE_HOTEL: 0, costoADMIN: 0, costoBALNEARIO: 0, costoECOPARQUE_HOTEL: 0 };
      }

      const empresaFila = fila.empresaOrigen || buscarColumna(fila, ['Empresa', 'Compania', 'RazonSocial']) || 'GENERAL';
      
      if (!empleadosStats[cedula]) {
        empleadosStats[cedula] = {
          cedula, nombre, cargo, proceso, unidad,
          empresasGrupo: new Set([empresaFila]),
          totalHorasExtras: 0, totalValorExtras: 0, totalHorasRecargos: 0, totalValorRecargos: 0,
          mesesConNovedad: new Set(), historialMeses: {}, desgloseJornadaPorMes: {}, desgloseConceptosJornada: {},
          fugaTransporteDinero: 0, mesesConFugaTransporte: 0
        };
      } else {
        empleadosStats[cedula].empresasGrupo.add(empresaFila);
      }

      const emp = empleadosStats[cedula];

      if (!emp.historialMeses[mesOrigen]) {
        emp.historialMeses[mesOrigen] = { mesContenedor: mesOrigen, devengadoSalarial: 0, transportePagado: 0, rodamientoPagado: 0, porEmpresa: {} };
      }

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
         emp.historialMeses[mesOrigen].porEmpresa[normEmpresa].devengado += valor;
      }
      if (esTransporte && valor > 0) {
         emp.historialMeses[mesOrigen].transportePagado += valor;
         emp.historialMeses[mesOrigen].porEmpresa[normEmpresa].transporte += valor;
      }
      if (esRodamiento && valor > 0) emp.historialMeses[mesOrigen].rodamientoPagado += valor;

      const esExtra = conceptoLimpio.includes('EXTRA DIURNA') || conceptoLimpio.includes('EXTRAS DIURNAS') ||
                      conceptoLimpio.includes('EXTRA NOCTURNA') || conceptoLimpio.includes('EXTRAS NOCTURNAS') ||
                      conceptoLimpio.includes('EXTRA FESTIVA') || conceptoLimpio.includes('EXTRAS FESTIVAS') ||
                      conceptoLimpio.includes('EXTRA DOMINICAL');
      
      const esRecargo = (conceptoLimpio.includes('RECARGO') && !conceptoLimpio.includes('EXTRA')) || 
                        conceptoLimpio.includes('NOCTURNO') || conceptoLimpio.includes('DOMINICAL') ||
                        conceptoLimpio.includes('FESTIVO COMPENSADO') || conceptoLimpio.includes('FESTIVO NO COMPENSADO');

      const esExtra = conceptoLimpio.includes('EXTRA DIURNA') || conceptoLimpio.includes('EXTRAS DIURNAS') ||
                      conceptoLimpio.includes('EXTRA NOCTURNA') || conceptoLimpio.includes('EXTRAS NOCTURNAS') ||
                      conceptoLimpio.includes('EXTRA FESTIVA') || conceptoLimpio.includes('EXTRAS FESTIVAS') ||
                      conceptoLimpio.includes('EXTRA DOMINICAL');
      
      const esRecargo = (conceptoLimpio.includes('RECARGO') && !conceptoLimpio.includes('EXTRA')) || 
                        conceptoLimpio.includes('NOCTURNO') || conceptoLimpio.includes('DOMINICAL') ||
                        conceptoLimpio.includes('FESTIVO COMPENSADO') || conceptoLimpio.includes('FESTIVO NO COMPENSADO');

      if (['DV05', 'DV06', 'DV07', 'DV08', 'DV09', 'DV10', 'DV11', 'DV19', 'DV22'].some(codigo => conceptoLimpio.includes(codigo)) || esExtra || esRecargo) {
        conceptosJornadaUnicos.add(conceptoLimpio);
        if (!emp.desgloseConceptosJornada[conceptoLimpio]) emp.desgloseConceptosJornada[conceptoLimpio] = { horas: 0, valor: 0 };
        emp.desgloseConceptosJornada[conceptoLimpio].horas += cantidad;
        emp.desgloseConceptosJornada[conceptoLimpio].valor += valor;

        if (!emp.desgloseJornadaPorMes[mesOrigen]) emp.desgloseJornadaPorMes[mesOrigen] = { horas: 0, valor: 0, conceptos: {} };
        emp.desgloseJornadaPorMes[mesOrigen].horas += cantidad;
        emp.desgloseJornadaPorMes[mesOrigen].valor += valor;
        
        if (!emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio]) emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio] = { horas: 0, valor: 0 };
        emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio].horas += cantidad;
        emp.desgloseJornadaPorMes[mesOrigen].conceptos[conceptoLimpio].valor += valor;

        if (esExtra) { emp.totalHorasExtras += cantidad; emp.totalValorExtras += valor; } 
        else { emp.totalHorasRecargos += cantidad; emp.totalValorRecargos += valor; }
        
        totalCostoExtrasCompania += valor;
        emp.mesesConNovedad.add(mesOrigen);

        if (unidad === 'ADMIN') { tendenciasMeses[mesOrigen].ADMIN += cantidad; tendenciasMeses[mesOrigen].costoADMIN += valor; } 
        else if (unidad === 'BALNEARIO') { tendenciasMeses[mesOrigen].BALNEARIO += cantidad; tendenciasMeses[mesOrigen].costoBALNEARIO += valor; } 
        else if (unidad === 'ECOPARQUE_HOTEL') { tendenciasMeses[mesOrigen].ECOPARQUE_HOTEL += cantidad; tendenciasMeses[mesOrigen].costoECOPARQUE_HOTEL += valor; }
      }
    });

    const alertasJornada = [];
    const alertasTransporte = [];
    let totalFugaTransporteCompania = 0;

    Object.values(empleadosStats).forEach(emp => {
      let tieneFuga = false;
      let periodosFuga = new Set();
      let fugaNetaAcumulada = 0;
      let quincenasConInfraccion = 0;

      Object.entries(emp.historialMeses).forEach(([mesAgrupado, data]) => {
         const transporte = data.transportePagado || 0;
         const rodamiento = data.rodamientoPagado || 0;
         const devengado = data.devengadoSalarial || 0;
         const topeMensual = 3501810;

         if (transporte < 0 || devengado < 0) { fugaNetaAcumulada += transporte; return; }

         if (transporte > 0) {
            let causalFuga = null;
            if (rodamiento > 0) causalFuga = `Doble Beneficio`;
            else if (data.esTeletrabajo) causalFuga = `Teletrabajo`;
            else if (devengado > topeMensual) causalFuga = `Excede tope`;

            if (causalFuga) {
               fugaNetaAcumulada += transporte;
               quincenasConInfraccion += 1;
               tieneFuga = true;
               periodosFuga.add(data.mesContenedor);
            }
         }
      });

      if (emp.empresasGrupo && emp.empresasGrupo.size > 1) tieneFuga = true;

      if (tieneFuga && fugaNetaAcumulada > 0) {
         emp.fugaTransporteDinero = fugaNetaAcumulada;
         emp.mesesConFugaTransporte = quincenasConInfraccion;
         totalFugaTransporteCompania += fugaNetaAcumulada;

         alertasTransporte.push({
            ...emp,
            periodosFuga: Array.from(periodosFuga),
            totalHorasVisual: quincenasConInfraccion,
            totalDineroVisual: fugaNetaAcumulada,
            fugaPorMes: Object.values(emp.historialMeses).reduce((acc, q) => {
               if (q.transportePagado > 0 && (q.rodamientoPagado > 0 || q.esTeletrabajo || q.devengadoSalarial > 3501810)) {
                  acc[q.mesContenedor] = (acc[q.mesContenedor] || 0) + q.transportePagado;
               }
               return acc;
            }, {}),
            riesgo: "Alerta procesada de manera segura en el Backend GRC.",
            tipo: 'FUGA_TRANSPORTE', icono: '🚗', mesesActivos: quincenasConInfraccion
         });
      }

      const totalHoras = emp.totalHorasExtras + emp.totalHorasRecargos;
      const totalDinero = emp.totalValorExtras + emp.totalValorRecargos;
      
      if (totalHoras > 0 || totalDinero > 0) {
          const mesesActivos = emp.mesesConNovedad.size;
          const cargoLimpio = normalizarTexto(emp.cargo);
          const esAdminPuro = ['CONTABLE', 'TALENTO', 'GERENT', 'SISTEMAS', 'COMPRAS', 'ADMINISTRATIV'].some(kw => cargoLimpio.includes(kw)) && !['RECEPCION', 'SPA'].some(ex => cargoLimpio.includes(ex));

          let riesgo = null, tipo = null, icono = null;

          if (esAdminPuro && totalHoras > 5) { riesgo = `Cargo Administrativo acumuló extras.`; tipo = 'CARGO_CORPORATIVO'; icono = '🚨'; } 
          else if (emp.totalHorasExtras > 50 && mesesActivos >= 3) { riesgo = `Sobrecarga crónica. Riesgo Burnout.`; tipo = 'BURNOUT'; icono = '🔥'; } 
          else if (totalDinero > 1500000) { riesgo = `Alerta Financiera / Equidad de equipo.`; tipo = 'FAVORITISMO'; icono = '💰'; } 
          else if (mesesActivos >= 2 && totalHoras >= 10) { riesgo = `Comportamiento recurrente.`; tipo = 'RECURRENCIA'; icono = '🔄'; }

          if (riesgo) {
            alertasJornada.push({
              ...emp,
              mesesConNovedad: Array.from(emp.mesesConNovedad),
              totalHorasVisual: totalHoras, totalDineroVisual: totalDinero,
              riesgo, tipo, icono, mesesActivos
            });
          }
      }
    });

    const empleadosStatsArray = Object.values(empleadosStats).map(emp => ({
      ...emp,
      empresasGrupo: Array.from(emp.empresasGrupo),
      mesesConNovedad: Array.from(emp.mesesConNovedad)
    }));

    // 📤 4. ENVÍO DEL RESUMEN LIMPIO Y LIGERO AL FRONTEND
    res.status(200).json({
      totalAnalizados: Object.keys(empleadosStats).length,
      totalMeses: mesesDetectados.size,
      totalCostoExtras: totalCostoExtrasCompania,
      totalFugaTransporte: totalFugaTransporteCompania,
      alertasJornada: alertasJornada.sort((a, b) => b.totalHorasVisual - a.totalHorasVisual),
      alertasTransporte: alertasTransporte.sort((a, b) => b.totalDineroVisual - a.totalDineroVisual),
      empleadosStatsMaster: empleadosStatsArray,
      procesos: Array.from(procesosUnicos).sort(),
      cargos: Array.from(cargosUnicos).sort(),
      conceptosJornada: Array.from(conceptosJornadaUnicos).sort(),
      tendencias: Object.values(tendenciasMeses).sort((a, b) => a.mes.localeCompare(b.mes))
    });

  } catch (error) {
    console.error("Error en API Forense:", error);
    res.status(500).json({ error: error.message });
  }
}