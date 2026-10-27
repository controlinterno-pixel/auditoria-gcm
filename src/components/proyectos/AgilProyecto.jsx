// src/components/proyectos/AgilProyecto.jsx - Backlog, sprints, capacidad, velocidad y retrospectivas.
// Velocidad = puntos de las historias completadas en cada sprint cerrado; con menos de 2 sprints cerrados no
// se muestra un promedio (no hay datos suficientes).
import { useState } from 'react';
import { ESTADOS_SPRINT, ESTADOS_TAREA, PRIORIDADES } from '../../utils/proyectos/modelo.js';
import { fecha, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import FormularioTarea from './FormularioTarea.jsx';
import { Campo, EstadoVacio, Insignia, Kpi, Modal, Seccion, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';

const ORDEN_PRIORIDAD = { critica: 0, alta: 1, media: 2, baja: 3 };

function FormularioSprint({ sprint, onGuardar, onCerrar, guardando }) {
  const [datos, setDatos] = useState(() => ({ nombre: '', objetivo: '', inicio: '', fin: '', capacidad: '', estado: 'planeado', revision: '', retrospectiva: '', mejorasTexto: (sprint?.mejoras || []).join('\n'), ...(sprint || {}) }));
  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.value }));
  const guardar = async evento => {
    evento.preventDefault();
    const enviado = { ...datos, mejoras: String(datos.mejorasTexto || '').split('\n').map(item => item.trim()).filter(Boolean), versionBase: sprint?.version };
    if (await onGuardar(enviado)) onCerrar();
  };
  return (
    <Modal titulo={sprint ? `Sprint ${sprint.nombre}` : 'Nuevo sprint'} onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="submit" form="formulario-sprint" className={botonPrimario} disabled={guardando}>Guardar</button></>}>
      <form id="formulario-sprint" onSubmit={guardar} className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Nombre" obligatorio className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.nombre} onChange={cambiar('nombre')} />}</Campo>
        <Campo etiqueta="Estado">{p => <select {...p} className={claseCampo} value={datos.estado} onChange={cambiar('estado')}>{Object.entries(ESTADOS_SPRINT).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
        <Campo etiqueta="Capacidad (puntos)">{p => <input {...p} type="number" min="0" className={claseCampo} value={datos.capacidad ?? ''} onChange={cambiar('capacidad')} />}</Campo>
        <Campo etiqueta="Inicio" obligatorio>{p => <input {...p} type="date" className={claseCampo} value={datos.inicio} onChange={cambiar('inicio')} />}</Campo>
        <Campo etiqueta="Fin" obligatorio>{p => <input {...p} type="date" className={claseCampo} value={datos.fin} onChange={cambiar('fin')} />}</Campo>
        <Campo etiqueta="Objetivo del sprint" className="sm:col-span-4">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.objetivo} onChange={cambiar('objetivo')} />}</Campo>
        <Campo etiqueta="Revisión del sprint" className="sm:col-span-2">{p => <textarea {...p} rows={3} className={claseCampo} value={datos.revision} onChange={cambiar('revision')} />}</Campo>
        <Campo etiqueta="Retrospectiva" className="sm:col-span-2">{p => <textarea {...p} rows={3} className={claseCampo} value={datos.retrospectiva} onChange={cambiar('retrospectiva')} />}</Campo>
        <Campo etiqueta="Compromisos de mejora (uno por línea)" className="sm:col-span-4">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.mejorasTexto} onChange={cambiar('mejorasTexto')} />}</Campo>
      </form>
    </Modal>
  );
}

