// src/components/proyectos/ui.jsx - Piezas visuales compartidas del módulo de Gestión de Proyectos.
import { useEffect, useId, useRef, useState } from 'react';
import { apiService } from '../../services/apiService';
import { useCatalogos } from '../../context/useCatalogos';

export const claseCampo = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0055ff] focus:ring-2 focus:ring-[#0055ff]/20 disabled:bg-slate-100 disabled:text-slate-500';
export const claseBoton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0055ff] disabled:cursor-not-allowed disabled:opacity-50';
export const botonPrimario = `${claseBoton} bg-[#0055ff] text-white shadow-sm hover:bg-[#0044cc]`;
export const botonSecundario = `${claseBoton} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const botonPeligro = `${claseBoton} border border-red-200 bg-white text-red-700 hover:bg-red-50`;

/** Campo con etiqueta asociada, ayuda y error (accesible con lector de pantalla). */
export function Campo({ etiqueta, ayuda, error, obligatorio, children, className = '' }) {
  const id = useId();
  const hijo = typeof children === 'function' ? children({ id, 'aria-describedby': ayuda || error ? `${id}-ayuda` : undefined, 'aria-invalid': error ? true : undefined }) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-slate-600">
        {etiqueta}{obligatorio && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {hijo}
      {(ayuda || error) && <p id={`${id}-ayuda`} className={`mt-1 text-[11px] ${error ? 'font-bold text-red-600' : 'text-slate-500'}`}>{error || ayuda}</p>}
    </div>
  );
}

export function Seccion({ titulo, descripcion, acciones, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(titulo || acciones) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            {titulo && <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">{titulo}</h3>}
            {descripcion && <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONOS = {
  gris: 'bg-slate-100 text-slate-700 border-slate-200',
  azul: 'bg-blue-50 text-blue-700 border-blue-200',
  verde: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amarillo: 'bg-amber-50 text-amber-800 border-amber-200',
  rojo: 'bg-red-50 text-red-700 border-red-200',
  morado: 'bg-violet-50 text-violet-700 border-violet-200',
};
export const Insignia = ({ tono = 'gris', children, titulo }) => (
  <span title={titulo} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONOS[tono] || TONOS.gris}`}>{children}</span>
);


