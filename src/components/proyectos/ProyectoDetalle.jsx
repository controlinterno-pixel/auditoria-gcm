// src/components/proyectos/ProyectoDetalle.jsx - Ficha integral del proyecto con sus pestañas.
import { ContextoGuia } from './guias.js';
import { lazy, Suspense, useMemo, useState } from 'react';
import { ESTADOS_PROYECTO, METODOLOGIAS } from '../../utils/proyectos/modelo.js';
import { calcularIndicadores, compactarPlan } from '../../utils/proyectos/indicadores.js';
import { hoyColombia } from '../../utils/proyectos/fechas.js';
import { useProyecto } from './useProyectos.js';
import FormularioProyecto from './FormularioProyecto.jsx';
import ResumenProyecto from './ResumenProyecto.jsx';
import { Insignia, Semaforo, botonSecundario } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';
import { useDialogoTexto } from './useUiProyectos.jsx';

const FormulacionProyecto = lazy(() => import('./FormulacionProyecto.jsx'));
const PlanificacionProyecto = lazy(() => import('./PlanificacionProyecto.jsx'));
const CierreProyecto = lazy(() => import('./CierreProyecto.jsx'));
const DocumentacionProyecto = lazy(() => import('./DocumentacionProyecto.jsx'));
const CronogramaProyecto = lazy(() => import('./CronogramaProyecto.jsx'));
const TareasProyecto = lazy(() => import('./TareasProyecto.jsx'));
const AgilProyecto = lazy(() => import('./AgilProyecto.jsx'));
const EntregablesProyecto = lazy(() => import('./EntregablesProyecto.jsx'));
const RiesgosProyecto = lazy(() => import('./RiesgosProyecto.jsx'));
const CambiosProyecto = lazy(() => import('./CambiosProyecto.jsx'));
const ReunionesProyecto = lazy(() => import('./ReunionesProyecto.jsx'));
const AvanceSitio = lazy(() => import('./AvanceSitio.jsx'));
const PresupuestoProyecto = lazy(() => import('./PresupuestoProyecto.jsx'));
const ReportesProyecto = lazy(() => import('./ReportesProyecto.jsx'));
const HistorialProyecto = lazy(() => import('./HistorialProyecto.jsx'));

