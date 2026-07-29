// Ruta: src/utils/motorAuditoria.js

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos, constantesAnuales) {
  const { smlmv = 1300000, auxTransporte = 162000 } = constantesAnuales;
  const limiteSalarial = smlmv * 2;
  const valorDiarioAuxilio = auxTransporte / 30;

  // 🛡️ Parser Robusto Universal para Formato Monetario Colombiano/Anglosajón
  const parsearMonto = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    
    let str = val.toString().trim();
    if (!str) return 0;

    // Limpia símbolos monetarios y letras
    let clean = str.replace(/[^0-9.,-]/g, '');
    if (!clean) return 0;

    // Caso A: Formato Latino "$ 1.489.761,00" o Anglosajón "1,489,761.00"
    if (clean.includes('.') && clean.includes(',')) {
      if (clean.lastIndexOf('.') < clean.lastIndexOf(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } 
    // Caso B: Solo puntos (ej. "1.489.761" o "124.548")
    else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts.length > 2) {
        clean = parts.join(''); // Múltiples puntos -> separadores de miles
      } else if (parts.length === 2 && parts[1].length === 3) {
        clean = clean.replace('.', ''); // Un solo punto seguido de 3 dígitos -> miles colombianos
      }
    } 
    // Caso C: Solo comas (ej. "1489761,00" o "1,489,761")
    else if (clean.includes(',')) {
      const parts = clean.split(',');
      if (parts.length > 2) {
        clean = parts.join('');
      } else if (parts.length === 2) {
        clean = parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
      }
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const empleados = {};

  // 1. CONSOLIDACIÓN Y LIMPIEZA DE TRANSACCIONES
  transaccionesExcel.forEach(fila => {
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula || fila.CEDULA || fila.NIT;
    const nombre = fila.Nombres || fila.NOMBRES || fila.Empleado || fila.EMPLEADO;
    const concepto = (fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || fila.CONCEPTO || '').toString().trim();

    const valorTotal = parsearMonto(fila.Total ?? fila.TOTAL ?? fila.Valor ?? fila.VALOR ?? 0);
    const cantidadDias = parsearMonto(fila.Cantidad ?? fila.CANTIDAD ?? fila.Dias ?? fila.DIAS ?? 0);

    if (!cedula) return;

    if (!empleados[cedula]) {
      empleados[cedula] = {
        cedula: cedula.toString().trim(),
        nombre: nombre ? nombre.toString().trim() : 'Empleado Sin Nombre',
        salarioBaseAcumulado: 0,
        auxilioPagado: 0,
        diasTrabajados: 0
      };
    }

    if (mapeoConceptos.salario_base?.includes(concepto)) {
      empleados[cedula].salarioBaseAcumulado += valorTotal;
      empleados[cedula].diasTrabajados += cantidadDias;
    }

    if (mapeoConceptos.aux_transporte?.includes(concepto)) {
      empleados[cedula].auxilioPagado += valorTotal;
    }
  });

  // 2. AUDITORÍA MATEMÁTICA Y LEGAL (REGLAS UGPP Y CONTRATACIÓN)
  const hallazgos = [];
  let riesgoFinancieroTotal = 0;

  for (const cedula in empleados) {
    const emp = empleados[cedula];
    
    // Normalizamos a tope comercial de 30 días
    const diasEfectivos = Math.min(emp.diasTrabajados, 30);
    let auxilioDeberSer = 0;

    // Regla Legal: Salario Base <= 2 SMLMV ($2.600.000)
    if (emp.salarioBaseAcumulado <= limiteSalarial) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * diasEfectivos);
    }

    const diferenciaExacta = auxilioDeberSer - emp.auxilioPagado;
    const diferenciaAbsoluta = Math.abs(diferenciaExacta);

    // Margen de tolerancia de $100 COP por redondeos ERP
    if (diferenciaAbsoluta > 100) {
      riesgoFinancieroTotal += diferenciaAbsoluta;

      const esPagoInsuficiente = diferenciaExacta > 0;
      
      hallazgos.push({
        id: crypto.randomUUID(),
        cedula: emp.cedula,
        nombre: emp.nombre,
        diasTrabajados: diasEfectivos,
        salarioBase: emp.salarioBaseAcumulado,
        auxilioDeberSer,
        auxilioPagado: emp.auxilioPagado,
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
      totalEmpleados: Object.keys(empleados).length,
      totalHallazgos: hallazgos.length,
      riesgoFinancieroTotal
    }
  };
}