const COLOR_SEMAFORO = { verde: 'bg-emerald-500', amarillo: 'bg-amber-400', rojo: 'bg-red-500', gris: 'bg-slate-300' };
const TEXTO_SEMAFORO = { verde: 'En control', amarillo: 'Con alertas', rojo: 'Crítico', gris: 'Sin evaluar' };
export function Semaforo({ semaforo, conTexto = false }) {
  const color = semaforo?.color || 'gris';
  const motivos = (semaforo?.motivos || []).join(' ');
  return (
    <span className="inline-flex items-center gap-1.5" title={motivos}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_SEMAFORO[color]}`} aria-hidden="true" />
      <span className={conTexto ? 'text-xs font-bold text-slate-700' : 'sr-only'}>{TEXTO_SEMAFORO[color]}{conTexto ? '' : `: ${motivos}`}</span>
    </span>
  );
}

/** Indicador con fórmula visible al pasar o enfocar, y que puede filtrar los registros que lo componen. */
export function Kpi({ titulo, valor, detalle, formula, tono = 'gris', onClick, activo = false }) {
  const contenido = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-lg font-black [overflow-wrap:anywhere] sm:text-2xl ${tono === 'rojo' ? 'text-red-600' : tono === 'amarillo' ? 'text-amber-600' : tono === 'verde' ? 'text-emerald-600' : 'text-slate-800'}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-slate-500">{detalle}</p>}
    </>
  );
  const clase = `min-w-0 rounded-2xl border bg-white p-3 text-left shadow-sm ${activo ? 'border-[#0055ff] ring-2 ring-[#0055ff]/20' : 'border-slate-200'}`;
  return onClick
    ? <button type="button" onClick={onClick} title={formula} aria-pressed={activo} className={`${clase} transition hover:border-[#0055ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0055ff]`}>{contenido}</button>
    : <div className={clase} title={formula}>{contenido}</div>;
}

export function EstadoVacio({ titulo, descripcion, accion }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm font-black text-slate-700">{titulo}</p>
      {descripcion && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{descripcion}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

/** Ventana modal con foco atrapado de forma simple, cierre con Escape y título para lectores de pantalla. */
export function Modal({ titulo, onCerrar, children, ancho = 'max-w-3xl', pie }) {
  const ref = useRef(null);
  const idTitulo = useId();
  useEffect(() => {
    const anterior = document.activeElement;
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    const alPresionar = evento => { if (evento.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alPresionar);
    return () => { document.removeEventListener('keydown', alPresionar); anterior?.focus?.(); };
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={evento => { if (evento.target === evento.currentTarget) onCerrar(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={idTitulo} className={`flex max-h-[92vh] w-full ${ancho} flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 id={idTitulo} className="text-base font-black text-slate-800">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">{pie}</div>}
      </div>
    </div>
  );
}

/** Sube un archivo al repositorio de la empresa (mismo servicio de evidencias de la app) y devuelve su enlace. */
export function SubirEvidencia({ onSubida, correo, disabled }) {
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState('');
  const id = useId();
  const subir = async evento => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    setError('');
    setProgreso(0);
    try {
      const resultado = await apiService.subirEvidencia(archivo, {}, valor => setProgreso(valor));
      const url = apiService.resolveArchivoUrl ? apiService.resolveArchivoUrl({ appName: resultado?.appName, fileName: resultado?.fileName, url: resultado?.url }) || resultado?.url : resultado?.url;
      if (!url) throw new Error('El servidor de archivos no devolvió el enlace.');
      onSubida({ url, nombre: resultado.fileName || archivo.name, subidoPor: correo, fecha: new Date().toISOString() });
    } catch (falla) {
      setError(falla?.message || 'No se pudo subir el archivo.');
    } finally {
      setProgreso(null);
    }
  };
  return (
    <div>
      <label htmlFor={id} className={`${botonSecundario} cursor-pointer ${disabled || progreso !== null ? 'pointer-events-none opacity-50' : ''}`}>
        📎 {progreso !== null ? `Subiendo ${Math.round(progreso)} %` : 'Adjuntar evidencia'}
      </label>
      <input id={id} type="file" className="sr-only" disabled={disabled || progreso !== null} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx" onChange={subir} />
      {error && <p role="alert" className="mt-1 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

export function ListaEvidencias({ evidencias = [], onQuitar }) {
  if (!evidencias.length) return <p className="text-xs text-slate-500">Sin evidencias adjuntas.</p>;
  return (
    <ul className="space-y-1">
      {evidencias.map((evidencia, indice) => (
        <li key={`${evidencia.url}-${indice}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs">
          <a href={evidencia.url} target="_blank" rel="noopener noreferrer" className="truncate font-bold text-[#0055ff] hover:underline">{evidencia.nombre || evidencia.url}</a>
          {onQuitar && <button type="button" onClick={() => onQuitar(indice)} className="text-slate-400 hover:text-red-600" aria-label={`Quitar ${evidencia.nombre || 'evidencia'}`}>✕</button>}
        </li>
      ))}
    </ul>
  );
}

/** Correos sugeridos (catálogo de cargos con correo corporativo) para los campos de personas. */
export function SugerenciasCorreos({ id }) {
  const { catalogoCargos = [] } = useCatalogos();
  const correos = [...new Map(catalogoCargos.filter(registro => registro?.correoCorporativo)
    .map(registro => [String(registro.correoCorporativo).toLowerCase(), registro.cargo || ''])).entries()];
  return <datalist id={id}>{correos.map(([correo, cargo]) => <option key={correo} value={correo}>{cargo}</option>)}</datalist>;
}
