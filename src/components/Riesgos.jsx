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
    ejemplo: (
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-[10px]">
          <tbody className="divide-y divide-emerald-200/50">
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900 w-1/3">Ejecución y adm. de procesos</td>
              <td className="p-2 text-slate-700">Pérdidas derivadas de errores en la ejecución y la administración de procesos.</td>
            </tr>
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900">Fraude Externo</td>
              <td className="p-2 text-slate-700">Pérdida derivada de actos de fraude por personas ajenas a la organización (No participa personal de empresa).</td>
            </tr>
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900">Fraude Interno</td>
              <td className="p-2 text-slate-700">Pérdida debido a actos de fraude, actuaciones irregulares, hechos delictivos, abuso de confianza... por personal interno.</td>
            </tr>
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900">Fallas Tecnológicas</td>
              <td className="p-2 text-slate-700">Errores en Hardware, Software, telecomunicaciones, interrupción de servicios básicos.</td>
            </tr>
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900">Relaciones Laborales</td>
              <td className="p-2 text-slate-700">Pérdidas por acciones contrarias a las leyes, demandas por daños personales o discriminación.</td>
            </tr>
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900">Usuarios, productos y practicas</td>
              <td className="p-2 text-slate-700">Fallas negligentes o involuntarias que impidan satisfacer una obligación frente a usuarios.</td>
            </tr>
            <tr className="hover:bg-emerald-50">
              <td className="p-2 font-bold text-emerald-900">Daños a activos fijos/ eventos externos</td>
              <td className="p-2 text-slate-700">Pérdidas por desastres naturales, atentados, vandalismo u orden público.</td>
            </tr>
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

export default function Riesgos({ isAdmin, safeRiesgos, setRiesgos, saveToCloud, showNotification }) {
  // 🤖 ESTADOS PARA EL DICTAMEN DE INTELIGENCIA ARTIFICIAL EN EL DASHBOARD
  const [dictamenIA, setDictamenIA] = useState(null);
  const [procesandoIA, setProcesandoIA] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      let weight = 0;
      
      // 1. Tipo de Control según Manual (Tabla 6)
      if (c.tipo === 'Preventivo') weight += 0.25;
      else if (c.tipo === 'Detectivo') weight += 0.15;
      else if (c.tipo === 'Correctivo') weight += 0.10;

      // 2. Implementación según Manual (Tabla 6)
      if (c.implementacion === 'Automático') weight += 0.25;
      else if (c.implementacion === 'Manual') weight += 0.15;

      // 3. Documentación según Manual (Tabla 6)
      if (c.documentacion === 'Documentado') weight += 0.15;

      // 4. Aplicación a Probabilidad o Impacto (Gráfica 9)
      if (c.tipo === 'Correctivo') {
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
      const textoControlesConsolidados = controles.map(c => `🔹 [${c.tipo}] ${c.descripcion} (${c.documentacion} - ${c.frecuencia})`).join('\n');

      const nuevoRiesgo = {
        ...(editRiesgo || {}),
        id: editRiesgo ? editRiesgo.id : crypto.randomUUID(),
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
        mes: "Junio",
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

    const solicitarDictamenIA = () => {
      setProcesandoIA(true);
      setDictamenIA(null);

      setTimeout(() => {
        let textoDictamen = "";
        
        if (topProcesos.length === 0) {
          textoDictamen = "Aún no hay riesgos registrados en el sistema para realizar un análisis de exposición cruzada.";
        } else if (topProcesos.length === 1) {
          textoDictamen = `El 100% de la carga de exposición recae sobre el proceso de **${topProcesos[0][0]}** con ${topProcesos[0][1]} riesgos mapeados. Se sugiere urgente diversificar la identificación de riesgos en el resto de los departamentos de Termales S.A.`;
        } else {
          const procesoCritico1 = topProcesos[0];
          const procesoCritico2 = topProcesos[1];
          const sumaCritica = procesoCritico1[1] + procesoCritico2[1];
          const porcentaje = Math.round((sumaCritica / totalRiesgos) * 100);

          textoDictamen = `Actualmente, **${procesoCritico1[0]}** (${procesoCritico1[1]} riesgos) y **${procesoCritico2[0]}** (${procesoCritico2[1]} riesgos) concentran el **${porcentaje}%** de toda la exposición operativa del hotel. Se sugiere a la Gerencia priorizar el presupuesto de auditoría y los planes de mitigación (capacitaciones, mantenimiento) sobre estos dos frentes antes de la temporada alta, ya que representan el mayor cuello de botella estructural.`;
        }

        setDictamenIA({
          titulo: "Análisis de Focos de Exposición",
          dictamen: textoDictamen,
        });
        setProcesandoIA(false);
      }, 800);
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
    return (
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Matriz de Riesgos Corporativa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left divide-y">
            <thead className="bg-slate-900 text-white font-bold text-[10px] uppercase">
              <tr>
                <th className="p-3">ID / Proceso</th>
                <th className="p-3 w-64">Clasificación y Escenario de Riesgo</th>
                <th className="p-3 text-center">Inherente</th>
                <th className="p-3 text-center">Residual</th>
                <th className="p-3">Controles Mitigantes</th>
                <th className="p-3">Monitoreo / Tratamiento</th>
                <th className="p-3 text-center">Análisis IA</th>
                <th className="p-3 text-center">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {safeRiesgos.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-400 font-bold italic">No hay riesgos registrados.</td></tr>
              ) : (
                safeRiesgos.map((r, index) => {
                  const zoneInh = getSeverityZone(r.probabilidadInherente, r.impactoInherente);
                  const zoneRes = getSeverityZone(r.probabilidadResidual, r.impactoResidual);
                  return (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-black text-slate-900">RSK-{String(r.id).substring(0,4)}</div>
                        <div className="font-bold text-[#0A3B32] text-[10px] mt-0.5">{r.proceso}</div>
                        {/* 🌟 Muestra el subproceso en letras pequeñas si aplica */}
                        {r.subproceso && r.subproceso !== 'General' && (
                          <div className="font-medium text-slate-500 text-[9px] mt-0.5">↳ {r.subproceso}</div>
                        )}
                      </td>
                      <td className="p-3 leading-tight">
                        <span className="bg-slate-100 text-slate-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase block w-max mb-1">{r.clasificacionRiesgo || 'General'}</span>
                        <div className="text-[10px] text-slate-800 font-medium">{r.descripcion}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded font-black text-[9px] uppercase ${zoneInh.color}`}>{zoneInh.label}</span>
                        <div className="text-[8px] text-slate-400 mt-1 font-bold">P:{r.probabilidadInherente}% | I:{r.impactoInherente}%</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded font-black text-[9px] uppercase shadow-sm ${zoneRes.color}`}>{zoneRes.label}</span>
                        <div className="text-[8px] text-slate-400 mt-1 font-bold">P:{r.probabilidadResidual}% | I:{r.impactoResidual}%</div>
                      </td>
                      <td className="p-3 text-[9px] whitespace-pre-wrap leading-tight text-slate-500 font-mono">{r.descripcionControl || 'Sin controles asignados'}</td>
                      <td className="p-3 text-[10px] leading-snug">
                        <div className="font-black text-slate-700">🎯 {r.tratamiento || 'Sin tratamiento'}</div>
                        {r.planAccionRiesgo && <div className="text-slate-500 mt-0.5 text-[9px]"><span className="font-bold">Plan:</span> {r.planAccionRiesgo}</div>}
                        {r.fechaSeguimiento && <div className="text-[8px] font-black text-blue-600 mt-1">📅 Seg: {r.fechaSeguimiento}</div>}
                      </td>
                      
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => solicitarAnalisisFilaIA(r)}
                          className="bg-purple-50 text-purple-700 border border-purple-200 font-bold px-3 py-1.5 rounded-lg text-[10px] hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1.5 mx-auto shadow-sm group"
                        >
                          <span className="group-hover:scale-110 transition-transform">✨</span> Analizar
                        </button>
                      </td>

                      <td className="p-3 text-center flex flex-col space-y-1">
                        <button onClick={() => handleEditRiesgo(r)} className="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">Editar</button>
                        {isAdmin && <button onClick={() => handleDeleteRiesgo(r.id)} className="bg-red-50 text-red-700 font-bold px-2 py-1 rounded text-[10px]">Eliminar</button>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 relative">
      
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
                  {typeof ayudaModal.ejemplo === 'string' ? `"${ayudaModal.ejemplo}"` : ayudaModal.ejemplo}
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
              <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 relative">
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