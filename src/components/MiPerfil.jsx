import React, { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function MiPerfil({ user, isAdmin, showNotification }) {
  const [activeTab, setActiveTab] = useState('perfil');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Leemos la memoria del navegador para recordar cómo dejaste los botones
  const [modoOscuro, setModoOscuro] = useState(localStorage.getItem('modoOscuro') === 'true');
  const [notificacionesActivas, setNotificacionesActivas] = useState(localStorage.getItem('notificacionesActivas') !== 'false');

  // Acciones reales al hacer clic
  const handleToggleModoOscuro = () => {
    const newState = !modoOscuro;
    setModoOscuro(newState);
    localStorage.setItem('modoOscuro', newState);
    
    if (newState) {
      document.documentElement.classList.add('dark');
      showNotification('Modo oscuro activado globalmente.', 'success');
    } else {
      document.documentElement.classList.remove('dark');
      showNotification('Modo claro activado.', 'success');
    }
  };

  const handleToggleNotificaciones = () => {
    const newState = !notificacionesActivas;
    setNotificacionesActivas(newState);
    localStorage.setItem('notificacionesActivas', newState);
    showNotification(newState ? 'Notificaciones por correo activadas.' : 'Notificaciones silenciadas.', 'success');
  };
  
  // Estados editables
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  // 💡 NUEVO: Leemos la foto de la memoria local primero
  const [photoURL, setPhotoURL] = useState(localStorage.getItem('userAvatar') || user?.photoURL || '');
const [cargo, setCargo] = useState(localStorage.getItem('userCargo') || (isAdmin ? 'Auditor Líder Senior' : 'Gestor de Proceso'));
  const [telefono, setTelefono] = useState(localStorage.getItem('userTelefono') || '+57 300 123 4567');
  const [ubicacion, setUbicacion] = useState(localStorage.getItem('userUbicacion') || 'Obteniendo ubicación...');

  // 🌍 Autodetectar ubicación real basada en IP
  React.useEffect(() => {
    const fetchLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.city && data.country_name) {
          const loc = `${data.city}, ${data.country_name}`;
          setUbicacion(loc);
          localStorage.setItem('userUbicacion', loc);
        }
      } catch (error) {
        setUbicacion('Santa Rosa de Cabal, COL'); // Fallback por si falla el internet
      }
    };
    
    if (!localStorage.getItem('userUbicacion')) {
      fetchLocation();
    } else {
      setUbicacion(localStorage.getItem('userUbicacion'));
    }
  }, []);
 const inicial = displayName 
    ? displayName.charAt(0).toUpperCase() 
    : (user?.email ? user.email.charAt(0).toUpperCase() : 'U');

  // 🛡️ ROL FIJO DEL SISTEMA
  const rolText = isAdmin ? 'Auditor Líder Senior' : 'Gestor de Proceso';

// 🧠 MOTOR DE AUTO-RECORTE INTELIGENTE
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Por favor, selecciona un archivo de imagen válido.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 300; 
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, x, y, img.width * scale, img.height * scale);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        setPhotoURL(compressedBase64); // Guardamos la foto recortada
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