export default function ProyectoDetalle({ id, usuario, onVolver, onCambio, showNotification, mapaProcesos, riesgosMatriz }) {
  const { proyecto, plan, cargando, error, guardando, operar, recargar } = useProyecto(id, showNotification);
  const [pestana, setPestana] = useState('resumen');
  const [editando, setEditando] = useState(false);
  const [pedirTexto, dialogo] = useDialogoTexto();

  const metodologia = proyecto?.ficha?.metodologia;
  const pestanas = useMemo(() => [
    ['resumen', 'Resumen'],
    ['formulacion', 'Formulación (Preinversión)'],
    ['planificacion', 'Interesados, organigrama y RACI'],
    ...(metodologia !== 'agil' ? [['cronograma', 'Cronograma y EDT']] : []),
    ['tareas', 'Tareas'],
    ...(metodologia !== 'predictiva' ? [['agil', 'Backlog y sprints']] : []),
    ['avanceSitio', 'Avance en sitio'],
    ['entregables', 'Entregables'],
    ['riesgos', 'Riesgos e incidencias'],
    ['cambios', 'Cambios'],
    ['reuniones', 'Reuniones y compromisos'],
    ...(proyecto?.ficha?.manejaPresupuesto ? [['presupuesto', 'Presupuesto']] : []),
    ['cierre', 'Operación y cierre'],
    ['documentacion', 'Documentación'],
    ['reportes', 'Reportes'],
    ['historial', 'Historial'],
  ], [metodologia, proyecto?.ficha?.manejaPresupuesto]);

  // Los indicadores del detalle se calculan con el plan completo y la misma función que el tablero.
  const hoy = hoyColombia();
  const indicadores = useMemo(() => (proyecto ? calcularIndicadores(proyecto, hoy, compactarPlan(plan || {}, proyecto.ficha?.calendario)) : null), [proyecto, plan, hoy]);

  const ejecutar = async (accion, datos, mensaje) => {
    const respuesta = await operar(accion, datos, mensaje);
    if (respuesta) onCambio?.();
    return respuesta;
  };

  if (cargando && !proyecto) return <p role="status" className="p-6 text-sm font-bold text-slate-500">Cargando proyecto…</p>;
  if (error || !proyecto) {
    return (
      <div className="space-y-3">
        <button type="button" className={botonSecundario} onClick={onVolver}>← Portafolio</button>
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error || 'El proyecto no existe o no tienes acceso.'}</p>
      </div>
    );
  }

  const cap = proyecto.capacidades || {};
  const props = { proyecto, plan: plan || {}, cap, usuario, operar: ejecutar, guardando, indicadores, pedirTexto, hoy, riesgosMatriz, showNotification };

  return (
    <ContextoGuia.Provider value="detalle">
    <div className="space-y-4">
      {dialogo}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <button type="button" className="mb-2 text-xs font-bold text-[#0055ff] hover:underline" onClick={onVolver}>← Portafolio de proyectos</button>
          <h2 className="text-xl font-black text-slate-800 sm:text-2xl">{proyecto.ficha?.nombre}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-black">{proyecto.codigoEstrategico ? `${proyecto.codigoEstrategico} · ` : ''}{proyecto.codigo}</span>
            <Insignia tono={TONO_ESTADO[proyecto.estado]}>{ESTADOS_PROYECTO[proyecto.estado]}</Insignia>
            <Insignia tono="azul">{METODOLOGIAS[metodologia]}</Insignia>
            {proyecto.archivado && <Insignia>Archivado</Insignia>}
            <Semaforo semaforo={indicadores?.semaforo} conTexto />
            {cap.roles?.length > 0 && <span>Tu rol: <b>{cap.roles.map(rol => (rol === 'reportaAvance' ? 'reporta avance en sitio' : rol)).join(', ')}</b></span>}
            {!cap.roles?.length && <span>Acceso de consulta</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botonSecundario} onClick={recargar} disabled={cargando}>↻ Recargar</button>
          {cap.gestionar && <button type="button" className={botonSecundario} onClick={() => setEditando(true)}>✏️ Editar ficha</button>}
        </div>
      </div>

      <div role="tablist" aria-label="Secciones del proyecto" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {pestanas.map(([clave, texto]) => (
          <button key={clave} type="button" role="tab" aria-selected={pestana === clave} onClick={() => setPestana(clave)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-black ${pestana === clave ? 'border-[#0055ff] text-[#0055ff]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{texto}</button>
        ))}
      </div>

      <div role="tabpanel">
        <Suspense fallback={<p role="status" className="text-sm text-slate-500">Cargando…</p>}>
          {pestana === 'resumen' && <ResumenProyecto {...props} />}
          {pestana === 'formulacion' && <FormulacionProyecto {...props} />}
          {pestana === 'planificacion' && <PlanificacionProyecto {...props} />}
          {pestana === 'cierre' && <CierreProyecto {...props} />}
          {pestana === 'documentacion' && <DocumentacionProyecto {...props} />}
          {pestana === 'cronograma' && <CronogramaProyecto {...props} />}
          {pestana === 'tareas' && <TareasProyecto {...props} />}
          {pestana === 'agil' && <AgilProyecto {...props} />}
          {pestana === 'avanceSitio' && <AvanceSitio {...props} />}
          {pestana === 'entregables' && <EntregablesProyecto {...props} />}
          {pestana === 'riesgos' && <RiesgosProyecto {...props} />}
          {pestana === 'cambios' && <CambiosProyecto {...props} />}
          {pestana === 'reuniones' && <ReunionesProyecto {...props} />}
          {pestana === 'presupuesto' && <PresupuestoProyecto {...props} />}
          {pestana === 'reportes' && <ReportesProyecto {...props} />}
          {pestana === 'historial' && <HistorialProyecto {...props} />}
        </Suspense>
      </div>

      {editando && (
        <FormularioProyecto proyecto={proyecto} usuario={usuario} guardando={guardando} mapaProcesos={mapaProcesos} onCerrar={() => setEditando(false)}
          onGuardar={async datos => { if (await ejecutar('editarFicha', datos, 'Ficha actualizada.')) setEditando(false); }} />
      )}
    </div>
    </ContextoGuia.Provider>
  );
}
