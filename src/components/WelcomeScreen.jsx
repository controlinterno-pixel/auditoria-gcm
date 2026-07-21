import React from 'react';

export default function WelcomeScreen({ isAdmin, onEnter, onLogout }) {
  // Logo Vectorial Corporativo
  const LogoTermales = () => (
    <svg viewBox="0 0 100 100" className="w-[75px] h-[75px] drop-shadow-sm shrink-0">
      <circle cx="16" cy="45" r="2" fill="#203d4a" />
      <circle cx="12" cy="49" r="1.5" fill="#203d4a" />
      <circle cx="18" cy="52" r="1.2" fill="#203d4a" />
      <circle cx="85" cy="42" r="1.8" fill="#203d4a" />
      <circle cx="92" cy="45" r="2.5" fill="#203d4a" />
      <circle cx="90" cy="50" r="1.5" fill="#203d4a" />
      <circle cx="84" cy="54" r="1.2" fill="#203d4a" />
      <path d="M 68 28 C 76 20, 88 22, 90 28 C 82 32, 72 32, 68 28 Z" fill="#4CAF50" />
      <path d="M 63 15 C 68 8, 76 10, 78 14 C 72 17, 65 18, 63 15 Z" fill="#4CAF50" />
      <path d="M 32 72 C 24 80, 12 78, 10 72 C 18 68, 28 68, 32 72 Z" fill="#4CAF50" />
      <path d="M 37 85 C 32 92, 24 90, 22 86 C 28 83, 35 82, 37 85 Z" fill="#4CAF50" />
      <circle cx="50" cy="50" r="25" stroke="#203d4a" strokeWidth="11" fill="none" />
      <circle cx="43" cy="55" r="7" stroke="#203d4a" strokeWidth="3.5" fill="none" />
      <circle cx="58" cy="62" r="4.5" stroke="#203d4a" strokeWidth="2.5" fill="none" />
      <circle cx="59" cy="48" r="2.2" fill="#203d4a" />
      <circle cx="53" cy="45" r="1.5" fill="#203d4a" />
    </svg>
  );

  return (
    <div className="relative flex min-h-screen w-full bg-[#f8fbfa] font-sans overflow-hidden">
      {/* Fondo Cascada */}
      <div 
        className="absolute left-0 top-0 w-[45%] h-full bg-cover bg-center z-0"
        style={{ backgroundImage: "url('/cascada.jpg'), linear-gradient(to right, #0A1A12, #11322A)" }}
      >
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#f8fbfa] to-transparent z-10"></div>
      </div>

      {/* Geometría HUD */}
      <svg className="absolute top-0 right-0 w-[400px] h-[400px] z-10 pointer-events-none" viewBox="0 0 400 400">
        <defs>
          <linearGradient id="grad-top-right" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#051f15" />
            <stop offset="100%" stopColor="#0a3b2a" />
          </linearGradient>
          <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <polygon points="120,0 400,0 400,280" fill="url(#grad-top-right)" />
        <line x1="120" y1="0" x2="400" y2="280" stroke="#00FF87" strokeWidth="4" filter="url(#glow-green)" />
      </svg>

      {/* Tarjeta Central */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-20">
        <div className="relative w-full max-w-[620px] animate-in zoom-in-95 duration-700">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-400 to-green-200 rounded-[3rem] blur-xl opacity-50"></div>
          
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl p-3 overflow-hidden">
            <div className="relative border-[1.5px] border-gray-200 rounded-[2rem] p-10 sm:p-14">
              
              {/* Logo y Encabezado */}
              <div className="flex flex-col items-center mb-6 mt-1">
                <div className="flex items-center space-x-2">
                  <LogoTermales />
                  <div className="flex flex-col leading-none ml-2">
                    <h1 className="text-[34px] font-black text-[#0B2A36] tracking-tight mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                      TERMALES
                    </h1>
                    <p className="text-[17px] font-bold text-[#64A338] -mt-1 tracking-wide">
                      Santa Rosa de Cabal
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-[26px] font-black text-[#0A3B32] tracking-tight">
                  {isAdmin ? 'Centro de Mando GRC' : 'Portal Operativo GRC'}
                </h2>
                <div className="flex items-center justify-center my-4 opacity-80">
                  <div className="h-[1px] bg-gray-300 w-10"></div>
                  <div className="w-[5px] h-[5px] rounded-full bg-[#64A338] mx-2"></div>
                  <div className="h-[1px] bg-gray-300 w-10"></div>
                </div>
              </div>

              <div className="text-center mb-10 px-2">
                <p className="text-[14px] text-gray-500 leading-relaxed font-medium max-w-sm mx-auto">
                  {isAdmin
                    ? 'Bienvenido al panel de Administración y Auditoría. Desde aquí podrá supervisar los riesgos corporativos, emitir informes formales, aprobar planes de acción y gestionar la base de datos global.'
                    : 'Bienvenido, Líder de Proceso. Desde aquí podrá visualizar los tableros analíticos, reportar el avance de sus planes de acción y registrar eventos de pérdida operativos.'}
                </p>
              </div>

              {/* Botones de Acción */}
              <div className="space-y-4 max-w-[400px] mx-auto relative z-20">
                <button 
                  onClick={onEnter} 
                  className="w-full bg-[#0A3B32] hover:bg-[#062620] text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95 group"
                >
                  <span>Acceder al Tablero de Control</span>
                </button>

                <button 
                  onClick={onLogout} 
                  className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-[#64A338] py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center space-x-3 active:scale-95 group shadow-sm"
                >
                  <span>Cerrar Sesión</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}