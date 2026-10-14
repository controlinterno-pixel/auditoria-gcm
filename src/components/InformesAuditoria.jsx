import { Fragment, useState, useEffect } from 'react';
import { renderHistorialSummary } from '../utils/historialCambios.js';
import { useCatalogos } from '../context/useCatalogos';

import { apiService } from '../services/apiService';
import { TIPOS_FUENTE, resolverTipoFuente } from '../constants/diccionariosGRC';

// Función para evitar que Programa de Auditoría caiga en la categoría genérica "Otra Fuente"
const resolverCategoriaFuente = (tipo, fuentes) => {
  if (String(tipo).trim() === 'Programa de Auditoría') {
    return 'Programa de Auditoría';
  }
  return resolverTipoFuente(tipo, fuentes);
};
const fusionarAdjuntosUnicos = (listaActual = [], nuevos = []) => {
  const map = new Map();
  [...listaActual, ...nuevos].forEach((item) => {
    if (!item || !item.url) return;
    const clave = `${item.url}|${item.nombre || ''}`;
    if (!map.has(clave)) map.set(clave, item);
  });
  return [...map.values()];
};

const normalizarCatalogo = valor => String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const convertirSubprocesosLista = valores => (
  Array.isArray(valores)
    ? valores.map(valor => String(valor || '').trim()).filter(Boolean)
    : String(valores || '').split(',').map(valor => valor.trim()).filter(Boolean)
);
const convertirMacroprocesosLista = valores => [...new Set(
  (Array.isArray(valores) ? valores : String(valores || '').split(','))
    .map(valor => String(valor || '').trim())
    .filter(Boolean)
)];
const mapaSubprocesos = (macroprocesos, subprocesos, relacion = {}) => {
  const macros = convertirMacroprocesosLista(macroprocesos);
  const legado = convertirSubprocesosLista(subprocesos);
  return Object.fromEntries(macros.map((macro, indice) => [
    macro,
    convertirSubprocesosLista(relacion?.[macro] ?? (indice === 0 ? legado : [])),
  ]));
};
const aplanarSubprocesos = relacion => [...new Set(Object.values(relacion || {}).flat())];
const obtenerMacroprocesosInforme = informe => convertirMacroprocesosLista(
  informe?.macroprocesos || informe?.macroproceso || informe?.proceso
);
const obtenerSubprocesosInforme = (informe, macroproceso = '') => {
  const relacion = informe?.subprocesosPorMacroproceso;
  if (relacion && typeof relacion === 'object') {
    const macros = macroproceso ? [macroproceso] : obtenerMacroprocesosInforme(informe);
    return [...new Set(macros.flatMap(macro => {
      const clave = Object.keys(relacion).find(valor => normalizarCatalogo(valor) === normalizarCatalogo(macro));
      return convertirSubprocesosLista(clave ? relacion[clave] : []);
    }))];
  }
  return convertirSubprocesosLista(informe?.subprocesos ?? informe?.subproceso);
};
const claveCorreoCargo = (cargo, macroproceso, subprocesos) => (
  `${normalizarCatalogo(cargo)}|${normalizarCatalogo(macroproceso)}|${convertirSubprocesosLista(subprocesos).map(normalizarCatalogo).sort().join('|')}`
);
const obtenerCorreoCargoCatalogo = (catalogoCargos, cargo, macroproceso, subproceso) => {
  const cargoNormalizado = normalizarCatalogo(cargo);
  const macroNormalizado = normalizarCatalogo(macroproceso);
  const subprocesosNormalizados = convertirSubprocesosLista(subproceso).map(normalizarCatalogo);
  const candidatos = (Array.isArray(catalogoCargos) ? catalogoCargos : []).filter(registro => (
    registro?.activo !== false &&
    normalizarCatalogo(registro?.cargo) === cargoNormalizado &&
    String(registro?.correoCorporativo || '').trim()
  ));
  const delMacroproceso = candidatos.filter(registro => normalizarCatalogo(registro.macroproceso) === macroNormalizado);
  const asignacion = delMacroproceso.find(registro => {
    const subprocesos = Array.isArray(registro.subprocesos)
      ? registro.subprocesos
      : registro.subproceso ? [registro.subproceso] : [];
    return subprocesos.some(valor => subprocesosNormalizados.includes(normalizarCatalogo(valor)));
  }) || delMacroproceso[0] || candidatos[0];
  return String(asignacion?.correoCorporativo || '').trim();
};

export default function InformesAuditoria({ 
  informesAuditoria, 
  setInformesAuditoria,
  safeProgramas = [],
  editInformeAuditoria, 
  setEditInformeAuditoria, 
  isAdmin, 
  searchTerm = '',
  setSearchTerm = () => {},
  columnFilters, 
  handleColFilterChange, 
  exportToExcel, 
  handleInformeAuditoriaSubmit, 
  puedeCrearInformes = false,
  puedeEditarInformes = false,
  isSubmitting, 
  setFormResetKey, 
  scrollToForm, 
  handleDeleteItem, 
  applyFilters, 
  FilterInput,
  fuentesMejora = []
}) {
  const { catalogoCargos = [], mapaProcesos: MAPA_PROCESOS, cargosEmpresa: CARGOS_EMPRESA } = useCatalogos();

  // 🏢 CONTROL DE CARGOS MÚLTIPLES EN SOCIALIZACIÓN
  const [participantesMultiples, setParticipantesMultiples] = useState([]);
  const [correosCargosResueltos, setCorreosCargosResueltos] = useState({});
  const [participanteTemp, setParticipanteTemp] = useState('');
  // 🌟 ESTADOS TEMPORALES PARA EL FORMULARIO
  // (Eliminamos estados redundantes que causaban desfases en los selects)
  const [macroprocesoFormState, setMacroprocesoForm] = useState(null);
  const [subprocesoFormState, setSubprocesoForm] = useState(null);
  const [reparandoConsecutivos, setReparandoConsecutivos] = useState(false);

  // Derivamos de editInformeAuditoria en el render cuando no haya interacción manual del usuario
  const idEdicion = editInformeAuditoria?.id || 'nuevo';
  const macroprocesoForm = macroprocesoFormState?.[idEdicion] ?? (
    editInformeAuditoria?.macroprocesos?.[0] || editInformeAuditoria?.macroproceso || editInformeAuditoria?.proceso || ''
  );
  const subprocesoForm = subprocesoFormState?.[idEdicion] ?? (editInformeAuditoria?.subproceso || 'General');
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
  const referenciasInforme = safeInformes.reduce((conteo, informe) => {
    const ref = String(informe?.ref || '').trim().toUpperCase();
    if (/^INF-\d{4}-\d+$/.test(ref)) conteo.set(ref, (conteo.get(ref) || 0) + 1);
    return conteo;
  }, new Map());
  const informesConReferenciaDuplicada = [...referenciasInforme.values()].reduce(
    (total, cantidad) => total + Math.max(0, cantidad - 1),
    0
  );
  const fuentesMejoraDisponibles = Array.isArray(fuentesMejora) ? fuentesMejora : [];

  // 🧭 ESTADOS DE NAVEGACIÓN (TABS Y ACORDEÓN)
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [agruparPor, setAgruparPor] = useState('Proceso');
  
  // ✨ NUEVO ESTADO: Controla el modal de vista de detalle único (Imagen 2)
  const [informeDetalleModal, setInformeDetalleModal] = useState(null);
  const [informeExpandidoId, setInformeExpandidoId] = useState(null);

  // 🛑 LÓGICA DE CONTROL ACTUALIZADA: Permite crear informes desde otras fuentes
  const handleCrearNuevoInforme = () => {
    const abrirNuevoInforme = () => {
      setEditInformeAuditoria(null);
      setModoVistaCompleta(false);
      setVistaActiva('nuevo');
    };

    if (vistaActiva !== 'nuevo') {
      abrirNuevoInforme();
      return;
    }

    confirmarSalidaSinGuardar(abrirNuevoInforme);
  };

  // 🎛️ ESTADOS DEL PANEL LATERAL
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroSubproceso, setDashFiltroSubproceso] = useState('Todos');
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroFuente, setDashFiltroFuente] = useState('Todas'); // ✨ NUEVO ESTADO PARA EL FILTRO DE PILLS
  const [procesosKpiAbierto, setProcesosKpiAbierto] = useState(false);

  // ✨ ESTADO Y LÓGICA DE PAGINACIÓN REAL
  const [paginaActual, setPaginaActual] = useState(1);
  const actualizarFiltroDashboard = (actualizarFiltro, valor) => {
    actualizarFiltro(valor);
    setPaginaActual(1);
    setProcesosKpiAbierto(false);
  };
  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos');
    setDashFiltroProceso('Todos');
    setDashFiltroSubproceso('Todos');
    setDashFiltroEstado('Todos');
    setDashFiltroFuente('Todas');
    setSearchTerm('');
    Object.keys(columnFilters || {}).forEach(clave => handleColFilterChange(clave, ''));
    setPaginaActual(1);
    setProcesosKpiAbierto(false);
  };
  const elegirProcesoKpi = proceso => {
    actualizarFiltroDashboard(setDashFiltroProceso, proceso);
    setDashFiltroSubproceso('Todos');
    setProcesosKpiAbierto(false);
  };
  const handleFiltroColumnaConPaginacion = (...args) => {
    handleColFilterChange(...args);
    setPaginaActual(1);
  };

  // ⏳ ESTADOS LOCALES PARA FILTROS DE HISTORIAL
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroProceso, setFiltroProceso] = useState('');
  const [filtroSubproceso, setFiltroSubproceso] = useState('');
  const [histFiltroCambios, setHistFiltroCambios] = useState('Todos');
  const [histFechaDesde, setHistFechaDesde] = useState('');
  const [histFechaHasta, setHistFechaHasta] = useState('');
  const [histFiltroFuente, setHistFiltroFuente] = useState('Todas');
  const [histFiltroSocializacion, setHistFiltroSocializacion] = useState('Todos');

  // 🧠 LÓGICA DE ENRIQUECIMIENTO (Soporte Legacy para Proceso)
  const informesEnriquecidos = safeInformes.map(inf => ({
    ...inf,
    procesoLimpio: obtenerMacroprocesosInforme(inf).join(', ') || 'Sin Proceso'
  }));
  const macroprocesosDisponiblesHistorial = [...new Set(informesEnriquecidos.flatMap(obtenerMacroprocesosInforme))].sort();
  const subprocesosDisponiblesHistorial = [...new Set(informesEnriquecidos
    .filter(informe => !filtroProceso || obtenerMacroprocesosInforme(informe).includes(filtroProceso))
    .flatMap(informe => obtenerSubprocesosInforme(informe, filtroProceso)))].sort();
const fuentesDisponiblesHistorial = [...new Set([...TIPOS_FUENTE, 'Programa de Auditoría'])];
    const informesConCambios = informesEnriquecidos.filter(informe => Array.isArray(informe.historialCambios) && informe.historialCambios.length > 0).length;

  // 🧠 LÓGICA DE FILTRADO (Historial Completo)
  const informesFiltradosPorFecha = informesEnriquecidos.filter(inf => {
    if (filtroProceso && !obtenerMacroprocesosInforme(inf).includes(filtroProceso)) return false;
    if (filtroSubproceso && !convertirSubprocesosLista(inf.subprocesos ?? inf.subproceso).includes(filtroSubproceso)) return false;
    if ((histFechaDesde || histFechaHasta || filtroAnio || filtroMes) && !inf.fecha) return false;
    if (histFechaDesde && String(inf.fecha) < histFechaDesde) return false;
    if (histFechaHasta && String(inf.fecha) > histFechaHasta) return false;
if (histFiltroFuente !== 'Todas' && resolverCategoriaFuente(inf.tipoFuente, fuentesMejoraDisponibles) !== histFiltroFuente) return false;
    if (histFiltroSocializacion !== 'Todos' && (histFiltroSocializacion === 'Socializado' ? inf.socializado !== 'Sí' : inf.socializado === 'Sí')) return false;
    const [anio, mes] = String(inf.fecha || '').split('-');
    if (filtroAnio && anio !== filtroAnio) return false;
    if (filtroMes && mes !== filtroMes) return false;
    const tieneCambios = Array.isArray(inf.historialCambios) && inf.historialCambios.length > 0;
    if (histFiltroCambios === 'Con cambios' && !tieneCambios) return false;
    if (histFiltroCambios === 'Sin cambios' && tieneCambios) return false;
    
    return true;
  });
  const informesCandidatosHistorial = applyFilters(informesFiltradosPorFecha, searchTerm, columnFilters);
  const paginasHistorial = Math.max(1, Math.ceil(informesCandidatosHistorial.length / 10));
  const paginaHistorialActual = Math.min(paginaActual, paginasHistorial);
  const informesPaginaHistorial = informesCandidatosHistorial.slice((paginaHistorialActual - 1) * 10, paginaHistorialActual * 10);
  const limpiarFiltrosHistorial = () => {
    setFiltroProceso('');
    setFiltroSubproceso('');
    setFiltroAnio('');
    setFiltroMes('');
    setHistFiltroCambios('Todos');
    setHistFechaDesde('');
    setHistFechaHasta('');
    setHistFiltroFuente('Todas');
    setHistFiltroSocializacion('Todos');
    setSearchTerm('');
    Object.keys(columnFilters || {}).forEach(clave => handleColFilterChange(clave, ''));
    setPaginaActual(1);
    setInformeExpandidoId(null);
  };
  const repararConsecutivosDuplicados = async () => {
    if (!isAdmin || !setInformesAuditoria || reparandoConsecutivos || informesConReferenciaDuplicada === 0) return;
    if (!window.confirm(`Se renumerarán ${informesConReferenciaDuplicada} informe(s) con referencias repetidas. ¿Continuar?`)) return;

    setReparandoConsecutivos(true);
    try {
      const resultado = await apiService.repararConsecutivosInformes();
      if (!Array.isArray(resultado?.informesAuditoria)) throw new Error('La respuesta del servidor no contiene los informes actualizados.');
      setInformesAuditoria(resultado.informesAuditoria);
      setInformeExpandidoId(null);
      window.alert(`Reparación completada: ${resultado.reparados || 0} referencia(s) corregida(s).`);
    } catch (error) {
      window.alert(error.message || 'No se pudieron reparar los consecutivos.');
    } finally {
      setReparandoConsecutivos(false);
    }
  };

  // 1. Filtrar los datos del Dashboard según el menú lateral y las pastillas (Pills)
  const informesBaseDashboard = informesEnriquecidos.filter(inf => {
    if (dashFiltroAnio !== 'Todos' && inf.fecha?.split('-')[0] !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && !obtenerMacroprocesosInforme(inf).includes(dashFiltroProceso)) return false;
    if (dashFiltroSubproceso !== 'Todos' && !obtenerSubprocesosInforme(inf, dashFiltroProceso === 'Todos' ? '' : dashFiltroProceso).includes(dashFiltroSubproceso)) return false;
    if (dashFiltroFuente !== 'Todas') {
      if (resolverCategoriaFuente(inf.tipoFuente, fuentesMejoraDisponibles) !== dashFiltroFuente) return false;
    }
    return true;
  });
  const informesDashboard = informesBaseDashboard.filter(inf => (
    dashFiltroEstado === 'Todos' ||
    (dashFiltroEstado === 'Socializado' ? inf.socializado === 'Sí' : inf.socializado !== 'Sí')
  ));

  const informesFiltradosDashboard = applyFilters(informesDashboard, searchTerm, columnFilters);
  const totalInformesFiltrados = informesFiltradosDashboard.length;
  const totalPaginasDashboard = Math.max(1, Math.ceil(totalInformesFiltrados / 10));
  const paginaActualDashboard = Math.min(paginaActual, totalPaginasDashboard);
  const informesPaginadosDashboard = informesFiltradosDashboard.slice(
    (paginaActualDashboard - 1) * 10,
    paginaActualDashboard * 10
  );
  const indiceInicioDashboard = totalInformesFiltrados === 0 ? 0 : (paginaActualDashboard - 1) * 10 + 1;
  const indiceFinDashboard = Math.min(paginaActualDashboard * 10, totalInformesFiltrados);

  // 2. Calcular KPIs basados en lo que está filtrado
  const totalInformes = informesBaseDashboard.length;
  const totalInformesVisibles = informesDashboard.length;
  const socializados = informesBaseDashboard.filter(i => i.socializado === 'Sí').length;
  const pendientes = totalInformes - socializados;
  const pctSocializados = totalInformes > 0 ? Math.round((socializados / totalInformes) * 100) : 0;
  const pctPendientes = totalInformes > 0 ? Math.round((pendientes / totalInformes) * 100) : 0;
  const procesosAuditados = new Set(informesBaseDashboard.flatMap(obtenerMacroprocesosInforme)).size;
  const macroprocesosDashboard = [...new Set(informesEnriquecidos.flatMap(obtenerMacroprocesosInforme))].sort();
  const subprocesosDashboard = [...new Set(informesEnriquecidos
    .filter(informe => dashFiltroProceso === 'Todos' || obtenerMacroprocesosInforme(informe).includes(dashFiltroProceso))
    .flatMap(informe => obtenerSubprocesosInforme(informe, dashFiltroProceso === 'Todos' ? '' : dashFiltroProceso)))].sort();
  const dashboardSinFiltros = dashFiltroAnio === 'Todos' &&
    dashFiltroProceso === 'Todos' &&
    dashFiltroSubproceso === 'Todos' &&
    dashFiltroEstado === 'Todos' &&
    dashFiltroFuente === 'Todas' &&
    !String(searchTerm || '').trim() &&
    !Object.values(columnFilters || {}).some(valor => String(valor || '').trim());

  // 3. Agrupador Dinámico según el botón "ORGANIZAR POR"
  const informesAgrupados = informesDashboard.reduce((acc, inf) => {
    let key = 'Sin clasificar';
    if (agruparPor === 'Año') key = inf.fecha ? inf.fecha.split('-')[0] : 'Sin Fecha';
    if (agruparPor === 'Proceso') key = inf.procesoLimpio;
    if (agruparPor === 'Subproceso') key = convertirSubprocesosLista(inf.subprocesos ?? inf.subproceso).join(', ') || 'General';
    if (agruparPor === 'Estado') key = inf.socializado === 'Sí' ? 'Socializados' : 'Pendientes';
    if (agruparPor === 'Responsable') key = inf.elaboradoPor || 'Sin Asignar';

    if (!acc[key]) acc[key] = [];
    acc[key].push(inf);
    return acc;
  }, {});

  const gruposOrdenados = Object.keys(informesAgrupados).sort((a, b) => b.localeCompare(a));

