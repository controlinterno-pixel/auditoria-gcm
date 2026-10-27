// src/components/proyectos/EntregablesProyecto.jsx - Entregables con versiones, evidencias y revisión por
// otra persona. Un archivo adjunto no aprueba nada: la aprobación es una decisión registrada.
import { useState } from 'react';
import { ESTADOS_ENTREGABLE, normalizarCorreo } from '../../utils/proyectos/modelo.js';
import { fecha, fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, EstadoVacio, Insignia, ListaEvidencias, Modal, Seccion, SubirEvidencia, SugerenciasCorreos, botonPeligro, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';

function FormularioEntregable({ entregable, tareas, onGuardar, onCerrar, guardando }) {
  const [datos, setDatos] = useState(() => ({ nombre: '', descripcion: '', responsable: '', fechaComprometida: '', idTarea: '', criterios: '', ...(entregable || {}) }));
  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.value }));
  return (
    <Modal titulo={entregable ? `Editar ${entregable.codigo}` : 'Nuevo entregable'} onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="submit" form="formulario-entregable" className={botonPrimario} disabled={guardando}>Guardar</button></>}>
      <SugerenciasCorreos id="correos-entregable" />
      <form id="formulario-entregable" className="grid gap-3 sm:grid-cols-2" onSubmit={async evento => { evento.preventDefault(); if (await onGuardar({ ...datos, versionBase: entregable?.version })) onCerrar(); }}>
        <Campo etiqueta="Nombre" obligatorio className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.nombre} onChange={cambiar('nombre')} />}</Campo>
        <Campo etiqueta="Responsable" obligatorio>{p => <input {...p} list="correos-entregable" className={claseCampo} value={datos.responsable} onChange={cambiar('responsable')} />}</Campo>
        <Campo etiqueta="Fecha comprometida" obligatorio>{p => <input {...p} type="date" className={claseCampo} value={datos.fechaComprometida} onChange={cambiar('fechaComprometida')} />}</Campo>
        <Campo etiqueta="Tarea asociada">{p => <select {...p} className={claseCampo} value={datos.idTarea} onChange={cambiar('idTarea')}><option value="">Ninguna</option>{tareas.map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo}</option>)}</select>}</Campo>
        <Campo etiqueta="Descripción">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.descripcion} onChange={cambiar('descripcion')} />}</Campo>
        <Campo etiqueta="Criterios de aceptación" className="sm:col-span-2">{p => <textarea {...p} rows={3} className={claseCampo} value={datos.criterios} onChange={cambiar('criterios')} />}</Campo>
      </form>
    </Modal>
  );
}

function Presentar({ entregable, usuario, onPresentar, onCerrar, guardando }) {
  const [evidencias, setEvidencias] = useState([]);
  const [comentario, setComentario] = useState('');
  return (
    <Modal titulo={`Presentar ${entregable.codigo} · versión ${(entregable.presentaciones || []).length + 1}`} ancho="max-w-lg" onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="button" className={botonPrimario} disabled={guardando || !evidencias.length} onClick={async () => { if (await onPresentar({ evidencias, comentario })) onCerrar(); }}>Presentar para revisión</button></>}>
      <div className="space-y-3">
        <ListaEvidencias evidencias={evidencias} onQuitar={indice => setEvidencias(actual => actual.filter((_, i) => i !== indice))} />
        <SubirEvidencia correo={usuario?.email} onSubida={evidencia => setEvidencias(actual => [...actual, evidencia])} />
        <Campo etiqueta="Comentario para el revisor">{p => <textarea {...p} rows={3} className={claseCampo} value={comentario} onChange={evento => setComentario(evento.target.value)} />}</Campo>
        {!evidencias.length && <p className="text-[11px] text-slate-500">Adjunta al menos una evidencia.</p>}
      </div>
    </Modal>
  );
}

