// src/components/proyectos/RiesgosProyecto.jsx - Riesgos, problemas, incidencias, bloqueos y dependencias
// externas, con matriz 5×5, acciones de tratamiento, riesgo residual y vínculo opcional a la matriz de la app.
import { useMemo, useState } from 'react';
import { ESTADOS_RIESGO, NATURALEZAS_RIESGO, RESPUESTAS_OPORTUNIDAD, RESPUESTAS_RIESGO, TIPOS_RIESGO, UMBRALES_POR_DEFECTO, nivelRiesgo, prioridadRiesgo } from '../../utils/proyectos/modelo.js';
import { fecha, moneda, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, EstadoVacio, Insignia, ListaEvidencias, Modal, Seccion, SubirEvidencia, SugerenciasCorreos, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

const ESCALA = [1, 2, 3, 4, 5];
const colorNivel = (nivel, critico) => (nivel === null ? 'bg-slate-100' : nivel >= critico ? 'bg-red-500 text-white' : nivel >= 8 ? 'bg-amber-300' : 'bg-emerald-200');

function FormularioRiesgo({ riesgo, plan, usuario, riesgosMatriz = [], onGuardar, onCerrar, guardando }) {
  const [datos, setDatos] = useState(() => ({ tipo: 'riesgo', descripcion: '', causa: '', evento: '', consecuencia: '', probabilidad: '', impacto: '', responsable: '', controles: '', respuesta: '', fechaLimite: '', probabilidadResidual: '', impactoResidual: '', estado: 'abierto', idRiesgoMatriz: '', idTarea: '', acciones: [], evidencias: [], naturaleza: 'amenaza', costoContingencia: '', disparador: '', indicadorMonitoreo: '', ...(riesgo || {}) }));
  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.value }));
  const nivel = nivelRiesgo(datos.probabilidad, datos.impacto);
  const esRiesgo = datos.tipo === 'riesgo';
  const escala = (campo, etiqueta) => <Campo etiqueta={etiqueta} obligatorio={esRiesgo && !campo.endsWith('Residual')}>{p => <select {...p} className={claseCampo} value={datos[campo] ?? ''} onChange={cambiar(campo)}><option value="">—</option>{ESCALA.map(valor => <option key={valor} value={valor}>{valor}</option>)}</select>}</Campo>;
  return (
    <Modal titulo={riesgo ? `${riesgo.codigo} · ${TIPOS_RIESGO[riesgo.tipo]}` : 'Nuevo riesgo o incidencia'} ancho="max-w-4xl" onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="submit" form="formulario-riesgo" className={botonPrimario} disabled={guardando}>Guardar</button></>}>
      <SugerenciasCorreos id="correos-riesgo" />
      <form id="formulario-riesgo" className="grid gap-3 sm:grid-cols-4" onSubmit={async evento => { evento.preventDefault(); if (await onGuardar({ ...datos, versionBase: riesgo?.version })) onCerrar(); }}>
        <Campo etiqueta="Categoría" obligatorio>{p => <select {...p} className={claseCampo} value={datos.tipo} onChange={cambiar('tipo')} disabled={Boolean(riesgo)}>{Object.entries(TIPOS_RIESGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
        <Campo etiqueta="Estado">{p => <select {...p} className={claseCampo} value={datos.estado} onChange={cambiar('estado')}>{Object.entries(ESTADOS_RIESGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
        <Campo etiqueta="Responsable">{p => <input {...p} list="correos-riesgo" className={claseCampo} value={datos.responsable} onChange={cambiar('responsable')} />}</Campo>
        <Campo etiqueta="Fecha límite">{p => <input {...p} type="date" className={claseCampo} value={datos.fechaLimite} onChange={cambiar('fechaLimite')} />}</Campo>
        <Campo etiqueta="Descripción" obligatorio className="sm:col-span-4">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.descripcion} onChange={cambiar('descripcion')} />}</Campo>
        {esRiesgo && (
          <>
            <Campo etiqueta="Causa" className="sm:col-span-2">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.causa} onChange={cambiar('causa')} />}</Campo>
            <Campo etiqueta="Evento de riesgo" className="sm:col-span-2">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.evento} onChange={cambiar('evento')} />}</Campo>
          </>
        )}
        <Campo etiqueta="Consecuencia" className="sm:col-span-2">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.consecuencia} onChange={cambiar('consecuencia')} />}</Campo>
        <Campo etiqueta="Controles existentes" className="sm:col-span-2">{p => <textarea {...p} rows={2} className={claseCampo} value={datos.controles} onChange={cambiar('controles')} />}</Campo>
        {esRiesgo && (
          <>
            {escala('probabilidad', 'Probabilidad (1–5)')}
            {escala('impacto', 'Impacto (1–5)')}
            <div className="flex items-end"><p className="text-sm font-bold">Nivel inherente: <span className={`rounded px-2 py-1 ${colorNivel(nivel, UMBRALES_POR_DEFECTO.nivelRiesgoCritico)}`}>{nivel ?? '—'}</span>{nivel !== null && <span className="ml-2 text-xs text-slate-500">Prioridad {prioridadRiesgo(nivel)}</span>}</p></div>
            <Campo etiqueta="Respuesta prevista">{p => <select {...p} className={claseCampo} value={datos.respuesta} onChange={cambiar('respuesta')}><option value="">—</option>{Object.entries(datos.naturaleza === 'oportunidad' ? RESPUESTAS_OPORTUNIDAD : RESPUESTAS_RIESGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
            <Campo etiqueta="Amenaza u oportunidad">{p => <select {...p} className={claseCampo} value={datos.naturaleza} onChange={evento => setDatos(actual => ({ ...actual, naturaleza: evento.target.value, respuesta: '' }))}>{Object.entries(NATURALEZAS_RIESGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
            <Campo etiqueta="Costo de contingencia">{p => <input {...p} type="number" min="0" className={claseCampo} value={datos.costoContingencia ?? ''} onChange={cambiar('costoContingencia')} />}</Campo>
            <Campo etiqueta="Disparador (indicador de activación)" className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.disparador || ''} onChange={cambiar('disparador')} />}</Campo>
            <Campo etiqueta="Indicador de monitoreo (KPI)" className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.indicadorMonitoreo || ''} onChange={cambiar('indicadorMonitoreo')} />}</Campo>
            {escala('probabilidadResidual', 'Probabilidad residual')}
            {escala('impactoResidual', 'Impacto residual')}
            <Campo etiqueta="Vincular a la matriz de riesgos de GCM" className="sm:col-span-2" ayuda="Solo referencia: no copia ni modifica el riesgo de la matriz.">
              {p => <select {...p} className={claseCampo} value={datos.idRiesgoMatriz} onChange={cambiar('idRiesgoMatriz')}><option value="">Sin vínculo</option>{riesgosMatriz.map(r => <option key={r.id} value={r.id}>{r.codigo || r.id} · {String(r.descripcion || r.nombre || r.riesgo || '').slice(0, 70)}</option>)}</select>}
            </Campo>
          </>
        )}
        <Campo etiqueta="Tarea relacionada" className="sm:col-span-2">{p => <select {...p} className={claseCampo} value={datos.idTarea} onChange={cambiar('idTarea')}><option value="">Ninguna</option>{(plan.tareas || []).map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo}</option>)}</select>}</Campo>
        <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-4">
          <legend className="px-1 text-xs font-black text-slate-700">Acciones de tratamiento</legend>
          {datos.acciones.map((accion, indice) => (
            <div key={accion.id || indice} className="mb-2 grid gap-2 sm:grid-cols-[1fr_200px_140px_auto_auto]">
              <input aria-label="Acción" className={claseCampo} value={accion.descripcion} onChange={evento => setDatos(actual => ({ ...actual, acciones: actual.acciones.map((item, i) => (i === indice ? { ...item, descripcion: evento.target.value } : item)) }))} />
              <input aria-label="Responsable de la acción" list="correos-riesgo" className={claseCampo} value={accion.responsable} onChange={evento => setDatos(actual => ({ ...actual, acciones: actual.acciones.map((item, i) => (i === indice ? { ...item, responsable: evento.target.value } : item)) }))} />
              <input aria-label="Fecha límite de la acción" type="date" className={claseCampo} value={accion.fechaLimite} onChange={evento => setDatos(actual => ({ ...actual, acciones: actual.acciones.map((item, i) => (i === indice ? { ...item, fechaLimite: evento.target.value } : item)) }))} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={accion.cumplida} onChange={evento => setDatos(actual => ({ ...actual, acciones: actual.acciones.map((item, i) => (i === indice ? { ...item, cumplida: evento.target.checked } : item)) }))} /> Cumplida</label>
              <button type="button" className="text-xs font-bold text-red-600" onClick={() => setDatos(actual => ({ ...actual, acciones: actual.acciones.filter((_, i) => i !== indice) }))}>Quitar</button>
            </div>
          ))}
          <button type="button" className="text-xs font-bold text-[#0055ff]" onClick={() => setDatos(actual => ({ ...actual, acciones: [...actual.acciones, { descripcion: '', responsable: '', fechaLimite: '', cumplida: false }] }))}>＋ Agregar acción</button>
        </fieldset>
        <div className="sm:col-span-4 space-y-2">
          <ListaEvidencias evidencias={datos.evidencias} onQuitar={indice => setDatos(actual => ({ ...actual, evidencias: actual.evidencias.filter((_, i) => i !== indice) }))} />
          <SubirEvidencia correo={usuario?.email} onSubida={evidencia => setDatos(actual => ({ ...actual, evidencias: [...actual.evidencias, evidencia] }))} />
        </div>
      </form>
    </Modal>
  );
}

