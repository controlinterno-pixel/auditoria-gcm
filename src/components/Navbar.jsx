import React from 'react';

export default function Navbar({ isPresentationMode, setIsPresentationMode }) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      
      {/* Espaciador izquierdo para mantener la píldora centrada */}
      <div className="flex-1"></div>

      {/* Título Central Corporativo (Píldora con Logo) */}
      <div className="flex justify-center">
        <div className="bg-slate-50 border border-slate-200 rounded-full px-8 py-2 flex items-center space-x-3 shadow-sm">
          
          {/* LOGO DE TERMALES CON LA RUTA CORRECTA */}
          <img 
            src="/logo_termales.png" 
            alt="Logo Termales" 
            className="h-8 w-auto object-contain" 
          />          
          <span className="text-xs font-black text-slate-700 tracking-widest uppercase">
            Termales de Santa Rosa de Cabal — Sistema de Gestión Integral
          </span>
        </div>
      </div>

      {/* Botón Modo Presentación a la derecha */}
      <div className="flex-1 flex justify-end">
        <button
          onClick={() => setIsPresentationMode(true)}
          className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md flex items-center space-x-2"
        >
          <span>📺</span>
          <span>Modo Presentación</span>
        </button>
      </div>

    </header>
  );
}