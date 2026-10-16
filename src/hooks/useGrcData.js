// src/hooks/useGrcData.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { apiService } from '../services/apiService';
import { auth, db } from '../services/firebase';
import { 
  defaultCronograma, defaultRiesgos, defaultHallazgos, 
  defaultPlanes, defaultEvaluaciones, defaultMonitoreo 
} from '../constants/defaultData';

export function useGrcData() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Entidades principales de base de datos
  const [riesgos, setRiesgos] = useState([]);
  const [hallazgos, setHallazgos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [incidentes, setIncidentes] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cronograma, setCronograma] = useState([]);
  const [monitoreo, setMonitoreo] = useState([]);
  const [informesAuditoria, setInformesAuditoria] = useState([]);
  const [comites, setComites] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [auditoresLista, setAuditoresLista] = useState([]);
  const [fuentesMejora, setFuentesMejora] = useState([]);
  const [catalogoCargos, setCatalogoCargos] = useState([]);
  const [mapaProcesos, setMapaProcesos] = useState({});
  const [sedesEmpresa, setSedesEmpresa] = useState([]);
  const [catalogosInicializados, setCatalogosInicializados] = useState(false);

  // 1. Estado y validación de perfil/rol de usuario
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken(true);
          await apiService.login(idToken);
        } catch (err) {
          console.error("Error renovando cookie de servidor:", err);
          if ([401, 403].includes(err?.status)) {
            console.error('[AUTH] Cierre automático durante la validación inicial de la sesión.', {
              status: err.status,
              code: err.code || 'unknown',
            });
            window.alert(err?.message || 'El servidor rechazó la sesión o el acceso de esta cuenta.');
            await signOut(auth);
            return;
          }
          console.warn('Fallo temporal al renovar la cookie. Se conserva la sesión de Firebase y las peticiones volverán a intentar renovarla.');
        }

        setUser(currentUser);

        try {
          const respuesta = await apiService.checkSession();
          const datosPerfil = respuesta?.user || {};
          setPerfilUsuario({
            ...datosPerfil,
            nombreResponsable: datosPerfil.nombreResponsable || 'Usuario GRC',
            correo: datosPerfil.correo || datosPerfil.email || currentUser.email
          });
          setIsAdmin(['admin', 'administrador'].includes(String(datosPerfil.rol || '').trim().toLowerCase()));
        } catch (error) {
          console.error("Error obteniendo perfil desde el servidor:", error);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setPerfilUsuario(null);
        setIsAdmin(false);
        setShowWelcome(true);
      }
    });
    return () => unsubscribe();
  }, []);

