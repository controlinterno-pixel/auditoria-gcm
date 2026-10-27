// src/components/proyectos/PresupuestoProyecto.jsx - Presupuesto inicial y vigente, revisiones autorizadas,
// costos reales y comprometidos (separados), estimación final y desviación. Un costo no registrado no es cero.
import { ContextoGuia } from './guias.js';
import { useState } from 'react';
import { CATEGORIAS_COSTO, TIPOS_COSTO } from '../../utils/proyectos/modelo.js';
import { FORMULAS } from '../../utils/proyectos/indicadores.js';
import { fecha, fechaHora, moneda, nombreDeCorreo, porcentaje, variacion } from '../../utils/proyectos/formato.js';
import { Campo, EstadoVacio, Insignia, Kpi, Modal, Seccion, SubirEvidencia, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

export default function PresupuestoProyecto({ proyecto, plan, cap, usuario, operar, guardando, indicadores: ind, pedirTexto, hoy }) {
  const codigo = proyecto.ficha?.moneda || 'COP';
  const [registrando, setRegistrando] = useState(false);
  const [costo, setCosto] = useState({ fecha: hoy, tipo: 'real', categoria: 'servicios', monto: '', descripcion: '', idTarea: '', soporte: '' });
  const [estimado, setEstimado] = useState({ monto: plan.estimadoFinal?.monto ?? '', justificacion: plan.estimadoFinal?.justificacion || '' });
  const costos = [...(plan.costos || [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const vigentes = costos.filter(item => item.estado !== 'anulado');
  const porCategoria = Object.entries(CATEGORIAS_COSTO).map(([clave, nombre]) => ({
    nombre,
    real: vigentes.filter(item => item.categoria === clave && item.tipo === 'real').reduce((s, item) => s + item.monto, 0),
    comprometido: vigentes.filter(item => item.categoria === clave && item.tipo === 'comprometido').reduce((s, item) => s + item.monto, 0),
  })).filter(fila => fila.real || fila.comprometido);

  const registrar = async evento => {
    evento.preventDefault();
    if (await operar('registrarCosto', { costo: { ...costo, monto: Number(costo.monto) } }, 'Costo registrado.')) {
      setRegistrando(false);
      setCosto(actual => ({ ...actual, monto: '', descripcion: '', soporte: '' }));
    }
  };
  const anular = async item => {
    const motivo = await pedirTexto({ titulo: `Anular ${item.codigo}`, etiqueta: 'Motivo de la anulación (el registro se conserva)', confirmar: 'Anular', peligro: true });
    if (motivo) await operar('anularCosto', { id: item.id, versionBase: item.version, motivo }, 'Costo anulado.');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi titulo="Aprobado inicial" valor={moneda(proyecto.ficha?.presupuestoAprobado, codigo)} />
        <Kpi titulo="Vigente" valor={moneda(ind.presupuestoVigente, codigo)} detalle={`${(plan.revisionesPresupuesto || []).length} revisión(es)`} />
        <Kpi titulo="Real (ejecutado)" valor={moneda(ind.costoReal, codigo)} />
        <Kpi titulo="Comprometido" valor={moneda(ind.costoComprometido, codigo)} />
        <Kpi titulo="Disponible" valor={moneda(ind.disponible, codigo)} tono={ind.disponible < 0 ? 'rojo' : 'gris'} formula="Vigente − real − comprometido." />
        <Kpi titulo="Proyección final" valor={moneda(ind.proyeccionFinal, codigo)} detalle={{ estimacion: 'Estimación del director', evm: 'EAC del valor ganado' }[ind.origenProyeccion] || 'Registra la estimación del costo final'} formula={FORMULAS.variacionPresupuestal} />
        <Kpi titulo="Consumido a la fecha" valor={porcentaje(ind.consumoPresupuesto)} detalle="Real + comprometido" formula={FORMULAS.consumoPresupuesto} />
        <Kpi titulo="Desviación" valor={variacion(ind.variacionPresupuestal)} tono={ind.variacionPresupuestal > 0 ? 'rojo' : 'gris'} detalle={ind.variacionPresupuestal === null ? 'Registra costos reales o una estimación' : ''} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Costos por categoría">
          {!porCategoria.length ? <EstadoVacio titulo="Sin costos registrados" /> : (
            <table className="w-full text-xs">
              <thead className="border-b text-left text-[10px] font-black uppercase text-slate-500"><tr><th className="p-2">Categoría</th><th className="p-2 text-right">Real</th><th className="p-2 text-right">Comprometido</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{porCategoria.map(fila => <tr key={fila.nombre}><td className="p-2 font-bold">{fila.nombre}</td><td className="p-2 text-right">{moneda(fila.real, codigo)}</td><td className="p-2 text-right">{moneda(fila.comprometido, codigo)}</td></tr>)}</tbody>
            </table>
          )}
        </Seccion>
        <Seccion titulo="Estimación del costo final" descripcion="Si no la registras, la proyección usa el valor ganado (EAC) cuando hay datos suficientes; si no, la desviación queda sin calcular.">
          {cap.gestionar ? (
            <ContextoGuia.Provider value="presupuesto">
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={evento => { evento.preventDefault(); void operar('estimarCostoFinal', { monto: estimado.monto === '' ? null : Number(estimado.monto), justificacion: estimado.justificacion }, 'Estimación registrada.'); }}>
              <Campo etiqueta={`Monto (${codigo})`}>{p => <input {...p} type="number" min="0" className={claseCampo} value={estimado.monto} onChange={evento => setEstimado(actual => ({ ...actual, monto: evento.target.value }))} />}</Campo>
              <Campo etiqueta="Justificación de la variación" className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={estimado.justificacion} onChange={evento => setEstimado(actual => ({ ...actual, justificacion: evento.target.value }))} />}</Campo>
              <div className="flex items-center justify-between gap-2 sm:col-span-3">
                <p className="text-[11px] text-slate-500">{plan.estimadoFinal ? `Última: ${nombreDeCorreo(plan.estimadoFinal.por)} · ${fechaHora(plan.estimadoFinal.fecha)}` : 'Sin estimación registrada.'}</p>
                <button type="submit" className={botonPrimario} disabled={guardando}>Guardar estimación</button>
              </div>
            </form>
            </ContextoGuia.Provider>
          ) : <p className="text-sm">{plan.estimadoFinal ? `${moneda(plan.estimadoFinal.monto, codigo)} · ${plan.estimadoFinal.justificacion}` : 'Sin estimación registrada.'}</p>}
        </Seccion>
      </div>

      <Seccion titulo="Revisiones presupuestales autorizadas" descripcion="Solo se originan en solicitudes de cambio aprobadas e implementadas.">
        {!(plan.revisionesPresupuesto || []).length ? <p className="text-sm text-slate-500">Sin revisiones: el presupuesto vigente es el aprobado inicialmente.</p> : (
          <ul className="space-y-1 text-xs">{plan.revisionesPresupuesto.map((revision, indice) => <li key={indice}>{fecha(revision.fecha)} · {moneda(revision.anterior, codigo)} → <b>{moneda(revision.nuevo, codigo)}</b> · {revision.codigoCambio} · {nombreDeCorreo(revision.por)}</li>)}</ul>
        )}
      </Seccion>

      <Seccion titulo="Registro de costos" descripcion="Los costos no se editan ni se borran: se anulan con motivo." acciones={cap.gestionar && <button type="button" className={botonPrimario} onClick={() => setRegistrando(true)}>＋ Registrar costo</button>}>
        {!costos.length ? <EstadoVacio titulo="Sin costos" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="border-b text-left text-[10px] font-black uppercase text-slate-500"><tr><th className="p-2">Código</th><th className="p-2">Fecha</th><th className="p-2">Tipo</th><th className="p-2">Categoría</th><th className="p-2">Descripción</th><th className="p-2 text-right">Monto</th><th className="p-2" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {costos.map(item => (
                  <tr key={item.id} className={item.estado === 'anulado' ? 'text-slate-400 line-through' : ''}>
                    <td className="p-2 font-bold">{item.codigo}</td><td className="p-2">{fecha(item.fecha)}</td><td className="p-2">{TIPOS_COSTO[item.tipo]}</td><td className="p-2">{CATEGORIAS_COSTO[item.categoria]}</td>
                    <td className="p-2">{item.descripcion}{item.soporte && <> · <a className="text-[#0055ff] no-underline" href={item.soporte} target="_blank" rel="noopener noreferrer">soporte</a></>}{item.estado === 'anulado' && <span className="block no-underline">Anulado: {item.motivoAnulacion}</span>}</td>
                    <td className="p-2 text-right font-bold">{moneda(item.monto, codigo)}</td>
                    <td className="p-2 text-right">{item.estado === 'anulado' ? <Insignia>Anulado</Insignia> : cap.gestionar && <button type="button" className="text-xs font-bold text-red-600" onClick={() => anular(item)}>Anular</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      {registrando && (
        <Modal titulo="Registrar costo" ancho="max-w-2xl" onCerrar={() => setRegistrando(false)} pie={<><button type="button" className={botonSecundario} onClick={() => setRegistrando(false)}>Cancelar</button><button type="submit" form="formulario-costo" className={botonPrimario} disabled={guardando}>Registrar</button></>}>
          <ContextoGuia.Provider value="costo">
          <form id="formulario-costo" onSubmit={registrar} className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Fecha" obligatorio>{p => <input {...p} type="date" className={claseCampo} value={costo.fecha} onChange={evento => setCosto(actual => ({ ...actual, fecha: evento.target.value }))} />}</Campo>
            <Campo etiqueta="Tipo" obligatorio>{p => <select {...p} className={claseCampo} value={costo.tipo} onChange={evento => setCosto(actual => ({ ...actual, tipo: evento.target.value }))}>{Object.entries(TIPOS_COSTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
            <Campo etiqueta="Categoría" obligatorio>{p => <select {...p} className={claseCampo} value={costo.categoria} onChange={evento => setCosto(actual => ({ ...actual, categoria: evento.target.value }))}>{Object.entries(CATEGORIAS_COSTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
            <Campo etiqueta={`Monto (${codigo})`} obligatorio>{p => <input {...p} type="number" min="0" className={claseCampo} value={costo.monto} onChange={evento => setCosto(actual => ({ ...actual, monto: evento.target.value }))} />}</Campo>
            <Campo etiqueta="Descripción" obligatorio className="sm:col-span-2">{p => <input {...p} className={claseCampo} value={costo.descripcion} onChange={evento => setCosto(actual => ({ ...actual, descripcion: evento.target.value }))} />}</Campo>
            <Campo etiqueta="Tarea asociada" className="sm:col-span-2">{p => <select {...p} className={claseCampo} value={costo.idTarea} onChange={evento => setCosto(actual => ({ ...actual, idTarea: evento.target.value }))}><option value="">Ninguna</option>{(plan.tareas || []).map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.titulo}</option>)}</select>}</Campo>
            <div className="flex items-end">{costo.soporte ? <a href={costo.soporte} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#0055ff]">Soporte adjunto ✓</a> : <SubirEvidencia correo={usuario?.email} onSubida={evidencia => setCosto(actual => ({ ...actual, soporte: evidencia.url }))} />}</div>
          </form>
          </ContextoGuia.Provider>
        </Modal>
      )}
    </div>
  );
}
