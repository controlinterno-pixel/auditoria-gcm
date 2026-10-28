// src/components/proyectos/DetalleTareaGantt.jsx - Lo que se ve al hacer clic en una barra del Gantt: quién la
// tiene, fechas vigentes, línea base y reales, avance frente a lo esperado hoy, holgura y dependencias.
import { ESTADOS_CERRADOS_TAREA, ESTADOS_TAREA, PRIORIDADES, TIPOS_TAREA } from '../../utils/proyectos/modelo.js';
import { diasEntre, duracion, esFecha } from '../../utils/proyectos/fechas.js';
import { avanceEsperado } from '../../utils/proyectos/cronograma.js';
import { fecha, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { useCatalogos } from '../../context/useCatalogos';
import { Insignia, Modal, botonPrimario, botonSecundario } from './ui.jsx';
import { TONO_ESTADO } from './tonos.js';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

function Dato({ titulo, children }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{titulo}</p>
      <div className="mt-1 space-y-0.5 text-xs text-slate-700 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

export default function DetalleTareaGantt({ fila, tareas, hoy, calendario, holgura, base, onEditar, onCerrar }) {
  const { catalogoCargos = [] } = useCatalogos();
  const { tarea, numero, esContenedor, inicio, fin, avance, critica } = fila;
  const persona = correo => {
    const registro = catalogoCargos.find(item => String(item?.correoCorporativo || '').toLowerCase() === String(correo || '').toLowerCase());
    return registro?.cargo ? `${registro.cargo} · ${correo}` : `${nombreDeCorreo(correo)} · ${correo}`;
  };
  const porCodigo = id => tareas.find(item => String(item.id) === String(id));
  const predecesoras = (tarea.dependencias || []).map(dep => ({ ...dep, tarea: porCodigo(dep.id) })).filter(dep => dep.tarea);
  const sucesoras = tareas.filter(item => (item.dependencias || []).some(dep => String(dep.id) === String(tarea.id)));
  const cerrada = ESTADOS_CERRADOS_TAREA.includes(tarea.estado);
  const esperado = esContenedor || tarea.tipo === 'hito' || cerrada ? null : avanceEsperado(inicio, fin, hoy);
  const atrasoFin = base && esFecha(fin) && esFecha(base.fin) ? diasEntre(base.fin, fin) : null;
  const vencida = !cerrada && esFecha(fin) && esFecha(hoy) && fin < hoy;
  const hijas = esContenedor ? tareas.filter(item => String(item.padreId) === String(tarea.id)) : [];
  const criterios = tarea.criteriosAceptacion || [];

  return (
    <Modal titulo={`${numero} · ${tarea.titulo}`} onCerrar={onCerrar} ancho="max-w-2xl"
      pie={<>
        <button type="button" className={botonSecundario} onClick={onCerrar}>Cerrar</button>
        <button type="button" className={botonPrimario} onClick={onEditar}>{esContenedor ? 'Abrir fase' : tarea.tipo === 'hito' ? 'Abrir hito' : 'Abrir actividad'}</button>
      </>}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Insignia>{TIPOS_TAREA[tarea.tipo]}</Insignia>
        {!esContenedor && <Insignia tono={TONO_ESTADO[tarea.estado]}>{ESTADOS_TAREA[tarea.estado]}</Insignia>}
        {tarea.prioridad && <Insignia tono={tarea.prioridad === 'critica' || tarea.prioridad === 'alta' ? 'amarillo' : 'gris'}>Prioridad {PRIORIDADES[tarea.prioridad]?.toLowerCase()}</Insignia>}
        {critica && <Insignia tono="rojo">Ruta crítica</Insignia>}
        {vencida && <Insignia tono="rojo">Vencida</Insignia>}
      </div>
      {tarea.descripcion && <p className="mb-3 text-xs text-slate-600">{tarea.descripcion}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Dato titulo="Responsable">
          {tarea.responsable ? <p className="font-bold text-slate-800">{persona(tarea.responsable)}</p> : <p className="font-bold text-amber-700">{esContenedor ? 'La fase no tiene responsable propio: lo tienen sus actividades.' : 'Sin responsable asignado.'}</p>}
          {(tarea.colaboradores || []).length > 0 && <p>Colaboran: {tarea.colaboradores.map(persona).join('; ')}</p>}
          {tarea.esfuerzoHoras !== '' && tarea.esfuerzoHoras !== null && tarea.esfuerzoHoras !== undefined && <p>Esfuerzo estimado: {plural(Number(tarea.esfuerzoHoras), 'hora', 'horas')}</p>}
        </Dato>
        <Dato titulo="Fechas">
          {esFecha(inicio) ? (
            <p className="font-bold text-slate-800">{tarea.tipo === 'hito' ? fecha(fin) : `${fecha(inicio)} → ${fecha(fin)} · ${plural(duracion(inicio, fin, calendario), calendario === 'laboral' ? 'día hábil' : 'día', calendario === 'laboral' ? 'días hábiles' : 'días')}`}</p>
          ) : <p className="text-amber-700">Sin fechas.</p>}
          {base && <p>Línea base: {tarea.tipo === 'hito' ? fecha(base.fin) : `${fecha(base.inicio)} → ${fecha(base.fin)}`}{atrasoFin ? <b className={atrasoFin > 0 ? 'text-red-600' : 'text-emerald-700'}> ({atrasoFin > 0 ? `+${plural(atrasoFin, 'día', 'días')} de atraso` : `${plural(-atrasoFin, 'día', 'días')} antes`})</b> : ' (sin desviación)'}</p>}
          {(tarea.inicioReal || tarea.finReal) && <p>Real: {fecha(tarea.inicioReal)} → {tarea.finReal ? fecha(tarea.finReal) : 'en curso'}</p>}
          {vencida && <p className="font-bold text-red-600">Debía terminar el {fecha(fin)}: {plural(diasEntre(fin, hoy), 'día', 'días')} de vencida.</p>}
        </Dato>
        {tarea.tipo !== 'hito' && (
          <Dato titulo="Avance">
            <p className="font-bold text-slate-800">{avance ?? 0} % real{esperado !== null ? ` · ${esperado} % esperado hoy` : ''}</p>
            {esperado !== null && (avance ?? 0) < esperado && <p className="text-red-600">Va {esperado - (avance ?? 0)} puntos por debajo de lo que debería llevar a hoy según sus fechas.</p>}
            {esperado !== null && (avance ?? 0) >= esperado && esperado > 0 && <p className="text-emerald-700">Va al día o adelantada frente a sus fechas.</p>}
            {esperado === 0 && !cerrada && !esContenedor && <p>Aún no empieza: inicia el {fecha(inicio)}.</p>}
            {esContenedor && hijas.length > 0 && <p>{plural(hijas.length, 'actividad', 'actividades')}: {hijas.filter(item => item.estado === 'completada').length} completadas, {hijas.filter(item => item.estado === 'en_curso').length} en curso, {hijas.filter(item => !ESTADOS_CERRADOS_TAREA.includes(item.estado) && esFecha(item.fin) && item.fin < hoy).length} vencidas.</p>}
          </Dato>
        )}
        {!esContenedor && holgura !== undefined && !cerrada && (
          <Dato titulo="Holgura">
            {holgura <= 0
              ? <p className="font-bold text-red-600">Sin holgura: cada día de retraso corre el fin del proyecto.</p>
              : <p className="font-bold text-slate-800">Puede retrasarse hasta {plural(holgura, 'día', 'días')} sin mover el fin del proyecto.</p>}
          </Dato>
        )}
        {(predecesoras.length > 0 || sucesoras.length > 0) && (
          <Dato titulo="Dependencias">
            {predecesoras.length > 0 && <p>Empieza después de: {predecesoras.map(dep => `${dep.tarea.codigo} ${dep.tarea.titulo}${dep.desfase ? ` (+${dep.desfase} d)` : ''}${ESTADOS_CERRADOS_TAREA.includes(dep.tarea.estado) ? ' ✓' : ''}`).join('; ')}</p>}
            {sucesoras.length > 0 && <p>De ella dependen: {sucesoras.map(item => `${item.codigo} ${item.titulo}`).join('; ')}</p>}
          </Dato>
        )}
        {(tarea.estado === 'bloqueada' || criterios.length > 0 || tarea.restricciones) && (
          <Dato titulo="Control">
            {tarea.estado === 'bloqueada' && <p className="font-bold text-red-600">Bloqueada: {tarea.motivoBloqueo}</p>}
            {criterios.length > 0 && <p>Criterios de aceptación: {criterios.filter(criterio => criterio.cumplido).length} de {criterios.length} cumplidos{tarea.requiereRevision ? ' · requiere revisión' : ''}</p>}
            {tarea.restricciones && <p>Restricciones: {tarea.restricciones}</p>}
          </Dato>
        )}
      </div>
    </Modal>
  );
}
