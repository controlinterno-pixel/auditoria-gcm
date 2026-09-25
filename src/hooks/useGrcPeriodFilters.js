// src/hooks/useGrcPeriodFilters.js
import { useState, useMemo, useEffect } from 'react';
import { getItemAnio, getItemMesText } from '../utils/helpers';

export function useGrcPeriodFilters({
  activeTab,
  subTabPlanificar,
  subTabResultados,
  subTabPlanes,
  subTabGobernanza,
  safeRiesgos,
  safeHallazgos,
  safePlanes,
  safeIncidentes,
  safeCronograma,
  safeComites,
  setSearchTerm,
  setColumnFilters
}) {
  const [periodFilters, setPeriodFilters] = useState({});

  const defaultAnios = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3]);
    safeRiesgos.forEach(r => r.anio && yearsSet.add(Number(r.anio)));
    safeHallazgos.forEach(h => h.anio && yearsSet.add(Number(h.anio)));
    safePlanes.forEach(p => p.anio && yearsSet.add(Number(p.anio)));
    safeIncidentes.forEach(i => i.anio && yearsSet.add(Number(i.anio)));
    safeCronograma.forEach(c => c.anio && yearsSet.add(Number(c.anio)));
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [safeRiesgos, safeHallazgos, safePlanes, safeIncidentes, safeCronograma]);

  const defaultMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const getCurrentFilterKey = () => {
    if (activeTab === 'plan_anual_tab') return `plan_anual_tab_${subTabPlanificar}`;
    if (activeTab === 'resultados_tab') return `resultados_tab_${subTabResultados}`;
    if (activeTab === 'planes_tab') return `planes_tab_${subTabPlanes}`;
    if (activeTab === 'gobernanza_tab') return `gobernanza_tab_${subTabGobernanza}`;
    return activeTab;
  };
  
  const filterKey = getCurrentFilterKey();

  const getDefaultAnios = (key) => {
    if (key === 'plan_anual_tab_riesgos' || key === 'plan_anual_tab_apetito') {
      return []; 
    }
    return [new Date().getFullYear()];
  };

  const selectedAnios = periodFilters[filterKey]?.anios || getDefaultAnios(filterKey);
  const selectedMeses = periodFilters[filterKey]?.meses || defaultMeses;

  const setSelectedAnios = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[filterKey] || { anios: getDefaultAnios(filterKey), meses: defaultMeses };
      return { ...prev, [filterKey]: { ...cur, anios: typeof valOrFunc === 'function' ? valOrFunc(cur.anios) : valOrFunc } };
    });
  };

  const setSelectedMeses = (valOrFunc) => {
    setPeriodFilters(prev => {
      const cur = prev[filterKey] || { anios: getDefaultAnios(filterKey), meses: defaultMeses };
      return { ...prev, [filterKey]: { ...cur, meses: typeof valOrFunc === 'function' ? valOrFunc(cur.meses) : valOrFunc } };
    });
  };

  useEffect(() => {
    setSearchTerm('');
    setColumnFilters({});
  }, [activeTab]);

  const handleColFilterChange = (key, value) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleAnio = (anio) => {
    setSelectedAnios(prev => prev.includes(anio) ? prev.filter(a => a !== anio) : [...prev, anio]);
  };
  
  const toggleMes = (mes) => {
    setSelectedMeses(prev => prev.includes(mes) ? prev.filter(m => m !== mes) : [...prev, mes]);
  };

  const filterByGlobalPeriod = (item) => {
    const a = getItemAnio(item);
    const m = getItemMesText(item);
    const passAnio = selectedAnios.length === 0 || selectedAnios.includes(Number(a)) || selectedAnios.includes(String(a));
    const passMes = selectedMeses.length === 0 || selectedMeses.includes(m);
    return passAnio && passMes;
  };

  const incFiltrados = useMemo(() => safeIncidentes.filter(filterByGlobalPeriod), [safeIncidentes, selectedAnios, selectedMeses]);
  const rFiltrados = useMemo(() => safeRiesgos.filter(filterByGlobalPeriod), [safeRiesgos, selectedAnios, selectedMeses]);
  const hFiltrados = useMemo(() => safeHallazgos.filter(filterByGlobalPeriod), [safeHallazgos, selectedAnios, selectedMeses]);
  const pFiltrados = useMemo(() => safePlanes.filter(filterByGlobalPeriod), [safePlanes, selectedAnios, selectedMeses]);

  const comitesFiltrados = useMemo(() => {
    return safeComites.filter(c => {
      const anioComite = Number(c.anio) || new Date().getFullYear();
      const mesComite = c.mes || '';
      const cumpleAnio = selectedAnios.length === 0 || selectedAnios.includes(anioComite);
      const cumpleMes = selectedMeses.length === 0 || selectedMeses.includes(mesComite);
      return cumpleAnio && cumpleMes;
    });
  }, [safeComites, selectedAnios, selectedMeses]);

  const cFiltrados = useMemo(() => safeCronograma.filter(c => {
    const anio = Number(c.anio) || new Date().getFullYear();
    return selectedAnios.length === 0 || selectedAnios.includes(anio);
  }), [safeCronograma, selectedAnios]);

  return {
    defaultAnios,
    defaultMeses,
    selectedAnios,
    selectedMeses,
    setSelectedAnios,
    setSelectedMeses,
    handleColFilterChange,
    toggleAnio,
    toggleMes,
    incFiltrados,
    rFiltrados,
    hFiltrados,
    pFiltrados,
    comitesFiltrados,
    cFiltrados
  };
}