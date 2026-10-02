import { useState } from 'react';
import ModalNuevaFuente from './ModalNuevaFuente';

// Datos de prueba basados exactamente en tu captura de diseño
const datosIniciales = [
  { id: 'AUD-001', tipoNorma: 'ISO 9001:2015', fecha: '12/03/2026', auditor: 'Juan Pérez', rol: 'Líder GH', alcance: 'Evaluar el cumplimiento del SGC en procesos críticos.', estado: 'Activa', color: 'bg-blue-500' },
  { id: 'AUD-002', tipoNorma: 'ISO 14001:2015', fecha: '05/02/2026', auditor: 'ICONTEC', rol: 'Auditor Externo', alcance: 'Verificar cumplimiento ambiental y gestión de residuos.', estado: 'Cerrada', color: 'bg-emerald-500' },
  { id: 'AUD-003', tipoNorma: 'PQR (Cliente)', fecha: '20/03/2026', auditor: 'Diana Vargas', rol: 'Servicio al Cliente', alcance: 'Analizar quejas y oportunidades de mejora en atención.', estado: 'Activa', color: 'bg-orange-500' },
  { id: 'AUD-004', tipoNorma: 'ISO 45001:2018', fecha: '15/04/2026', auditor: 'Carlos Ramírez', rol: 'Seguridad y Salud', alcance: 'Revisión de condiciones laborales y riesgos asociados.', estado: 'En seguimiento', color: 'bg-indigo-500' },
  { id: 'AUD-005', tipoNorma: 'ISO 37001:2016', fecha: '10/05/2026', auditor: 'Laura Martínez', rol: 'Compliance', alcance: 'Evaluar controles anticorrupción y ética organizacional.', estado: 'Cerrada', color: 'bg-teal-500' },
];

