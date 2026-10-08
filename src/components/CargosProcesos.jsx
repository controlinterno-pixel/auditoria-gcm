import { useMemo, useState } from 'react';
import { CARGOS_EMPRESA, CARGOS_POR_SEDE, MAPA_PROCESOS } from '../constants/diccionariosGRC';

const correoValido = valor => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim()) && String(valor || '').trim().toLowerCase().endsWith('@termales.com.co');
const nuevoId = () => globalThis.crypto?.randomUUID?.() || `cargo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CARGOS_VACIOS = [];
const subprocesosDelCargo = registro => (
  Array.isArray(registro?.subprocesos)
    ? registro.subprocesos
    : registro?.subproceso ? [registro.subproceso] : []
);
const sedesDelCargo = registro => Array.isArray(registro?.sedes) ? registro.sedes : [];
const nombreCargoNormalizado = cargo => String(cargo || '').trim().toLowerCase();
const cargosIniciales = [...new Set([...CARGOS_EMPRESA, ...Object.values(CARGOS_POR_SEDE).flat()])];
const sedesInicialesPorCargo = Object.entries(CARGOS_POR_SEDE).reduce((acumulado, [sede, cargos]) => {
  cargos.forEach(cargo => {
    const clave = nombreCargoNormalizado(cargo);
    acumulado.set(clave, [...new Set([...(acumulado.get(clave) || []), sede])]);
  });
  return acumulado;
}, new Map());

const completarCatalogoInicial = registros => {
  const existentes = new Set(registros.map(registro => nombreCargoNormalizado(registro.cargo)));
  const actualizados = registros.map(registro => ({
    ...registro,
    sedes: [...new Set([
      ...sedesDelCargo(registro),
      ...(sedesInicialesPorCargo.get(nombreCargoNormalizado(registro.cargo)) || []),
    ])],
  }));
  const faltantes = cargosIniciales
    .filter(cargo => !existentes.has(nombreCargoNormalizado(cargo)))
    .map(cargo => ({
      id: nuevoId(),
      cargo,
      correoCorporativo: '',
      macroproceso: '',
      subproceso: '',
      subprocesos: [],
      sedes: sedesInicialesPorCargo.get(nombreCargoNormalizado(cargo)) || [],
      activo: true,
    }));

  return [...actualizados, ...faltantes];
};

const formularioVacio = {
  cargo: '',
  correoCorporativo: '',
  macroproceso: '',
  subprocesos: [],
  sedes: [],
};

export default function CargosProcesos({
  isAdmin = false,
  catalogoCargos = [],
  mapaProcesos = {},
  catalogosInicializados = false,
  onSaveCatalogos,
  onDeleteCargo,
  showNotification = () => {},
}) {
  const [vistaActiva, setVistaActiva] = useState('cargos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroMacro, setFiltroMacro] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargoEditando, setCargoEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [macroSeleccionado, setMacroSeleccionado] = useState('');
  const [macroNombre, setMacroNombre] = useState('');
  const [subprocesosTexto, setSubprocesosTexto] = useState('');
  const [guardando, setGuardando] = useState(false);

  const listaCargos = Array.isArray(catalogoCargos) ? catalogoCargos : CARGOS_VACIOS;
  const mapaSeguro = mapaProcesos && typeof mapaProcesos === 'object' ? mapaProcesos : {};
  const macrosDisponibles = Object.keys(mapaSeguro).sort((a, b) => a.localeCompare(b, 'es'));
  const sedesDisponibles = [...new Set(listaCargos.flatMap(sedesDelCargo))].sort((a, b) => a.localeCompare(b, 'es'));
  const requiereCompletarCatalogo = sedesDisponibles.length === 0 || cargosIniciales.some(cargo => {
    const registrosCargo = listaCargos.filter(registro => nombreCargoNormalizado(registro.cargo) === nombreCargoNormalizado(cargo));
    if (registrosCargo.length === 0) return true;
    const sedesEsperadas = sedesInicialesPorCargo.get(nombreCargoNormalizado(cargo)) || [];
    return registrosCargo.some(registro => !Array.isArray(registro.sedes)) || sedesEsperadas.some(sede => (
      !registrosCargo.some(registro => sedesDelCargo(registro).includes(sede))
    ));
  });
  const filasFiltradas = useMemo(() => {
    const busquedaLimpia = busqueda.trim().toLowerCase();
    return listaCargos
      .filter(registro => !filtroMacro || registro.macroproceso === filtroMacro)
      .filter(registro => !busquedaLimpia || [
        registro.cargo,
        registro.correoCorporativo,
        registro.macroproceso,
        subprocesosDelCargo(registro).join(' '),
      ].some(valor => String(valor || '').toLowerCase().includes(busquedaLimpia)))
      .sort((a, b) => String(a.cargo || '').localeCompare(String(b.cargo || ''), 'es'));
  }, [listaCargos, busqueda, filtroMacro]);

  const guardarCatalogos = async (cargos, procesos) => {
    if (typeof onSaveCatalogos !== 'function') return false;
    setGuardando(true);
    try {
      return await onSaveCatalogos(cargos, procesos);
    } catch (error) {
      showNotification(error.message || 'No se pudo guardar el catálogo.', 'error');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const inicializarCatalogos = async () => {
    const resultado = await guardarCatalogos(
      completarCatalogoInicial(listaCargos),
      Object.keys(mapaSeguro).length ? mapaSeguro : MAPA_PROCESOS
    );
    if (resultado !== false) showNotification('Catálogo inicial importado.', 'success');
  };

  const completarCatalogo = async () => {
    if (await guardarCatalogos(completarCatalogoInicial(listaCargos), mapaSeguro) !== false) {
      showNotification('Cargos y sedes base incorporados al catálogo.', 'success');
    }
  };

  const abrirNuevoCargo = () => {
    setCargoEditando(null);
    setFormulario(formularioVacio);
    setModalAbierto(true);
  };

  const abrirEdicionCargo = registro => {
    setCargoEditando(registro);
    setFormulario({
      cargo: registro.cargo || '',
      correoCorporativo: registro.correoCorporativo || '',
      macroproceso: registro.macroproceso || '',
      subprocesos: subprocesosDelCargo(registro),
      sedes: sedesDelCargo(registro),
    });
    setModalAbierto(true);
  };

  const guardarCargo = async event => {
    event.preventDefault();
    const cargoLimpio = formulario.cargo.trim();
    const correoLimpio = formulario.correoCorporativo.trim().toLowerCase();
    if (!cargoLimpio || !correoValido(correoLimpio) || !formulario.macroproceso || formulario.subprocesos.length === 0) {
      showNotification('Completa cargo, correo corporativo, macroproceso y al menos un subproceso.', 'error');
      return;
    }

    const actualizado = {
      ...(cargoEditando || {}),
      id: cargoEditando?.id || nuevoId(),
      cargo: cargoLimpio,
      correoCorporativo: correoLimpio,
      macroproceso: formulario.macroproceso,
      subproceso: formulario.subprocesos[0] || '',
      subprocesos: formulario.subprocesos,
      sedes: formulario.sedes,
      activo: true,
      actualizadoEn: new Date().toISOString(),
    };
    const cargosSiguientes = cargoEditando
      ? listaCargos.map(registro => registro.id === cargoEditando.id ? actualizado : registro)
      : [actualizado, ...listaCargos];

    if (await guardarCatalogos(cargosSiguientes, mapaSeguro) !== false) {
      setModalAbierto(false);
      showNotification(cargoEditando ? 'Cargo actualizado.' : 'Cargo agregado.', 'success');
    }
  };

  const eliminarCargo = async registro => {
    if (!window.confirm(`¿Eliminar la asignación de ${registro.cargo} (${registro.correoCorporativo || 'sin correo'})?`)) return;
    if (typeof onDeleteCargo === 'function') {
      try {
        const eliminado = await onDeleteCargo(registro.id);
        if (eliminado) showNotification('Asignación eliminada del catálogo.', 'success');
      } catch (error) {
        showNotification(error.message || 'No se pudo eliminar la asignación.', 'error');
      }
      return;
    }
    const cargosSiguientes = listaCargos.filter(item => item.id !== registro.id);
    if (await guardarCatalogos(cargosSiguientes, mapaSeguro) !== false) {
      showNotification('Asignación eliminada del catálogo.', 'success');
    }
  };

  const seleccionarMacro = nombre => {
    setMacroSeleccionado(nombre);
    setMacroNombre(nombre);
    setSubprocesosTexto((mapaSeguro[nombre] || []).join('\n'));
  };

  const guardarMacroproceso = async event => {
    event.preventDefault();
    const nombreNuevo = macroNombre.trim();
    const subprocesos = [...new Set(subprocesosTexto.split('\n').map(valor => valor.trim()).filter(Boolean))];
    if (!nombreNuevo || subprocesos.length === 0) {
      showNotification('Indica el macroproceso y al menos un subproceso.', 'error');
      return;
    }

    const mapaSiguiente = { ...mapaSeguro };
    if (macroSeleccionado && macroSeleccionado !== nombreNuevo) delete mapaSiguiente[macroSeleccionado];
    mapaSiguiente[nombreNuevo] = subprocesos;
    const cargosSiguientes = listaCargos.map(registro => {
      if (registro.macroproceso !== macroSeleccionado || !macroSeleccionado) return registro;
      return {
        ...registro,
        macroproceso: nombreNuevo,
        subproceso: subprocesosDelCargo(registro).find(subproceso => subprocesos.includes(subproceso)) || '',
        subprocesos: subprocesosDelCargo(registro).filter(subproceso => subprocesos.includes(subproceso)),
      };
    });

    if (await guardarCatalogos(cargosSiguientes, mapaSiguiente) !== false) {
      setMacroSeleccionado(nombreNuevo);
      setMacroNombre(nombreNuevo);
      setSubprocesosTexto(subprocesos.join('\n'));
      showNotification('Estructura de procesos guardada.', 'success');
    }
  };

  const eliminarMacroproceso = async () => {
    if (!macroSeleccionado) return;
    const referencias = listaCargos.filter(registro => registro.macroproceso === macroSeleccionado);
    if (referencias.length > 0) {
      showNotification('Reasigna primero los cargos vinculados a este macroproceso.', 'error');
      return;
    }
    if (!window.confirm(`¿Eliminar el macroproceso ${macroSeleccionado} y sus subprocesos?`)) return;
    const mapaSiguiente = { ...mapaSeguro };
    delete mapaSiguiente[macroSeleccionado];
    if (await guardarCatalogos(listaCargos, mapaSiguiente) !== false) {
      setMacroSeleccionado('');
      setMacroNombre('');
      setSubprocesosTexto('');
      showNotification('Macroproceso eliminado.', 'success');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="relative overflow-hidden rounded-xl border border-slate-800 p-6 shadow-lg">
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('/Informes.png')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1e3f] via-[#0a1e3f]/95 to-[#0a1e3f]/80" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Administración de estructura</p>
            <h1 className="mt-1 text-xl font-black text-white">Cargos y Procesos</h1>
            <p className="mt-1 text-xs text-slate-300">Directorio de cargos, correos corporativos y asignaciones de proceso.</p>
          </div>
          {catalogosInicializados && vistaActiva === 'cargos' && (
            <button type="button" onClick={abrirNuevoCargo} className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-500">
              + Agregar asignación
            </button>
          )}
        </div>
      </header>

      {!catalogosInicializados ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-sm font-black text-slate-800">Inicializar catálogo administrable</h2>
          <p className="mt-1 text-xs text-slate-600">Se copiarán los cargos y procesos actuales al catálogo central. Después podrás completar correos y asignaciones, y los formularios usarán esta fuente.</p>
          <button type="button" disabled={guardando} onClick={inicializarCatalogos} className="mt-4 rounded-lg bg-[#0a3b32] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
            {guardando ? 'Guardando…' : 'Importar catálogo actual'}
          </button>
        </section>
      ) : (
        <>
          <div className="flex border-b border-slate-200">
            <button type="button" onClick={() => setVistaActiva('cargos')} className={`border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'cargos' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Cargos y correos</button>
            <button type="button" onClick={() => setVistaActiva('procesos')} className={`border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'procesos' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Macroprocesos y subprocesos</button>
          </div>

          {vistaActiva === 'cargos' ? (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar cargo, correo o proceso" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:w-64" />
                  <select value={filtroMacro} onChange={event => setFiltroMacro(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="">Todos los macroprocesos</option>
                    {macrosDisponibles.map(macro => <option key={macro} value={macro}>{macro}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500">{filasFiltradas.length} asignaciones</span>
                  {requiereCompletarCatalogo && <button type="button" disabled={guardando} onClick={completarCatalogo} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-black text-amber-800 hover:bg-amber-100 disabled:opacity-50">{guardando ? 'Actualizando…' : 'Completar cargos y sedes base'}</button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-slate-900 text-[10px] uppercase text-white">
                    <tr><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Correo corporativo</th><th className="px-4 py-3">Macroproceso</th><th className="px-4 py-3">Subprocesos</th><th className="px-4 py-3">Sedes</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filasFiltradas.map(registro => (
                      <tr key={registro.id} className="hover:bg-blue-50/50">
                        <td className="px-4 py-3 font-bold text-slate-800">{registro.cargo}</td>
                        <td className="px-4 py-3 text-slate-600">{registro.correoCorporativo || <span className="text-amber-700">Pendiente de asignar</span>}</td>
                        <td className="px-4 py-3 text-slate-600">{registro.macroproceso || 'Sin asignar'}</td>
                        <td className="px-4 py-3 text-slate-600">{subprocesosDelCargo(registro).join(', ') || 'Sin asignar'}</td>
                        <td className="px-4 py-3 text-slate-600">{sedesDelCargo(registro).join(', ') || 'Sin asignar'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => abrirEdicionCargo(registro)} className="rounded border border-slate-300 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100">Editar</button>
                            <button type="button" onClick={() => eliminarCargo(registro)} className="rounded border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-50">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filasFiltradas.length === 0 && <tr><td colSpan="6" className="px-4 py-10 text-center text-xs text-slate-500">No hay asignaciones que coincidan con la búsqueda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">Macroprocesos registrados</h2>
                <div className="space-y-1">
                  {macrosDisponibles.map(macro => (
                    <button key={macro} type="button" onClick={() => seleccionarMacro(macro)} className={`w-full rounded-lg px-3 py-2 text-left text-xs font-bold ${macroSeleccionado === macro ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <span>{macro}</span><span className="float-right text-[10px] text-slate-400">{mapaSeguro[macro]?.length || 0}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setMacroSeleccionado(''); setMacroNombre(''); setSubprocesosTexto(''); }} className="mt-3 rounded border border-blue-200 px-3 py-2 text-[10px] font-black text-blue-800 hover:bg-blue-50">+ Nuevo macroproceso</button>
              </div>
              <form onSubmit={guardarMacroproceso} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">{macroSeleccionado ? 'Editar macroproceso' : 'Crear macroproceso'}</h2>
                <label className="block text-[10px] font-bold text-slate-600">Nombre del macroproceso
                  <input required value={macroNombre} onChange={event => setMacroNombre(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                </label>
                <label className="block text-[10px] font-bold text-slate-600">Subprocesos, uno por línea
                  <textarea required rows="8" value={subprocesosTexto} onChange={event => setSubprocesosTexto(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                </label>
                <div className="flex flex-wrap justify-between gap-2">
                  {macroSeleccionado && <button type="button" onClick={eliminarMacroproceso} className="rounded border border-red-200 px-3 py-2 text-[10px] font-bold text-red-700 hover:bg-red-50">Eliminar macroproceso</button>}
                  <button type="submit" disabled={guardando} className="ml-auto rounded-lg bg-[#0a3b32] px-4 py-2 text-[10px] font-black text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar estructura'}</button>
                </div>
              </form>
            </section>
          )}
        </>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="cargo-modal-titulo">
          <form onSubmit={guardarCargo} className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <h2 id="cargo-modal-titulo" className="text-sm font-black text-slate-900">{cargoEditando ? 'Editar asignación' : 'Agregar asignación'}</h2>
              <button type="button" aria-label="Cerrar" onClick={() => setModalAbierto(false)} className="text-xl text-slate-500 hover:text-slate-900">×</button>
            </div>
            <label className="block text-[10px] font-bold text-slate-600">Cargo
              <input required maxLength="120" value={formulario.cargo} onChange={event => setFormulario(prev => ({ ...prev, cargo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            </label>
            <label className="block text-[10px] font-bold text-slate-600">Correo corporativo
              <input required type="email" value={formulario.correoCorporativo} onChange={event => setFormulario(prev => ({ ...prev, correoCorporativo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[10px] font-bold text-slate-600">Macroproceso
                <select required value={formulario.macroproceso} onChange={event => setFormulario(prev => ({ ...prev, macroproceso: event.target.value, subprocesos: [] }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                  <option value="">Seleccionar…</option>
                  {macrosDisponibles.map(macro => <option key={macro} value={macro}>{macro}</option>)}
                </select>
              </label>
              <fieldset disabled={!formulario.macroproceso} className="rounded-lg border border-slate-200 p-3 disabled:bg-slate-100 sm:col-span-2">
                <legend className="px-1 text-[10px] font-bold text-slate-600">Subprocesos vinculados</legend>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">{formulario.subprocesos.length} seleccionados</span>
                  <button type="button" disabled={!formulario.macroproceso} onClick={() => setFormulario(prev => ({ ...prev, subprocesos: [...(mapaSeguro[prev.macroproceso] || [])] }))} className="text-[10px] font-bold text-blue-700 hover:text-blue-900 disabled:opacity-50">Seleccionar todos</button>
                </div>
                <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
                  {(mapaSeguro[formulario.macroproceso] || []).map(subproceso => (
                    <label key={subproceso} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:bg-blue-50">
                      <input type="checkbox" checked={formulario.subprocesos.includes(subproceso)} onChange={event => setFormulario(prev => ({
                        ...prev,
                        subprocesos: event.target.checked
                          ? [...new Set([...prev.subprocesos, subproceso])]
                          : prev.subprocesos.filter(valor => valor !== subproceso),
                      }))} className="mt-0.5 accent-blue-700" />
                      <span>{subproceso}</span>
                    </label>
                  ))}
                  {formulario.macroproceso && (mapaSeguro[formulario.macroproceso] || []).length === 0 && (
                    <p className="text-[10px] text-amber-700">Este macroproceso aún no tiene subprocesos.</p>
                  )}
                </div>
              </fieldset>
              <fieldset className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
                <legend className="px-1 text-[10px] font-bold text-slate-600">Sedes donde aplica el cargo</legend>
                {sedesDisponibles.length > 0 ? (
                  <div className="grid max-h-32 gap-1 overflow-y-auto sm:grid-cols-2">
                    {sedesDisponibles.map(sede => (
                      <label key={sede} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:bg-blue-50">
                        <input type="checkbox" checked={formulario.sedes.includes(sede)} onChange={event => setFormulario(prev => ({
                          ...prev,
                          sedes: event.target.checked
                            ? [...new Set([...prev.sedes, sede])]
                            : prev.sedes.filter(valor => valor !== sede),
                        }))} className="accent-blue-700" />
                        <span>{sede}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="text-[10px] text-amber-700">Completa primero las sedes del catálogo base.</p>}
              </fieldset>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setModalAbierto(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancelar</button>
              <button type="submit" disabled={guardando} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar cargo'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}