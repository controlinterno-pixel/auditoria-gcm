import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  BarChart3, 
  Users, 
  Leaf, 
  ArrowRight,
  UserCheck
} from 'lucide-react';

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

      // 🛡️ REGLA DE SEGURIDAD N2:
      // El rol ya NO se escribe desde el cliente hacia la colección "usuarios".
      // La asignación de roles queda bajo control estricto del Administrador 
      // mediante la consola de Firebase o un backend seguro.
   
  await sendEmailVerification(user);
      await signOut(auth);
      setPendingVerification(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error("Error en registro:", errorMessage);
      alert("❌ Error al crear la cuenta: " + errorMessage);
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

// 🛡️ REGLA DE SEGURIDAD 2:
      // Bloqueo obligatorio para cuentas no verificadas (Sin excepciones o puertas traseras)
      if (!user.emailVerified) {
        await signOut(auth);
        alert("⚠️ Acceso denegado: Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada o spam para activar tu cuenta.");
        setPendingVerification(true);
      setLoading(false);
        return;
      }
    } catch {
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
      } catch {
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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden font-sans select-none p-4 sm:p-6">
      
      {/* 1. Imagen de Fondo de Paisaje (Nítida) */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-no-repeat"
        style={{ 
          backgroundImage: "url('/matriz_riesgos.png')",
          backgroundPosition: "center 35%" 
        }}
      />
      {/* Overlay sutil al 10% solo para apagar ligeramente el brillo extremo, manteniendo nitidez total */}
      <div className="absolute inset-0 z-10 bg-slate-950/10" />

      {/* 2. Navegación Superior Derecha */}
      <div className="absolute top-6 right-8 z-20 hidden md:flex items-center space-x-2 text-[11px] font-bold tracking-widest text-white/90 uppercase drop-shadow-md">
        <span className="text-emerald-400">|</span>
        <span>AUDITORÍA</span>
        <span className="text-emerald-400">|</span>
        <span>CONTROL</span>
        <span className="text-emerald-400">|</span>
        <span>RESULTADOS</span>
      </div>

      {/* 3. Panel Izquierdo Corporativo (Branding con corte diagonal) */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-[48%] z-20 hidden lg:flex flex-col justify-between p-12 bg-[#041224]/95 text-white shadow-[20px_0_50px_rgba(0,0,0,0.6)]"
        style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 0% 100%)" }}
      >
        
        <div className="flex items-center space-x-3">
          <img 
            src="/logo_termales.png" 
            alt="Termales Santa Rosa de Cabal" 
            className="h-16 w-auto object-contain drop-shadow-md"
          />
        </div>

        <div className="space-y-6 max-w-md">
          <div className="space-y-3">
            <div className="w-10 h-1 bg-emerald-400 rounded-full" />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight drop-shadow-md">
              Auditoría que genera <br />
              <span className="text-white">confianza</span>
            </h1>
            <p className="text-xs text-slate-200 font-medium leading-relaxed drop-shadow-sm">
              Tecnología, control y análisis para tomar mejores decisiones.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Transparencia</h4>
                <p className="text-[11px] text-slate-300">Procesos más seguros</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Eficiencia</h4>
                <p className="text-[11px] text-slate-300">Resultados en tiempo real</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Trabajo en equipo</h4>
                <p className="text-[11px] text-slate-300">Un mismo objetivo</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Sostenibilidad</h4>
                <p className="text-[11px] text-slate-300">Un futuro responsable</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-slate-300 tracking-wider">
          Eje Cafetero - Colombia
        </div>
      </div>

      {/* 4. Tarjeta Formulario (Login / Registro) */}
      <div className="relative z-30 w-full max-w-md my-auto lg:ml-[22%]">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/60 text-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto">
          
          {/* Header */}
          <div className="text-center space-y-1">
            <img 
              src="/logo_termales.png" 
              alt="Logo Termales" 
              className="h-12 w-auto mx-auto object-contain mb-1"
            />
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
              SISTEMA DE AUDITORÍA
            </p>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              GCM Auditor v5
            </h2>
            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
              TERMALES SANTA ROSA DE CABAL
            </p>
            <div className="w-10 h-0.5 bg-emerald-500 mx-auto rounded-full mt-2" />
          </div>

          {isRegistering ? (
            /* 📝 FORMULARIO DE REGISTRO COMPLETO */
            <form onSubmit={handleRegister} className="space-y-3 text-left">
              <div className="border-b pb-2 mb-2">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Registro de Nuevo Colaborador</h3>
                <p className="text-[10px] text-slate-400">Ingresa tus datos institucionales completos</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Nombre Completo *</label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Ana María Gómez" 
                    value={nombre} 
                    onChange={(e) => setNombre(e.target.value)} 
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Cargo *</label>
                  <select 
                    required 
                    value={cargo} 
                    onChange={(e) => setCargo(e.target.value)} 
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  >
                    <option value="">-- Seleccionar --</option>
                    {CARGOS_OPCIONES.map((item, idx) => (
                      <option key={`cargo-${idx}`} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Macroproceso / Área *</label>
                  <select 
                    required 
                    value={area} 
                    onChange={(e) => setArea(e.target.value)} 
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  >
                    <option value="">-- Proceso --</option>
                    {AREAS_OPCIONES.map((item, idx) => (
                      <option key={`area-${idx}`} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Correo Institucional *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    required 
                    placeholder="usuario@termales.com.co" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none font-mono" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Contraseña *</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      placeholder="Mín. 8 caract..." 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="w-full bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none pr-8" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {password && (
                    <div className="w-full mt-1">
                      <span className="text-[8px] font-bold block mb-0.5">{getPasswordStrength(password).label}</span>
                      <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${getPasswordStrength(password).color}`} style={{ width: `${getPasswordStrength(password).score}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Confirmar *</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      required 
                      placeholder="Repite clave" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      className={`w-full bg-slate-100/80 border rounded-xl px-2.5 py-2 text-xs font-semibold focus:ring-2 outline-none pr-8 ${confirmPassword && password !== confirmPassword ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 focus:ring-blue-500'}`} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-100/80 border border-slate-200 rounded-xl flex items-start gap-2">
                <input 
                  type="checkbox" 
                  id="habeasData" 
                  checked={habeasDataAccepted} 
                  onChange={(e) => setHabeasDataAccepted(e.target.checked)}
                  className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="habeasData" className="text-[9px] text-slate-600 leading-tight cursor-pointer">
                  Autorizo a Termales Santa Rosa de Cabal el tratamiento de mis datos personales según las políticas de privacidad y acepto mantener la confidencialidad de la información interna.
                </label>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-[#0b2239] hover:bg-[#133252] text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all hover:scale-[1.01] disabled:opacity-50 mt-1"
              >
                <span>{loading ? "Creando cuenta..." : "Crear Cuenta y Enviar Verificación ✉️"}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

          ) : (
            
            /* 🔐 FORMULARIO DE LOGIN */
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Correo corporativo</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="email" 
                    required 
                    placeholder="usuario@termales.com.co" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full bg-slate-100/80 border border-slate-200 rounded-xl py-3 pl-10 pr-10 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="text-right">
                <button 
                  type="button" 
                  onClick={handleResetPassword} 
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button 
                type="submit" 
                disabled={loading || lockTimer > 0} 
                className={`w-full text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 ${lockTimer > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0b2239] hover:bg-[#133252]'}`}
              >
                <span>
                  {loading ? "Verificando..." : lockTimer > 0 ? `Bloqueado (${lockTimer}s)` : "INICIAR SESIÓN"}
                </span>
                {!loading && lockTimer === 0 && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* Opciones Inferiores */}
          <div className="pt-2 border-t border-slate-200/80 space-y-3 text-center">
            <div className="text-xs text-slate-500 font-medium">
              <span>{isRegistering ? "¿Ya tienes una cuenta?" : "¿Nuevo usuario?"} </span>
              <button 
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setFailedAttempts(0);
                  setLockTimer(0);
                }} 
                className="font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                {isRegistering ? "Inicia sesión aquí" : "Crea tu cuenta con perfil extendido aquí"}
              </button>
            </div>

            <div className="flex items-center justify-center space-x-1.5 text-[10px] font-semibold text-slate-400 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Tu información está protegida</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}