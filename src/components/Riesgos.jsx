import { Fragment, useEffect, useState } from 'react';
import { Ban, History, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation.js';
import { ThinkingOrb } from 'thinking-orbs';
import { 
  CLASIFICACIONES_MANUAL,
  MAPA_PROCESOS as MAPA_PROCESOS_PREDETERMINADO,
} from '../constants/diccionariosGRC';
import { useCatalogos } from '../context/useCatalogos';
import { leerPuente, retirarDelPuente } from '../services/navigationBridge.js';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard.js';
import { consultarPanelIA } from '../services/aiEngine';
import { armarPanelIA, contextoMatriz, contextoRiesgo } from '../utils/contextoIARiesgos.js';
import { apiService } from '../services/apiService';
import ModalIA from '../components/ModalIA';
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, nivelEscala, riesgoEnPorcentaje, zonaPorNiveles, zonaSeveridad } from '../utils/nivelRiesgo.js';
import { anular, entradaHistorial, estaAnulado, MOTIVOS_ANULACION, reactivar, validarMotivo, vigentes } from '../utils/anulacion.js';
import { clasificacionDeRiesgo, normalizarClasificacion } from '../utils/clasificacionRiesgo.js';
import { fechaEntradaHistorial } from '../utils/fechaHistorial.js';
import { analizarControlEnRiesgo, explicarRiesgoDetallado, pruebasDeCampoDelRiesgo } from '../utils/explicacionRiesgoDetallada.js';
import { CRITERIOS_CUMPLIMIENTO, cumplimientoNumeral9, incumpleCriterio } from '../utils/cumplimientoManual.js';
import { explicarControlesRegistrados, explicarEficaciaPromedio, explicarExposicionPorProceso, explicarMayorExposicion, explicarMitigacionPromedio, explicarSeguimientos } from '../utils/explicacionDashboardRiesgos.js';
import { calcularEficaciaControl, codigoControl, desglosarEficaciaControl, explicarCalculoResidual, explicarControl, tonoDiseno } from '../utils/explicacionControles.js';

const normalizarTextoProceso = valor => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const convertirCampoProcesoEnLista = valor => (
  Array.isArray(valor)
    ? valor.map(item => String(item || '').trim()).filter(Boolean)
    : String(valor || '').split(',').map(item => item.trim()).filter(Boolean)
);

const resolverNombreCatalogo = (valor, opciones) => {
  const textoNormalizado = normalizarTextoProceso(valor);
  return opciones.find(opcion => normalizarTextoProceso(opcion) === textoNormalizado) || String(valor || '').trim();
};

const obtenerClaveNormalizada = (objeto, clave) => Object.keys(objeto || {}).find(nombre => (
  normalizarTextoProceso(nombre) === normalizarTextoProceso(clave)
));

const normalizarUbicacionRiesgo = (riesgo, mapaProcesos) => {
  const partesProcesoLegado = String(riesgo.proceso || '').split('/').map(parte => parte.trim()).filter(Boolean);
  const macroprocesosGuardados = convertirCampoProcesoEnLista(riesgo.macroprocesos);
  const candidatosMacroproceso = macroprocesosGuardados.length > 0
    ? macroprocesosGuardados
    : convertirCampoProcesoEnLista(riesgo.macroproceso || partesProcesoLegado[0] || 'Sin proceso');
  const nombresMacroproceso = Object.keys(mapaProcesos || {});
  const macroprocesos = [...new Set(candidatosMacroproceso.map(macroproceso => {
    const parteMacroproceso = String(macroproceso || '').split('/')[0].trim();
    return resolverNombreCatalogo(parteMacroproceso, nombresMacroproceso) || 'Sin proceso';
  }))];
  const relacionesGuardadas = riesgo.subprocesosPorMacroproceso && typeof riesgo.subprocesosPorMacroproceso === 'object'
    ? riesgo.subprocesosPorMacroproceso
    : {};
  const subprocesosLegados = convertirCampoProcesoEnLista(riesgo.subprocesos).length > 0
    ? convertirCampoProcesoEnLista(riesgo.subprocesos)
    : convertirCampoProcesoEnLista(riesgo.subproceso || partesProcesoLegado.slice(1).join('/'));
  const subprocesosPorMacroproceso = Object.fromEntries(macroprocesos.map((macroproceso, indice) => {
    const claveRelacion = Object.keys(relacionesGuardadas).find(clave => (
      normalizarTextoProceso(clave) === normalizarTextoProceso(macroproceso)
    ));
    const valoresRelacion = claveRelacion ? relacionesGuardadas[claveRelacion] : indice === 0 ? subprocesosLegados : [];
    const subprocesosDisponibles = Array.isArray(mapaProcesos?.[macroproceso]) ? mapaProcesos[macroproceso] : [];
    const subprocesos = [...new Set(convertirCampoProcesoEnLista(valoresRelacion).map(subproceso => (
      resolverNombreCatalogo(subproceso, subprocesosDisponibles)
    )).filter(Boolean))];
    if (subprocesos.length === 0 && subprocesosDisponibles.length === 1 && subprocesosDisponibles[0] === 'General') {
      subprocesos.push('General');
    }
    return [macroproceso, subprocesos];
  }));
  const subprocesos = [...new Set(Object.values(subprocesosPorMacroproceso).flat())];

  return {
    ...riesgo,
    proceso: macroprocesos[0] || 'Sin proceso',
    macroproceso: macroprocesos[0] || 'Sin proceso',
    macroprocesos,
    subproceso: subprocesosPorMacroproceso[macroprocesos[0]]?.[0] || '',
    subprocesos,
    subprocesosPorMacroproceso,
  };
};