export default function EntregablesProyecto({ plan, cap, usuario, operar, guardando, pedirTexto, hoy }) {
  const [editando, setEditando] = useState(null);
  const [presentando, setPresentando] = useState(null);
  const entregables = [...(plan.entregables || [])].sort((a, b) => String(a.fechaComprometida).localeCompare(String(b.fechaComprometida)));
  const correo = normalizarCorreo(usuario?.email);

  const decidir = async (entregable, decision) => {
    let comentario = '';
    if (decision !== 'en_revision') {
      comentario = await pedirTexto({ titulo: `${ESTADOS_ENTREGABLE[decision]}: ${entregable.nombre}`, etiqueta: decision === 'aprobado' ? 'Comentario (opcional)' : 'Qué debe ajustarse o por qué se rechaza', obligatorio: decision !== 'aprobado', confirmar: ESTADOS_ENTREGABLE[decision], peligro: decision === 'rechazado' });
      if (comentario === null) return;
    }
    await operar('decidirEntregable', { id: entregable.id, versionBase: entregable.version, decision, comentario }, `Entregable ${ESTADOS_ENTREGABLE[decision].toLowerCase()}.`);
  };

  return (
    <div className="space-y-4">
      <Seccion titulo="Entregables" descripcion="El responsable presenta con evidencias; lo aprueba otra persona (aprobadores, patrocinador o director)."
        acciones={cap.gestionar && <button type="button" className={botonPrimario} onClick={() => setEditando('nuevo')}>＋ Nuevo entregable</button>}>
        {!entregables.length ? <EstadoVacio titulo="Sin entregables" descripcion="Define qué se entrega, quién lo hace y para cuándo." /> : (
          <div className="space-y-3">
            {entregables.map(entregable => {
              const esResponsable = normalizarCorreo(entregable.responsable) === correo;
              const ultima = (entregable.presentaciones || []).at(-1);
              const puedePresentar = (cap.gestionar || (cap.aportar && esResponsable)) && ['pendiente', 'en_elaboracion', 'requiere_ajustes'].includes(entregable.estado);
              const puedeDecidir = cap.decidir && !esResponsable && normalizarCorreo(ultima?.por) !== correo && ['presentado', 'en_revision'].includes(entregable.estado);
              const vencido = !['aprobado', 'rechazado'].includes(entregable.estado) && entregable.fechaComprometida < hoy;
              return (
                <article key={entregable.id} className="rounded-2xl border border-slate-200 p-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-800">{entregable.codigo} · {entregable.nombre}</p>
                      <p className="text-slate-500">{nombreDeCorreo(entregable.responsable)} · Comprometido {fecha(entregable.fechaComprometida)}{vencido ? ' · vencido' : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Insignia tono={vencido ? 'rojo' : TONO_ESTADO[entregable.estado]}>{ESTADOS_ENTREGABLE[entregable.estado]}</Insignia>
                      {cap.gestionar && <button type="button" className={botonSecundario} onClick={() => setEditando(entregable)}>Editar</button>}
                      {puedePresentar && <button type="button" className={botonPrimario} onClick={() => setPresentando(entregable)}>Presentar</button>}
                      {puedeDecidir && entregable.estado === 'presentado' && <button type="button" className={botonSecundario} disabled={guardando} onClick={() => decidir(entregable, 'en_revision')}>Iniciar revisión</button>}
                      {puedeDecidir && (
                        <>
                          <button type="button" className={botonPrimario} disabled={guardando} onClick={() => decidir(entregable, 'aprobado')}>Aprobar</button>
                          <button type="button" className={botonSecundario} disabled={guardando} onClick={() => decidir(entregable, 'requiere_ajustes')}>Pedir ajustes</button>
                          <button type="button" className={botonPeligro} disabled={guardando} onClick={() => decidir(entregable, 'rechazado')}>Rechazar</button>
                        </>
                      )}
                    </div>
                  </div>
                  {entregable.criterios && <p className="mt-2 whitespace-pre-line text-slate-700"><b>Criterios:</b> {entregable.criterios}</p>}
                  {((entregable.presentaciones || []).length > 0 || (entregable.revisiones || []).length > 0) && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-bold text-[#0055ff]">Versiones y revisiones ({(entregable.presentaciones || []).length} / {(entregable.revisiones || []).length})</summary>
                      <ul className="mt-2 space-y-2">
                        {[...(entregable.presentaciones || []).map(item => ({ ...item, tipo: 'presentacion' })), ...(entregable.revisiones || []).map(item => ({ ...item, tipo: 'revision' }))]
                          .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((item, indice) => (
                            <li key={indice} className="rounded-lg bg-slate-50 p-2">
                              <p className="font-bold">{item.tipo === 'presentacion' ? `Versión ${item.version} presentada` : `Revisión: ${ESTADOS_ENTREGABLE[item.decision]}`} · {nombreDeCorreo(item.por)} · {fechaHora(item.fecha)}</p>
                              {item.comentario && <p className="text-slate-700">{item.comentario}</p>}
                              {item.evidencias && <ListaEvidencias evidencias={item.evidencias} />}
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Seccion>
      {editando && <FormularioEntregable entregable={editando === 'nuevo' ? null : editando} tareas={(plan.tareas || []).filter(tarea => tarea.estado !== 'cancelada')} guardando={guardando} onCerrar={() => setEditando(null)} onGuardar={entregable => operar('guardarEntregable', { entregable }, 'Entregable guardado.')} />}
      {presentando && <Presentar entregable={presentando} usuario={usuario} guardando={guardando} onCerrar={() => setPresentando(null)} onPresentar={datos => operar('presentarEntregable', { id: presentando.id, versionBase: presentando.version, ...datos }, 'Entregable presentado para revisión.')} />}
    </div>
  );
}
