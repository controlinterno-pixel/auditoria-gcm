// src/components/proyectos/ResumenProyecto.jsx - Indicadores con su fórmula, semáforo con motivos, flujo de
// autorización de fases del manual E-ID-MAN-01 y explicación del estado.
import { useState } from 'react';
import { ESTADOS_PROYECTO, NOMBRE_TRANSICION, TRANSICIONES_PROYECTO, normalizarCorreo, requisitosTransicion } from '../../utils/proyectos/modelo.js';
import { FORMULAS } from '../../utils/proyectos/indicadores.js';
import { PILARES, aprobacionDe } from '../../utils/proyectos/metodologia.js';
import { fecha, fechaHora, moneda, nombreDeCorreo, porcentaje, puntos, variacion } from '../../utils/proyectos/formato.js';
import { Campo, Insignia, Kpi, Seccion, Semaforo, botonPrimario, botonSecundario, botonPeligro, claseCampo } from './ui.jsx';

const Dato = ({ etiqueta, children }) => (
  <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{etiqueta}</dt><dd className="mt-0.5 whitespace-pre-line text-sm text-slate-800">{children || '—'}</dd></div>
);

export default function ResumenProyecto({ proyecto, plan, cap, usuario, operar, guardando, indicadores: ind, pedirTexto }) {
  const f = proyecto.ficha || {};
  const m = proyecto.miembros || {};
  const pendiente = (proyecto.solicitudesEstado || []).find(solicitud => solicitud.estado === 'pendiente');
  const [explicacion, setExplicacion] = useState(() => ({ explicacion: '', causa: '', planRecuperacion: '', ...(proyecto.explicacionEstado || {}) }));
  // Suspendido: solo se reanuda en la fase en que estaba (o se cancela).
  const destinos = proyecto.estado === 'suspendido'
    ? [proyecto.estadoAntesSuspension, 'cancelado'].filter(Boolean)
    : Object.entries(TRANSICIONES_PROYECTO).filter(([destino, origenes]) => origenes.includes(proyecto.estado) && destino !== 'propuesto').map(([destino]) => destino);
  const nombreDestino = destino => (proyecto.estado === 'suspendido' && destino !== 'cancelado' ? `Reanudar en ${ESTADOS_PROYECTO[destino]}` : NOMBRE_TRANSICION[destino]);
  const sinAprobacion = proyecto.configuracion?.aprobarCambiosEstado === false;
  const moneda_ = f.moneda || 'COP';

  const solicitar = async destino => {
    const motivo = await pedirTexto({ titulo: nombreDestino(destino), etiqueta: sinAprobacion ? 'Motivo (queda en el historial)' : 'Motivo de la solicitud (lo verá el patrocinador)', confirmar: sinAprobacion ? 'Aplicar' : 'Enviar solicitud', peligro: destino === 'cancelado' });
    if (motivo) await operar('solicitarEstado', { destino, motivo }, sinAprobacion ? 'Estado actualizado.' : 'Solicitud enviada al patrocinador.');
  };
  const decidir = async decision => {
    const comentario = await pedirTexto({ titulo: decision === 'aprobada' ? 'Autorizar la solicitud' : 'Rechazar la solicitud', etiqueta: decision === 'aprobada' ? 'Comentario (opcional)' : 'Motivo del rechazo', obligatorio: decision === 'rechazada', confirmar: decision === 'aprobada' ? 'Autorizar' : 'Rechazar', peligro: decision === 'rechazada' });
    if (comentario === null) return;
    await operar('decidirEstado', { idSolicitud: pendiente.id, decision, comentario }, decision === 'aprobada' ? 'Solicitud autorizada.' : 'Solicitud rechazada.');
  };
  const evmFaltante = !ind.maneja ? 'El proyecto no maneja presupuesto.' : !ind.tieneLineaBase ? 'Falta la línea base del cronograma.' : ind.costoReal === 0 ? 'Faltan costos reales registrados.' : 'Faltan fechas o avances en el cronograma.';

  const etapas = [
    ['propuesto', 'Prefactibilidad', 'Preinversión'], ['factibilidad', 'Factibilidad', 'Preinversión'], ['planificacion', 'Planificación', 'Inversión'],
    ['ejecucion', 'Ejecución', 'Inversión'], ['operacion', 'Entrega a operación', 'Operación y cierre'], ['cerrado', 'Cerrado', 'Operación y cierre'],
  ];
  const estadoVisible = proyecto.estado === 'suspendido' ? proyecto.estadoAntesSuspension : proyecto.estado;
  const posicionActual = etapas.findIndex(([clave]) => clave === estadoVisible);
  return (
    <div className="space-y-4">
      <Seccion titulo="Ciclo de vida (Manual E-ID-MAN-01)" descripcion="Cada paso lo solicita el director y lo aprueba el patrocinador (Gerencia) o el Comité I+D+i; la aprobación queda registrada como la firma del acta.">
        <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {etapas.map(([clave, nombre, fase], indice) => {
            const aprobacion = indice > 0 ? aprobacionDe(proyecto, clave) : null;
            const actual = indice === posicionActual;
            return (
              <li key={clave} className={`rounded-xl border p-2 text-xs ${actual ? 'border-[#0055ff] bg-blue-50' : indice < posicionActual ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`} aria-current={actual ? 'step' : undefined}>
                <p className="text-[10px] font-black uppercase text-slate-500">{fase}</p>
                <p className="font-black text-slate-800">{nombre}{actual && proyecto.estado === 'suspendido' ? ' (suspendido)' : ''}</p>
                {aprobacion && <p className="mt-1 text-[11px] text-slate-600">Aprobó {nombreDeCorreo(aprobacion.decididaPor)} · {fecha(aprobacion.fechaDecision)}</p>}
              </li>
            );
          })}
        </ol>
      </Seccion>

      <Seccion titulo="Estado de control" descripcion="El semáforo combina atraso, hitos, riesgos, costos, bloqueos y actualización: un avance alto no basta para estar en verde.">
        <div className="flex flex-wrap items-start gap-4">
          <Semaforo semaforo={ind.semaforo} conTexto />
          <ul className="flex-1 list-disc space-y-0.5 pl-4 text-sm text-slate-700">{ind.semaforo.motivos.map(motivo => <li key={motivo}>{motivo}</li>)}</ul>
        </div>
      </Seccion>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Kpi titulo="Avance real" valor={porcentaje(ind.avanceReal)} formula={FORMULAS.avanceReal} />
        <Kpi titulo="Avance planificado" valor={porcentaje(ind.avancePlanificado)} detalle={ind.tieneLineaBase ? 'Según línea base' : 'Sin línea base: fechas vigentes'} formula={FORMULAS.avancePlanificado} />
        <Kpi titulo="Desviación" valor={puntos(ind.desviacionAvance)} tono={ind.desviacionAvance <= -5 ? 'rojo' : 'gris'} formula={FORMULAS.desviacionAvance} />
        <Kpi titulo="Cumplimiento de hitos" valor={porcentaje(ind.cumplimientoHitos)} detalle={`${ind.hitosVencidos} vencido(s) · ${ind.hitosProximos} próximo(s)`} formula={FORMULAS.cumplimientoHitos} />
        <Kpi titulo="Entregables aceptados" valor={porcentaje(ind.cumplimientoEntregables)} detalle={`${ind.entregablesPendientesAprobacion} por aprobar`} formula={FORMULAS.cumplimientoEntregables} />
        <Kpi titulo="Tareas vencidas" valor={`${ind.tareasVencidas} de ${ind.tareasAbiertas}`} detalle={`${porcentaje(ind.tasaTareasVencidas)} · ${ind.tareasBloqueadas} bloqueada(s)`} formula={FORMULAS.tasaTareasVencidas} tono={ind.tareasVencidas ? 'amarillo' : 'gris'} />
        <Kpi titulo="Riesgos críticos" valor={ind.riesgosCriticos} detalle={`${ind.problemasAbiertos} problema(s) o incidencia(s) abiertos`} formula={FORMULAS.riesgosCriticos} tono={ind.riesgosCriticos ? 'rojo' : 'gris'} />
        <Kpi titulo="Compromisos a tiempo" valor={porcentaje(ind.cumplimientoCompromisos)} detalle={`${ind.compromisosVencidos} vencido(s)`} formula={FORMULAS.cumplimientoCompromisos} />
        <Kpi titulo="Fin vigente" valor={fecha(ind.finVigente)} detalle={ind.atrasoFinDias === null ? 'Sin línea base' : ind.atrasoFinDias > 0 ? `${ind.atrasoFinDias} días después de la línea base` : 'Dentro de la línea base'} tono={ind.atrasoFinDias > 0 ? 'rojo' : 'gris'} />
        {ind.maneja && <Kpi titulo="Variación presupuestal" valor={variacion(ind.variacionPresupuestal)} detalle={ind.proyeccionFinal === null ? `Consumido ${porcentaje(ind.consumoPresupuesto)} · falta estimar el costo final` : `Proyección ${moneda(ind.proyeccionFinal, moneda_)} (${{ estimacion: 'Estimación del director', evm: 'EAC del valor ganado' }[ind.origenProyeccion] || 'Registra la estimación del costo final'})`} formula={FORMULAS.variacionPresupuestal} tono={ind.variacionPresupuestal > 0 ? 'rojo' : 'gris'} />}
        <Kpi titulo="SPI / CPI" valor={ind.evm ? `${ind.evm.spi ?? '—'} / ${ind.evm.cpi ?? '—'}` : 'No disponible'} detalle={ind.evm ? `EAC ${moneda(ind.evm.eac, moneda_)}` : evmFaltante} formula={FORMULAS.evm} />
        <Kpi titulo="Cambios pendientes" valor={ind.cambiosPendientes} detalle={`${ind.accionesPendientes} acción(es) de tratamiento abierta(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Seccion titulo="Aprobaciones de fase" className="lg:col-span-1" descripcion={sinAprobacion ? 'Este proyecto no exige aprobación para cambiar de fase.' : 'El director solicita; aprueba el patrocinador, el Comité I+D+i o un administrador (nunca quien solicitó).'}>
          <p className="text-sm">Estado actual: <b>{ESTADOS_PROYECTO[proyecto.estado]}</b></p>
          {pendiente && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
              <p className="font-black text-amber-800">Solicitud pendiente: {NOMBRE_TRANSICION[pendiente.destino]}</p>
              <p className="mt-1 text-amber-900">“{pendiente.motivo}”</p>
              <p className="mt-1 text-amber-700">{nombreDeCorreo(pendiente.solicitante)} · {fechaHora(pendiente.fecha)}</p>
              {cap.autorizarEstado && normalizarCorreo(pendiente.solicitante) !== normalizarCorreo(usuario?.email) && (
                <div className="mt-2 flex gap-2">
                  <button type="button" className={botonPrimario} disabled={guardando} onClick={() => decidir('aprobada')}>Autorizar</button>
                  <button type="button" className={botonPeligro} disabled={guardando} onClick={() => decidir('rechazada')}>Rechazar</button>
                </div>
              )}
              {normalizarCorreo(pendiente.solicitante) === normalizarCorreo(usuario?.email) && <p className="mt-2 font-bold text-amber-800">La debe decidir otra persona (patrocinador o administrador).</p>}
            </div>
          )}
          {cap.gestionar && !pendiente && (
            <div className="mt-3 space-y-2">
              {destinos.map(destino => {
                const faltan = requisitosTransicion(proyecto, plan, destino);
                return (
                  <div key={destino}>
                    <button type="button" className={destino === 'cancelado' ? botonPeligro : botonSecundario} disabled={guardando || faltan.length > 0} onClick={() => solicitar(destino)}>{nombreDestino(destino)}</button>
                    {faltan.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-500">{faltan.slice(0, 8).map(faltante => <li key={faltante}>{faltante}</li>)}{faltan.length > 8 && <li>y {faltan.length - 8} más…</li>}</ul>}
                  </div>
                );
              })}
            </div>
          )}
          {(proyecto.solicitudesEstado || []).filter(solicitud => solicitud.estado !== 'pendiente').slice(-4).reverse().map(solicitud => (
            <p key={solicitud.id} className="mt-2 text-[11px] text-slate-500">
              <Insignia tono={solicitud.estado === 'aprobada' ? 'verde' : 'rojo'}>{solicitud.estado}</Insignia> {NOMBRE_TRANSICION[solicitud.destino]} · {nombreDeCorreo(solicitud.decididaPor)} · {fecha(solicitud.fechaDecision)}{solicitud.comentario ? ` · “${solicitud.comentario}”` : ''}
            </p>
          ))}
          {cap.archivar && <button type="button" className={`${botonSecundario} mt-3`} disabled={guardando} onClick={() => operar('archivar', { archivado: true }, 'Proyecto archivado.')}>Archivar proyecto</button>}
        </Seccion>

        <Seccion titulo="Explicación del estado" className="lg:col-span-2" descripcion="Causa de la desviación y plan de recuperación: aparece en el tablero junto al semáforo.">
          {cap.gestionar ? (
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={evento => { evento.preventDefault(); void operar('explicarEstado', explicacion, 'Explicación registrada.'); }}>
              {[['explicacion', 'Explicación del estado'], ['causa', 'Causa de la desviación'], ['planRecuperacion', 'Plan de recuperación']].map(([campo, etiqueta]) => (
                <Campo key={campo} etiqueta={etiqueta} obligatorio={campo === 'explicacion'}>
                  {props => <textarea {...props} rows={3} className={claseCampo} value={explicacion[campo] || ''} onChange={evento => setExplicacion(actual => ({ ...actual, [campo]: evento.target.value }))} />}
                </Campo>
              ))}
              <div className="flex items-center justify-between gap-2 sm:col-span-3">
                <p className="text-[11px] text-slate-500">{proyecto.explicacionEstado ? `Última: ${nombreDeCorreo(proyecto.explicacionEstado.por)} · ${fechaHora(proyecto.explicacionEstado.fecha)}` : 'Sin explicación registrada.'}</p>
                <button type="submit" className={botonPrimario} disabled={guardando || !String(explicacion.explicacion || '').trim()}>Guardar explicación</button>
              </div>
            </form>
          ) : proyecto.explicacionEstado ? (
            <dl className="grid gap-3 sm:grid-cols-3"><Dato etiqueta="Explicación">{proyecto.explicacionEstado.explicacion}</Dato><Dato etiqueta="Causa">{proyecto.explicacionEstado.causa}</Dato><Dato etiqueta="Plan de recuperación">{proyecto.explicacionEstado.planRecuperacion}</Dato></dl>
          ) : <p className="text-sm text-slate-500">El director aún no registra una explicación.</p>}
        </Seccion>
      </div>

      <Seccion titulo="Ficha del proyecto">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Objetivo general">{f.objetivoGeneral}</Dato>
          <Dato etiqueta="Objetivos específicos">{(f.objetivosEspecificos || []).map(objetivo => `• ${objetivo}`).join('\n')}</Dato>
          <Dato etiqueta="Alcance incluido">{f.alcanceIncluido}</Dato>
          <Dato etiqueta="Fuera del alcance">{f.alcanceExcluido}</Dato>
          <Dato etiqueta="Justificación">{f.justificacion}</Dato>
          <Dato etiqueta="Problema u oportunidad">{f.problema}</Dato>
          <Dato etiqueta="Beneficios esperados">{f.beneficios}</Dato>
          <Dato etiqueta="Criterios de éxito">{f.criteriosExito}</Dato>
          <Dato etiqueta="Fechas planificadas">{`${fecha(f.inicioPlanificado)} → ${fecha(f.finPlanificado)}`}</Dato>
          <Dato etiqueta="Fechas reales">{f.inicioReal ? `${fecha(f.inicioReal)} → ${f.finReal ? fecha(f.finReal) : 'en curso'}` : 'Sin iniciar'}</Dato>
          <Dato etiqueta="Presupuesto">{f.manejaPresupuesto ? `Aprobado ${moneda(f.presupuestoAprobado, moneda_)} · Vigente ${moneda(proyecto.presupuestoVigente, moneda_)}` : 'No maneja presupuesto'}</Dato>
          <Dato etiqueta="Área / proceso">{[f.area, f.proceso].filter(Boolean).join(' / ')}</Dato>
          <Dato etiqueta="Director">{m.director}</Dato>
          <Dato etiqueta="Código del portafolio">{proyecto.codigoEstrategico ? `${proyecto.codigoEstrategico} · Pilar ${PILARES[f.pilar]}` : 'Sin asignar'}</Dato>
          <Dato etiqueta="Patrocinador (aprueba las fases)">{m.patrocinador || 'Sin patrocinador: aprueba el Comité o un administrador.'}</Dato>
          <Dato etiqueta="Comité I+D+i / Estratégico">{(m.comite || []).join('\n')}</Dato>
          <Dato etiqueta="Equipo">{(m.equipo || []).join('\n')}</Dato>
          <Dato etiqueta="Aprobadores">{(m.aprobadores || []).join('\n')}</Dato>
          <Dato etiqueta="Dependencias y restricciones">{f.dependenciasRestricciones}</Dato>
          <Dato etiqueta="Portafolio / programa">{[f.portafolio, f.programa].filter(Boolean).join(' / ')}</Dato>
        </dl>
      </Seccion>
    </div>
  );
}
