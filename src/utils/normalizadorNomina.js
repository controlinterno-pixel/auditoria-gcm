// Ruta: src/utils/normalizadorNomina.js

export function normalizarSabanaNomina(filasExcel) {
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
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  const empleadosPorPeriodo = {};

  filasExcel.forEach(fila => {
    const cedula = fila.Identificacion || fila.IDENTIFICACION || fila.Cedula;
    const periodo = fila.IDEN_Periodo || fila.Periodo || 'GENERAL';
    const concepto = (fila.NombreConcepto || fila.Concepto || '').toString().trim();
    const valor = parsearMonto(fila.Total ?? fila.Valor ?? 0);
    const cantidad = parsearMonto(fila.Cantidad ?? fila.Dias ?? 0);

    if (!cedula) return;

    // Clave Única: Cédula + Período de Pago
    const llaveUnica = `${cedula}_${periodo}`;

    if (!empleadosPorPeriodo[llaveUnica]) {
      empleadosPorPeriodo[llaveUnica] = {
        llaveUnica,
        cedula: cedula.toString().trim(),
        nombre: (fila.Nombres || fila.Empleado || 'Empleado').toString().trim(),
        periodo,
        cargo: fila.Cargo || 'N/A',
        centroCosto: fila.NombreCcosto || 'N/A',
        // Conceptos Pivoteados
        sueldoBasico: 0,
        auxilioTransportePagado: 0,
        saludEmpleado: 0,
        pensionEmpleado: 0,
        saludPatronal: 0,
        pensionPatronal: 0,
        cajaCompensacion: 0,
        icbf: 0,
        sena: 0,
        arl: 0,
        rodamiento: 0,
        diasTrabajados: 0,
        conceptosAdicionales: {}
      };
    }

    const emp = empleadosPorPeriodo[llaveUnica];

    // Mapeo dinámico de filas a columnas
    switch (concepto.toUpperCase()) {
      case 'SUELDO BASICO':
      case 'SUELDO RETROACTIVO':
      case 'SUELDO POR LICENCIA REMUNERADA':
        emp.sueldoBasico += valor;
        emp.diasTrabajados += cantidad;
        break;

      case 'SUBSIDIO DE TRANSPORTE':
        emp.auxilioTransportePagado += valor;
        break;

      case 'SALUD':
        emp.saludEmpleado += Math.abs(valor);
        break;

      case 'PENSION':
        emp.pensionEmpleado += Math.abs(valor);
        break;

      case 'CAJA DE COMPENSACIÓN':
        emp.cajaCompensacion += valor;
        break;

      case 'RIESGOS PROFESIONALES':
        emp.arl += valor;
        break;

      case 'AUXILIO DE RODAMIENTO':
        emp.rodamiento += valor;
        break;

      default:
        emp.conceptosAdicionales[concepto] = (emp.conceptosAdicionales[concepto] || 0) + valor;
        break;
    }
  });

  return Object.values(empleadosPorPeriodo);
}