// 📚 DICCIONARIO METODOLÓGICO DE AYUDA (EDICIÓN TERMALES SANTA ROSA)
// 💡 Ayuda de cada casilla del formulario: qué es, por qué se diligencia y un ejemplo técnico.
// Escalas, pesos y fórmulas del Manual de Riesgos E-GE-MAN-001 (Tablas 2, 3, 5, 6 y 8).
const EXPLICACIONES_CAMPOS = {
  categoria: {
    titulo: "Categoría de Riesgo",
    que: "Es el tipo de objetivo de la organización que el riesgo puede afectar: Estratégico, Operativo, Cumplimiento, Financiero, Tecnológico o Ambiental.",
    porQue: "Permite ver en el Dashboard y en los informes a la Junta en qué frente se concentra la exposición de Termales y asignar el seguimiento al área que corresponde.",
    ejemplo: "Riesgo: 'Caída del sistema de reservas en temporada alta'. Afecta la operación por una falla de tecnología → Categoría: Tecnológico. Riesgo: 'Sanción por no reportar información exógena a la DIAN' → Categoría: Cumplimiento."
  },
  clasificacion: {
    titulo: "Clasificación de riesgo (Tabla 5)",
    que: "Es la clase de evento de pérdida según la Tabla 5 del manual. Cada riesgo se ubica en una sola de las 7 clasificaciones.",
    porQue: "Unifica cómo se agrupan los riesgos de todos los procesos: así se puede filtrar y comparar la matriz, por ejemplo cuántos riesgos de fraude interno tiene la empresa.",
    ejemplo: () => (
      <div className="overflow-x-auto mt-1">
        <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden shadow-sm text-[10px]">
          <tbody className="divide-y divide-emerald-200/50">
            <tr><td className="p-2 font-bold text-emerald-900 w-2/5">Ejecución y administración de procesos</td><td className="p-2 text-slate-700">Errores al ejecutar un proceso: facturar una tarifa equivocada a un huésped.</td></tr>
            <tr><td className="p-2 font-bold text-emerald-900">Fraude Externo</td><td className="p-2 text-slate-700">Un tercero engaña o roba: pago de reserva con tarjeta clonada.</td></tr>
            <tr><td className="p-2 font-bold text-emerald-900">Fraude Interno</td><td className="p-2 text-slate-700">Un colaborador actúa con intención: cajero que anula ventas cobradas.</td></tr>
            <tr><td className="p-2 font-bold text-emerald-900">Fallas Tecnológicas</td><td className="p-2 text-slate-700">Falla de hardware, software o comunicaciones: caída del servidor del POS.</td></tr>
            <tr><td className="p-2 font-bold text-emerald-900">Relaciones Laborales</td><td className="p-2 text-slate-700">Demandas o reclamos de trabajadores: horas extra no liquidadas.</td></tr>
            <tr><td className="p-2 font-bold text-emerald-900">Usuarios, productos y practicas</td><td className="p-2 text-slate-700">Fallas frente al cliente o al producto: quejas por incumplir lo ofrecido en un plan.</td></tr>
            <tr><td className="p-2 font-bold text-emerald-900">Daños a activos fijos/ eventos externos</td><td className="p-2 text-slate-700">Pérdida de bienes por desastres o terceros: avalancha que daña las piscinas.</td></tr>
          </tbody>
        </table>
      </div>
    )
  },
  normativa: {
    titulo: "Normativa Asociada",
    que: "Es la ley, decreto, resolución o norma técnica que regula la actividad donde está el riesgo. Si no aplica ninguna, se escribe 'Ninguna'.",
    porQue: "Cuando el riesgo tiene norma asociada, materializarlo puede traer sanciones, multas o cierres; esto ayuda a valorar el impacto y a priorizar los controles de cumplimiento.",
    ejemplo: "Riesgo de accidente laboral en mantenimiento de piscinas → 'Decreto 1072 de 2015 (SG-SST)'. Riesgo de manejo indebido de datos de huéspedes → 'Ley 1581 de 2012 (Habeas Data)'."
  },
  responsable: {
    titulo: "Líder Dueño del Proceso",
    que: "Es el cargo que responde por el riesgo: vigila que los controles se ejecuten, define los planes de acción y rinde cuentas en las auditorías.",
    porQue: "Sin un dueño asignado nadie responde por el riesgo. Según el numeral 9 del manual, el dueño debe definir plan de acción cuando el riesgo queda Extremo o Alto, y hacer seguimiento cuando queda Moderado o Bajo.",
    ejemplo: "Riesgo: 'Pérdida de activos fijos por falta de conciliación'. Dueño: 'Líder Administrativa', porque su proceso administra el inventario de activos. Se registra el cargo, no el nombre de la persona."
  },
  afectacion: {
    titulo: "Tipo de Afectación",
    que: "Es la consecuencia principal que tendría el riesgo si ocurre: pérdida de dinero, afectación de la operación, de la imagen, legal o en la salud de las personas.",
    porQue: "Orienta la valoración del impacto: la Tabla 3 del manual mide el impacto en SMLMV (afectación económica) o en el alcance de la afectación de imagen (reputacional).",
    ejemplo: "Accidente de un huésped en un tobogán: hay indemnización (dinero) y difusión en medios (imagen) → 'Económico-Reputacional'. Error en una conciliación bancaria sin efecto externo → 'Económico'."
  },
  causaInmediata: {
    titulo: "Causa Inmediata (¿Qué pasa?)",
    que: "Es la circunstancia visible que se presenta cuando el riesgo ocurre. Responde a la pregunta: ¿qué pasa?",
    porQue: "Es la primera parte de la redacción del riesgo que pide el manual. Describe el hecho, sin explicar todavía por qué ocurre.",
    ejemplo: "'Inconsistencia en la información de activos fijos', 'Descuadre de caja al cierre del turno', 'Ingreso de visitantes sin pago del pasadía'."
  },
  causaRaiz: {
    titulo: "Causa Raíz (¿Por qué pasa?)",
    que: "Es la falla de fondo que origina la causa inmediata. Responde a la pregunta: ¿por qué pasa? Puede ser falta de procedimiento, de control, de capacitación o de herramienta.",
    porQue: "Los controles deben atacar la causa raíz. Si se identifica mal, el control puede quedar bien diseñado y aun así el riesgo se sigue presentando.",
    ejemplo: "Causa inmediata: 'Inconsistencia en la información de activos fijos'. Causa raíz: 'Bases de datos de inventario desactualizadas en ubicación y responsables, sin conciliación periódica contra el registro contable'."
  },
  probInh: {
    titulo: "Probabilidad Inherente",
    que: "Es la posibilidad de que el riesgo ocurra sin tener en cuenta ningún control. Según la Tabla 2 del manual, se mide por cuántas veces al año se ejecuta la actividad que expone al riesgo.",
    porQue: "Es el punto de partida del cálculo: los controles preventivos y detectivos reducen este valor para obtener la probabilidad residual.",
    ejemplo: "Escala Tabla 2: hasta 2 veces/año = Muy baja (20 %); 3 a 24 = Baja (40 %); 24 a 500 = Media (60 %); 500 a 5.000 = Alta (80 %); más de 5.000 = Muy alta (100 %). Ejemplo: la recepción registra unas 40 facturas al día → 40 × 365 = 14.600 veces al año → Muy alta (100 %)."
  },
  impInh: {
    titulo: "Impacto Inherente",
    que: "Es la magnitud del daño si el riesgo ocurre, sin tener en cuenta los controles. Según la Tabla 3 del manual, se mide en SMLMV o por el alcance de la afectación de imagen.",
    porQue: "Junto con la probabilidad ubica el riesgo en la matriz de calor (Tabla 4). Con impacto Catastrófico el riesgo es Extremo y con impacto Mayor es Alto, cualquiera sea la probabilidad.",
    ejemplo: "Escala Tabla 3: menos de 10 SMLMV = Leve (20 %); 10 a 50 = Menor (40 %); 50 a 100 = Moderado (60 %); 100 a 500 = Mayor (80 %); más de 500 SMLMV o afectación de imagen a nivel nacional = Catastrófico (100 %). Ejemplo: pérdida estimada de 120 SMLMV por hurto de activos → Mayor (80 %)."
  },
  controlDesc: {
    titulo: "Descripción de la Tarea del Control",
    que: "Es la actividad concreta que una persona o un sistema ejecuta para evitar que el riesgo ocurra, detectarlo a tiempo o reducir su daño.",
    porQue: "Según la Tabla 6, la eficacia del control depende de su tipo (Preventivo 25 %, Detectivo 15 %, Correctivo 10 %) y de su implementación (Automático 25 %, Manual 15 %). La descripción debe dejar claro quién, qué, cada cuánto y con qué evidencia.",
    ejemplo: "Estructura: responsable + acción + qué verifica + frecuencia + evidencia. 'El Auxiliar Contable concilia mensualmente el módulo de activos fijos contra el inventario físico por sede, investiga las diferencias y deja el acta de conciliación firmada por la Líder Administrativa.' → Preventivo manual = 25 % + 15 % = 40 %."
  },
  probRes: {
    titulo: "Probabilidad Residual Final",
    que: "Es la probabilidad que queda después de aplicar los controles preventivos y detectivos. La app la calcula sola; no se digita.",
    porQue: "Según la Tabla 8, los controles mitigan de forma acumulativa: cada control reduce lo que quedó después del control anterior, no el valor inicial. Los controles correctivos no reducen la probabilidad.",
    ejemplo: "Probabilidad inherente 80 %. Control 1, preventivo manual (40 %): 80 − 80 × 0,40 = 48 %. Control 2, detectivo automático (15 % + 25 % = 40 %): 48 − 48 × 0,40 = 28,8 % → 29 % → Baja (21 % a 40 %)."
  },
  impRes: {
    titulo: "Impacto Residual Final",
    que: "Es el impacto que queda después de aplicar los controles correctivos. La app lo calcula sola; no se digita.",
    porQue: "Según la Tabla 8, solo los controles correctivos (pólizas, planes de contingencia, copias de seguridad) reducen el impacto, también de forma acumulativa. Los preventivos y detectivos no lo reducen.",
    ejemplo: "Impacto inherente 80 %. Control correctivo manual (10 % + 15 % = 25 %): 80 − 80 × 0,25 = 60 % → Moderado. Si el riesgo solo tiene controles preventivos, el impacto residual sigue en 80 %."
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
// 🧮 La eficacia de cada control (Tabla 6 del manual) se calcula en utils/explicacionControles.js.
// 🧮 CALCULADORA DE PORCENTAJE GLOBAL DE MITIGACIÓN DEL RIESGO (DONUT GAUGE)
const calcularMitigacionRiesgo = (r) => {
  // Reemplazamos || por ?? para que el 0 se respete matemáticamente
  const expInh = (r.probabilidadInherente ?? 60) * (r.impactoInherente ?? 60);
  const expRes = (r.probabilidadResidual ?? 15) * (r.impactoResidual ?? 30);
  
  if (expInh === 0) return 0;
  const mitigacion = Math.round(((expInh - expRes) / expInh) * 100);
  return Math.max(0, Math.min(100, mitigacion));
};
// Lectura del % de mitigación con los valores del riesgo: exposición = probabilidad × impacto, antes y después.
const leerMitigacionRiesgo = (r) => {
  const porcentaje = riesgoEnPorcentaje(r);
  const pInh = r.probabilidadInherente ?? 60;
  const iInh = r.impactoInherente ?? 60;
  const pRes = r.probabilidadResidual ?? 15;
  const iRes = r.impactoResidual ?? 30;
  const numero = valor => Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const exposicion = (p, i) => (porcentaje ? `${numero(p)}% × ${numero(i)}% = ${numero((p * i) / 100)}%` : `${numero(p)} × ${numero(i)} = ${numero(p * i)} (de 25)`);
  const mitigacion = calcularMitigacionRiesgo(r);
  return {
    mitigacion,
    inherente: exposicion(pInh, iInh),
    residual: exposicion(pRes, iRes),
    lectura: mitigacion === 0
      ? 'Los controles no reducen la exposición de este riesgo.'
      : `Los controles eliminan el ${mitigacion}% de la exposición de este riesgo; queda el ${100 - mitigacion}%.`,
  };
};
// 🏷️ COMPONENTE AUXILIAR EXTRACTO (Fuera del render para evitar recreación dinámica)
const LabelConPalomita = ({ idCampo, dark, onAbrirAyuda }) => {
  const dataAyuda = EXPLICACIONES_CAMPOS[idCampo];
  if (!dataAyuda) return null;
  return (
    <div className="flex items-center space-x-1.5 mb-1">
      <span className={`text-[10px] font-black uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{dataAyuda.titulo}</span>
      {/* No es <button>: dentro del <fieldset disabled> del modo consulta un botón queda desactivado y la ayuda no abría. */}
      <span
        role="button"
        tabIndex={0}
        onClick={() => onAbrirAyuda && onAbrirAyuda(dataAyuda)}
        onKeyDown={evento => {
          if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); onAbrirAyuda && onAbrirAyuda(dataAyuda); }
        }}
        aria-label={`Ayuda: ${dataAyuda.titulo}`}
        className="w-4 h-4 cursor-pointer rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-[9px] text-emerald-600 font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        title="Ver qué es, por qué diligenciarlo y un ejemplo"
      >
        <span className="group-hover:scale-110 transition-transform">✓</span>
      </span>
    </div>
  );
};
// ✓ Chulito verde que abre la explicación de un dato del Dashboard.
const BotonExplicacion = ({ etiqueta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Ver qué significa: ${etiqueta}`}
    title="Ver qué significa este dato y cómo se calcula"
    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 text-[9px] font-bold text-emerald-600 shadow-sm transition-all hover:bg-emerald-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
  >
    ✓
  </button>
);
// 📖 "Explícame este riesgo": panel desplegable con la explicación completa, calculada con los datos del riesgo.
// Es un <details> (no un botón) para que funcione también dentro del formulario en modo consulta.
const ExplicacionRiesgoDetallada = ({ riesgo, evaluaciones = [] }) => {
  const detalle = explicarRiesgoDetallado(riesgo, { pruebasCampo: pruebasDeCampoDelRiesgo(evaluaciones, riesgo.id) });
  const bloques = [
    ['1. Probabilidad', detalle.probabilidad],
    ['2. Impacto', detalle.impacto],
    [`3. Por qué queda en zona ${detalle.zonaResidual}`, detalle.zona],
    ...(detalle.pendientes.length ? [['4. Lo que falta', detalle.pendientes]] : []),
  ];
  return (
    <details className="group rounded-lg border border-emerald-700/60 bg-slate-950/40 text-[11px] leading-relaxed text-emerald-100">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 font-bold text-emerald-200 hover:bg-emerald-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
        <span>📖 Explícame este riesgo</span>
        <span aria-hidden="true" className="text-emerald-400 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t border-emerald-800/60 px-3 py-3">
        {bloques.map(([titulo, lineas]) => (
          <div key={titulo}>
            <p className="font-bold text-emerald-300">{titulo}</p>
            <ul className="mt-1 space-y-1">{lineas.map(linea => <li key={linea}>{linea}</li>)}</ul>
          </div>
        ))}
        <div>
          <p className="font-bold text-emerald-300">{detalle.pendientes.length ? '5' : '4'}. Qué lo mejoraría</p>
          {detalle.mejoras.length > 0 && (
            <ul className="mt-1 space-y-1">
              {detalle.mejoras.map(mejora => (
                <li key={mejora.accion}><strong className={mejora.bajaZona ? 'text-emerald-300' : 'text-emerald-100'}>{mejora.accion}:</strong> {mejora.resultado}.</li>
              ))}
            </ul>
          )}
          {detalle.notaMejoras && <p className="mt-1">{detalle.notaMejoras}</p>}
          <p className="mt-1 text-[10px] text-emerald-400/80">Esto es una simulación: muestra cómo quedaría el riesgo si se agregara ese control. No cambia nada en la matriz hasta que el control se implemente y se registre.</p>
        </div>
      </div>
    </details>
  );
};
// 🏛️ COMPONENTE PRINCIPAL
export default function Riesgos({ 
  hallazgos = [],        
  planesDeAccion = [],  
  isAdmin = false, 
  user = null,
  perfilUsuario = null,
  evaluaciones = [],
 safeRiesgos: rawRiesgos, 
  setRiesgos = () => console.warn("Modo offline: setRiesgos no detectado"), 
  showNotification = () => {} 
}) {
  const confirmarEliminacion = useDeleteConfirmation();
   // 🛡️ BLINDAJE: Forzamos un array vacío si la BD envía null para evitar que .map o .reduce colapsen
  const safeRiesgos = Array.isArray(rawRiesgos) ? rawRiesgos : [];
  // Los riesgos anulados se consultan en la matriz (filtro Estado), pero no cuentan en indicadores, Excel ni IA.
  const riesgosVigentes = vigentes(safeRiesgos);
  const { mapaProcesos: MAPA_PROCESOS, cargosEmpresa: CARGOS_EMPRESA, sedesEmpresa } = useCatalogos();
  const procesosAsignadosPerfil = Array.isArray(perfilUsuario?.procesosAsignados) && perfilUsuario.procesosAsignados.length > 0
    ? perfilUsuario.procesosAsignados
    : perfilUsuario?.procesoAsignado;
  const procesosAsignadosAuth = Array.isArray(user?.procesosAsignados) && user.procesosAsignados.length > 0
    ? user.procesosAsignados
    : user?.procesoAsignado;
  const subprocesosAsignadosPerfil = Array.isArray(perfilUsuario?.subprocesosAsignados) && perfilUsuario.subprocesosAsignados.length > 0
    ? perfilUsuario.subprocesosAsignados
    : perfilUsuario?.subprocesoAsignado;
  const subprocesosAsignadosUsuario = isAdmin
    ? []
    : convertirCampoProcesoEnLista(subprocesosAsignadosPerfil || user?.subprocesosAsignados || user?.subprocesoAsignado)
      .map(normalizarTextoProceso);
  const procesosAsignadosUsuario = convertirCampoProcesoEnLista(procesosAsignadosPerfil || procesosAsignadosAuth)
    .map(normalizarTextoProceso);
  const puedeModificarRiesgo = riesgo => {
    if (isAdmin) return true;
    const ubicacionRiesgo = normalizarUbicacionRiesgo(riesgo, MAPA_PROCESOS);
    const macroprocesosRiesgo = ubicacionRiesgo.macroprocesos
      .filter(macroproceso => macroproceso !== 'Sin proceso')
      .map(normalizarTextoProceso);
    return macroprocesosRiesgo.length > 0
      && macroprocesosRiesgo.every(macroproceso => procesosAsignadosUsuario.includes(macroproceso))
      && (subprocesosAsignadosUsuario.length === 0 || ubicacionRiesgo.subprocesos.length > 0
        && ubicacionRiesgo.subprocesos.every(subproceso => subprocesosAsignadosUsuario.includes(normalizarTextoProceso(subproceso))));
  };

  // 🤖 ESTADOS PARA EL DICTAMEN DE INTELIGENCIA ARTIFICIAL EN EL DASHBOARD
  const [dictamenIA, setDictamenIA] = useState(null);
  const [procesandoIA, setProcesandoIA] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  // Explicación de un dato del Dashboard (chulitos verdes), calculada con los riesgos del filtro.
  const [explicacionDashboard, setExplicacionDashboard] = useState(null);
  // Al cambiar de vista (dashboard, matriz, formulario) la página arranca arriba, no donde quedó la anterior.
  useEffect(() => {
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [vistaActiva]);
  const [formularioModificado, setFormularioModificado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const guardNavigationRiesgos = useUnsavedChangesGuard(formularioModificado && vistaActiva === 'nuevo', 'el riesgo');
  const cambiarVistaSeguraRiesgos = (nuevaVista) => guardNavigationRiesgos(() => {
    setFormularioModificado(false);
    setSoloLecturaRiesgo(false);
    setVistaActiva(nuevaVista);
  });
  // Cancelar el formulario regresa a "Ver matriz" (el efecto de vistaActiva la deja arriba).
  const cancelarFormularioRiesgo = () => guardNavigationRiesgos(() => {
    setFormularioModificado(false);
    setSoloLecturaRiesgo(false);
    setEditRiesgo(null);
    setVistaActiva('matriz');
  });
// 🛡️ Estado para el modal explicativo de eficacia del control
  const [controlSeleccionadoIA, setControlSeleccionadoIA] = useState(null);
  // Formulario completo del riesgo abierto en modo consulta (sin edición ni guardado).
  const [soloLecturaRiesgo, setSoloLecturaRiesgo] = useState(false);
  // 🚀 ESTADOS PARA EL EXPEDIENTE EXPANDIBLE (ACCORDEÓN 360°)
 const [expandedRiesgoId, setExpandedRiesgoId] = useState(null);
// 🔍 ESTADOS DE BÚSQUEDA Y FILTROS ENTERPRISE
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroProceso, setFiltroProceso] = useState('Todos');
  const [filtroSubproceso, setFiltroSubproceso] = useState('Todos');
  const [filtroClasificacion, setFiltroClasificacion] = useState('Todas');
  const [filtroNivel, setFiltroNivel] = useState('Todos');
  const [filtroEstadoRiesgo, setFiltroEstadoRiesgo] = useState('Activos');
  // Filtro de cumplimiento del numeral 9 ('sin-plan' | 'sin-seguimiento' | 'reprobados'), abierto desde el Dashboard.
  const [filtroCumplimiento, setFiltroCumplimiento] = useState(null);
  const [mitigacionAbierta, setMitigacionAbierta] = useState(null);
  const [filtroNivelDashboard, setFiltroNivelDashboard] = useState('Todos');
  const [matrizDashboardTipo, setMatrizDashboardTipo] = useState('residual');
  const [cuadranteDashboard, setCuadranteDashboard] = useState(null);
  const toggleExpediente = (id) => {
    if (expandedRiesgoId === id) {
      setExpandedRiesgoId(null);
    } else {
      setExpandedRiesgoId(id);
    }
  };
  // 🍿 ESTADO PARA EL POPUP INTERACTIVO ELEGANTE
const [ayudaModal, setAyudaModal] = useState(null);
  
const [editRiesgo, setEditRiesgo] = useState(null);
  const [customId, setCustomId] = useState('');
  const [idHallazgoOrigen, setIdHallazgoOrigen] = useState(null);
  const listadoMacros = Object.keys(MAPA_PROCESOS);
  const macroprocesosInicialesDisponibles = listadoMacros.filter(nombre => (
    isAdmin || procesosAsignadosUsuario.includes(normalizarTextoProceso(nombre))
  ));
  const macroprocesoInicial = macroprocesosInicialesDisponibles[0] || '';
  const [macroprocesosSeleccionados, setMacroprocesosSeleccionados] = useState(
    macroprocesoInicial ? [macroprocesoInicial] : []
  );
  const obtenerSubprocesosPermitidos = macroproceso => (MAPA_PROCESOS[macroproceso] || []).filter(subproceso => (
    subprocesosAsignadosUsuario.length === 0 || subprocesosAsignadosUsuario.includes(normalizarTextoProceso(subproceso))
  ));
  const crearRelacionSubprocesosInicial = macroprocesos => Object.fromEntries(macroprocesos.map(macroproceso => {
    const opciones = obtenerSubprocesosPermitidos(macroproceso);
    return [macroproceso, opciones.length === 1 ? opciones : []];
  }));
  const [subprocesosPorMacroprocesoSeleccionados, setSubprocesosPorMacroprocesoSeleccionados] = useState(
    () => crearRelacionSubprocesosInicial(macroprocesosSeleccionados)
  );
  const macroprocesosDisponibles = [...new Set([...listadoMacros, ...macroprocesosSeleccionados])].filter(nombre => (
    nombre && (isAdmin || soloLecturaRiesgo || procesosAsignadosUsuario.includes(normalizarTextoProceso(nombre)))
  )).sort((a, b) => a.localeCompare(b, 'es'));

  const alternarMacroprocesoRiesgo = (macroproceso, seleccionado) => {
    const macrosSiguientes = seleccionado
      ? [...new Set([...macroprocesosSeleccionados, macroproceso])]
      : macroprocesosSeleccionados.filter(actual => actual !== macroproceso);
    const relacionSiguiente = { ...subprocesosPorMacroprocesoSeleccionados };
    if (seleccionado) {
      const opciones = obtenerSubprocesosPermitidos(macroproceso);
      relacionSiguiente[macroproceso] = opciones.length === 1 ? opciones : [];
    } else {
      delete relacionSiguiente[macroproceso];
    }
    setMacroprocesosSeleccionados(macrosSiguientes);
    setSubprocesosPorMacroprocesoSeleccionados(relacionSiguiente);
  };

  const alternarSubprocesoRiesgo = (macroproceso, subproceso, seleccionado) => {
    const actuales = subprocesosPorMacroprocesoSeleccionados[macroproceso] || [];
    const siguientes = seleccionado
      ? [...new Set([...actuales, subproceso])]
      : actuales.filter(actual => actual !== subproceso);
    setSubprocesosPorMacroprocesoSeleccionados(prev => ({
      ...prev,
      [macroproceso]: siguientes,
    }));
  };
  
  // 🔢 FUNCIÓN BLINDADA PARA CALCULAR EL CONSECUTIVO EXACTO Y CAPTURAR RIESGO EMERGENTE
  const handleNuevoRiesgo = () => guardNavigationRiesgos(() => {
    const macroprocesoPredeterminado = macroprocesosDisponibles[0] || '';
    const macrosIniciales = macroprocesoPredeterminado ? [macroprocesoPredeterminado] : [];
    setMacroprocesosSeleccionados(macrosIniciales);
    setSubprocesosPorMacroprocesoSeleccionados(crearRelacionSubprocesosInicial(macrosIniciales));
    setFormularioModificado(false);
    setEditRiesgo(null);
    // Un riesgo nuevo arranca en blanco: no hereda líder, sedes ni textos del último riesgo abierto o guardado.
    setCategoria(''); setClasificacionRiesgo(CLASIFICACIONES_MANUAL[0]); setNormativa('');
    setSedeForm([]); setSedeTemp(''); setResponsablesMultiples([]); setResponsableTemp('');
    setAfectacion('Económico'); setCausaInmediata(''); setCausaRaiz(''); setEscenarioFinal('');
    setProbInherente(60); setImpInherente(60); setControles([]); setTratamiento('Reducir el riesgo');
    setPlanAccionRiesgo(''); setFechaSeguimiento(''); setSeguimientoBitacora(''); setHistorialPendienteFormulario([]);

    const maxId = safeRiesgos.reduce((max, r) => {
      const idStr = String(r.id).trim();
      
      if (/^\d+$/.test(idStr) && idStr.length < 8) {
        const num = parseInt(idStr, 10);
        return num > max ? num : max;
      }
      
      return max;
    }, 0);
    
    setCustomId(maxId + 1); 

    // 🚀 REVISAR SI VIENE UN HALLAZGO PROMOVIDO (puente en memoria, sin almacenamiento del navegador)
    const tempPromoted = leerPuente('promover_riesgo_temp');
    if (tempPromoted) {
      try {
        const data = tempPromoted;
        const ubicacionPromovida = normalizarUbicacionRiesgo(data, MAPA_PROCESOS);
        const macrosPromovidos = ubicacionPromovida.macroprocesos.filter(macro => (
          macroprocesosDisponibles.some(opcion => normalizarTextoProceso(opcion) === normalizarTextoProceso(macro))
        ));
        const relacionPromovida = Object.fromEntries(macrosPromovidos.map(macroproceso => {
          const opciones = obtenerSubprocesosPermitidos(macroproceso);
          const asociados = ubicacionPromovida.subprocesosPorMacroproceso[macroproceso] || [];
          return [macroproceso, asociados.filter(subproceso => opciones.some(opcion => (
            normalizarTextoProceso(opcion) === normalizarTextoProceso(subproceso)
          )))];
        }));
        setMacroprocesosSeleccionados(macrosPromovidos);
        setSubprocesosPorMacroprocesoSeleccionados(relacionPromovida);
        if (data.causaInmediata) setCausaInmediata(data.causaInmediata);
        if (data.sede) setSedeForm(Array.isArray(data.sede) ? data.sede : [data.sede]);
        if (data.responsable) setResponsablesMultiples(Array.isArray(data.responsable) ? data.responsable : [data.responsable]);
        if (data.idHallazgo) setIdHallazgoOrigen(data.idHallazgo);
        setClasificacionRiesgo('Riesgo Emergente');
        showNotification(`📥 Datos del Hallazgo ${data.refHallazgo || ''} cargados automáticamente como Riesgo Emergente.`, "info");
      } catch (err) {
        console.error("Error leyendo datos del hallazgo promovido", err);
      }
    } else {
      setIdHallazgoOrigen(null);
    }

    setSoloLecturaRiesgo(false);
    setVistaActiva('nuevo');
  });
  const [categoria, setCategoria] = useState('');
  const [clasificacionRiesgo, setClasificacionRiesgo] = useState(CLASIFICACIONES_MANUAL[0]);
  const [normativa, setNormativa] = useState('');
  // Modificamos sedeForm para que sea un arreglo (Array) y añadimos sedeTemp
  const [sedeForm, setSedeForm] = useState([]);
  const [sedeTemp, setSedeTemp] = useState('');
  const [responsablesMultiples, setResponsablesMultiples] = useState([]);
  const [responsableTemp, setResponsableTemp] = useState('');  
  const [afectacion, setAfectacion] = useState('Económico');
  const [causaInmediata, setCausaInmediata] = useState('');
  const [causaRaiz, setCausaRaiz] = useState('');
  const [escenarioFinal, setEscenarioFinal] = useState('');

  // 📝 Generador de plantilla automática para el escenario
  const generarTextoAutomatico = () => {
    let texto = `Posibilidad de afectación ${afectacion.toLowerCase()}`;
    if (causaInmediata) texto += ` debido a ${causaInmediata}`;
    if (causaRaiz) texto += ` originado por ${causaRaiz}`;
    setEscenarioFinal(texto);
  };

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

    // Los controles anulados no mitigan.
    vigentes(controles).forEach(c => {
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

// 🧮 GENERADOR DE TRAZA DE AUDITORÍA Y EXPLICACIÓN PASO A PASO POR RIESGO
  const obtenerExplicacionCalculo = (r) => {
    const probInh = Number(r.probabilidadInherente) || 60;
    const impInh = Number(r.impactoInherente) || 60;
    const lista = Array.isArray(r.controlesDetallados) ? r.controlesDetallados : [];

    // Pasos de Probabilidad (Preventivos / Detectivos)
    let currP = probInh;
    const pasosP = [];
    // Los controles anulados no mitigan (conservan su código CTL-{riesgo}-{n} por su posición en la lista).
    const prevs = lista.filter(c => !estaAnulado(c) && !(c.tipo || '').includes('Correctivo'));

    prevs.forEach((c) => {
      const ef = calcularEficaciaControl(c);
      const despues = currP - (currP * (ef / 100));
      pasosP.push({
        codigo: codigoControl(lista.indexOf(c), r.id),
        etiqueta: `${codigoControl(lista.indexOf(c), r.id)} (${c.tipo || 'Preventivo'})`,
        eficacia: ef,
        antes: Math.round(currP * 100) / 100,
        despues: Math.round(despues * 100) / 100
      });
      currP = despues;
    });

    // Pasos de Impacto (Correctivos)
    let currI = impInh;
    const pasosI = [];
    const corrects = lista.filter(c => !estaAnulado(c) && (c.tipo || '').includes('Correctivo'));

    corrects.forEach((c) => {
      const ef = calcularEficaciaControl(c);
      const despues = currI - (currI * (ef / 100));
      pasosI.push({
        codigo: codigoControl(lista.indexOf(c), r.id),
        etiqueta: `${codigoControl(lista.indexOf(c), r.id)} (Correctivo)`,
        eficacia: ef,
        antes: Math.round(currI * 100) / 100,
        despues: Math.round(despues * 100) / 100
      });
      currI = despues;
    });

    return {
      probInh,
      impInh,
      pasosP,
      pasosI,
      probFinal: Math.max(Math.round(currP), 0),
      impFinal: Math.max(Math.round(currI), 0),
      totalPrevs: prevs.length,
      totalCorrects: corrects.length
    };
  };

  // Filo izquierdo y etiqueta de cada control según su tipo.
  const ESTILO_TIPO_CONTROL = {
    Preventivo: { filo: 'border-l-blue-500', etiqueta: 'bg-blue-50 text-blue-700' },
    Detectivo: { filo: 'border-l-amber-400', etiqueta: 'bg-amber-50 text-amber-700' },
    Correctivo: { filo: 'border-l-purple-500', etiqueta: 'bg-purple-50 text-purple-700' },
  };

  // Filo izquierdo de cada tarjeta de riesgo según su nivel residual.
  const ACENTO_NIVEL_RESIDUAL = {
    Extremo: 'border-l-red-600',
    Alto: 'border-l-orange-500',
    Moderado: 'border-l-amber-400',
    Bajo: 'border-l-emerald-500',
  };

  // `porcentaje`: escala del riesgo (riesgoEnPorcentaje). Sin él, cada valor se interpreta por sí solo.
  const getSeverityZone = (prob, imp, porcentaje) => zonaSeveridad(prob, imp, porcentaje);

  const extraerNivelMatriz = (valor, eje, porcentaje) => {
    const texto = String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const etiquetas = eje === 'probabilidad'
      ? { 'muy baja': 1, rara: 1, 'rara vez': 1, baja: 2, improbable: 2, posible: 3, media: 3, probable: 4, alta: 4, 'muy alta': 5, 'casi seguro': 5, frecuente: 5 }
      : { insignificante: 1, leve: 1, menor: 2, moderado: 3, medio: 3, mayor: 4, alto: 4, catastrofico: 5, critico: 5 };
    if (etiquetas[texto]) return etiquetas[texto];

    const numero = typeof valor === 'number' ? valor : Number.parseFloat(texto.replace(',', '.'));
    return nivelEscala(numero, porcentaje);
  };

  // 🚫 ANULACIÓN / REACTIVACIÓN de riesgos y controles: no se borra nada; queda el motivo y el historial.
  const [solicitudAnulacion, setSolicitudAnulacion] = useState(null); // { id, accion: 'anular' | 'reactivar', indiceControl }
  const [formAnulacion, setFormAnulacion] = useState({ tipoMotivo: '', motivo: '' });
  const [guardandoAnulacion, setGuardandoAnulacion] = useState(false);
  // Anulaciones hechas dentro del formulario: se guardan (con su entrada de historial) al actualizar la matriz.
  const [historialPendienteFormulario, setHistorialPendienteFormulario] = useState([]);
  const abrirAnulacionFormulario = (accion, indiceControl) => {
    setSolicitudAnulacion({ id: editRiesgo?.id, accion, indiceControl, enFormulario: true });
    setFormAnulacion({ tipoMotivo: '', motivo: '' });
  };
  const abrirAnulacion = (riesgo, accion, indiceControl = null) => {
    setSolicitudAnulacion({ id: riesgo.id, accion, indiceControl });
    setFormAnulacion({ tipoMotivo: '', motivo: '' });
  };
  const confirmarAnulacion = async () => {
    const { id, accion, indiceControl, enFormulario } = solicitudAnulacion;
    if (enFormulario) {
      const errorFormulario = validarMotivo(formAnulacion, { exigirTipo: accion === 'anular' });
      if (errorFormulario) { showNotification(errorFormulario, 'error'); return; }
      const usuarioFormulario = user?.email || 'Usuario';
      const ahoraFormulario = new Date();
      setControles(actuales => actuales.map((control, indice) => {
        if (indice !== indiceControl) return control;
        return accion === 'anular'
          ? anular(control, { usuario: usuarioFormulario, tipoMotivo: formAnulacion.tipoMotivo, motivo: formAnulacion.motivo, ahora: ahoraFormulario })
          : reactivar(control);
      }));
      const accionFormulario = `Control ${codigoControl(indiceControl, id ?? customId)} ${accion === 'anular' ? 'anulado' : 'reactivado'}`;
      setHistorialPendienteFormulario(actuales => [...actuales, entradaHistorial({
        usuario: usuarioFormulario,
        accion: accionFormulario,
        motivo: accion === 'anular' ? `${formAnulacion.tipoMotivo}: ${formAnulacion.motivo.trim()}` : formAnulacion.motivo,
        ahora: ahoraFormulario,
      })]);
      showNotification(`${accionFormulario}. Se guarda en el historial al actualizar la matriz.`, 'success');
      setSolicitudAnulacion(null);
      return;
    }
    const riesgo = safeRiesgos.find(item => String(item.id) === String(id));
    if (!riesgo || !puedeModificarRiesgo(riesgo)) {
      showNotification('Solo puedes anular riesgos y controles de los macroprocesos que tienes asignados.', 'error');
      return;
    }
    const error = validarMotivo(formAnulacion, { exigirTipo: accion === 'anular' });
    if (error) { showNotification(error, 'error'); return; }
    const usuario = user?.email || 'Usuario';
    const ahora = new Date();
    const datos = { usuario, tipoMotivo: formAnulacion.tipoMotivo, motivo: formAnulacion.motivo, ahora };
    let actualizado;
    let accionHistorial;
    if (indiceControl === null) {
      actualizado = accion === 'anular' ? anular(riesgo, datos) : reactivar(riesgo);
      accionHistorial = accion === 'anular' ? 'Riesgo anulado' : 'Riesgo reactivado';
    } else {
      const controlesActualizados = [...(riesgo.controlesDetallados || [])];
      controlesActualizados[indiceControl] = accion === 'anular'
        ? anular(controlesActualizados[indiceControl], datos)
        : reactivar(controlesActualizados[indiceControl]);
      actualizado = { ...riesgo, controlesDetallados: controlesActualizados };
      accionHistorial = `Control ${codigoControl(indiceControl, riesgo.id)} ${accion === 'anular' ? 'anulado' : 'reactivado'}`;
    }
    const motivoHistorial = accion === 'anular' ? `${formAnulacion.tipoMotivo}: ${formAnulacion.motivo.trim()}` : formAnulacion.motivo;
    actualizado.historialCambios = [...(Array.isArray(riesgo.historialCambios) ? riesgo.historialCambios : []),
      entradaHistorial({ usuario, accion: accionHistorial, motivo: motivoHistorial, ahora })];
    setGuardandoAnulacion(true);
    try {
      // El servidor recalcula el residual sin los controles anulados.
      const response = await apiService.saveRiesgo(actualizado);
      const guardado = response?.riesgo || actualizado;
      setRiesgos(safeRiesgos.map(item => (String(item.id) === String(id) ? guardado : item)));
      showNotification(`${accionHistorial}. Quedó registrado en el historial del riesgo.`, 'success');
      setSolicitudAnulacion(null);
    } catch (errorGuardado) {
      showNotification(errorGuardado?.message || 'No se pudo guardar la anulación.', 'error');
    } finally {
      setGuardandoAnulacion(false);
    }
  };

  // 🕑 Lista del historial de un riesgo (más reciente primero), con el detalle antes/después de cada cambio.
  const renderHistorialRiesgo = (riesgo) => {
    const historial = (Array.isArray(riesgo?.historialCambios) ? riesgo.historialCambios : []).filter(Boolean).slice().reverse();
    return (
      <>
        {historial.length === 0 ? (
          <p className="mt-3 text-[11px] text-slate-500">Este riesgo no tiene cambios registrados.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {historial.map((entrada, indice) => (
              <li key={`${entrada.timestamp || entrada.fecha}-${indice}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-slate-900">{entrada.accion}</strong>
                  <span className="text-[10px] text-slate-500">{entrada.usuario || 'Sin usuario registrado'} · {fechaEntradaHistorial(entrada)}</span>
                </div>
                {entrada.motivo && <p className="mt-1"><span className="text-slate-500">Motivo:</span> {entrada.motivo}</p>}
                {Array.isArray(entrada.cambios) && entrada.cambios.length > 0 && (
                  <table className="mt-2 w-full border-collapse text-left text-[10px]">
                    <thead className="text-slate-500">
                      <tr><th className="py-1 pr-2 font-bold">Campo</th><th className="py-1 pr-2 font-bold">Antes</th><th className="py-1 font-bold">Después</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {entrada.cambios.map((cambio, posicion) => (
                        <tr key={`${cambio.campo}-${posicion}`} className="align-top">
                          <td className="py-1 pr-2 font-semibold text-slate-800">{cambio.campo}</td>
                          <td className="py-1 pr-2 text-red-700 line-through decoration-red-300">{cambio.antes || '—'}</td>
                          <td className="py-1 text-emerald-800">{cambio.despues || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            ))}
          </ol>
        )}
      </>
    );
  };
  const [historialAbierto, setHistorialAbierto] = useState(null); // id del riesgo cuyo historial está abierto

  const handleDeleteRiesgo = async (id) => {
    const riesgo = safeRiesgos.find(item => String(item.id) === String(id));
    if (!riesgo || !puedeModificarRiesgo(riesgo)) {
      showNotification('Solo puedes modificar riesgos de los macroprocesos que tienes asignados.', 'error');
      return;
    }
    if (await confirmarEliminacion(`Se eliminará el riesgo ${riesgo.ref || riesgo.id} de la matriz corporativa.`)) {
      try {
        // 1. Eliminación en el servidor
        await apiService.deleteRiesgo(id);

        // 2. Actualización del estado local en React
        const updatedList = safeRiesgos.filter(r => r.id !== id);
        setRiesgos(updatedList);
        showNotification("Riesgo eliminado con éxito", "success");
      } catch (error) {
        console.error("Error al eliminar:", error);
        showNotification(error.message || "Error al intentar eliminar el riesgo.", "error");
      }
    }
  };
// =========================================================================
  // 🤖 FUNCIÓN DE ANALISIS CON IA EN TIEMPO REAL (DATOS 100% REALES + HALLAZGOS)
  // =========================================================================
  const solicitarAnalisisFilaIA = async (riesgo) => {
    setProcesandoIA(true);
    setDictamenIA(null);

    try {
      // Cifras calculadas por el sistema; la IA solo las interpreta.
      const datos = contextoRiesgo(riesgo, { calcularEficacia: calcularEficaciaControl, calcularMitigacion: calcularMitigacionRiesgo, evaluaciones });
      const { riesgo: ficha, metricas } = datos;
      const respuesta = await consultarPanelIA({
        instruccion: `Emite el dictamen del riesgo ${ficha.codigo} (inherente ${ficha.nivelInherente}, residual ${ficha.nivelResidual}). Parte de "analisisSistema", que ya trae el cálculo exacto, por qué queda en su zona, los pendientes y la simulación de mejoras: no lo repitas literalmente, interprétalo. 1) Di si la reducción a ${ficha.nivelResidual} es creíble contrastando el diseño de cada CTL con la bitácora, el plan de acción y "pruebasTrabajoDeCampo" (un control reprobado en campo debilita la credibilidad). 2) Señala por código los controles de los que depende la mitigación y su punto débil. 3) Recomienda primero las acciones que la simulación muestra que sí cambian la zona; si ninguna la cambia, dilo. 4) Incluye los pendientes del numeral 9 como acciones del plan.`,
        datos,
      });
      setDictamenIA({
        titulo: `Panel Ejecutivo Inteligente — ${ficha.codigo}`,
        dictamen: armarPanelIA(respuesta, {
          badges: { inherente: ficha.nivelInherente.toUpperCase(), residual: ficha.nivelResidual.toUpperCase() },
          kpis: {
            scoreRiesgo: `${ficha.puntajeResidual}/25`,
            scoreMadurez: metricas.eficaciaPromedioControles ?? 'Sin controles',
            totalControles: metricas.totalControles,
            coberturaControles: metricas.mitigacionLograda,
          },
        }),
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

// 🤖 FUNCIÓN DE AUDITORÍA DE CONTROLES INDIVIDUALES (ENTERPRISE PROMPT)
  const solicitarAnalisisControlIA = async (c, r) => {
    setProcesandoIA(true);
    setDictamenIA(null);

    try {
      const datosRiesgo = contextoRiesgo(r, { calcularEficacia: calcularEficaciaControl, calcularMitigacion: calcularMitigacionRiesgo, evaluaciones });
      const indice = (Array.isArray(r.controlesDetallados) ? r.controlesDetallados : []).indexOf(c);
      const control = datosRiesgo.controles[indice] || {
        codigo: 'CTL', descripcion: c.descripcion || 'Sin dato', tipo: c.tipo || 'Sin dato',
        ejecucion: c.implementacion || 'Sin dato', documentacion: c.documentacion || 'Sin dato',
        frecuencia: c.frecuencia || 'Sin dato', evidencia: c.evidencia || 'Sin dato', eficacia: calcularEficaciaControl(c),
      };
      const respuesta = await consultarPanelIA({
        instruccion: `Audita el control ${control.codigo} del riesgo ${datosRiesgo.riesgo.codigo}. No lo describas: evalúa su diseño (tipo, ejecución, documentación, frecuencia y evidencia) con la Tabla 6, su dependencia manual, su trazabilidad y si ataca la causa raíz del riesgo, comparándolo con los demás controles del mismo riesgo. Empieza por "analisisDelControl", que trae el cálculo exacto: di con sus cifras qué pasa si el control falla y si se automatiza, y si la zona cambia o no (si no cambia, no lo presentes como crítico). Si automatizarlo cambia la zona, esa es la recomendación prioritaria; si ni su falla ni su automatización cambian la zona, dilo e incluye en recomendaciones y en el plan las acciones de "analisisDelControl.accionesQueCambianLaZona" (cálculo exacto del sistema; pueden ser de otro control), empezando por la primera. Si al control auditado le falta documentación, frecuencia continua, evidencia o responsable (ver controlAuditado), incluye al menos una recomendación y una acción del plan sobre ese mismo control. Redacta las acciones del plan como tareas (qué hacer y para qué), sin copiar el cálculo literal. Si aparece en "pruebasTrabajoDeCampo" con calificación menor a 100 %, trátalo como alerta principal. El responsable del control está en controlAuditado.responsable.`,
        datos: { controlAuditado: control, analisisDelControl: analizarControlEnRiesgo(r, indice), ...datosRiesgo },
      });
      setDictamenIA({
        titulo: `Auditoría de Control ${control.codigo} — ${datosRiesgo.riesgo.codigo}`,
        dictamen: armarPanelIA(respuesta, {
          badges: { inherente: datosRiesgo.riesgo.nivelInherente.toUpperCase(), residual: datosRiesgo.riesgo.nivelResidual.toUpperCase() },
          kpis: {
            scoreRiesgo: `${datosRiesgo.riesgo.puntajeResidual}/25`,
            scoreMadurez: control.eficacia,
            totalControles: datosRiesgo.metricas.totalControles,
            coberturaControles: datosRiesgo.metricas.mitigacionLograda,
          },
          indicadores: [
            { etiqueta: 'Puntaje residual', valor: `${datosRiesgo.riesgo.puntajeResidual}/25` },
            { etiqueta: 'Eficacia del control', valor: `${control.eficacia}%` },
            { etiqueta: 'Controles del riesgo', valor: datosRiesgo.metricas.totalControles },
            { etiqueta: 'Mitigación del riesgo', valor: `${datosRiesgo.metricas.mitigacionLograda}%` },
          ],
        }),
      });
    } catch (error) {
      console.error("Error transmitiendo análisis de control IA:", error);
      if (showNotification) {
        showNotification("Error al conectar con la Inteligencia Artificial.", "error");
      }
    } finally {
      setProcesandoIA(false);
    }
  };
// =========================================================================
  // 📥 FUNCIÓN PARA EXPORTAR LA MATRIZ COMPLETA A EXCEL
  // =========================================================================
  const exportarAExcel = async (lista = riesgosVigentes, alcance = 'Toda la matriz', sufijoArchivo = '') => {
    if (lista.length === 0) {
      showNotification('No hay riesgos vigentes en el alcance elegido para exportar.', 'error');
      return false;
    }

    try {
      const { crearLibroMatrizRiesgosExcel } = await import('../utils/riesgosExcelExport.js');
      const libro = await crearLibroMatrizRiesgosExcel(lista, {
        getSeverityZone,
        calcularMitigacionRiesgo,
        calcularEficaciaControl,
        alcance,
      });
      const buffer = await libro.xlsx.writeBuffer({
        useStyles: true,
        useSharedStrings: true,
        zip: { compression: 'DEFLATE', compressionOptions: { level: 6 } },
      });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `Matriz_Riesgos_Termales${sufijoArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showNotification(`Excel descargado: ${lista.length} riesgos (${alcance}).`, 'success');
      return true;
    } catch (error) {
      console.error('Error al generar el libro Excel de riesgos:', error);
      showNotification("No fue posible generar el archivo Excel.", "error");
      return false;
    }
  };

  // 📥 Alcance de la descarga: toda la matriz o un macroproceso (con uno, varios o todos sus subprocesos).
  // Un líder solo ve sus macroprocesos asignados; un administrador, todos.
  const [descargaExcel, setDescargaExcel] = useState(null); // { tipo: 'global' | 'proceso', macroproceso, subprocesos: [] }
  const [generandoExcel, setGenerandoExcel] = useState(false);
  // Se calcula solo con la ventana abierta (normaliza la ubicación de cada riesgo).
  const ubicacionesVigentes = descargaExcel ? riesgosVigentes.map(riesgo => ({ riesgo, ubicacion: normalizarUbicacionRiesgo(riesgo, MAPA_PROCESOS) })) : [];
  const macroprocesosDescarga = [...new Set([
    ...Object.keys(MAPA_PROCESOS),
    ...ubicacionesVigentes.flatMap(({ ubicacion }) => ubicacion.macroprocesos),
  ])]
    .filter(macroproceso => macroproceso !== 'Sin proceso')
    .filter(macroproceso => isAdmin || procesosAsignadosUsuario.includes(normalizarTextoProceso(macroproceso)))
    .sort((a, b) => a.localeCompare(b, 'es'));
  const subprocesosDeMacroproceso = macroproceso => [...new Set([
    ...(Array.isArray(MAPA_PROCESOS[macroproceso]) ? MAPA_PROCESOS[macroproceso] : []),
    ...(ubicacionesVigentes.length > 0 ? ubicacionesVigentes.map(({ ubicacion }) => ubicacion) : riesgosVigentes.map(riesgo => normalizarUbicacionRiesgo(riesgo, MAPA_PROCESOS)))
      .flatMap(ubicacion => ubicacion.subprocesosPorMacroproceso?.[macroproceso] || []),
  ])].sort((a, b) => a.localeCompare(b, 'es'));
  // Por defecto, los subprocesos asignados al usuario (si los tiene en ese macroproceso); si no, todos.
  const subprocesosIniciales = macroproceso => {
    const todos = subprocesosDeMacroproceso(macroproceso);
    const asignados = todos.filter(subproceso => subprocesosAsignadosUsuario.includes(normalizarTextoProceso(subproceso)));
    return asignados.length > 0 ? asignados : todos;
  };
  const abrirDescargaExcel = () => {
    // Al abrir aún no hay ubicaciones calculadas: los macroprocesos asignados salen del catálogo y de los riesgos.
    const disponibles = [...new Set([
      ...Object.keys(MAPA_PROCESOS),
      ...riesgosVigentes.flatMap(riesgo => normalizarUbicacionRiesgo(riesgo, MAPA_PROCESOS).macroprocesos),
    ])].filter(nombre => nombre !== 'Sin proceso' && (isAdmin || procesosAsignadosUsuario.includes(normalizarTextoProceso(nombre))))
      .sort((a, b) => a.localeCompare(b, 'es'));
    const macroproceso = disponibles[0] || '';
    setDescargaExcel({ tipo: isAdmin || !macroproceso ? 'global' : 'proceso', macroproceso, subprocesos: macroproceso ? subprocesosIniciales(macroproceso) : [] });
  };
  const riesgosDeDescarga = descarga => {
    if (!descarga || descarga.tipo === 'global') return riesgosVigentes;
    const todos = subprocesosDeMacroproceso(descarga.macroproceso);
    const todosLosSubprocesos = descarga.subprocesos.length === todos.length;
    return ubicacionesVigentes
      .filter(({ ubicacion }) => ubicacion.macroprocesos.includes(descarga.macroproceso))
      .filter(({ ubicacion }) => todosLosSubprocesos || (ubicacion.subprocesosPorMacroproceso?.[descarga.macroproceso] || [])
        .some(subproceso => descarga.subprocesos.includes(subproceso)))
      .map(({ riesgo }) => riesgo);
  };
  const confirmarDescargaExcel = async () => {
    const lista = riesgosDeDescarga(descargaExcel);
    const todos = descargaExcel.tipo === 'proceso' ? subprocesosDeMacroproceso(descargaExcel.macroproceso) : [];
    const alcance = descargaExcel.tipo === 'global'
      ? 'Toda la matriz'
      : `${descargaExcel.macroproceso} · ${descargaExcel.subprocesos.length === todos.length ? 'todos los subprocesos' : `Subprocesos: ${descargaExcel.subprocesos.join(', ')}`}`;
    const sufijo = descargaExcel.tipo === 'global' ? '' : `_${descargaExcel.macroproceso.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}`;
    setGenerandoExcel(true);
    const listo = await exportarAExcel(lista, alcance, sufijo);
    setGenerandoExcel(false);
    if (listo) setDescargaExcel(null);
  };
// =========================================================================
  // 🤖 INFORME GLOBAL IA: MATRIZ DE RIESGOS (VERSIÓN DEFINITIVA BLINDADA)
  // =========================================================================
  const solicitarAnalisisGlobalIA = async () => {
    setProcesandoIA(true);
    setDictamenIA(null);

    try {
      if (safeRiesgos.length === 0) {
        if (showNotification) showNotification("No hay riesgos en la matriz para analizar.", "error");
        return;
      }
      // Datos reales de toda la matriz: sin valores de relleno ni reemplazos sobre el texto de la IA.
      const datos = contextoMatriz(riesgosVigentes, {
        calcularEficacia: calcularEficaciaControl,
        calcularMitigacion: calcularMitigacionRiesgo,
        hallazgos,
        planes: planesDeAccion,
        evaluaciones,
      });
      const { metricas, distribucionInherente, distribucionResidual } = datos;
      const respuesta = await consultarPanelIA({
        instruccion: `Redacta el informe estratégico de la matriz corporativa de riesgos (${metricas.totalRiesgos} riesgos, ${metricas.totalControles} controles) para la Junta Directiva. Compara la distribución inherente con la residual y evalúa si la reducción es creíble según la calidad real de los controles (manuales, no documentados, sin evidencia, de baja eficacia) y el estado de hallazgos y planes vencidos. Identifica los procesos y riesgos (por RSK) que concentran la exposición, los riesgos sin controles y los seguimientos vencidos. Prioriza los incumplimientos de "cumplimientoNumeral9" (Extremo o Alto sin plan de acción primero) y los controles reprobados en Trabajo de Campo, y propón prioridades aplicando las reglas de la Tabla 4 (no propongas bajar la probabilidad cuando el impacto es Mayor o Catastrófico).`,
        datos,
      });
      const altosExtremos = distribucion => distribucion.Extremo + distribucion.Alto;
      setDictamenIA({
        titulo: `Informe Estratégico de la Matriz de Riesgos — Junta Directiva`,
        dictamen: armarPanelIA(respuesta, {
          badges: {
            inherente: `${altosExtremos(distribucionInherente)} ALTOS/EXTREMOS`,
            residual: `${altosExtremos(distribucionResidual)} ALTOS/EXTREMOS`,
          },
          kpis: {
            scoreRiesgo: metricas.puntajeResidualPromedio === null ? 'Sin datos' : `${metricas.puntajeResidualPromedio}/25`,
            scoreMadurez: metricas.eficaciaPromedioControles ?? 'Sin controles',
            totalControles: metricas.totalControles,
            coberturaControles: metricas.mitigacionPromedio ?? 'Sin datos',
          },
        }),
      });
    } catch (error) {
      console.error("Error al procesar dictamen global:", error);
      if (showNotification) showNotification("Error al comunicarse con la IA.", "error");
    } finally {
      setProcesandoIA(false);
    }
  };
 const handleEditRiesgo = (riesgo) => {
    if (!puedeModificarRiesgo(riesgo)) {
      showNotification('Solo puedes modificar riesgos de los macroprocesos que tienes asignados.', 'error');
      return;
    }
    setSoloLecturaRiesgo(false);
    cargarRiesgoEnFormulario(riesgo, false);
  };

  const verDetalleRiesgo = (riesgo) => {
    setSoloLecturaRiesgo(true);
    setFormularioModificado(false);
    cargarRiesgoEnFormulario(riesgo, true);
  };

  const cargarRiesgoEnFormulario = (riesgo, consulta) => {
    setEditRiesgo(riesgo);
    setHistorialPendienteFormulario([]);
    setCustomId(riesgo.id); // 🔥 RECUPERAMOS EL ID PARA EL FORMULARIO
   const ubicacion = normalizarUbicacionRiesgo(riesgo, MAPA_PROCESOS);
      
// 🏢 Recuperar Sede (Soporta versiones viejas de texto único y versiones nuevas de selección múltiple)
    setSedeForm(Array.isArray(riesgo.sede) ? riesgo.sede : (riesgo.sede ? [riesgo.sede] : []));
    
    // Recuperar la relación por macroproceso, incluso para registros heredados.
    // En consulta se muestra la ubicación tal como está guardada, sin recortarla al alcance del usuario.
    const macrosEditables = consulta ? ubicacion.macroprocesos : ubicacion.macroprocesos.filter(macroproceso => (
      macroprocesosDisponibles.some(opcion => normalizarTextoProceso(opcion) === normalizarTextoProceso(macroproceso))
    ));
    const relacionEditable = Object.fromEntries(macrosEditables.map(macroproceso => {
      const subprocesosGuardados = ubicacion.subprocesosPorMacroproceso[macroproceso] || [];
      if (consulta) return [macroproceso, subprocesosGuardados];
      const subprocesosPermitidos = obtenerSubprocesosPermitidos(macroproceso);
      return [macroproceso, subprocesosGuardados.filter(subproceso => subprocesosPermitidos.some(opcion => (
        normalizarTextoProceso(opcion) === normalizarTextoProceso(subproceso)
      )))];
    }));
    setMacroprocesosSeleccionados(macrosEditables);
    setSubprocesosPorMacroprocesoSeleccionados(relacionEditable);

    setCategoria(riesgo.categoria);
    // El selector solo tiene las 7 del manual: una variante guardada se muestra (y se guarda) como la del manual.
    setClasificacionRiesgo(normalizarClasificacion(riesgo.clasificacionRiesgo) || CLASIFICACIONES_MANUAL[0]);
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
    
    setAfectacion(riesgo.afectacion || 'Económico'); 
    setCausaInmediata(riesgo.causaInmediata || '');
    setCausaRaiz(riesgo.causaRaiz || '');
    setEscenarioFinal(riesgo.escenarioFinal || riesgo.descripcion || '');
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

    if (!navigator.onLine) {
      alert("❌ ERROR DE RED: No tienes conexión a Internet. El riesgo no se puede guardar en la nube. Revisa tu WiFi o cable de red e intenta de nuevo.");
      showNotification("Sin conexión a internet", "error");
      return;
    }

    const macroprocesosCanonicos = [...new Set(macroprocesosSeleccionados.map(macroprocesoSeleccionado => (
      resolverNombreCatalogo(macroprocesoSeleccionado, Object.keys(MAPA_PROCESOS))
    )).filter(Boolean))];
    const relacionSubprocesosCanonica = Object.fromEntries(macroprocesosCanonicos.map(macroprocesoCanonico => {
      const subprocesosPermitidos = obtenerSubprocesosPermitidos(macroprocesoCanonico);
      const subprocesosElegidos = subprocesosPorMacroprocesoSeleccionados[macroprocesoCanonico] || [];
      const subprocesosCanonicos = [...new Set(subprocesosElegidos.map(subproceso => (
        resolverNombreCatalogo(subproceso, subprocesosPermitidos)
      )).filter(Boolean))];
      return [macroprocesoCanonico, subprocesosCanonicos];
    }));
    const subprocesosCanonicos = [...new Set(Object.values(relacionSubprocesosCanonica).flat())];
    if (!isAdmin && procesosAsignadosUsuario.length === 0) {
      showNotification('El formulario está disponible para todos, pero necesitas una asignación de macroproceso para guardar riesgos.', 'error');
      return;
    }
    if (macroprocesosCanonicos.length === 0 || macroprocesosCanonicos.some(macroprocesoCanonico => (
      (relacionSubprocesosCanonica[macroprocesoCanonico] || []).length === 0
    ))) {
      showNotification('Selecciona uno o más macroprocesos y al menos un subproceso válido para cada uno.', 'error');
      return;
    }
    if (!isAdmin && macroprocesosCanonicos.some(macroprocesoCanonico => (
      !procesosAsignadosUsuario.includes(normalizarTextoProceso(macroprocesoCanonico))
    ))) {
      showNotification('Solo puedes crear riesgos dentro de los macroprocesos que tienes asignados.', 'error');
      return;
    }

    setIsSubmitting(true);
    const ts = new Date().toLocaleString();

    try {
      let updatedList = [...safeRiesgos];
      const textoControlesConsolidados = controles.map((c, index) => `C${index + 1}. [${c.tipo}] ${c.descripcion} (${c.documentacion} - ${c.frecuencia})`).join('\n\n');
      const macroprocesoPrincipal = macroprocesosCanonicos[0];
      const subprocesoPrincipal = relacionSubprocesosCanonica[macroprocesoPrincipal]?.[0] || '';

      const nuevoRiesgo = {
        ...(editRiesgo || {}),
        id: editRiesgo ? editRiesgo.id : customId,
        idHallazgoOrigen: editRiesgo ? (editRiesgo.idHallazgoOrigen || null) : idHallazgoOrigen,
        origen: idHallazgoOrigen ? `Hallazgo Emergente (HAL-${idHallazgoOrigen})` : (editRiesgo?.origen || 'Identificación Interna'),
        sede: sedeForm,      
        proceso: macroprocesoPrincipal,
        macroproceso: macroprocesoPrincipal,
        macroprocesos: macroprocesosCanonicos,
        subproceso: subprocesoPrincipal,
        subprocesos: subprocesosCanonicos,
        subprocesosPorMacroproceso: relacionSubprocesosCanonica,
        categoria,
        clasificacionRiesgo,
        normativa,
        responsable: responsablesMultiples.length > 0 ? responsablesMultiples.join(', ') : 'Sin Asignar',
        afectacion,
        causaInmediata,
        causaRaiz,
        escenarioFinal: escenarioFinal || causaInmediata,
        descripcion: escenarioFinal || causaInmediata,
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
          // El servidor agrega la entrada con el detalle de cada campo modificado (antes y después).
          ? [...(editRiesgo.historialCambios || []), ...historialPendienteFormulario]
          : [{ fecha: ts, accion: 'Creación manual con matriz completa' }]
      };

      retirarDelPuente('promover_riesgo_temp');

      // 1. Guardar en el servidor Serverless (api/grc/riesgos.js)
      const response = await apiService.saveRiesgo(nuevoRiesgo);
      const riesgoGuardado = response?.riesgo || nuevoRiesgo;

      // 2. Actualizar el estado local con la respuesta procesada por el servidor
      if (editRiesgo) {
        const idx = updatedList.findIndex(r => r.id === editRiesgo.id);
        if (idx !== -1) updatedList[idx] = riesgoGuardado;
      } else {
        updatedList.push(riesgoGuardado);
      }

      setRiesgos(updatedList);
      showNotification(`Riesgo corporativo ${editRiesgo ? 'actualizado' : 'creado'} con éxito.`, "success");
      setFormularioModificado(false);
      setVistaActiva('dashboard');
      setEditRiesgo(null);
      
      setAfectacion('Económico'); setCausaInmediata(''); setCausaRaiz(''); setEscenarioFinal(''); setControles([]); setHistorialPendienteFormulario([]);
      setPlanAccionRiesgo(''); setFechaSeguimiento(''); setSeguimientoBitacora('');

    } catch (error) {
      console.error("Error crítico al guardar:", error);
      showNotification(error.message || "Error de conexión al guardar el riesgo.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  


  const renderDashboard = () => {
    const niveles = ['Extremo', 'Alto', 'Moderado', 'Bajo'];
    // Escalas de las Tablas 2 y 3 del manual.
    const probabilidades = ESCALA_PROBABILIDAD.map((etiqueta, indice) => ({ nivel: indice + 1, etiqueta }));
    const impactos = ESCALA_IMPACTO.map((etiqueta, indice) => ({ nivel: indice + 1, etiqueta })).reverse();
    const mapaProcesosDashboard = Object.keys(MAPA_PROCESOS).length > 0 ? MAPA_PROCESOS : MAPA_PROCESOS_PREDETERMINADO;
    const riesgosNormalizados = riesgosVigentes.map(riesgo => normalizarUbicacionRiesgo(riesgo, mapaProcesosDashboard));
    const procesosUnicos = [...new Set([...Object.keys(mapaProcesosDashboard), ...riesgosNormalizados.flatMap(riesgo => riesgo.macroprocesos)])]
      .sort((a, b) => a.localeCompare(b, 'es'));
    const macroprocesoSeleccionado = filtroProceso === 'Todos'
      ? null
      : obtenerClaveNormalizada(mapaProcesosDashboard, filtroProceso) || filtroProceso;
    const subprocesosCatalogoDashboard = filtroProceso === 'Todos'
      ? Object.values(mapaProcesosDashboard).flat()
      : mapaProcesosDashboard[macroprocesoSeleccionado] || [];
    const subprocesosUnicos = [...new Set([...subprocesosCatalogoDashboard, ...riesgosNormalizados.flatMap(riesgo => (
      filtroProceso === 'Todos'
        ? riesgo.subprocesos
        : riesgo.subprocesosPorMacroproceso[obtenerClaveNormalizada(riesgo.subprocesosPorMacroproceso, macroprocesoSeleccionado)] || []
    ))])].sort((a, b) => a.localeCompare(b, 'es'));
    // Cada variante escrita (mayúsculas, tildes, errores) se agrupa en su clasificación del manual (Tabla 5).
    const clasificacionesUnicas = [...new Set(riesgosNormalizados.map(clasificacionDeRiesgo))].sort((a, b) => a.localeCompare(b, 'es'));
    // Todo el panorama (tarjetas, mapa, filtro y listas) usa el momento elegido: inherente o residual.
    const esResidual = matrizDashboardTipo === 'residual';
    const nivelActivo = esResidual ? 'Residual' : 'Inherente';
    const obtenerCoordenada = (riesgo, eje) => extraerNivelMatriz(
      eje === 'probabilidad'
        ? (esResidual ? riesgo.probabilidadResidual : riesgo.probabilidadInherente)
        : (esResidual ? riesgo.impactoResidual : riesgo.impactoInherente),
      eje,
      riesgoEnPorcentaje(riesgo),
    );
    const scoreRiesgo = riesgo => obtenerCoordenada(riesgo, 'probabilidad') * obtenerCoordenada(riesgo, 'impacto');
    // Zona según la matriz de calor del manual (Tabla 4), no por el producto P×I.
    const nivelRiesgo = riesgo => zonaPorNiveles(obtenerCoordenada(riesgo, 'probabilidad'), obtenerCoordenada(riesgo, 'impacto'));
    const riesgosBaseDashboard = riesgosNormalizados.filter(riesgo => {
      const macroprocesos = riesgo.macroprocesos.length > 0 ? riesgo.macroprocesos : ['Sin proceso'];
      const subprocesos = filtroProceso === 'Todos'
        ? riesgo.subprocesos
        : riesgo.subprocesosPorMacroproceso[obtenerClaveNormalizada(riesgo.subprocesosPorMacroproceso, macroprocesoSeleccionado)] || [];
      const clasificacion = clasificacionDeRiesgo(riesgo);
      const textoBusqueda = `${riesgo.id} ${riesgo.descripcion || riesgo.escenarioFinal || ''} ${macroprocesos.join(' ')} ${subprocesos.join(' ')} ${clasificacion}`.toLowerCase();
      return (filtroProceso === 'Todos' || macroprocesos.some(macroproceso => (
        normalizarTextoProceso(macroproceso) === normalizarTextoProceso(macroprocesoSeleccionado)
      )))
        && (filtroSubproceso === 'Todos' || subprocesos.some(subproceso => (
          normalizarTextoProceso(subproceso) === normalizarTextoProceso(filtroSubproceso)
        )))
        && (filtroClasificacion === 'Todas' || clasificacion === filtroClasificacion)
        && (!searchTerm || textoBusqueda.includes(searchTerm.toLowerCase()));
    });
    const riesgosDashboard = filtroNivelDashboard === 'Todos'
      ? riesgosBaseDashboard
      : riesgosBaseDashboard.filter(riesgo => nivelRiesgo(riesgo) === filtroNivelDashboard);

    const totalRiesgos = riesgosDashboard.length;
    // Las tarjetas cuentan sobre la base: al elegir un nivel, las demás conservan su número.
    const conteoNiveles = Object.fromEntries(niveles.map(nivel => [
      nivel,
      riesgosBaseDashboard.filter(r => nivelRiesgo(r) === nivel).length,
    ]));
    const extremos = conteoNiveles.Extremo;
    const altos = conteoNiveles.Alto;
    const moderados = conteoNiveles.Moderado;
    const bajos = conteoNiveles.Bajo;
    const controlesEstructurados = riesgosDashboard.flatMap(r => Array.isArray(r.controlesDetallados) ? r.controlesDetallados.filter(Boolean) : []);
    const controlesRegistrados = riesgosDashboard.reduce((total, riesgo) => {
      const controles = Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.filter(Boolean).length : 0;
      return total + (controles || (riesgo.descripcionControl ? 1 : 0));
    }, 0);
    const riesgosSinControl = riesgosDashboard.filter(r => !Array.isArray(r.controlesDetallados) || r.controlesDetallados.length === 0).length;
    // Los controles anulados no reducen el riesgo: no cuentan en la eficacia promedio.
    const controlesVigentesDashboard = vigentes(controlesEstructurados);
    const eficaciaPromedio = controlesVigentesDashboard.length > 0
      ? Math.round(controlesVigentesDashboard.reduce((total, control) => total + calcularEficaciaControl(control), 0) / controlesVigentesDashboard.length)
      : 0;
    // Texto del alcance para las explicaciones: proceso y filtros aplicados.
    const filtrosAlcance = [
      filtroSubproceso !== 'Todos' && `subproceso ${filtroSubproceso}`,
      filtroClasificacion !== 'Todas' && `clasificación ${filtroClasificacion}`,
      filtroNivelDashboard !== 'Todos' && `nivel ${filtroNivelDashboard} ${nivelActivo.toLowerCase()}`,
      searchTerm && `búsqueda "${searchTerm}"`,
    ].filter(Boolean);
    const alcanceDashboard = `${filtroProceso !== 'Todos' ? filtroProceso : 'toda la matriz'}${filtrosAlcance.length ? ` (${filtrosAlcance.join(', ')})` : ''}`;
    const mitigacionPromedio = totalRiesgos > 0
      ? Math.round(riesgosDashboard.reduce((total, riesgo) => total + calcularMitigacionRiesgo(riesgo), 0) / totalRiesgos)
      : 0;
    const riesgosPrioritarios = [...riesgosDashboard].sort((a, b) => {
      const diferenciaScore = scoreRiesgo(b) - scoreRiesgo(a);
      if (diferenciaScore !== 0) return diferenciaScore;
      return String(a.fechaSeguimiento || '9999').localeCompare(String(b.fechaSeguimiento || '9999'));
    });
    const conteoProcesos = riesgosDashboard.reduce((conteo, riesgo) => {
      const macroprocesos = riesgo.macroprocesos.length > 0 ? riesgo.macroprocesos : ['Sin proceso'];
      macroprocesos.forEach(macroproceso => {
        conteo[macroproceso] = (conteo[macroproceso] || 0) + 1;
      });
      return conteo;
    }, {});
    const topProcesos = Object.entries(conteoProcesos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxProceso = Math.max(...topProcesos.map(([, cantidad]) => cantidad), 1);
    const cambiarMomentoDashboard = momento => {
      setMatrizDashboardTipo(momento);
      // Las coordenadas cambian entre inherente y residual: la celda elegida ya no aplica.
      setCuadranteDashboard(null);
    };
    // Abre "Ver matriz" con los riesgos del proceso y los mismos filtros del dashboard, para que el número coincida.
    const abrirMatrizDeProceso = proceso => {
      if (filtroProceso !== proceso) setFiltroSubproceso('Todos');
      setFiltroProceso(proceso);
      setFiltroCumplimiento(null);
      setFiltroNivel(filtroNivelDashboard === 'Todos' ? 'Todos' : `${matrizDashboardTipo === 'inherente' ? 'inh' : 'res'}:${filtroNivelDashboard}`);
      setFiltroEstadoRiesgo('Activos');
      setCuadranteDashboard(null);
      setVistaActiva('matriz');
    };
    // Cumplimiento del numeral 9 con los filtros del dashboard (sin el nivel elegido: el criterio ya define la zona).
    const cumplimiento = cumplimientoNumeral9(riesgosBaseDashboard, evaluaciones);
    const abrirMatrizCumplimiento = criterio => {
      setFiltroCumplimiento(criterio);
      setFiltroNivel('Todos');
      setFiltroEstadoRiesgo('Activos');
      setCuadranteDashboard(null);
      setVistaActiva('matriz');
    };
    const elegirNivelDashboard = nivel => {
      setFiltroNivelDashboard(actual => (actual === nivel && nivel !== 'Todos' ? 'Todos' : nivel));
      setCuadranteDashboard(null);
    };
    const selectorMomento = (oscuro = false) => (
      <div role="group" aria-label="Momento de evaluación" className={`inline-flex w-fit rounded-lg border p-1 ${oscuro ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-100'}`}>
        {[
          { id: 'inherente', texto: 'Inherente', ayuda: 'Antes de controles' },
          { id: 'residual', texto: 'Residual', ayuda: 'Después de controles' },
        ].map(opcion => (
          <button
            type="button"
            key={opcion.id}
            title={opcion.ayuda}
            aria-pressed={matrizDashboardTipo === opcion.id}
            onClick={() => cambiarMomentoDashboard(opcion.id)}
            className={`min-h-8 rounded-md px-3 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${matrizDashboardTipo === opcion.id ? 'bg-emerald-600 text-white shadow-sm' : oscuro ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-white'}`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>
    );
    const riesgosEnCuadrante = cuadranteDashboard
      ? riesgosDashboard.filter(riesgo => obtenerCoordenada(riesgo, 'probabilidad') === cuadranteDashboard.probabilidad
        && obtenerCoordenada(riesgo, 'impacto') === cuadranteDashboard.impacto)
      : riesgosPrioritarios.slice(0, 4);
    const riesgosVencidos = riesgosDashboard.filter(riesgo => riesgo.fechaSeguimiento
      && new Date(`${riesgo.fechaSeguimiento}T23:59:59`) < new Date()
      && riesgo.estado !== 'Cerrado').length;

    const colorCelda = zona => ({
      Extremo: 'border-rose-400/45 bg-rose-950/75 text-rose-200 hover:bg-rose-900/80',
      Alto: 'border-orange-400/40 bg-orange-950/65 text-orange-200 hover:bg-orange-900/75',
      Moderado: 'border-amber-400/40 bg-amber-950/55 text-amber-200 hover:bg-amber-900/70',
    }[zona] || 'border-emerald-400/35 bg-emerald-950/65 text-emerald-200 hover:bg-emerald-900/80');

    // Cuántos filtros hay aplicados (se muestra en el botón "Quitar filtros").
    const filtrosActivosDashboard = [
      searchTerm, filtroProceso !== 'Todos', filtroSubproceso !== 'Todos', filtroClasificacion !== 'Todas',
      filtroNivelDashboard !== 'Todos', cuadranteDashboard,
    ].filter(Boolean).length;
    const limpiarFiltrosDashboard = () => {
      setSearchTerm('');
      setFiltroProceso('Todos');
      setFiltroSubproceso('Todos');
      setFiltroClasificacion('Todas');
      setFiltroNivel('Todos');
      setFiltroNivelDashboard('Todos');
      setCuadranteDashboard(null);
      setFiltroCumplimiento(null);
    };

    const solicitarDictamenIA = async () => {
      setProcesandoIA(true);
      setDictamenIA(null);

      try {
        if (riesgosDashboard.length === 0) {
          if (showNotification) showNotification('No hay riesgos en la vista actual para analizar.', 'error');
          return;
        }
        const datos = {
          vista: {
            momentoEvaluado: nivelActivo,
            macroproceso: filtroProceso,
            subproceso: filtroSubproceso,
            clasificacion: filtroClasificacion,
            nivel: filtroNivelDashboard,
          },
          ...contextoMatriz(riesgosDashboard, {
            calcularEficacia: calcularEficaciaControl,
            calcularMitigacion: calcularMitigacionRiesgo,
            hallazgos,
            planes: planesDeAccion,
            evaluaciones,
          }),
        };
        const respuesta = await consultarPanelIA({
          instruccion: `Analiza la vista actual del panorama de riesgos (filtros en "vista"; momento evaluado: ${nivelActivo.toLowerCase()}). Explica dónde se concentra la exposición, qué procesos y riesgos (por RSK) requieren atención primero, si los controles sostienen la reducción de inherente a residual, y qué incumplimientos de "cumplimientoNumeral9" hay en esta vista.`,
          datos,
        });
        const altosExtremos = distribucion => distribucion.Extremo + distribucion.Alto;
        setDictamenIA({
          titulo: "Diagnóstico de la vista — Inteligencia Artificial",
          dictamen: armarPanelIA(respuesta, {
            badges: {
              inherente: `${altosExtremos(datos.distribucionInherente)} ALTOS/EXTREMOS`,
              residual: `${altosExtremos(datos.distribucionResidual)} ALTOS/EXTREMOS`,
            },
            kpis: {
              scoreRiesgo: datos.metricas.puntajeResidualPromedio === null ? 'Sin datos' : `${datos.metricas.puntajeResidualPromedio}/25`,
              scoreMadurez: datos.metricas.eficaciaPromedioControles ?? 'Sin controles',
              totalControles: datos.metricas.totalControles,
              coberturaControles: datos.metricas.mitigacionPromedio ?? 'Sin datos',
            },
          }),
        });
      } catch (error) {
        console.error("Error al procesar dictamen corporativo con IA:", error);
        if (showNotification) showNotification("Error al comunicarse con el motor de IA.", "error");
      } finally {
        setProcesandoIA(false);
      }
    };
    return (
      <div className="space-y-5 animate-in fade-in duration-300 relative font-sans text-slate-800">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900">Panorama de riesgos</h3>
            <p className="mt-1 text-xs text-slate-500">Exposición, controles y seguimiento de la matriz corporativa.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-[10px] font-bold text-slate-500">
              Macroproceso
              <select value={filtroProceso} onChange={event => { setFiltroProceso(event.target.value); setFiltroSubproceso('Todos'); setCuadranteDashboard(null); }} className="min-h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <option value="Todos">Todos los procesos</option>
                {procesosUnicos.map(proceso => <option key={proceso} value={proceso}>{proceso}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-500">
              Subproceso
              <select value={filtroSubproceso} onChange={event => setFiltroSubproceso(event.target.value)} className="min-h-10 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <option value="Todos">Todos</option>
                {subprocesosUnicos.map(subproceso => <option key={subproceso} value={subproceso}>{subproceso}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-500">
              Clasificación
              <select value={filtroClasificacion} onChange={event => setFiltroClasificacion(event.target.value)} className="min-h-10 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <option value="Todas">Todas</option>
                {clasificacionesUnicas.map(clasificacion => <option key={clasificacion} value={clasificacion}>{clasificacion}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-bold text-slate-500">
              Nivel {nivelActivo.toLowerCase()}
              <select value={filtroNivelDashboard} onChange={event => { setFiltroNivelDashboard(event.target.value); setCuadranteDashboard(null); }} className="min-h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                <option value="Todos">Todos</option>
                {niveles.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={limpiarFiltrosDashboard}
              disabled={filtrosActivosDashboard === 0}
              title={filtrosActivosDashboard > 0 ? 'Quita todos los filtros y vuelve a mostrar toda la matriz' : 'No hay filtros aplicados'}
              aria-label={filtrosActivosDashboard > 0 ? `Quitar ${filtrosActivosDashboard} filtro(s) y restablecer la vista` : 'No hay filtros aplicados'}
              className={`group inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${filtrosActivosDashboard > 0
                ? 'bg-[#0A3B32] text-white shadow-md shadow-emerald-900/20 hover:-translate-y-0.5 hover:bg-[#062620] hover:shadow-lg'
                : 'cursor-default border border-slate-200 bg-slate-50 text-slate-400'}`}
            >
              <RotateCcw size={14} aria-hidden="true" className={filtrosActivosDashboard > 0 ? 'transition-transform duration-500 group-hover:-rotate-180' : ''} />
              <span>Quitar filtros</span>
              {filtrosActivosDashboard > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-black text-[#0A3B32]">{filtrosActivosDashboard}</span>
              )}
            </button>
          </div>
        </section>

        {procesosAsignadosUsuario.length === 0 && (
          <div role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-950">
            <strong>Consulta completa · Solo lectura.</strong> Tu perfil no tiene macroprocesos asignados para crear o editar riesgos. Solicita la asignación en Configuración.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-slate-600">
            Viendo el nivel <strong className="text-slate-900">{nivelActivo.toLowerCase()}</strong> ({esResidual ? 'después de controles' : 'antes de controles'}). Tarjetas, mapa y listas cambian juntos.
          </p>
          {selectorMomento(false)}
        </div>

        <section aria-label={`Indicadores de riesgo ${nivelActivo.toLowerCase()}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { nivel: 'Todos', titulo: filtroNivelDashboard === 'Todos' ? 'Riesgos visibles' : 'Ver todos', valor: riesgosBaseDashboard.length, color: 'border-slate-300 text-slate-900', detalle: filtroNivelDashboard === 'Todos' ? 'Todos los niveles' : `Mostrando ${totalRiesgos} · quitar nivel` },
            { nivel: 'Extremo', titulo: 'Extremos', valor: extremos, color: 'border-rose-300 text-rose-700', detalle: 'Atención inmediata' },
            { nivel: 'Alto', titulo: 'Altos', valor: altos, color: 'border-orange-300 text-orange-700', detalle: 'Requieren tratamiento' },
            { nivel: 'Moderado', titulo: 'Moderados', valor: moderados, color: 'border-amber-300 text-amber-700', detalle: 'Monitorear' },
            { nivel: 'Bajo', titulo: 'Bajos', valor: bajos, color: 'border-emerald-300 text-emerald-700', detalle: 'Dentro de control' },
          ].map(indicador => (
            <button
              type="button"
              key={indicador.nivel}
              aria-pressed={filtroNivelDashboard === indicador.nivel}
              onClick={() => elegirNivelDashboard(indicador.nivel)}
              className={`min-h-28 rounded-xl border-l-4 bg-white px-4 py-3 text-left shadow-sm transition-all hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${indicador.color} ${filtroNivelDashboard === indicador.nivel ? 'ring-2 ring-emerald-700/70 shadow-md' : filtroNivelDashboard !== 'Todos' && indicador.nivel !== 'Todos' ? 'opacity-60 hover:opacity-100' : ''}`}
            >
              <span className="block text-[11px] font-bold text-slate-500">{indicador.titulo}{indicador.nivel !== 'Todos' && <span className="font-semibold text-slate-400"> · {nivelActivo.toLowerCase()}</span>}</span>
              <span className="mt-1 block text-3xl font-black tabular-nums">{indicador.valor}</span>
              <span className="mt-1 block text-[10px] text-slate-500">{indicador.detalle}</span>
            </button>
          ))}
        </section>

        <section aria-label="Mapa de riesgo y detalle de cuadrante" className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0B1730] p-4 text-white shadow-lg sm:p-5">
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-700 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-white">Mapa de riesgos 5×5 · {nivelActivo.toLowerCase()}</h3>
                <p className="mt-1 text-[11px] text-slate-400">Selecciona una celda para abrir los riesgos de esa coordenada.</p>
              </div>
              {selectorMomento(true)}
            </div>

            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-300" aria-label="Leyenda de severidad">
              {[
                { label: 'Bajo · 1–4', color: 'bg-emerald-400' },
                { label: 'Moderado · 5–9', color: 'bg-amber-400' },
                { label: 'Alto · 10–15', color: 'bg-orange-400' },
                { label: 'Extremo · 16–25', color: 'bg-rose-400' },
              ].map(leyenda => <span key={leyenda.label} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-sm ${leyenda.color}`} />{leyenda.label}</span>)}
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[100px_repeat(5,minmax(0,1fr))] gap-1.5">
                  <div className="flex items-end justify-end pb-2 pr-2 text-right text-[9px] font-bold text-slate-400">Impacto ↓<br />Probabilidad →</div>
                  {probabilidades.map(probabilidad => <div key={probabilidad.nivel} className="flex min-h-9 items-end justify-center pb-1 text-center text-[9px] font-semibold text-slate-300">{probabilidad.nivel} · {probabilidad.etiqueta}</div>)}
                  {impactos.map(impacto => (
                    <Fragment key={impacto.nivel}>
                      <div className="flex items-center justify-end pr-2 text-right text-[10px] font-semibold text-slate-300">{impacto.nivel} · {impacto.etiqueta}</div>
                      {probabilidades.map(probabilidad => {
                        const conteo = riesgosDashboard.filter(riesgo => obtenerCoordenada(riesgo, 'probabilidad') === probabilidad.nivel
                          && obtenerCoordenada(riesgo, 'impacto') === impacto.nivel).length;
                        const seleccionado = cuadranteDashboard?.probabilidad === probabilidad.nivel && cuadranteDashboard?.impacto === impacto.nivel;
                        const zonaCelda = zonaPorNiveles(probabilidad.nivel, impacto.nivel);
                        const fueraDelNivel = filtroNivelDashboard !== 'Todos' && zonaCelda !== filtroNivelDashboard;
                        return (
                          <button
                            type="button"
                            key={`${probabilidad.nivel}-${impacto.nivel}`}
                            aria-pressed={seleccionado}
                            aria-label={`${conteo} riesgos; probabilidad ${probabilidad.etiqueta}; impacto ${impacto.etiqueta}; zona ${zonaCelda}`}
                            onClick={() => setCuadranteDashboard(seleccionado ? null : { probabilidad: probabilidad.nivel, impacto: impacto.nivel })}
                            className={`relative flex h-14 flex-col items-center justify-center rounded-md border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-16 ${colorCelda(zonaCelda)} ${seleccionado ? 'z-10 ring-2 ring-white ring-offset-2 ring-offset-[#0B1730]' : ''} ${fueraDelNivel ? 'opacity-30' : ''}`}
                          >
                            <span className="text-xl font-black tabular-nums leading-none">{conteo}</span>
                            <span className="mt-1 text-[8px] font-semibold opacity-80">{zonaCelda}</span>
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
                <p className="mt-2 text-center text-[9px] font-semibold text-slate-400">Probabilidad</p>
              </div>
            </div>
          </div>

          <aside className="flex min-h-[390px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-live="polite">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{cuadranteDashboard ? 'Riesgos del cuadrante' : 'Riesgos prioritarios'}</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {cuadranteDashboard
                      ? `${nivelActivo}: P${cuadranteDashboard.probabilidad} × I${cuadranteDashboard.impacto} · puntaje ${cuadranteDashboard.probabilidad * cuadranteDashboard.impacto}`
                      : `Mayor puntaje ${nivelActivo.toLowerCase()} dentro de los filtros actuales`}
                  </p>
                </div>
                {cuadranteDashboard && <button type="button" onClick={() => setCuadranteDashboard(null)} className="min-h-8 rounded-md px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Limpiar celda</button>}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-3xl font-black tabular-nums text-slate-900">{riesgosEnCuadrante.length}</span>
                <span className="pb-1 text-[11px] text-slate-500">{cuadranteDashboard ? 'riesgos en esta coordenada' : 'riesgos para revisar primero'}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {riesgosEnCuadrante.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No hay riesgos en esta coordenada con los filtros actuales.</p>
              ) : riesgosEnCuadrante.map(riesgo => {
                const nivel = nivelRiesgo(riesgo);
                const controles = Array.isArray(riesgo.controlesDetallados) ? riesgo.controlesDetallados.length : 0;
                const puedeEditar = puedeModificarRiesgo(riesgo);
                // Quien puede editar abre la ficha de edición; los demás la abren en modo consulta.
                return (
                  <button type="button" onClick={() => (puedeEditar ? handleEditRiesgo(riesgo) : verDetalleRiesgo(riesgo))} aria-label={`${puedeEditar ? 'Editar' : 'Consultar'} riesgo RSK-${riesgo.id}`} key={riesgo.id} className="group block w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-black text-emerald-800">RSK-{riesgo.id}</span>
                      <span className={`rounded px-2 py-0.5 text-[9px] font-black ${nivel === 'Extremo' ? 'bg-rose-100 text-rose-800' : nivel === 'Alto' ? 'bg-orange-100 text-orange-800' : nivel === 'Moderado' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{nivel}</span>
                    </span>
                    <span className="mt-1 block text-xs font-bold leading-snug text-slate-800">{riesgo.descripcion || riesgo.escenarioFinal || 'Riesgo sin descripción'}</span>
                    <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span>{filtroProceso !== 'Todos' ? filtroProceso : riesgo.macroprocesos.join(', ') || 'Sin proceso'}</span>
                      <span>{controles || (riesgo.descripcionControl ? 1 : 0)} controles</span>
                      <span>Mitigación {calcularMitigacionRiesgo(riesgo)}%</span>
                      {riesgo.fechaSeguimiento && <span>Seguimiento {riesgo.fechaSeguimiento}</span>}
                    </span>
                    <span className="mt-2 inline-flex text-[10px] font-bold text-emerald-800 group-hover:underline">{puedeEditar ? '✏️ Editar' : '👁 Ver detalle'}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-200 px-4 py-2 text-[10px] text-slate-500">Selecciona un registro para abrir su ficha: editable si es de tu proceso, en consulta si no.</div>
          </aside>
        </section>

        <section aria-labelledby="titulo-cumplimiento" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="titulo-cumplimiento" className="text-sm font-black text-slate-900">Cumplimiento del manual (numeral 9)</h3>
            <p className="text-[10px] text-slate-500">Con los filtros actuales · selecciona una tarjeta para ver esos riesgos en la matriz</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(CRITERIOS_CUMPLIMIENTO).map(([criterio, { titulo, regla }]) => {
              const lista = cumplimiento[criterio];
              const hay = lista.length > 0;
              return (
                <button
                  type="button"
                  key={criterio}
                  onClick={() => abrirMatrizCumplimiento(criterio)}
                  disabled={!hay}
                  title={regla}
                  aria-label={`${titulo}: ${lista.length} riesgo(s). ${hay ? 'Ver en la matriz' : 'Cumple'}`}
                  className={`group rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${hay
                    ? 'border-rose-200 bg-rose-50/60 hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md'
                    : 'cursor-default border-emerald-200 bg-emerald-50/50'}`}
                >
                  <span className={`block text-2xl font-black tabular-nums ${hay ? 'text-rose-700' : 'text-emerald-700'}`}>{hay ? lista.length : '✓'}</span>
                  <span className="mt-1 block text-[11px] font-bold text-slate-800">{titulo}</span>
                  <span className="mt-1 block text-[10px] leading-snug text-slate-500">
                    {hay ? `${lista.slice(0, 4).map(r => `RSK-${r.id}`).join(', ')}${lista.length > 4 ? ` y ${lista.length - 4} más` : ''}` : 'Ningún riesgo incumple.'}
                  </span>
                  {hay && <span className="mt-2 inline-block text-[10px] font-bold text-rose-700 group-hover:underline">Ver en la matriz →</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="Indicadores complementarios" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {[
            { titulo: 'Controles registrados', valor: controlesRegistrados, nota: `${controlesEstructurados.length} estructurados`, explicar: () => explicarControlesRegistrados({ riesgos: riesgosDashboard, alcance: alcanceDashboard }) },
            { titulo: 'Eficacia promedio', valor: `${eficaciaPromedio}%`, nota: 'Según atributos del control', explicar: () => explicarEficaciaPromedio({ riesgos: riesgosDashboard, alcance: alcanceDashboard }) },
            { titulo: 'Mitigación promedio', valor: `${mitigacionPromedio}%`, nota: 'Reducción frente al riesgo inherente', explicar: () => explicarMitigacionPromedio({ riesgos: riesgosDashboard, alcance: alcanceDashboard, calcularMitigacion: calcularMitigacionRiesgo }) },
            { titulo: 'Seguimientos vencidos', valor: riesgosVencidos, nota: `${riesgosSinControl} riesgos sin controles estructurados`, explicar: () => explicarSeguimientos({ riesgos: riesgosDashboard, alcance: alcanceDashboard }) },
          ].map(indicador => (
            <div key={indicador.titulo} className="bg-white px-4 py-3">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">{indicador.titulo}<BotonExplicacion etiqueta={indicador.titulo} onClick={() => setExplicacionDashboard(indicador.explicar())} /></span>
              <span className="mt-1 block text-xl font-black tabular-nums text-slate-900">{indicador.valor}</span>
              <span className="mt-1 block text-[9px] text-slate-500">{indicador.nota}</span>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">Exposición por proceso<BotonExplicacion etiqueta="Exposición por proceso" onClick={() => setExplicacionDashboard(explicarExposicionPorProceso({ riesgos: riesgosDashboard, topProcesos, nivelRiesgo, nivelActivo }))} /></h3>
                <p className="mt-1 text-[10px] text-slate-500">Selecciona un proceso para ver sus riesgos en la matriz.</p>
              </div>
              <button type="button" onClick={solicitarDictamenIA} className="min-h-9 rounded-lg border border-emerald-700 px-3 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">Analizar con IA</button>
            </div>
            <div className="space-y-1">
              {topProcesos.length === 0 ? <p className="py-5 text-center text-xs text-slate-500">No hay procesos con riesgos en esta vista.</p> : topProcesos.map(([proceso, cantidad]) => (
                <button type="button" key={proceso} onClick={() => abrirMatrizDeProceso(proceso)} aria-label={`Ver en la matriz los ${cantidad} riesgos de ${proceso}`} className={`grid min-h-10 w-full grid-cols-[minmax(110px,0.9fr)_minmax(60px,1.8fr)_36px] items-center gap-3 rounded-md px-2 text-left text-[11px] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${filtroProceso === proceso ? 'bg-emerald-50' : ''}`}>
                  <span className="truncate font-semibold text-slate-700">{proceso}</span>
                  <span className="h-2 overflow-hidden rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-[#0A3B32]" style={{ width: `${(cantidad / maxProceso) * 100}%` }} /></span>
                  <span className="text-right font-black tabular-nums text-slate-800">{cantidad}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 border-b border-slate-200 pb-3">
              <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900">Riesgos de mayor exposición<BotonExplicacion etiqueta="Riesgos de mayor exposición" onClick={() => setExplicacionDashboard(explicarMayorExposicion({ riesgos: riesgosPrioritarios.slice(0, 5), obtenerCoordenada, nivelRiesgo, nivelActivo }))} /></h3>
              <p className="mt-1 text-[10px] text-slate-500">Ordenados por puntaje {nivelActivo.toLowerCase()}; selecciona para abrir el registro.</p>
            </div>
            <div className="space-y-1">
              {riesgosPrioritarios.slice(0, 5).map((riesgo, indice) => {
                const puedeEditar = puedeModificarRiesgo(riesgo);
                return <button type="button" onClick={() => (puedeEditar ? handleEditRiesgo(riesgo) : verDetalleRiesgo(riesgo))} aria-label={`${puedeEditar ? 'Editar' : 'Consultar'} riesgo RSK-${riesgo.id}`} key={riesgo.id} className={`grid min-h-12 w-full grid-cols-[28px_minmax(0,1fr)_54px] items-center gap-2 rounded-md px-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700`}>
                  <span className="font-mono text-[10px] font-bold text-slate-400">{String(indice + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-slate-800">{riesgo.descripcion || riesgo.escenarioFinal || `Riesgo RSK-${riesgo.id}`}</span>
                    <span className="block truncate text-[9px] text-slate-500">{riesgo.macroprocesos.join(', ') || 'Sin proceso'} · RSK-{riesgo.id}{riesgo.fechaSeguimiento ? ` · ${riesgo.fechaSeguimiento}` : ''}</span>
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-center text-[10px] font-black tabular-nums text-slate-800">S {scoreRiesgo(riesgo)}</span>
                </button>;
              })}
              {riesgosPrioritarios.length === 0 && <p className="py-5 text-center text-xs text-slate-500">No hay riesgos que coincidan con los filtros.</p>}
            </div>
          </div>
        </section>
      </div>
    );
  };

const renderMatriz = () => {
    // 📊 Métricas calculadas para la barra superior
    const totalRiesgosCount = riesgosVigentes.length;
    const riesgosAltosCriticosCount = riesgosVigentes.filter(r => {
      const z = getSeverityZone(r.probabilidadResidual, r.impactoResidual, riesgoEnPorcentaje(r));
      return z.label === 'Alto' || z.label === 'Extremo';
    }).length;
    const totalControlesCount = riesgosVigentes.reduce((acc, r) => {
      const lista = Array.isArray(r.controlesDetallados) ? r.controlesDetallados : [];
      return acc + (vigentes(lista).length || (lista.length === 0 && r.descripcionControl ? 1 : 0));
    }, 0);

    // 🧮 CALCULADORAS DINÁMICAS PARA LA BARRA DE KPIs
    const todosLosControles = riesgosVigentes.flatMap(r => vigentes(r.controlesDetallados));
    const eficaciaPromedioGlobal = todosLosControles.length > 0
      ? Math.round(todosLosControles.reduce((acc, c) => acc + calcularEficaciaControl(c), 0) / todosLosControles.length)
      : 80;

    const avgResidualScore = totalRiesgosCount > 0
  ? riesgosVigentes.reduce((acc, r) => acc + ((r.probabilidadResidual ?? 15) * (r.impactoResidual ?? 30) / 100), 0) / totalRiesgosCount
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
    const riesgosNormalizados = safeRiesgos.map(riesgo => normalizarUbicacionRiesgo(riesgo, MAPA_PROCESOS));
    const riesgosFiltrados = riesgosNormalizados.filter(r => {
      const matchSearch = (r.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.macroprocesos.join(' ').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.subprocesos.join(' ').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(r.id).includes(searchTerm);
      const matchProceso = filtroProceso === 'Todos' || r.macroprocesos.includes(filtroProceso);
      const subprocesosDelProceso = filtroProceso === 'Todos'
        ? r.subprocesos
        : r.subprocesosPorMacroproceso[filtroProceso] || [];
      const matchSubproceso = filtroSubproceso === 'Todos' || subprocesosDelProceso.includes(filtroSubproceso);
      const matchClasificacion = filtroClasificacion === 'Todas' || clasificacionDeRiesgo(r) === filtroClasificacion;
      // filtroNivel: 'Todos', 'inh:<nivel>' (inherente) o 'res:<nivel>' (residual).
      const [tipoNivel, etiquetaNivel] = filtroNivel.includes(':') ? filtroNivel.split(':') : ['res', filtroNivel];
      const zonaFiltro = tipoNivel === 'inh'
        ? getSeverityZone(r.probabilidadInherente, r.impactoInherente, riesgoEnPorcentaje(r))
        : getSeverityZone(r.probabilidadResidual, r.impactoResidual, riesgoEnPorcentaje(r));
      const matchNivel = filtroNivel === 'Todos' || zonaFiltro.label === etiquetaNivel;
      const matchEstado = filtroEstadoRiesgo === 'Todos' || (filtroEstadoRiesgo === 'Anulados' ? estaAnulado(r) : !estaAnulado(r));
      const matchCumplimiento = !filtroCumplimiento || incumpleCriterio(r, filtroCumplimiento, evaluaciones);
      return matchSearch && matchProceso && matchSubproceso && matchClasificacion && matchNivel && matchEstado && matchCumplimiento;
    });

    const procesosUnicos = [...new Set([...Object.keys(MAPA_PROCESOS), ...riesgosNormalizados.flatMap(r => r.macroprocesos)])]
      .sort((a, b) => a.localeCompare(b, 'es'));
    
    // ✨ Derivamos los subprocesos dinámicamente basados en el proceso seleccionado
    const subprocesosCatalogoMatriz = filtroProceso === 'Todos'
      ? Object.values(MAPA_PROCESOS).flat()
      : MAPA_PROCESOS[filtroProceso] || [];
    const subprocesosUnicos = [...new Set([
      ...subprocesosCatalogoMatriz,
      ...riesgosNormalizados.flatMap(r => (filtroProceso === 'Todos'
        ? r.subprocesos
        : r.subprocesosPorMacroproceso[filtroProceso] || [])),
    ])].sort((a, b) => a.localeCompare(b, 'es'));

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
              onChange={(e) => {
                setFiltroProceso(e.target.value);
                setFiltroSubproceso('Todos'); // ✨ Resetea el subproceso automáticamente si cambias de proceso
              }}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32] max-w-[160px] truncate"
            >
              <option value="Todos">Todos los procesos</option>
              {procesosUnicos.map(proc => <option key={proc} value={proc}>{proc}</option>)}
            </select>

            {/* ✨ NUEVO FILTRO DE SUBPROCESOS */}
            <select
              value={filtroSubproceso}
              onChange={(e) => setFiltroSubproceso(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-2 focus:ring-[#0A3B32] max-w-[180px] truncate"
            >
              <option value="Todos">Todos los subprocesos</option>
              {subprocesosUnicos.map(sp => <option key={sp} value={sp}>{sp}</option>)}
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
              aria-label="Filtrar por nivel de riesgo inherente o residual"
              className={`text-xs p-2 border rounded-xl font-bold focus:ring-2 focus:ring-[#0A3B32] ${filtroNivel === 'Todos' ? 'border-slate-200 bg-white text-slate-700' : 'border-[#0A3B32] bg-emerald-50 text-[#0A3B32]'}`}
            >
              <option value="Todos">Todos los niveles</option>
              <optgroup label="Nivel inherente (antes de controles)">
                {['Bajo', 'Moderado', 'Alto', 'Extremo'].map(nivel => <option key={`inh-${nivel}`} value={`inh:${nivel}`}>Inherente: {nivel}</option>)}
              </optgroup>
              <optgroup label="Nivel residual (después de controles)">
                {['Bajo', 'Moderado', 'Alto', 'Extremo'].map(nivel => <option key={`res-${nivel}`} value={`res:${nivel}`}>Residual: {nivel}</option>)}
              </optgroup>
            </select>

            <select
              value={filtroEstadoRiesgo}
              onChange={e => setFiltroEstadoRiesgo(e.target.value)}
              aria-label="Filtrar por estado del riesgo"
              className={`text-xs font-extrabold px-3 py-2 rounded-xl border ${filtroEstadoRiesgo === 'Activos' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-300'}`}
            >
              <option value="Activos">● Estado: Activos</option>
              <option value="Anulados">Estado: Anulados ({safeRiesgos.length - riesgosVigentes.length})</option>
              <option value="Todos">Estado: Todos</option>
            </select>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 📋 3. TABLA PRINCIPAL ENTERPRISE SAAS                                    */}
        {/* ========================================================================= */}
        <p role="status" aria-live="polite" className="mb-2 px-1 text-xs font-semibold text-slate-600">
          Mostrando <strong className="text-slate-900">{riesgosFiltrados.length}</strong> de {riesgosNormalizados.length} riesgos
          {filtroCumplimiento && (
            <> · <strong className="text-rose-700">{CRITERIOS_CUMPLIMIENTO[filtroCumplimiento].titulo}</strong>
              <button type="button" onClick={() => setFiltroCumplimiento(null)} className="ml-2 font-bold text-[#0A3B32] underline">Quitar</button>
            </>
          )}
          {filtroNivel !== 'Todos' && (
            <> · nivel {filtroNivel.startsWith('inh:') ? 'inherente' : 'residual'} <strong className="text-slate-900">{filtroNivel.split(':').pop()}</strong>
              <button type="button" onClick={() => setFiltroNivel('Todos')} className="ml-2 font-bold text-[#0A3B32] underline">Quitar</button>
            </>
          )}
        </p>
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

          {/* Listado de Filas: cada riesgo es un expediente separado; el filo izquierdo indica su nivel residual */}
          <div className="space-y-3 bg-slate-100/80 p-3 sm:p-4">
            {riesgosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold italic">No hay riesgos que coincidan con la búsqueda.</div>
            ) : (
              riesgosFiltrados.map((r, index) => {
                const isExpanded = expandedRiesgoId === r.id;
                const panelId = `expediente-riesgo-${encodeURIComponent(String(r.id))}`;
                const zoneInh = getSeverityZone(r.probabilidadInherente, r.impactoInherente, riesgoEnPorcentaje(r));
                const zoneRes = getSeverityZone(r.probabilidadResidual, r.impactoResidual, riesgoEnPorcentaje(r));
                const listaControles = Array.isArray(r.controlesDetallados) ? r.controlesDetallados : [];
                // Los controles anulados se muestran en el expediente, pero no cuentan en totales ni promedios.
                const controlesActivos = vigentes(listaControles);
                const controlesAnulados = listaControles.length - controlesActivos.length;
                const totalControles = controlesActivos.length || (listaControles.length === 0 && r.descripcionControl ? 1 : 0);

                return (
                  <div
                    key={r.id || index}
                    className={`${String(mitigacionAbierta) === String(r.id) ? 'relative z-20 overflow-visible' : 'overflow-hidden'} rounded-xl border border-l-[6px] bg-white transition-shadow duration-200 ${estaAnulado(r) ? 'opacity-70 grayscale' : ''} ${ACENTO_NIVEL_RESIDUAL[zoneRes.label] || 'border-l-slate-400'} ${
                      isExpanded
                        ? 'border-purple-300 shadow-lg ring-2 ring-purple-200/70'
                        : 'border-slate-300 shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:border-slate-400 hover:shadow-md'
                    }`}
                  >
                    
                    {/* FILA COMPACTA PRINCIPAL */}
                    <div 
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      onClick={() => toggleExpediente(r.id)}
                      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggleExpediente(r.id); } }}
                      className={`grid grid-cols-12 gap-3 px-6 py-4 items-center cursor-pointer hover:bg-slate-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                        isExpanded ? 'bg-purple-50/40' : ''
                      }`}
                    >
                      {/* ID / PROCESO */}
                      <div className="col-span-2 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-black text-xs text-slate-900">RSK-{r.id}</span> {/* 🔥 QUITAMOS EL RECORTE */}
                          <span className="text-slate-400 text-xs">🏢</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5 line-clamp-1">
                          {r.macroprocesos.join(', ') || 'Gestión Operativa'}
                        </p>
                        {estaAnulado(r) ? (
                          <span className="inline-block mt-1 text-[8px] font-black uppercase text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300" title={r.anulacion ? `${r.anulacion.tipoMotivo}: ${r.anulacion.motivo} — ${r.anulacion.usuario}, ${fechaEntradaHistorial(r.anulacion)}` : 'Anulado'}>
                            Anulado
                          </span>
                        ) : (
                          <span className="inline-block mt-1 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Activo
                          </span>
                        )}
                      </div>

                      {/* RIESGO (DESCRIPCIÓN) */}
                      <div className="col-span-3 pr-2">
                        <span className="inline-block text-[8px] font-black uppercase px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded mb-1">
                          {r.subprocesos.length > 0 && r.subprocesos.some(subprocesoActual => subprocesoActual !== 'General') ? r.subprocesos.join(', ') : (r.categoria || 'Operativo')}
                        </span>
                        {/* 👇 Se eliminó line-clamp-2 de la línea de abajo 👇 */}
                        <p className="text-xs font-medium text-slate-800 leading-snug">
                          {r.descripcion}
                        </p>
                        <span className="text-[9px] font-bold text-indigo-600 hover:underline mt-0.5 block">Ver más →</span>
                      </div>

                      {/* CLASIFICACIÓN */}
                      <div className="col-span-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mb-1 ${zoneInh.color}`}>
                          {zoneInh.label}
                        </span>
                        <p className="text-[10px] text-slate-500 font-bold">{clasificacionDeRiesgo(r)}</p>
                      </div>

                      {/* INHERENTE VS RESIDUAL (TARJETAS LADO A LADO) */}
<div className="col-span-2 flex items-center justify-center space-x-2 text-center">
  <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 min-w-[65px]">
    <span className="text-[8px] font-black text-red-600 block uppercase">{zoneInh.label}</span>
    <span className="text-[8px] font-mono text-slate-600 font-bold">P: {r.probabilidadInherente ?? 60}%</span>
    <span className="text-[8px] font-mono text-slate-600 font-bold block">I: {r.impactoInherente ?? 80}%</span>
  </div>
  <span className="text-slate-300 font-bold text-xs">→</span>
  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 min-w-[65px]">
    <span className="text-[8px] font-black text-emerald-700 block uppercase">{zoneRes.label}</span>
    <span className="text-[8px] font-mono text-slate-600 font-bold">P: {r.probabilidadResidual ?? 15}%</span>
    <span className="text-[8px] font-mono text-slate-600 font-bold block">I: {r.impactoResidual ?? 30}%</span>
  </div>
</div>

                      {/* CONTROLES (DONUT CHART INTEGRADO) */}
                      <div className="col-span-1 flex items-center justify-center space-x-2">
                        <div className="text-center">
                          <span className="text-xs font-black text-slate-900 block">{totalControles}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase">Controles</span>
                        </div>
{(() => {
  const abierta = String(mitigacionAbierta) === String(r.id);
  const datosMitigacion = leerMitigacionRiesgo(r);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setMitigacionAbierta(null); }}>
      <button type="button" onClick={() => setMitigacionAbierta(abierta ? null : r.id)} aria-expanded={abierta}
        aria-label={`Mitigación ${datosMitigacion.mitigacion}%: ver qué significa`} title="Ver qué significa este porcentaje"
        className="block cursor-pointer rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <EficaciaGauge porcentaje={datosMitigacion.mitigacion} />
      </button>
      {abierta && (
        <div role="dialog" aria-label={`Mitigación de RSK-${r.id}`} className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] leading-snug text-slate-700 shadow-xl">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-black text-slate-900">Mitigación: {datosMitigacion.mitigacion}%</span>
            <button type="button" onClick={() => setMitigacionAbierta(null)} aria-label="Cerrar" className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
          </div>
          <p><span className="text-slate-500">Exposición sin controles:</span> <strong>{datosMitigacion.inherente}</strong></p>
          <p><span className="text-slate-500">Exposición con controles:</span> <strong>{datosMitigacion.residual}</strong></p>
          <p className="mt-1.5 border-t border-slate-100 pt-1.5">{datosMitigacion.lectura}</p>
        </div>
      )}
    </div>
  );
})()}
                      </div>

                      {/* ANÁLISIS IA */}
                      <div className="col-span-1 min-w-0 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); solicitarAnalisisFilaIA(r); }}
                          className="bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-200 font-bold px-2 py-1 rounded-lg text-[9px] transition-colors flex max-w-full items-center justify-center gap-1 mx-auto shadow-sm whitespace-nowrap"
                        >
                          ✨ Dictamen IA
                        </button>
<span className="text-[8px] text-slate-400 font-bold mt-1 block">Mitigación: <strong className="text-purple-700">{calcularMitigacionRiesgo(r)}%</strong></span>
                      </div>

                     {/* GESTIÓN: Todos pueden editar ✏️, pero solo Administradores pueden borrar 🗑️ */}
<div className="col-span-1 flex min-w-0 justify-end" onClick={(e) => e.stopPropagation()}>
  {/* Acciones de la fila: botones de 32 px, neutros en reposo y con el color de su acción al pasar el mouse. */}
  {/* 2 × 2 desde 1360 px de pantalla; por debajo, una sola columna para no invadir "Análisis IA". */}
  <div className="grid w-8 shrink-0 grid-cols-1 gap-1 min-[1360px]:w-[4.25rem] min-[1360px]:grid-cols-2">
    <button type="button" onClick={() => setHistorialAbierto(r.id)} aria-label={`Historial de cambios de RSK-${r.id}`} title="Historial de cambios"
      className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <History size={16} strokeWidth={2} aria-hidden="true" />
      {Array.isArray(r.historialCambios) && r.historialCambios.filter(Boolean).length > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-indigo-600 px-1 text-center text-[9px] font-bold leading-4 text-white ring-2 ring-white">{r.historialCambios.filter(Boolean).length}</span>
      )}
    </button>
    {puedeModificarRiesgo(r) && !estaAnulado(r) && (
      <button type="button" onClick={() => handleEditRiesgo(r)} aria-label={`Editar RSK-${r.id}`} title="Editar riesgo y controles"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
        <Pencil size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    )}
    {puedeModificarRiesgo(r) && (estaAnulado(r) ? (
      <button type="button" onClick={() => abrirAnulacion(r, 'reactivar')} aria-label={`Reactivar RSK-${r.id}`} title="Reactivar el riesgo (queda en el historial)"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    ) : (
      <button type="button" onClick={() => abrirAnulacion(r, 'anular')} aria-label={`Anular RSK-${r.id}`} title="Anular el riesgo si ya no aplica o se reemplaza (queda en el historial)"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
        <Ban size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    ))}
    {isAdmin && puedeModificarRiesgo(r) && (
      <button type="button" onClick={() => handleDeleteRiesgo(r.id)} aria-label={`Eliminar RSK-${r.id}`} title="Eliminar (solo administradores)"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
        <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    )}
  </div>
</div>
</div>

{/* ========================================================================= */}
{/* 🚀 EXPEDIENTE SECUNDARIO DE CONTROLES (ACCORDEÓN ANIMADO 250ms)           */}
{/* ========================================================================= */}
{isExpanded && (
  <div id={panelId} className="bg-slate-50/80 border-t border-purple-200 px-8 py-6 transition-all duration-250 ease-in-out animate-in slide-in-from-top-2 space-y-4">
    
    {/* 📊 1. RESUMEN VISUAL SUPERIOR (KPI BAR DEL RIESGO EXPANDIDO) */}
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b pb-2">
        <h4 className="font-black text-[11px] uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <span>🛡️ CONTROLES DEL RIESGO</span>
          <span className="text-[10px] text-purple-600 font-bold">({totalControles} vigentes{controlesAnulados > 0 ? ` · ${controlesAnulados} anulado${controlesAnulados === 1 ? '' : 's'}` : ''})</span>
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
            {controlesActivos.filter(c => c.tipo === 'Preventivo').length || 1}
          </p>
        </div>
        <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
          <p className="text-[8px] font-black text-amber-600 uppercase">Detectivos</p>
          <p className="text-base font-black text-amber-800">
            {controlesActivos.filter(c => c.tipo === 'Detectivo').length}
          </p>
        </div>
        <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
          <p className="text-[8px] font-black text-purple-600 uppercase">Correctivos</p>
          <p className="text-base font-black text-purple-800">
            {controlesActivos.filter(c => c.tipo === 'Correctivo').length}
          </p>
        </div>
        <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
          <p className="text-[8px] font-black text-emerald-600 uppercase">Automatizados</p>
          <p className="text-base font-black text-emerald-800">
            {controlesActivos.filter(c => c.implementacion === 'Automático').length}
          </p>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
          <p className="text-[8px] font-black text-slate-500 uppercase">Manuales</p>
          <p className="text-base font-black text-slate-700">
            {controlesActivos.filter(c => c.implementacion === 'Manual').length || totalControles}
          </p>
        </div>
        <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
          <p className="text-[8px] font-black text-indigo-600 uppercase">Eficacia Prom.</p>
<p className="text-base font-black text-indigo-800">
  {controlesActivos.length > 0 
    ? `${Math.round(controlesActivos.reduce((acc, c) => acc + calcularEficaciaControl(c), 0) / controlesActivos.length)}%` 
    : '—'}
</p>
        </div>
      </div>
    </div>

    {/* 📋 2. CONTROLES COMO EXPEDIENTES INDIVIDUALES: el filo izquierdo indica el tipo de control */}
    <ul className="space-y-2.5" aria-label={`Controles del riesgo RSK-${r.id}`}>
      {listaControles.length > 0 ? (
        listaControles.map((c, cIdx) => {
          // Control anulado: se conserva visible con su motivo, pero no cuenta en el residual ni en los promedios.
          if (estaAnulado(c)) {
            return (
              <li key={cIdx} className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-black text-slate-500 line-through">{codigoControl(cIdx, r.id)}</span>
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">Anulado</span>
                    <p className="text-[12px] text-slate-500 line-through">{c.descripcion}</p>
                  </div>
                  {c.anulacion && (
                    <p className="mt-1 text-[11px]">
                      <strong>{c.anulacion.tipoMotivo}:</strong> {c.anulacion.motivo} <span className="text-slate-400">— {c.anulacion.usuario}, {fechaEntradaHistorial(c.anulacion)}. No cuenta en el residual.</span>
                    </p>
                  )}
                </div>
                {puedeModificarRiesgo(r) && !estaAnulado(r) && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); abrirAnulacion(r, 'reactivar', cIdx); }}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50">
                    ↩️ Reactivar
                  </button>
                )}
              </li>
            );
          }
          const tipoControl = c.tipo || 'Preventivo';
          const estiloTipo = ESTILO_TIPO_CONTROL[tipoControl] || ESTILO_TIPO_CONTROL.Correctivo;
          // Color por % del máximo de su tipo: verde ≥ 80 %, ámbar 60–79 %, rojo < 60 %.
          const valoracionControl = explicarControl(c);
          const tonoEficacia = {
            verde: { texto: 'text-emerald-700', barra: 'bg-emerald-500', caja: 'border-emerald-200 bg-emerald-50/60 text-emerald-900' },
            ambar: { texto: 'text-amber-700', barra: 'bg-amber-400', caja: 'border-amber-200 bg-amber-50/60 text-amber-900' },
            rojo: { texto: 'text-red-700', barra: 'bg-red-500', caja: 'border-red-200 bg-red-50/60 text-red-900' },
          }[tonoDiseno(valoracionControl.porcentajeDelMaximo)];
          const documentado = c.documentacion === 'Documentado';
          const automatizado = c.implementacion === 'Automático';
          return (
            <li
              key={cIdx}
              className={`grid grid-cols-1 gap-4 rounded-xl border border-l-[5px] border-slate-300 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.07)] transition-shadow hover:border-slate-400 hover:shadow-md lg:grid-cols-[minmax(0,1fr)_9rem_auto] lg:items-center ${estiloTipo.filo}`}
            >
              {/* Identificación y ficha del control */}
              <div className="min-w-0 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-emerald-900/20 bg-emerald-50 px-2 py-1 font-mono text-[11px] font-black text-[#0A3B32]">
                    {codigoControl(cIdx, r.id)}
                  </span>
                  <p className="pt-0.5 text-[13px] font-semibold leading-snug text-slate-800">{c.descripcion}</p>
                </div>
                <dl className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <dt className="text-slate-500">Tipo</dt>
                    <dd className={`whitespace-nowrap rounded-md px-2 py-0.5 font-bold ${estiloTipo.etiqueta}`}>{tipoControl}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-slate-500">Frecuencia</dt>
                    <dd className="whitespace-nowrap font-semibold text-slate-800">{c.frecuencia || 'Mensual'}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-slate-500">Responsable</dt>
                    <dd className="font-semibold text-slate-800">{r.responsable || 'Coordinador del Proceso'}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-slate-500">Documentado</dt>
                    <dd className={`whitespace-nowrap rounded-md px-2 py-0.5 font-bold ${documentado ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{documentado ? 'Sí' : 'No'}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-slate-500">Automatizado</dt>
                    <dd className={`whitespace-nowrap rounded-md px-2 py-0.5 font-bold ${automatizado ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{automatizado ? 'Sí' : 'No'}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="text-slate-500">Estado</dt>
                    <dd className="flex items-center gap-1 whitespace-nowrap font-bold text-emerald-700">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Activo
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Eficacia: lo que el control reduce (valor del manual) y qué tan cerca está del máximo de su tipo */}
              {(() => {
                const { porcentajeDelMaximo } = valoracionControl;
                const queReduce = tipoControl === 'Correctivo' ? 'el impacto' : 'la probabilidad';
                return (
                  <div className="lg:border-l lg:border-slate-200 lg:pl-4" title={`Diseño: ${porcentajeDelMaximo}% del máximo posible para su tipo. Este control reduce ${queReduce} en ${valoracionControl.eficacia}%. Tiene ${valoracionControl.eficacia} de ${valoracionControl.maximoPosible} puntos posibles para un control ${tipoControl.toLowerCase()} (Tabla 6 del manual).`}>
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Diseño</p>
                      <span className={`whitespace-nowrap text-xl font-black tabular-nums leading-none ${tonoEficacia.texto}`}>{porcentajeDelMaximo}%</span>
                    </div>
                    {/* Escala 0–100 %: 100 % = máximo de puntos para su tipo */}
                    <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200" aria-hidden="true">
                      <div className={`h-full ${tonoEficacia.barra}`} style={{ width: `${porcentajeDelMaximo}%` }}></div>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[8px] font-semibold text-slate-400" aria-hidden="true">
                      <span>0%</span><span>100%</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-slate-700">
                      <strong>{valoracionControl.eficacia} de {valoracionControl.maximoPosible}</strong> puntos = <strong className={tonoEficacia.texto}>{porcentajeDelMaximo}%</strong>
                    </p>
                    <p className="text-[9px] leading-snug text-slate-500">Reduce {valoracionControl.eficacia}% {queReduce}</p>
                    {valoracionControl.faltantes.length > 0 && (
                      <p className="mt-1 text-[9px] font-bold leading-snug text-red-700">⚠️ {valoracionControl.faltantes.join(' · ')}</p>
                    )}
                  </div>
                );
              })()}

              {/* Acciones */}
              <div className="flex flex-wrap gap-1.5 lg:flex-col lg:items-stretch">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setControlSeleccionadoIA(c); }}
                  className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                  title="Ver cómo se calculó la eficacia del control">
                  📊 Ver evaluación
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); verDetalleRiesgo(r); }}
                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  title="Abrir el formulario completo del riesgo en modo consulta, sin poder editar">
                  👁 Ver detalle completo
                </button>
                {puedeModificarRiesgo(r) && <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if(showNotification) showNotification("Abriendo el formulario del riesgo para editar sus controles.", "success");
                    handleEditRiesgo(r);
                  }}
                  className="whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                  title="Editar Control">
                  ✏️ Editar
                </button>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    solicitarAnalisisControlIA(c, r);
                  }}
                  className="whitespace-nowrap rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-bold text-purple-800 hover:bg-purple-100"
                  title="Auditar diseño del control con IA">
                  🤖 IA
                </button>
                {puedeModificarRiesgo(r) && !estaAnulado(r) && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); abrirAnulacion(r, 'anular', cIdx); }}
                    className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                    title="Anular este control si ya no aplica o se reemplaza (queda en el historial)">
                    🚫 Anular
                  </button>
                )}
              </div>

              {/* 💬 Qué significa la eficacia de este control, según la Tabla 6 del manual y sus atributos */}
              {(() => {
                const explicacion = explicarControl(c);
                const tono = tonoEficacia.caja;
                return (
                  <div className={`rounded-lg border p-3 text-[11px] leading-relaxed lg:col-span-3 ${tono}`}>
                    <p><strong>💬 {explicacion.resumen}</strong> {explicacion.calculo}</p>
                    {explicacion.formalizacion && <p className="mt-1 font-semibold">⚠️ {explicacion.formalizacion}</p>}
                    {explicacion.mejoras.length > 0 && (
                      <div className="mt-1.5">
                        <p className="font-bold">Para mejorarlo:</p>
                        <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                          {explicacion.mejoras.map(mejora => <li key={mejora.texto}>{mejora.efecto ? `${mejora.texto}: ${mejora.efecto}.` : mejora.texto}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}
            </li>
          );
        })
      ) : (
        <li className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400 font-medium italic">
          ⚠️ Este riesgo no cuenta con controles estructurados individualmente.
          <span className="block text-[10px] text-slate-500 mt-1 font-normal">
            Control registrado en texto: "{r.descripcionControl || 'Sin descripción de control'}"
          </span>
        </li>
      )}
    </ul>
{(() => {
      const exp = obtenerExplicacionCalculo(r);
      const lectura = explicarCalculoResidual(exp, r);
      return (
        <div className="bg-[#0A3B32] text-white p-5 rounded-2xl border border-emerald-900 shadow-md space-y-4 mt-4">
          <div className="flex justify-between items-center border-b border-emerald-800/80 pb-3">
            <h5 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-emerald-300">
              <span>🧮 AUDITORÍA METODOLÓGICA Y DESGLOSE DEL CÁLCULO RESIDUAL</span>
            </h5>
            <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-mono font-bold px-2.5 py-1 rounded-full">
              ISO 31000 — Termales de Santa Rosa de Cabal.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            
            {/* EXPLICACIÓN PROBABILIDAD */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-emerald-800/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400 text-[11px] uppercase">
                  📊 Probabilidad Residual Final: <strong className="text-white text-sm font-mono">{exp.probFinal}%</strong>
                </span>
                <span className="text-[9px] text-slate-400 font-mono">Inherente: {exp.probInh}%</span>
              </div>

              {exp.pasosP.length > 0 ? (
                <div className="space-y-1.5 font-mono text-[11px] text-slate-300 bg-black/30 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-sans italic mb-1">Efecto cascada de mitigación preventiva:</p>
                  <p>• Probabilidad Inicial: <strong className="text-white">{exp.probInh}%</strong></p>
                  {exp.pasosP.map((p, pIdx) => (
                    <p key={pIdx} className="text-emerald-300">
                      • Tras {p.etiqueta} ({p.eficacia}% efic.): queda <strong className="text-white">{p.despues}%</strong>
                    </p>
                  ))}
                  <p className="border-t border-slate-700 pt-1 mt-1 text-emerald-400 font-bold">
                    = Resultado Redondeado: {exp.probFinal}%
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-amber-300/80 italic bg-amber-950/30 p-2.5 rounded-lg border border-amber-800/40">
                  ⚠️ No hay controles preventivos aplicados. La probabilidad se mantiene en {exp.probInh}%.
                </p>
              )}

              <div className="bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg text-[10px] text-emerald-200/90 leading-relaxed font-sans">
                <p className="font-bold text-emerald-300">💡 Lectura de este riesgo</p>
                {lectura.probabilidad.map(frase => <p key={frase} className="mt-1">{frase}</p>)}
              </div>
            </div>

            {/* EXPLICACIÓN IMPACTO */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-emerald-800/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400 text-[11px] uppercase">
                  🛡️ Impacto Residual Final: <strong className="text-white text-sm font-mono">{exp.impFinal}%</strong>
                </span>
                <span className="text-[9px] text-slate-400 font-mono">Inherente: {exp.impInh}%</span>
              </div>

              {exp.pasosI.length > 0 ? (
                <div className="space-y-1.5 font-mono text-[11px] text-slate-300 bg-black/30 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-400 font-sans italic mb-1">Amortiguación por controles correctivos:</p>
                  <p>• Impacto Inicial: <strong className="text-white">{exp.impInh}%</strong></p>
                  {exp.pasosI.map((p, pIdx) => (
                    <p key={pIdx} className="text-emerald-300">
                      • Tras {p.etiqueta} ({p.eficacia}% efic.): queda <strong className="text-white">{p.despues}%</strong>
                    </p>
                  ))}
                  <p className="border-t border-slate-700 pt-1 mt-1 text-emerald-400 font-bold">
                    = Resultado Redondeado: {exp.impFinal}%
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic bg-black/20 p-2.5 rounded-lg border border-slate-800">
                  ℹ️ Los controles preventivos no reducen impacto. Sin controles correctivos registrados, el impacto se mantiene en {exp.impInh}%.
                </p>
              )}

              <div className="bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg text-[10px] text-emerald-200/90 leading-relaxed font-sans">
                <p className="font-bold text-emerald-300">💡 Lectura de este riesgo</p>
                {lectura.impacto.map(frase => <p key={frase} className="mt-1">{frase}</p>)}
              </div>
            </div>

          </div>

          <div className="rounded-xl border border-emerald-700/60 bg-emerald-900/40 p-3 text-[11px] leading-relaxed text-emerald-100">
            <p><strong className="text-emerald-300">📌 En resumen:</strong> {lectura.conclusion}</p>
            {lectura.aviso && <p className="mt-1 text-amber-200">⚠️ {lectura.aviso}</p>}
          </div>

          {/* 📖 Explicación completa de este riesgo (la misma del formulario) */}
          <ExplicacionRiesgoDetallada riesgo={r} evaluaciones={evaluaciones} />
        </div>
      );
    })()}

    {/* 🕑 HISTORIAL DE CAMBIOS DEL RIESGO Y SUS CONTROLES (más reciente primero) */}
    <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-700">
        🕑 Historial de cambios <span className="text-purple-600">({(Array.isArray(r.historialCambios) ? r.historialCambios.filter(Boolean) : []).length})</span>
      </summary>
      {renderHistorialRiesgo(r)}
    </details>
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

      {/* 🕑 MODAL DEL HISTORIAL DE CAMBIOS DE UN RIESGO */}
      {historialAbierto !== null && (() => {
        const riesgoHistorial = safeRiesgos.find(item => String(item.id) === String(historialAbierto));
        return (
          <div className="fixed inset-0 z-[270] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-historial"
            onClick={() => setHistorialAbierto(null)} onKeyDown={(e) => { if (e.key === 'Escape') setHistorialAbierto(null); }}>
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 bg-indigo-700 p-5 text-white">
                <div className="min-w-0">
                  <h3 id="titulo-historial" className="text-sm font-black uppercase tracking-wider">🕑 Historial de cambios · RSK-{historialAbierto}</h3>
                  {riesgoHistorial?.descripcion && <p className="mt-1 line-clamp-2 text-[11px] text-white/80">{riesgoHistorial.descripcion}</p>}
                </div>
                <button type="button" onClick={() => setHistorialAbierto(null)} aria-label="Cerrar" autoFocus className="rounded-full bg-white/10 px-2 py-0.5 text-white/80 hover:bg-white/20 hover:text-white">✕</button>
              </div>
              <div className="overflow-y-auto p-5">{renderHistorialRiesgo(riesgoHistorial)}</div>
            </div>
          </div>
        );
      })()}

      {/* 📥 MODAL DE DESCARGA EXCEL: toda la matriz o un macroproceso y sus subprocesos */}
      {descargaExcel && (() => {
        const todosSubprocesos = descargaExcel.macroproceso ? subprocesosDeMacroproceso(descargaExcel.macroproceso) : [];
        const cantidad = riesgosDeDescarga(descargaExcel).length;
        const sinSubprocesos = descargaExcel.tipo === 'proceso' && descargaExcel.subprocesos.length === 0;
        const alternarSubproceso = subproceso => setDescargaExcel(actual => ({
          ...actual,
          subprocesos: actual.subprocesos.includes(subproceso) ? actual.subprocesos.filter(item => item !== subproceso) : [...actual.subprocesos, subproceso],
        }));
        return (
          <div className="fixed inset-0 z-[270] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-descarga-excel">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="bg-emerald-600 p-5 text-white">
                <h3 id="titulo-descarga-excel" className="text-sm font-black uppercase tracking-wider">📥 Descargar matriz en Excel</h3>
                <p className="mt-1 text-[11px] text-white/85">Elige qué riesgos incluir. Los riesgos anulados no se exportan.</p>
              </div>
              <div className="space-y-3 overflow-y-auto p-6 text-xs text-slate-700">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${descargaExcel.tipo === 'global' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="alcance-excel" checked={descargaExcel.tipo === 'global'} onChange={() => setDescargaExcel(actual => ({ ...actual, tipo: 'global' }))} className="mt-0.5" />
                  <span><strong className="block text-slate-900">Toda la matriz</strong>{riesgosVigentes.length} riesgos de todos los procesos, con los datos globales.</span>
                </label>
                {macroprocesosDescarga.length > 0 && (
                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${descargaExcel.tipo === 'proceso' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="radio" name="alcance-excel" checked={descargaExcel.tipo === 'proceso'} onChange={() => setDescargaExcel(actual => ({ ...actual, tipo: 'proceso' }))} className="mt-0.5" />
                    <span><strong className="block text-slate-900">{isAdmin ? 'Por macroproceso' : macroprocesosDescarga.length === 1 ? 'Mi macroproceso' : 'Mis macroprocesos'}</strong>Solo los riesgos de un macroproceso y los subprocesos que elijas.</span>
                  </label>
                )}
                {descargaExcel.tipo === 'proceso' && (
                  <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Macroproceso</span>
                      <select value={descargaExcel.macroproceso} onChange={e => setDescargaExcel(actual => ({ ...actual, macroproceso: e.target.value, subprocesos: subprocesosIniciales(e.target.value) }))}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs">
                        {macroprocesosDescarga.map(macroproceso => <option key={macroproceso} value={macroproceso}>{macroproceso}</option>)}
                      </select>
                    </label>
                    <fieldset>
                      <div className="mb-1 flex items-center justify-between">
                        <legend className="text-[10px] font-black uppercase text-slate-500">Subprocesos</legend>
                        <button type="button" onClick={() => setDescargaExcel(actual => ({ ...actual, subprocesos: actual.subprocesos.length === todosSubprocesos.length ? [] : todosSubprocesos }))}
                          className="text-[10px] font-bold text-emerald-700 hover:underline">
                          {descargaExcel.subprocesos.length === todosSubprocesos.length ? 'Quitar todos' : 'Seleccionar todos'}
                        </button>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {todosSubprocesos.map(subproceso => (
                          <label key={subproceso} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                            <input type="checkbox" checked={descargaExcel.subprocesos.includes(subproceso)} onChange={() => alternarSubproceso(subproceso)} />
                            <span>{subproceso}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}
                <p className="rounded-lg bg-slate-50 p-2 text-[11px] font-semibold text-slate-600">
                  {sinSubprocesos ? 'Selecciona al menos un subproceso.' : `Se descargarán ${cantidad} ${cantidad === 1 ? 'riesgo' : 'riesgos'}.`}
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <button type="button" onClick={() => setDescargaExcel(null)} disabled={generandoExcel} className="rounded-xl bg-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300">Cancelar</button>
                <button type="button" onClick={confirmarDescargaExcel} disabled={generandoExcel || sinSubprocesos || cantidad === 0}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {generandoExcel ? 'Generando…' : 'Descargar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🚫 MODAL DE ANULACIÓN / REACTIVACIÓN (motivo obligatorio, queda en el historial) */}
      {solicitudAnulacion && (() => {
        const riesgoSolicitud = safeRiesgos.find(item => String(item.id) === String(solicitudAnulacion.id));
        const esControl = solicitudAnulacion.indiceControl !== null;
        const esAnular = solicitudAnulacion.accion === 'anular';
        const objeto = esControl ? `el control ${codigoControl(solicitudAnulacion.indiceControl, solicitudAnulacion.id ?? customId)} del riesgo RSK-${solicitudAnulacion.id}` : `el riesgo RSK-${solicitudAnulacion.id}`;
        const errorMotivo = validarMotivo(formAnulacion, { exigirTipo: esAnular });
        const descripcionControl = !esControl ? ''
          : solicitudAnulacion.enFormulario ? controles[solicitudAnulacion.indiceControl]?.descripcion
            : riesgoSolicitud?.controlesDetallados?.[solicitudAnulacion.indiceControl]?.descripcion;
        return (
          <div className="fixed inset-0 z-[270] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-anulacion">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className={`p-5 text-white ${esAnular ? 'bg-slate-800' : 'bg-[#0A3B32]'}`}>
                <h3 id="titulo-anulacion" className="text-sm font-black uppercase tracking-wider">{esAnular ? '🚫 Anular' : '↩️ Reactivar'} {esControl ? 'control' : 'riesgo'}</h3>
                <p className="mt-1 text-[11px] text-white/80">{esAnular ? 'Vas a anular' : 'Vas a reactivar'} {objeto}. No se borra nada: queda registrado en el historial con tu usuario y la fecha{solicitudAnulacion.enFormulario ? ' cuando actualices la matriz' : ''}.</p>
              </div>
              <div className="space-y-4 p-6 text-xs text-slate-700">
                {descripcionControl && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] italic">{descripcionControl}</p>
                )}
                <p className="text-[11px] text-slate-600">
                  {esAnular
                    ? (esControl ? 'El control dejará de reducir el riesgo: el residual se recalcula sin él.' : 'El riesgo deja de contar en la matriz, los indicadores, el Excel y el análisis de IA. Se puede consultar con el filtro "Estado: Anulados".')
                    : (esControl ? 'El control vuelve a reducir el riesgo y el residual se recalcula con él.' : 'El riesgo vuelve a contar en la matriz y en los indicadores.')}
                </p>
                {esAnular && (
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Motivo</span>
                    <select value={formAnulacion.tipoMotivo} onChange={e => setFormAnulacion(actual => ({ ...actual, tipoMotivo: e.target.value }))} className="w-full rounded-lg border border-slate-300 p-2 text-xs">
                      <option value="">Selecciona…</option>
                      {MOTIVOS_ANULACION.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{esAnular ? 'Explica por qué' : 'Motivo de la reactivación'}</span>
                  <textarea value={formAnulacion.motivo} onChange={e => setFormAnulacion(actual => ({ ...actual, motivo: e.target.value }))} rows="3"
                    placeholder={esAnular ? (esControl ? 'Ej: se reemplaza por el nuevo control de conciliación automática en Zeus.' : 'Ej: el proceso dejó de existir tras la reestructuración de 2026.') : 'Ej: el control se volvió a aplicar desde octubre.'}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-[#0A3B32]"></textarea>
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <button type="button" onClick={() => setSolicitudAnulacion(null)} disabled={guardandoAnulacion} className="rounded-xl bg-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300">Cancelar</button>
                <button type="button" onClick={confirmarAnulacion} disabled={guardandoAnulacion || Boolean(errorMotivo)} title={errorMotivo || undefined}
                  className={`rounded-xl px-5 py-2 text-xs font-bold text-white disabled:opacity-50 ${esAnular ? 'bg-slate-800 hover:bg-slate-900' : 'bg-[#0A3B32] hover:bg-[#062620]'}`}>
                  {guardandoAnulacion ? 'Guardando…' : esAnular ? 'Anular' : 'Reactivar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                  <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Tipo + implementación (Tabla 6 del manual)</p>
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
                      {(() => {
                        const desglose = desglosarEficaciaControl(controlSeleccionadoIA);
                        return [
                          ...desglose.factores.map((factor, indice) => (
                            <tr key={factor.atributo}>
                              <td className="p-2.5 font-bold text-slate-800">{indice + 1}. {factor.atributo}</td>
                              <td className="p-2.5 text-slate-600">{factor.valor}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-emerald-700">+{factor.puntos}%</td>
                            </tr>
                          )),
                          ...desglose.informativos.map((atributo, indice) => (
                            <tr key={atributo.atributo}>
                              <td className="p-2.5 font-bold text-slate-800">{indice + 3}. {atributo.atributo}</td>
                              <td className={`p-2.5 ${atributo.cumple ? 'text-slate-600' : 'font-bold text-red-700'}`}>{atributo.valor}</td>
                              <td className="p-2.5 text-right text-[10px] text-slate-500">Informativo (sin peso)</td>
                            </tr>
                          )),
                        ];
                      })()}
                    </tbody>                    
                  </table>
                </div>
              </div>

              {/* Nota metodológica */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[10px] text-slate-600 leading-relaxed">
                <p className="font-bold text-slate-800 mb-1">📖 Regla del Manual de Riesgos (Termales de Santa Rosa de Cabal.):</p>
                Solo los atributos de eficiencia tienen peso: tipo (Preventivo 25%, Detectivo 15%, Correctivo 10%) e implementación (Automático 25%, Manual 15%). Documentación, frecuencia y evidencia son atributos informativos: no suman porcentaje, pero muestran si el control está formalizado y se puede verificar. Ejemplo del manual (Tabla 7): un control preventivo manual vale 40%.
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

      {/* 💡 EXPLICACIÓN DE UN DATO DEL DASHBOARD (calculada con los riesgos del filtro) */}
      {explicacionDashboard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setExplicacionDashboard(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-explicacion-dashboard" onClick={evento => evento.stopPropagation()} className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 border-b pb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">✓</span>
              <h4 id="titulo-explicacion-dashboard" className="text-xs font-black uppercase tracking-wider text-slate-800">{explicacionDashboard.titulo}</h4>
              {explicacionDashboard.valor && <span className="ml-auto rounded-lg bg-slate-900 px-2.5 py-1 text-sm font-black tabular-nums text-white">{explicacionDashboard.valor}</span>}
            </div>
            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-700">
              {explicacionDashboard.lineas.map(linea => <li key={linea} className="rounded-xl border border-slate-200/60 bg-slate-50 p-3">{linea}</li>)}
            </ul>
            {explicacionDashboard.accion && (
              <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs font-semibold leading-relaxed text-emerald-950"><span className="font-black">📌 Qué hacer: </span>{explicacionDashboard.accion}</p>
            )}
            <div className="mt-5 flex justify-end">
              <button type="button" autoFocus onClick={() => setExplicacionDashboard(null)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-md hover:bg-slate-800">Entendido</button>
            </div>
          </div>
        </div>
      )}
      {/* 🔮 EL POPUP MODAL SUTIL Y ELEGANTE CON BASE EN LA MAQUETA DE FORMATO */}
      {ayudaModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div role="dialog" aria-modal="true" aria-label={`Ayuda: ${ayudaModal.titulo}`} className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60"></div>
            
            <div className="flex items-center space-x-2 border-b pb-3 relative z-10">
              <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-[10px]">✓</span>
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">{ayudaModal.titulo}</h4>
            </div>

            <div className="mt-4 space-y-4 relative z-10 text-xs">
              {ayudaModal.que && (
                <div>
                  <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">📌 ¿Qué es?</h5>
                  <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">{ayudaModal.que}</p>
                </div>
              )}
              <div>
                <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-1">💡 ¿Por qué diligenciarlo?</h5>
                <p className="text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/60">{ayudaModal.porQue}</p>
              </div>
<div>
                <h5 className="font-black text-[10px] text-emerald-600 uppercase tracking-widest mb-1">📝 Ejemplo técnico</h5>
                <div className="text-emerald-950 font-semibold leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  {typeof ayudaModal.ejemplo === 'function' ? ayudaModal.ejemplo() : ayudaModal.ejemplo}
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
      {/* 👇 🤖 MODAL DE CARGA (SPINNER MIENTRAS LA IA PIENSA) 👇 */}
      {procesandoIA && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center justify-center space-y-5">
            <ThinkingOrb state="solving" size={64} theme="dark" aria-label="Motor GRC analizando datos..." />
            <p className="font-black animate-pulse text-xs text-emerald-400 uppercase tracking-widest text-center">
              Motor GRC Enterprise analizando datos...
            </p>
          </div>
        </div>
      )}

      {/* 👇 🤖 NUEVO PANEL EJECUTIVO INTELIGENTE (ENTERPRISE) 👇 */}
      <ModalIA 
        aiModal={dictamenIA ? { titulo: dictamenIA.titulo, contenido: dictamenIA.dictamen } : null} 
        setAiModal={setDictamenIA} 
      />
{/* 📋 CABECERA PRINCIPAL CON BANNER DE IMAGEN ESTILO PREMIUM */}
      <div 
        className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-6 mb-6 z-20"
      >
        {/* IMAGEN DE FONDO CON OVERLAY */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url('/matriz_riesgos.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070f1e] via-[#070f1e]/90 to-transparent z-10" />

        {/* CONTENIDO IZQUIERDA */}
        <div className="relative z-20 w-full md:w-3/5 flex flex-col gap-6">
          
          {/* Bloque 1: Título y descripción */}
          <div className="flex items-start gap-4">
            {/* Ícono Circular */}
            <div className="w-12 h-12 rounded-full border-[3px] border-blue-500/80 bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] backdrop-blur-sm">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <div className="pt-1">
              <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
                Riesgos
              </h2>
              <p className="text-[13px] text-slate-300 font-medium mt-1.5 leading-relaxed max-w-md">
                Identifica, prioriza y mitiga lo que puede afectar tus objetivos.
              </p>
            </div>
          </div>

          {/* Bloque 2: Frase destacada */}
          <div className="ml-[64px]">
            <h3 className="text-lg md:text-xl font-bold text-white drop-shadow-md leading-tight">
              Anticiparse siempre será <br className="hidden md:block" /> una ventaja.
            </h3>
            <div className="h-1.5 w-14 bg-blue-500 mt-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
          </div>
        </div>
        
        {/* BOTONERA DERECHA */}
        <div className="relative z-20 flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <button type="button" aria-current={vistaActiva === 'dashboard' ? 'page' : undefined} onClick={() => cambiarVistaSeguraRiesgos('dashboard')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'dashboard' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📊 Dashboard</button>
          <button type="button" aria-current={vistaActiva === 'matriz' ? 'page' : undefined} onClick={() => cambiarVistaSeguraRiesgos('matriz')} className={`px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border ${vistaActiva === 'matriz' ? 'bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:bg-slate-800/80 hover:text-white'}`}>📋 Ver Matriz</button>
          
          <button type="button" onClick={abrirDescargaExcel} className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-emerald-500 text-white border border-emerald-300 shadow-lg shadow-emerald-950/50 ring-2 ring-white/20 hover:bg-emerald-400 hover:-translate-y-0.5 flex items-center">
            <span className="mr-2" aria-hidden="true">📥</span> Descargar Excel
          </button>

          <button onClick={solicitarAnalisisGlobalIA} className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600/40 shadow-sm flex items-center backdrop-blur-sm">
            <span className="mr-2">✨</span> Informe Global IA
          </button>

          <button onClick={handleNuevoRiesgo} className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center shadow-lg bg-[#0A3B32] text-white hover:bg-[#062620] border border-emerald-900">
            <span className="mr-2">➕</span> Nuevo Riesgo
          </button>
        </div>
      </div>

      {vistaActiva === 'dashboard' && renderDashboard()}
      {vistaActiva === 'matriz' && renderMatriz()}

      {vistaActiva === 'nuevo' && (
        <form onChangeCapture={() => { if (!soloLecturaRiesgo) setFormularioModificado(true); }} onSubmit={e => { if (soloLecturaRiesgo) { e.preventDefault(); return; } handleRiesgoSubmit(e); }} className="space-y-6">
          {soloLecturaRiesgo && (
            <div role="status" className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300 bg-sky-50/95 px-5 py-3 shadow-md backdrop-blur">
              <p className="text-xs font-semibold text-sky-900">
                <span aria-hidden="true">👁 </span>Estás consultando <strong>RSK-{editRiesgo?.id}</strong> en modo lectura. Ningún campo se puede modificar.
              </p>
              <div className="flex gap-2">
                {editRiesgo && puedeModificarRiesgo(editRiesgo) && (
                  <button type="button" onClick={() => handleEditRiesgo(editRiesgo)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100">✏️ Pasar a edición</button>
                )}
                <button type="button" onClick={() => { setSoloLecturaRiesgo(false); setEditRiesgo(null); setVistaActiva('matriz'); }} className="rounded-lg bg-[#0A3B32] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#062620]">← Volver a la matriz</button>
              </div>
            </div>
          )}
          <fieldset disabled={soloLecturaRiesgo} className="m-0 min-w-0 space-y-6 border-0 p-0">
          
         {/* DATOS GENERALES EXTENDIDOS */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">1. Datos Generales de la Fila</h3>
            
            {/* 🔢 CAMPO VISUAL PARA EL ID DEL RIESGO */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 flex flex-wrap items-center gap-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                ID del Riesgo:
              </label>
              <div className="flex items-center space-x-1">
                <span className="text-xs font-black text-slate-400 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-sm">RSK -</span>
                <input 
                  type="number" 
                  value={customId} 
                  onChange={(e) => setCustomId(e.target.value)} 
                  disabled={!isAdmin}
                  className={`w-28 text-xs p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] font-black text-center shadow-sm ${!isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}`}
                />
              </div>
              {isAdmin ? (
                <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-bold">✏️ Modificable por Admin</span>
              ) : (
                <span className="text-[9px] text-slate-400 italic">Generado Automáticamente</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                <fieldset disabled={macroprocesosDisponibles.length === 0} className="rounded-lg border border-slate-300 bg-white p-2 disabled:bg-slate-100">
                  <legend className="px-1 text-[10px] font-black text-slate-500 uppercase tracking-wider">Macroprocesos / Procesos</legend>
                  <div className="grid max-h-36 grid-cols-1 gap-x-3 gap-y-1 overflow-y-auto sm:grid-cols-2">
                    {macroprocesosDisponibles.map(macroprocesoDisponible => (
                      <label key={macroprocesoDisponible} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-[10px] font-semibold text-slate-700 hover:bg-emerald-50">
                        <input
                          type="checkbox"
                          checked={macroprocesosSeleccionados.includes(macroprocesoDisponible)}
                          onChange={event => alternarMacroprocesoRiesgo(macroprocesoDisponible, event.target.checked)}
                          className="mt-0.5 accent-emerald-700"
                        />
                        <span>{macroprocesoDisponible}</span>
                      </label>
                    ))}
                    {macroprocesosDisponibles.length === 0 && <p className="text-[10px] text-slate-400">No tienes macroprocesos asignados para crear riesgos.</p>}
                  </div>
                </fieldset>
                {!isAdmin && macroprocesosDisponibles.length === 0 && <p className="text-[10px] text-amber-800">Puedes consultar la matriz completa. Solicita que te asignen un macroproceso para crear riesgos.</p>}

                <fieldset disabled={macroprocesosSeleccionados.length === 0} className="rounded-lg border border-slate-300 bg-white p-2 disabled:bg-slate-100">
                  <legend className="px-1 text-[10px] font-black text-slate-500 uppercase tracking-wider">Subprocesos por macroproceso</legend>
                  <div className="max-h-40 space-y-3 overflow-y-auto">
                    {macroprocesosSeleccionados.map(macroprocesoSeleccionado => {
                      const subprocesosDisponibles = obtenerSubprocesosPermitidos(macroprocesoSeleccionado);
                      const subprocesosSeleccionados = subprocesosPorMacroprocesoSeleccionados[macroprocesoSeleccionado] || [];
                      return (
                        <section key={macroprocesoSeleccionado}>
                          <h4 className="mb-1 text-[10px] font-black text-slate-600">{macroprocesoSeleccionado}</h4>
                          {subprocesosDisponibles.length > 0 ? (
                            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                              {subprocesosDisponibles.map(subproceso => (
                                <label key={subproceso} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-[10px] font-semibold text-slate-700 hover:bg-emerald-50">
                                  <input
                                    type="checkbox"
                                    checked={subprocesosSeleccionados.includes(subproceso)}
                                    onChange={event => alternarSubprocesoRiesgo(macroprocesoSeleccionado, subproceso, event.target.checked)}
                                    className="mt-0.5 accent-emerald-700"
                                  />
                                  <span>{subproceso}</span>
                                </label>
                              ))}
                            </div>
                          ) : <p className="text-[10px] text-slate-400">No hay subprocesos en el catálogo para este macroproceso.</p>}
                        </section>
                      );
                    })}
                    {macroprocesosSeleccionados.length === 0 && <p className="text-[10px] text-slate-400">Selecciona uno o más macroprocesos para ver sus subprocesos.</p>}
                  </div>
                </fieldset>
              </div>

              <div>
                <LabelConPalomita idCampo="categoria" onAbrirAyuda={setAyudaModal} />
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">                  
                  <option value="">Seleccione...</option>
                  <option value="Estratégico">Estratégico</option>
                  <option value="Operativo">Operativo</option>
                  <option value="Cumplimiento">Cumplimiento</option>
                  <option value="Financiero">Financiero</option>
                  <option value="Tecnológico">Tecnológico</option>
                  <option value="Ambiental">Ambiental</option>
                </select>
              </div>
              
              <div>
                <LabelConPalomita idCampo="clasificacion" onAbrirAyuda={setAyudaModal} />
                <select value={clasificacionRiesgo} onChange={(e) => setClasificacionRiesgo(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  {CLASIFICACIONES_MANUAL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="normativa" onAbrirAyuda={setAyudaModal} />
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
                  {sedesEmpresa.map(s => (
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
                <LabelConPalomita idCampo="responsable" onAbrirAyuda={setAyudaModal} />
                <div className="flex gap-2 mb-2 md:w-1/2">
                  <select value={responsableTemp} onChange={(e) => setResponsableTemp(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] bg-white">
                    <option value="">-- Escoger Líder --</option>
                    {CARGOS_EMPRESA.map(cargo => (
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

          {/* 2. ESTRUCTURA Y REDACCIÓN (MANDATO DEL MANUAL) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">2. Estructura y Redacción (Mandato del Manual)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <LabelConPalomita idCampo="afectacion" onAbrirAyuda={setAyudaModal} />
                <select value={afectacion} onChange={e => setAfectacion(e.target.value)} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value="Económico">Económico</option>
                  <option value="Operacional">Operacional</option>
                  <option value="Reputacional">Reputacional</option>
                  <option value="Legal / Cumplimiento">Legal / Cumplimiento</option>
                  <option value="Humano / Salud">Humano / Salud</option>
                  <option value="Económico-Reputacional">Económico-Reputacional</option>
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="causaInmediata" onAbrirAyuda={setAyudaModal} />           
                <textarea
                  rows="3"
                  value={causaInmediata}
                  onChange={e => setCausaInmediata(e.target.value)}
                  placeholder="Ej: Inconsistencia en la información de activos fijos..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] resize-y"
                />
              </div>
              <div>
                <LabelConPalomita idCampo="causaRaiz" onAbrirAyuda={setAyudaModal} />
                <textarea
                  rows="3"
                  value={causaRaiz}
                  onChange={e => setCausaRaiz(e.target.value)}
                  placeholder="Ej: Bases de datos desactualizadas de los inventarios..."
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] resize-y"
                />
              </div>
            </div>

            {/* Texto Final para el Escenario (100% EDITABLE) */}
            <div className="bg-emerald-50/70 border border-emerald-300 p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-emerald-900 uppercase tracking-wider block">
                  Texto Final para el Escenario (Editable)
                </label>
                <button
                  type="button"
                  onClick={generarTextoAutomatico}
                  className="text-[10px] font-extrabold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                >
                  🔄 Generar borrador sugerido
                </button>
              </div>
              <textarea
                rows="3"
                value={escenarioFinal}
                onChange={e => setEscenarioFinal(e.target.value)}
                placeholder="Escriba o ajuste la redacción final del riesgo aquí..."
                className="w-full text-xs p-2.5 bg-white border border-emerald-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          </div>
          {/* MATRIZ DE CALOR INHERENTE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest border-b pb-2">3. Nivel de Riesgo Inherente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LabelConPalomita idCampo="probInh" onAbrirAyuda={setAyudaModal} />
                <select value={probInherente} onChange={e => setProbInherente(Number(e.target.value))} className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32]">
                  <option value={20}>Muy Baja (20%)</option>
                  <option value={40}>Baja (40%)</option>
                  <option value={60}>Media (60%)</option>
                  <option value={80}>Alta (80%)</option>
                  <option value={100}>Muy Alta (100%)</option>
                </select>
              </div>
              <div>
                <LabelConPalomita idCampo="impInh" onAbrirAyuda={setAyudaModal} />
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
{controles.map((ctrl, idx) => estaAnulado(ctrl) ? (
  // Control anulado: solo lectura en el formulario; se reactiva desde el expediente del riesgo.
  <div key={idx} className="relative mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-100 p-4 text-slate-500">
    <div className="absolute -top-3 left-4 rounded-md border border-slate-400 bg-slate-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
      Control {codigoControl(idx, editRiesgo?.id ?? customId)} · Anulado
    </div>
    <p className="text-xs line-through">{ctrl.descripcion}</p>
    {ctrl.anulacion && <p className="mt-1 text-[11px]"><strong>{ctrl.anulacion.tipoMotivo}:</strong> {ctrl.anulacion.motivo} — {ctrl.anulacion.usuario}, {fechaEntradaHistorial(ctrl.anulacion)}.</p>}
    <div className="mt-2 flex items-center justify-between gap-2">
      <p className="text-[10px]">No cuenta en el residual.</p>
      <button type="button" onClick={() => abrirAnulacionFormulario('reactivar', idx)}
        className="whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-3 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50">↩️ Reactivar</button>
    </div>
  </div>
) : (
  <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 relative mt-6">
    
    {/* 🏷️ ETIQUETA VISUAL + BOTÓN DE CÁLCULO DE EFICACIA */}
    <div className="flex justify-between items-center">
      <div className="absolute -top-3 left-4 bg-[#0A3B32] text-white font-black text-[10px] px-3 py-1 rounded-md shadow-sm uppercase tracking-widest border border-[#062620]">
        Control {codigoControl(idx, editRiesgo?.id ?? customId)}
      </div>

      {/* 📊 BOTÓN CHULITO VERDE QUE ABRE EL DESGLOSE */}
      {/* No es <button> para que funcione también en modo consulta (dentro del <fieldset disabled>). */}
      <span
        role="button"
        tabIndex={0}
        onClick={() => setControlSeleccionadoIA(ctrl)}
        onKeyDown={evento => { if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); setControlSeleccionadoIA(ctrl); } }}
        className="ml-auto cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm transition-all transform hover:scale-105 cursor-pointer"
        title="Ver desglose de eficacia según el Manual de Riesgos"
      >
        <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">✓</span>
        <span>Ver Eficacia ({calcularEficaciaControl(ctrl)}%)</span>
      </span>
    </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">            
<div className="md:col-span-11">
                    <LabelConPalomita idCampo="controlDesc" onAbrirAyuda={setAyudaModal} />
                    <textarea
                      rows="3"
                      value={ctrl.descripcion}
                      onChange={(e) => { const nuevos = [...controles]; nuevos[idx].descripcion = e.target.value; setControles(nuevos); }}
                      className="w-full text-xs p-2 border bg-white rounded-lg focus:ring-2 focus:ring-[#0A3B32] resize-y"
                      placeholder="Describa la tarea completa del control..."
                    />
                  </div>                  
                  <div className="md:col-span-1 flex justify-center">
                    <div className="flex flex-col items-center gap-1.5">
                      {idx < (editRiesgo?.controlesDetallados?.length || 0) && (
                        <button type="button" onClick={() => abrirAnulacionFormulario('anular', idx)}
                          className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                          title="Anular este control si ya no aplica o se reemplaza (queda en el historial)">
                          🚫 Anular
                        </button>
                      )}
                      {(isAdmin || idx >= (editRiesgo?.controlesDetallados?.length || 0)) && (
                        <button type="button" onClick={async () => { if (await confirmarEliminacion('Se eliminará este control del formulario del riesgo.')) setControles(actuales => actuales.filter((_, i) => i !== idx)); }} className="text-red-500 hover:text-red-700 text-xs font-black uppercase tracking-widest bg-red-50 border border-red-200 px-3 py-2 rounded-xl transition-colors">🗑️ Borrar</button>
                      )}
                    </div>
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
              <LabelConPalomita idCampo="probRes" dark={true} onAbrirAyuda={setAyudaModal} />
                <input type="text" value={`${residuales.probabilidad}%`} disabled className="w-full text-xs p-2 border border-slate-600 rounded-lg bg-slate-800 text-emerald-400 font-black text-center cursor-not-allowed" />
              </div>
              <div>
              <LabelConPalomita idCampo="impRes" dark={true} onAbrirAyuda={setAyudaModal} />
                <input type="text" value={`${residuales.impacto}%`} disabled className="w-full text-xs p-2 border border-slate-600 rounded-lg bg-slate-800 text-emerald-400 font-black text-center cursor-not-allowed" />
              </div>
            </div>

            {/* 💡 Qué significan estos porcentajes para este riesgo: se actualiza mientras se editan los controles */}
            {(() => {
              const exp = obtenerExplicacionCalculo({ id: editRiesgo?.id ?? customId, probabilidadInherente: probInherente, impactoInherente: impInherente, controlesDetallados: controles });
              const lectura = explicarCalculoResidual(exp, { id: editRiesgo?.id ?? customId, controlesDetallados: controles, planAccionRiesgo, fechaSeguimiento });
              const tonoZona = {
                Extremo: 'bg-red-600 text-white', Alto: 'bg-orange-500 text-white', Moderado: 'bg-amber-400 text-slate-900', Bajo: 'bg-emerald-500 text-white',
              };
              return (
                <div className="space-y-3 rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 text-[11px] leading-relaxed text-emerald-100" aria-live="polite">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-emerald-300">💡 Lectura de este riesgo</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${tonoZona[lectura.zonaInherente]}`}>Inherente: {lectura.zonaInherente}</span>
                    <span aria-hidden="true" className="text-emerald-400">→</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${tonoZona[lectura.zonaResidual]}`}>Residual: {lectura.zonaResidual}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="font-bold text-emerald-300">Probabilidad</p>
                      {lectura.probabilidad.map(frase => <p key={frase} className="mt-1">{frase}</p>)}
                    </div>
                    <div>
                      <p className="font-bold text-emerald-300">Impacto</p>
                      {lectura.impacto.map(frase => <p key={frase} className="mt-1">{frase}</p>)}
                    </div>
                  </div>
                  <p className="border-t border-emerald-800/60 pt-2"><strong className="text-emerald-300">📌 En resumen:</strong> {lectura.conclusion}</p>
                  {/* 📖 Explicación completa de este riesgo */}
                  <ExplicacionRiesgoDetallada riesgo={{ id: editRiesgo?.id ?? customId, probabilidadInherente: probInherente, impactoInherente: impInherente, controlesDetallados: controles, planAccionRiesgo, fechaSeguimiento }} evaluaciones={evaluaciones} />
                </div>
              );
            })()}
          </div>

          </fieldset>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            {soloLecturaRiesgo ? (
              <button type="button" onClick={() => { setSoloLecturaRiesgo(false); setEditRiesgo(null); setVistaActiva('matriz'); }} className="min-h-11 px-6 py-3 rounded-xl font-bold text-white bg-[#0A3B32] hover:bg-[#062620] text-xs">← Volver a la matriz</button>
            ) : (
              <>
                <button type="button" onClick={cancelarFormularioRiesgo} className="mr-3 min-h-11 px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="bg-[#0A3B32] hover:bg-[#062620] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-md disabled:opacity-50">
                  {isSubmitting ? 'Guardando...' : (editRiesgo ? 'Actualizar Matriz' : 'Guardar en la Nube')}
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}