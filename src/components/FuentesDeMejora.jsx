import { useState } from 'react';

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
  
  return (
    <div className="min-h-screen bg-[#040914] text-slate-300 font-sans p-6 rounded-3xl animate-in fade-in duration-500">
      
      {/* 1. CABECERA */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/50 rounded-xl flex items-center justify-center text-blue-400 text-2xl shadow-[0_0_15px_rgba(37,99,235,0.2)]">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gestión de Mejora Continua</h2>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-black text-white tracking-tight">Módulo de Fuentes de Mejora</h1>
              <span className="text-sm font-bold text-slate-500">/ Auditorías</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Calidad › Cumplimiento › Sostenibilidad</p>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex-1 min-w-[300px] relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por auditor, norma, proceso o alcance..." 
            className="w-full bg-[#0b1426] border border-[#1e293b] text-sm text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Norma / Estándar</span>
            <select className="bg-[#0b1426] border border-[#1e293b] text-slate-300 text-xs rounded-lg py-2 px-3 outline-none cursor-pointer">
              <option>Todos</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Estado</span>
            <select className="bg-[#0b1426] border border-[#1e293b] text-slate-300 text-xs rounded-lg py-2 px-3 outline-none cursor-pointer">
              <option>Todos</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 ml-1">Fecha de auditoría</span>
            <button className="bg-[#0b1426] border border-[#1e293b] text-slate-300 text-xs rounded-lg py-2 px-3 flex items-center gap-2">
              <span>📅</span> Desde - Hasta <span>↕️</span>
            </button>
          </div>
          <div className="flex flex-col justify-end h-full mt-4">
            <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all">
              + Registrar Auditoría
            </button>
          </div>
        </div>
      </div>

      {/* 3. CONTENIDO PRINCIPAL (GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* TABLA IZQUIERDA (Ocupa 3 columnas) */}
        <div className="lg:col-span-3 bg-[#0b1426] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0f1a30] text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-[#1e293b]">
                  <th className="p-4 w-10 text-center"><input type="checkbox" className="rounded bg-slate-800 border-slate-600" /></th>
                  <th className="p-4">ID</th>
                  <th className="p-4">Tipo de Norma</th>
                  <th className="p-4">Fecha Auditoría</th>
                  <th className="p-4">Auditor / Equipo</th>
                  <th className="p-4">Objetivos / Alcance</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-300 divide-y divide-[#1e293b]">
                {fuentes.map((f, i) => (
                  <tr key={i} className="hover:bg-[#121f38] transition-colors">
                    <td className="p-4 text-center"><input type="checkbox" className="rounded bg-slate-800 border-slate-600" /></td>
                    <td className="p-4 font-black text-white">{f.id}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${f.color}`}></span>
                        <span className="font-bold border border-slate-700 bg-slate-800/50 px-2 py-0.5 rounded text-[10px]">{f.tipoNorma}</span>
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">{f.fecha}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-black text-white">{f.auditor.split(' ').map(n=>n[0]).join('')}</div>
                        <div>
                          <p className="text-white font-bold text-[11px]">{f.auditor}</p>
                          <p className="text-[9px] text-slate-500">{f.rol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-[11px] text-slate-400 w-64">{f.alcance}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 w-max ${f.estado === 'Activa' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : f.estado === 'Cerrada' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${f.estado === 'Activa' ? 'bg-emerald-400' : f.estado === 'Cerrada' ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
                        {f.estado}
                      </span>
                    </td>
                    <td className="p-4 text-center space-x-3 text-slate-400">
                      <button className="hover:text-white">👁️</button>
                      <button className="hover:text-white">✏️</button>
                      <button className="hover:text-white">⋮</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-[#0b1426] p-4 flex items-center justify-between border-t border-[#1e293b] text-xs text-slate-500">
            <span>Mostrando 1 - 5 de 24 auditorías</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 hover:text-white">&lt;</button>
              <button className="px-2 py-1 bg-blue-600 text-white rounded">1</button>
              <button className="px-2 py-1 hover:text-white">2</button>
              <button className="px-2 py-1 hover:text-white">3</button>
              <button className="px-2 py-1 hover:text-white">4</button>
              <button className="px-2 py-1 hover:text-white">5</button>
              <button className="px-2 py-1 hover:text-white">&gt;</button>
            </div>
          </div>
        </div>

        {/* PANELES LATERALES DERECHOS (Ocupa 1 columna) */}
        <div className="lg:col-span-1 space-y-6">
          {/* Panel 1: Gráfica de Dona */}
          <div className="bg-[#0b1426] border border-[#1e293b] rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs font-bold text-white mb-4">Distribución por Norma</h3>
            <div className="flex items-center gap-4">
              {/* Círculo de dona simulado */}
              <div className="relative w-24 h-24 rounded-full border-[6px] border-[#1e293b] flex items-center justify-center border-t-orange-500 border-r-blue-500 border-b-emerald-500 border-l-purple-500">
                <div className="text-center">
                  <span className="block text-xl font-black text-white">24</span>
                  <span className="block text-[8px] text-slate-400 uppercase tracking-widest">Auditorías</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-[10px]">
                <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> ISO 9001:2015</span><span className="text-white">6 <span className="text-slate-500">(25%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> ISO 14001:2015</span><span className="text-white">5 <span className="text-slate-500">(21%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 bg-purple-500 rounded-full"></span> ISO 45001:2018</span><span className="text-white">4 <span className="text-slate-500">(17%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 bg-teal-500 rounded-full"></span> ISO 37001:2016</span><span className="text-white">3 <span className="text-slate-500">(12%)</span></span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 bg-orange-500 rounded-full"></span> PQR (Cliente)</span><span className="text-white">3 <span className="text-slate-500">(12%)</span></span></div>
              </div>
            </div>
          </div>

          {/* Panel 2: Barras de Progreso */}
          <div className="bg-[#0b1426] border border-[#1e293b] rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs font-bold text-white mb-4">Resumen de Estado</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">Activas</span>
                  <span className="text-white">75% <span className="text-slate-500 ml-2">18</span></span>
                </div>
                <div className="w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden"><div className="bg-emerald-500 h-full w-[75%] rounded-full"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">En seguimiento</span>
                  <span className="text-white">17% <span className="text-slate-500 ml-2">4</span></span>
                </div>
                <div className="w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden"><div className="bg-amber-500 h-full w-[17%] rounded-full"></div></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400">Cerradas</span>
                  <span className="text-white">8% <span className="text-slate-500 ml-2">2</span></span>
                </div>
                <div className="w-full h-1.5 bg-[#1e293b] rounded-full overflow-hidden"><div className="bg-rose-500 h-full w-[8%] rounded-full"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECCIÓN INFERIOR: INTEGRACIONES PRÓXIMAS */}
      <div className="mt-8 pt-6 border-t border-[#1e293b]">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-500">🔗</span>
          <div>
            <h3 className="text-xs font-bold text-white">Integraciones Próximas</h3>
            <p className="text-[10px] text-slate-500">Conectaremos más fuentes para una visión integral de la mejora continua.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div className="bg-gradient-to-br from-[#1e1b4b] to-[#2e1065] border border-purple-500/30 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 text-lg">💬</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-bold text-white">PQR</h4>
              <p className="text-[9px] text-purple-300 leading-tight">Quejas, reclamos y sugerencias de clientes.</p>
              <div className="mt-1 text-[9px] font-black text-purple-400 tracking-wider">En desarrollo</div>
            </div>
            <span className="text-purple-400">›</span>
          </div>

          <div className="bg-gradient-to-br from-[#064e3b] to-[#065f46] border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 text-lg">📊</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-bold text-white">Indicadores de Gestión</h4>
              <p className="text-[9px] text-emerald-300 leading-tight">Desempeño de procesos y objetivos.</p>
              <div className="mt-1 text-[9px] font-black text-emerald-400 tracking-wider">Próximo</div>
            </div>
            <span className="text-emerald-400">›</span>
          </div>

          <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] border border-blue-500/30 p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 text-lg">👥</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-bold text-white">Encuestas de Satisfacción</h4>
              <p className="text-[9px] text-blue-300 leading-tight">Satisfacción de clientes y colaboradores.</p>
              <div className="mt-1 text-[9px] font-black text-blue-400 tracking-wider">Próximo</div>
            </div>
            <span className="text-blue-400">›</span>
          </div>

          <div className="bg-[#0b1426] border border-[#1e293b] p-4 rounded-2xl flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-lg">🔗</div>
            <div className="flex-1">
              <h4 className="text-[11px] font-bold text-white">Otras Fuentes</h4>
              <p className="text-[9px] text-slate-500 leading-tight">Riesgos, incidentes, cambios normativos.</p>
              <div className="mt-1 text-[9px] font-black text-slate-500 tracking-wider">Futuro</div>
            </div>
            <span className="text-slate-500">›</span>
          </div>

        </div>
      </div>

    </div>
  );
}