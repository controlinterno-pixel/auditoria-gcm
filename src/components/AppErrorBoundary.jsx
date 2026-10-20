import { Component } from 'react';
import { isChunkLoadError, reloadPreservingContext } from '../services/appUpdate';

// 🛡️ Evita la pantalla en blanco: un error de render o de carga de módulo no debe parecer un cierre de sesión.
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[UI] Error capturado por AppErrorBoundary', {
      chunk: isChunkLoadError(error),
      name: error?.name || 'Error',
    });
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const esVersionNueva = isChunkLoadError(error);
    const contenedor = this.props.fullScreen
      ? 'min-h-screen bg-[#041224] flex items-center justify-center p-4'
      : 'flex items-center justify-center p-6 sm:p-12';

    return (
      <div className={contenedor} role="alert">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-xl text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">{esVersionNueva ? '🔄' : '⚠️'}</div>
          <h2 className="text-lg font-black text-slate-800">
            {esVersionNueva ? 'Hay una versión nueva de GCM' : 'No se pudo mostrar este módulo'}
          </h2>
          <p className="text-sm text-slate-600">
            {esVersionNueva
              ? 'Se publicó una actualización mientras trabajabas. Tu sesión sigue activa: al actualizar volverás a este mismo módulo.'
              : 'Ocurrió un error inesperado en la pantalla. Tu sesión sigue activa y tu información guardada no se ha perdido.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={reloadPreservingContext}
              className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
            >
              Actualizar ahora
            </button>
            {!esVersionNueva && (
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="min-h-11 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