// ☁️ BÓVEDA: ESTADOS UNIFICADOS E INFALIBLES
  const [archivoSubidoUrl, setArchivoSubidoUrl] = useState('');
  const [archivoSubidoNombre, setArchivoSubidoNombre] = useState('');
  const [cargandoInforme, setCargandoInforme] = useState(false);
  const [progresoInforme, setProgresoInforme] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // ESTADOS NUEVOS: Múltiples Anexos e Historial de Cambios
  const [anexosMultiples, setAnexosMultiples] = useState([]); 
  const [cargandoAnexo, setCargandoAnexo] = useState(false);
  const [progresoAnexo, setProgresoAnexo] = useState(0);
  const [motivoCambio, setMotivoCambio] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [modoVistaCompleta, setModoVistaCompleta] = useState(false);
  const [historialExpandido, setHistorialExpandido] = useState(true);
  const [historialCompacto, setHistorialCompacto] = useState(true);
  const [historialVersionOpen, setHistorialVersionOpen] = useState({});
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [confirmacionSalida, setConfirmacionSalida] = useState(null);
  const [draftHistory, setDraftHistory] = useState([]);
  const [draftInforme, setDraftInforme] = useState({
    titulo: '',
    proceso: '',
    macroprocesos: [],
    subprocesosPorMacroproceso: {},
    subproceso: 'General',
    subprocesos: ['General'],
    tipoFuente: '',
    detalleFuente: '',
    fecha: '',
    elaboradoPor: '',
    revisadoPor: '',
    aprobadoPor: '',
    socializado: 'No',
    fechaSocializacion: '',
    participantes: '',
    correosNotificacionInput: '',
  });
// 🌐 Reconstruir ruta absoluta al Repositorio de Termales
  const obtenerUrlAbsoluta = (ruta) => {
    if (!ruta || ruta === '#' || ruta.trim() === '') return null;

    const valor = ruta.trim();

    if (valor.startsWith('http://') || valor.startsWith('https://')) {
      const url = new URL(valor);
      if (url.pathname.includes('/uploads/')) {
        const partes = url.pathname.split('/uploads/');
        const componentes = (partes[1] || '').split('/');
        const appName = componentes.shift() || 'controlInterno';
        const fileName = decodeURIComponent((componentes.join('/') || url.pathname.split('/').pop()).split('?')[0]);
        return `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${encodeURIComponent(String(appName))}/${encodeURIComponent(fileName)}`;
      }
      return valor;
    }

    const rutaLimpia = valor.startsWith('/') ? valor : `/${valor}`;
    if (rutaLimpia.includes('/uploads/')) {
      const partes = rutaLimpia.split('/uploads/');
      const componentes = (partes[1] || '').split('/');
      const appName = componentes.shift() || 'controlInterno';
      const fileName = decodeURIComponent((componentes.join('/') || rutaLimpia.split('/').pop()).split('?')[0]);
      return `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${encodeURIComponent(String(appName))}/${encodeURIComponent(fileName)}`;
    }

    return `https://repos.termalessantarosa.com.co${rutaLimpia}`;
  };

  const abrirArchivo = (ruta, nombre = 'archivo') => {
    const urlFinal = obtenerUrlAbsoluta(ruta);
    if (!urlFinal) {
      alert('⚠️ No hay archivo disponible para abrir.');
      return;
    }

    const link = document.createElement('a');
    link.href = urlFinal;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const descargarArchivo = (ruta, nombre = 'archivo') => {
    const urlFinal = obtenerUrlAbsoluta(ruta);
    if (!urlFinal) {
      alert('⚠️ No hay archivo disponible para descargar.');
      return;
    }

    const link = document.createElement('a');
    link.href = urlFinal;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

// 🔄 CARGA MAESTRA GARANTIZADA: Lee la BD al instante
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (editInformeAuditoria) {
      try {
        const dbUrlInf = editInformeAuditoria.evidenciaUrl || editInformeAuditoria.evidenciaUrlInput || editInformeAuditoria.archivoUrl || '';
        const urlInfValida = (dbUrlInf === '#' || dbUrlInf.trim() === '') ? '' : dbUrlInf;

        const decodeName = (url) => {
          if (!url) return '';
          try { return decodeURIComponent(url.split('/').pop().split('?')[0]); } 
          catch { return 'Archivo_Adjunto'; }
        };

        // Soporte Legacy: Convertir acta vieja al nuevo formato de array o cargar array existente
        let anexosCargados = [];
        if (editInformeAuditoria.anexos && Array.isArray(editInformeAuditoria.anexos)) {
          anexosCargados = editInformeAuditoria.anexos;
        } else if (editInformeAuditoria.actaSocializacionUrl && editInformeAuditoria.actaSocializacionUrl !== '#') {
          anexosCargados = [{ url: editInformeAuditoria.actaSocializacionUrl, nombre: decodeName(editInformeAuditoria.actaSocializacionUrl) }];
        }

        const macroprocesosIniciales = convertirMacroprocesosLista(
          editInformeAuditoria.macroprocesos || editInformeAuditoria.macroproceso || editInformeAuditoria.proceso
        );
        const subprocesosIniciales = convertirSubprocesosLista(
          editInformeAuditoria.subprocesos ?? editInformeAuditoria.subproceso ?? 'General'
        );
        const draftInicial = {
          titulo: editInformeAuditoria.titulo || '',
          proceso: editInformeAuditoria.proceso || editInformeAuditoria.macroproceso || '',
          macroprocesos: macroprocesosIniciales,
          subproceso: editInformeAuditoria.subproceso || 'General',
          subprocesos: subprocesosIniciales,
          subprocesosPorMacroproceso: mapaSubprocesos(
            macroprocesosIniciales,
            subprocesosIniciales,
            editInformeAuditoria.subprocesosPorMacroproceso
          ),
          tipoFuente: editInformeAuditoria.tipoFuente || '',
          detalleFuente: editInformeAuditoria.detalleFuente || '',
          fecha: editInformeAuditoria.fecha || '',
          elaboradoPor: editInformeAuditoria.elaboradoPor || '',
          revisadoPor: editInformeAuditoria.revisadoPor || '',
          aprobadoPor: editInformeAuditoria.aprobadoPor || '',
          auditorResponsable: editInformeAuditoria.auditorResponsable || editInformeAuditoria.auditor || editInformeAuditoria.auditorLider || editInformeAuditoria.auditor_responsable || '',
          correoAuditor: editInformeAuditoria.correoAuditor || editInformeAuditoria.correoAuditorResponsable || editInformeAuditoria.correo_auditor || editInformeAuditoria.correoAuditorSeguimiento || '',
          socializado: editInformeAuditoria.socializado || 'No',
          fechaSocializacion: editInformeAuditoria.fechaSocializacion || editInformeAuditoria.fecha_socializacion || editInformeAuditoria.fechaSoc || '',
          participantes: editInformeAuditoria.participantes || editInformeAuditoria.socializadoCon || '',
          correosNotificacionInput: editInformeAuditoria.correoEnviadoA || '',
        };

        setDraftInforme(draftInicial);
        setDraftHistory([draftInicial]);

        const participantesIniciales = (editInformeAuditoria.participantes || editInformeAuditoria.socializadoCon || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);

        setParticipantesMultiples(participantesIniciales);
        setArchivoSubidoUrl(urlInfValida);
        setArchivoSubidoNombre(decodeName(urlInfValida));
        setAnexosMultiples(fusionarAdjuntosUnicos([], anexosCargados));
        setMotivoCambio('');
        setIsDirty(false);
        setHistorialExpandido(true);
      } catch (error) {
        console.error("Error leyendo datos del informe:", error);
      }
    } else {
      setArchivoSubidoUrl('');
      setArchivoSubidoNombre('');
      setAnexosMultiples([]);
      setMotivoCambio('');
     const draftVacio = {
        titulo: '',
        proceso: '',
        macroprocesos: [],
        subprocesosPorMacroproceso: {},
        subproceso: 'General',
        subprocesos: [],
        tipoFuente: '',
        detalleFuente: '',
        fecha: '',
        elaboradoPor: '',
        revisadoPor: '',
        aprobadoPor: '',
        auditorResponsable: '',
        correoAuditor: '',
        socializado: 'No',
        fechaSocializacion: '',
        participantes: '',
        correosNotificacionInput: '',
      };
      setDraftInforme(draftVacio);
      setDraftHistory([draftVacio]);
      setIsDirty(false);
      setHistorialExpandido(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editInformeAuditoria]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const confirmarSalidaSinGuardar = (callback) => {
    if (!isDirty) {
      callback();
      return;
    }

    setConfirmacionSalida({
      mensaje: 'Tienes cambios sin guardar. ¿Deseas salir sin guardar?',
      onConfirm: () => {
        setConfirmacionSalida(null);
        setIsDirty(false);
        callback();
      },
      onCancel: () => setConfirmacionSalida(null),
    });
  };

  const registrarCambioBorrador = (siguienteDraft) => {
    setDraftHistory(prev => {
      const ultimo = prev[prev.length - 1];
      const serialActual = JSON.stringify(siguienteDraft);
      const serialAnterior = ultimo ? JSON.stringify(ultimo) : null;

      if (serialAnterior === serialActual) {
        return prev;
      }

      return [...prev, siguienteDraft].slice(-12);
    });
  };

  const deshacerUltimoCambio = () => {
    if (draftHistory.length <= 1) {
      setIsDirty(false);
      return;
    }

    const anterior = draftHistory[draftHistory.length - 2];
    setDraftInforme(anterior);
    setDraftHistory(prev => prev.slice(0, -1));
    setIsDirty(true);
  };
  // 🧹 Utilidad para limpiar nombres de archivos
  const sanitizarNombreArchivo = (nombreOriginal) => {
    return nombreOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9.\-_]/g, "").toLowerCase();
  };

  // 🖼️ Utilidad para comprimir imágenes
  const compressImage = (file, maxWidth, maxHeight, quality) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
          } else {
            if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(newFile);
          }, 'image/jpeg', quality);
        };
        img.onerror = error => reject(error);
      };
      reader.onerror = error => reject(error);
    });
  };

