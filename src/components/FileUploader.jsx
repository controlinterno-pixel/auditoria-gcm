import React, { useState } from 'react';
import { useDataFetching } from '../hooks/useDataFetching';
import { apiService } from '../services/apiService';

/**
 * ☁️ FileUploader - Componente Reutilizable para la Bóveda de Termales
 */
export default function FileUploader({
  label = "Soporte / Evidencia",
  subtext = "Sube fotografías, actas o documentos en formato PDF o Imagen.",
  fileUrl = "",
  onUploadSuccess,
  accept = ".pdf, .jpg, .jpeg, .png, .docx",
  maxSizeMB = 10,
  themeColor = "emerald", // "emerald" | "red" | "purple" | "blue"
  description = "Soporte adjunto desde Control Interno"
}) {
  const { isLoading, error, ejecutarPeticion } = useDataFetching();
  const [toast, setToast] = useState(null);

  // Helper para mostrar alertas suaves
  const triggerToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Configuración de paletas dinámicas
  const themes = {
    emerald: {
      border: "border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50",
      badge: "bg-emerald-50 text-emerald-700",
      bar: "bg-emerald-500",
      text: "group-hover:text-emerald-700",
      icon: "✅"
    },
    red: {
      border: "border-red-300 hover:border-red-500 hover:bg-red-50/50",
      badge: "bg-red-50 text-red-700",
      bar: "bg-red-500",
      text: "group-hover:text-red-700",
      icon: "✅"
    },
    purple: {
      border: "border-purple-300 hover:border-purple-500 hover:bg-purple-50/50",
      badge: "bg-purple-50 text-purple-700",
      bar: "bg-purple-500",
      text: "group-hover:text-purple-700",
      icon: "✅"
    },
    blue: {
      border: "border-blue-300 hover:border-blue-500 hover:bg-blue-50/50",
      badge: "bg-blue-50 text-blue-700",
      bar: "bg-blue-500",
      text: "group-hover:text-blue-700",
      icon: "✅"
    }
  };

  const currentTheme = themes[themeColor] || themes.emerald;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Guardián de Tamaño
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      triggerToast(`⚠️ El archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)}MB. El máximo permitido es ${maxSizeMB}MB.`, "error");
      e.target.value = "";
      return;
    }

    // 2. Envío a través de apiService y Hook
    try {
      const data = await ejecutarPeticion(
        apiService.subirEvidencia(file, {
          appName: 'controlInterno',
          description: description
        })
      );

      const urlFinal = `https://repos.termalessantarosa.com.co/api/archivos/auditoria/${data.appName}/${data.fileName}`;
      onUploadSuccess(urlFinal);
      triggerToast("🎉 ¡Soporte subido exitosamente al servidor!", "success");
    } catch (err) {
      triggerToast("❌ No se pudo conectar con el servidor de archivos.", "error");
    }
  };

  return (
    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner relative">
      
      {/* Toast Flotante */}
      {toast && (
        <div className={`absolute top-2 right-2 z-50 px-3 py-1.5 rounded-lg text-[10px] font-black shadow-md animate-in fade-in slide-in-from-top-1 ${
          toast.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Cabecera */}
      <div className="border-b pb-2 border-slate-200 flex justify-between items-center mb-3">
        <div>
          <label className="font-black text-slate-700 uppercase tracking-widest text-[11px]">{label}</label>
          <p className="text-[9px] text-slate-500 font-medium">{subtext}</p>
        </div>
        <div className="text-slate-300 text-2xl">☁️</div>
      </div>

      {/* Caja Dropzone */}
      <div className={`bg-white border-2 border-dashed ${currentTheme.border} p-5 rounded-2xl text-center relative transition-all flex flex-col items-center justify-center min-h-[140px] shadow-sm`}>
        {isLoading ? (
          <div className="space-y-3 w-full">
            <div className="text-3xl animate-bounce">🚀</div>
            <div className="w-full bg-slate-100 rounded-full h-2 max-w-[80%] mx-auto overflow-hidden">
              <div className={`${currentTheme.bar} h-2 rounded-full w-full animate-pulse`}></div>
            </div>
            <p className="text-[9px] font-bold text-slate-500 animate-pulse">Subiendo archivo al repositorio...</p>
          </div>
        ) : fileUrl ? (
          <div className="space-y-2">
            <div className="text-3xl">{currentTheme.icon}</div>
            <a href={fileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1 rounded-md inline-block">
              Ver Documento Cargado
            </a>
            <label className="block mt-2 cursor-pointer text-slate-400 hover:text-slate-600 text-[9px] font-bold uppercase tracking-wider underline transition-colors">
              Reemplazar Archivo
              <input type="file" className="hidden" accept={accept} onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center space-y-2 group w-full">
            <div className="text-3xl opacity-50 group-hover:scale-110 transition-transform">📂</div>
            <p className={`text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-1.5 rounded-lg ${currentTheme.badge} transition-colors`}>
              Seleccionar Archivo (Máx {maxSizeMB}MB)
            </p>
            <input type="file" className="hidden" accept={accept} onChange={handleFileChange} />
          </label>
        )}

        {error && <p className="text-red-500 text-[9px] mt-2 font-bold">{error}</p>}
      </div>
    </div>
  );
}