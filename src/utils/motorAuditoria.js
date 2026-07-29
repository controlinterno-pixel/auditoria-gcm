// Ruta: src/utils/motorAuditoria.js

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos, constantesAnuales) {
  const { smlmv = 1300000, auxTransporte = 162000 } = constantesAnuales;
  
  // Parámetros Quincenales
  const limiteSalarialQuincenal = smlmv; // 2 SMLMV quincenales = 1 SMLMV mensual ($1.300.000)
  const valorDiarioAuxilio = auxTransporte / 30; // $5.400 / día

  // 🛡️ Sanitizador Universal de Números y Moneda
  const parsearMonto = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = val.toString().trim();
    if (!str) return 0;
    let clean = str.replace(/[^0-9.,-]/g, '');
    if (!clean) return 0;

    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.lastIndexOf('.') < clean.lastIndexOf(',') 
        ? clean.replace(/\./g, '').replace(',', '.') 
        : clean.replace(/,/g, '');
    } else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        clean = parts.join('');
      }
    } else if (clean.includes(',')) {
      const parts = clean.split(',');
      clean = parts.length === 2 && parts[1].length <= 2 
        ? `${parts[0]}.${parts[1]}` 
        : parts.join('');
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const registrosQuincenales = {};

  // 1. ETL: PIVOTEO Y CONSOLIDACIÓN POR CÉDULA + PERÍODO
  transaccionesExcel.forEach(fila => {
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula || fila.CEDULA || fila.NIT;
    const periodo = fila.IDEN_Periodo || fila.Periodo || fila.IDEN_PERIODO || '228';
    const nombre = fila.Nombres || fila.NOMBRES || fila.Empleado || fila.EMPLEADO;
    const concepto = (fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || fila.CONCEPTO || '').toString().trim();

    const valorTotal = parsearMonto(fila.Total ?? fila.TOTAL ?? fila.Valor ?? fila.VALOR ?? 0);
    const cantidadDias = parsearMonto(fila.Cantidad ?? fila.CANTIDAD ?? fila.Dias ?? fila.DIAS ?? 0);

    if (!cedula) return;

    // Clave Compuesta: Cédula + Período (Ej. "4583653_228")
    const llaveUnica = `${cedula.toString().trim()}_${periodo.toString().trim()}`;

    if (!registrosQuincenales[llaveUnica]) {
      registrosQuincenales[llaveUnica] = {
        llaveUnica,
        cedula: cedula.toString().trim(),
        periodo: periodo.toString().trim(),
        nombre: nombre ? nombre.toString().trim() : 'Empleado Sin Nombre',
        salarioBaseAcumulado: 0,
        auxilioPagado: 0,
        diasTrabajados: 0
      };
    }

    if (mapeoConceptos.salario_base?.includes(concepto)) {
      registrosQuincenales[llaveUnica].salarioBaseAcumulado += valorTotal;
      registrosQuincenales[llaveUnica].diasTrabajados += cantidadDias;
    }

    if (mapeoConceptos.aux_transporte?.includes(concepto)) {
      registrosQuincenales[llaveUnica].auxilioPagado += valorTotal;
    }
  });

  // 2. AUDITORÍA QUINCENAL (REGLAS LEGALES COLOMBIANAS)
  const hallazgos = [];
  let riesgoFinancieroTotal = 0;

  for (const llave in registrosQuincenales) {
    const reg = registrosQuincenales[llave];
    
    // Normalización de días trabajados por quincena (Máximo 15 días)
    const diasEfectivos = Math.min(reg.diasTrabajados, 15);
    let auxilioDeberSer = 0;

    // Regla Quincenal: Salario Base <= $1.300.000 COP
    if (reg.salarioBaseAcumulado <= limiteSalarialQuincenal) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * diasEfectivos);
    }

    const diferenciaExacta = auxilioDeberSer - reg.auxilioPagado;
    const diferenciaAbsoluta = Math.abs(diferenciaExacta);

    // Margen de tolerancia de $100 COP por redondeos ERP
    if (diferenciaAbsoluta > 100) {
      riesgoFinancieroTotal += diferenciaAbsoluta;

      const esPagoInsuficiente = diferenciaExacta > 0;
      
      hallazgos.push({
        id: crypto.randomUUID(),
        cedula: reg.cedula,
        periodo: reg.periodo,
        nombre: reg.nombre,
        diasTrabajados: diasEfectivos,
        salarioBase: reg.salarioBaseAcumulado,
        auxilioDeberSer,
        auxilioPagado: reg.auxilioPagado,
        diferenciaExacta,
        diferenciaAbsoluta,
        tipoHallazgo: esPagoInsuficiente ? 'PAGO_INSUFICIENTE' : 'PAGO_EXCESO',
        severidad: esPagoInsuficiente ? 'CRÍTICA' : 'MODERADA'
      });
    }
  }

  return {
    hallazgos,
    kpis: {
      totalEmpleados: Object.keys(registrosQuincenales).length,
      totalHallazgos: hallazgos.length,
      riesgoFinancieroTotal
    }
  };
}