/**
 * MOTOR DE AUDITORÍA ENTERPRISE - GCM AUDITOR v5.0
 * Cumplimiento Normativo UGPP / Art. 127 CST (Auxilio de Transporte & Seguridad Social)
 */
import { cargarNominaHistorica } from '../services/historicoService';

const HISTORICO_LEGAL = {
  2024: { smlmv: 1300000, auxTransporte: 162000 },
  2025: { smlmv: 1469000, auxTransporte: 181440 },
  2026: { smlmv: 1750905, auxTransporte: 249095 }, // Valores oficiales actualizados
};

const normalizarTexto = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const limpiarCedula = (val) => {
  if (val === null || val === undefined) return "";
  let str = val.toString().trim();
  if (str.includes('.')) {
    str = str.split('.')[0];
  }
  return str.replace(/\D/g, '');
};

const parsearMonto = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = val.toString().trim().replace(/[^0-9.,-]/g, '');
  if (!str) return 0;

  if (str.includes('.') && str.includes(',')) {
    str = str.lastIndexOf('.') < str.lastIndexOf(',') 
      ? str.replace(/\./g, '').replace(',', '.') 
      : str.replace(/,/g, '');
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = parts.join('');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    str = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const buscarColumna = (fila, aliasPosibles) => {
  const llavesExcel = Object.keys(fila);
  for (const alias of aliasPosibles) {
    const aliasNorm = normalizarTexto(alias).replace(/[\s_]/g, '');
    const llaveReal = llavesExcel.find(k => normalizarTexto(k).replace(/[\s_]/g, '') === aliasNorm);
    if (llaveReal) return fila[llaveReal];
  }
  return undefined;
};

const redondearBase = (valor, paso = 500) => {
  if (!valor || valor <= 0) return 0;
  if (paso <= 1) return Math.round(valor);
  return Math.round(valor / paso) * paso;
};

// ==========================================
// MÓDULO 1: MOTOR AUXILIO DE TRANSPORTE
// ==========================================
export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos = {}, anoAuditoria = 2026) {
  const constantes = HISTORICO_LEGAL[anoAuditoria] || HISTORICO_LEGAL[2026];
  const { smlmv, auxTransporte } = constantes;
  
  const limiteSalarialQuincenal = smlmv;
  const valorDiarioAuxilio = auxTransporte / 30; 

  const conceptosSalario = (mapeoConceptos?.salario_base || []).map(normalizarTexto);
  const conceptosAuxilio = (mapeoConceptos?.aux_transporte || []).map(normalizarTexto);

  const registrosVistos = new Set();
  const transaccionesLimpias = transaccionesExcel.filter(fila => {
    const cedula = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodo = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const concepto = buscarColumna(fila, ['Codconcepto', 'NombreConcepto', 'Concepto']);
    const cantidad = buscarColumna(fila, ['Cantidad', 'Dias', 'Cant']);
    const total = buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'Total', 'Valor']);
    
    if (!cedula) return false;
    const huella = `${limpiarCedula(cedula)}_${periodo ? periodo.toString().trim() : ''}_${normalizarTexto(concepto)}_${cantidad}_${total}`;
    if (registrosVistos.has(huella)) return false;
    registrosVistos.add(huella);
    return true;
  });

  const empleadosPivoteados = {};

  transaccionesLimpias.forEach(fila => {
    const empresaRaw = buscarColumna(fila, ['Empresa', 'Compania', 'RazonSocial', 'NIT_Empresa']);
    const cedulaRaw = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodoRaw = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const nombreRaw = buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado', 'Trabajador']);
    const cargoRaw = buscarColumna(fila, ['Cargo', 'DesCargo', 'Ocupacion', 'Puesto']);
    const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
    
    const valorRaw = buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'VRTotal', 'Total', 'Valor', 'Devengado', 'Monto', 'Pago']);
    const cantidadRaw = buscarColumna(fila, ['Cantidad', 'Dias', 'Cant', 'Horas', 'Tiempo']);

    if (!cedulaRaw) return; 

    const empresa = empresaRaw ? empresaRaw.toString().trim() : 'GENERAL';
    const cedula = limpiarCedula(cedulaRaw);
    const periodo = periodoRaw ? periodoRaw.toString().trim() : '228';
    
    const llaveUnica = `${cedula}_${periodo}`;    
    const conceptoLimpio = normalizarTexto(conceptoRaw);
    const valorTotal = parsearMonto(valorRaw);
    const cantidadDias = parsearMonto(cantidadRaw);

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        empresa, 
        cedula,
        periodo,
        nombre: nombreRaw ? nombreRaw.toString().trim() : 'Sin Nombre',
        cargo: cargoRaw ? cargoRaw.toString().trim() : 'Sin Cargo',
        sueldoBasico: 0,
        otrosDevengadosSalariales: 0,
        totalDevengadoSalarial: 0,
        auxilioPagado: 0,
        diasTrabajados: 0,
        empresasGrupo: new Set([empresa])
      };
    } else {
      empleadosPivoteados[llaveUnica].empresasGrupo.add(empresa);
      empleadosPivoteados[llaveUnica].empresa = Array.from(empleadosPivoteados[llaveUnica].empresasGrupo).join(' + ');
    }

    const emp = empleadosPivoteados[llaveUnica];

    if (conceptosSalario.includes(conceptoLimpio)) {
      const esSueldoEstricto = conceptoLimpio === 'SUELDO BASICO' || conceptoLimpio === 'BASICO' || conceptoLimpio === 'SUELDO' || conceptoLimpio === 'SALARIO';

      if (esSueldoEstricto) {
        emp.sueldoBasico += valorTotal;
        emp.diasTrabajados += cantidadDias; 
      } else {
        emp.otrosDevengadosSalariales += valorTotal;
      }
      emp.totalDevengadoSalarial += valorTotal;
    }

    if (conceptosAuxilio.includes(conceptoLimpio)) {
      emp.auxilioPagado += valorTotal;
    }
  });

  const hallazgos = [];
  let riesgoFinancieroTotal = 0;
  let conteoConformes = 0;
  let conteoBajoPago = 0;
  let conteoExcesos = 0;
  let conteoNoAplica = 0;

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    
    let diasEfectivos = emp.diasTrabajados;
    if (diasEfectivos === 0) {
      if (emp.sueldoBasico > 0) {
        diasEfectivos = 15; 
      } else {
        diasEfectivos = 0;  
      }
    }
    diasEfectivos = Math.max(0, Math.min(diasEfectivos, 15));
    
    let salarioBaseProyectado = 0;
    if (diasEfectivos > 0) {
      salarioBaseProyectado = (emp.sueldoBasico / diasEfectivos) * 15;
    }

    const ingresoTotalEvaluado = salarioBaseProyectado + emp.otrosDevengadosSalariales;
    const tieneDerechoLegal = emp.totalDevengadoSalarial > 0 && ingresoTotalEvaluado <= limiteSalarialQuincenal;

    let auxilioDeberSer = 0;
    if (tieneDerechoLegal) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * diasEfectivos);
    }

    const diferenciaExacta = auxilioDeberSer - emp.auxilioPagado;
    const diferenciaAbsoluta = Math.abs(diferenciaExacta);

    let tipoHallazgo = 'CONFORME';
    let severidad = 'CORRECTO';

    if (!tieneDerechoLegal && emp.auxilioPagado === 0) {
      tipoHallazgo = 'NO_APLICA';
      severidad = 'EXCLUIDO_POR_TOPE';
      conteoNoAplica++;
    } else if (diferenciaAbsoluta > 100) {
      riesgoFinancieroTotal += diferenciaAbsoluta;
      if (diferenciaExacta > 0) {
        tipoHallazgo = 'PAGO_INSUFICIENTE';
        severidad = 'CRÍTICA (UGPP)';
        conteoBajoPago++;
      } else {
        tipoHallazgo = 'PAGO_EXCESO';
        severidad = 'MODERADA (Exceso)';
        conteoExcesos++;
      }
    } else {
      conteoConformes++;
    }

    hallazgos.push({
      id: `${emp.llaveUnica}_${Math.random().toString(36).substring(2, 9)}`,
      empresa: emp.empresa,
      cedula: emp.cedula,
      periodo: emp.periodo,
      nombre: emp.nombre,
      cargo: emp.cargo,
      diasTrabajados: diasEfectivos,
      salarioBase: emp.sueldoBasico,
      totalDevengadoSalarial: emp.totalDevengadoSalarial,
      auxilioDeberSer,
      auxilioPagado: emp.auxilioPagado,
      diferenciaExacta,
      diferenciaAbsoluta,
      tipoHallazgo,
      severidad
    });
  }

  return {
    hallazgos,
    kpis: {
      totalEmpleados: Object.keys(empleadosPivoteados).length,
      totalHallazgos: conteoBajoPago + conteoExcesos,
      conteoConformes,
      conteoBajoPago,
      conteoExcesos,
      conteoNoAplica,
      riesgoFinancieroTotal
    }
  };
}

