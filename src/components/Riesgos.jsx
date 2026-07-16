import React, { useState } from 'react';

const PROCESOS_OFICIALES = [
  "Gestión comercial",
  "Gestión de la mejora continua (SIGCAS)",
  "Gestión de mercadeo y comunicaciones",
  "Gestión de servicio al cliente",
  "Gestión estratégica",
 "Gestión de Operaciones",
"Gestión Administrativa y Financiera ",
"Gestión Talento Humano ",
  "I+D+i",
  "Subproceso alojamiento",
  "Subproceso alimentos y bebidas",
  "Subproceso compras",
  "Subproceso desarrollo de competencias",
  "Subproceso gestión administrativa",
  "Subproceso gestión de almacenes",
  "Subproceso gestión de cartera",
  "Subproceso gestión de contabilidad",
  "Subproceso gestión de costos",
  "Subproceso gestión de inventarios",
  "Subproceso gestión de tesorería",
  "Subproceso gestión del bienestar y la compensación",
  "Subproceso gestionar los activos fijos de la empresa",
  "Subproceso mantenimiento",
  "Subproceso recreación",
"Subproceso Seguridad y salud en trabajo",
"Subproceso Gestion de calidad",
"Subproceso Gestión Ambiental",
"Subproceso Control interno y Gestion de riesgos",
"Subproceso Proteccion de datos personales",
  "Subproceso selección, vinculación y administración de colaboradores",
  "Tecnologías de la información y la comunicación"
];

// 🏢 DICCIONARIO INTELIGENTE EN CASCADA (SEDE -> CARGOS)
const CARGOS_POR_SEDE = {
  "Hotel": [
    "Líderes Hotel",
    "Subdirector de Operaciones Hotel",
    "Líder de Proceso de alimentos y bebidas",
    "Chef Hotel",
    "Supervisor (a) mesa y servicio",
    "Coordinación de recepción",
    "Supervisor (a) de operaciones",
    "Coordinación SPA",
    "Coordinador de Mantenimiento"
  ],
  "Ecoparque": [
    "Líderes Ecoparque",
    "Subdirección de Operaciones Balneario",
    "Líder táctico de alimentos y bebidas",
    "Jefe de Cocina",
    "Supervisor (a) mesa y servicio",
    "Coordinador Operaciones",
    "Supervisor Operaciones",
    "Coordinación SPA",
    "Terapeuta SPA",
    "Coordinador de mantenimiento",
    "Supervisor Ruta Ecológica"
  ],
  "Administrativos": [
    "Administrativos",
    "Gerente Administrativa y Judicial",
    "Auditoría Interna",
    "Líder Táctico de mejora Continua",
    "Coordinador de Servicio al Cliente",
    "Dirección Administrativa y Financiera",
    "Líder de de Compras y Almacen",
    "Líder de Costos y Presupuestos",
    "Líder de Tesorería y Cartera",
    "Contadora de Socios",
    "Coordinación Administrativa Family Office",
    "Jefe de control interno",
    "Líder de Contabilidad",
    "Contador",
    "Líder Administrativa",
    "Dirección de Mercadeo y Comunicaciones",
    "Coordinación de Mercadeo y Comunicaciones",
    "Dirección Comercial",
    "Coordinación Comercial y Contact Center",
    "Dirección Talento Humano",
    "Coordinación Seguridad Y Salud en el trabajo",
    "Líder de Gestión Ambiental",
    "Lider Tactico de Infraestructura Tecnológica",
    "Director de TICS",
    "Desarrollador Junior",
    "Líder Táctico desarrollo de Software",
    "Coordinador de Marketing digital"
  ]
};

const CLASIFICACIONES_MANUAL = [
  "Ejecución y administracion del proceso", "Fraude interno", "Usuarios, productos y practicas", 
  "Fallas tecnologicas", "Daños a activos fisicos", "Relaciones laborales y seguridad en el puesto de trabajo"
];

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
    titulo: "Clasificación COSO / Manual",
    porQue: "Mandato directo de la Guía de Administración del Riesgo V5. Sirve para tipificar la naturaleza exacta de la falla humana, de procesos o del entorno para generar planes de choque estandarizados.",
    ejemplo: "Si un colaborador extrae dinero o activos de la caja de forma intencional con ánimo de lucro, se clasifica como 'Fraude interno'."
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
  const [proceso, setProceso] = useState(PROCESOS_OFICIALES[0]);
  const [categoria, setCategoria] = useState('');
  const [clasificacionRiesgo, setClasificacionRiesgo] = useState(CLASIFICACIONES_MANUAL[0]);
  const [normativa, setNormativa] = useState('');
