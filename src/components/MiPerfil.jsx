import React, { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function MiPerfil({ user, isAdmin, showNotification }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);

  const inicial = displayName 
    ? displayName.charAt(0).toUpperCase() 
    : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: photoURL.trim()
        });
        showNotification('Perfil actualizado con éxito. Recargando...', 'success');
        // Recargamos la página suavemente para que el menú lateral tome los nuevos datos
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (error) {
      console.error(error);
      showNotification('Error al actualizar el perfil.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      
      {/* 🛡️ Header del Perfil */}
      <div className="bg-[#0a1122] border border-blue-500/20 p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent z-0" />
        
        <div className="flex items-center gap-6 relative z-10 w-full">
          {/* Avatar Preview */}
          <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-4xl shadow-lg border-4 border-slate-800 shrink-0 overflow-hidden">
            {photoURL ? (
              <img src={photoURL} alt="Perfil" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
            ) : (
              inicial
            )}
          </div>
          
          <div className="space-y-1 w-full">
            <div className="inline-block px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg mb-1">
              {isAdmin ? '🛡️ Auditor Líder (Admin)' : '👤 Gestor de Proceso'}
            </div>
            <h2 className="text-3xl font-black text-white">{displayName || 'Usuario GCM'}</h2>
            <p className="text-sm text-slate-400 font-mono">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* ⚙️ Formulario de Configuración */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative z-10">
        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
          <span>⚙️</span> Personalizar mi espacio
        </h3>

        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Nombre */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                Nombre Completo
              </label>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej. Yehison Pineda"
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-slate-800 font-medium"
                required
              />
            </div>

            {/* Input URL Foto */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                URL de Fotografía (Opcional)
              </label>
              <input 
                type="url" 
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://ejemplo.com/mifoto.jpg"
                className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors text-slate-800 font-medium"
              />
              <p className="text-[10px] text-slate-500 mt-1">Pega un enlace directo a una imagen (JPG, PNG). Puedes usar la URL de tu foto de LinkedIn.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button 
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}