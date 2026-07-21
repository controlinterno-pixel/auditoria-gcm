import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function AuthScreen() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault(); 
    setAuthError('');
    try {
      if (isRegistering) { 
        await createUserWithEmailAndPassword(auth, authEmail, authPassword); 
      } else { 
        await signInWithEmailAndPassword(auth, authEmail, authPassword); 
      }
    } catch (error) { 
      setAuthError('Error en credenciales.'); 
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-2xl">
        <div className="text-center">
          <span className="text-5xl block animate-bounce">🛡️</span>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-900">GCM Auditor v5</h2>
          <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-1">Termales GRC Platform</p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleAuthSubmit}>
          {authError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
              ⚠️ {authError}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Correo</label>
              <input 
                type="email" 
                required 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                placeholder="tu_correo@termales.com.co" 
                className="block w-full rounded-lg border px-3 py-2 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contraseña</label>
              <input 
                type="password" 
                required 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                placeholder="••••••••" 
                className="block w-full rounded-lg border px-3 py-2 text-xs mt-1"
              />
            </div>
          </div>
          <button 
            type="submit" 
            className="w-full flex justify-center rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-md"
          >
            {isRegistering ? 'Crear Cuenta' : 'Ingresar al Portal'}
          </button>
        </form>
        
        <div className="text-center pt-2 border-t">
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} 
            className="text-xs font-bold text-blue-600"
          >
            {isRegistering ? '¿Ya tiene cuenta? Iniciar Sesión' : '¿No tiene acceso? Regístrese aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}