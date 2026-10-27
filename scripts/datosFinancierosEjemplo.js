// scripts/datosFinancierosEjemplo.js - Apartados 8 y 11 del proyecto "Ejemplo" (sendero ecológico), con cifras
// coherentes entre sí: los ingresos del flujo de caja salen de la proyección del apartado 8.
// Supuestos: 200 recorridos al mes a $50.000, ajustados por temporada; año 2 con 5 % más demanda y precio;
// costos de operación de $5.500.000 al mes (guías por turnos, mantenimiento, insumos), 4 % más en el año 2 y
// 6 % más en el año 3; reposición de señalización de $4.000.000 en los meses 12 y 24.

const MESES = ['Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre'];
// Temporada: vacaciones de diciembre, enero y mitad de año arriba; lluvias de octubre y noviembre abajo.
const AJUSTES = [25, 30, -10, 0, -10, -10, 15, 15, 0, -10, -20, -20];
const CLIENTES = 200;
const PRECIO = 50000;
const OPERACION = 5500000;

export const INGRESOS_EJEMPLO = {
  metodo: 'bottom-up',
  periodos: MESES.map((mes, i) => ({ periodo: `${mes} ${i === 0 ? 2026 : 2027}`, clientes: CLIENTES, precio: PRECIO, ajuste: AJUSTES[i] })),
  supuestos: '200 recorridos al mes (6 % de los visitantes entre semana, según las 10 entrevistas) a $50.000 por persona. '
    + 'Ajuste por temporada: +25 % a +30 % en vacaciones de diciembre y enero, +15 % en junio y julio, −20 % en la temporada de lluvias de octubre y noviembre. '
    + 'Para el análisis financiero se supone un crecimiento del 5 % en el año 2 y del 3 % en el año 3.',
};

const ingresoMes = (i, factor) => Math.round(CLIENTES * PRECIO * (1 + AJUSTES[i % 12] / 100) * factor);
const CRECIMIENTO = [1, 1.05, 1.05 * 1.03];
const COSTOS = [1, 1.04, 1.04 * 1.06];

export const FINANCIERO_EJEMPLO = {
  unidadPeriodo: 'mes',
  // 15,4 % efectivo anual, la rentabilidad mínima de referencia (ficticia) para proyectos de la empresa.
  tasaDescuento: 1.2,
  flujos: [
    { periodo: 0, descripcion: 'Inversión inicial: diseño, adecuación del sendero, señalización y capacitación', ingresos: 0, egresos: 85000000 },
    ...Array.from({ length: 36 }, (_, i) => {
      const anio = Math.floor(i / 12);
      const reposicion = i === 11 || i === 23 ? 4000000 : 0;
      return {
        periodo: i + 1,
        descripcion: `${MESES[i % 12]} ${2026 + Math.floor((i + 11) / 12)}${reposicion ? ' · reposición de señalización' : ''}`,
        ingresos: ingresoMes(i, CRECIMIENTO[anio]),
        egresos: Math.round(OPERACION * COSTOS[anio]) + reposicion,
      };
    }),
  ],
  // Cifras calculadas con estos mismos flujos (src/utils/proyectos/financiero.js); la prueba las verifica.
  sensibilidad: 'Escenario base: VAN $46.779.879, TIR 4,19 % mensual (63,6 % E. A.), ROI 25,6 %, recuperación en 1 año y 7 meses (1 año y 9 meses a valor presente). '
    + 'Con 20 % menos visitantes: VAN −$14.236.857 y la inversión no se recupera a valor presente en los 3 años; el proyecto deja de ser viable si la demanda cae más de 15,3 %, por eso la demanda es la variable crítica a vigilar. '
    + 'Con costos de operación 15 % más altos: VAN $20.784.309 y recuperación a valor presente en 2 años y 3 meses. '
    + 'Si se aprueba el mirador (+$6.000.000 de inversión): VAN $40.779.879 y recuperación a valor presente en 1 año y 11 meses.',
};
