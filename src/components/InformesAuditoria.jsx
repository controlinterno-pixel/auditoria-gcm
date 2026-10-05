import { useState, useEffect } from 'react';
import { renderHistorialSummary } from '../utils/historialCambios.js';
import { 
  MAPA_PROCESOS, 
  CARGOS_EMPRESA 
} from '../constants/diccionariosGRC';

import { apiService } from '../services/apiService';

const fusionarAdjuntosUnicos = (listaActual = [], nuevos = []) => {
  const map = new Map();
  [...listaActual, ...nuevos].forEach((item) => {
    if (!item || !item.url) return;
    const clave = `${item.url}|${item.nombre || ''}`;
    if (!map.has(clave)) map.set(clave, item);
  });
  return [...map.values()];
};

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
  FilterInput,
  fuentesMejora = []
}) {

  // 🏢 CONTROL DE CARGOS MÚLTIPLES EN SOCIALIZACIÓN
  const [participantesMultiples, setParticipantesMultiples] = useState([]);
  const [participanteTemp, setParticipanteTemp] = useState('');

  // 🌟 ESTADOS TEMPORALES PARA EL FORMULARIO
  // (Eliminamos estados redundantes que causaban desfases en los selects)
  const [macroprocesoFormState, setMacroprocesoForm] = useState(null);
  const [subprocesoFormState, setSubprocesoForm] = useState(null);

  // Derivamos de editInformeAuditoria en el render cuando no haya interacción manual del usuario
  const idEdicion = editInformeAuditoria?.id || 'nuevo';
  const macroprocesoForm = macroprocesoFormState?.[idEdicion] ?? (editInformeAuditoria?.macroproceso || editInformeAuditoria?.proceso || '');
  const subprocesoForm = subprocesoFormState?.[idEdicion] ?? (editInformeAuditoria?.subproceso || 'General');
  const safeInformes = Array.isArray(informesAuditoria) ? informesAuditoria : [];
  const fuentesMejoraDisponibles = Array.isArray(fuentesMejora) ? fuentesMejora : [];

  // 🧭 ESTADOS DE NAVEGACIÓN (TABS Y ACORDEÓN)
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [agruparPor, setAgruparPor] = useState('Proceso');
  
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
    return true;
  });

  // 2. Calcular KPIs basados en lo que está filtrado
  const totalInformes = informesDashboard.length;
  const socializados = informesDashboard.filter(i => i.socializado === 'Sí').length;
  const pctSocializados = totalInformes > 0 ? Math.round((socializados / totalInformes) * 100) : 0;
  const pendientes = totalInformes - socializados;
  const pctPendientes = totalInformes > 0 ? Math.round((pendientes / totalInformes) * 100) : 0;
  const procesosAuditados = new Set(informesDashboard.map(i => i.procesoLimpio)).size;

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
        subproceso: 'General',
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

 const cambiarVista = (nuevaVista) => {
    if (nuevaVista === vistaActiva) return;

    if (vistaActiva !== 'nuevo') {
      setVistaActiva(nuevaVista);
      return;
    }

    confirmarSalidaSinGuardar(() => {
      setVistaActiva(nuevaVista);
    });
  };

  const cambiarVistaSegura = (nuevaVista) => {
    cambiarVista(nuevaVista); // Usamos la misma lógica de protección que ya tiene el archivo
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
    const nuevoMacro = fuenteDB?.macroproceso || fuenteDB?.proceso || '';
    const nuevoSub = fuenteDB?.subproceso || 'General';
    const siguienteDraft = {
      ...draftInforme,
      tipoFuente: seleccion,
      detalleFuente: fuenteDB?.alcance || fuenteDB?.descripcion || '',
      proceso: nuevoMacro,
      macroproceso: nuevoMacro,
      subproceso: nuevoSub,
    };

    setDraftInforme(siguienteDraft);
    registrarCambioBorrador(siguienteDraft);
    setIsDirty(true);

    if (fuenteDB) {
      setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: nuevoMacro }));
      setSubprocesoForm(prev => ({ ...prev, [idEdicion]: nuevoSub }));
    } else if (seleccion === 'Programa de Auditoría') {
      setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
      setSubprocesoForm(prev => ({ ...prev, [idEdicion]: '' }));
    }
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

      {/* 🚀 VISTA 1: DASHBOARD ANALÍTICO TIPO BIG FOUR (IMAGEN 1) */}
      {vistaActiva === 'dashboard' && (() => {
        // 1. Cálculos dinámicos para las nuevas gráficas y pastillas (Pills)
        const conteoFuentes = informesDashboard.reduce((acc, inf) => {
          const fuente = inf.tipoFuente || 'Auditoría Interna';
          acc[fuente] = (acc[fuente] || 0) + 1;
          return acc;
        }, {});
        const fuentesArray = Object.entries(conteoFuentes).sort((a,b) => b[1] - a[1]);
        
        // Paleta de colores para la dona y pastillas
        const coloresArray = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'];
        const iconosArray = ['🎯', '🏢', '💬', '📈', '⚠️', '🛡️', '🔗'];
        
        // Generador de Conic Gradient para la Dona
        let accumulatedPercent = 0;
        const donutSlices = fuentesArray.map(([, count], idx) => {
          const percent = (count / totalInformes) * 100;
          const color = coloresArray[idx % coloresArray.length];
          const slice = `${color} ${accumulatedPercent}% ${accumulatedPercent + percent}%`;
          accumulatedPercent += percent;
          return slice;
        }).join(', ');
        const donutStyle = totalInformes > 0 ? { background: `conic-gradient(${donutSlices})` } : { background: '#f8fafc' };

        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 bg-slate-50/50 -m-6 p-6 rounded-b-2xl">
            
            {/* 1. TARJETAS SUPERIORES (MATCH EXACTO IMAGEN 1) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shrink-0 border border-blue-100">📄</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total de informes</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{totalInformes}</p>
                  <p className="text-[10px] font-bold text-emerald-500 mt-2 flex items-center gap-1">↑ 12% <span className="text-slate-400 font-medium normal-case">vs. mes anterior</span></p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-2xl shrink-0 border border-amber-100">🕒</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">En proceso</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{pendientes}</p>
                  <p className="text-[10px] font-bold text-amber-500 mt-2 flex items-center gap-1">↑ {pctPendientes}%</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl shrink-0 border border-emerald-100">✓</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Socializados</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{socializados}</p>
                  <p className="text-[10px] font-bold text-emerald-500 mt-2 flex items-center gap-1">↑ {pctSocializados}%</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-2xl shrink-0 border border-red-100">!</div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Procesos Auditados</p>
                  <p className="text-3xl font-black text-slate-800 leading-none">{procesosAuditados}</p>
                  <p className="text-[10px] font-bold text-red-500 mt-2 flex items-center gap-1">↓ 2%</p>
                </div>
              </div>
            </div>

            {/* 2. FUENTES DE INFORME (PILLS) */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fuentes de Informe</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                <div className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-3 shrink-0 shadow-md shadow-blue-500/20 cursor-pointer">
                  <span className="text-sm">⊞</span>
                  <span className="text-[11px] font-bold">Todas</span>
                  <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-md">({totalInformes})</span>
                </div>
                {fuentesArray.map(([fuente, count], idx) => (
                  <div key={fuente} className="bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl flex items-center gap-3 shrink-0 hover:bg-slate-50 cursor-pointer shadow-sm transition-colors">
                    <span className="text-sm">{iconosArray[idx % iconosArray.length]}</span>
                    <span className="text-[11px] font-bold">{fuente}</span>
                    <span className="text-slate-400 text-[10px] font-bold">({count})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              
              {/* 3. ZONA IZQUIERDA: FILTROS + TABLA + ACORDEÓN */}
              <div className="xl:col-span-3 space-y-4">
                
                {/* Barra de Filtros Blanca */}
                <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-wrap items-center gap-3 shadow-sm">
                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Proceso</span>
                    <select value={dashFiltroProceso} onChange={e => { setDashFiltroProceso(e.target.value); setDashFiltroSubproceso('Todos'); }} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer">
                      <option value="Todos">Todos los procesos</option>
                      {[...new Set(informesEnriquecidos.map(p => p.procesoLimpio).filter(Boolean))].sort().map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>

                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Subproceso</span>
                    <select value={dashFiltroSubproceso} onChange={e => setDashFiltroSubproceso(e.target.value)} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer max-w-[140px] truncate">
                      <option value="Todos">Todos los subprocesos</option>
                      {[...new Set(dashFiltroProceso !== 'Todos' ? (MAPA_PROCESOS[dashFiltroProceso] || []) : Object.values(MAPA_PROCESOS).flat())].sort().map(sp => <option key={sp} value={sp}>{sp}</option>)}
                    </select>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>

                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Año</span>
                    <select value={dashFiltroAnio} onChange={e=>setDashFiltroAnio(e.target.value)} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer">
                      <option value="Todos">Todos</option>
                      {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>

                  <div className="flex flex-col px-2">
                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">Estado</span>
                    <select value={dashFiltroEstado} onChange={e=>setDashFiltroEstado(e.target.value)} className="bg-transparent text-slate-700 font-bold text-[11px] outline-none cursor-pointer">
                      <option value="Todos">Todos</option>
                      <option value="Socializado">Socializado</option>
                      <option value="Pendiente">Pendiente</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex-1 ml-auto">
                    <span className="text-slate-400 text-xs">🔍</span>
                    <input type="text" placeholder="Buscar informe, título, responsable..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-[11px] outline-none bg-transparent text-slate-700 font-medium placeholder-slate-400" />
                  </div>
                </div>

                {/* Tabla Principal Tipo Big Four */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          <th className="p-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-300" /></th>
                          <th className="p-4 w-32">Consecutivo</th>
                          <th className="p-4">Informe / Título</th>
                          <th className="p-4">Fuente</th>
                          <th className="p-4">Proceso</th>
                          <th className="p-4 text-center">Fecha</th>
                          <th className="p-4 text-center">Trazabilidad</th>
                          <th className="p-4 text-center">Socialización</th>
                          <th className="p-4 text-center">Estado</th>
                          <th className="p-4 text-center w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-600">
                        {informesDashboard.length === 0 ? (
                          <tr><td colSpan="10" className="p-12 text-center text-slate-400 font-bold italic">No hay informes para los filtros seleccionados.</td></tr>
                        ) : (
                          applyFilters(informesDashboard, searchTerm, columnFilters).slice(0, 10).map(inf => {
                            const iconIndex = fuentesArray.findIndex(([f]) => f === (inf.tipoFuente || 'Auditoría Interna'));
                            const colorClass = ['text-blue-600 bg-blue-50 border-blue-200', 'text-purple-600 bg-purple-50 border-purple-200', 'text-emerald-600 bg-emerald-50 border-emerald-200', 'text-amber-600 bg-amber-50 border-amber-200', 'text-rose-600 bg-rose-50 border-rose-200', 'text-cyan-600 bg-cyan-50 border-cyan-200'][iconIndex % 6];
                            
                            return (
                              <tr key={inf.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="p-4 text-center"><input type="checkbox" className="rounded border-slate-300" /></td>
                                <td className="p-4 font-mono font-black text-slate-800">
                                  <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => { setEditInformeAuditoria(inf); setModoVistaCompleta(true); cambiarVistaSegura('nuevo'); scrollToForm(); }}>
                                    {inf.ref}
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-slate-700 leading-tight truncate max-w-[180px]" title={inf.titulo}>
                                  {inf.titulo}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2.5 py-1 rounded-full font-black uppercase tracking-wider text-[8px] border flex items-center w-max gap-1.5 ${colorClass}`}>
                                    <span>{iconosArray[iconIndex % iconosArray.length]}</span> {inf.tipoFuente || 'Auditoría Interna'}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-500 font-bold truncate max-w-[120px]" title={inf.procesoLimpio}>{inf.procesoLimpio}</td>
                                <td className="p-4 text-center text-slate-500 font-bold">{inf.fecha}</td>
                                <td className="p-4 text-center">
                                  <span className="text-blue-600 font-bold text-[10px] flex items-center justify-center gap-1 cursor-help" title="Con evidencia adjunta">🔗 Trazable</span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`font-bold text-[10px] flex items-center justify-center gap-1 ${inf.socializado === 'Sí' ? 'text-emerald-600' : 'text-amber-500'}`}>
                                    <span>{inf.socializado === 'Sí' ? '👥' : '⚠️️'}</span>
                                    {inf.socializado === 'Sí' ? 'Completada' : 'Pendiente'}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className="text-emerald-600 font-bold text-[10px] flex items-center justify-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                                  </span>
                                </td>
                                <td className="p-4 text-center text-slate-400 font-bold text-lg space-x-2">
                                  <button onClick={() => { setEditInformeAuditoria(inf); setModoVistaCompleta(true); cambiarVistaSegura('nuevo'); scrollToForm(); }} className="hover:text-blue-600 transition-colors" title="Ver Informe">👁️</button>
                                  <button className="hover:text-slate-700 transition-colors" title="Más opciones">⋮</button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white p-4 flex items-center justify-between border-t border-slate-200 text-[10px] font-bold text-slate-400">
                    <span>Mostrando {Math.min(informesDashboard.length, 10)} de {informesDashboard.length} informes</span>
                    {informesDashboard.length > 10 && (
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600">&lt;</button>
                        <button className="px-3 py-1 rounded bg-blue-600 text-white shadow-sm">1</button>
                        <button onClick={() => cambiarVistaSegura('historial')} className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600">&gt;</button>
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
              <div className="xl:col-span-1 space-y-4">
                
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
                     {fuentesArray.map(([fuente, count], idx) => {
                       const percent = totalInformes > 0 ? Math.round((count/totalInformes)*100) : 0;
                       const color = coloresArray[idx % coloresArray.length];
                       return (
                         <div key={fuente} className="flex justify-between items-center text-[10px] font-bold">
                           <span className="flex items-center text-slate-600 truncate" title={fuente}>
                             <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: color }}></span> 
                             <span className="truncate w-28">{fuente}</span>
                           </span>
                           <span className="text-slate-800 shrink-0">{count} <span className="text-slate-400 font-medium ml-1">({percent}%)</span></span>
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
    
      {/* 🚀 VISTA 2: FORMULARIO NUEVO / EDICIÓN */}
      {vistaActiva === 'nuevo' && isAdmin && (
        <div id="edit-form" className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-200 space-y-4 relative animate-in slide-in-from-right-8 duration-500 max-w-5xl mx-auto">
          
          <div className="flex justify-between items-center border-b pb-4 gap-3">
            <h3 className="text-sm font-black text-[#0A3B32] uppercase tracking-widest flex items-center">
              <span className="text-xl mr-3 bg-emerald-50 p-2 rounded-lg">{modoVistaCompleta ? '👁️' : (editInformeAuditoria ? '✏️' : '➕')}</span>
              {modoVistaCompleta ? `Información completa: ${editInformeAuditoria?.ref || 'Informe'}` : (editInformeAuditoria ? `Editando Flujo de Informe: ${editInformeAuditoria.ref}` : 'ARCHIVAR, RADICAR Y DISTRIBUIR NUEVO INFORME')}
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
              setVistaActiva('dashboard'); 
            }} 
            className="space-y-6 text-xs"
          >
          {modoVistaCompleta && (
            <>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 font-bold flex items-center justify-between gap-3">
                <span>Modo vista: esta información está guardada y no puede modificarse desde aquí.</span>
                <button
                  type="button"
                  onClick={() => {
                    setModoVistaCompleta(false);
                    setIsDirty(false);
                  }}
                  className="rounded-full border border-sky-300 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-sky-700 hover:bg-sky-100"
                >
                  Editar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Título</div>
                  <div className="mt-1 text-sm font-black text-slate-800 break-words">{draftInforme.titulo || 'Sin título'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Proceso</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{draftInforme.proceso || 'Sin proceso'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Subproceso</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{draftInforme.subproceso || 'General'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fuente</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{draftInforme.tipoFuente || 'No definida'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{draftInforme.fecha || 'Sin fecha'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Auditor Responsable</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{draftInforme.auditorResponsable || 'Sin asignar'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Correo Auditor</div>
                  <div className="mt-1 text-sm font-bold text-slate-800 break-all">{draftInforme.correoAuditor || 'Sin correo'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Socializado</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{draftInforme.socializado || 'No'}</div>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

{/* 🛡️ FUENTE DE MEJORA Y VINCULACIÓN DINÁMICA */}
              <div className="md:col-span-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm mb-2 space-y-4">
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
                    <optgroup label="Otras Fuentes Manuales">
                      <option value="Programa de Auditoría">Programa de Auditoría (Heredado)</option>
                    </optgroup>
                  </select>
                </div>

               {draftInforme.tipoFuente === 'Programa de Auditoría' && (
                  <div className="animate-in fade-in duration-300 border-t border-emerald-200 pt-3">
                    <label className="font-black text-emerald-900 block mb-1.5 uppercase tracking-widest text-[10px]">📋 Vincular Programa de Auditoría Aprobado</label>
                    <select
                      name="programaId"
                      required
                      defaultValue={editInformeAuditoria?.programaId || ''}
                      onChange={(e) => {
                        const prog = safeProgramas.find(p => String(p.id) === String(e.target.value));
                        setIsDirty(true);
                        if (prog) {
                           setMacroprocesoForm(prev => ({ ...prev, [idEdicion]: prog.proceso || '' }));
                           setSubprocesoForm(prev => ({ ...prev, [idEdicion]: prog.subproceso || 'General' }));
                        }
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
                    <p className="text-[9px] text-emerald-700 mt-1.5 font-medium">El sistema autocompletará el Macroproceso y Subproceso auditado.</p>
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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={modoVistaCompleta}
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
                   className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 cursor-pointer shadow-sm disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
disabled={draftInforme.tipoFuente === 'Programa de Auditoría' || modoVistaCompleta}
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
                   className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] bg-white outline-none font-bold text-slate-800 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                   disabled={
                     !macroprocesoForm || 
                     draftInforme.tipoFuente === 'Programa de Auditoría' || 
                     (MAPA_PROCESOS[macroprocesoForm]?.length <= 1) ||
                     modoVistaCompleta
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
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed" 
                  disabled={modoVistaCompleta}
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
                    const siguiente = { ...draftInforme, auditorResponsable: valor };
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
                  placeholder="auditoria@empresa.com"
                  className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-800 bg-white shadow-sm disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={modoVistaCompleta}
                />
                <input type="hidden" name="correoAuditorResponsable" value={draftInforme.correoAuditor || ''} />
                <input type="hidden" name="correo_auditor" value={draftInforme.correoAuditor || ''} />
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

              {/* ⚠️ Nota: Se redujo a md:col-span-2 para mantener la cuadrícula simétrica */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
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
                    onClick={() => { 
                      if(participanteTemp && !participantesMultiples.includes(participanteTemp)) {
  setParticipantesMultiples([...participantesMultiples, participanteTemp]); 
  setIsDirty(true);
}
                      setParticipanteTemp(''); 
                    }} 
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
              </div>   
            </div>            
            
            <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-2xl shadow-inner mt-4">
              <label className="font-black text-blue-900 block mb-2 uppercase tracking-wider text-[10px]">📧 DISTRIBUCIÓN POR CORREO ELECTRÓNICO (NOTIFICACIÓN INMEDIATA)</label>
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
                    onClick={() => cambiarVista('dashboard')}
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
                          <div className="text-[9px] text-slate-400 font-medium mt-1">
                            Emitido el: {inf.fecha}{inf.hora ? ` a las ${inf.hora}` : ''}
                          </div>
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
                          {isAdmin && (
                            <div className="flex justify-center items-center space-x-2 pt-2 border-t mt-2">
                              <button type="button" onClick={() => { setEditInformeAuditoria(inf); setModoVistaCompleta(false); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm(); }} className="text-orange-500 hover:text-orange-700 text-xs font-bold">✏️ Editar</button>
                              <span className="text-slate-200">|</span>
                              <button type="button" onClick={() => { setEditInformeAuditoria(inf); setModoVistaCompleta(true); setVistaActiva('nuevo'); setFormResetKey(Date.now()); scrollToForm(); }} className="text-sky-600 hover:text-sky-700 text-xs font-bold">👁️ Ver info completa</button>
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