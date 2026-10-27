// src/components/proyectos/ReportesProyecto.jsx - Reportes filtrables, imprimibles (PDF desde el navegador)
// y exportables a Excel, con fecha de generación, periodo, filtros y origen de los datos.
import { useMemo, useState } from 'react';
import { REPORTES_CON_PERIODO, TIPOS_REPORTE, construirReporte, htmlReporte } from '../../utils/proyectos/reportes.js';
import { sumarDias } from '../../utils/proyectos/fechas.js';
import { fecha } from '../../utils/proyectos/formato.js';
import { exportToExcel } from '../../services/grcStorageService';
import { Campo, Seccion, botonPrimario, botonSecundario, claseCampo } from './ui.jsx';

export default function ReportesProyecto({ proyecto, plan, indicadores, hoy, usuario, showNotification }) {
  const [tipo, setTipo] = useState('ficha');
  const [periodo, setPeriodo] = useState({ desde: sumarDias(hoy, -6), hasta: hoy });
  const conPeriodo = REPORTES_CON_PERIODO.includes(tipo);
  const reporte = useMemo(() => construirReporte(tipo, { proyecto, plan, ind: indicadores, hoy, periodo }), [tipo, proyecto, plan, indicadores, hoy, periodo]);
  const encabezado = [
    `${proyecto.codigo} · ${proyecto.ficha?.nombre}`,
    `Generado el ${new Date().toLocaleString('es-CO')} por ${usuario?.email || 'usuario'}`,
    conPeriodo ? `Periodo analizado: ${fecha(periodo.desde)} a ${fecha(periodo.hasta)}` : `Estado a la fecha: ${fecha(hoy)}`,
    'Filtros aplicados: ninguno adicional al periodo',
    'Origen de los datos: GCM Enterprise · Gestión de proyectos (registros del proyecto al momento de generar)',
  ];
  const elegirTipo = valor => {
    setTipo(valor);
    if (valor === 'mensual') setPeriodo({ desde: `${hoy.slice(0, 7)}-01`, hasta: hoy });
    if (valor === 'semanal') setPeriodo({ desde: sumarDias(hoy, -6), hasta: hoy });
  };

  const imprimir = () => {
    const ventana = window.open('', '_blank', 'width=1000,height=800');
    if (!ventana) { showNotification?.('El navegador bloqueó la ventana del reporte: permite ventanas emergentes para este sitio.', 'error'); return; }
    ventana.opener = null;
    ventana.document.write(htmlReporte(reporte, encabezado));
    ventana.document.close();
    ventana.focus();
    ventana.print();
  };
  const exportar = () => {
    const filas = reporte.secciones.flatMap(seccion => (seccion.columnas
      ? seccion.filas.map(fila => ({ Sección: seccion.titulo, ...Object.fromEntries(seccion.columnas.map((columna, i) => [columna, fila[i]])) }))
      : [{ Sección: seccion.titulo, Contenido: seccion.texto }]));
    exportToExcel([...encabezado.map(linea => ({ Sección: 'Encabezado', Contenido: linea })), ...filas], `${proyecto.codigo}_${tipo}`, showNotification);
  };

  return (
    <div className="space-y-4">
      <Seccion titulo="Generar reporte" acciones={<><button type="button" className={botonSecundario} onClick={exportar}>⬇ Excel</button><button type="button" className={botonPrimario} onClick={imprimir}>🖨 Imprimir / PDF</button></>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Reporte">{p => <select {...p} className={claseCampo} value={tipo} onChange={evento => elegirTipo(evento.target.value)}>{Object.entries(TIPOS_REPORTE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}</Campo>
          {conPeriodo && (
            <>
              <Campo etiqueta="Desde">{p => <input {...p} type="date" className={claseCampo} value={periodo.desde} max={periodo.hasta} onChange={evento => setPeriodo(actual => ({ ...actual, desde: evento.target.value }))} />}</Campo>
              <Campo etiqueta="Hasta">{p => <input {...p} type="date" className={claseCampo} value={periodo.hasta} min={periodo.desde} onChange={evento => setPeriodo(actual => ({ ...actual, hasta: evento.target.value }))} />}</Campo>
            </>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">El historial de actividad se consulta y pagina en la pestaña Historial.</p>
      </Seccion>

      <Seccion titulo={reporte.titulo}>
        <div className="mb-3 space-y-0.5 text-[11px] text-slate-500">{encabezado.map(linea => <p key={linea}>{linea}</p>)}</div>
        <div className="space-y-4">
          {reporte.secciones.map(seccion => (
            <div key={seccion.titulo}>
              <h4 className="mb-1 text-xs font-black uppercase tracking-wide text-slate-700">{seccion.titulo}</h4>
              {seccion.columnas ? (seccion.filas.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-xs">
                    <thead className="bg-slate-50 text-left"><tr>{seccion.columnas.map(columna => <th key={columna} className="border border-slate-200 p-1.5">{columna}</th>)}</tr></thead>
                    <tbody>{seccion.filas.map((fila, indice) => <tr key={indice}>{fila.map((celda, i) => <td key={i} className="border border-slate-200 p-1.5 align-top">{String(celda ?? '')}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : <p className="text-xs text-slate-500">{seccion.vacio}</p>) : <p className="whitespace-pre-line text-sm text-slate-700">{seccion.texto}</p>}
            </div>
          ))}
        </div>
      </Seccion>
    </div>
  );
}