const handleFileUpload = async (e, type) => {
    const originalFiles = Array.from(e.target.files);
    if (originalFiles.length === 0) return;

    // Límite amplio para evitar bloqueos en el frontend
    const MAX_MB = 25;

    const procesarYSubirArchivo = async (originalFile, onProgressCallback) => {
      let fileToUpload = originalFile;
      if (fileToUpload.type?.startsWith('image/')) {
        try { fileToUpload = await compressImage(fileToUpload, 1280, 1280, 0.7); } 
        catch (err) { console.error("Error comprimiendo imagen:", err); }
      }

      if (fileToUpload.size > MAX_MB * 1024 * 1024) {
        throw new Error(`El archivo ${fileToUpload.name} supera el límite de ${MAX_MB} MB. Por favor comprímelo antes de subirlo.`);
      }

      const nombreLimpio = sanitizarNombreArchivo(fileToUpload.name);
      const file = new File([fileToUpload], nombreLimpio, { type: fileToUpload.type || 'application/pdf' });
      
      const data = await apiService.subirEvidencia(file, { appName: 'controlInterno' }, onProgressCallback);
      
      const urlFinal = data?.url || data?.path || data?.filePath || (typeof data === 'string' ? data : file.name);
      return { url: urlFinal, nombre: originalFile.name };
    };

    if (type === 'informe') {
      setCargandoInforme(true);
      setProgresoInforme(0);
      setUploadError(null);
      try {
        const resultado = await procesarYSubirArchivo(originalFiles[0], setProgresoInforme);
        setArchivoSubidoUrl(resultado.url);
        setArchivoSubidoNombre(resultado.nombre);
        alert("🎉 ¡Informe adjuntado exitosamente!");
      } catch (err) {
        setUploadError(err.message);
        alert(`⚠️ No se pudo subir:\n${err.message}`);
      } finally {
        setCargandoInforme(false);
      }
    } else {
      setCargandoAnexo(true);
      setProgresoAnexo(0);
      try {
        const nuevosAnexos = [];
        for (let i = 0; i < originalFiles.length; i++) {
          const onProgress = (pct) => setProgresoAnexo(Math.round(((i * 100) + pct) / originalFiles.length));
          const resultado = await procesarYSubirArchivo(originalFiles[i], onProgress);
          nuevosAnexos.push(resultado);
        }
        setAnexosMultiples(prev => fusionarAdjuntosUnicos(prev, nuevosAnexos));
        alert("🎉 ¡Anexos guardados con éxito!");
      } catch (err) {
        alert(`⚠️️ Error al subir anexos:\n${err.message}`);
      } finally {
        setCargandoAnexo(false);
        setProgresoAnexo(0);
        e.target.value = '';
      }
    }
  };
  const handleResetForm = () => {
    setEditInformeAuditoria(null); 
    setArchivoSubidoUrl(''); 
    setArchivoSubidoNombre('');
    setAnexosMultiples([]);
    setMotivoCambio('');
    setIsDirty(false);
    setModoVistaCompleta(false);
    setFormResetKey(prev => prev + 1);
    setVistaActiva('dashboard');
  };

 // 🛡️ LÓGICA DE NAVEGACIÓN SEGURA UNIFICADA
  const cambiarVistaSegura = (nuevaVista) => {
    if (nuevaVista === vistaActiva) {
      // Si el usuario hace clic en el mismo botón donde ya está, pero es "Nuevo Informe"
      // preguntamos si quiere resetear el formulario. Si no, lo ignoramos.
      if (nuevaVista === 'nuevo' && !modoVistaCompleta && editInformeAuditoria) {
        if (window.confirm("¿Estás seguro de que deseas salir sin guardar? Perderás los datos de este informe para crear uno nuevo.")) {
          handleResetForm();
          setVistaActiva('nuevo');
        }
      }
      return;
    }

    // Si estamos editando o creando, y no estamos en modo "solo lectura"
    if (vistaActiva === 'nuevo' && !modoVistaCompleta && isDirty) {
      confirmarSalidaSinGuardar(() => {
        handleResetForm();
        setVistaActiva(nuevaVista);
      });
    } else {
      // Si estamos en dashboard, historial o modo solo lectura, navegamos libremente
      handleResetForm();
      setVistaActiva(nuevaVista);
    }
  };

  // Extraer años y responsables únicos para los selects
  const aniosDisponibles = [...new Set(safeInformes.map(i => i.fecha?.split('-')[0]).filter(Boolean))].sort().reverse();

  const historialActual = Array.isArray(editInformeAuditoria?.historialCambios)
    ? editInformeAuditoria.historialCambios
    : [];

  const _ultimoCambio = historialActual.length > 0 ? historialActual[historialActual.length - 1] : null;

  const contarCambios = (item) => Array.isArray(item?.historialCambios) ? item.historialCambios.length : 0;

  const _restaurarCambiosNoGuardados = () => {
    if (!editInformeAuditoria) return;

    const dbUrlInf = editInformeAuditoria.evidenciaUrl || editInformeAuditoria.evidenciaUrlInput || editInformeAuditoria.archivoUrl || '';
    const urlInfValida = (dbUrlInf === '#' || dbUrlInf.trim() === '') ? '' : dbUrlInf;
    const decodeName = (url) => {
      if (!url) return '';
      try { return decodeURIComponent(url.split('/').pop().split('?')[0]); }
      catch { return 'Archivo_Adjunto'; }
    };

    let anexosCargados = [];
    if (editInformeAuditoria.anexos && Array.isArray(editInformeAuditoria.anexos)) {
      anexosCargados = editInformeAuditoria.anexos;
    } else if (editInformeAuditoria.actaSocializacionUrl && editInformeAuditoria.actaSocializacionUrl !== '#') {
      anexosCargados = [{ url: editInformeAuditoria.actaSocializacionUrl, nombre: decodeName(editInformeAuditoria.actaSocializacionUrl) }];
    }

    const participantesIniciales = (editInformeAuditoria.participantes || editInformeAuditoria.socializadoCon || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    setDraftInforme({
      titulo: editInformeAuditoria.titulo || '',
      proceso: editInformeAuditoria.proceso || editInformeAuditoria.macroproceso || '',
      subproceso: editInformeAuditoria.subproceso || 'General',
      subprocesos: convertirSubprocesosLista(editInformeAuditoria.subprocesos ?? editInformeAuditoria.subproceso ?? 'General'),
      tipoFuente: editInformeAuditoria.tipoFuente || '',
      detalleFuente: editInformeAuditoria.detalleFuente || '',
      fecha: editInformeAuditoria.fecha || '',
      elaboradoPor: editInformeAuditoria.elaboradoPor || '',
      revisadoPor: editInformeAuditoria.revisadoPor || '',
      aprobadoPor: editInformeAuditoria.aprobadoPor || '',
      auditorResponsable: editInformeAuditoria.auditorResponsable || editInformeAuditoria.auditor || editInformeAuditoria.auditorLider || editInformeAuditoria.auditor_responsable || '',
      correoAuditor: editInformeAuditoria.correoAuditor || editInformeAuditoria.correoAuditorResponsable || editInformeAuditoria.correo_auditor || editInformeAuditoria.correoAuditorSeguimiento || '',
      socializado: editInformeAuditoria.socializado || 'No',
      fechaSocializacion: editInformeAuditoria.fechaSocializacion || editInformeAuditoria.fecha_socializacion || editInformeAuditoria.fechaSoc || '',
      participantes: editInformeAuditoria.participantes || editInformeAuditoria.socializadoCon || '',
      correosNotificacionInput: editInformeAuditoria.correoEnviadoA || '',
    });

    setArchivoSubidoUrl(urlInfValida);
    setArchivoSubidoNombre(decodeName(urlInfValida));
    setAnexosMultiples(anexosCargados);
    setParticipantesMultiples(participantesIniciales);
    setMotivoCambio('');
    setIsDirty(false);
  };

  const restaurarVersionHistorial = (log) => {
    const snapshot = log?.detalle?.snapshot || log?.snapshot || {};
    const versionResumen = typeof log?.version !== 'undefined' ? `Versión ${log.version}` : 'esta versión';

    if (!snapshot || Object.keys(snapshot).length === 0) {
      window.alert('Esta versión no tiene una instantánea guardada para restaurar.');
      return;
    }

    setRestoreConfirm({ log, versionResumen, snapshot });
  };

  const confirmarRestauracionVersion = () => {
    if (!restoreConfirm) return;
    const { log: _log, versionResumen, snapshot } = restoreConfirm;

    const siguiente = {
      titulo: snapshot.titulo || draftInforme.titulo || '',
      proceso: snapshot.proceso || draftInforme.proceso || '',
      subproceso: snapshot.subproceso || draftInforme.subproceso || 'General',
      subprocesos: convertirSubprocesosLista(snapshot.subprocesos ?? snapshot.subproceso ?? draftInforme.subprocesos ?? draftInforme.subproceso ?? 'General'),
      tipoFuente: snapshot.tipoFuente || draftInforme.tipoFuente || '',
      detalleFuente: snapshot.detalleFuente || draftInforme.detalleFuente || '',
      fecha: snapshot.fecha || draftInforme.fecha || '',
      elaboradoPor: snapshot.elaboradoPor || draftInforme.elaboradoPor || '',
      revisadoPor: snapshot.revisadoPor || draftInforme.revisadoPor || '',
      aprobadoPor: snapshot.aprobadoPor || draftInforme.aprobadoPor || '',
      auditorResponsable: snapshot.auditorResponsable || draftInforme.auditorResponsable || '',
      correoAuditor: snapshot.correoAuditor || draftInforme.correoAuditor || '',
      socializado: snapshot.socializado || draftInforme.socializado || 'No',
      fechaSocializacion: snapshot.fechaSocializacion || draftInforme.fechaSocializacion || '',
      participantes: snapshot.participantes || draftInforme.participantes || '',
      correosNotificacionInput: snapshot.correosNotificacionInput || draftInforme.correosNotificacionInput || '',
    };

    const anexosRestaurados = Array.isArray(snapshot.anexosMultiples)
      ? snapshot.anexosMultiples
      : Array.isArray(snapshot.anexos)
        ? snapshot.anexos
        : [];

    const participantesRestaurados = String(siguiente.participantes || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    setDraftInforme(siguiente);
    setArchivoSubidoUrl(snapshot.evidenciaUrl || '');
    setArchivoSubidoNombre(snapshot.evidenciaUrl ? decodeURIComponent((snapshot.evidenciaUrl.split('/').pop() || '').split('?')[0] || 'Archivo') : '');
    setAnexosMultiples(anexosRestaurados);
    setParticipantesMultiples(participantesRestaurados);
    setMotivoCambio(`Restauración desde ${versionResumen}`);
    setIsDirty(true);
    setRestoreConfirm(null);
  };

  const handleFuenteMejoraChange = (event) => {
    const seleccion = String(event.target.value || '');
    const fuenteDB = fuentesMejoraDisponibles.find(
      fuente => String(fuente.codigo || fuente.id) === String(seleccion)
    );
    const nuevosMacros = convertirMacroprocesosLista(fuenteDB?.macroprocesos || fuenteDB?.macroproceso || fuenteDB?.proceso);
    const nuevoMacro = nuevosMacros[0] || '';
    const nuevosSubprocesos = convertirSubprocesosLista(fuenteDB?.subprocesos ?? fuenteDB?.subproceso ?? 'General');
    const nuevaRelacion = mapaSubprocesos(nuevosMacros, nuevosSubprocesos, fuenteDB?.subprocesosPorMacroproceso);
    const siguienteDraft = {
      ...draftInforme,
      tipoFuente: seleccion,
      detalleFuente: fuenteDB?.alcance || fuenteDB?.descripcion || '',
      proceso: nuevoMacro,
      macroproceso: nuevoMacro,
      macroprocesos: nuevosMacros,
      subproceso: nuevosSubprocesos[0] || 'General',
      subprocesos: nuevosSubprocesos,
      subprocesosPorMacroproceso: nuevaRelacion,
      correoAuditor: obtenerCorreoCargoCatalogo(catalogoCargos, draftInforme.auditorResponsable, nuevoMacro, nuevosSubprocesos),
    };

    setDraftInforme(siguienteDraft);
    registrarCambioBorrador(siguienteDraft);
    setIsDirty(true);

    if (fuenteDB) {
      setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: nuevoMacro }));
      setSubprocesoForm(prev => ({ ...prev, [idEdicion]: nuevosSubprocesos[0] || '' }));
    } else if (seleccion === 'Programa de Auditoría') {
      setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
      setSubprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
    }
  };

  const actualizarTerritorioInforme = (macroprocesos, relacion) => {
    const macros = convertirMacroprocesosLista(macroprocesos);
    const relacionNormalizada = mapaSubprocesos(macros, [], relacion);
    const subprocesos = aplanarSubprocesos(relacionNormalizada);
    const macroPrincipal = macros[0] || '';
    const subprocesoPrincipal = convertirSubprocesosLista(relacionNormalizada[macroPrincipal])[0] || '';
    const siguiente = {
      ...draftInforme,
      proceso: macroPrincipal,
      macroproceso: macroPrincipal,
      macroprocesos: macros,
      subproceso: subprocesoPrincipal,
      subprocesos,
      subprocesosPorMacroproceso: relacionNormalizada,
      correoAuditor: obtenerCorreoCargoCatalogo(catalogoCargos, draftInforme.auditorResponsable, macroPrincipal, subprocesos),
    };
    setDraftInforme(siguiente);
    registrarCambioBorrador(siguiente);
    setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: macroPrincipal }));
    setSubprocesoForm(prev => ({ ...prev, [idEdicion]: subprocesoPrincipal }));
    setIsDirty(true);
  };

  const cambiarMacroprocesoInforme = (macroproceso, seleccionado) => {
    const macrosActuales = convertirMacroprocesosLista(draftInforme.macroprocesos || macroprocesoForm);
    const relacionActual = { ...(draftInforme.subprocesosPorMacroproceso || {}) };
    if (seleccionado) {
      if (macrosActuales.includes(macroproceso)) return;
      const disponibles = MAPA_PROCESOS[macroproceso] || [];
      relacionActual[macroproceso] = disponibles.length === 1
        ? [disponibles[0]]
        : disponibles.length === 0 ? ['General'] : [];
      actualizarTerritorioInforme([...macrosActuales, macroproceso], relacionActual);
      return;
    }
    delete relacionActual[macroproceso];
    actualizarTerritorioInforme(macrosActuales.filter(valor => valor !== macroproceso), relacionActual);
  };

  const cambiarSubprocesoInforme = (macroproceso, subproceso, seleccionado) => {
    const relacionActual = { ...(draftInforme.subprocesosPorMacroproceso || {}) };
    const actuales = convertirSubprocesosLista(relacionActual[macroproceso]);
    relacionActual[macroproceso] = seleccionado
      ? [...new Set([...actuales, subproceso])]
      : actuales.filter(valor => valor !== subproceso);
    actualizarTerritorioInforme(draftInforme.macroprocesos || [macroproceso], relacionActual);
  };

  useEffect(() => {
    if (editInformeAuditoria || !draftInforme.auditorResponsable) return;
    const cargo = draftInforme.auditorResponsable;
    const macroproceso = draftInforme.proceso || macroprocesoForm;
    const subprocesos = draftInforme.subprocesos ?? draftInforme.subproceso;
    const correoLocal = obtenerCorreoCargoCatalogo(
      catalogoCargos,
      cargo,
      macroproceso,
      subprocesos
    );
    const clave = claveCorreoCargo(cargo, macroproceso, subprocesos);
    const correo = correoLocal || correosCargosResueltos[clave];
    if (correo) {
      if (correo === draftInforme.correoAuditor) return;
      /* eslint-disable react-hooks/set-state-in-effect */
      setDraftInforme(prev => prev.auditorResponsable === cargo ? { ...prev, correoAuditor: correo } : prev);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    if (Object.prototype.hasOwnProperty.call(correosCargosResueltos, clave)) return;

    let activo = true;
    apiService.obtenerCorreosCargos([{ cargo, macroproceso, subprocesos }])
      .then(respuesta => {
        if (!activo) return;
        const correoRemoto = String(respuesta?.asignaciones?.[0]?.correoCorporativo || '').trim();
        setCorreosCargosResueltos(prev => ({ ...prev, [clave]: correoRemoto }));
        if (correoRemoto) {
          setDraftInforme(prev => prev.auditorResponsable === cargo ? { ...prev, correoAuditor: correoRemoto } : prev);
        }
      })
      .catch(error => console.error('No se pudo consultar el correo del auditor:', error));

    return () => { activo = false; };
  }, [catalogoCargos, correosCargosResueltos, draftInforme.auditorResponsable, draftInforme.correoAuditor, draftInforme.proceso, draftInforme.subproceso, draftInforme.subprocesos, editInformeAuditoria, macroprocesoForm]);

  useEffect(() => {
    if (editInformeAuditoria || participantesMultiples.length === 0) return;
    const macroproceso = draftInforme.proceso || macroprocesoForm;
    const subprocesos = draftInforme.subprocesos ?? draftInforme.subproceso;
    const solicitudes = participantesMultiples
      .filter(cargo => !obtenerCorreoCargoCatalogo(catalogoCargos, cargo, macroproceso, subprocesos))
      .filter(cargo => !Object.prototype.hasOwnProperty.call(
        correosCargosResueltos,
        claveCorreoCargo(cargo, macroproceso, subprocesos)
      ))
      .map(cargo => ({ cargo, macroproceso, subprocesos }));
    if (solicitudes.length === 0) return;

    let activo = true;
    apiService.obtenerCorreosCargos(solicitudes)
      .then(respuesta => {
        if (!activo) return;
        const asignaciones = Array.isArray(respuesta?.asignaciones) ? respuesta.asignaciones : [];
        const resoluciones = Object.fromEntries(asignaciones.map(asignacion => ([
          claveCorreoCargo(asignacion.cargo, asignacion.macroproceso, asignacion.subprocesos),
          String(asignacion?.correoCorporativo || '').trim(),
        ])));
        const correosNuevos = asignaciones
          .map(asignacion => String(asignacion?.correoCorporativo || '').trim())
          .filter(Boolean);
        setCorreosCargosResueltos(prev => ({ ...prev, ...resoluciones }));
        if (correosNuevos.length > 0) {
          setDraftInforme(prev => {
            const correosActuales = String(prev.correosNotificacionInput || '')
              .split(/[;,\n]/)
              .map(correo => correo.trim())
              .filter(Boolean);
            const agregar = [...new Set(correosNuevos)].filter(correo => (
              !correosActuales.some(actual => actual.toLowerCase() === correo.toLowerCase())
            ));
            return agregar.length > 0
              ? { ...prev, correosNotificacionInput: [...correosActuales, ...agregar].join(', ') }
              : prev;
          });
        }
      })
      .catch(error => console.error('No se pudieron consultar los correos de participantes:', error));

    return () => { activo = false; };
  }, [catalogoCargos, correosCargosResueltos, draftInforme.proceso, draftInforme.subproceso, draftInforme.subprocesos, editInformeAuditoria, macroprocesoForm, participantesMultiples]);

  const agregarParticipanteSocializacion = () => {
    if (!participanteTemp || participantesMultiples.includes(participanteTemp)) {
      setParticipanteTemp('');
      return;
    }

    const macroproceso = draftInforme.proceso || macroprocesoForm;
    const subprocesos = draftInforme.subprocesos ?? draftInforme.subproceso;
    const claveCorreo = claveCorreoCargo(participanteTemp, macroproceso, subprocesos);
    const correoParticipante = obtenerCorreoCargoCatalogo(
      catalogoCargos,
      participanteTemp,
      macroproceso,
      subprocesos
    ) || correosCargosResueltos[claveCorreo] || '';
    const correosActuales = String(draftInforme.correosNotificacionInput || '')
      .split(/[;,\n]/)
      .map(correo => correo.trim())
      .filter(Boolean);
    const correoYaIncluido = correosActuales.some(
      correo => correo.toLowerCase() === correoParticipante.toLowerCase()
    );
    const correosActualizados = correoParticipante && !correoYaIncluido
      ? [...correosActuales, correoParticipante]
      : correosActuales;
    const siguienteDraft = {
      ...draftInforme,
      correosNotificacionInput: correosActualizados.join(', '),
    };

    setParticipantesMultiples(prev => [...prev, participanteTemp]);
    setDraftInforme(siguienteDraft);
    registrarCambioBorrador(siguienteDraft);
    setIsDirty(true);
    setParticipanteTemp('');
  };
  const participantesSinCorreo = participantesMultiples.filter(cargo => !obtenerCorreoCargoCatalogo(
    catalogoCargos,
    cargo,
    draftInforme.proceso || macroprocesoForm,
    draftInforme.subprocesos ?? draftInforme.subproceso
  ) && Object.prototype.hasOwnProperty.call(
    correosCargosResueltos,
    claveCorreoCargo(cargo, draftInforme.proceso || macroprocesoForm, draftInforme.subprocesos ?? draftInforme.subproceso)
  ) && !correosCargosResueltos[claveCorreoCargo(
    cargo,
    draftInforme.proceso || macroprocesoForm,
    draftInforme.subprocesos ?? draftInforme.subproceso
  )]);
  const claveAuditorCorreo = claveCorreoCargo(
    draftInforme.auditorResponsable,
    draftInforme.proceso || macroprocesoForm,
    draftInforme.subprocesos ?? draftInforme.subproceso
  );
  const auditorCorreoNoDisponible = Boolean(
    draftInforme.auditorResponsable &&
    !draftInforme.correoAuditor &&
    Object.prototype.hasOwnProperty.call(correosCargosResueltos, claveAuditorCorreo) &&
    !correosCargosResueltos[claveAuditorCorreo]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {restoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">⚠️</div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Confirmación</p>
                <h3 className="text-lg font-black text-slate-900">Restaurar versión</h3>
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-6">
              ¿Deseas restaurar <span className="font-black text-slate-900">{restoreConfirm.versionResumen}</span> y reemplazar el estado actual del informe?
            </p>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-5">
              Se volverá a ese estado guardado con los archivos y datos de esa versión.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreConfirm(null)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-slate-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarRestauracionVersion}
                className="rounded-full bg-[#0A3B32] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#0b4a3f]"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacionSalida && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">⚠️</div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Advertencia</p>
                <h3 className="text-lg font-black text-slate-900">Salir sin guardar</h3>
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-6">{confirmacionSalida.mensaje}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={confirmacionSalida.onCancel}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-slate-400"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmacionSalida.onConfirm}
                className="rounded-full bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700"
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 📋 CABECERA PRINCIPAL CON BANNER DE IMAGEN ESTILO PREMIUM */}
      <div 
        className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-6 mb-6 z-20"
      >
        {/* IMAGEN DE FONDO CON OVERLAY */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url('/Informes.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070f1e] via-[#070f1e]/90 to-transparent z-10" />

        {/* CONTENIDO IZQUIERDA */}
        <div className="relative z-20 w-full md:w-3/5 flex flex-col gap-6">
          
          {/* Bloque 1: Título y descripción */}
          <div className="flex items-start gap-4">
            {/* Ícono Circular Campana */}
            <div className="w-12 h-12 rounded-full border-[3px] border-blue-500/80 bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] backdrop-blur-sm">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            
            <div className="pt-1">
              <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
                Informes y Hallazgos
              </h2>
              <p className="text-[13px] text-slate-300 font-medium mt-1.5 leading-relaxed max-w-md">
                Convierte la información en decisiones de alto impacto.
              </p>
            </div>
          </div>

          {/* Bloque 2: Frase destacada */}
          <div className="ml-[64px]">
            <h3 className="text-lg md:text-xl font-bold text-white drop-shadow-md leading-tight">
              Los hallazgos de hoy, <br className="hidden md:block" /> construyen un mejor mañana.
            </h3>
            <div className="h-1.5 w-14 bg-blue-500 mt-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </div>
        </div>

        {/* BOTONERA DERECHA */}
        <div className="relative z-20 flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <button onClick={() => cambiarVistaSegura('dashboard')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'dashboard' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📊 Resumen Visual</button>
          <button onClick={() => cambiarVistaSegura('historial')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'historial' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📜 Historial Completo</button>
          
          {puedeCrearInformes && (
            <button onClick={handleCrearNuevoInforme} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-lg border backdrop-blur-sm ${vistaActiva === 'nuevo' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white border-transparent' : 'bg-[#0A3B32] text-white hover:bg-[#062620] border-emerald-900'}`}>
              <span className="mr-2">➕</span> Nuevo Informe
            </button>
          )}

          {vistaActiva === 'historial' && typeof exportToExcel === 'function' && (
             <button type="button" onClick={() => exportToExcel(safeInformes, 'Historico_Informes_Auditoria')} className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-600/40 shadow-sm flex items-center backdrop-blur-sm">
               <span className="mr-2">📥</span> Exportar
             </button>
          )}
        </div>
      </div>

      {/* 🚀 VISTA 1: DASHBOARD ANALÍTICO TIPO BIG FOUR (IMAGEN 1) */}
      {vistaActiva === 'dashboard' && (() => {
        // Relaciona la referencia guardada en cada informe con la fuente real del módulo.
        const normalizarReferencia = referencia => String(referencia || '').trim().toLowerCase();
        const fuentesPorReferencia = new Map(
          fuentesMejoraDisponibles.flatMap(fuente =>
            [fuente.codigo, fuente.id]
              .filter(Boolean)
              .map(referencia => [normalizarReferencia(referencia), fuente])
          )
        );
        const conteoFuentes = informesDashboard.reduce((acc, inf) => {
          const referencia = String(inf.tipoFuente || 'Auditoría Interna').trim();
          const fuenteReal = fuentesPorReferencia.get(normalizarReferencia(referencia)) || null;
          const nombreGrupo = resolverCategoriaFuente(referencia, fuentesMejoraDisponibles); // Usamos la nueva función
          const clave = `tipo:${normalizarReferencia(nombreGrupo)}`;
          const fuenteAgrupada = acc.get(clave) || {
            clave,
            nombre: nombreGrupo,
            referencias: new Set(),
            fuentes: [],
            cantidad: 0,
          };
          fuenteAgrupada.referencias.add(normalizarReferencia(referencia));
          if (fuenteReal) {
            [fuenteReal.codigo, fuenteReal.id].filter(Boolean).forEach(id =>
              fuenteAgrupada.referencias.add(normalizarReferencia(id))
            );
            if (!fuenteAgrupada.fuentes.some(fuente =>
              String(fuente.codigo || fuente.id) === String(fuenteReal.codigo || fuenteReal.id)
            )) {
              fuenteAgrupada.fuentes.push(fuenteReal);
            }
          }
          fuenteAgrupada.cantidad += 1;
          acc.set(clave, fuenteAgrupada);
          return acc;
        }, new Map());
        // Aseguramos que 'nombre' se procese estrictamente como texto antes de comparar
        const fuentesArray = [...conteoFuentes.values()].sort((a, b) =>
          b.cantidad - a.cantidad || String(a.nombre || '').localeCompare(String(b.nombre || ''))
        );
        
        // Paleta de colores para la dona y pastillas
        const coloresArray = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];
        const iconosArray = ['🎯', '🏢', '💬', '📈', '⚠️', '🛡️', '🔗'];
        
        // Generador de Conic Gradient para la Dona
        let accumulatedPercent = 0;
        const donutSlices = fuentesArray.map((fuente, idx) => {
          const percent = (fuente.cantidad / totalInformesVisibles) * 100;
          const color = coloresArray[idx % coloresArray.length];
          const slice = `${color} ${accumulatedPercent}% ${accumulatedPercent + percent}%`;
          accumulatedPercent += percent;
          return slice;
        }).join(', ');
        const donutStyle = totalInformesVisibles > 0 ? { background: `conic-gradient(${donutSlices})` } : { background: '#f8fafc' };

        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 bg-slate-50/50 -m-6 p-6 rounded-b-2xl">
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <button type="button" onClick={limpiarFiltrosDashboard} aria-label={`Quitar filtros y mostrar todos los informes (${totalInformes})`} aria-pressed={dashboardSinFiltros} className={`flex w-full min-w-0 items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${dashboardSinFiltros ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shrink-0 border border-blue-100">📄</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total de informes</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{totalInformes}</p>
                  <p className="mt-2 text-[10px] font-semibold text-blue-700">Quitar filtros</p>
                </div>
              </button>
              <button type="button" onClick={() => actualizarFiltroDashboard(setDashFiltroEstado, dashFiltroEstado === 'Pendiente' ? 'Todos' : 'Pendiente')} aria-label={`Filtrar informes en proceso (${pendientes})`} aria-pressed={dashFiltroEstado === 'Pendiente'} className={`flex w-full min-w-0 items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${dashFiltroEstado === 'Pendiente' ? 'border-amber-300 bg-amber-50 ring-1 ring-amber-200' : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40'}`}>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-2xl shrink-0 border border-amber-100">🕒</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">En proceso</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{pendientes}</p>
                  <p className="mt-2 text-[10px] font-semibold text-amber-700">{dashFiltroEstado === 'Pendiente' ? 'Filtro activo' : `${pctPendientes}% del total`}</p>
                </div>
              </button>
              <button type="button" onClick={() => actualizarFiltroDashboard(setDashFiltroEstado, dashFiltroEstado === 'Socializado' ? 'Todos' : 'Socializado')} aria-label={`Filtrar informes socializados (${socializados})`} aria-pressed={dashFiltroEstado === 'Socializado'} className={`flex w-full min-w-0 items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${dashFiltroEstado === 'Socializado' ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'}`}>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl shrink-0 border border-emerald-100">✓</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Socializados</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{socializados}</p>
                  <p className="mt-2 text-[10px] font-semibold text-emerald-700">{dashFiltroEstado === 'Socializado' ? 'Filtro activo' : `${pctSocializados}% del total`}</p>
                </div>
              </button>
              <button type="button" onClick={() => setProcesosKpiAbierto(abierto => !abierto)} aria-expanded={procesosKpiAbierto} aria-controls="kpi-procesos-picker" aria-label={`Elegir proceso auditado (${procesosAuditados})`} className={`flex w-full min-w-0 items-start gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${procesosKpiAbierto || dashFiltroProceso !== 'Todos' ? 'border-rose-300 bg-rose-50/60 ring-1 ring-rose-200' : 'border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/40'}`}>
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-2xl shrink-0 border border-red-100">!</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Procesos Auditados</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{procesosAuditados}</p>
                  <p className="mt-2 text-[10px] font-semibold text-rose-700">{dashFiltroProceso === 'Todos' ? 'Elegir proceso' : dashFiltroProceso}</p>
                </div>
              </button>
            </div>

            {procesosKpiAbierto && (
              <div id="kpi-procesos-picker" className="rounded-xl border border-rose-200 bg-white p-4" aria-label="Seleccionar proceso auditado">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-800">Filtrar por proceso</p>
                  <button type="button" onClick={() => setProcesosKpiAbierto(false)} className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Cerrar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {macroprocesosDashboard.map(proceso => {
                    const cantidad = informesEnriquecidos.filter(informe => obtenerMacroprocesosInforme(informe).includes(proceso)).length;
                    const activo = dashFiltroProceso === proceso;
                    return (
                      <button key={proceso} type="button" onClick={() => elegirProcesoKpi(proceso)} aria-pressed={activo} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activo ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50'}`}>
                        {proceso} <span className="ml-1 text-[10px] font-bold text-slate-500">{cantidad}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

           {/* 2. FUENTES DE INFORME (PILLS INTERACTIVOS) */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fuentes de Informe</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                
                {/* Botón "Todas" */}
                <div 
                  onClick={() => actualizarFiltroDashboard(setDashFiltroFuente, 'Todas')}
                  className={`px-5 py-2.5 rounded-xl flex items-center gap-3 shrink-0 cursor-pointer transition-all shadow-sm ${
                    dashFiltroFuente === 'Todas' 
                      ? 'bg-blue-600 text-white shadow-blue-500/30' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-sm">⊞</span>
                  <span className="text-[11px] font-bold">Todas</span>
                  {/* Este contador siempre muestra el total de informes sin importar los filtros de la tabla */}
                  <span className={`${dashFiltroFuente === 'Todas' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'} text-[10px] font-black px-2 py-0.5 rounded-md`}>({informesEnriquecidos.length})</span>
                </div>

                {/* Lista de Pastillas Dinámicas */}
                {fuentesArray.map((fuenteAgrupada, idx) => {
                  const isActive = dashFiltroFuente === fuenteAgrupada.nombre;
                  
                  const detalle = fuenteAgrupada.fuentes.length > 1
                    ? `${fuenteAgrupada.fuentes.length} fuentes vinculadas`
                    : fuenteAgrupada.fuentes[0]?.macroproceso || fuenteAgrupada.fuentes[0]?.proceso || '';
                  
                  const title = fuenteAgrupada.fuentes.length > 0
                    ? fuenteAgrupada.fuentes.map(fuente => [
                        fuente.codigo || fuente.id,
                        fuente.responsable || fuente.auditor,
                        fuente.alcance || fuente.descripcion,
                      ].filter(Boolean).join(' · ')).join(' | ')
                    : `${fuenteAgrupada.nombre}: no se encontró la fuente original`;

                  return (
                  <div 
                    key={fuenteAgrupada.clave} 
                    title={title} 
                    onClick={() => actualizarFiltroDashboard(setDashFiltroFuente, fuenteAgrupada.nombre)}
                    className={`px-4 py-2.5 rounded-xl flex items-center gap-3 shrink-0 cursor-pointer transition-all shadow-sm max-w-[280px] ${
                      isActive 
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-500' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">{iconosArray[idx % iconosArray.length]}</span>
                    <span className="min-w-0 flex flex-col">
                      <span className={`text-[11px] font-bold truncate ${isActive ? 'text-blue-800' : ''}`}>{fuenteAgrupada.nombre}</span>
                      <span className={`text-[9px] truncate ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{detalle}</span>
                    </span>
                    <span className={`${isActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'} text-[10px] font-bold px-1.5 py-0.5 rounded`}>({fuenteAgrupada.cantidad})</span>
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              
              {/* 3. ZONA IZQUIERDA: FILTROS + TABLA + ACORDEÓN */}
              <div className="min-w-0 space-y-4 xl:col-span-3">
                
                {/* Barra de Filtros Blanca */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Proceso</span>
                    <select value={dashFiltroProceso} onChange={e => { actualizarFiltroDashboard(setDashFiltroProceso, e.target.value); setDashFiltroSubproceso('Todos'); }} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer">
                      <option value="Todos">Todos los procesos</option>
                      {macroprocesosDashboard.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="h-8 w-px bg-slate-200"></div>

                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Subproceso</span>
                    <select value={dashFiltroSubproceso} onChange={e => actualizarFiltroDashboard(setDashFiltroSubproceso, e.target.value)} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer max-w-[140px] truncate">
                      <option value="Todos">Todos los subprocesos</option>
                        {subprocesosDashboard.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Año</span>
                    <select value={dashFiltroAnio} onChange={e => actualizarFiltroDashboard(setDashFiltroAnio, e.target.value)} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer">
                      <option value="Todos">Todos</option>
                      {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>

                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Estado</span>
                    <select value={dashFiltroEstado} onChange={e => actualizarFiltroDashboard(setDashFiltroEstado, e.target.value)} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer">
                      <option value="Todos">Todos</option>
                      <option value="Socializado">Socializado</option>
                      <option value="Pendiente">Pendiente</option>
                    </select>
                  </div>

                  <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-slate-400 text-xs">🔍</span>
                    <input type="text" placeholder="Buscar informe, título, responsable..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1); }} className="w-full text-[11px] outline-none bg-transparent text-slate-700 font-medium placeholder-slate-400" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <tr>
                          <th className="w-10 p-4 text-center"><input type="checkbox" className="rounded border-slate-300" /></th>
                          <th className="w-32 p-4">Consecutivo</th>
                          <th className="p-4">Informe / Título</th>
                          <th className="p-4">Fuente</th>
                          <th className="p-4">Proceso</th>
                          <th className="p-4 text-center">Fecha</th>
                          <th className="p-4 text-center">Socialización</th>
                          <th className="p-4 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-600">
                        {informesFiltradosDashboard.length === 0 ? (
                          <tr><td colSpan="8" className="p-12 text-center font-bold italic text-slate-400">No hay informes para los filtros seleccionados.</td></tr>
                        ) : informesPaginadosDashboard.map(inf => {
                          const referenciaInforme = normalizarReferencia(inf.tipoFuente || 'Auditoría Interna');
                          const iconIndex = fuentesArray.findIndex(fuente => fuente.referencias.has(referenciaInforme));
                          const colorClass = ['text-blue-600 bg-blue-50 border-blue-200', 'text-purple-600 bg-purple-50 border-purple-200', 'text-emerald-600 bg-emerald-50 border-emerald-200', 'text-amber-600 bg-amber-50 border-amber-200', 'text-rose-600 bg-rose-50 border-rose-200', 'text-cyan-600 bg-cyan-50 border-cyan-200'][iconIndex % 6] || 'text-slate-600 bg-slate-50 border-slate-200';
                          const cambios = Array.isArray(inf.historialCambios) ? inf.historialCambios.length : 0;
                          return (
                            <tr key={inf.id} className="group cursor-pointer transition-colors hover:bg-slate-50/50" onClick={() => setInformeDetalleModal(inf)}>
                              <td className="p-4 text-center"><input type="checkbox" className="rounded border-slate-300" onClick={event => event.stopPropagation()} /></td>
                              <td className="p-4 font-mono font-black text-slate-800"><span className="transition-colors group-hover:text-blue-600">{inf.ref}</span></td>
                              <td className="max-w-[180px] truncate p-4 font-bold leading-tight text-slate-700" title={inf.titulo}>{inf.titulo}</td>
                              <td className="p-4"><span className={`flex w-max items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${colorClass}`}><span>{iconosArray[iconIndex % iconosArray.length] || '📄'}</span>{inf.tipoFuente || 'Auditoría Interna'}</span></td>
                              <td className="max-w-[160px] truncate p-4 font-bold text-slate-500" title={inf.procesoLimpio}>{inf.procesoLimpio}</td>
                              <td className="p-4 text-center font-bold text-slate-500">{inf.fecha}</td>
                              <td className="p-4 text-center"><span className={`flex items-center justify-center gap-1 text-[10px] font-bold ${inf.socializado === 'Sí' ? 'text-emerald-600' : 'text-amber-500'}`}><span>{inf.socializado === 'Sí' ? '👥' : '⚠'}</span>{inf.socializado === 'Sí' ? 'Completada' : 'Pendiente'}</span></td>
                              <td className="p-4 text-center"><span className={`flex items-center justify-center gap-1 text-[10px] font-bold ${cambios ? 'text-blue-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${cambios ? 'bg-blue-500' : 'bg-slate-400'}`} />{cambios ? `${cambios} cambios` : 'Inicial'}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* ✨ FOOTER CON PAGINACIÓN REAL */}
                  <div className="bg-white p-4 flex items-center justify-between border-t border-slate-200 text-[10px] font-bold text-slate-400">
                    <span>Mostrando {indiceInicioDashboard} a {indiceFinDashboard} de {totalInformesFiltrados} informes</span>
                    {totalPaginasDashboard > 1 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaginaActual(Math.max(1, paginaActualDashboard - 1))}
                          disabled={paginaActualDashboard === 1}
                          className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          &lt; Ant
                        </button>
                        <span className="px-3 py-1 rounded bg-blue-600 text-white shadow-sm">Pág {paginaActualDashboard} de {totalPaginasDashboard}</span>
                        <button
                          onClick={() => setPaginaActual(Math.min(totalPaginasDashboard, paginaActualDashboard + 1))}
                          disabled={paginaActualDashboard === totalPaginasDashboard}
                          className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Sig &gt;
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acordeón Inferior (Historial agrupado por fuente) */}
                {gruposOrdenados.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-4">
                    <div className="bg-slate-50/50 p-4 border-b border-slate-200 flex justify-between items-center gap-3">
                      <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Historial agrupado por {agruparPor.toLowerCase()}</h3>
                      <div className="flex items-center gap-3">
                        <select
                          value={agruparPor}
                          onChange={e => setAgruparPor(e.target.value)}
                          className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg py-2 px-3 outline-none cursor-pointer focus:border-[#0A3B32]"
                          aria-label="Organizar historial por"
                        >
                          {['Año', 'Proceso', 'Subproceso', 'Estado', 'Responsable'].map(opcion => (
                            <option key={opcion} value={opcion}>{opcion}</option>
                          ))}
                        </select>
                        <button onClick={() => cambiarVistaSegura('historial')} className="text-[10px] text-blue-600 font-bold hover:underline">Ver historial completo ➔</button>
                      </div>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto">
                       {gruposOrdenados.map(grupo => (
                         <div key={grupo} onClick={() => { setFiltroProceso(agruparPor==='Proceso'?grupo:''); cambiarVistaSegura('historial'); }} className="flex justify-between items-center p-3 hover:bg-blue-50/50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-100">
                           <div className="flex items-center gap-3">
                             <span className="text-lg">{agruparPor === 'Proceso' ? '🏛️' : agruparPor === 'Estado' ? '🚩' : '📂'}</span>
                             <span className="text-xs font-black text-slate-800">{grupo}</span>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{informesAgrupados[grupo].length} informes</span>
                             <span className="text-slate-400 font-bold">›</span>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

              </div>

              {/* 4. ZONA DERECHA: PANELES DE RESUMEN */}
              <div className="space-y-4 xl:col-span-1">
                
                {/* Dona: Distribución */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                  <h3 className="text-[11px] font-black text-slate-800 mb-6">Distribución por fuente</h3>
                  
                  <div className="flex justify-center mb-8">
                     <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-inner relative" style={donutStyle}>
                        <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                           <span className="block text-2xl font-black text-slate-800 leading-none">{totalInformes}</span>
                           <span className="block text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Total</span>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                     {fuentesArray.map((fuenteAgrupada, idx) => {
                       const percent = totalInformes > 0 ? Math.round((fuenteAgrupada.cantidad / totalInformes) * 100) : 0;
                       const color = coloresArray[idx % coloresArray.length];
                       return (
                         <div key={fuenteAgrupada.clave} className="flex justify-between items-center text-[10px] font-bold">
                           <span className="flex items-center text-slate-600 truncate" title={fuenteAgrupada.nombre}>
                             <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: color }}></span> 
                             <span className="truncate w-28">{fuenteAgrupada.nombre}</span>
                           </span>
                           <span className="text-slate-800 shrink-0">{fuenteAgrupada.cantidad} <span className="text-slate-400 font-medium ml-1">({percent}%)</span></span>
                         </div>
                       )
                     })}
                  </div>
                </div>

                {/* Resumen Rápido (Lista vertical) */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <h3 className="text-[11px] font-black text-slate-800 mb-4">Resumen rápido</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:shadow-sm transition-shadow cursor-pointer bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">📄</div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Informes</p>
                          <p className="text-sm font-black text-slate-800 leading-none">{totalInformes}</p>
                        </div>
                      </div>
                      <span className="text-slate-300">›</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:shadow-sm transition-shadow cursor-pointer bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center text-sm">🕒</div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">En proceso</p>
                          <p className="text-sm font-black text-slate-800 leading-none">{pendientes}</p>
                        </div>
                      </div>
                      <span className="text-slate-300">›</span>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:shadow-sm transition-shadow cursor-pointer bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center text-sm">✓</div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Socializados</p>
                          <p className="text-sm font-black text-slate-800 leading-none">{socializados}</p>
                        </div>
                      </div>
                      <span className="text-slate-300">›</span>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:shadow-sm transition-shadow cursor-pointer bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-sm">!</div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Prcs. Auditados</p>
                          <p className="text-sm font-black text-slate-800 leading-none">{procesosAuditados}</p>
                        </div>
                      </div>
                      <span className="text-slate-300">›</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )
      })()}

      {informeDetalleModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="informe-detalle-titulo"
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{informeDetalleModal.ref || 'Informe de auditoría'}</p>
                <h2 id="informe-detalle-titulo" className="mt-1 text-lg font-black text-slate-900 break-words">
                  {informeDetalleModal.titulo || 'Sin título'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInformeDetalleModal(null)}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar detalle del informe"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6">
              {[
                ['Fuente de mejora', informeDetalleModal.tipoFuente || 'No definida'],
                ['Proceso', informeDetalleModal.procesoLimpio || informeDetalleModal.macroproceso || informeDetalleModal.proceso || 'Sin proceso'],
                ['Subproceso', convertirSubprocesosLista(informeDetalleModal.subprocesos ?? informeDetalleModal.subproceso).join(', ') || 'General'],
                ['Fecha de emisión', informeDetalleModal.fecha || 'Sin fecha'],
                ['Elaborado por', informeDetalleModal.elaboradoPor || 'Sin asignar'],
                ['Revisado por', informeDetalleModal.revisadoPor || 'Sin asignar'],
                ['Aprobado por', informeDetalleModal.aprobadoPor || 'Sin asignar'],
                ['Auditor responsable', informeDetalleModal.auditorResponsable || informeDetalleModal.auditor || 'Sin asignar'],
                ['Correo del auditor', informeDetalleModal.correoAuditor || informeDetalleModal.correoAuditorResponsable || 'Sin correo'],
                ['Socializado', informeDetalleModal.socializado || 'No'],
                ['Fecha de socialización', informeDetalleModal.fechaSocializacion || informeDetalleModal.fecha_socializacion || 'Sin fecha'],
                ['Participantes', informeDetalleModal.participantes || informeDetalleModal.socializadoCon || 'Sin participantes'],
                ['Detalle de la fuente', informeDetalleModal.detalleFuente || 'Sin detalle'],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{etiqueta}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">{valor}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                type="button"
                onClick={() => setInformeDetalleModal(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
              {(isAdmin || puedeEditarInformes) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditInformeAuditoria(informeDetalleModal);
                    setModoVistaCompleta(false);
                    setInformeDetalleModal(null);
                    setVistaActiva('nuevo');
                    setFormResetKey(Date.now());
                    scrollToForm();
                  }}
                  className="rounded-xl bg-[#0A3B32] px-4 py-2.5 text-xs font-black text-white hover:bg-[#062620]"
                >
                  Editar informe
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    
      {/* 🚀 VISTA 2: FORMULARIO NUEVO / EDICIÓN (O SOLO LECTURA PARA LÍDERES) */}
      {vistaActiva === 'nuevo' && (puedeCrearInformes || puedeEditarInformes || modoVistaCompleta) && (
        <div id="edit-form" className="relative mx-auto max-w-6xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-7">
          <div className="flex justify-between items-center border-b pb-4 gap-3">
            <h3 className="flex items-center text-sm font-black text-[#0A3B32]">
              <span className="text-xl mr-3 bg-emerald-50 p-2 rounded-lg">{modoVistaCompleta ? '👁️' : (editInformeAuditoria ? '✏️' : '➕')}</span>
              {modoVistaCompleta ? `Información completa: ${editInformeAuditoria?.ref || 'Informe'}` : (editInformeAuditoria ? `Editar informe ${editInformeAuditoria.ref}` : 'Nuevo informe')}
            </h3>
            {editInformeAuditoria && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm">
                  {historialActual.length} cambios registrados
                </span>
                <button
                  type="button"
                  onClick={deshacerUltimoCambio}
                  disabled={draftHistory.length <= 1}
                  className="bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all"
                >
                  ↩️ Deshacer último cambio ({Math.max(draftHistory.length - 1, 0)})
                </button>
              </div>
            )}
          </div>
<form 
            key={editInformeAuditoria?.ref || 'form-nuevo'} 
            onSubmit={async (e) => { 
              if (!modoVistaCompleta && convertirMacroprocesosLista(draftInforme.macroprocesos || macroprocesoForm).length === 0) {
                e.preventDefault();
                window.alert('Selecciona al menos un macroproceso para el informe.');
                return;
              }
              if (!modoVistaCompleta && (!Array.isArray(draftInforme.subprocesos) || draftInforme.subprocesos.length === 0)) {
                e.preventDefault();
                window.alert('Selecciona al menos un subproceso para el informe.');
                return;
              }
              const guardado = await handleInformeAuditoriaSubmit(e);
              if (!guardado) return;
              
              setIsDirty(false);
              handleResetForm();
              setVistaActiva('dashboard'); 
            }} 
            className="space-y-8 text-xs"
          >
          {modoVistaCompleta && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 font-bold flex items-center justify-between gap-3 shadow-inner">
              <span className="flex items-center gap-2">
                <span className="text-lg">ℹ️</span> 
                Modo lectura: Estás visualizando los detalles de este informe. Los campos están bloqueados.
              </span>
              <button
                type="button"
                onClick={() => {
                  setModoVistaCompleta(false);
                  setIsDirty(false);
                }}
                className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100 shadow-sm transition-all flex items-center gap-1.5 hover:scale-105"
              >
                <span>✏️</span> Editar
              </button>
            </div>
          )}

            <div className="grid grid-cols-1 gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-4">

{/* 🛡️ FUENTE DE MEJORA Y VINCULACIÓN DINÁMICA */}
              <div className="col-span-full space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div>
                  <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📍 Fuente de Mejora (Obligatorio)</label>
            <select
              name="tipoFuente"
              required
              value={draftInforme.tipoFuente || ''}
              onChange={handleFuenteMejoraChange}
              className="w-full border border-emerald-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-sm bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              disabled={modoVistaCompleta}
                              >
                    <option value="">-- Seleccione la Fuente que origina el informe --</option>
                    {fuentesMejoraDisponibles.length > 0 && (
                      <optgroup label="Desde Módulo Fuentes de Mejora">
                        {fuentesMejoraDisponibles.filter(f => f.estado !== 'Cerrada').map(f => (
                          <option key={f.codigo || f.id} value={String(f.codigo || f.id)}>
                            [{f.codigo || f.id}] {f.norma || f.tipoNorma} - {f.responsable || f.auditor || 'Sin Responsable'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                   <optgroup label="Programas de Control Interno">
                      <option value="Programa de Auditoría">Programa de Auditoría</option>
                    </optgroup>
                  </select>
                </div>

{draftInforme.tipoFuente === 'Programa de Auditoría' && (
                  <div className="animate-in fade-in duration-300 border-t border-emerald-200 pt-3">
                    <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📋 Vincular Programa de Auditoría Aprobado</label>
                    <select
                      name="programaId_select"
                      required
                      value={draftInforme.programaId || editInformeAuditoria?.programaId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const prog = safeProgramas.find(p => String(p.id) === String(val));
                        setIsDirty(true);
                        
                        const nuevosMacros = prog
                          ? convertirMacroprocesosLista(prog.macroprocesos || prog.proceso)
                          : [];
                        const nuevoMacro = nuevosMacros[0] || '';
                        const nuevosSubprocesos = prog
                          ? convertirSubprocesosLista(prog.subprocesos ?? prog.subproceso ?? 'General')
                          : [];
                        const nuevaRelacion = mapaSubprocesos(
                          nuevosMacros,
                          nuevosSubprocesos,
                          prog?.subprocesosPorMacroproceso
                        );
                        const subprocesosPrograma = aplanarSubprocesos(nuevaRelacion);
                        const nuevoSub = nuevosSubprocesos[0] || 'General';
                        
                        if (prog) {
                           setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: nuevoMacro }));
                           setSubprocesoForm(prev => ({ ...prev, [idEdicion]: nuevoSub }));
                        }
                        
                        const siguiente = {
                          ...draftInforme,
                          programaId: val,
                          proceso: nuevoMacro,
                          macroproceso: nuevoMacro,
                          macroprocesos: nuevosMacros,
                          subproceso: subprocesosPrograma[0] || nuevoSub,
                          subprocesos: subprocesosPrograma,
                          subprocesosPorMacroproceso: nuevaRelacion,
                          correoAuditor: obtenerCorreoCargoCatalogo(catalogoCargos, draftInforme.auditorResponsable, nuevoMacro, subprocesosPrograma),
                        };
                        setDraftInforme(siguiente);
                        registrarCambioBorrador(siguiente);
                      }}
                      className="w-full border border-emerald-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-sm bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      disabled={modoVistaCompleta}
                    >
                      <option value="">-- Seleccione un Programa --</option>
                      {safeProgramas.filter(p => p.estado === 'Aprobado').map((p, idx) => (
                        <option key={p.id} value={p.id}>
                          [{p.ref || `PRG-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`}] {p.proceso} — {p.subproceso || 'General'}
                        </option>
                      ))}
                    </select>
                    {/* 👇 ESTE INPUT OCULTO GARANTIZA QUE SE GUARDE EL PROGRAMA SIEMPRE */}
                    <input type="hidden" name="programaId" value={draftInforme.programaId || editInformeAuditoria?.programaId || ''} />
                    <p className="text-[9px] text-emerald-700 mt-1.5 font-medium">El sistema precarga los macroprocesos y subprocesos de la fuente; puedes ajustar la selección para este informe.</p>
                  </div>
                )}
{draftInforme.tipoFuente && draftInforme.tipoFuente !== 'Programa de Auditoría' && (
                  <div className="animate-in fade-in duration-300 border-t border-emerald-200 pt-3">
                    <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📝 Detalle de la Fuente (Vinculación Automática)</label>
                    <input
                      name="detalleFuente"
                      required
                      value={draftInforme.detalleFuente || ''}
                      onChange={(e) => {
                        const siguiente = { ...draftInforme, detalleFuente: e.target.value };
                        setDraftInforme(siguiente);
                        registrarCambioBorrador(siguiente);
                        setIsDirty(true);
                      }}
                      placeholder="El alcance u objetivo se llenará automáticamente al seleccionar la fuente..."
                      className="w-full border border-emerald-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-sm bg-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      disabled={modoVistaCompleta}
                    />
                    <p className="text-[10px] text-emerald-700 mt-2 font-semibold">El campo Detalle se sincroniza con el Alcance de la auditoría seleccionada en el módulo Fuente de mejora.</p>
                  </div>
                )}
              </div>

              <div className="col-span-full border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800">Identificación del informe</h4>
              </div>

              <div className="col-span-full">
                <label className="font-bold text-gray-600 block mb-1.5">Título del Informe Formal</label>
                <input 
                  name="titulo" 
                  value={draftInforme.titulo} 
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, titulo: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required 
                  placeholder="Ej: Informe de Accidente en Planta" 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={modoVistaCompleta}
                />
              </div>

              <fieldset disabled={modoVistaCompleta} className="md:col-span-2 min-w-0">
                <legend className="font-bold text-gray-600 mb-1.5">🏛️ Macroprocesos</legend>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  {Object.keys(MAPA_PROCESOS).map(macroproceso => (
                    <label key={macroproceso} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50">
                      <input
                        type="checkbox"
                        checked={convertirMacroprocesosLista(draftInforme.macroprocesos || macroprocesoForm).includes(macroproceso)}
                        onChange={event => cambiarMacroprocesoInforme(macroproceso, event.target.checked)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      {macroproceso}
                    </label>
                  ))}
                </div>
                <input type="hidden" name="macroprocesos" value={JSON.stringify(draftInforme.macroprocesos || [])} />
                <input type="hidden" name="proceso" value={draftInforme.proceso || macroprocesoForm || ''} />
              </fieldset>

              <fieldset disabled={modoVistaCompleta || !convertirMacroprocesosLista(draftInforme.macroprocesos || macroprocesoForm).length} className="md:col-span-2 min-w-0">
                <legend className="font-bold text-gray-600 mb-1.5">↳ Subprocesos</legend>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                  {convertirMacroprocesosLista(draftInforme.macroprocesos || macroprocesoForm).map(macroproceso => {
                    const disponibles = MAPA_PROCESOS[macroproceso] || [];
                    return (
                      <div key={macroproceso} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">{macroproceso}</p>
                        {disponibles.length === 0 ? (
                          <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={convertirSubprocesosLista(draftInforme.subprocesosPorMacroproceso?.[macroproceso]).includes('General')}
                              onChange={event => cambiarSubprocesoInforme(macroproceso, 'General', event.target.checked)}
                              className="h-4 w-4 accent-emerald-700"
                            />
                            General
                          </label>
                        ) : disponibles.map(subproceso => (
                          <label key={`${macroproceso}-${subproceso}`} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-emerald-50">
                            <input
                              type="checkbox"
                              checked={convertirSubprocesosLista(draftInforme.subprocesosPorMacroproceso?.[macroproceso]).includes(subproceso)}
                              onChange={event => cambiarSubprocesoInforme(macroproceso, subproceso, event.target.checked)}
                              className="h-4 w-4 accent-emerald-700"
                            />
                            {subproceso}
                          </label>
                        ))}
                      </div>
                    );
                  })}
                  {!(draftInforme.macroprocesos || []).length && <p className="px-2 py-1 text-[10px] text-slate-400">Primero selecciona macroprocesos.</p>}
                </div>
                <input type="hidden" name="subproceso" value={draftInforme.subproceso || 'General'} />
                <input type="hidden" name="subprocesos" value={JSON.stringify(draftInforme.subprocesos || [])} />
                <input type="hidden" name="subprocesosPorMacroproceso" value={JSON.stringify(draftInforme.subprocesosPorMacroproceso || {})} />
              </fieldset>

                <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">📅 Fecha de Emisión</label>
                <input 
                  name="fecha" 
                  type="date" 
                  value={draftInforme.fecha} 
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, fecha: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                  disabled={modoVistaCompleta}
                />
              </div>

              <div className="col-span-full border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800">Responsables</h4>
              </div>

             <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">✍️ Elaborado Por (Cargo)</label>
                <select 
                  name="elaboradoPor" 
                  value={draftInforme.elaboradoPor} 
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, elaboradoPor: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-medium text-slate-800 shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={modoVistaCompleta}
                >
                  <option value="">-- Seleccionar Cargo --</option>
                  {CARGOS_EMPRESA.map((cargo, i) => <option key={`elab-${i}`} value={cargo}>{cargo}</option>)}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">🔍 Revisado Por (Cargo)</label>
                <select 
                  name="revisadoPor" 
                  value={draftInforme.revisadoPor} 
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, revisadoPor: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-sm cursor-pointer text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={modoVistaCompleta}
                >
                  <option value="">-- Seleccionar Cargo --</option>
                  {CARGOS_EMPRESA.map((cargo, i) => <option key={`rev-${i}`} value={cargo}>{cargo}</option>)}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">🔒 Aprobado Por (Cargo)</label>
                <select 
                  name="aprobadoPor" 
                  value={draftInforme.aprobadoPor} 
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, aprobadoPor: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-sm cursor-pointer text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={modoVistaCompleta}
                >
                  <option value="">-- Seleccionar Cargo --</option>
                  {CARGOS_EMPRESA.map((cargo, i) => <option key={`apr-${i}`} value={cargo}>{cargo}</option>)}
                </select>
              </div>

{/* AUDITOR RESPONSABLE Y CORREO CON RESPALDO DE CAMPOS COMPATIBLES */}
              <div className="md:col-span-2">
                <label className="font-bold text-gray-600 block mb-1.5">🛡 Auditor Responsable / Seguimiento (Cargo)</label>
                <select 
                  name="auditorResponsable" 
                  value={draftInforme.auditorResponsable || ''} 
                  onChange={(e) => {
                    const valor = e.target.value;
                    const siguiente = {
                      ...draftInforme,
                      auditorResponsable: valor,
                      correoAuditor: obtenerCorreoCargoCatalogo(catalogoCargos, valor, draftInforme.proceso || macroprocesoForm, draftInforme.subproceso || subprocesoForm),
                    };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required 
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={modoVistaCompleta}
                >
                  <option value="">-- Seleccionar Auditor --</option>
                  {CARGOS_EMPRESA.map((cargo, i) => <option key={`auditor-${i}`} value={cargo}>{cargo}</option>)}
                </select>
                <input type="hidden" name="auditor" value={draftInforme.auditorResponsable || ''} />
                <input type="hidden" name="auditorLider" value={draftInforme.auditorResponsable || ''} />
              </div>

              <div className="md:col-span-2">
                <label className="font-bold text-gray-600 block mb-1.5">✉ Correo del Auditor Responsable</label>
                <input 
                  type="email"
                  name="correoAuditor" 
                  value={draftInforme.correoAuditor || ''} 
                  onChange={(e) => {
                    const valor = e.target.value;
                    const siguiente = { ...draftInforme, correoAuditor: valor };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  required
                  readOnly
                  placeholder="Correo definido en Cargos y Procesos"
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 bg-white shadow-sm read-only:bg-slate-50 read-only:text-slate-600 read-only:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={modoVistaCompleta}
                />
                <input type="hidden" name="correoAuditorResponsable" value={draftInforme.correoAuditor || ''} />
                <input type="hidden" name="correo_auditor" value={draftInforme.correoAuditor || ''} />
                {auditorCorreoNoDisponible && (
                  <p className="mt-1.5 text-[10px] font-medium text-amber-700">Este cargo no tiene un correo activo en Cargos y Procesos. Configúralo allí para completar este campo automáticamente.</p>
                )}
              </div>

              <div className="col-span-full border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-800">Socialización</h4>
              </div>

              <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">📢 ¿Fue Socializado?</label>
                <select 
                  name="socializado" 
                  value={draftInforme.socializado || 'No'} 
                  onChange={(e) => {
                    const valor = e.target.value;
                    const siguiente = { 
                      ...draftInforme, 
                      socializado: valor,
                      fechaSocializacion: valor === 'No' ? '' : draftInforme.fechaSocializacion
                    };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  className="w-full border rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm disabled:bg-slate-100"
                  disabled={modoVistaCompleta}
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">🗓️ Fecha Socialización</label>
                <input 
                  name="fechaSocializacion" 
                  type="date" 
                  value={draftInforme.fechaSocializacion || ''}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const siguiente = { ...draftInforme, fechaSocializacion: valor };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-400" 
                  disabled={modoVistaCompleta || draftInforme.socializado !== 'Sí'}
                />
                <input type="hidden" name="fecha_socializacion" value={draftInforme.fechaSocializacion || ''} />
                <input type="hidden" name="fechaSoc" value={draftInforme.fechaSocializacion || ''} />
              </div>

              <div className="col-span-full space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Cargos)</label>
                <div className="flex gap-2">
                <select 
                    value={participanteTemp} 
                    onChange={(e) => setParticipanteTemp(e.target.value)} 
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-700 text-xs shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    disabled={modoVistaCompleta}
                  >
                    <option value="">-- Seleccionar Cargo Participante --</option>
                    {CARGOS_EMPRESA.map(cargo => (
                      <option key={cargo} value={cargo} disabled={participantesMultiples.includes(cargo)}>{cargo}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={agregarParticipanteSocializacion} 
                    className="bg-[#0A3B32] text-white px-5 rounded-lg text-xs font-bold hover:bg-[#062620] shrink-0 transition-colors shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={modoVistaCompleta}
                  >
                    ➕ Añadir
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2 min-h-[40px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                  {participantesMultiples.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Ningún cargo seleccionado aún...</span>}
                  {participantesMultiples.map(cargo => (
                    <span key={cargo} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                      {cargo} 
                      <button 
                        type="button" 
                        onClick={() => setParticipantesMultiples(participantesMultiples.filter(item => item !== cargo))} 
                        className="ml-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={modoVistaCompleta}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
             </div>
                <input type="hidden" name="participantes" value={participantesMultiples.join(', ')} />
                <input type="hidden" name="socializadoCon" value={participantesMultiples.join(', ')} />
                {participantesSinCorreo.length > 0 && (
                  <p className="w-full text-[10px] font-medium text-amber-700">Sin correo activo en Cargos y Procesos: {participantesSinCorreo.join(', ')}.</p>
                )}
              </div>   
            </div>            
            
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
              <label className="mb-2 block text-sm font-bold text-blue-900">Distribución por correo electrónico</label>
<input
  name="correosNotificacionInput"
  type="text"
  value={draftInforme.correosNotificacionInput || ''}
  onChange={(e) => {
    const siguiente = { ...draftInforme, correosNotificacionInput: e.target.value };
    setDraftInforme(siguiente);
    registrarCambioBorrador(siguiente);
    setIsDirty(true);
  }}
  placeholder="Ej: usuario1@empresa.com, usuario2@empresa.com (Separa los correos por comas)"
  className="w-full border border-blue-300 bg-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
  disabled={modoVistaCompleta}
/>
              <p className="text-[10px] text-blue-600 mt-2 font-medium">Al añadir cargos de socialización se agregan sus correos del catálogo. Puedes editar esta lista libremente.</p>
              <p className="text-[10px] text-blue-600 mt-2 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
            </div>

            {/* ☁️ BÓVEDA SERVIDOR TERMALES */}
            <div className="mt-2 grid grid-cols-1 gap-5 border-t border-slate-200 pt-6 md:grid-cols-2">
              <div className="col-span-full flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Documentos del informe</h4>
                </div>
                <div className="text-xl text-slate-400">☁️</div>
              </div>

{/* 👇 Mapeo completo para asegurar que la URL del PDF nunca se pierda */}
              <input type="hidden" name="evidenciaUrl" value={archivoSubidoUrl || ''} />
              <input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl || ''} />
              <input type="hidden" name="archivoUrl" value={archivoSubidoUrl || ''} />
              
              {/* Anexos y Actas Multiples */}
              <input type="hidden" name="anexosMultiples" value={JSON.stringify(anexosMultiples)} />
              <input type="hidden" name="actaSocializacionUrl" value={anexosMultiples.length > 0 ? anexosMultiples[0].url : ''} />
              <input type="hidden" name="actaSocializacionUrlInput" value={anexosMultiples.length > 0 ? anexosMultiples[0].url : ''} />

              {/* 🛑 CONTROL DE CAMBIOS: Solo visible al editar */}
              {editInformeAuditoria && (
                <div className="md:col-span-2 mb-4 space-y-3">
                  <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm animate-in fade-in">
                    <label className="font-black text-orange-900 block mb-1.5 uppercase tracking-widest text-[10px]">
                      📝 Motivo de la Edición (Control de Cambios / Obligatorio)
                    </label>
                    <textarea 
                      name="motivoCambio"
                      required
                      value={motivoCambio}
                      onChange={(e) => setMotivoCambio(e.target.value)}
                      placeholder="Justifique técnicamente qué está modificando en este informe para dejar trazabilidad..."
                      className="w-full border border-orange-300 rounded-lg p-2 focus:ring-2 focus:ring-orange-500 outline-none text-xs font-medium bg-white"
                      rows="2"
                    />
                  </div>

                  <div className="bg-gradient-to-br from-slate-50 via-white to-orange-50 border border-slate-200 rounded-2xl p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between mb-3 gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-900 text-white rounded-lg w-8 h-8 flex items-center justify-center text-[12px] shadow-sm">🕘</div>
                        <span className="font-black text-slate-700 uppercase tracking-widest text-[10px]">Historial de cambios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-900 text-white text-[9px] font-black rounded-full px-2.5 py-1 uppercase tracking-widest shadow-sm">
                          {historialActual.length} registros
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setHistorialCompacto(prev => !prev)}
                            className="bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-slate-300 hover:text-slate-900 rounded-full px-2.5 py-1.5 shadow-sm transition-all"
                          >
                            {historialCompacto ? 'Detallado' : 'Compacto'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistorialExpandido(prev => !prev)}
                            className="bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-slate-300 hover:text-slate-900 rounded-full px-2.5 py-1.5 shadow-sm transition-all"
                          >
                            {historialExpandido ? 'Cerrar' : 'Abrir'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {historialActual.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">Aún no hay cambios registrados para este informe.</p>
                    ) : historialExpandido ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {[...historialActual].reverse().map((log, index) => {
                          const versionKey = `${log.fecha || 'sin-fecha'}-${index}`;
                          const isOpen = Boolean(historialVersionOpen[versionKey]);
                          const resumenCorto = renderHistorialSummary(log.detalle || {});
                          return (
                            <div key={versionKey} className="relative border border-slate-200 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-orange-400 rounded-l-xl" />
                              <div className="pl-3 space-y-1.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{log.fecha || 'Sin fecha'}</span>
                                  <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">
                                    {typeof log.version !== 'undefined' ? `Versión ${log.version}` : `Cambio ${index + 1}`}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <p className="text-[10px] font-bold text-slate-800 leading-relaxed">{log.accion || 'Cambio registrado'}</p>
                                  <button
                                    type="button"
                                    onClick={() => setHistorialVersionOpen(prev => ({ ...prev, [versionKey]: !prev[versionKey] }))}
                                    className="text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-900"
                                  >
                                    {isOpen ? 'Ocultar detalle' : 'Ver detalle'}
                                  </button>
                                </div>
                                {historialCompacto && !isOpen ? (
                                  <p className="text-[9px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                                    <span className="font-black uppercase tracking-wider text-slate-500">Resumen:</span> {resumenCorto}
                                  </p>
                                ) : (
                                  <>
                                    {log.motivo && (
                                      <p className="text-[9px] text-slate-600 leading-relaxed bg-orange-50 border border-orange-100 rounded-lg px-2 py-1">
                                        <span className="font-black uppercase tracking-wider text-orange-700">Motivo:</span> {log.motivo}
                                      </p>
                                    )}
                                  </>
                                )}

                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => restaurarVersionHistorial(log)}
                                    className="text-[8px] font-black uppercase tracking-wider text-white bg-[#0A3B32] hover:bg-[#0b4a3f] rounded-full px-2.5 py-1.5 shadow-sm transition-all"
                                  >
                                    Restaurar esta versión
                                  </button>
                                </div>

                                {isOpen && (() => {
                                  const detalle = log.detalle && typeof log.detalle === 'object' ? log.detalle : {};
                                  const campos = Array.isArray(detalle.campos) ? detalle.campos : [];
                                  const archivos = Array.isArray(detalle.archivos) ? detalle.archivos : [];
                                  const resumen = renderHistorialSummary(detalle);
                                  return (
                                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[9px] text-slate-700 space-y-2">
                                      <div className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-[9px] text-slate-700">
                                        <span className="font-black uppercase tracking-wider text-teal-700">Cambio:</span> {resumen}
                                      </div>
                                      <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Usuario:</span><span>{log.usuario || 'Sistema'}</span></div>
                                      <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Fecha:</span><span>{log.fecha || 'Sin fecha'}</span></div>
                                      {typeof log.version !== 'undefined' && (
                                        <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Versión:</span><span>{log.version}</span></div>
                                      )}
                                      {campos.length > 0 && (
                                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                          <div className="font-black uppercase tracking-wider text-slate-500 mb-1">Campos actualizados</div>
                                          <ul className="space-y-1">
                                            {campos.slice(0, 5).map((campo, idx) => (
                                              <li key={`${campo.campo || idx}`} className="flex justify-between gap-2">
                                                <span className="font-bold text-slate-600">{campo.label}</span>
                                                <span className="text-right text-slate-700 break-all">{campo.antes} → {campo.ahora}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {archivos.length > 0 && (
                                        <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                          <div className="font-black uppercase tracking-wider text-slate-500 mb-2">Archivos en esta versión</div>
                                          <div className="space-y-2">
                                            {archivos.map((archivo, idx) => (
                                              <div key={`${archivo.url || idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                <div className="min-w-0 flex-1">
                                                  <div className="font-bold text-slate-600 text-[9px] uppercase tracking-wider">{archivo.tipo || 'Archivo'}</div>
                                                  <div className="text-right text-slate-700 break-all max-w-[180px] text-[9px]" title={archivo.nombre}>{archivo.nombre}</div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); descargarArchivo(archivo.url, archivo.nombre || 'archivo.pdf'); }}
                                                    className="text-emerald-600 hover:bg-emerald-100 px-1.5 py-1 rounded-md text-[9px] font-black"
                                                    title="Descargar archivo"
                                                  >
                                                    ⬇️
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => { e.preventDefault(); abrirArchivo(archivo.url, archivo.nombre || 'archivo.pdf'); }}
                                                    className="text-blue-600 hover:bg-blue-100 px-1.5 py-1 rounded-md text-[9px] font-black"
                                                    title="Ver archivo"
                                                  >
                                                    👁️
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {log.detalle && typeof log.detalle === 'object' && (
                                        <>
                                          {log.detalle.proceso && (
                                            <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Proceso:</span><span>{log.detalle.proceso}</span></div>
                                          )}
                                          {log.detalle.subproceso && (
                                            <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Subproceso:</span><span>{log.detalle.subproceso}</span></div>
                                          )}
                                          {log.detalle.socializado && (
                                            <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Socializado:</span><span>{log.detalle.socializado}</span></div>
                                          )}
                                          {log.detalle.correoEnviadoA && (
                                            <div className="flex justify-between gap-3"><span className="font-black uppercase tracking-wider text-slate-500">Correo:</span><span className="truncate max-w-[180px]" title={log.detalle.correoEnviadoA}>{log.detalle.correoEnviadoA}</span></div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">Historial oculto. Haz clic en “Abrir” para revisarlo.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ARCHIVO 1: INFORME PRINCIPAL */}
              <div className="bg-white border-2 border-dashed border-emerald-300 p-5 rounded-2xl text-center relative hover:border-emerald-500 transition-all flex flex-col items-center justify-center min-h-[170px] shadow-sm">
                <span className="absolute top-3 left-4 text-[9px] font-black uppercase text-emerald-600 tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">📄 Documento Principal</span>
                <div className="absolute top-3 right-4 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  {archivoSubidoUrl ? '1 principal' : 'Sin principal'}
                </div>
                {cargandoInforme ? (
                  <div className="space-y-3 w-full mt-4 px-4">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200 shadow-inner">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-150 rounded-full" style={{ width: `${progresoInforme}%` }}></div>
                    </div>
                    <p className="text-[10px] font-black text-emerald-700 tracking-wider">Subiendo Informe... <span className="font-mono text-xs">{progresoInforme}%</span></p>
                  </div>
                ) : archivoSubidoUrl ? (
                  <div className="space-y-3 mt-4 w-full px-2">
                    <div className="flex items-center justify-center space-x-1.5">
                      <span className="text-xl text-emerald-500">✅</span>
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">Documento Adjunto</span>
                    </div>
                    <p className="text-[10px] font-mono font-bold text-slate-700 max-w-[240px] truncate mx-auto bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-inner" title={archivoSubidoNombre}>
                      📎 {archivoSubidoNombre || 'Informe_Adjunto.pdf'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                      <button type="button" title="Descargar documento principal" onClick={(e) => { e.preventDefault(); descargarArchivo(archivoSubidoUrl, archivoSubidoNombre || 'documento_principal.pdf'); }} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10px] font-black px-2.5 py-1.5 rounded-full shadow-sm transition-all flex items-center space-x-1 cursor-pointer hover:scale-[1.02]">
                        <span>⬇️</span><span>Descargar</span>
                      </button>
                      <button type="button" title="Ver documento principal" onClick={(e) => { e.preventDefault(); abrirArchivo(archivoSubidoUrl, archivoSubidoNombre || 'documento_principal.pdf'); }} className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-black px-2.5 py-1.5 rounded-full shadow-sm transition-all flex items-center space-x-1 cursor-pointer hover:scale-[1.02]">
                        <span>👁️</span><span>Ver</span>
                      </button>
                      <label title="Reemplazar documento principal" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[10px] font-black px-2.5 py-1.5 rounded-full shadow-sm transition-all flex items-center space-x-1 cursor-pointer hover:scale-[1.02]">
                        <span>🔄</span><span>Reemplazar</span>
                        <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => {
                          const confirmar = window.confirm('¿Deseas reemplazar este documento principal? Los anexos ya cargados se conservarán.');
                          if (confirmar) handleFileUpload(e, 'informe');
                          else e.target.value = '';
                        }} />
                      </label>
                      <button type="button" title="Eliminar documento principal" onClick={(e) => { e.preventDefault(); if (confirm("¿Seguro de quitar este adjunto?")) { setArchivoSubidoUrl(''); setArchivoSubidoNombre(''); } }} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-[10px] font-black px-2.5 py-1.5 rounded-full shadow-sm transition-all flex items-center space-x-1 cursor-pointer hover:scale-[1.02]">
                        <span>🗑️</span><span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ) : modoVistaCompleta ? (
                  <div className="flex flex-col items-center space-y-2 group w-full mt-4 opacity-50">
                    <div className="text-4xl">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg">Sin documento principal</p>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full mt-4">
                    <div className="text-4xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">Seleccionar Archivo PDF</p>
                    <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => handleFileUpload(e, 'informe')} />
                  </label>
                )}
                {uploadError && <p className="text-red-500 text-[10px] mt-2 font-bold">{uploadError}</p>}
              </div>

              {/* ARCHIVOS 2: ANEXOS Y ACTAS MÚLTIPLES */}
              <div className="bg-white border-2 border-dashed border-purple-300 p-5 rounded-2xl relative hover:border-purple-500 transition-all flex flex-col items-center justify-start min-h-[170px] shadow-sm">
                 <span className="absolute top-3 left-4 text-[9px] font-black uppercase text-purple-600 tracking-widest bg-purple-50 px-2 py-0.5 rounded border border-purple-100">🤝 Actas y Anexos</span>
                 <div className="absolute top-3 right-4 bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                  {anexosMultiples.length} adjuntos
                 </div>
                
                {cargandoAnexo ? (
                  <div className="space-y-3 w-full mt-8 px-4 text-center">
                    <div className="text-3xl animate-bounce">🚀</div>
                    <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border border-slate-200 shadow-inner">
                      <div className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full transition-all duration-150 rounded-full" style={{ width: `${progresoAnexo}%` }}></div>
                    </div>
                    <p className="text-[10px] font-black text-purple-700 tracking-wider">Subiendo archivos... <span className="font-mono text-xs">{progresoAnexo}%</span></p>
                  </div>
                ) : (
                  <div className="w-full mt-8 space-y-3">
                    {anexosMultiples.length > 0 && (
                      <div className="flex flex-col gap-2 w-full max-h-32 overflow-y-auto pr-2">
                        {anexosMultiples.map((anexo, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-sm hover:border-purple-200 hover:bg-purple-50/30 transition-all">
                            <p className="text-[10px] font-mono font-bold text-slate-700 truncate w-3/4" title={anexo.nombre}>
                              📎 {anexo.nombre}
                            </p>
                            <div className="flex gap-1">
                              <button type="button" onClick={(e) => { e.preventDefault(); abrirArchivo(anexo.url, anexo.nombre || 'anexo.pdf'); }} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded-lg transition-colors" title="Ver archivo">👁️</button>
                              <button type="button" onClick={(e) => { e.preventDefault(); descargarArchivo(anexo.url, anexo.nombre || 'anexo.pdf'); }} className="text-emerald-600 hover:bg-emerald-100 p-1.5 rounded-lg transition-colors" title="Descargar archivo">⬇️</button>
                              <button type="button" onClick={(e) => { e.preventDefault(); setAnexosMultiples(prev => prev.filter((_, i) => i !== index)); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-colors" title="Eliminar">🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!modoVistaCompleta && (
                      <>
                        <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full mt-2">
                          <div className="text-3xl opacity-50 group-hover:scale-110 transition-transform">➕</div>
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">Añadir Archivos</p>
                          <input type="file" multiple className="hidden" accept=".pdf, .jpg, .png, .docx, .xlsx" onChange={(e) => handleFileUpload(e, 'acta')} />
                        </label>
                        <p className="mt-2 text-[9px] text-slate-500 text-center font-medium bg-purple-50 border border-purple-100 rounded-lg px-2 py-1.5">
                          Los anexos anteriores se conservan y se suman con los nuevos.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-4 flex justify-between items-center gap-3 pt-4 flex-wrap">
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-700 shadow-sm">
                <span>Total adjuntos:</span>
                <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-900">{(archivoSubidoUrl ? 1 : 0) + anexosMultiples.length}</span>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto ml-auto">
                
                {/* ✨ NUEVO BOTÓN: Salir sin guardar */}
                {!modoVistaCompleta && (
                  <button 
                    type="button" 
                    onClick={() => cambiarVistaSegura('dashboard')}
                    className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-sm shadow-sm transition-all w-full md:w-auto"
                  >
                    ❌ Salir sin guardar
                  </button>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting || cargandoInforme || cargandoAnexo || modoVistaCompleta} 
                  className={`font-black uppercase tracking-widest px-10 py-3.5 rounded-xl shadow-lg transition-all w-full md:w-auto text-center block text-sm ${modoVistaCompleta || isSubmitting || cargandoInforme || cargandoAnexo ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#0A3B32] hover:bg-[#062620] hover:scale-105 text-white cursor-pointer'}`}
                >
                  {modoVistaCompleta ? 'Modo solo lectura' : (isSubmitting ? '⏳ Procesando...' : cargandoInforme || cargandoAnexo ? 'Subiendo archivos...' : (editInformeAuditoria ? 'Guardar Cambios' : 'RADICAR Y ENVIAR DICTAMEN'))}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 🚀 VISTA 3: TABLA DE HISTORIAL */}
      {vistaActiva === 'historial' && (
        <div className="space-y-6 animate-in slide-in-from-left-8 duration-500">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Macroproceso</span>
                <select value={filtroProceso} onChange={event => { setFiltroProceso(event.target.value); setFiltroSubproceso(''); setPaginaActual(1); }} className="mt-1 w-full truncate bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                  <option value="">Todos los procesos</option>
                  {macroprocesosDisponiblesHistorial.map(macro => <option key={macro} value={macro}>{macro}</option>)}
                </select>
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Subproceso</span>
                <select value={filtroSubproceso} onChange={event => { setFiltroSubproceso(event.target.value); setPaginaActual(1); }} className="mt-1 w-full truncate bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                  <option value="">Todos los subprocesos</option>
                  {subprocesosDisponiblesHistorial.map(subproceso => <option key={subproceso} value={subproceso}>{subproceso}</option>)}
                </select>
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Tipo de fuente</span>
                <select value={histFiltroFuente} onChange={event => { setHistFiltroFuente(event.target.value); setPaginaActual(1); }} className="mt-1 w-full truncate bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                  <option value="Todas">Todas las fuentes</option>
                  {fuentesDisponiblesHistorial.map(fuente => <option key={fuente} value={fuente}>{fuente}</option>)}
                </select>
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Año</span>
                <select value={filtroAnio} onChange={event => { setFiltroAnio(event.target.value); setPaginaActual(1); }} className="mt-1 w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                  <option value="">Todos los años</option>
                  {aniosDisponibles.map(anio => <option key={anio} value={String(anio)}>{anio}</option>)}
                </select>
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Mes</span>
                <select value={filtroMes} onChange={event => { setFiltroMes(event.target.value); setPaginaActual(1); }} className="mt-1 w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                  <option value="">Todos los meses</option>
                  {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((mes, indice) => <option key={mes} value={String(indice + 1).padStart(2, '0')}>{mes}</option>)}
                </select>
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Socialización</span>
                <select value={histFiltroSocializacion} onChange={event => { setHistFiltroSocializacion(event.target.value); setPaginaActual(1); }} className="mt-1 w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none">
                  <option value="Todos">Todos los estados</option>
                  <option value="Socializado">Socializado</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Emisión desde</span>
                <input type="date" value={histFechaDesde} onChange={event => { setHistFechaDesde(event.target.value); setPaginaActual(1); }} className="mt-1 w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none" />
              </label>
              <label className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">Emisión hasta</span>
                <input type="date" value={histFechaHasta} onChange={event => { setHistFechaHasta(event.target.value); setPaginaActual(1); }} className="mt-1 w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none" />
              </label>
              <label className="col-span-2 flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2 xl:col-span-3">
                <span className="text-slate-400">🔍</span>
                <input type="text" placeholder="Buscar informe, título, proceso..." value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPaginaActual(1); }} className="w-full bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400" />
              </label>
              <button type="button" onClick={limpiarFiltrosHistorial} className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-100 sm:col-span-1 xl:col-span-1">Limpiar filtros</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 bg-white px-4 py-2.5">
            <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Filtrar historial por cambios">
              {[
                { id: 'Todos', label: 'Todos', count: informesEnriquecidos.length },
                { id: 'Con cambios', label: 'Con cambios', count: informesConCambios },
                { id: 'Sin cambios', label: 'Sin cambios', count: informesEnriquecidos.length - informesConCambios },
              ].map(opcion => (
                <button key={opcion.id} type="button" aria-pressed={histFiltroCambios === opcion.id} onClick={() => { setHistFiltroCambios(opcion.id); setPaginaActual(1); }} className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-black transition-colors ${histFiltroCambios === opcion.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>
                  {opcion.label} <span className={`ml-1 tabular-nums ${histFiltroCambios === opcion.id ? 'text-blue-100' : 'text-slate-400'}`}>{opcion.count}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && informesConReferenciaDuplicada > 0 && (
                <button
                  type="button"
                  onClick={repararConsecutivosDuplicados}
                  disabled={reparandoConsecutivos}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                >
                  {reparandoConsecutivos ? 'Reparando...' : `Reparar ${informesConReferenciaDuplicada} consecutivo(s)`}
                </button>
              )}
              <p className="text-[10px] font-semibold text-slate-500">{informesCandidatosHistorial.length} registros en los filtros actuales</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                    <th className="w-40 px-4 py-3">ID / Referencia</th>
                    <th className="px-4 py-3">Informe / Proceso</th>
                    <th className="w-36 px-4 py-3">Firmas</th>
                    <th className="w-40 px-4 py-3">Socialización</th>
                    <th className="w-[360px] px-4 py-3 text-right">Gestión</th>
                  </tr>
                  <tr className="bg-slate-100">
                    <td className="p-2"><FilterInput colKey="ref" placeholder="Filtrar..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleFiltroColumnaConPaginacion} /></td>
                    <td className="p-2"><FilterInput colKey="proceso" placeholder="Filtrar proceso..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleFiltroColumnaConPaginacion} /></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 bg-slate-50"></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {informesCandidatosHistorial.length === 0 ? (
                    <tr><td colSpan="5" className="p-12 text-center font-semibold text-slate-400">No hay informes para los filtros seleccionados.</td></tr>
                  ) : informesPaginaHistorial.map((inf, idx) => {
                    const idInforme = String(inf.id || inf.ref || idx);
                    const expandido = informeExpandidoId === idInforme;
                    const cambios = Array.isArray(inf.historialCambios) ? inf.historialCambios : [];
                    const responsables = [
                      ['Elaboró', inf.elaboradoPor],
                      ['Revisó', inf.revisadoPor],
                      ['Aprobó', inf.aprobadoPor],
                    ].filter(([, valor]) => String(valor || '').trim());
                    const documentos = [
                      inf.evidenciaUrl || inf.evidenciaUrlInput || inf.archivoUrl || inf.url || inf.path,
                      inf.actaSocializacionUrl || inf.actaSocializacionUrlInput || inf.actaUrl,
                      ...(Array.isArray(inf.anexosMultiples) ? inf.anexosMultiples.map(anexo => anexo?.url) : []),
                      ...(Array.isArray(inf.anexos) ? inf.anexos.map(anexo => anexo?.url) : []),
                    ].filter((url, index, urls) => url && url !== '#' && urls.indexOf(url) === index);
                    return (
                      <Fragment key={idInforme}>
                      <tr className={`group cursor-pointer border-b-2 transition-colors ${expandido ? 'border-b-0 bg-blue-50/50' : `${idx % 2 === 0 ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'} hover:bg-blue-50/70`}`} onClick={() => setInformeExpandidoId(expandido ? null : idInforme)}>
                        <td className="whitespace-nowrap border-l-4 border-l-slate-200 p-4 font-mono text-sm font-black text-slate-800 transition-colors group-hover:border-l-blue-500">
                          <div className="flex items-center gap-2">
                            <button type="button" aria-expanded={expandido} aria-label={expandido ? 'Ocultar detalle del informe' : 'Ver detalle del informe'} onClick={() => setInformeExpandidoId(expandido ? null : idInforme)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-[10px] text-slate-500 hover:border-blue-300 hover:text-blue-700">{expandido ? '▾' : '›'}</button>
                            <span>{inf.ref || `INF-2026-${String(idx + 1).padStart(3, '0')}`}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">
                            {convertirMacroprocesosLista(inf.macroprocesos || inf.macroproceso || inf.proceso).join(', ')}
                          </span>
                          {convertirSubprocesosLista(inf.subprocesos ?? inf.subproceso).some(subproceso => subproceso !== 'General') && (
                            <div className="text-[10px] text-slate-500 font-bold mt-0.5 mb-1.5">↳ {convertirSubprocesosLista(inf.subprocesos ?? inf.subproceso).filter(subproceso => subproceso !== 'General').join(', ')}</div>
                          )}
                          <div className="mt-1 font-black leading-tight text-slate-900">{inf.titulo}</div>
                          <p className="mt-1 text-[9px] font-medium text-slate-400">{inf.fecha || 'Sin fecha'}{inf.hora ? ` · ${inf.hora}` : ''}</p>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-black ${responsables.length === 3 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{responsables.length}/3 asignados</span>
                          <p className="mt-1 max-w-[140px] truncate text-[9px] text-slate-500" title={responsables.map(([, valor]) => valor).join(', ')}>{responsables.map(([, valor]) => valor).join(', ') || 'Sin responsables'}</p>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-[9px] font-black ${inf.socializado === 'Sí' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{inf.socializado === 'Sí' ? '● Socializado' : '● Pendiente'}</span>
                          <p className="mt-1 text-[9px] font-semibold text-slate-500">{contarCambios(inf) ? `${contarCambios(inf)} cambio(s)` : 'Registro inicial'}</p>
                        </td>
                        <td className="p-4 text-center space-y-1.5 align-middle" onClick={event => event.stopPropagation()}>
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Búsqueda multi-campo para garantizar lectura de informes antiguos y nuevos
                              const urlValida = inf.evidenciaUrl || inf.evidenciaUrlInput || inf.archivoUrl || inf.url || inf.path;
                              
                              if (!urlValida || urlValida === '#' || urlValida.trim() === '') {
                                alert("⚠️ ARCHIVO NO DISPONIBLE\n\nEste informe no tiene un enlace de PDF asignado en la base de datos.");
                                return;
                              }
                              
                              abrirArchivo(urlValida, inf.titulo ? `${inf.titulo}.pdf` : 'informe.pdf');
                            }} 
                            className="bg-blue-50 text-blue-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-blue-100 flex items-center justify-center space-x-1 border border-blue-100 shadow-sm transition-all w-full cursor-pointer"
                          >
                            <span>📄</span><span>Ver Informe Final</span>
                          </button>

                          {(() => {
                            const urlActa = inf.actaSocializacionUrl || inf.actaSocializacionUrlInput || inf.actaUrl;
                            if (urlActa && urlActa !== '#') {
                              return (
                                <button 
                                  type="button" 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    abrirArchivo(urlActa, inf.titulo ? `${inf.titulo}_acta.pdf` : 'acta_socializacion.pdf');
                                  }}
                                  className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full cursor-pointer mt-1"
                                >
                                  <span>🤝</span><span>Ver Acta Socialización</span>
                                </button>
                              );
                            }
                            return <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1.5 rounded border border-dashed text-center mt-1">Sin Acta Cargada</div>;
                          })()}
                          <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                            {/* Botón de Ver visible para TODOS (Líderes y Admins) */}
                            <button type="button" onClick={() => { setEditInformeAuditoria(inf); setModoVistaCompleta(true); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm(); }} className="text-sky-600 hover:text-sky-700 text-xs font-bold">👁️ Ver info completa</button>
                            
                            {/* La edición respeta el permiso del módulo; el borrado sigue reservado a admins */}
                            {(isAdmin || puedeEditarInformes) && (
                              <>
                                <span className="text-slate-200">|</span>
                                <button type="button" onClick={() => { setEditInformeAuditoria(inf); setModoVistaCompleta(false); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm(); }} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏️ Editar</button>
                              </>
                            )}
                            {isAdmin && (
                              <>
                                <span className="text-slate-200">|</span>
                                <button type="button" onClick={() => handleDeleteItem('informesAuditoria', inf.id)} className="text-slate-400 hover:text-red-600 text-xs font-bold">🗑️ Eliminar</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="border-b-2 border-slate-300 bg-blue-50/60">
                          <td colSpan="5" className="border-l-4 border-l-blue-500 px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                              <section>
                                <h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Trazabilidad de firmas</h4>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {[
                                    ['Elaboró', inf.elaboradoPor],
                                    ['Revisó', inf.revisadoPor],
                                    ['Aprobó', inf.aprobadoPor],
                                  ].map(([etiqueta, valor]) => (
                                    <div key={etiqueta} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px]">
                                      <span className="font-bold text-slate-500">{etiqueta}</span>
                                      <span className="truncate font-black text-slate-800">{valor || 'Sin asignar'}</span>
                                    </div>
                                  ))}
                                </div>
                              </section>
                              <section>
                                <h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Socialización e impacto</h4>
                                <p className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-700">
                                  <span className="font-black">Participantes:</span> {inf.participantes || inf.socializadoCon || 'Sin participantes registrados'}
                                </p>
                                {inf.correoEnviadoA && (
                                  <p className="mt-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-800">
                                    <span className="font-black">Notificado:</span> {inf.correoEnviadoA}
                                    {inf.fechaCorreoEnviado ? ` · ${inf.fechaCorreoEnviado}` : ''}
                                  </p>
                                )}
                              </section>
                              <section>
                                <h4 className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Documentos e historial</h4>
                                <p className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-700">{documentos.length} documento(s) adjunto(s)</p>
                                {cambios.length > 0 && (
                                  <p className="mt-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-[10px] text-blue-900">
                                    <span className="font-black">Último cambio:</span> {cambios[cambios.length - 1].accion || 'Actualización'}
                                  </p>
                                )}
                              </section>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-white p-3 text-[10px] font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {informesCandidatosHistorial.length === 0
                  ? 'Mostrando 0 informes'
                  : `Mostrando ${(paginaHistorialActual - 1) * 10 + 1}–${Math.min(paginaHistorialActual * 10, informesCandidatosHistorial.length)} de ${informesCandidatosHistorial.length} informes`}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPaginaActual(Math.max(1, paginaHistorialActual - 1))} disabled={paginaHistorialActual === 1} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
                <span className="min-w-20 text-center text-slate-700">{paginaHistorialActual} / {paginasHistorial}</span>
                <button type="button" onClick={() => setPaginaActual(Math.min(paginasHistorial, paginaHistorialActual + 1))} disabled={paginaHistorialActual >= paginasHistorial} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
                <span className="ml-1 text-slate-400">10 por página</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}