// src/components/proyectos/FormularioProyecto.jsx - Ficha del proyecto (crear y editar), por secciones.
import { ContextoGuia } from './guias.js';
import { useMemo, useState } from 'react';
import { METODOLOGIAS, MONEDAS, PRIORIDADES, UMBRALES_POR_DEFECTO, validarFicha, validarMiembros } from '../../utils/proyectos/modelo.js';
import { PILARES, codigoEstrategico } from '../../utils/proyectos/metodologia.js';
import { Campo, GuiaEnLinea, Modal, SugerenciasCorreos, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

const PASOS = [
  { id: 'identificacion', titulo: 'Identificación' },
  { id: 'alcance', titulo: 'Objetivos y alcance' },
  { id: 'equipo', titulo: 'Organización y equipo' },
  { id: 'plan', titulo: 'Fechas y presupuesto' },
  { id: 'exito', titulo: 'Beneficios y control' },
];

const listaATexto = lista => (Array.isArray(lista) ? lista.join(', ') : '');

export default function FormularioProyecto({ proyecto, usuario, onGuardar, onCerrar, guardando, mapaProcesos = {} }) {
  const esNuevo = !proyecto;
  const [paso, setPaso] = useState('identificacion');
  const [ficha, setFicha] = useState(() => ({
    metodologia: 'predictiva', prioridad: 'media', moneda: 'COP', calendario: 'laboral', fechaSolicitud: new Date().toISOString().slice(0, 10),
    ...(proyecto?.ficha || {}),
    objetivosEspecificosTexto: (proyecto?.ficha?.objetivosEspecificos || []).join('\n'),
  }));
  const [miembros, setMiembros] = useState(() => ({
    director: proyecto?.miembros?.director || usuario?.email || '',
    patrocinador: proyecto?.miembros?.patrocinador || '',
    responsableArea: proyecto?.miembros?.responsableArea || '',
    equipo: listaATexto(proyecto?.miembros?.equipo),
    aprobadores: listaATexto(proyecto?.miembros?.aprobadores),
    lectores: listaATexto(proyecto?.miembros?.lectores),
    comite: listaATexto(proyecto?.miembros?.comite),
  }));
  const [configuracion, setConfiguracion] = useState(() => ({
    aprobarCambiosEstado: proyecto?.configuracion?.aprobarCambiosEstado !== false,
    umbrales: { ...UMBRALES_POR_DEFECTO, ...(proyecto?.configuracion?.umbrales || {}) },
  }));
  const [intento, setIntento] = useState(false);
  const presupuestoBloqueado = proyecto && !['propuesto', 'planificacion'].includes(proyecto.estado);

  const fichaParaEnviar = () => ({
    ...ficha,
    objetivosEspecificos: String(ficha.objetivosEspecificosTexto || '').split('\n').map(item => item.trim()).filter(Boolean),
    ...Object.fromEntries(['numPrograma', 'numSubprograma', 'numProyecto'].map(campo => [campo, ficha[campo] === '' || ficha[campo] === null || ficha[campo] === undefined ? null : Number(ficha[campo])])),
  });
  const errores = useMemo(() => [...validarFicha(fichaParaEnviar()).errores, ...validarMiembros(miembros).errores], [ficha, miembros]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambiar = campo => evento => setFicha(actual => ({ ...actual, [campo]: evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value }));
  const cambiarMiembro = campo => evento => setMiembros(actual => ({ ...actual, [campo]: evento.target.value }));
  const macroprocesos = Object.keys(mapaProcesos || {});

  const guardar = async evento => {
    evento.preventDefault();
    setIntento(true);
    if (errores.length) return;
    await onGuardar({ ficha: fichaParaEnviar(), miembros, configuracion, version: proyecto?.version });
  };

  const campoTexto = (campo, etiqueta, opciones = {}) => (
    <Campo etiqueta={etiqueta} obligatorio={opciones.obligatorio} ayuda={opciones.ayuda} className={opciones.className}>
      {props => (opciones.largo
        ? <textarea {...props} rows={opciones.filas || 3} className={claseCampo} value={ficha[campo] || ''} onChange={cambiar(campo)} />
        : <input {...props} type={opciones.tipo || 'text'} className={claseCampo} value={ficha[campo] ?? ''} onChange={cambiar(campo)} disabled={opciones.disabled} list={opciones.lista} />)}
    </Campo>
  );
  const campoCorreo = (campo, etiqueta, ayuda, { multiple = false, obligatorio = false, disabled = false } = {}) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda} obligatorio={obligatorio}>
      {props => <input {...props} type="text" list={multiple ? undefined : 'correos-proyecto'} className={claseCampo} value={miembros[campo]} onChange={cambiarMiembro(campo)} disabled={disabled} placeholder={multiple ? 'correo1@termales.com.co, correo2@termales.com.co' : 'nombre@termales.com.co'} />}
    </Campo>
  );

  return (
    <Modal titulo={esNuevo ? 'Nuevo proyecto' : `Editar ficha · ${proyecto.codigo}`} ancho="max-w-4xl" onCerrar={onCerrar} pie={(
      <>
        {intento && errores.length > 0 && <p role="alert" className="mr-auto max-w-xl text-xs font-bold text-red-600">{errores[0]}{errores.length > 1 ? ` (y ${errores.length - 1} más)` : ''}</p>}
        <button type="button" className={botonSecundario} onClick={onCerrar}>Cancelar</button>
        <button type="submit" form="formulario-proyecto" className={botonPrimario} disabled={guardando}>{guardando ? 'Guardando…' : esNuevo ? 'Crear proyecto' : 'Guardar ficha'}</button>
      </>
    )}>
      <ContextoGuia.Provider value="ficha">
      <SugerenciasCorreos id="correos-proyecto" />
      <div role="tablist" aria-label="Secciones de la ficha" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {PASOS.map(item => (
          <button key={item.id} type="button" role="tab" aria-selected={paso === item.id} onClick={() => setPaso(item.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-black ${paso === item.id ? 'border-[#0055ff] text-[#0055ff]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item.titulo}</button>
        ))}
      </div>
      <form id="formulario-proyecto" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
        {paso === 'identificacion' && (
          <>
            {campoTexto('nombre', 'Nombre del proyecto', { obligatorio: true, className: 'sm:col-span-2' })}
            {campoTexto('descripcion', 'Descripción', { largo: true, className: 'sm:col-span-2' })}
            {campoTexto('justificacion', 'Justificación', { largo: true })}
            {campoTexto('problema', 'Problema u oportunidad que atiende (apartado 1 del manual)', { largo: true, ayuda: 'Contexto, evidencia, impactos actuales y consecuencias de no actuar.' })}
            <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:col-span-2 sm:grid-cols-5">
              <legend className="px-1 text-xs font-black text-slate-700">Código del portafolio (Capítulo II del manual)</legend>
              <Campo etiqueta="Pilar estratégico">
                {props => <select {...props} className={claseCampo} value={ficha.pilar || ''} onChange={cambiar('pilar')}><option value="">—</option>{Object.entries(PILARES).map(([valor, texto]) => <option key={valor} value={valor}>{valor} · {texto}</option>)}</select>}
              </Campo>
              {campoTexto('numPrograma', 'N.° de programa', { tipo: 'number' })}
              {campoTexto('numSubprograma', 'N.° de subprograma', { tipo: 'number', ayuda: 'Opcional' })}
              {campoTexto('numProyecto', 'N.° de proyecto', { tipo: 'number' })}
              <div className="self-end pb-2 text-sm">Código: <b>{codigoEstrategico({ ...ficha, numPrograma: Number(ficha.numPrograma), numSubprograma: Number(ficha.numSubprograma), numProyecto: Number(ficha.numProyecto) }) || '—'}</b></div>
            </fieldset>
            <Campo etiqueta="Metodología" obligatorio ayuda="Predictiva: EDT, cronograma y línea base. Ágil: backlog y sprints. Híbrida: ambas.">
              {props => <select {...props} className={claseCampo} value={ficha.metodologia} onChange={cambiar('metodologia')}>{Object.entries(METODOLOGIAS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select>}
            </Campo>
            <Campo etiqueta="Prioridad" obligatorio>
              {props => <select {...props} className={claseCampo} value={ficha.prioridad} onChange={cambiar('prioridad')}>{Object.entries(PRIORIDADES).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select>}
            </Campo>
          </>
        )}
        {paso === 'alcance' && (
          <>
            {campoTexto('objetivoGeneral', 'Objetivo general', { obligatorio: true, largo: true, className: 'sm:col-span-2' })}
            {campoTexto('objetivosEspecificosTexto', 'Objetivos específicos (uno por línea)', { largo: true, filas: 4, className: 'sm:col-span-2' })}
            {campoTexto('alcanceIncluido', 'Alcance incluido', { largo: true })}
            {campoTexto('alcanceExcluido', 'Fuera del alcance', { largo: true })}
            {campoTexto('dependenciasRestricciones', 'Dependencias y restricciones', { largo: true })}
            {campoTexto('riesgosIniciales', 'Riesgos iniciales identificados', { largo: true, ayuda: 'Para gestionarlos con calificación y responsables, regístralos luego en la pestaña Riesgos.' })}
          </>
        )}
        {paso === 'equipo' && (
          <>
            {campoCorreo('director', 'Director o gerente del proyecto', 'Gestiona la ficha, el cronograma, los costos y las reuniones.', { obligatorio: true, disabled: !esNuevo && !['admin', 'administrador'].includes(String(usuario?.rol || '').toLowerCase()) })}
            {campoCorreo('patrocinador', 'Patrocinador (Gerencia que aprueba)', 'Aprueba Prefactibilidad, Factibilidad, Acta de constitución y Acta de cierre, y las solicitudes de cambio. Debe ser distinto del director.', { disabled: !esNuevo && !['admin', 'administrador'].includes(String(usuario?.rol || '').toLowerCase()) })}
            {campoCorreo('comite', 'Comité I+D+i / Estratégico (PMO)', 'También aprueban las fases. Solo un administrador los cambia después de crear el proyecto.', { multiple: true, disabled: !esNuevo && !['admin', 'administrador'].includes(String(usuario?.rol || '').toLowerCase()) })}
            {campoCorreo('responsableArea', 'Responsable del área', 'Consulta el proyecto.')}
            <Campo etiqueta="Área">
              {props => <input {...props} className={claseCampo} value={ficha.area || ''} onChange={cambiar('area')} list="macroprocesos-proyecto" />}
            </Campo>
            <datalist id="macroprocesos-proyecto">{macroprocesos.map(nombre => <option key={nombre} value={nombre} />)}</datalist>
            {campoTexto('proceso', 'Proceso')}
            {campoTexto('portafolio', 'Portafolio')}
            {campoTexto('programa', 'Programa')}
            {campoCorreo('equipo', 'Equipo de trabajo', 'Ejecutan y actualizan las tareas que se les asignen.', { multiple: true })}
            {campoCorreo('aprobadores', 'Aprobadores', 'Revisan tareas, entregables y cambios.', { multiple: true })}
            {campoCorreo('lectores', 'Lectores', 'Solo consultan.', { multiple: true })}
          </>
        )}
        {paso === 'plan' && (
          <>
            {campoTexto('fechaSolicitud', 'Fecha de solicitud', { tipo: 'date' })}
            <Campo etiqueta="Calendario del cronograma" ayuda="Laboral: las duraciones y dependencias cuentan de lunes a viernes.">
              {props => <select {...props} className={claseCampo} value={ficha.calendario} onChange={cambiar('calendario')}><option value="laboral">Laboral (lunes a viernes)</option><option value="calendario">Todos los días</option></select>}
            </Campo>
            {campoTexto('inicioPlanificado', 'Inicio planificado', { tipo: 'date', obligatorio: true })}
            {campoTexto('finPlanificado', 'Fin planificado', { tipo: 'date', obligatorio: true })}
            {!esNuevo && campoTexto('inicioReal', 'Inicio real', { tipo: 'date', ayuda: 'Se registra solo al iniciar la ejecución; puedes corregirlo.' })}
            {!esNuevo && campoTexto('finReal', 'Fin real', { tipo: 'date' })}
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={ficha.manejaPresupuesto === true} onChange={cambiar('manejaPresupuesto')} disabled={presupuestoBloqueado} />
              Este proyecto maneja presupuesto
              <GuiaEnLinea clave="maneja presupuesto" etiqueta="Maneja presupuesto" />
            </label>
            {ficha.manejaPresupuesto && (
              <>
                {campoTexto('presupuestoAprobado', 'Presupuesto aprobado', { tipo: 'number', obligatorio: true, disabled: presupuestoBloqueado, ayuda: presupuestoBloqueado ? 'Desde la ejecución, el presupuesto cambia solo con una solicitud de cambio aprobada.' : '' })}
                <Campo etiqueta="Moneda">
                  {props => <select {...props} className={claseCampo} value={ficha.moneda} onChange={cambiar('moneda')} disabled={presupuestoBloqueado}>{MONEDAS.map(codigo => <option key={codigo}>{codigo}</option>)}</select>}
                </Campo>
              </>
            )}
          </>
        )}
        {paso === 'exito' && (
          <>
            {campoTexto('beneficios', 'Beneficios esperados', { largo: true })}
            {campoTexto('indicadoresEsperados', 'Indicadores esperados', { largo: true })}
            {campoTexto('criteriosExito', 'Criterios de éxito y aceptación', { largo: true, className: 'sm:col-span-2' })}
            <fieldset className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
              <legend className="px-1 text-xs font-black text-slate-700">Control y semáforo</legend>
              <label className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={configuracion.aprobarCambiosEstado} onChange={evento => setConfiguracion(actual => ({ ...actual, aprobarCambiosEstado: evento.target.checked }))} />
                Los cambios de estado (iniciar, suspender, cerrar…) requieren autorización del patrocinador
                <GuiaEnLinea clave="aprobar estados" etiqueta="Aprobación de fases" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['desviacionAmarillo', 'Atraso para alerta (p. p.)'], ['desviacionRojo', 'Atraso crítico (p. p.)'],
                  ['costoAmarillo', 'Sobrecosto para alerta (%)'], ['costoRojo', 'Sobrecosto crítico (%)'],
                  ['nivelRiesgoCritico', 'Nivel de riesgo crítico (1–25)'], ['diasSinActualizacion', 'Días sin actualizar para alerta'],
                ].map(([clave, etiqueta]) => (
                  <Campo key={clave} etiqueta={etiqueta}>
                    {props => <input {...props} type="number" min="0" className={claseCampo} value={configuracion.umbrales[clave]} onChange={evento => setConfiguracion(actual => ({ ...actual, umbrales: { ...actual.umbrales, [clave]: evento.target.value === '' ? '' : Number(evento.target.value) } }))} />}
                  </Campo>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </form>
      </ContextoGuia.Provider>
      <p className="mt-4 text-[11px] text-slate-500">Paso {PASOS.findIndex(item => item.id === paso) + 1} de {PASOS.length}. Los datos se conservan al cambiar de sección.</p>
    </Modal>
  );
}