export default function FuentesDeMejora({ isAdmin, fuentes = datosIniciales }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✨ AÑADIR ESTE ESTADO
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. CABECERA PRINCIPAL CON BANNER ESTILO HALLAZGOS */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-6 mb-6 z-20">
        
        {/* IMAGEN DE FONDO CON OVERLAY CLARO */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 opacity-20"
          style={{ backgroundImage: "url('/Informes.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1e3f] via-[#0a1e3f]/90 to-[#0a1e3f]/80 z-10" />

        {/* CONTENIDO IZQUIERDA */}
        <div className="relative z-20 w-full md:w-3/5 flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full border-[3px] border-blue-500/80 bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] backdrop-blur-sm">
              <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
            </div>
            <div className="pt-1">
              <h2 className="text-3xl font-black text-white drop-shadow-md tracking-tight">
                Fuente de mejora
              </h2>
              <p className="text-[13px] text-slate-300 font-medium mt-1.5 leading-relaxed max-w-md">
                Gestión centralizada de orígenes para auditorías y hallazgos.
              </p>
            </div>
          </div>
        </div>

        {/* BOTONERA DERECHA */}
        <div className="relative z-20 flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <button 
            onClick={() => setIsModalOpen(true)} // ✨ AÑADIR ONCLICK AQUÍ
            className="px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm border bg-gradient-to-r from-[#0055ff] to-[#0077ff] text-white shadow-[0_4px_15px_rgba(0,85,255,0.3)] border-transparent flex items-center"
          >
            <span className="mr-2">➕</span> Nueva Fuente
          </button>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex-1 min-w-[300px] relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por auditor, norma, proceso o alcance..." 
            className="w-full bg-white border border-slate-200 text-sm text-slate-700 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#0A3B32] focus:ring-1 focus:ring-[#0A3B32] shadow-sm font-bold placeholder-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Norma / Estándar</span>
            <select className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg py-2.5 px-3 outline-none cursor-pointer focus:border-[#0A3B32] shadow-sm">
              <option>Todos</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Estado</span>
            <select className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg py-2.5 px-3 outline-none cursor-pointer focus:border-[#0A3B32] shadow-sm">
              <option>Todos</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Fecha de auditoría</span>
            <button className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg py-2.5 px-3 flex items-center gap-2 shadow-sm hover:bg-slate-50">
              <span>📅</span> Desde - Hasta <span>↕️</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. CONTENIDO PRINCIPAL (GRID CLARO) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* TABLA IZQUIERDA (Ocupa 3 columnas) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-[10px] uppercase font-black tracking-widest text-white border-b border-slate-200">
                  <th className="p-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-400" /></th>
                  <th className="p-4">ID</th>
                  <th className="p-4">Tipo de Norma</th>
                  <th className="p-4">Fecha Auditoría</th>
                  <th className="p-4">Auditor / Equipo</th>
                  <th className="p-4">Objetivos / Alcance</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
                {fuentes.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-center"><input type="checkbox" className="rounded border-slate-300" /></td>
                    <td className="p-4 font-black text-slate-800 bg-slate-50/50">{f.id}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${f.color}`}></span>
                        <span className="font-bold border border-slate-200 bg-white px-2 py-0.5 rounded-md text-[10px] shadow-sm">{f.tipoNorma}</span>
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{f.fecha}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-700 border border-slate-200">{f.auditor.split(' ').map(n=>n[0]).join('')}</div>
                        <div>
                          <p className="text-slate-800 font-bold text-[11px]">{f.auditor}</p>
                          <p className="text-[9px] text-slate-500 font-medium">{f.rol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-[11px] font-bold text-slate-600 w-64 leading-tight">{f.alcance}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 w-max border ${f.estado === 'Activa' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : f.estado === 'Cerrada' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${f.estado === 'Activa' ? 'bg-emerald-500' : f.estado === 'Cerrada' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                        {f.estado}
                      </span>
                    </td>
                    <td className="p-4 text-center space-x-2 text-slate-400">
                      <button className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors">👁️</button>
                      <button className="text-orange-500 hover:bg-orange-50 p-1.5 rounded-lg transition-colors">✏️</button>
                      <button className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">⋮</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-4 flex items-center justify-between border-t border-slate-200 text-[10px] font-bold text-slate-500">
            <span>Mostrando 1 - 5 de 24 auditorías</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-200">&lt;</button>
              <button className="px-2 py-1 bg-slate-900 text-white rounded">1</button>
              <button className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-200">2</button>
              <button className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-200">3</button>
              <button className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-200">&gt;</button>
            </div>
          </div>
        </div>

        {/* PANELES LATERALES DERECHOS (Estilo Claro) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Panel 1: Gráfica de Dona */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Distribución por Norma</h3>
            <div className="flex flex-col items-center justify-center gap-6">
              {/* Círculo de dona simulado */}
              <div className="relative w-32 h-32 rounded-full border-[12px] border-slate-100 flex items-center justify-center border-t-orange-500 border-r-blue-500 border-b-emerald-500 border-l-purple-500 shadow-inner">
                <div className="text-center">
                  <span className="block text-3xl font-black text-slate-800 leading-none">24</span>
                  <span className="block text-[8px] text-slate-400 uppercase tracking-widest mt-1">Auditorías</span>
                </div>
              </div>
              
              <div className="w-full space-y-3 text-[10px] font-bold">
                <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></span> ISO 9001:2015</span><span className="text-slate-800">6 <span className="text-slate-400 font-medium ml-1">(25%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm"></span> ISO 14001:2015</span><span className="text-slate-800">5 <span className="text-slate-400 font-medium ml-1">(21%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 bg-purple-500 rounded-full shadow-sm"></span> ISO 45001:2018</span><span className="text-slate-800">4 <span className="text-slate-400 font-medium ml-1">(17%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 bg-teal-500 rounded-full shadow-sm"></span> ISO 37001:2016</span><span className="text-slate-800">3 <span className="text-slate-400 font-medium ml-1">(12%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 bg-orange-500 rounded-full shadow-sm"></span> PQR (Cliente)</span><span className="text-slate-800">3 <span className="text-slate-400 font-medium ml-1">(12%)</span></span></div>
              </div>
            </div>
          </div>

          {/* Panel 2: Barras de Progreso */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b pb-2">Resumen de Estado</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                  <span className="text-slate-600">Activas</span>
                  <span className="text-slate-800">75% <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">18</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[75%] rounded-full"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                  <span className="text-slate-600">En seguimiento</span>
                  <span className="text-slate-800">17% <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1">4</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-amber-500 h-full w-[17%] rounded-full"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                  <span className="text-slate-600">Cerradas</span>
                  <span className="text-slate-800">8% <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded ml-1">2</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="bg-rose-500 h-full w-[8%] rounded-full"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECCIÓN INFERIOR: INTEGRACIONES PRÓXIMAS (Adaptado a diseño claro) */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-400">🔗</span>
          <div>
            <h3 className="text-xs font-black text-slate-700">Integraciones Próximas</h3>
            <p className="text-[10px] font-bold text-slate-500">Conectaremos más fuentes para una visión integral de la mejora continua.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-purple-100 rounded-xl flex items-center justify-center text-purple-600 text-lg">💬</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-purple-900">PQR</h4>
              <p className="text-[9px] text-purple-700 font-medium leading-tight">Quejas, reclamos y sugerencias.</p>
              <div className="mt-1.5 text-[9px] font-black text-purple-600 bg-white border border-purple-100 px-2 py-0.5 rounded w-max">En desarrollo</div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 text-lg">📊</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-emerald-900">Indicadores G.</h4>
              <p className="text-[9px] text-emerald-700 font-medium leading-tight">Desempeño de procesos.</p>
              <div className="mt-1.5 text-[9px] font-black text-emerald-600 bg-white border border-emerald-100 px-2 py-0.5 rounded w-max">Próximo</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 text-lg">👥</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-blue-900">Encuestas S.</h4>
              <p className="text-[9px] text-blue-700 font-medium leading-tight">Satisfacción de clientes.</p>
              <div className="mt-1.5 text-[9px] font-black text-blue-600 bg-white border border-blue-100 px-2 py-0.5 rounded w-max">Próximo</div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 text-lg">🔗</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-slate-700">Otras Fuentes</h4>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">Incidentes, normativas.</p>
              <div className="mt-1.5 text-[9px] font-black text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded w-max">Futuro</div>
            </div>
          </div>

        </div>
      </div>
{/* ✨ RENDERIZAR EL MODAL */}
      <ModalNuevaFuente 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={(data) => {
          console.log("Fuente Creada:", data);
          alert("Fuente creada con éxito (simulado)");
        }} 
      />
    </div>
  );
}