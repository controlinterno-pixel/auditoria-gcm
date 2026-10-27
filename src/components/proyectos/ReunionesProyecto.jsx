// src/components/proyectos/ReunionesProyecto.jsx - Reuniones, actas, decisiones y compromisos verificables
// (responsable, fecha límite, seguimiento y evidencia de cumplimiento).
import { ContextoGuia } from './guias.js';
import { useState } from 'react';
import { ESTADOS_COMPROMISO, normalizarCorreo } from '../../utils/proyectos/modelo.js';
import { fecha, fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, EstadoVacio, Insignia, ListaEvidencias, Modal, Seccion, SubirEvidencia, SugerenciasCorreos, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

const lineas = texto => String(texto || '').split('\n').map(item => item.trim()).filter(Boolean);

function FormularioReunion({ reunion, usuario, onGuardar, onCerrar, guardando }) {
  const [datos, setDatos] = useState(() => ({
    titulo: '', fecha: '', tipo: 'Seguimiento', acta: '', documentos: [], compromisos: [],
    ...(reunion || {}),
    asistentesTexto: (reunion?.asistentes || []).join('\n'), decisionesTexto: (reunion?.decisiones || []).join('\n'),
  }));
  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.value }));
  const cambiarCompromiso = (indice, campo) => evento => setDatos(actual => ({ ...actual, compromisos: actual.compromisos.map((item, i) => (i === indice ? { ...item, [campo]: evento.target.value } : item)) }));
  const guardar = async evento => {
    evento.preventDefault();
    const { asistentesTexto, decisionesTexto, ...resto } = datos;
    if (await onGuardar({ ...resto, asistentes: lineas(asistentesTexto), decisiones: lineas(decisionesTexto), versionBase: reunion?.version })) onCerrar();
  };
  return (
    <Modal titulo={reunion ? `Acta ${reunion.codigo}` : 'Registrar reunión'} ancho="max-w-4xl" onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="submit" form="formulario-reunion" className={botonPrimario} disabled={guardando}>Guardar acta</button></>}>
      <SugerenciasCorreos id="correos-reunion" />
      <ContextoGuia.Provider value="reunion">
      <form id="formulario-reunion" onSubmit={guardar} className="grid gap-3 sm:grid-cols-4">
        <Campo etiqueta="Título" obligatorio className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.titulo} onChange={cambiar('titulo')} />}</Campo>
        <Campo etiqueta="Fecha" obligatorio>{p => <input {...p} type="date" className={claseCampo} value={datos.fecha} onChange={cambiar('fecha')} />}</Campo>
        <Campo etiqueta="Tipo">{p => <input {...p} className={claseCampo} value={datos.tipo} onChange={cambiar('tipo')} list="tipos-reunion" />}</Campo>
        <datalist id="tipos-reunion">{['Seguimiento', 'Comité directivo', 'Planificación', 'Revisión de sprint', 'Retrospectiva', 'Cierre'].map(tipo => <option key={tipo} value={tipo} />)}</datalist>
        <Campo etiqueta="Asistentes (uno por línea)">{p => <textarea {...p} rows={4} className={claseCampo} value={datos.asistentesTexto} onChange={cambiar('asistentesTexto')} />}</Campo>
        <Campo etiqueta="Acta / temas tratados" className="sm:col-span-2">{p => <textarea {...p} rows={4} className={claseCampo} value={datos.acta} onChange={cambiar('acta')} />}</Campo>
        <Campo etiqueta="Decisiones (una por línea)">{p => <textarea {...p} rows={4} className={claseCampo} value={datos.decisionesTexto} onChange={cambiar('decisionesTexto')} />}</Campo>
        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-4">
          <legend className="px-1 text-xs font-black text-slate-700">Compromisos (responsable y fecha límite obligatorios)</legend>
          {datos.compromisos.map((compromiso, indice) => (
            <div key={compromiso.id || indice} className="mb-2 grid gap-2 sm:grid-cols-[1fr_220px_150px_auto]">
              <input aria-label="Compromiso" className={claseCampo} value={compromiso.descripcion} onChange={cambiarCompromiso(indice, 'descripcion')} />
              <input aria-label="Responsable del compromiso" list="correos-reunion" className={claseCampo} value={compromiso.responsable} onChange={cambiarCompromiso(indice, 'responsable')} />
              <input aria-label="Fecha límite" type="date" className={claseCampo} value={compromiso.fechaLimite} onChange={cambiarCompromiso(indice, 'fechaLimite')} />
              {(!compromiso.estado || compromiso.estado === 'pendiente') ? <button type="button" className="text-xs font-bold text-red-600" onClick={() => setDatos(actual => ({ ...actual, compromisos: actual.compromisos.filter((_, i) => i !== indice) }))}>Quitar</button> : <span className="self-center text-[11px] text-slate-500">Con seguimiento</span>}
            </div>
          ))}
          <button type="button" className="text-xs font-bold text-[#0055ff]" onClick={() => setDatos(actual => ({ ...actual, compromisos: [...actual.compromisos, { descripcion: '', responsable: '', fechaLimite: '' }] }))}>＋ Agregar compromiso</button>
        </fieldset>
        <div className="space-y-2 sm:col-span-4">
          <ListaEvidencias evidencias={datos.documentos} onQuitar={indice => setDatos(actual => ({ ...actual, documentos: actual.documentos.filter((_, i) => i !== indice) }))} />
          <SubirEvidencia correo={usuario?.email} onSubida={documento => setDatos(actual => ({ ...actual, documentos: [...actual.documentos, documento] }))} />
        </div>
      </form>
      </ContextoGuia.Provider>
    </Modal>
  );
}

