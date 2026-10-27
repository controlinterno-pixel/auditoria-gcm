// src/components/proyectos/HistorialProyecto.jsx - Historial verificable (lo escribe solo el servidor, con
// fecha del servidor). Se carga por páginas de 50 al abrir esta pestaña, para no gastar lecturas.
import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import { fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { EstadoVacio, Seccion, botonSecundario } from './ui.jsx';

const NOMBRES = {
  crear: 'Creó el proyecto', 'editar-ficha': 'Editó la ficha', 'solicitar-estado': 'Solicitó cambio de estado', 'aprobar-estado': 'Autorizó cambio de estado',
  'rechazar-estado': 'Rechazó cambio de estado', 'cambiar-estado': 'Cambió el estado', 'explicar-estado': 'Explicó el estado', 'guardar-cierre': 'Registró el cierre',
  archivar: 'Archivó', desarchivar: 'Desarchivó', 'crear-tarea': 'Creó tarea', 'editar-tarea': 'Editó tarea', 'reprogramar-por-dependencia': 'Reprogramó por dependencia',
  'aprobar-tarea': 'Aprobó tarea', 'devolver-tarea': 'Devolvió tarea', 'comentar-tarea': 'Comentó tarea', 'establecer-linea-base': 'Estableció línea base',
  'crear-sprint': 'Creó sprint', 'editar-sprint': 'Editó sprint', 'crear-entregable': 'Creó entregable', 'editar-entregable': 'Editó entregable',
  'presentar-entregable': 'Presentó entregable', 'revisar-entregable': 'Revisó entregable', 'crear-riesgo': 'Registró riesgo o incidencia', 'editar-riesgo': 'Editó riesgo o incidencia',
  'solicitar-cambio': 'Solicitó cambio', 'editar-cambio': 'Editó solicitud de cambio', 'decidir-cambio': 'Decidió sobre un cambio', 'revisar-presupuesto': 'Revisó el presupuesto',
  'registrar-reunion': 'Registró reunión', 'editar-reunion': 'Editó acta', 'actualizar-compromiso': 'Actualizó compromiso', 'registrar-costo': 'Registró costo',
  'anular-costo': 'Anuló costo', 'estimar-costo-final': 'Estimó el costo final',
};
const resumir = valor => (valor && typeof valor === 'object' ? Object.entries(valor).map(([campo, dato]) => `${campo}: ${typeof dato === 'object' ? JSON.stringify(dato) : dato}`).join(' · ') : '');

export default function HistorialProyecto({ proyecto }) {
  const [eventos, setEventos] = useState([]);
  const [siguiente, setSiguiente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const pedir = useCallback((despuesDe = '', vigente = () => true) => apiService.historialProyecto(proyecto.id, despuesDe).then(
    respuesta => {
      if (!vigente()) return;
      setEventos(actuales => (despuesDe ? [...actuales, ...(respuesta.eventos || [])] : respuesta.eventos || []));
      setSiguiente(respuesta.siguiente || null);
      setError('');
      setCargando(false);
    },
    falla => {
      if (!vigente()) return;
      setError(falla?.message || 'No se pudo cargar el historial.');
      setCargando(false);
    },
  ), [proyecto.id]);
  // Se recarga cuando el proyecto cambia de versión (alguien guardó) mientras la pestaña está abierta.
  useEffect(() => {
    let activo = true;
    void pedir('', () => activo);
    return () => { activo = false; };
  }, [pedir, proyecto.version]);
  const cargarMas = despuesDe => { setCargando(true); setError(''); void pedir(despuesDe); };

  return (
    <Seccion titulo="Historial de actividad" descripcion="Quién hizo qué, cuándo (hora del servidor), valores anteriores y nuevos, y motivo. No se puede editar desde la aplicación.">
      {error && <p role="alert" className="mb-3 text-sm font-bold text-red-600">{error}</p>}
      {!eventos.length && !cargando ? <EstadoVacio titulo="Sin eventos" /> : (
        <ol className="space-y-2 text-xs">
          {eventos.map(evento => (
            <li key={evento.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
              <p><b>{NOMBRES[evento.accion] || evento.accion}</b> {evento.idRecurso && <span className="font-bold text-slate-600">{evento.idRecurso}</span>} · {evento.nombreUsuario || nombreDeCorreo(evento.usuario)} <span className="text-slate-500">({evento.usuario}) · {fechaHora(evento.fecha)}</span></p>
              {evento.antes && <p className="mt-0.5 break-words text-slate-500">Antes: {resumir(evento.antes)}</p>}
              {evento.despues && <p className="mt-0.5 break-words text-slate-700">Después: {resumir(evento.despues)}</p>}
              {evento.motivo && <p className="mt-0.5 text-slate-700">Motivo: {evento.motivo}</p>}
              {evento.referencia && <p className="mt-0.5 text-slate-500">Referencia: {evento.referencia}</p>}
            </li>
          ))}
        </ol>
      )}
      {cargando && <p role="status" className="mt-2 text-xs text-slate-500">Cargando…</p>}
      {siguiente && !cargando && <button type="button" className={`${botonSecundario} mt-3`} onClick={() => cargarMas(siguiente)}>Cargar más</button>}
    </Seccion>
  );
}
