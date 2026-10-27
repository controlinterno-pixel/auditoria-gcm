// src/components/proyectos/LeccionesAprendidas.jsx - Base corporativa de lecciones aprendidas (manual 4.2.2):
// se consulta antes de iniciar nuevas iniciativas. Se lee solo al abrirla (1 lectura por proyecto).
import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/apiService';
import { FASES_CICLO } from '../../utils/proyectos/metodologia.js';
import { Campo, EstadoVacio, Insignia, Modal, claseCampo } from './ui.jsx';

export default function LeccionesAprendidas({ categorias, onCerrar }) {
  const [estado, setEstado] = useState({ cargando: true, error: '', lecciones: [] });
  const [filtro, setFiltro] = useState({ texto: '', categoria: '', tipo: '' });
  useEffect(() => {
    let activo = true;
    apiService.leccionesProyectos().then(
      respuesta => activo && setEstado({ cargando: false, error: '', lecciones: respuesta?.lecciones || [] }),
      error => activo && setEstado({ cargando: false, error: error?.message || 'No se pudo cargar la base de lecciones.', lecciones: [] }),
    );
    return () => { activo = false; };
  }, []);
  const filtradas = useMemo(() => estado.lecciones.filter(leccion => (!filtro.categoria || leccion.categoria === filtro.categoria)
    && (!filtro.tipo || leccion.tipo === filtro.tipo)
    && (!filtro.texto.trim() || `${leccion.situacion} ${leccion.recomendacion} ${leccion.proyecto} ${leccion.area}`.toLowerCase().includes(filtro.texto.trim().toLowerCase()))), [estado.lecciones, filtro]);

  return (
    <Modal titulo="Base de lecciones aprendidas" ancho="max-w-4xl" onCerrar={onCerrar}>
      <p className="mb-3 text-xs text-slate-600">Lecciones registradas en el cierre de los proyectos. Consúltalas antes de formular un proyecto nuevo.</p>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Buscar">{p => <input {...p} type="search" className={claseCampo} value={filtro.texto} onChange={evento => setFiltro(actual => ({ ...actual, texto: evento.target.value }))} />}</Campo>
        <Campo etiqueta="Categoría">{p => <select {...p} className={claseCampo} value={filtro.categoria} onChange={evento => setFiltro(actual => ({ ...actual, categoria: evento.target.value }))}><option value="">Todas</option>{Object.entries(categorias).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
        <Campo etiqueta="Tipo">{p => <select {...p} className={claseCampo} value={filtro.tipo} onChange={evento => setFiltro(actual => ({ ...actual, tipo: evento.target.value }))}><option value="">Todos</option><option value="plus">Plus (funcionó)</option><option value="delta">Delta (por mejorar)</option></select>}</Campo>
      </div>
      {estado.cargando && <p role="status" className="text-sm text-slate-500">Cargando…</p>}
      {estado.error && <p role="alert" className="text-sm font-bold text-red-600">{estado.error}</p>}
      {!estado.cargando && !estado.error && (!filtradas.length ? <EstadoVacio titulo="Sin lecciones" descripcion="Aparecen cuando los proyectos registran sus lecciones aprendidas." /> : (
        <ul className="space-y-2">
          {filtradas.map((leccion, indice) => (
            <li key={`${leccion.codigo}-${indice}`} className="rounded-xl border border-slate-200 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Insignia tono={leccion.tipo === 'plus' ? 'verde' : 'amarillo'}>{leccion.tipo === 'plus' ? 'Plus' : 'Delta'}</Insignia>
                <Insignia>{categorias[leccion.categoria] || leccion.categoria}</Insignia>
                {leccion.fase && <Insignia tono="azul">{FASES_CICLO[leccion.fase]}</Insignia>}
                <span className="font-bold text-slate-600">{leccion.codigo} · {leccion.proyecto}{leccion.area ? ` · ${leccion.area}` : ''}</span>
              </div>
              <p className="mt-1 text-slate-800">{leccion.situacion}</p>
              {leccion.recomendacion && <p className="mt-1 text-slate-600"><b>Recomendación:</b> {leccion.recomendacion}</p>}
            </li>
          ))}
        </ul>
      ))}
    </Modal>
  );
}
