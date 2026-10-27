// src/components/proyectos/CambiosProyecto.jsx - Control formal de cambios: solicitud, análisis, decisión de
// otra persona e implementación (con revisión presupuestal y versión de línea base registradas).
import { ContextoGuia } from './guias.js';
import { useState } from 'react';
import { ESTADOS_CAMBIO, TRANSICIONES_CAMBIO, normalizarCorreo, rolesEnProyecto } from '../../utils/proyectos/modelo.js';
import { fecha, fechaHora, moneda, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, EstadoVacio, Insignia, ListaEvidencias, Modal, Seccion, SubirEvidencia, botonPeligro, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';

const IMPACTOS = [['alcance', 'Alcance'], ['tiempo', 'Tiempo'], ['costo', 'Costo'], ['calidad', 'Calidad'], ['riesgos', 'Riesgos']];

function FormularioCambio({ cambio, proyecto, usuario, onGuardar, onCerrar, guardando }) {
  const [datos, setDatos] = useState(() => ({ titulo: '', descripcion: '', justificacion: '', elementosAfectados: '', impacto: {}, nuevoPresupuesto: '', evidencias: [], ...(cambio || {}) }));
  const cambiar = campo => evento => setDatos(actual => ({ ...actual, [campo]: evento.target.value }));
  return (
    <Modal titulo={cambio ? `Editar ${cambio.codigo}` : 'Nueva solicitud de cambio'} ancho="max-w-4xl" onCerrar={onCerrar} pie={<><button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button><button type="submit" form="formulario-cambio" className={botonPrimario} disabled={guardando}>Enviar solicitud</button></>}>
      <ContextoGuia.Provider value="cambio">
      <form id="formulario-cambio" className="grid gap-3 sm:grid-cols-2" onSubmit={async evento => { evento.preventDefault(); if (await onGuardar({ ...datos, versionBase: cambio?.version })) onCerrar(); }}>
        <Campo etiqueta="Título" obligatorio className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.titulo} onChange={cambiar('titulo')} />}</Campo>
        <Campo etiqueta="Descripción" obligatorio>{p => <textarea {...p} rows={3} className={claseCampo} value={datos.descripcion} onChange={cambiar('descripcion')} />}</Campo>
        <Campo etiqueta="Justificación" obligatorio>{p => <textarea {...p} rows={3} className={claseCampo} value={datos.justificacion} onChange={cambiar('justificacion')} />}</Campo>
        <Campo etiqueta="Elementos afectados (tareas, entregables, fases…)" className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={datos.elementosAfectados} onChange={cambiar('elementosAfectados')} />}</Campo>
        {IMPACTOS.map(([clave, etiqueta]) => (
          <Campo key={clave} etiqueta={`Impacto en ${etiqueta.toLowerCase()}`}>{p => <textarea {...p} rows={2} className={claseCampo} value={datos.impacto?.[clave] || ''} onChange={evento => setDatos(actual => ({ ...actual, impacto: { ...actual.impacto, [clave]: evento.target.value } }))} />}</Campo>
        ))}
        {proyecto.ficha?.manejaPresupuesto && (
          <Campo etiqueta={`Nuevo presupuesto (${proyecto.ficha.moneda})`} ayuda={`Vigente: ${moneda(proyecto.presupuestoVigente, proyecto.ficha.moneda)}. Déjalo vacío si el cambio no modifica el presupuesto.`}>
            {p => <input {...p} type="number" min="0" className={claseCampo} value={datos.nuevoPresupuesto ?? ''} onChange={cambiar('nuevoPresupuesto')} />}
          </Campo>
        )}
        <div className="space-y-2 sm:col-span-2">
          <ListaEvidencias evidencias={datos.evidencias} onQuitar={indice => setDatos(actual => ({ ...actual, evidencias: actual.evidencias.filter((_, i) => i !== indice) }))} />
          <SubirEvidencia correo={usuario?.email} onSubida={evidencia => setDatos(actual => ({ ...actual, evidencias: [...actual.evidencias, evidencia] }))} />
        </div>
      </form>
      </ContextoGuia.Provider>
    </Modal>
  );
}

