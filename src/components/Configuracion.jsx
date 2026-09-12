import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { MAPA_PROCESOS } from '../constants/diccionariosGRC';

export default function Configuracion({
  isAdmin,
  forceUpdateCronograma,
  handleImportExcelRiesgos,
  exportToJSON,
  handleImportJSON
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar lista de usuarios desde Firestore
  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'usuarios'));
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setUsuarios(docs);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // Cambiar rol de un usuario
  const handleCambiarRol = async (uid, nuevoRol) => {
    try {
      const userRef = doc(db, 'usuarios', uid);
      await updateDoc(userRef, { rol: nuevoRol });
      setUsuarios(prev => prev.map(u => u.id === uid ? { ...u, rol: nuevoRol } : u));
      alert("✅ Rol actualizado correctamente");
    } catch (error) {
      console.error("Error actualizando rol:", error);
      alert("❌ No se pudo actualizar el rol");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-black text-slate-800">⚙️ Configuración y Cargas Masivas</h2>
        <p className="text-xs text-slate-500 font-bold mt-1">Gestión avanzada de la base de datos, copias de seguridad y usuarios.</p>
      </div>

{/* 👥 NUEVA SECCIÓN: GESTIÓN DE USUARIOS Y ROLES (GRANULAR) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm mb-1">👥 Gestión de Usuarios y Accesos Modulares</h3>
            <p className="text-xs text-slate-500">Asigna roles o define permisos específicos por módulo para cada colaborador de Termales Santa Rosa.</p>
          </div>
          <button 
            onClick={cargarUsuarios}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            🔄 Refrescar Usuarios
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 opacity-60">
            <span className="text-3xl animate-bounce mb-2">⏳</span>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando Usuarios...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {usuarios.length === 0 ? (
              <p className="p-4 text-center text-slate-400 italic text-xs font-bold border border-slate-200 border-dashed rounded-xl">No hay usuarios registrados aún.</p>
            ) : (
              usuarios.map((u) => (
                <div key={u.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-black text-lg shrink-0">
                        {u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 text-sm leading-tight">{u.nombre || 'Colaborador GRC'}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{u.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                        u.rol === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        u.rol === 'auditor' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        Rol: {u.rol || 'lider'}
                      </span>
                     <select
                        value={u.rol || 'lider'}
                        onChange={(e) => handleCambiarRol(u.id, e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-3 py-1.5 font-bold focus:ring-2 focus:ring-[#0A3B32] outline-none shadow-sm cursor-pointer"
                      >
                        <option value="lider">Líder (Personalizado)</option>
                        <option value="auditor">Auditor (Ver Todo)</option>
                        <option value="admin">Administrador (Total)</option>
                      </select>
                    </div>
                  </div>

                  {/* 🔗 NUEVO: ASIGNACIÓN DE PROCESO Y NOMBRE PARA RLS (ROW-LEVEL SECURITY) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm mb-4">
                    <p className="text-[9px] font-black text-[#0A3B32] uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">🛡️ Seguridad a Nivel de Fila (Filtro Automático Inteligente)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Nombre (Dueño Tarea)</label>
                        <input 
                          type="text" 
                          value={u.nombreResponsable || ''} 
                          placeholder="Ej: Oscar Restrepo"
                          onChange={async (e) => {
                            const val = e.target.value;
                            setUsuarios(prev => prev.map(usr => usr.id === u.id ? { ...usr, nombreResponsable: val } : usr));
                            try {
                              await updateDoc(doc(db, 'usuarios', u.id), { nombreResponsable: val });
                            } catch (err) {}
                          }}
                          className="w-full text-[11px] p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] outline-none font-medium shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Macroproceso / Área</label>
                        <select 
                          value={u.procesoAsignado || ''} 
                          onChange={async (e) => {
                            const val = e.target.value;
                            // Al cambiar macroproceso, limpiamos el subproceso para evitar inconsistencias
                            setUsuarios(prev => prev.map(usr => usr.id === u.id ? { ...usr, procesoAsignado: val, subprocesoAsignado: '' } : usr));
                            try {
                              await updateDoc(doc(db, 'usuarios', u.id), { procesoAsignado: val, subprocesoAsignado: '' });
                            } catch (err) {}
                          }}
                          className="w-full text-[11px] p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-700 bg-white cursor-pointer shadow-sm"
                        >
                          <option value="">-- Acceso Global / Sin área --</option>
                          {Object.keys(MAPA_PROCESOS || {}).sort().map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Subproceso (Nivel Quirúrgico)</label>
                        <select 
                          value={u.subprocesoAsignado || ''} 
                          disabled={!u.procesoAsignado}
                          onChange={async (e) => {
                            const val = e.target.value;
                            setUsuarios(prev => prev.map(usr => usr.id === u.id ? { ...usr, subprocesoAsignado: val } : usr));
                            try {
                              await updateDoc(doc(db, 'usuarios', u.id), { subprocesoAsignado: val });
                            } catch (err) {}
                          }}
                          className="w-full text-[11px] p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0A3B32] outline-none font-bold text-slate-700 cursor-pointer shadow-sm disabled:opacity-50 disabled:bg-slate-50 truncate"
                        >
                          <option value="">-- Ver todo el Macroproceso --</option>
                          {((MAPA_PROCESOS || {})[u.procesoAsignado] || []).sort().map(sp => (
                            <option key={sp} value={sp}>{sp}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 🎛️ PANEL DE PERMISOS GRANULARES (Solo si NO es admin general) */}
                  {u.rol !== 'admin' && (
                    <div className="pt-4 border-t border-slate-200 mt-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Accesos Modulares y Submódulos (Lectura/Edición)</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          { 
                            id: 'inicio', 
                            label: 'Inicio', 
                            subs: [
                              { id: 'sub_mi_espacio', label: 'Mi Espacio GRC' },
                              { id: 'sub_dashboard', label: 'GRC Dashboard' }
                            ]
                          },
                          { 
                            id: 'auditorias', 
                            label: 'Auditorías', 
                            subs: [
                              { id: 'sub_cronograma', label: 'Cronograma Anual' },
                              { id: 'sub_programas', label: 'Programas de Auditoría' },
                              { id: 'sub_campo', label: 'Trabajo de Campo' }
                            ]
                          },
                          { 
                            id: 'riesgos', 
                            label: 'Riesgos', 
                            subs: [
                              { id: 'sub_matriz_riesgos', label: 'Matriz de Riesgos' },
                              { id: 'sub_apetito', label: 'Apetito de Riesgo' }
                            ]
                          },
                          { 
                            id: 'hallazgos', 
                            label: 'Informes y Hallazgos', 
                            subs: [
                              { id: 'sub_informes', label: 'Informes Emitidos' },
                              { id: 'sub_hallazgos', label: 'Hallazgos Registrados' },
                              { id: 'sub_incidentes', label: 'Eventos de Pérdida' }
                            ]
                          },
                          { 
                            id: 'planes', 
                            label: 'Planes de Acción', 
                            subs: [
                              { id: 'sub_seguimiento_planes', label: 'Seguimiento de Planes' }
                            ]
                          },
                          { 
                            id: 'gobernanza', 
                            label: 'Gobernanza & IA', 
                            subs: [
                              { id: 'sub_comites', label: 'Sesiones de Comité' },
                              { id: 'sub_trazabilidad', label: 'Bitácora Trazabilidad' },
                              { id: 'sub_auditoria_auto', label: 'Auditoría Automatizada' }
                            ]
                          }
                        ].map(modulo => {
                          const userPermisos = u.permisos || ['inicio', 'sub_mi_espacio', 'hallazgos', 'sub_hallazgos', 'planes', 'sub_seguimiento_planes'];
                          const moduloActivo = userPermisos.includes(modulo.id);

                          return (
                            <div key={modulo.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                              {/* Checkbox Principal (Módulo) */}
                              <label className={`flex items-center gap-2 text-[11px] font-black cursor-pointer mb-2 pb-2 border-b border-slate-100 ${moduloActivo ? 'text-[#0A3B32]' : 'text-slate-500'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={moduloActivo}
                                  onChange={async (e) => {
                                    const isChecked = e.target.checked;
                                    let nuevosPermisos = [...userPermisos];
                                    
                                    if (isChecked) {
                                      nuevosPermisos.push(modulo.id);
                                      // Al activar el padre, sugerimos activar sus hijos
                                      modulo.subs.forEach(s => {
                                        if(!nuevosPermisos.includes(s.id)) nuevosPermisos.push(s.id);
                                      });
                                    } else {
                                      nuevosPermisos = nuevosPermisos.filter(p => p !== modulo.id);
                                      // Al desactivar el padre, desactivamos todos sus hijos
                                      modulo.subs.forEach(s => {
                                        nuevosPermisos = nuevosPermisos.filter(p => p !== s.id);
                                      });
                                    }

                                    try {
                                      const userRef = doc(db, 'usuarios', u.id);
                                      await updateDoc(userRef, { permisos: nuevosPermisos });
                                      setUsuarios(prev => prev.map(usr => usr.id === u.id ? { ...usr, permisos: nuevosPermisos } : usr));
                                    } catch (error) {
                                      console.error("Error actualizando permiso:", error);
                                      alert("❌ No se pudo guardar el permiso en la base de datos.");
                                    }
                                  }}
                                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                                {modulo.label}
                              </label>

                              {/* Checkboxes Hijos (Submódulos) */}
                              <div className="flex flex-col gap-1.5 pl-6">
                                {modulo.subs.map(sub => {
                                  const subActivo = userPermisos.includes(sub.id);
                                  return (
                                    <label key={sub.id} className={`flex items-center gap-2 text-[10px] font-bold cursor-pointer transition-colors ${subActivo ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'}`}>
                                      <input 
                                        type="checkbox" 
                                        checked={subActivo}
                                        disabled={!moduloActivo} // Si el padre está apagado, no puedes prender el hijo
                                        onChange={async (e) => {
                                          const isChecked = e.target.checked;
                                          let nuevosPermisos = [...userPermisos];
                                          
                                          if (isChecked) nuevosPermisos.push(sub.id);
                                          else nuevosPermisos = nuevosPermisos.filter(p => p !== sub.id);

                                          try {
                                            const userRef = doc(db, 'usuarios', u.id);
                                            await updateDoc(userRef, { permisos: nuevosPermisos });
                                            setUsuarios(prev => prev.map(usr => usr.id === u.id ? { ...usr, permisos: nuevosPermisos } : usr));
                                          } catch (error) {
                                            console.error("Error actualizando permiso:", error);
                                            alert("❌ No se pudo guardar el permiso en la base de datos.");
                                          }
                                        }}
                                        className="w-3 h-3 text-emerald-500 rounded focus:ring-emerald-400 disabled:opacity-50 cursor-pointer"
                                      />
                                      {sub.label}
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200">
        <div className="flex justify-between items-center">
           <div>
              <h3 className="font-black text-amber-900 uppercase tracking-widest text-sm mb-1">🚀 Forzar Actualización de Cronograma (NUEVO)</h3>
              <p className="text-xs text-amber-700 max-w-2xl">Utiliza este botón para borrar el cronograma de prueba antiguo de tu base de datos y cargar automáticamente los <b>procesos auditables</b> oficiales de Termales Santa Rosa.</p>
           </div>
           <button onClick={forceUpdateCronograma} className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all">
             Cargar Procesos
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* BOTON PARA IMPORTAR MATRIZ RIESGOS DESDE EXCEL */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-600">
          <h3 className="font-black text-emerald-700 uppercase tracking-widest text-sm mb-4">📊 Cargar Matriz de Riesgos (Excel)</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo .xlsx para actualizar masivamente <b>solo la Matriz de Riesgos</b>. Asegúrate de usar la plantilla descargada previamente.</p>
          <label className="block w-full cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-emerald-200 transition-all">
            Seleccionar Archivo Excel o CSV
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcelRiesgos} />
          </label>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm mb-4">📥 Exportar Backup (Descarga)</h3>
          <p className="text-xs text-slate-600 mb-6">Descarga una copia completa de toda tu base de datos actual en formato JSON. Útil para tener respaldos de seguridad o para editar los datos masivamente en un editor de texto o Excel.</p>
          <button onClick={exportToJSON} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-widest py-3 rounded-xl shadow-md transition-all">
            Descargar Base de Datos (.JSON)
          </button>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 border-t-4 border-t-red-600">
          <h3 className="font-black text-red-600 uppercase tracking-widest text-sm mb-4">📤 Carga Masiva Completa DB</h3>
          <p className="text-xs text-slate-600 mb-6">Sube un archivo JSON con la estructura correcta para actualizar masivamente. <b>ADVERTENCIA:</b> Esta acción borrará todos los datos actuales de todos los módulos.</p>
          
          <label className="block w-full cursor-pointer bg-red-50 hover:bg-red-100 text-red-700 font-black uppercase tracking-widest py-3 text-center rounded-xl shadow-sm border border-red-200 transition-all">
            Seleccionar Archivo JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          </label>
        </div>
      </div>
      
      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-200">
        <h3 className="font-black text-blue-800 uppercase tracking-widest text-sm mb-2">💡 ¿Cómo hacer una carga masiva desde Excel?</h3>
        <ol className="list-decimal pl-5 text-xs text-blue-900 space-y-2 mt-4 font-medium">
          <li>Ve a la pestaña <b>Matriz de Riesgos</b> y presiona el botón de <b>Exportar</b> para obtener la estructura actual en Excel.</li>
          <li>Abre el Excel y agrega tus cientos de filas nuevas en el Excel asegurándote de no cambiar los nombres de las columnas (ej. <i>id, proceso, sede</i>).</li>
          <li>Ve a esta pestaña de Configuración y usa el botón verde <b>Cargar Matriz de Riesgos (Excel)</b> para subir el archivo actualizado.</li>
        </ol>
      </div>
    </div>
  );
}