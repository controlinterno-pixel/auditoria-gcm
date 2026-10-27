// src/components/proyectos/GestionProyectos.jsx - Módulo Gestión de Proyectos (Gobernanza & IA).
// El portafolio y el detalle se leen solo al entrar o al abrir un proyecto; no hay listeners en tiempo real.
import { ContextoGuia } from './guias.js';
import { useState } from 'react';
import { apiService } from '../../services/apiService';
import { useCatalogos } from '../../context/useCatalogos';
import { usePortafolio } from './useProyectos.js';
import PortafolioProyectos from './PortafolioProyectos.jsx';
import ProyectoDetalle from './ProyectoDetalle.jsx';
import FormularioProyecto from './FormularioProyecto.jsx';

export default function GestionProyectos({ usuario, puedeCrear, showNotification, riesgosMatriz = [] }) {
  const [incluirArchivados, setIncluirArchivados] = useState(false);
  const { proyectos, hoy, cargando, error, recargar } = usePortafolio(incluirArchivados);
  const [abierto, setAbierto] = useState(null);
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const { mapaProcesos } = useCatalogos();

  const crear = async datos => {
    setGuardando(true);
    try {
      const respuesta = await apiService.operarProyecto('crear', null, datos);
      showNotification?.(`Proyecto ${respuesta.proyecto.codigo} creado.`, 'success');
      setCreando(false);
      void recargar();
      setAbierto(respuesta.proyecto.id);
    } catch (falla) {
      showNotification?.(falla?.message || 'No se pudo crear el proyecto.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      {abierto ? (
        <ProyectoDetalle id={abierto} usuario={usuario} showNotification={showNotification} mapaProcesos={mapaProcesos} riesgosMatriz={riesgosMatriz}
          onVolver={() => { setAbierto(null); void recargar(); }} />
      ) : (
        <ContextoGuia.Provider value="filtro"><PortafolioProyectos proyectos={proyectos} hoy={hoy} cargando={cargando} error={error} onAbrir={setAbierto} onNuevo={() => setCreando(true)}
          puedeCrear={puedeCrear} incluirArchivados={incluirArchivados} setIncluirArchivados={setIncluirArchivados} onRecargar={recargar} /></ContextoGuia.Provider>
      )}
      {creando && <FormularioProyecto usuario={usuario} guardando={guardando} mapaProcesos={mapaProcesos} onCerrar={() => setCreando(false)} onGuardar={crear} />}
    </div>
  );
}
