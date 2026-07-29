// Ruta: src/utils/motorAuditoria.js

/**
 * MOTOR DE AUDITORÍA ENTERPRISE - GCM AUDITOR
 * Cumplimiento Normativo UGPP / Art. 127 CST (Auxilio de Transporte)
 */
export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos = {}, constantesAnuales = {}) {
  const { smlmv = 1300000, auxTransporte = 162000 } = constantesAnuales;
  
  const limiteSalarialQuincenal = smlmv; // 1 SMLMV quincenal ($1.300.000)
  const valorDiarioAuxilio = auxTransporte / 30; // $5.400 / día

  // Mapeo flexible: Conceptos que constituyen salario según Art. 127 CST
  const conceptosSalario = (mapeoConceptos?.salario_base && mapeoConceptos.salario_base.length > 0)
    ? mapeoConceptos.salario_base.map(c => c.toString().toUpperCase().trim())
    : [
        'SUELDO BASICO', 'SUELDO RETROACTIVO', 'SUELDO POR LICENCIA REMUNERADA',
        'HORAS EXTRAS DIURNAS', 'HORAS EXTRAS NOCTURNAS', 'HORAS EXTRAS FESTIVAS O DOMINICALES',
        'HORAS EXTRAS FESTIVAS NOCTURNAS', 'HORA RECARGO DOMINICAL', 'HORAS RECARGO NOCTURNO',
        'COMISIONES VENTAS', 'BONIFICACION PRESTACIONAL'
      ];

  const conceptosAuxilio = (mapeoConceptos?.aux_transporte && mapeoConceptos.aux_transporte.length > 0)
    ? mapeoConceptos.aux_transporte.map(c => c.toString().toUpperCase().trim())
    : ['SUBSIDIO DE TRANSPORTE'];

  // Helper de parseo numérico robusto
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

  // ==========================================
  // FASE 1: ETL & PIVOTE DE EMPLEADOS (Objeto 360°)
  // ==========================================
  const empleadosPivoteados = {};

  transaccionesExcel.forEach(fila => {
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula || fila.CEDULA || fila.NIT;
    const periodo = fila.IDEN_Periodo || fila.Periodo || fila.IDEN_PERIODO || '228';
    const nombre = fila.Nombres || fila.NOMBRES || fila.Empleado || fila.EMPLEADO;
    const conceptoRaw = (fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || fila.CONCEPTO || '').toString().toUpperCase().trim();

    const valorTotal = parsearMonto(fila.Total ?? fila.TOTAL ?? fila.Valor ?? fila.VALOR ?? 0);
    const cantidadDias = parsearMonto(fila.Cantidad ?? fila.CANTIDAD ?? fila.Dias ?? fila.DIAS ?? 0);

    if (!cedula) return;

    const llaveUnica = `${cedula.toString().trim()}_${periodo.toString().trim()}`;

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        cedula: cedula.toString().trim(),
        periodo: periodo.toString().trim(),
        nombre: nombre ? nombre.toString().trim() : 'Empleado Sin Nombre',
        // Estructura Enterprise
        sueldoBasico: 0,
        otrosDevengadosSalariales: 0,
        totalDevengadoSalarial: 0,
        auxilioPagado: 0,
        diasTrabajados: 0
      };
    }

    const emp = empleadosPivoteados[llaveUnica];

    // Acumular conceptos salariales (Básico + Recargos + Extras + Comisiones)
    if (conceptosSalario.includes(conceptoRaw)) {
      if (conceptoRaw === 'SUELDO BASICO') {
        emp.sueldoBasico += valorTotal;
      } else {
        emp.otrosDevengadosSalariales += valorTotal;
      }
      emp.totalDevengadoSalarial += valorTotal;
      emp.diasTrabajados += cantidadDias;
    }

    // Acumular auxilio pagado
    if (conceptosAuxilio.includes(conceptoRaw)) {
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

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    const diasEfectivos = Math.min(emp.diasTrabajados, 15);
    
    // Regla Legal 1: ¿El Total Devengado Salarial está dentro del tope legal (<= 1 SMLMV quincenal)?
    const tieneDerechoLegal = emp.totalDevengadoSalarial > 0 && emp.totalDevengadoSalarial <= limiteSalarialQuincenal;

    // Regla Legal 2: Cálculo del Deber Ser
    let auxilioDeberSer = 0;
    if (tieneDerechoLegal) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * diasEfectivos);
    }

    // Regla Legal 3: Comparación y Clasificación
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
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : `${emp.llaveUnica}_${Math.random().toString(36).substring(2, 9)}`,
      cedula: emp.cedula,
      periodo: emp.periodo,
      nombre: emp.nombre,
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

  // ==========================================
  // FASE 3: METRICAS Y SALIDA ENTERPRISE
  // ==========================================
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