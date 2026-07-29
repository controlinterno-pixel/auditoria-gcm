// Ruta: src/utils/motorAuditoria.js

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos, constantesAnuales) {
  const { smlmv, auxTransporte } = constantesAnuales;
  const limiteSalarial = smlmv * 2;
  const valorDiarioAuxilio = auxTransporte / 30;

  const empleados = {};

  // 🛡️ Helper para parsear importes (Soporta números directos y texto con formato $1.000.000)
  const parsearMonto = (val) => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    // Si viene como string, elimina formato $ y puntos/comas de miles
    let str = val.toString().trim().replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // 1. AGRUPAR Y LIMPIAR LA INFORMACIÓN POR EMPLEADO
  transaccionesExcel.forEach(fila => {
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula || fila.CEDULA || fila.NIT;
    const nombre = fila.Nombres || fila.NOMBRES || fila.Empleado || fila.EMPLEADO;
    const concepto = fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || fila.CONCEPTO;
    
    // Leemos la columna Total o sus variantes
    const valorTotal = parsearMonto(fila.Total ?? fila.TOTAL ?? fila.Valor ?? fila.VALOR ?? 0);
    const cantidadDias = parsearMonto(fila.Cantidad ?? fila.CANTIDAD ?? fila.Dias ?? fila.DIAS ?? 0);

    if (!cedula) return; 

    if (!empleados[cedula]) {
      empleados[cedula] = { 
        nombre: nombre, 
        salarioBaseAcumulado: 0, 
        auxilioPagado: 0, 
        diasTrabajados: 0 
      };
    }

    // Clasificar según el mapeo seleccionado en la UI
    if (mapeoConceptos.salario_base && mapeoConceptos.salario_base.includes(concepto)) {
      empleados[cedula].salarioBaseAcumulado += valorTotal;
      empleados[cedula].diasTrabajados += cantidadDias; 
    }

    if (mapeoConceptos.aux_transporte && mapeoConceptos.aux_transporte.includes(concepto)) {
      empleados[cedula].auxilioPagado += valorTotal;
    }
  });

  // 2. EJECUTAR LA AUDITORÍA MATEMÁTICA
  const hallazgos = [];

  for (const cedula in empleados) {
    const emp = empleados[cedula];
    let auxilioDeberSer = 0;

    // Si el salario base no supera los 2 SMLMV, tiene derecho al auxilio
    if (emp.salarioBaseAcumulado <= limiteSalarial) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * emp.diasTrabajados);
    }

    const diferencia = Math.abs(auxilioDeberSer - emp.auxilioPagado);

    // Margen de tolerancia de $100 por redondeos de nómina
    if (diferencia > 100) { 
      hallazgos.push({
        id: crypto.randomUUID(),
        cedula,
        nombre: emp.nombre || 'Sin nombre',
        diasTrabajados: emp.diasTrabajados,
        salarioBase: emp.salarioBaseAcumulado,
        auxilioDeberSer,
        auxilioPagado: emp.auxilioPagado,
        diferenciaExacta: auxilioDeberSer - emp.auxilioPagado,
        descripcion: `Auditoría: Se esperaba un pago de $${auxilioDeberSer.toLocaleString('es-CO')} pero se registró $${emp.auxilioPagado.toLocaleString('es-CO')}.`
      });
    }
  }

  return hallazgos;
}