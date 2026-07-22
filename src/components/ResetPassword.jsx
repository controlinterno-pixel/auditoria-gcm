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

  const handleReset = async (e) => {
    e.preventDefault();
    
    // 1. Validar que las contraseñas coincidan
    if (newPassword !== confirmPassword) {
      alert("⚠️ Las contraseñas no coinciden.");
      return;
    }

    // 2. Validar tu seguridad (puedes traer aquí tu función getPasswordStrength)
    if (newPassword.length < 8) {
      alert("⚠️ La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      // 3. Enviamos la nueva contraseña a Firebase usando el código de la URL
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage("✅ Tu contraseña ha sido cambiada con éxito. Ya puedes iniciar sesión.");
    } catch (error) {
      alert("❌ Enlace inválido o expirado. Vuelve a solicitar el cambio de contraseña.");
    } finally {
      setLoading(false);
    }
  };

  if (!oobCode) return <div className="p-10 text-center">Cargando enlace seguro...</div>;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl">
        <h2 className="text-xl font-black text-slate-800 mb-4">Crea tu nueva contraseña</h2>
        
        {message ? (
          <div className="text-emerald-600 font-bold text-center">{message}</div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Nueva Contraseña</label>
              <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Confirmar Contraseña</label>
              <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 rounded-xl mt-4">
              {loading ? "Guardando..." : "Guardar Nueva Contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}