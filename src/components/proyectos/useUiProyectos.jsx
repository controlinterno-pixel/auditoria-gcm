// src/components/proyectos/useUiProyectos.jsx - Hooks de interfaz del módulo (diálogo de texto y paginación).
import { useState } from 'react';
import { Campo, Modal, botonPeligro, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

/** Pide un texto obligatorio (motivo, comentario) antes de una acción; devuelve null si se cancela. */
export function useDialogoTexto() {
  const [dialogo, setDialogo] = useState(null);
  const pedir = ({ titulo, etiqueta, obligatorio = true, confirmar = 'Confirmar', peligro = false }) => new Promise(resolver => setDialogo({ titulo, etiqueta, obligatorio, confirmar, peligro, resolver, valor: '' }));
  const cerrar = valor => { dialogo?.resolver(valor); setDialogo(null); };
  const elemento = dialogo && (
    <Modal titulo={dialogo.titulo} ancho="max-w-lg" onCerrar={() => cerrar(null)} pie={(
      <>
        <button type="button" className={botonSecundario} onClick={() => cerrar(null)}>Cancelar</button>
        <button type="button" className={dialogo.peligro ? botonPeligro : botonPrimario} disabled={dialogo.obligatorio && !dialogo.valor.trim()} onClick={() => cerrar(dialogo.valor.trim())}>{dialogo.confirmar}</button>
      </>
    )}>
      <Campo etiqueta={dialogo.etiqueta} obligatorio={dialogo.obligatorio}>
        {props => <textarea {...props} rows={4} className={claseCampo} value={dialogo.valor} onChange={evento => setDialogo(actual => ({ ...actual, valor: evento.target.value }))} />}
      </Campo>
    </Modal>
  );
  return [pedir, elemento];
}

/** Paginación simple de tablas. */
export function usePaginacion(items, porPagina = 15) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(items.length / porPagina));
  const actual = Math.min(pagina, total);
  const visibles = items.slice((actual - 1) * porPagina, actual * porPagina);
  const controles = total > 1 && (
    <nav className="mt-3 flex items-center justify-end gap-2 text-xs" aria-label="Paginación">
      <button type="button" className={botonSecundario} disabled={actual === 1} onClick={() => setPagina(actual - 1)}>Anterior</button>
      <span className="font-bold text-slate-600">Página {actual} de {total}</span>
      <button type="button" className={botonSecundario} disabled={actual === total} onClick={() => setPagina(actual + 1)}>Siguiente</button>
    </nav>
  );
  return { visibles, controles, reiniciar: () => setPagina(1) };
}
