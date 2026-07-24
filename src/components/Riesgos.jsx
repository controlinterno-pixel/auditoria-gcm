import React, { useState } from 'react';

import { 
  MAPA_PROCESOS, 
  CARGOS_POR_SEDE, 
  CLASIFICACIONES_MANUAL 
} from '../constants/diccionariosGRC';

import { analizarRiesgoConIA } from '../services/aiEngine';
// 📚 DICCIONARIO METODOLÓGICO DE AYUDA (EDICIÓN TERMALES SANTA ROSA)
const EXPLICACIONES_CAMPOS = {
  proceso: {
    titulo: "Proceso / Subproceso",
    porQue: "Permite segregar el mapa de riesgos corporativo. Al asignarle un bloque exacto de la operación, facilitamos la consolidación de estadísticas en el Dashboard por áreas de negocio.",
    ejemplo: "Si se están auditando pérdidas de vajilla o inventario en restaurantes, se debe seleccionar obligatoriamente 'Alimentos y Bebidas (AYB)'."
  },
  categoria: {
    titulo: "Categoría de Riesgo",
    porQue: "Agrupa los riesgos bajo la taxonomía de la norma internacional ISO 31000. Ayuda a la Junta Directiva a entender si la mayor exposición de Termales es operacional, de estrategia o legal.",
    ejemplo: "Un ataque informático al sistema de reservas Zeus corresponde a la categoría 'Tecnológico'. Una demanda laboral corresponde a 'Cumplimiento'."
  },

clasificacion: {
    titulo: "Clasificación de riesgo (Tabla 5)",
    porQue: "Permite agrupar los riesgos identificados en las categorías estandarizadas por la Guía de administración del riesgo V5.",
    ejemplo: () => (
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-[10px]">
          <tbody className="divide-y divide-emerald-200/50">
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900 w-1/3">Ejecución y adm. de procesos</td><td className="p-2 text-slate-700">Pérdidas derivadas de errores.</td></tr>
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900">Fraude Externo</td><td className="p-2 text-slate-700">Actos de fraude por personas ajenas.</td></tr>
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900">Fraude Interno</td><td className="p-2 text-slate-700">Fraude por personal interno.</td></tr>
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900">Fallas Tecnológicas</td><td className="p-2 text-slate-700">Errores en hardware o software.</td></tr>
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900">Relaciones Laborales</td><td className="p-2 text-slate-700">Demandas por daños o discriminación.</td></tr>
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900">Usuarios y productos</td><td className="p-2 text-slate-700">Fallas frente a usuarios o prácticas.</td></tr>
            <tr className="hover:bg-emerald-50"><td className="p-2 font-bold text-emerald-900">Daños externos</td><td className="p-2 text-slate-700">Pérdidas por desastres o vandalismo.</td></tr>
          </tbody>
        </table>
      </div>
    )
  }, 
  normativa: {
    titulo: "Normativa Asociada",
    porQue: "Conecta el riesgo con el marco legal, leyes o lineamientos de entes de control externos que rigen la operación de Termales. Ayuda a evitar sanciones o cierres.",
    ejemplo: "Para riesgos de Seguridad y Salud en el Trabajo, la norma asociada es el 'Decreto 1072'. Para temas contables, el 'Estatuto Tributario'."
  },
  responsable: {
    titulo: "Líder Dueño del Proceso",
    porQue: "Establece la rendición de cuentas (Accountability). Define qué cargo de la organización es el único responsable de vigilar la ejecución diaria de los controles preventivos y responder ante auditorías.",
    ejemplo: "Para el proceso de contabilidad e impuestos, el líder dueño del proceso es el 'Jefe de Contabilidad'."
  },
  afectacion: {
    titulo: "Tipo de Afectación",
    porQue: "Define las dimensiones afectadas del negocio. Ayuda a priorizar la atención: un riesgo puede implicar solo desembolso de dinero, o dañar gravemente el nombre y la marca del hotel.",
    ejemplo: "Si un huésped sufre un accidente en las instalaciones, la afectación es 'Económico-Reputacional' debido a la indemnización y el impacto publicitario municipal."
  },
  causaInmediata: {
    titulo: "Causa Inmediata (¿Qué pasa?)",
    porQue: "Describe el síntoma o la circunstancia visible e inmediata bajo la cual el riesgo se materializa. Es la primera parte obligatoria de la redacción metodológica.",
    ejemplo: "Pérdida o descuadre físico de activos fijos por daños, hurtos y/o actos indebidos."
  },
  causaRaiz: {
    titulo: "Causa Raíz (¿Por qué pasa?)",
    porQue: "Es la vulnerabilidad básica o falla estructural de control interno que causó el evento. Aquí es donde los controles de la empresa deben atacar para que no vuelva a ocurrir.",
    ejemplo: "Ausencia de un procedimiento de seguimiento, monitoreo y conciliación mensual del módulo de activos fijos Zeus contra la contabilidad física."
  },
  probInh: {
    titulo: "Probabilidad Inherente",
    porQue: "Mide cuántas veces al año ejecutamos la actividad que conlleva el riesgo, calculando la exposición pura del hotel antes de implementar cualquier tipo de defensa o control.",
    ejemplo: "Si la facturación en el hotel se realiza más de 5,000 veces al año, su probabilidad inherente es 'Muy Alta (100%)'."
  },
  impInh: {
    titulo: "Impacto Inherente",
    porQue: "Evalúa la gravedad máxima del daño en términos de Salarios Mínimos (SMLMV) o impacto reputacional nacional/local si el riesgo se llegara a materializar sin controles.",
    ejemplo: "Una afectación mayor a 500 Salarios Mínimos Mensuales Legales Vigentes se califica a nivel máximo como 'Catastrófico (100%)'."
  },
  controlDesc: {
    titulo: "Descripción de la Tarea del Control",
    porQue: "Detalla la acción o procedimiento específico que realiza el personal o un sistema automatizado para anular las causas del riesgo e impedir su materialización.",
    ejemplo: "El Coordinador de Contabilidad realiza mensualmente la toma física y aleatoria de los inventarios confrontando el módulo Zeus contra los activos asignados por acta."
  },
  probRes: {
    titulo: "Probabilidad Residual Final",
    porQue: "Calcula qué tan probable es que ocurra el evento DESPUÉS de aplicar los controles Preventivos y Detectivos. El sistema resta más porcentaje si el control es Automático y Documentado, que si es Manual.",
    ejemplo: "Fórmula: Prob. Inicial - (Prob. Inicial × Suma de pesos de los controles Preventivos/Detectivos)."
  },
  impRes: {
    titulo: "Impacto Residual Final",
    porQue: "Calcula qué tan grave sería el daño DESPUÉS de aplicar controles Correctivos. IMPORTANTE: Los controles preventivos NO reducen el impacto. Solo las acciones como pólizas de seguro o copias de seguridad logran amortiguar la caída.",
    ejemplo: "Fórmula: Impacto Inicial - (Impacto Inicial × Suma de pesos de los controles Correctivos)."
  }
};

