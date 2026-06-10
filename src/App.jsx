import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- TUS LLAVES SECRETAS DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBGE2P-_oep_N7o8so6wubmaZXv12imZaE",
  authDomain: "gestion-de-riesgos-b4bf0.firebaseapp.com",
  projectId: "gestion-de-riesgos-b4bf0",
  storageBucket: "gestion-de-riesgos-b4bf0.firebasestorage.app",
  messagingSenderId: "507146405155",
  appId: "1:507146405155:web:574f89d0cc6256e629b896",
  measurementId: "G-WTZPTWV67Y"
};

// Inicializamos la app, la autenticación y la base de datos
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- CONTROL DE ACCESO: LISTA DE AUDITORES AUTORIZADOS ---
const ADMIN_EMAILS = [
  "controlinterno@termales.com.co",
  "auditoria@termales.com.co",
  "analista.auditoria@termales.com.co",
  "analista.controlinterno@termales.com.co"
];

// --- DATOS POR DEFECTO ---
const defaultRiesgos = [
  { id: 98, categoria: 'Operativo', proceso: 'Alimentos y bebidas', tipoRiesgo: 'Operativo', afectacion: 'Reputacional', causaInmediata: 'Mal estado de materias primas', causaRaiz: 'Proveedores no evaluados', descripcion: 'Afectación del sabor e higiene de alimentos por uso de insumos cárnicos de baja calidad.', probabilidadInherente: 'Posible', impactoInherente: 'Alto', noControl: 'C-98', descripcionControl: 'Checklist de cadena de frío diaria e inspección organoléptica al recibir insumos.', probabilidadResidual: 'Posible', impactoResidual: 'Medio', responsable: 'Jefe de Alimentos y Bebidas', historialCambios: [] },
  { id: 186, categoria: 'Estratégico', proceso: 'Gestión Estratégica', tipoRiesgo: 'Legal y Regulatorio', afectacion: 'Económica', causaInmediata: 'Cambios normativos tributarios', causaRaiz: 'Falta de comité legal interno', descripcion: 'Sanciones o pérdidas financieras por errores en la declaración de impuestos hoteleros.', probabilidadInherente: 'Rara', impactoInherente: 'Medio', noControl: 'C-186', descripcionControl: 'Revisión y auditoría externa por firma contable cada trimestre.', probabilidadResidual: 'Rara', impactoResidual: 'Bajo', responsable: 'Gerente Financiero', historialCambios: [] },
  { id: 201, categoria: 'Tecnológico', proceso: 'Infraestructura TI', tipoRiesgo: 'Ciberseguridad', afectacion: 'Operacional', causaInmediata: 'Falta de parches de seguridad', causaRaiz: 'Obsolescencia de servidores locales', descripcion: 'Intrusión de ransomware que paralice el sistema hotelero de reservas.', probabilidadInherente: 'Posible', impactoInherente: 'Crítico', noControl: 'C-201', descripcionControl: 'Firewall activo con logs y copias de seguridad semanales inmutables.', probabilidadResidual: 'Posible', impactoResidual: 'Alto', responsable: 'CISO / Director de TI', historialCambios: [] }
];

const defaultHallazgos = [
  { id: 1, ref: 'Aud. Interna TI-2026', titulo: 'Acceso de usuarios genéricos a la base de datos del ERP.', proceso: 'Sistemas', responsable: 'Jefe de TI', severidad: 'Alto', idRiesgo: 201, estado: 'Abierto', fecha: '2026-06-01', historialCambios: [] },
  { id: 2, ref: 'Aud. Op-2025', titulo: 'Ausencia de actas de capacitación en higiene de alimentos.', proceso: 'Alimentos y bebidas', responsable: 'Jefe de A&B', severidad: 'Medio', idRiesgo: 98, estado: 'Cerrado', fecha: '2025-11-15', historialCambios: [] }
];

const defaultPlanes = [
  { id: 1, idHallazgo: 1, accion: 'Desactivar credenciales comunes y parametrizar roles individuales en base de datos.', responsable: 'Jefe de TI', fecha: '2026-07-15', estado: 'En Proceso', historialCambios: [] },
  { id: 2, idHallazgo: 2, accion: 'Realizar capacitación certificada con entidad de salud y documentar firmas.', responsable: 'Jefe de A&B', fecha: '2025-12-10', estado: 'Cerrado', historialCambios: [] }
];

const defaultIncidentes = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-05', titulo: 'Alarma de ataque de fuerza bruta contenida', descripcion: 'El firewall detectó 400 intentos de inicio de sesión fallidos de IPs externas. El puerto se bloqueó.', costo: 1200000, impacto: 'Bajo', reportadoPor: 'analista.controlinterno@termales.com.co', estado: 'Cerrado', historialCambios: [] }
];

const defaultEvaluaciones = [
  { id: 1, idRiesgo: 201, fecha: '2026-06-01', diseño: 'Eficaz', ejecucion: 'Eficaz', calificacion: 100, comentarios: 'Prueba de penetración simulada arrojó contención del cortafuegos de manera instantánea.', auditor: 'controlinterno@termales.com.co', historialCambios: [] }
];

