// Ruta: src/utils/motorAuditoria.js

export function auditarAuxilioTransporte(transaccionesExcel, mapeoConceptos, constantesAnuales) {
  const { smlmv, auxTransporte } = constantesAnuales;
  const limiteSalarial = smlmv * 2;
  const valorDiarioAuxilio = auxTransporte / 30;

  const empleados = {};

  // 1. Agrupar la información por Empleado
  transaccionesExcel.forEach(fila => {
    const cedula = fila.Identificacion;
    const concepto = fila.NombreConcepto;
    const valorTotal = fila.Total;
    const cantidadDias = fila.Cantidad;

    if (!empleados[cedula]) {
      empleados[cedula] = { nombre: fila.Nombres, salarioBaseAcumulado: 0, auxilioPagado: 0, diasTrabajados: 0 };
    }

    // Usamos el mapeo dinámico del usuario
    if (mapeoConceptos.salario_base && mapeoConceptos.salario_base.includes(concepto)) {
      empleados[cedula].salarioBaseAcumulado += valorTotal;
      empleados[cedula].diasTrabajados += cantidadDias; 
    }

    if (mapeoConceptos.aux_transporte && mapeoConceptos.aux_transporte.includes(concepto)) {
      empleados[cedula].auxilioPagado += valorTotal;
    }
  });

  // 2. Ejecutar la auditoría
  const hallazgos = [];

  for (const cedula in empleados) {
    const emp = empleados[cedula];
    let auxilioDeberSer = 0;

    if (emp.salarioBaseAcumulado <= limiteSalarial) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * emp.diasTrabajados);
    }

    const diferencia = Math.abs(auxilioDeberSer - emp.auxilioPagado);

    if (diferencia > 10) { // Tolerancia de 10 pesos
      hallazgos.push({
        cedula,
        nombre: emp.nombre,
        diferenciaExacta: auxilioDeberSer - emp.auxilioPagado,
        descripcion: `Se calculó un auxilio de $${auxilioDeberSer} pero se pagaron $${emp.auxilioPagado}.`
      });
    }
  }

  return hallazgos;
}