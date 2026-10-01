import { useState, useEffect } from 'react';
import { renderHistorialSummary } from '../utils/historialCambios.js';
import { 
  MAPA_PROCESOS, 
  CARGOS_EMPRESA 
} from '../constants/diccionariosGRC';

// 1. Importamos la arquitectura centralizada
import { useDataFetching } from '../hooks/useDataFetching';
import { apiService } from '../services/apiService';
import { subirArchivoStorage } from '../services/uploadService';

export default function InformesAuditoria({ 
  informesAuditoria, 
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
  isSubmitting, 
  setFormResetKey, 
  scrollToForm, 
  handleDeleteItem, 
  applyFilters, 
  FilterInput
}) {

  // 🏢 CONTROL DE CARGOS MÚLTIPLES EN SOCIALIZACIÓN
  const [participantesMultiples, setParticipantesMultiples] = useState([]);
  const [participanteTemp, setParticipanteTemp] = useState('');

  // 🌟 ESTADOS TEMPORALES PARA EL FORMULARIO
  const [macroprocesoFormState, setMacroprocesoForm] = useState(null);
  const [subprocesoFormState, setSubprocesoForm] = useState(null);
  const [tipoFuenteFormState, setTipoFuenteFormState] = useState(null);
  const [socializadoFormState, setSocializadoFormState] = useState(null);

  // Derivamos de editInformeAuditoria en el render cuando no haya interacción manual del usuario
  const idEdicion = editInformeAuditoria?.id || 'nuevo';
  const tipoFuenteForm = tipoFuenteFormState?.[idEdicion] ?? (editInformeAuditoria?.tipoFuente || '');
  const macroprocesoForm = macroprocesoFormState?.[idEdicion] ?? (editInformeAuditoria?.macroproceso || editInformeAuditoria?.proceso || '');
  const subprocesoForm = subprocesoFormState?.[idEdicion] ?? (editInformeAuditoria?.subproceso || 'General');
  const socializadoForm = socializadoFormState?.[idEdicion] ?? (editInformeAuditoria?.socializado || 'No');
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];

  // 🧭 ESTADOS DE NAVEGACIÓN (TABS Y ACORDEÓN)
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [grupoExpandido, setGrupoExpandido] = useState(null);
  
  // 🛑 LÓGICA DE CONTROL ACTUALIZADA: Permite crear informes desde otras fuentes
  const handleCrearNuevoInforme = () => {
    confirmarSalidaSinGuardar(() => {
      setEditInformeAuditoria(null);
      setVistaActiva('nuevo');
    });
  };

  // 🎛️ ESTADOS DEL PANEL LATERAL
  const [agruparPor, setAgruparPor] = useState('Año'); 
  const [dashFiltroAnio, setDashFiltroAnio] = useState('Todos');
  const [dashFiltroProceso, setDashFiltroProceso] = useState('Todos');
  const [dashFiltroSubproceso, setDashFiltroSubproceso] = useState('Todos');
  const [dashFiltroEstado, setDashFiltroEstado] = useState('Todos');
  const [dashFiltroResponsable, setDashFiltroResponsable] = useState('Todos');

  // ⏳ ESTADOS LOCALES PARA FILTROS DE HISTORIAL
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroProceso, setFiltroProceso] = useState('');
  const [filtroSubproceso, setFiltroSubproceso] = useState('');

  // 🧠 LÓGICA DE ENRIQUECIMIENTO (Soporte Legacy para Proceso)
  const informesEnriquecidos = safeInformes.map(inf => ({
    ...inf,
    procesoLimpio: inf.macroproceso || inf.proceso || 'Sin Proceso'
  }));

  // 🧠 LÓGICA DE FILTRADO (Historial Completo)
  const informesFiltradosPorFecha = informesEnriquecidos.filter(inf => {
    if (filtroProceso && inf.procesoLimpio !== filtroProceso) return false;
    if (filtroSubproceso && inf.subproceso !== filtroSubproceso) return false;
    
    if (!filtroAnio && !filtroMes) return true;
    if (!inf.fecha) return false;
    const [anio, mes] = inf.fecha.split('-'); 
    if (filtroAnio && anio !== filtroAnio) return false;
    if (filtroMes && mes !== filtroMes) return false;
    
    return true;
  });

  // 1. Filtrar los datos del Dashboard según el menú lateral
  const informesDashboard = informesEnriquecidos.filter(inf => {
    if (dashFiltroAnio !== 'Todos' && inf.fecha?.split('-')[0] !== dashFiltroAnio) return false;
    if (dashFiltroProceso !== 'Todos' && inf.procesoLimpio !== dashFiltroProceso) return false;
    if (dashFiltroSubproceso !== 'Todos' && inf.subproceso !== dashFiltroSubproceso) return false; 
    if (dashFiltroEstado !== 'Todos' && (dashFiltroEstado === 'Socializado' ? inf.socializado === 'Sí' : inf.socializado !== 'Sí')) return false;
    if (dashFiltroResponsable !== 'Todos' && inf.elaboradoPor !== dashFiltroResponsable) return false;
    return true;
  });

  // 2. Calcular KPIs basados en lo que está filtrado
  const totalInformes = informesDashboard.length;
  const socializados = informesDashboard.filter(i => i.socializado === 'Sí').length;
  const pctSocializados = totalInformes > 0 ? Math.round((socializados / totalInformes) * 100) : 0;
  const pendientes = totalInformes - socializados;
  const pctPendientes = totalInformes > 0 ? Math.round((pendientes / totalInformes) * 100) : 0;
  const procesosAuditados = new Set(informesDashboard.map(i => i.procesoLimpio)).size;
  const sortedInformes = [...informesDashboard].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimoInforme = sortedInformes.length > 0 ? sortedInformes[0] : null;

  // 3. Agrupador Dinámico según el botón "ORGANIZAR POR"
  const informesAgrupados = informesDashboard.reduce((acc, inf) => {
    let key = 'Sin clasificar';
    if (agruparPor === 'Año') key = inf.fecha ? inf.fecha.split('-')[0] : 'Sin Fecha';
    if (agruparPor === 'Proceso') key = inf.procesoLimpio;
    if (agruparPor === 'Subproceso') key = inf.subproceso || 'General'; 
    if (agruparPor === 'Estado') key = inf.socializado === 'Sí' ? 'Socializados' : 'Pendientes';
    if (agruparPor === 'Responsable') key = inf.elaboradoPor || 'Sin Asignar';

    if (!acc[key]) acc[key] = [];
    acc[key].push(inf);
    return acc;
  }, {});

  const gruposOrdenados = Object.keys(informesAgrupados).sort((a, b) => b.localeCompare(a));

  // 4. Lógica para el Top 5 de Procesos
  const conteoProcesos = informesDashboard.reduce((acc, inf) => {
    acc[inf.procesoLimpio] = (acc[inf.procesoLimpio] || 0) + 1;
    return acc;
  }, {});
  const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const limpiarFiltrosDashboard = () => {
    setDashFiltroAnio('Todos'); setDashFiltroProceso('Todos'); setDashFiltroSubproceso('Todos');
    setDashFiltroEstado('Todos'); setDashFiltroResponsable('Todos');
  }; 

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
  const [historialExpandido, setHistorialExpandido] = useState(true);
  const [historialCompacto, setHistorialCompacto] = useState(true);
  const [historialVersionOpen, setHistorialVersionOpen] = useState({});
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [draftHistory, setDraftHistory] = useState([]);
  const [draftInforme, setDraftInforme] = useState({
    titulo: '',
    proceso: '',
    subproceso: 'General',
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

// 🔄 CARGA MAESTRA GARANTIZADA: Lee la BD al instante
  useEffect(() => {
    if (editInformeAuditoria) {
      try {
        const dbUrlInf = editInformeAuditoria.evidenciaUrl || editInformeAuditoria.evidenciaUrlInput || editInformeAuditoria.archivoUrl || '';
        const urlInfValida = (dbUrlInf === '#' || dbUrlInf.trim() === '') ? '' : dbUrlInf;

        const decodeName = (url) => {
          if (!url) return '';
          try { return decodeURIComponent(url.split('/').pop().split('?')[0]); } 
          catch(e) { return 'Archivo_Adjunto'; }
        };

        // Soporte Legacy: Convertir acta vieja al nuevo formato de array o cargar array existente
        let anexosCargados = [];
        if (editInformeAuditoria.anexos && Array.isArray(editInformeAuditoria.anexos)) {
          anexosCargados = editInformeAuditoria.anexos;
        } else if (editInformeAuditoria.actaSocializacionUrl && editInformeAuditoria.actaSocializacionUrl !== '#') {
          anexosCargados = [{ url: editInformeAuditoria.actaSocializacionUrl, nombre: decodeName(editInformeAuditoria.actaSocializacionUrl) }];
        }

        const draftInicial = {
          titulo: editInformeAuditoria.titulo || '',
          proceso: editInformeAuditoria.proceso || editInformeAuditoria.macroproceso || '',
          subproceso: editInformeAuditoria.subproceso || 'General',
          tipoFuente: editInformeAuditoria.tipoFuente || '',
          detalleFuente: editInformeAuditoria.detalleFuente || '',
          fecha: editInformeAuditoria.fecha || '',
          elaboradoPor: editInformeAuditoria.elaboradoPor || '',
          revisadoPor: editInformeAuditoria.revisadoPor || '',
          aprobadoPor: editInformeAuditoria.aprobadoPor || '',
          socializado: editInformeAuditoria.socializado || 'No',
          fechaSocializacion: editInformeAuditoria.fechaSocializacion || editInformeAuditoria.fecha_socializacion || editInformeAuditoria.fechaSoc || '',
          participantes: editInformeAuditoria.participantes || editInformeAuditoria.socializadoCon || '',
          correosNotificacionInput: editInformeAuditoria.correoEnviadoA || '',
        };

        setDraftInforme(draftInicial);
        setDraftHistory([draftInicial]);

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
        subproceso: 'General',
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
      };
      setDraftInforme(draftVacio);
      setDraftHistory([draftVacio]);
      setIsDirty(false);
      setHistorialExpandido(true);
    }
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

    const confirmado = window.confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
    if (confirmado) {
      callback();
    }
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

  const fusionarAdjuntosUnicos = (listaActual = [], nuevos = []) => {
    const map = new Map();
    [...listaActual, ...nuevos].forEach((item) => {
      if (!item || !item.url) return;
      const clave = `${item.url}|${item.nombre || ''}`;
      if (!map.has(clave)) map.set(clave, item);
    });
    return [...map.values()];
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

    const MAX_MB = 7;

    const procesarYSubirArchivo = async (originalFile, onProgressCallback) => {
      let fileToUpload = originalFile;
      if (fileToUpload.type.startsWith('image/')) {
        try { fileToUpload = await compressImage(fileToUpload, 1280, 1280, 0.7); } 
        catch (err) { console.error("Error comprimiendo imagen:", err); }
      }

      if (fileToUpload.size > MAX_MB * 1024 * 1024) {
        throw new Error(`El archivo ${fileToUpload.name} supera el límite (${MAX_MB} MB).`);
      }

      const nombreLimpio = sanitizarNombreArchivo(fileToUpload.name);
      const file = new File([fileToUpload], nombreLimpio, { type: fileToUpload.type });
      
      const data = await apiService.subirEvidencia(file, { appName: 'controlInterno' }, onProgressCallback);
      
      const urlFinal = data?.url || data?.path || data?.filePath || (typeof data === 'string' ? data : file.name);
      return { url: urlFinal, nombre: file.name };
    };

    if (type === 'informe') {
      setCargandoInforme(true);
      setProgresoInforme(0);
      setUploadError(null);
      try {
        const resultado = await procesarYSubirArchivo(originalFiles[0], setProgresoInforme);
        setArchivoSubidoUrl(resultado.url);
        setArchivoSubidoNombre(resultado.nombre);
        alert("🎉 ¡Informe guardado con éxito!");
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
        alert("🎉 ¡Anexos guardados con éxito! Los documentos anteriores se conservaron.");
      } catch (err) {
        alert(`⚠️ Error al subir anexos:\n${err.message}`);
      } finally {
        setCargandoAnexo(false);
        setProgresoAnexo(0);
        e.target.value = ''; // Limpiar el input
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
    setFormResetKey(Date.now());
    setVistaActiva('dashboard');
  };

  const cambiarVista = (nuevaVista) => {
    if (nuevaVista === vistaActiva) return;
    confirmarSalidaSinGuardar(() => {
      setVistaActiva(nuevaVista);
    });
  };

  // Extraer años y responsables únicos para los selects
  const aniosDisponibles = [...new Set(safeInformes.map(i => i.fecha?.split('-')[0]).filter(Boolean))].sort().reverse();
  const responsablesDisponibles = [...new Set(safeInformes.map(i => i.elaboradoPor).filter(Boolean))].sort();

  const historialActual = Array.isArray(editInformeAuditoria?.historialCambios)
    ? editInformeAuditoria.historialCambios
    : [];

  const ultimoCambio = historialActual.length > 0 ? historialActual[historialActual.length - 1] : null;

  const contarCambios = (item) => Array.isArray(item?.historialCambios) ? item.historialCambios.length : 0;

  const restaurarCambiosNoGuardados = () => {
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
      tipoFuente: editInformeAuditoria.tipoFuente || '',
      detalleFuente: editInformeAuditoria.detalleFuente || '',
      fecha: editInformeAuditoria.fecha || '',
      elaboradoPor: editInformeAuditoria.elaboradoPor || '',
      revisadoPor: editInformeAuditoria.revisadoPor || '',
      aprobadoPor: editInformeAuditoria.aprobadoPor || '',
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
    const { log, versionResumen, snapshot } = restoreConfirm;

    const siguiente = {
      titulo: snapshot.titulo || draftInforme.titulo || '',
      proceso: snapshot.proceso || draftInforme.proceso || '',
      subproceso: snapshot.subproceso || draftInforme.subproceso || 'General',
      tipoFuente: draftInforme.tipoFuente || '',
      detalleFuente: draftInforme.detalleFuente || '',
      fecha: snapshot.fecha || draftInforme.fecha || '',
      elaboradoPor: snapshot.elaboradoPor || draftInforme.elaboradoPor || '',
      revisadoPor: snapshot.revisadoPor || draftInforme.revisadoPor || '',
      aprobadoPor: snapshot.aprobadoPor || draftInforme.aprobadoPor || '',
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
          <button onClick={() => cambiarVista('dashboard')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'dashboard' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📊 Resumen Visual</button>
          <button onClick={() => cambiarVista('historial')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'historial' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📜 Historial Completo</button>
          
          {isAdmin && (
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

      {/* 🚀 VISTA 1: DASHBOARD DE KPIs CON MENÚ LATERAL */}
      {vistaActiva === 'dashboard' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-slate-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl shrink-0">📄</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Informes</p>
                   <p className="text-2xl font-black text-slate-800">{totalInformes}</p>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-emerald-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">✅</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Socializados</p>
                   <div className="flex items-baseline space-x-2">
                     <p className="text-2xl font-black text-slate-800">{socializados}</p>
                     <p className="text-[10px] font-bold text-emerald-500">{pctSocializados}%</p>
                   </div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-orange-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xl shrink-0">🕒</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pendientes</p>
                   <div className="flex items-baseline space-x-2">
                     <p className="text-2xl font-black text-slate-800">{pendientes}</p>
                     <p className="text-[10px] font-bold text-orange-500">{pctPendientes}%</p>
                   </div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">🏛️</div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Procesos Auditados</p>
                   <p className="text-2xl font-black text-slate-800">{procesosAuditados}</p>
                </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 hover:border-purple-300 transition-colors">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">📅</div>
                <div className="overflow-hidden">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Último Informe</p>
                   <p className="text-[13px] font-black text-slate-800 truncate mt-1">{ultimoInforme ? ultimoInforme.fecha : '---'}</p>
                   <p className="text-[9px] font-bold text-slate-400 truncate">{ultimoInforme ? ultimoInforme.procesoLimpio : 'Sin datos'}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
             
             {/* 🎛️ MENÚ LATERAL DE ORGANIZACIÓN */}
             <div className="lg:col-span-1 space-y-4">
                <div className="bg-white rounded-2xl border border-[#1A4B42]/20 shadow-sm overflow-hidden">
                  <div className="bg-[#f8fafa] p-4 border-b border-[#1A4B42]/10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-[#1A4B42] uppercase tracking-widest">ORGANIZAR POR</h3>
                    <div className="w-6 h-6 rounded-full bg-[#1A4B42] text-white flex items-center justify-center text-[10px] font-bold">1</div>
                  </div>
                  <div className="p-2 space-y-1">
                    {[
                      { id: 'Año', label: 'Vista por Año', icon: '📊' },
                      { id: 'Proceso', label: 'Vista por Proceso', icon: '🏛️' },
                      { id: 'Subproceso', label: 'Vista por Subproceso', icon: '🗂️' }, // ✨ NUEVO BOTÓN
                      { id: 'Estado', label: 'Vista por Estado', icon: '🚩' },
                      { id: 'Responsable', label: 'Vista por Responsable', icon: '👤' }
                    ].map(btn => (
                      <button 
                        key={btn.id}
                        onClick={() => { setAgruparPor(btn.id); setGrupoExpandido(null); }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-3 ${agruparPor === btn.id ? 'bg-[#f0fdf4] text-[#0A3B32] shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <span className="text-sm grayscale opacity-70">{btn.icon}</span>
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#1A4B42]/20 shadow-sm p-4 space-y-4">
                  <h3 className="text-[10px] font-black text-[#1A4B42] uppercase tracking-widest border-b border-slate-100 pb-2">FILTROS</h3>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Año</label>
                    <select value={dashFiltroAnio} onChange={e=>setDashFiltroAnio(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Macroproceso</label>
                    <select 
                      value={dashFiltroProceso} 
                      onChange={e => { setDashFiltroProceso(e.target.value); setDashFiltroSubproceso('Todos'); }} 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]"
                    >
                      <option value="Todos">Todos</option>
                      {Object.keys(MAPA_PROCESOS).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* ✨ NUEVO: SELECTOR DE SUBPROCESO DINÁMICO Y LIMPIO */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Subproceso</label>
                    <select 
                      value={dashFiltroSubproceso} 
                      onChange={e => setDashFiltroSubproceso(e.target.value)} 
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]"
                    >
                      <option value="Todos">Todos</option>
                      {[...new Set(dashFiltroProceso !== 'Todos' ? (MAPA_PROCESOS[dashFiltroProceso] || []) : Object.values(MAPA_PROCESOS).flat())].sort().map(sp => (
                        <option key={sp} value={sp}>{sp}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Estado</label>                    <select value={dashFiltroEstado} onChange={e=>setDashFiltroEstado(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      <option value="Socializado">Socializado</option>
                      <option value="Pendiente">Pendiente</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">Responsable</label>
                    <select value={dashFiltroResponsable} onChange={e=>setDashFiltroResponsable(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-[#0A3B32]">
                      <option value="Todos">Todos</option>
                      {responsablesDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <button onClick={limpiarFiltrosDashboard} className="w-full bg-[#f8fafa] hover:bg-slate-100 text-[#0A3B32] border border-[#1A4B42]/10 font-bold text-[10px] uppercase tracking-widest py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all">
                    <span>Limpiar Filtros</span> <span>⚗️</span>
                  </button>
                </div>
             </div>

             {/* 🗂️ ACORDEONES */}
             <div className="lg:col-span-2 space-y-4">
               <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 ml-2">
                    <span>Agrupado por: <span className="text-[#0A3B32] bg-[#f0fdf4] px-2 py-1 rounded-md">{agruparPor}</span></span>
                    <span className="text-slate-400 font-medium">({gruposOrdenados.length} grupos)</span>
                  </div>
               </div>

               {informesDashboard.length === 0 ? (
                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 font-bold italic">
                   No hay informes que coincidan con los filtros.
                 </div>
               ) : (
                 gruposOrdenados.map(grupo => {
                   const infs = informesAgrupados[grupo];
                   const soc = infs.filter(i => i.socializado === 'Sí').length;
                   const pend = infs.length - soc;
                   const procs = new Set(infs.map(i => i.procesoLimpio)).size;
                   const isExpanded = grupoExpandido === grupo;

                   return (
                     <div key={grupo} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                       <div onClick={() => setGrupoExpandido(isExpanded ? null : grupo)} className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'border-b border-slate-100 bg-slate-50/50' : ''}`}>
                         <div className="flex items-center space-x-3 flex-1 pr-4">
                         <span className="text-xl shrink-0">{agruparPor === 'Año' ? '📅' : agruparPor === 'Proceso' ? '🏛️' : agruparPor === 'Subproceso' ? '🗂️' : agruparPor === 'Estado' ? '🚩' : '👤'}</span>
                           <h4 className="text-sm sm:text-base font-black text-slate-800 leading-tight">{grupo} <span className="text-slate-400 font-medium text-xs ml-1 whitespace-nowrap">({infs.length})</span></h4>
                           {grupo === new Date().getFullYear().toString() && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm shrink-0">Actual</span>}
                         </div>
                         {!isExpanded && (
                           <div className="hidden md:flex items-center space-x-4 text-xs font-bold bg-white px-4 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                             <span className="text-emerald-600 flex items-center"><span className="mr-1.5 text-base">✅</span> {soc}</span>
                             <span className="text-orange-500 flex items-center"><span className="mr-1.5 text-base">🕒</span> {pend}</span>
                             <span className="text-slate-300 ml-4 border-l pl-4 font-black">▼</span>
                           </div>
                         )}
                         {isExpanded && <span className="text-slate-400 font-black hidden md:block">▲</span>}
                       </div>

                       {isExpanded && (
                         <div className="p-4 sm:p-6 bg-white animate-in slide-in-from-top-2 duration-300">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-b border-slate-100 pb-6">
                             <div className="text-center">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Socializados</p>
                               <p className="text-xl font-black text-emerald-600">{soc} <span className="text-[10px] font-bold text-emerald-400 ml-1">({Math.round((soc/infs.length)*100)}%)</span></p>
                             </div>
                             <div className="text-center border-l border-slate-100">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Pendientes</p>
                               <p className="text-xl font-black text-orange-500">{pend} <span className="text-[10px] font-bold text-orange-300 ml-1">({Math.round((pend/infs.length)*100)}%)</span></p>
                             </div>
                             <div className="text-center border-l border-slate-100 hidden md:block">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Procesos</p>
                               <p className="text-xl font-black text-slate-700">{procs}</p>
                             </div>
                             <div className="text-center border-l border-slate-100 hidden md:block">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Última Emisión</p>
                               <p className="text-sm font-black text-slate-700 mt-1.5">{infs.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0]?.fecha}</p>
                             </div>
                           </div>

                           <div className="space-y-2">
                             {infs.slice(0, 5).map(inf => (
                               <div key={inf.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-200">
                                 <div className="flex items-center space-x-4 w-full md:w-1/2">
                                   <div className={`w-1 h-10 rounded-full shrink-0 ${inf.socializado === 'Sí' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                                   <div>
                                     <p className="text-xs font-bold text-slate-800 leading-tight" title={inf.procesoLimpio}>{inf.procesoLimpio}</p>
                                     <p className="text-[10px] text-slate-400 font-mono mt-0.5">{inf.ref}</p>
                                   </div>
                                 </div>
                                 <div className="w-1/6 hidden lg:block">
                                   <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${inf.socializado === 'Sí' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                                     {inf.socializado === 'Sí' ? 'Socializado' : 'Pendiente'}
                                   </span>
                                 </div>
                                 <div className="w-1/4 hidden md:block text-[10px] font-bold text-slate-600 truncate">
                                   <span className="text-slate-400 font-normal mr-1">Auditor:</span>{inf.elaboradoPor}
                                 </div>
                                 <div className="w-auto md:w-1/6 text-right text-[10px] font-bold text-slate-500">
                                   {inf.fecha}
                                 </div>
                               </div>
                             ))}
                           </div>
                           
                           {infs.length > 5 && (
                             <div className="mt-5 text-center bg-slate-50 rounded-xl p-2 border border-slate-100">
                               <button onClick={() => { setFiltroAnio(agruparPor==='Año'?grupo:''); setVistaActiva('historial'); }} className="text-[10px] font-black uppercase tracking-widest text-[#0A3B32] hover:underline flex items-center justify-center w-full">
                                 Ver los {infs.length} informes <span className="ml-1 text-sm">➔</span>
                               </button>
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })
               )}
             </div>
             
             {/* 🍩 RESUMEN VISUAL */}
             <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit sticky top-24">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">RESUMEN VISUAL</h3>
                
                <div className="flex items-center justify-center mb-8">
                   <div className="relative w-36 h-36 rounded-full border-[14px] border-slate-100 border-l-emerald-500 border-t-emerald-500 border-r-orange-500 border-b-slate-200 flex items-center justify-center transform -rotate-45 shadow-inner">
                      <div className="transform rotate-45 text-center">
                         <span className="block text-3xl font-black text-slate-800 leading-none">{totalInformes}</span>
                         <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Total</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4 mb-8">
                   <div className="flex justify-between items-center text-xs font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                     <span className="flex items-center text-emerald-900"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-sm"></span> Socializados</span>
                     <span className="text-emerald-700 bg-white px-2 py-0.5 rounded shadow-sm">{socializados}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs font-bold bg-orange-50 p-2.5 rounded-xl border border-orange-100">
                     <span className="flex items-center text-orange-900"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2 shadow-sm"></span> Pendientes</span>
                     <span className="text-orange-700 bg-white px-2 py-0.5 rounded shadow-sm">{pendientes}</span>
                   </div>
                </div>

                {topProcesos.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Top Procesos Auditados</h3>
                    <div className="space-y-3">
                      {topProcesos.map(([proc, count], idx) => (
                        <div key={idx} className="flex items-center text-[10px]">
                          <span className="w-20 truncate text-slate-600 font-bold pr-2" title={proc}>{proc}</span>
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#0A3B32] h-full rounded-full" style={{width: `${(count/totalInformes)*100}%`}}></div>
                          </div>
                          <span className="w-6 text-right font-black text-slate-800">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* 🚀 VISTA 2: FORMULARIO NUEVO / EDICIÓN */}
      {vistaActiva === 'nuevo' && isAdmin && (
        <div id="edit-form" className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-200 space-y-4 relative animate-in slide-in-from-right-8 duration-500 max-w-5xl mx-auto">
          
          <div className="flex justify-between items-center border-b pb-4 gap-3">
            <h3 className="text-sm font-black text-[#0A3B32] uppercase tracking-widest flex items-center">
              <span className="text-xl mr-3 bg-emerald-50 p-2 rounded-lg">{editInformeAuditoria ? '✏️' : '➕'}</span>
              {editInformeAuditoria ? `Editando Flujo de Informe: ${editInformeAuditoria.ref}` : 'ARCHIVAR, RADICAR Y DISTRIBUIR NUEVO INFORME'}
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
              const guardado = await handleInformeAuditoriaSubmit(e);
              if (!guardado) return;
              
              setIsDirty(false);
              handleResetForm();
              if (typeof setFormResetKey === 'function') setFormResetKey(Date.now());
              setVistaActiva('dashboard'); 
            }} 
            onInputCapture={() => setIsDirty(true)}
            onChangeCapture={() => setIsDirty(true)}
            className="space-y-6 text-xs"
          >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

             {/* 🛡️ FUENTE DE MEJORA Y VINCULACIÓN OBLIGATORIA */}
              <div className="md:col-span-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm mb-2 space-y-4">
                <div>
                  <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📍 Fuente de Mejora (Obligatorio)</label>
                 <select
                    name="tipoFuente"
                    required
                    value={tipoFuenteForm}
                    onChange={(e) => {
                      setTipoFuenteFormState(prev => ({ ...prev, [idEdicion]: e.target.value }));
                      if (e.target.value !== 'Programa de Auditoría') {
                        setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
                        setSubprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
                      }
                    }}
                    className="w-full border border-emerald-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-sm bg-white cursor-pointer"
                  >
                    <option value="">-- Seleccione la Fuente que origina el informe --</option>
                    <option value="Programa de Auditoría">Programa de Auditoría</option>
                    <option value="Auditoría">Auditoría</option>
                    <option value="Cliente">Cliente</option>
                    <option value="Accidente">Accidente</option>
                    <option value="Indicador">Indicador</option>
                    <option value="Iniciativa">Iniciativa</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>

                {tipoFuenteForm === 'Programa de Auditoría' && (
                  <div className="animate-in fade-in duration-300 border-t border-emerald-200 pt-3">
                    <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📋 Vincular Programa de Auditoría Aprobado</label>
                    <select
                      name="programaId"
                      required
                      defaultValue={editInformeAuditoria?.programaId || ''}
                      onChange={(e) => {
                        const prog = safeProgramas.find(p => String(p.id) === String(e.target.value));
                        if (prog) {
                           setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: prog.proceso || '' }));
                           setSubprocesoForm(prev => ({ ...prev, [idEdicion]: prog.subproceso || 'General' }));
                        }
                      }}
                      className="w-full border border-emerald-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-sm bg-white cursor-pointer"
                    >
                      <option value="">-- Seleccione un Programa --</option>
                      {safeProgramas.filter(p => p.estado === 'Aprobado').map((p, idx) => (
                        <option key={p.id} value={p.id}>
                          [{p.ref || `PRG-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`}] {p.proceso} — {p.subproceso || 'General'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-emerald-700 mt-1.5 font-medium">El sistema autocompletará el Macroproceso y Subproceso auditado.</p>
                  </div>
                )}

              {tipoFuenteForm && tipoFuenteForm !== 'Programa de Auditoría' && (
                  <div className="animate-in fade-in duration-300 border-t border-emerald-200 pt-3">
                    <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📝 Detalle de la Fuente ({tipoFuenteForm})</label>
                    <input
                      name="detalleFuente"
                      required
                      defaultValue={editInformeAuditoria?.detalleFuente || ''}
                      placeholder={`Especifique el origen relacionado a: ${tipoFuenteForm}`}
                      className="w-full border border-emerald-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-800 shadow-sm bg-white"
                    />
                    <p className="text-xs text-emerald-700 mt-2 font-semibold">Debe especificar manualmente la fuente - informes de auditoría, PQRs, accidentes de trabajo e iniciativas de proceso, entre otros.</p>
                  </div>
                )} 
              </div>

              <div className="md:col-span-2">
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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm" 
                />
              </div>

              <div className="md:col-span-1">
                 <label className="font-bold text-gray-600 block mb-1.5">🏛️ Macroproceso</label>
                 <select
                   name="proceso"
                   required
                   value={draftInforme.proceso || macroprocesoForm}
                   onChange={(e) => {
                     const nuevoMacro = e.target.value;
                     const siguiente = { ...draftInforme, proceso: nuevoMacro };
                     setDraftInforme(siguiente);
                     registrarCambioBorrador(siguiente);
                     setIsDirty(true);
                     setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: nuevoMacro }));
                     
                     const subprocesosAsociados = MAPA_PROCESOS[nuevoMacro] || [];
                     if (subprocesosAsociados.length === 1) {
                       const siguienteSub = { ...siguiente, subproceso: subprocesosAsociados[0] };
                       setDraftInforme(siguienteSub);
                       registrarCambioBorrador(siguienteSub);
                       setSubprocesoForm(prev => ({ ...prev, [idEdicion]: subprocesosAsociados[0] }));
                     } else {
                       const siguienteSub = { ...siguiente, subproceso: '' };
                       setDraftInforme(siguienteSub);
                       registrarCambioBorrador(siguienteSub);
                       setSubprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
                     }
                   }}
                   className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 cursor-pointer shadow-sm disabled:opacity-50"
                   disabled={tipoFuenteForm === 'Programa de Auditoría'}
                 >
                   <option value="">-- Seleccionar --</option>
                   {Object.keys(MAPA_PROCESOS).map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
              </div>

              <div className="md:col-span-1">
                 <label className="font-bold text-gray-600 block mb-1.5">↳ Subproceso</label>
                 <select 
                   name="subproceso" 
                   value={draftInforme.subproceso || subprocesoForm || 'General'} 
                   onChange={(e) => {
                     const siguiente = { ...draftInforme, subproceso: e.target.value };
                     setDraftInforme(siguiente);
                     registrarCambioBorrador(siguiente);
                     setIsDirty(true);
                     setSubprocesoForm(prev => ({ ...prev, [idEdicion]: e.target.value }));
                   }}
                   required 
                   className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                   disabled={
                     !macroprocesoForm || 
                     tipoFuenteForm === 'Programa de Auditoría' || 
                     (MAPA_PROCESOS[macroprocesoForm]?.length <= 1)
                   }
                 >
                   <option value="">-- Seleccionar --</option>
                   {[...new Set(MAPA_PROCESOS[macroprocesoForm] || [])].sort().map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>  

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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm" 
                />
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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-medium text-slate-800 shadow-sm cursor-pointer"
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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-sm cursor-pointer text-slate-800"
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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 bg-white outline-none w-full shadow-sm cursor-pointer text-slate-800"
                >
                  <option value="">-- Seleccionar Cargo --</option>
                  {CARGOS_EMPRESA.map((cargo, i) => <option key={`apr-${i}`} value={cargo}>{cargo}</option>)}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">📢 ¿Fue Socializado?</label>
                <select 
                  name="socializado" 
                  value={draftInforme.socializado || socializadoForm} 
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, socializado: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                    setSocializadoFormState(prev => ({ ...prev, [idEdicion]: e.target.value }));
                  }}
                  className="w-full border rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm cursor-pointer"
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </div>

              {/* ✨ CAMPO CONDICIONADO: Fecha de Socialización */}
              <div className="md:col-span-1">
                <label className="font-bold text-gray-600 block mb-1.5">🗓️ Fecha Socialización</label>
                <input 
                  key={`fecha-soc-${idEdicion}-${socializadoForm}-${editInformeAuditoria?.id || 'nuevo'}`}
                  name="fechaSocializacion" 
                  type="date" 
                  disabled={draftInforme.socializado !== 'Sí' && socializadoForm !== 'Sí'}
                  value={draftInforme.fechaSocializacion || ''}
                  onChange={(e) => {
                    const siguiente = { ...draftInforme, fechaSocializacion: e.target.value };
                    setDraftInforme(siguiente);
                    registrarCambioBorrador(siguiente);
                    setIsDirty(true);
                  }}
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 shadow-sm cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed transition-all" 
                />
              </div>

              {/* ⚠️ Nota: Se redujo a md:col-span-2 para mantener la cuadrícula simétrica */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-gray-600 block mb-1">Participantes de la Socialización (Cargos)</label>
                <div className="flex gap-2">
                <select 
                    value={participanteTemp} 
                    onChange={(e) => setParticipanteTemp(e.target.value)} 
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-700 text-xs shadow-sm cursor-pointer"
                  >
                    <option value="">-- Seleccionar Cargo Participante --</option>
                    {CARGOS_EMPRESA.map(cargo => (
                      <option key={cargo} value={cargo} disabled={participantesMultiples.includes(cargo)}>{cargo}</option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => { 
                      if(participanteTemp && !participantesMultiples.includes(participanteTemp)) {
                        setParticipantesMultiples([...participantesMultiples, participanteTemp]); 
                      }
                      setParticipanteTemp(''); 
                    }} 
                    className="bg-[#0A3B32] text-white px-5 rounded-lg text-xs font-bold hover:bg-[#062620] shrink-0 transition-colors shadow-sm flex items-center"
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
                        className="ml-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors font-sans"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
             </div>
                <input type="hidden" name="participantes" value={participantesMultiples.join(', ')} />
                <input type="hidden" name="socializadoCon" value={participantesMultiples.join(', ')} />
              </div>   
            </div>            
            
            <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl shadow-inner mt-4">
              <label className="font-black text-blue-900 block mb-2 uppercase tracking-wider text-[10px]">📧 DISTRIBUCIÓN POR CORREO ELECTRÓNICO (NOTIFICACIÓN INMEDIATA)</label>
<input name="correosNotificacionInput" type="text" placeholder="Ej: usuario1@empresa.com, usuario2@empresa.com (Separa los correos por comas)" className="w-full border border-blue-300 bg-white rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 shadow-sm" />
              <p className="text-[10px] text-blue-600 mt-2 font-medium">Al guardar, el sistema enviará automáticamente una copia digitalizada del informe y su acta a los destinatarios configurados.</p>
            </div>

            {/* ☁️ BÓVEDA SERVIDOR TERMALES */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="md:col-span-2 border-b pb-3 border-slate-200 flex justify-between items-center">
                <div>
                  <label className="font-black text-slate-800 uppercase tracking-widest text-xs">Repositorio Oficial Termales Santa Rosa</label>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Sube tus PDFs. El sistema los enviará directo a repos.termalessantarosa.com.co.</p>
                </div>
                <div className="text-slate-300 text-3xl">☁️</div>
              </div>

<input type="hidden" name="evidenciaUrlInput" value={archivoSubidoUrl} />
              {/* Enviamos los anexos como JSON string para el nuevo flujo */}
              <input type="hidden" name="anexosMultiples" value={JSON.stringify(anexosMultiples)} />
              {/* 🛡️ SOPORTE LEGACY: Evita que el componente padre crashee buscando los campos viejos */}
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
                                          <div className="font-black uppercase tracking-wider text-slate-500 mb-1">Archivos en esta versión</div>
                                          <ul className="space-y-1">
                                            {archivos.map((archivo, idx) => (
                                              <li key={`${archivo.url || idx}`} className="flex justify-between gap-2">
                                                <span className="font-bold text-slate-600">{archivo.tipo || 'Archivo'}</span>
                                                <span className="text-right text-slate-700 break-all max-w-[180px]" title={archivo.nombre}>{archivo.nombre}</span>
                                              </li>
                                            ))}
                                          </ul>
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
                    <button type="button" onClick={(e) => { e.preventDefault(); window.open(obtenerUrlAbsoluta(archivoSubidoUrl), '_blank'); }} className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1 cursor-pointer">
                        <span>👁️</span><span>Ver PDF</span>
                      </button>
                      <label className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1 cursor-pointer">
                        <span>🔄</span><span>Reemplazar</span>
                        <input type="file" className="hidden" accept=".pdf, .docx" onChange={(e) => {
                          const confirmar = window.confirm('¿Deseas reemplazar este documento principal? Los anexos ya cargados se conservarán.');
                          if (confirmar) handleFileUpload(e, 'informe');
                          else e.target.value = '';
                        }} />
                      </label>
                      <button type="button" onClick={(e) => { e.preventDefault(); if (confirm("¿Seguro de quitar este adjunto?")) { setArchivoSubidoUrl(''); setArchivoSubidoNombre(''); } }} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-sm transition-all flex items-center space-x-1 cursor-pointer">
                        <span>🗑️</span><span>Eliminar</span>
                      </button>
                    </div>
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
                          <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-mono font-bold text-slate-700 truncate w-3/4" title={anexo.nombre}>
                              📎 {anexo.nombre}
                            </p>
                            <div className="flex gap-1">
                            <button type="button" onClick={(e) => { e.preventDefault(); window.open(obtenerUrlAbsoluta(anexo.url), '_blank'); }} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded-md transition-colors" title="Ver PDF">👁️</button>
                              <button type="button" onClick={(e) => { e.preventDefault(); setAnexosMultiples(prev => prev.filter((_, i) => i !== index)); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded-md transition-colors" title="Eliminar">🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full mt-2">
                      <div className="text-3xl opacity-50 group-hover:scale-110 transition-transform">➕</div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-colors">Añadir Archivos</p>
                      <input type="file" multiple className="hidden" accept=".pdf, .jpg, .png, .docx, .xlsx" onChange={(e) => handleFileUpload(e, 'acta')} />
                    </label>
                    <p className="mt-2 text-[9px] text-slate-500 text-center font-medium bg-purple-50 border border-purple-100 rounded-lg px-2 py-1.5">
                      Los anexos anteriores se conservan y se suman con los nuevos.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-4 flex justify-end pt-4">
              <div className="mr-auto flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-700 shadow-sm">
                <span>Total adjuntos:</span>
                <span className="bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-900">{(archivoSubidoUrl ? 1 : 0) + anexosMultiples.length}</span>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting || cargandoInforme || cargandoAnexo} 
                className={`font-black uppercase tracking-widest px-10 py-3.5 rounded-xl shadow-lg transition-all w-full md:w-auto text-center block text-sm ${isSubmitting || cargandoInforme || cargandoAnexo ? 'bg-slate-400 text-slate-100 cursor-not-allowed' : 'bg-[#0A3B32] hover:bg-[#062620] hover:scale-105 text-white cursor-pointer'}`}
              >
                {isSubmitting ? '⏳ Procesando...' : cargandoInforme || cargandoAnexo ? 'Subiendo archivos...' : (editInformeAuditoria ? 'Guardar Cambios' : 'RADICAR Y ENVIAR DICTAMEN')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🚀 VISTA 3: TABLA DE HISTORIAL */}
      {vistaActiva === 'historial' && (
        <div className="space-y-6 animate-in slide-in-from-left-8 duration-500">
          <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Filtros:</span>
              
              {/* SELECTOR DE PROCESO */}
              <select value={filtroProceso} onChange={(e) => { setFiltroProceso(e.target.value); setFiltroSubproceso(''); }} className="border border-slate-300 rounded-lg text-xs py-2 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0A3B32] shadow-sm cursor-pointer">
                <option value="">🏛️ Todos los Procesos</option>
                {Object.keys(MAPA_PROCESOS).map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {/* SELECTOR DE SUBPROCESO EN CASCADA */}
              <select value={filtroSubproceso} onChange={(e) => setFiltroSubproceso(e.target.value)} disabled={!filtroProceso} className="border border-slate-300 rounded-lg text-xs py-2 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0A3B32] shadow-sm cursor-pointer disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed max-w-[200px] truncate">
                <option value="">🗂️ Todos los Subprocesos</option>
                {filtroProceso && [...new Set(MAPA_PROCESOS[filtroProceso] || [])].sort().map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="border border-slate-300 rounded-lg text-xs py-2 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0A3B32] shadow-sm cursor-pointer">
                <option value="">📅 Todos los Años</option>
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(a => <option key={a} value={String(a)}>{a}</option>)}
              </select>
              
              <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="border border-slate-300 rounded-lg text-xs py-2 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0A3B32] shadow-sm cursor-pointer">
                <option value="">📆 Todos los Meses</option>
                <option value="01">Enero</option><option value="02">Febrero</option><option value="03">Marzo</option>
                <option value="04">Abril</option><option value="05">Mayo</option><option value="06">Junio</option>
                <option value="07">Julio</option><option value="08">Agosto</option><option value="09">Septiembre</option>
                <option value="10">Octubre</option><option value="11">Noviembre</option><option value="12">Diciembre</option>
              </select>
            </div>
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-full md:w-64 shadow-inner">
              <span className="text-slate-400">🔍</span>
              <input type="text" placeholder="Buscar informe..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-xs outline-none bg-transparent text-slate-700 font-bold placeholder-slate-400" />
            </div>
          </div>

          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wider">
                    <th className="p-4 w-32">Consecutivo</th>
                    <th className="p-4">Proceso / Título</th>
                    <th className="p-4">Trazabilidad de Firmas</th>
                    <th className="p-4">Socialización e Impacto</th>
                    <th className="p-4 text-center w-56">Documentos Custodiados</th>
                  </tr>
                  <tr className="bg-slate-100">
                    <td className="p-2"><FilterInput colKey="ref" placeholder="Filtrar..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></td>
                    <td className="p-2"><FilterInput colKey="proceso" placeholder="Filtrar proceso..." dark={false} columnFilters={columnFilters} handleColFilterChange={handleColFilterChange} /></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 bg-slate-50"></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {applyFilters(informesFiltradosPorFecha, searchTerm, columnFilters).length === 0 ? (
                    <tr><td colSpan="5" className="p-12 text-center text-slate-400 font-bold italic">No se encontraron informes.</td></tr>
                  ) : (
                    applyFilters(informesFiltradosPorFecha, searchTerm, columnFilters).map((inf, idx) => (
                      <tr key={inf.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono font-black text-sm text-slate-800 bg-slate-50/50">{inf.ref || `INF-2026-${String(idx + 1).padStart(3, '0')}`}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 font-black rounded uppercase text-[9px] tracking-wider mb-1 inline-block">
                            {inf.macroproceso || inf.proceso}
                          </span>
                          {inf.subproceso && inf.subproceso !== 'General' && (
                            <div className="text-[10px] text-slate-500 font-bold mt-0.5 mb-1.5">↳ {inf.subproceso}</div>
                          )}
                          <div className="font-bold text-slate-900 text-sm leading-tight mt-1">{inf.titulo}</div>
                          <div className="text-[9px] text-slate-400 font-medium mt-1">Emitido el: {inf.fecha}</div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full">
                              {contarCambios(inf)} cambios
                            </span>
                            {contarCambios(inf) > 0 && (
                              <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-1">
                                {Array.isArray(inf.historialCambios) ? inf.historialCambios[inf.historialCambios.length - 1].accion : 'Sin acciones'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-[10px] font-medium text-slate-600">
                            <div><span className="text-slate-400 font-bold">✍️ ELABORÓ:</span> <span className="font-black text-slate-800">{inf.elaboradoPor}</span></div>
                            <div><span className="text-slate-400 font-bold">🔍 REVISÓ:</span> <span className="font-black text-slate-800">{inf.revisadoPor}</span></div>
                            <div><span className="text-slate-400 font-bold">🔒 APROBÓ:</span> <span className="font-black text-slate-800">{inf.aprobadoPor}</span></div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-start space-y-1.5">
                            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border inline-block ${inf.socializado === 'Sí' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>📢 Socializado: {inf.socializado || 'No'}</span>
                            {(inf.participantes || inf.socializadoCon) && (
                              <div className="text-[10px] text-slate-500 font-bold leading-relaxed bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 mt-1">
                                <span className="text-slate-400 font-normal">Cargos:</span> {inf.participantes || inf.socializadoCon}
                              </div>
                            )}
                            {inf.correoEnviadoA && (
                              <div className="mt-2 group inline-block cursor-help">
                                <div className="flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-sm">
                                  <span className="text-sm">📧</span><span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Notificado al Líder</span>
                                </div>
                                <div className="fixed inset-0 z-[9999] pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible flex items-center justify-center transition-all duration-300">
                                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"></div>
                                  <div className="relative bg-[#0f172a] border border-emerald-500/40 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] transform scale-95 group-hover:scale-100 transition-transform duration-300 w-80 text-left">
                                    <h4 className="text-[12px] font-black text-emerald-400 uppercase tracking-widest mb-3 border-b border-slate-700/80 pb-2 flex items-center"><span className="mr-2 text-base">🔗</span> Audit Trail de Correo</h4>
                                    <div className="space-y-3 text-[10px] leading-relaxed text-slate-300 font-medium">
                                      <p className="flex flex-col"><b className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Destinatario(s):</b> <span className="text-white font-mono break-all bg-slate-800/80 p-1.5 rounded border border-slate-700">{inf.correoEnviadoA}</span></p>
                                      <p className="flex flex-col"><b className="text-slate-400 uppercase tracking-wider text-[9px] mb-1">Fecha y Hora de Despacho:</b> <span className="text-emerald-400 font-black text-xs">{inf.fechaCorreoEnviado}</span></p>
                                      <p className="text-[9px] text-slate-500 italic mt-3 border-t border-slate-700/80 pt-3">El sistema GRC certifica que este dictamen fue despachado de forma segura.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center space-y-1.5 align-middle">
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
                              
                              window.open(obtenerUrlAbsoluta(urlValida), '_blank', 'noopener,noreferrer');
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
                                    window.open(obtenerUrlAbsoluta(urlActa), '_blank', 'noopener,noreferrer');
                                  }}
                                  className="bg-purple-50 text-purple-700 font-black px-3 py-2 rounded-xl text-[10px] hover:bg-purple-100 flex items-center justify-center space-x-1 border border-purple-100 shadow-sm transition-all w-full cursor-pointer mt-1"
                                >
                                  <span>🤝</span><span>Ver Acta Socialización</span>
                                </button>
                              );
                            }
                            return <div className="text-[9px] text-slate-400 italic bg-slate-50 py-1.5 rounded border border-dashed text-center mt-1">Sin Acta Cargada</div>;
                          })()}
                          {isAdmin && (
                            <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                              <button type="button" onClick={() => { setEditInformeAuditoria(inf); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm(); }} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏️ Editar</button>
                              <span className="text-slate-200">|</span>
                              <button type="button" onClick={() => handleDeleteItem('informesAuditoria', inf.id)} className="text-slate-400 hover:text-red-600 text-xs font-bold">🗑️ Eliminar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}