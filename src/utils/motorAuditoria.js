// Ruta: src/utils/motorAuditoria.js

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos, constantesAnuales) {
  const { smlmv = 1300000, auxTransporte = 162000 } = constantesAnuales;
  const limiteSalarial = smlmv * 2;
  const valorDiarioAuxilio = auxTransporte / 30;

  // 🛡️ Sanitizador universal de datos numéricos
  const parsearMonto = (val) => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let str = val.toString().trim().replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const empleados = {};

  // 1. CONSOLIDACIÓN Y LIMPIEZA DE TRANSACCIONES
  transaccionesExcel.forEach(fila => {
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula || fila.CEDULA || fila.NIT;
    const nombre = fila.Nombres || fila.NOMBRES || fila.Empleado || fila.EMPLEADO;
    const concepto = fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || fila.CONCEPTO;

    const valorTotal = parsearMonto(fila.Total ?? fila.TOTAL ?? fila.Valor ?? fila.VALOR ?? 0);
    const cantidadDias = parsearMonto(fila.Cantidad ?? fila.CANTIDAD ?? fila.Dias ?? fila.DIAS ?? 0);

    if (!cedula) return;

    if (!empleados[cedula]) {
      empleados[cedula] = {
        cedula,
        nombre: nombre || 'Empleado Sin Nombre',
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

  // 2. AUDITORÍA MATEMÁTICA Y LEGAL (REGLAS UGPP)
  const hallazgos = [];
  let riesgoFinancieroTotal = 0;

  for (const cedula in empleados) {
    const emp = empleados[cedula];
    
    // Normalizamos a tope de 30 días según regulación comercial
    const diasEfectivos = Math.min(emp.diasTrabajados, 30);
    let auxilioDeberSer = 0;

    // Regla: Salario Base <= 2 SMLMV ($2.600.000)
    if (emp.salarioBaseAcumulado <= limiteSalarial) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * diasEfectivos);
    }

    const diferenciaExacta = auxilioDeberSer - emp.auxilioPagado;
    const diferenciaAbsoluta = Math.abs(diferenciaExacta);

    // Margen de tolerancia de $100 COP por redondeos de nómina ERP
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
        severidad: esPagoInsuficiente ? 'CRÍTICA' : 'MODERADA',
        descripcion: esPagoInsuficiente
          ? `Bajo Pago: Le correspondían $${auxilioDeberSer.toLocaleString('es-CO')} por ${diasEfectivos} días, pero recibió $${emp.auxilioPagado.toLocaleString('es-CO')}.`
          : `Pago Improcedente: Salario supera 2 SMLMV ($${emp.salarioBaseAcumulado.toLocaleString('es-CO')}) o cobró en exceso.`
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