export default function App() {
  // Estados UI
  const [activeTab, setActiveTab] = useState('tablero');
  const [notification, setNotification] = useState(null);
  const [tipoMatriz, setTipoMatriz] = useState('inherente'); 
  const [filtroAnio, setFiltroAnio] = useState('Todos');
  const [xlsxLoaded, setXlsxLoaded] = useState(false);

  // Estados de Modificación / Edición
  const [editRiesgo, setEditRiesgo] = useState(null);
  const [editEvaluacion, setEditEvaluacion] = useState(null);
  const [editHallazgo, setEditHallazgo] = useState(null);
  const [editPlan, setEditPlan] = useState(null);
  const [editIncidente, setEditIncidente] = useState(null);

  // Estado para el Modal Historial
  const [viewHistory, setViewHistory] = useState(null);

  // Estado de Autenticación de Firebase
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);

  // Estados del Formulario de Login
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  // Estados de datos principales
  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [driveUrl, setDriveUrl] = useState(''); 

  // Variables seguras
  const safeRiesgos = Array.isArray(riesgos) ? riesgos : [];
  const safeHallazgos = Array.isArray(hallazgos) ? hallazgos : [];
  const safePlanes = Array.isArray(planes) ? planes : [];
  const safeIncidentes = Array.isArray(incidentes) ? incidentes : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];

  // --- ESCUCHA DE AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userEmailNormalized = currentUser.email?.toLowerCase().trim();
        const hasAdminAccess = ADMIN_EMAILS.some(email => email.toLowerCase().trim() === userEmailNormalized);
        setIsAdmin(hasAdminAccess);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- CARGA DE LIBRERÍA XLSX ---
  useEffect(() => {
    if (window.XLSX) { setXlsxLoaded(true); return; }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxLoaded(true);
    document.head.appendChild(script);
  }, []);

  // --- CONEXIÓN EN TIEMPO REAL A FIREBASE ---
  useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);

    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');

    const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        setRiesgos(Array.isArray(data.riesgos) ? data.riesgos : defaultRiesgos);
        setHallazgos(Array.isArray(data.hallazgos) ? data.hallazgos : defaultHallazgos);
        setPlanes(Array.isArray(data.planes) ? data.planes : defaultPlanes);
        setIncidentes(Array.isArray(data.incidentes) ? data.incidentes : defaultIncidentes);
        setEvaluaciones(Array.isArray(data.evaluaciones) ? data.evaluaciones : defaultEvaluaciones);
        setDriveUrl(data.driveUrl || ''); 
      } else {
        if (ADMIN_EMAILS.some(email => email.toLowerCase().trim() === user.email?.toLowerCase().trim())) {
          setDoc(docRef, {
            riesgos: defaultRiesgos,
            hallazgos: defaultHallazgos,
            planes: defaultPlanes,
            incidentes: defaultIncidentes,
            evaluaciones: defaultEvaluaciones,
            driveUrl: ''
          });
        }
      }
      setIsCloudLoaded(true);
    }, (error) => {
      console.error("Error leyendo Firestore:", error);
      showNotification("Error de permisos en la nube. Verifique su acceso.", "error");
      setIsCloudLoaded(true);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // --- MÉTODOS AUXILIARES Y DE AUTENTICACIÓN ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        showNotification("Cuenta registrada con éxito.");
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        showNotification("Sesión iniciada correctamente.");
      }
    } catch (error) {
      setAuthError('Error de autenticación. Verifique sus credenciales.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRiesgos([]); setHallazgos([]); setPlanes([]); setIncidentes([]); setEvaluaciones([]);
    showNotification("Sesión cerrada.");
  };

  const saveToCloud = async (partialData) => {
    try {
      const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
      await setDoc(docRef, partialData, { merge: true });
    } catch (error) {
      showNotification("Error al guardar en la nube.", "error");
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 6000);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleResetData = async () => {
      if (!isAdmin) return;
      if (window.confirm('⚠️ ¿Seguro que desea FORMATEAR la base de datos a sus valores iniciales?')) {
          const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
          await setDoc(docRef, {
            riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes,
            incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, driveUrl: ''
          });
          window.location.reload();
      }
  };

  const mapImpactoNum = { 'Bajo': 1, 'Medio': 2, 'Alto': 4, 'Crítico': 5 };
  const mapProbabilidadNum = { 'Rara': 1, 'Posible': 3, 'Frecuente': 5 };

  const getYearFromDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    if (dateStr.includes('-')) return dateStr.split('-')[0];
    if (dateStr.includes('/')) return dateStr.split('/')[2].substring(0,4);
    return 'N/A';
  };

  const normalizarImpacto = (val) => {
    if (!val) return 'Medio';
    const s = String(val).toLowerCase();
    if (s.includes('alta') || s.includes('mayor') || s.includes('4')) return 'Alto';
    if (s.includes('extremo') || s.includes('catastr') || s.includes('critico') || s.includes('crítico') || s.includes('5')) return 'Crítico';
    if (s.includes('moderado') || s.includes('media') || s.includes('3')) return 'Medio';
    if (s.includes('baja') || s.includes('menor') || s.includes('2') || s.includes('1')) return 'Bajo';
    return 'Medio';
  };

  const normalizarProbabilidad = (val) => {
    if (!val) return 'Posible';
    const s = String(val).toLowerCase();
    if (s.includes('alta') || s.includes('frecuente') || s.includes('5') || s.includes('4')) return 'Frecuente';
    if (s.includes('media') || s.includes('posible') || s.includes('moderada') || s.includes('3')) return 'Posible';
    if (s.includes('baja') || s.includes('rara') || s.includes('2') || s.includes('1')) return 'Rara';
    return 'Posible';
  };

  // --- LÓGICA CENTRAL DE PROCESAMIENTO DE EXCEL ---
  const processExcelWorkbook = async (wb, originName = "Archivo local") => {
    let nuevosRiesgos = [...safeRiesgos];
    let nuevosIncidentes = [...safeIncidentes];
    let nuevasEvaluaciones = [...safeEvaluaciones];
    
    let uniqueRiesgosProcesados = new Set();
    let currentRiskId = null; 
    let cEvaluaciones = 0; let cIncidentes = 0;
    const timestamp = new Date().toLocaleString();

    const matrizSheetName = wb.SheetNames.find(name => name.toUpperCase().includes("MATRICES DE RIESGO") || name.toUpperCase().includes("MATRIZ"));
    const riesgosSheetName = wb.SheetNames.find(name => name.trim().toLowerCase() === "riesgos");

    if (matrizSheetName) {
      const wsRiesgos = wb.Sheets[matrizSheetName];
      const dataRiesgos = window.XLSX.utils.sheet_to_json(wsRiesgos, { defval: "" });
      
      dataRiesgos.forEach(row => {
        let rawId = row['No'] || row['No.'] || row['ID'] || row['N°'];
        if (rawId && String(rawId).trim() !== '') {
          currentRiskId = parseInt(rawId);
        }

        if (currentRiskId && !isNaN(currentRiskId)) {
          uniqueRiesgosProcesados.add(currentRiskId);
          const existeIdx = nuevosRiesgos.findIndex(r => r.id === currentRiskId);

          let nuevoControl = row['Descripción del Control'] || '';
          let nuevoNumControl = row['No. Control'] || '';

          if (existeIdx >= 0) {
            let controlExistente = nuevosRiesgos[existeIdx].descripcionControl || '';
            let numControlExistente = nuevosRiesgos[existeIdx].noControl || '';

            if (nuevoControl && !controlExistente.includes(nuevoControl)) {
              nuevosRiesgos[existeIdx].descripcionControl = controlExistente + " | " + nuevoControl;
            }
            if (nuevoNumControl && !numControlExistente.includes(nuevoNumControl)) {
              nuevosRiesgos[existeIdx].noControl = numControlExistente + ", " + nuevoNumControl;
            }
            nuevosRiesgos[existeIdx].historialCambios = [...(nuevosRiesgos[existeIdx].historialCambios || []), { fecha: timestamp, accion: `Control adicional sincronizado desde Excel` }];
          } else {
            const pInh = normalizarProbabilidad(row['Probabilidad Inherente']);
            const iInh = normalizarImpacto(row['Impacto Inherente']);
            const pRes = normalizarProbabilidad(row['Probabilidad Residual Final']);
            const iRes = normalizarImpacto(row['Impacto Residual Final']);

            const riesgoObj = {
              id: currentRiskId,
              categoria: row['Categoría'] || 'Operativo',
              proceso: row['Proceso/Subproceso'] || row['Proceso'] || 'Gestión',
              tipoRiesgo: row['Tipo de riesgo'] || 'Operativo',
              afectacion: row['Afectacion'] || 'Económica',
              causaInmediata: row['Causa Inmediata'] || 'N/A',
              causaRaiz: row['Causa Raíz'] || 'N/A',
              descripcion: row['Descripción del riesgo'] || 'Sin descripción',
              probabilidadInherente: pInh,
              impactoInherente: iInh,
              probabilidadResidual: pRes,
              impactoResidual: iRes,
              noControl: nuevoNumControl || `C-${currentRiskId}`,
              descripcionControl: nuevoControl || 'No especificado',
              responsable: row['Responsable'] || 'No Asignado',
              historialCambios: [{ fecha: timestamp, accion: `Sincronización automática desde ${originName} (Hoja: ${matrizSheetName})` }]
            };
            nuevosRiesgos.push(riesgoObj);
          }
        }
      });
    }

    if (riesgosSheetName) {
      const wsMaterializacion = wb.Sheets[riesgosSheetName];
      const dataMat = window.XLSX.utils.sheet_to_json(wsMaterializacion, { defval: "" });

      dataMat.forEach((row, index) => {
        const idRiesgoVal = parseInt(row['N°'] || row['N° Riesgo'] || row['ID']);
        if (!isNaN(idRiesgoVal)) {
          
          const matString = String(row['¿Materializado?'] || '').toLowerCase();
          if (matString === 'si' || matString === 'sí') {
            const nuevoIncidente = {
              id: nuevosIncidentes.length ? Math.max(...nuevosIncidentes.map(i => i.id)) + 1 + index : index + 1,
              idRiesgo: idRiesgoVal,
              fecha: row['Fecha'] || new Date().toISOString().split('T')[0],
              titulo: 'Materialización Reportada Riesgo #' + idRiesgoVal,
              descripcion: row['Hallazgo con EVIDENCIA OBJETIVA de Materialización'] || `Incidente sincronizado desde ${originName}`,
              costo: 0,
              impacto: 'Medio',
              reportadoPor: originName,
              estado: 'Abierto',
              historialCambios: [{ fecha: timestamp, accion: `Incidente sincronizado desde Excel` }]
            };
            nuevosIncidentes.push(nuevoIncidente);
            cIncidentes++;
          }

          const efectividad = String(row['Efectividad del Control'] || '');
          if (efectividad && efectividad.trim() !== '') {
            const esEficaz = efectividad.toLowerCase().includes('eficaz') && !efectividad.toLowerCase().includes('ineficaz');
            const esInadecuado = efectividad.toLowerCase().includes('ineficaz') || efectividad.toLowerCase().includes('parcial');
            
            if (esEficaz || esInadecuado) {
              const nuevaEval = {
                id: nuevasEvaluaciones.length ? Math.max(...nuevasEvaluaciones.map(e => e.id)) + 1 + index : index + 1,
                idRiesgo: idRiesgoVal,
                fecha: row['Fecha'] || new Date().toISOString().split('T')[0],
                diseño: esEficaz ? 'Eficaz' : 'Inadecuado',
                ejecucion: esEficaz ? 'Eficaz' : 'Inadecuado',
                calificacion: esEficaz ? 100 : (efectividad.toLowerCase().includes('parcial') ? 50 : 0),
                comentarios: `Test de control sincronizado. Efectividad registrada: ${efectividad}`,
                auditor: originName,
                historialCambios: [{ fecha: timestamp, accion: `Test sincronizado desde Excel` }]
              };
              nuevasEvaluaciones.push(nuevaEval);
              cEvaluaciones++;
            }
          }
        }
      });
    }

    if (uniqueRiesgosProcesados.size === 0 && cIncidentes === 0 && cEvaluaciones === 0) {
      showNotification("El archivo fue leído, pero no se encontraron las hojas 'MATRICES DE RIESGO' ni 'Riesgos', o estaban vacías.", "error");
      return;
    }

    setRiesgos(nuevosRiesgos);
    setIncidentes(nuevosIncidentes);
    setEvaluaciones(nuevasEvaluaciones);
    
    await saveToCloud({ riesgos: nuevosRiesgos, incidentes: nuevosIncidentes, evaluaciones: nuevasEvaluaciones });
    showNotification(`Sincronización Completa: Procesados ${uniqueRiesgosProcesados.size} riesgos únicos exactos. ${cEvaluaciones} tests y ${cIncidentes} incidentes cargados.`, 'success');
  };

  const handleDriveSync = async () => {
    if (!isAdmin) return;
    if (!xlsxLoaded || !window.XLSX) {
      showNotification("Preparando el motor de sincronización. Intente nuevamente.", "error"); return;
    }

    let urlToFetch = driveUrl;
    const userPrompt = window.prompt("Enlace a Google Sheets (Formato XLSX):", driveUrl);
    if (userPrompt === null) return;
    if (userPrompt.trim() !== '') {
      urlToFetch = userPrompt.trim();
      setDriveUrl(urlToFetch);
      await saveToCloud({ driveUrl: urlToFetch });
    } else {
      showNotification("El enlace de Drive no puede estar vacío.", "error"); return;
    }

    showNotification("Conectando con Google Drive y descargando datos...", "success");
    try {
      const response = await fetch(urlToFetch);
      if (!response.ok) throw new Error(`Error de red: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const wb = window.XLSX.read(arrayBuffer, { type: 'array' });
      await processExcelWorkbook(wb, "Google Drive Sync");
    } catch (error) {
      console.error("Error conectando a Drive:", error);
      showNotification("Error de conexión (CORS o link inválido). Asegúrate de publicar el archivo en la web como '.xlsx'.", "error");
    }
  };

  // --- SECCIÓN DE FUNCIONES DE MATRIZ Y APETITO AUTOMÁTICO ---
  const calcularMatriz5x5 = (probabilidad, impacto) => {
    const pVal = mapProbabilidadNum[probabilidad] || 3;
    const iVal = mapImpactoNum[impacto] || 2;
    const score = pVal * iVal;

    let apetito = "Dentro de Apetito";
    let accion = "Aceptar / Monitorear";
    let color = "bg-emerald-500 text-white";
    let borderSemaforo = "border-emerald-200";

    if (score <= 4) {
      color = "bg-emerald-500 text-white";
      borderSemaforo = "border-emerald-600";
    } else if (score <= 9) {
      color = "bg-yellow-400 text-slate-900";
      borderSemaforo = "border-yellow-600";
      accion = "Monitorear periódicamente";
    } else if (score <= 16) {
      color = "bg-orange-500 text-white";
      borderSemaforo = "border-orange-600";
      apetito = "Fuera de Apetito";
      accion = "Mitigar / Ajustar Controles";
    } else {
      color = "bg-red-600 text-white";
      borderSemaforo = "border-red-700";
      apetito = "Fuera de Apetito";
      accion = "Evitar / Suspender Proceso / Transferir";
    }

    return { score, apetito, accion, color, borderSemaforo };
  };

  // --- REEMPLAZO MEJORADO DE HANDLERIESGOSUBMIT CON LOGS DETALLADOS POR ATRIBUTO ---
  const handleRiesgoSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const probInh = formData.get('probInh');
    const impInh = formData.get('impInh');
    const probRes = formData.get('probRes') || probInh;
    const impRes = formData.get('impRes') || impInh;
    const timestamp = new Date().toLocaleString();

    let updatedList;
    if (editRiesgo) {
      // Identificar qué atributos específicos cambiaron para armar el log detallado
      let cambios = [];
      if (editRiesgo.proceso !== formData.get('proceso')) cambios.push('proceso');
      if (editRiesgo.categoria !== formData.get('categoria')) cambios.push('categoría');
      if (editRiesgo.responsable !== formData.get('responsable')) cambios.push('responsable');
      if (editRiesgo.descripcionControl !== formData.get('control')) cambios.push('control clave');
      if (editRiesgo.descripcion !== formData.get('descripcion')) cambios.push('descripción del riesgo');
      if (editRiesgo.probabilidadInherente !== probInh || editRiesgo.impactoInherente !== impInh) cambios.push('riesgo inherente');
      if (editRiesgo.probabilidadResidual !== probRes || editRiesgo.impactoResidual !== impRes) cambios.push('riesgo residual');

      const detalleLog = cambios.length > 0 ? `Modificación en: ${cambios.join(', ')}` : 'Registro actualizado sin cambios en atributos';

      const modificado = {
        ...editRiesgo,
        proceso: formData.get('proceso'),
        categoria: formData.get('categoria'),
        responsable: formData.get('responsable'),
        descripcionControl: formData.get('control'),
        descripcion: formData.get('descripcion'),
        probabilidadInherente: probInh,
        impactoInherente: impInh,
        probabilidadResidual: probRes,
        impactoResidual: impRes,
        historialCambios: [...(editRiesgo.historialCambios || []), { fecha: timestamp, accion: detalleLog }]
      };
      updatedList = safeRiesgos.map(r => r.id === editRiesgo.id ? modificado : r);
      setEditRiesgo(null);
      showNotification("Riesgo actualizado correctamente.");
    } else {
      const nuevo = {
        id: safeRiesgos.length ? Math.max(...safeRiesgos.map(r => r.id)) + 1 : 1,
        proceso: formData.get('proceso'), 
        categoria: formData.get('categoria'), 
        responsable: formData.get('responsable'),
        noControl: 'C-' + Math.floor(Math.random() * 100 + 100), 
        descripcionControl: formData.get('control'),
        descripcion: formData.get('descripcion'), 
        probabilidadInherente: probInh, 
        impactoInherente: impInh,
        probabilidadResidual: probRes, 
        impactoResidual: impRes,
        historialCambios: [{ fecha: timestamp, accion: 'Riesgo e indicadores iniciales creados en la matriz' }]
      };
      updatedList = [...safeRiesgos, nuevo];
      showNotification("Riesgo guardado.");
    }
    
    setRiesgos(updatedList);
    await saveToCloud({ riesgos: updatedList });
    e.target.reset();
  };

  const handleEvaluacionSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const idRiesgo = parseInt(formData.get('idRiesgo'));
    const diseno = formData.get('diseno');
    const ejecucion = formData.get('ejecucion');
    const calif = (diseno === 'Eficaz' && ejecucion === 'Eficaz') ? 100 : 0;
    const timestamp = new Date().toLocaleString();

    let updatedList;
    if (editEvaluacion) {
      const modificada = {
        ...editEvaluacion,
        idRiesgo, diseño: diseno, ejecucion, calificacion: calif,
        comentarios: formData.get('comentarios'),
        historialCambios: [...(editEvaluacion.historialCambios || []), { fecha: timestamp, accion: 'Evaluación modificada por Auditor' }]
      };
      updatedList = safeEvaluaciones.map(ev => ev.id === editEvaluacion.id ? modificada : ev);
      setEditEvaluacion(null);
      showNotification("Evaluación actualizada.");
    } else {
      const nuevaEval = {
        id: safeEvaluaciones.length ? Math.max(...safeEvaluaciones.map(ev => ev.id)) + 1 : 1,
        idRiesgo, fecha: new Date().toISOString().split('T')[0],
        diseño: diseno, ejecucion, calificacion: calif,
        comentarios: formData.get('comentarios'), auditor: user.email,
        historialCambios: [{ fecha: timestamp, accion: 'Test de auditoría generado' }]
      };
      updatedList = [...safeEvaluaciones, nuevaEval];
      showNotification("Evaluación guardada.");
    }

    const nuevosRiesgos = safeRiesgos.map(r => {
      if (r.id === idRiesgo) {
        let nuevaProb = (calif === 100) ? 'Rara' : r.probabilidadInherente;
        return {
          ...r, probabilidadResidual: nuevaProb,
          historialCambios: [...(r.historialCambios||[]), { fecha: timestamp, accion: `Test arrojó efectividad del ${calif}%. Riesgo residual e indicadores de apetito recalculados.` }]
        };
      }
      return r;
    });

    setEvaluaciones(updatedList);
    setRiesgos(nuevosRiesgos);
    await saveToCloud({ evaluaciones: updatedList, riesgos: nuevosRiesgos });
    e.target.reset();
  };

  const handleHallazgoSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const idRiesgo = formData.get('idRiesgo');
    const timestamp = new Date().toLocaleString();

    let updatedList;
    if (editHallazgo) {
      const modificado = {
        ...editHallazgo,
        ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'),
        titulo: formData.get('titulo'), severidad: formData.get('severidad'), idRiesgo: idRiesgo ? parseInt(idRiesgo) : null,
        historialCambios: [...(editHallazgo.historialCambios || []), { fecha: timestamp, accion: 'Hallazgo editado por Auditor' }]
      };
      updatedList = safeHallazgos.map(h => h.id === editHallazgo.id ? modificado : h);
      setEditHallazgo(null);
      showNotification("Hallazgo actualizado.");
    } else {
      const nuevo = {
        id: safeHallazgos.length ? Math.max(...safeHallazgos.map(h => h.id)) + 1 : 1,
        ref: formData.get('ref'), proceso: formData.get('proceso'), responsable: formData.get('responsable'),
        titulo: formData.get('titulo'), severidad: formData.get('severidad'), idRiesgo: idRiesgo ? parseInt(idRiesgo) : null,
        estado: 'Abierto', fecha: new Date().toISOString().split('T')[0],
        historialCambios: [{ fecha: timestamp, accion: 'Hallazgo documentado' }]
      };
      updatedList = [...safeHallazgos, nuevo];
      showNotification("Hallazgo documentado.");
    }
    
    setHallazgos(updatedList);
    await saveToCloud({ hallazgos: updatedList });
    e.target.reset();
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.target);
    const timestamp = new Date().toLocaleString();
    
    let updatedList;
    if (editPlan) {
      const modificado = {
        ...editPlan,
        idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'),
        responsable: formData.get('responsable'), fecha: formData.get('fecha'),
        historialCambios: [...(editPlan.historialCambios || []), { fecha: timestamp, accion: 'Plan modificado' }]
      };
      updatedList = safePlanes.map(p => p.id === editPlan.id ? modificado : p);
      setEditPlan(null);
      showNotification("Plan actualizado.");
    } else {
      const nuevo = {
        id: safePlanes.length ? Math.max(...safePlanes.map(p => p.id)) + 1 : 1,
        idHallazgo: parseInt(formData.get('idHallazgo')), accion: formData.get('accion'),
        responsable: formData.get('responsable'), fecha: formData.get('fecha'), estado: 'En Proceso',
        historialCambios: [{ fecha: timestamp, accion: 'Plan asignado' }]
      };
      updatedList = [...safePlanes, nuevo];
      showNotification("Plan asignado exitosamente.");
    }

    setPlanes(updatedList);
    await saveToCloud({ planes: updatedList });
    e.target.reset();
  };

  const handleIncidenteSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const idRiesgo = parseInt(formData.get('idRiesgo'));
    const costo = parseFloat(formData.get('costo') || 0);
    const titulo = formData.get('titulo');
    const timestamp = new Date().toLocaleString();

    let updatedList;
    if (editIncidente) {
      const modificado = {
        ...editIncidente,
        idRiesgo, titulo, descripcion: formData.get('descripcion'), costo, impacto: formData.get('impacto'),
        historialCambios: [...(editIncidente.historialCambios || []), { fecha: timestamp, accion: 'Incidente modificado' }]
      };
      updatedList = safeIncidentes.map(i => i.id === editIncidente.id ? modificado : i);
      setEditIncidente(null);
      showNotification("Incidente actualizado.");
    } else {
      const nuevo = {
        id: safeIncidentes.length ? Math.max(...safeIncidentes.map(i => i.id)) + 1 : 1,
        idRiesgo, fecha: new Date().toISOString().split('T')[0], titulo, descripcion: formData.get('descripcion'),
        costo, impacto: formData.get('impacto'), reportadoPor: user.email, estado: 'Abierto',
        historialCambios: [{ fecha: timestamp, accion: 'Incidente reportado' }]
      };
      updatedList = [...safeIncidentes, nuevo];
      showNotification("Incidente reportado. Dashboard actualizado.");
    }

    const nuevosRiesgos = safeRiesgos.map(r => r.id === idRiesgo ? {
      ...r,
      historialCambios: [...(r.historialCambios||[]), { fecha: timestamp, accion: editIncidente ? `Incidente ID #${editIncidente.id} fue editado` : `Incidente reportado: "${titulo}" (Pérdida est: $${costo})` }]
    } : r);

    setIncidentes(updatedList);
    setRiesgos(nuevosRiesgos);
    await saveToCloud({ incidentes: updatedList, riesgos: nuevosRiesgos });
    e.target.reset();
  };

  // --- FUNCIONES ELIMINAR ---
  const handleDeleteItem = async (listType, id) => {
    if (!isAdmin) return;
    if (!window.confirm('¿Seguro que desea eliminar este registro permanentemente?')) return;
    
    let updated;
    if (listType === 'riesgos') { updated = safeRiesgos.filter(r => r.id !== id); setRiesgos(updated); }
    if (listType === 'evaluaciones') { updated = safeEvaluaciones.filter(e => e.id !== id); setEvaluaciones(updated); }
    if (listType === 'hallazgos') { updated = safeHallazgos.filter(h => h.id !== id); setHallazgos(updated); }
    if (listType === 'planes') { updated = safePlanes.filter(p => p.id !== id); setPlanes(updated); }
    if (listType === 'incidentes') { updated = safeIncidentes.filter(i => i.id !== id); setIncidentes(updated); }
    
    await saveToCloud({ [listType]: updated });
    showNotification("Registro eliminado.", "error");
  };

  const handleCerrarIncidente = async (id) => {
    if (!isAdmin) return;
    const updated = safeIncidentes.map(i => i.id === id ? { ...i, estado: 'Cerrado', historialCambios: [...(i.historialCambios||[]), {fecha: new Date().toLocaleString(), accion: 'Incidente mitigado y cerrado'}] } : i);
    setIncidentes(updated);
    await saveToCloud({ incidentes: updated });
    showNotification("Incidente cerrado.");
  };

  const handleCerrarPlan = async (id) => {
    if (!isAdmin) return;
    const updated = safePlanes.map(p => p.id === id ? { ...p, estado: 'Cerrado', historialCambios: [...(p.historialCambios||[]), {fecha: new Date().toLocaleString(), accion: 'Plan marcado como finalizado/cerrado'}] } : p);
    setPlanes(updated);
    await saveToCloud({ planes: updated });
    showNotification("Plan finalizado.");
  };

  // ==================== RENDERS DE VISTAS ====================

  // --- 1. REEMPLAZO MEJORADO DEL TABLERO ANALÍTICO CON TUS NUEVOS NOMBRES ---
  const renderTablero = () => {
    const anioActual = filtroAnio;
    const hFiltrados = safeHallazgos.filter(h => anioActual === 'Todos' || getYearFromDate(h.fecha) === anioActual);
    const pFiltrados = safePlanes.filter(p => anioActual === 'Todos' || getYearFromDate(p.fecha) === anioActual);

    const añosSet = new Set();
    safeHallazgos.forEach(h => { if(h.fecha) añosSet.add(getYearFromDate(h.fecha)); });
    safePlanes.forEach(p => { if(p.fecha) añosSet.add(getYearFromDate(p.fecha)); });
    const availableYears = Array.from(añosSet).sort().reverse();

    const hTotal = hFiltrados.length;
    const hAbiertos = hFiltrados.filter(h => h.estado === 'Abierto').length;
    const hCerrados = hFiltrados.filter(h => h.estado === 'Cerrado').length;

    const critCount = { 'Crítico': 0, 'Alto': 0, 'Medio': 0, 'Bajo': 0 };
    hFiltrados.forEach(h => { critCount[h.severidad] = (critCount[h.severidad] || 0) + 1; });

    const hProcCount = {};
    hFiltrados.forEach(h => { hProcCount[h.proceso] = (hProcCount[h.proceso] || 0) + 1; });

    const pTotal = pFiltrados.length;
    const pAbiertos = pFiltrados.filter(p => p.estado !== 'Cerrado').length;
    const pCerrados = pFiltrados.filter(p => p.estado === 'Cerrado').length;

    const pAbiertosProcCount = {};
    pFiltrados.filter(p => p.estado !== 'Cerrado').forEach(p => {
      const hallazgoPadre = safeHallazgos.find(h => h.id === p.idHallazgo);
      const proceso = hallazgoPadre ? hallazgoPadre.proceso : 'Otros';
      pAbiertosProcCount[proceso] = (pAbiertosProcCount[proceso] || 0) + 1;
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tablero Analítico de Auditoría</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Análisis integral de desviaciones y compromisos operacionales.</p>
          </div>
          <div className="mt-4 md:mt-0 bg-white p-1 rounded-xl border flex items-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-3 pr-2">Filtro de Año:</span>
            <select value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} className="bg-slate-50 border rounded-lg text-xs font-bold text-slate-700 px-3 py-1.5 focus:outline-none">
              <option value="Todos">Histórico Global</option>
              {availableYears.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Métricas de Hallazgos</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">📄</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Total Hallazgos</p><p className="text-3xl font-black mt-1 text-slate-800">{hTotal}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-red-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xl">⚠️</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Hallazgos Abiertos</p><p className="text-3xl font-black mt-1 text-red-600">{hAbiertos}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-emerald-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl">✅</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Hallazgos Cerrados</p><p className="text-3xl font-black mt-1 text-emerald-600">{hCerrados}</p></div></div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 mt-8">Métricas de Planes de Acción</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">🤝</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Planes de Acción Totales</p><p className="text-3xl font-black mt-1 text-slate-800">{pTotal}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-amber-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-xl">⏳</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Planes de Acción Pendientes</p><p className="text-3xl font-black mt-1 text-amber-600">{pAbiertos}</p></div></div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-r-4 border-emerald-500 flex items-center justify-between"><div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl">✅</div><div className="text-right"><p className="text-[10px] uppercase text-slate-500 font-extrabold tracking-widest">Planes de Acción Cerrados</p><p className="text-3xl font-black mt-1 text-emerald-600">{pCerrados}</p></div></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <h4 className="text-xs font-bold text-slate-880 uppercase tracking-wider mb-4 border-b pb-2">Hallazgos por Criticidad</h4>
            <div className="space-y-4 flex-1 justify-center flex flex-col">
              {['Crítico', 'Alto', 'Medio', 'Bajo'].map(crit => {
                const count = critCount[crit] || 0;
                const pct = hTotal > 0 ? Math.round((count / hTotal) * 100) : 0;
                let bgClass = 'bg-emerald-500';
                if(crit === 'Crítico') bgClass = 'bg-rose-600';
                if(crit === 'Alto') bgClass = 'bg-orange-500';
                if(crit === 'Medio') bgClass = 'bg-amber-400';
                return (
                  <div key={crit}>
                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1 uppercase"><span>{crit}</span><span>{count} ({pct}%)</span></div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${bgClass} transition-all duration-1000`} style={{ width: `${pct}%` }}></div></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Hallazgos por Proceso</h4>
            <div className="space-y-4 overflow-y-auto max-h-48 pr-2">
              {Object.keys(hProcCount).length === 0 ? <p className="text-xs text-slate-400 italic text-center">No hay datos</p> : 
                Object.keys(hProcCount).sort((a,b) => hProcCount[b] - hProcCount[a]).map(proc => {
                  const count = hProcCount[proc];
                  const pct = hTotal > 0 ? Math.round((count / hTotal) * 100) : 0;
                  return (
                    <div key={proc}>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1"><span className="truncate max-w-[150px]">{proc}</span><span>{count} hallazgos</span></div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-indigo-500 transition-all duration-1000" style={{ width: `${pct}%` }}></div></div>
                    </div>
                  );
                })
              }
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Planes Abiertos por Proceso</h4>
            <div className="space-y-4 overflow-y-auto max-h-48 pr-2">
              {Object.keys(pAbiertosProcCount).length === 0 ? <p className="text-xs text-slate-400 italic text-center">No hay planes en proceso</p> : 
                Object.keys(pAbiertosProcCount).sort((a,b) => pAbiertosProcCount[b] - pAbiertosProcCount[a]).map(proc => {
                  const count = pAbiertosProcCount[proc];
                  const pct = pAbiertos > 0 ? Math.round((count / pAbiertos) * 100) : 0;
                  return (
                    <div key={proc}>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1"><span className="truncate max-w-[150px]">{proc}</span><span className="text-amber-600">{count} pendientes</span></div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-amber-400 transition-all duration-1000" style={{ width: `${pct}%` }}></div></div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboardRiesgos = () => {
    const total = safeRiesgos.length;
    const esRes = tipoMatriz === 'residual';

    const totalRiesgos = safeRiesgos.length;
    const riesgosCriticos = safeRiesgos.filter(r => {
      const { score } = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
      return score > 16;
    }).length;
    const riesgosFueraApetito = safeRiesgos.filter(r => {
      const { apetito } = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
      return apetito === "Fuera de Apetito";
    }).length;
    const totalPerdidas = safeIncidentes.reduce((acc, i) => acc + (i.costo || 0), 0);

    const calcularScorePromedio = (esResid) => {
      if (total === 0) return 0;
      const sum = safeRiesgos.reduce((acc, r) => {
        const imp = esResid ? r.impactoResidual : r.impactoInherente;
        const prob = esResid ? r.probabilidadResidual : r.probabilidadInherente;
        return acc + (mapImpactoNum[imp] || 1) * (mapProbabilidadNum[prob] || 1);
      }, 0);
      return (sum / total).toFixed(1);
    };

    const scoreInherente = parseFloat(calcularScorePromedio(false));
    const scoreResidual = parseFloat(calcularScorePromedio(true));
    const impactos = ['Crítico', 'Alto', 'Medio', 'Bajo'];
    const probabilidades = ['Rara', 'Posible', 'Frecuente'];

    const contarCelda = (imp, prob) => safeRiesgos.filter(r => (esRes ? r.impactoResidual : r.impactoInherente) === imp && (esRes ? r.probabilidadResidual : r.probabilidadInherente) === prob).length;

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Intelligence Dashboard GRC</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Análisis de Apetito y Tratamientos según ISO 31000.</p>
          </div>
          <div className="mt-4 md:mt-0 bg-white p-1 rounded-xl border flex items-center shadow-sm">
            <button onClick={() => setTipoMatriz('inherente')} className={`px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${!esRes ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Inherente</button>
            <button onClick={() => setTipoMatriz('residual')} className={`px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${esRes ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>Residual</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
            <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Total Riesgos</p>
            <p className="text-3xl font-black mt-2 text-slate-800">{totalRiesgos}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-red-600">
            <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Fuera de Apetito</p>
            <p className="text-3xl font-black mt-2 text-red-600 flex items-center space-x-2">
              <span>{riesgosFueraApetito}</span>
              {riesgosFueraApetito > 0 && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-black animate-pulse">ALERTA</span>}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-orange-500">
            <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Riesgos Críticos</p>
            <p className="text-3xl font-black mt-2 text-orange-600">{riesgosCriticos}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-purple-600">
            <p className="text-slate-500 text-[10px] font-extrabold uppercase tracking-widest">Pérdidas Totales</p>
            <p className="text-2xl font-black mt-2 text-purple-700">${totalPerdidas.toLocaleString('es-CO')}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-6 flex items-center space-x-2">
            <span>🎚️ Mapa de Calor Empresarial</span><span className="px-2.5 py-0.5 text-[8px] rounded-full text-white font-extrabold bg-slate-800 uppercase tracking-widest font-mono">{tipoMatriz}</span>
          </h3>
          <div className="flex items-center justify-center">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 w-full max-w-2xl relative pb-6">
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-bold text-slate-400 uppercase tracking-widest">Impacto</div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">Probabilidad</div>
              <div></div>
              {probabilidades.map(p => <div key={p} className="text-center py-2 text-slate-600 font-bold uppercase text-[9px] bg-slate-50 rounded-t-lg border-b border-slate-200">{p}</div>)}
              {impactos.map(imp => (
                <React.Fragment key={imp}>
                  <div className="flex items-center justify-end pr-3 py-4 text-slate-600 font-bold uppercase text-[9px] bg-slate-50 rounded-l-lg text-right">{imp}</div>
                  {probabilidades.map(prob => {
                    const count = contarCelda(imp, prob);
                    const { score, color } = calcularMatriz5x5(prob, imp);
                    return (
                      <div key={prob} className={`relative border p-4 flex flex-col justify-center items-center h-20 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow cursor-pointer ${color} bg-opacity-20`}>
                        <span className="absolute top-1 right-2 text-[8px] font-mono font-bold opacity-60 text-slate-700">S:{score}</span>
                        <span className={`text-2xl font-black ${count > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{count}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRiesgos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Estructura de Riesgos</h2>
      </div>
      {!isAdmin ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs font-semibold">ℹ️ Cuenta en Modo "Solo Lectura". Requiere rol de Auditor.</div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{editRiesgo ? `✏️ Editando Riesgo #${editRiesgo.id}` : '➕ Registrar Nuevo Riesgo'}</h3>
          <form key={editRiesgo ? editRiesgo.id : 'new'} onSubmit={handleRiesgoSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div><label className="font-bold text-gray-600">Proceso</label><input name="proceso" defaultValue={editRiesgo?.proceso||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none focus:border-blue-500" /></div>
            <div><label className="font-bold text-gray-600">Categoría</label><select name="categoria" defaultValue={editRiesgo?.categoria||'Operativo'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option>Operativo</option><option>Estratégico</option><option>Tecnológico</option></select></div>
            <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editRiesgo?.responsable||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none focus:border-blue-500" /></div>
            <div><label className="font-bold text-gray-600">Control Clave</label><input name="control" defaultValue={editRiesgo?.descripcionControl||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none focus:border-blue-500" /></div>
            <div className="md:col-span-4"><label className="font-bold text-gray-600">Descripción Evento</label><input name="descripcion" defaultValue={editRiesgo?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none focus:border-blue-500" /></div>
            
            <div><label className="font-bold text-gray-600">Prob. Inherente</label><select name="probInh" defaultValue={editRiesgo?.probabilidadInherente||'Posible'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option value="Rara">Rara</option><option value="Posible">Posible</option><option value="Frecuente">Frecuente</option></select></div>
            <div><label className="font-bold text-gray-600">Imp. Inherente</label><select name="impInh" defaultValue={editRiesgo?.impactoInherente||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option value="Bajo">Bajo</option><option value="Medio">Medio</option><option value="Alto">Alto</option><option value="Crítico">Crítico</option></select></div>
            <div><label className="font-bold text-gray-600">Prob. Residual</label><select name="probRes" defaultValue={editRiesgo?.probabilidadResidual||'Posible'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option value="Rara">Rara</option><option value="Posible">Posible</option><option value="Frecuente">Frecuente</option></select></div>
            <div><label className="font-bold text-gray-600">Imp. Residual</label><select name="impRes" defaultValue={editRiesgo?.impactoResidual||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option value="Bajo">Bajo</option><option value="Medio">Medio</option><option value="Alto">Alto</option><option value="Crítico">Crítico</option></select></div>
            
            <div className="md:col-span-4 flex justify-end space-x-2">
              {editRiesgo && <button type="button" onClick={()=>setEditRiesgo(null)} className="bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs shadow">Cancelar</button>}
              <button type="submit" className={`${editRiesgo ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold px-6 py-2 rounded-lg text-xs shadow-md`}>{editRiesgo ? 'Actualizar Cambios' : 'Guardar y Calcular'}</button>
            </div>
          </form>
        </div>
      )}

      {/* 4. REEMPLAZO MEJORADO DE LA TABLA DE RIESGOS TOTALMENTE DESPLEGADA */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between"><h4 className="text-xs font-bold text-slate-700 uppercase">Matriz de Riesgos</h4><span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono font-bold">{safeRiesgos.length} Registros</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y"><thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">Número de Riesgo</th><th className="p-3">Proceso</th><th className="p-3">Descripción</th><th className="p-3">Responsable</th><th className="p-3">Control</th><th className="p-3 text-center">Riesgo Inherente</th><th className="p-3 text-center">Riesgo Residual</th><th className="p-3">Apetito</th><th className="p-3">Acción Recomendada</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {safeRiesgos.map(r => {
                const inh = calcularMatriz5x5(r.probabilidadInherente, r.impactoInherente);
                const res = calcularMatriz5x5(r.probabilidadResidual, r.impactoResidual);
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-500">#{r.id}</td>
                    <td className="p-3 font-bold">{r.proceso}<br/><span className="text-[9px] font-bold tracking-wider text-indigo-500 uppercase font-mono">{r.categoria}</span></td>
                    <td className="p-3 whitespace-normal break-words font-medium text-slate-800">{r.descripcion}</td>
                    <td className="p-3 font-medium text-slate-600 whitespace-nowrap">{r.responsable || 'No Asignado'}</td>
                    <td className="p-3 whitespace-normal break-words text-slate-600 italic">⚙️ {r.descripcionControl || 'Ninguno'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-500">{inh.score} pts ({r.probabilidadInherente}/{r.impactoInherente})</td>
                    <td className="p-3 text-center font-mono font-black text-slate-800">{res.score} pts ({r.probabilidadResidual}/{r.impactoResidual})</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${res.apetito === "Dentro de Apetito" ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800 animate-pulse'}`}>
                        {res.apetito}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] block text-center font-black shadow-sm border ${res.color} ${res.borderSemaforo}`}>
                        {res.accion}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap space-x-1">
                      <button onClick={() => setViewHistory({tipo: 'Riesgo', item: r})} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1 rounded text-[10px]">⏱️ Historial</button>
                      {isAdmin && (
                        <>
                          <button onClick={() => {setEditRiesgo(r); scrollToTop();}} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️ Editar</button>
                          <button onClick={() => handleDeleteItem('riesgos', r.id)} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderEvaluaciones = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">Auditoría de Controles</h2></div>
      {!isAdmin ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs font-semibold">ℹ️ Módulo exclusivo para Auditores.</div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{editEvaluacion ? `✏️ Editando Test #${editEvaluacion.id}` : '➕ Nuevo Test de Control'}</h3>
          <form key={editEvaluacion ? editEvaluacion.id : 'new'} onSubmit={handleEvaluacionSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div><label className="font-bold text-gray-600">Riesgo / Control</label><select name="idRiesgo" defaultValue={editEvaluacion?.idRiesgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none">{safeRiesgos.map(r => <option key={r.id} value={r.id}>[{r.noControl}] {r.proceso}</option>)}</select></div>
            <div><label className="font-bold text-gray-600">Diseño</label><select name="diseno" defaultValue={editEvaluacion?.diseño||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div><label className="font-bold text-gray-600">Ejecución</label><select name="ejecucion" defaultValue={editEvaluacion?.ejecucion||'Eficaz'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option>Eficaz</option><option>Inadecuado</option></select></div>
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Evidencias</label><textarea name="comentarios" defaultValue={editEvaluacion?.comentarios||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none focus:border-blue-500" rows="2"></textarea></div>
            <div className="md:col-span-3 flex justify-end space-x-2">
              {editEvaluacion && <button type="button" onClick={()=>setEditEvaluacion(null)} className="bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs shadow">Cancelar</button>}
              <button type="submit" className={`${editEvaluacion ? 'bg-amber-500' : 'bg-indigo-600'} text-white font-bold px-6 py-2 rounded-lg text-xs shadow-md`}>{editEvaluacion ? 'Actualizar' : 'Firmar e Inyectar'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between"><h4 className="text-xs font-bold text-slate-700 uppercase">Historial</h4><span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono font-bold">{safeEvaluaciones.length} Tests</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y"><thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID Test</th><th className="p-3">Fecha</th><th className="p-3">Diseño/Operación</th><th className="p-3">Eficacia</th><th className="p-3">Comentarios</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {safeEvaluaciones.map(ev => (
                <tr key={ev.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-400">#TEST-{ev.id}</td><td className="p-3">{ev.fecha}</td><td className="p-3">D: {ev.diseño} <br/><span className="text-[10px] text-slate-500">E: {ev.ejecucion}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded font-black text-[10px] ${ev.calificacion === 100 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ev.calificacion}%</span></td><td className="p-3">{ev.comentarios}</td>
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => setViewHistory({tipo: 'Auditoría', item: ev})} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1 rounded text-[10px]">⏱️</button>
                    {isAdmin && (
                      <>
                        <button onClick={() => {setEditEvaluacion(ev); scrollToTop();}} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️</button>
                        <button onClick={() => handleDeleteItem('evaluaciones', ev.id)} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderHallazgos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">Hallazgos y Desviaciones</h2></div>
      {!isAdmin ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs font-semibold">ℹ️ Solo lectura.</div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{editHallazgo ? `✏️ Editando Hallazgo #${editHallazgo.id}` : '➕ Documentar Desviación'}</h3>
          <form key={editHallazgo ? editHallazgo.id : 'new'} onSubmit={handleHallazgoSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div><label className="font-bold text-gray-600">Referencia</label><input name="ref" defaultValue={editHallazgo?.ref||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div><label className="font-bold text-gray-600">Proceso</label><input name="proceso" defaultValue={editHallazgo?.proceso||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editHallazgo?.responsable||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div className="md:col-span-2"><label className="font-bold text-gray-600">Título</label><input name="titulo" defaultValue={editHallazgo?.titulo||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div><label className="font-bold text-gray-600">Severidad</label><select name="severidad" defaultValue={editHallazgo?.severidad||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Vincular Riesgo</label><select name="idRiesgo" defaultValue={editHallazgo?.idRiesgo||''} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option value="">-- Sin vincular --</option>{safeRiesgos.map(r => <option key={r.id} value={r.id}>[ID: {r.id}] {r.proceso}</option>)}</select></div>
            <div className="md:col-span-3 flex justify-end space-x-2">
              {editHallazgo && <button type="button" onClick={()=>setEditHallazgo(null)} className="bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs shadow">Cancelar</button>}
              <button type="submit" className={`${editHallazgo ? 'bg-amber-500' : 'bg-red-600'} text-white font-bold px-6 py-2 rounded-lg text-xs shadow-md`}>{editHallazgo ? 'Actualizar' : 'Guardar Hallazgo'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between"><h4 className="text-xs font-bold text-slate-700 uppercase">Historial</h4><span className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono font-bold">{safeHallazgos.length} Hallazgos</span></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y"><thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3">Ref</th><th className="p-3">Proceso</th><th className="p-3">Título</th><th className="p-3">Estado</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {safeHallazgos.map(h => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-400">#HAL-{h.id}</td><td className="p-3 font-mono">{h.ref}</td><td className="p-3 font-bold">{h.proceso}</td><td className="p-3">{h.titulo}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded font-black text-[10px] uppercase bg-slate-100">{h.estado}</span></td>
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => setViewHistory({tipo: 'Hallazgo', item: h})} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1 rounded text-[10px]">⏱️</button>
                    {isAdmin && (
                      <>
                        <button onClick={() => {setEditHallazgo(h); scrollToTop();}} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️</button>
                        <button onClick={() => handleDeleteItem('hallazgos', h.id)} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPlanes = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">Planes de Acción</h2></div>
      {!isAdmin ? (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs font-semibold">ℹ️ Solo lectura.</div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{editPlan ? `✏️ Editando Plan #${editPlan.id}` : '➕ Asignar Plan'}</h3>
          <form key={editPlan ? editPlan.id : 'new'} onSubmit={handlePlanSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Hallazgo Vinculado</label><select name="idHallazgo" defaultValue={editPlan?.idHallazgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option value="">-- Seleccione --</option>{safeHallazgos.filter(h=>h.estado!=='Cerrado' || editPlan?.idHallazgo===h.id).map(h => <option key={h.id} value={h.id}>[#HAL-{h.id}] {h.titulo}</option>)}</select></div>
            <div className="md:col-span-3"><label className="font-bold text-gray-600">Acción</label><input name="accion" defaultValue={editPlan?.accion||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div><label className="font-bold text-gray-600">Responsable</label><input name="responsable" defaultValue={editPlan?.responsable||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div><label className="font-bold text-gray-600">Compromiso</label><input name="fecha" type="date" defaultValue={editPlan?.fecha||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
            <div className="md:col-span-3 flex justify-end space-x-2">
              {editPlan && <button type="button" onClick={()=>setEditPlan(null)} className="bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs shadow">Cancelar</button>}
              <button type="submit" className={`${editPlan ? 'bg-amber-500' : 'bg-slate-800'} text-white font-bold px-6 py-2 rounded-lg text-xs shadow-md`}>{editPlan ? 'Actualizar' : 'Guardar Plan'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between"><h4 className="text-xs font-bold text-slate-700 uppercase">Historial</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y"><thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3">Hallazgo</th><th className="p-3">Acción</th><th className="p-3">Compromiso</th><th className="p-3">Estado</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {safePlanes.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-400">#PLAN-{p.id}</td><td className="p-3 text-red-600">#HAL-{p.idHallazgo}</td><td className="p-3 font-bold">{p.accion}</td><td className="p-3 font-mono">{p.fecha}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${p.estado === 'Cerrado' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.estado}</span></td>
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => setViewHistory({tipo: 'Plan de Acción', item: p})} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1 rounded text-[10px]">⏱️</button>
                    {isAdmin && (
                      <>
                        <button onClick={() => handleCerrarPlan(p.id)} className="bg-green-100 hover:bg-green-200 text-green-800 font-bold px-2 py-1 rounded text-[10px]">✅</button>
                        <button onClick={() => {setEditPlan(p); scrollToTop();}} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️</button>
                        <button onClick={() => handleDeleteItem('planes', p.id)} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderIncidentes = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">🚨 Eventos de Pérdida (Incidentes)</h2></div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{editIncidente ? `✏️ Editando Incidente #${editIncidente.id}` : '➕ Reportar Evento'}</h3>
        <form key={editIncidente ? editIncidente.id : 'new'} onSubmit={handleIncidenteSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div><label className="font-bold text-gray-600">Riesgo Vinculado</label><select name="idRiesgo" defaultValue={editIncidente?.idRiesgo||''} required className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none">{safeRiesgos.map(r => <option key={r.id} value={r.id}>[ID: {r.id}] {r.proceso}</option>)}</select></div>
          <div><label className="font-bold text-gray-600">Título</label><input name="titulo" defaultValue={editIncidente?.titulo||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
          <div><label className="font-bold text-gray-600">Pérdida Estimada (COP)</label><input name="costo" defaultValue={editIncidente?.costo||''} type="number" required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" /></div>
          <div className="md:col-span-2"><label className="font-bold text-gray-600">Descripción</label><textarea name="descripcion" defaultValue={editIncidente?.descripcion||''} required className="w-full border rounded-lg p-2 mt-1 focus:outline-none" rows="2"></textarea></div>
          <div><label className="font-bold text-gray-600">Impacto</label><select name="impacto" defaultValue={editIncidente?.impacto||'Medio'} className="w-full border rounded-lg p-2 mt-1 bg-white focus:outline-none"><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></div>
          <div className="md:col-span-3 flex justify-end space-x-2">
            {editIncidente && <button type="button" onClick={()=>setEditIncidente(null)} className="bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs shadow">Cancelar</button>}
            <button type="submit" className={`${editIncidente ? 'bg-amber-500' : 'bg-red-600'} text-white font-bold px-6 py-2 rounded-lg text-xs shadow-md`}>{editIncidente ? 'Actualizar' : 'Emitir Alerta'}</button>
          </div>
        </form>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between"><h4 className="text-xs font-bold text-slate-700 uppercase">Historial</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y"><thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">ID</th><th className="p-3">Título</th><th className="p-3">Costo</th><th className="p-3">Estado</th><th className="p-3 text-center">Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {safeIncidentes.map(i => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono font-bold text-slate-400">#INC-{i.id}</td><td className="p-3 font-bold">{i.titulo}</td><td className="p-3 text-red-600 font-mono">${(i.costo||0).toLocaleString('es-CO')}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${i.estado === 'Cerrado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{i.estado}</span></td>
                  <td className="p-3 text-center whitespace-nowrap space-x-1">
                    <button onClick={() => setViewHistory({tipo: 'Incidente', item: i})} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2 py-1 rounded text-[10px]">⏱️</button>
                    {isAdmin && (
                      <>
                        {i.estado === 'Abierto' && <button onClick={() => handleCerrarIncidente(i.id)} className="bg-green-100 hover:bg-green-200 text-green-800 font-bold px-2 py-1 rounded text-[10px]">✅</button>}
                        <button onClick={() => {setEditIncidente(i); scrollToTop();}} className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">✏️</button>
                        <button onClick={() => handleDeleteItem('incidentes', i.id)} className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2 py-1 rounded text-[10px]">🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInforme = () => {
    let logs = [];
    safeRiesgos.forEach(r => { (r.historialCambios||[]).forEach(h => logs.push({...h, tipo: 'Riesgo', id: r.id})); });
    safeHallazgos.forEach(h => { (h.historialCambios||[]).forEach(x => logs.push({...x, tipo: 'Hallazgo', id: h.id})); });
    logs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="border-b pb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">📜 Trawabilidad</h2></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y"><thead className="bg-slate-900 text-white font-bold"><tr><th className="p-3">Fecha</th><th className="p-3">Módulo</th><th className="p-3">Acción</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? <tr><td colSpan="3" className="p-4 text-center text-slate-400 italic">No hay logs.</td></tr> : logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50"><td className="p-3 font-mono text-slate-500">{log.fecha}</td><td className="p-3"><span className="px-2 py-0.5 rounded font-black text-[9px] uppercase bg-slate-100">{log.tipo} #{log.id}</span></td><td className="p-3 font-semibold">{log.accion}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER DEL MODAL DE HISTORIAL ---
  const renderHistoryModal = () => {
    if (!viewHistory) return null;
    const { tipo, item } = viewHistory;
    const historial = item.historialCambios || [];

    return (
      <div className="fixed inset-0 bg-slate-900/60 z-[100] flex justify-center items-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
          <div className="p-5 border-b flex justify-between items-center bg-slate-50">
            <h3 className="font-black text-slate-800">⏱️ Historial: {tipo} #{item.id}</h3>
            <button onClick={() => setViewHistory(null)} className="text-slate-400 hover:text-slate-700 font-black text-xl">&times;</button>
          </div>
          <div className="p-5 overflow-y-auto flex-1 space-y-3">
            {historial.length > 0 ? (
              historial.slice().reverse().map((h, i) => (
                <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
                  <div className="font-mono text-[10px] text-indigo-600 font-bold mb-1">{h.fecha}</div>
                  <div className="text-slate-700 font-medium">{h.accion}</div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic text-center p-4">No hay historial registrado para este ítem.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER DE LOGIN ---
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-2xl">
          <div className="text-center">
            <span className="text-5xl block animate-bounce">🛡️</span><h2 className="mt-4 text-3xl font-extrabold text-slate-900 tracking-tight">GCM Auditor v5</h2><p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Termales GRC Platform</p>
          </div>
          <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
            {authError && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-medium animate-shake">⚠️ {authError}</div>}
            <div className="space-y-3">
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Correo</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="tu_correo@termales.com.co" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none mt-1"/></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase">Contraseña</label><input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none mt-1"/></div>
            </div>
            <button type="submit" className="w-full flex justify-center rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-md">{isRegistering ? 'Crear Cuenta' : 'Ingresar al Portal'}</button>
          </form>
          <div className="text-center pt-2 border-t"><button onClick={() => {setIsRegistering(!isRegistering); setAuthError('');}} className="text-xs font-bold text-blue-600">{isRegistering ? '¿Ya tiene cuenta? Iniciar Sesión' : '¿No tiene acceso? Regístrese aquí'}</button></div>
        </div>
      </div>
    );
  }

  // Carga
  if (!isCloudLoaded) return (<div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white flex-col space-y-4"><span className="text-6xl animate-bounce">☁️</span><h2 className="text-xl font-bold tracking-widest uppercase">Conectando...</h2></div>);

  // APP PRINCIPAL
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {notification && <div className="fixed top-4 right-4 z-50 p-4 rounded-xl bg-slate-800 text-white border border-slate-600 text-xs font-bold shadow-2xl transition-all">{notification.message}</div>}
      {renderHistoryModal()}

      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl flex-shrink-0 relative z-20">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800"><span className="text-2xl">🛡️</span><div><h1 className="text-sm font-bold tracking-wide">GCM Auditor v5</h1><p className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">{user.email}</p></div></div>
        <div className="px-6 py-2.5 bg-slate-800 border-b border-slate-800 flex justify-between items-center text-[10px]"><span className="text-slate-400 font-bold uppercase tracking-wider">Permiso:</span><span className={`px-2 py-0.5 rounded font-black uppercase tracking-wider ${isAdmin ? 'bg-amber-500 text-amber-950' : 'bg-blue-600 text-white'}`}>{isAdmin ? 'Auditor' : 'Lector'}</span></div>
        <nav className="flex-1 px-4 py-4 space-y-1 text-xs font-medium overflow-y-auto">
          {[
            { id: 'tablero', icon: '📊', label: 'Tablero Analítico' },
            { id: 'dashboard_riesgos', icon: '📈', label: 'Intelligence Dash' },
            { id: 'riesgos', icon: '⚠️', label: 'Matriz de Riesgos' },
            { id: 'evaluaciones', icon: '🔬', label: 'Audit Controles' },
            { id: 'hallazgos', icon: '📄', label: 'Hallazgos' },
            { id: 'planes', icon: '✅', label: 'Planes Acción' },
            { id: 'incidentes', icon: '🚨', label: 'Eventos Pérdida' },
            { id: 'informe', icon: '📜', label: 'Trazabilidad' }
          ].map(tab => (
            <button key={tab.id} onClick={() => {
              setActiveTab(tab.id); setEditRiesgo(null); setEditEvaluacion(null); setEditHallazgo(null); setEditPlan(null); setEditIncidente(null);
            }} className={`w-full text-left px-4 py-3 rounded-xl flex items-center space-x-2 transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 space-y-2 border-t border-slate-800">
          
          {/* BOTÓN DE SINCRONIZACIÓN (SÓLO DRIVE) */}
          {isAdmin && (
            <div className="space-y-2 mb-3">
              <button onClick={handleDriveSync} className="w-full text-[10px] bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 transition-colors font-bold flex items-center justify-center space-x-1 shadow-md">
                <span>☁️</span> <span>Sincronizar Drive</span>
              </button>
            </div>
          )}

          {isAdmin && <button onClick={handleResetData} className="w-full text-[10px] text-red-400 hover:bg-red-950 border border-red-900/50 rounded-lg py-1.5 transition-colors font-medium">⚠️ Formatear Nube</button>}
          <button onClick={handleLogout} className="w-full text-[10px] text-slate-300 hover:bg-slate-800 border border-slate-700/50 rounded-lg py-1.5 transition-colors font-bold flex items-center justify-center space-x-1"><span>🚪</span> <span>Cerrar Sesión</span></button>
        </div>
      </div>
      
      {/* VISTA CONTENIDO */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shadow-sm flex-shrink-0 relative z-10">
          <div className="flex items-center space-x-2"><span className="text-slate-400 text-xs font-bold uppercase">Sede Activa:</span><span className="bg-slate-100 text-slate-700 text-[10px] px-2.5 py-1 rounded-full font-mono font-bold">Termales de Santa Rosa</span></div>
        </header>
        <main className="flex-grow overflow-y-auto p-8 relative z-0">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'tablero' && renderTablero()}
            {activeTab === 'dashboard_riesgos' && renderDashboardRiesgos()}
            {activeTab === 'riesgos' && renderRiesgos()}
            {activeTab === 'evaluaciones' && renderEvaluaciones()}
            {activeTab === 'hallazgos' && renderHallazgos()}
            {activeTab === 'planes' && renderPlanes()}
            {activeTab === 'incidentes' && renderIncidentes()}
            {activeTab === 'informe' && renderInforme()}
          </div>
        </main>
      </div>
    </div>
  );
}
