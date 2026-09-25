// src/hooks/useGrcData.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { 
  defaultCronograma, defaultRiesgos, defaultHallazgos, 
  defaultPlanes, defaultIncidentes, defaultEvaluaciones, defaultMonitoreo 
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

  // 1. Estado y validación de perfil/rol de usuario
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken })
          });
        } catch (err) {
          console.error("Error renovando cookie de servidor:", err);
        }

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
        setPerfilUsuario(null);
        setIsAdmin(false);
        setShowWelcome(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Carga Inicial Centralizada con Firebase
  useEffect(() => {
    if (!user) return;
    setIsCloudLoaded(false);
    
    const timeoutSeguridad = setTimeout(() => {
      console.warn("⚠️ Firebase está tardando. Forzando entrada...");
      setIsCloudLoaded(true);
    }, 4000);

    const docRef = doc(db, 'workspace_compartido', 'base_de_datos_grc');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      clearTimeout(timeoutSeguridad); 
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
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
      } else {
        if (isAdmin) {
          setDoc(docRef, { 
            riesgos: defaultRiesgos, hallazgos: defaultHallazgos, planes: defaultPlanes, 
            incidentes: defaultIncidentes, evaluaciones: defaultEvaluaciones, 
            cronograma: defaultCronograma, monitoreo: defaultMonitoreo, 
            informesAuditoria: [], comites: [] 
          });
        }
      }      
      setIsCloudLoaded(true);
    }, (error) => {
      clearTimeout(timeoutSeguridad);
      console.error("🔥 Error de Firebase:", error);
      setIsCloudLoaded(true);
    });

    return () => {
      clearTimeout(timeoutSeguridad);
      unsubscribe();
    };
  }, [user, isAdmin]);

  // 3. Motor RLS (Seguridad a nivel de fila)
  const isSuperUser = isAdmin || perfilUsuario?.rol === 'auditor';

  const applyRowLevelSecurity = (list, keyProceso, keyResp, keyCorreoResp) => {
    if (isSuperUser) return list;
    
    return list.filter(item => {
      if (keyCorreoResp && item[keyCorreoResp]?.toLowerCase() === user?.email?.toLowerCase()) return true;
      if (keyResp && perfilUsuario?.nombreResponsable && item[keyResp]?.toLowerCase().includes(perfilUsuario.nombreResponsable.toLowerCase())) return true;
      if (keyProceso && perfilUsuario?.procesoAsignado && item[keyProceso] === perfilUsuario.procesoAsignado) return true;
      return false;
    });
  };

  const safePlanes = applyRowLevelSecurity(Array.isArray(planes) ? planes : [], 'proceso', 'responsable', 'correoResponsable');
  const safeHallazgos = applyRowLevelSecurity(Array.isArray(hallazgos) ? hallazgos : [], 'proceso', 'responsable', null);
  const safeRiesgos = applyRowLevelSecurity(Array.isArray(riesgos) ? riesgos : [], 'proceso', 'responsable', null);
  const safeEvaluaciones = applyRowLevelSecurity(Array.isArray(evaluaciones) ? evaluaciones : [], 'proceso', null, null);
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
    safePlanes, safeHallazgos, safeRiesgos, safeEvaluaciones,
    safeProgramas, safeIncidentes, safeCronograma, safeMonitoreo, safeComites
  };
}