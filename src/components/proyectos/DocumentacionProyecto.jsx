// src/components/proyectos/DocumentacionProyecto.jsx - Documentación del proyecto (manual 6.1): formatos y
// anexos por fase, guardados en el repositorio de archivos de Termales con el prefijo del proyecto y versiones.
import { useState } from 'react';
import { apiService } from '../../services/apiService';
import { DOCUMENTOS, FASES_CICLO, estadoDocumento, nombreArchivoDocumento } from '../../utils/proyectos/metodologia.js';
import { fechaHora, nombreDeCorreo } from '../../utils/proyectos/formato.js';
import { Insignia, Seccion, botonSecundario } from './ui.jsx';

const ESTADO = {
  archivo: ['verde', 'Archivo cargado'], app: ['azul', 'Diligenciado en la aplicación'], noAplica: ['gris', 'No aplica'], pendiente: ['amarillo', 'Pendiente'], opcional: ['gris', 'Opcional'],
};

function CargarDocumento({ proyecto, documento, version, usuario, onCargado }) {
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState('');
  const subir = async evento => {
    const original = evento.target.files?.[0];
    evento.target.value = '';
    if (!original) return;
    // El manual pide el prefijo del proyecto en el nombre: E1_SP1_PY1_Formato3_..._v2.pdf
    const extension = original.name.includes('.') ? original.name.split('.').pop().toLowerCase() : '';
    const archivo = new File([original], nombreArchivoDocumento(proyecto, documento, version, extension), { type: original.type });
    setError('');
    setProgreso(0);
    try {
      const resultado = await apiService.subirEvidencia(archivo, { conservarOriginal: true }, setProgreso);
      const url = apiService.resolveArchivoUrl?.({ appName: resultado?.appName, fileName: resultado?.fileName, url: resultado?.url }) || resultado?.url;
      if (!url) throw new Error('El repositorio de archivos no devolvió el enlace.');
      await onCargado({ url, nombre: archivo.name, subidoPor: usuario?.email });
    } catch (falla) {
      setError(falla?.message || 'No se pudo cargar el archivo.');
    } finally {
      setProgreso(null);
    }
  };
  return (
    <div>
      <label className={`${botonSecundario} cursor-pointer ${progreso !== null ? 'pointer-events-none opacity-50' : ''}`}>
        {progreso !== null ? `Cargando ${Math.round(progreso)} %` : version > 1 ? `Cargar versión ${version}` : 'Cargar archivo'}
        <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx" onChange={subir} />
      </label>
      {error && <p role="alert" className="mt-1 text-[11px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

export default function DocumentacionProyecto({ proyecto, plan, cap, usuario, operar, guardando, pedirTexto }) {
  const prefijo = proyecto.codigoEstrategico || proyecto.codigo;
  const marcarNoAplica = async documento => {
    const justificacion = await pedirTexto({ titulo: `${documento.nombre}: no aplica`, etiqueta: 'Justificación', confirmar: 'Marcar como no aplica' });
    if (justificacion) await operar('marcarDocumento', { idDocumento: documento.id, justificacion }, 'Documento marcado como no aplica.');
  };
  return (
    <div className="space-y-4">
      <Seccion titulo="Documentación del proyecto" descripcion={`Los archivos se guardan en el repositorio de Termales con el prefijo ${prefijo} y se conservan todas las versiones (la última es la vigente). Los formatos que la aplicación ya diligencia no necesitan archivo, salvo que quieras adjuntar el firmado.`}>
        {!proyecto.codigoEstrategico && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Asigna el código del portafolio en la ficha para que los archivos lleven el prefijo del manual (por ejemplo E1_SP1_PY1).</p>}
        <div className="space-y-4">
          {Object.entries(FASES_CICLO).map(([fase, nombre], indice) => (
            <div key={fase}>
              <h4 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">{indice + 1}_{nombre}</h4>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {DOCUMENTOS.filter(documento => documento.fase === fase).map(documento => {
                  const estado = estadoDocumento(documento, proyecto, plan);
                  const registro = plan.documentos?.[documento.id];
                  const versiones = registro?.versiones || [];
                  return (
                    <li key={documento.id} className="p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-800">{documento.nombre}{documento.opcional ? ' (opcional)' : ''}</p>
                          <p className="text-slate-500">{nombreArchivoDocumento(proyecto, documento, versiones.length + 1, 'pdf')}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Insignia tono={ESTADO[estado][0]}>{ESTADO[estado][1]}</Insignia>
                          {cap.aportar && <CargarDocumento proyecto={proyecto} documento={documento} version={versiones.length + 1} usuario={usuario}
                            onCargado={archivo => operar('subirDocumento', { idDocumento: documento.id, archivo }, 'Documento cargado en el repositorio.')} />}
                          {cap.gestionar && estado === 'pendiente' && <button type="button" className={botonSecundario} disabled={guardando} onClick={() => marcarNoAplica(documento)}>No aplica</button>}
                          {cap.gestionar && registro?.noAplica && <button type="button" className={botonSecundario} disabled={guardando} onClick={() => operar('marcarDocumento', { idDocumento: documento.id, noAplica: false }, 'Documento marcado como requerido.')}>Sí aplica</button>}
                        </div>
                      </div>
                      {registro?.noAplica && <p className="mt-1 text-slate-600">No aplica: {registro.noAplica.justificacion} · {nombreDeCorreo(registro.noAplica.por)}</p>}
                      {versiones.length > 0 && (
                        <ol className="mt-2 space-y-1">
                          {[...versiones].reverse().map((version, posicion) => (
                            <li key={version.version} className="flex flex-wrap items-center gap-2">
                              <Insignia tono={posicion === 0 ? 'verde' : 'gris'}>{posicion === 0 ? 'Versión actual' : 'Versión anterior'}</Insignia>
                              <a href={version.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0055ff] hover:underline">v{version.version} · {version.nombre}</a>
                              <span className="text-slate-500">{nombreDeCorreo(version.por)} · {fechaHora(version.fecha)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  );
}
