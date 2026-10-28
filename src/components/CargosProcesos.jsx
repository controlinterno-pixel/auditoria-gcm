import { useMemo, useState } from 'react';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation.js';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard.js';
import { CARGOS_EMPRESA, CARGOS_POR_SEDE, MAPA_PROCESOS } from '../constants/diccionariosGRC';
import { NIVELES_ROL, ORIGENES_ROL, ROLES_BASE, erroresRol } from '../utils/proyectos/rolesProyecto.js';

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
const nombreSedeNormalizado = sede => String(sede || '').trim().toLowerCase();
const cargosIniciales = [...new Set([...CARGOS_EMPRESA, ...Object.values(CARGOS_POR_SEDE).flat()])];
const sedesIniciales = Object.keys(CARGOS_POR_SEDE);

const completarCatalogoInicial = registros => {
  const existentes = new Set(registros.map(registro => nombreCargoNormalizado(registro.cargo)));
  const actualizados = registros.map(registro => {
    const { sedes: _sedesLegacy, ...cargo } = registro;
    return cargo;
  });
  const faltantes = cargosIniciales
    .filter(cargo => !existentes.has(nombreCargoNormalizado(cargo)))
    .map(cargo => ({
      id: nuevoId(),
      cargo,
      correoCorporativo: '',
      macroproceso: '',
      subproceso: '',
      subprocesos: [],
      activo: true,
    }));

  return [...actualizados, ...faltantes];
};

const formularioVacio = {
  cargo: '',
  correoCorporativo: '',
  macroproceso: '',
  subprocesos: [],
};

