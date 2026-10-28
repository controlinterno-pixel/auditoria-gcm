// src/components/proyectos/AvanceSitio.jsx - Línea de tiempo de reportes fotográficos del avance en sitio
// (obra, montaje, adecuaciones). Los suben el director y las personas de "Reportan avance en sitio".
import { useMemo, useState } from 'react';
import { ContextoGuia } from './guias.js';
import { apiService } from '../../services/apiService';
import { useCatalogos } from '../../context/useCatalogos';
import { TIPOS_CONTENEDOR } from '../../utils/proyectos/modelo.js';
import { fecha, fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, EstadoVacio, Insignia, Modal, Seccion, botonPeligro, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

const MAX_FOTOS = 12;
const vacio = hoy => ({ fecha: hoy, titulo: '', frente: '', idTarea: '', avanceFisico: '', descripcion: '', fotos: [] });

function SubirFotos({ fotos, onCambio, correo }) {
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState('');
  const subir = async evento => {
    const archivos = [...(evento.target.files || [])].slice(0, MAX_FOTOS - fotos.length);
    evento.target.value = '';
    if (!archivos.length) return;
    setError('');
    let acumuladas = [...fotos];
    try {
      for (const [indice, archivo] of archivos.entries()) {
        if (!archivo.type?.startsWith('image/')) throw new Error(`"${archivo.name}" no es una imagen.`);
        setProgreso(`${indice + 1} de ${archivos.length}`);
        const resultado = await apiService.subirEvidencia(archivo, { comprimirFoto: true });
        if (!resultado?.url) throw new Error('El servidor de archivos no devolvió el enlace.');
        acumuladas = [...acumuladas, { url: resultado.url, nombre: resultado.fileName || archivo.name, subidoPor: correo, fecha: new Date().toISOString() }];
        onCambio(acumuladas);
      }
    } catch (falla) {
      setError(falla?.message || 'No se pudo subir la foto.');
    } finally {
      setProgreso(null);
    }
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((foto, indice) => (
          <div key={foto.url} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            <img src={foto.url} alt={foto.nombre} className="h-full w-full object-cover" loading="lazy" />
            <button type="button" onClick={() => onCambio(fotos.filter((_, i) => i !== indice))} className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 text-xs font-black text-red-600" aria-label={`Quitar ${foto.nombre}`}>✕</button>
          </div>
        ))}
      </div>
      {fotos.length < MAX_FOTOS && (
        <label className={`${botonSecundario} mt-2 cursor-pointer ${progreso ? 'pointer-events-none opacity-50' : ''}`}>
          📷 {progreso ? `Subiendo foto ${progreso}…` : fotos.length ? 'Agregar más fotos' : 'Tomar o elegir fotos'}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={Boolean(progreso)} onChange={subir} />
        </label>
      )}
      <p className="mt-1 text-[11px] text-slate-500">Hasta {MAX_FOTOS} fotos por reporte. Se reducen automáticamente para que carguen rápido.</p>
      {error && <p role="alert" className="mt-1 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

function FormularioReporte({ hoy, tareas, frentes, usuario, guardando, onGuardar, onCerrar }) {
  const [datos, setDatos] = useState(() => vacio(hoy));
  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.value }));
  const listo = datos.titulo.trim() && datos.fecha && datos.fotos.length > 0;
  return (
    <Modal titulo="Reportar avance en sitio" onCerrar={onCerrar} pie={<>
      <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
      <button type="submit" form="formulario-avance-sitio" className={botonPrimario} disabled={guardando || !listo}>Publicar reporte</button>
    </>}>
      <ContextoGuia.Provider value="avanceSitio">
        <form id="formulario-avance-sitio" className="grid gap-3 sm:grid-cols-2" onSubmit={evento => { evento.preventDefault(); if (listo) onGuardar({ ...datos, avanceFisico: datos.avanceFisico === '' ? null : Number(datos.avanceFisico) }); }}>
          <Campo etiqueta="Fecha de las fotos" obligatorio>{p => <input {...p} type="date" max={hoy} className={claseCampo} value={datos.fecha} onChange={cambiar('fecha')} />}</Campo>
          <Campo etiqueta="Frente de obra o zona">{p => (
            <>
              <input {...p} list="frentes-avance" className={claseCampo} value={datos.frente} onChange={cambiar('frente')} placeholder="Ej. Estación 3, tramo norte" />
              <datalist id="frentes-avance">{frentes.map(frente => <option key={frente} value={frente} />)}</datalist>
            </>
          )}</Campo>
          <Campo etiqueta="Qué muestra el reporte" obligatorio className="sm:col-span-2">{p => <input {...p} maxLength={120} className={claseCampo} value={datos.titulo} onChange={cambiar('titulo')} placeholder="Ej. Vaciado de la placa del mirador" />}</Campo>
          <Campo etiqueta="Actividad del cronograma">{p => (
            <select {...p} className={claseCampo} value={datos.idTarea} onChange={cambiar('idTarea')}>
              <option value="">Sin vincular</option>
              {tareas.map(tarea => <option key={tarea.id} value={tarea.id}>{tarea.codigo} · {tarea.titulo}</option>)}
            </select>
          )}</Campo>
          <Campo etiqueta="Avance físico observado (%)">{p => <input {...p} type="number" min="0" max="100" step="1" className={claseCampo} value={datos.avanceFisico} onChange={cambiar('avanceFisico')} />}</Campo>
          <Campo etiqueta="Descripción" className="sm:col-span-2">{p => <textarea {...p} rows={3} className={claseCampo} value={datos.descripcion} onChange={cambiar('descripcion')} placeholder="Qué se hizo, novedades, clima, personal en sitio…" />}</Campo>
          <Campo etiqueta="Fotos" obligatorio className="sm:col-span-2">{() => <SubirFotos fotos={datos.fotos} correo={usuario?.email} onCambio={fotos => setDatos(actual => ({ ...actual, fotos }))} />}</Campo>
        </form>
      </ContextoGuia.Provider>
    </Modal>
  );
}

