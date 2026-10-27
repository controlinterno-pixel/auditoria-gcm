// src/components/proyectos/EditorApartado.jsx - Marco común de cada apartado del manual E-ID-MAN-01:
// estado (completo / pendiente / no aplica), "No aplica" con justificación y guardado con control de versión.
import { ContextoGuia } from './guias.js';
import { useState } from 'react';
import { APARTADOS, estadoApartado } from '../../utils/proyectos/metodologia.js';
import { fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Campo, GuiaEnLinea, Insignia, Seccion, botonPrimario, claseCampo } from './ui.jsx';

export function InsigniaApartado({ id, proyecto, plan }) {
  const estado = estadoApartado(id, proyecto, plan);
  return <Insignia tono={estado.noAplica ? 'gris' : estado.completo ? 'verde' : 'amarillo'} titulo={estado.faltante}>{estado.noAplica ? 'No aplica' : estado.completo ? 'Completo' : 'Pendiente'}</Insignia>;
}

/**
 * children(datos, cambiar, deshabilitado): el formulario del apartado. cambiar(campo, valor) o cambiar(objeto).
 * Si el apartado se diligencia en la ficha (sin sección propia), pasar seccion = null.
 */
export default function EditorApartado({ id, seccion = id, proyecto, plan, cap, operar, guardando, descripcion, children }) {
  const apartado = APARTADOS.find(item => item.id === id);
  const guardado = plan?.secciones?.[seccion];
  const [datos, setDatos] = useState(() => structuredClone(guardado?.datos || {}));
  const [noAplica, setNoAplica] = useState(Boolean(guardado?.datos?.noAplica));
  const [justificacion, setJustificacion] = useState(guardado?.datos?.noAplica?.justificacion || '');
  const estado = estadoApartado(id, proyecto, plan);
  const deshabilitado = !cap.gestionar;
  const cambiar = (campo, valor) => setDatos(actual => (typeof campo === 'object' ? { ...actual, ...campo } : { ...actual, [campo]: valor }));

  const guardar = async evento => {
    evento.preventDefault();
    const { noAplica: _anterior, ...resto } = datos;
    await operar('guardarSeccion', { seccion, versionBase: guardado?.version, datos: { ...resto, ...(noAplica ? { noAplica: { justificacion } } : {}) } }, `Apartado ${apartado?.numero || ''} guardado.`);
  };

  return (
    <Seccion titulo={`${apartado ? `Apartado ${apartado.numero} · ` : ''}${apartado?.titulo || ''}`} descripcion={descripcion}
      acciones={<InsigniaApartado id={id} proyecto={proyecto} plan={plan} />}>
      {!estado.completo && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Falta: {estado.faltante}</p>}
      <ContextoGuia.Provider value={seccion}>
      <form onSubmit={guardar} className="space-y-4">
        {apartado?.admiteNoAplica && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={noAplica} onChange={evento => setNoAplica(evento.target.checked)} disabled={deshabilitado} />
              Este apartado no aplica al proyecto
            </label>
            <ContextoGuia.Provider value="apartado"><GuiaEnLinea clave="noAplica" etiqueta="No aplica" /></ContextoGuia.Provider>
            {noAplica && (
              <Campo etiqueta="Justificación" obligatorio className="mt-2" ayuda="Queda en el historial y en el informe de formulación.">
                {props => <textarea {...props} rows={2} className={claseCampo} value={justificacion} onChange={evento => setJustificacion(evento.target.value)} disabled={deshabilitado} />}
              </Campo>
            )}
          </div>
        )}
        {!noAplica && <fieldset disabled={deshabilitado} className="space-y-4">{children(datos, cambiar, deshabilitado)}</fieldset>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">{guardado ? `Última actualización: ${nombreDeCorreo(guardado.actualizadoPor)} · ${fechaHora(guardado.actualizadoEn)}` : 'Sin diligenciar.'}</p>
          {cap.gestionar && <button type="submit" className={botonPrimario} disabled={guardando || (noAplica && justificacion.trim().length < 10)}>Guardar apartado</button>}
        </div>
      </form>
      </ContextoGuia.Provider>
    </Seccion>
  );
}

/** Campo de texto largo enlazado a datos[campo]. */
export function AreaTexto({ etiqueta, campo, datos, cambiar, ayuda, filas = 3, obligatorio, className = '' }) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda} obligatorio={obligatorio} className={className}>
      {props => <textarea {...props} rows={filas} className={claseCampo} value={datos[campo] || ''} onChange={evento => cambiar(campo, evento.target.value)} />}
    </Campo>
  );
}

/** Editor de listas: filas con un formulario por elemento, agregar y quitar. */
export function ListaEditable({ elementos = [], onCambiar, nuevo, renderFila, textoAgregar = '＋ Agregar', vacio = 'Sin elementos.' }) {
  return (
    <div className="space-y-2">
      {!elementos.length && <p className="text-xs text-slate-500">{vacio}</p>}
      {elementos.map((elemento, indice) => (
        <div key={elemento.id || indice} className="rounded-xl border border-slate-200 p-3">
          {renderFila(elemento, cambios => onCambiar(elementos.map((item, i) => (i === indice ? { ...item, ...cambios } : item))), indice)}
          <button type="button" className="mt-2 text-xs font-bold text-red-600" onClick={() => onCambiar(elementos.filter((_, i) => i !== indice))}>Quitar</button>
        </div>
      ))}
      <button type="button" className="text-xs font-bold text-[#0055ff]" onClick={() => onCambiar([...elementos, nuevo()])}>{textoAgregar}</button>
    </div>
  );
}