export default function CambiosProyecto({ proyecto, plan, cap, usuario, operar, guardando, pedirTexto }) {
  const [abierto, setAbierto] = useState(null);
  const cambios = [...(plan.cambios || [])].reverse();
  const correo = normalizarCorreo(usuario?.email);
  const esDirector = rolesEnProyecto(proyecto, correo).has('director');

  const mover = async (cambio, estado) => {
    const etiquetas = { en_analisis: 'Análisis técnico (impacto, alternativas, recomendación)', aprobada: 'Fundamento de la aprobación', rechazada: 'Fundamento del rechazo', implementada: 'Comentario de implementación (opcional)', cancelada: 'Motivo de la cancelación (opcional)' };
    const texto = await pedirTexto({ titulo: `${ESTADOS_CAMBIO[estado]}: ${cambio.codigo}`, etiqueta: etiquetas[estado], obligatorio: ['en_analisis', 'aprobada', 'rechazada'].includes(estado), confirmar: ESTADOS_CAMBIO[estado], peligro: ['rechazada', 'cancelada'].includes(estado) });
    if (texto === null) return;
    await operar('decidirCambio', { id: cambio.id, versionBase: cambio.version, estado, ...(estado === 'en_analisis' ? { analisis: texto } : { comentario: texto }) }, `Solicitud ${ESTADOS_CAMBIO[estado].toLowerCase()}.`);
  };
  const acciones = cambio => {
    const esSolicitante = normalizarCorreo(cambio.solicitante) === correo;
    return Object.entries(TRANSICIONES_CAMBIO).filter(([destino, origenes]) => origenes.includes(cambio.estado) && (
      ((destino === 'en_analisis' || destino === 'implementada') && cap.gestionar)
      || ((destino === 'aprobada' || destino === 'rechazada') && !esSolicitante && (cap.autorizarEstado || (cap.decidir && !esDirector)))
      || (destino === 'cancelada' && (cap.gestionar || esSolicitante)))).map(([destino]) => destino);
  };

  return (
    <div className="space-y-4">
      <Seccion titulo="Solicitudes de cambio" descripcion="Lo aprueba el patrocinador, un aprobador o un administrador, nunca quien lo solicitó. Al implementarlo se registra la versión de línea base afectada; si cambia fechas, establece una nueva línea base desde el cronograma."
        acciones={(cap.aportar || cap.decidir) && <button type="button" className={botonPrimario} onClick={() => setAbierto('nuevo')}>＋ Solicitar cambio</button>}>
        {!cambios.length ? <EstadoVacio titulo="Sin solicitudes de cambio" /> : (
          <div className="space-y-3">
            {cambios.map(cambio => (
              <article key={cambio.id} className="rounded-2xl border border-slate-200 p-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{cambio.codigo} · {cambio.titulo}</p>
                    <p className="text-slate-500">Solicitó {nombreDeCorreo(cambio.solicitante)} el {fecha(cambio.fechaSolicitud)}{cambio.aprobador ? ` · Decidió ${nombreDeCorreo(cambio.aprobador)} el ${fecha(cambio.fechaDecision)}` : ''}{cambio.versionLineaBase ? ` · Línea base v${cambio.versionLineaBase}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Insignia tono={TONO_ESTADO[cambio.estado]}>{ESTADOS_CAMBIO[cambio.estado]}</Insignia>
                    {cambio.estado === 'solicitada' && (cap.gestionar || normalizarCorreo(cambio.solicitante) === correo) && <button type="button" className={botonSecundario} onClick={() => setAbierto(cambio)}>Editar</button>}
                    {acciones(cambio).map(destino => <button key={destino} type="button" disabled={guardando} className={['rechazada', 'cancelada'].includes(destino) ? botonPeligro : destino === 'aprobada' ? botonPrimario : botonSecundario} onClick={() => mover(cambio, destino)}>{ESTADOS_CAMBIO[destino]}</button>)}
                  </div>
                </div>
                <p className="mt-2 text-slate-700">{cambio.descripcion}</p>
                <p className="mt-1 text-slate-600"><b>Justificación:</b> {cambio.justificacion}</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-5">
                  {IMPACTOS.filter(([clave]) => cambio.impacto?.[clave]).map(([clave, etiqueta]) => <div key={clave}><dt className="font-bold text-slate-500">{etiqueta}</dt><dd>{cambio.impacto[clave]}</dd></div>)}
                </dl>
                {cambio.nuevoPresupuesto !== null && cambio.nuevoPresupuesto !== undefined && <p className="mt-1 font-bold">Nuevo presupuesto: {moneda(cambio.nuevoPresupuesto, proyecto.ficha?.moneda)}</p>}
                {cambio.analisis && <p className="mt-1 text-slate-600"><b>Análisis técnico:</b> {cambio.analisis}</p>}
                {(cambio.evidencias || []).length > 0 && <div className="mt-2"><ListaEvidencias evidencias={cambio.evidencias} /></div>}
                {(cambio.decisiones || []).length > 0 && (
                  <ul className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    {cambio.decisiones.map((decision, indice) => <li key={indice}>{ESTADOS_CAMBIO[decision.estado]} · {nombreDeCorreo(decision.por)} · {fechaHora(decision.fecha)}{decision.comentario ? ` · “${decision.comentario}”` : ''}</li>)}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </Seccion>
      {abierto && <FormularioCambio cambio={abierto === 'nuevo' ? null : abierto} proyecto={proyecto} usuario={usuario} guardando={guardando} onCerrar={() => setAbierto(null)} onGuardar={cambio => operar('guardarCambio', { cambio }, 'Solicitud de cambio registrada.')} />}
    </div>
  );
}