/** Foto en grande con anterior/siguiente dentro del mismo reporte. */
function VisorFotos({ reporte, indice, onCambiar, onCerrar }) {
  const foto = reporte.fotos[indice];
  const total = reporte.fotos.length;
  return (
    <Modal titulo={`${reporte.codigo} · ${reporte.titulo}`} onCerrar={onCerrar} ancho="max-w-5xl" pie={<>
      <a href={foto.url} target="_blank" rel="noopener noreferrer" className={botonSecundario}>Abrir original</a>
      {total > 1 && <button type="button" className={botonSecundario} onClick={() => onCambiar((indice - 1 + total) % total)}>← Anterior</button>}
      {total > 1 && <button type="button" className={botonPrimario} onClick={() => onCambiar((indice + 1) % total)}>Siguiente →</button>}
    </>}>
      <img src={foto.url} alt={`${reporte.titulo} (${indice + 1} de ${total})`} className="mx-auto max-h-[65vh] w-auto rounded-lg object-contain" />
      <p className="mt-2 text-center text-xs text-slate-500">Foto {indice + 1} de {total} · {fecha(reporte.fecha)}{reporte.frente ? ` · ${reporte.frente}` : ''}</p>
    </Modal>
  );
}

export default function AvanceSitio({ proyecto, plan, cap, usuario, operar, guardando, pedirTexto, hoy }) {
  const { catalogoCargos = [] } = useCatalogos();
  const [formulario, setFormulario] = useState(false);
  const [visor, setVisor] = useState(null);
  const [frente, setFrente] = useState('');
  const [verOcultos, setVerOcultos] = useState(false);
  const tareas = useMemo(() => (plan.tareas || []).filter(tarea => tarea.estado !== 'cancelada' && !TIPOS_CONTENEDOR.includes(tarea.tipo)), [plan.tareas]);
  const todos = useMemo(() => [...(plan.avancesSitio || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creadoEn).localeCompare(String(a.creadoEn))), [plan.avancesSitio]);
  const frentes = [...new Set(todos.map(reporte => reporte.frente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const visibles = todos.filter(reporte => (verOcultos || !reporte.oculto) && (!frente || reporte.frente === frente));
  const ocultos = todos.filter(reporte => reporte.oculto).length;
  const quien = correo => catalogoCargos.find(item => String(item?.correoCorporativo || '').toLowerCase() === String(correo || '').toLowerCase())?.cargo || nombreDeCorreo(correo);
  const tareaDe = id => (plan.tareas || []).find(tarea => String(tarea.id) === String(id));
  const autorizados = (proyecto.miembros?.reportanAvance || []).length;

  // Agrupado por mes para leer la obra como una línea de tiempo.
  const porMes = visibles.reduce((grupos, reporte) => {
    const mes = String(reporte.fecha).slice(0, 7);
    (grupos.get(mes) || grupos.set(mes, []).get(mes)).push(reporte);
    return grupos;
  }, new Map());
  const nombreMes = mes => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const publicar = async datos => {
    if (await operar('registrarAvanceSitio', { reporte: datos }, 'Reporte de avance publicado.')) setFormulario(false);
  };
  const ocultar = async reporte => {
    const motivo = await pedirTexto({ titulo: `Ocultar ${reporte.codigo}`, etiqueta: 'Motivo (queda en el historial; mínimo 10 caracteres)', confirmar: 'Ocultar', peligro: true });
    if (motivo) await operar('ocultarAvanceSitio', { id: reporte.id, versionBase: reporte.version, motivo }, 'Reporte ocultado.');
  };

  return (
    <div className="space-y-4">
      <Seccion titulo="Avance en sitio" descripcion={todos.length
        ? `${todos.length - ocultos} reportes publicados · último del ${fecha(todos.find(reporte => !reporte.oculto)?.fecha)}${autorizados ? ` · ${autorizados} persona(s) autorizada(s) para reportar` : ''}.`
        : 'Fotos fechadas de cómo va el proyecto en sitio, publicadas por el director y las personas autorizadas en la ficha.'}
      acciones={cap.reportarAvance && <button type="button" className={botonPrimario} onClick={() => setFormulario(true)}>📷 Reportar avance</button>}>
        {(frentes.length > 0 || (cap.gestionar && ocultos > 0)) && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            {frentes.length > 0 && (
              <Campo etiqueta="Frente de obra">{p => (
                <select {...p} className={claseCampo} value={frente} onChange={evento => setFrente(evento.target.value)}>
                  <option value="">Todos ({todos.filter(reporte => !reporte.oculto).length})</option>
                  {frentes.map(nombre => <option key={nombre} value={nombre}>{nombre} ({todos.filter(reporte => reporte.frente === nombre && !reporte.oculto).length})</option>)}
                </select>
              )}</Campo>
            )}
            {cap.gestionar && ocultos > 0 && <label className="flex items-center gap-2 pb-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={verOcultos} onChange={evento => setVerOcultos(evento.target.checked)} /> Ver ocultos ({ocultos})</label>}
          </div>
        )}
        {!visibles.length ? (
          <EstadoVacio titulo="Sin reportes de avance" descripcion={cap.reportarAvance
            ? 'Publica el primero con "Reportar avance": fotos fechadas de lo que se ve en sitio.'
            : 'Aún no hay fotos. Las suben el director y las personas que él autorice en la ficha ("Reportan avance en sitio").'} />
        ) : (
          <div className="space-y-6">
            {[...porMes.entries()].map(([mes, reportes]) => (
              <section key={mes}>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">{nombreMes(mes)}</h3>
                <ol className="relative space-y-4 border-l-2 border-[#0055ff]/20 pl-5">
                  {reportes.map(reporte => {
                    const tarea = tareaDe(reporte.idTarea);
                    return (
                      <li key={reporte.id} className={`relative ${reporte.oculto ? 'opacity-60' : ''}`}>
                        <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#0055ff] shadow" aria-hidden="true" />
                        <article className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black text-[#0055ff]">{fecha(reporte.fecha)} · {reporte.codigo}</p>
                              <h4 className="text-sm font-black text-slate-800 [overflow-wrap:anywhere]">{reporte.titulo}</h4>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {reporte.frente && <Insignia>{reporte.frente}</Insignia>}
                              {reporte.avanceFisico !== null && reporte.avanceFisico !== undefined && <Insignia tono="azul">{reporte.avanceFisico} % físico</Insignia>}
                              {reporte.oculto && <Insignia tono="rojo">Oculto</Insignia>}
                            </div>
                          </div>
                          {tarea && <p className="mt-1 text-xs text-slate-600">Actividad: <b>{tarea.codigo} {tarea.titulo}</b>{tarea.tipo !== 'hito' ? ` · ${tarea.avance ?? 0} % registrado en el cronograma` : ''}</p>}
                          {reporte.descripcion && <p className="mt-1 whitespace-pre-line text-xs text-slate-700">{reporte.descripcion}</p>}
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {reporte.fotos.map((foto, indice) => (
                              <button key={foto.url} type="button" onClick={() => setVisor({ reporte, indice })} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100" aria-label={`Ver foto ${indice + 1} de ${reporte.titulo}`}>
                                <img src={foto.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                              </button>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>Reportó {quien(reporte.reportadoPor)} · {fechaHora(reporte.creadoEn)}</span>
                            {cap.gestionar && !reporte.oculto && <button type="button" className={botonPeligro} disabled={guardando} onClick={() => ocultar(reporte)}>Ocultar</button>}
                          </div>
                          {reporte.oculto && <p className="mt-1 text-[11px] font-bold text-red-700">Ocultado por {quien(reporte.oculto.por)} el {fechaHora(reporte.oculto.fecha)}: {reporte.oculto.motivo}</p>}
                        </article>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Seccion>
      {formulario && <FormularioReporte hoy={hoy} tareas={tareas} frentes={frentes} usuario={usuario} guardando={guardando} onGuardar={publicar} onCerrar={() => setFormulario(false)} />}
      {visor && <VisorFotos reporte={visor.reporte} indice={visor.indice} onCambiar={indice => setVisor(actual => ({ ...actual, indice }))} onCerrar={() => setVisor(null)} />}
    </div>
  );
}
