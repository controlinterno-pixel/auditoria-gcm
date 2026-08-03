// Ruta: src/utils/motorAuditoria.js

/**
 * MOTOR DE AUDITORÍA ENTERPRISE - GCM AUDITOR
 * Cumplimiento Normativo UGPP / Art. 127 CST (Auxilio de Transporte)
 */

// 🌟 BASE DE DATOS LOCAL DE CONSTANTES LEGALES (Fácil de actualizar)
const HISTORICO_LEGAL = {
  2024: { smlmv: 1300000, auxTransporte: 162000 },
  2025: { smlmv: 1469000, auxTransporte: 181440 }, // Valores hipotéticos 2025
  2026: { smlmv: 1880000, auxTransporte: 249096 }, // Valores actuales deducidos
  // 2027: { smlmv: XXXXXX, auxTransporte: XXXXXX } -> Se agrega aquí en el futuro
};

// Helper para normalizar textos
const normalizarTexto = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const parsearMonto = (val) => {
  // ... (Mismo código de parsearMonto que ya tienes) ...
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
  // ... (Mismo código de buscarColumna que ya tienes) ...
  const llavesExcel = Object.keys(fila);
  for (const alias of aliasPosibles) {
    const aliasNorm = normalizarTexto(alias).replace(/[\s_]/g, '');
    const llaveReal = llavesExcel.find(k => normalizarTexto(k).replace(/[\s_]/g, '') === aliasNorm);
    if (llaveReal) return fila[llaveReal];
  }
  return undefined;
};

