import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { confirmPasswordReset } from 'firebase/auth';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oobCode, setOobCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Capturamos el código secreto de la URL cuando carga la página
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');
    if (code) {
      setOobCode(code);
    }
  }, []);

  // 🛡️ Medidor de Fortaleza de la Contraseña
  const getPasswordStrength = (pass) => {
    let score = 0;
    if (!pass) return { score: 0, label: 'Muy débil', color: 'bg-slate-200' };

    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;

    if (score <= 25) return { score, label: 'Muy débil ❌', color: 'bg-red-500' };
    if (score <= 50) return { score, label: 'Aceptable ⚠️', color: 'bg-amber-500' };
    if (score <= 75) return { score, label: 'Buena 👍', color: 'bg-blue-500' };
    return { score, label: 'Muy Segura 🛡️', color: 'bg-emerald-500' };
  };

  const handleReset = async (e) => {
    e.preventDefault();
    
    // 1. Validar coincidencia de campos
    if (newPassword !== confirmPassword) {
      alert("⚠️ Las contraseñas no coinciden. Verifícalas e intenta de nuevo.");
      return;
    }

    // 2. Validar fortaleza de la contraseña
    const strength = getPasswordStrength(newPassword);
    if (strength.score < 75) {
      alert("⚠️ La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo especial (!@#$).");
      return;
    }

    setLoading(true);
    try {
      // 3. Confirmar el cambio en Firebase
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage("✅ ¡Contraseña actualizada con éxito! Ya puedes cerrar esta ventana o volver a iniciar sesión.");
    } catch (error) {
      console.error("Error al restablecer:", error);
      alert("❌ El enlace ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!oobCode) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl text-center text-slate-700 font-medium">
          ⌛ Cargando enlace de verificación seguro...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
        
        {/* Encabezado */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-slate-800">Crea tu nueva contraseña</h2>
          <p className="text-xs text-slate-400 mt-1">GCM Auditor v5 - Termales Santa Rosa de Cabal</p>
        </div>

        {message ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
            <p className="text-emerald-700 font-bold text-sm">{message}</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all"
            >
              Ir a Iniciar Sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {/* Campo 1: Nueva Contraseña */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-black uppercase text-slate-500">Nueva Contraseña *</label>
                {newPassword && <span className="text-[10px] font-bold">{getPasswordStrength(newPassword).label}</span>}
              </div>
              <input 
                type="password" 
                required 
                placeholder="Mínimo 8 caracteres, mayúscula, número y símbolo"
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
              />
              {newPassword && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${getPasswordStrength(newPassword).color}`} style={{ width: `${getPasswordStrength(newPassword).score}%` }} />
                </div>
              )}
            </div>
            
            {/* Campo 2: Confirmar Contraseña */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Confirmar Nueva Contraseña *</label>
              <input 
                type="password" 
                required 
                placeholder="Repite tu nueva contraseña"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all mt-4 disabled:opacity-50"
            >
              {loading ? "Guardando cambios..." : "Guardar Nueva Contraseña 🛡️"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}