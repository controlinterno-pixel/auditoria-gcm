import React, { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// 🔗 IMPORTAMOS TUS DICCIONARIOS REALES DE GRC
import { MAPA_PROCESOS, CARGOS_SOCIALIZACION } from '../constants/diccionariosGRC';

export default function AuthScreen() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  // Campos del Formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [area, setArea] = useState('');

  // 🛡️ Nuevos Estados para Mejoras de UX/Seguridad
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [habeasDataAccepted, setHabeasDataAccepted] = useState(false);
  
  // ⏱️ Estados para Rate Limiting en Login
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockTimer, setLockTimer] = useState(0);

  // 📋 Extraemos las áreas principales del MAPA_PROCESOS
  const AREAS_OPCIONES = Object.keys(MAPA_PROCESOS);
  const CARGOS_OPCIONES = CARGOS_SOCIALIZACION;

  // 🛡️ Helper para medir la fortaleza de la contraseña
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

  // 1. Manejo del Registro
  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // 🛡️ Validación de Dominio Corporativo
    if (!cleanEmail.endsWith('@termales.com.co')) {
      alert("⛔ Acceso denegado: Solo se permiten correos institucionales (@termales.com.co)");
      return;
    }

    // 🛡️ Validación de Selección de Cargo y Área
    if (!cargo || !area) {
      alert("⚠️ Debe seleccionar un Cargo y un Área válida de las opciones desplegables.");
      return;
    }

    // 🛡️ Validación de Confirmación de Contraseña
    if (password !== confirmPassword) {
      alert("⚠️ Las contraseñas no coinciden. Por favor verifique.");
      return;
    }

    // 📜 Validación Habeas Data
    if (!habeasDataAccepted) {
      alert("⚠️ Debe aceptar las políticas de tratamiento de datos para continuar.");
      return;
    }

    // 🛡️ Validación de Fortaleza de Contraseña
    const strength = getPasswordStrength(password);
    if (strength.score < 75) {
      alert("⚠️ La contraseña es muy débil. Debe incluir al menos 8 caracteres, una mayúscula, un número y un símbolo especial (!@#$).");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'usuarios', user.uid), {
        uid: user.uid,
        email: cleanEmail,
        nombre: nombre,
        cargo: cargo,
        area: area,
        rol: 'lider',
        emailVerified: false,
        habeasDataAceptado: new Date().toISOString(), // Registro de auditoría de aceptación
        fechaRegistro: new Date().toISOString()
      });

      await sendEmailVerification(user);
      setPendingVerification(true);
    } catch (error) {
      console.error("Error en registro:", error);
      alert("❌ Error al crear la cuenta: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Manejo del Login con Anti Fuerza Bruta (Rate Limiting)
  const handleLogin = async (e) => {
    e.preventDefault();
    if (lockTimer > 0) return; // Bloqueo preventivo

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;
      
      // Reseteamos intentos fallidos si entra con éxito
      setFailedAttempts(0);

      if (!user.emailVerified && user.email !== 'controlinterno@termales.com.co') {
        alert("⚠️ Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada o spam.");
        setPendingVerification(true);
        setLoading(false);
        return;
      }
    } catch (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setLockTimer(60); // Bloqueo por 60 segundos
        alert("⛔ Demasiados intentos fallidos. Por seguridad, el acceso ha sido bloqueado por 60 segundos.");
      } else {
        alert(`❌ Credenciales inválidas. Intentos restantes: ${5 - newAttempts}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ⏱️ Efecto para manejar la cuenta regresiva del bloqueo
  useEffect(() => {
    let timer;
    if (lockTimer > 0) {
      timer = setInterval(() => {
        setLockTimer((prev) => {
          if (prev <= 1) {
            setFailedAttempts(0); // Reiniciamos oportunidades al acabar el tiempo
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockTimer]);

  // 🔄 Reenviar correo
  const handleResendEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser);
        alert("📩 Correo de verificación reenviado con éxito.");
      } catch (err) {
        alert("Espera un momento antes de solicitar otro correo.");
      }
    }
  };

  // 🔑 Recuperar Contraseña
  const handleResetPassword = async () => {
    if (!email) {
      alert("⚠️ Por favor, ingresa tu correo corporativo en el campo de arriba.");
      return;
    }

    try {
      auth.languageCode = 'es'; 
      const actionCodeSettings = {
        url: 'https://auditoria-gcm.vercel.app/reset-password',
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email.trim().toLowerCase(), actionCodeSettings);
      alert("✅ ¡Correo enviado con éxito! Revisa tu bandeja de entrada o SPAM para restablecer la contraseña.");
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        alert("❌ No existe ninguna cuenta registrada con este correo.");
      } else {
        alert(`❌ Error: ${error.message}`);
      }
    }
  };

  // (Componente de Verificación Pendiente se mantiene igual)
  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-inner">✉️</div>
          <div>
            <h2 className="text-2xl font-black text-slate-800">¡Confirma tu correo!</h2>
            <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
              Hemos enviado un enlace de confirmación a: <br/>
              <span className="font-bold text-slate-800 font-mono">{email}</span>
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
            <p className="text-[11px] text-amber-800 font-semibold leading-normal">
              💡 <b>Paso final de seguridad:</b> Haz clic en el enlace del correo para activar tu acceso a GCM Auditor v5.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <button onClick={() => window.location.reload()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all">
              Ya lo confirmé, Iniciar Sesión
            </button>
            <button onClick={handleResendEmail} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl transition-all">
               Reenviar correo de confirmación
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
        
        {/* Encabezado con Logo */}
        <div className="text-center mb-8">
          <div className="inline-block p-2 bg-white rounded-2xl mb-3 shadow-sm border border-slate-100">
            <img src="/logo_termales.png" alt="Logo Termales Santa Rosa de Cabal" className="w-16 h-16 object-contain mx-auto" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">GCM Auditor v5</h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Termales Santa Rosa de Cabal</p>
        </div>

        {isRegistering ? (
          // 📝 FORMULARIO DE REGISTRO
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="border-b pb-2 mb-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Registro de Nuevo Colaborador</h3>
              <p className="text-[11px] text-slate-400">Ingresa tus datos institucionales completos</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Nombre Completo *</label>
                <input type="text" required placeholder="Ej. Ana María Gómez" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Cargo / Puesto *</label>
                <select required value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700">
                  <option value="">-- Seleccionar --</option>
                  {CARGOS_OPCIONES.map((item, idx) => (<option key={`cargo-${idx}`} value={item}>{item}</option>))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Macroproceso / Área *</label>
              <select required value={area} onChange={(e) => setArea(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700">
                <option value="">-- Seleccionar Proceso --</option>
                {AREAS_OPCIONES.map((item, idx) => (<option key={`area-${idx}`} value={item}>{item}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Correo Institucional (@termales.com.co) *</label>
              <input type="email" required placeholder="usuario@termales.com.co" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>

            {/* CONTRASEÑA CON OJITO Y CONFIRMACIÓN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black uppercase text-slate-500">Contraseña Segura *</label>
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required placeholder="Mín. 8 caracteres..." value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 transition-colors text-sm">
                    {showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
                {password && (
                  <div className="w-full mt-2">
                    <span className="text-[9px] font-bold block mb-1">{getPasswordStrength(password).label}</span>
                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${getPasswordStrength(password).color}`} style={{ width: `${getPasswordStrength(password).score}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Confirmar Contraseña *</label>
                <div className="relative">
                  <input type={showConfirmPassword ? "text" : "password"} required placeholder="Repite tu contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 outline-none pr-10 ${confirmPassword && password !== confirmPassword ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'}`} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 transition-colors text-sm">
                    {showConfirmPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>
            </div>

            {/* CHECKBOX HABEAS DATA */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
              <input 
                type="checkbox" 
                id="habeasData" 
                checked={habeasDataAccepted} 
                onChange={(e) => setHabeasDataAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="habeasData" className="text-[10px] text-slate-600 leading-tight cursor-pointer">
                Autorizo a Termales Santa Rosa de Cabal el tratamiento de mis datos personales según las políticas de privacidad y acepto mantener la confidencialidad de la información interna gestionada en esta plataforma de auditoría.
              </label>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all mt-2 disabled:opacity-50">
              {loading ? "Creando cuenta..." : "Crear Cuenta y Enviar Verificación ✉️"}
            </button>
          </form>

        ) : (
          
          // 🔐 FORMULARIO DE LOGIN
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Correo Corporativo</label>
              <input type="email" required placeholder="usuario@termales.com.co" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Contraseña</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors text-sm">
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end -mt-2 mb-2">
              <button type="button" onClick={handleResetPassword} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button type="submit" disabled={loading || lockTimer > 0} className={`w-full text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50 ${lockTimer > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'}`}>
              {loading ? "Verificando..." : lockTimer > 0 ? `Bloqueado (${lockTimer}s)` : "Iniciar Sesión"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center border-t pt-4">
          <button onClick={() => {
            setIsRegistering(!isRegistering);
            setFailedAttempts(0); // Limpiar bloqueos al cambiar de vista
            setLockTimer(0);
          }} className="text-xs font-bold text-blue-600 hover:underline">
            {isRegistering ? "¿Ya tienes una cuenta? Inicia Sesión aquí" : "¿Nuevo usuario? Crea tu cuenta con perfil extendido aquí"}
          </button>
        </div>
      </div>
    </div>
  );
}