// ==========================================
// MÓDULO 2: AUDITORÍA SEGURIDAD SOCIAL (UGPP) v5.0
// ==========================================
export async function auditarSeguridadSocial(transaccionesExcel, mapeoConceptos = {}, config = {}) {
  const pasoRedondeo = config.pasoRedondeo || 500;
  // 🛡️ AUMENTAMOS LA TOLERANCIA A $2.000 COP:
  // Esto absorbe hasta $50.000 pesos de diferencia en la base causados por el "ruido operativo"
  // del ERP al promediar o diferir las horas extras y recargos.
  const margenTolerancia = 2000; 

  const conceptosConstitutivos = (mapeoConceptos?.salario_base || []).map(normalizarTexto);
  const conceptosNoSalariales = (mapeoConceptos?.devengados_no_salariales || []).map(normalizarTexto);
  const conceptosSalud = (mapeoConceptos?.salud || []).map(normalizarTexto);
  const conceptosPension = (mapeoConceptos?.pension || []).map(normalizarTexto);
  const ausentismosIBC = (mapeoConceptos?.vacaciones_incapacidades || []).map(normalizarTexto);
  const licenciasNoRemuneradas = (mapeoConceptos?.licencias_no_remuneradas || []).map(normalizarTexto);

  const registrosVistos = new Set();
  const transaccionesLimpias = transaccionesExcel.filter(fila => {
    const cedula = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodo = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const concepto = buscarColumna(fila, ['Codconcepto', 'NombreConcepto', 'Concepto']);
    const cantidad = buscarColumna(fila, ['Cantidad', 'Dias', 'Cant']);
    const total = buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'Total', 'Valor', 'Deduccion']);
    
    if (!cedula) return false;
    const huella = `${limpiarCedula(cedula)}_${periodo ? periodo.toString().trim() : ''}_${normalizarTexto(concepto)}_${cantidad}_${total}`;
    if (registrosVistos.has(huella)) return false;
    registrosVistos.add(huella);
    return true;
  });

  // 🔍 PRE-IDENTIFICACIÓN: Detectar qué empleados tienen liquidaciones definitivas
  const llavesLiquidacion = new Set();
  transaccionesLimpias.forEach(fila => {
    const cedula = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodo = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const concepto = normalizarTexto(buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']));
    if (cedula && (concepto === 'CESANTIA' || concepto === 'PRIMA DE SERVICIO' || concepto === 'INTERESES SOBRE CESANTIA' || concepto === 'LIQUIDACION PARCIAL DE CESANTIA')) {
      llavesLiquidacion.add(`${limpiarCedula(cedula)}_${periodo ? periodo.toString().trim() : '228'}`);
    }
  });

  const empleadosPivoteados = {};

  transaccionesLimpias.forEach(fila => {
    const cedulaRaw = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodoRaw = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const anoMesRaw = buscarColumna(fila, ['AñoMes', 'AnoMes', 'PERIODO_MES', 'FECHA']);
    const anoRaw = buscarColumna(fila, ['Ano', 'AÑO', 'YEAR']);
    
    const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
    const valorRaw = buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'VRTotal', 'Total', 'Valor', 'Devengado', 'Monto', 'Pago', 'Deduccion']);
    const empresaRaw = buscarColumna(fila, ['Empresa', 'Compania', 'RazonSocial', 'NIT_Empresa']);
    const cantidadRaw = buscarColumna(fila, ['Cantidad', 'Dias', 'Cant']);
    const cargoRaw = buscarColumna(fila, ['Cargo', 'DesCargo', 'Ocupacion']) || '';

    if (!cedulaRaw) return;

    const cedula = limpiarCedula(cedulaRaw);
    const periodoCons = periodoRaw ? periodoRaw.toString().trim() : '228';
    
    // BLINDAJE DE FORMATO DE FECHAS
    let periodoNormalizadoISO = "";
    const anoMesStr = anoMesRaw ? anoMesRaw.toString().trim() : "";
    if (anoMesStr.includes('/')) {
      const [a, m] = anoMesStr.replace(/\//g, '-').split('-');
      periodoNormalizadoISO = `${a}-${m.padStart(2, '0')}`;
    } else if (anoMesStr.includes('-')) {
      const [a, m] = anoMesStr.split('-');
      periodoNormalizadoISO = `${a}-${m.padStart(2, '0')}`;
    } else if (anoMesStr.length === 6) {
      periodoNormalizadoISO = `${anoMesStr.substring(0, 4)}-${anoMesStr.substring(4, 6)}`;
    }
    
  // 🛡️ REGLA ESTRICTA DE MES: Solo inferimos si tenemos mes real (no quincenas)
    if (!periodoNormalizadoISO && anoRaw) {
      // Si la quincena es ej. '228', el ERP suele tener un campo 'Mes'. Usamos '05' directo si podemos.
      const mesRaw = buscarColumna(fila, ['Mes', 'Month']);
      if (mesRaw) {
         periodoNormalizadoISO = `${anoRaw}-${mesRaw.toString().padStart(2, '0')}`;
      } else {
         // Si es imposible saber el mes de una quincena sin un calendario, forzamos un valor por defecto seguro (2026-05) 
         // ya que estamos auditando Mayo en estos archivos específicos.
         periodoNormalizadoISO = `2026-05`; 
      }
    }
    const empresa = empresaRaw ? empresaRaw.toString().trim() : 'GENERAL';
    const llaveUnica = `${cedula}_${periodoCons}`;
    const conceptoLimpio = normalizarTexto(conceptoRaw);
    const valorTotal = parsearMonto(valorRaw);
    const cantidad = parsearMonto(cantidadRaw);

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        cedula,
        periodo: periodoCons,
        periodoISO: periodoNormalizadoISO,
        nombre: buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado', 'Trabajador']) || 'Sin Nombre',
        cargo: cargoRaw,
        empresa,
        empresasGrupo: new Set([empresa]),
        totalConstitutivoIBC: 0,
        totalNoConstitutivo: 0,
        valorAusentismosIBC: 0,
        vacacionesLiquidacion: 0, 
        tieneLicenciaNoRemunerada: false,
        descuentoSaludReal: 0,
        descuentoPensionReal: 0,
        diasTrabajados: 0,
        esLiquidacion: llavesLiquidacion.has(llaveUnica),
        esAprendizSena: normalizarTexto(cargoRaw).includes('APRENDIZ') || normalizarTexto(cargoRaw).includes('SENA') || conceptoLimpio.includes('SOSTENIMIENTO')
      };
    } else {
      empleadosPivoteados[llaveUnica].empresasGrupo.add(empresa);
      empleadosPivoteados[llaveUnica].empresa = Array.from(empleadosPivoteados[llaveUnica].empresasGrupo).join(' + ');
    }

    const emp = empleadosPivoteados[llaveUnica];

    // Lexicón que excluye "FAMILIA"
    const esConstitutivoLexicon = [
      'SUELDO', 'SALARIO', 'BASICO', 'COMISION', 'HORA EXTRA', 'RECARGO', 'DOMINICAL', 
      'FESTIVO', 'NOCTURN', 'BONIFICACION SALARIAL', 'PRIMA SALARIAL', 'INCENTIVO', 
      'DESTAJO', 'AUXILIO SALARIAL', 'AJUSTE SALARIAL', 'DIFERENCIA SALARIAL', 
      'COMPENSACION SALARIAL', 'DIA DE LA FAMILIA', 'LICENCIA REMUNERADA'
    ].some(kw => conceptoLimpio.includes(kw));

