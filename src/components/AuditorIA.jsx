import React from 'react';

export default function AuditorIA({
  isPresentationMode,
  isAdmin,
  showAuditorIA,
  setShowAuditorIA,
  auditorInput,
  setAuditorInput,
  auditorRespuesta,
  setAuditorRespuesta,
  isAuditorThinking,
  handleAuditorSubmit
}) {
  if (isPresentationMode || !isAdmin) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end font-sans selection:bg-blue-500/30 text-white">
       {showAuditorIA && (
         <div className="mb-4 w-85 sm:w-[380px] bg-[#060b16] rounded-[28px] shadow-[0_15px_50px_rgba(0,0,0,0.9)] border border-blue-500/20 overflow-hidden animate-in slide-in-from-bottom-5 p-4 space-y-3.5">
           
           {/* 1. CABECERA INSTITUCIONAL */}
           <div className="flex justify-between items-center px-1">
             <div className="flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
               <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></div>
               <span className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Online</span>
             </div>
             <div className="text-center flex-1 pr-4">
               <h3 className="font-black text-sm tracking-widest text-slate-100">AUDITOR IA</h3>
               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Asistente Inteligente</p>
             </div>
             <button onClick={() => setShowAuditorIA(false)} className="text-slate-400 hover:text-white transition-colors p-1 text-base font-bold">
               <svg className="w-4 h-4 transform rotate-90 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
             </button>
           </div>
           
           {/* 2. RECUADRO SUPERIOR: ROBOT Y ONDA CYAN */}
           <div className="bg-[#0a1122] border border-blue-500/15 rounded-2xl p-4 flex flex-col items-center justify-center relative h-[170px] overflow-hidden shadow-inner">
             <div className="absolute w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
             
             <div className="relative z-10 w-24 h-24 flex items-center justify-center drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
               <svg viewBox="0 0 100 100" className="w-full h-full">
                 <defs>
                   <linearGradient id="helmGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" stopColor="#ffffff" />
                     <stop offset="45%" stopColor="#f8fafc" />
                     <stop offset="100%" stopColor="#cbd5e1" />
                   </linearGradient>
                   <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" stopColor="#0a0f1d" />
                     <stop offset="100%" stopColor="#1e293b" />
                   </linearGradient>
                   <radialGradient id="neonGlow" cx="50%" cy="50%" r="50%">
                     <stop offset="0%" stopColor="#38bdf8" />
                     <stop offset="40%" stopColor="#0284c7" />
                     <stop offset="100%" stopColor="#0a1122" />
                   </radialGradient>
                 </defs>
                 <path d="M24,36 L15,23 L24,19 Z" fill="#ef4444" />
                 <path d="M76,36 L85,23 L76,19 Z" fill="#ef4444" />
                 <rect x="16" y="36" width="6" height="18" rx="3" fill="#475569" />
                 <rect x="78" y="36" width="6" height="18" rx="3" fill="#475569" />
                 <circle cx="50" cy="45" r="28" fill="url(#helmGrad)" stroke="#94a3b8" strokeWidth="0.5" />
                 <rect x="28" y="31" width="44" height="28" rx="14" fill="url(#screenGrad)" stroke="#2563eb" strokeWidth="1" />
                 <circle cx="40" cy="45" r="3.5" fill="url(#neonGlow)" className="animate-pulse" />
                 <circle cx="60" cy="45" r="3.5" fill="url(#neonGlow)" className="animate-pulse" />
                 <path d="M42,72 L58,72 L55,83 L45,83 Z" fill="#94a3b8" />
                 <circle cx="50" cy="77" r="2.5" fill="#38bdf8" />
               </svg>
             </div>

             <div className="absolute inset-x-0 bottom-2 h-16 pointer-events-none z-0 opacity-90 flex items-center">
               <svg viewBox="0 0 100 20" className="w-full h-full text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" preserveAspectRatio="none">
                 <path d="M0,10 Q8,10 12,2 T24,18 T36,10 T46,1 T56,19 T66,10 T76,2 T86,17 L100,10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
             </div>
           </div>

           {/* 3. IDENTIDAD CORPORATIVA */}
           <div className="bg-[#0a1122] border border-blue-500/15 p-3 rounded-2xl flex items-center justify-between shadow-inner">
             <div className="flex items-center space-x-3">
               <div className="w-10 h-10 bg-[#050a14] rounded-xl flex items-center justify-center border border-blue-500/20 shadow-md">
                 <span className="text-xl">🤖</span>
               </div>
               <div className="space-y-0.5">
                 <h4 className="font-black text-slate-100 text-[12px] tracking-wide">TERMALES DE SANTA ROSA</h4>
                 <div className="flex items-center space-x-1 text-blue-400 font-bold tracking-widest text-[9px]">
                   <span className="text-amber-500 text-xs">👑</span>
                   <span>CONTROL INTERNO</span>
                 </div>
               </div>
             </div>
             <div className="text-blue-500 pr-1">
               <svg className="w-5 h-5 text-blue-500 drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
               </svg>
             </div>
           </div>

           {/* 4. BLOQUE PRINCIPAL: RESPUESTA O CUADRÍCULA DE SELECCIÓN */}
           <div className="bg-[#0a1122]/70 border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-inner">
             {auditorRespuesta ? (
               <div className="space-y-2.5">
                 <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                   <span className="text-[9px] uppercase tracking-widest text-blue-400 font-black">Dictamen Consolidado</span>
                   <button onClick={() => setAuditorRespuesta('')} className="text-[9px] text-slate-400 hover:text-white font-bold bg-slate-800 px-2 py-0.5 rounded-md transition-colors">← Volver</button>
                 </div>
                 <div className="text-slate-200 text-[11px] leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap font-medium pr-1 scrollbar-thin border-l-2 border-blue-500 pl-2.5">
                   {auditorRespuesta}
                 </div>
               </div>
             ) : (
               <>
                 <div className="flex items-start space-x-2.5">
                   <div className="w-6 h-6 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 text-xs shadow-sm mt-0.5">🤖</div>
                   <div className="text-slate-300 text-[11px] leading-relaxed font-semibold">
                     ¡Hola! 👋 <br />
                     Soy tu asistente de auditoría inteligente. ¿Qué deseas analizar hoy?
                   </div>
                 </div>

                 {/* CUADRÍCULA DE ACCIÓN INSTANTÁNEA (AUTOMÁTICA) */}
                 <div className="grid grid-cols-2 gap-2 mt-1">
                   {[
                     { text: 'Dashboard Ejecutivo', icon: '📊', query: 'Dame un resumen ejecutivo general del estado actual de la plataforma.' },
                     { text: 'Riesgos', icon: '⚠️', query: 'Haz un análisis de la matriz de riesgos registrados.' },
                     { text: 'Controles', icon: '✔', query: '¿Cuál es el estado de la efectividad de los controles?' },
                     { text: 'Informes Emitidos', icon: '📄', query: 'Hazme un resumen de los informes de auditoría emitidos.' },
                     { text: 'Hallazgos', icon: '🔎', query: 'Dame un reporte de los hallazgos actuales y su estado.' },
                     { text: 'Indicadores', icon: '📈', query: '¿Cómo están los indicadores de monitoreo corporativo?' },
                     { text: 'Planes de Mejoramiento', icon: '📝', query: '¿Cuál es el avance físico de los planes de mejoramiento?' }
                   ].map((sug, idx) => (
                     <button 
                       key={`sug-${idx}`}
                       type="button"
                       disabled={isAuditorThinking}
                       onClick={() => {
                         // Ejecución instantánea: Pasa el prompt directamente al cerebro de la IA
                         handleAuditorSubmit(null, sug.query);
                       }}
                       className={`w-full bg-[#050a14]/90 border border-slate-800/80 hover:border-blue-500/40 hover:bg-[#0a1122] px-3 py-2.5 rounded-xl flex items-center space-x-2 text-left transition-all duration-200 group active:scale-95 disabled:opacity-30 ${idx === 0 ? 'col-span-2 justify-center' : ''}`}
                     >
                       <span className="text-xs shrink-0">{sug.icon}</span>
                       <span className="text-slate-300 group-hover:text-slate-100 text-[10px] font-black tracking-wide truncate">{sug.text}</span>
                     </button>
                   ))}
                 </div>
               </>
             )}
           </div>

           {/* 5. INPUT MANUAL TRADICIONAL */}
           <form onSubmit={handleAuditorSubmit} className="w-full relative pt-0.5">
             <input 
               type="text" 
               value={auditorInput}
               onChange={(e) => setAuditorInput(e.target.value)}
               placeholder="Escribe otra consulta aquí..."
               disabled={isAuditorThinking}
               className="w-full bg-[#0a1122] border border-slate-800 rounded-2xl pl-4 pr-12 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-inner font-medium transition-all"
             />
             <button 
               type="submit" 
               disabled={isAuditorThinking || !auditorInput.trim()} 
               className="absolute right-2 top-[54%] -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
             >
               <svg className="w-3.5 h-3.5 transform rotate-45 mr-0.5 -mt-0.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
               </svg>
             </button>
           </form>

         </div>
       )}

       <button 
         onClick={() => setShowAuditorIA(!showAuditorIA)} 
         className={`w-16 h-16 rounded-full shadow-[0_4px_25px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 border-2 bg-[#050a14] ${showAuditorIA ? 'border-slate-700 text-white scale-90' : 'border-cyan-500/80 shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:scale-105'}`}
       >
         {showAuditorIA ? <span className="text-xl font-bold">✕</span> : (
           <div className="w-12 h-12 flex items-center justify-center">
             <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]">
               <path d="M24,36 L15,23 L24,19 Z" fill="#ef4444" />
               <path d="M76,36 L85,23 L76,19 Z" fill="#ef4444" />
               <rect x="16" y="36" width="5" height="16" rx="2.5" fill="#475569" />
               <rect x="79" y="36" width="5" height="16" rx="2.5" fill="#475569" />
               <circle cx="50" cy="45" r="26" fill="#f8fafc" />
               <rect x="29" y="32" width="42" height="26" rx="13" fill="#0f172a" />
               <circle cx="41" cy="45" r="3" fill="#38bdf8" />
               <circle cx="59" cy="45" r="3" fill="#38bdf8" />
               <path d="M43,71 L57,71 L54,80 L46,80 Z" fill="#94a3b8" />
             </svg>
           </div>
         )}
       </button>
    </div>
  );
}
