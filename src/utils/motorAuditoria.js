/**
 * MOTOR DE AUDITORÍA ENTERPRISE - GCM AUDITOR v5.0
 * Cumplimiento Normativo UGPP / Art. 127 CST (Auxilio de Transporte & Seguridad Social)
 */

const HISTORICO_LEGAL = {
  2024: { smlmv: 1300000, auxTransporte: 162000 },
  2025: { smlmv: 1469000, auxTransporte: 181440 },
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
    const cedulaRaw = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodoRaw = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
    const valorRaw = buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'VRTotal', 'Total', 'Valor', 'Devengado', 'Monto', 'Pago', 'Deduccion']);
    const empresaRaw = buscarColumna(fila, ['Empresa', 'Compania', 'RazonSocial', 'NIT_Empresa']);
    const cantidadRaw = buscarColumna(fila, ['Cantidad', 'Dias', 'Cant']);

    if (!cedulaRaw) return;

    const cedula = cedulaRaw.toString().trim();
    const periodo = periodoRaw ? periodoRaw.toString().trim() : '228';
    const empresa = empresaRaw ? empresaRaw.toString().trim() : 'GENERAL';
    
    const llaveUnica = `${cedula}_${periodo}`;
    const conceptoLimpio = normalizarTexto(conceptoRaw);
    const valorTotal = parsearMonto(valorRaw);
    const cantidad = parsearMonto(cantidadRaw);

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        cedula,
        periodo,
        nombre: buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado', 'Trabajador']) || 'Sin Nombre',
        cargo: buscarColumna(fila, ['Cargo', 'DesCargo', 'Ocupacion']) || 'Sin Cargo',
        empresa,
        empresasGrupo: new Set([empresa]),
        totalConstitutivoIBC: 0,
        totalNoConstitutivo: 0,
        valorAusentismosIBC: 0,
        tieneLicenciaNoRemunerada: false,
        descuentoSaludReal: 0,
        descuentoPensionReal: 0,
        diasTrabajados: 0,
        esLiquidacion: false // 🚩 Nueva bandera
      };
    } else {
      empleadosPivoteados[llaveUnica].empresasGrupo.add(empresa);
      empleadosPivoteados[llaveUnica].empresa = Array.from(empleadosPivoteados[llaveUnica].empresasGrupo).join(' + ');
    }

    const emp = empleadosPivoteados[llaveUnica];

    // Detectar si el periodo incluye liquidación de prestaciones
    if (conceptoLimpio.includes('CESANTIA') || conceptoLimpio.includes('PRIMA DE SERVICIO')) {
      emp.esLiquidacion = true;
    }

    // ⚡ LEXICÓN DEFENSIVO DE BACKEND
    const esConstitutivoLexicon = [
      'SUELDO', 'SALARIO', 'BASICO', 'COMISION', 'HORA EXTRA', 'RECARGO', 'DOMINICAL', 
      'FESTIVO', 'NOCTURN', 'BONIFICACION SALARIAL', 'PRIMA SALARIAL', 'INCENTIVO', 
      'DESTAJO', 'AUXILIO SALARIAL', 'AJUSTE SALARIAL', 'DIFERENCIA SALARIAL', 
      'COMPENSACION SALARIAL', 'DIA DE LA FAMILIA', 'LICENCIA REMUNERADA'
    ].some(kw => conceptoLimpio.includes(kw));

    const esExcluidoIBC = ['NO REMUNERAD', 'CESANTIA', 'PRIMA DE SERVICIOS', 'SUSPENSION', 'INCAPACIDAD', 'INC.'].some(excl => conceptoLimpio.includes(excl));
    
    // Las vacaciones son excluidas del IBC SI es liquidación (Compensadas)
    const esVacacion = conceptoLimpio.includes('VACACION');

    const esNoSalarialLexicon = ['BONIFICACION NO PRESTACIONAL', 'VIATICO', 'RODAMIENTO', 'SOSTENIMIENTO', 'AUXILIO NO SALARIAL'].some(kw => conceptoLimpio.includes(kw));

    // LÓGICA DE ASIGNACIÓN ESTRICTA
    if ((conceptosConstitutivos.includes(conceptoLimpio) || esConstitutivoLexicon) && !esExcluidoIBC && !esVacacion) {
      emp.totalConstitutivoIBC += valorTotal;
      if (['SUELDO BASICO', 'BASICO', 'SUELDO', 'SALARIO'].includes(conceptoLimpio)) {
        emp.diasTrabajados += cantidad;
      }
    } else if (ausentismosIBC.includes(conceptoLimpio) || esVacacion || conceptoLimpio.includes('INCAPACIDAD') || conceptoLimpio.includes('INC.')) {
      // 🚩 SOLO sumamos las vacaciones al IBC si NO es una liquidación de contrato
      if (esVacacion && emp.esLiquidacion) {
        emp.totalNoConstitutivo += valorTotal; // Pasan a ser un pago no salarial exento
      } else {
        emp.valorAusentismosIBC += valorTotal;
      }
    } else if (conceptosNoSalariales.includes(conceptoLimpio) || esNoSalarialLexicon) {
      emp.totalNoConstitutivo += valorTotal;
    } else if (licenciasNoRemuneradas.includes(conceptoLimpio) || conceptoLimpio.includes('NO REMUNERAD') || conceptoLimpio.includes('SUSPENSION')) {
      emp.tieneLicenciaNoRemunerada = true;
    } else if (conceptosSalud.includes(conceptoLimpio) || (conceptoLimpio.includes('SALUD') && !conceptoLimpio.includes('FONDO') && !conceptoLimpio.includes('EMPRESA'))) {
      emp.descuentoSaludReal += Math.abs(valorTotal);
    } else if (conceptosPension.includes(conceptoLimpio) || ((conceptoLimpio.includes('PENSION') || conceptoLimpio.includes('SOLIDARIDAD')) && !conceptoLimpio.includes('FONDO') && !conceptoLimpio.includes('EMPRESA'))) {
      emp.descuentoPensionReal += Math.abs(valorTotal);
    }
  });
  const hallazgos = [];
  let conteoConformes = 0;
  let conteoBajoPago = 0;
  let conteoExcesos = 0;
  let conteoDesalineados = 0;

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    
    // Extracción dinámica de días laborados
    let diasEfectivos = emp.diasTrabajados > 0 ? emp.diasTrabajados : 15;
    diasEfectivos = Math.max(0, Math.min(diasEfectivos, 15));

    const totalDevengado = emp.totalConstitutivoIBC + emp.totalNoConstitutivo + emp.valorAusentismosIBC;
    let ibcBruto = emp.totalConstitutivoIBC + emp.valorAusentismosIBC;
    
    // Ley 1393 (Tope 40%)
    const limite40 = totalDevengado * 0.40;
    if (emp.totalNoConstitutivo > limite40) {
      ibcBruto += (emp.totalNoConstitutivo - limite40);
    }

    // Redondeo al paso configurado
    const ibcLiquidacion = redondearBase(ibcBruto, pasoRedondeo);

    // Deber ser normativo del 4%
    const deberSerSalud = Math.round(ibcLiquidacion * 0.04);
    const deberSerPension = Math.round(ibcLiquidacion * 0.04);

    const difSalud = deberSerSalud - emp.descuentoSaludReal;
    const difPension = deberSerPension - emp.descuentoPensionReal;

    // IBC Implícito (Nivel 2: Solamente para diagnóstico informativo en Modal)
    const ibcImplicitoSalud = emp.descuentoSaludReal > 0 ? Math.round(emp.descuentoSaludReal / 0.04) : 0;
    const ibcImplicitoPension = emp.descuentoPensionReal > 0 ? Math.round(emp.descuentoPensionReal / 0.04) : 0;
    
    const desalineacionBases = (emp.descuentoSaludReal > 0 && emp.descuentoPensionReal > 0) &&
                                Math.abs(ibcImplicitoSalud - ibcImplicitoPension) > pasoRedondeo;

    // NIVEL 1: AUDITORÍA NORMATIVA DE AUDIT (Basada ÚNICAMENTE en si los aportes reales corresponden al 4% del IBC Motor)
    let tipoHallazgo = 'CONFORME';
    let severidad = 'CORRECTO';
    
    if (desalineacionBases) {
      tipoHallazgo = 'DESALINEACION_SUBSISTEMAS';
      severidad = 'ADVERTENCIA (Desalineación Salud/Pensión)';
      conteoDesalineados++;
    } else if (Math.abs(difSalud) <= margenTolerancia && Math.abs(difPension) <= margenTolerancia) {
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
      diasTrabajados: diasEfectivos,
      salarioBase: ibcLiquidacion, // IBC Motor
      ibcImplicito: ibcImplicitoSalud || ibcImplicitoPension,
      ibcImplicitoPension,
      totalDevengadoSalarial: totalDevengado,
      auxilioDeberSer: deberSerSalud, // Deber Ser Salud 4%
      auxilioPagado: emp.descuentoSaludReal, // Descuento Real Salud
      diferenciaExacta: difSalud,
      tipoHallazgo,
      severidad
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