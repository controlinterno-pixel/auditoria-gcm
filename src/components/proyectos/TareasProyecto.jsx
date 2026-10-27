// src/components/proyectos/TareasProyecto.jsx - Ejecución: tablero Kanban, lista y calendario con filtros.
import { useMemo, useState } from 'react';
import { ESTADOS_CERRADOS_TAREA, ESTADOS_TAREA, PRIORIDADES, TIPOS_CONTENEDOR, TIPOS_TAREA, normalizarCorreo } from '../../utils/proyectos/modelo.js';
import { fecha, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import FormularioTarea from './FormularioTarea.jsx';
import { Campo, EstadoVacio, Insignia, Seccion, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';
import { usePaginacion } from './useUiProyectos.jsx';

const COLUMNAS = ['pendiente', 'en_curso', 'bloqueada', 'en_revision', 'completada'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function TareasProyecto(props) {
  const { plan, cap, usuario, operar, hoy } = props;
  const [vista, setVista] = useState('kanban');
  const [filtros, setFiltros] = useState({ texto: '', responsable: '', prioridad: '', soloMias: false, vencidas: false, canceladas: false });
  const [abierta, setAbierta] = useState(null);
  const [mes, setMes] = useState(() => hoy.slice(0, 7));
  const correo = normalizarCorreo(usuario?.email);

  const tareas = useMemo(() => (plan.tareas || []).filter(tarea => !TIPOS_CONTENEDOR.includes(tarea.tipo)), [plan.tareas]);
  const responsables = [...new Set(tareas.map(tarea => tarea.responsable).filter(Boolean))].sort();
  const filtradas = useMemo(() => {
    const texto = filtros.texto.trim().toLowerCase();
    return tareas.filter(tarea => (filtros.canceladas || tarea.estado !== 'cancelada')
      && (!texto || `${tarea.codigo} ${tarea.titulo} ${tarea.descripcion}`.toLowerCase().includes(texto))
      && (!filtros.responsable || tarea.responsable === filtros.responsable)
      && (!filtros.prioridad || tarea.prioridad === filtros.prioridad)
      && (!filtros.soloMias || normalizarCorreo(tarea.responsable) === correo || (tarea.colaboradores || []).includes(correo))
      && (!filtros.vencidas || (!ESTADOS_CERRADOS_TAREA.includes(tarea.estado) && tarea.fin && tarea.fin < hoy)));
  }, [tareas, filtros, correo, hoy]);
  const { visibles, controles } = usePaginacion(filtradas, 20);

  const puedeMover = tarea => cap.gestionar || (cap.aportar && (normalizarCorreo(tarea.responsable) === correo || (tarea.colaboradores || []).includes(correo)));
  const mover = (tarea, estado) => {
    if (estado === 'completada' && tarea.requiereRevision) estado = 'en_revision';
    const avance = ['completada', 'en_revision'].includes(estado) ? 100 : estado === 'pendiente' ? 0 : Math.min(Number(tarea.avance) || 0, 95);
    void operar('guardarTarea', { tarea: { id: tarea.id, versionBase: tarea.version, estado, avance: estado === 'en_curso' && !avance ? 5 : avance } }, `${tarea.codigo}: ${ESTADOS_TAREA[estado]}.`);
  };
  const vencida = tarea => !ESTADOS_CERRADOS_TAREA.includes(tarea.estado) && tarea.fin && tarea.fin < hoy;
  const cambiarFiltro = campo => evento => setFiltros(actual => ({ ...actual, [campo]: evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value }));

  const tarjeta = tarea => (
    <article key={tarea.id} className={`rounded-xl border bg-white p-2.5 text-xs shadow-sm ${vencida(tarea) ? 'border-red-300' : 'border-slate-200'}`}>
      <button type="button" onClick={() => setAbierta(tarea)} className="w-full text-left">
        <p className="font-black text-slate-800">{tarea.titulo}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{tarea.codigo} · {TIPOS_TAREA[tarea.tipo]} · {nombreDeCorreo(tarea.responsable)}</p>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Insignia tono={tarea.prioridad === 'critica' || tarea.prioridad === 'alta' ? 'rojo' : 'gris'}>{PRIORIDADES[tarea.prioridad]}</Insignia>
        {tarea.fin && <Insignia tono={vencida(tarea) ? 'rojo' : 'gris'}>{vencida(tarea) ? 'Vencida ' : 'Fin '}{fecha(tarea.fin)}</Insignia>}
        {tarea.requiereRevision && <Insignia tono="morado">Con revisión</Insignia>}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={tarea.avance} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance de ${tarea.titulo}`}>
        <div className="h-1.5 rounded-full bg-[#0055ff]" style={{ width: `${tarea.avance}%` }} />
      </div>
      {tarea.estado === 'bloqueada' && tarea.motivoBloqueo && <p className="mt-1 text-[11px] font-bold text-red-700">⛔ {tarea.motivoBloqueo}</p>}
      {puedeMover(tarea) && tarea.estado !== 'en_revision' && (
        <label className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">Mover a
          <select className="rounded border border-slate-200 px-1 py-0.5 text-[11px]" value="" onChange={evento => evento.target.value && (evento.target.value === 'bloqueada' ? setAbierta({ ...tarea, estado: 'bloqueada' }) : mover(tarea, evento.target.value))}>
            <option value="">…</option>
            {COLUMNAS.filter(estado => estado !== tarea.estado && estado !== 'en_revision').map(estado => <option key={estado} value={estado}>{ESTADOS_TAREA[estado]}</option>)}
          </select>
        </label>
      )}
    </article>
  );

  // Calendario: cada tarea aparece el día en que vence (fin previsto).
  const [anio, numeroMes] = mes.split('-').map(Number);
  const primerDia = new Date(Date.UTC(anio, numeroMes - 1, 1));
  const desplazamiento = (primerDia.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();
  const celdas = [...Array(desplazamiento).fill(null), ...Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)];
  const moverMes = delta => { const fechaMes = new Date(Date.UTC(anio, numeroMes - 1 + delta, 1)); setMes(fechaMes.toISOString().slice(0, 7)); };

  return (
    <div className="space-y-4">
      <Seccion titulo="Tareas" descripcion={`${filtradas.length} de ${tareas.length} tarea(s) e hitos.`} acciones={(
        <>
          <div role="group" aria-label="Vista" className="flex rounded-lg border border-slate-300 p-0.5">
            {[['kanban', 'Kanban'], ['lista', 'Lista'], ['calendario', 'Calendario']].map(([clave, texto]) => (
              <button key={clave} type="button" aria-pressed={vista === clave} onClick={() => setVista(clave)} className={`rounded-md px-2.5 py-1 text-xs font-black ${vista === clave ? 'bg-[#0055ff] text-white' : 'text-slate-600'}`}>{texto}</button>
            ))}
          </div>
          {cap.gestionar && <button type="button" className={botonPrimario} onClick={() => setAbierta('nueva')}>＋ Nueva tarea</button>}
        </>
      )}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Campo etiqueta="Buscar" className="lg:col-span-2">{p => <input {...p} type="search" className={claseCampo} value={filtros.texto} onChange={cambiarFiltro('texto')} />}</Campo>
          <Campo etiqueta="Responsable">{p => <select {...p} className={claseCampo} value={filtros.responsable} onChange={cambiarFiltro('responsable')}><option value="">Todos</option>{responsables.map(r => <option key={r} value={r}>{nombreDeCorreo(r)}</option>)}</select>}</Campo>
          <Campo etiqueta="Prioridad">{p => <select {...p} className={claseCampo} value={filtros.prioridad} onChange={cambiarFiltro('prioridad')}><option value="">Todas</option>{Object.entries(PRIORIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
          <div className="flex flex-col justify-end gap-1 text-xs font-bold text-slate-600 lg:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={filtros.soloMias} onChange={cambiarFiltro('soloMias')} /> Solo mis tareas</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={filtros.vencidas} onChange={cambiarFiltro('vencidas')} /> Solo vencidas</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={filtros.canceladas} onChange={cambiarFiltro('canceladas')} /> Incluir canceladas</label>
          </div>
        </div>
      </Seccion>

      {!tareas.length ? (
        <EstadoVacio titulo="Sin tareas" descripcion={cap.gestionar ? 'Crea las fases y actividades desde la pestaña Cronograma, o una tarea aquí.' : 'El director aún no registra tareas.'} />
      ) : vista === 'kanban' ? (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-5">
          {COLUMNAS.map(estado => {
            const columna = filtradas.filter(tarea => tarea.estado === estado);
            return (
              <section key={estado} aria-label={ESTADOS_TAREA[estado]} className="min-w-[220px] rounded-2xl bg-slate-100 p-2">
                <h4 className="mb-2 flex items-center justify-between px-1 text-xs font-black text-slate-700">{ESTADOS_TAREA[estado]} <span className="rounded-full bg-white px-2 text-[11px]">{columna.length}</span></h4>
                <div className="space-y-2">{columna.map(tarjeta)}</div>
              </section>
            );
          })}
        </div>
      ) : vista === 'lista' ? (
        <Seccion>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="border-b border-slate-200 text-left text-[10px] font-black uppercase text-slate-500"><tr><th className="p-2">Código</th><th className="p-2">Tarea</th><th className="p-2">Responsable</th><th className="p-2">Estado</th><th className="p-2">Avance</th><th className="p-2">Inicio</th><th className="p-2">Fin</th><th className="p-2">Prioridad</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibles.map(tarea => (
                  <tr key={tarea.id} className="hover:bg-slate-50">
                    <td className="p-2 font-black">{tarea.codigo}</td>
                    <td className="p-2"><button type="button" className="text-left font-bold text-[#0055ff] hover:underline" onClick={() => setAbierta(tarea)}>{tarea.titulo}</button></td>
                    <td className="p-2">{nombreDeCorreo(tarea.responsable)}</td>
                    <td className="p-2"><Insignia tono={TONO_ESTADO[tarea.estado]}>{ESTADOS_TAREA[tarea.estado]}</Insignia></td>
                    <td className="p-2 font-bold">{tarea.avance} %</td>
                    <td className="p-2">{fecha(tarea.inicio)}</td>
                    <td className={`p-2 ${vencida(tarea) ? 'font-black text-red-600' : ''}`}>{fecha(tarea.fin)}</td>
                    <td className="p-2">{PRIORIDADES[tarea.prioridad]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {controles}
        </Seccion>
      ) : (
        <Seccion titulo={primerDia.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })} descripcion="Cada tarea aparece el día en que vence." acciones={(
          <><button type="button" className={botonSecundario} onClick={() => moverMes(-1)} aria-label="Mes anterior">←</button><button type="button" className={botonSecundario} onClick={() => setMes(hoy.slice(0, 7))}>Hoy</button><button type="button" className={botonSecundario} onClick={() => moverMes(1)} aria-label="Mes siguiente">→</button></>
        )}>
          <div className="grid grid-cols-7 gap-1 text-[11px]">
            {DIAS.map(dia => <div key={dia} className="p-1 text-center font-black text-slate-500">{dia}</div>)}
            {celdas.map((dia, indice) => (
              <div key={dia || `vacio-${indice}`} className={`min-h-20 rounded-lg border p-1 ${!dia ? 'border-transparent' : dia === hoy ? 'border-[#0055ff] bg-blue-50' : 'border-slate-200 bg-white'}`}>
                {dia && <p className="font-bold text-slate-500">{Number(dia.slice(8))}</p>}
                {dia && filtradas.filter(tarea => tarea.fin === dia).map(tarea => (
                  <button key={tarea.id} type="button" onClick={() => setAbierta(tarea)} className={`mt-0.5 block w-full truncate rounded px-1 text-left font-bold ${tarea.tipo === 'hito' ? 'bg-violet-100 text-violet-800' : vencida(tarea) ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`} title={tarea.titulo}>
                    {tarea.tipo === 'hito' ? '◆ ' : ''}{tarea.titulo}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {abierta && <FormularioTarea {...props} tarea={abierta === 'nueva' ? null : abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}
