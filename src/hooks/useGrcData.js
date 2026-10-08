// src/hooks/useGrcData.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { apiService } from '../services/apiService';
import { doc, getDoc } from 'firebase/firestore';
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
  const [catalogosInicializados, setCatalogosInicializados] = useState(false);

  // 1. Estado y validación de perfil/rol de usuario
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          await apiService.login(idToken);
        } catch (err) {
          console.error("Error renovando cookie de servidor:", err);
          await signOut(auth);
          return;
        }

        setUser(currentUser);

        try {
          const docRef = doc(db, 'usuarios', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const datosPerfil = docSnap.data();
            setPerfilUsuario({
              ...datosPerfil,
              nombreResponsable: datosPerfil.nombreResponsable || datosPerfil.nombre || 'Usuario GRC',
              correo: datosPerfil.correo || datosPerfil.email || currentUser.email
            });
            setIsAdmin(datosPerfil.rol === 'admin');
          } else {
            setPerfilUsuario({
              correo: currentUser.email,
              nombreResponsable: 'Usuario GRC',
              rol: 'lider'
            });
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error obteniendo perfil en Firestore:", error);
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

  // 2. Carga Inicial Centralizada SEGURA (Backend-Driven)
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    let isFetching = false;
    setTimeout(() => {
      if (isMounted) setIsCloudLoaded(false);
    }, 0);

    // 🛡️ PURGA AUTOMÁTICA DE DATOS RESIDUALES Y PII EN LOCALSTORAGE
    // Elimina datos de negocio y datos personales identificables del almacenamiento local
    const llavesBasura = [
      'grc_riesgos', 'grc_hallazgos', 'grc_planes', 'grc_incidentes', 
      'grc_evaluaciones', 'grc_cronograma', 'grc_monitoreo', 'grc_informesAuditoria', 
      'grc_comites', 'grc_programas', 'grc_auditoresLista',
      'userTelefono', 'userCargo', 'userUbicacion', 'userAvatar'
    ];
    llavesBasura.forEach(key => localStorage.removeItem(key));
    
    const fetchSecureData = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        // 🛡️ HALLAZGO N1 MITIGADO: 
        // Eliminamos onSnapshot directo a Firestore.
        // La solicitud pasa por el backend, quien valida la cookie HttpOnly 
        // y aplica el filtrado RLS estricto antes de devolver el JSON.
const data = await apiService.getGrcData();
  if (!isMounted) return;
        
        // Asignación directa: confiamos 100% en el filtro del servidor
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
        setCatalogosInicializados(data.catalogosInicializados === true);
        
      } catch (error) {
        console.error("🔥 Error de seguridad/red obteniendo datos:", error);
  } finally {
        isFetching = false;
        if (isMounted) setIsCloudLoaded(true);
      }
    };

    fetchSecureData();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchSecureData();
    }, 15000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchSecureData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);    

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
    catalogosInicializados, setCatalogosInicializados,
    safePlanes, safeHallazgos, safeRiesgos, safeEvaluaciones,
    safeProgramas, safeIncidentes, safeCronograma, safeMonitoreo, safeComites
  };
}