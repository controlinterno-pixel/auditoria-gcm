// src/components/proyectos/FormularioTarea.jsx - Crear, editar, ejecutar, revisar y comentar una tarea.
// Quien gestiona edita todo; quien ejecuta solo estado, avance, bloqueo, criterios y evidencias (el servidor
// ignora el resto). La revisión la hace otra persona distinta de quien ejecutó.
import { useMemo, useState } from 'react';
import { ESTADOS_TAREA, PRIORIDADES, TIPOS_CONTENEDOR, TIPOS_TAREA, normalizarCorreo, validarTarea } from '../../utils/proyectos/modelo.js';
import { fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, Insignia, ListaEvidencias, Modal, SubirEvidencia, SugerenciasCorreos, botonPeligro, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';

const VACIA = { titulo: '', descripcion: '', tipo: 'actividad', padreId: '', responsable: '', colaboradores: [], inicio: '', fin: '', prioridad: 'media', estado: 'pendiente', avance: 0, esfuerzoHoras: '', puntos: '', sprintId: '', dependencias: [], restricciones: '', entregablesTexto: '', motivoBloqueo: '', requiereRevision: false, criteriosAceptacion: [], evidencias: [] };

export default function FormularioTarea({ tarea, proyecto, plan, cap, usuario, operar, guardando, onCerrar, tipoInicial }) {
  const nueva = !tarea;
  const correo = normalizarCorreo(usuario?.email);
  const esEjecutor = tarea && (normalizarCorreo(tarea.responsable) === correo || (tarea.colaboradores || []).includes(correo));
  const puedeEditarTodo = cap.gestionar;
  const puedeEjecutar = puedeEditarTodo || (cap.aportar && esEjecutor);
  const puedeRevisar = tarea?.estado === 'en_revision' && cap.decidir && !esEjecutor;
  const [datos, setDatos] = useState(() => ({ ...VACIA, ...(tipoInicial ? { tipo: tipoInicial } : {}), ...(tarea || {}), colaboradoresTexto: (tarea?.colaboradores || []).join(', ') }));
  const [nuevoCriterio, setNuevoCriterio] = useState('');
  const [comentario, setComentario] = useState('');
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);

  const tareas = plan.tareas || [];
  const contenedores = tareas.filter(item => TIPOS_CONTENEDOR.includes(item.tipo) && item.id !== tarea?.id);
  const predecesorasPosibles = tareas.filter(item => !TIPOS_CONTENEDOR.includes(item.tipo) && item.id !== tarea?.id && item.estado !== 'cancelada');
  const enLineaBase = tarea && (plan.lineasBase || []).at(-1)?.tareas?.[String(tarea.id)];
  const fechasCambian = tarea && (tarea.inicio !== datos.inicio || tarea.fin !== datos.fin);
  const pideMotivo = (enLineaBase && fechasCambian) || (datos.estado === 'cancelada' && tarea?.estado !== 'cancelada');
  const esAgil = proyecto.ficha?.metodologia !== 'predictiva';

  const paraEnviar = () => {
    const base = { ...datos, colaboradores: String(datos.colaboradoresTexto || '').split(',').map(normalizarCorreo).filter(Boolean), avance: Number(datos.avance) || 0 };
    if (base.tipo === 'hito') base.fin = base.inicio;
    if (['en_revision', 'completada'].includes(base.estado)) base.avance = 100;
    if (base.estado === 'pendiente') base.avance = 0;
    delete base.colaboradoresTexto;
    return base;
  };
  const errores = useMemo(() => {
    const lista = validarTarea(paraEnviar());
    if (pideMotivo && !motivo.trim()) lista.push(datos.estado === 'cancelada' ? 'Explica por qué se cancela la tarea.' : 'La tarea está en la línea base: explica el motivo de la reprogramación.');
    return lista;
  }, [datos, motivo, pideMotivo]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value }));
  const guardar = async evento => {
    evento.preventDefault();
    setIntento(true);
    if (errores.length) return;
    const enviada = paraEnviar();
    const respuesta = await operar('guardarTarea', { tarea: { ...enviada, versionBase: tarea?.version, motivo } }, nueva ? 'Tarea creada.' : 'Tarea actualizada.');
    if (respuesta) onCerrar();
  };
  const revisar = async decision => {
    if (decision === 'devolver' && !comentario.trim()) { setIntento(true); return; }
    const respuesta = await operar('revisarTarea', { idTarea: tarea.id, versionBase: tarea.version, decision, comentario }, decision === 'aprobar' ? 'Tarea aprobada.' : 'Tarea devuelta.');
    if (respuesta) onCerrar();
  };
  const comentar = async () => {
    if (!comentario.trim()) return;
    if (await operar('comentarTarea', { idTarea: tarea.id, texto: comentario }, 'Comentario agregado.')) setComentario('');
  };
  const sololectura = !puedeEjecutar;
  const deshabilitarGestion = !puedeEditarTodo;

  return (
    <Modal titulo={nueva ? `Nueva ${TIPOS_TAREA[datos.tipo]?.toLowerCase() || 'tarea'}` : `${tarea.codigo} · ${tarea.titulo}`} ancho="max-w-4xl" onCerrar={onCerrar} pie={(
      <>
        {intento && errores.length > 0 && <p role="alert" className="mr-auto max-w-xl text-xs font-bold text-red-600">{errores.join(' ')}</p>}
        <button type="button" className={botonSecundario} onClick={onCerrar}>{sololectura ? 'Cerrar' : 'Cancelar'}</button>
        {!sololectura && tarea?.estado !== 'en_revision' && <button type="submit" form="formulario-tarea" className={botonPrimario} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>}
      </>
    )}>
      <SugerenciasCorreos id="correos-tarea" />
      {tarea?.estado === 'en_revision' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-black">En revisión: {puedeRevisar ? 'aprueba o devuelve la tarea.' : 'esperando que otra persona la revise (director, aprobador o patrocinador).'}</p>
          {puedeRevisar && (
            <div className="mt-2 space-y-2">
              <textarea aria-label="Comentario de la revisión" rows={2} className={claseCampo} value={comentario} onChange={evento => setComentario(evento.target.value)} placeholder="Comentario (obligatorio para devolver)" />
              <div className="flex gap-2">
                <button type="button" className={botonPrimario} disabled={guardando} onClick={() => revisar('aprobar')}>Aprobar</button>
                <button type="button" className={botonPeligro} disabled={guardando || !comentario.trim()} onClick={() => revisar('devolver')}>Devolver</button>
              </div>
            </div>
          )}
        </div>
      )}
      <form id="formulario-tarea" onSubmit={guardar} className="grid gap-4 sm:grid-cols-6" noValidate>
        <Campo etiqueta="Título" obligatorio className="sm:col-span-4">{props => <input {...props} className={claseCampo} value={datos.titulo} onChange={cambiar('titulo')} disabled={deshabilitarGestion} />}</Campo>
        <Campo etiqueta="Tipo" className="sm:col-span-2">{props => (
          <select {...props} className={claseCampo} value={datos.tipo} onChange={cambiar('tipo')} disabled={deshabilitarGestion || !nueva}>
            {Object.entries(TIPOS_TAREA).filter(([valor]) => esAgil || !['epica', 'historia'].includes(valor)).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>)}
        </Campo>
        <Campo etiqueta="Descripción" className="sm:col-span-6">{props => <textarea {...props} rows={2} className={claseCampo} value={datos.descripcion} onChange={cambiar('descripcion')} disabled={deshabilitarGestion} />}</Campo>
        <Campo etiqueta="Pertenece a (fase, paquete o épica)" className="sm:col-span-3">{props => (
          <select {...props} className={claseCampo} value={datos.padreId} onChange={cambiar('padreId')} disabled={deshabilitarGestion}>
            <option value="">— Nivel superior —</option>
            {contenedores.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.titulo}</option>)}
          </select>)}
        </Campo>
        <Campo etiqueta="Prioridad" className="sm:col-span-3">{props => <select {...props} className={claseCampo} value={datos.prioridad} onChange={cambiar('prioridad')} disabled={deshabilitarGestion}>{Object.entries(PRIORIDADES).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select>}</Campo>
        {!TIPOS_CONTENEDOR.includes(datos.tipo) && (
          <>
            <Campo etiqueta="Responsable principal" className="sm:col-span-3">{props => <input {...props} list="correos-tarea" className={claseCampo} value={datos.responsable} onChange={cambiar('responsable')} disabled={deshabilitarGestion} placeholder="nombre@termales.com.co" />}</Campo>
            <Campo etiqueta="Colaboradores (separados por coma)" className="sm:col-span-3">{props => <input {...props} className={claseCampo} value={datos.colaboradoresTexto} onChange={cambiar('colaboradoresTexto')} disabled={deshabilitarGestion} />}</Campo>
          </>
        )}
        <Campo etiqueta={datos.tipo === 'hito' ? 'Fecha del hito' : 'Inicio previsto'} className="sm:col-span-2">{props => <input {...props} type="date" className={claseCampo} value={datos.inicio} onChange={cambiar('inicio')} disabled={deshabilitarGestion} />}</Campo>
        {datos.tipo !== 'hito' && <Campo etiqueta="Fin previsto" className="sm:col-span-2">{props => <input {...props} type="date" className={claseCampo} value={datos.fin} onChange={cambiar('fin')} disabled={deshabilitarGestion} />}</Campo>}
        {!TIPOS_CONTENEDOR.includes(datos.tipo) && datos.tipo !== 'hito' && (
          <Campo etiqueta={esAgil && datos.tipo === 'historia' ? 'Puntos de historia' : 'Esfuerzo estimado (horas)'} className="sm:col-span-2" ayuda="Pondera el avance del proyecto.">
            {props => esAgil && datos.tipo === 'historia'
              ? <input {...props} type="number" min="0" className={claseCampo} value={datos.puntos ?? ''} onChange={cambiar('puntos')} disabled={deshabilitarGestion} />
              : <input {...props} type="number" min="0" className={claseCampo} value={datos.esfuerzoHoras ?? ''} onChange={cambiar('esfuerzoHoras')} disabled={deshabilitarGestion} />}
          </Campo>
        )}
        {esAgil && datos.tipo === 'historia' && (
          <Campo etiqueta="Sprint" className="sm:col-span-2">{props => <select {...props} className={claseCampo} value={datos.sprintId} onChange={cambiar('sprintId')} disabled={deshabilitarGestion}><option value="">Backlog (sin sprint)</option>{(plan.sprints || []).filter(sprint => sprint.estado !== 'cerrado').map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.nombre}</option>)}</select>}</Campo>
        )}
        {pideMotivo && <Campo etiqueta={datos.estado === 'cancelada' ? 'Motivo de la cancelación' : 'Motivo de la reprogramación'} obligatorio className="sm:col-span-6" ayuda="Queda en el historial. La línea base aprobada no cambia: se mide la desviación.">{props => <input {...props} className={claseCampo} value={motivo} onChange={evento => setMotivo(evento.target.value)} />}</Campo>}

        {!TIPOS_CONTENEDOR.includes(datos.tipo) && proyecto.ficha?.metodologia !== 'agil' && (
          <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-6" disabled={deshabilitarGestion}>
            <legend className="px-1 text-xs font-black text-slate-700">Predecesoras (fin → inicio)</legend>
            {datos.dependencias.map((dependencia, indice) => (
              <div key={`${dependencia.id}-${indice}`} className="mb-2 flex flex-wrap items-center gap-2">
                <select aria-label="Predecesora" className={`${claseCampo} max-w-sm`} value={dependencia.id} onChange={evento => setDatos(actual => ({ ...actual, dependencias: actual.dependencias.map((item, i) => (i === indice ? { ...item, id: evento.target.value } : item)) }))}>
                  {predecesorasPosibles.map(item => <option key={item.id} value={item.id}>{item.codigo} · {item.titulo}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs">Desfase (días)<input type="number" className={`${claseCampo} w-20`} value={dependencia.desfase || 0} onChange={evento => setDatos(actual => ({ ...actual, dependencias: actual.dependencias.map((item, i) => (i === indice ? { ...item, desfase: Number(evento.target.value) } : item)) }))} /></label>
                <button type="button" className="text-xs font-bold text-red-600" onClick={() => setDatos(actual => ({ ...actual, dependencias: actual.dependencias.filter((_, i) => i !== indice) }))}>Quitar</button>
              </div>
            ))}
            {predecesorasPosibles.length > 0 ? <button type="button" className="text-xs font-bold text-[#0055ff]" onClick={() => setDatos(actual => ({ ...actual, dependencias: [...actual.dependencias, { id: predecesorasPosibles[0].id, desfase: 0 }] }))}>＋ Agregar predecesora</button>
              : <p className="text-[11px] text-slate-500">Aún no hay otras actividades para enlazar.</p>}
            <p className="mt-1 text-[11px] text-slate-500">Si una predecesora se retrasa, esta tarea se reprograma sola (conservando su duración). Los ciclos se rechazan.</p>
          </fieldset>
        )}

        {!TIPOS_CONTENEDOR.includes(datos.tipo) && (
          <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-6" disabled={sololectura}>
            <legend className="px-1 text-xs font-black text-slate-700">Ejecución</legend>
            <div className="grid gap-3 sm:grid-cols-4">
              <Campo etiqueta="Estado">{props => (
                <select {...props} className={claseCampo} value={datos.estado} onChange={cambiar('estado')}>
                  {Object.entries(ESTADOS_TAREA).filter(([valor]) => (valor !== 'en_revision' || datos.requiereRevision) && (valor !== 'completada' || !datos.requiereRevision || tarea?.estado === 'completada') && (valor !== 'cancelada' || puedeEditarTodo)).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                </select>)}
              </Campo>
              <Campo etiqueta="Avance (%)" ayuda="0 si está pendiente; 100 solo al completar o enviar a revisión.">{props => <input {...props} type="number" min="0" max="100" step="5" className={claseCampo} value={['completada', 'en_revision'].includes(datos.estado) ? 100 : datos.estado === 'pendiente' ? 0 : datos.avance} onChange={cambiar('avance')} disabled={['completada', 'en_revision', 'pendiente'].includes(datos.estado)} />}</Campo>
              <Campo etiqueta="Inicio real">{props => <input {...props} type="date" className={claseCampo} value={datos.inicioReal || ''} onChange={cambiar('inicioReal')} />}</Campo>
              <Campo etiqueta="Fin real">{props => <input {...props} type="date" className={claseCampo} value={datos.finReal || ''} onChange={cambiar('finReal')} />}</Campo>
              {datos.estado === 'bloqueada' && <Campo etiqueta="¿Qué la bloquea?" obligatorio className="sm:col-span-4">{props => <input {...props} className={claseCampo} value={datos.motivoBloqueo} onChange={cambiar('motivoBloqueo')} />}</Campo>}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={datos.requiereRevision} onChange={cambiar('requiereRevision')} disabled={deshabilitarGestion} /> Requiere revisión y aprobación de otra persona antes de completarse
            </label>
          </fieldset>
        )}

        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-3" disabled={sololectura}>
          <legend className="px-1 text-xs font-black text-slate-700">Criterios de aceptación</legend>
          {datos.criteriosAceptacion.length === 0 && <p className="text-[11px] text-slate-500">Sin criterios. Con criterios, la tarea solo se completa cuando todos se cumplen.</p>}
          <ul className="space-y-1">
            {datos.criteriosAceptacion.map((criterio, indice) => (
              <li key={`${criterio.texto}-${indice}`} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={criterio.cumplido === true} aria-label={`Cumplido: ${criterio.texto}`} onChange={evento => setDatos(actual => ({ ...actual, criteriosAceptacion: actual.criteriosAceptacion.map((item, i) => (i === indice ? { ...item, cumplido: evento.target.checked } : item)) }))} />
                <span className="flex-1">{criterio.texto}</span>
                {puedeEditarTodo && <button type="button" className="text-slate-400 hover:text-red-600" aria-label={`Quitar ${criterio.texto}`} onClick={() => setDatos(actual => ({ ...actual, criteriosAceptacion: actual.criteriosAceptacion.filter((_, i) => i !== indice) }))}>✕</button>}
              </li>
            ))}
          </ul>
          {puedeEditarTodo && (
            <div className="mt-2 flex gap-2">
              <input aria-label="Nuevo criterio de aceptación" className={claseCampo} value={nuevoCriterio} onChange={evento => setNuevoCriterio(evento.target.value)} placeholder="Nuevo criterio" />
              <button type="button" className={botonSecundario} disabled={!nuevoCriterio.trim()} onClick={() => { setDatos(actual => ({ ...actual, criteriosAceptacion: [...actual.criteriosAceptacion, { texto: nuevoCriterio.trim(), cumplido: false }] })); setNuevoCriterio(''); }}>Agregar</button>
            </div>
          )}
        </fieldset>
        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-3" disabled={sololectura}>
          <legend className="px-1 text-xs font-black text-slate-700">Entregables y evidencias</legend>
          <Campo etiqueta="Entregables de la tarea">{props => <textarea {...props} rows={2} className={claseCampo} value={datos.entregablesTexto} onChange={cambiar('entregablesTexto')} disabled={deshabilitarGestion} />}</Campo>
          <div className="mt-2 space-y-2">
            <ListaEvidencias evidencias={datos.evidencias} onQuitar={sololectura ? null : indice => setDatos(actual => ({ ...actual, evidencias: actual.evidencias.filter((_, i) => i !== indice) }))} />
            {!sololectura && <SubirEvidencia correo={usuario?.email} onSubida={evidencia => setDatos(actual => ({ ...actual, evidencias: [...actual.evidencias, evidencia] }))} />}
          </div>
        </fieldset>
        {puedeEditarTodo && <Campo etiqueta="Restricciones" className="sm:col-span-6">{props => <input {...props} className={claseCampo} value={datos.restricciones} onChange={cambiar('restricciones')} />}</Campo>}
      </form>

      {tarea && (
        <section className="mt-5 border-t border-slate-200 pt-4" aria-label="Comentarios y revisiones">
          <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">Seguimiento</h3>
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {[...(tarea.comentarios || []).map(item => ({ ...item, tipo: 'comentario' })), ...(tarea.revisiones || []).map(item => ({ ...item, tipo: 'revision', texto: `${item.decision === 'aprobar' ? 'Aprobó' : 'Devolvió'}${item.comentario ? `: ${item.comentario}` : ''}` }))]
              .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((item, indice) => (
                <li key={item.id || indice} className="rounded-lg bg-slate-50 p-2 text-xs">
                  <p className="font-bold text-slate-700">{nombreDeCorreo(item.por)} · <span className="font-normal text-slate-500">{fechaHora(item.fecha)}</span> {item.tipo === 'revision' && <Insignia tono={TONO_ESTADO[item.decision === 'aprobar' ? 'completada' : 'en_revision']}>revisión</Insignia>}</p>
                  <p className="mt-0.5 whitespace-pre-line text-slate-700">{item.texto}</p>
                </li>
              ))}
            {!(tarea.comentarios || []).length && !(tarea.revisiones || []).length && <li className="text-xs text-slate-500">Sin comentarios.</li>}
          </ul>
          {cap.comentar && !puedeRevisar && (
            <div className="mt-2 flex gap-2">
              <input aria-label="Nuevo comentario" className={claseCampo} value={comentario} onChange={evento => setComentario(evento.target.value)} placeholder="Escribe un comentario" />
              <button type="button" className={botonSecundario} disabled={guardando || !comentario.trim()} onClick={comentar}>Comentar</button>
            </div>
          )}
        </section>
      )}
    </Modal>
  );
}