export default function AgilProyecto(props) {
  const { plan, cap, operar, guardando } = props;
  const [abierta, setAbierta] = useState(null);
  const [sprintAbierto, setSprintAbierto] = useState(null);
  const historias = (plan.tareas || []).filter(tarea => ['historia', 'epica'].includes(tarea.tipo) && tarea.estado !== 'cancelada');
  const sprints = [...(plan.sprints || [])].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  const backlog = historias.filter(tarea => tarea.tipo === 'historia' && !tarea.sprintId && tarea.estado !== 'completada')
    .sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]);
  const puntosDe = lista => lista.reduce((suma, tarea) => suma + (Number(tarea.puntos) || 0), 0);
  const cerrados = sprints.filter(sprint => sprint.estado === 'cerrado').map(sprint => ({ ...sprint, velocidad: puntosDe(historias.filter(tarea => tarea.sprintId === sprint.id && tarea.estado === 'completada')) }));
  const velocidadPromedio = cerrados.length >= 2 ? cerrados.reduce((suma, sprint) => suma + sprint.velocidad, 0) / cerrados.length : null;
  const epicas = historias.filter(tarea => tarea.tipo === 'epica');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Historias en backlog" valor={backlog.length} detalle={`${puntosDe(backlog)} puntos`} />
        <Kpi titulo="Sprints cerrados" valor={cerrados.length} />
        <Kpi titulo="Velocidad promedio" valor={velocidadPromedio === null ? 'Sin datos' : `${Math.round(velocidadPromedio * 10) / 10} pts`} detalle={velocidadPromedio === null ? 'Se calcula con 2 o más sprints cerrados' : 'Puntos completados por sprint cerrado'} />
        <Kpi titulo="Épicas" valor={epicas.length} />
      </div>

      <Seccion titulo="Sprints" acciones={cap.gestionar && <button type="button" className={botonPrimario} onClick={() => setSprintAbierto('nuevo')}>＋ Nuevo sprint</button>}>
        {!sprints.length ? <EstadoVacio titulo="Sin sprints" descripcion="Planifica el primer sprint con su objetivo, fechas y capacidad." /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sprints.map(sprint => {
              const delSprint = historias.filter(tarea => tarea.sprintId === sprint.id);
              const comprometidos = puntosDe(delSprint);
              const completados = puntosDe(delSprint.filter(tarea => tarea.estado === 'completada'));
              const excede = sprint.capacidad !== null && sprint.capacidad !== undefined && comprometidos > Number(sprint.capacidad);
              return (
                <article key={sprint.id} className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="text-left text-sm font-black text-slate-800 hover:underline" onClick={() => setSprintAbierto(sprint)} disabled={!cap.gestionar}>{sprint.nombre}</button>
                    <Insignia tono={TONO_ESTADO[sprint.estado]}>{ESTADOS_SPRINT[sprint.estado]}</Insignia>
                  </div>
                  <p className="mt-1 text-slate-500">{fecha(sprint.inicio)} → {fecha(sprint.fin)}</p>
                  {sprint.objetivo && <p className="mt-1 text-slate-700">{sprint.objetivo}</p>}
                  <p className={`mt-2 font-bold ${excede ? 'text-red-600' : 'text-slate-700'}`}>{completados} de {comprometidos} pts completados{sprint.capacidad !== null && sprint.capacidad !== undefined ? ` · capacidad ${sprint.capacidad}` : ''}{excede ? ' · supera la capacidad' : ''}</p>
                  <ul className="mt-2 space-y-1">{delSprint.map(tarea => <li key={tarea.id}><button type="button" onClick={() => setAbierta(tarea)} className="text-left text-[#0055ff] hover:underline">{tarea.codigo} {tarea.titulo}</button> <span className="text-slate-500">· {ESTADOS_TAREA[tarea.estado]} · {tarea.puntos ?? '—'} pts</span></li>)}</ul>
                  {sprint.retrospectiva && <p className="mt-2 border-t border-slate-100 pt-2 text-slate-600"><b>Retrospectiva:</b> {sprint.retrospectiva}</p>}
                  {(sprint.mejoras || []).length > 0 && <ul className="mt-1 list-disc pl-4 text-slate-600">{sprint.mejoras.map(mejora => <li key={mejora}>{mejora}</li>)}</ul>}
                </article>
              );
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Backlog priorizado" descripcion="Historias sin sprint, de mayor a menor prioridad." acciones={cap.gestionar && (
        <><button type="button" className={botonSecundario} onClick={() => setAbierta({ tipoInicial: 'epica' })}>＋ Épica</button><button type="button" className={botonPrimario} onClick={() => setAbierta({ tipoInicial: 'historia' })}>＋ Historia</button></>
      )}>
        {!backlog.length ? <EstadoVacio titulo="Backlog vacío" /> : (
          <ul className="divide-y divide-slate-100 text-xs">
            {backlog.map(tarea => (
              <li key={tarea.id} className="flex flex-wrap items-center gap-2 py-2">
                <button type="button" onClick={() => setAbierta(tarea)} className="font-bold text-[#0055ff] hover:underline">{tarea.codigo} · {tarea.titulo}</button>
                <Insignia tono={ORDEN_PRIORIDAD[tarea.prioridad] <= 1 ? 'rojo' : 'gris'}>{PRIORIDADES[tarea.prioridad]}</Insignia>
                <span className="text-slate-500">{tarea.puntos ?? 'Sin estimar'} pts · {nombreDeCorreo(tarea.responsable)}</span>
                {tarea.padreId && <span className="text-slate-500">Épica: {epicas.find(epica => epica.id === tarea.padreId)?.titulo}</span>}
                {(tarea.criteriosAceptacion || []).length === 0 && <Insignia tono="amarillo">Sin criterios de aceptación</Insignia>}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {abierta && <FormularioTarea {...props} tarea={abierta.id ? abierta : null} tipoInicial={abierta.tipoInicial} onCerrar={() => setAbierta(null)} />}
      {sprintAbierto && <FormularioSprint sprint={sprintAbierto === 'nuevo' ? null : sprintAbierto} guardando={guardando} onCerrar={() => setSprintAbierto(null)} onGuardar={sprint => operar('guardarSprint', { sprint }, 'Sprint guardado.')} />}
    </div>
  );
}