const handleUpdateProfile = async () => {
    setIsSaving(true);
    try {
      if (auth.currentUser) {
        const isBase64 = photoURL.startsWith('data:image');

        await updateProfile(auth.currentUser, {
          displayName: displayName.trim(),
          // 🔥 Evitamos enviar la imagen gigante a Firebase, solo actualizamos el nombre
          photoURL: isBase64 ? auth.currentUser.photoURL : photoURL.trim() 
        });

        // 💾 Guardamos la imagen y el cargo en la memoria local
        if (isBase64) {
          localStorage.setItem('userAvatar', photoURL);
        } else if (photoURL === '') {
          localStorage.removeItem('userAvatar');
        }
        localStorage.setItem('userCargo', cargo.trim());
        localStorage.setItem('userTelefono', telefono.trim());

        // Actualizamos el objeto local
        if (user) {
          user.displayName = displayName.trim();
          user.photoURL = photoURL;
        }

        showNotification('Perfil actualizado con éxito.', 'success');
        setIsEditing(false);
      }
    } catch (error) {
      console.error(error);
      showNotification('Error al actualizar el perfil.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-[1400px] mx-auto space-y-6 pb-12 font-sans">
      
      {/* 🛡️ 1. HERO BANNER PRINCIPAL */}
      <div className="bg-[#070f1e] rounded-3xl p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center md:items-start gap-8 shadow-2xl border border-slate-800/80">
        
        {/* Decoración de fondo abstracta */}
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <svg width="400" height="200" viewBox="0 0 400 200" fill="none">
            <path d="M350 50L300 150L200 100L100 180L0 80" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Avatar grande */}
        <div className="relative shrink-0 z-10">
          <div className="w-28 h-28 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-4xl shadow-[0_0_30px_rgba(37,99,235,0.3)] border-4 border-[#070f1e] overflow-hidden">
            {photoURL ? (
              <img src={photoURL} alt="Perfil" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
            ) : (
              inicial
            )}
          </div>
          <div className="absolute bottom-2 right-2 w-4 h-4 bg-emerald-500 border-2 border-[#070f1e] rounded-full shadow-sm" title="En línea"></div>
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
            ● En línea
          </div>
        </div>

        {/* Info central */}
        <div className="flex-1 space-y-2 z-10 text-center md:text-left">
          <h2 className="text-3xl font-black tracking-tight drop-shadow-md">
            Hola, <span className="text-blue-400">{displayName || 'Usuario'}</span>
          </h2>
          {/* 💡 Aquí mostramos el cargo dinámico */}
          <p className="text-sm text-slate-300 font-semibold uppercase tracking-widest">{cargo}</p>
          <p className="text-xs text-slate-400 max-w-lg leading-relaxed pt-1">
            Comprometido con la mejora continua, la transparencia y la gestión integral de riesgos.
          </p>
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-5 pt-3">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v10a2 2 0 002 2z" /></svg>
              {user?.email}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              {telefono}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {ubicacion}
            </span>
          </div>
        </div>

        {/* Cita derecha */}
        <div className="hidden lg:block w-72 border-l border-slate-700/50 pl-6 relative z-10">
          <span className="text-5xl font-serif text-blue-500/20 absolute -top-4 -left-3">"</span>
          <p className="text-xs text-slate-300 italic leading-relaxed pt-2">
            La auditoría no solo encuentra riesgos, también construye confianza en toda la organización.
          </p>
        </div>
      </div>

      {/* 🗂️ 2. MENÚ DE PESTAÑAS */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 mt-8">
        {[
          { id: 'perfil', label: 'Mi Perfil', icon: '👤' },
          { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
          { id: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
          { id: 'seguridad', label: 'Seguridad', icon: '🛡️' },
          { id: 'actividad', label: 'Actividad', icon: '📊' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* 🧱 3. GRID PRINCIPAL (3 COLUMNAS) */}
      {activeTab === 'perfil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          
          {/* ⬅️ COLUMNA IZQUIERDA (Info y Ajustes Rápidos) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Tarjeta: Información Personal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">👤</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Información Personal</h3>
                    <p className="text-[10px] text-slate-500">Datos básicos de tu cuenta</p>
                  </div>
                </div>
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
                    ✏️ Editar
                  </button>
                ) : (
                  <button onClick={handleUpdateProfile} disabled={isSaving} className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 px-4 py-1.5 rounded-full transition-colors shadow-md">
                    {isSaving ? '⏳...' : '💾 Guardar'}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5">👤</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Nombre completo</p>
                    {isEditing ? (
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none" />
                    ) : (
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{displayName || 'Usuario GCM'}</p>
                    )}
                  </div>
                </div>

                {/* 🔒 ROL EN EL SISTEMA (Fijo, no editable) */}
                <div className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5">🛡️</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rol en el sistema</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-2">
                      {rolText} 
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Verificado</span>
                    </p>
                  </div>
                </div>

                {/* ✏️ CARGO EN LA ORGANIZACIÓN (Editable) */}
                <div className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5">💼</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Cargo en la Organización</p>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={cargo} 
                        onChange={(e) => setCargo(e.target.value)} 
                        placeholder="Ej. Gerente de Auditoría" 
                        className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none" 
                      />
                    ) : (
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{cargo}</p>
                    )}
                  </div>
                </div>

                {/* 💡 CARGA DE IMAGEN MEJORADA */}
                {isEditing && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <span className="text-blue-400 mt-1.5">📷</span>
                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-[10px] text-blue-800 font-bold uppercase tracking-wider">Fotografía de Perfil</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Sube una foto desde tu equipo. El sistema la centrará automáticamente.</p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer bg-white border border-blue-300 text-blue-600 text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-sm hover:bg-blue-50 transition-colors">
                          Explorar Archivos...
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload} 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* 📱 TELÉFONO (Editable) */}
                <div className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5">📱</span>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Teléfono de Contacto</p>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={telefono} 
                        onChange={(e) => setTelefono(e.target.value)} 
                        placeholder="Ej. +57 300 123 4567" 
                        className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded focus:border-blue-500 focus:outline-none" 
                      />
                    ) : (
                      <p className="text-xs font-bold text-slate-800 mt-0.5">{telefono}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5">✉️</span>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Correo electrónico</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-slate-400 mt-0.5">🏢</span>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Dependencia</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">Auditoría Interna / Control</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta: Contraseña */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex justify-between items-center group cursor-pointer hover:border-blue-300 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-lg">🔒</div>
                <div>
                  <h3 className="text-xs font-black text-slate-800">Cambiar Contraseña</h3>
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Tu cuenta está protegida
                  </p>
                </div>
              </div>
              <button className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-full group-hover:bg-blue-50 transition-colors">
                Cambiar
              </button>
            </div>

{/* Tarjeta: Preferencias */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">⚙️</div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Preferencias de la App</h3>
                  <p className="text-[10px] text-slate-500">Personaliza tu experiencia</p>
                </div>
              </div>

<div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">🌙</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Modo oscuro</p>
                      <p className="text-[9px] text-slate-500">Tema oscuro para la interfaz</p>
                    </div>
                  </div>
                  {/* Toggle Switch FUNCIONAL: Modo Oscuro */}
                  <div 
                    onClick={handleToggleModoOscuro}
                    className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${modoOscuro ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${modoOscuro ? 'translate-x-4' : ''}`}></div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">🌍</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Idioma</p>
                      <p className="text-[9px] text-slate-500">Español (Colombia)</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">🔔</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Notificaciones</p>
                      <p className="text-[9px] text-slate-500">Alertas al correo electrónico</p>
                    </div>
                  </div>
                  {/* Toggle Switch FUNCIONAL: Notificaciones */}
                   <div 
                    onClick={handleToggleNotificaciones}
                    className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${notificacionesActivas ? 'bg-blue-600' : 'bg-slate-300'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${notificacionesActivas ? 'translate-x-4' : ''}`}></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ⏺️ COLUMNA CENTRAL (Tarjeta Estética) */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-slate-50 to-white"></div>
              
              <div className="relative z-10 w-32 h-32 rounded-full bg-slate-100 mb-6 p-1 border border-slate-200 shadow-md">
                <div className="w-full h-full rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-5xl overflow-hidden">
                  {photoURL ? (
                    <img src={photoURL} alt="Perfil" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                  ) : (
                    inicial
                  )}
                </div>
                <div className="absolute bottom-1 right-2 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></div>
              </div>

              <div className="z-10 mb-6">
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-100">
                  ● Cuenta Activa
                </span>
              </div>

              <p className="text-sm text-slate-600 italic font-medium leading-relaxed z-10 max-w-xs relative">
                <span className="text-3xl text-slate-200 absolute -top-4 -left-4">"</span>
                La excelencia en la auditoría comienza con la integridad de cada uno de nosotros.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mt-8 z-10">
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1">🔹 Analítico</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1">🟢 Responsable</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 flex items-center gap-1">⭐ Líder</span>
              </div>
            </div>
          </div>

          {/* ➡️ COLUMNA DERECHA (Organización y Permisos) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Tarjeta: Mi Organización */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">🏢</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Mi Organización</h3>
                    <p className="text-[10px] text-slate-500">Información de la entidad</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-white rounded-full border border-slate-200 flex items-center justify-center text-2xl shadow-sm">♨️</div>
                <div>
                  <p className="text-xs font-black text-slate-800">Termales de Santa Rosa</p>
                  <p className="text-[10px] text-slate-500 font-medium">Sistema de Gestión Integral</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><span className="text-slate-400">📄</span> NIT</span>
                  <span className="text-[11px] font-bold text-slate-800">900.123.456-7</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><span className="text-slate-400">📍</span> Sede</span>
                  <span className="text-[11px] font-bold text-slate-800">Santa Rosa, Risaralda</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-50">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5"><span className="text-slate-400">💼</span> Cargo</span>
                  {/* 💡 Aquí también se refleja tu nuevo cargo */}
                  <span className="text-[11px] font-bold text-slate-800 text-right">{cargo}</span>
                </div>
              </div>
            </div>

            {/* Tarjeta: Roles y Permisos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">🛡️</div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Roles y Permisos</h3>
                    <p className="text-[10px] text-slate-500">Accesos asignados a tu usuario</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-blue-600 cursor-pointer hover:underline">Ver detalles</span>
              </div>

              <div className="space-y-3">
                {['Planificación de auditoría', 'Trabajo de campo', 'Resultados y hallazgos', 'Planes de acción', 'Gobernanza y cierre'].map((modulo, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[8px]">✓</div>
                      {modulo}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Acceso completo</span>
                  </div>
                ))}
                {!isAdmin && (
                   <div className="flex justify-between items-center pt-2">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[8px]">🔒</div>
                      Administración global
                    </span>
                    <span className="text-[9px] font-bold text-rose-400 uppercase">Restringido</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tarjeta: Estadísticas rápidas */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">📊</div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Estadísticas de Actividad</h3>
                  <p className="text-[10px] text-slate-500">Tu participación en el sistema</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">📋</div>
                  <div><p className="text-lg font-black text-slate-800">12</p><p className="text-[8px] font-bold text-slate-500 uppercase">Programas</p></div>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-sm">✅</div>
                  <div><p className="text-lg font-black text-slate-800">8</p><p className="text-[8px] font-bold text-slate-500 uppercase">Informes</p></div>
                </div>
                <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-sm">⏱️</div>
                  <div><p className="text-lg font-black text-slate-800">45</p><p className="text-[8px] font-bold text-slate-500 uppercase">Días activo</p></div>
                </div>
                <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm">⭐</div>
                  <div><p className="text-lg font-black text-slate-800">98%</p><p className="text-[8px] font-bold text-slate-500 uppercase">Cumplimiento</p></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}