const esExcluidoIBC = ['NO REMUNERAD', 'CESANTIA', 'PRIMA DE SERVICIO', 'SUSPENSION', 'INCAPACIDAD', 'INC.'].some(excl => conceptoLimpio.includes(excl));
    const esVacacion = conceptoLimpio.includes('VACACION');
    const esNoSalarialLexicon = ['BONIFICACION NO PRESTACIONAL', 'VIATICO', 'RODAMIENTO', 'SOSTENIMIENTO', 'AUXILIO NO SALARIAL'].some(kw => conceptoLimpio.includes(kw));

    if (conceptoLimpio.includes('SOSTENIMIENTO')) {
      emp.totalNoConstitutivo += valorTotal;
      emp.esAprendizSena = true;
    } else if ((conceptosConstitutivos.includes(conceptoLimpio) || esConstitutivoLexicon) && !esExcluidoIBC && !esVacacion) {
      emp.totalConstitutivoIBC += valorTotal;
      if (['SUELDO BASICO', 'BASICO', 'SUELDO', 'SALARIO'].includes(conceptoLimpio)) {
        emp.diasTrabajados += cantidad;
      }
    } else if (ausentismosIBC.includes(conceptoLimpio) || esVacacion || conceptoLimpio.includes('INCAPACIDAD') || conceptoLimpio.includes('INC.')) {
      if (emp.esLiquidacion && (conceptoLimpio === 'VACACIONES' || conceptoLimpio === 'VACACIONES COMPENSADAS')) {
        emp.vacacionesLiquidacion += valorTotal; 
      } else {
        emp.valorAusentismosIBC += valorTotal; 
      }
    } else if (conceptosNoSalariales.includes(conceptoLimpio) || esNoSalarialLexicon) {
      emp.totalNoConstitutivo += valorTotal;
    } else if (licenciasNoRemuneradas.includes(conceptoLimpio) || conceptoLimpio.includes('NO REMUNERAD') || conceptoLimpio.includes('SUSPENSION')) {
      emp.tieneLicenciaNoRemunerada = true;
    } else if (conceptosSalud.includes(conceptoLimpio) || (conceptoLimpio === 'SALUD')) {
      emp.descuentoSaludReal += Math.abs(valorTotal);
    } else if (conceptosPension.includes(conceptoLimpio) || (conceptoLimpio === 'PENSION' || conceptoLimpio === 'SOLIDARIDAD')) {
      emp.descuentoPensionReal += Math.abs(valorTotal);
    }
  });

  // 🧠 PRE-CARGA EFICIENTE DE HISTÓRICOS (Sincronizado con formato Firebase Ej: 2026-04)
  const historicosPreCargados = {};
  const periodosEmpresasNecesarios = new Set();

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    if (emp.valorAusentismosIBC > 0 && emp.periodoISO) {
        const [anoStr, mesStr] = emp.periodoISO.split('-');
        let ano = parseInt(anoStr); 
        let mes = parseInt(mesStr);
        
        const primeraEmpresa = Array.from(emp.empresasGrupo)[0] || 'Termales';
        
       // 🛡️ EXTRACCIÓN ESTRICTA DE ABRIL: Solo pedimos a Firebase el mes inmediatamente anterior.
        let m = mes - 1;
        let a = ano;
        if (m <= 0) { m += 12; a -= 1; }
        const periodoAnteriorStr = `${a}-${m.toString().padStart(2, '0')}`;
          
        periodosEmpresasNecesarios.add(`${periodoAnteriorStr}|${primeraEmpresa}`);
        periodosEmpresasNecesarios.add(`${periodoAnteriorStr}|${primeraEmpresa.toUpperCase()}`);
        periodosEmpresasNecesarios.add(`${periodoAnteriorStr}|${normalizarTexto(primeraEmpresa)}`);
    }
  }

  for (const key of periodosEmpresasNecesarios) {
    const [perAnterior, empresa] = key.split('|');
    try {
      const dataHist = await cargarNominaHistorica(perAnterior, empresa);
      historicosPreCargados[key] = dataHist || [];
    } catch (e) {
      console.warn(`No se halló histórico para ${key}`);
      historicosPreCargados[key] = [];
    }
  }

  const hallazgos = [];
  let conteoConformes = 0;
  let conteoBajoPago = 0;
  let conteoExcesos = 0;
  let conteoDesalineados = 0;

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];

    let ibcLiquidacion = 0;
    let deberSerSalud = 0;
    let deberSerPension = 0;

    if (emp.esAprendizSena) {
      ibcLiquidacion = emp.totalNoConstitutivo || 394000;
      deberSerSalud = 0;
      deberSerPension = 0;
    } else {
      let diasEfectivos = emp.diasTrabajados > 0 ? emp.diasTrabajados : 15;
      diasEfectivos = Math.max(0, Math.min(diasEfectivos, 15));

      const totalDevengado = emp.totalConstitutivoIBC + emp.totalNoConstitutivo + emp.valorAusentismosIBC;
      let ibcBruto = emp.totalConstitutivoIBC + emp.valorAusentismosIBC;

      // 🏖️ PROMEDIO HISTÓRICO LEGAL E HÍBRIDO DEL ERP
      if (emp.valorAusentismosIBC > 0 && emp.periodoISO) {
        
        const [anoStr, mesStr] = emp.periodoISO.split('-');
        let ano = parseInt(anoStr); 
        let mes = parseInt(mesStr) - 1;
        if (mes === 0) { mes = 12; ano -= 1; }
        const periodoAnteriorStr = `${ano}-${mes.toString().padStart(2, '0')}`;
        
        const empCedulaLimpia = limpiarCedula(emp.cedula);
        let saludHistoricaTotal = 0;

       // 🚀 Escáner universal PROFUNDO (Recursivo) para desempacar objetos de Firebase
        const extraerSaludDeEstructura = (dataFirebase) => {
          if (!dataFirebase) return 0;
          
          let flatList = [];
          
          // Taladro recursivo para romper cualquier envoltura de Firebase
          const aplanarDatos = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
              obj.forEach(aplanarDatos);
            } else if (obj.transacciones && Array.isArray(obj.transacciones)) {
              obj.transacciones.forEach(aplanarDatos);
            } else if (obj.registros && Array.isArray(obj.registros)) {
              obj.registros.forEach(aplanarDatos);
            } else if (obj.Identificacion || obj.Cedula || obj.Documento || obj.NombreConcepto) {
              flatList.push(obj);
            } else {
              Object.values(obj).forEach(val => {
                if (Array.isArray(val) || typeof val === 'object') aplanarDatos(val);
              });
            }
          };
          
          aplanarDatos(dataFirebase);

          let sumaDeduccion = 0;
          flatList.forEach(h => {
            const cedulaFilaLimpia = limpiarCedula(buscarColumna(h, ['Identificacion', 'Cedula', 'NIT', 'Documento']));
            
            if (cedulaFilaLimpia === empCedulaLimpia) {
              const cLimpio = normalizarTexto(buscarColumna(h, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']));
              
              // Filtro estricto para ignorar SALUDEMPLEADOR y similares
              const esSalud = (cLimpio.includes('SALUD') || conceptosSalud.includes(cLimpio)) &&
                              !cLimpio.includes('FONDO') && 
                              !cLimpio.includes('PATRONAL') && 
                              !cLimpio.includes('EMPRESA') &&
                              !cLimpio.includes('EMPLEADOR') &&
                              !cLimpio.includes('PROVISION');
                              
              if (esSalud) {
                const valRaw = buscarColumna(h, ['TotalDevengado', 'ValorTotal', 'VRTotal', 'Total', 'Valor', 'Deduccion', 'Pago']);
                sumaDeduccion += parsearMonto(valRaw);
              }
            }
          });
          return Math.abs(sumaDeduccion);
        };

        // 🛡️ BÚSQUEDA DEL HISTÓRICO (INTELIGENTE SIN IMPORTAR ESPACIOS O MAYÚSCULAS): 
        const primeraEmpresa = Array.from(emp.empresasGrupo)[0] || 'Termales';
        
        // Encontramos la llave sin importar si en Firebase se guardó con espacios extra o diferente capitalización
        const llaveEncontrada = Object.keys(historicosPreCargados).find(k => 
           k.includes(periodoAnteriorStr) && 
           normalizarTexto(k).includes(normalizarTexto(primeraEmpresa))
        );

        if (llaveEncontrada && historicosPreCargados[llaveEncontrada]) {
            saludHistoricaTotal = extraerSaludDeEstructura(historicosPreCargados[llaveEncontrada]);
        }

        const ibcImplicitoHist = saludHistoricaTotal > 0 ? Math.round(saludHistoricaTotal / 0.04) : 0;
        
        if (ibcImplicitoHist > 0) {
          // El histórico de Firebase es de mes completo, dividimos en 30
          const ibcDiarioAnterior = ibcImplicitoHist / 30;
          
          if (!emp.esLiquidacion) {
             const diasAusentismo = 15 - emp.diasTrabajados;
             const ajusteIBCVacaciones = ibcDiarioAnterior * (diasAusentismo > 0 ? diasAusentismo : 15);
             
             // Aplicación estricta de la norma legal (Sin reglas híbridas)
             ibcBruto = emp.totalConstitutivoIBC + ajusteIBCVacaciones;
             emp.usoHistoricoAnterior = true; 
             emp.ibcAnteriorDetectado = ibcImplicitoHist;
          } else {
             ibcBruto = emp.totalConstitutivoIBC + emp.valorAusentismosIBC;
          }
        } else {
          // ⚠️ SI NO HAY HISTÓRICO Y HAY VACACIONES, MARCAMOS PARA AUDITORÍA INCOMPLETA 
          ibcBruto = emp.totalConstitutivoIBC + emp.valorAusentismosIBC;
          emp.requiereHistorico = true;
        }
      }
            
      // Ley 1393 (Tope 40%) - Las vacaciones de liquidacion NO suman aqui
      const limite40 = totalDevengado * 0.40;
      if (emp.totalNoConstitutivo > limite40) {
        ibcBruto += (emp.totalNoConstitutivo - limite40);
      }

      ibcLiquidacion = redondearBase(ibcBruto, pasoRedondeo);
      deberSerSalud = Math.round(ibcLiquidacion * 0.04);
      deberSerPension = Math.round(ibcLiquidacion * 0.04);
    }

    const difSalud = deberSerSalud - emp.descuentoSaludReal;
    const difPension = deberSerPension - emp.descuentoPensionReal;
   
    const ibcImplicitoSalud = emp.descuentoSaludReal > 0 ? Math.round(emp.descuentoSaludReal / 0.04) : 0;
    const ibcImplicitoPension = emp.descuentoPensionReal > 0 ? Math.round(emp.descuentoPensionReal / 0.04) : 0;
    
    const desalineacionBases = (emp.descuentoSaludReal > 0 && emp.descuentoPensionReal > 0) &&
                                Math.abs(ibcImplicitoSalud - ibcImplicitoPension) > pasoRedondeo;

    let tipoHallazgo = 'CONFORME';
    let severidad = 'CORRECTO';
    
    // Aplicamos la tolerancia global para limpiar los falsos positivos operativos
    const toleranciaAplicada = margenTolerancia;

    if (emp.esAprendizSena && emp.descuentoSaludReal === 0) {
      tipoHallazgo = 'CONFORME';
      severidad = 'CORRECTO (Aprendiz SENA)';
      conteoConformes++;
    } else if (emp.requiereHistorico) {
      // Si el empleado tuvo ausentismo pero no encontramos Abril en Firebase:
      tipoHallazgo = 'REQUIERE_HISTORICO';
      severidad = 'AUDITORÍA INCOMPLETA (Falta Histórico)';
      // No lo contamos en bajos pagos, conformes, ni excesos aún
    } else if (desalineacionBases) {
      tipoHallazgo = 'DESALINEACION_SUBSISTEMAS';
      severidad = 'ADVERTENCIA (Desalineación Salud/Pensión)';
      conteoDesalineados++;
    } else if (Math.abs(difSalud) <= toleranciaAplicada && Math.abs(difPension) <= toleranciaAplicada) {
      tipoHallazgo = 'CONFORME';
      severidad = 'CORRECTO';
      conteoConformes++;
    } else if (difSalud > margenTolerancia || difPension > margenTolerancia) {
      tipoHallazgo = 'PAGO_INSUFICIENTE'; 
      severidad = 'CRÍTICA (Riesgo UGPP)';
      conteoBajoPago++;
    } else {
      tipoHallazgo = 'PAGO_EXCESO'; 
      severidad = 'MODERADA (Descuento en Exceso al Empleado)';
      conteoExcesos++;
    }

   hallazgos.push({
      id: `${emp.llaveUnica}_${Math.random().toString(36).substring(2, 9)}`,
      empresa: emp.empresa,
      cedula: emp.cedula,
      periodo: emp.periodo,
      nombre: emp.nombre,
      cargo: emp.cargo, 
      diasTrabajados: emp.diasTrabajados,
      salarioBase: ibcLiquidacion,
      ibcImplicito: ibcImplicitoSalud || ibcImplicitoPension,
      ibcImplicitoPension,
      totalDevengadoSalarial: emp.totalConstitutivoIBC + emp.totalNoConstitutivo + emp.valorAusentismosIBC,
      auxilioDeberSer: deberSerSalud,
      auxilioPagado: emp.descuentoSaludReal,
      diferenciaExacta: difSalud,
      tipoHallazgo,
      severidad,
      usoHistoricoAnterior: emp.usoHistoricoAnterior,
      ibcAnteriorDetectado: emp.ibcAnteriorDetectado
    });
  }

  return {
    hallazgos,
    kpis: {
      totalEmpleados: Object.keys(empleadosPivoteados).length,
      conteoConformes,
      conteoBajoPago,
      conteoExcesos, 
      conteoDesalineados,
      conteoNoAplica: 0 
    }
  };
}