export default function CargosProcesos({
  isAdmin = false,
  catalogoCargos = [],
  mapaProcesos = {},
  sedesEmpresa = [],
  organizacionesExternas = [],
  rolesProyecto = null,
  catalogosInicializados = false,
  onSaveCatalogos,
  onDeleteCargo,
  showNotification = () => {},
}) {
  const confirmarEliminacion = useDeleteConfirmation();
  const [vistaActiva, setVistaActiva] = useState('cargos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroMacro, setFiltroMacro] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargoEditando, setCargoEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [macroSeleccionado, setMacroSeleccionado] = useState('');
  const [macroNombre, setMacroNombre] = useState('');
  const [subprocesosTexto, setSubprocesosTexto] = useState('');
  const [sedeNueva, setSedeNueva] = useState('');
  const [organizacionNueva, setOrganizacionNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargoModificado, setCargoModificado] = useState(false);
  const [macroModificado, setMacroModificado] = useState(false);
  const [sedeModificada, setSedeModificada] = useState(false);
  const [organizacionModificada, setOrganizacionModificada] = useState(false);
  const [rolEditando, setRolEditando] = useState(null);
  const [rolModificado, setRolModificado] = useState(false);

  const listaCargos = Array.isArray(catalogoCargos) ? catalogoCargos : CARGOS_VACIOS;
  const mapaSeguro = mapaProcesos && typeof mapaProcesos === 'object' ? mapaProcesos : {};
  const macrosDisponibles = Object.keys(mapaSeguro).sort((a, b) => a.localeCompare(b, 'es'));
  const sedesDisponibles = Array.isArray(sedesEmpresa) ? sedesEmpresa : [];
  // Sin catálogo guardado se muestran los roles del manual; al guardar cualquier cambio quedan administrados aquí.
  const rolesDisponibles = Array.isArray(rolesProyecto) ? rolesProyecto : ROLES_BASE;
  const organizacionesDisponibles = Array.isArray(organizacionesExternas) ? [...organizacionesExternas].sort((a, b) => a.localeCompare(b, 'es')) : [];
  const guardCargo = useUnsavedChangesGuard(modalAbierto && cargoModificado, 'la asignación del cargo');
  const guardMacro = useUnsavedChangesGuard(macroModificado, 'el macroproceso');
  const guardSede = useUnsavedChangesGuard(sedeModificada, 'la sede');
  const guardOrganizacion = useUnsavedChangesGuard(organizacionModificada, 'la organización');
  const guardRol = useUnsavedChangesGuard(rolModificado, 'el rol');
  const descartarBorradoresCatalogo = () => {
    setCargoModificado(false);
    setMacroModificado(false);
    setSedeModificada(false);
    setOrganizacionModificada(false);
    setRolModificado(false);
    setRolEditando(null);
    setModalAbierto(false);
    setFormulario(formularioVacio);
    setSedeNueva('');
    setOrganizacionNueva('');
    setMacroNombre(macroSeleccionado);
    setSubprocesosTexto((mapaSeguro[macroSeleccionado] || []).join('\n'));
  };
  const cambiarVistaCatalogo = siguienteVista => guardSede(() => guardOrganizacion(() => guardRol(() => {
    descartarBorradoresCatalogo();
    setVistaActiva(siguienteVista);
  })));
  const requiereCompletarCatalogo = sedesDisponibles.length === 0 || cargosIniciales.some(cargo => (
    !listaCargos.some(registro => nombreCargoNormalizado(registro.cargo) === nombreCargoNormalizado(cargo))
  ));
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

  const guardarCatalogos = async (cargos, procesos, sedes = sedesDisponibles, organizaciones = organizacionesDisponibles, roles = rolesProyecto) => {
    if (typeof onSaveCatalogos !== 'function') return false;
    setGuardando(true);
    try {
      return await onSaveCatalogos(cargos, procesos, sedes, organizaciones, roles);
    } catch (error) {
      showNotification(error.message || 'No se pudo guardar el catálogo.', 'error');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const inicializarCatalogos = async () => {
    const sedesCatalogo = [...new Set([
      ...sedesDisponibles,
      ...listaCargos.flatMap(sedesDelCargo),
      ...sedesIniciales,
    ])];
    const resultado = await guardarCatalogos(
      completarCatalogoInicial(listaCargos),
      Object.keys(mapaSeguro).length ? mapaSeguro : MAPA_PROCESOS,
      sedesCatalogo
    );
    if (resultado !== false) showNotification('Catálogo inicial importado.', 'success');
  };

  const completarCatalogo = async () => {
    const sedesCatalogo = [...new Set([
      ...sedesDisponibles,
      ...listaCargos.flatMap(sedesDelCargo),
      ...sedesIniciales,
    ])];
    if (await guardarCatalogos(completarCatalogoInicial(listaCargos), mapaSeguro, sedesCatalogo) !== false) {
      showNotification('Catálogos base de cargos y sedes incorporados.', 'success');
    }
  };

  const agregarSede = async event => {
    event.preventDefault();
    const nombre = sedeNueva.trim();
    if (!nombre) return false;
    if (sedesDisponibles.some(sede => nombreSedeNormalizado(sede) === nombreSedeNormalizado(nombre))) {
      showNotification('Esa sede ya está registrada.', 'error');
      return false;
    }
    if (await guardarCatalogos(listaCargos, mapaSeguro, [...sedesDisponibles, nombre]) !== false) {
      setSedeNueva('');
      setSedeModificada(false);
      showNotification('Sede agregada al catálogo.', 'success');
      return true;
    }
    return false;
  };

  const eliminarSede = async sede => {
    if (!(await confirmarEliminacion(`Se eliminará ${sede} del catálogo de sedes. Los hallazgos existentes conservarán su valor.`))) return;
    const sedesSiguientes = sedesDisponibles.filter(item => item !== sede);
    if (await guardarCatalogos(listaCargos, mapaSeguro, sedesSiguientes) !== false) {
      showNotification('Sede eliminada del catálogo de opciones.', 'success');
    }
  };

  // Organizaciones externas (aliados, proveedores, entidades, comunidad): las eligen los proyectos para sus
  // interesados y participantes de otras organizaciones.
  const agregarOrganizacion = async event => {
    event.preventDefault();
    const nombre = organizacionNueva.trim().replace(/\s+/g, ' ');
    if (!nombre) return false;
    if (organizacionesDisponibles.some(organizacion => nombreSedeNormalizado(organizacion) === nombreSedeNormalizado(nombre))) {
      showNotification('Esa organización ya está registrada.', 'error');
      return false;
    }
    if (await guardarCatalogos(listaCargos, mapaSeguro, sedesDisponibles, [...organizacionesDisponibles, nombre]) !== false) {
      setOrganizacionNueva('');
      setOrganizacionModificada(false);
      showNotification('Organización agregada al catálogo.', 'success');
      return true;
    }
    return false;
  };

  const eliminarOrganizacion = async organizacion => {
    if (!(await confirmarEliminacion(`Se eliminará ${organizacion} del catálogo de organizaciones. Los proyectos que ya la usan conservan su valor.`))) return;
    if (await guardarCatalogos(listaCargos, mapaSeguro, sedesDisponibles, organizacionesDisponibles.filter(item => item !== organizacion)) !== false) {
      showNotification('Organización eliminada del catálogo de opciones.', 'success');
    }
  };

  // Roles del organigrama de los proyectos (apartado 14 del manual E-ID-MAN-01).
  const guardarRoles = async (roles, mensaje) => {
    if (await guardarCatalogos(listaCargos, mapaSeguro, sedesDisponibles, organizacionesDisponibles, roles) !== false) {
      showNotification(mensaje, 'success');
      return true;
    }
    return false;
  };

  const guardarRol = async event => {
    event.preventDefault();
    const rol = { ...rolEditando, nombre: String(rolEditando.nombre || '').trim().replace(/\s+/g, ' '), id: rolEditando.id || `rol-${nuevoId()}` };
    const error = erroresRol(rol, rolesDisponibles);
    if (error) { showNotification(error, 'error'); return false; }
    const existe = rolesDisponibles.some(item => item.id === rol.id);
    const roles = existe ? rolesDisponibles.map(item => (item.id === rol.id ? rol : item)) : [...rolesDisponibles, { ...rol, activo: true }];
    if (await guardarRoles(roles, existe ? 'Rol actualizado.' : 'Rol agregado.')) {
      setRolEditando(null);
      setRolModificado(false);
      return true;
    }
    return false;
  };

  const alternarRol = rol => guardarRoles(
    rolesDisponibles.map(item => (item.id === rol.id ? { ...item, activo: item.activo === false } : item)),
    rol.activo === false ? `${rol.nombre} vuelve a estar disponible en los proyectos.` : `${rol.nombre} ya no se ofrece en los proyectos.`,
  );

  const eliminarRol = async rol => {
    if (!(await confirmarEliminacion(`Se eliminará el rol ${rol.nombre}. Los proyectos que ya lo usan conservan el nombre escrito.`))) return;
    await guardarRoles(rolesDisponibles.filter(item => item.id !== rol.id), 'Rol eliminado del catálogo.');
  };

  const abrirNuevoCargo = () => {
    setCargoEditando(null);
    setFormulario(formularioVacio);
    setCargoModificado(false);
    setModalAbierto(true);
  };

  const abrirEdicionCargo = registro => {
    setCargoEditando(registro);
    setCargoModificado(false);
    setFormulario({
      cargo: registro.cargo || '',
      correoCorporativo: registro.correoCorporativo || '',
      macroproceso: registro.macroproceso || '',
      subprocesos: subprocesosDelCargo(registro),
    });
    setModalAbierto(true);
  };

  const guardarCargo = async event => {
    event.preventDefault();
    const cargoLimpio = formulario.cargo.trim();
    const correoLimpio = formulario.correoCorporativo.trim().toLowerCase();
    if (!cargoLimpio || !correoValido(correoLimpio) || !formulario.macroproceso || formulario.subprocesos.length === 0) {
      showNotification('Completa cargo, correo corporativo, macroproceso y al menos un subproceso.', 'error');
      return false;
    }

    const { sedes: _sedesLegacy, ...datosCargoEditando } = cargoEditando || {};
    const actualizado = {
      ...datosCargoEditando,
      id: cargoEditando?.id || nuevoId(),
      cargo: cargoLimpio,
      correoCorporativo: correoLimpio,
      macroproceso: formulario.macroproceso,
      subproceso: formulario.subprocesos[0] || '',
      subprocesos: formulario.subprocesos,
      activo: true,
      actualizadoEn: new Date().toISOString(),
    };
    const cargosSiguientes = cargoEditando
      ? listaCargos.map(registro => registro.id === cargoEditando.id ? actualizado : registro)
      : [actualizado, ...listaCargos];

    if (await guardarCatalogos(cargosSiguientes, mapaSeguro) !== false) {
      setCargoModificado(false);
      setModalAbierto(false);
      showNotification(cargoEditando ? 'Cargo actualizado.' : 'Cargo agregado.', 'success');
      return true;
    }
    return false;
  };

  const eliminarCargo = async registro => {
    if (!(await confirmarEliminacion(`Se eliminará la asignación de ${registro.cargo} (${registro.correoCorporativo || 'sin correo'}).`))) return;
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
      return false;
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
      setMacroModificado(false);
      showNotification('Estructura de procesos guardada.', 'success');
      return true;
    }
    return false;
  };

  const eliminarMacroproceso = async () => {
    if (!macroSeleccionado) return;
    const referencias = listaCargos.filter(registro => registro.macroproceso === macroSeleccionado);
    if (referencias.length > 0) {
      showNotification('Reasigna primero los cargos vinculados a este macroproceso.', 'error');
      return;
    }
    if (!(await confirmarEliminacion(`Se eliminará el macroproceso ${macroSeleccionado} junto con sus subprocesos.`))) return;
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
            <p className="mt-1 text-xs text-slate-300">Directorio de cargos, correos corporativos, asignaciones de proceso, sedes, organizaciones externas y roles de proyecto.</p>
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
          <div className="flex border-b border-slate-200" role="tablist" aria-label="Secciones de catálogos">
            <button type="button" role="tab" aria-selected={vistaActiva === 'cargos'} aria-current={vistaActiva === 'cargos' ? 'page' : undefined} onClick={() => cambiarVistaCatalogo('cargos')} className={`min-h-11 border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'cargos' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Cargos y correos</button>
            <button type="button" role="tab" aria-selected={vistaActiva === 'procesos'} aria-current={vistaActiva === 'procesos' ? 'page' : undefined} onClick={() => cambiarVistaCatalogo('procesos')} className={`min-h-11 border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'procesos' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Macroprocesos y subprocesos</button>
            <button type="button" role="tab" aria-selected={vistaActiva === 'sedes'} aria-current={vistaActiva === 'sedes' ? 'page' : undefined} onClick={() => cambiarVistaCatalogo('sedes')} className={`min-h-11 border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'sedes' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Sedes</button>
            <button type="button" role="tab" aria-selected={vistaActiva === 'organizaciones'} aria-current={vistaActiva === 'organizaciones' ? 'page' : undefined} onClick={() => cambiarVistaCatalogo('organizaciones')} className={`min-h-11 border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'organizaciones' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Organizaciones externas</button>
            <button type="button" role="tab" aria-selected={vistaActiva === 'roles'} aria-current={vistaActiva === 'roles' ? 'page' : undefined} onClick={() => cambiarVistaCatalogo('roles')} className={`min-h-11 border-b-2 px-4 py-2.5 text-xs font-black ${vistaActiva === 'roles' ? 'border-blue-600 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Roles de proyecto</button>
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
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-900 text-[10px] uppercase text-white">
                    <tr><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Correo corporativo</th><th className="px-4 py-3">Macroproceso</th><th className="px-4 py-3">Subprocesos</th><th className="px-4 py-3 text-right">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filasFiltradas.map(registro => (
                      <tr key={registro.id} className="hover:bg-blue-50/50">
                        <td className="px-4 py-3 font-bold text-slate-800">{registro.cargo}</td>
                        <td className="px-4 py-3 text-slate-600">{registro.correoCorporativo || <span className="text-amber-700">Pendiente de asignar</span>}</td>
                        <td className="px-4 py-3 text-slate-600">{registro.macroproceso || 'Sin asignar'}</td>
                        <td className="px-4 py-3 text-slate-600">{subprocesosDelCargo(registro).join(', ') || 'Sin asignar'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => abrirEdicionCargo(registro)} className="rounded border border-slate-300 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100">Editar</button>
                            <button type="button" onClick={() => eliminarCargo(registro)} className="rounded border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-50">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filasFiltradas.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-xs text-slate-500">No hay asignaciones que coincidan con la búsqueda.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          ) : vistaActiva === 'procesos' ? (
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">Macroprocesos registrados</h2>
                <div className="space-y-1">
                  {macrosDisponibles.map(macro => (
                    <button key={macro} type="button" onClick={() => guardMacro(() => { setMacroModificado(false); seleccionarMacro(macro); })} aria-current={macroSeleccionado === macro ? 'true' : undefined} className={`min-h-11 w-full rounded-lg px-3 py-2 text-left text-xs font-bold ${macroSeleccionado === macro ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                      <span>{macro}</span><span className="float-right text-[10px] text-slate-400">{mapaSeguro[macro]?.length || 0}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => guardMacro(() => { setMacroModificado(false); setMacroSeleccionado(''); setMacroNombre(''); setSubprocesosTexto(''); })} className="mt-3 min-h-11 rounded border border-blue-200 px-3 py-2 text-[10px] font-black text-blue-800 hover:bg-blue-50">+ Nuevo macroproceso</button>
              </div>
              <form onChangeCapture={() => setMacroModificado(true)} onSubmit={async event => { await guardarMacroproceso(event); }} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
          ) : vistaActiva === 'roles' ? (
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
              <form onChangeCapture={() => setRolModificado(true)} onSubmit={guardarRol} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">{rolEditando?.id ? 'Editar rol' : 'Registrar un rol'}</h2>
                <p className="text-[10px] text-slate-500">Roles que se eligen en el organigrama de los proyectos (apartado 14). Al elegirlos, el proyecto toma su nivel y si es de la empresa o de otra organización.</p>
                <label className="block text-[10px] font-bold text-slate-600">Nombre del rol
                  <input required maxLength="100" value={rolEditando?.nombre || ''} onChange={event => setRolEditando(actual => ({ nivel: 'tactico', origen: 'empresa', ...actual, nombre: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Ej. Interventoría" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-[10px] font-bold text-slate-600">Nivel
                    <select value={rolEditando?.nivel || 'tactico'} onChange={event => setRolEditando(actual => ({ origen: 'empresa', ...actual, nivel: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                      {Object.entries(NIVELES_ROL).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                    </select>
                  </label>
                  <label className="block text-[10px] font-bold text-slate-600">Pertenece a
                    <select value={rolEditando?.origen || 'empresa'} onChange={event => setRolEditando(actual => ({ nivel: 'tactico', ...actual, origen: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
                      {Object.entries(ORIGENES_ROL).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-[10px] font-bold text-slate-600">Qué hace en el proyecto
                  <textarea rows="3" maxLength="500" value={rolEditando?.descripcion || ''} onChange={event => setRolEditando(actual => ({ nivel: 'tactico', origen: 'empresa', ...actual, descripcion: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                </label>
                <label className="block text-[10px] font-bold text-slate-600">Dónde lo dice el manual (opcional)
                  <input maxLength="200" value={rolEditando?.referencia || ''} onChange={event => setRolEditando(actual => ({ nivel: 'tactico', origen: 'empresa', ...actual, referencia: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Ej. Manual E-ID-MAN-01, apartado 14 (pág. 29)" />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  {rolEditando && <button type="button" onClick={() => guardRol(() => { setRolModificado(false); setRolEditando(null); })} className="rounded border border-slate-300 px-3 py-2 text-[10px] font-bold text-slate-700">Cancelar</button>}
                  <button type="submit" disabled={guardando || !String(rolEditando?.nombre || '').trim()} className="rounded-lg bg-[#0a3b32] px-4 py-2 text-[10px] font-black text-white disabled:opacity-50">{guardando ? 'Guardando…' : rolEditando?.id ? 'Guardar rol' : 'Agregar rol'}</button>
                </div>
              </form>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-1 text-xs font-black uppercase tracking-wide text-slate-700">Roles registrados ({rolesDisponibles.filter(rol => rol.activo !== false).length} activos)</h2>
                {!Array.isArray(rolesProyecto) && <p className="mb-2 text-[10px] text-slate-500">Son los roles del manual E-ID-MAN-01. Al agregar, editar o desactivar uno, el catálogo queda guardado y se administra desde aquí.</p>}
                <ul className="divide-y divide-slate-100">
                  {rolesDisponibles.map(rol => (
                    <li key={rol.id} className={`flex flex-col gap-2 py-2 text-xs sm:flex-row sm:items-start sm:justify-between ${rol.activo === false ? 'opacity-60' : ''}`}>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 [overflow-wrap:anywhere]">{rol.nombre}{rol.activo === false && <span className="ml-2 text-[10px] font-bold text-amber-700">Inactivo</span>}</p>
                        <p className="text-[10px] font-bold text-slate-500">{NIVELES_ROL[rol.nivel] || 'Sin nivel'} · {ORIGENES_ROL[rol.origen] || 'La empresa'}</p>
                        {rol.descripcion && <p className="mt-0.5 text-[10px] text-slate-600">{rol.descripcion}</p>}
                        {rol.referencia && <p className="mt-0.5 text-[10px] font-bold text-blue-800">📘 {rol.referencia}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" disabled={guardando} onClick={() => guardRol(() => { setRolModificado(false); setRolEditando({ ...rol }); })} className="rounded border border-slate-300 px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Editar</button>
                        <button type="button" disabled={guardando} onClick={() => alternarRol(rol)} className="rounded border border-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50">{rol.activo === false ? 'Activar' : 'Desactivar'}</button>
                        <button type="button" disabled={guardando} onClick={() => eliminarRol(rol)} className="rounded border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          ) : vistaActiva === 'organizaciones' ? (
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <form onChangeCapture={() => setOrganizacionModificada(true)} onSubmit={agregarOrganizacion} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">Registrar una organización</h2>
                <p className="text-[10px] text-slate-500">Entidades, proveedores, aliados o comunidades con las que se relacionan los proyectos. Se eligen como interesados o participantes externos en Gestión de Proyectos.</p>
                <label className="block text-[10px] font-bold text-slate-600">Nombre de la organización
                  <input required maxLength="150" value={organizacionNueva} onChange={event => setOrganizacionNueva(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Ej. Corporación Autónoma Regional de Risaralda (CARDER)" />
                </label>
                <button type="submit" disabled={guardando || !organizacionNueva.trim()} className="rounded-lg bg-[#0a3b32] px-4 py-2 text-[10px] font-black text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Agregar organización'}</button>
              </form>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">Organizaciones registradas ({organizacionesDisponibles.length})</h2>
                {organizacionesDisponibles.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay organizaciones registradas.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {organizacionesDisponibles.map(organizacion => (
                      <li key={organizacion} className="flex items-center justify-between gap-3 py-2 text-xs">
                        <span className="min-w-0 font-semibold text-slate-700 [overflow-wrap:anywhere]">{organizacion}</span>
                        <button type="button" disabled={guardando} onClick={() => eliminarOrganizacion(organizacion)} className="rounded border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          ) : (
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <form onChangeCapture={() => setSedeModificada(true)} onSubmit={agregarSede} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">Registrar una sede</h2>
                <p className="text-[10px] text-slate-500">Las sedes son opciones independientes y no se asignan a cargos ni procesos.</p>
                <label className="block text-[10px] font-bold text-slate-600">Nombre de la sede
                  <input required maxLength="100" value={sedeNueva} onChange={event => setSedeNueva(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" placeholder="Ej. Hotel" />
                </label>
                <button type="submit" disabled={guardando || !sedeNueva.trim()} className="rounded-lg bg-[#0a3b32] px-4 py-2 text-[10px] font-black text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Agregar sede'}</button>
              </form>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">Sedes disponibles</h2>
                {sedesDisponibles.length === 0 ? (
                  <p className="text-xs text-slate-500">Aún no hay sedes registradas.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sedesDisponibles.map(sede => (
                      <li key={sede} className="flex items-center justify-between gap-3 py-2 text-xs">
                        <span className="font-semibold text-slate-700">{sede}</span>
                        <button type="button" disabled={guardando} onClick={() => eliminarSede(sede)} className="rounded border border-red-200 px-2.5 py-1 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Eliminar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </section>
          )}
        </>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="cargo-modal-titulo">
          <form onChangeCapture={() => setCargoModificado(true)} onSubmit={guardarCargo} className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <h2 id="cargo-modal-titulo" className="text-sm font-black text-slate-900">{cargoEditando ? 'Editar asignación' : 'Agregar asignación'}</h2>
              <button type="button" aria-label="Cerrar y salir del formulario de cargo" onClick={() => guardCargo(() => { setCargoModificado(false); setFormulario(formularioVacio); setModalAbierto(false); })} className="min-h-11 min-w-11 text-xl text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">×</button>
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
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => guardCargo(() => { setCargoModificado(false); setFormulario(formularioVacio); setModalAbierto(false); })} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancelar</button>
              <button type="submit" disabled={guardando} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar cargo'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}