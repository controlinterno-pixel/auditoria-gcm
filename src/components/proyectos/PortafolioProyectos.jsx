// src/components/proyectos/PortafolioProyectos.jsx - Tablero ejecutivo del portafolio con filtros reales,
// indicadores que filtran sus registros, excepciones priorizadas y tabla paginada.
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ESTADOS_ACTIVOS, ESTADOS_PROYECTO, METODOLOGIAS } from '../../utils/proyectos/modelo.js';
import { FORMULAS, calcularIndicadores } from '../../utils/proyectos/indicadores.js';
import { hoyColombia } from '../../utils/proyectos/fechas.js';
import { fecha, moneda, nombreDeCorreo, porcentaje, puntos } from '../../utils/proyectos/formato.js';
import { exportToExcel } from '../../services/grcStorageService';
import { CATEGORIAS_LECCION, PILARES } from '../../utils/proyectos/metodologia.js';
import LeccionesAprendidas from './LeccionesAprendidas.jsx';
import { Campo, EstadoVacio, Insignia, Kpi, Seccion, Semaforo, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';
import { usePaginacion } from './useUiProyectos.jsx';

const FILTROS_INICIALES = { texto: '', anio: '', pilar: '', area: '', director: '', metodologia: '', estado: 'activos', semaforo: '' };
const ORDEN_SEMAFORO = { rojo: 0, amarillo: 1, verde: 2, gris: 3 };

// Cada indicador del tablero lleva a los proyectos que lo componen.
const FILTROS_KPI = {
  riesgo: { titulo: 'en riesgo o con desviación crítica', cumple: p => p.ind.semaforo.color === 'rojo' },
  hitosVencidos: { titulo: 'con hitos vencidos', cumple: p => p.ind.hitosVencidos > 0 },
  hitosProximos: { titulo: 'con hitos próximos a vencer', cumple: p => p.ind.hitosProximos > 0 },
  tareasVencidas: { titulo: 'con tareas vencidas', cumple: p => p.ind.tareasVencidas > 0 },
  bloqueadas: { titulo: 'con tareas bloqueadas', cumple: p => p.ind.tareasBloqueadas > 0 },
  riesgosCriticos: { titulo: 'con riesgos críticos abiertos', cumple: p => p.ind.riesgosCriticos > 0 },
  entregables: { titulo: 'con entregables por aprobar', cumple: p => p.ind.entregablesPendientesAprobacion > 0 },
  sinActualizar: { titulo: 'sin actualización reciente', cumple: p => p.ind.semaforo.motivos.some(motivo => motivo.startsWith('Sin actualizaciones')) },
  acciones: { titulo: 'con acciones correctivas pendientes', cumple: p => p.ind.accionesPendientes > 0 },
  sobrecosto: { titulo: 'con sobrecosto proyectado', cumple: p => p.ind.variacionPresupuestal !== null && p.ind.variacionPresupuestal > 0 },
};

const traslapa = (proyecto, anio) => !anio || (String(proyecto.ficha?.inicioPlanificado || '').slice(0, 4) <= anio && String(proyecto.ind.finVigente || proyecto.ficha?.finPlanificado || '9999').slice(0, 4) >= anio);

export default function PortafolioProyectos({ proyectos, hoy: hoyServidor, cargando, error, onAbrir, onNuevo, puedeCrear, incluirArchivados, setIncluirArchivados, onRecargar }) {
  const hoy = hoyServidor || hoyColombia();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [kpi, setKpi] = useState('');
  const [orden, setOrden] = useState({ campo: 'semaforo', asc: true });
  const [verLecciones, setVerLecciones] = useState(false);

  const conIndicadores = useMemo(() => proyectos.map(proyecto => ({ ...proyecto, ind: calcularIndicadores(proyecto, hoy) })), [proyectos, hoy]);
  const opciones = useMemo(() => ({
    anios: [...new Set(conIndicadores.flatMap(p => [String(p.ficha?.inicioPlanificado || '').slice(0, 4), String(p.ind.finVigente || '').slice(0, 4)]).filter(Boolean))].sort(),
    areas: [...new Set(conIndicadores.map(p => p.ficha?.area).filter(Boolean))].sort(),
    directores: [...new Set(conIndicadores.map(p => p.miembros?.director).filter(Boolean))].sort(),
  }), [conIndicadores]);

  const filtrados = useMemo(() => {
    const texto = filtros.texto.trim().toLowerCase();
    return conIndicadores.filter(p => (!texto || `${p.codigo} ${p.codigoEstrategico || ''} ${p.ficha?.nombre} ${p.ficha?.portafolio} ${p.ficha?.programa}`.toLowerCase().includes(texto))
      && traslapa(p, filtros.anio)
      && (!filtros.pilar || p.ficha?.pilar === filtros.pilar)
      && (!filtros.area || p.ficha?.area === filtros.area)
      && (!filtros.director || p.miembros?.director === filtros.director)
      && (!filtros.metodologia || p.ficha?.metodologia === filtros.metodologia)
      && (!filtros.estado || (filtros.estado === 'activos' ? ESTADOS_ACTIVOS.includes(p.estado) : p.estado === filtros.estado))
      && (!filtros.semaforo || p.ind.semaforo.color === filtros.semaforo));
  }, [conIndicadores, filtros]);

  const t = useMemo(() => {
    const suma = campo => filtrados.reduce((total, p) => total + (p.ind[campo] || 0), 0);
    const hitosEvaluables = suma('hitosEvaluables');
    const conHitos = filtrados.filter(p => p.ind.cumplimientoHitos !== null);
    const conPresupuesto = filtrados.filter(p => p.ind.maneja && p.ind.presupuestoVigente);
    const monedas = [...new Set(conPresupuesto.map(p => p.ficha?.moneda || 'COP'))];
    const conAvance = filtrados.filter(p => p.ind.avanceReal !== null && p.ind.avancePlanificado !== null);
    return {
      total: filtrados.length,
      porEstado: Object.fromEntries(Object.keys(ESTADOS_PROYECTO).map(estado => [estado, filtrados.filter(p => p.estado === estado).length])),
      enRiesgo: filtrados.filter(FILTROS_KPI.riesgo.cumple).length,
      hitosOk: conHitos.length ? conHitos.filter(p => p.ind.hitosVencidos === 0 && p.ind.cumplimientoHitos === 100).length : null,
      conHitos: conHitos.length,
      hitosEvaluables,
      avanceReal: conAvance.length ? conAvance.reduce((s, p) => s + p.ind.avanceReal, 0) / conAvance.length : null,
      avancePlan: conAvance.length ? conAvance.reduce((s, p) => s + p.ind.avancePlanificado, 0) / conAvance.length : null,
      conAvance: conAvance.length,
      hitosVencidos: suma('hitosVencidos'), hitosProximos: suma('hitosProximos'),
      tareasAbiertas: suma('tareasAbiertas'), tareasBloqueadas: suma('tareasBloqueadas'), tareasVencidas: suma('tareasVencidas'),
      riesgosCriticos: suma('riesgosCriticos'), entregables: suma('entregablesPendientesAprobacion'), acciones: suma('accionesPendientes'),
      sinActualizar: filtrados.filter(FILTROS_KPI.sinActualizar.cumple).length,
      // Solo se suman presupuestos de una misma moneda: mezclar COP con USD daría una cifra sin sentido.
      monedaUnica: monedas.length === 1 ? monedas[0] : null,
      presupuesto: monedas.length === 1 ? conPresupuesto.reduce((s, p) => s + p.ind.presupuestoVigente, 0) : null,
      real: monedas.length === 1 ? conPresupuesto.reduce((s, p) => s + p.ind.costoReal, 0) : null,
      comprometido: monedas.length === 1 ? conPresupuesto.reduce((s, p) => s + p.ind.costoComprometido, 0) : null,
      conPresupuesto: conPresupuesto.length,
    };
  }, [filtrados]);

  const tabla = useMemo(() => {
    const lista = kpi ? filtrados.filter(FILTROS_KPI[kpi].cumple) : filtrados;
    const valor = p => ({
      semaforo: ORDEN_SEMAFORO[p.ind.semaforo.color], codigo: p.codigoEstrategico || p.codigo, nombre: p.ficha?.nombre || '', estado: p.estado,
      avance: p.ind.avanceReal ?? -1, desviacion: p.ind.desviacionAvance ?? 999, fin: p.ind.finVigente || '9999', actualizado: p.actualizadoEn || '',
    }[orden.campo]);
    return [...lista].sort((a, b) => (valor(a) > valor(b) ? 1 : valor(a) < valor(b) ? -1 : 0) * (orden.asc ? 1 : -1));
  }, [filtrados, kpi, orden]);
  const { visibles, controles } = usePaginacion(tabla, 12);

  const excepciones = useMemo(() => filtrados.filter(p => ['rojo', 'amarillo'].includes(p.ind.semaforo.color))
    .sort((a, b) => ORDEN_SEMAFORO[a.ind.semaforo.color] - ORDEN_SEMAFORO[b.ind.semaforo.color] || (a.ind.desviacionAvance ?? 0) - (b.ind.desviacionAvance ?? 0)).slice(0, 8), [filtrados]);

  const graficoAvance = filtrados.filter(p => p.ind.avanceReal !== null && ESTADOS_ACTIVOS.includes(p.estado)).slice(0, 12)
    .map(p => ({ nombre: p.codigo, Planificado: p.ind.avancePlanificado, Real: p.ind.avanceReal }));
  const graficoFinalizaciones = Object.entries(filtrados.filter(p => ESTADOS_ACTIVOS.includes(p.estado) && p.ind.finVigente)
    .reduce((meses, p) => ({ ...meses, [p.ind.finVigente.slice(0, 7)]: (meses[p.ind.finVigente.slice(0, 7)] || 0) + 1 }), {}))
    .sort(([a], [b]) => a.localeCompare(b)).slice(0, 12).map(([mes, cantidad]) => ({ mes, Proyectos: cantidad }));

  const cambiarFiltro = campo => evento => { setFiltros(actual => ({ ...actual, [campo]: evento.target.value })); };
  const alternarKpi = clave => setKpi(actual => (actual === clave ? '' : clave));
  const ordenarPor = campo => setOrden(actual => ({ campo, asc: actual.campo === campo ? !actual.asc : true }));
  const filtrosActivos = Object.entries(filtros).filter(([clave, valor]) => valor && valor !== FILTROS_INICIALES[clave]);

  const exportar = () => exportToExcel(tabla.map(p => ({
    Código: p.codigo, 'Código portafolio': p.codigoEstrategico || '', Pilar: PILARES[p.ficha?.pilar] || '', Proyecto: p.ficha?.nombre, Estado: ESTADOS_PROYECTO[p.estado], Metodología: METODOLOGIAS[p.ficha?.metodologia], Área: p.ficha?.area || '',
    Director: p.miembros?.director, 'Avance real (%)': p.ind.avanceReal ?? 'Sin datos', 'Avance planificado (%)': p.ind.avancePlanificado ?? 'Sin datos',
    'Desviación (p. p.)': p.ind.desviacionAvance ?? 'Sin datos', Semáforo: p.ind.semaforo.color, Motivos: p.ind.semaforo.motivos.join(' '),
    'Fin vigente': p.ind.finVigente, 'Hitos vencidos': p.ind.hitosVencidos, 'Tareas vencidas': p.ind.tareasVencidas, 'Riesgos críticos': p.ind.riesgosCriticos,
    'Presupuesto vigente': p.ind.presupuestoVigente ?? 'No maneja', 'Costo real': p.ind.costoReal ?? 'No maneja',
    'Generado el': new Date().toLocaleString('es-CO'), 'Filtros': filtrosActivos.map(([c, v]) => `${c}=${v}`).join('; ') || 'Ninguno', 'Origen': 'GCM · Gestión de proyectos',
  })), 'Portafolio_proyectos');

  const encabezado = (campo, texto) => (
    <th scope="col" className="p-2 text-left">
      <button type="button" onClick={() => ordenarPor(campo)} className="font-black uppercase tracking-wide text-slate-500 hover:text-slate-800" aria-label={`Ordenar por ${texto}`}>
        {texto}{orden.campo === campo ? (orden.asc ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">📁 Gestión de Proyectos</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">Portafolio, cronogramas, entregables, riesgos, cambios y presupuesto con trazabilidad.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botonSecundario} onClick={onRecargar} disabled={cargando}>↻ Actualizar</button>
          <button type="button" className={botonSecundario} onClick={() => setVerLecciones(true)}>📚 Lecciones aprendidas</button>
          <button type="button" className={botonSecundario} onClick={exportar} disabled={!tabla.length}>⬇ Exportar Excel</button>
          {puedeCrear && <button type="button" className={botonPrimario} onClick={onNuevo}>＋ Nuevo proyecto</button>}
        </div>
      </div>

      <Seccion titulo="Filtros" descripcion="Afectan todos los indicadores, gráficos y la tabla.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-9">
          <Campo etiqueta="Buscar" className="col-span-2">{props => <input {...props} type="search" className={claseCampo} value={filtros.texto} onChange={cambiarFiltro('texto')} placeholder="Código, nombre, portafolio…" />}</Campo>
          <Campo etiqueta="Año">{props => <select {...props} className={claseCampo} value={filtros.anio} onChange={cambiarFiltro('anio')}><option value="">Todos</option>{opciones.anios.map(a => <option key={a}>{a}</option>)}</select>}</Campo>
          <Campo etiqueta="Pilar">{props => <select {...props} className={claseCampo} value={filtros.pilar} onChange={cambiarFiltro('pilar')}><option value="">Todos</option>{Object.entries(PILARES).map(([v, tx]) => <option key={v} value={v}>{v} · {tx}</option>)}</select>}</Campo>
          <Campo etiqueta="Área">{props => <select {...props} className={claseCampo} value={filtros.area} onChange={cambiarFiltro('area')}><option value="">Todas</option>{opciones.areas.map(a => <option key={a}>{a}</option>)}</select>}</Campo>
          <Campo etiqueta="Director">{props => <select {...props} className={claseCampo} value={filtros.director} onChange={cambiarFiltro('director')}><option value="">Todos</option>{opciones.directores.map(d => <option key={d} value={d}>{nombreDeCorreo(d)}</option>)}</select>}</Campo>
          <Campo etiqueta="Metodología">{props => <select {...props} className={claseCampo} value={filtros.metodologia} onChange={cambiarFiltro('metodologia')}><option value="">Todas</option>{Object.entries(METODOLOGIAS).map(([v, tx]) => <option key={v} value={v}>{tx}</option>)}</select>}</Campo>
          <Campo etiqueta="Estado">{props => <select {...props} className={claseCampo} value={filtros.estado} onChange={cambiarFiltro('estado')}><option value="activos">Activos</option><option value="">Todos</option>{Object.entries(ESTADOS_PROYECTO).map(([v, tx]) => <option key={v} value={v}>{tx}</option>)}</select>}</Campo>
          <Campo etiqueta="Nivel de riesgo">{props => <select {...props} className={claseCampo} value={filtros.semaforo} onChange={cambiarFiltro('semaforo')}><option value="">Todos</option><option value="rojo">Crítico</option><option value="amarillo">Con alertas</option><option value="verde">En control</option><option value="gris">Sin evaluar</option></select>}</Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2 font-bold text-slate-600"><input type="checkbox" checked={incluirArchivados} onChange={evento => setIncluirArchivados(evento.target.checked)} /> Incluir archivados</label>
          {filtrosActivos.length > 0 && <button type="button" className="font-bold text-[#0055ff] hover:underline" onClick={() => { setFiltros(FILTROS_INICIALES); setKpi(''); }}>Limpiar filtros</button>}
        </div>
      </Seccion>

      {verLecciones && <LeccionesAprendidas categorias={CATEGORIAS_LECCION} onCerrar={() => setVerLecciones(false)} />}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      {cargando && !proyectos.length && <p role="status" className="text-sm font-bold text-slate-500">Cargando portafolio…</p>}

      {!cargando && !error && !proyectos.length ? (
        <EstadoVacio titulo="Aún no tienes proyectos" descripcion="Aquí verás los proyectos donde eres director, patrocinador, aprobador, integrante del equipo o lector."
          accion={puedeCrear && <button type="button" className={botonPrimario} onClick={onNuevo}>Crear el primer proyecto</button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Kpi titulo="Proyectos" valor={t.total} detalle={`Preinversión ${t.porEstado.propuesto + t.porEstado.factibilidad} · Inversión ${t.porEstado.planificacion + t.porEstado.ejecucion} · Operación ${t.porEstado.operacion} · Susp. ${t.porEstado.suspendido} · Cerr. ${t.porEstado.cerrado}`} />
            <Kpi titulo="En riesgo crítico" valor={t.enRiesgo} tono={t.enRiesgo ? 'rojo' : 'verde'} onClick={() => alternarKpi('riesgo')} activo={kpi === 'riesgo'} formula="Proyectos con semáforo rojo: atraso crítico, hitos vencidos, riesgos críticos o sobrecosto." />
            <Kpi titulo="Cumplen sus hitos" valor={t.hitosOk === null ? 'Sin datos' : `${t.hitosOk} de ${t.conHitos}`} detalle={t.hitosOk === null ? 'Ningún hito evaluable aún' : `${t.hitosEvaluables} hitos evaluables`} formula={FORMULAS.cumplimientoHitos} />
            <Kpi titulo="Avance real vs. plan" valor={t.avanceReal === null ? 'Sin datos' : `${porcentaje(t.avanceReal)} / ${porcentaje(t.avancePlan)}`} detalle={t.conAvance ? `Promedio de ${t.conAvance} proyecto(s)` : 'Sin cronogramas con fechas'} tono={t.avanceReal !== null && t.avanceReal < t.avancePlan - 5 ? 'amarillo' : 'gris'} formula={`${FORMULAS.avanceReal} ${FORMULAS.avancePlanificado}`} />
            <Kpi titulo="Hitos vencidos" valor={t.hitosVencidos} detalle={`${t.hitosProximos} próximos a vencer`} tono={t.hitosVencidos ? 'rojo' : 'gris'} onClick={() => alternarKpi('hitosVencidos')} activo={kpi === 'hitosVencidos'} />
            <Kpi titulo="Próximos vencimientos" valor={t.hitosProximos} detalle="Hitos en los próximos días" onClick={() => alternarKpi('hitosProximos')} activo={kpi === 'hitosProximos'} />
            <Kpi titulo="Tareas abiertas" valor={t.tareasAbiertas} detalle={`${t.tareasBloqueadas} bloqueadas`} onClick={() => alternarKpi('bloqueadas')} activo={kpi === 'bloqueadas'} />
            <Kpi titulo="Tareas vencidas" valor={t.tareasVencidas} tono={t.tareasVencidas ? 'amarillo' : 'gris'} onClick={() => alternarKpi('tareasVencidas')} activo={kpi === 'tareasVencidas'} formula={FORMULAS.tasaTareasVencidas} />
            <Kpi titulo="Riesgos críticos abiertos" valor={t.riesgosCriticos} tono={t.riesgosCriticos ? 'rojo' : 'gris'} onClick={() => alternarKpi('riesgosCriticos')} activo={kpi === 'riesgosCriticos'} formula={FORMULAS.riesgosCriticos} />
            <Kpi titulo="Entregables por aprobar" valor={t.entregables} onClick={() => alternarKpi('entregables')} activo={kpi === 'entregables'} />
            <Kpi titulo="Sin actualización" valor={t.sinActualizar} detalle="Según el umbral de cada proyecto" tono={t.sinActualizar ? 'amarillo' : 'gris'} onClick={() => alternarKpi('sinActualizar')} activo={kpi === 'sinActualizar'} />
            <Kpi titulo="Acciones correctivas pendientes" valor={t.acciones} onClick={() => alternarKpi('acciones')} activo={kpi === 'acciones'} />
          </div>

          <Seccion titulo="Presupuesto del portafolio" descripcion={t.conPresupuesto ? `${t.conPresupuesto} proyecto(s) con presupuesto en los filtros actuales.` : 'Ningún proyecto filtrado maneja presupuesto.'}>
            {t.conPresupuesto && !t.monedaUnica ? (
              <p className="text-xs font-bold text-amber-700">Los proyectos filtrados usan monedas distintas: filtra por área o proyecto para ver totales comparables.</p>
            ) : t.conPresupuesto ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi titulo="Presupuesto vigente" valor={moneda(t.presupuesto, t.monedaUnica)} />
                <Kpi titulo="Comprometido" valor={moneda(t.comprometido, t.monedaUnica)} />
                <Kpi titulo="Ejecutado (real)" valor={moneda(t.real, t.monedaUnica)} />
                <Kpi titulo="Disponible" valor={moneda(t.presupuesto - t.real - t.comprometido, t.monedaUnica)} tono={t.presupuesto - t.real - t.comprometido < 0 ? 'rojo' : 'gris'} onClick={() => alternarKpi('sobrecosto')} activo={kpi === 'sobrecosto'} formula="Presupuesto vigente − costo real − costo comprometido." />
              </div>
            ) : null}
          </Seccion>

          <div className="grid gap-4 lg:grid-cols-2">
            <Seccion titulo="Avance planificado vs. real" descripcion="Proyectos activos con cronograma (máximo 12).">
              {graficoAvance.length ? (
                <div className="h-64" role="img" aria-label="Gráfico de barras del avance planificado y real por proyecto">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoAvance}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nombre" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" /><Tooltip /><Legend /><Bar dataKey="Planificado" fill="#94a3b8" /><Bar dataKey="Real" fill="#0055ff" /></BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EstadoVacio titulo="Sin datos de avance" descripcion="Aparecen cuando los proyectos tienen actividades con fechas." />}
            </Seccion>
            <Seccion titulo="Finalizaciones previstas" descripcion="Proyectos activos por mes de fin vigente.">
              {graficoFinalizaciones.length ? (
                <div className="h-64" role="img" aria-label="Gráfico de proyectos por mes de finalización prevista">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoFinalizaciones}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="Proyectos" fill="#0A3B32" /></BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <EstadoVacio titulo="Sin fechas de finalización" />}
            </Seccion>
          </div>

          {excepciones.length > 0 && (
            <Seccion titulo="Excepciones priorizadas" descripcion="Primero los críticos y los de mayor atraso.">
              <ul className="divide-y divide-slate-100">
                {excepciones.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => onAbrir(p.id)} className="flex w-full items-start gap-3 py-2 text-left hover:bg-slate-50">
                      <Semaforo semaforo={p.ind.semaforo} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-800">{p.codigo} · {p.ficha?.nombre}</span>
                        <span className="block text-xs text-slate-600">{p.ind.semaforo.motivos.join(' ')}</span>
                        {p.explicacionEstado?.explicacion && <span className="block text-[11px] italic text-slate-500">Director: {p.explicacionEstado.explicacion}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          <Seccion titulo={kpi ? `Proyectos ${FILTROS_KPI[kpi].titulo}` : 'Proyectos'} descripcion={`${tabla.length} registro(s).`}
            acciones={kpi && <button type="button" className={botonSecundario} onClick={() => setKpi('')}>Ver todos</button>}>
            {tabla.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-xs">
                    <thead className="border-b border-slate-200 text-[10px]">
                      <tr>{encabezado('semaforo', 'Estado de control')}{encabezado('codigo', 'Código')}{encabezado('nombre', 'Proyecto')}{encabezado('estado', 'Fase')}{encabezado('avance', 'Avance real / plan')}{encabezado('desviacion', 'Desviación')}{encabezado('fin', 'Fin vigente')}{encabezado('actualizado', 'Actualizado')}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibles.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-2"><Semaforo semaforo={p.ind.semaforo} conTexto /></td>
                          <td className="p-2 font-black text-slate-700">{p.codigoEstrategico || '—'}<span className="block text-[10px] font-bold text-slate-500">{p.codigo}</span></td>
                          <td className="p-2">
                            <button type="button" onClick={() => onAbrir(p.id)} className="text-left font-bold text-[#0055ff] hover:underline">{p.ficha?.nombre}</button>
                            <span className="block text-[11px] text-slate-500">{METODOLOGIAS[p.ficha?.metodologia]} · {nombreDeCorreo(p.miembros?.director)}{p.archivado ? ' · Archivado' : ''}</span>
                          </td>
                          <td className="p-2"><Insignia tono={TONO_ESTADO[p.estado]}>{ESTADOS_PROYECTO[p.estado]}</Insignia></td>
                          <td className="p-2 font-bold">{porcentaje(p.ind.avanceReal)} / {porcentaje(p.ind.avancePlanificado)}</td>
                          <td className={`p-2 font-bold ${p.ind.desviacionAvance < 0 ? 'text-red-600' : 'text-slate-700'}`}>{puntos(p.ind.desviacionAvance)}</td>
                          <td className="p-2">{fecha(p.ind.finVigente)}{p.ind.atrasoFinDias > 0 && <span className="block text-[11px] font-bold text-red-600">+{p.ind.atrasoFinDias} días vs. línea base</span>}</td>
                          <td className="p-2 text-slate-500">{fecha(p.actualizadoEn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {controles}
              </>
            ) : <EstadoVacio titulo="Ningún proyecto coincide" descripcion="Ajusta o limpia los filtros." />}
          </Seccion>
        </>
      )}
    </div>
  );
}