export default function RiesgosProyecto({ proyecto, plan, cap, usuario, operar, guardando, riesgosMatriz }) {
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState({ tipo: '', estado: 'abiertos', celda: null });
  const critico = Number(proyecto.configuracion?.umbrales?.nivelRiesgoCritico ?? UMBRALES_POR_DEFECTO.nivelRiesgoCritico);
  const riesgos = useMemo(() => plan.riesgos || [], [plan.riesgos]);
  const correo = String(usuario?.email || '').toLowerCase();
  const filtrados = useMemo(() => riesgos.filter(riesgo => (!filtro.tipo || riesgo.tipo === filtro.tipo)
    && (filtro.estado === '' || (filtro.estado === 'abiertos' ? riesgo.estado !== 'cerrado' : riesgo.estado === filtro.estado))
    && (!filtro.celda || (Number(riesgo.probabilidad) === filtro.celda[0] && Number(riesgo.impacto) === filtro.celda[1])))
    .sort((a, b) => (b.nivel ?? -1) - (a.nivel ?? -1)), [riesgos, filtro]);
  const abiertosRiesgo = riesgos.filter(riesgo => riesgo.tipo === 'riesgo' && riesgo.naturaleza !== 'oportunidad' && riesgo.estado !== 'cerrado');
  const puedeEditar = riesgo => cap.gestionar || (cap.aportar && String(riesgo.responsable).toLowerCase() === correo);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Seccion titulo="Matriz de amenazas abiertas" descripcion={`Probabilidad × impacto (1–5). Crítico: nivel ≥ ${critico}. Selecciona una celda para filtrar.`}>
          <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1 text-[10px]" role="grid" aria-label="Matriz de probabilidad por impacto">
            <span />
            {ESCALA.map(impacto => <span key={impacto} className="text-center font-bold text-slate-500">I{impacto}</span>)}
            {[...ESCALA].reverse().map(probabilidad => (
              <div key={probabilidad} className="contents" role="row">
                <span className="flex items-center font-bold text-slate-500">P{probabilidad}</span>
                {ESCALA.map(impacto => {
                  const cantidad = abiertosRiesgo.filter(riesgo => Number(riesgo.probabilidad) === probabilidad && Number(riesgo.impacto) === impacto).length;
                  const seleccionada = filtro.celda?.[0] === probabilidad && filtro.celda?.[1] === impacto;
                  return (
                    <button key={impacto} type="button" role="gridcell" aria-label={`Probabilidad ${probabilidad}, impacto ${impacto}: ${cantidad} riesgo(s)`} aria-pressed={seleccionada}
                      onClick={() => setFiltro(actual => ({ ...actual, celda: seleccionada ? null : [probabilidad, impacto], tipo: seleccionada ? actual.tipo : 'riesgo' }))}
                      className={`h-10 rounded font-black ${colorNivel(probabilidad * impacto, critico)} ${seleccionada ? 'ring-2 ring-[#0055ff]' : ''}`}>{cantidad || ''}</button>
                  );
                })}
              </div>
            ))}
          </div>
        </Seccion>
        <Seccion titulo="Registro" descripcion={`${filtrados.length} de ${riesgos.length} registro(s).`} acciones={cap.aportar && <button type="button" className={botonPrimario} onClick={() => setAbierto('nuevo')}>＋ Registrar</button>}>
          <div className="mb-3 flex flex-wrap gap-2">
            <select aria-label="Categoría" className={`${claseCampo} max-w-[220px]`} value={filtro.tipo} onChange={evento => setFiltro(actual => ({ ...actual, tipo: evento.target.value }))}><option value="">Todas las categorías</option>{Object.entries(TIPOS_RIESGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <select aria-label="Estado" className={`${claseCampo} max-w-[180px]`} value={filtro.estado} onChange={evento => setFiltro(actual => ({ ...actual, estado: evento.target.value }))}><option value="abiertos">Abiertos</option><option value="">Todos</option>{Object.entries(ESTADOS_RIESGO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            {filtro.celda && <button type="button" className={botonSecundario} onClick={() => setFiltro(actual => ({ ...actual, celda: null }))}>Quitar filtro de celda</button>}
          </div>
          {!filtrados.length ? <EstadoVacio titulo="Sin registros" /> : (
            <ul className="divide-y divide-slate-100 text-xs">
              {filtrados.map(riesgo => (
                <li key={riesgo.id} className="flex flex-wrap items-start gap-2 py-2">
                  <span className={`mt-0.5 w-8 rounded text-center font-black ${colorNivel(riesgo.nivel, critico)}`}>{riesgo.nivel ?? '—'}</span>
                  <div className="min-w-0 flex-1">
                    <button type="button" className="text-left font-bold text-[#0055ff] hover:underline disabled:text-slate-800 disabled:no-underline" disabled={!puedeEditar(riesgo)} onClick={() => setAbierto(riesgo)}>{riesgo.codigo} · {riesgo.descripcion}</button>
                    <p className="text-slate-500">{riesgo.naturaleza === 'oportunidad' ? 'Oportunidad' : TIPOS_RIESGO[riesgo.tipo]}{riesgo.nivel !== null && riesgo.nivel !== undefined ? ` · prioridad ${prioridadRiesgo(riesgo.nivel, critico)}` : ''} · {nombreDeCorreo(riesgo.responsable)}{riesgo.costoContingencia ? ` · contingencia ${moneda(riesgo.costoContingencia, proyecto.ficha?.moneda)}` : ''}{riesgo.fechaLimite ? ` · límite ${fecha(riesgo.fechaLimite)}` : ''}{riesgo.nivelResidual ? ` · residual ${riesgo.nivelResidual}` : ''}{riesgo.idRiesgoMatriz ? ' · vinculado a la matriz GCM' : ''}</p>
                    {(riesgo.acciones || []).length > 0 && <p className="text-slate-600">Acciones: {riesgo.acciones.filter(accion => accion.cumplida).length} de {riesgo.acciones.length} cumplidas</p>}
                  </div>
                  <Insignia tono={riesgo.estado === 'cerrado' ? 'verde' : riesgo.estado === 'en_tratamiento' ? 'amarillo' : 'rojo'}>{ESTADOS_RIESGO[riesgo.estado]}</Insignia>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
      {abierto && <FormularioRiesgo riesgo={abierto === 'nuevo' ? null : abierto} plan={plan} usuario={usuario} riesgosMatriz={riesgosMatriz} guardando={guardando} onCerrar={() => setAbierto(null)} onGuardar={riesgo => operar('guardarRiesgo', { riesgo }, 'Registro guardado.')} />}
    </div>
  );
}