// 2. Carga Inicial Centralizada SEGURA + Semáforo en Tiempo Real (Firestore)
  const userId = user?.uid;
  useEffect(() => {
    if (!userId) return;
    
    let isMounted = true;
    const loadingTimer = window.setTimeout(() => {
      if (isMounted) setIsCloudLoaded(false);
    }, 0);

    const llavesBasura = [
      'grc_riesgos', 'grc_hallazgos', 'grc_planes', 'grc_incidentes', 
      'grc_evaluaciones', 'grc_cronograma', 'grc_monitoreo', 'grc_informesAuditoria', 
      'grc_comites', 'grc_programas', 'grc_auditoresLista',
      'userTelefono', 'userCargo', 'userUbicacion', 'userAvatar'
    ];
    llavesBasura.forEach(key => localStorage.removeItem(key));
    
    let isFetching = false;
    let forcedRefreshPending = false;
    const fetchSecureData = async (forceFresh = false) => {
      if (!isMounted) return;
      if (isFetching) {
        if (forceFresh) forcedRefreshPending = true;
        return;
      }

      isFetching = true;
      try {
        const data = await apiService.getGrcData({ forceFresh });
        if (!isMounted) return;
        
        setRiesgos(data.riesgos || defaultRiesgos);
        setHallazgos(data.hallazgos || defaultHallazgos);
        setPlanes(data.planes || defaultPlanes);
        setIncidentes(data.incidentes || []);
        setEvaluaciones(data.evaluaciones || defaultEvaluaciones);
        setCronograma(data.cronograma || defaultCronograma);
        setMonitoreo(data.monitoreo || defaultMonitoreo);
        setInformesAuditoria(data.informesAuditoria || []);
        setComites(data.comites || []);
        setProgramas(data.programas || []);
        setAuditoresLista(data.auditoresLista || []);
        setFuentesMejora(data.fuentesMejora || []);
        setCatalogoCargos(Array.isArray(data.catalogoCargos) ? data.catalogoCargos : []);
        setMapaProcesos(data.mapaProcesos && typeof data.mapaProcesos === 'object' ? data.mapaProcesos : {});
        setSedesEmpresa(Array.isArray(data.sedesEmpresa) ? data.sedesEmpresa : []);
        setCatalogosInicializados(data.catalogosInicializados === true);
      } catch (error) {
        console.error("🔥 Error de seguridad/red obteniendo datos:", error);
      } finally {
        isFetching = false;
        if (isMounted) setIsCloudLoaded(true);
        if (isMounted && forcedRefreshPending) {
          forcedRefreshPending = false;
          void fetchSecureData(true);
        }
      }
    };

    fetchSecureData();

    const semaforoRef = doc(db, 'sistema', 'semaforo');
    let esPrimeraCarga = true;
    const unsubscribeSemaforo = onSnapshot(semaforoRef, docSnap => {
      if (esPrimeraCarga) {
        esPrimeraCarga = false;
        return;
      }
      if (docSnap.exists()) void fetchSecureData(true);
    }, error => {
      console.warn('Semáforo en tiempo real no disponible:', error);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(loadingTimer);
      unsubscribeSemaforo();
    };
  }, [userId]);

  // 3. Motor RLS Delegado al Servidor
  // 🛡️ Ya no filtramos arreglos en el cliente. Si la data llegó aquí, 
  // es porque el usuario tiene permiso legítimo para verla.
  const safeRiesgos = Array.isArray(riesgos) ? riesgos : [];
  const safeHallazgos = Array.isArray(hallazgos) ? hallazgos : [];
  const safePlanes = Array.isArray(planes) ? planes : [];
  const safeEvaluaciones = Array.isArray(evaluaciones) ? evaluaciones : [];
  const safeProgramas = Array.isArray(programas) ? programas : [];
  const safeIncidentes = Array.isArray(incidentes) ? incidentes : [];
  const safeCronograma = Array.isArray(cronograma) ? cronograma : [];
  const safeMonitoreo = Array.isArray(monitoreo) ? monitoreo : [];
  const safeComites = Array.isArray(comites) ? comites : [];

  return {
    user, setUser,
    isAdmin, setIsAdmin,
    perfilUsuario, setPerfilUsuario,
    isCloudLoaded, setIsCloudLoaded,
    showWelcome, setShowWelcome,
    riesgos, setRiesgos,
    hallazgos, setHallazgos,
    planes, setPlanes,
    incidentes, setIncidentes,
    evaluaciones, setEvaluaciones,
    cronograma, setCronograma,
    monitoreo, setMonitoreo,
    informesAuditoria, setInformesAuditoria,
    comites, setComites,
    programas, setProgramas,
    auditoresLista, setAuditoresLista,
    fuentesMejora, setFuentesMejora,
    catalogoCargos, setCatalogoCargos,
    mapaProcesos, setMapaProcesos,
    sedesEmpresa, setSedesEmpresa,
    catalogosInicializados, setCatalogosInicializados,
    safePlanes, safeHallazgos, safeRiesgos, safeEvaluaciones,
    safeProgramas, safeIncidentes, safeCronograma, safeMonitoreo, safeComites
  };
}