// 🚀 COMPONENTE DONUT GAUGE PARA EFICACIA DE CONTROLES (ESTILO ENTERPRISE)
const EficaciaGauge = ({ porcentaje = 75 }) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (porcentaje / 100) * circumference;

  let colorClass = "stroke-emerald-500";
  if (porcentaje < 50) colorClass = "stroke-red-500";
  else if (porcentaje < 75) colorClass = "stroke-amber-500";

  return (
    <div className="relative inline-flex items-center justify-center w-10 h-10">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} className="stroke-slate-100" strokeWidth="3.5" fill="transparent" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          className={`${colorClass} transition-all duration-500 ease-out`}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[8px] font-black text-slate-800">{porcentaje}%</span>
    </div>
  );
};
// 🧮 CALCULADORA METODOLÓGICA DE EFICACIA SEGÚN TABLA 6 DEL MANUAL DE RIESGOS (TERMALES S.A.)
const calcularEficaciaControl = (c) => {
  if (!c) return 75;
  let score = 0;

  // 1. Tipo (Preventivo: 25%, Detectivo: 15%, Correctivo: 10%)
  const tipo = c.tipo || 'Preventivo';
  if (tipo.includes('Detectivo')) score += 15;
  else if (tipo.includes('Correctivo')) score += 10;
  else score += 25; // Preventivo por defecto

  // 2. Ejecución (Automático: 25%, Manual: 15%)
  const ejecucion = c.implementacion || c.ejecucion || 'Manual';
  if (ejecucion.includes('Automático')) score += 25;
  else score += 15; // Manual por defecto

  // 3. Documentación (Documentado: 15%, No documentado: 0%)
  const doc = c.documentacion || 'Documentado';
  if (doc.includes('Documentado') && !doc.includes('No documentado')) score += 15;

  // 4. Frecuencia (Continua: 10%, Aleatoria: 5%)
  const freq = c.frecuencia || 'Continua';
  if (freq.includes('Aleatoria') || freq.includes('Periódica')) score += 5;
  else score += 10; // Continua / Permanente por defecto

  // 5. Evidencia (Con registro: 10%, Sin registro: 0%)
  const evi = c.evidencia || 'Con registro';
  if (evi.includes('Con registro') || evi.includes('Trazable')) score += 10;

  return Math.min(score, 100);
};
// 🧮 CALCULADORA DE PORCENTAJE GLOBAL DE MITIGACIÓN DEL RIESGO (DONUT GAUGE)
const calcularMitigacionRiesgo = (r) => {
  const expInh = (r.probabilidadInherente || 60) * (r.impactoInherente || 60);
  const expRes = (r.probabilidadResidual || 15) * (r.impactoResidual || 30);
  if (expInh === 0) return 0;
  const mitigacion = Math.round(((expInh - expRes) / expInh) * 100);
  return Math.max(0, Math.min(100, mitigacion));
};
// 🏛️ COMPONENTE PRINCIPAL
export default function Riesgos({ 
  isAdmin = false, 
  safeRiesgos: rawRiesgos, 
  setRiesgos = () => console.warn("Modo offline: setRiesgos no detectado"), 
  saveToCloud = async () => console.warn("Modo offline: saveToCloud no detectado"), 
  showNotification = () => {} 
}) {
   // 🛡️ BLINDAJE: Forzamos un array vacío si la BD envía null para evitar que .map o .reduce colapsen
  const safeRiesgos = Array.isArray(rawRiesgos) ? rawRiesgos : [];

  // 🤖 ESTADOS PARA EL DICTAMEN DE INTELIGENCIA ARTIFICIAL EN EL DASHBOARD
  const [dictamenIA, setDictamenIA] = useState(null);
  const [procesandoIA, setProcesandoIA] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [isSubmitting, setIsSubmitting] = useState(false);
// 🛡️ Estado para el modal explicativo de eficacia del control
  const [controlSeleccionadoIA, setControlSeleccionadoIA] = useState(null);
  // 🚀 ESTADOS PARA EL EXPEDIENTE EXPANDIBLE (ACCORDEÓN 360°)
  const [expandedRiesgoId, setExpandedRiesgoId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('controles');
// 🔍 ESTADOS DE BÚSQUEDA Y FILTROS ENTERPRISE
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroProceso, setFiltroProceso] = useState('Todos');
  const [filtroClasificacion, setFiltroClasificacion] = useState('Todas');
  const [filtroNivel, setFiltroNivel] = useState('Todos');
  const toggleExpediente = (id) => {
    if (expandedRiesgoId === id) {
      setExpandedRiesgoId(null);
    } else {
      setExpandedRiesgoId(id);
      setActiveSubTab('controles');
    }
  };
  // 🍿 ESTADO PARA EL POPUP INTERACTIVO ELEGANTE
  const [ayudaModal, setAyudaModal] = useState(null);
  
  const [editRiesgo, setEditRiesgo] = useState(null);
  const [riesgoId, setRiesgoId] = useState('');
  
  // 🌟 NUEVOS ESTADOS EN CASCADA PARA PROCESOS
  const listadoMacros = Object.keys(MAPA_PROCESOS);
  const [macroproceso, setMacroproceso] = useState(listadoMacros[0]);
  const [subproceso, setSubproceso] = useState(MAPA_PROCESOS[listadoMacros[0]][0]);

  // Función inteligente para manejar el cambio del proceso
  const handleMacroprocesoChange = (e) => {
    const nuevoMacro = e.target.value;
    setMacroproceso(nuevoMacro);
    
    if (MAPA_PROCESOS[nuevoMacro] && MAPA_PROCESOS[nuevoMacro].length > 0) {
      setSubproceso(MAPA_PROCESOS[nuevoMacro][0]);
    } else {
      setSubproceso('');
    }
  };

  const subprocesosDisponibles = MAPA_PROCESOS[macroproceso] || [];
  const tieneSubprocesosReales = subprocesosDisponibles.length > 1 || (subprocesosDisponibles.length === 1 && subprocesosDisponibles[0] !== "General");

  const [categoria, setCategoria] = useState('');
  const [clasificacionRiesgo, setClasificacionRiesgo] = useState(CLASIFICACIONES_MANUAL[0]);
  const [normativa, setNormativa] = useState('');
  // Modificamos sedeForm para que sea un arreglo (Array) y añadimos sedeTemp
  const [sedeForm, setSedeForm] = useState(['Administrativos']);
  const [sedeTemp, setSedeTemp] = useState('');
  const [responsablesMultiples, setResponsablesMultiples] = useState([]);
  const [responsableTemp, setResponsableTemp] = useState('');  
  const [afectacion, setAfectacion] = useState('Económico');
  const [causaInmediata, setCausaInmediata] = useState('');
  const [causaRaiz, setCausaRaiz] = useState('');
  const [probInherente, setProbInherente] = useState(60);
  const [impInherente, setImpInherente] = useState(60);
  
  const [controles, setControles] = useState([]);
  const [tratamiento, setTratamiento] = useState('Reducir el riesgo');
  const [planAccionRiesgo, setPlanAccionRiesgo] = useState('');
  const [fechaSeguimiento, setFechaSeguimiento] = useState('');
  const [seguimientoBitacora, setSeguimientoBitacora] = useState('');

 const calcularRiesgoResidual = () => {
    let curr_p = probInherente / 100;
    let curr_i = impInherente / 100;

    controles.forEach(c => {
      // Usamos exactamente el % de eficacia oficial de Tabla 6 (convertido a decimal)
      const weight = calcularEficaciaControl(c) / 100;
      const tipo = c.tipo || '';

      // Controles Correctivos reducen Impacto; Preventivos/Detectivos reducen Probabilidad
      if (tipo.includes('Correctivo')) {
        curr_i = curr_i - (curr_i * weight);
      } else {
        curr_p = curr_p - (curr_p * weight);
      }
    });

    return {
      probabilidad: Math.max(Math.round(curr_p * 100), 0),
      impacto: Math.max(Math.round(curr_i * 100), 0)
    };
  };
  const residuales = calcularRiesgoResidual();
  const descripcionAutomatica = `Posibilidad de afectación ${afectacion.toLowerCase()} por ${causaInmediata.toLowerCase()} debido a ${causaRaiz.toLowerCase()}`;

  const getSeverityZone = (prob, imp) => {
    let p = Number(prob) || 1;
    let i = Number(imp) || 1;
    
    if (p > 5) p = Math.ceil(p / 20);
    if (i > 5) i = Math.ceil(i / 20);
    
    if (p >= 4 && i >= 4) {
      return { label: 'Extremo', color: 'bg-red-600 text-white' };
    } 
    if ((p >= 3 && i >= 4) || (p >= 4 && i >= 3)) {
      return { label: 'Alto', color: 'bg-orange-500 text-white' };
    } 
    if ((p >= 2 && i >= 3) || (p >= 3 && i >= 2) || (p >= 2 && i >= 2)) {
      return { label: 'Moderado', color: 'bg-amber-400 text-slate-900' };
    }
    
    return { label: 'Bajo', color: 'bg-emerald-500 text-white' };
  };

  const handleDeleteRiesgo = async (id) => {
    if (window.confirm("⚠️ ¿Estás seguro de que deseas eliminar este riesgo de la matriz corporativa?")) {
      try {
        const updatedList = safeRiesgos.filter(r => r.id !== id);
        setRiesgos(updatedList);
        await saveToCloud({ riesgos: updatedList });
        showNotification("Riesgo eliminado con éxito", "success");
      } catch (error) {
        console.error("Error al eliminar:", error);
        showNotification("Error al intentar eliminar el riesgo.", "error");
      }
    }
  };
// 🤖 FUNCIÓN DE ANALISIS CON IA EN TIEMPO REAL (STREAMING)
  // 🤖 FUNCIÓN DE ANALISIS ESTABLE CON CARGA ELEGANTE
  const solicitarAnalisisFilaIA = async (riesgo) => {
    setProcesandoIA(true);
    setDictamenIA(null); // Limpiamos para mostrar la animación de carga

    try {
      // 🚀 Usamos la versión estable que descarga el 100% del texto (Evita errores de renderizado)
      const textoCompleto = await analizarRiesgoConIA(riesgo);
      
      setDictamenIA({
        titulo: `Dictamen Técnico ERIR® — ${riesgo.proceso || 'Riesgo Corporativo'}`,
        dictamen: textoCompleto
      });
    } catch (error) {
      console.error("Error transmitiendo análisis de IA:", error);
      if (showNotification) {
        showNotification("Error al conectar con la Inteligencia Artificial.", "error");
      }
    } finally {
      setProcesandoIA(false);
    }
  };
  const handleEditRiesgo = (riesgo) => {
    setEditRiesgo(riesgo);
    setRiesgoId(riesgo.id);
    
// 🏢 Recuperar Sede (Soporta versiones viejas de texto único y versiones nuevas de selección múltiple)
    setSedeForm(Array.isArray(riesgo.sede) ? riesgo.sede : (riesgo.sede ? [riesgo.sede] : ['Administrativos']));
    
    // 🌟 Recuperar proceso y Subproceso (Manteniendo compatibilidad con datos viejos)
    setMacroproceso(riesgo.macroproceso || riesgo.proceso || listadoMacros[0]);
    setSubproceso(riesgo.subproceso || 'General');

    setCategoria(riesgo.categoria);
    setClasificacionRiesgo(riesgo.clasificacionRiesgo || CLASIFICACIONES_MANUAL[0]);
    setNormativa(riesgo.normativa);
    
    // 👥 Recuperar Múltiples Responsables
    if (riesgo.responsable) {
      if (Array.isArray(riesgo.responsable)) {
        setResponsablesMultiples(riesgo.responsable);
      } else if (riesgo.responsable.includes(',')) {
        setResponsablesMultiples(riesgo.responsable.split(',').map(r => r.trim()));
      } else if (riesgo.responsable !== 'Sin Asignar') {
        setResponsablesMultiples([riesgo.responsable]);
      } else {
        setResponsablesMultiples([]);
      }
    } else {
      setResponsablesMultiples([]);
    }
    
    setAfectacion('Económico'); 
    setCausaInmediata(riesgo.descripcion || '');
    setCausaRaiz('');
    setProbInherente(riesgo.probabilidadInherente || 60);
    setImpInherente(riesgo.impactoInherente || 60);
    setControles(riesgo.controlesDetallados || []);
    
    setTratamiento(riesgo.tratamiento || 'Reducir el riesgo');
    setPlanAccionRiesgo(riesgo.planAccionRiesgo || '');
    setFechaSeguimiento(riesgo.fechaSeguimiento || '');
    setSeguimientoBitacora(riesgo.seguimientoBitacora || '');
    
    setVistaActiva('nuevo');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };
  
  const handleRiesgoSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const ts = new Date().toLocaleString();

    try {
      let updatedList = [...safeRiesgos];
const textoControlesConsolidados = controles.map((c, index) => `C${index + 1}. [${c.tipo}] ${c.descripcion} (${c.documentacion} - ${c.frecuencia})`).join('\n\n');

const nuevoRiesgo = {
        ...(editRiesgo || {}),
        // 🛡️ BLINDAJE: Generador de ID seguro con respaldo si crypto falla
        id: editRiesgo ? editRiesgo.id : (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `RSK-${Date.now()}`),
        sede: sedeForm,      
        // ✅ CORREGIDO: Se usa macroproceso para no romper el guardado
        proceso: macroproceso,
        macroproceso: macroproceso,
        subproceso: subproceso,
        categoria,
        clasificacionRiesgo,
        normativa,
        responsable: responsablesMultiples.length > 0 ? responsablesMultiples.join(', ') : 'Sin Asignar',
        descripcion: causaInmediata && causaRaiz ? descripcionAutomatica : causaInmediata,
        probabilidadInherente: probInherente,
        impactoInherente: impInherente,
        probabilidadResidual: residuales.probabilidad,
        impactoResidual: residuales.impacto,
        descripcionControl: textoControlesConsolidados,
        controlesDetallados: controles,
        tratamiento,
        planAccionRiesgo,
        fechaSeguimiento,
        seguimientoBitacora,
        anio: new Date().getFullYear(),
mes: new Date().toLocaleString('es-ES', { month: 'long' }),
        historialCambios: editRiesgo 
          ? [...(editRiesgo.historialCambios || []), { fecha: ts, accion: 'Modificación con variables completas del manual' }]
          : [{ fecha: ts, accion: 'Creación manual con matriz completa' }]
      };

      if (editRiesgo) {
        const idx = updatedList.findIndex(r => r.id === editRiesgo.id);
        if (idx !== -1) updatedList[idx] = nuevoRiesgo;
      } else {
        updatedList.push(nuevoRiesgo);
      }

      setRiesgos(updatedList);
      await saveToCloud({ riesgos: updatedList });

      showNotification(`Riesgo corporativo ${editRiesgo ? 'actualizado' : 'creado'} con éxito.`, "success");
      setVistaActiva('dashboard');
      setEditRiesgo(null);
      
      setAfectacion('Económico'); setCausaInmediata(''); setCausaRaiz(''); setControles([]);
      setPlanAccionRiesgo(''); setFechaSeguimiento(''); setSeguimientoBitacora('');
    } catch (error) {
      console.error(error);
      showNotification("Error al procesar el riesgo corporativo.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  const LabelConPalomita = ({ idCampo, dark }) => {
    const dataAyuda = EXPLICACIONES_CAMPOS[idCampo];
    if (!dataAyuda) return null;
    return (
      <div className="flex items-center space-x-1.5 mb-1">
        <span className={`text-[10px] font-black uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{dataAyuda.titulo}</span>
        <button
          type="button"
          onClick={() => setAyudaModal(dataAyuda)}
          className="w-4 h-4 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[9px] text-emerald-600 font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm group"
          title="Ver por qué diligenciar y ejemplo"
        >
          <span className="group-hover:scale-110 transition-transform">✓</span>
        </button>
      </div>
    );
  };


  const renderDashboard = () => {
    const totalRiesgos = safeRiesgos.length;
    const extremos = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Extremo').length;
    const altos = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Alto').length;
    const moderados = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Moderado').length;
    const bajos = safeRiesgos.filter(r => getSeverityZone(r.probabilidadResidual, r.impactoResidual).label === 'Bajo').length;

    const conteoProcesos = safeRiesgos.reduce((acc, r) => {
      acc[r.proceso] = (acc[r.proceso] || 0) + 1;
      return acc;
    }, {});

    const topProcesos = Object.entries(conteoProcesos).sort((a,b) => b[1] - a[1]).slice(0, 5);

    const solicitarDictamenIA = async () => {
      setProcesandoIA(true);
      setDictamenIA(null);

      try {
        if (totalRiesgos === 0) {
          setDictamenIA({
            titulo: "Diagnóstico General de Riesgos",
            dictamen: "No hay datos de riesgos registrados en la matriz para procesar el análisis de Inteligencia Artificial."
          });
          return;
        }

        const datosResumen = {
          proceso: "Diagnóstico Corporativo Global",
          descripcion: `Evaluación de la matriz corporativa con un total de ${totalRiesgos} riesgos registrados. Principales procesos expuestos: ${topProcesos.map(([p, c]) => `${p} (${c} riesgos)`).join(', ')}. Distribución actual de severidad residual: Extremos (${extremos}), Altos (${altos}), Moderados (${moderados}), Bajos (${bajos}).`,
          probabilidadInherente: 80,
          impactoInherente: 80
        };

        const dictamenRespuesta = await analizarRiesgoConIA(datosResumen);
        setDictamenIA({
          titulo: "Diagnóstico Corporativo Global — Inteligencia Artificial",
          dictamen: dictamenRespuesta
        });
      } catch (error) {
        console.error("Error al procesar dictamen corporativo con IA:", error);
        if (showNotification) showNotification("Error al comunicarse con el motor de IA.", "error");
      } finally {
        setProcesandoIA(false);
      }
    };
   return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 relative">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Riesgos</p>
            <p className="text-3xl font-black text-slate-800">{totalRiesgos}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-2xl shadow-sm border border-red-200">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Extremos</p>
            <p className="text-3xl font-black text-red-700">{extremos}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl shadow-sm border border-orange-200">
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Altos</p>
            <p className="text-3xl font-black text-orange-700">{altos}</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl shadow-sm border border-amber-200">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Moderados</p>
            <p className="text-3xl font-black text-amber-700">{moderados}</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl shadow-sm border border-emerald-200">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Bajos</p>
            <p className="text-3xl font-black text-emerald-700">{bajos}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Procesos con mayor exposición</h3>
            <button onClick={solicitarDictamenIA} className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-md flex items-center gap-1 transition-all font-black shadow-sm shrink-0">✨ Analizar con IA</button>
          </div>
          
          <div className="space-y-3">
            {topProcesos.map(([proc, count], idx) => (
              <div key={idx} className="flex items-center text-xs">
                <span className="w-1/3 truncate text-slate-600 font-bold pr-2">{proc}</span>
                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#0A3B32] h-full rounded-full" style={{width: `${(count/(totalRiesgos || 1))*100}%`}}></div>
                </div>
                <span className="w-12 text-right font-black text-slate-800">{count}</span>
              </div>
            ))}
            {topProcesos.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No hay riesgos mapeados en la matriz aún.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

const renderMatriz = () => {
    // 📊 Métricas calculadas para la barra superior
    const totalRiesgosCount = safeRiesgos.length;
    const riesgosAltosCriticosCount = safeRiesgos.filter(r => {
      const z = getSeverityZone(r.probabilidadResidual, r.impactoResidual);
      return z.label === 'Alto' || z.label === 'Extremo';
    }).length;
    const totalControlesCount = safeRiesgos.reduce((acc, r) => {
      const lista = Array.isArray(r.controlesDetallados) ? r.controlesDetallados : [];
      return acc + (lista.length || (r.descripcionControl ? 1 : 0));
    }, 0);

    // 🧮 CALCULADORAS DINÁMICAS PARA LA BARRA DE KPIs
    const todosLosControles = safeRiesgos.flatMap(r => Array.isArray(r.controlesDetallados) ? r.controlesDetallados : []);
    const eficaciaPromedioGlobal = todosLosControles.length > 0
      ? Math.round(todosLosControles.reduce((acc, c) => acc + calcularEficaciaControl(c), 0) / todosLosControles.length)
      : 80;

    const avgResidualScore = totalRiesgosCount > 0
      ? safeRiesgos.reduce((acc, r) => acc + ((r.probabilidadResidual || 15) * (r.impactoResidual || 30) / 100), 0) / totalRiesgosCount
      : 0;

    let nivelPromedioText = 'BAJO';
    let nivelPromedioColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (avgResidualScore > 40) {
      nivelPromedioText = 'EXTREMO';
      nivelPromedioColor = 'bg-red-100 text-red-800 border-red-200';
    } else if (avgResidualScore > 25) {
      nivelPromedioText = 'ALTO';
      nivelPromedioColor = 'bg-orange-100 text-orange-800 border-orange-200';
    } else if (avgResidualScore > 12) {
      nivelPromedioText = 'MODERADO';
      nivelPromedioColor = 'bg-amber-100 text-amber-800 border-amber-200';
    }

    // 🔍 Filtrado dinámico en tiempo real
    const riesgosFiltrados = safeRiesgos.filter(r => {
      const matchSearch = (r.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.proceso || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(r.id).includes(searchTerm);
      const matchProceso = filtroProceso === 'Todos' || r.proceso === filtroProceso;
      const matchClasificacion = filtroClasificacion === 'Todas' || r.clasificacionRiesgo === filtroClasificacion;
      const zoneRes = getSeverityZone(r.probabilidadResidual, r.impactoResidual);
      const matchNivel = filtroNivel === 'Todos' || zoneRes.label === filtroNivel;
      return matchSearch && matchProceso && matchClasificacion && matchNivel;
    });

    const procesosUnicos = Array.from(new Set(safeRiesgos.map(r => r.proceso).filter(Boolean)));

    return (
      <div className="space-y-6 font-sans text-slate-800 animate-in fade-in duration-300">

        {/* ========================================================================= */}
        {/* 📊 1. MICRO-DASHBOARD EJECUTIVO SUPERIOR (KPI BAR)                       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Riesgos</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{totalRiesgosCount}</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Registrados en la matriz</p>
            </div>
            <span className="p-3 bg-slate-100 text-slate-700 rounded-2xl text-lg shadow-inner">📋</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riesgos Altos y Críticos</p>
              <div className="flex items-baseline space-x-2 mt-1">
                <h3 className="text-3xl font-black text-red-600">{riesgosAltosCriticosCount}</h3>
                <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                  {totalRiesgosCount > 0 ? Math.round((riesgosAltosCriticosCount / totalRiesgosCount) * 100) : 0}% del total
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Requieren atención prioritaria</p>
            </div>
            <span className="p-3 bg-red-50 text-red-600 rounded-2xl text-lg shadow-inner">⚠️</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riesgo Residual Promedio</p>
              <div className="mt-2">
                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border shadow-sm ${nivelPromedioColor}`}>
                  {nivelPromedioText}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-3">Nivel general de exposición</p>
            </div>
            <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl text-lg shadow-inner">📉</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controles Implementados</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{totalControlesCount}</h3>
              <p className="text-[10px] text-emerald-700 font-extrabold mt-1">Eficacia promedio: {eficaciaPromedioGlobal}%</p>
            </div>
            <span className="p-3 bg-blue-50 text-blue-600 rounded-2xl text-lg shadow-inner">🛡️</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 🔍 2. BARRA DE BÚSQUEDA Y FILTROS TÁCTICOS                                */}
        {/* ========================================================================= */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar riesgo..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0A3B32] font-semibold bg-slate-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroProceso}
              onChange={(e) => setFiltroProceso(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32]"
            >
              <option value="Todos">Todos los procesos</option>
              {procesosUnicos.map(proc => <option key={proc} value={proc}>{proc}</option>)}
            </select>

            <select
              value={filtroClasificacion}
              onChange={(e) => setFiltroClasificacion(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32]"
            >
              <option value="Todas">Todas las clasificaciones</option>
              {CLASIFICACIONES_MANUAL.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={filtroNivel}
              onChange={(e) => setFiltroNivel(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32]"
            >
              <option value="Todos">Todos los niveles</option>
              <option value="Bajo">Bajo</option>
              <option value="Moderado">Moderado</option>
              <option value="Alto">Alto</option>
              <option value="Extremo">Extremo</option>
            </select>

            <span className="text-xs bg-emerald-50 text-emerald-800 font-extrabold px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Estado: Activos
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📋 3. TABLA PRINCIPAL ENTERPRISE SAAS                                    */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          
          {/* Encabezado Principal */}
          <div className="grid grid-cols-12 gap-3 bg-slate-900 text-white px-6 py-3.5 text-[10px] font-black uppercase tracking-wider items-center">
            <div className="col-span-2">ID / Proceso</div>
            <div className="col-span-3">Riesgo</div>
            <div className="col-span-2">Clasificación</div>
            <div className="col-span-2 text-center">Nivel de Riesgo (Inherente / Residual)</div>
            <div className="col-span-1 text-center">Controles</div>
            <div className="col-span-1 text-center">Análisis IA</div>
            <div className="col-span-1 text-right">Gestión</div>
          </div>

          {/* Listado de Filas */}
          <div className="divide-y divide-slate-100">
            {riesgosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold italic">No hay riesgos que coincidan con la búsqueda.</div>
            ) : (
              riesgosFiltrados.map((r, index) => {
                const isExpanded = expandedRiesgoId === r.id;
                const zoneInh = getSeverityZone(r.probabilidadInherente, r.impactoInherente);
                const zoneRes = getSeverityZone(r.probabilidadResidual, r.impactoResidual);
                const listaControles = Array.isArray(r.controlesDetallados) ? r.controlesDetallados : [];
                const totalControles = listaControles.length || (r.descripcionControl ? 1 : 0);

                return (
                  <div key={r.id || index} className="transition-all duration-200">
                    
                    {/* FILA COMPACTA PRINCIPAL */}
                    <div 
                      onClick={() => toggleExpediente(r.id)}
                      className={`grid grid-cols-12 gap-3 px-6 py-4 items-center cursor-pointer hover:bg-slate-50 transition-all ${
                        isExpanded ? 'bg-purple-50/20 border-l-4 border-l-purple-600' : ''
                      }`}
                    >
                      {/* ID / PROCESO */}
                      <div className="col-span-2 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-black text-xs text-slate-900">RSK-{String(r.id).substring(0,4)}</span>
                          <span className="text-slate-400 text-xs">🏢</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5 line-clamp-1">
                          {r.proceso || 'Gestión Operativa'}
                        </p>
                        <span className="inline-block mt-1 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Activo
                        </span>
                      </div>

                      {/* RIESGO (DESCRIPCIÓN) */}
                      <div className="col-span-3 pr-2">
                        <span className="inline-block text-[8px] font-black uppercase px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded mb-1">
                          {r.subproceso && r.subproceso !== 'General' ? r.subproceso : (r.categoria || 'Operativo')}
                        </span>
                        <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug">
                          {r.descripcion}
                        </p>
                        <span className="text-[9px] font-bold text-indigo-600 hover:underline mt-0.5 block">Ver más →</span>
                      </div>

                      {/* CLASIFICACIÓN */}
                      <div className="col-span-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1 ${zoneInh.color}`}>
                          {zoneInh.label}
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold">{r.clasificacionRiesgo || 'Operativo'}</p>
                      </div>

                      {/* INHERENTE VS RESIDUAL (TARJETAS LADO A LADO) */}
                      <div className="col-span-2 flex items-center justify-center space-x-2 text-center">
                        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 min-w-[65px]">
                          <span className="text-[8px] font-black text-red-600 block uppercase">{zoneInh.label}</span>
                          <span className="text-[8px] font-mono text-slate-600 font-bold">P: {r.probabilidadInherente || 60}%</span>
                          <span className="text-[8px] font-mono text-slate-600 font-bold block">I: {r.impactoInherente || 80}%</span>
                        </div>
                        <span className="text-slate-300 font-bold text-xs">→</span>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 min-w-[65px]">
                          <span className="text-[8px] font-black text-emerald-700 block uppercase">{zoneRes.label}</span>
                          <span className="text-[8px] font-mono text-slate-600 font-bold">P: {r.probabilidadResidual || 15}%</span>
                          <span className="text-[8px] font-mono text-slate-600 font-bold block">I: {r.impactoResidual || 30}%</span>
                        </div>
                      </div>

                      {/* CONTROLES (DONUT CHART INTEGRADO) */}
                      <div className="col-span-1 flex items-center justify-center space-x-2">
                        <div className="text-center">
                          <span className="text-xs font-black text-slate-900 block">{totalControles}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase">Controles</span>
                        </div>
<EficaciaGauge porcentaje={calcularMitigacionRiesgo(r)} />
                      </div>

                      {/* ANÁLISIS IA */}
                      <div className="col-span-1 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); solicitarAnalisisFilaIA(r); }}
                          className="bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded-lg text-[9px] transition-all flex items-center justify-center gap-1 mx-auto shadow-sm"
                        >
                          ✨ Dictamen IA
                        </button>
<span className="text-[8px] text-slate-400 font-bold mt-1 block">Mitigación: <strong className="text-purple-700">{calcularMitigacionRiesgo(r)}%</strong></span>
                      </div>

                      {/* GESTIÓN */}
                      <div className="col-span-1 flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleEditRiesgo(r)} className="p-1.5 hover:bg-amber-100 text-amber-800 rounded-lg text-xs" title="Editar">✏️</button>
                        {isAdmin && <button onClick={() => handleDeleteRiesgo(r.id)} className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg text-xs" title="Eliminar">🗑️</button>}
                      </div>
                    </div>

{/* ========================================================================= */}
{/* 🚀 EXPEDIENTE SECUNDARIO DE CONTROLES (ACCORDEÓN ANIMADO 250ms)           */}
{/* ========================================================================= */}
{isExpanded && (
  <div className="bg-slate-50/80 border-t border-b border-purple-200 px-8 py-6 transition-all duration-250 ease-in-out animate-in slide-in-from-top-2 space-y-4">
    
    {/* 📊 1. RESUMEN VISUAL SUPERIOR (KPI BAR DEL RIESGO EXPANDIDO) */}
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b pb-2">
        <h4 className="font-black text-[11px] uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <span>🛡️ CONTROLES DEL RIESGO</span>
          <span className="text-[10px] text-purple-600 font-bold">({totalControles} Registrados)</span>
        </h4>
        <span 
          onClick={() => toggleExpediente(r.id)} 
          className="text-[10px] text-purple-700 font-bold cursor-pointer hover:underline"
        >
          ▲ Ocultar Expediente
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <p className="text-[8px] font-black text-slate-400 uppercase">Total</p>
          <p className="text-base font-black text-slate-800">{totalControles}</p>
        </div>
        <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
          <p className="text-[8px] font-black text-blue-600 uppercase">Preventivos</p>
          <p className="text-base font-black text-blue-800">
            {listaControles.filter(c => c.tipo === 'Preventivo').length || 1}
          </p>
        </div>
        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
          <p className="text-[8px] font-black text-amber-600 uppercase">Detectivos</p>
          <p className="text-base font-black text-amber-800">
            {listaControles.filter(c => c.tipo === 'Detectivo').length}
          </p>
        </div>
        <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
          <p className="text-[8px] font-black text-purple-600 uppercase">Correctivos</p>
          <p className="text-base font-black text-purple-800">
            {listaControles.filter(c => c.tipo === 'Correctivo').length}
          </p>
        </div>
        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
          <p className="text-[8px] font-black text-emerald-600 uppercase">Automatizados</p>
          <p className="text-base font-black text-emerald-800">
            {listaControles.filter(c => c.implementacion === 'Automático').length}
          </p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-[8px] font-black text-slate-500 uppercase">Manuales</p>
          <p className="text-base font-black text-slate-700">
            {listaControles.filter(c => c.implementacion === 'Manual').length || totalControles}
          </p>
        </div>
        <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
          <p className="text-[8px] font-black text-indigo-600 uppercase">Eficacia Prom.</p>
<p className="text-base font-black text-indigo-800">
  {listaControles.length > 0 
    ? `${Math.round(listaControles.reduce((acc, c) => acc + calcularEficaciaControl(c), 0) / listaControles.length)}%` 
    : '80%'}
</p>
        </div>
      </div>
    </div>

    {/* 📋 2. TABLA SECUNDARIA COMPLETA DE CONTROLES */}
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-slate-900 text-white font-black uppercase text-[9px] tracking-wider">
            <th className="p-3">ID</th>
            <th className="p-3">Nombre del Control</th>
            <th className="p-3">Tipo</th>
            <th className="p-3">Frecuencia</th>
            <th className="p-3">Responsable</th>
            <th className="p-3 text-center">Documentado</th>
            <th className="p-3 text-center">Automatizado</th>
            <th className="p-3 text-center">Eficacia</th>
            <th className="p-3 text-center">Estado</th>
            <th className="p-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
          {listaControles.length > 0 ? (
            listaControles.map((c, cIdx) => (
              <tr key={cIdx} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-mono font-bold text-[#0A3B32]">CTL-2{cIdx + 1}</td>
                <td className="p-3 font-semibold text-slate-800">{c.descripcion}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    c.tipo === 'Preventivo' ? 'bg-blue-50 text-blue-700' :
                    c.tipo === 'Detectivo' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'
                  }`}>
                    {c.tipo || 'Preventivo'}
                  </span>
                </td>
                <td className="p-3">{c.frecuencia || 'Mensual'}</td>
                <td className="p-3 font-semibold text-slate-600">{r.responsable || 'Coordinador del Proceso'}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${c.documentacion === 'Documentado' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.documentacion === 'Documentado' ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${c.implementacion === 'Automático' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.implementacion === 'Automático' ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="p-3 text-center">
<span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
  {calcularEficaciaControl(c)}%
</span>
                </td>
                <td className="p-3 text-center">
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    Activo
                  </span>
                </td>
                <td className="p-3 text-right space-x-1 whitespace-nowrap">
                  <button className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-bold" title="Ver Control">👁 Ver</button>
                  <button className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[9px] font-bold" title="Editar">✏️ Editar</button>
                  <button className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-[9px] font-bold" title="Analizar con IA">🤖 IA</button>
                  <button className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[9px] font-bold" title="Evidencia">📄 Evidencia</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10" className="p-6 text-center text-slate-400 font-medium italic bg-slate-50/50">
                ⚠️ Este riesgo no cuenta con controles estructurados individualmente. 
                <span className="block text-[10px] text-slate-500 mt-1 font-normal">
                  Control registrado en texto: "{r.descripcionControl || 'Sin descripción de control'}"
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

  </div>
)}     
</div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };               
  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">

      {/* 🛡️ MODAL EXPLICATIVO DE EFICACIA DEL CONTROL (TABLA 6 DEL MANUAL) */}
      {controlSeleccionadoIA && (
        <div className="fixed inset-0 z-[260] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Encabezado */}
            <div className="bg-[#0A3B32] text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 font-mono font-black text-lg">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-xs tracking-wider uppercase">Evaluación de Eficacia del Control</h3>
                  <p className="text-[10px] text-emerald-200/80 font-medium">Según Manual del Sistema Integral de Riesgos (ISO 31000)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setControlSeleccionadoIA(null)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-7 h-7 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4 text-slate-700 text-xs">
              
              {/* Resultado del % */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Eficacia Total Calculada</span>
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Ponderación según atributos del control</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-black font-mono text-emerald-800">
                    {calcularEficaciaControl(controlSeleccionadoIA)}%
                  </span>
                </div>
              </div>

              {/* Tabla con la regla del manual */}
              <div>
                <h4 className="font-black text-slate-500 uppercase tracking-wider text-[9px] mb-2">
                  📊 Desglose según Numeral 8.3.4 (Tabla 6 del Manual):
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2.5">Atributo</th>
                        <th className="p-2.5">Seleccionado</th>
                        <th className="p-2.5 text-right">Aporte</th>
                      </tr>
                    </thead>
<tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">1. Tipo</td>
                        <td className="p-2.5 text-slate-600">{controlSeleccionadoIA.tipo || 'Preventivo'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          +{(controlSeleccionadoIA.tipo || '').includes('Detectivo') ? '15%' : (controlSeleccionadoIA.tipo || '').includes('Correctivo') ? '10%' : '25%'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">2. Ejecución</td>
                        <td className="p-2.5 text-slate-600">{controlSeleccionadoIA.implementacion || 'Manual'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          +{(controlSeleccionadoIA.implementacion || '').includes('Automático') ? '25%' : '15%'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">3. Documentación</td>
                        <td className="p-2.5 text-slate-600">{controlSeleccionadoIA.documentacion || 'Documentado'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          +{(controlSeleccionadoIA.documentacion || '').includes('Documentado') && !(controlSeleccionadoIA.documentacion || '').includes('No documentado') ? '15%' : '0%'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">4. Frecuencia</td>
                        <td className="p-2.5 text-slate-600">{controlSeleccionadoIA.frecuencia || 'Continua'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          +{(controlSeleccionadoIA.frecuencia || '').includes('Aleatoria') || (controlSeleccionadoIA.frecuencia || '').includes('Periódica') ? '5%' : '10%'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-800">5. Evidencia</td>
                        <td className="p-2.5 text-slate-600">{controlSeleccionadoIA.evidencia || 'Con registro'}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                          +{(controlSeleccionadoIA.evidencia || '').includes('Con registro') || (controlSeleccionadoIA.evidencia || '').includes('Trazable') ? '10%' : '0%'}
                        </td>
                      </tr>
                    </tbody>                    
                  </table>
                </div>
              </div>

              {/* Nota metodológica */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-600 leading-relaxed">
                <p className="font-bold text-slate-800 mb-1">📖 Regla del Manual de Riesgos (Termales S.A.):</p>
                "Los controles Preventivos y Automáticos otorgan la ponderación más alta (+30% y +25%) debido a que atacan directamente la causa raíz del riesgo antes de que ocurra el evento."
              </div>

            </div>

            {/* Botón de cierre */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setControlSeleccionadoIA(null)}
                className="px-5 py-2 bg-[#0A3B32] hover:bg-[#062620] text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                Entendido
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🔮 EL POPUP MODAL SUTIL Y ELEGANTE CON BASE EN LA MAQUETA DE FORMATO */}
      {ayudaModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 overflow-hidden relative animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60"></div>
            
            <div className="flex items-center space-x-2 border-b pb-3 relative z-10">
              <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-[10px]">✓</span>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">{ayudaModal.titulo}</h4>
            </div>

            <div className="mt-4 space-y-4 relative z-10 text-xs">
              <div>
                <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">💡 ¿Por qué diligenciarlo?</h5>
                <p className="text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">{ayudaModal.porQue}</p>
              </div>
<div>
                <h5 className="font-black text-[10px] text-emerald-600 uppercase tracking-widest mb-1">📝 Guía Metodológica</h5>
                <div className="text-emerald-950 font-semibold leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  {typeof ayudaModal.ejemplo === 'function' ? ayudaModal.ejemplo() : `"${ayudaModal.ejemplo}"`}
                </div>
              </div>             
            </div>

<div className="mt-6 flex justify-end relative z-10">
              <button
                type="button"
                onClick={() => setAyudaModal(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 👇 Pega desde aquí: 🤖 MODAL PARA MOSTRAR LA INTELIGENCIA ARTIFICIAL 👇 */}
      {(procesandoIA || dictamenIA) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl p-6 overflow-hidden relative max-h-[90vh] flex flex-col">
            
            {/* Encabezado del Modal */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 relative z-10">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <span className="text-2xl">✨</span> {dictamenIA ? dictamenIA.titulo : 'Generando Dictamen Técnico...'}
              </h3>
              <button 
                onClick={() => { setDictamenIA(null); setProcesandoIA(false); }} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 font-black transition-colors"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
            
            {/* Cuerpo del Modal (Scrollable) */}
            <div className="overflow-y-auto flex-1 pr-2 relative z-10">
              {procesandoIA ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="animate-spin text-5xl">⚙️</div>
                  <p className="font-black animate-pulse text-sm text-emerald-700 uppercase tracking-widest">
                    El Motor IA está analizando los datos...
                  </p>
                </div>
              ) : (
                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pb-4">
                  {dictamenIA.dictamen}
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
      {/* CABECERA */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 z-40">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Matriz de Riesgos</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Gestión corporativa integral de riesgos y controles (ISO 31000 - Termales S.A)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setVistaActiva('dashboard')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'dashboard' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📊 Dashboard</button>
          <button onClick={() => setVistaActiva('matriz')} className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${vistaActiva === 'matriz' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>📋 Ver Matriz</button>
          {isAdmin && (
            <button onClick={() => { setEditRiesgo(null); setVistaActiva('nuevo'); }} className="px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-md bg-[#0A3B32] text-white hover:bg-[#062620]">
              <span className="mr-2">➕</span> Nuevo Riesgo
            </button>
          )}
        </div>
      </div>

      {vistaActiva === 'dashboard' && renderDashboard()}
      {vistaActiva === 'matriz' && renderMatriz()}

      {vistaActiva === 'nuevo' && (
        <form onSubmit={handleRiesgoSubmit} className="space-y-6">
          
          {/* DATOS GENERALES EXTENDIDOS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">1. Datos Generales de la Fila</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* 🌟 AQUÍ ESTÁ EL NUEVO CONTENEDOR LADO A LADO PARA MACRO Y SUBPROCESO */}
              <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <LabelConPalomita idCampo="proceso" />
                  <select 
                    value={macroproceso} 
                    onChange={handleMacroprocesoChange} 
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] bg-white font-bold text-slate-800"
                  >
                    <option value="" disabled>Seleccione...</option>
                    {listadoMacros.map(macro => (
                      <option key={macro} value={macro}>{macro}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 mt-1">
                    Subproceso Específico
                  </label>
                  <select 
                    value={subproceso} 
                    onChange={(e) => setSubproceso(e.target.value)} 
                    disabled={!tieneSubprocesosReales || !macroproceso}
                    className={`w-full text-xs p-2 border rounded-lg transition-colors ${
                      (!tieneSubprocesosReales || !macroproceso)
                        ? 'bg-slate-100 cursor-not-allowed border-slate-200 text-slate-400' 
                        : 'bg-white border-slate-300 text-slate-800 font-semibold focus:ring-2 focus:ring-[#0A3B32]'      
                    }`}
                  >
                    {!macroproceso && <option value="">Esperando selección...</option>}
                    {macroproceso && subprocesosDisponibles.map(sub => (
                      <option key={sub} value={sub}>
                        {!tieneSubprocesosReales && sub === "General" ? "No aplica subdivisión" : sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <LabelConPalomita idCampo="categoria" />
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">                  
                  <option value="">Seleccione...</option>
                  <option value="Estratégico">Estratégico</option>
                  <option value="Operativo">Operativo</option>
                  <option value="Cumplimiento">Cumplimiento</option>
                  <option value="Financiero">Financiero</option>
                  <option value="Tecnológico">Tecnológico</option>
                </select>
              </div>
              
              <div>
                <LabelConPalomita idCampo="clasificacion" />
                <select value={clasificacionRiesgo} onChange={(e) => setClasificacionRiesgo(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  {CLASIFICACIONES_MANUAL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="normativa" />
                <input type="text" value={normativa} onChange={(e) => setNormativa(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" placeholder="Ej. ISO 31000..." />
              </div>
              
              {/* 🏢 SELECTOR MÚLTIPLE: SEDES AFECTADAS */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Sedes Afectadas</label>
                <select 
                  value={sedeTemp} 
                  onChange={(e) => { 
                    const nuevaSede = e.target.value;
                    if(nuevaSede && !sedeForm.includes(nuevaSede)) {
                      setSedeForm([...sedeForm, nuevaSede]);
                    }
                    setSedeTemp(''); 
                  }} 
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 bg-white mb-2"
                >
                  <option value="">-- Añadir Sede --</option>
                  {Object.keys(CARGOS_POR_SEDE).map(s => (
                    <option key={s} value={s} disabled={sedeForm.includes(s)}>{s}</option>
                  ))}
                </select>

                {/* 🏷️ CHIPS DE SEDES */}
                <div className="flex flex-wrap gap-2 min-h-[32px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                  {sedeForm.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Seleccione al menos una sede...</span>}
                  {sedeForm.map(s => (
                    <span key={s} className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                      {s} 
                      {sedeForm.length > 1 && (
                        <button type="button" onClick={() => setSedeForm(sedeForm.filter(item => item !== s))} className="ml-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* 👥 SELECTOR MÚLTIPLE: DUEÑO DEL PROCESO (AGRUPADO POR SEDES SELECCIONADAS) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 md:col-span-2 lg:col-span-3">
                <LabelConPalomita idCampo="responsable" />
                <div className="flex gap-2 mb-2 md:w-1/2">
                  <select value={responsableTemp} onChange={(e) => setResponsableTemp(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] bg-white">
                    <option value="">-- Escoger Líder --</option>
                    {/* Iteramos sobre TODAS las sedes seleccionadas para extraer sus líderes */}
                    {sedeForm.map(sedeSeleccionada => (
                      <optgroup key={sedeSeleccionada} label={`📍 ${sedeSeleccionada}`}>
                        {(CARGOS_POR_SEDE[sedeSeleccionada] || []).map(cargo => (
                          <option key={cargo} value={cargo} disabled={responsablesMultiples.includes(cargo)}>
                            {cargo}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button type="button" onClick={() => { if(responsableTemp && !responsablesMultiples.includes(responsableTemp)) setResponsablesMultiples([...responsablesMultiples, responsableTemp]); setResponsableTemp(''); }} className="bg-[#0A3B32] text-white px-4 rounded-lg text-xs font-bold hover:bg-[#062620] shrink-0 transition-colors shadow-sm">➕ Añadir</button>
                </div>
                
                {/* 🏷️ CHIPS DE SELECCIÓN MÚLTIPLE */}
                <div className="flex flex-wrap gap-2 mt-2 min-h-[32px] p-2 bg-white border border-dashed border-slate-300 rounded-lg items-center">
                  {responsablesMultiples.length === 0 && <span className="text-[10px] text-slate-400 italic font-medium w-full text-center">Ningún responsable añadido aún...</span>}
                  {responsablesMultiples.map(r => (
                    <span key={r} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center shadow-sm">
                      {r} 
                      <button type="button" onClick={() => setResponsablesMultiples(responsablesMultiples.filter(item => item !== r))} className="ml-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                    </span>
                  ))}
                </div>
              </div> 
            </div>
          </div>

          {/* SINTAXIS OBLIGATORIA */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">2. Estructura y Redacción (Mandato del Manual)</h3>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <LabelConPalomita idCampo="afectacion" />
                <select value={afectacion} onChange={e => setAfectacion(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value="Económico">Económico</option>
                  <option value="Reputacional">Reputacional</option>
                  <option value="Económico-Reputacional">Económico-Reputacional</option>
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="causaInmediata" />           
                <textarea
                  rows="2"
                  value={causaInmediata}
                  onChange={e => setCausaInmediata(e.target.value)}
                  placeholder="¿Qué pasa en la operación?"
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] resize-y"
                />
              </div>
              <div>
                <LabelConPalomita idCampo="causaRaiz" />
                <textarea
                  rows="2"
                  value={causaRaiz}
                  onChange={e => setCausaRaiz(e.target.value)}
                  placeholder="¿Por qué se origina el fallo?"
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] resize-y"
                />
              </div>
            </div>
            <div className="bg-[#f0fdf4] border border-emerald-200 p-3 rounded-lg">
              <label className="text-[9px] font-black text-emerald-800 uppercase block mb-1">Texto Final para el Escenario (Bloqueado)</label>
              <p className="text-xs font-medium text-emerald-900">{descripcionAutomatica}</p>
            </div>
          </div>

          {/* MATRIZ DE CALOR INHERENTE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">3. Nivel de Riesgo Inherente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LabelConPalomita idCampo="probInh" />
                <select value={probInherente} onChange={e => setProbInherente(Number(e.target.value))} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value={20}>Muy Baja (20%)</option>
                  <option value={40}>Baja (40%)</option>
                  <option value={60}>Media (60%)</option>
                  <option value={80}>Alta (80%)</option>
                  <option value={100}>Muy Alta (100%)</option>
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="impInh" />
                <select value={impInherente} onChange={e => setImpInherente(Number(e.target.value))} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value={20}>Leve (20%)</option>
                  <option value={40}>Menor (40%)</option>
                  <option value={60}>Moderado (60%)</option>
                  <option value={80}>Mayor (80%)</option>
                  <option value={100}>Catastrófico (100%)</option>
                </select>
              </div>
            </div>
          </div>

          {/* BLOQUE DINÁMICO CON LAS 5 CASILLAS METODOLÓGICAS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">4. Evaluación de Solidez de Controles (5 Variables)</h3>
              <button type="button" onClick={() => setControles([...controles, { descripcion: '', tipo: 'Preventivo', implementacion: 'Manual', documentacion: 'Documentado', frecuencia: 'Continua', evidencia: 'Con registro' }])} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-200 transition-colors">➕ Agregar Control</button>
            </div>
{controles.map((ctrl, idx) => (
  <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 relative mt-6">
    
    {/* 🏷️ ETIQUETA VISUAL + BOTÓN DE CÁLCULO DE EFICACIA */}
    <div className="flex justify-between items-center">
      <div className="absolute -top-3 left-4 bg-[#0A3B32] text-white font-black text-[10px] px-3 py-1 rounded-md shadow-sm uppercase tracking-widest border border-[#062620]">
        Control C{idx + 1}
      </div>

      {/* 📊 BOTÓN CHULITO VERDE QUE ABRE EL DESGLOSE */}
      <button
        type="button"
        onClick={() => setControlSeleccionadoIA(ctrl)}
        className="ml-auto text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm transition-all transform hover:scale-105 cursor-pointer"
        title="Ver desglose de eficacia según el Manual de Riesgos"
      >
        <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">✓</span>
        <span>Ver Eficacia ({calcularEficaciaControl(ctrl)}%)</span>
      </button>
    </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">            
<div className="md:col-span-11">
                    <LabelConPalomita idCampo="controlDesc" />
                    <textarea
                      rows="3"
                      value={ctrl.descripcion}
                      onChange={(e) => { const nuevos = [...controles]; nuevos[idx].descripcion = e.target.value; setControles(nuevos); }}
                      className="w-full text-xs p-2 border bg-white rounded-lg focus:ring-2 focus:ring-[#0A3B32] resize-y"
                      placeholder="Describa la tarea completa del control..."
                    />
                  </div>                  
                  <div className="md:col-span-1 flex justify-center">
                    <button type="button" onClick={() => setControles(controles.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-widest bg-red-50 border border-red-200 px-3 py-2 rounded-xl transition-colors">🗑️ Borrar</button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Tipo</label>
                    <select value={ctrl.tipo} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].tipo = e.target.value; setControles(nuevos); }} className="w-full text-[11px] p-1.5 border bg-white rounded-md">
                      <option value="Preventivo">Preventivo (Foco Probabilidad)</option>
                      <option value="Detectivo">Detectivo (Foco Desviación)</option>
                      <option value="Correctivo">Correctivo (Foco Impacto)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Ejecución</label>
                    <select value={ctrl.implementacion} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].implementacion = e.target.value; setControles(nuevos); }} className="w-full text-[11px] p-1.5 border bg-white rounded-md">
                      <option value="Automático">Automático</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Documentación</label>
                    <select value={ctrl.documentacion} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].documentacion = e.target.value; setControles(nuevos); }} className="w-full text-[11px] p-1.5 border bg-white rounded-md">
                      <option value="Documentado">Documentado</option>
                      <option value="No documentado">No documentado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Frecuencia</label>
                    <select value={ctrl.frecuencia} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].frecuencia = e.target.value; setControles(nuevos); }} className="w-full text-[11px] p-1.5 border bg-white rounded-md">
                      <option value="Continua">Continua / Permanente</option>
                      <option value="Aleatoria">Aleatoria / Periódica</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-0.5">Soporte Evidencia</label>
                    <select value={ctrl.evidencia} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].evidencia = e.target.value; setControles(nuevos); }} className="w-full text-[11px] p-1.5 border bg-white rounded-md">
                      <option value="Con registro">Con registro / Trazable</option>
                      <option value="Sin registro">Sin registro</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* TRATAMIENTO Y SEGUIMIENTO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">5. Monitoreo, Tratamiento y Mitigación Temporal</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Estrategia de Tratamiento</label>
                <select value={tratamiento} onChange={e => setTratamiento(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value="Reducir el riesgo">Reducir el riesgo (Mitigar)</option>
                  <option value="Asumir el riesgo">Asumir el riesgo (Aceptar)</option>
                  <option value="Transferir el riesgo">Transferir el riesgo (Compartir)</option>
                  <option value="Evitar el riesgo">Evitar el riesgo (Eliminar actividad)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Plan de Acción de Control Interno</label>
                <input type="text" value={planAccionRiesgo} onChange={e => setPlanAccionRiesgo(e.target.value)} placeholder="Ej: Implementar póliza de cumplimiento..." className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Próxima Fecha de Seguimiento</label>
                <input type="date" value={fechaSeguimiento} onChange={e => setFechaSeguimiento(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bitácora de Observaciones y Seguimiento Activo</label>
              <textarea value={seguimientoBitacora} onChange={e => setSeguimientoBitacora(e.target.value)} rows="2" placeholder="Notas de auditoría sobre el comportamiento de este riesgo..." className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]"></textarea>
            </div>
          </div>

          {/* CALCULADORA RESIDUAL */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest border-b border-slate-700 pb-2">6. Resultados de Mitigación (Cálculo Multivariable)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LabelConPalomita idCampo="probRes" dark={true} />
                <input type="text" value={`${residuales.probabilidad}%`} disabled className="w-full text-xs p-2 border border-slate-600 rounded-lg bg-slate-800 text-emerald-400 font-black text-center cursor-not-allowed" />
              </div>
              <div>
                <LabelConPalomita idCampo="impRes" dark={true} />
                <input type="text" value={`${residuales.impacto}%`} disabled className="w-full text-xs p-2 border border-slate-600 rounded-lg bg-slate-800 text-emerald-400 font-black text-center cursor-not-allowed" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button type="button" onClick={() => setVistaActiva('dashboard')} className="mr-3 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-md disabled:opacity-50">
              {isSubmitting ? 'Guardando...' : (editRiesgo ? 'Actualizar Matriz' : 'Guardar en la Nube')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}