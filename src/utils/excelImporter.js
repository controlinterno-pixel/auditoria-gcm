// src/utils/excelImporter.js

export const processExcelRiesgos = ({
  event,
  safeRiesgos,
  setRiesgos,
  saveToCloud,
  showNotification,
  setIsCloudLoaded,
  user
}) => {
  if (!window.XLSX) {
    showNotification("La librería de Excel aún no ha cargado. Intenta de nuevo en unos segundos.", "error");
    return;
  }
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = window.XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = window.XLSX.utils.sheet_to_json(worksheet);

      const extraerNivel = (val) => {
        if (!val) return 1;
        if (typeof val === 'number') return val > 5 ? Math.ceil(val / 20) : val;
        const str = String(val).toLowerCase();
        const match = str.match(/nivel\s*(\d)/);
        if (match) return parseInt(match[1], 10);
        
        if (str.includes('1') || str.includes('rara') || str.includes('baja') || str.includes('insignificante')) return 1;
        if (str.includes('2') || str.includes('improbable') || str.includes('menor')) return 2;
        if (str.includes('3') || str.includes('posible') || str.includes('media') || str.includes('moderado')) return 3;
        if (str.includes('4') || str.includes('probable') || str.includes('alta') || str.includes('mayor')) return 4;
        if (str.includes('5') || str.includes('seguro') || str.includes('extrema') || str.includes('catastr')) return 5;
        return 1;
      };

      if (window.confirm("⚠️ ALERTA: ¿Deseas cargar esta Matriz de Riesgos? Reemplazará los riesgos actuales para NO acumular basura.")) {
        setIsCloudLoaded(false);
        const riesgosAgrupados = {};

        json.forEach((r, index) => {
          const idRaw = r['NO'] || r['No'] || r['ID'] || r['Id'] || r['id'] || (Date.now() + index);
          const idRiesgo = parseInt(idRaw) || idRaw;
          const riesgoExistente = safeRiesgos?.find(existente => String(existente.id) === String(idRiesgo)) || {};

          if (!riesgosAgrupados[idRiesgo]) {
            riesgosAgrupados[idRiesgo] = {
              ...riesgoExistente, 
              id: idRiesgo,
              sede: r['Sede'] || riesgoExistente.sede || 'Administrativos',
              proceso: r['PROCESO/SUBPROCESO'] || r['Proceso'] || riesgoExistente.proceso || 'Proceso General',
              categoria: r['CATEGORÍA'] || r['Categoría'] || riesgoExistente.categoria || 'Operativo',
              clasificacionRiesgo: r['CLASIFICACIÓN DEL RIESGO'] || r['Clasificación del riesgo'] || riesgoExistente.clasificacionRiesgo || 'Ejecución',
              normativa: riesgoExistente.normativa || 'Interna',
              responsable: r['RESPONSABLE'] || r['Responsable'] || riesgoExistente.responsable || 'Sin Asignar',
              descripcion: r['DESCRIPCIÓN DEL RIESGO'] || r['Descripción'] || riesgoExistente.descripcion || '',
              causa: r['CAUSA INMEDIATA'] || r['CAUSA RAÍZ'] || r['Causas'] || riesgoExistente.causa || '',
              
              probabilidadInherente: extraerNivel(r['PROBABILIDAD INHERENTE'] || riesgoExistente.probabilidadInherente),
              impactoInherente: extraerNivel(r['IMPACTO INHERENTE'] || riesgoExistente.impactoInherente),
              probabilidadResidual: extraerNivel(r['PROBABILIDAD RESIDUAL FINAL'] || riesgoExistente.probabilidadResidual),
              impactoResidual: extraerNivel(r['IMPACTO RESIDUAL FINAL'] || riesgoExistente.impactoResidual),
              
              noControl: r['NO. CONTROL'] || riesgoExistente.noControl || '',
              descripcionControl: r['DESCRIPCIÓN DEL CONTROL'] || riesgoExistente.descripcionControl || '',

              capacidadRiesgo: riesgoExistente.capacidadRiesgo || 0,
              toleranciaFinanciera: riesgoExistente.toleranciaFinanciera || 0,
              apetitoFinanciero: riesgoExistente.apetitoFinanciero || 0,
              posturaEstrategica: riesgoExistente.posturaEstrategica || 'No definida',
              kriScore: riesgoExistente.kriScore || 0,
              impactoOperativo: riesgoExistente.impactoOperativo || 'No definido',
              impactoReputacional: riesgoExistente.impactoReputacional || 'No definido',
              impactoLegal: riesgoExistente.impactoLegal || 'No definido',
              escalamiento: riesgoExistente.escalamiento || 'Jefe de Área',
              anio: riesgoExistente.anio || new Date().getFullYear(),
              mes: riesgoExistente.mes || "Julio",
              historialCambios: [...(riesgoExistente.historialCambios || []), { fecha: new Date().toLocaleString(), usuario: user?.email || 'Sistema', accion: 'Actualizado vía Carga Masiva (Excel)' }]
            };
          }
        });

        const nuevosRiesgos = Object.values(riesgosAgrupados);
        setRiesgos(nuevosRiesgos);
        await saveToCloud({ riesgos: nuevosRiesgos });
        showNotification(`Éxito: Matriz cargada. Los datos obsoletos fueron eliminados.`, "success");
        setIsCloudLoaded(true);
      }
    } catch (error) {
      console.error(error);
      showNotification("Error al procesar el archivo. Verifica el formato.", "error");
      setIsCloudLoaded(true);
    }
    event.target.value = null;
  };
  reader.readAsArrayBuffer(file);
};