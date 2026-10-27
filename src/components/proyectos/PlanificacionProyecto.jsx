// src/components/proyectos/PlanificacionProyecto.jsx - Inversión (manual E-ID-MAN-01): apartados 12 a 17
// (interesados, EDT, organigrama, RACI, riesgos y requisitos del Acta de constitución).
import { ESTRATEGIAS_INTERESADO, FASES_CICLO, apartadosDeEtapa, elementosRaci, erroresRaci, estadoApartado, estrategiaInteresado } from '../../utils/proyectos/metodologia.js';
import EditorApartado, { AreaTexto, ListaEditable } from './EditorApartado.jsx';
import { Campo, CampoCatalogo, Insignia, Seccion, claseCampo } from './ui.jsx';
import { faltantesEnCatalogo, mensajeFaltantes } from '../../utils/proyectos/catalogos.js';
import { useCatalogos } from '../../context/useCatalogos';

const nuevoId = () => (globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
const Entrada = ({ etiqueta, valor, onCambio }) => <Campo etiqueta={etiqueta}>{p => <input {...p} className={claseCampo} value={valor ?? ''} onChange={evento => onCambio(evento.target.value)} />}</Campo>;
const Selector = ({ etiqueta, valor, onCambio, opciones }) => (
  <Campo etiqueta={etiqueta}>{p => <select {...p} className={claseCampo} value={valor ?? ''} onChange={evento => onCambio(evento.target.value)}><option value="">—</option>{Object.entries(opciones).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
);
const ESCALA = { 1: '1 · Muy bajo', 2: '2 · Bajo', 3: '3 · Medio', 4: '4 · Alto', 5: '5 · Muy alto' };
const TONO_ESTRATEGIA = { cerca: 'rojo', satisfecho: 'amarillo', informado: 'azul', monitorear: 'gris' };
const DONDE = { edt: 'pestaña Cronograma y EDT', riesgosProyecto: 'pestaña Riesgos e incidencias', acta: 'ficha del proyecto (Editar ficha)' };

export default function PlanificacionProyecto(props) {
  const { proyecto, plan } = props;
  const clave = id => `${id}-${plan.secciones?.[id]?.version || 'nuevo'}`;
  const elementos = elementosRaci(plan);
  const problemasRaci = erroresRaci(plan);
  const { cargosEmpresa = [], organizacionesExternas = [], catalogosInicializados } = useCatalogos();
  // Interesados y participantes deben existir en Cargos y Procesos; si falta alguno, no se guarda hasta crearlo.
  const bloqueoCatalogo = seccion => datos => mensajeFaltantes(faltantesEnCatalogo(seccion, datos, { cargos: cargosEmpresa, organizaciones: organizacionesExternas, inicializado: catalogosInicializados }));

  return (
    <div className="space-y-4">
      <Seccion titulo="Requisitos del Acta de constitución" descripcion="Para firmar el Acta (Formato 3) e iniciar la ejecución deben estar completos los apartados 12 a 17.">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {apartadosDeEtapa('inversion').map(apartado => {
            const estado = estadoApartado(apartado.id, proyecto, plan);
            return (
              <li key={apartado.id} className="rounded-xl border border-slate-200 p-2 text-xs">
                <div className="flex items-center justify-between gap-2"><b>{apartado.numero}. {apartado.titulo}</b><Insignia tono={estado.completo ? 'verde' : 'amarillo'}>{estado.completo ? 'Completo' : 'Pendiente'}</Insignia></div>
                {!estado.completo && <p className="mt-1 text-slate-600">{estado.faltante}{DONDE[apartado.id] ? ` (en la ${DONDE[apartado.id]})` : ''}</p>}
              </li>
            );
          })}
        </ul>
      </Seccion>

      <EditorApartado key={clave('interesados')} id="interesados" {...props} bloqueo={bloqueoCatalogo('interesados')} descripcion="Personas, áreas y entidades que influyen en el proyecto o se ven afectadas. La estrategia sale de la matriz poder–interés. Actualízala al menos cada mes durante la inversión.">
        {(datos, cambiar) => (
          <ListaEditable elementos={datos.lista || []} onCambiar={lista => cambiar('lista', lista)} textoAgregar="＋ Agregar interesado"
            nuevo={() => ({ id: nuevoId(), nombre: '', tipo: 'interno', poder: 3, interes: 3, actitud: 'neutral' })}
            renderFila={(interesado, actualizar) => {
              const estrategia = estrategiaInteresado(interesado);
              return (
                <div className="grid gap-3 sm:grid-cols-6">
                  <Selector etiqueta="Tipo" valor={interesado.tipo} onCambio={valor => actualizar({ tipo: valor, nombre: '', contacto: '' })} opciones={{ interno: 'Interno', externo: 'Externo' }} />
                  {interesado.tipo === 'externo' ? (
                    <>
                      <div className="sm:col-span-2"><CampoCatalogo etiqueta="Organización" tipo="organizacion" valor={interesado.nombre} onCambio={valor => actualizar({ nombre: valor })} /></div>
                      <div className="sm:col-span-3"><Entrada etiqueta="Contacto o rol en la organización" valor={interesado.contacto} onCambio={valor => actualizar({ contacto: valor })} /></div>
                    </>
                  ) : <div className="sm:col-span-5"><CampoCatalogo etiqueta="Cargo o área de la empresa" tipo="cargo" valor={interesado.nombre} onCambio={valor => actualizar({ nombre: valor })} /></div>}
                  <Selector etiqueta="Poder / influencia" valor={interesado.poder} onCambio={valor => actualizar({ poder: Number(valor) })} opciones={ESCALA} />
                  <Selector etiqueta="Interés" valor={interesado.interes} onCambio={valor => actualizar({ interes: Number(valor) })} opciones={ESCALA} />
                  <Selector etiqueta="Actitud" valor={interesado.actitud} onCambio={valor => actualizar({ actitud: valor })} opciones={{ favor: 'A favor', neutral: 'Neutral', contra: 'En contra' }} />
                  <div className="sm:col-span-6"><Insignia tono={TONO_ESTRATEGIA[estrategia]}>Estrategia: {ESTRATEGIAS_INTERESADO[estrategia]}</Insignia></div>
                  <AreaTexto etiqueta="Expectativas" campo="expectativas" datos={interesado} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} className="sm:col-span-2" />
                  <AreaTexto etiqueta="Mensajes clave" campo="mensajes" datos={interesado} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} className="sm:col-span-2" />
                  <AreaTexto etiqueta="Riesgos asociados" campo="riesgosAsociados" datos={interesado} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} className="sm:col-span-2" />
                  <Entrada etiqueta="Canal" valor={interesado.canal} onCambio={valor => actualizar({ canal: valor })} />
                  <Entrada etiqueta="Frecuencia" valor={interesado.frecuencia} onCambio={valor => actualizar({ frecuencia: valor })} />
                  <div className="sm:col-span-2"><CampoCatalogo etiqueta="Responsable de la relación" tipo="cargo" valor={interesado.responsable} onCambio={valor => actualizar({ responsable: valor })} /></div>
                </div>
              );
            }} />
        )}
      </EditorApartado>

      <EditorApartado key={clave('organigrama')} id="organigrama" {...props} bloqueo={bloqueoCatalogo('organigrama')} descripcion="Roles por fase del ciclo de vida, nivel (estratégico, táctico, operativo), a quién reportan y sus funciones. Se anexa al Acta de constitución.">
        {(datos, cambiar) => (
          <div className="space-y-4">
            <ListaEditable elementos={datos.roles || []} onCambiar={roles => cambiar('roles', roles)} textoAgregar="＋ Agregar rol"
              nuevo={() => ({ id: nuevoId(), fase: 'inversion', rol: '', nivel: 'tactico' })}
              renderFila={(rol, actualizar) => (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Selector etiqueta="Fase" valor={rol.fase} onCambio={valor => actualizar({ fase: valor })} opciones={FASES_CICLO} />
                  <Entrada etiqueta="Rol" valor={rol.rol} onCambio={valor => actualizar({ rol: valor })} />
                  <Selector etiqueta="Pertenece a" valor={rol.origen || 'empresa'} onCambio={valor => actualizar({ origen: valor, persona: '', organizacion: '' })} opciones={{ empresa: 'La empresa', externa: 'Otra organización' }} />
                  {rol.origen === 'externa' ? (
                    <>
                      <CampoCatalogo etiqueta="Organización" tipo="organizacion" valor={rol.organizacion} onCambio={valor => actualizar({ organizacion: valor })} />
                      <Entrada etiqueta="Persona o rol en la organización" valor={rol.persona} onCambio={valor => actualizar({ persona: valor })} />
                    </>
                  ) : <CampoCatalogo etiqueta="Cargo" tipo="cargo" valor={rol.persona} onCambio={valor => actualizar({ persona: valor })} />}
                  <Entrada etiqueta="Reporta a" valor={rol.reportaA} onCambio={valor => actualizar({ reportaA: valor })} />
                  <Selector etiqueta="Nivel" valor={rol.nivel} onCambio={valor => actualizar({ nivel: valor })} opciones={{ estrategico: 'Estratégico', tactico: 'Táctico', operativo: 'Operativo' }} />
                  <AreaTexto etiqueta="Funciones" campo="funciones" datos={rol} cambiar={(c, v) => actualizar({ [c]: v })} filas={2} className="sm:col-span-2 lg:col-span-4" />
                </div>
              )} />
            {(datos.roles || []).length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3" aria-label="Organigrama por fase">
                {Object.entries(FASES_CICLO).map(([fase, nombre]) => (
                  <div key={fase} className="rounded-xl bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-black uppercase text-slate-600">{nombre}</p>
                    {['estrategico', 'tactico', 'operativo'].map(nivel => (datos.roles || []).filter(rol => rol.fase === fase && rol.nivel === nivel).map(rol => (
                      <div key={rol.id} className={`mb-1 rounded-lg border bg-white p-2 text-xs ${nivel === 'estrategico' ? 'border-[#0055ff]' : 'border-slate-200'}`} style={{ marginLeft: nivel === 'tactico' ? 12 : nivel === 'operativo' ? 24 : 0 }}>
                        <b>{rol.rol}</b>{rol.persona ? ` · ${rol.persona}` : ''}{rol.origen === 'externa' && rol.organizacion ? ` (${rol.organizacion})` : ''}{rol.reportaA && <span className="block text-slate-500">Reporta a: {rol.reportaA}</span>}
                      </div>
                    )))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </EditorApartado>

      <EditorApartado key={clave('raci')} id="raci" {...props} descripcion="R: ejecuta · A: aprueba (exactamente uno por fila) · C: consultado · I: informado. Las filas son los entregables y paquetes de trabajo de la EDT; usa cargos, no personas aisladas.">
        {(datos, cambiar) => {
          const roles = datos.roles || [];
          const filas = datos.filas || {};
          const asignar = (idElemento, rol, letra) => cambiar('filas', { ...filas, [idElemento]: { ...(filas[idElemento] || {}), [rol]: letra } });
          return (
            <div className="space-y-3">
              <Campo etiqueta="Roles (cargos) separados por coma">{p => <input {...p} className={claseCampo} value={roles.join(', ')} onChange={evento => cambiar('roles', evento.target.value.split(',').map(rol => rol.trim()).filter(Boolean))} />}</Campo>
              {!elementos.length ? <p className="text-xs text-slate-500">Crea entregables o paquetes de trabajo para asignar responsabilidades.</p> : roles.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead><tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase text-slate-500"><th className="p-2">Entregable o paquete</th>{roles.map(rol => <th key={rol} className="p-2 text-center">{rol}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {elementos.map(elemento => {
                        const aes = Object.values(filas[elemento.id] || {}).filter(letra => letra === 'A').length;
                        return (
                          <tr key={elemento.id} className={aes > 1 ? 'bg-red-50' : ''}>
                            <td className="p-2"><b>{elemento.nombre}</b><span className="block text-[10px] text-slate-500">{elemento.tipo}</span></td>
                            {roles.map(rol => (
                              <td key={rol} className="p-1 text-center">
                                <select aria-label={`${rol} en ${elemento.nombre}`} className="rounded border border-slate-300 px-1 py-0.5" value={filas[elemento.id]?.[rol] || ''} onChange={evento => asignar(elemento.id, rol, evento.target.value)}>
                                  <option value="">—</option>{['R', 'A', 'C', 'I'].map(letra => <option key={letra}>{letra}</option>)}
                                </select>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {problemasRaci.length > 0 && plan.secciones?.raci && <ul className="list-disc pl-4 text-[11px] text-amber-800">{problemasRaci.slice(0, 6).map(problema => <li key={problema}>{problema}</li>)}</ul>}
            </div>
          );
        }}
      </EditorApartado>
    </div>
  );
}
