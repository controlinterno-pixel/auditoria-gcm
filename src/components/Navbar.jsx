import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, Bell, BellRing, ClipboardCheck, Monitor, Play } from 'lucide-react';

export default function Navbar({
  setIsPresentationMode,
  misTareasEjecucion = 0,
  misTareasRevision = 0,
  misTareasAprobacion = 0,
  onSelectTasks = () => false,
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);
  const campanaRef = useRef(null);
  const panelId = useId();
  const tareas = [
    { tipo: 'ejecucion', titulo: 'Ejecutar', cantidad: misTareasEjecucion, Icono: Play, color: 'bg-rose-50 text-rose-700' },
    { tipo: 'revision', titulo: 'Revisar', cantidad: misTareasRevision, Icono: ClipboardCheck, color: 'bg-amber-50 text-amber-800' },
    { tipo: 'aprobacion', titulo: 'Aprobar', cantidad: misTareasAprobacion, Icono: BadgeCheck, color: 'bg-emerald-50 text-emerald-800' },
  ].filter(tarea => tarea.cantidad > 0);
  const total = tareas.reduce((suma, tarea) => suma + tarea.cantidad, 0);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = event => {
      if (!contenedorRef.current?.contains(event.target)) setAbierto(false);
    };
    const cerrarTeclado = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setAbierto(false);
        campanaRef.current?.focus();
      }
    };
    contenedorRef.current?.querySelector('[data-task-action]')?.focus();
    document.addEventListener('pointerdown', cerrarFuera);
    document.addEventListener('keydown', cerrarTeclado);
    return () => {
      document.removeEventListener('pointerdown', cerrarFuera);
      document.removeEventListener('keydown', cerrarTeclado);
    };
  }, [abierto]);

  const irATareas = tipo => {
    if (onSelectTasks(tipo) !== false) setAbierto(false);
  };

return (
    <header className="bg-white border-b border-slate-200 px-3 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-[60] shadow-sm">
      
      {/* Espaciador izquierdo para mantener la píldora centrada */}
      <div className="hidden xl:block flex-1"></div>

      {/* Título Central Corporativo (Píldora con Logo) */}
      <div className="flex min-w-0 flex-1 justify-center xl:flex-none">
        <div className="bg-slate-50 border border-slate-200 rounded-full px-3 sm:px-6 py-2 flex min-w-0 items-center gap-3 shadow-sm">
          
          {/* LOGO DE TERMALES CON LA RUTA CORRECTA */}
          <img 
            src="/logo_termales.png" 
            alt="Logo Termales" 
            className="h-8 w-auto shrink-0 object-contain"
          />          
          <span className="hidden sm:block text-[10px] lg:text-xs font-black text-slate-700">
            Termales de Santa Rosa de Cabal — Sistema de Gestión Integral
          </span>
        </div>
      </div>

      {/* Botón Modo Presentación a la derecha */}
      <div className="flex shrink-0 items-center justify-end gap-3 xl:flex-1">
        <div ref={contenedorRef} className="relative">
          <button
            ref={campanaRef}
            type="button"
            title={total ? `${total} tareas pendientes` : 'Notificaciones: sin tareas pendientes'}
            aria-label={total ? `Notificaciones: ${total} tareas pendientes` : 'Notificaciones: sin tareas pendientes'}
            aria-expanded={abierto}
            aria-controls={panelId}
            onClick={() => tareas.length === 1 ? irATareas(tareas[0].tipo) : setAbierto(valor => !valor)}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${total ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-[0_0_12px_rgba(245,158,11,0.24)] hover:bg-amber-100' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
          >
            {total ? <BellRing key={total} size={21} aria-hidden="true" className="notification-bell-ring" /> : <Bell size={21} aria-hidden="true" />}
            {total > 0 && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">{total > 99 ? '99+' : total}</span>}
          </button>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{total} tareas pendientes</span>
          {abierto && (
            <section id={panelId} aria-label="Notificaciones de tareas" className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Pendientes por gestionar</h2>
                <span className="text-xs font-semibold tabular-nums text-slate-500">{total}</span>
              </div>
              {tareas.length ? tareas.map(({ tipo, titulo, cantidad, Icono, color }) => (
                <button key={tipo} type="button" data-task-action onClick={() => irATareas(tipo)} className="flex min-h-16 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}><Icono size={18} aria-hidden="true" /></span>
                  <span className="flex-1 text-sm font-semibold text-slate-800">{titulo}</span>
                  <span className="text-sm font-bold tabular-nums text-slate-900">{cantidad}</span>
                  <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-slate-400" />
                </button>
              )) : <p className="px-4 py-5 text-sm text-slate-600">No tienes tareas pendientes.</p>}
            </section>
          )}
        </div>
        <button
          type="button"
          title="Modo Presentación"
          aria-label="Activar modo presentación"
          onClick={() => setIsPresentationMode(true)}
          className="min-h-11 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-md flex items-center gap-2"
        >
          <Monitor size={16} aria-hidden="true" />
          <span className="hidden lg:inline">Modo Presentación</span>
        </button>
      </div>

    </header>
  );
}