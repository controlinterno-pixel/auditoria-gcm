// src/components/proyectos/CierreProyecto.jsx - Operación y cierre (manual 4.2.2, Acta de cierre y 4.3):
// entrega a la operación, lecciones aprendidas por categoría y Acta de cierre.
import { CATEGORIAS_LECCION, FASES_CICLO, apartadosDeEtapa, estadoApartado } from '../../utils/proyectos/metodologia.js';
import { fecha, porcentaje, puntos } from '../../utils/proyectos/formato.js';
import EditorApartado, { AreaTexto, ListaEditable } from './EditorApartado.jsx';
import { Campo, Insignia, Seccion, claseCampo } from './ui.jsx';

const nuevoId = () => (globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
const Selector = ({ etiqueta, valor, onCambio, opciones }) => (
  <Campo etiqueta={etiqueta}>{p => <select {...p} className={claseCampo} value={valor ?? ''} onChange={evento => onCambio(evento.target.value)}><option value="">—</option>{Object.entries(opciones).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
);

export default function CierreProyecto(props) {
  const { proyecto, plan, indicadores: ind } = props;
  const clave = id => `${id}-${plan.secciones?.[id]?.version || 'nuevo'}`;
  return (
    <div className="space-y-4">
      <Seccion titulo="Requisitos para firmar el Acta de cierre" descripcion="El patrocinador o el Comité aprueban el cierre cuando están completos estos apartados y la documentación de las tres fases.">
        <ul className="grid gap-2 sm:grid-cols-3">
          {apartadosDeEtapa('cierre').map(apartado => {
            const estado = estadoApartado(apartado.id, proyecto, plan);
            return <li key={apartado.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2 text-xs"><b>{apartado.titulo}</b><Insignia tono={estado.completo ? 'verde' : 'amarillo'}>{estado.completo ? 'Completo' : 'Pendiente'}</Insignia></li>;
          })}
        </ul>
      </Seccion>

      <EditorApartado key={clave('transferencia')} id="transferencia" {...props} descripcion="Entrega formal de los resultados al área que los opera: capacitación, manuales, ajustes de procesos y de mantenimiento, y gestión del cambio.">
        {(datos, cambiar) => (
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Área que recibe" obligatorio>{p => <input {...p} className={claseCampo} value={datos.areaReceptora || ''} onChange={evento => cambiar('areaReceptora', evento.target.value)} />}</Campo>
            <Campo etiqueta="Responsable en la operación" obligatorio>{p => <input {...p} className={claseCampo} value={datos.responsableOperacion || ''} onChange={evento => cambiar('responsableOperacion', evento.target.value)} />}</Campo>
            <Campo etiqueta="Fecha de entrega" obligatorio>{p => <input {...p} type="date" className={claseCampo} value={datos.fechaEntrega || ''} onChange={evento => cambiar('fechaEntrega', evento.target.value)} />}</Campo>
            <AreaTexto etiqueta="Capacitaciones realizadas" campo="capacitaciones" datos={datos} cambiar={cambiar} obligatorio />
            <AreaTexto etiqueta="Manuales y formatos de Calidad actualizados" campo="manuales" datos={datos} cambiar={cambiar} />
            <AreaTexto etiqueta="Ajustes a procesos" campo="ajustesProcesos" datos={datos} cambiar={cambiar} />
            <AreaTexto etiqueta="Ajustes al mantenimiento" campo="mantenimiento" datos={datos} cambiar={cambiar} />
            <AreaTexto etiqueta="Gestión del cambio (resistencia y mitigación)" campo="gestionCambio" datos={datos} cambiar={cambiar} className="sm:col-span-2" />
          </div>
        )}
      </EditorApartado>

      <EditorApartado key={clave('lecciones')} id="lecciones" {...props} descripcion="Qué funcionó (plus) y qué mejorar (delta), clasificado por categoría. Se publican en la base corporativa para consultarlas antes de iniciar nuevos proyectos.">
        {(datos, cambiar) => (
          <ListaEditable elementos={datos.lista || []} onCambiar={lista => cambiar('lista', lista)} textoAgregar="＋ Agregar lección"
            nuevo={() => ({ id: nuevoId(), categoria: 'tecnica', tipo: 'plus', fase: 'inversion', situacion: '', solucion: '', recomendacion: '' })}
            renderFila={(leccion, actualizar) => (
              <div className="grid gap-3 sm:grid-cols-3">
                <Selector etiqueta="Categoría" valor={leccion.categoria} onCambio={valor => actualizar({ categoria: valor })} opciones={CATEGORIAS_LECCION} />
                <Selector etiqueta="Tipo" valor={leccion.tipo} onCambio={valor => actualizar({ tipo: valor })} opciones={{ plus: 'Plus (funcionó bien)', delta: 'Delta (por mejorar)' }} />
                <Selector etiqueta="Fase" valor={leccion.fase} onCambio={valor => actualizar({ fase: valor })} opciones={FASES_CICLO} />
                <AreaTexto etiqueta="Situación" campo="situacion" datos={leccion} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} obligatorio />
                <AreaTexto etiqueta="Cómo se resolvió" campo="solucion" datos={leccion} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} />
                <AreaTexto etiqueta="Recomendación para futuros proyectos" campo="recomendacion" datos={leccion} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} />
              </div>
            )} />
        )}
      </EditorApartado>

      <EditorApartado key={clave('actaCierre')} id="actaCierre" {...props} descripcion="Cierre formal: resultados frente a los objetivos, cierre de contratos, liberación de recursos, evaluación del desempeño y archivo documental.">
        {(datos, cambiar) => (
          <div className="space-y-3">
            <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4" aria-label="Desempeño del proyecto">
              <p><b>Avance real:</b> {porcentaje(ind.avanceReal)}</p>
              <p><b>Desviación:</b> {puntos(ind.desviacionAvance)}</p>
              <p><b>Cumplimiento de hitos:</b> {porcentaje(ind.cumplimientoHitos)}</p>
              <p><b>Fin real:</b> {fecha(proyecto.ficha?.finReal) || 'Al firmar'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AreaTexto etiqueta="Resultados alcanzados frente a los objetivos" campo="resultados" datos={datos} cambiar={cambiar} obligatorio />
              <AreaTexto etiqueta="Cumplimiento de objetivos y beneficios (frente al caso de negocio)" campo="cumplimientoObjetivos" datos={datos} cambiar={cambiar} />
              <AreaTexto etiqueta="Beneficios logrados" campo="beneficiosLogrados" datos={datos} cambiar={cambiar} />
              <AreaTexto etiqueta="Cierre de contratos con terceros" campo="contratos" datos={datos} cambiar={cambiar} obligatorio />
              <AreaTexto etiqueta="Liberación de recursos humanos, materiales y financieros" campo="liberacionRecursos" datos={datos} cambiar={cambiar} obligatorio />
              <AreaTexto etiqueta="Evaluación del desempeño (cronograma, presupuesto, riesgos)" campo="evaluacionDesempeno" datos={datos} cambiar={cambiar} />
              <AreaTexto etiqueta="Archivo de la documentación (repositorio de Termales)" campo="archivo" datos={datos} cambiar={cambiar} className="sm:col-span-2" />
            </div>
          </div>
        )}
      </EditorApartado>
    </div>
  );
}
