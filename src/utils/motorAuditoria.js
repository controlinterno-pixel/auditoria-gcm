/**
 * MOTOR DE AUDITORÍA ENTERPRISE - GCM AUDITOR v5.0
 * Cumplimiento Normativo UGPP / Art. 127 CST (Auxilio de Transporte & Seguridad Social)
 */
import { cargarNominaHistorica } from '../services/historicoService';

const HISTORICO_LEGAL = {
  2024: { smlmv: 1300000, auxTransporte: 162000 },
  2025: { smlmv: 1469000, auxTransporte: 181440 },
  // Valores confirmados para el año 2026
  2026: { smlmv: 1880000, auxTransporte: 249096 },
};

const normalizarTexto = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
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
    str = parts.length === 2 && parts[1].length <= 2 
      ? `${parts[0]}.${parts[1]}` 
      : parts.join('');
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
    const huella = `${cedula.toString().trim()}_${periodo ? periodo.toString().trim() : ''}_${normalizarTexto(concepto)}_${cantidad}_${total}`;
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
    const cedula = cedulaRaw.toString().trim();
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
  const margenTolerancia = pasoRedondeo; 

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
    const huella = `${cedula.toString().trim()}_${periodo ? periodo.toString().trim() : ''}_${normalizarTexto(concepto)}_${cantidad}_${total}`;
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
      llavesLiquidacion.add(`${cedula.toString().trim()}_${periodo ? periodo.toString().trim() : '228'}`);
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

    const cedula = cedulaRaw.toString().trim();
    const periodoCons = periodoRaw ? periodoRaw.toString().trim() : '228';
    
   let periodoNormalizadoISO = "";
    if (anoMesRaw) {
      const str = anoMesRaw.toString().replace('/', '-').trim();
      if (str.includes('-')) {
        const [a, m] = str.split('-');
        periodoNormalizadoISO = `${a}-${m.padStart(2, '0')}`;
      } else if (str.length === 6) {
        periodoNormalizadoISO = `${str.substring(0, 4)}-${str.substring(4, 6)}`;
      }
    } 
    
    // Extracción dinámica del mes según la quincena o la fecha (evita dejar '-05' fijo)
    if (!periodoNormalizadoISO && anoRaw) {
      const mesDetectado = Math.ceil((parseInt(periodoCons) || 228) / 2) % 12 || 5;
      periodoNormalizadoISO = `${anoRaw}-${mesDetectado.toString().padStart(2, '0')}`; 
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
        tieneLicenciaNoRemunerada: false,
        descuentoSaludReal: 0,
        descuentoPensionReal: 0,
        diasTrabajados: 0,
        esLiquidacion: llavesLiquidacion.has(llaveUnica), // Pre-identificado
        esAprendizSena: normalizarTexto(cargoRaw).includes('APRENDIZ') || normalizarTexto(cargoRaw).includes('SENA') || conceptoLimpio.includes('SOSTENIMIENTO')
      };
    } else {
      empleadosPivoteados[llaveUnica].empresasGrupo.add(empresa);
      empleadosPivoteados[llaveUnica].empresa = Array.from(empleadosPivoteados[llaveUnica].empresasGrupo).join(' + ');
    }

    const emp = empleadosPivoteados[llaveUnica];

   // Lexicón defensivo
    const esConstitutivoLexicon = [
      'SUELDO', 'SALARIO', 'BASICO', 'COMISION', 'HORA EXTRA', 'RECARGO', 'DOMINICAL', 
      'FESTIVO', 'NOCTURN', 'BONIFICACION SALARIAL', 'PRIMA SALARIAL', 'INCENTIVO', 
      'DESTAJO', 'AUXILIO SALARIAL', 'AJUSTE SALARIAL', 'DIFERENCIA SALARIAL', 
      'COMPENSACION SALARIAL', 'LICENCIA REMUNERADA' // 👈 DÍA DE LA FAMILIA SE ELIMINÓ DE AQUÍ
    ].some(kw => conceptoLimpio.includes(kw));

    const esExcluidoIBC = ['NO REMUNERAD', 'CESANTIA', 'PRIMA DE SERVICIO', 'SUSPENSION', 'INCAPACIDAD', 'INC.', 'FAMILIA'].some(excl => conceptoLimpio.includes(excl));
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
        // En liquidación definitiva las vacaciones compensadas no cotizan a Salud/Pensión
        emp.totalNoConstitutivo += valorTotal; 
      } else {
        // Netea positivos y negativos (reversiones de vacaciones)
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

// 🧠 PRE-CARGA EFICIENTE DE HISTÓRICOS (Mes Anterior)
  // Evita hacer cientos de consultas individuales a la BD dentro del bucle
  const historicosPreCargados = {};
  const periodosEmpresasNecesarios = new Set();

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    if (emp.valorAusentismosIBC > 0 && emp.periodoISO) {
      const [anoStr, mesStr] = emp.periodoISO.split('-');
      let ano = parseInt(anoStr);
      let mes = parseInt(mesStr) - 1;
      if (mes === 0) {
        mes = 12;
        ano -= 1;
      }
      const periodoAnterior = `${ano}-${mes.toString().padStart(2, '0')}`;
      const keyConsulta = `${periodoAnterior}|${emp.empresa || 'Termales'}`;
      periodosEmpresasNecesarios.add(keyConsulta);
    }
  }

  // Consultamos a Firebase/BD solo los meses estrictamente necesarios de forma masiva
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
      // Regla Especial SENA: $0 retención a salud para el aprendiz
      ibcLiquidacion = emp.totalNoConstitutivo || 394000;
      deberSerSalud = 0;
      deberSerPension = 0;
    } else {
      let diasEfectivos = emp.diasTrabajados > 0 ? emp.diasTrabajados : 15;
      diasEfectivos = Math.max(0, Math.min(diasEfectivos, 15));

      const totalDevengado = emp.totalConstitutivoIBC + emp.totalNoConstitutivo + emp.valorAusentismosIBC;
      let ibcBruto = emp.totalConstitutivoIBC + emp.valorAusentismosIBC;

      // 🏖️ PROMEDIO HISTÓRICO LEGAL (ART. 70 DECRETO 806/1998)
      if (emp.valorAusentismosIBC > 0 && emp.periodoISO) {
        const [anoStr, mesStr] = emp.periodoISO.split('-');
        let ano = parseInt(anoStr);
        let mes = parseInt(mesStr) - 1;
        if (mes === 0) { mes = 12; ano -= 1; }
        const periodoAnterior = `${ano}-${mes.toString().padStart(2, '0')}`;
        const keyConsulta = `${periodoAnterior}|${emp.empresa || 'Termales'}`;
        
        const historicoMesAnterior = historicosPreCargados[keyConsulta] || [];
        const empHist = historicoMesAnterior.find(h => h.cedula === emp.cedula);
        
        if (empHist && empHist.ibcImplicito > 0) {
          const ibcDiarioAnterior = empHist.ibcImplicito / 30;
          
          // 🛡️ REGLA: No inflar el IBC con históricos fantasma si el empleado fue liquidado (esLiquidacion)
          let ajusteIBCVacaciones = 0;
          if (!emp.esLiquidacion) {
             const diasAusentismo = 15 - emp.diasTrabajados;
             // Si el ausentismo no es exactamente 15, tomamos el faltante real.
             ajusteIBCVacaciones = ibcDiarioAnterior * (diasAusentismo > 0 ? diasAusentismo : 15);
          } else {
             // Si está liquidado, el IBC es estrictamente lo devengado
             ajusteIBCVacaciones = emp.valorAusentismosIBC;
          }
          
          ibcBruto = (emp.totalConstitutivoIBC) + ajusteIBCVacaciones;
          emp.usoHistoricoAnterior = true; 
          emp.ibcAnteriorDetectado = empHist.ibcImplicito;
        }
      }
      
      // Ley 1393 (Tope 40%)
      const limite40 = totalDevengado * 0.40;
      if (emp.totalNoConstitutivo > limite40) {
        ibcBruto += (emp.totalNoConstitutivo - limite40);
      }

      // Redondeo al paso configurado
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
    
    // Un margen de hasta $1.500 es normal por diferencias en cortes de decimales al promediar el mes anterior
    const toleranciaUsoHistorico = emp.usoHistoricoAnterior ? 1500 : margenTolerancia;

    if (emp.esAprendizSena && emp.descuentoSaludReal === 0) {
      tipoHallazgo = 'CONFORME';
      severidad = 'CORRECTO (Aprendiz SENA)';
      conteoConformes++;
    } else if (desalineacionBases) {
      tipoHallazgo = 'DESALINEACION_SUBSISTEMAS';
      severidad = 'ADVERTENCIA (Desalineación Salud/Pensión)';
      conteoDesalineados++;
    } else if (Math.abs(difSalud) <= toleranciaUsoHistorico && Math.abs(difPension) <= toleranciaUsoHistorico) {
      tipoHallazgo = 'CONFORME';
      severidad = 'CORRECTO';
      conteoConformes++;
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
      usoHistoricoAnterior: emp.usoHistoricoAnterior, // 👈 Inyectamos a la UI
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