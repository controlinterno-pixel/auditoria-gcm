// src/components/proyectos/CronogramaProyecto.jsx - EDT, Gantt (con línea base y ruta crítica), hitos y
// comparación de fechas originales, vigentes y reales.
import { useMemo, useState } from 'react';
import { ESTADOS_CERRADOS_TAREA, ESTADOS_TAREA, TIPOS_CONTENEDOR, TIPOS_TAREA } from '../../utils/proyectos/modelo.js';
import { compararConLineaBase, holguras, idsContenedores } from '../../utils/proyectos/cronograma.js';
import { avancePorContenedor } from '../../utils/proyectos/indicadores.js';
import { diasEntre, esFecha } from '../../utils/proyectos/fechas.js';
import { fecha, fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import FormularioTarea from './FormularioTarea.jsx';
import { EstadoVacio, Insignia, Seccion, botonPrimario, botonSecundario } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';

/** EDT en orden jerárquico con numeración 1, 1.1, 1.1.1 y nivel de sangría. */
function arbol(tareas) {
  const hijos = new Map();
  tareas.forEach(tarea => {
    const padre = tarea.padreId && tareas.some(item => String(item.id) === String(tarea.padreId)) ? String(tarea.padreId) : '';
    hijos.set(padre, [...(hijos.get(padre) || []), tarea]);
  });
  const inicioEfectivo = tarea => tarea.inicio || (hijos.get(String(tarea.id)) || []).map(inicioEfectivo).filter(Boolean).sort()[0] || '';
  const ordenar = lista => [...lista].sort((a, b) => String(inicioEfectivo(a) || '9999').localeCompare(String(inicioEfectivo(b) || '9999')) || String(a.codigo).localeCompare(String(b.codigo)));
  const resultado = [];
  const recorrer = (padre, prefijo, nivel) => ordenar(hijos.get(padre) || []).forEach((tarea, indice) => {
    const numero = prefijo ? `${prefijo}.${indice + 1}` : String(indice + 1);
    resultado.push({ tarea, numero, nivel });
    recorrer(String(tarea.id), numero, nivel + 1);
  });
  recorrer('', '', 0);
  return resultado;
}

export default function CronogramaProyecto(props) {
  const { proyecto, plan, cap, operar, guardando, pedirTexto, hoy } = props;
  const [vista, setVista] = useState('gantt');
  const [abierta, setAbierta] = useState(null);
  const tareas = useMemo(() => (plan.tareas || []).filter(tarea => tarea.estado !== 'cancelada'), [plan.tareas]);
  const filas = useMemo(() => arbol(tareas), [tareas]);
  const contenedores = useMemo(() => idsContenedores(tareas), [tareas]);
  const avanceFases = useMemo(() => avancePorContenedor(tareas, proyecto.ficha?.calendario), [tareas, proyecto.ficha?.calendario]);
  const lineaBase = (plan.lineasBase || []).at(-1) || null;
  const conRutaCritica = proyecto.ficha?.metodologia !== 'agil';
  const holgura = useMemo(() => (conRutaCritica ? holguras(tareas) : new Map()), [tareas, conRutaCritica]);
  const comparacion = useMemo(() => new Map(compararConLineaBase(tareas, lineaBase).map(item => [String(item.id), item])), [tareas, lineaBase]);

  // Rango del Gantt: de la primera a la última fecha (vigente, línea base o real).
  const fechas = tareas.flatMap(tarea => [tarea.inicio, tarea.fin, comparacion.get(String(tarea.id))?.base?.inicio, comparacion.get(String(tarea.id))?.base?.fin]).filter(esFecha).sort();
  const desde = fechas[0];
  const hasta = fechas.at(-1);
  const totalDias = desde ? diasEntre(desde, hasta) + 1 : 0;
  const posicion = (inicio, fin) => ({ left: `${(diasEntre(desde, inicio) / totalDias) * 100}%`, width: `${Math.max(((diasEntre(inicio, fin) + 1) / totalDias) * 100, 0.8)}%` });
  const meses = [];
  if (desde) for (let mes = desde.slice(0, 7); mes <= hasta.slice(0, 7);) { meses.push(mes); const [a, m] = mes.split('-').map(Number); mes = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7); }

  const establecerLineaBase = async () => {
    const cambiosAprobados = (plan.cambios || []).filter(cambio => cambio.estado === 'aprobada');
    if (lineaBase && !cambiosAprobados.length) return;
    const motivo = await pedirTexto({ titulo: lineaBase ? `Nueva línea base (v${lineaBase.version + 1})` : 'Establecer la línea base', etiqueta: lineaBase ? `Motivo (se vinculará a ${cambiosAprobados[0].codigo})` : 'Motivo o acta que aprueba el cronograma', confirmar: 'Establecer' });
    if (motivo) await operar('establecerLineaBase', { motivo, idCambio: cambiosAprobados[0]?.id }, 'Línea base establecida.');
  };
  const cambiosAprobados = (plan.cambios || []).filter(cambio => cambio.estado === 'aprobada');
  const hitos = tareas.filter(tarea => tarea.tipo === 'hito').sort((a, b) => String(a.fin).localeCompare(String(b.fin)));

  return (
    <div className="space-y-4">
      <Seccion titulo="Cronograma y estructura de desglose del trabajo" descripcion={lineaBase
        ? `Línea base v${lineaBase.version} establecida por ${nombreDeCorreo(lineaBase.establecidaPor)} el ${fechaHora(lineaBase.fecha)}${lineaBase.motivo ? ` · ${lineaBase.motivo}` : ''}.`
        : 'Sin línea base: el avance planificado se mide con las fechas vigentes.'}
      acciones={(
        <>
          <div role="group" aria-label="Vista" className="flex rounded-lg border border-slate-300 p-0.5">
            {[['gantt', 'Gantt'], ['edt', 'EDT'], ['hitos', 'Hitos'], ['comparacion', 'Línea base']].map(([clave, texto]) => (
              <button key={clave} type="button" aria-pressed={vista === clave} onClick={() => setVista(clave)} className={`rounded-md px-2.5 py-1 text-xs font-black ${vista === clave ? 'bg-[#0055ff] text-white' : 'text-slate-600'}`}>{texto}</button>
            ))}
          </div>
          {cap.gestionar && (
            <>
              <button type="button" className={botonSecundario} onClick={() => setAbierta({ tipoInicial: 'fase' })}>＋ Fase / paquete</button>
              <button type="button" className={botonSecundario} onClick={() => setAbierta({ tipoInicial: 'hito' })}>＋ Hito</button>
              <button type="button" className={botonPrimario} onClick={() => setAbierta({ tipoInicial: 'actividad' })}>＋ Actividad</button>
              <button type="button" className={botonSecundario} disabled={guardando || !tareas.length || (lineaBase && !cambiosAprobados.length)} title={lineaBase && !cambiosAprobados.length ? 'Una nueva línea base requiere una solicitud de cambio aprobada.' : ''} onClick={establecerLineaBase}>
                {lineaBase ? 'Nueva línea base' : 'Establecer línea base'}
              </button>
            </>
          )}
        </>
      )}>
        {conRutaCritica && holgura.size > 0 && <p className="mb-3 text-[11px] text-slate-500">Ruta crítica (en rojo): actividades sin holgura; si se retrasan, se retrasa el fin del proyecto. Holgura en días calendario.</p>}
        {!tareas.length ? (
          <EstadoVacio titulo="Cronograma vacío" descripcion="Empieza por las fases o paquetes de trabajo y agrega sus actividades e hitos." />
        ) : vista === 'gantt' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[280px_1fr] border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                <div className="p-1">Actividad</div>
                <div className="relative h-6">{meses.map(mes => <span key={mes} className="absolute top-1 border-l border-slate-200 pl-1" style={{ left: `${(Math.max(diasEntre(desde, `${mes}-01`), 0) / totalDias) * 100}%` }}>{mes}</span>)}</div>
              </div>
              {filas.map(({ tarea, numero, nivel }) => {
                const esContenedor = contenedores.has(String(tarea.id)) || TIPOS_CONTENEDOR.includes(tarea.tipo);
                const base = comparacion.get(String(tarea.id))?.base;
                const critica = holgura.get(String(tarea.id)) <= 0 && !ESTADOS_CERRADOS_TAREA.includes(tarea.estado);
                const hijas = tareas.filter(item => String(item.padreId) === String(tarea.id) && esFecha(item.inicio));
                const inicio = esContenedor ? hijas.map(item => item.inicio).sort()[0] : tarea.inicio;
                const fin = esContenedor ? hijas.map(item => item.fin).sort().at(-1) : tarea.fin;
                const avance = esContenedor ? avanceFases.get(String(tarea.id)) : tarea.avance;
                return (
                  <div key={tarea.id} className="grid grid-cols-[280px_1fr] border-b border-slate-100 text-xs hover:bg-slate-50">
                    <button type="button" onClick={() => setAbierta(tarea)} className="truncate p-1.5 text-left" style={{ paddingLeft: `${8 + nivel * 14}px` }} title={`${tarea.titulo} · ${fecha(inicio)} → ${fecha(fin)} · ${avance ?? 0} %`}>
                      <span className="mr-1 text-slate-400">{numero}</span>
                      <span className={esContenedor ? 'font-black text-slate-800' : 'font-bold text-slate-700'}>{tarea.titulo}</span>
                      {critica && <span className="ml-1 text-[10px] font-black text-red-600">crítica</span>}
                    </button>
                    <div className="relative h-8">
                      {esFecha(hoy) && hoy >= desde && hoy <= hasta && <span className="absolute inset-y-0 w-px bg-[#0055ff]/60" style={{ left: `${(diasEntre(desde, hoy) / totalDias) * 100}%` }} aria-hidden="true" />}
                      {base && <span className="absolute bottom-1 h-1 rounded bg-slate-400/60" style={posicion(base.inicio, base.fin)} title={`Línea base: ${fecha(base.inicio)} → ${fecha(base.fin)}`} />}
                      {esFecha(inicio) && esFecha(fin) && (tarea.tipo === 'hito'
                        ? <span className="absolute top-1.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 bg-violet-600" style={{ left: `${(diasEntre(desde, inicio) / totalDias) * 100}%` }} title={`Hito: ${fecha(inicio)}`} />
                        : (
                          <span className={`absolute top-1.5 h-4 overflow-hidden rounded ${esContenedor ? 'bg-slate-700' : critica ? 'bg-red-200' : 'bg-blue-100'}`} style={posicion(inicio, fin)}>
                            <span className={`block h-full ${esContenedor ? 'bg-slate-900' : critica ? 'bg-red-500' : 'bg-[#0055ff]'}`} style={{ width: `${avance ?? 0}%` }} />
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
              <p className="mt-2 text-[11px] text-slate-500">Barra: fechas vigentes y avance · Línea gris: línea base · ◆ hito · Línea azul: hoy.</p>
            </div>
          </div>
        ) : vista === 'edt' ? (
          <ul className="divide-y divide-slate-100 text-xs">
            {filas.map(({ tarea, numero, nivel }) => (
              <li key={tarea.id} className="flex flex-wrap items-center gap-2 py-1.5" style={{ paddingLeft: `${nivel * 18}px` }}>
                <span className="w-12 text-slate-400">{numero}</span>
                <button type="button" onClick={() => setAbierta(tarea)} className="font-bold text-[#0055ff] hover:underline">{tarea.titulo}</button>
                <Insignia>{TIPOS_TAREA[tarea.tipo]}</Insignia>
                {!TIPOS_CONTENEDOR.includes(tarea.tipo) && <Insignia tono={TONO_ESTADO[tarea.estado]}>{ESTADOS_TAREA[tarea.estado]}</Insignia>}
                <span className="text-slate-500">{fecha(tarea.inicio)} → {fecha(tarea.fin)}</span>
                <span className="font-bold text-slate-700">{TIPOS_CONTENEDOR.includes(tarea.tipo) ? `${avanceFases.get(String(tarea.id)) ?? 0} %` : `${tarea.avance} %`}</span>
                {(tarea.dependencias || []).length > 0 && <span className="text-slate-500">Depende de: {tarea.dependencias.map(dep => tareas.find(item => String(item.id) === String(dep.id))?.codigo).filter(Boolean).join(', ')}</span>}
              </li>
            ))}
          </ul>
        ) : vista === 'hitos' ? (
          hitos.length ? (
            <ol className="relative space-y-3 border-l-2 border-violet-200 pl-4">
              {hitos.map(hito => {
                const base = comparacion.get(String(hito.id))?.base;
                const vencido = hito.estado !== 'completada' && hito.fin < hoy;
                return (
                  <li key={hito.id} className="text-sm">
                    <button type="button" onClick={() => setAbierta(hito)} className="font-black text-slate-800 hover:underline">◆ {hito.titulo}</button>
                    <p className="text-xs text-slate-600">
                      Vigente {fecha(hito.fin)}{base ? ` · Línea base ${fecha(base.fin)}` : ''}{hito.finReal ? ` · Cumplido ${fecha(hito.finReal)}` : ''}
                      {' '}<Insignia tono={hito.estado === 'completada' ? 'verde' : vencido ? 'rojo' : 'gris'}>{hito.estado === 'completada' ? (base && hito.finReal > base.fin ? 'Cumplido con atraso' : 'Cumplido') : vencido ? 'Vencido' : 'Pendiente'}</Insignia>
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : <EstadoVacio titulo="Sin hitos" descripcion="Los hitos marcan puntos de control (aprobaciones, entregas clave) y alimentan el indicador de cumplimiento." />
        ) : (
          !lineaBase ? <EstadoVacio titulo="Sin línea base" descripcion="Establécela cuando el cronograma esté aprobado para medir desviaciones sin perder la planificación original." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="border-b border-slate-200 text-left text-[10px] font-black uppercase text-slate-500"><tr><th className="p-2">Actividad</th><th className="p-2">Línea base</th><th className="p-2">Vigente</th><th className="p-2">Real</th><th className="p-2">Desviación del fin</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {[...comparacion.values()].filter(item => item.base || item.vigente).map(item => (
                    <tr key={item.id}>
                      <td className="p-2 font-bold">{item.titulo}</td>
                      <td className="p-2">{item.base ? `${fecha(item.base.inicio)} → ${fecha(item.base.fin)}` : 'Agregada después'}</td>
                      <td className="p-2">{item.vigente ? `${fecha(item.vigente.inicio)} → ${fecha(item.vigente.fin)}` : '—'}</td>
                      <td className="p-2">{item.real ? `${fecha(item.real.inicio)} → ${item.real.fin ? fecha(item.real.fin) : 'en curso'}` : '—'}</td>
                      <td className={`p-2 font-black ${item.atrasoDias > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{item.atrasoDias === null ? '—' : item.atrasoDias > 0 ? `+${item.atrasoDias} días` : item.atrasoDias < 0 ? `${item.atrasoDias} días` : 'A tiempo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(plan.lineasBase || []).length > 1 && <p className="mt-2 text-[11px] text-slate-500">Versiones anteriores: {(plan.lineasBase || []).slice(0, -1).map(lb => `v${lb.version} (${fecha(lb.fecha)})`).join(', ')}. Se conservan en el historial.</p>}
            </div>
          )
        )}
      </Seccion>
      {abierta && <FormularioTarea {...props} tarea={abierta.id ? abierta : null} tipoInicial={abierta.tipoInicial} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}
