// Ruta: src/utils/motorAuditoria.js

/**
 * MOTOR DE AUDITORÍA ENTERPRISE - GCM AUDITOR
 * Cumplimiento Normativo UGPP / Art. 127 CST (Auxilio de Transporte)
 */

// Helper para normalizar textos (quita tildes, ñ, espacios extra y pasa a mayúsculas)
const normalizarTexto = (str) => {
  if (!str) return "";
  return str
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quita tildes
    .toUpperCase()
    .trim();
};

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

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos = {}, constantesAnuales = {}) {
  const { smlmv = 1300000, auxTransporte = 162000 } = constantesAnuales;
  
  const limiteSalarialQuincenal = smlmv; // 1 SMLMV quincenal ($1.300.000)
  const valorDiarioAuxilio = auxTransporte / 30; // $5.400 / día

  // Normalizamos las selecciones que vienen de la UI
  const conceptosSalario = (mapeoConceptos?.salario_base || []).map(normalizarTexto);
  const conceptosAuxilio = (mapeoConceptos?.aux_transporte || []).map(normalizarTexto);

  // ==========================================
  // FASE 1: ETL & PIVOTE DE EMPLEADOS (Objeto 360°)
  // ==========================================
  const empleadosPivoteados = {};

  transaccionesExcel.forEach(fila => {
    // Búsqueda defensiva de columnas (Soporte Multi-Software)
    const cedulaRaw = fila.Identificacion ?? fila.IDENTIFICACION ?? fila.Cedula ?? fila.CEDULA ?? fila.NIT;
    const periodoRaw = fila.IDEN_Periodo ?? fila.Periodo ?? fila.IDEN_PERIODO ?? '228';
    const nombreRaw = fila.Nombres ?? fila.NOMBRES ?? fila.Empleado ?? fila.EMPLEADO;
    const conceptoRaw = fila.NombreConcepto ?? fila['Nombre Concepto'] ?? fila.Concepto ?? fila.CONCEPTO;
    
    const valorRaw = fila.Total ?? fila.TOTAL ?? fila.Valor ?? fila.VALOR ?? fila.ValorTotal ?? fila.VR_TOTAL ?? fila.Devengado ?? fila.Monto;
    const cantidadRaw = fila.Cantidad ?? fila.CANTIDAD ?? fila.Dias ?? fila.DIAS ?? fila.CANT;

    if (!cedulaRaw) return; // Si no hay cédula, saltamos la fila

    const cedula = cedulaRaw.toString().trim();
    const periodo = periodoRaw.toString().trim();
    const llaveUnica = `${cedula}_${periodo}`;
    
    // Normalizamos el concepto aplicando la regla anti-tildes
    const conceptoLimpio = normalizarTexto(conceptoRaw);
    const valorTotal = parsearMonto(valorRaw);
    const cantidadDias = parsearMonto(cantidadRaw);

    if (!empleadosPivoteados[llaveUnica]) {
      empleadosPivoteados[llaveUnica] = {
        llaveUnica,
        cedula,
        periodo,
        nombre: nombreRaw ? nombreRaw.toString().trim() : 'Empleado Sin Nombre',
        sueldoBasico: 0,
        otrosDevengadosSalariales: 0,
        totalDevengadoSalarial: 0,
        auxilioPagado: 0,
        diasTrabajados: 0
      };
    }

    const emp = empleadosPivoteados[llaveUnica];

    // Acumular conceptos salariales
    if (conceptosSalario.includes(conceptoLimpio)) {
      if (conceptoLimpio.includes('SUELDO BASICO') || conceptoLimpio === 'BASICO') {
        emp.sueldoBasico += valorTotal;
      } else {
        emp.otrosDevengadosSalariales += valorTotal;
      }
      emp.totalDevengadoSalarial += valorTotal;
      // Solo sumamos días en el sueldo básico para no duplicar días por horas extras
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

  for (const llave in empleadosPivoteados) {
    const emp = empleadosPivoteados[llave];
    
    // Si por algún motivo los días vienen en 0 pero hay devengo, forzamos a 15 (quincena)
    let diasEfectivos = emp.diasTrabajados > 0 ? emp.diasTrabajados : 15;
    diasEfectivos = Math.min(diasEfectivos, 15); // Tope quincenal
    
    const tieneDerechoLegal = emp.totalDevengadoSalarial > 0 && emp.totalDevengadoSalarial <= limiteSalarialQuincenal;

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
    } else if (diferenciaAbsoluta > 100) { // Tolerancia de 100 pesos por redondeo
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