function ActualizarCompromiso({ compromiso, usuario, puedeCancelar, onGuardar, onCerrar, guardando }) {
  const [estado, setEstado] = useState(compromiso.estado === 'pendiente' ? 'en_curso' : compromiso.estado);
  const [comentario, setComentario] = useState('');
  const [evidencia, setEvidencia] = useState(null);
  const faltaSoporte = estado === 'cumplido' && !comentario.trim() && !evidencia;
  return (
    <Modal titulo="Seguimiento del compromiso" ancho="max-w-lg" onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="button" className={botonPrimario} disabled={guardando || faltaSoporte} onClick={async () => { if (await onGuardar({ estado, comentario, evidencia: evidencia?.url || '' })) onCerrar(); }}>Guardar</button></>}>
      <p className="mb-3 text-sm font-bold text-slate-800">{compromiso.descripcion}</p>
      <ContextoGuia.Provider value="reunion">
      <div className="space-y-3">
        <Campo etiqueta="Estado">{p => <select {...p} className={claseCampo} value={estado} onChange={evento => setEstado(evento.target.value)}>{Object.entries(ESTADOS_COMPROMISO).filter(([valor]) => valor !== 'cancelado' || puedeCancelar).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
        <Campo etiqueta="Comentario" ayuda={estado === 'cumplido' ? 'Para darlo por cumplido, explica cómo se cumplió o adjunta la evidencia.' : ''}>{p => <textarea {...p} rows={3} className={claseCampo} value={comentario} onChange={evento => setComentario(evento.target.value)} />}</Campo>
        {evidencia ? <ListaEvidencias evidencias={[evidencia]} onQuitar={() => setEvidencia(null)} /> : <SubirEvidencia correo={usuario?.email} onSubida={setEvidencia} />}
      </div>
      </ContextoGuia.Provider>
    </Modal>
  );
}

export default function ReunionesProyecto({ plan, cap, usuario, operar, guardando, hoy }) {
  const [abierta, setAbierta] = useState(null);
  const [compromisoAbierto, setCompromisoAbierto] = useState(null);
  const reuniones = [...(plan.reuniones || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const correo = normalizarCorreo(usuario?.email);
  const pendientes = reuniones.flatMap(reunion => (reunion.compromisos || []).map(compromiso => ({ ...compromiso, reunion })))
    .filter(compromiso => !['cumplido', 'cancelado'].includes(compromiso.estado)).sort((a, b) => String(a.fechaLimite).localeCompare(String(b.fechaLimite)));

  return (
    <div className="space-y-4">
      <Seccion titulo="Compromisos abiertos" descripcion={`${pendientes.length} compromiso(s) por cumplir.`}>
        {!pendientes.length ? <p className="text-sm text-slate-500">No hay compromisos pendientes.</p> : (
          <ul className="divide-y divide-slate-100 text-xs">
            {pendientes.map(compromiso => {
              const vencido = compromiso.fechaLimite < hoy;
              const puedeActualizar = cap.gestionar || (cap.comentar && normalizarCorreo(compromiso.responsable) === correo);
              return (
                <li key={compromiso.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1"><b>{compromiso.descripcion}</b><span className="block text-slate-500">{nombreDeCorreo(compromiso.responsable)} · {compromiso.reunion.codigo} {compromiso.reunion.titulo}</span></span>
                  <Insignia tono={vencido ? 'rojo' : 'gris'}>{vencido ? 'Vencido ' : 'Límite '}{fecha(compromiso.fechaLimite)}</Insignia>
                  <Insignia tono={compromiso.estado === 'en_curso' ? 'azul' : 'gris'}>{ESTADOS_COMPROMISO[compromiso.estado]}</Insignia>
                  {puedeActualizar && <button type="button" className={botonSecundario} onClick={() => setCompromisoAbierto(compromiso)}>Actualizar</button>}
                </li>
              );
            })}
          </ul>
        )}
      </Seccion>
      <Seccion titulo="Reuniones y actas" acciones={cap.gestionar && <button type="button" className={botonPrimario} onClick={() => setAbierta('nueva')}>＋ Registrar reunión</button>}>
        {!reuniones.length ? <EstadoVacio titulo="Sin reuniones registradas" /> : (
          <div className="space-y-3">
            {reuniones.map(reunion => (
              <article key={reunion.id} className="rounded-2xl border border-slate-200 p-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-black text-slate-800">{reunion.codigo} · {reunion.titulo} <span className="font-normal text-slate-500">· {reunion.tipo} · {fecha(reunion.fecha)}</span></p>
                  {cap.gestionar && <button type="button" className={botonSecundario} onClick={() => setAbierta(reunion)}>Editar acta</button>}
                </div>
                {reunion.acta && <p className="mt-2 whitespace-pre-line text-slate-700">{reunion.acta}</p>}
                {(reunion.decisiones || []).length > 0 && <div className="mt-2"><b>Decisiones:</b><ul className="list-disc pl-4">{reunion.decisiones.map(decision => <li key={decision}>{decision}</li>)}</ul></div>}
                {(reunion.compromisos || []).length > 0 && (
                  <div className="mt-2"><b>Compromisos:</b>
                    <ul className="mt-1 space-y-1">{reunion.compromisos.map(compromiso => (
                      <li key={compromiso.id}>{compromiso.descripcion} · {nombreDeCorreo(compromiso.responsable)} · {fecha(compromiso.fechaLimite)} · <b>{ESTADOS_COMPROMISO[compromiso.estado]}</b>{compromiso.fechaCumplimiento ? ` el ${fecha(compromiso.fechaCumplimiento)}` : ''}
                        {(compromiso.seguimiento || []).length > 0 && <span className="block text-[11px] text-slate-500">Último seguimiento: {nombreDeCorreo(compromiso.seguimiento.at(-1).por)} · {fechaHora(compromiso.seguimiento.at(-1).fecha)}{compromiso.seguimiento.at(-1).comentario ? ` · “${compromiso.seguimiento.at(-1).comentario}”` : ''}{compromiso.seguimiento.at(-1).evidencia ? ' · con evidencia' : ''}</span>}
                      </li>
                    ))}</ul>
                  </div>
                )}
                {(reunion.asistentes || []).length > 0 && <p className="mt-2 text-slate-500">Asistentes: {reunion.asistentes.join(', ')}</p>}
                {(reunion.documentos || []).length > 0 && <div className="mt-2"><ListaEvidencias evidencias={reunion.documentos} /></div>}
              </article>
            ))}
          </div>
        )}
      </Seccion>
      {abierta && <FormularioReunion reunion={abierta === 'nueva' ? null : abierta} usuario={usuario} guardando={guardando} onCerrar={() => setAbierta(null)} onGuardar={reunion => operar('guardarReunion', { reunion }, 'Acta guardada.')} />}
      {compromisoAbierto && <ActualizarCompromiso compromiso={compromisoAbierto} usuario={usuario} puedeCancelar={cap.gestionar} guardando={guardando} onCerrar={() => setCompromisoAbierto(null)}
        onGuardar={datos => operar('actualizarCompromiso', { idReunion: compromisoAbierto.reunion.id, idCompromiso: compromisoAbierto.id, ...datos }, 'Compromiso actualizado.')} />}
    </div>
  );
}
