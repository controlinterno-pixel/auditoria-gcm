import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { DeleteConfirmationContext } from '../hooks/useDeleteConfirmation.js';

function DeleteDialog({ solicitud, responder }) {
  const dialogRef = useRef(null);
  const cancelarRef = useRef(null);

  useEffect(() => {
    const anterior = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    cancelarRef.current.focus();
    return () => {
      dialog.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="eliminar-titulo"
      aria-describedby="eliminar-detalle eliminar-advertencia"
      onCancel={event => { event.preventDefault(); responder(false); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-3xl border border-rose-200 bg-white p-0 text-slate-800 shadow-[0_24px_90px_-16px_rgba(136,19,55,0.5)] backdrop:bg-slate-950/65 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-rose-200 bg-rose-50 px-6 py-4 sm:px-8 sm:py-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-700 shadow-sm">
          <Trash2 size={30} aria-hidden="true" />
        </span>
        <button type="button" onClick={() => responder(false)} aria-label="Cancelar eliminación" className="flex h-11 w-11 items-center justify-center rounded-full text-rose-800 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="px-6 py-5 sm:px-8 sm:py-7">
        <h2 id="eliminar-titulo" className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">¿Estás seguro de que deseas eliminar?</h2>
        <p id="eliminar-detalle" className="mt-4 whitespace-pre-line break-words text-base leading-relaxed text-slate-700">{solicitud.detalle}</p>
        <div id="eliminar-advertencia" className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle size={23} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-relaxed"><strong className="block font-semibold">Esta acción no se puede deshacer.</strong>Una vez eliminado, no podrás recuperar este archivo o registro desde la aplicación.</p>
        </div>
      </div>
      <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end sm:px-8 sm:py-5">
        <button ref={cancelarRef} type="button" onClick={() => responder(false)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600">Cancelar, conservar</button>
        <button type="button" onClick={() => responder(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-rose-800 bg-rose-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"><Trash2 size={18} aria-hidden="true" />Sí, eliminar</button>
      </footer>
    </dialog>,
    document.body,
  );
}

export function DeleteConfirmationProvider({ children }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const pendientes = useRef(new Set());
  const consecutivo = useRef(0);
  const confirmarEliminacion = useCallback(detalle => new Promise(resolve => {
    const solicitud = { id: ++consecutivo.current, detalle, resolve };
    pendientes.current.add(solicitud);
    setSolicitudes(actuales => [...actuales, solicitud]);
  }), []);

  useEffect(() => () => {
    pendientes.current.forEach(solicitud => solicitud.resolve(false));
    pendientes.current.clear();
  }, []);

  const actual = solicitudes[0];
  const responder = confirmado => {
    if (!pendientes.current.delete(actual)) return;
    actual.resolve(confirmado);
    setSolicitudes(actuales => actuales.filter(item => item !== actual));
  };

  return (
    <DeleteConfirmationContext.Provider value={confirmarEliminacion}>
      {children}
      {actual && <DeleteDialog key={actual.id} solicitud={actual} responder={responder} />}
    </DeleteConfirmationContext.Provider>
  );
}
