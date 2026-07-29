// Ruta: src/utils/motorAuditoria.js

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos, constantesAnuales) {
  const { smlmv, auxTransporte } = constantesAnuales;
  const limiteSalarial = smlmv * 2;
  const valorDiarioAuxilio = auxTransporte / 30;

  const empleados = {};

  // 1. AGRUPAR Y LIMPIAR LA INFORMACIÓN POR EMPLEADO
  transaccionesExcel.forEach(fila => {
    // 🛡️ Blindaje de columnas: Busca variantes comunes en nombres de columnas de ERPs
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula || fila.CEDULA || fila.NIT;
    const nombre = fila.Nombres || fila.NOMBRES || fila.Empleado || fila.EMPLEADO;
    const concepto = fila.NombreConcepto || fila['Nombre Concepto'] || fila.Concepto || fila.CONCEPTO;
    
    // 🛡️ Blindaje matemático: Forzar a número y convertir nulos a cero
    const valorTotal = parseFloat(fila.Total || fila.TOTAL || fila.Valor || fila.VALOR || 0);
    const cantidadDias = parseFloat(fila.Cantidad || fila.CANTIDAD || fila.Dias || fila.DIAS || 0);

    // Evitar procesar subtotales o filas vacías del Excel
    if (!cedula) return; 

    if (!empleados[cedula]) {
      empleados[cedula] = { 
        nombre: nombre, 
        salarioBaseAcumulado: 0, 
        auxilioPagado: 0, 
        diasTrabajados: 0 
      };
    }

    // Clasificar según el mapeo que hizo el usuario en pantalla
    if (mapeoConceptos.salario_base && mapeoConceptos.salario_base.includes(concepto)) {
      empleados[cedula].salarioBaseAcumulado += valorTotal;
      empleados[cedula].diasTrabajados += cantidadDias; 
    }

    if (mapeoConceptos.aux_transporte && mapeoConceptos.aux_transporte.includes(concepto)) {
      empleados[cedula].auxilioPagado += valorTotal;
    }
  });

  // Imprimir para diagnóstico en consola
  console.log(`📊 El motor consolidó las transacciones en ${Object.keys(empleados).length} empleados únicos.`);

  // 2. EJECUTAR LA AUDITORÍA MATEMÁTICA
  const hallazgos = [];

  for (const cedula in empleados) {
    const emp = empleados[cedula];
    let auxilioDeberSer = 0;

    // Solo se calcula auxilio si el salario base está por debajo del límite legal (2 SMLMV)
    if (emp.salarioBaseAcumulado <= limiteSalarial) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * emp.diasTrabajados);
    }

    const diferencia = Math.abs(auxilioDeberSer - emp.auxilioPagado);

    // Tolerancia de 100 pesos colombianos por posibles redondeos de decimales en el ERP
    if (diferencia > 100) { 
      hallazgos.push({
        id: crypto.randomUUID(), // Identificador único para renderizar en React
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