const [sedeForm, setSedeForm] = useState('Administrativos');
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
      if (c.tipo === 'Preventivo') weight += 0.20;
      else if (c.tipo === 'Detectivo') weight += 0.12;
      else if (c.tipo === 'Correctivo') weight += 0.08;

      if (c.implementacion === 'Automático') weight += 0.10;
      else if (c.implementacion === 'Manual') weight += 0.05;

      if (c.documentacion === 'Documentado') weight += 0.05;
      if (c.frecuencia === 'Continua') weight += 0.05;
      if (c.evidencia === 'Con registro') weight += 0.05;

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
    // 1. Convertir a número por seguridad
    let p = Number(prob) || 1;
    let i = Number(imp) || 1;
    
    // 2. Si vienen como porcentajes (20, 40, 60, 80, 100), los convertimos a la escala 1-5
    if (p > 5) p = Math.ceil(p / 20);
    if (i > 5) i = Math.ceil(i / 20);
    
    // 3. Aplicar la lógica exacta de la matriz 5x5
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
  const handleEditRiesgo = (riesgo) => {
    setEditRiesgo(riesgo);
    setRiesgoId(riesgo.id);
    
    // 🏢 Recuperar Sede
    setSedeForm(riesgo.sede || 'Administrativos');
    
    setProceso(riesgo.proceso);
    setCategoria(riesgo.categoria);
    setClasificacionRiesgo(riesgo.clasificacionRiesgo || CLASIFICACIONES_MANUAL[0]);
    setNormativa(riesgo.normativa);
    
    // 👥 Recuperar Múltiples Responsables
    if (riesgo.responsable) {
      // Si ya venía como arreglo (versiones nuevas)
      if (Array.isArray(riesgo.responsable)) {
        setResponsablesMultiples(riesgo.responsable);
      } 
      // Si venía como texto separado por comas (versión de transición)
      else if (riesgo.responsable.includes(',')) {
        setResponsablesMultiples(riesgo.responsable.split(',').map(r => r.trim()));
      } 
      // Si venía como un solo texto (versiones antiguas)
      else if (riesgo.responsable !== 'Sin Asignar') {
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
    setTimeout(scrollToForm, 100);
  };
  
  const handleRiesgoSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const ts = new Date().toLocaleString();

    try {
      let updatedList = [...safeRiesgos];
      const textoControlesConsolidados = controles.map(c => `🔹 [${c.tipo}] ${c.descripcion} (${c.documentacion} - ${c.frecuencia})`).join('\n');

      const nuevoRiesgo = {
        ...(editRiesgo || {}), // 🛡️ EL BLINDAJE: Esto obliga al sistema a "recordar" y heredar los datos financieros del Apetito antes de sobreescribir.
        id: editRiesgo ? editRiesgo.id : crypto.randomUUID(),
        sede: sedeForm,
        proceso,
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

  // 🏷️ COMPONENTE INTERNO REUTILIZABLE PARA TITULOS CON LA PALOMITA DE INFORMACIÓN
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

    // 🤖 FUNCIÓN REACTIVA DE LA IA PARA LEER LAS BARRAS
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
        
        {/* ─── 🤖 CAPA DE ENFOQUE INTELIGENTE (FIXED BACKDROP BLUR) ─── */}
        {(procesandoIA || dictamenIA) && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            
            {/* Carga Animada Inline */}
            {procesandoIA && (
              <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl flex items-center gap-4 shadow-2xl max-w-xl border-l-4 border-l-blue-500 scale-100 transition-transform">
                <span className="text-2xl animate-spin">🤖</span>
                <div className="text-xs">
                  <span className="font-black text-white block uppercase tracking-wider text-[11px] mb-0.5">GCM Auditor v5 IA Assistant</span>
                  <span className="text-slate-400 font-medium">Analizando barras de concentración y cruzando estadísticas operativas...</span>
                </div>
              </div>
            )}

            {/* Recuadro de Resultados Nítido */}
            {dictamenIA && (
              <div className="bg-[#0f172a] border border-slate-800 p-6 rounded-3xl shadow-2xl max-w-2xl relative border-l-4 border-l-emerald-500 w-full">
                <button onClick={() => setDictamenIA(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider bg-[#1e293b] px-2.5 py-1 rounded-xl transition-colors">✕ Cerrar</button>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🤖</span>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dictamen de Inteligencia Artificial para Gerencia</h4>
                </div>

                <h3 className="text-sm font-black text-white uppercase tracking-tight mb-4 border-b border-slate-800/80 pb-2.5">
                  {dictamenIA.titulo}
                </h3>

                <div className="text-emerald-300 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 text-xs leading-relaxed font-medium">
                  <b className="text-emerald-400 uppercase block text-[9px] mb-1.5 tracking-wider">🎯 Diagnóstico Estratégico:</b> 
                  <span dangerouslySetInnerHTML={{ __html: dictamenIA.dictamen.replace(/\*\*(.*?)\*\*/g, '<b class="text-white bg-emerald-900/40 px-1 py-0.5 rounded">$1</b>') }}></span>
                </div>
              </div>
            )}
            
          </div>
        )}

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
                <h5 className="font-black text-[10px] text-emerald-600 uppercase tracking-widest mb-1">📝 Ejemplo Metodológico (Termales)</h5>
                <p className="text-emerald-950 font-semibold leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 italic">"{ayudaModal.ejemplo}"</p>
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
              <div>
                <LabelConPalomita idCampo="proceso" />
                <select value={proceso} onChange={(e) => setProceso(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  {PROCESOS_OFICIALES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="categoria" />
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]" required>
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
              
              {/* 🏢 SELECTOR EN CASCADA: SEDE */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Sede Afectada</label>
                <select value={sedeForm} onChange={(e) => { setSedeForm(e.target.value); setResponsableTemp(''); }} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-900 bg-white">
                  {Object.keys(CARGOS_POR_SEDE).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* 👥 SELECTOR MÚLTIPLE: DUEÑO DEL PROCESO */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 md:col-span-2">
                <LabelConPalomita idCampo="responsable" />
                <div className="flex gap-2 mb-2">
                  <select value={responsableTemp} onChange={(e) => setResponsableTemp(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] bg-white">
                    <option value="">-- Escoger de {sedeForm} --</option>
                    {CARGOS_POR_SEDE[sedeForm].map(cargo => (
                      <option key={cargo} value={cargo} disabled={responsablesMultiples.includes(cargo)}>{cargo}</option>
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
                  required
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
                  required
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
                      required
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
                    <select value={ctrl.evidence} onChange={(e) => { const nuevos = [...controles]; nuevos[idx].evidencia = e.target.value; setControles(nuevos); }} className="w-full text-[11px] p-1.5 border bg-white rounded-md">
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