// Agregamos 'anoAuditoria' como parámetro (por defecto 2026)
export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos = {}, anoAuditoria = 2026) {
  
  // Extraemos las constantes basándonos en el año, si no existe, usamos 2026 por seguridad
  const constantes = HISTORICO_LEGAL[anoAuditoria] || HISTORICO_LEGAL[2026];
  const { smlmv, auxTransporte } = constantes;
  
  const limiteSalarialQuincenal = smlmv; // 2 SMLMV mensual = 1 SMLMV quincenal
  const valorDiarioAuxilio = auxTransporte / 30; 

  const conceptosSalario = (mapeoConceptos?.salario_base || []).map(normalizarTexto);
  const conceptosAuxilio = (mapeoConceptos?.aux_transporte || []).map(normalizarTexto);
  const conceptosAusentismos = (mapeoConceptos?.ausentismos || []).map(normalizarTexto);

// ==========================================
  // FASE 1: ETL & PIVOTE DE EMPLEADOS 
  // ==========================================
  
  // 🧹 DESDUPLICACIÓN INTELIGENTE (Elimina duplicados de archivos consolidados)
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

  transaccionesExcel.forEach(fila => {
    // Búsqueda defensiva absoluta (Soporte Helisa, Novasoft, SAP, etc.)
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
    
   // 🔑 LLAVE ÚNICA CONSOLIDADA (GRUPO EMPRESARIAL): Evalúa al empleado por cédula, sumando todas las empresas
    const llaveUnica = `${cedula}_${periodo}`;    
    const conceptoLimpio = normalizarTexto(conceptoRaw);
    const valorTotal = parsearMonto(valorRaw);
    const cantidadDias = parsearMonto(cantidadRaw);

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        empresa: empresa, 
        cedula,
        periodo,
        nombre: nombreRaw ? nombreRaw.toString().trim() : 'Sin Nombre',
        cargo: cargoRaw ? cargoRaw.toString().trim() : 'Sin Cargo',
        sueldoBasico: 0,
        otrosDevengadosSalariales: 0,
        totalDevengadoSalarial: 0,
        auxilioPagado: 0,
        diasTrabajados: 0,
        diasAusentismos: 0,
        empresasGrupo: new Set([empresa]) // Rastrear en cuántas empresas está
      };
    } else {
      // Si el empleado ya existe en el periodo, agregamos la nueva empresa al Set
      empleadosPivoteados[llaveUnica].empresasGrupo.add(empresa);
      // Actualizamos la etiqueta de la empresa para que el UI muestre "Fam + RecreFam"
      empleadosPivoteados[llaveUnica].empresa = Array.from(empleadosPivoteados[llaveUnica].empresasGrupo).join(' + ');
    }
       

    const emp = empleadosPivoteados[llaveUnica];

    // Acumular conceptos salariales
    if (conceptosSalario.includes(conceptoLimpio)) {
      if (conceptoLimpio.includes('SUELDO BASICO') || conceptoLimpio === 'BASICO' || conceptoLimpio === 'SUELDO') {
        emp.sueldoBasico += valorTotal;
      } else {
        emp.otrosDevengadosSalariales += valorTotal;
      }
      emp.totalDevengadoSalarial += valorTotal;
      
      // Control de días para evitar duplicar por horas extras
      if (conceptoLimpio.includes('SUELDO') || conceptoLimpio.includes('BASICO')) {
        emp.diasTrabajados += cantidadDias;
      }
    }

    // Acumular auxilio pagado
    if (conceptosAuxilio.includes(conceptoLimpio)) {
      emp.auxilioPagado += valorTotal;
    }
  
  });
  // ==========================================
  // FASE 2: MOTOR REGLAS DE NEGOCIO Y UGPP
  // ==========================================
  const hallazgos = [];
  let riesgoFinancieroTotal = 0;
  let conteoConformes = 0;
  let conteoBajoPago = 0;
  let conteoExcesos = 0;
  let conteoNoAplica = 0;

  // +++ PEGAR  +++
  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    
   // Toma directamente los días laborados del Sueldo Básico
    let diasEfectivos = emp.diasTrabajados;
    diasEfectivos = Math.max(0, Math.min(diasEfectivos, 15));
    
   // Proyección de Salario Básico (Blindaje Legal Art 127 CST)
    let salarioBaseProyectado = 0;
    if (diasEfectivos > 0) {
      salarioBaseProyectado = (emp.sueldoBasico / diasEfectivos) * 15;
    }

    // Evaluación Integral: Básico Proyectado + Variables Reales (Extras/Comisiones)
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
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${emp.llaveUnica}_${Math.random().toString(36).substring(2, 9)}`,
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
// NUEVO MÓDULO: AUDITORÍA SEGURIDAD SOCIAL (UGPP) - BIG FOUR STANDARD
// ==========================================
export function auditarSeguridadSocial(transaccionesExcel, mapeoConceptos = {}) {
  const conceptosSalario = (mapeoConceptos?.salario_base || []).map(normalizarTexto);
  const conceptosNoSalariales = (mapeoConceptos?.devengados_no_salariales || []).map(normalizarTexto);
  const conceptosSalud = (mapeoConceptos?.salud || []).map(normalizarTexto);
  const conceptosPension = (mapeoConceptos?.pension || []).map(normalizarTexto);
  const conceptosAusentismos = (mapeoConceptos?.ausentismos || []).map(normalizarTexto);

  const empleadosPivoteados = {};

  // FASE 1: LECTURA Y CONSOLIDACIÓN MULTI-EMPRESA
  transaccionesExcel.forEach(fila => {
    const cedulaRaw = buscarColumna(fila, ['Identificacion', 'Cedula', 'NIT', 'Documento']);
    const periodoRaw = buscarColumna(fila, ['IDEN_Periodo', 'Periodo', 'Mes', 'Quincena']);
    const conceptoRaw = buscarColumna(fila, ['NombreConcepto', 'Concepto', 'Descripcion', 'Detalle']);
    const valorRaw = buscarColumna(fila, ['TotalDevengado', 'ValorTotal', 'VRTotal', 'Total', 'Valor', 'Devengado', 'Monto', 'Pago', 'Deduccion']);
    const empresaRaw = buscarColumna(fila, ['Empresa', 'Compania', 'RazonSocial', 'NIT_Empresa']);

    if (!cedulaRaw) return;

    const cedula = cedulaRaw.toString().trim();
    const periodo = periodoRaw ? periodoRaw.toString().trim() : 'GENERAL';
    const empresa = empresaRaw ? empresaRaw.toString().trim() : 'GENERAL';
    
    // Llave agrupada por Cédula + Periodo (No por empresa, para consolidar Fam+RecreFam)
    const llaveUnica = `${cedula}_${periodo}`;
    const conceptoLimpio = normalizarTexto(conceptoRaw);
    const valorTotal = parsearMonto(valorRaw);

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        cedula,
        periodo,
        nombre: buscarColumna(fila, ['Nombres', 'Nombre', 'Empleado', 'Trabajador']) || 'Sin Nombre',
        empresa: empresa,
        empresasGrupo: new Set([empresa]),
        totalConstitutivoIBC: 0,
        totalNoConstitutivo: 0,
        valorAusentismos: 0,
        descuentoSaludReal: 0,
        descuentoPensionReal: 0,
      };
    } else {
      // Consolidación de grupo: Añadir empresa al Set y actualizar nombre visual
      empleadosPivoteados[llaveUnica].empresasGrupo.add(empresa);
      empleadosPivoteados[llaveUnica].empresa = Array.from(empleadosPivoteados[llaveUnica].empresasGrupo).join(' + ');
    }

    const emp = empleadosPivoteados[llaveUnica];

    // Distribución a las bolsas exactas
    if (conceptosSalario.includes(conceptoLimpio)) {
      emp.totalConstitutivoIBC += valorTotal;
    } else if (conceptosNoSalariales.includes(conceptoLimpio)) {
      emp.totalNoConstitutivo += valorTotal;
    } else if (conceptosAusentismos.includes(conceptoLimpio)) {
      emp.valorAusentismos += valorTotal;
    } else if (conceptosSalud.includes(conceptoLimpio)) {
      emp.descuentoSaludReal += Math.abs(valorTotal);
    } else if (conceptosPension.includes(conceptoLimpio)) {
      emp.descuentoPensionReal += Math.abs(valorTotal);
    }
  });

  // FASE 2: CÁLCULO MATEMÁTICO UGPP Y LEY 1393
  const hallazgos = [];
  let conteoConformes = 0;
  let conteoRiesgo = 0; 
  let conteoExcesos = 0; 
  const margenTolerancia = 100; // Tolerancia por redondeos

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    
    // El Total Devengado incluye TODO (Salarial + No Salarial + Ausentismos pagados)
    const totalDevengado = emp.totalConstitutivoIBC + emp.totalNoConstitutivo + emp.valorAusentismos;
    
    // El IBC Base arranca con lo salarial y los ausentismos
    let ibcFinal = emp.totalConstitutivoIBC + emp.valorAusentismos;
    
    // Aplicación estricta del Art 30 Ley 1393 de 2010 (Tope del 40%)
    const limite40 = totalDevengado * 0.40;
    if (emp.totalNoConstitutivo > limite40) {
      const excesoLey1393 = emp.totalNoConstitutivo - limite40;
      ibcFinal += excesoLey1393;
    }

    const deberSerSalud = Math.round(ibcFinal * 0.04);
    const deberSerPension = Math.round(ibcFinal * 0.04);

    const difSalud = deberSerSalud - emp.descuentoSaludReal;
    const difPension = deberSerPension - emp.descuentoPensionReal;

    // 🌟 INGENIERÍA INVERSA: CÁLCULO DEL IBC IMPLÍCITO (Descuento Real / 4%)
    // Si hubo descuento, reconstruimos la base. Si no, es 0.
    const ibcImplicito = emp.descuentoSaludReal > 0 ? Math.round(emp.descuentoSaludReal / 0.04) : 0;

    let tipoHallazgo = 'CONFORME';
    let severidad = 'CORRECTO';
    
    if (Math.abs(difSalud) > margenTolerancia || Math.abs(difPension) > margenTolerancia) {
      if (difSalud > margenTolerancia || difPension > margenTolerancia) {
        tipoHallazgo = 'PAGO_INSUFICIENTE'; 
        severidad = 'CRÍTICA (UGPP)';
        conteoRiesgo++;
      } else {
        tipoHallazgo = 'PAGO_EXCESO'; 
        severidad = 'MODERADA (Exceso al empleado)';
        conteoExcesos++;
      }
    } else {
      conteoConformes++;
    }

    hallazgos.push({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${emp.llaveUnica}_${Math.random().toString(36).substring(2, 9)}`,
      empresa: emp.empresa,
      cedula: emp.cedula,
      periodo: emp.periodo,
      nombre: emp.nombre,
      cargo: 'N/A', 
      diasTrabajados: 15,
      salarioBase: ibcFinal, 
      ibcImplicito, // 👈 ¡Inyectamos nuestra nueva variable aquí!
      totalDevengadoSalarial: totalDevengado,
      auxilioDeberSer: deberSerSalud, 
      auxilioPagado: emp.descuentoSaludReal, 
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
      conteoBajoPago: conteoRiesgo,
      conteoExcesos, 
      conteoNoAplica: 0 
    }
  };
}
