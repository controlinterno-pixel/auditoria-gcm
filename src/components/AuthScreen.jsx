import React, { useState } from 'react';
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

  // 2. Manejo del Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;

      if (!user.emailVerified && user.email !== 'controlinterno@termales.com.co') {
        alert("⚠️ Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada o spam.");
        setPendingVerification(true);
        setLoading(false);
        return;
      }
    } catch (error) {
      alert("❌ Error al ingresar: Credenciales inválidas o correo no registrado.");
    } finally {
      setLoading(false);
    }
  };

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
      alert("⚠️ Por favor, ingresa tu correo corporativo en el campo de arriba para enviarte el enlace.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      alert("✅ ¡Listo! Revisa tu bandeja de entrada o spam. Te hemos enviado un enlace para restablecer tu contraseña.");
    } catch (error) {
      alert("❌ Hubo un error. Verifica que el correo esté bien escrito.");
    }
  };

  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
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
              💡 <b>Paso final de seguridad:</b> Haz clic en el enlace del correo para activar tu acceso a GCM Auditor v5. Si no lo ves, revisa tu carpeta de <i>Spam</i>.
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
        {/* Encabezado con Logo Corporativo */}
        <div className="text-center mb-8">
          <div className="inline-block p-2 bg-white rounded-2xl mb-3 shadow-sm border border-slate-100">
            <img 
              src="/logo_termales.png" 
              alt="Logo Termales Santa Rosa de Cabal" 
              className="w-16 h-16 object-contain mx-auto"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">GCM Auditor v5</h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Termales Santa Rosa de Cabal</p>
        </div>
        {isRegistering ? (
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
              
              {/* DESPLEGABLE DE CARGO CON DATOS REALES */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Cargo / Puesto *</label>
                <select required value={cargo} onChange={(e) => setCargo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700">
                  <option value="">-- Seleccionar --</option>
                  {CARGOS_OPCIONES.map((item, idx) => (
                    <option key={`cargo-${idx}`} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* DESPLEGABLE DE ÁREA CON DATOS REALES */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Macroproceso / Área *</label>
              <select required value={area} onChange={(e) => setArea(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700">
                <option value="">-- Seleccionar Proceso --</option>
                {AREAS_OPCIONES.map((item, idx) => (
                  <option key={`area-${idx}`} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Correo Institucional (@termales.com.co) *</label>
              <input type="email" required placeholder="usuario@termales.com.co" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-black uppercase text-slate-500">Contraseña Segura *</label>
                {password && <span className="text-[10px] font-bold">{getPasswordStrength(password).label}</span>}
              </div>
              <input type="password" required placeholder="Mínimo 8 caracteres, mayúscula, número y símbolo" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
              {password && (
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${getPasswordStrength(password).color}`} style={{ width: `${getPasswordStrength(password).score}%` }} />
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all mt-2 disabled:opacity-50">
              {loading ? "Creando cuenta..." : "Crear Cuenta y Enviar Verificación ✉️"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Correo Corporativo</label>
              <input type="email" required placeholder="usuario@termales.com.co" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
<div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Contraseña</label>
              <input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            
            {/* NUEVO BOTÓN DE OLVIDÉ CONTRASEÑA */}
            <div className="flex justify-end -mt-2 mb-2">
              <button 
                type="button" 
                onClick={handleResetPassword}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-lg transition-all disabled:opacity-50">
              {loading ? "Verificando..." : "Iniciar Sesión"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center border-t pt-4">
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-xs font-bold text-blue-600 hover:underline">
            {isRegistering ? "¿Ya tienes una cuenta? Inicia Sesión aquí" : "¿Nuevo usuario? Crea tu cuenta con perfil extendido aquí"}
          </button>
        </div>

      </div>
    </div>
  );
}