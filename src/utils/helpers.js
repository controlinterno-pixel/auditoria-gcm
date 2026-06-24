export const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
export const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };
export const mapMesNumATexto = { 
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", 
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", 
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre" 
};

export const formatSafeDate = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val);
};

export const getMonthFromDate = (dateVal) => {
  const dateStr = formatSafeDate(dateVal);
  if (!dateStr || dateStr.length < 7) return 'N/A';
  if (dateStr.includes('-')) return dateStr.split('-')[1]; 
  return 'N/A';
};

export const getYearFromDate = (dateVal) => {
  const dateStr = formatSafeDate(dateVal);
  if (!dateStr) return 'N/A';
  if (dateStr.includes('-')) return dateStr.split('-')[0];
  return 'N/A';
};

export const getItemAnio = (item) => {
  if (item.anio) return Number(item.anio);
  const dateStr = formatSafeDate(item.fecha);
  if (dateStr) return Number(getYearFromDate(dateStr)) || new Date().getFullYear();
  return new Date().getFullYear();
};

export const getItemMesText = (item) => {
  if (item.mes) return item.mes;
  const dateStr = formatSafeDate(item.fecha);
  if (dateStr) {
    const mNum = getMonthFromDate(dateStr);
    return mapMesNumATexto[mNum] || "Mayo";
  }
  return "Mayo";
};

export const calcularMatriz5x5 = (probabilidad, impacto) => {
  const pVal = mapProbabilidadNum[probabilidad] || 3;
  const iVal = mapImpactoNum[impacto] || 2;
  const score = pVal * iVal;

  let apetito = "Dentro de Apetito";
  let accion = "Aceptar / Monitorear";
  let color = "bg-emerald-500 text-white";
  let borderSemaforo = "border-emerald-200";

  if (score <= 4) {
    color = "bg-emerald-500 text-white"; borderSemaforo = "border-emerald-600";
  } else if (score <= 9) {
    color = "bg-yellow-400 text-slate-900"; borderSemaforo = "border-yellow-600"; accion = "Monitorear periódicamente";
  } else if (score <= 16) {
    color = "bg-orange-500 text-white"; borderSemaforo = "border-orange-600"; apetito = "Fuera de Apetito"; accion = "Mitigar / Ajustar Controles";
  } else {
    color = "bg-red-600 text-white"; borderSemaforo = "border-red-700"; apetito = "Fuera de Apetito"; accion = "Evitar / Suspender Proceso / Transferir";
  }
  return { score, apetito, accion, color, borderSemaforo };
};

export const applyFilters = (dataArray, globalTerm, colFilters = {}) => {
  let result = dataArray;
  if (globalTerm) {
    const lowerTerm = globalTerm.toLowerCase();
    result = result.filter(item => 
      Object.values(item).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(lowerTerm))
    );
  }
  if (colFilters && Object.keys(colFilters).length > 0) {
    Object.entries(colFilters).forEach(([key, filterValue]) => {
      if (filterValue) {
        const lowerFilter = filterValue.toLowerCase();
        result = result.filter(item => {
          const val = item[key];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerFilter);
        });
      }
    });
  }
  return result;
};