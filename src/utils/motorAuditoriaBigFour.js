// Ruta: src/utils/motorAuditoriaBigFour.js
import { normalizarSabanaNomina } from './normalizadorNomina';

export function ejecutarAuditoriaBigFour(filasExcel, parametrosLegales = {}) {
  const { smlmv = 1300000, auxTransporteMensual = 162000 } = parametrosLegales;
  const limiteSalarialQuincenal = smlmv; // $1.300.000 para 15 días
  const valorDiarioAuxilio = auxTransporteMensual / 30; // $5.400 / día

  // 1. Fase ETL
  const empleadosPivoteados = normalizarSabanaNomina(filasExcel);

  const hallazgos = [];
  let riesgoFinancieroTotal = 0;

  // 2. Fase Auditoría y Cruce Legal
  empleadosPivoteados.forEach(emp => {
    const diasEfectivos = Math.min(emp.diasTrabajados, 15); // Tope quincenal de 15 días
    
    // Regla Legal Auxilio Transporte Quincenal
    let auxilioDeberSer = 0;
    if (emp.sueldoBasico <= limiteSalarialQuincenal) {
      auxilioDeberSer = Math.round(valorDiarioAuxilio * diasEfectivos);
    }

    const difAuxilio = auxilioDeberSer - emp.auxilioTransportePagado;
    const difAbsoluta = Math.abs(difAuxilio);

    if (difAbsoluta > 100) {
      riesgoFinancieroTotal += difAbsoluta;
      
      const esBajoPago = difAuxilio > 0;

      hallazgos.push({
        id: crypto.randomUUID(),
        cedula: emp.cedula,
        nombre: emp.nombre,
        periodo: emp.periodo,
        centroCosto: emp.centroCosto,
        diasTrabajados: diasEfectivos,
        salarioBase: emp.sueldoBasico,
        auxilioDeberSer,
        auxilioPagado: emp.auxilioTransportePagado,
        diferencia: difAuxilio,
        diferenciaAbsoluta: difAbsoluta,
        tipoHallazgo: esBajoPago ? 'PAGO_INSUFICIENTE' : 'PAGO_EXCESO',
        severidad: esBajoPago ? 'CRÍTICA (UGPP)' : 'MODERADA (Exceso)'
      });
    }
  });

  return {
    hallazgos,
    kpis: {
      totalRegistrosAuditados: empleadosPivoteados.length,
      totalHallazgos: hallazgos.length,
      riesgoFinancieroTotal
    }
  };
}