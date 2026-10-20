import { useMemo, useState } from 'react';
import { AlertCircle, Download, FileCheck2, Files, ListFilter, LoaderCircle } from 'lucide-react';
import { construirReporte360, fecha360, informesPorFuente360, texto360, tiposFuente360 } from '../utils/reporte360.js';

const porcentaje = valor => valor === null ? 'Sin avance registrado' : `${valor}%`;

export default function Reporte360({
  informesAuditoria = [], safeHallazgos = [], safePlanes = [], fuentesMejora = [],
  user = null, perfilUsuario = null, showNotification = () => {},
}) {
  const [modo, setModo] = useState('informe');
  const [idInforme, setIdInforme] = useState('');
  const [tiposSeleccionados, setTiposSeleccionados] = useState([]);
  const [idsInformes, setIdsInformes] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [fechaVista] = useState(() => new Date());
  const informes = useMemo(() => [...informesAuditoria].sort((a, b) => (
    String(b.fecha || '').localeCompare(String(a.fecha || '')) ||
    String(b.ref || b.id).localeCompare(String(a.ref || a.id), 'es', { numeric: true })
  )), [informesAuditoria]);
  const seleccionDisponible = informes.some(informe => String(informe.id) === idInforme);
  const tiposDisponibles = useMemo(() => tiposFuente360(informes, fuentesMejora), [informes, fuentesMejora]);
  const fuentesSeleccionadasDisponibles = tiposSeleccionados.length > 0 && tiposSeleccionados.every(tipo => tiposDisponibles.includes(tipo));
  const informesDeFuentes = useMemo(() => informesPorFuente360(informes, fuentesMejora, tiposSeleccionados), [informes, fuentesMejora, tiposSeleccionados]);
  const idsDisponibles = informesDeFuentes.map(informe => String(informe.id));
  const idsElegidos = idsInformes ?? idsDisponibles;
  const autor = [perfilUsuario?.nombreResponsable || perfilUsuario?.nombre || user?.displayName, user?.email].filter(Boolean).join(' · ');
  const reporte = useMemo(() => {
    if (modo === 'informe' && !seleccionDisponible) return null;
    if (modo === 'fuentes' && (
      !fuentesSeleccionadasDisponibles || (idsInformes !== null && (
        !idsInformes.length || idsInformes.some(id => !informesDeFuentes.some(informe => String(informe.id) === id))
      ))
    )) return null;
    return construirReporte360({
      informes, hallazgos: safeHallazgos, planes: safePlanes, fuentes: fuentesMejora,
      modo, idInforme, tiposFuente: tiposSeleccionados, idsInformes, generadoEn: fechaVista, generadoPor: autor,
    });
  }, [informes, safeHallazgos, safePlanes, fuentesMejora, modo, idInforme, tiposSeleccionados, idsInformes, fuentesSeleccionadasDisponibles, informesDeFuentes, seleccionDisponible, fechaVista, autor]);
  const cambiarAlcance = nuevoModo => {
    setModo(nuevoModo);
    setError('');
    setConfirmacion('');
  };
  const descargar = async event => {
    event.preventDefault();
    if (generando) return;
    setError('');
    setConfirmacion('');
    setGenerando(true);
    try {
      const corte = construirReporte360({
        informes, hallazgos: safeHallazgos, planes: safePlanes, fuentes: fuentesMejora,
        modo, idInforme, tiposFuente: tiposSeleccionados, idsInformes, generadoPor: autor,
      });
      const { descargarReporte360 } = await import('../services/reporte360Pdf.js');
      const nombre = await descargarReporte360(corte);
      setConfirmacion(`PDF generado: ${nombre}`);
      showNotification('Reporte 360 generado. Revisa las descargas de tu navegador.');
    } catch (err) {
      console.error('[Reporte360] No se pudo generar el PDF:', err);
      const mensaje = err.message || 'No se pudo generar el Reporte 360. Reintenta la descarga.';
      setError(mensaje);
      showNotification(mensaje, 'error');
    } finally {
      setGenerando(false);
    }
  };
  const hayContenido = Boolean(reporte?.expedientes.length);

  return (
    <section className="space-y-6 text-slate-800 selection:bg-emerald-100 selection:text-emerald-950" aria-labelledby="reporte360-titulo">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 id="reporte360-titulo" className="text-3xl font-semibold tracking-tight text-[#0A3B32]">Reporte 360</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Del informe emitido al cierre de sus acciones. Un expediente ejecutivo con avances, evaluaciones y trazabilidad documental.</p>
        </div>
        <img src={`${import.meta.env.BASE_URL}logo_termales.png`} alt="Termales Santa Rosa de Cabal" className="h-24 w-28 shrink-0 object-contain self-start sm:self-center" />
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <form onSubmit={descargar} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <fieldset disabled={generando}>
            <legend className="text-base font-semibold text-[#0A3B32]">Elige el alcance del PDF</legend>
            <div className="mt-4 space-y-3">
              {[
                { valor: 'informe', titulo: 'Por informe emitido', descripcion: 'Su fuente, hallazgos, acciones y evaluaciones.', Icono: FileCheck2 },
                { valor: 'fuentes', titulo: 'Por tipos de fuente', descripcion: 'Uno o varios tipos de fuente de mejora en un PDF consolidado.', Icono: ListFilter },
                { valor: 'general', titulo: 'General con todo', descripcion: 'Todos los informes, hallazgos y acciones disponibles para tu usuario.', Icono: Files },
              ].map(({ valor, titulo, descripcion, Icono }) => (
                <label key={valor} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${modo === valor ? 'border-[#0A3B32] bg-emerald-50/60' : 'border-slate-200 hover:border-slate-400'} ${generando ? 'cursor-wait opacity-70' : ''}`}>
                  <input type="radio" name="alcance360" value={valor} checked={modo === valor} onChange={() => cambiarAlcance(valor)} className="mt-1 h-4 w-4 shrink-0 accent-[#0A3B32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold"><Icono size={17} aria-hidden="true" />{titulo}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">{descripcion}</span>
                  </span>
                </label>
              ))}
            </div>
            {modo === 'informe' && (
              <div className="mt-5">
                <label htmlFor="informe-reporte360" className="mb-2 block text-sm font-semibold">Informe emitido</label>
                <select
                  id="informe-reporte360"
                  value={seleccionDisponible ? idInforme : ''}
                  onChange={event => { setIdInforme(event.target.value); setError(''); setConfirmacion(''); }}
                  required
                  className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  <option value="">Selecciona un informe</option>
                  {informes.map(informe => <option key={informe.id} value={informe.id}>[{informe.ref || informe.id}] {informe.titulo || 'Sin título'} · {fecha360(informe.fecha)}</option>)}
                </select>
                {informes.length === 0 && <p className="mt-2 text-xs text-slate-600">No hay informes disponibles. El general permite revisar registros sin un informe vinculado.</p>}
              </div>
            )}
            {modo === 'fuentes' && (
              <fieldset className="mt-5" aria-describedby="fuentes-reporte360-ayuda">
                <legend className="text-sm font-semibold">Tipos de fuente de mejora</legend>
                <p id="fuentes-reporte360-ayuda" className="mt-2 text-xs leading-relaxed text-slate-600">Marca uno o varios tipos y luego elige sus informes. Puedes incluir uno, varios o todos. Los registros sin informe verificable quedan en General con todo.</p>
                <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                  {tiposDisponibles.map(tipo => (
                    <label key={tipo} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={tiposSeleccionados.includes(tipo)} onChange={event => {
                        setTiposSeleccionados(actual => event.target.checked ? [...actual, tipo] : actual.filter(item => item !== tipo));
                        setIdsInformes(null);
                        setError('');
                        setConfirmacion('');
                      }} className="h-4 w-4 shrink-0 accent-[#0A3B32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" />
                      <span className="min-w-0 break-words">{tipo}</span>
                    </label>
                  ))}
                </div>
                {!tiposDisponibles.length && <p className="mt-2 text-xs text-slate-600">No hay tipos de fuente asociados a informes disponibles.</p>}
                {tiposSeleccionados.some(tipo => !tiposDisponibles.includes(tipo)) && <p role="alert" className="mt-2 text-xs text-amber-800">Un tipo seleccionado ya no está disponible. Vuelve a seleccionar los tipos para continuar.</p>}
                <button type="button" onClick={() => { setTiposSeleccionados([]); setIdsInformes(null); setError(''); setConfirmacion(''); }} disabled={!tiposSeleccionados.length} className="mt-2 min-h-11 rounded px-2 text-xs font-semibold text-[#0A3B32] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:text-slate-500">Limpiar selección</button>
                {fuentesSeleccionadasDisponibles && (
                  <fieldset className="mt-4 min-w-0 border-t border-slate-200 pt-4">
                    <legend className="text-sm font-semibold text-[#0A3B32]">Informes asociados</legend>
                    <p role="status" className="mt-2 text-xs text-slate-600">
                      {idsElegidos.filter(id => idsDisponibles.includes(id)).length} de {informesDeFuentes.length} informes seleccionados
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">Al cambiar los tipos de fuente se seleccionan todos sus informes. Desmarca los que no quieras incluir.</p>
                    <div className="mt-2 flex flex-wrap gap-x-4">
                      <button type="button" onClick={() => { setIdsInformes(null); setError(''); setConfirmacion(''); }} className="min-h-11 rounded text-xs font-semibold text-[#0A3B32] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">Seleccionar todos los informes</button>
                      <button type="button" onClick={() => { setIdsInformes([]); setError(''); setConfirmacion(''); }} disabled={!idsElegidos.length} className="min-h-11 rounded text-xs font-semibold text-[#0A3B32] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:text-slate-500">Limpiar informes</button>
                    </div>
                    <div className="mt-2 max-h-80 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200">
                      {informesDeFuentes.map(informe => (
                        <label key={informe.id} className={`flex min-h-11 cursor-pointer items-start gap-3 p-3 ${idsElegidos.includes(String(informe.id)) ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={idsElegidos.includes(String(informe.id))} onChange={event => {
                            const seleccionado = event.target.checked;
                            setIdsInformes(actual => seleccionado
                              ? [...(actual ?? idsDisponibles), String(informe.id)]
                              : (actual ?? idsDisponibles).filter(id => id !== String(informe.id)));
                            setError('');
                            setConfirmacion('');
                          }} className="mt-1 h-4 w-4 shrink-0 accent-[#0A3B32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" />
                          <span className="min-w-0 break-words text-sm">
                            <span className="block font-semibold text-[#0A3B32]">{informe.ref || informe.id}</span>
                            <span className="mt-1 block">{informe.titulo || 'Sin título'}</span>
                            <span className="mt-1 block text-xs text-slate-600">{fecha360(informe.fecha)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {!idsElegidos.length && <p className="mt-3 text-xs text-slate-600">Selecciona al menos un informe para habilitar la descarga.</p>}
                    {idsElegidos.some(id => !idsDisponibles.includes(id)) && <p role="alert" className="mt-3 text-xs text-amber-800">Un informe seleccionado ya no está disponible. Actualiza la selección o selecciona todos para continuar.</p>}
                  </fieldset>
                )}
              </fieldset>
            )}
          </fieldset>
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold">Contenido del documento</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
              <li>Síntesis ejecutiva y mapa de compromisos.</li>
              <li>Informe, fuente y hallazgos, incluso sin acciones.</li>
              <li>Avances, estados, fechas y responsables de cada acción.</li>
              <li>Evaluación integral o de eficacia, según la fuente.</li>
              <li>Evidencias enlazadas e historial de cambios.</li>
            </ul>
            <button type="submit" disabled={!hayContenido || generando} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0A3B32] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#145547] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600">
              {generando ? <LoaderCircle size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Download size={18} aria-hidden="true" />}
              {generando ? 'Generando PDF…' : 'Descargar Reporte 360'}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">El PDF refleja los registros disponibles al descargar. No modifica estados ni envía correos.</p>
          </div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <p role="status" className={confirmacion ? 'mt-4 break-words text-xs text-emerald-800' : 'sr-only'}>{confirmacion || (generando ? 'Preparando el documento ejecutivo.' : '')}</p>
        </form>

        <section aria-labelledby="reporte360-alcance" className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <h3 id="reporte360-alcance" className="text-lg font-semibold text-[#0A3B32]">Alcance del reporte</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Avance de ejecución y cierre aprobado se presentan por separado.</p>
          </div>
          {!reporte ? (
            <div className="px-6 py-12">
              <FileCheck2 size={30} className="text-[#3e6570]" aria-hidden="true" />
              <h4 className="mt-4 text-base font-semibold">{modo === 'fuentes' ? fuentesSeleccionadasDisponibles ? 'Selecciona los informes que vas a incluir' : 'Selecciona los tipos de fuente que vas a consolidar' : 'Selecciona el informe que vas a presentar'}</h4>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">Aquí verás su cobertura antes de descargar. Para una lectura completa de la gestión, elige General con todo.</p>
            </div>
          ) : !hayContenido ? (
            <p className="px-6 py-12 text-sm leading-relaxed text-slate-600">No hay informes, hallazgos ni acciones disponibles en esta sesión para construir el reporte.</p>
          ) : (
            <div className="space-y-6 p-5 sm:p-6">
              {modo === 'fuentes' && <p className="break-words text-sm text-slate-600"><strong>Tipos consolidados: </strong>{reporte.tiposFuente.join(', ')}</p>}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                {[
                  ['Informes', reporte.resumen.informes],
                  ['Hallazgos', reporte.resumen.hallazgos],
                  ['Acciones', reporte.resumen.acciones],
                  ['Acciones cerradas', reporte.resumen.cerradas],
                  ['Acciones abiertas', reporte.resumen.abiertas],
                  ['Vencidas sin cierre', reporte.resumen.vencidas],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="border-b border-slate-100 pb-3">
                    <dt className="text-xs text-slate-600">{etiqueta}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-[#0A3B32]">{valor}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium">Avance de ejecución promedio</span>
                <strong className="text-base tabular-nums text-[#0A3B32]">{porcentaje(reporte.resumen.avance)}</strong>
                {reporte.resumen.sinAvance > 0 && <p className="w-full text-xs text-slate-600">{reporte.resumen.sinAvance} acción(es) sin avance válido, excluidas del promedio.</p>}
              </div>
              <div className="space-y-3">
                {reporte.expedientes.map(grupo => (
                  <details key={grupo.clave} className="border-b border-slate-200 pb-3">
                    <summary className="min-h-11 cursor-pointer rounded text-sm font-semibold text-[#0A3B32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                      {grupo.referencia} · {grupo.titulo}
                      <span className="mt-1 block pl-4 text-xs font-normal text-slate-600">{grupo.resumen.hallazgos} hallazgos · {grupo.resumen.acciones} acciones · {grupo.resumen.cerradas} cerradas</span>
                    </summary>
                    <div className="mt-3 space-y-3 pl-4 text-xs leading-relaxed">
                      <p><strong>Fuente: </strong>{grupo.tipoFuente}</p>
                      <p><strong>Evaluación: </strong>{grupo.esPrograma === null ? 'Origen sin verificar' : grupo.esPrograma ? 'Integral del paquete (Programa de Auditoría)' : 'Eficacia por acción (otras fuentes)'}</p>
                      {grupo.hallazgos.map(hallazgo => (
                        <div key={hallazgo.registro.id} className="border-t border-slate-100 pt-3">
                          <p className="font-semibold">{hallazgo.referencia} · {texto360(hallazgo.registro.estado)}</p>
                          <p className="mt-1 text-slate-600">{texto360(hallazgo.registro.titulo)}</p>
                          {hallazgo.planes.length ? (
                            <ul className="mt-2 space-y-2">
                              {hallazgo.planes.map(plan => <li key={plan.registro.id} className="break-words text-slate-600"><strong className="text-slate-800">{plan.referencia}</strong> · {plan.cerrado ? 'Cerrada' : 'Abierta'} · {porcentaje(plan.avance)} · {plan.evaluacion.resultado}<br />{texto360(plan.registro.responsable)} · Límite: {fecha360(plan.registro.fecha)}</li>)}
                            </ul>
                          ) : <p className="mt-2 text-amber-800">Sin acciones vinculadas disponibles.</p>}
                        </div>
                      ))}
                      {grupo.planesSinHallazgo.length > 0 && <p className="text-amber-800">{grupo.planesSinHallazgo.length} acción(es) sin hallazgo disponible se incluirán en el PDF.</p>}
                    </div>
                  </details>
                ))}
              </div>
              {reporte.incidencias.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-4 text-amber-950">
                  <p className="flex items-center gap-2 text-sm font-semibold"><AlertCircle size={17} aria-hidden="true" />{reporte.incidencias.length} observaciones de integridad</p>
                  <p className="mt-2 text-xs leading-relaxed">Se incluirán en el PDF los vínculos faltantes y datos que requieren validación; no se ocultarán registros.</p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800">Ver observaciones</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4">{reporte.incidencias.map((incidencia, indice) => <li key={indice}>{incidencia}</li>)}</ul>
                  </details>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
