// src/components/proyectos/FormulacionProyecto.jsx - Preinversión del manual E-ID-MAN-01:
// Formato 1 (Estructura inicial, apartados 1–5) y Formato 2 (Formulación, apartados 6–11).
import { useState } from 'react';
import { BLOQUES_MODELO_NEGOCIO, BLOQUES_PROPUESTA_VALOR, FASES_CICLO, LETRAS_PESTEL, TIPOS_INGENIERIA, apartadosDeEtapa } from '../../utils/proyectos/metodologia.js';
import { ingresoPeriodo, resumenFinanciero } from '../../utils/proyectos/financiero.js';
import { escribirCifra, leerCifra, moneda, porcentaje, simboloMoneda } from '../../utils/proyectos/formato.js';
import EditorApartado, { AreaTexto, InsigniaApartado, ListaEditable } from './EditorApartado.jsx';
import { Campo, Seccion, claseCampo } from './ui.jsx';

const nuevoId = () => (globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
const Entrada = ({ etiqueta, valor, onCambio, tipo = 'text', ...resto }) => (
  <Campo etiqueta={etiqueta}>{props => <input {...props} {...resto} type={tipo} className={claseCampo} value={valor ?? ''} onChange={evento => onCambio(tipo === 'number' ? (evento.target.value === '' ? '' : Number(evento.target.value)) : evento.target.value)} />}</Campo>
);
// Mientras se escribe la parte decimal se conserva el texto; al salir de la casilla queda con separador de miles.
function EntradaMoneda({ etiqueta, valor, onCambio, codigo }) {
  const [texto, setTexto] = useState(null);
  return (
    <Campo etiqueta={etiqueta}>{props => (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-slate-500">{simboloMoneda(codigo)}</span>
        <input {...props} type="text" inputMode="decimal" className={`${claseCampo} pl-12`} value={texto ?? escribirCifra(valor)}
          onChange={evento => { setTexto(/,\d{0,2}$/.test(evento.target.value) ? evento.target.value : null); onCambio(leerCifra(evento.target.value)); }}
          onBlur={() => setTexto(null)} />
      </div>
    )}</Campo>
  );
}
const Selector =({ etiqueta, valor, onCambio, opciones }) => (
  <Campo etiqueta={etiqueta}>{props => <select {...props} className={claseCampo} value={valor ?? ''} onChange={evento => onCambio(evento.target.value)}><option value="">—</option>{Object.entries(opciones).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
);

function Apartado({ id, props }) {
  const { proyecto, plan } = props;
  const f = proyecto.ficha || {};
  const comun = { id, ...props };
  const clave = `${id}-${plan.secciones?.[id]?.version || 'nuevo'}`;
  switch (id) {
    case 'problema':
      return (
        <Seccion titulo="Apartado 1 · Problema u oportunidad" acciones={<InsigniaApartado id="problema" proyecto={proyecto} plan={plan} />} descripcion="Es el “por qué” del proyecto: evidencia, impactos actuales y consecuencias de no actuar. Se edita en la ficha del proyecto.">
          <p className="whitespace-pre-line text-sm text-slate-700">{f.problema || 'Sin diligenciar: usa “Editar ficha”.'}</p>
          {f.justificacion && <p className="mt-2 whitespace-pre-line text-sm text-slate-600"><b>Justificación:</b> {f.justificacion}</p>}
        </Seccion>
      );
    case 'alternativas':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Genera 2 o 3 alternativas viables (no solo la “solución obvia”) y evalúa su pertinencia técnica, económica, ambiental y social.">
          {(datos, cambiar) => (
            <ListaEditable elementos={datos.lista || []} onCambiar={lista => cambiar('lista', lista)} textoAgregar="＋ Agregar alternativa"
              nuevo={() => ({ id: nuevoId(), nombre: '', descripcion: '' })}
              renderFila={(alternativa, actualizar) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Entrada etiqueta="Alternativa" valor={alternativa.nombre} onCambio={valor => actualizar({ nombre: valor })} />
                  <label className="flex items-end gap-2 pb-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={alternativa.seleccionada === true} onChange={evento => actualizar({ seleccionada: evento.target.checked })} /> Alternativa seleccionada</label>
                  {[['descripcion', 'Descripción técnica'], ['tecnica', 'Pertinencia técnica'], ['economica', 'Pertinencia económica'], ['ambiental', 'Pertinencia ambiental'], ['social', 'Pertinencia social'], ['impactosPositivos', 'Impactos positivos'], ['impactosNegativos', 'Impactos negativos']].map(([campo, etiqueta]) => (
                    <AreaTexto key={campo} etiqueta={etiqueta} campo={campo} datos={alternativa} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} />
                  ))}
                </div>
              )} />
          )}
        </EditorApartado>
      );
    case 'entorno':
      return (
        <EditorApartado key={clave} {...comun} descripcion="¿Dónde se desarrollará el proyecto? Microentorno: lugar, condiciones de operación, normativa, comunidad y actores.">
          {(datos, cambiar) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <AreaTexto etiqueta="Descripción del entorno" campo="descripcion" datos={datos} cambiar={cambiar} obligatorio className="sm:col-span-2" />
              <AreaTexto etiqueta="Ubicación y condiciones físicas (accesos, clima, lote)" campo="ubicacion" datos={datos} cambiar={cambiar} />
              <AreaTexto etiqueta="Normativa aplicable (POT, CARDER, licencias)" campo="normativa" datos={datos} cambiar={cambiar} />
              <AreaTexto etiqueta="Actores del entorno (JAC, líderes, operadores)" campo="actores" datos={datos} cambiar={cambiar} className="sm:col-span-2" />
            </div>
          )}
        </EditorApartado>
      );
    case 'aspectos':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Factores críticos: supuestos (“¿qué pasaría si…?”), estudios, normas, permisos y consultas a expertos.">
          {(datos, cambiar) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {[['supuestos', 'Supuestos (análisis de supuestos)'], ['estudios', 'Estudios técnicos o ambientales necesarios'], ['normas', 'Normas a tener en cuenta'], ['permisos', 'Permisos y licencias'], ['expertos', 'Consultas a expertos (jurídico, financiero, operaciones, compras)']].map(([campo, etiqueta]) => (
                <AreaTexto key={campo} etiqueta={etiqueta} campo={campo} datos={datos} cambiar={cambiar} />
              ))}
            </div>
          )}
        </EditorApartado>
      );
    case 'cronogramaFases':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Calendario preliminar por fase del ciclo de vida. Considera los tiempos internos de contratación y verificación de proveedores.">
          {(datos, cambiar) => (
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(FASES_CICLO).map(([fase, nombre]) => (
                <fieldset key={fase} className="rounded-xl border border-slate-200 p-3">
                  <legend className="px-1 text-xs font-black text-slate-700">{nombre}</legend>
                  <Entrada etiqueta="Inicio" tipo="date" valor={datos[fase]?.inicio} onCambio={valor => cambiar(fase, { ...datos[fase], inicio: valor })} />
                  <Entrada etiqueta="Fin" tipo="date" valor={datos[fase]?.fin} onCambio={valor => cambiar(fase, { ...datos[fase], fin: valor })} />
                </fieldset>
              ))}
              <AreaTexto etiqueta="Hitos y actividades clave por fase" campo="hitos" datos={datos} cambiar={cambiar} className="sm:col-span-3" />
            </div>
          )}
        </EditorApartado>
      );
    case 'objetivos':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Objetivo general y específicos (formato verbo + resultado + unidad de medida, enfoque SMART). Se editan en la ficha; máximo 5 específicos salvo justificación.">
          {(datos, cambiar) => (
            <div className="space-y-2 text-sm">
              <p><b>Objetivo general:</b> {f.objetivoGeneral || '—'}</p>
              <ol className="list-decimal pl-5">{(f.objetivosEspecificos || []).map(objetivo => <li key={objetivo}>{objetivo}</li>)}</ol>
              {(f.objetivosEspecificos || []).length > 5 && <AreaTexto etiqueta="Justificación para más de 5 objetivos específicos" campo="justificacionExceso" datos={datos} cambiar={cambiar} obligatorio />}
            </div>
          )}
        </EditorApartado>
      );
    case 'pestel':
      return (
        <EditorApartado key={clave} {...comun} descripcion="1 a 3 factores por letra; ninguna sin analizar. Documenta fuente y fecha (no tomar como cierta información de hace más de 5 años).">
          {(datos, cambiar) => (
            <ListaEditable elementos={datos.factores || []} onCambiar={factores => cambiar('factores', factores)} textoAgregar="＋ Agregar factor"
              nuevo={() => ({ id: nuevoId(), letra: 'P', hecho: '', importancia: 2, valoracion: 3 })}
              renderFila={(factor, actualizar) => {
                const antiguo = factor.fechaFuente && (Date.now() - Date.parse(factor.fechaFuente)) / 31557600000 > 5;
                return (
                  <div className="grid gap-3 sm:grid-cols-6">
                    <Selector etiqueta="Letra" valor={factor.letra} onCambio={valor => actualizar({ letra: valor })} opciones={LETRAS_PESTEL} />
                    <Campo etiqueta="Hecho o dato" className="sm:col-span-5">{p => <input {...p} className={claseCampo} value={factor.hecho || ''} onChange={evento => actualizar({ hecho: evento.target.value })} />}</Campo>
                    <Entrada etiqueta="Fuente" valor={factor.fuente} onCambio={valor => actualizar({ fuente: valor })} />
                    <Campo etiqueta="Fecha de la fuente" ayuda={antiguo ? 'Más de 5 años: actualiza la fuente.' : ''}>{p => <input {...p} type="date" className={claseCampo} value={factor.fechaFuente || ''} onChange={evento => actualizar({ fechaFuente: evento.target.value })} />}</Campo>
                    <Selector etiqueta="Oportunidad / amenaza" valor={factor.tipo} onCambio={valor => actualizar({ tipo: valor })} opciones={{ oportunidad: 'Oportunidad', amenaza: 'Amenaza' }} />
                    <Selector etiqueta="Tendencia" valor={factor.tendencia} onCambio={valor => actualizar({ tendencia: valor })} opciones={{ mejor: 'Mejor', estable: 'Estable', peor: 'Peor' }} />
                    <Selector etiqueta="Importancia" valor={factor.importancia} onCambio={valor => actualizar({ importancia: Number(valor) })} opciones={{ 3: '3 · Alta', 2: '2 · Media', 1: '1 · Baja' }} />
                    <Selector etiqueta="Valoración" valor={factor.valoracion} onCambio={valor => actualizar({ valoracion: Number(valor) })} opciones={{ 1: '1 · Muy negativo', 2: '2 · Negativo', 3: '3 · Indiferente', 4: '4 · Positivo', 5: '5 · Muy positivo' }} />
                  </div>
                );
              }} />
          )}
        </EditorApartado>
      );
    case 'propuestaValor':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Perfil del cliente (tareas, dolores, motivaciones) y mapa de valor (productos, calmantes, detonantes). Se logra el “encaje” cuando coinciden.">
          {(datos, cambiar) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(BLOQUES_PROPUESTA_VALOR).map(([campo, etiqueta]) => <AreaTexto key={campo} etiqueta={etiqueta} campo={campo} datos={datos} cambiar={cambiar} filas={2} />)}
              <AreaTexto etiqueta="Encaje y evidencias (entrevistas, % de aceptación, disposición a pagar)" campo="encaje" datos={datos} cambiar={cambiar} className="sm:col-span-2" />
            </div>
          )}
        </EditorApartado>
      );
    case 'modeloNegocio':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Los 9 bloques del Business Model Canvas: cómo el proyecto crea, entrega y captura valor.">
          {(datos, cambiar) => <div className="grid gap-3 sm:grid-cols-3">{Object.entries(BLOQUES_MODELO_NEGOCIO).map(([campo, etiqueta]) => <AreaTexto key={campo} etiqueta={etiqueta} campo={campo} datos={datos} cambiar={cambiar} filas={3} />)}</div>}
        </EditorApartado>
      );
    case 'ingresos':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Ingreso bruto = clientes × precio promedio, ajustado por estacionalidad. Documenta los supuestos.">
          {(datos, cambiar) => (
            <div className="space-y-3">
              <Selector etiqueta="Método" valor={datos.metodo} onCambio={valor => cambiar('metodo', valor)} opciones={{ 'bottom-up': 'Bottom-up (ventas esperadas)', 'top-down': 'Top-down (participación de mercado)' }} />
              <ListaEditable elementos={datos.periodos || []} onCambiar={periodos => cambiar('periodos', periodos)} textoAgregar="＋ Agregar periodo"
                nuevo={() => ({ id: nuevoId(), periodo: '', clientes: '', precio: '', ajuste: 0 })}
                renderFila={(periodo, actualizar) => (
                  <div className="grid gap-3 sm:grid-cols-5">
                    <Entrada etiqueta="Periodo" valor={periodo.periodo} onCambio={valor => actualizar({ periodo: valor })} />
                    <Entrada etiqueta="Clientes" tipo="number" valor={periodo.clientes} onCambio={valor => actualizar({ clientes: valor })} />
                    <EntradaMoneda etiqueta={`Precio promedio (${f.moneda || 'COP'})`} codigo={f.moneda} valor={periodo.precio} onCambio={valor => actualizar({ precio: valor })} />
                    <Entrada etiqueta="Ajuste por estacionalidad (%)" tipo="number" valor={periodo.ajuste} onCambio={valor => actualizar({ ajuste: valor })} />
                    <div className="self-end pb-2 text-sm font-black text-slate-800">{moneda(ingresoPeriodo(periodo), f.moneda)}</div>
                  </div>
                )} />
              <p className="text-sm font-bold">Total proyectado: {moneda((datos.periodos || []).reduce((suma, periodo) => suma + (ingresoPeriodo(periodo) || 0), 0), f.moneda)}</p>
              <AreaTexto etiqueta="Supuestos usados" campo="supuestos" datos={datos} cambiar={cambiar} obligatorio />
            </div>
          )}
        </EditorApartado>
      );
    case 'localizacion':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Decisión de dónde y de qué tamaño: fija el alcance y los parámetros de los que el proyecto no saldrá en adelante.">
          {(datos, cambiar) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <AreaTexto etiqueta="Ubicación seleccionada" campo="ubicacion" datos={datos} cambiar={cambiar} obligatorio />
              <AreaTexto etiqueta="Capacidad o tamaño (aforo, m², infraestructura)" campo="capacidad" datos={datos} cambiar={cambiar} obligatorio />
              <AreaTexto etiqueta="Criterios y matriz de puntaje (demanda, accesibilidad, costos, impacto ambiental)" campo="criterios" datos={datos} cambiar={cambiar} />
              <AreaTexto etiqueta="Restricciones legales o físicas" campo="restricciones" datos={datos} cambiar={cambiar} />
              <Campo etiqueta="Superficie">{p => <input {...p} className={claseCampo} value={datos.superficie || ''} onChange={evento => cambiar('superficie', evento.target.value)} />}</Campo>
            </div>
          )}
        </EditorApartado>
      );
    case 'ingenieria':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Según el tipo de proyecto (figura 6 del manual): proceso, distribución física y estudios requeridos.">
          {(datos, cambiar) => (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">{Object.entries(TIPOS_INGENIERIA).map(([valor, texto]) => (
                <label key={valor} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={(datos.tipos || []).includes(valor)} onChange={evento => cambiar('tipos', evento.target.checked ? [...(datos.tipos || []), valor] : (datos.tipos || []).filter(tipo => tipo !== valor))} /> {texto}
                </label>
              ))}</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <AreaTexto etiqueta="Proceso (secuencia de actividades, responsables, entradas y salidas)" campo="proceso" datos={datos} cambiar={cambiar} obligatorio filas={4} />
                <AreaTexto etiqueta="Layout o distribución física" campo="layout" datos={datos} cambiar={cambiar} filas={4} />
                <AreaTexto etiqueta="Estudios, asesorías o prototipos" campo="estudios" datos={datos} cambiar={cambiar} filas={4} />
              </div>
            </div>
          )}
        </EditorApartado>
      );
    case 'organizacional':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Personal requerido en cada fase, su función y por qué es importante que esté.">
          {(datos, cambiar) => <div className="grid gap-3 sm:grid-cols-3">{Object.entries(FASES_CICLO).map(([fase, nombre]) => <AreaTexto key={fase} etiqueta={nombre} campo={fase} datos={datos} cambiar={cambiar} obligatorio filas={4} />)}</div>}
        </EditorApartado>
      );
    case 'financiero':
      return (
        <EditorApartado key={clave} {...comun} descripcion="Flujos de caja proyectados por periodo (el periodo 0 es la inversión inicial). VAN, TIR y PRD se calculan solos.">
          {(datos, cambiar) => {
            const resultado = resumenFinanciero(datos);
            return (
              <div className="space-y-3">
                <div className="max-w-xs"><Entrada etiqueta="Tasa de descuento por periodo (%)" tipo="number" valor={datos.tasaDescuento} onCambio={valor => cambiar('tasaDescuento', valor)} /></div>
                <ListaEditable elementos={datos.flujos || []} onCambiar={flujos => cambiar('flujos', flujos)} textoAgregar="＋ Agregar periodo"
                  nuevo={() => ({ id: nuevoId(), periodo: (datos.flujos || []).length, ingresos: '', egresos: '' })}
                  renderFila={(flujo, actualizar) => (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Entrada etiqueta="Periodo" tipo="number" min="0" valor={flujo.periodo} onCambio={valor => actualizar({ periodo: valor })} />
                      <EntradaMoneda etiqueta="Ingresos" codigo={f.moneda} valor={flujo.ingresos} onCambio={valor => actualizar({ ingresos: valor })} />
                      <EntradaMoneda etiqueta="Egresos" codigo={f.moneda} valor={flujo.egresos} onCambio={valor => actualizar({ egresos: valor })} />
                      <Entrada etiqueta="Descripción" valor={flujo.descripcion} onCambio={valor => actualizar({ descripcion: valor })} />
                    </div>
                  )} />
                <div className="grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
                  <p><b>VAN:</b> {moneda(resultado.van, f.moneda)}</p>
                  <p><b>TIR:</b> {resultado.tir === null ? 'No existe (los flujos no cambian de signo)' : porcentaje(resultado.tir)}</p>
                  <p><b>PRD:</b> {resultado.prd === null ? 'No se recupera en el horizonte' : `${resultado.prd.toLocaleString('es-CO', { maximumFractionDigits: 2 })} periodos`}</p>
                </div>
                <AreaTexto etiqueta="Análisis de sensibilidad" campo="sensibilidad" datos={datos} cambiar={cambiar} />
              </div>
            );
          }}
        </EditorApartado>
      );
    default:
      return null;
  }
}

export default function FormulacionProyecto(props) {
  const { proyecto, plan } = props;
  const grupos = [
    ['prefactibilidad', 'Prefactibilidad · Formato 1 · Estructura inicial'],
    ['factibilidad', 'Factibilidad · Formato 2 · Formulación del proyecto'],
  ];
  const [activo, setActivo] = useState('problema');
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <nav aria-label="Apartados de la formulación" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {grupos.map(([etapa, titulo]) => (
          <div key={etapa} className="rounded-2xl border border-slate-200 bg-white p-2">
            <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{titulo}</p>
            {apartadosDeEtapa(etapa).map(apartado => (
              <button key={apartado.id} type="button" onClick={() => setActivo(apartado.id)} aria-current={activo === apartado.id ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${activo === apartado.id ? 'bg-blue-50 font-black text-[#0055ff]' : 'font-bold text-slate-700 hover:bg-slate-50'}`}>
                <span>{apartado.numero}. {apartado.titulo}</span>
                <InsigniaApartado id={apartado.id} proyecto={proyecto} plan={plan} />
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="min-w-0"><Apartado id={activo} props={props} /></div>
    </div>
  );
}
